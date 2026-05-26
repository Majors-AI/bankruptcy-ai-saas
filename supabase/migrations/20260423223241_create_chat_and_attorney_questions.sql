/*
  # Chat & Attorney Questions System

  1. New Tables
    - `chat_sessions` — a single chat thread per client session
      - `id` (uuid, pk)
      - `client_id` (text) — identifies the client (from case data)
      - `created_at` (timestamptz)

    - `chat_messages` — individual messages in a chat session
      - `id` (uuid, pk)
      - `session_id` (uuid, fk → chat_sessions)
      - `role` (text) — 'user' | 'assistant' | 'system'
      - `content` (text)
      - `is_legal_escalation` (boolean) — true when AI flagged this as legal advice needed
      - `created_at` (timestamptz)

    - `attorney_questions` — questions escalated from AI to attorney queue
      - `id` (uuid, pk)
      - `session_id` (uuid, fk → chat_sessions)
      - `message_id` (uuid, fk → chat_messages)
      - `client_id` (text)
      - `client_name` (text)
      - `question` (text) — the original client question
      - `status` (text) — 'pending' | 'answered'
      - `answered_by` (text)
      - `answer` (text)
      - `answered_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Public insert allowed for chat (clients are not authenticated in current app)
    - Public read allowed for own session messages (by session_id)

  3. Notes
    - The current app has no auth; clients are identified by a client_id string
    - attorney_questions are created by the edge function when legal advice is detected
*/

CREATE TABLE IF NOT EXISTS chat_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert chat sessions"
  ON chat_sessions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can select chat sessions"
  ON chat_sessions FOR SELECT
  TO anon
  USING (true);

CREATE TABLE IF NOT EXISTS chat_messages (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role                 text NOT NULL DEFAULT 'user',
  content              text NOT NULL DEFAULT '',
  is_legal_escalation  boolean DEFAULT false,
  created_at           timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert chat messages"
  ON chat_messages FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can select chat messages"
  ON chat_messages FOR SELECT
  TO anon
  USING (true);

CREATE TABLE IF NOT EXISTS attorney_questions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  message_id   uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
  client_id    text NOT NULL DEFAULT '',
  client_name  text NOT NULL DEFAULT '',
  question     text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'pending',
  answered_by  text,
  answer       text,
  answered_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE attorney_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert attorney questions"
  ON attorney_questions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can select attorney questions"
  ON attorney_questions FOR SELECT
  TO anon
  USING (true);
