/*
  # File a Case Portal & Creditor Verification Log

  ## New Tables

  ### file_a_case_queue
  Holds cases that have been fully signed by all parties and are ready to be filed.
  Populated automatically once signing is complete. All attorneys can see and act on these.
  - id, client_id, case_number, chapter, fee_structure
  - attorney_name, paralegal_name
  - signed_at (when all parties signed)
  - filing_status: pending | filed | on_hold
  - filed_at, filed_by, court_case_number (assigned by court after ECF)
  - notice_sent (whether system notice was sent to all attorneys)
  - notes, created_at, updated_at

  ### creditor_verification_log
  Logs every creditor contact attempt. AI bot or staff logs the call.
  System can only confirm representation — no other info disclosed.
  - id, logged_by, contact_type (phone | email | fax)
  - creditor_name, creditor_company, creditor_phone
  - client_name_provided (what creditor said the client's name is)
  - client_found (bool — did we find them in the system)
  - client_id (if found)
  - filing_status_at_time (not_filed | filed)
  - response_given (confirmed_representation | not_in_system | general_notice_provided)
  - notes, created_at

  ## Security
  - RLS enabled on both tables
  - Anon read/write allowed (staff-facing, no auth in this project yet)
*/

-- ─── file_a_case_queue ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS file_a_case_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  client_name text NOT NULL,
  case_number text,
  chapter smallint NOT NULL CHECK (chapter IN (7, 13)),
  fee_structure text NOT NULL DEFAULT 'regular',
  attorney_name text,
  paralegal_name text,
  signed_at timestamptz,
  filing_status text NOT NULL DEFAULT 'pending' CHECK (filing_status IN ('pending', 'filed', 'on_hold')),
  filed_at timestamptz,
  filed_by text,
  court_case_number text,
  notice_sent boolean NOT NULL DEFAULT false,
  notice_sent_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE file_a_case_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read file_a_case_queue"
  ON file_a_case_queue FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert file_a_case_queue"
  ON file_a_case_queue FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update file_a_case_queue"
  ON file_a_case_queue FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- ─── creditor_verification_log ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS creditor_verification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logged_by text NOT NULL DEFAULT 'Staff',
  contact_type text NOT NULL DEFAULT 'phone' CHECK (contact_type IN ('phone', 'email', 'fax', 'other')),
  creditor_name text,
  creditor_company text,
  creditor_phone text,
  account_number_provided text,
  client_name_provided text NOT NULL,
  client_found boolean NOT NULL DEFAULT false,
  client_id text,
  filing_status_at_time text CHECK (filing_status_at_time IN ('not_filed', 'filed', 'unknown')),
  response_given text NOT NULL DEFAULT 'not_in_system' CHECK (response_given IN (
    'confirmed_representation',
    'not_in_system',
    'general_notice_provided',
    'automatic_stay_notice'
  )),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE creditor_verification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read creditor_verification_log"
  ON creditor_verification_log FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert creditor_verification_log"
  ON creditor_verification_log FOR INSERT
  TO anon
  WITH CHECK (true);

-- ─── Seed a few example file_a_case_queue entries ────────────────────────────

INSERT INTO file_a_case_queue (client_id, client_name, chapter, fee_structure, attorney_name, paralegal_name, signed_at, filing_status, notice_sent)
VALUES
  ('CLT-1014', 'Nancy E. Turner', 13, 'bifurcated', 'David Chen', 'Linda Park', now() - interval '2 hours', 'pending', true),
  ('CLT-1019', 'Raymond C. Adams', 7, 'regular', 'Sarah Mitchell', 'Carlos Reyes', now() - interval '1 day', 'pending', true),
  ('CLT-1020', 'Carol B. Mitchell', 13, 'bifurcated', 'David Chen', 'Linda Park', now() - interval '3 hours', 'pending', false);
