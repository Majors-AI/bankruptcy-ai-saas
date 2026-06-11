// Means Test Expenses — reference catalog (left-nav, under "Means Test").
//
// A read-only inventory of the IRS-allowable deduction categories the
// long-form means test (Form 122A-2 / 122C-2) accounts for. This page
// answers the question "what expenses get counted on this firm's means
// tests?" — it doesn't run a per-case computation (that lives on the
// Signing Review's LongFormDeductionPanel).
//
// Source of truth for the line list: src/lib/meansTestDeductions.ts
// (computeLongFormDeductions). Each category here cites the statute /
// IRS table and points at the canonical store it reads from.

import { Calculator, Home, Car, Heart, FileText, DollarSign, ExternalLink } from "lucide-react";

interface ExpenseLine {
  label: string;
  citation: string;
  source: string;
  note?: string;
}

interface ExpenseCategory {
  key: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  citation: string;
  intro: string;
  lines: ExpenseLine[];
}

const CATEGORIES: ExpenseCategory[] = [
  {
    key: "national",
    label: "National Standards",
    icon: Home,
    citation: "§ 707(b)(2)(A)(ii)(I) · IRS National Standards",
    intro: "Household-size-scaled allowances applied uniformly across the country.",
    lines: [
      { label: "Food", citation: "IRS National Standards", source: "NATIONAL_STANDARDS_2025.food[size]" },
      { label: "Housekeeping supplies", citation: "IRS National Standards", source: "NATIONAL_STANDARDS_2025.housekeepingSupplies[size]" },
      { label: "Apparel & services", citation: "IRS National Standards", source: "NATIONAL_STANDARDS_2025.apparelServices[size]" },
      { label: "Personal care products & services", citation: "IRS National Standards", source: "NATIONAL_STANDARDS_2025.personalCare[size]" },
      { label: "Miscellaneous", citation: "IRS National Standards", source: "NATIONAL_STANDARDS_2025.miscellaneous[size]" },
      { label: "Out-of-pocket health-care (per person, by age band)", citation: "IRS National Health Care Standards", source: "pending — column on NATIONAL_STANDARDS_2025 is null today", note: "Flagged for operator load." },
    ],
  },
  {
    key: "housing",
    label: "Local Housing & Utilities",
    icon: Home,
    citation: "§ 707(b)(2)(A)(ii)(I) · IRS Local Standards — Housing & Utilities",
    intro: "By state × county × household size. Mortgage/rent line is the standard minus the actual secured-home payment (floored at $0).",
    lines: [
      { label: "Insurance / operating (line 8)", citation: "IRS Local Standards — Housing", source: "IRS_HOUSING_UTILITIES_2025[state][county][size]" },
      { label: "Mortgage / rent (line 9) — standard minus secured-home payment", citation: "§ 707(b)(2)(A)(iii) reduction · Lanning v. Hamilton (590 U.S.)", source: "IRS_HOUSING_UTILITIES_2025[state][county][size] − formData.realPropMonthlyPayment − formData.secondMortgagePayment", note: "Today the store carries one combined number per (state, county, size). UST split between lines 8 / 9 is operator-load pending." },
    ],
  },
  {
    key: "transportation",
    label: "Local Transportation",
    icon: Car,
    citation: "§ 707(b)(2)(A)(ii)(II) · IRS Local Standards — Transportation",
    intro: "Operating allowance by region/metro × vehicles (cap 2); ownership allowance per vehicle minus secured car-loan payment (floored at $0). Public-transit-only households use the national transit allowance.",
    lines: [
      { label: "Operating — region / metro × vehicles (1 or 2)", citation: "IRS Local Standards — Transportation Operating", source: "IRS_TRANSPORTATION_2025.operating[region].metros[metro][one|two]" },
      { label: "Public-transit allowance (no vehicle)", citation: "IRS Local Standards — Transportation", source: "IRS_TRANSPORTATION_2025.publicTransitNational" },
      { label: "Ownership per vehicle (up to 2) — minus secured car payment", citation: "IRS Local Standards — Transportation Ownership", source: "IRS_TRANSPORTATION_2025.ownershipNational.one × vehicles − vehicles[i].monthlyPayment" },
    ],
  },
  {
    key: "other_necessary",
    label: "Other Necessary Expenses (actuals)",
    icon: FileText,
    citation: "§ 707(b)(2)(A)(ii)(I) · IRM 5.15 Allowable Living Expense — Other Necessary",
    intro: "Actuals (not standards) — entered as paid. Documented and tied to the case record.",
    lines: [
      { label: "Federal / state / local income taxes", citation: "IRM 5.15.1", source: "formData.taxes.* (actual)" },
      { label: "Mandatory payroll deductions (involuntary)", citation: "IRM 5.15.1", source: "formData.mandatoryPayrollDeductions" },
      { label: "Term-life insurance (debtor only — own life)", citation: "IRM 5.15.1", source: "formData.termLifePremiumDebtor" },
      { label: "Court-ordered payments (alimony, support, restitution)", citation: "§ 707(b)(2)(A)(ii)(I) · IRM 5.15.1", source: "formData.courtOrderedPayments" },
      { label: "Education for employment / disabled child", citation: "§ 707(b)(2)(A)(ii)(IV) · IRM 5.15.1", source: "formData.educationEmploymentOrDisabled" },
      { label: "Childcare", citation: "IRM 5.15.1", source: "formData.childcare" },
      { label: "Telecommunications beyond basic", citation: "IRM 5.15.1", source: "formData.telecomBeyondBasic" },
    ],
  },
  {
    key: "additional",
    label: "Additional Expense Deductions",
    icon: Heart,
    citation: "§ 707(b)(2)(A)(ii)(I)–(V)",
    intro: "Statute-specific deductions on top of the IRS allowable categories. Some carry statutory caps still pending operator load.",
    lines: [
      { label: "Health / disability insurance + HSA contributions", citation: "§ 707(b)(2)(A)(ii)(I)", source: "formData.healthDisabilityHsa" },
      { label: "Elderly, ill, or disabled household-member care", citation: "§ 707(b)(2)(A)(ii)(II)", source: "formData.elderlyIllDisabledCare" },
      { label: "Family-violence protection costs", citation: "§ 707(b)(2)(A)(ii)(I)", source: "formData.familyViolenceProtection" },
      { label: "Additional home-energy expense (above standard)", citation: "§ 707(b)(2)(A)(ii)(V)", source: "formData.additionalHomeEnergyExcess" },
      { label: "Education for minor children (capped)", citation: "§ 707(b)(2)(A)(ii)(IV)", source: "formData.educationMinorChildren — statutory per-child cap PENDING", note: "Cap not yet loaded; engine flags this line pending." },
      { label: "Charitable contributions (capped)", citation: "§ 707(b)(1) carve-out", source: "formData.charitable — % allowance PENDING", note: "Allowance percentage not yet loaded; engine flags this line pending." },
    ],
  },
  {
    key: "debt_payment",
    label: "Debt-Payment Deductions",
    icon: DollarSign,
    citation: "§ 707(b)(2)(A)(iii)–(iv)",
    intro: "60-month-amortized payments for secured debt, secured arrears, and priority unsecured debt. Ch.13 also includes the trustee administrative expense.",
    lines: [
      { label: "Secured debt — 60-month average payment", citation: "§ 707(b)(2)(A)(iii)(I)", source: "sum of current secured monthly payments (attorney verifies 60-mo amortization)" },
      { label: "Secured arrears ÷ 60", citation: "§ 707(b)(2)(A)(iii)(II)", source: "formData.securedArrears (FIELD NOT YET ON CASE RECORD)", note: "Attorney enters per case until field lands." },
      { label: "Priority unsecured ÷ 60", citation: "§ 707(b)(2)(A)(iv)", source: "formData.taxDebt (interim — full priority basket pending)" },
      { label: "Ch.13 trustee administrative %", citation: "§ 1326(b)(2)", source: "projectedPlanPaymentMonthly × trustee % (PENDING — fee schedule not loaded)" },
    ],
  },
];

