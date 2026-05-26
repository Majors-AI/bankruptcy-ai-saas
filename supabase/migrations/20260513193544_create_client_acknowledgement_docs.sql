/*
  # Create client_acknowledgement_docs table

  ## Purpose
  Stores a permanent, timestamped record of each client's signed acknowledgement
  document package — capturing registration consent, third-party vendor disclosures
  (SendGrid, Twilio, iSoftpull, Plaid, E-SIGN), and FCRA written consent for iSoftpull.
  These records are referenced in the client portal under "My Documents" and in the
  FileCabinet attorney view.

  ## New Tables
  - `client_acknowledgement_docs`
    - `id` (uuid, primary key)
    - `user_id` (uuid, references auth.users)
    - `email` (text) — client email for cross-reference
    - `doc_type` (text) — e.g. 'registration_disclosure_package'
    - `label` (text) — human-readable document label
    - Individual consent flags matching client_registrations
    - `signed_at` (timestamptz) — timestamp when all consents were finalized
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Clients can read their own records
  - Service role has full access for staff/admin operations
*/

CREATE TABLE IF NOT EXISTS client_acknowledgement_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  doc_type text DEFAULT 'registration_disclosure_package',
  label text DEFAULT 'Registration & Disclosure Acknowledgement',
  consented_general boolean DEFAULT false,
  consented_sendgrid boolean DEFAULT false,
  consented_twilio boolean DEFAULT false,
  consented_isoftpull boolean DEFAULT false,
  consented_plaid boolean DEFAULT false,
  consented_electronic boolean DEFAULT false,
  consented_isoftpull_fcra boolean DEFAULT false,
  consented_isoftpull_electronic boolean DEFAULT false,
  signed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_acknowledgement_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can select own acknowledgement docs"
  ON client_acknowledgement_docs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Clients can insert own acknowledgement docs"
  ON client_acknowledgement_docs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Clients can update own acknowledgement docs"
  ON client_acknowledgement_docs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to client_acknowledgement_docs"
  ON client_acknowledgement_docs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anon insert for upsert during registration flow
CREATE POLICY "Anon can insert acknowledgement docs"
  ON client_acknowledgement_docs FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS client_ack_docs_user_id_idx ON client_acknowledgement_docs(user_id);
CREATE INDEX IF NOT EXISTS client_ack_docs_email_idx ON client_acknowledgement_docs(email);
CREATE INDEX IF NOT EXISTS client_ack_docs_signed_at_idx ON client_acknowledgement_docs(signed_at);
