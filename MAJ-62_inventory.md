# MAJ-62 — V1 SaaS Questionnaire Audit

**Date:** 2026-05-27  
**Branch:** feature/maj-61-intake-portal-funding  
**Scope:** Field-level audit of all three questionnaire files against official bankruptcy schedules and the MAJ-61 intake pipeline.

---

## 1. Files Audited

| File | Role |
|------|------|
| `src/components/client-portal/FullBankruptcyQuestionnaire.tsx` | **Destination repo** — 15-step client questionnaire (V1 SaaS). This is the primary file. |
| `src/bankruptcy-information-and-document-questionnaire(1).jsx` | **Source repo** — schedule-by-schedule questionnaire with full `mapIntakeToRetention()` and CreditorCombobox. |
| `src/BankruptcyIntake.jsx` | **Destination repo** — 8-section intake form. Source of pre-fill data for both questionnaires. |

---

## 2. Official Bankruptcy Schedule Reference

| Form | Description | Chapter |
|------|-------------|---------|
| B101 | Voluntary Petition | Both |
| B106A/B | Schedule A/B — Property | Both |
| B106C | Schedule C — Exemptions | Both |
| B106D | Schedule D — Secured Creditors | Both |
| B106E/F | Schedule E/F — Unsecured Creditors | Both |
| B106G | Schedule G — Executory Contracts & Leases | Both |
| B106H | Schedule H — Co-Debtors | Both |
| B106I | Schedule I — Income | Both |
| B106J | Schedule J — Expenses | Both |
| B107 | Statement of Financial Affairs (SOFA) | Both |
| B108 | Statement of Intention | Ch.7 |
| B122A-1 | Means Test — Ch.7 | Ch.7 |
| B122C-1 | Means Test — Ch.13 | Ch.13 |
| B2030 | Disclosure of Attorney Compensation | Both |

---

## 3. FullBankruptcyQuestionnaire.tsx — Field Inventory

### Step 0: Disclosure (disclosure)
*(No data fields — consent/acknowledgment screen only)*

---

### Step 1: Personal Information (personal)
Maps to **B101 — Voluntary Petition** and parts of **Schedule I**.

| Field Key | Label | Type | Required | Pre-Filled from Intake | Notes |
|-----------|-------|------|----------|------------------------|-------|
| `first_name` | First Name | text | yes | yes | |
| `last_name` | Last Name | text | yes | yes | |
| `middle_name` | Middle Name | text | no | no | NOT pre-filled from intake |
| `suffix` | Suffix | select | no | no | NOT pre-filled from intake |
| `ssn` | Social Security Number | text/masked | yes | no | Never in intake — privacy |
| `dob` | Date of Birth | date | yes | no | Not in intake |
| `email` | Email | email | yes | yes | |
| `phone` | Phone | tel | yes | yes | |
| `marital_status` | Marital Status | select | yes | yes | |
| `filing_type` | Filing Type | radio | yes | yes | individual/joint |
| `spouse_first` | Spouse First Name | text | cond | yes | if joint |
| `spouse_last` | Spouse Last Name | text | cond | yes | if joint |
| `spouse_middle` | Spouse Middle Name | text | no | no | NOT pre-filled |
| `spouse_suffix` | Spouse Suffix | select | no | no | NOT pre-filled |
| `spouse_ssn` | Spouse SSN | text/masked | cond | no | Never in intake |
| `spouse_dob` | Spouse Date of Birth | date | cond | no | Not in intake |
| `addr1` | Street Address | text | yes | yes | maps from `street_address` |
| `city` | City | text | yes | yes | |
| `state` | State | select | yes | yes | |
| `zip` | ZIP Code | text | yes | yes | |
| `county` | County | text | yes | yes | |
| `address_years` | Time at Current Address | select | yes | yes | `2+ years` / `less than 2 years` |
| `prior_domicile_state` | Prior State | select | cond | yes | if < 2 yrs |
| `prior_addr1_street` | Prior Street | text | cond | no | NOT in intake — client re-entry |
| `prior_addr1_city` | Prior City | text | cond | no | NOT in intake |
| `prior_addr1_state` | Prior State | select | cond | yes | same as `prior_domicile_state` |
| `prior_addr1_from` | Prior Address From | text | cond | no | NOT in intake |
| `prior_addr1_to` | Prior Address To | text | cond | no | NOT in intake |
| `num_dependents` | Number of Dependents | number | yes | yes | |
| `dependents` | Dependents (array) | array | cond | yes (json) | name/age/relationship per dependent |
| `chapter` | Chapter | display | n/a | yes | set at intake/acceptance |
| `district` | Bankruptcy District | display | n/a | derived | inferred from state/county |
| `division` | Bankruptcy Division | display | n/a | derived | inferred from county |

**Missing from FullBankruptcyQuestionnaire.tsx personal step:**
- `ssn` / `spouse_ssn` — present in source repo questionnaire (B101 required), absent here
- `dob` / `spouse_dob` — present in source repo, absent here
- `middle_name` / `spouse_middle` — present in source repo, absent here
- Prior address date range (`from`/`to`) — present in source repo for 730-day domicile rule

---

### Step 2: Real Estate (real_estate)
Maps to **Schedule A/B Part 1** and **Schedule D** (mortgage).

