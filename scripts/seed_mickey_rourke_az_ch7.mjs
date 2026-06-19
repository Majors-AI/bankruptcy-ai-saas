// Seed Mickey Rourke — AZ Chapter 7 lead, mid-intake (client-prefilled).
//
// Lifecycle position: contact-request lead came in → client filled the
// questionnaire on their own via the client portal → submission is sitting
// in the intake-staff confirmation queue. Intake has NOT yet confirmed and
// the case has NOT yet been sent to attorney for review.
//
// State at end of seed:
//   intake_leads:
//     status              = 'intake_in_progress'   (mid-workflow)
//     client_prefilled    = true                   (client self-served)
//     intake_completed    = false                  (intake hasn't confirmed)
//     sent_for_review     = false                  (not sent to attorney)
//     sent_for_review_at  = null
//   intake_submissions:
//     status              = 'pending_review'
//     review_status       = 'submitted'            (in intake queue)
//     completed_by_staff  = false                  (client filled it)
//     lead_id             = <lead.id>              (linked back to lead)
//   intake_leads.submission_id is set to point at the submission
//   so traversal works in either direction.
//
// Next workflow steps (NOT applied here — leave for the test user to drive):
//   1. Intake staff opens the case, reviews, sets review_status='reviewed'
//      or 'approved' and flips intake_completed=true on the lead.
//   2. Intake clicks "Send for Attorney Review", which flips
//      sent_for_review=true and lead.status='sent_for_attorney_review',
//      and an attorney_intake_reviews row is created.
//
// Designed to stress-test the same AZ-specific paths as before:
//   - Above AZ 2-person median (~$7,036/mo) → debtor gross $11,500/mo
//   - § 707(b)(1) PRIMARILY BUSINESS DEBT bypass candidate
//     (SBA $500k / total $892k ≈ 56% → means-test presumption of abuse
//     mechanics do not apply)
//   - AZ homestead (A.R.S. § 33-1101) right at the $400,600 cap:
//     $700k value − $300k mortgage = $400k equity, owned 5 years
//     (1215-day federal § 522(p) cap not triggered)
//   - AZ annuity exemption (A.R.S. § 20-1131(D)) borderline:
//     2-year continuous ownership + spouse beneficiary
//   - Crypto ($35k) as headline non-exempt asset
//   - Schedule J net positive (~$2,400/mo surplus)
//   - Married non-joint (individual filing); spouse exists only as the
//     annuity beneficiary
//
// Idempotent: deletes any prior Mickey rows (submissions then leads) by
// email before inserting.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter(l => l.includes('='))
    .map(l => l.split('=', 2))
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const EMAIL = 'mickey.rourke@example.com';

// ─── form_data: the camelCase blob the new portal reads ──────────────────────

