/*
  # Add Last Contact Tracking + Drop/Inactive Demo Data

  ## Schema Changes (accounting_clients)
  - last_contact_date (date) — most recent date staff had contact with client;
    used to flag cases that have gone silent for 6+ months
  - no_contact_drop_flagged (boolean DEFAULT false) — set to true when the
    no-contact rule fires (last_contact_date > 6 months ago)
  - drop_requested_at (timestamptz) — timestamp when a drop/dismissal was
    formally requested for this client

  ## Demo Data Updates
  - Update demo-inactive-001 (Marcus Webb): last_contact_date = 195 days ago,
    intake_date = 7 months ago (triggers 6-month no-contact rule)
  - Insert demo-pastdue-001 (Janet Morales, AZ Ch.7): intake 8 months ago,
    last contact 210 days ago (clearly past 6-month no-contact threshold)
  - Fee structure for Janet Morales: attorney_fee=1400, cff=338, down=400,
    plan_months=4, monthly
  - Initial $400 down payment for Janet Morales (7 months ago, credit_card)
  - 4 overdue schedule entries for Janet Morales: -5m/-4m/-3m/-2m, all late
  - 3 overdue schedule entries for Marcus Webb: -5m/-4m/-3m, all late
*/

-- 1. Add new columns to accounting_clients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_clients' AND column_name = 'last_contact_date'
  ) THEN
    ALTER TABLE accounting_clients ADD COLUMN last_contact_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_clients' AND column_name = 'no_contact_drop_flagged'
  ) THEN
    ALTER TABLE accounting_clients ADD COLUMN no_contact_drop_flagged boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_clients' AND column_name = 'drop_requested_at'
  ) THEN
    ALTER TABLE accounting_clients ADD COLUMN drop_requested_at timestamptz;
  END IF;
END $$;

-- 2. Update demo-inactive-001 (Marcus Webb)
UPDATE accounting_clients
SET
  last_contact_date = (CURRENT_DATE - INTERVAL '195 days')::date,
  intake_date       = (CURRENT_DATE - INTERVAL '7 months')::date
WHERE client_id = 'demo-inactive-001';

-- 3. Insert new past-due demo client (Janet Morales) — DELETE first for idempotency
DELETE FROM accounting_clients WHERE client_id = 'demo-pastdue-001';

INSERT INTO accounting_clients (
  client_id, full_name, email, phone, state, chapter, case_type,
  status, extended_status, intake_date, last_contact_date, notes
) VALUES (
  'demo-pastdue-001',
  'Janet Morales',
  'jmorales@example.com',
  '(480) 555-0174',
  'AZ', 7, 'regular',
  'active', 'inactive',
  (CURRENT_DATE - INTERVAL '8 months')::date,
  (CURRENT_DATE - INTERVAL '210 days')::date,
  'Client completed intake and paid retainer. Stopped responding after month 2. Multiple calls, emails, texts unanswered. Last contact was a text confirmation 7 months ago. No court date set.'
);

-- 4. Fee structure for demo-pastdue-001 (DELETE + INSERT for idempotency)
DELETE FROM accounting_fee_structures
WHERE client_id IN (SELECT id FROM accounting_clients WHERE client_id = 'demo-pastdue-001');

INSERT INTO accounting_fee_structures (
  client_id, attorney_fee, court_filing_fee, down_payment, plan_months, payment_frequency
)
SELECT id, 1400, 338, 400, 4, 'monthly'
FROM accounting_clients
WHERE client_id = 'demo-pastdue-001';

-- 5. Initial payment for demo-pastdue-001
INSERT INTO accounting_payments (
  client_id, amount, payment_date, payment_method,
  payment_type, destination_account, account_state, recorded_by
)
SELECT
  id, 400,
  (CURRENT_DATE - INTERVAL '7 months')::date,
  'credit_card', 'plan_payment', 'operating', 'AZ', 'System'
FROM accounting_clients
WHERE client_id = 'demo-pastdue-001';

-- 6. Overdue schedule entries for demo-pastdue-001 (Janet Morales)
INSERT INTO accounting_payment_schedule (client_id, installment_number, due_date, amount_due, status)
SELECT id, 1, (CURRENT_DATE - INTERVAL '5 months')::date, 350.00, 'late'
FROM accounting_clients WHERE client_id = 'demo-pastdue-001';

INSERT INTO accounting_payment_schedule (client_id, installment_number, due_date, amount_due, status)
SELECT id, 2, (CURRENT_DATE - INTERVAL '4 months')::date, 350.00, 'late'
FROM accounting_clients WHERE client_id = 'demo-pastdue-001';

INSERT INTO accounting_payment_schedule (client_id, installment_number, due_date, amount_due, status)
SELECT id, 3, (CURRENT_DATE - INTERVAL '3 months')::date, 350.00, 'late'
FROM accounting_clients WHERE client_id = 'demo-pastdue-001';

INSERT INTO accounting_payment_schedule (client_id, installment_number, due_date, amount_due, status)
SELECT id, 4, (CURRENT_DATE - INTERVAL '2 months')::date, 338.00, 'late'
FROM accounting_clients WHERE client_id = 'demo-pastdue-001';

-- 7. Overdue schedule entries for demo-inactive-001 (Marcus Webb)
INSERT INTO accounting_payment_schedule (client_id, installment_number, due_date, amount_due, status)
SELECT id, 1, (CURRENT_DATE - INTERVAL '5 months')::date, 300.00, 'late'
FROM accounting_clients WHERE client_id = 'demo-inactive-001';

INSERT INTO accounting_payment_schedule (client_id, installment_number, due_date, amount_due, status)
SELECT id, 2, (CURRENT_DATE - INTERVAL '4 months')::date, 300.00, 'late'
FROM accounting_clients WHERE client_id = 'demo-inactive-001';

INSERT INTO accounting_payment_schedule (client_id, installment_number, due_date, amount_due, status)
SELECT id, 3, (CURRENT_DATE - INTERVAL '3 months')::date, 300.00, 'late'
FROM accounting_clients WHERE client_id = 'demo-inactive-001';
