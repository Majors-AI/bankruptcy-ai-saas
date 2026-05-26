/*
  # Accounting Portal Schema

  ## Overview
  Full accounting schema for law firm bankruptcy case management.
  Tracks clients, fee structures, payment schedules, and transactions
  across Chapter 7 (regular and bifurcated) and Chapter 13 (flat fee and hourly) cases.

  ## New Tables

  ### `accounting_clients`
  Master client record for billing purposes.
  - id, client_id (links to existing client records), full_name, email, phone
  - state (2-letter), chapter (7 or 13), case_type
  - For Ch.7: 'regular' (all fees paid before filing) or 'bifurcated' (can file then pay)
  - For Ch.13: 'flat_fee' (upfront portion + remainder through plan) or 'hourly' (retainer held in IOLTA)
  - status: active, filed, closed, on_hold

  ### `accounting_fee_structures`
  Fee configuration per client.
  - attorney_fee: total attorney fee agreed upon
  - court_filing_fee: $338 ch7, $313 ch13 (configurable)
  - payment_frequency: weekly, biweekly, semi_monthly, monthly, paid_in_full
  - bifurcated_signing_threshold: default $400, adjustable per client (ch7 bifurcated only)
  - threshold_bypassed: boolean, allows scheduling without meeting threshold
  - ch13_upfront_amount: portion of flat fee due before filing (ch13 flat_fee only)
  - ch13_plan_remainder: remainder paid through chapter 13 plan
  - hourly_rate: for ch13 hourly cases
  - retainer_amount: initial retainer held in IOLTA (ch13 hourly only)
  - iolta_balance: current IOLTA trust account balance

  ### `accounting_payments`
  Individual payment transactions.
  - client_id (FK to accounting_clients)
  - amount, payment_date, payment_method
  - payment_type: retainer, attorney_fee, court_filing_fee, plan_payment
  - is_iolta: true if payment held in IOLTA trust account
  - applied_to: what this payment was applied toward
  - notes, recorded_by

  ### `accounting_payment_schedule`
  Installment schedule entries.
  - client_id (FK), due_date, amount_due, amount_paid, status: pending/paid/late/waived

  ## Security
  - RLS enabled on all tables
  - Anon key allowed for portal use (firm-internal tool)
*/

-- ── accounting_clients ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL DEFAULT 'client-demo',
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  state char(2),
  chapter smallint NOT NULL DEFAULT 7 CHECK (chapter IN (7, 13)),
  case_type text NOT NULL DEFAULT 'regular'
    CHECK (case_type IN ('regular', 'bifurcated', 'flat_fee', 'hourly')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'filed', 'closed', 'on_hold')),
  case_number text,
  filed_date date,
  intake_date date DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE accounting_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read accounting_clients"
  ON accounting_clients FOR SELECT
  TO anon USING (true);

CREATE POLICY "Anon can insert accounting_clients"
  ON accounting_clients FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Anon can update accounting_clients"
  ON accounting_clients FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

-- ── accounting_fee_structures ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_fee_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES accounting_clients(id) ON DELETE CASCADE,
  attorney_fee numeric(10,2) NOT NULL DEFAULT 0,
  court_filing_fee numeric(10,2) NOT NULL DEFAULT 338,
  total_fee numeric(10,2) GENERATED ALWAYS AS (attorney_fee + court_filing_fee) STORED,
  payment_frequency text NOT NULL DEFAULT 'monthly'
    CHECK (payment_frequency IN ('weekly', 'biweekly', 'semi_monthly', 'monthly', 'paid_in_full')),
  -- Ch.7 bifurcated
  bifurcated_signing_threshold numeric(10,2) NOT NULL DEFAULT 400,
  threshold_bypassed boolean NOT NULL DEFAULT false,
  threshold_bypass_reason text,
  threshold_bypassed_by text,
  threshold_bypassed_at timestamptz,
  -- Ch.13 flat fee
  ch13_upfront_amount numeric(10,2),
  ch13_plan_remainder numeric(10,2),
  -- Ch.13 hourly
  hourly_rate numeric(10,2),
  retainer_amount numeric(10,2),
  iolta_balance numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE accounting_fee_structures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read accounting_fee_structures"
  ON accounting_fee_structures FOR SELECT
  TO anon USING (true);

