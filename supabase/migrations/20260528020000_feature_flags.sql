/*
  # BAN-41 Phase 2b — Feature Flag System

  24 platform features catalogued across 11 categories (intake, portal,
  credit, bank, trustee, calendar, ai, documents, cloud, reporting, advanced).
  Each feature is independently togglable per firm by the super-admin. Tier
  templates suggest defaults; tier choice never locks specific features.

  Depends on:
    - firms       (from 20260527020000_firms_and_user_profiles.sql)
    - auth.users  (Supabase auth)
*/

-- ─── Feature catalogue ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feature_flag_definitions (
  feature_key  text PRIMARY KEY,
  name         text NOT NULL,
  description  text,
  category     text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_flag_definitions_category
  ON feature_flag_definitions(category) WHERE is_active = true;

-- Seed the 24 platform features. ON CONFLICT (feature_key) DO NOTHING so this
-- migration is re-runnable without disturbing operator edits made later.
INSERT INTO feature_flag_definitions (feature_key, name, category, description) VALUES
  -- ─── Intake ───
  ('intake_bot',                   'AI Intake Bot',                   'intake',    'Conversational AI bot for prospective client info-gathering and appointment scheduling'),
  ('intake_short_verification',    'Short Verification Intake',       'intake',    'Tier 2 intake — 20-25 questions completed by client before verification call'),
  -- ─── Portal ───
  ('client_portal',                'Client Portal',                   'portal',    'Always-on client dashboard for case progress, payments, messages'),
  ('questionnaire_full',           'Full Questionnaire',              'portal',    '17-section client questionnaire post-acceptance'),
  -- ─── Credit ───
  ('credit_report_isoftpull',      'iSoftpull Soft Credit Pull',      'credit',    'Automated soft credit inquiry via iSoftpull API'),
  ('credit_report_manual_upload',  'Manual Credit Report Upload',     'credit',    'Client uploads credit report PDF; LLM parser categorizes creditors'),
  -- ─── Bank ───
  ('bank_link_plaid',              'Plaid Bank Account Connection',   'bank',      'Connect bank account via Plaid for transaction history + statements'),
  ('bank_statement_manual_upload', 'Manual Bank Statement Upload',    'bank',      'Client uploads bank statements directly via questionnaire'),
  -- ─── Trustee ───
  ('trustee_doc_portal',           'Trustee Document Portal',         'trustee',   'Organize and review trustee submission documents'),
  ('trustee_auto_submission',      'Trustee Auto-Submission',         'trustee',   'Automatically submit documents to trustees with API integration'),
  ('pacer_email_ingestion',        'PACER Email Ingestion',           'trustee',   'Auto-ingest ECF/PACER notices to client files'),
  -- ─── Calendar ───
  ('calendar_sync',                'Calendar Sync',                   'calendar',  'Sync firm calendars with Google Calendar'),
  ('calendar_auto_assignment',     'Calendar Auto-Assignment',        'calendar',  'Auto-assign signing + review appointments based on availability'),
  -- ─── AI ───
  ('liaison_agent',                'Liaison Agent',                   'ai',        'Post-acceptance AI assistant for case-related client questions'),
  ('ai_petition_drafting',         'AI Petition Drafting',            'ai',        'AI-assisted bankruptcy petition draft generation'),
  -- ─── Documents ───
  ('boldsign_esign',               'BoldSign Electronic Signature',   'documents', 'Electronic signature for retainer agreements + petition'),
  ('best_case_export',             'Best Case Import Export',         'documents', 'Export to Best Case bankruptcy filing software format'),
  -- ─── Cloud ───
  ('cloud_sync_google_drive',      'Google Drive Sync',               'cloud',     'One-way sync of client files to firm Google Drive'),
  ('cloud_sync_dropbox',           'Dropbox Sync',                    'cloud',     'One-way sync of client files to firm Dropbox'),
  -- ─── Reporting ───
  ('attorney_metrics_dashboard',   'Per-Attorney Metrics',            'reporting', 'Per-attorney filing rate, discharge rate, time-to-filing'),
  ('firm_metrics_dashboard',       'Firm Metrics Dashboard',          'reporting', 'Firm-wide case metrics, conversion rates, chapter mix'),
  -- ─── Advanced ───
  ('multi_state_practice',         'Multi-State Practice',            'advanced',  'Multiple state exemption profiles + per-state trustee configs'),
  ('chapter_11_subv',              'Chapter 11 Subchapter V',         'advanced',  'Sub V small business reorganization support'),
  ('white_label_branding',         'White Label Branding',            'advanced',  'Custom firm branding overrides default bankruptcy.ai UI')
ON CONFLICT (feature_key) DO NOTHING;

-- ─── Per-firm feature toggles ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS firm_features (
  firm_id      uuid REFERENCES firms(id) ON DELETE CASCADE,
  feature_key  text REFERENCES feature_flag_definitions(feature_key),
  enabled      boolean NOT NULL DEFAULT false,
  enabled_at   timestamptz,
  enabled_by   uuid REFERENCES auth.users(id),
  disabled_at  timestamptz,
  disabled_by  uuid REFERENCES auth.users(id),
  notes        text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (firm_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_firm_features_enabled
  ON firm_features(firm_id) WHERE enabled = true;

-- ─── Audit trail ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS firm_features_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      uuid REFERENCES firms(id) ON DELETE CASCADE,
  feature_key  text,
  action       text CHECK (action IN ('enabled', 'disabled')),
  changed_by   uuid REFERENCES auth.users(id),
  notes        text,
  changed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_firm_features_history_firm
  ON firm_features_history(firm_id, changed_at DESC);

-- ─── Seed: MLG pilot — all 24 features enabled ────────────────────────────────

INSERT INTO firm_features (firm_id, feature_key, enabled, enabled_at, notes)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  feature_key,
  true,
  now(),
  'MLG pilot — all features enabled'
FROM feature_flag_definitions
ON CONFLICT (firm_id, feature_key) DO NOTHING;
