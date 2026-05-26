
/*
  # Attorney Intake Review System + Eric Cartman Demo Submission

  ## Overview
  1. Creates `attorney_intake_reviews` table — stores eligibility analysis, means test snapshot,
     income-to-qualify projections, preferential payment analysis, and attorney's final decision.
  2. Creates `attorney_intake_issues` table — per-issue flagging with attorney notes and
     client acknowledgment tracking.
  3. Seeds Eric Cartman (South Park, CO) intake lead + submission, marked sent_for_attorney_review.

  ## Key Notes
  - Eric Cartman: individual, 3 dependents, $6,400/mo gross employment income
  - Colorado 4-person annual median is ~$93,864 (~$7,822/mo) — Eric is below median (~$76,800/yr)
    BUT only slightly; means test analysis needed because of preferential payment to insider aunt
  - Preferential payment: $1,800 to Aunt Charlotte (insider) ~8 months ago — within 12-mo insider lookback
  - Credit card debt $58,000 + medical $12,000 + personal loan $8,500 = $78,500 unsecured
  - Vehicle: 2020 Toyota Tundra worth $28,000, loan $19,000 — $9,000 equity (CO exemption $7,500)
  - $1,500 non-exempt equity in vehicle — potential asset issue
*/

-- ─── attorney_intake_reviews ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attorney_intake_reviews (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                   uuid REFERENCES intake_leads(id) ON DELETE SET NULL,
  submission_id             uuid REFERENCES intake_submissions(id) ON DELETE SET NULL,

  attorney_name             text NOT NULL DEFAULT 'Jennifer Smith, Esq.',
  review_status             text NOT NULL DEFAULT 'in_progress',

  ch7_eligible              boolean,
  ch13_eligible             boolean,
  eligibility_notes         text,

  household_size            integer,
  state                     text,
  current_monthly_income    numeric(12,2),
  six_month_gross_total     numeric(12,2),
  state_median_income       numeric(12,2),
  median_income_label       text,
  above_median              boolean,
  disposable_income         numeric(12,2),
  means_test_result         text,

  qualify_target_monthly    numeric(12,2),
  qualify_target_3mo        numeric(12,2),
  qualify_target_6mo        numeric(12,2),
  qualify_analysis_notes    text,

  pref_pay_flagged          boolean DEFAULT false,
  pref_pay_total            numeric(12,2),
  pref_pay_insider_total    numeric(12,2),
  pref_pay_non_insider_total numeric(12,2),
  pref_pay_notes            text,

  decision                  text DEFAULT 'pending',
  case_type                 text,
  chapter                   integer,
  attorney_fee              numeric(10,2),
  court_filing_fee          numeric(10,2),
  total_fee                 numeric(10,2),
  down_payment              numeric(10,2),
  plan_months               integer,
  ch13_upfront_amount       numeric(10,2),
  ch13_plan_portion         numeric(10,2),
  limited_scope_desc        text,
  decision_notes            text,

  decided_at                timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE attorney_intake_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon select attorney_intake_reviews"
  ON attorney_intake_reviews FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert attorney_intake_reviews"
  ON attorney_intake_reviews FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update attorney_intake_reviews"
  ON attorney_intake_reviews FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_atty_intake_reviews_lead_id ON attorney_intake_reviews(lead_id);
CREATE INDEX IF NOT EXISTS idx_atty_intake_reviews_submission_id ON attorney_intake_reviews(submission_id);

-- ─── attorney_intake_issues ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attorney_intake_issues (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id           uuid NOT NULL REFERENCES attorney_intake_reviews(id) ON DELETE CASCADE,
  category            text NOT NULL DEFAULT 'other',
  severity            text NOT NULL DEFAULT 'warning',
  title               text NOT NULL DEFAULT '',
  description         text NOT NULL DEFAULT '',
  attorney_note       text,
  client_acknowledged boolean NOT NULL DEFAULT false,
  client_initials     text,
  acknowledged_at     timestamptz,
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE attorney_intake_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon select attorney_intake_issues"
  ON attorney_intake_issues FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert attorney_intake_issues"
  ON attorney_intake_issues FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update attorney_intake_issues"
  ON attorney_intake_issues FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_atty_intake_issues_review_id ON attorney_intake_issues(review_id);

-- ─── Seed: Eric Cartman intake lead ───────────────────────────────────────────

INSERT INTO intake_leads (
  id, full_name, email, phone, state, status,
  chapter_interest, debt_estimate, income_estimate,
  intake_completed, sent_for_review, sent_for_review_at,
  pre_screen_notes, source, assigned_name,
  created_at, updated_at
) VALUES (
  'eeca1111-c0c0-4000-b000-000000000001',
  'Eric Cartman', 'ecartman@southpark.co', '(303) 555-0142',
  'CO', 'sent_for_attorney_review',
  7, 78000.00, 6400.00,
  true, true, now(),
  'Client called in overwhelmed with credit card and medical debt. Made a $1,800 payment to aunt (insider) ~8 months ago. Income borderline for CO 4-person household. Needs means test and pref-pay review.',
  'referral', 'Sarah Kim',
  now() - interval '3 days', now()
) ON CONFLICT (id) DO NOTHING;

-- ─── Seed: Eric Cartman intake submission ─────────────────────────────────────

INSERT INTO intake_submissions (
  id, lead_id,
  filing_type, chapter_type,
  first_name, last_name,
  dob, ssn_last4,
  email, phone,
  street_address, city, state, zip_code, county,
  in_state_over_2_years, exemption_state, exemption_state_reason,
  marital_status, num_dependents,
  dependents_json, income_sources_json,
  debtor_work_status, debtor_employer, debtor_gross_monthly, debtor_net_monthly, debtor_pay_frequency,
  exp_rent_mortgage, exp_utilities, exp_food, exp_transportation,
  exp_healthcare, exp_insurance, exp_childcare, exp_other,
  owns_real_estate,
  vehicles_json, no_vehicles,
  bank_balance, retirement_balance,
  has_stocks, has_crypto,
  household_goods_value,
  secured_debt, credit_card_debt, medical_debt, student_loan_debt,
  tax_debt, personal_loan_debt, other_unsecured,
  primary_reason,
  has_prior_bk, pending_lawsuits, garnishment,
  has_transfers, transfers_json,
  has_preferential_payments, preferential_payments_json,
  owned_business, expected_refund, refund_amount,
  recent_luxury, luxury_details,
  status, completed_by_staff,
  submitted_at, created_at
) VALUES (
  'eeca2222-c0c0-4000-b000-000000000002',
  'eeca1111-c0c0-4000-b000-000000000001',
  'individual', 'chapter_7',
  'Eric', 'Cartman',
  '1992-07-12', '4444',
  'ecartman@southpark.co', '(303) 555-0142',
  '321 Park County Rd', 'South Park', 'CO', '80440', 'Park County',
  true, 'CO', 'Client has resided in Colorado for more than 2 years; Colorado exemptions apply.',
  'single', 3,
  '[{"id":"dep1","relationship":"dependent","age":10,"name":"Stan Marsh","disabled":false,"monthlyContribution":0,"contributesToHousehold":false},{"id":"dep2","relationship":"dependent","age":10,"name":"Kyle Broflovski","disabled":false,"monthlyContribution":0,"contributesToHousehold":false},{"id":"dep3","relationship":"dependent","age":10,"name":"Kenny McCormick","disabled":true,"disabledDesc":"Recurring fatality incidents","monthlyContribution":0,"contributesToHousehold":false}]'::jsonb,
  '[{"id":"inc1","person":"debtor","personLabel":"Eric Cartman","sourceType":"employed","employerOrSource":"Cartman Enterprises LLC","payFrequency":"bi-weekly","grossPerPeriod":2954.00,"netPerPeriod":2340.00}]'::jsonb,
  'employed', 'Cartman Enterprises LLC', 6400.00, 5070.00, 'bi-weekly',
  1450.00, 280.00, 650.00, 420.00,
  180.00, 220.00, 0.00, 310.00,
  false,
  '[{"id":"veh1","year":2020,"make":"Toyota","model":"Tundra","value":28000,"hasLoan":true,"loanBalance":19000}]'::jsonb,
  false,
  2100.00, 0.00,
  false, false,
  4500.00,
  19000.00, 58000.00, 12000.00, 0.00,
  0.00, 8500.00, 0.00,
  'Overwhelming credit card and medical debt; minimum payments no longer sustainable',
  false, false, false,
  false, '[]'::jsonb,
  true,
  '[{"id":"pp1","creditor":"Aunt Charlotte Cartman","amount":1800.00,"date":"2025-09-15","relationship":"aunt (insider)"}]'::jsonb,
  false, false, null,
  false, null,
  'pending_review', true,
  now() - interval '2 days', now() - interval '2 days'
) ON CONFLICT (id) DO NOTHING;

-- Link submission_id back to lead
UPDATE intake_leads
SET submission_id = 'eeca2222-c0c0-4000-b000-000000000002'
WHERE id = 'eeca1111-c0c0-4000-b000-000000000001'
  AND submission_id IS NULL;