CREATE POLICY "Anon can insert accounting_fee_structures"
  ON accounting_fee_structures FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Anon can update accounting_fee_structures"
  ON accounting_fee_structures FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

-- ── accounting_payments ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES accounting_clients(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'credit_card'
    CHECK (payment_method IN ('credit_card', 'debit_card', 'check', 'cash', 'wire', 'ach', 'other')),
  payment_type text NOT NULL DEFAULT 'attorney_fee'
    CHECK (payment_type IN ('retainer', 'attorney_fee', 'court_filing_fee', 'plan_payment', 'credit', 'other')),
  is_iolta boolean NOT NULL DEFAULT false,
  applied_to text,
  notes text,
  recorded_by text,
  voided boolean NOT NULL DEFAULT false,
  void_reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE accounting_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read accounting_payments"
  ON accounting_payments FOR SELECT
  TO anon USING (true);

CREATE POLICY "Anon can insert accounting_payments"
  ON accounting_payments FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Anon can update accounting_payments"
  ON accounting_payments FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

-- ── accounting_payment_schedule ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_payment_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES accounting_clients(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  due_date date NOT NULL,
  amount_due numeric(10,2) NOT NULL,
  amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'late', 'waived', 'partial')),
  paid_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE accounting_payment_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read accounting_payment_schedule"
  ON accounting_payment_schedule FOR SELECT
  TO anon USING (true);

CREATE POLICY "Anon can insert accounting_payment_schedule"
  ON accounting_payment_schedule FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Anon can update accounting_payment_schedule"
  ON accounting_payment_schedule FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

-- ── indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_accounting_clients_chapter ON accounting_clients(chapter);
CREATE INDEX IF NOT EXISTS idx_accounting_clients_state ON accounting_clients(state);
CREATE INDEX IF NOT EXISTS idx_accounting_clients_status ON accounting_clients(status);
CREATE INDEX IF NOT EXISTS idx_accounting_payments_client ON accounting_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_accounting_payments_date ON accounting_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_accounting_schedule_client ON accounting_payment_schedule(client_id);
CREATE INDEX IF NOT EXISTS idx_accounting_schedule_due ON accounting_payment_schedule(due_date);

-- ── seed demo data ────────────────────────────────────────────────────────────

INSERT INTO accounting_clients (client_id, full_name, email, phone, state, chapter, case_type, status, intake_date, filed_date)
VALUES
  ('client-001', 'Lisa M. Thompson', 'lisa.thompson@email.com', '(312) 555-0191', 'IL', 7, 'bifurcated', 'active', '2026-03-15', null),
  ('client-002', 'James R. Walker', 'jwalker@email.com', '(312) 555-0204', 'IL', 7, 'regular', 'filed', '2026-02-01', '2026-04-10'),
  ('client-003', 'Maria G. Santos', 'msantos@email.com', '(708) 555-0317', 'IL', 13, 'flat_fee', 'active', '2026-03-20', null),
  ('client-004', 'David K. Okafor', 'dokafor@email.com', '(773) 555-0428', 'IL', 13, 'hourly', 'active', '2026-04-01', null),
  ('client-005', 'Sandra J. Patel', 'spatel@email.com', '(219) 555-0539', 'IN', 7, 'bifurcated', 'active', '2026-04-05', null),
  ('client-006', 'Marcus T. Williams', 'mwilliams@email.com', '(219) 555-0641', 'IN', 7, 'regular', 'filed', '2026-01-15', '2026-03-01'),
  ('client-007', 'Angela F. Rivera', 'arivera@email.com', '(312) 555-0752', 'IL', 13, 'flat_fee', 'filed', '2026-02-10', '2026-04-22'),
  ('client-008', 'Thomas B. Chen', 'tchen@email.com', '(847) 555-0863', 'IL', 7, 'bifurcated', 'active', '2026-04-12', null),
  ('client-demo', 'Lisa Demo Client', 'lisa@demo.com', '(312) 555-0000', 'IL', 7, 'bifurcated', 'active', '2026-03-01', null)
