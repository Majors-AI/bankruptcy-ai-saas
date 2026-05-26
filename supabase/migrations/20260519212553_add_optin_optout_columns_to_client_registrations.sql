/*
  # Add opt-in / opt-out consent columns to client_registrations

  ## Changes
  - Adds opt_in_isoftpull boolean: true = consented to soft credit pull; false = opted out (will provide manually)
  - Adds opt_in_plaid boolean: true = consented to Plaid bank linking; false = opted out (will provide manually)
  - Adds opt_in_boldsign boolean: true = consented to BoldSign e-sign; false = opted out (will sign on paper/provide manually)
  - Adds consented_boldsign boolean: overall BoldSign disclosure acknowledged
  - Adds skipped_registration boolean: client went direct to disclosures without creating account
  - All default false to be safe (restrictive default)
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_registrations' AND column_name='opt_in_isoftpull') THEN
    ALTER TABLE client_registrations ADD COLUMN opt_in_isoftpull boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_registrations' AND column_name='opt_in_plaid') THEN
    ALTER TABLE client_registrations ADD COLUMN opt_in_plaid boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_registrations' AND column_name='opt_in_boldsign') THEN
    ALTER TABLE client_registrations ADD COLUMN opt_in_boldsign boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_registrations' AND column_name='consented_boldsign') THEN
    ALTER TABLE client_registrations ADD COLUMN consented_boldsign boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_registrations' AND column_name='skipped_registration') THEN
    ALTER TABLE client_registrations ADD COLUMN skipped_registration boolean NOT NULL DEFAULT false;
  END IF;
END $$;
