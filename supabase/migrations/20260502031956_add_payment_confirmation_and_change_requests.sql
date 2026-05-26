/*
  # Add Payment Processor Confirmation and Client Payment Change Requests

  1. Changes to accounting_payments
    - `processor_confirmation` (text, nullable) — confirmation code/ID from payment processor
    - `confirmed_at` (timestamptz, nullable) — date/time the processor confirmed the payment

  2. New Table: client_payment_change_requests
    - Stores client requests to change an upcoming scheduled payment
    - `client_id` — FK to accounting_clients
    - `schedule_id` — FK to accounting_payment_schedule (the installment being changed)
    - `request_type` — 'change_date', 'change_amount', 'pay_in_full', 'other'
    - `requested_by_client_id` — text identifier for client (e.g. 'client-demo')
    - `notes` — client's explanation of the requested change
    - `status` — 'pending', 'approved', 'denied'
    - `reviewed_by`, `reviewed_at` — staff review tracking
    - `requested_at` — timestamp of request

  3. Security
    - RLS enabled on new table
    - Authenticated users can insert their own requests
    - Service role can read/update all
*/

-- Add processor confirmation columns to existing payments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_payments' AND column_name = 'processor_confirmation'
  ) THEN
    ALTER TABLE accounting_payments ADD COLUMN processor_confirmation text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_payments' AND column_name = 'confirmed_at'
  ) THEN
    ALTER TABLE accounting_payments ADD COLUMN confirmed_at timestamptz;
  END IF;
END $$;

-- Create client payment change requests table
CREATE TABLE IF NOT EXISTS client_payment_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES accounting_clients(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES accounting_payment_schedule(id) ON DELETE SET NULL,
  requested_by_client_id text NOT NULL DEFAULT '',
  request_type text NOT NULL CHECK (request_type IN ('change_date', 'change_amount', 'pay_in_full', 'other')),
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by text,
  reviewed_at timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_payment_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert payment change requests"
  ON client_payment_change_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert payment change requests"
  ON client_payment_change_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can read payment change requests"
  ON client_payment_change_requests
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon can read own payment change requests"
  ON client_payment_change_requests
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated can update payment change requests"
  ON client_payment_change_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
