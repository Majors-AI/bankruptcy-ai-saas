/*
  Exemption data for all 50 states + DC.

  DIRECTION REVERSAL — MAJ-61 Phase 4:
  The source repo (majorslawgroup-intake) used a simple `addressYears + priorDomicileState`
  dropdown approach to determine which state's exemptions apply. This is NOT legally sufficient
  at the 2-year boundary — 11 U.S.C. § 522(b)(3)(A) requires a precise day-count over the
  730-day window, with a fallback to the prior domicile state if the current state was not the
  domicile for the greater portion of that window.

  The destination repo's `computeExemptionState()` in ClientIntakeForm.tsx implements the full
  § 522(b)(3)(A) calculation and stores the result in `intake_submissions.exemption_state`.
  The destination implementation WINS — this module consumes that stored result; do not revert
  to the simpler dropdown approach.

  Lookup support: `getApplicableExemptions()` accepts either a 2-letter state code (e.g. "AZ")
  or a full state name (e.g. "Arizona") via the STATE_NAME_TO_CODE map below.
*/

export interface StateExemption {
  state: string;
  code: string;
  useFederal: boolean;
  federalOption: boolean;
  homestead: number | 'unlimited';
  homesteadNote?: string;
  vehicle: number;
  wildcard: number;
  wildcardNote?: string;
  retirement: string;
  wages: string;
  bankAccount: number;
  bankAccountNote?: string;
  jewelry: number;
  tools: number;
  householdGoods: number;
  householdGoodsNote?: string;
  lifeInsurance: string;
  notes?: string;
  alternateSystem?: StateExemption;
  alternateSystemNote?: string;
}

// Full state name → 2-letter code. Used to normalize intake_submissions.exemption_state
// and intake_submissions.state (which store full names) for STATE_EXEMPTIONS lookups.
export const STATE_NAME_TO_CODE: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'District of Columbia': 'DC', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI',
  'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME',
  'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
  'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE',
  'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM',
  'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX',
  'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
  'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  // common abbreviations already passed as codes
  'DC': 'DC',
};

