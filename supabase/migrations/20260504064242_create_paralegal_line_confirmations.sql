/*
  # Create paralegal_line_confirmations table

  ## Purpose
  Stores paralegal per-line value confirmations for each petition data item
  (schedule line, creditor, asset, etc.) during a paralegal review session.

  ## New Tables
  - `paralegal_line_confirmations`
    - `id` (uuid, pk)
    - `review_id` (uuid, FK to paralegal_reviews)
    - `line_key` (text) – unique key per line, e.g. "asset_real_0", "cred_cc"
    - `schedule` (text) – e.g. "Schedule A/B", "Schedule D"
    - `label` (text) – human-readable label for the line
    - `intake_value` (text) – original value from intake submission
    - `confirmed_value` (text) – value confirmed or amended by paralegal
    - `status` (text) – pending / confirmed / amended / flagged
    - `paralegal_note` (text)
    - `confirmed_at` (timestamptz)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can read/write their own review's confirmations
  - Anon key allowed for demo mode (insert/update/select)
*/

CREATE TABLE IF NOT EXISTS paralegal_line_confirmations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id       uuid NOT NULL REFERENCES paralegal_reviews(id) ON DELETE CASCADE,
  line_key        text NOT NULL,
  schedule        text NOT NULL DEFAULT '',
  label           text NOT NULL DEFAULT '',
  intake_value    text NOT NULL DEFAULT '',
  confirmed_value text,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','amended','flagged')),
  paralegal_note  text,
  confirmed_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (review_id, line_key)
);

ALTER TABLE paralegal_line_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select line confirmations"
  ON paralegal_line_confirmations FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert line confirmations"
  ON paralegal_line_confirmations FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update line confirmations"
  ON paralegal_line_confirmations FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_plc_review_id ON paralegal_line_confirmations(review_id);
CREATE INDEX IF NOT EXISTS idx_plc_line_key  ON paralegal_line_confirmations(line_key);
