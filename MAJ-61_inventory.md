# MAJ-61 — Cross-Repo Inventory & Migration Plan
**Date:** 2026-05-26  
**Source repo:** `C:\Users\CANELO\Documents\majorslawgroup-intake` (Majors Law — ideal version)  
**Destination repo:** `C:\Users\CANELO\Documents\bankruptcy-ai-saas` (V1 SaaS)  
**Status:** Read-only audit — no files modified.

---

## Section A — Intake Module

### A.1 Source: `BankruptcyIntake.jsx` (majorslawgroup-intake)

**Entry point:** `src/BankruptcyIntake.jsx` (~384 KB, ~5,050 lines)  
**Signature:** `export default function BankruptcyIntake({ clientId, clientName, clientEmail, clientPhone, staffMode } = {})`  
**All props optional** — renders standalone as `<BankruptcyIntake />`

#### Sections (verbatim constant)
```javascript
const SECTIONS = [
  "Filing Type",          // 0
  "Household",            // 1
  "Income",               // 2
  "Real Property",        // 3
  "Personal Property",    // 4
  "Expenses",             // 5
  "Debts",                // 6
  "Financial History",    // 7
  "Personal Injury Screening", // 8
  "Review & Submit"       // 9
];
```

#### Section 0 — Filing Type
| Field | Type | Options / Notes |
|---|---|---|
| `maritalStatus` | select | single, married, separated, divorced, widowed |
| `filingType` | select | individual, joint, individual-nonfiling-spouse |
| `firstName`, `lastName` | text | debtor |
| `email`, `phone` | text | debtor contact |
| `spouseFirstName`, `spouseLastName` | text | required if joint or NFS |
| `address`, `city`, `zip`, `state`, `county` | text | current address |
| `addressYears` | select | Less than 91 days / 91 days–6 months / 6 months–2 years / 2+ years |
| `priorDomicileState` | select | required if addressYears < 2 years |
| `priorAddr1Street`, `priorAddr1City`, `priorAddr1State`, `priorAddr1From`, `priorAddr1To` | text | prior domicile details |

**Validation:** `req(field, msg)` helper — blank check triggers per-field error message. Spouse fields gated on filingType. Prior domicile fields gated on addressYears < 2 years.

#### Section 1 — Household
| Field | Type | Notes |
|---|---|---|
| `numDependents` | select | "0"–"8+" |
| `dependents[]` | array | per-item: age (required), relationship (required), stillLivesHere, contributesFinancially, monthlyContribution |
| `householdSizeChanged` | bool | |
| `householdSizeChangeDetails` | text | |

**Validation:** For each dependent if numDependents > 0: age and relationship required.

#### Section 2 — Income
| Field | Type | Notes |
|---|---|---|
| `debtorWorkStatus` | select | employed, selfEmployed, both, unemployed, retired, other |
| `avgMonthly6` | number | 6-month gross average (overrides computed CMI in means test) |
| Per income source (employment) | | employerName, payFrequency, grossPerPeriod, netPerPeriod, bonusInfo |
| Per income source (self-employment) | | businessName, businessType, grossIncome, operatingExpenses |
| Spouse fields | | mirrored for spouse if joint or NFS |
| `dSsRetirement`, `dSsDisability`, `dVeterans` | number | CMI-excluded income (debtor) |
| `sSsRetirement`, `sSsDisability`, `sVeterans` | number | CMI-excluded income (spouse) |

#### Sections 3–8 — Real Property, Personal Property, Expenses, Debts, Financial History, PI Screening
- **Real Property:** ownsRealEstate, realProperties[] (address, type, value, mortgageBalance, lender, isCurrent)
- **Personal Property:** vehicles[], bankAccounts[], retirementAccounts[], jewelry, tools, householdGoods, lifeInsurance, stocks, crypto, firearms, collectibles
- **Expenses:** rent/mortgage, utilities, food, transportation, healthcare, insurance, childcare, other
- **Debts:** securedDebt, creditCardDebt, medicalDebt, studentLoanDebt, taxDebt, personalLoanDebt, otherUnsecured, primaryReason
- **Financial History:** priorBankruptcy, pendingLawsuits, garnishment, transfers[], preferentialPayments[], ownedBusiness, expectedRefund, recentLuxury
- **PI Screening (Section 8):** piDateOfLoss, piIncidentDescription, piIncidentLocation, piAtFaultName, piAtFaultPhone, piAtFaultInsurance, piOtherParties, piPoliceReport, piPoliceReportNumber, piPoliceDepartment, piWasInjured, piInjuryDescription, piMedicalTreatment, piMedicalProvider, piPropertyDamage, piPropertyDamageDesc, piAdditionalNotes

