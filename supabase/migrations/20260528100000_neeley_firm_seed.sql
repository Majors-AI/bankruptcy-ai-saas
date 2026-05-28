/*
  # V1 Launch — Seed Neeley Law Firm as second pilot firm.

  Mirrors the MLG seed pattern from Phase 1:
    - firms row (status=active)
    - firm_pricing row (comped, vendor pass-through at-cost, autopay off)
    - firm_features rows for ALL 24 feature definitions, enabled=true

  Section 6 (V1 feature flag config) follows up and disables the V1-deferred
  features for BOTH firms — Neeley starts with everything ON here so the
  audit trail shows the explicit V1 narrowing happened in the same release.

  Depends on:
    - firms                     (from 20260527020000_firms_and_user_profiles.sql)
    - firm_pricing              (from 20260528010000_tier_templates_and_firm_pricing.sql)
    - firm_features             (from 20260528020000_feature_flags.sql)
    - feature_flag_definitions  (from 20260528020000_feature_flags.sql)
*/

INSERT INTO firms (id, name, slug, status) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Neeley Law Firm', 'neeley', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO firm_pricing (
  firm_id,
  subscription_amount_cents,
  per_case_fee_cents,
  included_cases_per_month,
  vendor_pass_through_enabled,
  vendor_markup_pct,
  autopay_enabled,
  notes
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  0,
  0,
  NULL,
  true,
  0,
  false,
  'Neeley pilot — comped during V1, vendor pass-through at-cost'
)
ON CONFLICT (firm_id) DO NOTHING;

INSERT INTO firm_features (firm_id, feature_key, enabled, enabled_at, notes)
SELECT
  '00000000-0000-0000-0000-000000000002'::uuid,
  feature_key,
  true,
  now(),
  'Neeley pilot — all features enabled at seed'
FROM feature_flag_definitions
ON CONFLICT (firm_id, feature_key) DO NOTHING;
