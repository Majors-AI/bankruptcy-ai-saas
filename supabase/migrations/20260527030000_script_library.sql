/*
  # BAN-36 — Script Library

  Houses approved UPL-safe scripts used across the platform. Each row is keyed
  by script_key and may declare variable placeholders that callers substitute
  at render time via lib/scriptLibrary.ts.

  Versioning: a script_key may have multiple rows; is_active=true marks the
  current canonical version. effective_date + version are informational. To
  retire a script set is_active=false (do not delete — keep an audit trail).
*/

CREATE TABLE IF NOT EXISTS script_library (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_key      text NOT NULL,
  name            text NOT NULL,
  script_text     text NOT NULL,
  variables       jsonb NOT NULL DEFAULT '[]'::jsonb,
  version         integer NOT NULL DEFAULT 1,
  effective_date  timestamptz NOT NULL DEFAULT now(),
  approved_by     uuid REFERENCES auth.users(id),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Only one active row per script_key. New versions: insert with is_active=true
-- after marking the previous row is_active=false.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_script_library_active_key
  ON script_library (script_key) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_script_library_key ON script_library (script_key);

ALTER TABLE script_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read active scripts"
  ON script_library FOR SELECT TO anon USING (is_active = true);

-- Seed: 7 UPL-safe scripts. Single quotes inside script_text are doubled.
INSERT INTO script_library (script_key, name, script_text, variables, is_active) VALUES
  (
    'intake_bot_opening',
    'AI Intake Bot Opening',
    'Hi, I''m an AI assistant for {firm_name}. I''m not an attorney, and the legal administrators you''ll speak with are not attorneys either. Your case is reviewed by a licensed attorney to determine eligibility. Although our system uses AI, our attorneys review all cases and provide advice based on what is provided. Let''s gather some preliminary information to set up your consultation.',
    '["firm_name"]'::jsonb,
    true
  ),
  (
    'intake_staff_verification_opening',
    'Intake Staff Verification Call Opening',
    'Hi {client_name}, my name is {staff_name} and I''m a legal administrator at {firm_name} — I''m not an attorney. I''m calling to verify the information you provided so a licensed attorney can review your case. The attorney will determine your eligibility and make all decisions about chapter and strategy. Although our system uses AI to organize information, our attorneys review all cases personally and provide advice based on what is provided. Can we go through your intake information together so I can make sure everything is accurate?',
    '["client_name", "staff_name", "firm_name"]'::jsonb,
    true
  ),
  (
    'post_acceptance_legal_admin',
    'Post-Attorney-Acceptance Script',
    'Hi {client_name}, great news — {attorney_name} has reviewed your case and accepted it. {attorney_name} has determined you qualify for {chapter} based on the information you provided. The attorney has quoted a total fee of ${total_fee} for this case type. As a legal administrator I''ll help you work out a payment plan that fits your situation, but the total fee was set by the attorney. Let''s talk about what works for you.',
    '["client_name", "attorney_name", "chapter", "total_fee"]'::jsonb,
    true
  ),
  (
    'attorney_clarification_request',
    'Attorney Requests Clarification',
    'Hi {client_name}, {attorney_name} is reviewing your case and has a few follow-up questions before making a decision. We need to clarify {clarification_topics} — would you be able to {action_request} so the attorney can complete the review?',
    '["client_name", "attorney_name", "clarification_topics", "action_request"]'::jsonb,
    true
  ),
  (
    'liaison_agent_opening',
    'Liaison Agent Opening Post-Acceptance',
    'Hi {client_name}, I''m the case assistant for {firm_name}. I help you stay on track with documents and deadlines. I''m not an attorney, and I cannot give legal advice. Any legal question I''ll route to your attorney — they review and respond directly. What can I help you with today?',
    '["client_name", "firm_name"]'::jsonb,
    true
  ),
  (
    'bot_legal_question_deflect',
    'Bot Deflects Legal Question',
    'That''s a great question for {attorney_name} — they''ll review it at your consultation. I''ve noted it down so it''ll be in front of them. In the meantime, can I help with anything administrative — documents, scheduling, or status updates?',
    '["attorney_name"]'::jsonb,
    true
  ),
  (
    'mid_case_attorney_followup',
    'Mid-Case Attorney Follow-Up Needed',
    'Hi {client_name}, {attorney_name} needs more information to keep your case moving. Specifically: {question}. As a legal administrator I can collect your answer and pass it back to {attorney_name}, who will then {followup_action}.',
    '["client_name", "attorney_name", "question", "followup_action"]'::jsonb,
    true
  )
ON CONFLICT DO NOTHING;