#### Submission — Supabase Tables Written On Submit
```javascript
// Primary
await supabase.from("intake_submissions").insert({
  reference_number: "BAI-" + Date.now().toString(36).toUpperCase(),
  form_data: data,           // entire form as JSONB blob
  status: "pending_review",
  client_id: clientId ?? null,
});

// Cascading updates
await supabase.from("clients").update({
  intake_id: submission.id,
  status: "intake_complete",
  last_activity: new Date().toISOString(),
  intake_completed_at: new Date().toISOString(),
}).eq("id", clientId);

await supabase.from("follow_up_sequences").upsert({
  client_id, client_name, client_email, client_phone,
  stage: "day2",
  next_follow_up_at: day2.toISOString(),
  opted_out: false,
  notes: "Auto-created on intake submission",
  updated_at: new Date().toISOString(),
}, { onConflict: "client_id" });

await supabase.from("intake_notifications").insert({
  client_id, client_name, client_email, client_phone,
  intake_id, reference_number,
  status: "pending_contact",
  notified_at: new Date().toISOString(),
});

// PI only — separate table
await supabase.from("pi_intake_submissions").insert({ ...allPiFields, status: "pending_review" });
```

---

### A.2 Destination: `ClientIntakeForm.tsx` (bankruptcy-ai-saas)

**Entry point:** `src/ClientIntakeForm.tsx`  
**Step array (STEPS constant):**
```
0. Residency    1. Identity    2. Household    3. Income
4. Expenses     5. Real Property    6. Personal Property
7. Debts    8. Financial History    9. Review & Submit
```

**No PI Screening section.**

#### Exemption State Calculation (11 U.S.C. § 522(b)(3)(A)) — verbatim
```typescript
function getExemptionWindow() {
  const today = new Date();
  const twoYearsAgo = new Date(today);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const twoAndHalfYearsAgo = new Date(twoYearsAgo);
  twoAndHalfYearsAgo.setMonth(twoAndHalfYearsAgo.getMonth() - 6);
  return { twoYearsAgo, twoAndHalfYearsAgo };
}

function computeMajorityState(priorResidences, windowStart, windowEnd) {
  // counts days per state in the 6-month lookback window (2.5yr–2yr before filing)
  // returns the state with the most days
}

function computeExemptionState(data) {
  if (data.inStateOver2Years === "yes")      → current state exemptions
  if (movedIn <= twoYearsAgo)               → current state exemptions
  else → majority state from priorResidences[] in window
}
```

#### Submission — Exact Column Names (80+ individual columns)
`intake_submissions` table — individual snake_case columns:
`filing_type`, `state`, `county`, `city`, `street_address`, `zip_code`, `in_state_over_2_years`, `moved_to_state_date`, `prior_residences_json`, `exemption_state`, `exemption_state_reason`, `first_name`, `middle_name`, `last_name`, `suffix`, `dob`, `ssn_last4`, `email`, `phone`, `alt_phone`, `spouse_first_name`, `spouse_last_name`, `spouse_dob`, `spouse_email`, `marital_status`, `num_dependents`, `dependents_json`, `income_sources_json`, `exp_rent_mortgage`, `exp_utilities`, `exp_food`, `exp_transportation`, `exp_healthcare`, `exp_insurance`, `exp_childcare`, `exp_other`, `owns_real_estate`, `real_properties_json`, `vehicles_json`, `no_vehicles`, `bank_balance`, `retirement_balance`, `has_stocks`, `stocks_value`, `has_crypto`, `crypto_value`, `has_life_insurance`, `life_insurance_cash_value`, `has_firearms`, `firearm_value`, `has_collectibles`, `collectibles_value`, `household_goods_value`, `other_property_desc`, `secured_debt`, `credit_card_debt`, `medical_debt`, `student_loan_debt`, `tax_debt`, `personal_loan_debt`, `other_unsecured`, `primary_reason`, `has_prior_bk`, `prior_bankruptcies_json`, `pending_lawsuits`, `lawsuit_details`, `garnishment`, `garnishment_details`, `has_transfers`, `transfers_json`, `has_preferential_payments`, `preferential_payments_json`, `owned_business`, `business_details`, `expected_refund`, `refund_amount`, `recent_luxury`, `luxury_details`, `status`, `submitted_at`