export default function MeansTestExpensesPage() {
  return (
    <div className="space-y-4">
      <PageHeader />

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="text-xs text-amber-200 leading-relaxed">
          <strong className="text-amber-300">What this page shows.</strong> The IRS-allowable expense categories
          the long-form means test (Form 122A-2 / 122C-2) accounts for on every case. Standards-default
          per category; attorneys may override per-line on the Signing Review (audit-logged).
          Per-case computation: <em>computeLongFormDeductions</em> in src/lib/meansTestDeductions.ts.
        </p>
      </div>

      {CATEGORIES.map(cat => {
        const Icon = cat.icon;
        return (
          <section key={cat.key} className="rounded-lg border border-[#2A2A28] bg-[#1A1A18]">
            <div className="px-4 py-3 border-b border-[#2A2A28] flex items-start gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#0F0F0E] border border-[#2A2A28] flex items-center justify-center">
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#FAFAF7]">{cat.label}</p>
                <p className="text-[10px] uppercase tracking-widest text-[#6B6B66] mt-0.5">{cat.citation}</p>
                <p className="text-[11px] text-[#6B6B66] mt-1 leading-relaxed">{cat.intro}</p>
              </div>
            </div>
            <ul className="divide-y divide-[#2A2A28]">
              {cat.lines.map(line => (
                <li key={line.label} className="px-4 py-2.5 grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#FAFAF7]">{line.label}</p>
                    <p className="text-[10px] text-[#6B6B66]">{line.citation}</p>
                    {line.note && (
                      <p className="text-[10px] text-amber-300 mt-1 italic leading-snug">{line.note}</p>
                    )}
                  </div>
                  <p className="text-[10px] text-[#6B6B66] font-mono leading-snug break-words">
                    <ExternalLink className="w-2.5 h-2.5 inline mr-1" />{line.source}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <p className="text-[10px] text-[#6B6B66] italic leading-snug">
        Editing the IRS standards: see <strong className="text-[#FAFAF7]">Living Standards</strong> (firm overlay,
        attorney-supervisor / owner only). Per-case overrides: see the long-form deduction panel on the
        attorney <strong className="text-[#FAFAF7]">Signing Review</strong> for the case.
      </p>
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#1A1A18] border border-[#2A2A28] flex items-center justify-center">
        <Calculator className="w-4 h-4" style={{ color: "var(--lfs-accent)" }} />
      </div>
      <div>
        <h2 className="text-base font-semibold text-[#FAFAF7]">Means Test Expenses</h2>
        <p className="text-[11px] text-[#6B6B66] mt-0.5 leading-relaxed max-w-2xl">
          The IRS-allowable expense categories accounted for in the long-form means test
          (Form 122A-2 for Chapter 7 / Form 122C-2 for Chapter 13).
        </p>
      </div>
    </div>
  );
}
