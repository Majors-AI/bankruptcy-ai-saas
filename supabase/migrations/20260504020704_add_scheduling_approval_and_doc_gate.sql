/*
  # Add Scheduling Approval and Document Gate to Attorney Case Reviews

  ## Summary
  Adds the ability for an attorney to explicitly approve a client to schedule their
  signing appointment. The scheduling approval is separate from the general "case approved"
  status and carries its own checklist gate — certain documents must be confirmed present
  before the attorney can issue the green light.

  ## Changes to `attorney_case_reviews`
  - `scheduling_approved` (boolean, default false) — attorney has explicitly approved client to schedule
  - `scheduling_approved_at` (timestamptz) — when the approval was granted
  - `scheduling_approved_by` (text) — attorney name who approved
  - `scheduling_blocked_reason` (text) — optional note explaining why scheduling was not approved
  - `scheduling_doc_checklist` (jsonb) — snapshot of which hard-block documents were confirmed
    present at the time of approval (id, ssn, credit_counseling, mortgage_stmt, auto_loan_stmt, bank_stmt)

  ## Security
  - RLS already enabled on attorney_case_reviews (from prior migration)
  - No new tables — only column additions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attorney_case_reviews' AND column_name = 'scheduling_approved'
  ) THEN
    ALTER TABLE attorney_case_reviews
      ADD COLUMN scheduling_approved boolean NOT NULL DEFAULT false,
      ADD COLUMN scheduling_approved_at timestamptz,
      ADD COLUMN scheduling_approved_by text,
      ADD COLUMN scheduling_blocked_reason text,
      ADD COLUMN scheduling_doc_checklist jsonb;
  END IF;
END $$;