---

## Section B — Attorney Review Portal

**File:** `src/LegalAdminPortal.tsx` (bankruptcy-ai-saas, ~1,300+ lines)

### B.1 Tabs by Role

| Tab ID | Label | Roles |
|---|---|---|
| `leads` | Leads | legal_admin, attorney_super_admin, super_admin |
| `followup` | Follow-Up / Review Queue | all roles |
| `calendar` | Calendar | all roles |
| `availability` | Availability | legal_admin, attorney_super_admin, super_admin |
| `timeoff` | Time Off | legal_admin, attorney_super_admin, super_admin |
| `sick_admin` | Out-of-Office Admin | attorney_super_admin, super_admin only |

Default landing: attorneys → `followup`; legal admins → `leads`.

### B.2 Role Types and Gating
```typescript
type PortalRole = "legal_admin" | "attorney" | "attorney_super_admin" | "super_admin";

function isAttorney(role)        → role === "attorney" || role === "attorney_super_admin"
function isSuperAdminRole(role)  → role === "attorney_super_admin" || role === "super_admin"
function isLegalAdmin(role)      → role === "legal_admin"
```

Roles sourced from: `staff_members.intake_portal_role` via PIN login.

### B.3 Supabase Tables Read
| Table | Purpose |
|---|---|
| `leads` | All lead records, status, urgency, intake_completed flag |
| `contact_logs` | Per-lead contact history |
| `attorney_case_acceptances` | Attorney accept/decline decisions |
| `intake_reviews` | Ch.7/Ch.13 eligibility flags, disposable income analysis |
| `calendar_events` | Consultation scheduling |
| `staff_availability` | Weekly availability slots (StaffAvailability interface) |
| `time_off_requests` | Employee time off |
| `staff_members` | Role, PIN, name, title, is_active |

### B.4 Attorney Workflow (status machine)
```
New → Contacted → Consultation Scheduled → Consultation Complete
→ Intake Complete → Sent for Attorney Review
→ [Accepted | Declined | No Case]
→ If Accepted: Fee Quote → [Retained | Follow-Up]
```

### B.5 Data Displayed — Leads Tab Fields
`full_name`, `email`, `phone`, `source`, `chapter_interest`, `status`, `assigned_name`, `first_contact_at`, `last_contact_at`, `next_follow_up_at`, `consultation_date`, `retained_at`, `notes`, `urgency`, `preferred_contact`, `pre_screen_notes`, `ai_scheduled`, `intake_completed`, `sent_for_review`, `sent_for_review_at`, `client_prefilled`, `debt_estimate`, `income_estimate`, `state`, `submission_id`, `follow_up_queue`, `bot_followup_enabled`, `bot_followup_count`, `last_bot_followup_at`, `created_at`

---

## Section C — Funding Analysis Module

### C.1 Means Test — Source (`BankruptcyIntake.jsx`)

**Median income table (all 50 states + DC, updated November 1, 2025):**
```javascript
const MEDIAN_INCOME = {
  "Alabama":    { 1:62672,  2:75465,  3:90321,  4:104003, extra:11100 },
  "Alaska":     { 1:83617,  2:109882, 3:109882, 4:138492, extra:11100 },
  "Arizona":    { 1:72039,  2:86745,  3:102274, 4:118067, extra:11100 },
  "Arkansas":   { 1:56923,  2:71742,  3:80218,  4:94586,  extra:11100 },
  "California": { 1:77221,  2:100161, 3:113553, 4:135505, extra:11100 },
  // ... all 50 states + DC, all with extra: 11100 per person above 4
};
const MEDIAN_DATE = "November 1, 2025";

const getMedian = (state, hhSize) => {
  const t = MEDIAN_INCOME[state];
  if (!t) return null;
  return hhSize <= 4 ? (t[hhSize] || t[4]) : t[4] + (hhSize - 4) * t.extra;
};
```

**Current Monthly Income (CMI) formula:**
```javascript
// CMI excludes SS retirement, SS disability, veterans benefits per Form 122A-1
const cmiExcluded = (parseFloat(data.dSsRetirement)||0)
  + (parseFloat(data.dSsDisability)||0)
  + (parseFloat(data.dVeterans)||0)
  + (parseFloat(data.sSsRetirement)||0)
  + (parseFloat(data.sSsDisability)||0)
  + (parseFloat(data.sVeterans)||0);
const cmiMT = Math.max(0, totalIncome() - cmiExcluded);
// If staff entered a manual 6-month average, use that instead
const mtMonthly = data.avgMonthly6 ? parseFloat(data.avgMonthly6) : cmiMT;
const mtAnnual = mtMonthly * 12;
```

