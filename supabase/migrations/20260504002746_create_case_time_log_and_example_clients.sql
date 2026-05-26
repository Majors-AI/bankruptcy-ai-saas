/*
  # Case Time Log and Example Client Data

  ## New Table: case_time_log
  Central time tracking for every client case. Every interaction — file opens,
  payment adjustments, cancellation requests, paralegal reviews, calls, messages,
  and manual notes — is recorded here.

  ### Columns
  - `id` (uuid PK)
  - `client_id` (uuid FK → accounting_clients)
  - `staff_name` (text) — who performed the activity
  - `activity_type` (text) — categorized activity:
      'file_open' | 'file_close' | 'manual_note' | 'payment_adjustment' |
      'cancel_request' | 'hold_request' | 'paralegal_review' | 'attorney_review' |
      'client_call' | 'creditor_call' | 'sms_thread' | 'email' | 'video_call' |
      'message' | 'document_upload' | 'other'
  - `duration_minutes` (numeric) — actual time in minutes
  - `billable` (boolean) — whether to bill to client
  - `notes` (text) — free-form notes / description
  - `reference_id` (text) — optional FK to related record (payment_id, cancel_id, etc.)
  - `reference_table` (text) — which table reference_id points to
  - `started_at` (timestamptz) — when activity started
  - `ended_at` (timestamptz) — when activity ended
  - `created_at` (timestamptz)

  ## Changes to accounting_clients
  - Add `case_closed_date` (date) — when case was formally closed
  - Add `case_closed_reason` (text) — discharge, dismissal, converted, cancelled
  - Add `case_closed_notes` (text) — disposition details
  - Add `discharge_date` (date) — date of bankruptcy discharge
  - Add `dismissal_reason` (text) — reason for dismissal if applicable
*/

-- ── case_time_log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_time_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL REFERENCES accounting_clients(id) ON DELETE CASCADE,
  staff_name       text NOT NULL DEFAULT '',
  activity_type    text NOT NULL DEFAULT 'manual_note',
  duration_minutes numeric NOT NULL DEFAULT 0,
  billable         boolean NOT NULL DEFAULT false,
  notes            text,
  reference_id     text,
  reference_table  text,
  started_at       timestamptz DEFAULT now(),
  ended_at         timestamptz,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE case_time_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read time log"
  ON case_time_log FOR SELECT TO anon USING (true);

CREATE POLICY "Staff can insert time log"
  ON case_time_log FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Staff can update time log"
  ON case_time_log FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_time_log_client ON case_time_log(client_id);
CREATE INDEX IF NOT EXISTS idx_time_log_type   ON case_time_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_time_log_started ON case_time_log(started_at DESC);

-- ── Case closed / disposition columns ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_clients' AND column_name='case_closed_date') THEN
    ALTER TABLE accounting_clients ADD COLUMN case_closed_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_clients' AND column_name='case_closed_reason') THEN
    ALTER TABLE accounting_clients ADD COLUMN case_closed_reason text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_clients' AND column_name='case_closed_notes') THEN
    ALTER TABLE accounting_clients ADD COLUMN case_closed_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_clients' AND column_name='discharge_date') THEN
    ALTER TABLE accounting_clients ADD COLUMN discharge_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_clients' AND column_name='dismissal_reason') THEN
    ALTER TABLE accounting_clients ADD COLUMN dismissal_reason text;
  END IF;
END $$;

-- ── Example demo clients ──────────────────────────────────────────────────────
-- Delete any existing demo data to allow re-seeding cleanly
DELETE FROM accounting_clients WHERE client_id IN (
  'demo-onhold-001','demo-inactive-001','demo-closed-001','demo-cancelled-001'
);

-- On-hold client
INSERT INTO accounting_clients (
  client_id, full_name, email, phone, state, chapter, case_type,
  status, extended_status, intake_date, notes
) VALUES (
  'demo-onhold-001',
  'Sandra Reyes',
  'sreyes@example.com',
  '(602) 555-0142',
  'AZ', 7, 'regular',
  'on_hold', 'on_hold',
  (CURRENT_DATE - INTERVAL '45 days')::date,
  'Client requested payment pause due to job change. Hold approved 2 weeks ago.'
);

-- Inactive client
INSERT INTO accounting_clients (
  client_id, full_name, email, phone, state, chapter, case_type,
  status, extended_status, intake_date, notes
) VALUES (
  'demo-inactive-001',
  'Marcus Webb',
  'mwebb@example.com',
  '(206) 555-0188',
  'WA', 7, 'regular',
  'active', 'inactive',
  (CURRENT_DATE - INTERVAL '90 days')::date,
  'Client completed intake, made one payment, then stopped responding. 4 follow-up attempts made.'
);

