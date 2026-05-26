/*
  # Session Progress & Time Entries

  ## Purpose
  Persist questionnaire progress across sessions so clients can resume where they left off.
  Also log all help/chat interactions as time entries tied to the client file.

  ## New Tables

  ### `session_progress`
  - Stores the client's current step index, full form data (JSON), and metadata
  - One row per client_id — upserted on every save
  - Fields:
    - `id` (uuid, pk)
    - `client_id` (text, unique) — identifies the client
    - `current_step` (int) — zero-based index into SECTIONS array
    - `form_data` (jsonb) — full serialized questionnaire data
    - `doc_status` (jsonb) — document upload status map
    - `sections_completed` (int) — count of completed sections for display
    - `last_active_section` (text) — label of the last active section
    - `updated_at` (timestamptz)
    - `created_at` (timestamptz)

  ### `case_time_entries`
  - Logs every help chat open event and attorney escalation as a time entry on the client file
  - Fields:
    - `id` (uuid, pk)
    - `client_id` (text)
    - `client_name` (text)
    - `entry_type` (text) — 'help_chat_opened' | 'attorney_escalation' | 'section_visited' | 'session_resumed'
    - `section_id` (text) — which section was active
    - `section_label` (text)
    - `notes` (text) — additional context
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Public (anon) insert and select allowed — current app has no auth
*/

CREATE TABLE IF NOT EXISTS session_progress (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             text UNIQUE NOT NULL,
  current_step          int NOT NULL DEFAULT 0,
  form_data             jsonb DEFAULT '{}',
  doc_status            jsonb DEFAULT '{}',
  sections_completed    int DEFAULT 0,
  last_active_section   text DEFAULT '',
  updated_at            timestamptz DEFAULT now(),
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE session_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert session_progress"
  ON session_progress FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can select session_progress"
  ON session_progress FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can update session_progress"
  ON session_progress FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS case_time_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      text NOT NULL DEFAULT '',
  client_name    text NOT NULL DEFAULT '',
  entry_type     text NOT NULL DEFAULT 'help_chat_opened',
  section_id     text NOT NULL DEFAULT '',
  section_label  text NOT NULL DEFAULT '',
  notes          text DEFAULT '',
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE case_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert case_time_entries"
  ON case_time_entries FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can select case_time_entries"
  ON case_time_entries FOR SELECT
  TO anon
  USING (true);
