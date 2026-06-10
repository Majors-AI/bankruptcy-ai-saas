// Shared All-Answers view.
//
// Originally added inline on the attorney intake review surface
// (src/AttorneyIntakeDashboard.tsx) as the "All Answers" tab. Extracted into
// this shared component so the legal-admin lead-detail screen can mount the
// same read-only view via a "Review Intake" action without duplicating the
// schema or rendering logic.
//
// Two modes:
//   - 'read-only' (default): pure listing of every captured questionnaire
//     answer, grouped by section, with blanks flagged. No flag toggles, no
//     submit-back-to-client action. Suitable for any reviewer — including
//     non-lawyer intake staff.
//   - 'attorney-review': adds per-section "Request additional information"
//     flag toggle + per-section note input + a bottom "Submit back to client"
//     action that bundles the flagged sections. The host owns the
//     infoRequests state and submit handler.
//
// The locked client questionnaire (BankruptcyIntake.jsx) remains the source
// of truth for the actual form; this view is a read-only mirror of the data
// it produces (intake_submissions.form_data).
//
// TODO Phase B — full schema parity:
//   - generate ALL_ANSWERS_SCHEMA from a single shared definition the locked
//     questionnaire also consumes, so adding a field to the form is a
//     one-place change. Today the schema is hand-maintained.
//   - cover repeating arrays beyond the headline ones (e.g., per-property
//     `acquiredDate`, per-vehicle `purchaseDate`, per-creditor narrative).

import { ClipboardList, Flag, Send } from "lucide-react";

// ─── Schema ──────────────────────────────────────────────────────────────────

export type AllAnswersFmt = 'text' | 'money' | 'yesNo' | 'date' | 'multiline' | 'count' | 'multi';

export type AllAnswersField = {
  key: string;
  /** Short label — used as a fallback heading when `question` isn't provided
   *  and as the inline label on array-item rows. Kept compact. */
  label: string;
  /** The actual QUESTION asked of the client (or that the staffer asked
   *  during guided intake). Shown above the answer in the All Answers view
   *  so the reviewing attorney sees the original prompt alongside the
   *  recorded answer — not just a one-word column header.
   *  Optional; falls back to `label` when omitted. */
  question?: string;
  format?: AllAnswersFmt;
  // For array-valued fields, render each item using `itemFields`. If the array
  // is empty, the section displays "None reported" (which counts as answered).
  itemFields?: { key: string; label: string; format?: 'text' | 'money' | 'yesNo' | 'date' }[];
};

export type AllAnswersSection = {
  id: string;
  /** Group title — set to the FILING DOCUMENT this group of questions belongs
   *  to (e.g. "Voluntary Petition (Form 101)", "Schedule A/B — Property",
   *  "Statement of Financial Affairs"). The All Answers view groups + renders
   *  by this title so the reviewing attorney sees questions sorted under the
   *  document they end up on. */
  title: string;
  /** Optional one-line subtitle describing what the document is for. */
  documentNote?: string;
  fields: AllAnswersField[];
};