-- Case closed (discharged)
INSERT INTO accounting_clients (
  client_id, full_name, email, phone, state, chapter, case_type,
  status, extended_status, intake_date, case_number,
  filed_date, case_closed_date, case_closed_reason,
  discharge_date, case_closed_notes
) VALUES (
  'demo-closed-001',
  'Patricia Nguyen',
  'pnguyen@example.com',
  '(512) 555-0267',
  'TX', 7, 'regular',
  'closed', 'case_closed',
  (CURRENT_DATE - INTERVAL '11 months')::date,
  '7:24-bk-00418',
  (CURRENT_DATE - INTERVAL '8 months')::date,
  (CURRENT_DATE - INTERVAL '1 month')::date,
  'discharged',
  (CURRENT_DATE - INTERVAL '5 weeks')::date,
  'Standard Chapter 7 no-asset case. Discharge granted. All fees collected prior to filing. IOLTA filing fee transferred to operating 48 hrs post-filing.'
);

-- Cancelled client
INSERT INTO accounting_clients (
  client_id, full_name, email, phone, state, chapter, case_type,
  status, extended_status, intake_date,
  case_closed_date, case_closed_reason, case_closed_notes
) VALUES (
  'demo-cancelled-001',
  'Derek Okafor',
  'dokafor@example.com',
  '(602) 555-0391',
  'AZ', 7, 'regular',
  'on_hold', 'cancelled',
  (CURRENT_DATE - INTERVAL '60 days')::date,
  (CURRENT_DATE - INTERVAL '10 days')::date,
  'client_withdrew',
  'Client decided not to proceed after consultation. Partial refund of $200 issued. File closed.'
);

-- Add fee structures for demo clients
INSERT INTO accounting_fee_structures (client_id, attorney_fee, court_filing_fee, down_payment, plan_months, payment_frequency)
SELECT id, 1200, 338, 300, 4, 'monthly'
FROM accounting_clients WHERE client_id = 'demo-onhold-001';

INSERT INTO accounting_fee_structures (client_id, attorney_fee, court_filing_fee, down_payment, plan_months, payment_frequency)
SELECT id, 1500, 338, 200, 5, 'monthly'
FROM accounting_clients WHERE client_id = 'demo-inactive-001';

INSERT INTO accounting_fee_structures (client_id, attorney_fee, court_filing_fee, down_payment, plan_months, payment_frequency, cff_paid, approved_for_signing)
SELECT id, 1350, 338, 350, 4, 'monthly', true, true
FROM accounting_clients WHERE client_id = 'demo-closed-001';

INSERT INTO accounting_fee_structures (client_id, attorney_fee, court_filing_fee, down_payment, plan_months, payment_frequency)
SELECT id, 1200, 338, 300, 4, 'monthly'
FROM accounting_clients WHERE client_id = 'demo-cancelled-001';

-- Payments for demo clients
INSERT INTO accounting_payments (client_id, amount, payment_date, payment_method, payment_type, destination_account, account_state, recorded_by)
SELECT id, 300, (CURRENT_DATE - INTERVAL '45 days')::date, 'credit_card', 'plan_payment', 'operating', 'AZ', 'System'
FROM accounting_clients WHERE client_id = 'demo-onhold-001';

INSERT INTO accounting_payments (client_id, amount, payment_date, payment_method, payment_type, destination_account, account_state, recorded_by)
SELECT id, 200, (CURRENT_DATE - INTERVAL '88 days')::date, 'debit_card', 'plan_payment', 'operating', 'WA', 'System'
FROM accounting_clients WHERE client_id = 'demo-inactive-001';

INSERT INTO accounting_payments (client_id, amount, payment_date, payment_method, payment_type, destination_account, account_state, recorded_by)
SELECT id, 1350, (CURRENT_DATE - INTERVAL '9 months')::date, 'check', 'attorney_fee', 'operating', 'TX', 'System'
FROM accounting_clients WHERE client_id = 'demo-closed-001';

INSERT INTO accounting_payments (client_id, amount, payment_date, payment_method, payment_type, destination_account, account_state, recorded_by)
SELECT id, 338, (CURRENT_DATE - INTERVAL '8 months' + INTERVAL '1 week')::date, 'credit_card', 'court_filing_fee', 'iolta', 'TX', 'System'
FROM accounting_clients WHERE client_id = 'demo-closed-001';