| Field Key | Label | Type | Pre-Filled | Notes |
|-----------|-------|------|------------|-------|
| `owns_real_estate` | Do you own real estate? | yes/no | yes | |
| `properties[]` | Array of properties | array | yes (partial) | |
| `properties[].description` | Property Type/Description | text | partial | e.g. "Primary Residence" |
| `properties[].address` | Property Address | text | yes | from `real_prop_address` |
| `properties[].city` | City | text | no | NOT in intake |
| `properties[].state` | State | text | no | NOT in intake — prop state |
| `properties[].zip` | ZIP | text | no | NOT in intake |
| `properties[].value` | Current Market Value | amount | yes | from `real_prop_value` |
| `properties[].mortgage_balance` | Mortgage Balance | amount | yes | from `mortgage_balance` |
| `properties[].monthly_payment` | Monthly Payment | amount | partial | from `realPropMonthlyPayment` |
| `properties[].lender` | Lender Name | text | no | **NOT in intake** — Schedule D required |
| `properties[].interest_rate` | Interest Rate | text | no | NOT in intake |
| `properties[].is_current` | Payments Current? | select | no | NOT in intake |
| `properties[].arrears` | Amount Past Due | amount | no | NOT in intake |
| `properties[].account_last4` | Account Last 4 Digits | text | no | NOT in intake |
| `properties[].intent` | What do you want to do? | select | yes | keep/surrender/reaffirm |
| `properties[].ownership_type` | Ownership Type | select | yes | sole/joint/community |
| `has_hoa` | HOA? | yes/no | yes | |
| `hoa_name` | HOA Name | text | yes | |
| `hoa_monthly` | HOA Monthly Dues | amount | yes | |
| `hoa_is_current` | HOA Current? | yes/no | yes | |
| `hoa_past_due` | HOA Past Due Amount | amount | yes | |
| `has_investment_property` | Investment Property? | yes/no | yes | |
| `has_second_property` | Second Property? | yes/no | yes | |
| `second_*` | Second property fields | various | partial | same sub-fields as primary |
| `has_raw_land` | Timeshare/Raw Land? | yes/no | yes | |
| `liens[]` | Judgment Liens | array | yes | from `liens` json |

---

### Step 3: Vehicles (vehicles)
Maps to **Schedule A/B Part 2** and **Schedule D** (auto loans).

| Field Key | Label | Pre-Filled | Notes |
|-----------|-------|------------|-------|
| `has_vehicles` | Has Vehicles? | yes | |
| `vehicles[]` | Vehicle array | yes (json) | from `vehicles_json` |
| `vehicles[].type` | Vehicle Type | yes | Car/Truck/Motorcycle/Boat/etc. |
| `vehicles[].year` | Year | yes | |
| `vehicles[].make` | Make | yes | |
| `vehicles[].model` | Model | yes | |
| `vehicles[].value` | Market Value | yes | includes KBB/NADA lookup |
| `vehicles[].mileage` | Mileage | no | **NOT in intake** |
| `vehicles[].intent` | Keep/Surrender/Reaffirm | yes | |
| `vehicles[].has_loan` | Has Loan? | yes | |
| `vehicles[].lender` | Lender Name | no | **NOT in intake** — Schedule D required |
| `vehicles[].loan_balance` | Loan Balance | yes | |
| `vehicles[].monthly_payment` | Monthly Payment | yes | |
| `vehicles[].interest_rate` | Interest Rate | no | NOT in intake |
| `vehicles[].account_last4` | Account Last 4 | no | NOT in intake |
| `vehicles[].ownership_type` | Ownership Type | yes | |
| `vehicles[].valuation_status` | KBB/NADA Status | n/a | client-side only |

---

### Step 4: Bank Accounts (bank_accts)
Maps to **Schedule A/B Part 5**.

| Field Key | Label | Pre-Filled | Notes |
|-----------|-------|------------|-------|
| `has_bank_accounts` | Has Accounts? | partial | from `hasBankAccounts` |
| `accounts[]` | Account array | partial | from `bankAccounts` json |
| `accounts[].institution` | Bank Name | partial | from `bankName` |
| `accounts[].account_type` | Account Type | partial | checking/savings/etc. |
| `accounts[].balance` | Current Balance | yes | from `bank_balance` |
| `accounts[].last4` | Last 4 Digits | no | **NOT in intake** |
| `accounts[].plaid_linked` | Plaid Linked? | no | integration optional |
| `has_closed_accounts` | Closed Accounts (last year)? | no | **NOT in intake** — SOFA Part 4 |
| `closed_accounts[]` | Closed account array | no | NOT in intake — SOFA Part 4 |

---

### Step 5: Retirement Accounts (retirement)
Maps to **Schedule A/B Part 6**.

| Field Key | Label | Pre-Filled | Notes |
|-----------|-------|------------|-------|
| `has_retirement` | Has Retirement? | partial | from `hasRetirement` |
| `retirement_accounts[]` | Retirement array | partial | from `retirementAccounts` |
| `retirement_accounts[].account_type` | Type | partial | 401k/IRA/pension/etc. |
| `retirement_accounts[].institution` | Institution | partial | |
| `retirement_accounts[].balance` | Balance | partial | |
| `has_ss_income` | Social Security? | yes | from `dSsRetirement`/`dSsDisability` |
| `ss_monthly` | SS Monthly Amount | yes | |
| `has_pension` | Pension? | yes | from `dPension` |
| `pension_monthly` | Pension Monthly | yes | |
| `pension_source` | Pension Source | yes | from `dPensionSource` |
| `has_veterans` | VA Benefits? | yes | from `dVeterans` |
| `veterans_monthly` | VA Monthly | yes | |

