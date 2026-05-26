/*
  # Client Questions — Persistent Question Tracking

  Tracks every question a client asks via the Chat Assistant, with status so
  unanswered or escalated questions carry forward for attorney review after
  submission.

  ## New Table: `client_questions`
  - `id` — uuid primary key
  - `client_id` — identifies which client asked the question
  - `client_name` — display name
  - `question` — the full question text
  - `asked_at` — when it was asked
  - `ai_response` — what the assistant answered (null if not answered)
  - `status` — 'answered' | 'needs_attorney' | 'pending_review'
  - `escalated` — true if AI flagged as legal advice needed
  - `needs_additional_explanation` — true if client explicitly asked for more info
  - `attorney_answer` — attorney's response (null until answered)
  - `attorney_answered_at` — when attorney answered
  - `answered_by` — attorney name
  - `session_id` — links to chat_sessions for context
  - `section_context` — which form section the client was on when they asked
  - `created_at`, `updated_at`

  ## Security
  - RLS enabled
  - Public anon insert (no auth in current app)
  - Public anon select (filtered by client_id in application layer)
  - Public anon update (for marking needs_additional_explanation)
*/

CREATE TABLE IF NOT EXISTS client_questions (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                     text NOT NULL DEFAULT '',
  client_name                   text NOT NULL DEFAULT '',
  question                      text NOT NULL DEFAULT '',
  asked_at                      timestamptz DEFAULT now(),
  ai_response                   text,
  status                        text NOT NULL DEFAULT 'pending_review',
  escalated                     boolean DEFAULT false,
  needs_additional_explanation  boolean DEFAULT false,
  attorney_answer               text,
  attorney_answered_at          timestamptz,
  answered_by                   text,
  session_id                    uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  section_context               text,
  created_at                    timestamptz DEFAULT now(),
  updated_at                    timestamptz DEFAULT now()
);

ALTER TABLE client_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert client questions"
  ON client_questions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can select client questions"
  ON client_questions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can update client questions"
  ON client_questions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_client_questions_client_id ON client_questions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_questions_status ON client_questions(status);
CREATE INDEX IF NOT EXISTS idx_client_questions_escalated ON client_questions(escalated);
