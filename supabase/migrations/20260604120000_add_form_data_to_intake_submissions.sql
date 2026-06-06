/*
  # Add form_data JSONB to intake_submissions

  Source's new attorney intake review portal — and target's existing
  questionnaire prefill query at
  bankruptcy-information-and-document-questionnaire(1).jsx:2642
  (`supabase.from('intake_submissions').select('form_data')...`) — both
  read `intake_submissions.form_data`, a camelCase JSONB snapshot of the
  intake state. Today the column does not exist; the questionnaire query
  has been silently failing.

  This migration:
    1. Adds form_data JSONB column (NOT NULL DEFAULT '{}').
    2. Adds a GIN index for ad-hoc queries against the blob.
    3. Backfills existing rows by transforming flat snake_case columns
       into the camelCase shape the portal + questionnaire expect.

  Existing flat columns are NOT dropped — kept for compatibility. The
  BankruptcyIntake insert is updated separately to populate both. BAN-40
  phase 2 will collapse to form_data only.

  WA homestead inputs (homeAcquiredDate, isOccupiedPrimary,
  realPropMonthlyPayment) are intentionally NOT backfilled — they have
  no flat-column source. The portal renders "incomplete — data needed"
  when either is missing rather than computing against absent inputs.
*/

ALTER TABLE intake_submissions
  ADD COLUMN IF NOT EXISTS form_data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_intake_submissions_form_data_gin
  ON intake_submissions USING gin (form_data);

-- ─── Backfill ────────────────────────────────────────────────────────────────
-- Idempotent: only touches rows whose form_data is empty.
--
-- Split into multiple jsonb_build_object() calls because Postgres caps any
-- single function call at 100 arguments (error 54023). Each chunk stays well
-- under 100 (each k/v pair = 2 args), concatenated with `||` then stripped of
-- null entries at the end.

UPDATE intake_submissions
SET form_data = jsonb_strip_nulls(
  -- chunk 1: identity, filing, residence, household
  jsonb_build_object(
    'firstName',          first_name,
    'lastName',           last_name,
    'email',              email,
    'phone',              phone,
    'spouseFirstName',    spouse_first_name,
    'spouseLastName',     spouse_last_name,
    'filingType',         filing_type,
    'maritalStatus',      marital_status,
    'chapterType',        chapter_type,
    'address',            street_address,
    'city',               city,
    'state',              state,
    'zip',                zip_code,
    'county',             county,
    'addressYears',       address_years,
    'priorDomicileState', prior_state,
    'numDependents',      COALESCE(num_dependents::text, '0'),
    'dependents',         dependents_json
  )
  ||
  -- chunk 2: income + expenses
  jsonb_build_object(
    'debtorWorkStatus',   debtor_work_status,
    'spouseWorkStatus',   spouse_work_status,
    'debtorEmployer',     debtor_employer,
    'spouseEmployer',     spouse_employer,
    'debtorMonthlyGross', debtor_gross_monthly::text,
    'spouseMonthlyGross', spouse_gross_monthly::text,
    'debtorSources',      income_sources_json,
    'expRentMortgage',    exp_rent_mortgage::text,
    'expUtilities',       exp_utilities::text,
    'expFood',            exp_food::text,
    'expTransportation',  exp_transportation::text,
    'expMedical',         exp_healthcare::text,
    'expInsurance',       exp_insurance::text,
    'expChildcare',       exp_childcare::text,
    'expOther',           exp_other::text
  )
  ||
  -- chunk 3: real property + vehicles + personal property
  jsonb_build_object(
    'ownsRealEstate',         CASE WHEN owns_real_estate THEN 'yes' ELSE 'no' END,
    'realPropAddress',        real_prop_address,
    'realPropValue',          real_prop_value::text,
    'mortgageBalance',        mortgage_balance::text,
    'mortgageLender',         mortgage_lender,
    'properties',             real_properties_json,
    'noVehicles',             no_vehicles,
    'numVehicles',            num_vehicles,
    'vehicles',               vehicles_json,
    'bankBalance',            bank_balance::text,
    'retirementBalance',      retirement_balance::text,
    'hasStocks',              CASE WHEN has_stocks THEN 'yes' ELSE 'no' END,
    'stocksValue',            stocks_value::text,
    'hasCrypto',              CASE WHEN has_crypto THEN 'yes' ELSE 'no' END,
    'cryptoValue',            crypto_value::text
  )
  ||
  -- chunk 4: more personal property + household goods
  jsonb_build_object(
    'hasLifeInsurance',       CASE WHEN has_life_insurance THEN 'yes' ELSE 'no' END,
    'lifeInsuranceCashValue', life_insurance_cash_value::text,
    'hasFirearms',            CASE WHEN has_firearms THEN 'yes' ELSE 'no' END,
    'firearmValue',           firearm_value::text,
    'hasCollectibles',        CASE WHEN has_collectibles THEN 'yes' ELSE 'no' END,
    'collectiblesValue',      collectibles_value::text,
    'householdGoodsValue',    household_goods_value::text,
    'otherPersonalPropDesc',  other_property_desc
  )
  ||
  -- chunk 5: debts
  jsonb_build_object(
    'securedDebt',        secured_debt::text,
    'creditCardDebt',     credit_card_debt::text,
    'medicalDebt',        medical_debt::text,
    'studentLoanDebt',    student_loan_debt::text,
    'taxDebt',            tax_debt::text,
    'personalLoanDebt',   personal_loan_debt::text,
    'otherUnsecured',     other_unsecured::text
  )
  ||
  -- chunk 6: financial history flags + details
  jsonb_build_object(
    'priorBankruptcy',      CASE WHEN prior_bankruptcy THEN 'yes' ELSE 'no' END,
    'priorBankruptcies',    prior_bankruptcies_json,
    'pendingLawsuits',      CASE WHEN pending_lawsuits THEN 'yes' ELSE 'no' END,
    'lawsuitDetails',       lawsuit_details,
    'garnishment',          CASE WHEN garnishment THEN 'yes' ELSE 'no' END,
    'garnishmentDetails',   garnishment_details,
    'transferredProperty',  CASE WHEN transferred_property OR has_transfers THEN 'yes' ELSE 'no' END,
    'transfers',            transfers_json,
    'preferentialPayments', CASE WHEN has_preferential_payments THEN 'yes' ELSE 'no' END,
    'preferentialEntries',  preferential_payments_json,
    'ownedBusiness',        CASE WHEN owned_business THEN 'yes' ELSE 'no' END,
    'businessDetails',      business_details,
    'expectedRefund',       CASE WHEN expected_refund THEN 'yes' ELSE 'no' END,
    'refundAmount',         refund_amount::text,
    'recentLuxury',         CASE WHEN recent_luxury THEN 'yes' ELSE 'no' END,
    'luxuryDetails',        luxury_details
  )
)
WHERE form_data IS NULL OR form_data = '{}'::jsonb;
