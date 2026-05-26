/*
  # Accounting: State Accounts, Payment Account Mapping, and Transfer Notices

  ## Overview
  Extends the accounting portal with:
  1. State-specific operating and IOLTA trust accounts (AZ, WA, TX)
  2. Payment-to-account mapping rules based on chapter, case type, and payment type
  3. Fund transfer notices for accounting admins (e.g., when a filed Ch.7 case
     filing fee held in IOLTA can be moved to operating after 48 hrs)
  4. Transfer log to record actual fund movements between accounts

  ## New Tables

  ### `accounting_state_accounts`
  One operating account and one IOLTA trust account per state.
  - state: 2-letter code (AZ, WA, TX)
  - account_type: 'operating' or 'iolta'
  - account_name: display name
  - balance: running balance (informational; real balance is authoritative at bank)

  ### `accounting_payment_account_map`
  Records which account each payment was deposited into.
  - payment_id (FK → accounting_payments)
  - state_account_id (FK → accounting_state_accounts)
  - mapped_at: timestamp

  ### `accounting_transfer_notices`
  Pending admin notices to move funds between accounts (e.g., filing fee from IOLTA → operating).
  - client_id (FK → accounting_clients)
  - from_account_id, to_account_id (FK → accounting_state_accounts)
  - amount
  - reason: text description of why transfer is triggered
  - status: 'pending' | 'approved' | 'dismissed'
  - triggered_at: when the notice was generated (case filed + 48h)
  - approved_by, approved_at, dismissed_by, dismissed_at

  ### `accounting_transfers`
  Completed fund transfers between accounts.
  - from_account_id, to_account_id
  - amount, transfer_date
  - notice_id (optional FK to the notice that triggered it)
  - performed_by, notes

  ## Business Rules Encoded
  - Ch.7 Regular: attorney_fee → operating; court_filing_fee → IOLTA until filed+48h then → operating
  - Ch.7 Bifurcated: attorney_fee → IOLTA until filed+48h then → operating; court_filing_fee → IOLTA until filed+48h
  - Ch.13 Flat Fee: upfront attorney_fee → operating; court_filing_fee → IOLTA; plan_payment → operating
  - Ch.13 Hourly: retainer → IOLTA; invoiced amounts drawn from IOLTA to operating

  ## Security
  RLS enabled. Anon access for portal use (firm-internal).
*/

-- ── accounting_state_accounts ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_state_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state char(2) NOT NULL CHECK (state IN ('AZ', 'WA', 'TX')),
  account_type text NOT NULL CHECK (account_type IN ('operating', 'iolta')),
  account_name text NOT NULL,
  bank_name text,
  account_last4 text,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (state, account_type)
);

ALTER TABLE accounting_state_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read accounting_state_accounts"
  ON accounting_state_accounts FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert accounting_state_accounts"
  ON accounting_state_accounts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update accounting_state_accounts"
  ON accounting_state_accounts FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Seed state accounts for AZ, WA, TX
INSERT INTO accounting_state_accounts (state, account_type, account_name, bank_name, balance)
VALUES
  ('AZ', 'operating', 'MajorsLaw AZ Operating', 'Chase Bank', 0),
  ('AZ', 'iolta',     'MajorsLaw AZ IOLTA Trust', 'Chase Bank', 0),
  ('WA', 'operating', 'MajorsLaw WA Operating', 'Wells Fargo', 0),
  ('WA', 'iolta',     'MajorsLaw WA IOLTA Trust', 'Wells Fargo', 0),
  ('TX', 'operating', 'MajorsLaw TX Operating', 'Bank of America', 0),
  ('TX', 'iolta',     'MajorsLaw TX IOLTA Trust', 'Bank of America', 0)
ON CONFLICT (state, account_type) DO NOTHING;

-- ── accounting_payment_account_map ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_payment_account_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES accounting_payments(id) ON DELETE CASCADE,
  state_account_id uuid NOT NULL REFERENCES accounting_state_accounts(id),
  mapped_at timestamptz DEFAULT now(),
  UNIQUE (payment_id)
);

ALTER TABLE accounting_payment_account_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read accounting_payment_account_map"
  ON accounting_payment_account_map FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert accounting_payment_account_map"
  ON accounting_payment_account_map FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update accounting_payment_account_map"
  ON accounting_payment_account_map FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── accounting_transfer_notices ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_transfer_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES accounting_clients(id) ON DELETE CASCADE,
  from_account_id uuid NOT NULL REFERENCES accounting_state_accounts(id),
  to_account_id uuid NOT NULL REFERENCES accounting_state_accounts(id),
  amount numeric(10,2) NOT NULL,
  reason text NOT NULL,
  notice_type text NOT NULL DEFAULT 'filing_fee_release'
    CHECK (notice_type IN ('filing_fee_release', 'attorney_fee_release', 'manual')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'dismissed')),
  triggered_at timestamptz NOT NULL DEFAULT now(),
  eligible_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  dismissed_by text,
  dismissed_at timestamptz,
  dismiss_reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE accounting_transfer_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read accounting_transfer_notices"
  ON accounting_transfer_notices FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert accounting_transfer_notices"
  ON accounting_transfer_notices FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update accounting_transfer_notices"
  ON accounting_transfer_notices FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── accounting_transfers ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id uuid NOT NULL REFERENCES accounting_state_accounts(id),
  to_account_id uuid NOT NULL REFERENCES accounting_state_accounts(id),
  amount numeric(10,2) NOT NULL,
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  notice_id uuid REFERENCES accounting_transfer_notices(id),
  client_id uuid REFERENCES accounting_clients(id),
  performed_by text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE accounting_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read accounting_transfers"
  ON accounting_transfers FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert accounting_transfers"
  ON accounting_transfers FOR INSERT TO anon WITH CHECK (true);

-- ── indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_transfer_notices_status ON accounting_transfer_notices(status);
CREATE INDEX IF NOT EXISTS idx_transfer_notices_client ON accounting_transfer_notices(client_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from ON accounting_transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to ON accounting_transfers(to_account_id);
CREATE INDEX IF NOT EXISTS idx_pay_map_payment ON accounting_payment_account_map(payment_id);

-- ── Add is_admin column to accounting context (for role-based UI) ────────────
-- We track admin role in the UI session; no auth table changes needed.
-- The accounting_transfer_notices.approved_by field stores the admin's name.
