/*
  MAJ-105: V1 scope lockdown — per-nav-feature boolean columns on firm_features

  Adds one boolean column per workflow feature directly to firm_features.
  These sit alongside the existing BAN-41 (feature_key, enabled) EAV rows;
  a single .limit(1) query reads the firm-level booleans from any row.

  Defaults:
    - feature_client_portal, feature_file_cabinet, feature_trustee_portal → true
      (always-on core features; safe default for any new firm)
    - everything else → false

  V1 pilot seed (MLG + Neeley):
    ON:  feature_client_portal, feature_file_cabinet, feature_trustee_portal,
         feature_signing_review (MAJ-104)
    OFF: all other features (V1.5+)
*/

ALTER TABLE firm_features
  ADD COLUMN IF NOT EXISTS feature_intake_portal          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_intake_form            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_attorney_intake_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_legacy_import          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_client_registration    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_attorney_registration  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_client_portal          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS feature_signing_review         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_file_cabinet           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS feature_trustee_portal         boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS feature_paralegal_review       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_attorney_review        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_file_a_case            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_ecf_notices            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_creditor_verification  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_ai_bots                boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_calendar               boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_accounting             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_messages               boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_tasks                  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_productivity           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_comms                  boolean NOT NULL DEFAULT false;

-- ── MLG pilot (00000000-0000-0000-0000-000000000001) — V1 scope ───────────────

UPDATE firm_features SET
  feature_intake_portal          = false,
  feature_intake_form            = false,
  feature_attorney_intake_review = false,
  feature_legacy_import          = false,
  feature_client_registration    = false,
  feature_attorney_registration  = false,
  feature_client_portal          = true,
  feature_signing_review         = true,
  feature_file_cabinet           = true,
  feature_trustee_portal         = true,
  feature_paralegal_review       = false,
  feature_attorney_review        = false,
  feature_file_a_case            = false,
  feature_ecf_notices            = false,
  feature_creditor_verification  = false,
  feature_ai_bots                = false,
  feature_calendar               = false,
  feature_accounting             = false,
  feature_messages               = false,
  feature_tasks                  = false,
  feature_productivity           = false,
  feature_comms                  = false
WHERE firm_id = '00000000-0000-0000-0000-000000000001';

-- ── Neeley pilot (00000000-0000-0000-0000-000000000002) — V1 scope ────────────

UPDATE firm_features SET
  feature_intake_portal          = false,
  feature_intake_form            = false,
  feature_attorney_intake_review = false,
  feature_legacy_import          = false,
  feature_client_registration    = false,
  feature_attorney_registration  = false,
  feature_client_portal          = true,
  feature_signing_review         = true,
  feature_file_cabinet           = true,
  feature_trustee_portal         = true,
  feature_paralegal_review       = false,
  feature_attorney_review        = false,
  feature_file_a_case            = false,
  feature_ecf_notices            = false,
  feature_creditor_verification  = false,
  feature_ai_bots                = false,
  feature_calendar               = false,
  feature_accounting             = false,
  feature_messages               = false,
  feature_tasks                  = false,
  feature_productivity           = false,
  feature_comms                  = false
WHERE firm_id = '00000000-0000-0000-0000-000000000002';