export const STATE_EXEMPTIONS: Record<string, StateExemption> = {
  AL: { state: 'Alabama', code: 'AL', useFederal: false, federalOption: false, homestead: 16450, homesteadNote: 'Ala. Code §6-10-2', vehicle: 3000, wildcard: 0, retirement: 'Fully exempt - ERISA-qualified plans, IRAs up to $1,512,350', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 3450, tools: 3450, householdGoods: 3450, lifeInsurance: 'Exempt if beneficiary is spouse or child' },
  AK: { state: 'Alaska', code: 'AK', useFederal: false, federalOption: false, homestead: 72900, vehicle: 4050, wildcard: 1350, retirement: 'Fully exempt - ERISA-qualified plans', wages: 'Weekly net: Greater of $473 or 75%', bankAccount: 0, jewelry: 1620, tools: 4050, householdGoods: 4050, lifeInsurance: 'Proceeds exempt if beneficiary is dependent', notes: 'Alaska Stat. §09.38' },
  AZ: { state: 'Arizona', code: 'AZ', useFederal: false, federalOption: false, homestead: 437600, homesteadNote: 'A.R.S. §33-1101(A); married couples may double', vehicle: 16500, wildcard: 0, retirement: 'Fully exempt - ERISA plans, IRAs', wages: 'Greater of 75% disposable earnings or 30x federal minimum wage', bankAccount: 5600, bankAccountNote: 'A.R.S. §33-1126(A)(9)', jewelry: 2000, tools: 5000, householdGoods: 16500, lifeInsurance: 'Cash value $2,000; proceeds unlimited if beneficiary is dependent', notes: 'A.R.S. Title 33. Vehicle: $16,500 (§33-1125(8)); $27,500 if physically disabled. Household furnishings: $16,500 (§33-1123). Bank account: $5,600 (§33-1126(A)(9)).' },
  AR: { state: 'Arkansas', code: 'AR', useFederal: false, federalOption: false, homestead: 800, homesteadNote: 'Urban $2,500; Rural unlimited (80 acres). Ark. Const. Art. IX', vehicle: 1200, wildcard: 500, retirement: 'Fully exempt - ERISA-qualified plans, IRAs', wages: '60 days wages exempt; otherwise 75%', bankAccount: 0, jewelry: 0, tools: 750, householdGoods: 500, lifeInsurance: 'Proceeds exempt if beneficiary is dependent' },
  CA: {
    state: 'California', code: 'CA', useFederal: false, federalOption: false,
    homestead: 349402, homesteadNote: 'CCP §704.730 (System 704 — homeowners). Single/joint: same cap, no doubling.',
    vehicle: 3625, wildcard: 0,
    retirement: 'Fully exempt - ERISA plans, IRAs', wages: 'Greater of 75% or 40x state minimum wage weekly',
    bankAccount: 0, jewelry: 2175, tools: 10825, householdGoods: 10825,
    lifeInsurance: 'Unmatured policies with loan value $14,875',
    notes: 'System 704 applies when debtor owns real property. Homestead cap is NOT doubled for joint filers.',
    alternateSystem: {
      state: 'California', code: 'CA', useFederal: false, federalOption: false,
      homestead: 0, homesteadNote: 'No homestead — CCP §703.140 (System 703 applies when debtor does not own real property)',
      vehicle: 3625, wildcard: 34000, wildcardNote: 'CCP §703.140(b)(5) — $1,550 general wildcard + up to $32,450 unused homestead',
      retirement: 'Fully exempt - ERISA plans, IRAs', wages: 'Greater of 75% or 40x state minimum wage weekly',
      bankAccount: 0, jewelry: 2175, tools: 10825, householdGoods: 10825,
      lifeInsurance: 'Loan value $14,875',
      notes: 'System 703 (CCP §703.140) — used when debtor does not own real property. Large wildcard available.',
    },
    alternateSystemNote: 'System 703 (CCP §703.140) — debtor does not own real property; wildcard up to $34,000 available',
  },
  CO: { state: 'Colorado', code: 'CO', useFederal: false, federalOption: false, homestead: 350000, homesteadNote: 'C.R.S. §38-41-201; $700,000 if 60+ or disabled', vehicle: 15000, wildcard: 0, retirement: 'Fully exempt - ERISA plans, IRAs up to $1,512,350', wages: 'Greater of 75% or 60x federal minimum wage', bankAccount: 0, jewelry: 2000, tools: 60000, householdGoods: 6000, lifeInsurance: 'Loan value $200,000; proceeds exempt if dependent beneficiary' },
  CT: { state: 'Connecticut', code: 'CT', useFederal: false, federalOption: false, homestead: 250000, vehicle: 3500, wildcard: 1000, retirement: 'Fully exempt', wages: '75% of disposable earnings', bankAccount: 1000, jewelry: 4000, tools: 10000, householdGoods: 7500, lifeInsurance: 'Exempt' },
  DE: { state: 'Delaware', code: 'DE', useFederal: false, federalOption: false, homestead: 0, homesteadNote: 'No homestead exemption', vehicle: 15000, wildcard: 25000, wildcardNote: 'Del. Code tit. 10 §4914 — very generous wildcard', retirement: 'Fully exempt', wages: '85% of earned wages', bankAccount: 0, jewelry: 1000, tools: 15000, householdGoods: 25000, lifeInsurance: 'Exempt - group life' },
  FL: { state: 'Florida', code: 'FL', useFederal: false, federalOption: false, homestead: -1, homesteadNote: 'Unlimited homestead exemption - Fla. Const. Art. X §4. Only applies to property owned 1,215+ days before filing.', vehicle: 1000, wildcard: 4000, wildcardNote: 'F.S. §222.25 — $4,000 wildcard if no homestead claimed', retirement: 'Fully exempt - IRAs, 401k, pension plans', wages: '100% of earnings of head of household', bankAccount: 0, bankAccountNote: 'Head of household wages deposited into bank account are protected for 6 months', jewelry: 1000, tools: 1000, householdGoods: 1000, lifeInsurance: 'Cash value and proceeds fully exempt', notes: 'Florida residents who have not been domiciled in Florida for 730 days must use the federal exemptions or the state of prior domicile.' },
  GA: { state: 'Georgia', code: 'GA', useFederal: false, federalOption: false, homestead: 43000, homesteadNote: 'O.C.G.A. §44-13-100; double for married couples', vehicle: 5000, wildcard: 1200, wildcardNote: 'O.C.G.A. §44-13-100(a)(6)', retirement: 'Fully exempt - ERISA plans, IRAs', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 500, tools: 1500, householdGoods: 5000, lifeInsurance: 'Proceeds exempt if beneficiary is dependent' },
  HI: { state: 'Hawaii', code: 'HI', useFederal: false, federalOption: false, homestead: 50000, homesteadNote: 'HRS §651-92; $100,000 if 65+ or disabled', vehicle: 2575, wildcard: 1300, retirement: 'Fully exempt', wages: '95% if income below $300/month; otherwise standard 75%', bankAccount: 0, jewelry: 1000, tools: 3000, householdGoods: 3000, lifeInsurance: 'Group policy exempt' },
  ID: { state: 'Idaho', code: 'ID', useFederal: false, federalOption: false, homestead: 175000, vehicle: 10000, wildcard: 800, retirement: 'Fully exempt - ERISA plans, IRAs', wages: '75% of disposable earnings', bankAccount: 800, jewelry: 1500, tools: 7500, householdGoods: 8000, lifeInsurance: 'Loan value $25,000; proceeds unlimited' },
  IL: { state: 'Illinois', code: 'IL', useFederal: false, federalOption: false, homestead: 15000, homesteadNote: '735 ILCS 5/12-901; $30,000 for joint owners', vehicle: 2400, wildcard: 4000, wildcardNote: '735 ILCS 5/12-1001(b)', retirement: 'Fully exempt - ERISA plans, IRAs', wages: 'Greater of 85% net or 45x federal minimum wage', bankAccount: 0, jewelry: 2400, tools: 3000, householdGoods: 4000, lifeInsurance: 'Proceeds exempt for dependent beneficiary' },
  IN: { state: 'Indiana', code: 'IN', useFederal: false, federalOption: false, homestead: 22750, vehicle: 10250, wildcard: 10250, wildcardNote: 'Indiana has a general wildcard of $10,250', retirement: 'Fully exempt', wages: 'Greater of 75% or 30x federal minimum wage', bankAccount: 0, jewelry: 0, tools: 0, householdGoods: 0, lifeInsurance: 'Proceeds exempt for spouse/dependent beneficiary' },
  IA: { state: 'Iowa', code: 'IA', useFederal: false, federalOption: false, homestead: -1, homesteadNote: 'Unlimited homestead (up to 1/2 acre urban, 40 acres rural) - Iowa Code §561.2', vehicle: 7000, wildcard: 200, retirement: 'Fully exempt', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 2000, tools: 10000, householdGoods: 7000, lifeInsurance: 'Proceeds exempt - Iowa Code §627.6' },
  KS: { state: 'Kansas', code: 'KS', useFederal: false, federalOption: false, homestead: -1, homesteadNote: 'Unlimited homestead - K.S.A. §60-2301 (160 acres rural, 1 acre urban)', vehicle: 20000, wildcard: 0, retirement: 'Fully exempt - ERISA plans, IRAs', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 0, tools: 7500, householdGoods: 0, lifeInsurance: 'Loan value and proceeds exempt' },
  KY: { state: 'Kentucky', code: 'KY', useFederal: false, federalOption: false, homestead: 34180, vehicle: 3000, wildcard: 1075, retirement: 'Fully exempt - KRS §427.150', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 3225, tools: 3225, householdGoods: 3225, lifeInsurance: 'Exempt - group policy' },
  LA: { state: 'Louisiana', code: 'LA', useFederal: false, federalOption: false, homestead: 35000, homesteadNote: 'La. R.S. 20:1; $75,000 if married/elderly/disabled', vehicle: 7500, wildcard: 0, retirement: 'Fully exempt - ERISA plans', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 5000, tools: 7500, householdGoods: 7500, lifeInsurance: 'Proceeds exempt - beneficiary dependent' },
  ME: { state: 'Maine', code: 'ME', useFederal: false, federalOption: true, homestead: 90000, homesteadNote: '14 M.R.S.A. §4422; $180,000 if 60+ or disabled', vehicle: 7500, wildcard: 400, retirement: 'Fully exempt', wages: 'Greater of 75% or 30x federal minimum wage', bankAccount: 0, jewelry: 1325, tools: 5000, householdGoods: 5000, lifeInsurance: 'Loan value $4,000; group policy exempt' },
  MD: { state: 'Maryland', code: 'MD', useFederal: false, federalOption: false, homestead: 25150, vehicle: 6000, wildcard: 6000, retirement: 'Fully exempt - ERISA plans, IRAs', wages: 'Greater of 75% or 30x federal minimum wage', bankAccount: 0, jewelry: 5000, tools: 5000, householdGoods: 5000, lifeInsurance: 'Group policy proceeds exempt' },
  MA: { state: 'Massachusetts', code: 'MA', useFederal: false, federalOption: false, homestead: 1000000, homesteadNote: 'M.G.L. ch. 188 §1 — requires declaration for full exemption', vehicle: 7500, wildcard: 1000, retirement: 'Fully exempt', wages: 'Greater of 75% or $455/week', bankAccount: 2500, jewelry: 1675, tools: 5000, householdGoods: 3000, lifeInsurance: 'Loan value $4,000; proceeds exempt for dependent' },
  MI: { state: 'Michigan', code: 'MI', useFederal: false, federalOption: true, homestead: 44325, homesteadNote: 'M.C.L.A. §600.5451; $66,650 if 65+ or disabled', vehicle: 3725, wildcard: 0, retirement: 'Fully exempt', wages: '60% of disposable wages (head of household 70%)', bankAccount: 0, jewelry: 3725, tools: 3725, householdGoods: 3725, lifeInsurance: 'Proceeds exempt for spouse/child' },
  MN: { state: 'Minnesota', code: 'MN', useFederal: false, federalOption: false, homestead: 550000, homesteadNote: 'Minn. Stat. §510.02; $1,100,000 for agricultural', vehicle: 8000, wildcard: 13000, wildcardNote: 'Minn. Stat. §550.37(24) — $13,000 cash/wildcard', retirement: 'Fully exempt', wages: '75% of disposable earnings', bankAccount: 10, bankAccountNote: 'Minn. Stat. §550.37', jewelry: 2940, tools: 13000, householdGoods: 13000, lifeInsurance: 'Exempt - Minn. Stat. §61A.12' },
  MS: { state: 'Mississippi', code: 'MS', useFederal: false, federalOption: false, homestead: 200000, homesteadNote: 'Miss. Code §85-3-21; up to 160 acres', vehicle: 10000, wildcard: 10000, retirement: 'Fully exempt - ERISA plans, IRAs', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 0, tools: 10000, householdGoods: 10000, lifeInsurance: 'Proceeds exempt for dependent beneficiary' },
  MO: { state: 'Missouri', code: 'MO', useFederal: false, federalOption: false, homestead: 15000, homesteadNote: 'Mo. Rev. Stat. §513.475; $30,000 if 65+ or disabled', vehicle: 3000, wildcard: 600, retirement: 'Fully exempt - ERISA plans, IRAs', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 500, tools: 3000, householdGoods: 1000, lifeInsurance: 'Loan value $150,000 - Mo. Rev. Stat. §376.530' },
  MT: { state: 'Montana', code: 'MT', useFederal: false, federalOption: false, homestead: 350000, vehicle: 4500, wildcard: 800, retirement: 'Fully exempt', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 1000, tools: 4500, householdGoods: 4500, lifeInsurance: 'Exempt - Mont. Code §33-15-511' },
  NE: { state: 'Nebraska', code: 'NE', useFederal: false, federalOption: false, homestead: 100000, homesteadNote: 'Neb. Rev. Stat. §40-101; no cap for head of family', vehicle: 3475, wildcard: 2500, retirement: 'Fully exempt', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 2825, tools: 4350, householdGoods: 4350, lifeInsurance: 'Proceeds exempt for dependent beneficiary' },
  NV: { state: 'Nevada', code: 'NV', useFederal: false, federalOption: false, homestead: 605000, homesteadNote: 'NRS §21.090; must file homestead declaration', vehicle: 21825, wildcard: 10000, retirement: 'Fully exempt - NRS §21.090', wages: 'Greater of 75% or 50x federal minimum wage per week', bankAccount: 0, jewelry: 10000, tools: 10000, householdGoods: 12000, lifeInsurance: 'Proceeds exempt - NRS §21.090' },
  NH: { state: 'New Hampshire', code: 'NH', useFederal: false, federalOption: false, homestead: 120000, vehicle: 10000, wildcard: 1000, retirement: 'Fully exempt', wages: '50 times federal minimum wage weekly', bankAccount: 0, jewelry: 500, tools: 5000, householdGoods: 3500, lifeInsurance: 'Proceeds exempt for dependent beneficiary' },
  NJ: { state: 'New Jersey', code: 'NJ', useFederal: false, federalOption: false, homestead: 0, homesteadNote: 'No homestead exemption', vehicle: 1000, wildcard: 1000, retirement: 'Fully exempt - ERISA plans, IRAs', wages: '90% net wages if income ≤$7,500/year; otherwise 75%', bankAccount: 0, jewelry: 1000, tools: 1000, householdGoods: 1000, lifeInsurance: 'Loan value/proceeds exempt for spouse/child' },
  NM: { state: 'New Mexico', code: 'NM', useFederal: false, federalOption: false, homestead: 60000, vehicle: 4000, wildcard: 500, retirement: 'Fully exempt - ERISA plans, IRAs', wages: 'Greater of 75% or 40x minimum wage', bankAccount: 0, jewelry: 2500, tools: 3500, householdGoods: 5000, lifeInsurance: 'Exempt - NMSA §42-10-4' },
  NY: { state: 'New York', code: 'NY', useFederal: false, federalOption: false, homestead: 179975, homesteadNote: 'CPLR §5206; varies by county. NYC/Long Island up to $179,975', vehicle: 4825, wildcard: 1375, retirement: 'Fully exempt - ERISA plans, IRAs', wages: 'Greater of 90% or 30x minimum wage per week', bankAccount: 3600, bankAccountNote: 'Amount from Social Security is fully protected', jewelry: 1350, tools: 3600, householdGoods: 13500, lifeInsurance: 'Loan value $18,450; proceeds unlimited if beneficiary is dependent' },
  NC: { state: 'North Carolina', code: 'NC', useFederal: false, federalOption: true, homestead: 45000, homesteadNote: 'N.C.G.S. §1C-1601; $90,000 if 65+ and spouse deceased', vehicle: 3500, wildcard: 5000, wildcardNote: 'N.C.G.S. §1C-1601(a)(2) — unused homestead up to $5,000', retirement: 'Fully exempt - ERISA plans, IRAs', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 2000, tools: 2000, householdGoods: 5000, lifeInsurance: 'Loan value $10,000; proceeds exempt for dependent' },
  ND: { state: 'North Dakota', code: 'ND', useFederal: false, federalOption: false, homestead: 200000, vehicle: 10000, wildcard: 7500, retirement: 'Fully exempt - ERISA plans, IRAs', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 5000, tools: 10000, householdGoods: 10000, lifeInsurance: 'Proceeds exempt for dependent beneficiary' },
  OH: { state: 'Ohio', code: 'OH', useFederal: false, federalOption: false, homestead: 161375, vehicle: 4525, wildcard: 1350, wildcardNote: 'O.R.C. §2329.66 wildcard up to $1,350', retirement: 'Fully exempt - O.R.C. §2329.66', wages: 'Greater of 75% or 30x federal minimum wage', bankAccount: 0, jewelry: 1700, tools: 3225, householdGoods: 13400, lifeInsurance: 'Loan value $8,075; group policy exempt' },
  OK: { state: 'Oklahoma', code: 'OK', useFederal: false, federalOption: false, homestead: -1, homesteadNote: 'Unlimited homestead - 160 acres rural, 1 acre urban. Okla. Stat. tit. 31 §2', vehicle: 7500, wildcard: 0, retirement: 'Fully exempt - Okla. Stat. tit. 31 §1', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 0, tools: 10000, householdGoods: 5000, lifeInsurance: 'Proceeds exempt for surviving family' },
  OR: { state: 'Oregon', code: 'OR', useFederal: false, federalOption: false, homestead: 40000, homesteadNote: 'ORS §18.395; $50,000 for married couple', vehicle: 3000, wildcard: 400, retirement: 'Fully exempt - ERISA plans, IRAs', wages: 'Greater of 75% or 30x federal minimum wage', bankAccount: 400, jewelry: 1800, tools: 5000, householdGoods: 3000, lifeInsurance: 'Loan value $500 per person; group policy exempt' },
  PA: { state: 'Pennsylvania', code: 'PA', useFederal: false, federalOption: false, homestead: 0, homesteadNote: 'No homestead exemption', vehicle: 0, wildcard: 300, retirement: 'Fully exempt - ERISA plans, IRAs', wages: '100% of wages exempt from execution', bankAccount: 0, jewelry: 0, tools: 0, householdGoods: 0, lifeInsurance: 'Group policy exempt; annuities $100/month', notes: 'Pennsylvania has very limited exemptions. Most debtors rely on the federal exemptions via federal opt-in allowance... but PA does not allow federal exemptions. Key exemptions: clothing, Bibles, retirement accounts.' },
  RI: { state: 'Rhode Island', code: 'RI', useFederal: false, federalOption: false, homestead: 500000, vehicle: 12350, wildcard: 8975, retirement: 'Fully exempt', wages: 'Greater of 50x minimum wage or 75%', bankAccount: 0, jewelry: 1000, tools: 1500, householdGoods: 8975, lifeInsurance: 'Proceeds exempt for family member beneficiary' },
  SC: { state: 'South Carolina', code: 'SC', useFederal: false, federalOption: false, homestead: 67200, homesteadNote: 'S.C. Code §15-41-30; $134,400 for married', vehicle: 7150, wildcard: 11775, retirement: 'Fully exempt', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 1000, tools: 4250, householdGoods: 6700, lifeInsurance: 'Loan value $4,000; proceeds exempt for dependent' },
  SD: { state: 'South Dakota', code: 'SD', useFederal: false, federalOption: false, homestead: -1, homesteadNote: 'Unlimited homestead (1 acre urban, 160 acres rural) - SDCL §43-31-1', vehicle: 8000, wildcard: 7000, retirement: 'Fully exempt - SDCL §43-45', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 0, tools: 0, householdGoods: 7000, lifeInsurance: 'Proceeds exempt for surviving family' },
  TN: { state: 'Tennessee', code: 'TN', useFederal: false, federalOption: false, homestead: 25000, homesteadNote: 'T.C.A. §26-2-301; $50,000 for married/elderly', vehicle: 5000, wildcard: 10000, retirement: 'Fully exempt - ERISA plans, IRAs', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 1000, tools: 1900, householdGoods: 10000, lifeInsurance: 'Loan value $5,000; proceeds exempt for dependent' },
  TX: { state: 'Texas', code: 'TX', useFederal: false, federalOption: false, homestead: -1, homesteadNote: 'Unlimited homestead (10 acres urban, 200 acres rural) - Tex. Prop. Code §41.001', vehicle: 0, wildcard: 0, retirement: 'Fully exempt - Tex. Prop. Code §42.0021', wages: 'Current wages 100% exempt', bankAccount: 0, jewelry: 0, tools: 0, householdGoods: 0, lifeInsurance: 'Loan value/proceeds exempt', notes: 'Texas has a personal property exemption of $100,000 per single person or $200,000 per married couple covering vehicles, household goods, tools, jewelry, firearms, and sporting equipment combined.' },
  UT: { state: 'Utah', code: 'UT', useFederal: false, federalOption: false, homestead: 60800, homesteadNote: 'Utah Code §78B-5-503', vehicle: 3940, wildcard: 0, retirement: 'Fully exempt - Utah Code §78B-5-505', wages: 'Greater of 75% or 30x federal minimum wage', bankAccount: 0, jewelry: 1000, tools: 5000, householdGoods: 1000, lifeInsurance: 'Proceeds exempt for spouse/dependent' },
  VT: { state: 'Vermont', code: 'VT', useFederal: false, federalOption: true, homestead: 150000, vehicle: 4000, wildcard: 400, retirement: 'Fully exempt', wages: '75% of disposable earnings', bankAccount: 700, jewelry: 500, tools: 5000, householdGoods: 2500, lifeInsurance: 'Proceeds exempt for dependent beneficiary' },
  VA: { state: 'Virginia', code: 'VA', useFederal: false, federalOption: false, homestead: 25000, homesteadNote: 'Va. Code §34-4; $50,000 if 65+ or disabled', vehicle: 6000, wildcard: 5000, retirement: 'Fully exempt - Va. Code §34-34', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 2000, tools: 10000, householdGoods: 10000, lifeInsurance: 'Cash value/proceeds exempt for spouse/child' },
  WA: { state: 'Washington', code: 'WA', useFederal: false, federalOption: false, homestead: 0, homesteadNote: 'RCW §§6.13.010–6.13.030 — county-based homestead. Debtor must have owned home 1,215+ days before filing. See WA_COUNTY_HOMESTEAD_2026 for amounts by county ($199,500–$940,000).', vehicle: 15000, wildcard: 10000, wildcardNote: 'RCW §6.15.010(1)(d)(ii) — other personal property; $20,000 joint', retirement: 'Fully exempt - RCW §6.15.020', wages: 'Greater of 75% or 40x minimum wage', bankAccount: 0, jewelry: 3500, tools: 15000, householdGoods: 6500, lifeInsurance: 'Proceeds exempt for dependent beneficiary', notes: 'Homestead is county-based and requires 1,215 days of ownership before filing. Vehicle: $15,000 individual / $30,000 joint (§6.15.010(1)(d)(iv)). Wearing apparel/jewelry: $3,500 individual / $7,000 joint (§6.15.010(1)(a)). Household goods: $6,500 individual / $13,000 joint (§6.15.010(1)(d)(i)). Tools: $15,000 individual / $30,000 joint (§6.15.010(1)(e)).' },
  WV: { state: 'West Virginia', code: 'WV', useFederal: false, federalOption: false, homestead: 35000, vehicle: 5000, wildcard: 1000, retirement: 'Fully exempt - W. Va. Code §38-10-4', wages: '80% of disposable earnings', bankAccount: 0, jewelry: 1000, tools: 2500, householdGoods: 8000, lifeInsurance: 'Loan value $4,000; proceeds exempt for dependent' },
  WI: { state: 'Wisconsin', code: 'WI', useFederal: false, federalOption: true, homestead: 75000, homesteadNote: 'Wis. Stat. §815.20', vehicle: 4000, wildcard: 5000, retirement: 'Fully exempt - Wis. Stat. §815.18', wages: 'Greater of 75% or 30x minimum wage', bankAccount: 0, jewelry: 0, tools: 5000, householdGoods: 12000, lifeInsurance: 'Loan value $4,000; proceeds unlimited if beneficiary is dependent' },
  WY: { state: 'Wyoming', code: 'WY', useFederal: false, federalOption: false, homestead: 20000, vehicle: 5000, wildcard: 0, retirement: 'Fully exempt - Wyo. Stat. §1-20-110', wages: '75% of disposable earnings', bankAccount: 0, jewelry: 1000, tools: 3000, householdGoods: 4000, lifeInsurance: 'Loan value $4,000; proceeds exempt for dependent' },
  DC: { state: 'District of Columbia', code: 'DC', useFederal: false, federalOption: false, homestead: 0, homesteadNote: 'No separate DC homestead — use federal exemptions', vehicle: 2575, wildcard: 0, retirement: 'Fully exempt', wages: 'Greater of 75% or 30x federal minimum wage', bankAccount: 0, jewelry: 0, tools: 0, householdGoods: 0, lifeInsurance: 'Group policy exempt', notes: 'DC does not have its own comprehensive exemption scheme; most DC debtors use the federal exemptions under 11 U.S.C. §522(d).' },
};

