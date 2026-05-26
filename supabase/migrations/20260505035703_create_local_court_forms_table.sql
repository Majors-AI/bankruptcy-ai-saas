/*
  # Local Court Forms Table

  ## Summary
  Stores local bankruptcy court forms organized by district. Each form has a
  form number, name, description, chapter applicability, and a URL.

  ## New Tables

  ### `local_court_forms`
  - `id` (uuid, pk)
  - `district_code` (text) — e.g. 'AZ', 'E_WA', 'W_WA', 'N_TX'
  - `district_name` (text) — full district name
  - `form_number` (text) — official form number/ID
  - `form_name` (text)
  - `description` (text, nullable)
  - `chapter_applicability` (text) — e.g. 'All', 'Chapter 7', 'Chapter 13', 'Chapter 11', 'Adversary'
  - `category` (text, nullable) — e.g. 'ECF', 'ADR', 'Plan', 'Discharge'
  - `form_url` (text, nullable)
  - `sort_order` (int)
  - `created_at`
*/

CREATE TABLE IF NOT EXISTS local_court_forms (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_code         text NOT NULL DEFAULT '',
  district_name         text NOT NULL DEFAULT '',
  form_number           text NOT NULL DEFAULT '',
  form_name             text NOT NULL DEFAULT '',
  description           text,
  chapter_applicability text NOT NULL DEFAULT 'All',
  category              text,
  form_url              text,
  sort_order            int NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE local_court_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon select local_court_forms"
  ON local_court_forms FOR SELECT TO anon USING (true);

CREATE POLICY "Anon insert local_court_forms"
  ON local_court_forms FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon update local_court_forms"
  ON local_court_forms FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon delete local_court_forms"
  ON local_court_forms FOR DELETE TO anon USING (true);

CREATE INDEX IF NOT EXISTS idx_lcf_district ON local_court_forms (district_code);