const form_data = {
  // identity / filing
  firstName: 'Mickey', lastName: 'Rourke',
  email: EMAIL, phone: '(602) 555-0188',
  filingType: 'individual', chapterType: 'chapter_7', maritalStatus: 'married',
  // Spouse exists (annuity beneficiary) but is not a co-debtor.
  spouseFirstName: 'Carre', spouseLastName: 'Otis',

  // residence — long-time AZ resident; clean 730-day window
  address: '7424 E Camelback Rd', city: 'Scottsdale', state: 'AZ',
  zip: '85251', county: 'Maricopa', addressYears: '5',
  priorDomicileState: 'AZ',

  // AZ homestead gate
  homeAcquiredDate: '2021-06-08',
  isOccupiedPrimary: 'yes',

  // household
  numDependents: '0',
  dependents: [],

  // income — ABOVE AZ 2-person median (~$7,036/mo)
  debtorWorkStatus: 'employed',
  spouseWorkStatus: 'not_employed',
  debtorEmployer: 'Mayo Clinic Arizona — Sports Medicine Consultant',
  debtorMonthlyGross: '11500',
  spouseMonthlyGross: '0',
  debtorSources: [
    {
      sourceType: 'employment',
      employerName: 'Mayo Clinic Arizona — Sports Medicine Consultant',
      payFrequency: 'Bi-Weekly',
      grossPerPeriod: '5307.69',
      netPerPeriod: '3784.62',
      receiveBonus: 'no',
    },
  ],
  spouseSources: [],

  dSsRetirement: '0', dSsDisability: '0', dVeterans: '0',

  // expenses (Schedule J) — moderate; deliberately yields positive net
  expRentMortgage: '2350',
  expUtilities: '380',
  expFood: '850',
  expTransportation: '520',
  expMedical: '410',
  expInsurance: '620',
  expChildcare: '0',
  expOther: '670',

  // real property — single primary residence; $400k equity, owned 5y
  ownsRealEstate: 'yes',
  realPropAddress: '7424 E Camelback Rd, Scottsdale, AZ 85251',
  realPropValue: '700000',
  mortgageBalance: '300000',
  mortgageLender: 'Desert Sun Mortgage Co.',
  mortgageArrears: '0',
  realPropMonthlyPayment: '2350',
  realPropIntent: 'keep',
  realPropType: 'Primary Residence',
  properties: [
    {
      address: '7424 E Camelback Rd, Scottsdale, AZ 85251',
      propType: 'Primary Residence',
      propertyValue: '700000',
      loanBalance: '300000',
      monthlyPayment: '2350',
      arrearsAmount: '0',
      lenderName: 'Desert Sun Mortgage Co.',
      intent: 'keep',
      interestRate: '5.875',
      acquiredDate: '2021-06-08',
      note: 'Owned 5y; $400k equity at AZ § 33-1101 cap ($400,600). Fully exempt; § 522(p) 1215-day federal cap not triggered.',
    },
  ],

  // no vehicles
  numVehicles: 0, noVehicles: true,
  vehicles: [],

  // personal property — crypto is the headline non-exempt asset
  bankBalance: '8500',
  retirementBalance: '125000',
  hasStocks: 'no', stocksValue: '0',
  hasCrypto: 'yes', cryptoValue: '35000',
  hasLifeInsurance: 'no', lifeInsuranceCashValue: '0',
  hasFirearms: 'no', firearmValue: '0',
  hasCollectibles: 'no', collectiblesValue: '0',
  householdGoodsValue: '14000',
  jewelryValue: '2500',
  toolsValue: '0',
  otherPersonalPropDesc: '',

  // ── Annuity (A.R.S. § 20-1131(D)) — 2y, spouse beneficiary ───────────
  hasAnnuities: 'yes',
  annuities: [
    {
      id: 1,
      annuityType: 'Fixed Annuity',
      issuerName: 'Pacific Life',
      currentValue: '80000',
      // Both yearsHeld (intake form) and yearsOwned (questionnaire normalized
      // alias) populated so either consumer reads the same value.
      yearsHeld: '2',
      yearsOwned: '2',
      beneficiary: 'Carre Otis (spouse)',
      purchaseDate: '2024-06-08',
      note: 'A.R.S. § 20-1131(D) — 2-year continuous-ownership requirement met as of filing; spouse-beneficiary requirement met. Borderline (exactly 2y).',
    },
  ],

  pendingClaims: [],
  pendingClaimsValue: '0',

  // ── Debts ──────────────────────────────────────────────────────────────
  // Consumer secured: mortgage $300k
  // Consumer unsecured: credit cards $92k
  // BUSINESS unsecured: SBA loan $500k (personal guarantee on closed LLC)
  //   business / total = $500k / $892k ≈ 56% → primarily business debt
  securedDebt: '300000',
  creditCardDebt: '92000',
  medicalDebt: '0',
  studentLoanDebt: '0',
  taxDebt: '0',
  // personalLoanDebt is the codebase's nearest bucket for SBA. See
  // businessDetails below for the narrative classification.
  personalLoanDebt: '500000',
  otherUnsecured: '0',

  // priority + DSO — none
  backTaxes: '0',
  priorityDebts: [],
  childSupport: '0',
  alimony: '0',
  dsoArrears: '0',
  dsoArrearsAmount: '0',

  // garnishment — none
  garnishment: 'no',

  // co-debtor — spouse on the joint mortgage
  coDebtors: [
    {
      name: 'Carre Otis (spouse)',
      relationship: 'spouse',
      debt: 'Joint mortgage on primary residence — $300,000 balance',
      creditor: 'Desert Sun Mortgage Co.',
    },
  ],

  pendingLawsuits: 'no',
  priorBankruptcy: 'no',

  transferredProperty: 'no',
  transfers: [],

  preferentialPayments: 'no',
  preferentialPaymentsInsider: 'no',
  preferentialEntries: [],
  preferentialInsiderEntries: [],

  // ── Business / SBA narrative ────────────────────────────────────────────
  ownedBusiness: 'yes',
  businessDetails: 'Rourke Boxing Academy LLC (Scottsdale, AZ) — debtor was sole member. Business closed Q3 2024 due to declining membership. SBA 7(a) loan ($500,000 principal) originated 2019; personally guaranteed; remains outstanding post-closure. No ongoing business income; debtor now W-2 consultant. Classification: business debt for § 707(b)(1) primarily-business-debt analysis.',

  recentLuxury: 'no',
  recentCashAdvance: 'no',
  expectedRefund: 'no',

  _source: 'client_self_serve_az_ch7',
};