---

### Step 6: Personal Property (personal_property)
Maps to **Schedule A/B Parts 3, 4, 7, 8, 9, 10**.

| Field Key | Label | Pre-Filled | Notes |
|-----------|-------|------------|-------|
| `has_household_goods` | Household Goods? | yes | from `hasHouseholdGoods` |
| `household_goods_value` | Household Goods Value | yes | |
| `electronics_value` | Electronics Value | partial | from `electronicsValue` |
| `tools_value` | Tools Value | partial | from `toolsValue` |
| `jewelry_value` | Jewelry Value | partial | from `jewelryValue` |
| `has_life_insurance` | Life Insurance? | yes | |
| `life_policy_type` | Policy Type | partial | whole/term/etc. |
| `life_face_value` | Face Value | no | NOT in intake |
| `life_cash_value` | Cash Value | partial | from `lifePolicies[]` |
| `life_beneficiary` | Beneficiary | no | NOT in intake |
| `has_stocks` | Stocks/Investments? | yes | |
| `stocks_value` | Value | yes | |
| `has_crypto` | Cryptocurrency? | yes | |
| `crypto_value` | Value | yes | |
| `has_firearms` | Firearms? | yes | |
| `firearms[]` | Firearm array | partial | description/serial/value |
| `has_collectibles` | Collectibles? | yes | |
| `collectibles_value` | Value | yes | |
| `has_other_prop` | Other Property? | partial | |
| `other_prop_value` | Value | partial | |
| `other_prop_desc` | Description | yes | from `otherPersonalPropDesc` |
| `has_annuities` | Annuities? | partial | from `hasAnnuities` |
| `annuities[]` | Annuity array | partial | |
| `has_pending_claims` | Pending Legal Claims? | partial | from `hasPendingClaims` |
| `pi_has_claim` | Personal Injury Claim? | yes | from `piHasClaim` |
| `pi_description` | PI Claim Description | yes | |
| `pi_status` | PI Status (pending/settled) | partial | |
| `pi_value` | Estimated PI Value | partial | from `pendingClaimsValue` |
| `pi_property_damage` | Property Damage? | yes | |
| `pi_has_attorney` | Has PI Attorney? | yes | |
| `expected_refund` | Expected Tax Refund? | yes | from `expectedRefund` |
| `refund_amount` | Refund Amount | yes | from `refundAmount` |

**NOT in FullBankruptcyQuestionnaire.tsx personal_property step:**
- Business assets (`hasBusinessAssets`, `businessAssets[]`) — present in intake, missing from questionnaire
- Money owed to debtor (`hasMoneyOwed`, `moneyOwedDesc`) — present in intake, missing from questionnaire
- SS back pay (`hasSsBackPay`, `ssBackPayAmount`) — present in intake, missing from questionnaire
- Pending SS claim (`hasSsClaim`) — present in intake, missing from questionnaire

---

### Step 7: Support & Claims (support)
*(Partially maps to Schedule A/B misc claims and SOFA Part 3)*

| Field Key | Label | Pre-Filled | Notes |
|-----------|-------|------------|-------|
| `child_support_current` | Paying Child Support? | no | **NOT in intake** |
| `child_support_monthly` | Monthly Amount | no | NOT in intake |
| `child_support_arrears` | In Arrears? | partial | from `childSupportArrears` |
| `child_support_arrears_amount` | Arrears Amount | partial | |
| `alimony_current` | Paying Alimony? | no | NOT in intake |
| `alimony_monthly` | Monthly Alimony | no | NOT in intake |
| `alimony_arrears` | Alimony Arrears? | partial | from `alimonyArrears` |
| `alimony_arrears_amount` | Arrears Amount | partial | |
| `pi_has_claim` | Personal Injury Claim? | yes | from `piHasClaim` |
| `pi_description` | Description | yes | |
| `pi_date_of_loss` | Date of Loss | yes | from `piDateOfLoss` |
| `pi_incident_location` | Incident Location | yes | from `piIncidentLocation` |
| `pi_was_injured` | Were You Injured? | yes | from `piWasInjured` |
| `pi_injury_description` | Injury Description | yes | |
| `pi_medical_treatment` | Received Treatment? | yes | |
| `pi_has_attorney` | Has PI Attorney? | yes | |
| `pi_attorney_name` | Attorney Name | yes | |
| `pi_property_damage` | Property Damage? | yes | |
| `pi_property_damage_desc` | Damage Description | yes | |
| `expected_refund` | Expected Tax Refund? | yes | |
| `refund_amount` | Refund Amount | yes | |

---

### Step 8: Secured Creditors (secured)
Maps to **Schedule D**.