ON CONFLICT DO NOTHING;

-- Insert fee structures for the demo clients
DO $$
DECLARE
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid; c7 uuid; c8 uuid; cd uuid;
BEGIN
  SELECT id INTO c1 FROM accounting_clients WHERE client_id = 'client-001';
  SELECT id INTO c2 FROM accounting_clients WHERE client_id = 'client-002';
  SELECT id INTO c3 FROM accounting_clients WHERE client_id = 'client-003';
  SELECT id INTO c4 FROM accounting_clients WHERE client_id = 'client-004';
  SELECT id INTO c5 FROM accounting_clients WHERE client_id = 'client-005';
  SELECT id INTO c6 FROM accounting_clients WHERE client_id = 'client-006';
  SELECT id INTO c7 FROM accounting_clients WHERE client_id = 'client-007';
  SELECT id INTO c8 FROM accounting_clients WHERE client_id = 'client-008';
  SELECT id INTO cd FROM accounting_clients WHERE client_id = 'client-demo';

  INSERT INTO accounting_fee_structures (client_id, attorney_fee, court_filing_fee, payment_frequency, bifurcated_signing_threshold, threshold_bypassed)
  VALUES (c1, 1500, 338, 'biweekly', 400, false)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounting_fee_structures (client_id, attorney_fee, court_filing_fee, payment_frequency)
  VALUES (c2, 1500, 338, 'paid_in_full')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounting_fee_structures (client_id, attorney_fee, court_filing_fee, payment_frequency, ch13_upfront_amount, ch13_plan_remainder)
  VALUES (c3, 5000, 313, 'monthly', 2500, 2500)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounting_fee_structures (client_id, attorney_fee, court_filing_fee, payment_frequency, hourly_rate, retainer_amount, iolta_balance)
  VALUES (c4, 0, 313, 'monthly', 350, 2500, 2500)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounting_fee_structures (client_id, attorney_fee, court_filing_fee, payment_frequency, bifurcated_signing_threshold, threshold_bypassed)
  VALUES (c5, 1500, 338, 'weekly', 400, false)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounting_fee_structures (client_id, attorney_fee, court_filing_fee, payment_frequency)
  VALUES (c6, 1200, 338, 'paid_in_full')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounting_fee_structures (client_id, attorney_fee, court_filing_fee, payment_frequency, ch13_upfront_amount, ch13_plan_remainder)
  VALUES (c7, 4500, 313, 'monthly', 2000, 2500)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounting_fee_structures (client_id, attorney_fee, court_filing_fee, payment_frequency, bifurcated_signing_threshold, threshold_bypassed)
  VALUES (c8, 1500, 338, 'semi_monthly', 400, false)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounting_fee_structures (client_id, attorney_fee, court_filing_fee, payment_frequency, bifurcated_signing_threshold, threshold_bypassed)
  VALUES (cd, 1500, 338, 'biweekly', 400, false)
  ON CONFLICT DO NOTHING;
END $$;

