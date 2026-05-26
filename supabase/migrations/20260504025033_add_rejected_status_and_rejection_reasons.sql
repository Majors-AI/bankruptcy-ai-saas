/*
  # Add rejection support to paralegal review

  1. Changes
    - Add 'rejected' to `paralegal_section_confirmations.status` check constraint
    - Add `rejection_reason` column to `paralegal_section_confirmations` (structured enum)
    - Add `rejection_detail` column to `paralegal_section_confirmations` (free text for "other")
    - Add `rejection_reason` column to `paralegal_doc_confirmations` (structured enum)
    - Add `rejection_detail` column to `paralegal_doc_confirmations` (free text for "other")

  2. Rejection reasons (enum-like)
    - not_correct
    - incomplete_documents
    - duplicate_entry
    - not_applicable
    - other

  3. Notes
    - Columns are nullable — only populated when status = 'rejected'
    - No data is deleted or altered; purely additive
*/

-- Add rejection columns to paralegal_section_confirmations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paralegal_section_confirmations' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE paralegal_section_confirmations ADD COLUMN rejection_reason text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paralegal_section_confirmations' AND column_name = 'rejection_detail'
  ) THEN
    ALTER TABLE paralegal_section_confirmations ADD COLUMN rejection_detail text;
  END IF;
END $$;

-- Add rejection columns to paralegal_doc_confirmations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paralegal_doc_confirmations' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE paralegal_doc_confirmations ADD COLUMN rejection_reason text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paralegal_doc_confirmations' AND column_name = 'rejection_detail'
  ) THEN
    ALTER TABLE paralegal_doc_confirmations ADD COLUMN rejection_detail text;
  END IF;
END $$;