// ─── Idempotency: clear any prior Mickey rows ─────────────────────────────────
// Submissions first (FK on lead_id), then leads.

const delSub = await sb.from('intake_submissions').delete().eq('email', EMAIL);
if (delSub.error) { console.error('delete submissions error:', delSub.error); process.exit(1); }

const delLead = await sb.from('intake_leads').delete().eq('email', EMAIL);
if (delLead.error) { console.error('delete leads error:', delLead.error); process.exit(1); }
console.log('[1/4] cleared prior Mickey Rourke rows (submissions + leads)');

// ─── Step 1: Create lead (contact request came in) ────────────────────────────
// status='intake_in_progress' — mid-workflow. client_prefilled=true reflects
// that the client filled the questionnaire on their own; intake hasn't yet
// confirmed (intake_completed=false) and the lead has not been sent to
// attorney (sent_for_review=false).

const leadRow = {
  full_name: 'Mickey Rourke',
  email: EMAIL,
  phone: '(602) 555-0188',
  state: 'AZ',
  status: 'intake_in_progress',
  chapter_interest: 7,
  debt_estimate: 892000.00,   // 300k mortgage + 92k cc + 500k SBA
  income_estimate: 11500.00,
  // Client filled the questionnaire on their own ahead of an intake call:
  client_prefilled: true,
  intake_completed: false,
  sent_for_review: false,
  sent_for_review_at: null,
  preferred_contact: 'email',
  urgency: 'normal',
  pre_screen_notes:
    'Inbound contact request via firm website. Client self-completed the full questionnaire ' +
    'through the client portal before any consult. Above-median AZ household by gross wages, ' +
    'but $500k SBA loan (closed LLC, personal guarantee) makes this a primarily-business-debt ' +
    'Ch.7 candidate — verify with client during intake confirmation. AZ homestead sits exactly ' +
    'at the $400,600 cap; annuity at the 2-year mark for A.R.S. § 20-1131(D); crypto $35k is ' +
    'the non-exempt headline. Needs intake review before attorney handoff.',
  source: 'inbound',
  assigned_name: null,
  // first_contact_at intentionally set ~2 days ago to make the lead look
  // realistic in queues that sort by recency.
  first_contact_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
};

const ins1 = await sb.from('intake_leads').insert(leadRow).select('id,full_name,status').single();
if (ins1.error) { console.error('insert lead error:', ins1.error); process.exit(1); }
const leadId = ins1.data.id;
console.log('[2/4] inserted intake_lead:', ins1.data);

// ─── Step 2: Create submission (self-completed questionnaire) ─────────────────
// review_status='submitted' = waiting in the intake-staff confirmation queue.
// completed_by_staff=false = client self-served (not filled by staff in a
// consult). status='pending_review' is the fixed canonical value.

