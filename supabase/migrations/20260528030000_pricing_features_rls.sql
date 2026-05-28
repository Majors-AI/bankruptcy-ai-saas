/*
  # BAN-41 Phase 2c — RLS policies for pricing + feature tables

  Two-tier access model:
    - super_admin_bankruptcy_ai: full read/write on every table (platform op).
    - firm staff (anything else with a firm_id): read-only access scoped to
      their own firm_id via user_profiles lookup.

  feature_flag_definitions is platform-wide read by everyone (the catalogue
  itself isn't firm-specific data) but only super-admins can mutate it.

  Notes:
    - Each table already has RLS enabled inline in 20260527020000 for firms
      and user_profiles; this migration enables it on the BAN-41 tables and
      attaches policies. RLS-enable is idempotent in Postgres.
    - Policies reference user_profiles.user_id = auth.uid(). Until Supabase
      auth is wired into the app, anon requests evaluate to no policy match
      and are denied — which is the intent (Phase 1's permissive policies on
      firms / user_profiles were bootstrap-only and are NOT extended here).
*/

-- ─── tier_templates: super-admin only ─────────────────────────────────────────

ALTER TABLE tier_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tier_templates_super_admin_all ON tier_templates
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

-- ─── firm_pricing: super-admin all; firm read-own ─────────────────────────────

ALTER TABLE firm_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_pricing_super_admin_all ON firm_pricing
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

CREATE POLICY firm_pricing_firm_read ON firm_pricing
  FOR SELECT
  USING (
    firm_id = (
      SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()
    )
  );

-- ─── firm_pricing_history: super-admin all; firm read-own ─────────────────────

ALTER TABLE firm_pricing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_pricing_history_super_admin_all ON firm_pricing_history
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

CREATE POLICY firm_pricing_history_firm_read ON firm_pricing_history
  FOR SELECT
  USING (
    firm_id = (
      SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()
    )
  );

-- ─── firm_discounts: super-admin only ─────────────────────────────────────────
-- Firms can see their own pricing (via firm_pricing read), but discounts are
-- platform-internal pricing levers we do NOT surface to firms by default.

ALTER TABLE firm_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_discounts_super_admin_all ON firm_discounts
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

-- ─── feature_flag_definitions: catalogue is platform-public read ──────────────

ALTER TABLE feature_flag_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY feature_flag_definitions_all_read ON feature_flag_definitions
  FOR SELECT USING (true);

CREATE POLICY feature_flag_definitions_super_admin_write ON feature_flag_definitions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'super_admin_bankruptcy_ai'
    )
  );

CREATE POLICY feature_flag_definitions_super_admin_update ON feature_flag_definitions
  FOR UPDATE
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

-- ─── firm_features: super-admin all; firm read-own ────────────────────────────

ALTER TABLE firm_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_features_super_admin_all ON firm_features
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

CREATE POLICY firm_features_firm_read ON firm_features
  FOR SELECT
  USING (
    firm_id = (
      SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()
    )
  );

-- ─── firm_features_history: super-admin all; firm read-own ────────────────────

ALTER TABLE firm_features_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_features_history_super_admin_all ON firm_features_history
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

CREATE POLICY firm_features_history_firm_read ON firm_features_history
  FOR SELECT
  USING (
    firm_id = (
      SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()
    )
  );
