/*
  # Create intake_submissions table

  Stores initial client intake form submissions before a full case is opened.

  1. New Tables
    - `intake_submissions`
      - `id` (uuid, primary key)
      - Filing type and chapter
      - Debtor personal info (name, dob, ssn last 4, contact, address)
      - Optional spouse info
      - Household info (marital status, dependents)
      - Income overview (employment status, employer, gross/net monthly)
      - Asset overview (real estate, vehicles, bank/retirement balances, stocks, crypto)
      - Debt overview (by category, primary reason)
      - Financial history flags (prior bankruptcy, lawsuits, garnishment, transfers, business)
      - `status` (pending_review, contacted, retained, declined)
      - `submitted_at`, `created_at`

  2. Security
    - Enable RLS
    - Allow anonymous INSERT (public intake form — no auth required)
    - Staff reads handled server-side via service role key
*/

CREATE TABLE IF NOT EXISTS intake_submissions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Filing details
  filing_type             text NOT NULL,
  chapter_type            text NOT NULL,

  -- Debtor identity
  first_name              text NOT NULL,
  middle_name             text,
  last_name               text NOT NULL,
  suffix                  text,
  dob                     date NOT NULL,
  ssn_last4               text NOT NULL,
  email                   text NOT NULL,
  phone                   text,

  -- Residence
  street_address          text NOT NULL,
  city                    text NOT NULL,
  state                   text NOT NULL,
  zip_code                text NOT NULL,
  county                  text,
  address_years           text,
  prior_address           text,

  -- Spouse (optional)
  spouse_first_name       text,
  spouse_last_name        text,
  spouse_dob              date,
  spouse_email            text,
  spouse_phone            text,

  -- Household
  marital_status          text NOT NULL,
  num_dependents          integer NOT NULL DEFAULT 0,
  dependent_ages          text,

  -- Income
  debtor_work_status      text NOT NULL,
  debtor_employer         text,
  debtor_gross_monthly    numeric(12,2),
  debtor_net_monthly      numeric(12,2),
  debtor_pay_frequency    text,
  debtor_other_income     numeric(12,2),
  debtor_other_income_desc text,
  spouse_work_status      text,
  spouse_employer         text,
  spouse_gross_monthly    numeric(12,2),

  -- Assets
  owns_real_estate        boolean NOT NULL DEFAULT false,
  real_prop_address       text,
  real_prop_value         numeric(12,2),
  mortgage_balance        numeric(12,2),
  mortgage_lender         text,
  num_vehicles            integer NOT NULL DEFAULT 0,
  vehicle_descriptions    text,
  bank_accounts_balance   numeric(12,2),
  retirement_balance      numeric(12,2),
  has_stocks              boolean NOT NULL DEFAULT false,
  has_crypto              boolean NOT NULL DEFAULT false,
  other_assets            text,

  -- Debts
  secured_debt            numeric(12,2) NOT NULL DEFAULT 0,
  credit_card_debt        numeric(12,2) NOT NULL DEFAULT 0,
  medical_debt            numeric(12,2) NOT NULL DEFAULT 0,
  student_loan_debt       numeric(12,2) NOT NULL DEFAULT 0,
  tax_debt                numeric(12,2) NOT NULL DEFAULT 0,
  personal_loan_debt      numeric(12,2) NOT NULL DEFAULT 0,
  other_unsecured         numeric(12,2) NOT NULL DEFAULT 0,
  primary_reason          text NOT NULL,

  -- Financial history flags
  prior_bankruptcy        boolean NOT NULL DEFAULT false,
  pending_lawsuits        boolean NOT NULL DEFAULT false,
  garnishment             boolean NOT NULL DEFAULT false,
  transferred_property    boolean NOT NULL DEFAULT false,
  owned_business          boolean NOT NULL DEFAULT false,

  -- Workflow
  status                  text NOT NULL DEFAULT 'pending_review',
  staff_notes             text,
  submitted_at            timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE intake_submissions ENABLE ROW LEVEL SECURITY;

-- Allow public/anonymous users to INSERT (this is a public intake form)
CREATE POLICY "Anyone can submit an intake form"
  ON intake_submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Staff access is handled via service role key — no authenticated user policy needed here
-- Add index for staff review queue ordering
CREATE INDEX IF NOT EXISTS idx_intake_submissions_submitted_at
  ON intake_submissions (submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_intake_submissions_status
  ON intake_submissions (status);
