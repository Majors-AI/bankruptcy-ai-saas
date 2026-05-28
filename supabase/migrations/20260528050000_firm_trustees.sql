/*
  # BAN-29 — Firm-configurable trustee management

  Each firm adds and configures their own trustees. trustee_api_configs
  (platform-seeded — see 20260505163143_create_trustee_submission_and_api_config.sql)
  stays in place for the small set of trustees that have confirmed API endpoints
  and submission contracts. firm_trustees is the source of truth for "which
  trustees does THIS firm work with, and how do they submit?"

  Until trustee APIs are wired for a given trustee, submission_method defaults
  to 'portal_manual' so the system organizes docs into phase 07-trustee
  (see 20260528040000_client_file_phases.sql) and a firm staffer submits.

  Depends on:
    - firms                (from 20260527020000_firms_and_user_profiles.sql)
    - clients              (from 20260527010000_create_clients_table.sql)
    - case_acceptances     (from 20260527010100_create_case_acceptances_table.sql)
    - trustee_api_configs  (from 20260505163143_create_trustee_submission_and_api_config.sql)
    - user_profiles        (from 20260527020000_firms_and_user_profiles.sql)
    - auth.users           (Supabase auth)
*/

-- ─── Firm-side trustee directory ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS firm_trustees (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id                  uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  trustee_name             text NOT NULL,
  district                 text,
  division                 text,
  submission_method        text NOT NULL DEFAULT 'portal_manual'
    CHECK (submission_method IN ('email', 'portal_manual', 'portal_api', 'mail')),
  submission_email         text,
  submission_portal_url    text,
  api_config_id            uuid REFERENCES trustee_api_configs(id),
  standard_document_list   jsonb,
  file_naming_convention   text,
  notes                    text,
  is_active                boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id, trustee_name, district)
);

CREATE INDEX IF NOT EXISTS idx_firm_trustees_firm
  ON firm_trustees(firm_id, is_active);

-- ─── Manual submission tracking ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trustee_submission_log (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id                  uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  firm_trustee_id          uuid REFERENCES firm_trustees(id),
  client_id                uuid REFERENCES clients(id) ON DELETE SET NULL,
  case_acceptance_id       uuid REFERENCES case_acceptances(id) ON DELETE SET NULL,
  submission_method        text NOT NULL,
  submitted_at             timestamptz NOT NULL DEFAULT now(),
  submitted_by             uuid REFERENCES auth.users(id),
  confirmation_receipt_url text,
  documents_included       uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  notes                    text,
  status                   text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'acknowledged', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_trustee_submission_log_firm
  ON trustee_submission_log(firm_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_trustee_submission_log_client
  ON trustee_submission_log(client_id) WHERE client_id IS NOT NULL;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE firm_trustees ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_trustees_super_admin_all ON firm_trustees
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'super_admin_bankruptcy_ai'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'super_admin_bankruptcy_ai'
    )
  );

-- Firm staff (any user_profiles row with a firm_id) can read AND write their
-- own firm's trustees — firm super admin / attorney / legal_admin all need to
-- add and edit trustees during onboarding and over time.
CREATE POLICY firm_trustees_firm_all ON firm_trustees
  FOR ALL
  USING (
    firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid())
  )
  WITH CHECK (
    firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid())
  );

ALTER TABLE trustee_submission_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY trustee_submission_log_super_admin_all ON trustee_submission_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'super_admin_bankruptcy_ai'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'super_admin_bankruptcy_ai'
    )
  );

CREATE POLICY trustee_submission_log_firm_all ON trustee_submission_log
  FOR ALL
  USING (
    firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid())
  )
  WITH CHECK (
    firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid())
  );

-- NO seed rows. Each firm — MLG included — adds their own trustees through
-- the in-app management UI.