| Field Key | Label | Pre-Filled | Notes |
|-----------|-------|------------|-------|
| `secured_creditors[]` | Secured creditor array | yes (partial) | synthesized from RE + vehicles |
| `secured_creditors[].creditor_name` | Lender Name | no | **NOT in intake** |
| `secured_creditors[].collateral` | Collateral | partial | address/vehicle from prior steps |
| `secured_creditors[].collateral_type` | Collateral Type | partial | real_estate/vehicle/other |
| `secured_creditors[].current_balance` | Balance Owed | yes | |
| `secured_creditors[].monthly_payment` | Monthly Payment | yes | |
| `secured_creditors[].is_current` | Payments Current? | no | NOT in intake |
| `secured_creditors[].arrears` | Arrears Amount | partial | from `mortgageArrears` |
| `secured_creditors[].account_last4` | Account Last 4 | no | **NOT in intake** — Schedule D required |

**Critical gap:** Lender names are not captured in intake for mortgages or auto loans. The ConfirmBanner on this step asks clients to fill them in, but there is no pre-fill path.

---

### Step 9: Unsecured Debts (unsecured)
Maps to **Schedule E/F**.

| Field Key | Label | Pre-Filled | Notes |
|-----------|-------|------------|-------|
| `credit_card_total` | Credit Card Total | yes | from `credit_card_debt` |
| `medical_total` | Medical Total | yes | from `medical_debt` |
| `personal_loan_total` | Personal Loan Total | yes | from `personal_loan_debt` |
| `student_loan_total` | Student Loan Total | yes | from `student_loan_debt` |
| `tax_debt_total` | Tax Debt Total | yes | from `tax_debt` |
| `judgment_total` | Judgment Total | partial | from `judgmentDebt` |
| `other_unsecured_total` | Other Unsecured Total | yes | from `other_unsecured` |
| `has_business_debt` | Business Debt? | partial | from `hasBusinessDebt` |
| `business_line_debt` | Business Line | partial | |
| `business_cc_debt` | Business Credit Cards | partial | |
| `business_other_debt` | Other Business Debt | partial | |
| `business_debt_desc` | Business Debt Description | partial | from `businessDebtDesc` |
| `creditors[]` | Individual creditor array | no | **NOT pre-filled** — client entry only |
| `creditors[].creditor_name` | Creditor Name | no | NOT in intake |
| `creditors[].debt_type` | Debt Type | no | NOT in intake |
| `creditors[].balance` | Balance | no | NOT in intake |
| `creditors[].account_last4` | Account Last 4 | no | NOT in intake |

**Gap:** Source repo has CreditorCombobox with `CommCred_complete.csv` for type-ahead creditor selection. FullBankruptcyQuestionnaire only has plain text input. No creditor address, city, state, ZIP — all required for Schedule E/F.  
**Gap:** Priority vs. non-priority distinction not captured. Tax debt, child support arrears, and alimony arrears are priority creditors (Schedule E) but stored in the same unsecured totals.

---

### Step 10: Income (income)
Maps to **Schedule I** and **Means Test (B122A-1 / B122C-1)**.

| Field Key | Label | Pre-Filled | Notes |
|-----------|-------|------------|-------|
| `employment_sources[]` | Employment array | yes | from `income_sources_json` |
| `employment_sources[].employer` | Employer Name | yes | |
| `employment_sources[].type` | Employment/Self-Employment | yes | |
| `employment_sources[].gross_monthly` | Gross Monthly | yes | converted from per-period |
| `employment_sources[].net_monthly` | Net Monthly | yes | |
| `rental_income` | Rental Income | partial | from `dRental` |
| `other_income` | Other Income | partial | from `dOtherIncome` |
| `other_income_desc` | Other Income Description | partial | from `dOtherIncomeDesc` |

**Missing from FullBankruptcyQuestionnaire.tsx income step (present in intake and/or Schedule I):**
- Pay frequency (weekly/bi-weekly/semi-monthly/monthly) — present in intake (`payFrequency`), NOT in questionnaire
- Bonus income (gross/net annually) — present in intake, NOT in questionnaire
- SS Retirement/Disability — present in intake (`dSsRetirement`, `dSsDisability`), shown in retirement step but NOT in income step
- Veterans benefits — same issue
- Unemployment benefits — in intake, NOT in income step
- Workers' compensation — in intake, NOT in income step
- Alimony/child support received — in intake (`dAlimony`, `dChildSupport`), NOT in income step
- Family support received — in intake, NOT in income step
- Spouse income sources — questionnaire income step only shows `employment_sources` array (not split debtor/spouse)
- Employer address, phone, EIN, start date, occupation — required by Schedule I, NOT in questionnaire or intake

---

### Step 11: Expenses (expenses)
Maps to **Schedule J**.

| Field Key | Label | Pre-Filled | Notes |
|-----------|-------|------------|-------|
| `rent_mortgage` | Rent/Mortgage | yes | from `exp_rent_mortgage` |
| `electric_gas` | Electric/Gas | yes | from `exp_utilities` (aggregated) |
| `water_sewer` | Water/Sewer | no | **NOT in intake** — separate from utilities |
| `phone` | Phone | no | **NOT in intake** |
| `internet` | Internet | no | NOT in intake |
| `food` | Food/Groceries | yes | from `exp_food` |
| `clothing` | Clothing | no | NOT in intake |
| `personal_care` | Personal Care | no | NOT in intake |
| `transportation` | Gas/Transportation | yes | from `exp_transportation` |
| `car_insurance` | Vehicle Insurance | no | NOT in intake |
| `health_insurance` | Health Insurance | yes | from `exp_insurance` (aggregated) |
| `medical` | Medical/Dental | yes | from `exp_healthcare` |
| `childcare` | Childcare/Education | yes | from `exp_childcare` |
| `other` | Other Monthly Expenses | yes | from `exp_other` |

