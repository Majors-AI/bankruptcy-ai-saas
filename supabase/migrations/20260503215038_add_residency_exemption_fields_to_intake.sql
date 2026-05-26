/*
  # Add residency and exemption determination fields to intake_submissions

  Replaces the generic `address_years` / `prior_state` columns with precise fields
  that support the 11 U.S.C. § 522(b)(3)(A) two-year domicile / 180-day lookback
  exemption state calculation.

  New Columns:
  - `in_state_over_2_years` (boolean) — debtor's answer to the 2-year question
  - `moved_to_state_date` (text, YYYY-MM) — when they moved to the current state (if < 2 yrs)
  - `prior_residences_json` (jsonb) — array of { state, city, fromDate, toDate } records
  - `exemption_state` (text) — resolved state whose exemptions apply
  - `exemption_state_reason` (text) — plain-English explanation of why that state was chosen

  Old columns `address_years` and `prior_state` are kept for backwards compatibility with
  any existing rows but are no longer populated by the new form.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_submissions' AND column_name = 'in_state_over_2_years'
  ) THEN
    ALTER TABLE intake_submissions ADD COLUMN in_state_over_2_years boolean;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_submissions' AND column_name = 'moved_to_state_date'
  ) THEN
    ALTER TABLE intake_submissions ADD COLUMN moved_to_state_date text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_submissions' AND column_name = 'prior_residences_json'
  ) THEN
    ALTER TABLE intake_submissions ADD COLUMN prior_residences_json jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_submissions' AND column_name = 'exemption_state'
  ) THEN
    ALTER TABLE intake_submissions ADD COLUMN exemption_state text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_submissions' AND column_name = 'exemption_state_reason'
  ) THEN
    ALTER TABLE intake_submissions ADD COLUMN exemption_state_reason text;
  END IF;
END $$;