-- Seed some payments
DO $$
DECLARE
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid; c7 uuid; c8 uuid; cd uuid;
BEGIN
  SELECT id INTO c1 FROM accounting_clients WHERE client_id = 'client-001';
  SELECT id INTO c2 FROM accounting_clients WHERE client_id = 'client-002';
  SELECT id INTO c3 FROM accounting_clients WHERE client_id = 'client-003';
  SELECT id INTO c4 FROM accounting_clients WHERE client_id = 'client-004';
  SELECT id INTO c5 FROM accounting_clients WHERE client_id = 'client-005';
  SELECT id INTO c6 FROM accounting_clients WHERE client_id = 'client-006';
  SELECT id INTO c7 FROM accounting_clients WHERE client_id = 'client-007';
  SELECT id INTO c8 FROM accounting_clients WHERE client_id = 'client-008';
  SELECT id INTO cd FROM accounting_clients WHERE client_id = 'client-demo';

  -- client-001: bifurcated ch7, paid $750 so far
  INSERT INTO accounting_payments (client_id, amount, payment_date, payment_method, payment_type, notes) VALUES
    (c1, 250, '2026-03-20', 'credit_card', 'attorney_fee', 'Initial payment'),
    (c1, 250, '2026-04-03', 'credit_card', 'attorney_fee', 'Installment 2'),
    (c1, 250, '2026-04-17', 'credit_card', 'attorney_fee', 'Installment 3');

  -- client-002: regular ch7, paid in full
  INSERT INTO accounting_payments (client_id, amount, payment_date, payment_method, payment_type, notes) VALUES
    (c2, 1500, '2026-02-05', 'check', 'attorney_fee', 'Paid in full'),
    (c2, 338, '2026-02-05', 'check', 'court_filing_fee', 'Court filing fee');

  -- client-003: ch13 flat fee
  INSERT INTO accounting_payments (client_id, amount, payment_date, payment_method, payment_type, notes) VALUES
    (c3, 2500, '2026-03-25', 'ach', 'attorney_fee', 'Upfront portion'),
    (c3, 313, '2026-03-25', 'ach', 'court_filing_fee', 'Court filing fee'),
    (c3, 500, '2026-04-20', 'ach', 'plan_payment', 'Plan payment 1');

  -- client-004: ch13 hourly, retainer in IOLTA
  INSERT INTO accounting_payments (client_id, amount, payment_date, payment_method, payment_type, is_iolta, notes) VALUES
    (c4, 2500, '2026-04-05', 'wire', 'retainer', true, 'Initial retainer — IOLTA'),
    (c4, 313, '2026-04-05', 'wire', 'court_filing_fee', false, 'Court filing fee');

  -- client-005: bifurcated ch7, $350 paid
  INSERT INTO accounting_payments (client_id, amount, payment_date, payment_method, payment_type, notes) VALUES
    (c5, 150, '2026-04-08', 'debit_card', 'attorney_fee', 'Installment 1'),
    (c5, 150, '2026-04-15', 'debit_card', 'attorney_fee', 'Installment 2'),
    (c5, 50, '2026-04-22', 'debit_card', 'attorney_fee', 'Installment 3');

  -- client-006: regular ch7, paid in full
  INSERT INTO accounting_payments (client_id, amount, payment_date, payment_method, payment_type, notes) VALUES
    (c6, 1200, '2026-01-18', 'check', 'attorney_fee', 'Paid in full'),
    (c6, 338, '2026-01-18', 'check', 'court_filing_fee', 'Court filing fee');

  -- client-007: ch13, upfront paid + plan payments
  INSERT INTO accounting_payments (client_id, amount, payment_date, payment_method, payment_type, notes) VALUES
    (c7, 2000, '2026-02-15', 'ach', 'attorney_fee', 'Upfront portion'),
    (c7, 313, '2026-02-15', 'ach', 'court_filing_fee', 'Court filing fee'),
    (c7, 500, '2026-03-22', 'ach', 'plan_payment', 'Plan payment 1'),
    (c7, 500, '2026-04-22', 'ach', 'plan_payment', 'Plan payment 2');

  -- client-008: bifurcated ch7, just started — $200 paid
  INSERT INTO accounting_payments (client_id, amount, payment_date, payment_method, payment_type, notes) VALUES
    (c8, 200, '2026-04-15', 'credit_card', 'attorney_fee', 'Installment 1');

  -- client-demo
  INSERT INTO accounting_payments (client_id, amount, payment_date, payment_method, payment_type, notes) VALUES
    (cd, 300, '2026-03-05', 'credit_card', 'attorney_fee', 'Installment 1'),
    (cd, 300, '2026-03-19', 'credit_card', 'attorney_fee', 'Installment 2');
END $$;
