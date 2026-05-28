/*
  # BAN-41 Phase 2a — Tier Templates + Firm Pricing

  Pricing model: fully operator-configured per firm. Tier templates are
  starting points only; actual pricing lives on firm_pricing per firm and
  can be edited independently of tier defaults.

  Default amounts on tier_templates are intentionally null — forces operator
  to consciously set each value when signing up a firm rather than relying
  on hardcoded numbers.

  Depends on:
    - firms              (from 20260527020000_firms_and_user_profiles.sql)
    - auth.users         (Supabase auth)

  History tables (firm_pricing_history, firm_features_history in next
  migration) record every change for audit purposes.
*/

-- ─── Tier Templates ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tier_templates (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key                  text NOT NULL UNIQUE,
  name                          text NOT NULL,
  default_monthly_amount_cents  integer,
  default_per_case_fee_cents    integer,
  default_included_cases        integer,
  default_vendor_markup_pct     integer,
  description                   text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO tier_templates (template_key, name, default_monthly_amount_cents, default_per_case_fee_cents, default_included_cases, default_vendor_markup_pct, description) VALUES
  ('starter',    'Starter',    NULL, NULL, 10,   NULL, 'Lower volume firms. Operator sets actual amounts per firm.'),
  ('pro',        'Pro',        NULL, NULL, 30,   15,   'Mid-tier with vendor pass-through markup. Operator sets actual amounts per firm.'),
  ('enterprise', 'Enterprise', NULL, NULL, 100,  0,    'High volume firms. Vendor pass-through at cost. Operator sets actual amounts per firm.'),
  ('custom',     'Custom',     NULL, NULL, NULL, NULL, 'Fully bespoke. All values operator-defined at signup.')
ON CONFLICT (template_key) DO NOTHING;

-- ─── Per-Firm Pricing ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS firm_pricing (
  firm_id                       uuid PRIMARY KEY REFERENCES firms(id) ON DELETE CASCADE,
  subscription_amount_cents     integer,
  per_case_fee_cents            integer,
  included_cases_per_month      integer,
  vendor_pass_through_enabled   boolean NOT NULL DEFAULT false,
  vendor_markup_pct             integer NOT NULL DEFAULT 0,
  autopay_enabled               boolean NOT NULL DEFAULT false,
  billing_email                 text,
  stripe_customer_id            text,
  default_payment_method_id     text,
  current_period_start          date,
  current_period_end            date,
  notes                         text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  updated_by                    uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_firm_pricing_stripe_customer
  ON firm_pricing(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ─── Pricing audit trail ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS firm_pricing_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         uuid REFERENCES firms(id) ON DELETE CASCADE,
  field_changed   text NOT NULL,
  old_value       text,
  new_value       text,
  changed_by      uuid REFERENCES auth.users(id),
  reason          text,
  changed_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_firm_pricing_history_firm
  ON firm_pricing_history(firm_id, changed_at DESC);

-- ─── Per-firm discounts (stack with base pricing) ─────────────────────────────

CREATE TABLE IF NOT EXISTS firm_discounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         uuid REFERENCES firms(id) ON DELETE CASCADE,
  discount_type   text NOT NULL CHECK (discount_type IN ('subscription_pct', 'per_case_pct', 'flat_amount_cents', 'free_months')),
  discount_value  integer NOT NULL,
  applied_at      timestamptz NOT NULL DEFAULT now(),
  applied_by      uuid REFERENCES auth.users(id),
  expires_at      timestamptz,
  reason          text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_firm_discounts_active
  ON firm_discounts(firm_id, is_active, expires_at);

-- ─── Seed: MLG pilot firm — comped during build ───────────────────────────────
-- subscription $0 / per-case $0 / unlimited cases / vendor pass-through at-cost,
-- autopay off (manual billing during pilot).

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
  '00000000-0000-0000-0000-000000000001',
  0,
  0,
  NULL,
  true,
  0,
  false,
  'MLG pilot — comped during build, vendor pass-through at-cost, manual billing'
)
ON CONFLICT (firm_id) DO NOTHING;
