/*
  Seed Mickey Rourke — AZ Chapter 7 lead, mid-intake (client-prefilled).

  How to run: paste into Supabase Dashboard → SQL Editor (runs as the
  postgres user, bypassing RLS). The companion .mjs script fails against
  the live DB's tightened anon policy on intake_submissions — this SQL
  is the supported path until either a service-role key is available
  locally or the policy is loosened.

  Lifecycle position seeded: contact-request lead came in → client filled
  the questionnaire on their own via the client portal → submission is
  sitting in the intake-staff confirmation queue. Intake has NOT yet
  confirmed and the case has NOT yet been sent to attorney for review.

  State at end of seed:
    intake_leads:
      status              = 'intake_in_progress'   (mid-workflow)
      client_prefilled    = true                   (client self-served)
      intake_completed    = false                  (intake hasn't confirmed)
      sent_for_review     = false                  (not sent to attorney)
      submission_id       = <new submission.id>
    intake_submissions:
      status              = 'pending_review'
      review_status       = 'submitted'            (in intake queue)
      completed_by_staff  = false                  (client filled it)
      lead_id             = <new lead.id>

  Stress-test hooks (same as the .mjs):
    - Above AZ 2-person median (~$7,036/mo) → debtor gross $11,500/mo
      (annual $138k well over the median — without the § 707(b) bypass
      below, Ch.7 would fail the means test)
    - § 707(b)(1) PRIMARILY BUSINESS DEBT bypass — EXERCISES THE ATTORNEY
      OVERRIDE WORKFLOW. The SBA loan sits in form_data.personalLoanDebt
      (one of the six classifiable buckets calcDebtComposition reads); its
      default classification is CONSUMER per CLASSIFIABLE_DEBT_BUCKETS in
      src/AttorneyIntakeDashboard.tsx. On initial load, the case looks
      ineligible:
        Business (no overrides):                              $0
        Consumer  (mortgage $300k + CC $92k + SBA $750k):     $1,142,000
        Business share: 0% → bypass does NOT apply → Ch.7 fails means test
      The attorney opens the Issues tab → Debt Classification card → flips
      personalLoanDebt to "business". After that single click:
        Business  (personalLoanDebt classified business):     $750,000
        Consumer  (mortgage $300k + CC $92k):                 $392,000
        Total:                                                $1,142,000
        Business share: 65.7% (> 50% → means test does NOT apply)
      So income being over-median is irrelevant once the SBA is correctly
      classified. The attorney's classification is the ONLY thing saving
      Ch.7 eligibility here.
    - SBA $750k is posted to form_data.personalLoanDebt — the classifiable
      bucket calcDebtComposition.awaiting surfaces to the attorney. The
      explicit business-debt fields (supplyVendorDebt, businessCreditCardDebt,
      businessMortgageDebt, businessEquipmentDebt, otherBusinessDebt) are
      all zero; the questionnaire today has no separate input for SBA
      personal-guarantee loans, so they land in personalLoanDebt by
      convention until the schema captures the distinction explicitly.
    - AZ homestead (A.R.S. § 33-1101) right at $400,600 cap
    - AZ annuity (A.R.S. § 20-1131(D)) borderline: 2y continuous + spouse
    - Crypto $35k as headline non-exempt asset
    - Schedule J net positive (~$2,400/mo surplus)
    - Married non-joint (individual filing)

  Idempotent: deletes prior Mickey rows (submissions then leads) before
  inserting.
*/

DO $$
DECLARE
  v_lead_id        uuid;
  v_submission_id  uuid;
