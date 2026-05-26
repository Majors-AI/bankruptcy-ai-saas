/*
  # Paralegal Document Review Tables

  ## Purpose
  Supports structured paralegal-led document review sessions conducted with clients.
  Each review session walks through schedule-based sections, confirms documents,
  and tracks per-document decisions (confirmed, needs_info, rejected, transferred).

  ## New Tables

  ### paralegal_reviews
  One row per paralegal review session for a client.
  - id (uuid pk)
  - client_id (text) — matches client_documents.client_id
  - paralegal_name (text)
  - status: 'in_progress' | 'complete' | 'needs_info'
  - notes (text nullable)
  - info_request_sent_at (timestamptz nullable) — when "needs additional info" link was sent
  - created_at, updated_at

  ### paralegal_doc_confirmations
  One row per document per review session — tracks paralegal's decision on each document.
  - id (uuid pk)
  - review_id (uuid FK → paralegal_reviews)
  - client_document_id (uuid FK → client_documents)
  - section (text) — which review section this doc belongs to
  - status: 'pending' | 'confirmed' | 'needs_info' | 'rejected' | 'transferred' | 'duplicated'
  - transfer_to_section (text nullable) — destination section when transferred
  - paralegal_note (text nullable)
  - confirmed_at (timestamptz nullable)
  - created_at

  ### paralegal_section_confirmations
  One row per section per review — tracks whether the entire section has been signed off.
  - id (uuid pk)
  - review_id (uuid FK → paralegal_reviews)
  - section_key (text) — e.g. 'personal_info', 'income', 'assets'
  - status: 'pending' | 'confirmed' | 'needs_info'
  - paralegal_note (text nullable)
  - confirmed_at (timestamptz nullable)
  - created_at

  ## Security
  - RLS enabled on all three tables
  - Anon (paralegal staff) can read/insert/update — staff are not authenticated clients
*/

-- ── paralegal_reviews ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS paralegal_reviews (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            text NOT NULL DEFAULT '',
  paralegal_name       text NOT NULL DEFAULT '',
  status               text NOT NULL DEFAULT 'in_progress'
                         CHECK (status IN ('in_progress', 'complete', 'needs_info')),
  notes                text,
  info_request_sent_at timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE paralegal_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read paralegal_reviews"
  ON paralegal_reviews FOR SELECT TO anon USING (true);

CREATE POLICY "Anon insert paralegal_reviews"
  ON paralegal_reviews FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon update paralegal_reviews"
  ON paralegal_reviews FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── paralegal_doc_confirmations ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS paralegal_doc_confirmations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id            uuid NOT NULL REFERENCES paralegal_reviews(id) ON DELETE CASCADE,
  client_document_id   uuid NOT NULL REFERENCES client_documents(id) ON DELETE CASCADE,
  section              text NOT NULL DEFAULT '',
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','confirmed','needs_info','rejected','transferred','duplicated')),
  transfer_to_section  text,
  paralegal_note       text,
  confirmed_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE paralegal_doc_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read paralegal_doc_confirmations"
  ON paralegal_doc_confirmations FOR SELECT TO anon USING (true);

CREATE POLICY "Anon insert paralegal_doc_confirmations"
  ON paralegal_doc_confirmations FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon update paralegal_doc_confirmations"
  ON paralegal_doc_confirmations FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── paralegal_section_confirmations ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS paralegal_section_confirmations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id      uuid NOT NULL REFERENCES paralegal_reviews(id) ON DELETE CASCADE,
  section_key    text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','confirmed','needs_info')),
  paralegal_note text,
  confirmed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE paralegal_section_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read paralegal_section_confirmations"
  ON paralegal_section_confirmations FOR SELECT TO anon USING (true);

CREATE POLICY "Anon insert paralegal_section_confirmations"
  ON paralegal_section_confirmations FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon update paralegal_section_confirmations"
  ON paralegal_section_confirmations FOR UPDATE TO anon USING (true) WITH CHECK (true);
