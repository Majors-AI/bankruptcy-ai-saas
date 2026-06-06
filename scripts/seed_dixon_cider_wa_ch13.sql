/*
  Seed: Dixon Cider — WA Chapter 13, COMPLICATED case (stress-test).

  Run AFTER both migrations:
    - 20260604120000_add_form_data_to_intake_submissions.sql
    - 20260604120100_extend_attorney_intake_reviews_for_portal.sql

  Designed to light up every flag/warning the new portal can produce:

  Eligibility / means test:
    - JOINT filing (debtor + spouse, both employed)
    - Income ABOVE WA 4-person median (~$11,100/mo)  → long-form 122A-2
    - Recently moved CA → WA 14 months ago → 730-day domicile rule:
        priorDomicileState=CA, addressYears=1, in_state_over_2_years=false
        Exemption state may resolve to CA (greater portion of 730-day window)
    - § 109(e) under both limits (so eligibility passes; want the
      analysis to RUN, not get short-circuited)

  Plan funding (every 1325 element with substance):
    - Primary residence with arrears → conduit + arrears cure (Element 1)
    - Investment rental (no homestead) → liquidation floor (Element 3)
    - Three vehicles:
        Tesla Y, 8 months old → within 910 days, NO cramdown allowed
        2018 Audi Q5, 6+ years old → cramdown eligible (split-claim)
        2014 F-150 underwater → SURRENDER
    - Self-employment income (cidery LLC) → biz GROSS counted in Ch.13 DMI
    - Domestic support arrears (Element 2 priority + § 1325(a)(7) good faith)
    - Back taxes priority (Element 2)
    - Active wage garnishment

  Asset-protection / disclosure red flags:
    - Insider preferential payment ($4,200 to spouse's brother 7 months ago)
      → within 1-year insider lookback, § 547(b)
    - Property transfer to son ($35k cash gift) 18 months ago → § 548 reach
    - Recent luxury purchase ($8,400 cruise) within 90 days → § 523(a)(2)(C)
      presumption of nondischargeability for $1,000+ luxury
    - Cash advance ($2,800) within 70 days → same § 523 presumption
    - Pending PI lawsuit (motorcycle accident) → asset disclosure (Sch. B)
    - Co-signer on parent's mortgage → § 1322(b)(1) co-debtor stay
    - Expected federal tax refund $4,200

  Discharge complications:
    - Prior Chapter 7 discharged 38 months ago → § 1328(f)(1) bars Ch.13
      discharge within 4 years of Ch.7 discharge → CRITICAL warning
      (case may still be filable for plan relief but no discharge)

  Exemption non-exempt equity (drives liquidation floor):
    - Investment property $200k non-mortgage equity (no homestead)
    - Brokerage $185k (non-exempt — wildcard insufficient)
    - Crypto $48k (non-exempt)
    - Bank balance $32k (limited bank exemption)
    - Jewelry $14k (WA jewelry exemption $3,500)
    - Firearms $9k (no general firearm exemption; wildcard insufficient)

  Idempotent: deletes any prior Dixon Cider row by email before inserting.
*/

DELETE FROM intake_submissions WHERE email = 'dixon.cider@example.com';