**Means test decision:**
```javascript
const hhSize = parseInt(data.numDependents||0) + (hasSpouse ? 2 : 1);
const median = getMedian(data.state, hhSize);
const passes = median !== null ? mtAnnual <= median : null;
const overMedian = passes === false;
// UI display:
// passes === true  → "Below Median — Presumptive Ch. 7 Qualification"
// passes === false → "Full Means Test Required"
```

**Disposable Monthly Income (DMI):**
```javascript
const ch7NetMonthlyIncome = () =>
  monthlyNetWages() + spouseMonthlyNetWages() +
  monthlyNetBusiness() + spouseMonthlyNetBusiness() +
  govOtherTotal();
const ch7DMI = ch7NetMonthlyIncome() - totalExpenses();
// Threshold: ch7DMI <= 300 → "Likely qualifies for Ch. 7"
//            ch7DMI >  300 → "High DMI — attorney will review"

// Ch.13 uses GROSS business income (per 11 U.S.C. § 1325(b))
const ch13NetMonthlyIncome = () =>
  monthlyNetWages() + spouseMonthlyNetWages() +
  monthlyBusinessGross() + spouseMonthlyBusinessGross() +
  govOtherTotal();
const ch13DMI = ch13NetMonthlyIncome() - totalExpenses();
```

**Note:** No explicit $130/$195 thresholds. Ch.7 threshold is $300 DMI absolute.

### C.2 Means Test — Destination (`LegalAdminPortal.tsx`)

```typescript
// Only Colorado seeded; 10th Circuit fallback for all other states
const CO_MEDIAN: Record<number, number> = {
  1:59_412, 2:79_300, 3:87_216, 4:93_864, 5:101_580, 6:109_296,
};
function stateMedian(state, houseSize) {
  if (state === "CO") return CO_MEDIAN[Math.min(houseSize, 6)] ?? CO_MEDIAN[6];
  const fallback = { 1:55_000, 2:72_000, 3:82_000, 4:92_000, 5:100_000, 6:108_000 };
  return fallback[Math.min(houseSize, 6)] ?? fallback[6];
}

function computeCMI(sub) {
  // Converts income sources to monthly using frequency multipliers:
  // weekly×4.333, bi-weekly×2.167, semi-monthly×2, monthly×1, annual÷12
  // Falls back to sub.debtor_gross_monthly if no income_sources_json
}

function computeHouseholdSize(sub) {
  const deps = Number(sub.num_dependents ?? 0);
  const isJoint = sub.filing_type === "joint";
  return 1 + (isJoint ? 1 : 0) + deps;
}

function computeTotalExpenses(sub) {
  return Number(sub.exp_rent_mortgage??0) + Number(sub.exp_utilities??0)
    + Number(sub.exp_food??0) + Number(sub.exp_transportation??0)
    + Number(sub.exp_healthcare??0) + Number(sub.exp_insurance??0)
    + Number(sub.exp_childcare??0) + Number(sub.exp_other??0);
}
```

**CONFLICT — see Section D.**

### C.3 Fee Schedule & Payment Plan Formula (Source: `CaseAcceptanceFlow.tsx`)

**Chapter-based max months:**
```javascript
function getMaxMonths(isBifurcated, chapter) {
  if (chapter === "13") return 6;
  if (isBifurcated) return 18;
  return 10;   // Ch.7 non-bifurcated
}
```

**Payment plan formula (verbatim):**
```javascript
function calcPaymentPlan(attorneyFee, isBifurcated, chapter, freq, months, downPayment=0) {
  const freqMap = { "Weekly":52, "Bi-Weekly":26, "Semi-Monthly":24, "Monthly":12 };
  const periodsPerYear = freqMap[freq] ?? 26;
  const periodsPerMonth = periodsPerYear / 12;
  const totalPeriods = Math.max(1, Math.round(months * periodsPerMonth));
  const balance = Math.max(0, attorneyFee - downPayment);
  const perPeriod = totalPeriods > 0 ? balance / totalPeriods : balance;
  const roundedPerPeriod = Math.ceil(perPeriod);  // always rounds UP
  const lastPayment = balance - roundedPerPeriod * (totalPeriods - 1);
  return { perPeriod: roundedPerPeriod, totalPeriods, lastPayment: Math.max(0, lastPayment), balance };
}
```

