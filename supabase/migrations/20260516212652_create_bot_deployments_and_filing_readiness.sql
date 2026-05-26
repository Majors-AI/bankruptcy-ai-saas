/*
  # AI Bot Deployments & Filing Readiness

  ## Changes to file_a_case_queue
  - Add bank_balance_confirmed_at, client_info_confirmed_at, requires_resign, resign_reason, filing_readiness_checked_at

  ## New Tables
  - bot_deployments: AI bot instances with channel, purpose, prompt config
  - bot_assignments: Links bots to specific client cases
  - bot_conversations: Full conversation history for bot and staff interactions, auto-logged to case_time_log
*/

-- ─── Extend file_a_case_queue ─────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'file_a_case_queue' AND column_name = 'bank_balance_confirmed_at') THEN
    ALTER TABLE file_a_case_queue ADD COLUMN bank_balance_confirmed_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'file_a_case_queue' AND column_name = 'client_info_confirmed_at') THEN
    ALTER TABLE file_a_case_queue ADD COLUMN client_info_confirmed_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'file_a_case_queue' AND column_name = 'requires_resign') THEN
    ALTER TABLE file_a_case_queue ADD COLUMN requires_resign boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'file_a_case_queue' AND column_name = 'resign_reason') THEN
    ALTER TABLE file_a_case_queue ADD COLUMN resign_reason text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'file_a_case_queue' AND column_name = 'filing_readiness_checked_at') THEN
    ALTER TABLE file_a_case_queue ADD COLUMN filing_readiness_checked_at timestamptz;
  END IF;
END $$;

-- ─── bot_deployments ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bot_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,
  display_name text NOT NULL,
  channel text NOT NULL DEFAULT 'all' CHECK (channel IN ('phone', 'email', 'sms', 'dm', 'all')),
  purpose text NOT NULL DEFAULT 'general_support' CHECK (purpose IN (
    'intake_screening', 'post_filing_followup', 'creditor_response',
    'general_support', 'collections', 'document_reminder', 'hearing_reminder'
  )),
  system_prompt text,
  greeting_message text,
  is_active boolean NOT NULL DEFAULT true,
  assigned_by text NOT NULL DEFAULT 'Admin',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bot_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read bot_deployments" ON bot_deployments FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert bot_deployments" ON bot_deployments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update bot_deployments" ON bot_deployments FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ─── bot_assignments ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bot_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES bot_deployments(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  client_name text NOT NULL,
  case_number text,
  assigned_by text NOT NULL DEFAULT 'Staff',
  assignment_reason text,
  active_since timestamptz DEFAULT now(),
  deactivated_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bot_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read bot_assignments" ON bot_assignments FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert bot_assignments" ON bot_assignments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update bot_assignments" ON bot_assignments FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ─── bot_conversations ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid REFERENCES bot_deployments(id) ON DELETE SET NULL,
  client_id text,
  client_name text NOT NULL,
  channel text NOT NULL DEFAULT 'sms' CHECK (channel IN ('phone', 'email', 'sms', 'dm', 'chat')),
  direction text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  message_body text NOT NULL,
  response_body text,
  staff_name text,
  conversation_thread_id text,
  logged_to_time_log boolean NOT NULL DEFAULT false,
  time_log_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bot_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read bot_conversations" ON bot_conversations FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert bot_conversations" ON bot_conversations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update bot_conversations" ON bot_conversations FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ─── Seed default bots ───────────────────────────────────────────────────────

INSERT INTO bot_deployments (bot_name, display_name, channel, purpose, greeting_message, system_prompt, is_active, assigned_by)
VALUES
  (
    'intake_bot', 'Intake Screener', 'phone', 'intake_screening',
    'Thank you for calling. I am here to assist with your bankruptcy inquiry. May I have your name?',
    'You are an intake screening assistant for a bankruptcy law firm. Collect eligibility information and schedule consultations. Never provide legal advice.',
    true, 'Admin'
  ),
  (
    'followup_bot', 'Post-Filing Guide', 'sms', 'post_filing_followup',
    'This is an automated update from your bankruptcy attorney office. We have a status update for your case.',
    'You are a post-filing follow-up assistant. Send scheduled status updates, hearing reminders, and document deadline notices. Always identify as automated.',
    true, 'Admin'
  ),
  (
    'doc_reminder_bot', 'Document Reminder', 'email', 'document_reminder',
    'Hello, this is a reminder from our office regarding outstanding documents needed for your case.',
    'You are a document reminder assistant. Follow up with clients about missing documents. Be friendly but persistent. Log all interactions.',
    true, 'Admin'
  ),
  (
    'creditor_bot', 'Creditor Response', 'phone', 'creditor_response',
    'Thank you for calling. This is an automated response system. We can only confirm representation status.',
    'You are a creditor response bot. Confirm representation only. Never disclose case details, balances, or filing dates. If case is filed, advise automatic stay is in effect under 11 U.S.C. 362.',
    true, 'Admin'
  ),
  (
    'hearing_bot', 'Hearing Reminder', 'sms', 'hearing_reminder',
    'Reminder: Your 341 hearing is scheduled. Please confirm your attendance.',
    'You are a hearing reminder assistant. Send 341 meeting reminders, confirm attendance, and provide hearing preparation tips.',
    true, 'Admin'
  );