export const FEDERAL_EXEMPTIONS: StateExemption = {
  state: 'Federal',
  code: 'FED',
  useFederal: true,
  federalOption: true,
  homestead: 29275,
  homesteadNote: '11 U.S.C. §522(d)(1)',
  vehicle: 5350,
  wildcard: 1475,
  wildcardNote: '$1,475 + unused homestead (up to $13,950)',
  retirement: 'Fully exempt - 11 U.S.C. §522(d)(10)(E); IRAs up to $1,512,350',
  wages: 'No specific federal exemption; state law applies',
  bankAccount: 0,
  jewelry: 2075,
  tools: 2800,
  householdGoods: 700,
  householdGoodsNote: '$700 per item, total $14,875',
  lifeInsurance: 'Loan value $15,000; accrued payments exempt',
};

export const CA_COUNTY_HOMESTEAD_2026: Record<string, number> = {
  'Alameda': 743459, 'Alpine': 371547, 'Amador': 470000, 'Butte': 437500,
  'Calaveras': 456000, 'Colusa': 371547, 'Contra Costa': 743459, 'Del Norte': 397500,
  'El Dorado': 690000, 'Fresno': 436090, 'Glenn': 371547, 'Humboldt': 410000,
  'Imperial': 432500, 'Inyo': 371547, 'Kern': 395000, 'Kings': 371547,
  'Lake': 371547, 'Lassen': 371547, 'Los Angeles': 743459, 'Madera': 427500,
  'Marin': 743459, 'Mariposa': 399900, 'Mendocino': 499000, 'Merced': 440000,
  'Modoc': 371547, 'Mono': 743459, 'Monterey': 743459, 'Napa': 743459,
  'Nevada': 544000, 'Orange': 743459, 'Placer': 665000, 'Plumas': 415000,
  'Riverside': 629950, 'Sacramento': 535000, 'San Benito': 732500, 'San Bernardino': 497160,
  'San Diego': 743459, 'San Francisco': 743459, 'San Joaquin': 550000, 'San Luis Obispo': 743459,
  'San Mateo': 743459, 'Santa Barbara': 743459, 'Santa Clara': 743459, 'Santa Cruz': 743459,
  'Shasta': 380000, 'Sierra': 371547, 'Siskiyou': 371547, 'Solano': 580000,
  'Sonoma': 743459, 'Stanislaus': 465000, 'Sutter': 440000, 'Tehama': 371547,
  'Trinity': 371547, 'Tulare': 372950, 'Tuolumne': 392500, 'Ventura': 743459,
  'Yolo': 650000, 'Yuba': 450000,
};