**Missing from expenses step (present in intake):**
- Property tax — intake has `expPropTax`, NOT in questionnaire  
- HOA dues — intake has `expHoa`, NOT in questionnaire (though it's in RE step)  
- Lot/space rent — intake has `expLotSpaceRent`, NOT in questionnaire  
- Household supplies — intake has `expHouseholdSupplies`, NOT in questionnaire  
- Miscellaneous — intake has `expMisc`, NOT in questionnaire  
- Car maintenance — intake has `expCarMaintenance`, NOT in questionnaire  
- Public transit — intake has `expPublicTransit`, NOT in questionnaire  
- Life insurance — intake has `expInsLife`, NOT in questionnaire  
- Home insurance — intake has `expInsHome`, NOT in questionnaire  
- Disability insurance — intake has `expInsDisability`, NOT in questionnaire  
- Charitable contributions — intake has `expCharitable`, NOT in questionnaire  
- Recreation — intake has `expRecreation`, NOT in questionnaire  
- Home maintenance — intake has `expHomeMaintenance`, NOT in questionnaire  
- Alimony paid — intake has `expAlimonyPaid`, NOT in questionnaire  
- Support paid for others — intake has `expSupportOthers`, NOT in questionnaire  
- Government fines — intake has `expGovFines`, NOT in questionnaire  
- Additional taxes — intake has `expAddlTaxes`, NOT in questionnaire  

**Also missing (not in intake either, but Schedule J required):**  
- Mortgage insurance / PMI amount  
- Regular contributions to household expenses of non-filing spouse  
- IRS National Standard auto-fill (BankruptcyIntake has this; FullBankruptcyQuestionnaire does not)

---

### Step 12: Financial History (history)
Maps to **SOFA Parts 1–4**.

| Field Key | Label | Pre-Filled | Notes |
|-----------|-------|------------|-------|
| `filed_before` | Prior Bankruptcy? | yes | from `has_prior_bk` |
| `prior_bankruptcy_details` | Details | partial | from `prior_bankruptcies_json` |
| `has_lawsuits` | Pending Lawsuits? | yes | from `pending_lawsuits` |
| `lawsuit_details` | Details | yes | |
| `has_recent_transfers` | Property Transfers (2yr)? | yes | from `transferredProperty` |
| `transfer_details` | Details | partial | from `transfers_json` |
| `preferential_payments` | Pref. Payments (90d)? | yes | from `has_preferential_payments` |
| `preferential_payment_details` | Details | partial | from `preferential_payments_json` |
| `preferential_insider` | Insider Payments (1yr)? | partial | from `preferentialPaymentsInsider` |
| `preferential_insider_details` | Details | partial | |
| `recent_luxury` | Luxury/Cash Advance (90d)? | yes | from `recent_luxury` |
| `luxury_details` | Details | yes | |
| `has_garnishments` | Wage Garnishment? | yes | from `garnishment` |
| `garnishment_details` | Details | yes | from `garnishmentCreditor` + `garnishmentMonthlyAmount` |
| `foreclosure_pending` | Foreclosure Pending? | partial | from `foreclosurePending` |
| `foreclosure_date` | Foreclosure Date | yes | from `foreclosureDate` |
| `created_trust` | Created Trust (10yr)? | yes | from `createdTrust` |
| `trust_details` | Details | yes | from `trustDetails` |
| `owned_business` | Owned Business (4yr)? | yes | from `ownedBusiness` |
| `business_details` | Details | yes | from `businessDetails` |
| `dso_obligation` | DSO Obligation? | partial | from `dsoObligation` |
| `dso_amount` | DSO Monthly Amount | partial | from `dsoAmount` |
| `dso_recipient` | DSO Recipient Name | no | NOT in intake |

**Missing from history step (present in intake):**
- Per-bankruptcy structured data: chapter, year, disposition, case number, district — intake has `priorBankruptcies[]` array with all these; questionnaire has only free-text `prior_bankruptcy_details`
- Per-transfer structured data: intake has `transfers[]` array with description/recipient/amount/date/relationship/fairMarketValue/soldForLess; questionnaire has only free-text
- Per-preferential-payment structured data: intake has `preferentialEntries[]` array; questionnaire has only free-text
- Annual income history for SOFA Part 1 (current year + 2 prior years gross) — NOT in intake or questionnaire
- Closed financial accounts (SOFA Part 4) — NOT in questionnaire or intake
- Safe deposit boxes — NOT in questionnaire or intake

---

### Step 13: Document Checklist (documents)
*(Computed from prior steps — no data entry fields)*

Documents listed: mortgage statements, auto loan statements, other secured creditor statements, 6-month bank statements per account, closed account statements, retirement statements, SS/pension/VA award letters, always-required (2yr tax returns, 2 pay stubs per employer, credit counseling certificate, photo ID, SSN card).

---

### Step 14: Review (review)
*(Read-only summary — no data entry fields)*

---

## 4. Schedule G & H — Not Present in FullBankruptcyQuestionnaire.tsx

**Schedule G (Executory Contracts & Leases):** Completely absent from FullBankruptcyQuestionnaire.tsx. The source repo (`bankruptcy-information-and-document-questionnaire(1).jsx`) has a full `schedG` section. A debtor with a car lease or apartment lease has no way to disclose this.

**Schedule H (Co-Debtors):** Completely absent from FullBankruptcyQuestionnaire.tsx. The source repo has a `schedH` section. Creditors on Schedule D and E/F with co-signers cannot be identified without this step.

**Statement of Intention (B108):** The `intent` field on real estate and vehicles covers this partially, but there is no standalone Statement of Intention confirmation step.

---

## 5. Intake → Questionnaire Continuity Map

This table lists every field in `intake_submissions` and whether it flows cleanly into `FullBankruptcyQuestionnaire.tsx`.

| Intake Column | Questionnaire Field | Continuity |
|---------------|---------------------|------------|
| `filing_type` | `personal.filing_type` | Clean |
| `first_name` | `personal.first_name` | Clean |
| `last_name` | `personal.last_name` | Clean |
| `email` | `personal.email` | Clean |
| `phone` | `personal.phone` | Clean |
| `marital_status` | `personal.marital_status` | Clean |
| `spouse_first_name` | `personal.spouse_first` | Clean |
| `spouse_last_name` | `personal.spouse_last` | Clean |
| `street_address` | `personal.addr1` | Clean |
| `city` | `personal.city` | Clean |
| `state` | `personal.state` | Clean |
| `zip_code` | `personal.zip` | Clean |
| `county` | `personal.county` | Clean |
| `address_years` | `personal.address_years` | Clean |
| `prior_state` | `personal.prior_domicile_state` | Clean |
| `num_dependents` | `personal.num_dependents` | Clean |
| `dependents_json` | `personal.dependents[]` | Clean |
| `debtor_work_status` | `income.employment_sources[].type` | Partial — status mapped but detail split |
| `spouse_work_status` | `income.employment_sources[].type` | Partial |
| `income_sources_json` | `income.employment_sources[]` | Partial — gross_monthly/net_monthly clean; pay frequency dropped |
| `exp_rent_mortgage` | `expenses.rent_mortgage` | Clean |
| `exp_utilities` | `expenses.electric_gas` | **Lossy** — utilities bucket split into electric_gas but water/phone/internet lost |
| `exp_food` | `expenses.food` | Clean |
| `exp_transportation` | `expenses.transportation` | Clean |
| `exp_healthcare` | `expenses.medical` | Clean |
| `exp_insurance` | `expenses.health_insurance` | **Lossy** — insurance bucket; vehicle/home/life/disability dropped |
| `exp_childcare` | `expenses.childcare` | Clean |
| `exp_other` | `expenses.other` | Clean |
| `exp_prop_tax` | *(none)* | **Gap** — not in questionnaire |
| `exp_hoa` | *(none)* | **Gap** — not in questionnaire (HOA in RE step) |
| `exp_lot_space_rent` | *(none)* | **Gap** |
| `exp_electric_gas` | *(none)* | Note: DB stores both `exp_utilities` (aggregate) AND `exp_electric_gas` (line item) — only aggregate is mapped |
| `exp_water_sewer` | *(none)* | **Gap** |
| `exp_phone` | *(none)* | **Gap** |
| `exp_household_supplies` | *(none)* | **Gap** |
| `exp_clothing` | *(none)* | **Gap** |
| `exp_personal_care` | *(none)* | **Gap** |
| `exp_misc` | *(none)* | **Gap** |
| `exp_gas_fuel` | *(none)* | Note: mapped to `transportation` via `exp_transportation` |
| `exp_car_maintenance` | *(none)* | **Gap** |
| `exp_ins_vehicle` | *(none)* | **Gap** |
| `exp_ins_health` | *(none)* | Note: mapped via `exp_insurance` aggregate |
| `exp_ins_life` | *(none)* | **Gap** |
| `exp_ins_home` | *(none)* | **Gap** |
| `exp_ins_disability` | *(none)* | **Gap** |
| `exp_charitable` | *(none)* | **Gap** |
| `exp_recreation` | *(none)* | **Gap** |
| `exp_home_maintenance` | *(none)* | **Gap** |
| `exp_alimony_paid` | *(none)* | **Gap** |
| `exp_support_others` | *(none)* | **Gap** |
| `exp_gov_fines` | *(none)* | **Gap** |
| `exp_addl_taxes` | *(none)* | **Gap** |
| `owns_real_estate` | `real_estate.owns_real_estate` | Clean |
| `real_prop_address` | `real_estate.properties[0].address` | Clean |
| `real_prop_value` | `real_estate.properties[0].value` | Clean |
| `mortgage_balance` | `real_estate.properties[0].mortgage_balance` | Clean |
| `no_vehicles` | `vehicles.has_vehicles` | Clean (inverted) |
| `vehicles_json` | `vehicles.vehicles[]` | Clean |
| `bank_balance` | `bank_accts.accounts[].balance` | Partial — single balance, maps to first account only |
| `has_stocks` | `personal_property.has_stocks` | Clean |
| `stocks_value` | `personal_property.stocks_value` | Clean |
| `has_crypto` | `personal_property.has_crypto` | Clean |
| `crypto_value` | `personal_property.crypto_value` | Clean |
| `has_life_insurance` | `personal_property.has_life_insurance` | Clean |
| `has_firearms` | `personal_property.has_firearms` | Clean |
| `has_collectibles` | `personal_property.has_collectibles` | Clean |
| `collectibles_value` | `personal_property.collectibles_value` | Clean |
| `household_goods_value` | `personal_property.household_goods_value` | Clean |
| `other_property_desc` | `personal_property.other_prop_desc` | Clean |
| `secured_debt` | `unsecured.secured_*` | Note: `secured_debt` is a single total — mapped to RE/vehicle steps instead |
| `credit_card_debt` | `unsecured.credit_card_total` | Clean |
| `medical_debt` | `unsecured.medical_total` | Clean |
| `student_loan_debt` | `unsecured.student_loan_total` | Clean |
| `tax_debt` | `unsecured.tax_debt_total` | Clean |
| `personal_loan_debt` | `unsecured.personal_loan_total` | Clean |
| `other_unsecured` | `unsecured.other_unsecured_total` | Clean |
| `has_prior_bk` | `history.filed_before` | Clean |
| `prior_bankruptcies_json` | `history.prior_bankruptcy_details` | **Lossy** — structured array flattened to free text |
| `pending_lawsuits` | `history.has_lawsuits` | Clean |
| `lawsuit_details` | `history.lawsuit_details` | Clean |
| `garnishment` | `history.has_garnishments` | Clean |
| `has_transfers` | `history.has_recent_transfers` | Clean |
| `transfers_json` | `history.transfer_details` | **Lossy** — structured array flattened to free text |
| `has_preferential_payments` | `history.preferential_payments` | Clean |
| `preferential_payments_json` | `history.preferential_payment_details` | **Lossy** — structured array flattened to free text |
| `owned_business` | `history.owned_business` | Clean |
| `business_details` | `history.business_details` | Clean |
| `expected_refund` | `support.expected_refund` | Clean |
| `refund_amount` | `support.refund_amount` | Clean |
| `recent_luxury` | `history.recent_luxury` | Clean |
| `luxury_details` | `history.luxury_details` | Clean |

---

## 6. Gap List by Severity

### BLOCKING — Required by official schedules, completely missing

| # | Gap | Schedule | Notes |
|---|-----|----------|-------|
| B1 | **SSN (debtor and spouse)** | B101 | Never collected in questionnaire. Required for petition. |
| B2 | **Date of Birth (debtor and spouse)** | B101 | Not collected anywhere in questionnaire. |
| B3 | **Schedule G — Executory Contracts & Leases** | B106G | Entire section missing. Car leases, apartment leases, service contracts not disclosed. |
| B4 | **Schedule H — Co-Debtors** | B106H | Entire section missing. Co-signers on any debt not captured. |
| B5 | **Creditor addresses (Schedule E/F)** | B106E/F | Individual creditors in `unsecured.creditors[]` have no address fields. Court requires creditor name + mailing address for all Schedule E/F entries. |
| B6 | **Priority vs. non-priority creditor distinction** | B106E/F | Tax debt, DSO arrears, and other priority debts are stored in same totals as non-priority. Cannot generate Schedule E vs. Schedule F split. |
| B7 | **Annual gross income history (SOFA Part 1)** | B107 | Current year YTD + prior 2 years gross — not collected in intake or questionnaire. |
| B8 | **Means Test 6-month gross income** | B122A-1 / B122C-1 | Need 6-month average gross income per source broken down by month. BankruptcyIntake has a 6-month average field (`avgMonthly6`) but it is not mapped to questionnaire. |

---

### HIGH — Needed for clean Best Case import, unmapped or wrong

| # | Gap | Schedule | Notes |
|---|-----|----------|-------|
| H1 | **Lender names — mortgages** | B106D | Mortgage lender not in intake. Client must enter manually in questionnaire, but there is no pre-fill. |
| H2 | **Lender names — auto loans** | B106D | Same as H1 for vehicle loans. |
| H3 | **Account last 4 digits — secured creditors** | B106D | Required for Best Case import; not in intake. |
| H4 | **Account last 4 digits — bank accounts** | B106A/B | Required for Best Case import; not in intake. |
| H5 | **Employer address, phone, EIN, start date, occupation** | B106I | Schedule I requires full employer details. None collected in intake or questionnaire. |
| H6 | **Prior bankruptcy structured data** | B107 | Questionnaire uses free text. Best Case import needs: chapter, year, district, case number, disposition — all present in intake JSON but dropped to free text in questionnaire. |
| H7 | **Property transfer structured data** | B107 | Same as H6 — intake has structured array, questionnaire uses free text. |
| H8 | **Middle name / suffix (debtor and spouse)** | B101 | Source repo questionnaire captures these. Legal name on petition must match government ID. |
| H9 | **IRS National Standards in expenses step** | B122A-1 | BankruptcyIntake has full IRS standards with county-level housing/transport allocations and auto-fill. FullBankruptcyQuestionnaire expenses step has plain amount inputs with no standards guidance. |
| H10 | **Statement of Intention (B108)** | B108 | Intent field exists on vehicles/RE but no standalone B108 confirmation step with the required statutory declaration. |
| H11 | **Closed financial accounts (SOFA Part 4)** | B107 | Not in intake or questionnaire. Trustees look for this. |

---

### CONTINUITY — Intake field exists but will not flow into questionnaire (client re-entry required)

| # | Gap | Intake Field | Questionnaire Step |
|---|-----|-------------|-------------------|
| C1 | Water/sewer expense | `exp_water_sewer` | expenses — missing entirely |
| C2 | Phone expense | `exp_phone` | expenses — missing entirely |
| C3 | Household supplies expense | `exp_household_supplies` | expenses — missing entirely |
| C4 | Clothing expense | `exp_clothing` | expenses — missing entirely |
| C5 | Personal care expense | `exp_personal_care` | expenses — missing entirely |
| C6 | Car maintenance expense | `exp_car_maintenance` | expenses — missing entirely |
| C7 | Vehicle insurance expense | `exp_ins_vehicle` | expenses — missing entirely |
| C8 | Life insurance expense | `exp_ins_life` | expenses — missing entirely |
| C9 | Home insurance expense | `exp_ins_home` | expenses — missing entirely |
| C10 | Disability insurance expense | `exp_ins_disability` | expenses — missing entirely |
| C11 | Utilities aggregate split | `exp_utilities` → electric_gas | expenses — only electric_gas shown; water/phone/internet require re-entry |
| C12 | Insurance aggregate split | `exp_insurance` → health_insurance | expenses — only health shown; vehicle/life/home/disability require re-entry |
| C13 | Social Security income | `dSsRetirement`, `dSsDisability` | Only shown in retirement step, not income step |
| C14 | Veterans benefits | `dVeterans`, `dVeteransRetirement` | Only shown in retirement step, not income step |
| C15 | Unemployment / workers comp | `dUnemployment`, `dWorkersComp` | Not shown in any questionnaire step |
| C16 | Alimony/child support received | `dAlimony`, `dChildSupport` | Not shown in income step |
| C17 | Business assets | `businessAssets[]` | Not shown in any questionnaire step |
| C18 | Money owed to debtor | `hasMoneyOwed`, `moneyOwedDesc` | Not shown in any questionnaire step |
| C19 | SS back pay | `hasSsBackPay`, `ssBackPayAmount` | Not shown in any questionnaire step |
| C20 | Pay frequency | `payFrequency` | In income sources json but dropped in questionnaire income step |
| C21 | Annual bonus | `bonusGross`, `bonusNet` | In income sources json but dropped in questionnaire income step |
| C22 | Prior address dates | `priorAddr1From`, `priorAddr1To` | Collected in intake, not shown in questionnaire |
| C23 | Property tax expense | `expPropTax` | Not in questionnaire expenses step |
| C24 | Charitable contributions | `expCharitable` | Not in questionnaire expenses step |
| C25 | Alimony paid expense | `expAlimonyPaid` | Not in questionnaire expenses step |

---

### MINOR — Dead fields, redundant, or improvement opportunities

| # | Issue | Notes |
|---|-------|-------|
| M1 | `BankruptcyQuestionnaire.tsx` is a duplicate/older questionnaire | Two questionnaire files in destination repo. May cause confusion. One should be deprecated. |
| M2 | `personal.chapter` display in questionnaire shows `chapter_type` from intake_submissions | `chapter_type` was intended to be dropped per migration comment but still exists in DB. |
| M3 | `prior_addr1_state` and `prior_domicile_state` are effectively the same field | Questionnaire has both — they should be unified. |
| M4 | HOA monthly dues captured in both real_estate step and (previously) in intake expenses | Potential double-count. |
| M5 | `creditors[]` in unsecured step has no pre-fill path from credit report | Source repo has CreditorCombobox type-ahead; destination repo has plain text. |
| M6 | Questionnaire income step does not split debtor vs. spouse | Source repo has separate sections. For joint filers this conflates income. |
| M7 | `has_business_debt` in unsecured step pre-fills from intake but individual business creditors are not structured — no separate SBA, equipment loan, business credit card fields matching intake. | |

---

## 7. Summary Counts

| Severity | Count |
|----------|-------|
| Blocking | 8 |
| High | 11 |
| Continuity | 25 |
| Minor | 7 |
| **Total gaps** | **51** |

---

## 8. Recommended Fix Priority for Next Sprint (MAJ-63+)

1. **B1, B2, H8** — Add SSN, DOB, middle name/suffix to personal step. These are the most fundamental petition fields.
2. **B3, B4** — Add Schedule G and Schedule H steps to FullBankruptcyQuestionnaire.tsx (port from source repo).
3. **B5, B6** — Add creditor address fields to `unsecured.creditors[]` and add a priority/non-priority toggle (use CreditorCombobox from source repo).
4. **H1, H2, H3** — Add lender name and account last 4 to real estate and vehicle steps (and map back through intake if possible via a future intake field).
5. **C1-C12** — Expand expenses step to match all intake expense fields. This is pure UI work — the data already exists in `intake_submissions`.
6. **B7, B8** — Add SOFA annual income section and Means Test 6-month income calculation.
7. **H5** — Add employer details fields to income step (address, phone, EIN, start date, occupation).
8. **H6, H7** — Replace prior bankruptcy and transfer free-text fields with structured arrays matching the intake JSON format.
9. **H9** — Port IRS National Standards from BankruptcyIntake into the questionnaire expenses step.
10. **H11** — Add closed accounts section (SOFA Part 4).
