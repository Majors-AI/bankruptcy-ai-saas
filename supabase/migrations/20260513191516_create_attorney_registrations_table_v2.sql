/*
  # Create attorney_registrations table (v2 — safe if exists)

  Stores law firm / attorney registration records including billing acknowledgments
  and third-party vendor consent timestamps.
*/

CREATE TABLE IF NOT EXISTS attorney_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  first_name text DEFAULT '',
  last_name text DEFAULT '',
  phone text DEFAULT '',
  firm_name text DEFAULT '',
  bar_number text DEFAULT '',
  state_bar text DEFAULT '',
  firm_address text DEFAULT '',
  firm_city text DEFAULT '',
  firm_state text DEFAULT '',
  firm_zip text DEFAULT '',
  firm_website text,
  billing_monthly_acknowledged boolean DEFAULT false,
  billing_immediate_acknowledged boolean DEFAULT false,
  billing_plaid_acknowledged boolean DEFAULT false,
  billing_isoftpull_acknowledged boolean DEFAULT false,
  billing_third_party_acknowledged boolean DEFAULT false,
  billing_consent_timestamp timestamptz,
  consented_general boolean DEFAULT false,
  consented_sendgrid boolean DEFAULT false,
  consented_twilio boolean DEFAULT false,
  consented_isoftpull boolean DEFAULT false,
  consented_plaid boolean DEFAULT false,
  consented_electronic boolean DEFAULT false,
  vendor_consent_timestamp timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE attorney_registrations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'attorney_registrations' AND policyname = 'Attorneys can insert own registration'
  ) THEN
    CREATE POLICY "Attorneys can insert own registration"
      ON attorney_registrations FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'attorney_registrations' AND policyname = 'Attorneys can select own registration'
  ) THEN
    CREATE POLICY "Attorneys can select own registration"
      ON attorney_registrations FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'attorney_registrations' AND policyname = 'Attorneys can update own registration'
  ) THEN
    CREATE POLICY "Attorneys can update own registration"
      ON attorney_registrations FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'attorney_registrations' AND policyname = 'Service role full access to attorney_registrations'
  ) THEN
    CREATE POLICY "Service role full access to attorney_registrations"
      ON attorney_registrations FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS attorney_registrations_user_id_idx ON attorney_registrations(user_id);
CREATE INDEX IF NOT EXISTS attorney_registrations_email_idx ON attorney_registrations(email);
CREATE INDEX IF NOT EXISTS attorney_registrations_firm_name_idx ON attorney_registrations(firm_name);
