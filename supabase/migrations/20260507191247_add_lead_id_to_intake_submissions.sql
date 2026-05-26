/*
  # Add lead_id and completed_by_staff to intake_submissions

  1. Changes
    - `intake_submissions`
      - Add `lead_id` (uuid, nullable) — links a submission back to the intake_leads row
      - Add `completed_by_staff` (boolean, default false) — true when staff filled the form on behalf of client during a consult
      - Add index on lead_id for fast lookup

  2. Notes
    - No data loss — only additive columns
    - Existing RLS policies unchanged
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_submissions' AND column_name = 'lead_id'
  ) THEN
    ALTER TABLE intake_submissions ADD COLUMN lead_id uuid REFERENCES intake_leads(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_submissions' AND column_name = 'completed_by_staff'
  ) THEN
    ALTER TABLE intake_submissions ADD COLUMN completed_by_staff boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_intake_submissions_lead_id ON intake_submissions(lead_id);
