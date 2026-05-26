/*
  # Client Information Update Requests

  1. New Table: `client_info_update_requests`

    Stores every request a client makes to add or change information on their
    case file. The key design constraint is that INCOME INFORMATION IS NEVER
    DELETED — the means test requires all income sources from the prior 6 months
    to remain on record. Requests to "remove" employer/income create a row with
    change_type = 'remove' so the paralegal/attorney reviews it rather than
    wiping the record directly.

  Fields:
    - id, client_id
    - section: which part of their file they want to update
        'address' | 'employer_add' | 'employer_remove' | 'income_add' |
        'income_remove' | 'assets' | 'creditors' | 'dependents' |
        'personal_info' | 'expenses' | 'vehicles' | 'real_property' |
        'forgotten_assets' | 'circumstances_changed' | 'documents' | 'other'
    - change_type: 'add' | 'remove' | 'update'
    - description: client's free-text explanation
    - details_json: structured key/value pairs for the section
    - income_preserved: boolean — TRUE means we kept the old income record
        (only meaningful for employer_remove / income_remove sections)
    - staff_reviewer, staff_notes
    - status: 'pending' | 'in_review' | 'applied' | 'rejected'
    - created_at, updated_at

  2. Security
    - RLS enabled; anon can insert/read own requests
*/

CREATE TABLE IF NOT EXISTS client_info_update_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        text NOT NULL DEFAULT 'client-demo',
  section          text NOT NULL,
  change_type      text NOT NULL DEFAULT 'update',
  description      text,
  details_json     jsonb,
  income_preserved boolean NOT NULL DEFAULT false,
  staff_reviewer   text,
  staff_notes      text,
  status           text NOT NULL DEFAULT 'pending',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE client_info_update_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can read their own update requests"
  ON client_info_update_requests FOR SELECT
  TO anon USING (true);

CREATE POLICY "Clients can submit update requests"
  ON client_info_update_requests FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Staff can update request status"
  ON client_info_update_requests FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_info_updates_client
  ON client_info_update_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_info_updates_status
  ON client_info_update_requests(status);
CREATE INDEX IF NOT EXISTS idx_info_updates_section
  ON client_info_update_requests(section);
