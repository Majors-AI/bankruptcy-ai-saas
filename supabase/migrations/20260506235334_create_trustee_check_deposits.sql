/*
  # Trustee Check Deposits

  ## Purpose
  Tracks physical checks received from trustees (Chapter 13 plan payments,
  refunds, etc.) with photo evidence of the deposited check.

  ## New Tables

  ### trustee_check_deposits
  Records each check received from a trustee with:
  - `id` — UUID primary key
  - `client_id` — associated accounting client (nullable — some checks may be batch)
  - `client_name` — denormalized for display
  - `trustee_name` — name of the trustee who issued the check
  - `trustee_state` — AZ, WA, TX
  - `check_number` — check number from the check itself
  - `check_date` — date printed on the check
  - `amount` — dollar amount of the check
  - `destination_account` — 'operating' or 'iolta'
  - `deposit_date` — date deposited at bank
  - `deposited_by` — staff member who made the deposit
  - `bank_name` — bank where deposited
  - `deposit_confirmation` — bank confirmation / deposit slip number
  - `check_image_url` — URL of photo of the check stored in Supabase storage
  - `check_image_back_url` — URL of photo of back of check (endorsement)
  - `deposit_slip_url` — URL of photo of deposit slip
  - `payment_type` — 'plan_payment' | 'refund' | 'disbursement' | 'other'
  - `notes` — internal notes
  - `linked_payment_id` — links to accounting_payments record if already recorded
  - `status` — 'pending_deposit' | 'deposited' | 'reconciled' | 'returned'
  - `created_at`
  - `updated_at`

  ## Storage
  A public storage bucket `check-images` should be used for check photos.

  ## Security
  - RLS enabled
  - Anon SELECT/INSERT/UPDATE (consistent with rest of project)
*/

CREATE TABLE IF NOT EXISTS trustee_check_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  client_name text,
  trustee_name text NOT NULL,
  trustee_state text,
  check_number text,
  check_date date,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  destination_account text NOT NULL DEFAULT 'iolta' CHECK (destination_account IN ('operating', 'iolta')),
  deposit_date date,
  deposited_by text,
  bank_name text,
  deposit_confirmation text,
  check_image_url text,
  check_image_back_url text,
  deposit_slip_url text,
  payment_type text NOT NULL DEFAULT 'plan_payment' CHECK (payment_type IN ('plan_payment', 'refund', 'disbursement', 'other')),
  notes text,
  linked_payment_id uuid,
  status text NOT NULL DEFAULT 'pending_deposit' CHECK (status IN ('pending_deposit', 'deposited', 'reconciled', 'returned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trustee_check_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read trustee check deposits"
  ON trustee_check_deposits FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert trustee check deposits"
  ON trustee_check_deposits FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update trustee check deposits"
  ON trustee_check_deposits FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_trustee_checks_client ON trustee_check_deposits(client_id);
CREATE INDEX IF NOT EXISTS idx_trustee_checks_deposit_date ON trustee_check_deposits(deposit_date);
CREATE INDEX IF NOT EXISTS idx_trustee_checks_status ON trustee_check_deposits(status);
