/*
  # Collections Schema

  1. New Tables
    - `collection_cases`
      - Tracks clients who are 30+ days behind on their payment plan
      - Stores current balance owed, days past due, case status
      - Links to accounting_clients via client_id
    - `collection_contacts`
      - Log of every AI or staff contact attempt for a collection case
      - Records channel (sms/email/in_app), message sent, response if any
      - Tracks whether the client responded or made a payment after contact

  2. Security
    - RLS enabled on both tables
    - Authenticated users can read/write all collection records
    - Anon cannot access any collection data
*/

CREATE TABLE IF NOT EXISTS collection_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  client_name text NOT NULL,
  client_email text,
  client_phone text,
  total_owed numeric(10,2) NOT NULL DEFAULT 0,
  total_paid numeric(10,2) NOT NULL DEFAULT 0,
  outstanding_balance numeric(10,2) NOT NULL DEFAULT 0,
  days_past_due integer NOT NULL DEFAULT 0,
  last_payment_date date,
  last_payment_amount numeric(10,2),
  first_missed_payment_date date,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','payment_arrangement','resolved','written_off','on_hold')),
  ai_followup_enabled boolean NOT NULL DEFAULT true,
  last_ai_contact_at timestamptz,
  next_ai_contact_at timestamptz,
  ai_contact_count integer NOT NULL DEFAULT 0,
  staff_assigned text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE collection_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated staff can read collection cases"
  ON collection_cases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated staff can insert collection cases"
  ON collection_cases FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated staff can update collection cases"
  ON collection_cases FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS collection_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES collection_cases(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  contact_type text NOT NULL DEFAULT 'ai_followup'
    CHECK (contact_type IN ('ai_followup','staff_call','staff_email','staff_sms','payment_received','arrangement_made','escalated')),
  channel text CHECK (channel IN ('sms','email','in_app','phone','none')),
  message_sent text,
  client_response text,
  payment_made_after boolean NOT NULL DEFAULT false,
  payment_amount_after numeric(10,2),
  ai_model text,
  sent_by text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE collection_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated staff can read collection contacts"
  ON collection_contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated staff can insert collection contacts"
  ON collection_contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated staff can update collection contacts"
  ON collection_contacts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_collection_cases_client_id ON collection_cases(client_id);
CREATE INDEX IF NOT EXISTS idx_collection_cases_status ON collection_cases(status);
CREATE INDEX IF NOT EXISTS idx_collection_cases_days_past_due ON collection_cases(days_past_due);
CREATE INDEX IF NOT EXISTS idx_collection_cases_next_ai_contact ON collection_cases(next_ai_contact_at);
CREATE INDEX IF NOT EXISTS idx_collection_contacts_case_id ON collection_contacts(case_id);