export function getCaHomesteadByCounty(county: string): number {
  const normalized = county.trim().replace(/\s+county$/i, '');
  return CA_COUNTY_HOMESTEAD_2026[normalized] ?? 371547;
}

export const WA_COUNTY_HOMESTEAD_2026: Record<string, number> = {
  'Adams': 282000, 'Asotin': 282000, 'Benton': 410000, 'Chelan': 540000,
  'Clallam': 480000, 'Clark': 562000, 'Columbia': 282000, 'Cowlitz': 380000,
  'Douglas': 380000, 'Ferry': 199500, 'Franklin': 370000, 'Garfield': 199500,
  'Grant': 315000, 'Grays Harbor': 330000, 'Island': 620000, 'Jefferson': 550000,
  'King': 940000, 'Kitsap': 600000, 'Kittitas': 450000, 'Klickitat': 340000,
  'Lewis': 330000, 'Lincoln': 250000, 'Mason': 400000, 'Okanogan': 282000,
  'Pacific': 282000, 'Pend Oreille': 282000, 'Pierce': 600000, 'San Juan': 700000,
  'Skagit': 540000, 'Skamania': 420000, 'Snohomish': 750000, 'Spokane': 390000,
  'Stevens': 282000, 'Thurston': 500000, 'Wahkiakum': 282000, 'Walla Walla': 360000,
  'Whatcom': 590000, 'Whitman': 282000, 'Yakima': 340000,
};