// Groups are ordered to mirror the filing-document sequence the firm
// uses (Petition → Schedules A through J → Means Test → SOFA → Statement
// of Intention → extras). Schedule G (executory contracts) and Schedule H
// (co-debtors) are intentionally OMITTED — they were excluded from the
// determination questionnaire and the locked client form's outputs we
// surface here don't carry their fields.
export const ALL_ANSWERS_SCHEMA: ReadonlyArray<AllAnswersSection> = [
  {
    id: 'voluntaryPetition',
    title: 'Voluntary Petition (Form 101)',
    documentNote: 'Identity, household, jurisdiction, marital status, residency — the official cover petition filed with the court.',
    fields: [
      { key: 'firstName',           label: 'First name',           question: 'What is the debtor\'s first name?' },
      { key: 'lastName',            label: 'Last name',            question: 'What is the debtor\'s last name?' },
      { key: 'email',               label: 'Email',                question: 'What is the best email address to reach the debtor?' },
      { key: 'phone',               label: 'Phone',                question: 'What is the best phone number to reach the debtor?' },
      { key: 'filingType',          label: 'Filing type',          question: 'Is this an individual filing, an individual with a non-filing spouse, or a joint filing with the spouse?' },
      { key: 'chapterType',         label: 'Chapter sought',       question: 'Which chapter is the debtor considering — Chapter 7 or Chapter 13?' },
      { key: 'maritalStatus',       label: 'Marital status',       question: 'What is the debtor\'s current marital status — single, married, separated, divorced, or widowed?' },
      { key: 'spouseFirstName',     label: 'Spouse first name',    question: 'If married, what is the spouse\'s first name?' },
      { key: 'spouseLastName',      label: 'Spouse last name',     question: 'If married, what is the spouse\'s last name?' },
      { key: 'spouseEmail',         label: 'Spouse email',         question: 'Email for the non-filing or joint-filing spouse?' },
      { key: 'spousePhone',         label: 'Spouse phone',         question: 'Phone for the non-filing or joint-filing spouse?' },
      { key: 'address',             label: 'Street address',       question: 'What is the debtor\'s current street address?' },
      { key: 'city',                label: 'City',                 question: 'What city does the debtor live in?' },
      { key: 'state',               label: 'State',                question: 'What state does the debtor live in? (Drives the applicable exemption set and bankruptcy district.)' },
      { key: 'zip',                 label: 'ZIP',                  question: 'What is the ZIP code?' },
      { key: 'county',              label: 'County',               question: 'Which county? (Drives district routing + IRS Local Standards lookup.)' },
      { key: 'addressYears',        label: 'Years at this address', question: 'How long has the debtor lived at this address — less than 91 days, 91 days–6 months, 6 months–2 years, or 2+ years? (Triggers § 522(b)(3) 730-day domicile analysis when under 2 years.)' },
      { key: 'priorDomicileState',  label: 'Prior domicile state', question: 'If the debtor has lived in the current state less than 2 years, where did they live before? (730-day rule may require prior-state exemptions.)' },
      { key: 'movedToStateDate',    label: 'Date moved to state',  question: 'When did the debtor move to the current state?', format: 'date' },
      { key: 'numDependents',       label: 'Number of dependents', question: 'How many dependents are in the household? (Drives household size for the means test and IRS Standards.)' },
      {
        key: 'dependents', label: 'Dependents', format: 'multi',
        question: 'For each dependent: name, relationship to the debtor, and age.',
        itemFields: [
          { key: 'name',         label: 'Name' },
          { key: 'relationship', label: 'Relationship' },
          { key: 'age',          label: 'Age' },
        ],
      },
    ],
  },

  {
    id: 'schedAB',
    title: 'Schedule A/B — Real & Personal Property',
    documentNote: 'Every asset the debtor owns or has an interest in — real property, vehicles, bank/retirement accounts, investments, personal effects.',
    fields: [
      // Real property
      { key: 'ownsRealEstate',  label: 'Owns real estate',  question: 'Does the debtor own any real estate?', format: 'yesNo' },
      { key: 'homeAcquiredDate', label: 'Home acquired date', question: 'When was the home acquired? (Drives WA homestead eligibility and the § 522(p) 1215-day cap.)', format: 'date' },
      { key: 'isOccupiedPrimary', label: 'Home is primary residence', question: 'Does the debtor occupy the home as their primary residence?', format: 'yesNo' },
      {
        key: 'properties', label: 'Properties', format: 'multi',
        question: 'For every parcel of real estate the debtor owns or has an interest in: address, type, value, mortgage balance, monthly payment, arrears, lender, and intent (keep, cramdown, or surrender).',
        itemFields: [
          { key: 'address',       label: 'Address' },
          { key: 'propType',      label: 'Type' },
          { key: 'propertyValue', label: 'Value',         format: 'money' },
          { key: 'loanBalance',   label: 'Mortgage owed', format: 'money' },
          { key: 'lenderName',    label: 'Lender' },
          { key: 'arrearsAmount', label: 'Arrears',       format: 'money' },
          { key: 'intent',        label: 'Intent' },
        ],
      },

      // Vehicles
      { key: 'noVehicles',  label: 'No vehicles', question: 'Does the debtor own ZERO vehicles?', format: 'yesNo' },
      { key: 'numVehicles', label: 'Number of vehicles', question: 'How many vehicles does the debtor own or have an interest in?' },
      {
        key: 'vehicles', label: 'Vehicles', format: 'multi',
        question: 'For every vehicle: year, make, model, current value, loan balance, monthly payment, lender, and intent (keep, cramdown if Ch. 13, or surrender).',
        itemFields: [
          { key: 'year',        label: 'Year' },
          { key: 'make',        label: 'Make' },
          { key: 'model',       label: 'Model' },
          { key: 'value',       label: 'Value',     format: 'money' },
          { key: 'loanBalance', label: 'Loan owed', format: 'money' },
          { key: 'lenderName',  label: 'Lender' },
          { key: 'intent',      label: 'Intent' },
        ],
      },

      // Personal property — financial
      { key: 'bankBalance',            label: 'Bank balances',            question: 'What is the total of all bank balances (checking + savings, every institution combined)?', format: 'money' },
      { key: 'retirementBalance',      label: 'Retirement balances',      question: 'What is the total of all retirement-account balances (401(k), IRA, 403(b), pension)? Generally off-estate under ERISA but disclosure is required.', format: 'money' },
      { key: 'hasStocks',              label: 'Has stocks',               question: 'Does the debtor own any stocks, bonds, or brokerage holdings?', format: 'yesNo' },
      { key: 'stocksValue',            label: 'Stocks value',             question: 'What is the current value of the debtor\'s stocks / brokerage account holdings?', format: 'money' },
      { key: 'hasCrypto',              label: 'Has crypto',               question: 'Does the debtor own any cryptocurrency?', format: 'yesNo' },
      { key: 'cryptoValue',            label: 'Crypto value',             question: 'What is the current value of all cryptocurrency holdings?', format: 'money' },
      { key: 'hasLifeInsurance',       label: 'Has life insurance',       question: 'Does the debtor own any life insurance policies (any type)?', format: 'yesNo' },
      { key: 'lifeInsuranceCashValue', label: 'Life ins. cash value',     question: 'What is the combined CASH SURRENDER VALUE of all life insurance policies (face value is not the answer — cash value is)?', format: 'money' },

      // Personal property — tangible
      { key: 'hasFirearms',         label: 'Has firearms',         question: 'Does the debtor own any firearms?', format: 'yesNo' },
      { key: 'firearmValue',        label: 'Firearm value',        question: 'Combined estimated value of all firearms?', format: 'money' },
      { key: 'hasCollectibles',     label: 'Has collectibles',     question: 'Does the debtor have any collectibles (art, antiques, coins, sports cards, etc.) with material value?', format: 'yesNo' },
      { key: 'collectiblesValue',   label: 'Collectibles value',   question: 'Combined estimated value of all collectibles?', format: 'money' },
      { key: 'householdGoodsValue', label: 'Household goods',      question: 'Estimated value of household goods (furniture, appliances, kitchen items, etc.)?', format: 'money' },
      { key: 'jewelryValue',        label: 'Jewelry',              question: 'Estimated value of all jewelry?', format: 'money' },
      { key: 'toolsValue',          label: 'Tools of trade',       question: 'Value of any tools of trade (work tools, instruments, equipment used to earn income)?', format: 'money' },
      { key: 'otherPersonalPropDesc', label: 'Other personal property', question: 'Description of any other personal property of material value not already listed (with estimated values).', format: 'multiline' },

      // Annuities (asset + exemption input)
      { key: 'hasAnnuities', label: 'Has annuities', question: 'Does the debtor own any annuity contracts?', format: 'yesNo' },
      {
        key: 'annuities', label: 'Annuities', format: 'multi',
        question: 'For every annuity: type, issuer, current value, years held, beneficiary, purchase date. (AZ § 20-1131(D) requires 2+ years continuous ownership AND a spouse/child/parent/dependent beneficiary for the exemption.)',
        itemFields: [
          { key: 'annuityType',  label: 'Type' },
          { key: 'issuerName',   label: 'Issuer' },
          { key: 'currentValue', label: 'Current value', format: 'money' },
          { key: 'yearsHeld',    label: 'Years held' },
          { key: 'beneficiary',  label: 'Beneficiary' },
          { key: 'purchaseDate', label: 'Purchase date', format: 'date' },
        ],
      },

      // Expected refund (asset of the estate as of petition date)
      { key: 'expectedRefund', label: 'Expects tax refund', question: 'Is the debtor expecting a federal or state tax refund? (Refund accrued pre-petition is property of the estate.)', format: 'yesNo' },
      { key: 'refundAmount',   label: 'Refund amount',     question: 'Estimated refund amount?', format: 'money' },
    ],
  },

  {
    id: 'schedD',
    title: 'Schedule D — Secured Creditors',
    documentNote: 'Creditors holding a security interest in the debtor\'s property (mortgages, car loans, other liens).',
    fields: [
      { key: 'securedDebt', label: 'Total secured debt', question: 'What is the aggregate total of ALL secured debts (mortgages + vehicle loans + other secured)?', format: 'money' },
      // Per-property and per-vehicle lender/loanBalance lines come from the
      // properties[] and vehicles[] arrays in Schedule A/B above.
    ],
  },

  {
    id: 'schedE',
    title: 'Schedule E — Priority Unsecured Creditors',
    documentNote: 'Debts the law gives priority status — taxes, back child support / alimony, certain wages.',
    fields: [
      { key: 'taxDebt', label: 'Tax debt', question: 'Total tax debt owed (combined federal + state + local — personal income taxes only; business taxes go under Business)?', format: 'money' },
      {
        key: 'priorityDebts', label: 'Priority debts', format: 'multi',
        question: 'For every priority creditor: name, amount owed, and type (income tax year, child support arrears, etc.).',
        itemFields: [
          { key: 'creditor', label: 'Creditor' },
          { key: 'amount',   label: 'Amount', format: 'money' },
          { key: 'type',     label: 'Type' },
        ],
      },
      { key: 'dsoArrears',       label: 'Has DSO arrears',  question: 'Does the debtor owe past-due child support or alimony (domestic support obligation arrears)?', format: 'yesNo' },
      { key: 'dsoArrearsAmount', label: 'DSO arrears',      question: 'Total DSO arrears amount?', format: 'money' },
    ],
  },

  {
    id: 'schedF',
    title: 'Schedule F — Non-Priority Unsecured Creditors',
    documentNote: 'General unsecured debts — credit cards, medical, personal loans. Discharged in Ch. 7; treated under the plan in Ch. 13.',
    fields: [
      { key: 'creditCardDebt',   label: 'Credit card debt',  question: 'Total consumer credit card debt? (Cards used for business purposes go under Business Debts.)', format: 'money' },
      { key: 'medicalDebt',      label: 'Medical debt',      question: 'Total medical / dental / hospital debt?', format: 'money' },
      { key: 'studentLoanDebt',  label: 'Student loan debt', question: 'Total student loan balance?', format: 'money' },
      { key: 'personalLoanDebt', label: 'Personal loans',    question: 'Total personal-loan and other unsecured consumer debt — does NOT include SBA or business-guaranteed loans (those go under Business). Reclassifying business loans here will block the §707(b)(1) bypass.', format: 'money' },
      { key: 'otherUnsecured',   label: 'Other unsecured',   question: 'Any other unsecured debts not already covered (judgments, deficiency balances, etc.)?', format: 'money' },
    ],
  },

  {
    id: 'schedI',
    title: 'Schedule I — Income',
    documentNote: 'Current monthly income from all sources — drives the means test (Form 122A) and Ch. 13 plan funding.',
    fields: [
      { key: 'debtorWorkStatus',   label: 'Debtor work status',   question: 'Is the debtor employed, self-employed, unemployed, retired, or disabled?' },
      { key: 'debtorEmployer',     label: 'Debtor employer',      question: 'Who is the debtor\'s current employer (or "self-employed — [business name]")?' },
      { key: 'debtorMonthlyGross', label: 'Debtor monthly gross', question: 'What is the debtor\'s AVERAGE MONTHLY income from all sources — wages, bonuses, self-employment net, rental net, investment, family support, side income?', format: 'money' },
      { key: 'spouseWorkStatus',   label: 'Spouse work status',   question: 'Is the spouse employed, self-employed, unemployed, retired, disabled, or not employed?' },
      { key: 'spouseEmployer',     label: 'Spouse employer',      question: 'Who is the spouse\'s current employer (if applicable)?' },
      { key: 'spouseMonthlyGross', label: 'Spouse monthly gross', question: 'Spouse\'s average monthly income from all sources?', format: 'money' },
      { key: 'dSsRetirement',      label: 'SS retirement (debtor)', question: 'Social Security retirement income (debtor) — excluded from CMI under § 101(10A).', format: 'money' },
      { key: 'dSsDisability',      label: 'SS disability (debtor)', question: 'Social Security disability income (SSDI) (debtor) — excluded from CMI.', format: 'money' },
      { key: 'dVeterans',          label: 'VA benefits (debtor)',   question: 'VA benefits income (debtor) — generally excluded from CMI.', format: 'money' },
      {
        key: 'debtorSources', label: 'Debtor income sources', format: 'multi',
        question: 'Per-source breakdown of the debtor\'s income (employer, frequency, gross per period, net per period, bonus) — used for 6-month CMI averaging.',
        itemFields: [
          { key: 'sourceType',     label: 'Type' },
          { key: 'employerName',   label: 'Employer' },
          { key: 'payFrequency',   label: 'Frequency' },
          { key: 'grossPerPeriod', label: 'Gross / period', format: 'money' },
          { key: 'netPerPeriod',   label: 'Net / period',   format: 'money' },
        ],
      },
    ],
  },

  {
    id: 'schedJ',
    title: 'Schedule J — Monthly Expenses',
    documentNote: 'Reasonable monthly living expenses. IRS Standards apply to over-median Ch. 7 means-test analysis (Form 122A-2).',
    fields: [
      { key: 'expRentMortgage',   label: 'Rent / mortgage',  question: 'Monthly rent or mortgage payment (actual)?', format: 'money' },
      { key: 'expUtilities',      label: 'Utilities',        question: 'Monthly utilities — electric, gas, water/sewer, phone, internet (combined)?', format: 'money' },
      { key: 'expFood',           label: 'Food',             question: 'Monthly food spending? (IRS Standards pre-fill applies in the over-median means test.)', format: 'money' },
      { key: 'expTransportation', label: 'Transportation',   question: 'Monthly transportation — gas, maintenance, transit (operating costs; the ownership/lease portion is separate)?', format: 'money' },
      { key: 'expMedical',        label: 'Medical',          question: 'Monthly out-of-pocket medical / dental?', format: 'money' },
      { key: 'expInsurance',      label: 'Insurance',        question: 'Monthly insurance — health, life, vehicle, homeowner / renter (combined)?', format: 'money' },
      { key: 'expChildcare',      label: 'Childcare',        question: 'Monthly childcare cost? (Actual — means test allows actuals here.)', format: 'money' },
      { key: 'expOther',          label: 'Other',            question: 'Any other recurring monthly expenses not captured above (charitable giving, recreation, home maintenance, etc.)?', format: 'money' },
    ],
  },

  {
    id: 'meansTest',
    title: 'Form 122A — Means Test',
    documentNote: 'Calculates whether the debtor passes the §707(b) means test for Ch. 7. CMI inputs above; IRS-Standards expense lines below for over-median cases.',
    fields: [
      // The CMI inputs are the debtorMonthlyGross + spouseMonthlyGross + non-CMI
      // items captured under Schedule I above. Form 122A-2 also uses these
      // IRS-Standards-pre-filled lines from the determination questionnaire:
      { key: 'expApparel',           label: 'Apparel & services',          question: 'Monthly apparel & services expense? (IRS National Standard pre-fills by household size.)', format: 'money' },
      { key: 'expPersonalCare',      label: 'Personal care products',      question: 'Monthly personal-care expense? (IRS National Standard pre-fills by household size.)', format: 'money' },
      { key: 'expHousekeeping',      label: 'Housekeeping supplies',       question: 'Monthly housekeeping-supplies expense? (IRS National Standard pre-fills by household size.)', format: 'money' },
      { key: 'expMiscellaneous',     label: 'Miscellaneous',               question: 'Monthly miscellaneous expense? (IRS National Standard pre-fills by household size.)', format: 'money' },
      { key: 'expHealthOutOfPocket', label: 'Out-of-pocket health care',   question: 'Monthly out-of-pocket health-care expense? (IRS National Standard per-person × household size, under-65 default.)', format: 'money' },
      { key: 'expTransportationOp',  label: 'Transportation operating',    question: 'Monthly transportation OPERATING cost? (IRS Local Standard by MSA.)', format: 'money' },
      { key: 'expTransportationOwn', label: 'Transportation ownership',    question: 'Monthly transportation OWNERSHIP / lease cost? (IRS National figure capped at 2 cars.)', format: 'money' },
      { key: 'expHealthInsurance',   label: 'Health insurance (actual)',   question: 'Monthly health-insurance premium (actual — separate from the IRS health-care standard)?', format: 'money' },
      { key: 'expTaxes',             label: 'Taxes withheld',              question: 'Monthly income / property tax withholding?', format: 'money' },
      { key: 'expDsoPaid',           label: 'Court-ordered DSO paid',      question: 'Monthly court-ordered child support / alimony actually paid?', format: 'money' },
      { key: 'expCarPayment',        label: 'Car payment (actual)',        question: 'Total monthly car payment (actual — summed across vehicles).', format: 'money' },
    ],
  },

  {
    id: 'business',
    title: 'Business Interests & Business Debts',
    documentNote: 'Drives the § 707(b)(1) primarily-business-debt bypass. The five business-debt buckets below are what the engine reads as non-consumer.',
    fields: [
      { key: 'ownedBusiness',          label: 'Owned business',         question: 'Has the debtor owned, operated, or had a material interest in any business in the last 4 years? (Closed LLCs and sole proprietorships count.)', format: 'yesNo' },
      { key: 'businessDetails',        label: 'Business details',       question: 'Tell me about the business — entity name, debtor\'s role, current status (operating / closed), when it started / ended, and the nature of the debt.', format: 'multiline' },
      { key: 'otherBusinessDebt',      label: 'SBA / business loan',    question: 'Total SBA loan or other business-loan balance (personally guaranteed) — 7(a), EIDL, microloans, etc.', format: 'money' },
      { key: 'businessCreditCardDebt', label: 'Business credit cards',  question: 'Total credit card debt incurred for business purchases — even if the card was issued in the debtor\'s personal name.', format: 'money' },
      { key: 'businessMortgageDebt',   label: 'Business RE mortgage',   question: 'Mortgage balance on any commercial / investment real estate?', format: 'money' },
      { key: 'businessEquipmentDebt',  label: 'Equipment financing',    question: 'Total equipment-financing balance (machinery, business vehicles, presses, etc.)?', format: 'money' },
      { key: 'supplyVendorDebt',       label: 'Supply / vendor / trade',question: 'Total supply, vendor, and trade-payable balances?', format: 'money' },
    ],
  },

  {
    id: 'sofa',
    title: 'Statement of Financial Affairs (SOFA)',
    documentNote: 'Background on the debtor\'s financial history over the lookback periods — prior bankruptcies, lawsuits, transfers, preferential payments, recent large purchases.',
    fields: [
      { key: 'priorBankruptcy', label: 'Prior bankruptcy', question: 'Has the debtor filed a prior bankruptcy in the last 8 years (Ch. 7) or 6 years (Ch. 13)? (Triggers § 727(a)(8) / § 1328(f) eligibility-timing analysis.)', format: 'yesNo' },
      {
        key: 'priorBankruptcies', label: 'Prior filings', format: 'multi',
        question: 'For every prior bankruptcy: chapter, year filed, whether discharged, and discharge date.',
        itemFields: [
          { key: 'chapter',       label: 'Chapter' },
          { key: 'yearFiled',     label: 'Year filed' },
          { key: 'caseNumber',    label: 'Case number' },
          { key: 'discharged',    label: 'Discharged', format: 'yesNo' },
          { key: 'dischargeDate', label: 'Discharge date', format: 'date' },
        ],
      },
      { key: 'pendingLawsuits', label: 'Pending lawsuits', question: 'Are there any pending lawsuits, judgments, or active legal proceedings against the debtor?', format: 'yesNo' },
      { key: 'lawsuitDetails',  label: 'Lawsuit details',  question: 'Describe any pending lawsuits, judgments, or pending claims (court, opposing party, status, amount in controversy).', format: 'multiline' },
      { key: 'transferredProperty', label: 'Property transfers', question: 'Has the debtor transferred any property (cash gifts, real estate transfers, vehicle sales below value, etc.) within the last 2 years?', format: 'yesNo' },
      {
        key: 'transfers', label: 'Transfers (§ 548 reach-back)', format: 'multi',
        question: 'For every transfer in the last 2 years: description, recipient, amount, and date. (§ 548 reaches back 2 years; state UVTA may reach back 4 years.)',
        itemFields: [
          { key: 'description', label: 'Description' },
          { key: 'recipient',   label: 'Recipient' },
          { key: 'amount',      label: 'Amount', format: 'money' },
          { key: 'date',        label: 'Date',   format: 'date' },
        ],
      },
      { key: 'preferentialPayments',        label: 'Preferential payments',          question: 'Has the debtor made any payments to creditors totaling more than $700 to a single creditor within the 90 days before filing? (Trustee may recover under § 547.)', format: 'yesNo' },
      { key: 'preferentialPaymentsInsider', label: 'Insider preferential payments',  question: 'Has the debtor made any payments to family members or other insiders within the LAST YEAR? (Insider lookback is 1 year — § 547(b) + § 101(31).)', format: 'yesNo' },
      { key: 'recentLuxury',                label: 'Recent luxury purchases',        question: 'Has the debtor made any luxury purchases over $800 to a single creditor within the 90 days before filing? (§ 523(a)(2)(C) presumptive non-dischargeability.)', format: 'yesNo' },
      { key: 'recentCashAdvance',           label: 'Recent cash advance',            question: 'Has the debtor taken any cash advances over $1,100 within 70 days before filing? (§ 523(a)(2)(C) presumption.)', format: 'yesNo' },
      { key: 'garnishment',                 label: 'Active garnishment',             question: 'Is there an active wage garnishment in effect?', format: 'yesNo' },
      { key: 'garnishmentCreditor',         label: 'Garnishment creditor',           question: 'Who is the garnishing creditor?' },
      { key: 'garnishmentMonthlyAmount',    label: 'Garnishment / month',            question: 'How much is being garnished per month?', format: 'money' },
      { key: 'childSupport',                label: 'Child support paid',             question: 'Monthly child support actually paid by the debtor?', format: 'money' },
      { key: 'alimony',                     label: 'Alimony paid',                   question: 'Monthly alimony / spousal maintenance actually paid by the debtor?', format: 'money' },
    ],
  },

  {
    id: 'statementOfIntention',
    title: 'Statement of Intention (Form 108)',
    documentNote: 'For each secured debt and each unexpired lease, the debtor must state intent: reaffirm, redeem, surrender, or (Ch. 13) cure / cramdown. Captured per-property and per-vehicle above.',
    fields: [
      // The per-property and per-vehicle `intent` fields drive this. We note
      // them here for the reviewer's eyes — actual values are in
      // properties[].intent and vehicles[].intent under Schedule A/B above.
      // No new fields; this group exists to surface the document's existence
      // and remind the attorney to scan the intents on the property + vehicle
      // arrays. TODO Phase B: per-secured-debt intent capture beyond what
      // properties/vehicles arrays already provide.
    ],
  },
];