**Fees are passed as props** (not hardcoded in component):
- `attorney_fee`, `filing_fee`, `credit_counseling_fee`
- `totalDue = attorney_fee + filing_fee + credit_counseling_fee`

**21-step presentation flow:**
```
welcome → case_accepted → chapter_explained → what_was_reviewed
→ unexempt_assets → full_service → qualify_readiness
→ attorney_call → attorney_call_active → attorney_call_complete
→ fees_intro → fee_breakdown → payment_plan → bifurcated_explain
→ objections → timeline → next_steps → qualifying_close
→ welcome_call_pending → defer → done
```

**BoldSign integration:**
```javascript
// Triggered at welcome_call_pending step
POST /functions/v1/send-boldsign
{
  clientId, clientName, chapter, attorney_fee, filing_fee, credit_counseling_fee,
  is_bifurcated, down_payment, payment_plan_amount, payment_plan_total_periods,
  payment_plan_balance, last_payment_amount, payment_frequency, plan_months,
}
```

Tables written: `presentation_sessions`, `clients`, `case_acceptances`, `welcome_calls`

### C.4 Exemption Data (Source: `src/components/admin/exemptions.ts`)

**StateExemption interface:**
```typescript
interface StateExemption {
  state, code, useFederal, federalOption,
  homestead: number | 'unlimited',   // -1 = unlimited
  homesteadNote?,
  vehicle, wildcard, wildcardNote?,
  retirement, wages,
  bankAccount, bankAccountNote?,
  jewelry, tools, householdGoods, householdGoodsNote?,
  lifeInsurance, notes?,
  alternateSystem?, alternateSystemNote?,
}
```

**Sample verbatim data:**

| State | Homestead | Vehicle | Wildcard | Notes |
|---|---|---|---|---|
| AL | $16,450 | $3,000 | $0 | ERISA IRAs up to $1,512,350 |
| CA (704) | $349,402 | $3,625 | $0 | Homeowners; no doubling for joint |
| CA (703) | $0 | $3,625 | $34,000 | Non-homeowners; $1,550 + $32,450 unused homestead |
| FL | Unlimited | $1,000 | $4,000 (no homestead) | 1,215-day ownership req; head-of-household wages 100% |
| TX | Unlimited | $0 | $0 | $100K/$200K personal property pool |
| WA | County-based | $15,000 | $10,000 | 1,215-day ownership req; county amounts $199.5K–$940K |

---

## Section D — Cross-Reference: Conflicts Between Repos

### CONFLICT 1 — `intake_submissions` schema mismatch ⚠️ CRITICAL
- **Source** (`BankruptcyIntake.jsx`): Inserts 4 columns — `reference_number`, `form_data` (single JSONB blob), `status`, `client_id`
- **Destination** (`ClientIntakeForm.tsx`): Inserts 80+ individual snake_case columns (`first_name`, `last_name`, `filing_type`, `exp_rent_mortgage`, etc.)
- **Risk:** Both components target the same `intake_submissions` table. If both are active, reads by `LegalAdminPortal.tsx` expect the individual columns but source data only has `form_data`. Any query on `first_name` will return null for source submissions.
- **Resolution needed:** Either add individual columns to source insert, or build a migration view/trigger to flatten `form_data` into columns.

### CONFLICT 2 — Means test median income: 50 states vs CO-only ⚠️ HIGH
- **Source** (`BankruptcyIntake.jsx`): Full `MEDIAN_INCOME` table covering all 50 states + DC, updated November 1, 2025
- **Destination** (`LegalAdminPortal.tsx`): Only Colorado seeded; all other states fall back to 10th Circuit generic values (55K/72K/82K/92K/100K/108K)
- **Impact:** Clients in 49+ states get wrong means test result in the attorney portal

### CONFLICT 3 — CMI formula divergence ⚠️ HIGH
- **Source**: Uses `data.avgMonthly6` (staff-entered 6-month gross average) OR computed `totalIncome() - cmiExcluded`; SS/VA benefits explicitly excluded per Form 122A-1
- **Destination**: Converts `income_sources_json` array entries using frequency multipliers (weekly×4.333, etc.); no SS exclusion; falls back to `debtor_gross_monthly` legacy column
- **Impact:** Same client may produce different CMI values in each portal, creating attorney-facing discrepancies