INSERT INTO accounting_payments (client_id, amount, payment_date, payment_method, payment_type, destination_account, account_state, recorded_by)
SELECT id, 300, (CURRENT_DATE - INTERVAL '58 days')::date, 'credit_card', 'plan_payment', 'operating', 'AZ', 'System'
FROM accounting_clients WHERE client_id = 'demo-cancelled-001';

-- Seed time log entries for demo clients
INSERT INTO case_time_log (client_id, staff_name, activity_type, duration_minutes, billable, notes, started_at)
SELECT id, 'Maria G.', 'file_open', 8, false, 'Reviewed hold request and payment history.', (NOW() - INTERVAL '2 days')
FROM accounting_clients WHERE client_id = 'demo-onhold-001';

INSERT INTO case_time_log (client_id, staff_name, activity_type, duration_minutes, billable, notes, started_at)
SELECT id, 'James T.', 'client_call', 12, true, 'Client called to discuss hold timeline. Expects to resume payments in 3 weeks.', (NOW() - INTERVAL '5 days')
FROM accounting_clients WHERE client_id = 'demo-onhold-001';

INSERT INTO case_time_log (client_id, staff_name, activity_type, duration_minutes, billable, notes, started_at)
SELECT id, 'Maria G.', 'hold_request', 3, false, 'Submitted hold request on behalf of client. Pending super admin approval.', (NOW() - INTERVAL '15 days')
FROM accounting_clients WHERE client_id = 'demo-onhold-001';

INSERT INTO case_time_log (client_id, staff_name, activity_type, duration_minutes, billable, notes, started_at)
SELECT id, 'Maria G.', 'sms_thread', 4, false, 'Follow-up texts re: missed monthly payment. No response after 3 messages.', (NOW() - INTERVAL '20 days')
FROM accounting_clients WHERE client_id = 'demo-inactive-001';

INSERT INTO case_time_log (client_id, staff_name, activity_type, duration_minutes, billable, notes, started_at)
SELECT id, 'James T.', 'client_call', 0, false, 'Called client — no answer. Left voicemail #2.', (NOW() - INTERVAL '35 days')
FROM accounting_clients WHERE client_id = 'demo-inactive-001';

INSERT INTO case_time_log (client_id, staff_name, activity_type, duration_minutes, billable, notes, started_at)
SELECT id, 'James T.', 'email', 2, false, 'Sent 30-day delinquency notice email. No reply.', (NOW() - INTERVAL '30 days')
FROM accounting_clients WHERE client_id = 'demo-inactive-001';

INSERT INTO case_time_log (client_id, staff_name, activity_type, duration_minutes, billable, notes, started_at)
SELECT id, 'Sarah L.', 'paralegal_review', 25, true, 'Full case review for filing readiness. All docs verified. Approved for filing.', (NOW() - INTERVAL '8 months')
FROM accounting_clients WHERE client_id = 'demo-closed-001';

INSERT INTO case_time_log (client_id, staff_name, activity_type, duration_minutes, billable, notes, started_at)
SELECT id, 'James T.', 'attorney_review', 15, true, 'Reviewed petition. Signed off. Case filed — case no. 7:24-bk-00418.', (NOW() - INTERVAL '8 months' + INTERVAL '2 days')
FROM accounting_clients WHERE client_id = 'demo-closed-001';

INSERT INTO case_time_log (client_id, staff_name, activity_type, duration_minutes, billable, notes, started_at)
SELECT id, 'Sarah L.', 'file_open', 5, false, 'Discharge received. Closed file. Archived documents.', (NOW() - INTERVAL '1 month')
FROM accounting_clients WHERE client_id = 'demo-closed-001';

INSERT INTO case_time_log (client_id, staff_name, activity_type, duration_minutes, billable, notes, started_at)
SELECT id, 'Maria G.', 'client_call', 18, true, 'Client called to cancel. Discussed options. Client withdrew. Partial refund $200 processed.', (NOW() - INTERVAL '11 days')
FROM accounting_clients WHERE client_id = 'demo-cancelled-001';

INSERT INTO case_time_log (client_id, staff_name, activity_type, duration_minutes, billable, notes, started_at)
SELECT id, 'Maria G.', 'cancel_request', 5, false, 'Filed cancellation request. File closed per client request.', (NOW() - INTERVAL '10 days')
FROM accounting_clients WHERE client_id = 'demo-cancelled-001';
