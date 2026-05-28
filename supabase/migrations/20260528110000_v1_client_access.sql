/*
  # V1 — Magic-link client access + manual-onboarding scripts

  Adds an access_token column on clients so the new "+ New Client" modal can
  send a personal portal link to clients onboarded outside the AI intake bot.
  Tokens expire after 90 days; rotation policy is "regenerate from staff side
  on demand" (no auto-refresh).

  Seeds two V1 onboarding scripts into script_library (BAN-36) — one email,
  one SMS. Both use the firm_name placeholder so each firm's outbound message
  is signed correctly.

  Adds a firm_id column on clients so RLS in the V1 feature flag work + new
  per-firm queries (Phase 3 trustee widget, this PR's BCI + ZIP work) can
  scope by firm without re-deriving through case_acceptances.

  Depends on:
    - clients         (from 20260527010000_create_clients_table.sql)
    - firms           (from 20260527020000_firms_and_user_profiles.sql)
    - script_library  (from 20260527030000_script_library.sql)
*/

-- ─── Magic-link + manual-onboarding columns on clients ──────────────────────

ALTER TABLE clients ADD COLUMN IF NOT EXISTS access_token             text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS access_token_expires_at  timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_source        text DEFAULT 'intake';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS firm_id                  uuid REFERENCES firms(id);

CREATE INDEX IF NOT EXISTS idx_clients_access_token
  ON clients(access_token) WHERE access_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_firm
  ON clients(firm_id);

-- ─── V1 onboarding scripts ──────────────────────────────────────────────────
-- Email + SMS variants. Plain text uses E'...' so the \n literals turn into
-- actual newlines in script_text. Newer scripts share script_key conflict
-- handling with the BAN-36 seed pattern.

INSERT INTO script_library (script_key, name, script_text, variables, is_active) VALUES
  (
    'v1_manual_onboarding_welcome',
    'V1 Manual Onboarding Welcome (Email)',
    E'Welcome to {firm_name}, {client_name}.\n\n' ||
    E'Your case has been accepted by {attorney_name} and we are ready to begin gathering the information and documents needed for your bankruptcy filing.\n\n' ||
    E'Next steps:\n\n' ||
    E'1. Access your secure client portal: {portal_url}\n\n' ||
    E'2. Complete the questionnaire — gathers information for your bankruptcy schedules. Save and return as needed.\n\n' ||
    E'3. Connect your bank and payroll, or upload statements manually. The portal will guide you.\n\n' ||
    E'4. Upload any other required documents shown in your portal checklist.\n\n' ||
    E'Once your information is complete, your attorney will prepare your filing documents and contact you to schedule a signing appointment.\n\n' ||
    E'Your attorney is {attorney_name}. For legal questions, message us through the portal.\n\n' ||
    E'This is an electronic record per the E-SIGN Act.\n\n' ||
    E'{firm_name}',
    '["firm_name", "client_name", "attorney_name", "portal_url"]'::jsonb,
    true
  ),
  (
    'v1_manual_onboarding_welcome_sms',
    'V1 Manual Onboarding Welcome (SMS)',
    '{firm_name}: Your case is accepted. Start your bankruptcy file: {portal_url} - Reply STOP to opt out.',
    '["firm_name", "portal_url"]'::jsonb,
    true
  )
ON CONFLICT (script_key) DO NOTHING;
