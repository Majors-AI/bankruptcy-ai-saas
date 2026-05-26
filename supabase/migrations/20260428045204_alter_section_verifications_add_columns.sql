/*
  # Alter section_verifications — add missing columns

  Adds exemptions_applied (jsonb) and updated_at (timestamptz) columns
  that were not present in the initial table creation.
  Also adds section_key as an alias for section_id to match the new schema.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'section_verifications' AND column_name = 'exemptions_applied'
  ) THEN
    ALTER TABLE section_verifications ADD COLUMN exemptions_applied jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'section_verifications' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE section_verifications ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_section_verifications_review_id
  ON section_verifications (review_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_section_verifications_review_section
  ON section_verifications (review_id, section_id);
