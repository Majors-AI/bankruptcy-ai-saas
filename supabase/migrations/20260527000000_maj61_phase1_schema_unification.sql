/*
  # MAJ-61 Phase 1 — Schema Unification for BankruptcyIntake.jsx

  BankruptcyIntake.jsx (source form) does not collect dob, ssn_last4, or
  primary_reason, but the original CREATE TABLE defined them as NOT NULL.
  This migration makes those columns nullable so source-form submissions can
  insert without providing those values.

  Also adds client_id and reference_number columns that the source form writes
  on every submission.

  ClientIntakeForm.tsx (destination form) is unchanged — it already provides
  dob, ssn_last4, and primary_reason on every insert, so making them nullable
  has no effect on that path.
*/

-- Make fields nullable that BankruptcyIntake.jsx does not collect

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_submissions' AND column_name = 'dob'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE intake_submissions ALTER COLUMN dob DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_submissions' AND column_name = 'ssn_last4'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE intake_submissions ALTER COLUMN ssn_last4 DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_submissions' AND column_name = 'primary_reason'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE intake_submissions ALTER COLUMN primary_reason DROP NOT NULL;
    ALTER TABLE intake_submissions ALTER COLUMN primary_reason SET DEFAULT '';
  END IF;
END $$;

-- Add client_id column (links back to the client record that triggered intake)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_submissions' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE intake_submissions ADD COLUMN client_id uuid;
  END IF;
END $$;

-- Add reference_number column (BAI-XXXXXXXX display identifier)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_submissions' AND column_name = 'reference_number'
  ) THEN
    ALTER TABLE intake_submissions ADD COLUMN reference_number text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_intake_submissions_client_id
  ON intake_submissions (client_id);

CREATE INDEX IF NOT EXISTS idx_intake_submissions_reference_number
  ON intake_submissions (reference_number);