### CONFLICT 4 — Exemption state determination method ⚠️ MEDIUM
- **Source** (`BankruptcyIntake.jsx`): Uses `addressYears` dropdown + `priorDomicileState` — simple prior-state lookup; no days-in-window calculation
- **Destination** (`ClientIntakeForm.tsx`): Full 11 U.S.C. § 522(b)(3)(A) implementation with `computeExemptionState()` — calculates majority days in 6-month window ending exactly 2 years before today using calendar arithmetic
- **Impact:** Clients near the 2-year boundary get different exemption state determinations depending on which form they use

### CONFLICT 5 — PI Screening: source only ⚠️ MEDIUM
- **Source** (`BankruptcyIntake.jsx`): Full Section 8 — Personal Injury Screening with 15+ PI fields, writes to `pi_intake_submissions`
- **Destination** (`ClientIntakeForm.tsx`): No PI screening section; no `pi_intake_submissions` writes
- **Impact:** PI cases from source repo are never surfaced in destination portal

### CONFLICT 6 — Section ordering and field organization ⚠️ MEDIUM
- **Source**: Filing Type → Household → Income → Real Property → Personal Property → Expenses → Debts → Financial History → PI Screening → Review
- **Destination**: Residency → Identity → Household → Income → Expenses → Real Property → Personal Property → Debts → Financial History → Review
- **Impact:** Prefill mapping (`buildPreFill()` in `FullBankruptcyQuestionnaire.tsx`) must account for different field paths when reading source vs destination submissions

### CONFLICT 7 — Exemption data: source only ⚠️ MEDIUM
- **Source** (`exemptions.ts`): All 50 states + DC with complete data; CA dual 703/704 system; WA county-level homestead; FL/TX unlimited homestead with ownership-day checks; wildcard, jewelry, tools, wages, retirement amounts verbatim
- **Destination**: No equivalent exemptions.ts file; `LegalAdminPortal.tsx` means test has no exemption lookup at all
- **Impact:** Attorney portal cannot display exemption analysis; clients cannot see which assets are protected

### CONFLICT 8 — NFS income treatment ⚠️ MEDIUM
- **Source** (`BankruptcyIntake.jsx`): `filingType === "individual-nonfiling-spouse"` triggers full spouse income collection; spouse income included in household budget and means test CMI but spouse is not a co-debtor
- **Destination** (`ClientIntakeForm.tsx`): `maritalStatus` is collected but no `individual-nonfiling-spouse` option in `filingType`; income_sources_json does not differentiate debtor vs NFS income for means test purposes
- **Impact:** NFS means test is legally required to include spouse income (11 U.S.C. § 101(10A)); destination is non-compliant for married individual filers

### CONFLICT 9 — Supabase client pattern ⚠️ LOW (RESOLVED)
- **Source**: All components import from `src/lib/supabase.ts`
- **Destination (original)**: Inline `createClient()` in individual files
- **Status:** RESOLVED — `src/lib/supabase.ts` was created in the destination repo during earlier migration work; all 8 copied source files resolve correctly

### CONFLICT 10 — Fee schedule location ⚠️ LOW
- **Source** (`CaseAcceptanceFlow.tsx`): Fees received as props; no hardcoded amounts in component
- **Destination** (`LegalAdminPortal.tsx`): Contains hardcoded fee schedule (Ch.7 Regular $1,500, Ch.7 Bifurcated $1,838, Ch.13 $4,000, Limited $750) used for display in lead cards
- **Impact:** If the fee schedule changes, it must be updated in both places

### CONFLICT 11 — CA exemption dual-system: no selector in destination ⚠️ LOW
- **Source** (`exemptions.ts`): CA has `alternateSystem` (703 vs 704) with logic to determine which applies based on real estate ownership
- **Destination**: No CA exemption system at all in the portal
- **Impact:** CA clients cannot see correct exemption amounts; attorney must compute manually

---

## Section E — Specific Logic Checklist