INSERT INTO intake_submissions (
  -- Identity
  filing_type, chapter_type, first_name, last_name, email, phone,
  spouse_first_name, spouse_last_name, spouse_email, spouse_phone,
  -- Residence (NOT NULL)
  street_address, city, state, zip_code, county, address_years, prior_state,
  -- Household (NOT NULL)
  marital_status, num_dependents,
  -- Income (NOT NULL)
  debtor_work_status, debtor_employer, debtor_gross_monthly, debtor_net_monthly, debtor_pay_frequency,
  spouse_work_status, spouse_employer, spouse_gross_monthly,
  -- Real property
  owns_real_estate, real_prop_address, real_prop_value, mortgage_balance, mortgage_lender,
  -- Vehicles
  num_vehicles, no_vehicles,
  -- Personal property
  bank_balance, retirement_balance,
  has_stocks, stocks_value,
  has_crypto, crypto_value,
  has_life_insurance, life_insurance_cash_value,
  has_firearms, firearm_value,
  has_collectibles, collectibles_value,
  household_goods_value, other_property_desc,
  -- Debts
  secured_debt, credit_card_debt, medical_debt, student_loan_debt,
  tax_debt, personal_loan_debt, other_unsecured,
  -- Financial history flags
  prior_bankruptcy, has_prior_bk, pending_lawsuits, garnishment,
  transferred_property, has_transfers,
  has_preferential_payments, owned_business, expected_refund, recent_luxury,
  -- Expenses (Schedule J)
  exp_rent_mortgage, exp_utilities, exp_food, exp_transportation,
  exp_healthcare, exp_insurance, exp_childcare, exp_other,
  -- Workflow
  reference_number, status, submitted_at, in_state_over_2_years,
  -- The blob the new portal actually reads
  form_data
) VALUES (
  -- Identity
  'joint', '13', 'Dixon', 'Cider', 'dixon.cider@example.com', '(206) 555-0142',
  'Daria', 'Cider', 'daria.cider@example.com', '(206) 555-0143',
  -- Residence
  '1842 Lake Washington Blvd NE', 'Seattle', 'WA', '98112', 'King', '1', 'CA',
  -- Household: joint + 2 minor children
  'married_joint', 2,
  -- Debtor income
  'employed', 'Pacific Northwest Logistics LLC', 14500.00, 10200.00, 'Bi-Weekly',
  'selfEmployed', 'Salish Sea Cidery LLC (Dixon + Daria, 50/50)', 6500.00,
  -- Real property
  true, '1842 Lake Washington Blvd NE, Seattle, WA 98112', 980000.00, 540000.00, 'Cascadia Federal Mortgage',
  -- Vehicles
  3, false,
  -- Personal property
  32000.00, 215000.00,
  true, 185000.00,
  true, 48000.00,
  true, 18500.00,
  true, 9000.00,
  true, 6500.00,
  42000.00, 'Art collection (gallery-appraised) $6,500; wine cellar ~$3,200; commercial cidery equipment held outside LLC ~$22,000',
  -- Debts (secured = primary mortgage + 3 vehicle loans)
  780500.00, 96000.00, 42000.00, 58000.00,
  31500.00, 24000.00, 14500.00,
  -- Flags
  true, true, true, true,
  true, true,
  true, true, true, true,
  -- Expenses
  4850.00, 480.00, 1850.00, 950.00,
  720.00, 580.00, 1600.00, 820.00,
  -- Workflow
  'INT-DIXON-CIDER-COMPLEX-2026', 'pending_review', now(), false,
  -- ── form_data: camelCase shape the new portal reads ────────────────────────
  jsonb_build_object(
    -- identity / filing
    'firstName',         'Dixon',
    'lastName',          'Cider',
    'email',             'dixon.cider@example.com',
    'phone',             '(206) 555-0142',
    'filingType',        'joint',
    'chapterType',       '13',
    'maritalStatus',     'married_joint',
    'spouseFirstName',   'Daria',
    'spouseLastName',    'Cider',
    'spouseEmail',       'daria.cider@example.com',
    'spousePhone',       '(206) 555-0143',

    -- residence — recently moved from CA to WA (730-day domicile issue)
    'address',           '1842 Lake Washington Blvd NE',
    'city',              'Seattle',
    'state',             'WA',
    'zip',               '98112',
    'county',            'King',
    'addressYears',      '1',
    'priorDomicileState','CA',
    'priorAddr1Street',  '847 Ocean Avenue',
    'priorAddr1City',    'Santa Monica',
    'priorAddr1State',   'CA',
    'movedToStateDate',  '2025-04-12',

    -- WA homestead gate inputs (per the new portal's null-rule)
    'homeAcquiredDate',  '2025-05-08',
    'isOccupiedPrimary', 'yes',

    -- household / dependents
    'numDependents',     '2',
    'dependents',        jsonb_build_array(
      jsonb_build_object('age', '12', 'relationship', 'son',      'name', 'Cole'),
      jsonb_build_object('age', '9',  'relationship', 'daughter', 'name', 'Cleo')
    )
  )
  ||
  -- ── chunk 1b ──
  jsonb_build_object(
    -- income — wages above WA 4-person median (~$11,100/mo) PLUS self-employment cidery
    'debtorWorkStatus',  'employed',
    'spouseWorkStatus',  'selfEmployed',
    'debtorEmployer',    'Pacific Northwest Logistics LLC',
    'spouseEmployer',    'Salish Sea Cidery LLC',
    'debtorMonthlyGross','14500',
    'spouseMonthlyGross','6500',
    'debtorSources',     jsonb_build_array(
      jsonb_build_object(
        'sourceType',     'employment',
        'employerName',   'Pacific Northwest Logistics LLC',
        'payFrequency',   'Bi-Weekly',
        'grossPerPeriod', '6692.31',
        'netPerPeriod',   '4707.69',
        'receiveBonus',   'yes',
        'bonusGross',     '12000',
        'bonusNet',       '8400',
        'bonusIncludedInIncome', 'no'
      )
    ),
    'spouseSources',     jsonb_build_array(
      jsonb_build_object(
        'sourceType',     'selfEmployment',
        'businessName',   'Salish Sea Cidery LLC',
        'employerName',   'Salish Sea Cidery LLC',
        'payFrequency',   'Monthly',
        'grossPerPeriod', '14200',
        'netPerPeriod',   '6500',
        'businessGrossIncome', '14200',
        'businessExpenses',    '7700',
        'receiveBonus',   'no'
      )
    ),

    -- non-CMI income (debtor SS disability, spouse VA)
    'dSsRetirement',     '0',
    'dSsDisability',     '0',
    'dVeterans',         '0',

    -- expenses (Schedule J) — high due to dependents + Seattle COL
    'expRentMortgage',   '4850',
    'expUtilities',      '480',
    'expFood',           '1850',
    'expTransportation', '950',
    'expMedical',        '720',
    'expInsurance',      '580',
    'expChildcare',      '1600',
    'expOther',          '820',

    -- real property — TWO properties: primary (arrears) + investment (NO homestead)
    'ownsRealEstate',    'yes',
    'realPropAddress',   '1842 Lake Washington Blvd NE, Seattle, WA',
    'realPropValue',     '980000',
    'mortgageBalance',   '540000',
    'mortgageLender',    'Cascadia Federal Mortgage',
    'mortgageArrears',   '24500',
    'realPropMonthlyPayment', '4850',
    'realPropIntent',    'keep',
    'realPropType',      'Primary Residence',
    'properties',        jsonb_build_array(
      jsonb_build_object(
        'address',         '1842 Lake Washington Blvd NE, Seattle, WA',
        'propType',        'Primary Residence',
        'propertyValue',   '980000',
        'loanBalance',     '540000',
        'monthlyPayment',  '4850',
        'arrearsAmount',   '24500',
        'lenderName',      'Cascadia Federal Mortgage',
        'intent',          'keep',
        'interestRate',    '6.875'
      ),
      jsonb_build_object(
        'address',         '12420 Westmont Ave, Edmonds, WA',
        'propType',        'Investment/Rental Property',
        'propertyValue',   '475000',
        'loanBalance',     '275000',
        'monthlyPayment',  '2150',
        'arrearsAmount',   '0',
        'lenderName',      'Snohomish Credit Union',
        'intent',          'keep',
        'interestRate',    '5.50',
        'rentalIncome',    '2400'
      ),
      jsonb_build_object(
        'address',         '847 Ocean Avenue, Santa Monica, CA',
        'propType',        'Investment/Rental Property',
        'propertyValue',   '1450000',
        'loanBalance',     '1380000',
        'monthlyPayment',  '7200',
        'arrearsAmount',   '0',
        'lenderName',      'West Coast Federal',
        'intent',          'surrender',
        'interestRate',    '4.25',
        'note',            'Underwater $70k incl costs; surrender + abandonment'
      )
    )
  )
  ||
  -- ── chunk 2 (avoid Postgres 100-arg limit on a single jsonb_build_object) ──
  jsonb_build_object(
    -- vehicles — one within 910 days (no cramdown), one crammable, one underwater surrender
    'numVehicles',       3,
    'noVehicles',        false,
    'vehicles',          jsonb_build_array(
      jsonb_build_object(
        'year',          '2024',
        'make',          'Tesla',
        'model',         'Model Y Long Range',
        'value',         '52000',
        'loanBalance',   '48500',
        'monthlyPayment','840',
        'lenderName',    'Tesla Finance',
        'interestRate',  '7.24',
        'intent',        'keep',
        'purchaseDate',  '2025-10-04',
        'note',          'Within 910 days — NO cramdown'
      ),
      jsonb_build_object(
        'year',          '2018',
        'make',          'Audi',
        'model',         'Q5 Premium',
        'value',         '21000',
        'loanBalance',   '32000',
        'monthlyPayment','610',
        'lenderName',    'Audi Financial',
        'interestRate',  '8.99',
        'intent',        'cramdown',
        'purchaseDate',  '2020-03-15',
        'note',          'Over 910 days; § 506(a) cramdown to $21,000 + Till interest'
      ),
      jsonb_build_object(
        'year',          '2014',
        'make',          'Ford',
        'model',         'F-150 SuperCrew',
        'value',         '11000',
        'loanBalance',   '18500',
        'monthlyPayment','475',
        'lenderName',    'Ford Credit',
        'interestRate',  '9.5',
        'intent',        'surrender',
        'purchaseDate',  '2019-08-20',
        'note',          'Underwater $7,500 — surrender'
      )
    )
  )
  ||
  -- ── chunk 3 ──
  jsonb_build_object(
    -- personal property (mostly non-exempt → drives liquidation floor)
    'bankBalance',       '32000',
    'retirementBalance', '215000',
    'hasStocks',         'yes',
    'stocksValue',       '185000',
    'hasCrypto',         'yes',
    'cryptoValue',       '48000',
    'hasLifeInsurance',  'yes',
    'lifeInsuranceCashValue', '18500',
    'hasFirearms',       'yes',
    'firearmValue',      '9000',
    'hasCollectibles',   'yes',
    'collectiblesValue', '6500',
    'householdGoodsValue', '42000',
    'jewelryValue',      '14000',
    'toolsValue',        '8500',
    'otherPersonalPropDesc', 'Art collection (gallery-appraised) $6,500; wine cellar ~$3,200; commercial cidery equipment held outside LLC ~$22,000',

    -- business assets (commercial cidery equipment outside the LLC)
    'businessAssets',    jsonb_build_array(
      jsonb_build_object(
        'description',   'Commercial cider press & tanks (held personally)',
        'estimatedValue','22000',
        'owedOnIt',      '0'
      )
    ),

    -- pending lawsuit — asset disclosure on Sch. B
    'pendingClaims',     jsonb_build_array(
      jsonb_build_object(
        'description',   'Personal injury — motorcycle accident, Mar 2025',
        'role',          'plaintiff',
        'estimatedValue','75000',
        'status',        'pending settlement negotiations'
      )
    ),
    'pendingClaimsValue','75000',

    -- debts — debtor + spouse joint
    'securedDebt',       '780500',
    'creditCardDebt',    '96000',
    'medicalDebt',       '42000',
    'studentLoanDebt',   '58000',
    'taxDebt',           '31500',
    'personalLoanDebt',  '24000',
    'otherUnsecured',    '14500'
  )
  ||
  -- ── chunk 4 ──
  jsonb_build_object(
    -- priority debts (back taxes + domestic support arrears)
    'backTaxes',         '31500',
    'priorityDebts',     jsonb_build_array(
      jsonb_build_object('creditor', 'IRS',                'amount', '21500', 'type', 'income_tax_2023_2024'),
      jsonb_build_object('creditor', 'WA Dept of Revenue', 'amount', '10000', 'type', 'business_b_and_o_tax')
    ),
    'childSupport',      '0',
    'alimony',           '1850',
    'dsoArrears',        '8400',
    'dsoArrearsAmount',  '8400',
    'dsoNote',           'Alimony arrears owed to ex-spouse from prior marriage (CA decree, transferred to WA)',

    -- garnishment — active
    'garnishment',       'yes',
    'garnishmentCreditor', 'Discover Bank (cc judgment $14,200)',
    'garnishmentMonthlyAmount', '850',
    'garnishmentDetails','Discover Bank cc judgment $14,200 — wage garnishment 25% disposable, $850/mo',

    -- co-debtor / co-signer (§ 1301 + § 1322(b)(1))
    'coDebtors',         jsonb_build_array(
      jsonb_build_object(
        'name',          'Margaret Cider (mother)',
        'relationship',  'mother',
        'debt',          'Reverse mortgage co-signer — $185,000 balance',
        'creditor',      'AAG Reverse'
      )
    ),

    -- pending lawsuits flag
    'pendingLawsuits',   'yes',
    'lawsuitDetails',    'Plaintiff in PI suit (motorcycle, Mar 2025) — pending settlement. Defendant in Discover Bank cc collection $14,200 (judgment entered, garnishment active).',

    -- financial history red flags
    'priorBankruptcy',   'yes',
    'priorBankruptcies', jsonb_build_array(
      jsonb_build_object(
        'chapter',       '7',
        'yearFiled',     2023,
        'caseNumber',    '23-10456 (C.D. Cal.)',
        'discharged',    true,
        'dischargeDate', '2023-04-08',
        'note',          '§ 1328(f)(1) — Ch.13 discharge BARRED within 4 years of prior Ch.7 discharge. Eligible to FILE Ch.13 for plan relief but no discharge until 2027-04-08.'
      )
    ),

    -- transfers within 2-year reach-back (§ 548)
    'transferredProperty','yes',
    'transfers',         jsonb_build_array(
      jsonb_build_object(
        'description',   'Cash gift to son',
        'recipient',     'Jordan Cider (adult son, non-debtor)',
        'relationship',  'son',
        'amount',        '35000',
        'date',          '2024-12-18',
        'transferType',  'gift',
        'note',          '§ 548 reach-back 2 years — disclose; trustee may avoid as constructive fraud if insolvent at time'
      )
    ),

    -- preferential payments — INSIDER within 1-year lookback
    'preferentialPayments',         'yes',
    'preferentialPaymentsInsider',  'yes',
    'preferentialEntries',          jsonb_build_array(),
    'preferentialInsiderEntries',   jsonb_build_array(
      jsonb_build_object(
        'creditor',     'Marcus Sterling (Daria''s brother)',
        'amount',       '4200',
        'date',         '2025-11-14',
        'relationship', 'insider — spouse''s brother',
        'note',         '§ 547(b) + § 101(31) insider — 1-year lookback. Trustee may recover for benefit of estate.'
      )
    ),

    -- owned business — Salish Sea Cidery LLC (50/50 with spouse)
    'ownedBusiness',     'yes',
    'businessDetails',   'Salish Sea Cidery LLC (Snohomish County) — 50/50 with spouse Daria. Operating cidery + taproom. Sched B disclosure of membership interest; commercial cidery equipment held personally listed separately (~$22k).',

    -- recent expensive purchases — § 523(a)(2)(C) presumption
    'recentLuxury',      'yes',
    'luxuryDetails',     'Royal Caribbean cruise Sept 2025 — $8,400 charged to Chase Sapphire within 90 days of filing. § 523(a)(2)(C) presumption of nondischargeability for >$1,000 luxury within 90 days.',
    'recentCashAdvance', 'yes',
    'cashAdvanceAmount', '2800',
    'cashAdvanceDate',   '2025-12-22',
    'cashAdvanceNote',   '§ 523(a)(2)(C) presumption — cash advance >$1,100 within 70 days nondischargeable',

    -- expected refund (asset)
    'expectedRefund',    'yes',
    'refundAmount',      '4200',

    -- marker
    '_source',           'self_serve_complex'
  )
);
