/*
  # V1 Launch — MLG + Neeley Feature Flag Configuration

  iSoftpull DROPPED. Plaid (bank + income) ON. Service delivery / info
  gathering / BCI export ON. Doc generation, fee-agreement signing,
  deadline calendaring, signing scheduling OFF (Best Case handles after
  the BCI import).

  Two firms in the V1 pilot:
    - MLG    (00000000-0000-0000-0000-000000000001)
    - Neeley (00000000-0000-0000-0000-000000000002)

  bank_link_plaid is the existing flag for bank statements; payroll_link_plaid
  was added in 20260528150000_plaid_integration.sql for Plaid Income.

  History rows are written for every firm_features row touched so the
  audit trail captures the V1 launch explicitly.

  Depends on:
    - firm_features              (from 20260528020000_feature_flags.sql)
    - feature_flag_definitions   (from 20260528020000_feature_flags.sql; payroll_link_plaid added 20260528150000)
    - firm_features_history      (from 20260528020000_feature_flags.sql)
*/

-- ─── V1-deferred features: OFF for both pilot firms ────────────────────────

UPDATE firm_features
SET enabled = false,
    disabled_at = now(),
    notes = 'V1 launch — deferred to V2',
    updated_at = now()
WHERE firm_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
)
AND feature_key IN (
  'intake_bot',
  'intake_short_verification',
  'credit_report_isoftpull',       -- DROPPED entirely
  'liaison_agent',
  'ai_petition_drafting',
  'attorney_metrics_dashboard',
  'firm_metrics_dashboard',
  'cloud_sync_google_drive',
  'cloud_sync_dropbox',
  'white_label_branding',
  'chapter_11_subv',
  'multi_state_practice',
  'trustee_auto_submission',
  'calendar_auto_assignment',
  'boldsign_esign',                -- fee agreement signed outside the platform
  'calendar_sync'                  -- BAN-33 deferred to Phase 5; Best Case calendar handles deadlines in V1
);

-- ─── V1 service-delivery features: ON for both pilot firms ─────────────────

UPDATE firm_features
SET enabled = true,
    enabled_at = now(),
    notes = 'V1 launch — info gathering / doc collection / BCI ON',
    updated_at = now()
WHERE firm_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
)
AND feature_key IN (
  'client_portal',
  'questionnaire_full',
  'credit_report_manual_upload',
  'bank_statement_manual_upload',
  'bank_link_plaid',
  'trustee_doc_portal',
  'pacer_email_ingestion',
  'best_case_export'
);

-- payroll_link_plaid was just added by 20260528150000 — the seed in that
-- migration only creates the catalogue row. Enable it for both pilot firms.
-- Use INSERT...ON CONFLICT so this works whether or not 20260528100000's
-- Neeley enable-all run already created the firm_features row.
INSERT INTO firm_features (firm_id, feature_key, enabled, enabled_at, notes, updated_at)
SELECT
  firm_id,
  'payroll_link_plaid'::text,
  true,
  now(),
  'V1 launch — Plaid Income ON',
  now()
FROM (VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid),
  ('00000000-0000-0000-0000-000000000002'::uuid)
) AS f(firm_id)
ON CONFLICT (firm_id, feature_key)
DO UPDATE SET
  enabled    = true,
  enabled_at = now(),
  notes      = 'V1 launch — Plaid Income ON',
  updated_at = now();

-- ─── Audit log entries for every row we touched ─────────────────────────────
-- One row per firm_features row that exists for these firms — captures the
-- V1-launch snapshot in firm_features_history with the current enabled state.

INSERT INTO firm_features_history (firm_id, feature_key, action, notes, changed_at)
SELECT
  firm_id,
  feature_key,
  CASE WHEN enabled THEN 'enabled' ELSE 'disabled' END,
  'V1 launch config',
  now()
FROM firm_features
WHERE firm_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);