function fmtMoney(v: unknown): string {
  if (v == null || v === '') return '';
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return String(v);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtYesNo(v: unknown): string {
  if (v === true || v === 'yes' || v === 'true') return 'Yes';
  if (v === false || v === 'no' || v === 'false') return 'No';
  return '';
}
function fmtDate(v: unknown): string {
  if (!v) return '';
  const s = String(v);
  // Pass ISO dates through; otherwise leave as-is.
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
}

export function renderAnswerValue(v: unknown, format?: AllAnswersFmt): { text: string; isBlank: boolean } {
  if (format === 'money') {
    const f = fmtMoney(v);
    return { text: f, isBlank: f === '' || f === '$0' };
  }
  if (format === 'yesNo') {
    const f = fmtYesNo(v);
    return { text: f, isBlank: f === '' };
  }
  if (format === 'date') {
    const f = fmtDate(v);
    return { text: f, isBlank: f === '' };
  }
  if (v == null || v === '') return { text: '', isBlank: true };
  const s = String(v).trim();
  return { text: s, isBlank: s === '' };
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface AllAnswersAttorneyReview {
  infoRequests: Record<string, { note: string }>;
  onInfoRequestsChange: (next: Record<string, { note: string }>) => void;
  onSubmit: () => void;
  submitState: 'idle' | 'sending' | 'queued' | 'error';
  /** True when the viewer is the supervising attorney; false locks the controls. */
  canEdit: boolean;
}

export interface AllAnswersViewProps {
  fd: Record<string, unknown>;
  /** Header title. Default "All Answers". */
  title?: string;
  /** Optional short helper text under the title. */
  subtitle?: string;
  /**
   * If provided, the view renders in attorney-review mode (per-section flag
   * toggles + bottom submit-back action). If omitted, the view is read-only.
   */
  attorneyReview?: AllAnswersAttorneyReview;
}

export default function AllAnswersView({
  fd, title = 'All Answers', subtitle, attorneyReview,
}: AllAnswersViewProps) {
  const ar = attorneyReview;
  const flaggedSectionIds = ar ? Object.keys(ar.infoRequests) : [];
  const flaggedCount = flaggedSectionIds.length;
  const canSubmit = !!ar && flaggedCount > 0 && ar.canEdit && ar.submitState !== 'sending';

  // Build a count of unanswered questions for the header chip.
  let totalBlanks = 0;
  ALL_ANSWERS_SCHEMA.forEach(sec => {
    sec.fields.forEach(f => {
      if (f.format === 'multi') {
        // Multi/array fields count as "answered" when the questionnaire reached
        // the section and produced an array (even empty — "None reported" is an
        // answer).
        const arr = (fd as Record<string, unknown>)[f.key];
        if (!Array.isArray(arr)) totalBlanks++;
      } else {
        const v = (fd as Record<string, unknown>)[f.key];
        const { isBlank } = renderAnswerValue(v, f.format);
        if (isBlank) totalBlanks++;
      }
    });
  });

  const toggleSectionFlag = (sectionId: string) => {
    if (!ar) return;
    const next = { ...ar.infoRequests };
    if (sectionId in next) delete next[sectionId];
    else next[sectionId] = { note: '' };
    ar.onInfoRequestsChange(next);
  };
  const setSectionNote = (sectionId: string, note: string) => {
    if (!ar) return;
    ar.onInfoRequestsChange({ ...ar.infoRequests, [sectionId]: { note } });
  };

  const editDisabledHint = ar?.canEdit
    ? ''
    : 'View-only — supervising attorney can flag sections';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <ClipboardList size={16} className="text-amber-400" /> {title}
        </h3>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
            {ALL_ANSWERS_SCHEMA.length} filing documents
          </span>
          {totalBlanks > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
              {totalBlanks} unanswered
            </span>
          )}
          {ar && flaggedCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {flaggedCount} flagged
            </span>
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
        {subtitle ?? 'Every captured question with its recorded answer, grouped under the filing document the question feeds (Voluntary Petition, Schedule A/B, Schedule D–J, Form 122A Means Test, SOFA, Statement of Intention). Blank answers are flagged so missing required fields are visible at a glance.'}
      </p>

      <div className="space-y-4">
        {ALL_ANSWERS_SCHEMA.map(sec => {
          const flagged = !!ar && sec.id in ar.infoRequests;
          const note = ar ? (ar.infoRequests[sec.id]?.note ?? '') : '';
          return (
            <div key={sec.id} className={`rounded-xl border ${flagged ? 'border-rose-500/40 bg-rose-500/5' : 'border-slate-800 bg-slate-950/40'}`}>
              {/* Section header — the section TITLE is the filing document
                  this group of questions belongs to (Voluntary Petition,
                  Schedule A/B, SOFA, etc.). documentNote, when present,
                  describes what the document is for so the reviewing
                  attorney sees the questions sorted under their final home. */}
              <div className="px-4 py-2.5 border-b border-slate-800/60">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300">{sec.title}</span>
                  {flagged && (
                    <span className="text-[9px] font-bold uppercase tracking-widest text-rose-300 bg-rose-500/15 border border-rose-500/30 rounded px-1.5 py-0.5">
                      flagged
                    </span>
                  )}
                  {ar && (
                    <button
                      type="button"
                      disabled={!ar.canEdit}
                      onClick={() => toggleSectionFlag(sec.id)}
                      className={`ml-auto text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded border transition-colors ${
                        flagged
                          ? 'border-rose-500/40 text-rose-300 hover:bg-rose-500/10'
                          : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                      title={ar.canEdit ? (flagged ? 'Remove flag' : 'Request additional information for this section') : editDisabledHint}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Flag size={10} />
                        {flagged ? 'Remove flag' : 'Request additional information'}
                      </span>
                    </button>
                  )}
                </div>
                {sec.documentNote && (
                  <p className="text-[10px] text-slate-500 leading-snug mt-1">{sec.documentNote}</p>
                )}
              </div>

              {/* Per-section info-request note (attorney-review mode only) */}
              {ar && flagged && (
                <div className="px-4 pt-3">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-rose-300 mb-1 block">
                      What's needed from the client?
                    </span>
                    <textarea
                      value={note}
                      onChange={e => setSectionNote(sec.id, e.target.value)}
                      disabled={!ar.canEdit}
                      placeholder="e.g. Send the most recent pay stub; confirm whether the SBA loan is personally guaranteed; provide annuity purchase agreement"
                      rows={2}
                      className="w-full text-[11px] bg-slate-900/70 border border-slate-700 rounded px-2 py-1.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-rose-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </label>
                </div>
              )}

              {/* Section rows */}
              <div className="divide-y divide-slate-800/40">
                {sec.fields.map(f => {
                  // Per the firm's spec:
                  //   • QUESTION text is rendered in YELLOW (amber-300) so it
                  //     stands out as a prompt the staffer asked the client.
                  //   • ANSWER text is rendered WHITE + BOLD + slightly larger
                  //     so the recorded value reads clearly against the dark
                  //     background.
                  //   • Label chip (when the short field-label differs from
                  //     the spoken question) stays muted as a small caption.
                  const heading = f.question ?? f.label;
                  const showLabelChip = !!f.question && f.label !== f.question;

                  if (f.format === 'multi') {
                    const arr = ((fd as Record<string, unknown>)[f.key] as Array<Record<string, unknown>>) ?? null;
                    if (!Array.isArray(arr)) {
                      return (
                        <div key={f.key} className="px-4 py-2.5">
                          <p className="text-[12px] text-amber-300 font-medium leading-snug">{heading}</p>
                          {showLabelChip && <p className="text-[9px] uppercase tracking-widest text-slate-600 mt-0.5">{f.label}</p>}
                          <div className="mt-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                              unanswered
                            </span>
                          </div>
                        </div>
                      );
                    }
                    if (arr.length === 0) {
                      return (
                        <div key={f.key} className="px-4 py-2.5">
                          <p className="text-[12px] text-amber-300 font-medium leading-snug">{heading}</p>
                          {showLabelChip && <p className="text-[9px] uppercase tracking-widest text-slate-600 mt-0.5">{f.label}</p>}
                          <p className="text-[12px] text-white font-bold italic mt-1.5">None reported</p>
                        </div>
                      );
                    }
                    return (
                      <div key={f.key} className="px-4 py-2.5">
                        <p className="text-[12px] text-amber-300 font-medium leading-snug">
                          {heading} <span className="text-amber-300/70 font-normal">({arr.length})</span>
                        </p>
                        {showLabelChip && <p className="text-[9px] uppercase tracking-widest text-slate-600 mt-0.5 mb-1.5">{f.label}</p>}
                        <div className="space-y-1.5 mt-1.5">
                          {arr.map((item, i) => (
                            <div key={i} className="rounded bg-slate-900/40 border border-slate-800/60 p-2">
                              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                                {(f.itemFields ?? []).map(ifld => {
                                  const raw = item[ifld.key];
                                  const { text, isBlank } = renderAnswerValue(raw, ifld.format);
                                  return (
                                    <div key={ifld.key} className="flex items-center gap-2 text-[10.5px]">
                                      <span className="text-amber-300/85">{ifld.label}:</span>
                                      {isBlank ? (
                                        <span className="text-amber-300/80 italic">—</span>
                                      ) : (
                                        <span className="text-white font-bold">{text}</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  const raw = (fd as Record<string, unknown>)[f.key];
                  const { text, isBlank } = renderAnswerValue(raw, f.format);
                  return (
                    <div key={f.key} className="px-4 py-2.5">
                      <p className="text-[12px] text-amber-300 font-medium leading-snug">{heading}</p>
                      {showLabelChip && (
                        <p className="text-[9px] uppercase tracking-widest text-slate-600 mt-0.5">{f.label}</p>
                      )}
                      <div className="mt-1.5">
                        {isBlank ? (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                            unanswered
                          </span>
                        ) : (
                          <span className={`text-[13px] text-white font-bold ${f.format === 'multiline' ? 'whitespace-pre-line block' : ''}`}>
                            {text}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── ATTORNEY-REVIEW: Submit back to client (scaffold) ─────────────── */}
      {ar && (
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-2 mb-3">
            <Send size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-amber-200">Submit back to client</p>
              <p className="text-[11px] text-amber-200/70 leading-relaxed mt-0.5">
                Bundles the flagged sections + notes and (in the live build) sends the client a
                consolidated "we need a little more from you" request. Status moves to
                <code className="font-mono mx-1">info_requested</code>;
                the case stays in the intake queue pending the client's reply.
              </p>
            </div>
          </div>

          {flaggedCount === 0 ? (
            <p className="text-[11px] text-slate-500 italic">
              Flag at least one section above to enable submit-back.
            </p>
          ) : (
            <div className="space-y-2 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Bundle preview</p>
              <ul className="text-[11px] text-slate-200 space-y-1 list-disc pl-5">
                {flaggedSectionIds.map(sid => {
                  const sec = ALL_ANSWERS_SCHEMA.find(s => s.id === sid);
                  const n = ar.infoRequests[sid]?.note?.trim() ?? '';
                  return (
                    <li key={sid}>
                      <span className="font-semibold">{sec?.title ?? sid}</span>
                      {n
                        ? <> — <span className="text-slate-300">{n}</span></>
                        : <span className="italic text-amber-300/80"> — note pending</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => ar.onSubmit()}
              className={`text-[11px] font-semibold uppercase tracking-widest px-3 py-1.5 rounded border transition-colors ${
                canSubmit
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 hover:bg-amber-500/25'
                  : 'bg-slate-800/40 border-slate-700/40 text-slate-500 cursor-not-allowed'
              }`}
              title={
                !ar.canEdit
                  ? 'View-only — supervising attorney can submit'
                  : flaggedCount === 0
                    ? 'Flag at least one section first'
                    : 'Submit info request to client'
              }
            >
              {ar.submitState === 'sending' ? 'Queueing…'
                : ar.submitState === 'queued' ? 'Queued — client notified (scaffold)'
                : `Submit back to client (${flaggedCount} section${flaggedCount === 1 ? '' : 's'})`}
            </button>
            {ar.submitState === 'queued' && (
              <span className="text-[10px] text-amber-300/80 italic">
                Scaffold only — no real send. Live build wires Twilio + SendGrid; status → info_requested.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
