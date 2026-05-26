/*
  # Account Mapping & Fund Movement Notices

  ## Overview
  Adds destination account tracking to payments (Operating vs. IOLTA Trust),
  and a notices table for alerting staff when filing fees held in IOLTA become
  eligible for transfer to the operating account (48 hours after case filing).

  ## Changes to Existing Tables

  ### `accounting_payments`
  - Add `destination_account` column: 'operating' or 'iolta'
    - Ch.7 Regular attorney fees → 'operating'
    - Ch.7 Regular court filing fees → 'iolta' (until case is filed + 48hrs)
    - Bifurcated attorney fees → 'operating'
    - Bifurcated court filing fees → 'iolta'
    - Ch.13 flat fee attorney fees → 'operating'
    - Ch.13 court filing fees → 'iolta'
    - Ch.13 hourly retainer → 'iolta'

  ## New Tables

  ### `accounting_fund_notices`
  Tracks notices generated when IOLTA-held filing fees become eligible
  for transfer to the operating account (48 hours after case is filed).
  - client_id, notice_type ('filing_fee_transfer_ready')
  - filing_fee_amount: amount held in IOLTA eligible to move
  - filed_at: when the case was filed
  - eligible_at: filed_at + 48 hours
  - acknowledged: bool, acknowledged_at, acknowledged_by
  - transferred: bool, transferred_at, transferred_by

  ## Security
  - RLS enabled, anon access for internal portal use
*/

-- Add destination_account to payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_payments' AND column_name = 'destination_account'
  ) THEN
    ALTER TABLE accounting_payments
      ADD COLUMN destination_account text NOT NULL DEFAULT 'operating'
      CHECK (destination_account IN ('operating', 'iolta'));
  END IF;
END $$;

-- Backfill: any existing payment with is_iolta=true → 'iolta'
UPDATE accounting_payments
SET destination_account = 'iolta'
WHERE is_iolta = true AND destination_account = 'operating';

-- Backfill: court_filing_fee payments → 'iolta' (always held until filed)
UPDATE accounting_payments
SET destination_account = 'iolta'
WHERE payment_type = 'court_filing_fee' AND destination_account = 'operating';

-- Add filing_fee_iolta_balance to fee structures to track held filing fees separately
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_fee_structures' AND column_name = 'filing_fee_iolta_balance'
  ) THEN
    ALTER TABLE accounting_fee_structures
      ADD COLUMN filing_fee_iolta_balance numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Backfill filing_fee_iolta_balance from existing court_filing_fee payments
UPDATE accounting_fee_structures afs
SET filing_fee_iolta_balance = COALESCE((
  SELECT SUM(p.amount)
  FROM accounting_payments p
  WHERE p.client_id = afs.client_id
    AND p.payment_type = 'court_filing_fee'
    AND p.voided = false
), 0);

-- Fund transfer notices table
CREATE TABLE IF NOT EXISTS accounting_fund_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES accounting_clients(id) ON DELETE CASCADE,
  notice_type text NOT NULL DEFAULT 'filing_fee_transfer_ready'
    CHECK (notice_type IN ('filing_fee_transfer_ready')),
  filing_fee_amount numeric(10,2) NOT NULL DEFAULT 0,
  filed_at timestamptz NOT NULL,
  eligible_at timestamptz NOT NULL,
  case_number text,
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_at timestamptz,
  acknowledged_by text,
  transferred boolean NOT NULL DEFAULT false,
  transferred_at timestamptz,
  transferred_by text,
  transfer_ref text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE accounting_fund_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read accounting_fund_notices"
  ON accounting_fund_notices FOR SELECT
  TO anon USING (true);

CREATE POLICY "Anon can insert accounting_fund_notices"
  ON accounting_fund_notices FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Anon can update accounting_fund_notices"
  ON accounting_fund_notices FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_fund_notices_client ON accounting_fund_notices(client_id);
CREATE INDEX IF NOT EXISTS idx_fund_notices_eligible ON accounting_fund_notices(eligible_at);
CREATE INDEX IF NOT EXISTS idx_fund_notices_transferred ON accounting_fund_notices(transferred);

-- Seed a notice for demo client-002 (Regular Ch.7, filed Apr 10 2026 — more than 48hrs ago)
DO $$
DECLARE
  c2 uuid;
  fee_amt numeric;
BEGIN
  SELECT id INTO c2 FROM accounting_clients WHERE client_id = 'client-002';
  SELECT COALESCE(SUM(amount), 0) INTO fee_amt
    FROM accounting_payments
    WHERE client_id = c2 AND payment_type = 'court_filing_fee' AND voided = false;

  IF c2 IS NOT NULL AND fee_amt > 0 THEN
    INSERT INTO accounting_fund_notices (client_id, notice_type, filing_fee_amount, filed_at, eligible_at, case_number, acknowledged, transferred)
    VALUES (c2, 'filing_fee_transfer_ready', fee_amt, '2026-04-10T10:00:00Z', '2026-04-12T10:00:00Z', '26-BK-04421', false, false)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Seed a notice for client-006 (Regular Ch.7, filed Mar 1 2026 — already eligible, mark transferred)
DO $$
DECLARE
  c6 uuid;
  fee_amt numeric;
BEGIN
  SELECT id INTO c6 FROM accounting_clients WHERE client_id = 'client-006';
  SELECT COALESCE(SUM(amount), 0) INTO fee_amt
    FROM accounting_payments
    WHERE client_id = c6 AND payment_type = 'court_filing_fee' AND voided = false;

  IF c6 IS NOT NULL AND fee_amt > 0 THEN
    INSERT INTO accounting_fund_notices (client_id, notice_type, filing_fee_amount, filed_at, eligible_at, case_number, acknowledged, transferred, transferred_at, transferred_by)
    VALUES (c6, 'filing_fee_transfer_ready', fee_amt, '2026-03-01T10:00:00Z', '2026-03-03T10:00:00Z', '26-BK-02187', true, true, '2026-03-04T09:00:00Z', 'Admin')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
