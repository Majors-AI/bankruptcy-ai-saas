/*
  # Trust Accounts, Account Mapping, and Transfer Notifications

  ## Overview
  Adds per-state operating and IOLTA trust accounts for AZ, WA, TX.
  Adds account destination mapping to payment records (destination_account, account_state).
  Adds filing fee transfer notification system: when a case is filed and 48 hours have
  passed, accounting admin is notified to move court filing fee from IOLTA to operating.
  Adds admin role columns to payments for audit trail.

  ## New Tables
  - `accounting_trust_accounts`: per-state operating + IOLTA accounts (AZ, WA, TX)
  - `accounting_fund_transfers`: records of money moved between accounts
  - `accounting_transfer_notifications`: pending admin actions for filing fee releases

  ## Modified Tables
  - `accounting_payments`: adds destination_account, account_state, posted_to_account_id,
    is_admin_action, admin_actor

  ## Security
  - RLS enabled on all new tables, anon access permitted (firm-internal portal)
*/

-- ── accounting_trust_accounts ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_trust_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state char(2) NOT NULL CHECK (state IN ('AZ', 'WA', 'TX')),
  account_type text NOT NULL CHECK (account_type IN ('operating', 'iolta')),
  account_name text NOT NULL,
  account_number_last4 char(4),
  bank_name text,
  current_balance numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (state, account_type)
);

ALTER TABLE accounting_trust_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read accounting_trust_accounts"
  ON accounting_trust_accounts FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert accounting_trust_accounts"
  ON accounting_trust_accounts FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update accounting_trust_accounts"
  ON accounting_trust_accounts FOR UPDATE TO anon USING (true) WITH CHECK (true);

INSERT INTO accounting_trust_accounts (state, account_type, account_name, bank_name, current_balance)
VALUES
  ('AZ', 'operating', 'MajorsLaw AZ Operating Account',    'Chase Bank',      0),
  ('AZ', 'iolta',     'MajorsLaw AZ IOLTA Trust Account',  'Chase Bank',      0),
  ('WA', 'operating', 'MajorsLaw WA Operating Account',    'Wells Fargo',     0),
  ('WA', 'iolta',     'MajorsLaw WA IOLTA Trust Account',  'Wells Fargo',     0),
  ('TX', 'operating', 'MajorsLaw TX Operating Account',    'Bank of America', 0),
  ('TX', 'iolta',     'MajorsLaw TX IOLTA Trust Account',  'Bank of America', 0)
ON CONFLICT (state, account_type) DO NOTHING;

-- ── accounting_fund_transfers ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_fund_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id uuid NOT NULL REFERENCES accounting_trust_accounts(id),
  to_account_id uuid NOT NULL REFERENCES accounting_trust_accounts(id),
  amount numeric(10,2) NOT NULL,
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL DEFAULT '',
  related_client_id uuid REFERENCES accounting_clients(id),
  related_payment_id uuid REFERENCES accounting_payments(id),
  executed_by text NOT NULL,
  status text NOT NULL DEFAULT 'executed' CHECK (status IN ('pending', 'executed', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE accounting_fund_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read accounting_fund_transfers"
  ON accounting_fund_transfers FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert accounting_fund_transfers"
  ON accounting_fund_transfers FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update accounting_fund_transfers"
  ON accounting_fund_transfers FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── accounting_transfer_notifications ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_transfer_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES accounting_clients(id) ON DELETE CASCADE,
  case_number text NOT NULL,
  filed_date date NOT NULL,
  amount numeric(10,2) NOT NULL,
  state char(2) NOT NULL,
  notify_after timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'actioned', 'dismissed')),
  actioned_by text,
  actioned_at timestamptz,
  transfer_id uuid REFERENCES accounting_fund_transfers(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE accounting_transfer_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read accounting_transfer_notifications"
  ON accounting_transfer_notifications FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert accounting_transfer_notifications"
  ON accounting_transfer_notifications FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update accounting_transfer_notifications"
  ON accounting_transfer_notifications FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── Add columns to accounting_payments ───────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_payments' AND column_name = 'destination_account'
  ) THEN
    ALTER TABLE accounting_payments
      ADD COLUMN destination_account text DEFAULT 'operating'
        CHECK (destination_account IN ('operating', 'iolta')),
      ADD COLUMN account_state char(2),
      ADD COLUMN posted_to_account_id uuid REFERENCES accounting_trust_accounts(id),
      ADD COLUMN is_admin_action boolean NOT NULL DEFAULT false,
      ADD COLUMN admin_actor text;
  END IF;