BEGIN
  ----------------------------------------------------------------------------
  -- 1) Idempotency: clear any prior Mickey rows (submissions first; lead_id
  --    FK on intake_submissions points at intake_leads).
  ----------------------------------------------------------------------------
  DELETE FROM intake_submissions WHERE email = 'mickey.rourke@example.com';
  DELETE FROM intake_leads        WHERE email = 'mickey.rourke@example.com';

  ----------------------------------------------------------------------------
  -- 2) Insert the lead (contact request came in via inbound web form).
  --    intake_completed=false because intake staff hasn't yet confirmed the
  --    self-completed questionnaire; sent_for_review=false because it has
  --    not yet been pushed to attorney review.
  ----------------------------------------------------------------------------
  INSERT INTO intake_leads (
    full_name, email, phone, state, status,
    chapter_interest, debt_estimate, income_estimate,
    client_prefilled, intake_completed, sent_for_review, sent_for_review_at,
    preferred_contact, urgency,
    pre_screen_notes, source, assigned_name,
    first_contact_at, created_at, updated_at
  ) VALUES (
    'Mickey Rourke',
    'mickey.rourke@example.com',
    '(602) 555-0188',
    'AZ',
    'intake_in_progress',
    7,
    1142000.00,          -- 300k mortgage + 92k cc + 750k SBA (in otherBusinessDebt)
    11500.00,
    true,                -- client_prefilled — self-served the questionnaire
    false,               -- intake_completed — what intake is being asked to confirm
    false,               -- sent_for_review — not yet sent to attorney
    NULL,                -- sent_for_review_at
    'email',
    'normal',
    'Inbound contact request via firm website. Client self-completed the full ' ||
    'questionnaire through the client portal before any consult. Above-median AZ ' ||
    'household by gross wages. $750k SBA business loan (closed LLC, personal ' ||
    'guarantee) sits in personalLoanDebt — the classifiable bucket the attorney ' ||
    'review surface defaults to CONSUMER. On initial load the case shows Ch.7 ' ||
    'ineligible (over-median + 0% business by default). Attorney needs to open ' ||
    'Issues → Debt Classification → flip personalLoanDebt to "business" to engage ' ||
    'the § 707(b)(1) primarily-business-debt bypass (business share becomes ≈ 66% ' ||
    'after classification). AZ homestead sits exactly at the $400,600 cap; annuity ' ||
    'at the 2-year mark for A.R.S. § 20-1131(D); crypto $35k is the non-exempt ' ||
    'headline. Needs intake review before attorney handoff.',
    'inbound',
    NULL,
    now() - interval '2 days',
    now() - interval '2 days',
    now()
  ) RETURNING id INTO v_lead_id;

  ----------------------------------------------------------------------------
  -- 3) Insert the submission (self-completed questionnaire).
  --    review_status='submitted' puts it in the intake-staff queue.
  --    completed_by_staff=false marks it as client-self-served.
  ----------------------------------------------------------------------------
  INSERT INTO intake_submissions (
    lead_id,
    -- identity
    filing_type, chapter_type,
    first_name, last_name, email, phone,
    spouse_first_name, spouse_last_name, spouse_email, spouse_phone,
    -- residence
    street_address, city, state, zip_code, county, address_years, prior_state,
    in_state_over_2_years,
    -- household
    marital_status, num_dependents,
    -- income
    debtor_work_status, debtor_employer, debtor_gross_monthly, debtor_net_monthly,
    debtor_pay_frequency,
    spouse_work_status, spouse_employer, spouse_gross_monthly,
    -- real property
    owns_real_estate, real_prop_address, real_prop_value, mortgage_balance, mortgage_lender,
    -- vehicles
    num_vehicles, no_vehicles,
    -- personal property
    bank_balance, retirement_balance,
    has_stocks, stocks_value,
    has_crypto, crypto_value,
    has_life_insurance, life_insurance_cash_value,
    has_firearms, firearm_value,
    has_collectibles, collectibles_value,
    household_goods_value, other_property_desc,
    -- debts
    secured_debt, credit_card_debt, medical_debt, student_loan_debt,
    tax_debt, personal_loan_debt, other_unsecured,
    -- financial history flags
    prior_bankruptcy, has_prior_bk, pending_lawsuits, garnishment,
    transferred_property, has_transfers,
    has_preferential_payments, owned_business, expected_refund, recent_luxury,
    -- expenses (Schedule J)
    exp_rent_mortgage, exp_utilities, exp_food, exp_transportation,
    exp_healthcare, exp_insurance, exp_childcare, exp_other,
    -- workflow
    reference_number, status, review_status, completed_by_staff,
    submitted_at,
    -- the blob the new portal reads
    form_data
  ) VALUES (
    v_lead_id,
    -- identity
    'individual', 'chapter_7',
    'Mickey', 'Rourke', 'mickey.rourke@example.com', '(602) 555-0188',
    'Carre', 'Otis', NULL, NULL,
    -- residence
    '7424 E Camelback Rd', 'Scottsdale', 'AZ', '85251', 'Maricopa', '5', 'AZ',
    true,
    -- household
    'married', 0,
    -- income
    'employed', 'Mayo Clinic Arizona — Sports Medicine Consultant',
    11500.00, 8200.00, 'Bi-Weekly',
    'not_employed', NULL, 0.00,
    -- real property
    true, '7424 E Camelback Rd, Scottsdale, AZ 85251', 700000.00, 300000.00,
    'Desert Sun Mortgage Co.',
    -- vehicles
    0, true,
    -- personal property
    8500.00, 125000.00,
    false, 0.00,
    true, 35000.00,
    false, 0.00,
    false, 0.00,
    false, 0.00,
    14000.00,
    'Annuity (Pacific Life Fixed) $80,000 — see form_data.annuities; spouse beneficiary; 2y continuous ownership.',
    -- debts (flat columns are for legacy / paralegal-review reads; the
    -- attorney intake dashboard reads form_data.* below)
    --   secured_debt      = mortgage $300k.
    --   credit_card_debt  = $92k.
    --   personal_loan_debt = $750k SBA (classifiable bucket — defaults to
    --   consumer in calcDebtComposition; the attorney flips it to business
    --   in the Issues tab to engage the § 707(b)(1) bypass). The flat
    --   schema has no business-debt columns today; questionnaire convention
    --   stashes SBA personal-guarantee loans in personal_loan_debt until
    --   an explicit is_business_debt flag is added per the
    --   CLASSIFIABLE_DEBT_BUCKETS TODO in AttorneyIntakeDashboard.tsx.
    300000.00, 92000.00, 0.00, 0.00,
    0.00, 750000.00, 0.00,
    -- flags
    false, false, false, false,
    false, false,
    false, true, false, false,
    -- expenses
    2350.00, 380.00, 850.00, 520.00,
    410.00, 620.00, 0.00, 670.00,
    -- workflow
    'INT-MICKEY-ROURKE-AZ-CH7-2026', 'pending_review', 'submitted', false,
    now() - interval '1 day',
    -- form_data: camelCase shape the new portal reads
    jsonb_build_object(
      'firstName',        'Mickey',
      'lastName',         'Rourke',
      'email',            'mickey.rourke@example.com',
      'phone',            '(602) 555-0188',
      'filingType',       'individual',
      'chapterType',      'chapter_7',
      'maritalStatus',    'married',
      'spouseFirstName',  'Carre',
      'spouseLastName',   'Otis',
      'address',          '7424 E Camelback Rd',
      'city',             'Scottsdale',
      'state',            'AZ',
      'zip',              '85251',
      'county',           'Maricopa',
      'addressYears',     '5',
      'priorDomicileState','AZ',
      'homeAcquiredDate', '2021-06-08',
      'isOccupiedPrimary','yes',
      'numDependents',    '0',
      'dependents',       jsonb_build_array()
    )
    ||
    jsonb_build_object(
      'debtorWorkStatus',  'employed',
      'spouseWorkStatus',  'not_employed',
      'debtorEmployer',    'Mayo Clinic Arizona — Sports Medicine Consultant',
      'debtorMonthlyGross','11500',
      'spouseMonthlyGross','0',
      'debtorSources',     jsonb_build_array(
        jsonb_build_object(
          'sourceType',     'employment',
          'employerName',   'Mayo Clinic Arizona — Sports Medicine Consultant',
          'payFrequency',   'Bi-Weekly',
          'grossPerPeriod', '5307.69',
          'netPerPeriod',   '3784.62',
          'receiveBonus',   'no'
        )
      ),
      'spouseSources',     jsonb_build_array(),
      'dSsRetirement',     '0',
      'dSsDisability',     '0',
      'dVeterans',         '0',
      'expRentMortgage',   '2350',
      'expUtilities',      '380',
      'expFood',           '850',
      'expTransportation', '520',
      'expMedical',        '410',
      'expInsurance',      '620',
      'expChildcare',      '0',
      'expOther',          '670'
    )
    ||
    jsonb_build_object(
      'ownsRealEstate',         'yes',
      'realPropAddress',        '7424 E Camelback Rd, Scottsdale, AZ 85251',
      'realPropValue',          '700000',
      'mortgageBalance',        '300000',
      'mortgageLender',         'Desert Sun Mortgage Co.',
      'mortgageArrears',        '0',
      'realPropMonthlyPayment', '2350',
      'realPropIntent',         'keep',
      'realPropType',           'Primary Residence',
      'properties',             jsonb_build_array(
        jsonb_build_object(
          'address',         '7424 E Camelback Rd, Scottsdale, AZ 85251',
          'propType',        'Primary Residence',
          'propertyValue',   '700000',
          'loanBalance',     '300000',
          'monthlyPayment',  '2350',
          'arrearsAmount',   '0',
          'lenderName',      'Desert Sun Mortgage Co.',
          'intent',          'keep',
          'interestRate',    '5.875',
          'acquiredDate',    '2021-06-08',
          'note',            'Owned 5y; $400k equity at AZ § 33-1101 cap ($400,600). Fully exempt; § 522(p) 1215-day federal cap not triggered.'
        )
      ),
      'numVehicles',            0,
      'noVehicles',             true,
      'vehicles',               jsonb_build_array()
    )
    ||
    jsonb_build_object(
      'bankBalance',            '8500',
      'retirementBalance',      '125000',
      'hasStocks',              'no',
      'stocksValue',            '0',
      'hasCrypto',              'yes',
      'cryptoValue',            '35000',
      'hasLifeInsurance',       'no',
      'lifeInsuranceCashValue', '0',
      'hasFirearms',            'no',
      'firearmValue',           '0',
      'hasCollectibles',        'no',
      'collectiblesValue',      '0',
      'householdGoodsValue',    '14000',
      'jewelryValue',           '2500',
      'toolsValue',             '0',
      'otherPersonalPropDesc',  ''
    )
    ||
    jsonb_build_object(
      'hasAnnuities',  'yes',
      'annuities',     jsonb_build_array(
        jsonb_build_object(
          'id',           1,
          'annuityType',  'Fixed Annuity',
          'issuerName',   'Pacific Life',
          'currentValue', '80000',
          'yearsHeld',    '2',
          'yearsOwned',   '2',
          'beneficiary',  'Carre Otis (spouse)',
          'purchaseDate', '2024-06-08',
          'note',         'A.R.S. § 20-1131(D) — 2-year continuous-ownership requirement met as of filing; spouse-beneficiary requirement met. Borderline (exactly 2y).'
        )
      ),
      'pendingClaims',      jsonb_build_array(),
      'pendingClaimsValue', '0',
      -- Debt buckets feeding calcDebtComposition (src/AttorneyIntakeDashboard.tsx):
      --   Consumer secured (always):  mortgage $300k (also on properties[].loanBalance)
      --   Consumer unsecured default: credit cards $92k (creditCardDebt)
      --   Classifiable bucket:        personalLoanDebt $750k — the SBA loan,
      --                                defaults to CONSUMER per CLASSIFIABLE_DEBT_BUCKETS.
      --                                Attorney flips to "business" via the
      --                                Debt Classification card on the Issues tab.
      -- Initial render: business 0% / consumer 100% → over-median → Ch.7 ineligible.
      -- After attorney classifies personalLoanDebt = business:
      --   business: $750,000 / total $1,142,000 = 65.7% > 50%
      --   → § 707(b)(1) means test does NOT apply → Ch.7 eligible.
      'securedDebt',        '300000',
      'creditCardDebt',     '92000',
      'medicalDebt',        '0',
      'studentLoanDebt',    '0',
      'taxDebt',            '0',
      'personalLoanDebt',   '750000',
      'otherUnsecured',     '0',
      -- Explicit business-debt fields calcTotalBusinessDebt() reads — all zero
      -- so the SBA isn't double-counted. The questionnaire today has no
      -- separate SBA / personal-guarantee field; SBA enters via
      -- personalLoanDebt above and is reclassified by the attorney.
      -- TODO Phase B: add is_business_debt per debt entry on the locked
      -- questionnaire so seed cases like this don't need an attorney click.
      'supplyVendorDebt',       '0',
      'businessCreditCardDebt', '0',
      'businessMortgageDebt',   '0',
      'businessEquipmentDebt',  '0',
      'otherBusinessDebt',      '0'
    )
    ||
    jsonb_build_object(
      'backTaxes',         '0',
      'priorityDebts',     jsonb_build_array(),
      'childSupport',      '0',
      'alimony',           '0',
      'dsoArrears',        '0',
      'dsoArrearsAmount',  '0',
      'garnishment',       'no',
      'coDebtors',         jsonb_build_array(
        jsonb_build_object(
          'name',         'Carre Otis (spouse)',
          'relationship', 'spouse',
          'debt',         'Joint mortgage on primary residence — $300,000 balance',
          'creditor',     'Desert Sun Mortgage Co.'
        )
      ),
      'pendingLawsuits',          'no',
      'priorBankruptcy',          'no',
      'transferredProperty',      'no',
      'transfers',                jsonb_build_array(),
      'preferentialPayments',     'no',
      'preferentialPaymentsInsider','no',
      'preferentialEntries',      jsonb_build_array(),
      'preferentialInsiderEntries', jsonb_build_array(),
      'ownedBusiness',            'yes',
      'businessDetails',          'Rourke Boxing Academy LLC (Scottsdale, AZ) — debtor was sole member. Business closed Q3 2024 due to declining membership. SBA 7(a) loan ($750,000 principal) originated 2019; personally guaranteed; remains outstanding post-closure. Stashed in form_data.personalLoanDebt (the classifiable bucket calcDebtComposition reads); defaults to consumer — attorney must reclassify as business via the Debt Classification card on the Issues tab. No ongoing business income; debtor now W-2 consultant. Classification under § 101(8): business debt (loan was for the LLC, not personal/family/household). Once classified, business share is 65.7% of $1,142,000 total → § 707(b)(1) primarily-business-debt majority → means test does not apply.',
      'recentLuxury',             'no',
      'recentCashAdvance',        'no',
      'expectedRefund',           'no',
      '_source',                  'client_self_serve_az_ch7'
    )
  ) RETURNING id INTO v_submission_id;

  ----------------------------------------------------------------------------
  -- 4) Soft-link the lead back to the submission for direct traversal.
  ----------------------------------------------------------------------------
  UPDATE intake_leads
     SET submission_id = v_submission_id
   WHERE id = v_lead_id;

  RAISE NOTICE 'Mickey Rourke seeded. lead=%, submission=%, position=awaiting intake-staff confirmation (review_status=submitted, intake_completed=false, sent_for_review=false). SBA $750k sits in personalLoanDebt (classifiable bucket, defaults to consumer). Initial render: Ch.7 looks ineligible (over-median + 0%% business). Attorney must open Issues → Debt Classification card → flip personalLoanDebt to "business" to engage § 707(b)(1) bypass (business share becomes 65.7%% > 50%%).',
    v_lead_id, v_submission_id;
END $$;