| Feature | Source (majorslawgroup-intake) | Destination (bankruptcy-ai-saas) | Gap |
|---|---|---|---|
| **Eligibility breakdown** | Full: below/above median → DMI → Ch.7/Ch.13 recommendation | Partial: CO median only, no SS exclusion, no DMI threshold | Significant gap — 49 states wrong |
| **Funding analysis** | `calcPaymentPlan()` with bifurcated/ch13 max months, ceil rounding, last-payment adjustment | `LegalAdminPortal.tsx` has hardcoded fee schedule for display only; no `calcPaymentPlan` equivalent | Missing full payment calculator in destination |
| **Issue flags** | `ch7DMI > 300` → "High DMI — attorney will review"; overMedian → "Full Means Test Required" | Attorney review queue exists; no automated DMI flags | Flags not automated in destination |
| **NFS logic** | Full: `individual-nonfiling-spouse` filingType; spouse income in CMI; NFS not a debtor | Missing: no NFS filingType option; no NFS income separation | Non-compliant for married individual filers |
| **Means test (Form 122A-1)** | All 50 states; SS/VA excluded; 6-month average; $300 DMI threshold | CO only; no exclusions; income sources converted by frequency | 49 states gap + formula divergence |
| **Exemption analyzer** | `exemptions.ts` — all 50 states + federal; CA dual system; WA county-level | None in portal | Missing entirely in destination |
| **Exemption state determination** | Simple: `addressYears` + `priorDomicileState` | Full 522(b)(3)(A) implementation with days-in-window | Methods diverge; destination is more legally correct |
| **Ch.13 plan simulator** | Ch.13 DMI uses gross business income per § 1325(b); 6-month max payment plan | Not implemented | Missing in destination |
| **Intake email parser** | Not found in either repo | Not found in either repo | Not implemented anywhere |
| **Escalation chain** | `intake_notifications` insert on submission → `follow_up_sequences` day2 stage | `leads` table with urgency flag; bot followup system | Different mechanisms; not unified |
| **Limited scope detection** | No `limited scope` filing type in `BankruptcyIntake.jsx` | Hardcoded "Limited $750" fee in portal display | No intake-level limited scope logic in either repo |
| **Attorney call script** | `CaseAcceptanceFlow.tsx` — 21-step presentation script; `attorney_call` step includes live call flow | `LegalAdminPortal.tsx` has "Follow-Up" tab with review queue; no scripted call flow | Destination has no call script |
| **Case classification** | `passes === true` → Ch.7; `overMedian` → full means test → Ch.13 likely; `ch7DMI` threshold | Attorney decides in review queue (intake_reviews table) | Manual in destination; automated in source |
| **PI Screening** | Full Section 8 with `pi_intake_submissions` table | Not implemented | Missing entirely in destination |
| **IRS Standards auto-population** | `src/data/irs_standards_az_wa_ca_(1).json` — AZ/WA/CA county-level data; Section 5 (Expenses) auto-fills from IRS allowances | Not implemented | Missing in destination |

---

## Section F — Migration Plan

### F.1 Chosen Approach

**Incremental lift-and-integrate.** Do not rewrite. Migrate source logic module by module into the destination repo's existing architecture. Destination's state-based routing (View union type + useState) stays in place. Source components already copied; remaining work is data layer unification and logic backfill.

### F.2 File Mapping

| Source file | Destination path | Status | Action needed |
|---|---|---|---|
| `src/BankruptcyIntake.jsx` | `src/BankruptcyIntake.jsx` | Copied | Wire `intake_submissions` schema — see Conflict 1 |
| `src/components/IntakeChatbot.tsx` | `src/components/IntakeChatbot.tsx` | Copied | Verify edge function `intake-ai-chat` is deployed |
| `src/components/IntakeAnswersSummary.tsx` | `src/components/IntakeAnswersSummary.tsx` | Copied | Verify reads from correct columns |
| `src/components/CaseAcceptanceFlow.tsx` | `src/components/CaseAcceptanceFlow.tsx` | Copied | Wire to `legal_admin` view; pass fee props |
| `src/components/ClientRegistration.tsx` | `src/components/ClientRegistration.tsx` | Copied | Distinct from root-level `ClientRegistration.tsx` |
| `src/components/ScheduleCall.tsx` | `src/components/ScheduleCall.tsx` | Copied | Verify edge function `send-confirmation` deployed |
| `src/components/client-portal/FullBankruptcyQuestionnaire.tsx` | `src/components/client-portal/FullBankruptcyQuestionnaire.tsx` | Copied | `buildPreFill()` must handle both schemas |
| `src/components/client-portal/BankruptcyQuestionnaire.tsx` | `src/components/client-portal/BankruptcyQuestionnaire.tsx` | Copied | Ready |
| `src/data/irs_standards_az_wa_ca_(1).json` | `src/data/irs_standards_az_wa_ca_(1).json` | Copied | AZ/WA/CA only; expand to all states |
| `src/components/admin/exemptions.ts` | `src/components/admin/exemptions.ts` | **NOT COPIED** | Copy and wire to attorney portal |
| `src/lib/supabase.ts` | `src/lib/supabase.ts` | Created | Done |

