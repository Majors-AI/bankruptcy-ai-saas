/*
  # Attorney Review Portal Tables

  ## Summary
  Supports the attorney's final case review workflow. Stores the attorney's review
  session for each client, per-section issue flags, and the outbound email action
  taken (approve-to-proceed vs. issues-found).

  ## New Tables

  ### `attorney_case_reviews`
  One row per attorney review session per client.
  - `id` (uuid, pk)
  - `client_id` (text) — client identifier
  - `attorney_name` (text) — reviewing attorney
  - `status` — 'in_progress' | 'approved' | 'issues_found'
  - `review_notes` (text, nullable) — general notes for the file
  - `email_sent_at` (timestamptz, nullable) — when outbound email was dispatched
  - `email_type` — 'approved' | 'issues_found' | null
  - `document_reminders_included` (boolean) — whether updated-doc reminder was included
  - `credit_counseling_included` (boolean) — whether credit counseling invitation included
  - `filing_fee_included` (boolean) — whether court filing fee reminder included
  - `created_at`, `updated_at`

  ### `attorney_review_issues`
  Individual issues flagged per section during review.
  - `id` (uuid, pk)
  - `review_id` (uuid, fk → attorney_case_reviews)
  - `section` (text) — e.g. 'Personal Information', 'Property & Assets'
  - `severity` — 'warning' | 'error' | 'info'
  - `description` (text) — human-readable description of the issue
  - `resolved` (boolean)
  - `created_at`

  ## Security
  - RLS enabled on both tables
  - Anon insert/select/update (demo environment, no auth)
*/

CREATE TABLE IF NOT EXISTS attorney_case_reviews (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                     text NOT NULL DEFAULT 'client-demo',
  attorney_name                 text NOT NULL DEFAULT 'Jennifer Smith, Esq.',
  status                        text NOT NULL DEFAULT 'in_progress',
  review_notes                  text,
  email_sent_at                 timestamptz,
  email_type                    text,
  document_reminders_included   boolean NOT NULL DEFAULT false,
  credit_counseling_included    boolean NOT NULL DEFAULT false,
  filing_fee_included           boolean NOT NULL DEFAULT false,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE attorney_case_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert attorney reviews"
  ON attorney_case_reviews FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can select attorney reviews"
  ON attorney_case_reviews FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can update attorney reviews"
  ON attorney_case_reviews FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_attorney_case_reviews_client_id
  ON attorney_case_reviews (client_id);

-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS attorney_review_issues (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   uuid REFERENCES attorney_case_reviews(id) ON DELETE CASCADE,
  section     text NOT NULL DEFAULT '',
  severity    text NOT NULL DEFAULT 'warning',
  description text NOT NULL DEFAULT '',
  resolved    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE attorney_review_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert review issues"
  ON attorney_review_issues FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can select review issues"
  ON attorney_review_issues FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can update review issues"
  ON attorney_review_issues FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon can delete review issues"
  ON attorney_review_issues FOR DELETE TO anon USING (true);

CREATE INDEX IF NOT EXISTS idx_attorney_review_issues_review_id
  ON attorney_review_issues (review_id);
