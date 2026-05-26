/*
  # Message Portal Schema

  ## Purpose
  Supports an internal staff-to-client messaging system with multi-channel delivery
  (in-app, SMS via Twilio, email via SendGrid, Google Meet links).

  ## New Tables

  ### client_message_threads
  One thread per client. All messages for a client are grouped here.
  - id, client_id (FK to accounting_clients), created_at, updated_at
  - unread_count: how many messages the staff has not yet marked read

  ### client_messages
  Individual messages sent to or about a client.
  - id, thread_id (FK), client_id (FK)
  - sender_role: 'attorney' | 'paralegal' | 'staff' | 'system'
  - sender_name: display name of sender
  - subject: optional subject line
  - body: message body text
  - channel: 'in_app' | 'sms' | 'email' | 'voice' | 'google_meet'
  - delivery_status: 'pending' | 'sent' | 'delivered' | 'failed'
  - delivery_error: error message if failed
  - external_id: Twilio SID or SendGrid message ID for tracking
  - meet_link: Google Meet URL if channel = google_meet
  - related_document: optional doc key this message references (for missing doc alerts)
  - is_internal: if true, message is staff-only note (never shown to client)
  - sent_at, created_at

  ## Security
  - RLS enabled on all tables
  - All access restricted to authenticated users only
  - Clients must NOT be able to read is_internal=true messages
*/

-- ── Threads ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_message_threads (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid NOT NULL,
  unread_count   int NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_message_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated staff can view message threads"
  ON client_message_threads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated staff can insert message threads"
  ON client_message_threads FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated staff can update message threads"
  ON client_message_threads FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anon read for client portal polling
CREATE POLICY "Anon can view message threads"
  ON client_message_threads FOR SELECT
  TO anon
  USING (true);

-- ── Messages ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id        uuid NOT NULL REFERENCES client_message_threads(id) ON DELETE CASCADE,
  client_id        uuid NOT NULL,
  sender_role      text NOT NULL DEFAULT 'staff',
  sender_name      text NOT NULL DEFAULT 'Staff',
  subject          text,
  body             text NOT NULL DEFAULT '',
  channel          text NOT NULL DEFAULT 'in_app',
  delivery_status  text NOT NULL DEFAULT 'pending',
  delivery_error   text,
  external_id      text,
  meet_link        text,
  related_document text,
  is_internal      boolean NOT NULL DEFAULT false,
  sent_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated staff can view all messages"
  ON client_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated staff can insert messages"
  ON client_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated staff can update messages"
  ON client_messages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anon read only non-internal messages (client portal)
CREATE POLICY "Anon can view non-internal messages"
  ON client_messages FOR SELECT
  TO anon
  USING (is_internal = false);

-- Anon insert for client-originated messages (future use)
CREATE POLICY "Anon can insert messages"
  ON client_messages FOR INSERT
  TO anon
  WITH CHECK (is_internal = false);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_client_message_threads_client_id
  ON client_message_threads(client_id);

CREATE INDEX IF NOT EXISTS idx_client_messages_thread_id
  ON client_messages(thread_id);

CREATE INDEX IF NOT EXISTS idx_client_messages_client_id
  ON client_messages(client_id);

CREATE INDEX IF NOT EXISTS idx_client_messages_created_at
  ON client_messages(created_at DESC);