### F.3 Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `intake_submissions` dual schema — source writes JSONB blob; destination reads individual columns | CRITICAL | Add DB migration to either (a) add a `form_data` JSONB column to existing table + trigger to populate individual columns, OR (b) update `BankruptcyIntake.jsx` submission to write individual columns matching destination schema |
| Means test produces different results for same client in different portals | HIGH | Replace `LegalAdminPortal.tsx` `stateMedian()` with source's `MEDIAN_INCOME` table; update CMI formula to match source |
| NFS filingType missing in `ClientIntakeForm.tsx` — legally required for means test | HIGH | Add `individual-nonfiling-spouse` to destination intake form's filingType field |
| `BankruptcyIntake.jsx` is 384KB — Babel already de-optimizes it | MEDIUM | Consider splitting into section-level components; or accept as-is since dev server handles it |
| `FullBankruptcyQuestionnaire.tsx` `buildPreFill()` reads intake data — will break if schema doesn't match | MEDIUM | Update `buildPreFill()` to handle both `form_data.fieldName` (source schema) and `fieldName` (destination schema) via optional chaining |
| Edge functions (`intake-ai-chat`, `send-boldsign`, `send-confirmation`) must be deployed to the destination Supabase project | MEDIUM | Verify each function exists at `[SUPABASE_URL_REDACTED]/functions/v1/` |
| CA 703/704 dual exemption system has no UI selector in destination | LOW | Add `ownsRealEstate` branch to exemption display in attorney portal once `exemptions.ts` is wired in |
| `BankruptcyIntake.jsx` IRS standards file covers AZ/WA/CA only | LOW | Obtain full 50-state IRS standards JSON or implement API call to IRS data |

### F.4 Order of Operations

**Phase 1 — Schema unification (prerequisite for everything else)**
1. Add `form_data JSONB` column to `intake_submissions` table (Supabase migration)
2. OR update `BankruptcyIntake.jsx` insert to write individual columns (preferred — keeps read logic simple)
3. Update `IntakeAnswersSummary.tsx` to read from whichever unified schema is chosen
4. Verify `FullBankruptcyQuestionnaire.tsx` `buildPreFill()` works with unified schema

**Phase 2 — Means test parity**
5. Replace `LegalAdminPortal.tsx` `CO_MEDIAN` + generic fallback with the full `MEDIAN_INCOME` table from `BankruptcyIntake.jsx`
6. Update `computeCMI()` in `LegalAdminPortal.tsx` to exclude SS/VA benefits per Form 122A-1
7. Add `$300 DMI threshold` flag to attorney review queue display

**Phase 3 — NFS compliance**
8. Add `individual-nonfiling-spouse` filingType to `ClientIntakeForm.tsx` Step 0 (Residency/Filing Type)
9. Update income section to collect and label spouse income as NFS (not co-debtor)
10. Update `computeCMI()` in portal to include NFS spouse income

**Phase 4 — Exemption analyzer**
11. Copy `src/components/admin/exemptions.ts` from source to destination
12. Wire exemption lookup to attorney review card — display applying-state exemptions after intake submission
13. Add CA 703/704 selector based on `owns_real_estate` flag

**Phase 5 — PI Screening**
14. Add Section 8 (PI Screening) fields to `ClientIntakeForm.tsx` Step 9 or as a new step
15. Wire `pi_intake_submissions` insert on submission
16. Add PI flag/badge to leads table in `LegalAdminPortal.tsx`

**Phase 6 — CaseAcceptanceFlow integration**
17. Add a view/route in `App.tsx` to render `CaseAcceptanceFlow` from the attorney portal
18. Pass fees from lead record (or a fee configuration table) as props to `CaseAcceptanceFlow`
19. Resolve Conflict 10 — remove duplicate hardcoded fee schedule from `LegalAdminPortal.tsx`

**Phase 7 — IRS standards expansion**
20. Obtain or build full 50-state IRS standards JSON (currently AZ/WA/CA only)
21. Update Expenses section to auto-populate from IRS allowances for all states

---

*End of MAJ-61 inventory. All data gathered by read-only audit — no source files were modified.*
