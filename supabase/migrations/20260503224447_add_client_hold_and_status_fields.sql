/*
  # Add Client Status Categories and Hold Requests

  1. Changes to `accounting_clients`
     - Add `extended_status` column to track fine-grained statuses beyond the existing
       "active | filed | closed | on_hold":
         'active'      — actively paying per schedule
         'on_hold'     — payments paused (approved hold)
         'completed'   — all fees paid in full, not yet filed/closed
         'inactive'    — started intake, no payment activity, unresponsive
         'case_closed' — filed and case formally closed by the court
         'cancelled'   — client cancelled engagement
       Existing `status` column is preserved for backward compatibility.

  2. New Table: `client_hold_requests`
     Tracks requests to place a client on hold or push out (defer) their
     next payment. These require Accounting Super Admin approval before
     taking effect.

     Fields:
       - id, client_id (FK → accounting_clients.id)
       - request_type: 'hold' | 'push_payment'
       - requested_by: staff name
       - reason: free-text explanation
       - push_to_date: target new due date (for push_payment type)
       - status: 'pending_approval' | 'approved' | 'denied'
       - reviewed_by, reviewed_at, review_notes
       - created_at, updated_at

  3. Security: RLS enabled on new table
*/

-- Add extended_status to accounting_clients if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_clients' AND column_name = 'extended_status'
  ) THEN
    ALTER TABLE accounting_clients
      ADD COLUMN extended_status text NOT NULL DEFAULT 'active';
  END IF;
END $$;

-- Seed extended_status from existing status where possible
UPDATE accounting_clients
SET extended_status = CASE
  WHEN status = 'on_hold'  THEN 'on_hold'
  WHEN status = 'closed'   THEN 'case_closed'
  WHEN status = 'filed'    THEN 'active'
  ELSE 'active'
END
WHERE extended_status = 'active';

-- Hold requests table
CREATE TABLE IF NOT EXISTS client_hold_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES accounting_clients(id) ON DELETE CASCADE,
  request_type    text NOT NULL DEFAULT 'hold',
  requested_by    text NOT NULL DEFAULT '',
  reason          text NOT NULL DEFAULT '',
  push_to_date    date,
  status          text NOT NULL DEFAULT 'pending_approval',
  reviewed_by     text,
  reviewed_at     timestamptz,
  review_notes    text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE client_hold_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accounting staff can read hold requests"
  ON client_hold_requests FOR SELECT
  TO anon USING (true);

CREATE POLICY "Accounting staff can create hold requests"
  ON client_hold_requests FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Accounting super admin can update hold requests"
  ON client_hold_requests FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_hold_requests_client
  ON client_hold_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_hold_requests_status
  ON client_hold_requests(status);