const submissionRow = {
  lead_id: leadId,
  // §12 matter-spine interim convention: populate client_id with the
  // same value as lead_id so SigningReview's legacy client_id-based
  // reads work TODAY before §12 S1/S2 (lead_id columns on
  // signing_reviews / paralegal_reviews) lands. Once S1/S2 ship and
  // those tables read by lead_id directly, this dual-write goes away.
  client_id: leadId,
  filing_type: 'individual',
  chapter_type: 'chapter_7',
  first_name: 'Mickey', last_name: 'Rourke',
  email: EMAIL, phone: '(602) 555-0188',
  spouse_first_name: 'Carre', spouse_last_name: 'Otis',
  spouse_email: null, spouse_phone: null,
  street_address: '7424 E Camelback Rd',
  city: 'Scottsdale', state: 'AZ', zip_code: '85251', county: 'Maricopa',
  address_years: '5', prior_state: 'AZ', in_state_over_2_years: true,
  marital_status: 'married', num_dependents: 0,
  debtor_work_status: 'employed',
  debtor_employer: 'Mayo Clinic Arizona — Sports Medicine Consultant',
  debtor_gross_monthly: 11500.0, debtor_net_monthly: 8200.0,
  debtor_pay_frequency: 'Bi-Weekly',
  spouse_work_status: 'not_employed',
  spouse_employer: null,
  spouse_gross_monthly: 0.0,
  owns_real_estate: true,
  real_prop_address: '7424 E Camelback Rd, Scottsdale, AZ 85251',
  real_prop_value: 700000.0, mortgage_balance: 300000.0,
  mortgage_lender: 'Desert Sun Mortgage Co.',
  num_vehicles: 0, no_vehicles: true,
  bank_balance: 8500.0, retirement_balance: 125000.0,
  has_stocks: false, stocks_value: 0.0,
  has_crypto: true, crypto_value: 35000.0,
  has_life_insurance: false, life_insurance_cash_value: 0.0,
  has_firearms: false, firearm_value: 0.0,
  has_collectibles: false, collectibles_value: 0.0,
  household_goods_value: 14000.0,
  other_property_desc: 'Annuity (Pacific Life Fixed) $80,000 — see form_data.annuities; spouse beneficiary; 2y continuous ownership.',
  secured_debt: 300000.0, credit_card_debt: 92000.0,
  medical_debt: 0.0, student_loan_debt: 0.0,
  tax_debt: 0.0, personal_loan_debt: 500000.0, other_unsecured: 0.0,
  prior_bankruptcy: false, has_prior_bk: false,
  pending_lawsuits: false, garnishment: false,
  transferred_property: false, has_transfers: false,
  has_preferential_payments: false, owned_business: true,
  expected_refund: false, recent_luxury: false,
  exp_rent_mortgage: 2350.0, exp_utilities: 380.0,
  exp_food: 850.0, exp_transportation: 520.0,
  exp_healthcare: 410.0, exp_insurance: 620.0,
  exp_childcare: 0.0, exp_other: 670.0,
  reference_number: 'INT-MICKEY-ROURKE-AZ-CH7-2026',
  // Fixed canonical submission status — workflow state is on review_status.
  status: 'pending_review',
  // Intake-staff queue: 'submitted' = waiting for intake to start review.
  review_status: 'submitted',
  // Client filled it themselves via the client portal.
  completed_by_staff: false,
  submitted_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  form_data,
};

const ins2 = await sb.from('intake_submissions').insert(submissionRow).select('id,first_name,last_name,reference_number,status,review_status,completed_by_staff,lead_id').single();
if (ins2.error) { console.error('insert submission error:', ins2.error); process.exit(1); }
const submissionId = ins2.data.id;
console.log('[3/4] inserted intake_submission:', ins2.data);

// ─── Step 3: Link the lead back to the submission ────────────────────────────
// intake_leads.submission_id is a soft-link (no FK) used by surfaces that
// traverse from lead → submission directly.

const upd = await sb.from('intake_leads').update({ submission_id: submissionId }).eq('id', leadId).select('id,submission_id').single();
if (upd.error) { console.error('update lead.submission_id error:', upd.error); process.exit(1); }
console.log('[4/4] linked lead.submission_id:', upd.data);

console.log('\n✓ Mickey Rourke seeded.');
console.log('  Lead:        ', leadId, '(status=intake_in_progress, client_prefilled=true, sent_for_review=false)');
console.log('  Submission:  ', submissionId, '(review_status=submitted, completed_by_staff=false)');
console.log('  Position:    Awaiting intake-staff confirmation. Not yet sent to attorney.');