export function getWaHomesteadByCounty(county: string): number {
  const normalized = county.trim().replace(/\s+county$/i, '');
  return WA_COUNTY_HOMESTEAD_2026[normalized] ?? 282000;
}

export interface WaHomesteadEligibility {
  eligible: boolean;
  daysOwned: number | null;
  meets1215: boolean;
  isPrimary: boolean;
  county: string;
  amount: number;
  note: string;
}

export function getWaHomesteadEligibility(
  homeAcquiredDate: string | undefined,
  isOccupiedPrimary: string | undefined,
  county: string | undefined,
): WaHomesteadEligibility {
  const isPrimary = isOccupiedPrimary === 'yes';
  const countyName = (county || '').trim().replace(/\s+county$/i, '');
  const amount = WA_COUNTY_HOMESTEAD_2026[countyName] ?? 282000;

  if (!homeAcquiredDate) {
    return { eligible: false, daysOwned: null, meets1215: false, isPrimary, county: countyName, amount, note: 'Home acquisition date not provided — cannot verify 1,215-day requirement.' };
  }
  const acquired = new Date(homeAcquiredDate);
  if (isNaN(acquired.getTime())) {
    return { eligible: false, daysOwned: null, meets1215: false, isPrimary, county: countyName, amount, note: 'Invalid home acquisition date.' };
  }
  const daysOwned = Math.floor((Date.now() - acquired.getTime()) / (1000 * 60 * 60 * 24));
  const meets1215 = daysOwned >= 1215;
  const eligible = meets1215 && isPrimary;
  const note = eligible
    ? `WA homestead auto-applied: ${countyName} County — ${daysOwned.toLocaleString()} days owned (≥1,215 days), primary residence confirmed. RCW §§6.13.010–6.13.030.`
    : !isPrimary
    ? `Property is not debtor's primary residence — homestead exemption does not apply. RCW §6.13.010.`
    : `Property owned ${daysOwned.toLocaleString()} days — must be owned 1,215+ days before filing for WA homestead. ${1215 - daysOwned} more days needed.`;
  return { eligible, daysOwned, meets1215, isPrimary, county: countyName, amount, note };
}

