/*
  # Create client_registrations table

  ## Purpose
  Stores client portal registration records including all third-party consent timestamps
  for compliance with SendGrid, Twilio, iSoftpull (FCRA), and Plaid requirements.

  ## New Tables
  - `client_registrations`
    - `id` (uuid, primary key)
    - `user_id` (uuid, references auth.users)
    - `email` (text)
    - `consented_general` (boolean) — general legal disclosures
    - `consented_sendgrid` (boolean) — SendGrid email consent
    - `consented_twilio` (boolean) — Twilio SMS/voice consent
    - `consented_isoftpull` (boolean) — iSoftpull/credit pre-qual consent
    - `consented_plaid` (boolean) — Plaid financial records consent
    - `consented_electronic` (boolean) — E-SIGN Act consent
    - `consent_timestamp` (timestamptz) — when general consents were captured
    - `consented_isoftpull_fcra` (boolean) — FCRA written instruction consent
    - `consented_isoftpull_electronic` (boolean) — iSoftpull electronic disclosures consent
    - `isoftpull_consent_timestamp` (timestamptz) — when iSoftpull consent was captured
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can only read/write their own registration record
*/

CREATE TABLE IF NOT EXISTS client_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  consented_general boolean DEFAULT false,
  consented_sendgrid boolean DEFAULT false,
  consented_twilio boolean DEFAULT false,
  consented_isoftpull boolean DEFAULT false,
  consented_plaid boolean DEFAULT false,
  consented_electronic boolean DEFAULT false,
  consent_timestamp timestamptz,
  consented_isoftpull_fcra boolean DEFAULT false,
  consented_isoftpull_electronic boolean DEFAULT false,
  isoftpull_consent_timestamp timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE client_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own registration"
  ON client_registrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select own registration"
  ON client_registrations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own registration"
  ON client_registrations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow anon upsert for registration flow (user may not be authenticated yet during upsert calls)
CREATE POLICY "Service role full access"
  ON client_registrations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS client_registrations_user_id_idx ON client_registrations(user_id);
CREATE INDEX IF NOT EXISTS client_registrations_email_idx ON client_registrations(email);