END $$;

-- ── indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_notifications_status ON accounting_transfer_notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_client ON accounting_transfer_notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from ON accounting_fund_transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to ON accounting_fund_transfers(to_account_id);
CREATE INDEX IF NOT EXISTS idx_payments_destination ON accounting_payments(destination_account);
CREATE INDEX IF NOT EXISTS idx_payments_acct_state ON accounting_payments(account_state);

-- ── Seed demo AZ filed client with pending transfer notification ──────────────

DO $$
DECLARE
  az_client uuid;
  wa_client uuid;
BEGIN
  -- AZ filed regular Ch.7 client
  INSERT INTO accounting_clients (client_id, full_name, email, state, chapter, case_type, status, intake_date, filed_date, case_number)
  VALUES ('client-az-001', 'Robert H. Mendez', 'rmendez@email.com', 'AZ', 7, 'regular', 'filed', '2026-03-10', '2026-04-28', '2:26-bk-04812')
  ON CONFLICT DO NOTHING;

  SELECT id INTO az_client FROM accounting_clients WHERE client_id = 'client-az-001' LIMIT 1;

  INSERT INTO accounting_fee_structures (client_id, attorney_fee, court_filing_fee, payment_frequency)
  VALUES (az_client, 1500, 338, 'paid_in_full')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounting_payments (client_id, amount, payment_date, payment_method, payment_type, is_iolta, destination_account, account_state, notes)
  VALUES
    (az_client, 1500, '2026-03-15', 'check', 'attorney_fee',    false, 'operating', 'AZ', 'Attorney fee — AZ operating account'),
    (az_client, 338,  '2026-03-15', 'check', 'court_filing_fee', true, 'iolta',     'AZ', 'Court filing fee — AZ IOLTA, pending 48hr release')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounting_transfer_notifications (client_id, case_number, filed_date, amount, state, notify_after, status)
  VALUES (az_client, '2:26-bk-04812', '2026-04-28', 338, 'AZ',
          ('2026-04-28'::date + interval '48 hours')::timestamptz, 'pending')
  ON CONFLICT DO NOTHING;

  -- WA filed bifurcated Ch.7 client
  INSERT INTO accounting_clients (client_id, full_name, email, state, chapter, case_type, status, intake_date, filed_date, case_number)
  VALUES ('client-wa-001', 'Patricia A. Nguyen', 'pnguyen@email.com', 'WA', 7, 'bifurcated', 'filed', '2026-03-20', '2026-04-30', '2:26-bk-05103')
  ON CONFLICT DO NOTHING;

  SELECT id INTO wa_client FROM accounting_clients WHERE client_id = 'client-wa-001' LIMIT 1;

  INSERT INTO accounting_fee_structures (client_id, attorney_fee, court_filing_fee, payment_frequency, bifurcated_signing_threshold)
  VALUES (wa_client, 1500, 338, 'biweekly', 400)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounting_payments (client_id, amount, payment_date, payment_method, payment_type, is_iolta, destination_account, account_state, notes)
  VALUES
    (wa_client, 600, '2026-03-25', 'credit_card', 'attorney_fee',     false, 'operating', 'WA', 'Attorney fee installments — WA operating'),
    (wa_client, 338, '2026-03-25', 'check',       'court_filing_fee',  true, 'iolta',     'WA', 'Court filing fee — WA IOLTA, pending 48hr release')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounting_transfer_notifications (client_id, case_number, filed_date, amount, state, notify_after, status)
  VALUES (wa_client, '2:26-bk-05103', '2026-04-30', 338, 'WA',
          ('2026-04-30'::date + interval '48 hours')::timestamptz, 'pending')
  ON CONFLICT DO NOTHING;
END $$;