/**
 * Returns applicable exemptions for a filing state.
 * Accepts either a 2-letter state code ("AZ") or a full state name ("Arizona").
 * For CA, pass hasRealProperty to select System 704 (owners) vs System 703 (non-owners).
 * Falls back to FEDERAL_EXEMPTIONS if state is unrecognized or domicile < 2 years.
 */
export function getApplicableExemptions(filingState: string, domicileYears?: number, hasRealProperty?: boolean): StateExemption {
  // Normalize full name → 2-letter code if needed
  const code = filingState.length === 2 ? filingState.toUpperCase()
    : STATE_NAME_TO_CODE[filingState] ?? null;

  if (!code) return FEDERAL_EXEMPTIONS;
  const state = STATE_EXEMPTIONS[code];
  if (!state) return FEDERAL_EXEMPTIONS;
  if (domicileYears !== undefined && domicileYears < 2) {
    return FEDERAL_EXEMPTIONS;
  }
  // CA dual-system: 704 (owns real property) vs 703 (does not own real property)
  if (code === 'CA' && state.alternateSystem) {
    return hasRealProperty ? state : state.alternateSystem;
  }
  return state;
}

export function getBKDistrict(state: string): string[] {
  const districts: Record<string, string[]> = {
    AL: ['Northern District of Alabama', 'Middle District of Alabama', 'Southern District of Alabama'],
    AK: ['District of Alaska'],
    AZ: ['District of Arizona'],
    AR: ['Eastern District of Arkansas', 'Western District of Arkansas'],
    CA: ['Northern District of California', 'Eastern District of California', 'Central District of California', 'Southern District of California'],
    CO: ['District of Colorado'],
    CT: ['District of Connecticut'],
    DE: ['District of Delaware'],
    FL: ['Northern District of Florida', 'Middle District of Florida', 'Southern District of Florida'],
    GA: ['Northern District of Georgia', 'Middle District of Georgia', 'Southern District of Georgia'],
    HI: ['District of Hawaii'],
    ID: ['District of Idaho'],
    IL: ['Northern District of Illinois', 'Central District of Illinois', 'Southern District of Illinois'],
    IN: ['Northern District of Indiana', 'Southern District of Indiana'],
    IA: ['Northern District of Iowa', 'Southern District of Iowa'],
    KS: ['District of Kansas'],
    KY: ['Eastern District of Kentucky', 'Western District of Kentucky'],
    LA: ['Eastern District of Louisiana', 'Middle District of Louisiana', 'Western District of Louisiana'],
    ME: ['District of Maine'],
    MD: ['District of Maryland'],
    MA: ['District of Massachusetts'],
    MI: ['Eastern District of Michigan', 'Western District of Michigan'],
    MN: ['District of Minnesota'],
    MS: ['Northern District of Mississippi', 'Southern District of Mississippi'],
    MO: ['Eastern District of Missouri', 'Western District of Missouri'],
    MT: ['District of Montana'],
    NE: ['District of Nebraska'],
    NV: ['District of Nevada'],
    NH: ['District of New Hampshire'],
    NJ: ['District of New Jersey'],
    NM: ['District of New Mexico'],
    NY: ['Northern District of New York', 'Eastern District of New York', 'Southern District of New York', 'Western District of New York'],
    NC: ['Eastern District of North Carolina', 'Middle District of North Carolina', 'Western District of North Carolina'],
    ND: ['District of North Dakota'],
    OH: ['Northern District of Ohio', 'Southern District of Ohio'],
    OK: ['Northern District of Oklahoma', 'Eastern District of Oklahoma', 'Western District of Oklahoma'],
    OR: ['District of Oregon'],
    PA: ['Eastern District of Pennsylvania', 'Middle District of Pennsylvania', 'Western District of Pennsylvania'],
    RI: ['District of Rhode Island'],
    SC: ['District of South Carolina'],
    SD: ['District of South Dakota'],
    TN: ['Eastern District of Tennessee', 'Middle District of Tennessee', 'Western District of Tennessee'],
    TX: ['Northern District of Texas', 'Eastern District of Texas', 'Southern District of Texas', 'Western District of Texas'],
    UT: ['District of Utah'],
    VT: ['District of Vermont'],
    VA: ['Eastern District of Virginia', 'Western District of Virginia'],
    WA: ['Eastern District of Washington', 'Western District of Washington'],
    WV: ['Northern District of West Virginia', 'Southern District of West Virginia'],
    WI: ['Eastern District of Wisconsin', 'Western District of Wisconsin'],
    WY: ['District of Wyoming'],
    DC: ['District of Columbia'],
    PR: ['District of Puerto Rico'],
    VI: ['District of the Virgin Islands'],
    GU: ['District of Guam'],
  };
  const normalized = state.length > 2 ? (STATE_NAME_TO_CODE[state] ?? state) : state.toUpperCase();
  return districts[normalized] || [`District of ${state}`];
}
