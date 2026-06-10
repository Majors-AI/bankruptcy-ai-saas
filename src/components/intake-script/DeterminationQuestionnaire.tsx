// Staff-facing DETERMINATION questionnaire.
//
// Short form the firm uses to make a Ch.7 vs. Ch.13 determination. Mirrors
// the LOCKED client questionnaire's substantive questions (form_data keys
// match exactly) but is trimmed to what the eligibility engine actually
// reads: identity, residence, household, income, expenses (with IRS
// Standards pre-fill), assets, debts (incl. the FIVE business-debt fields
// the engine reads but the locked form never writes), SOFA, refund.
//
// THIS FILE DOES NOT TOUCH THE LOCKED QUESTIONNAIRE
// (src/bankruptcy-information-and-document-questionnaire(1).jsx). The locked
// form is the canonical client-facing surface; this determination form is a
// SEPARATE staff-facing tool with the same data shape so AllAnswersView,
// calcDebtComposition, and analyzeChapter7 all read it identically.
//
// ─── EXPENSE PRE-FILL (Form 122A-2 methodology) ─────────────────────────────
// When the staffer reaches Section 5 (Expenses), each Schedule J line is
// pre-filled per the IRS / UST Means Test Standards:
//   • NATIONAL Standards (by household size): food, apparel, personal care,
//     housekeeping, miscellaneous, out-of-pocket health care
//   • LOCAL Standards (by county + household size): housing & utilities
//     non-mortgage portion; transportation operating costs by MSA
//   • ACTUALS: mortgage / rent (from properties[0].monthlyPayment), car
//     payment (from vehicles[].monthlyPayment), childcare, court-ordered
//     support, health insurance, taxes (means-test "actual" categories)
//
// Pre-fill is a DEFAULT. Staff may override any line; an override is
// preserved verbatim through navigation. The eligibility engine reads the
// final values from the same form_data keys regardless of source.
//
// ─── BUSINESS-DEBT EXCEPTION ─────────────────────────────────────────────────
// Section 12 collects the FIVE business-debt fields the engine reads at
// AttorneyIntakeDashboard.tsx:447-451 (otherBusinessDebt,
// businessCreditCardDebt, businessMortgageDebt, businessEquipmentDebt,
// supplyVendorDebt). When the sum of these crosses 50% of total debt the
// § 707(b)(1) primarily-business-debt bypass triggers automatically.
//
// ─── SUBMIT (scaffold) ──────────────────────────────────────────────────────
// On final submit, the questionnaire emits the constructed form_data via
// the `onSubmit` callback. The host (StaffGuidedIntake) decides what to do
// with it. NO DB writes happen inside this component. TODO Phase B: the
// host writes the row to intake_submissions and stitches it to the lead.

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, AlertTriangle, ArrowLeft, ArrowRight,
  Check, ChevronUp, Plus, Trash2, Briefcase, Home, Calendar,
  CreditCard, DollarSign, FileText, Scale, Shield, User, Users,
} from "lucide-react";
import {
  EFFECTIVE_DATE, UST_SOURCE_URL, NEXT_REFRESH_HINT,
  scaleNationalStandards, OUT_OF_POCKET_HEALTH_CARE,
  localHousingForCountyHouseholdSize, TRANSPORTATION_OWNERSHIP,
  transportationOperatingForCounty,
  anyStandardsPendingVerification, LOADED_STATES,
} from "../../lib/irsMeansStandards";

// ─── Types ───────────────────────────────────────────────────────────────────

export type DetFormData = Record<string, unknown>;

interface DeterminationQuestionnaireProps {
  /** Optional initial form_data (e.g. prefill from a lead row or saved draft). */
  initialData?: DetFormData;
  /** Optional lead-driven defaults for identity/residence so the staffer
   *  doesn't re-type what we already know. Same shape as initialData. */
  leadDefaults?: DetFormData;
  /** Fired when the staffer presses "Submit for attorney review" on the
   *  closing section. Host decides what to persist (TODO Phase B). */
  onSubmit: (fd: DetFormData) => void;
  /** Fired when the staffer presses Back-to-intro from section 1. */
  onCancel?: () => void;
  /** Emits the current section index whenever it changes (lets the host
   *  swap a per-section flow-script in its sidebar). */
  onSectionChange?: (index: number, sectionId: string) => void;
}

// ─── Section definitions ─────────────────────────────────────────────────────

type SectionDef = {
  id: string;
  title: string;
  shortLabel: string;
  icon: React.ReactNode;
  /** One-line staff flow-script — shown in the host's sidebar above the form. */
  flowScript: string;
};

const SECTIONS: ReadonlyArray<SectionDef> = [
  { id: 'identity',         title: 'Identity & filing',                shortLabel: 'Identity',      icon: <User       size={14} />, flowScript: '"Let\'s confirm your name and the type of case we\'re considering."' },
  { id: 'residence',        title: 'Residence & domicile',              shortLabel: 'Residence',     icon: <Home       size={14} />, flowScript: '"Where do you live, and how long have you been at that address? This drives which state\'s exemptions apply."' },
  { id: 'household',        title: 'Household & dependents',            shortLabel: 'Household',     icon: <Users      size={14} />, flowScript: '"Tell me about your dependents — anyone who relies on you financially."' },
  { id: 'income',           title: 'Income (Form 122A inputs)',         shortLabel: 'Income',        icon: <DollarSign size={14} />, flowScript: '"Now your average monthly income from ALL sources. We\'re looking at the household\'s monthly total."' },
  { id: 'expenses',         title: 'Monthly expenses (Schedule J)',     shortLabel: 'Expenses',      icon: <FileText   size={14} />, flowScript: '"I\'m going to pre-fill the IRS-standard amounts for each category. If your actual costs are different, just tell me — we can override any of these."' },
  { id: 'realProperty',     title: 'Real property',                     shortLabel: 'Real Property', icon: <Home       size={14} />, flowScript: '"Do you own a home or other real estate? If so, I\'ll need each property\'s value, mortgage, and what you intend to do with it."' },
  { id: 'vehicles',         title: 'Vehicles',                          shortLabel: 'Vehicles',      icon: <Briefcase  size={14} />, flowScript: '"Now your vehicles — year/make/model, what they\'re worth, what\'s owed."' },
  { id: 'personalProperty', title: 'Personal property',                 shortLabel: 'Personal',      icon: <Briefcase  size={14} />, flowScript: '"Bank balances, retirement, anything else you own — totals are fine."' },
  { id: 'annuities',        title: 'Annuities',                         shortLabel: 'Annuities',     icon: <Shield     size={14} />, flowScript: '"Do you have any annuity contracts? Some states have favorable exemptions for annuities owned a certain length of time."' },
  { id: 'debts',            title: 'Consumer debts',                    shortLabel: 'Debts',         icon: <CreditCard size={14} />, flowScript: '"Now your consumer debts — credit cards, medical, student loans, taxes. Business loans go in the next section."' },
  { id: 'dsoGarnishment',   title: 'Domestic support & garnishment',    shortLabel: 'DSO',           icon: <Scale      size={14} />, flowScript: '"Any child support or alimony — paid or owed — and any active wage garnishments."' },
  { id: 'business',         title: 'Business interests & business debts', shortLabel: 'Business',    icon: <Briefcase  size={14} />, flowScript: '"Have you owned a business in the last 4 years? If so, this is where we break out any business debts — SBA loans, business credit cards, equipment financing, vendor balances. Important for the means-test exception."' },
  { id: 'history',          title: 'Financial history (SOFA subset)',   shortLabel: 'History',       icon: <Calendar   size={14} />, flowScript: '"Some yes/no questions about your financial history over the last few years — prior bankruptcies, lawsuits, transfers, recent large purchases."' },
  { id: 'refund',           title: 'Expected tax refund',               shortLabel: 'Refund',        icon: <DollarSign size={14} />, flowScript: '"Are you expecting a tax refund? It\'s treated as an asset of the estate, so the attorney needs to know."' },
];

export const DETERMINATION_SECTION_COUNT = SECTIONS.length;

/** Exposed so StaffGuidedIntake can mirror the per-section flow script in
 *  its sidebar. Index matches SECTIONS order. */
export function getDeterminationFlowScript(index: number): { title: string; flowScript: string } | null {
  const s = SECTIONS[index];
  return s ? { title: s.title, flowScript: s.flowScript } : null;
}

// ─── Mandatory-answer validation ───────────────────────────────────────────
//
// Per firm spec: every visible question on a section must be answered before
// the staffer can advance. Conditional fields (spouse fields when not married,
// prior-domicile when long-tenured at current address, etc.) drop OUT of the
// required set when their precondition isn't met — so the gate doesn't ask
// for inapplicable answers. Money inputs treat "0" as a valid answer; blanks
// fail.

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

/** Human-readable label for each form_data key — used in the missing-fields
 *  banner so the staffer can see which questions still need answers. */
const KEY_LABELS: Record<string, string> = {
  firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone',
  filingType: 'Filing type', chapterType: 'Chapter sought', maritalStatus: 'Marital status',
  spouseFirstName: 'Spouse first name', spouseLastName: 'Spouse last name',
  address: 'Street address', city: 'City', state: 'State', zip: 'ZIP', county: 'County',
  addressYears: 'Years at current address',
  priorDomicileState: 'Prior domicile state', movedToStateDate: 'Date moved to current state',
  homeAcquiredDate: 'Date home was acquired', isOccupiedPrimary: 'Primary residence?',
  numDependents: 'Number of dependents',
  debtorWorkStatus: 'Debtor employment status', debtorEmployer: 'Debtor employer', debtorMonthlyGross: 'Debtor monthly gross',
  spouseWorkStatus: 'Spouse employment status', spouseEmployer: 'Spouse employer', spouseMonthlyGross: 'Spouse monthly gross',
  dSsRetirement: 'SS retirement (debtor)', dSsDisability: 'SS disability (debtor)', dVeterans: 'VA benefits (debtor)',
  expRentMortgage: 'Rent / mortgage', expUtilities: 'Utilities (housing + utilities standard)',
  expFood: 'Food', expApparel: 'Apparel & services',
  expPersonalCare: 'Personal care', expHousekeeping: 'Housekeeping',
  expMiscellaneous: 'Miscellaneous', expHealthOutOfPocket: 'Out-of-pocket health care',
  expTransportationOp: 'Transportation operating', expTransportationOwn: 'Transportation ownership',
  expCarPayment: 'Car payment (actual)',
  expHealthInsurance: 'Health insurance premium', expChildcare: 'Childcare', expTaxes: 'Taxes withheld', expDsoPaid: 'Court-ordered DSO paid',
  expOther: 'Other monthly expenses',
  ownsRealEstate: 'Owns real estate?',
  noVehicles: 'No vehicles?', numVehicles: 'Number of vehicles',
  bankBalance: 'Bank balances', retirementBalance: 'Retirement balances',
  hasStocks: 'Has stocks?', stocksValue: 'Stocks value',
  hasCrypto: 'Has crypto?', cryptoValue: 'Crypto value',
  hasLifeInsurance: 'Has life insurance?', lifeInsuranceCashValue: 'Life insurance cash value',
  hasFirearms: 'Has firearms?', firearmValue: 'Firearm value',
  hasCollectibles: 'Has collectibles?', collectiblesValue: 'Collectibles value',
  householdGoodsValue: 'Household goods', jewelryValue: 'Jewelry', toolsValue: 'Tools of trade',
  otherPersonalPropDesc: 'Other personal property',
  hasAnnuities: 'Has annuities?',
  securedDebt: 'Total secured debt', creditCardDebt: 'Credit card debt',
  medicalDebt: 'Medical debt', studentLoanDebt: 'Student loan debt',
  taxDebt: 'Tax debt', personalLoanDebt: 'Personal loans / consumer unsecured',
  otherUnsecured: 'Other unsecured',
  childSupport: 'Child support paid', alimony: 'Alimony paid',
  dsoArrears: 'DSO arrears?', dsoArrearsAmount: 'DSO arrears amount',
  garnishment: 'Active garnishment?', garnishmentCreditor: 'Garnishment creditor', garnishmentMonthlyAmount: 'Garnishment monthly amount',
  ownedBusiness: 'Owned business in last 4 years?', businessDetails: 'Business details',
  otherBusinessDebt: 'SBA / business loan', businessCreditCardDebt: 'Business credit cards',
  businessMortgageDebt: 'Business RE mortgage', businessEquipmentDebt: 'Business equipment financing',
  supplyVendorDebt: 'Supply / vendor / trade payables',
  priorBankruptcy: 'Prior bankruptcy?', pendingLawsuits: 'Pending lawsuits?',
  lawsuitDetails: 'Lawsuit details',
  transferredProperty: 'Property transfers in last 2 years?',
  preferentialPayments: 'Preferential payments (90-day)?',
  preferentialPaymentsInsider: 'Insider preferential payments (1-year)?',
  recentLuxury: 'Recent luxury purchases?',
  recentCashAdvance: 'Recent cash advance?',
  expectedRefund: 'Expecting tax refund?', refundAmount: 'Refund amount',
};

/** Returns the form_data keys that MUST have a non-blank value on the given
 *  section, given the current form_data. Conditional fields (spouse, prior-
 *  domicile, follow-up Y/N → details) only enter the required set when their
 *  precondition is met. */
function requiredKeysForSection(sectionId: string, fd: DetFormData): string[] {
  const s = (k: string) => (fd[k] == null ? '' : String(fd[k]));
  switch (sectionId) {
    case 'identity': {
      const keys = ['firstName', 'lastName', 'email', 'phone', 'filingType', 'chapterType', 'maritalStatus'];
      const ft = s('filingType');
      const ms = s('maritalStatus');
      if (ft === 'joint' || ft === 'individual-nonfiling-spouse' || ms === 'married') {
        keys.push('spouseFirstName', 'spouseLastName');
      }
      return keys;
    }
    case 'residence': {
      const keys = ['address', 'city', 'state', 'zip', 'county', 'addressYears',
                    'homeAcquiredDate', 'isOccupiedPrimary'];
      if (s('addressYears') && s('addressYears') !== '2+ years') {
        keys.push('priorDomicileState', 'movedToStateDate');
      }
      return keys;
    }
    case 'household': {
      // numDependents itself is required. Per-dependent items get gated below
      // via the array iteration in validateSection (which checks each
      // dependent has name / relationship / age).
      return ['numDependents'];
    }
    case 'income': {
      const keys = ['debtorWorkStatus', 'debtorEmployer', 'debtorMonthlyGross',
                    'dSsRetirement', 'dSsDisability', 'dVeterans'];
      const ft = s('filingType');
      if (ft === 'joint' || ft === 'individual-nonfiling-spouse') {
        keys.push('spouseWorkStatus', 'spouseEmployer', 'spouseMonthlyGross');
      }
      return keys;
    }
    case 'expenses': {
      // All expense lines required — they're all relevant to the means test
      // even when zero. Pre-fill from IRS Standards populates most defaults.
      return [
        'expRentMortgage', 'expUtilities', 'expFood', 'expApparel',
        'expPersonalCare', 'expHousekeeping', 'expMiscellaneous',
        'expHealthOutOfPocket', 'expTransportationOp', 'expTransportationOwn',
        'expCarPayment', 'expHealthInsurance', 'expChildcare', 'expTaxes',
        'expDsoPaid', 'expOther',
      ];
    }
    case 'realProperty': {
      // Just the yes/no — if "yes", per-property validation handles each item.
      return ['ownsRealEstate'];
    }
    case 'vehicles': {
      const keys = ['noVehicles'];
      if (s('noVehicles') === 'no') keys.push('numVehicles');
      return keys;
    }
    case 'personalProperty': {
      // All yes/no + their values when "yes" + the always-required totals.
      const keys = ['bankBalance', 'retirementBalance',
                    'hasStocks', 'hasCrypto', 'hasLifeInsurance', 'hasFirearms', 'hasCollectibles',
                    'householdGoodsValue', 'jewelryValue', 'toolsValue'];
      if (s('hasStocks') === 'yes')         keys.push('stocksValue');
      if (s('hasCrypto') === 'yes')         keys.push('cryptoValue');
      if (s('hasLifeInsurance') === 'yes')  keys.push('lifeInsuranceCashValue');
      if (s('hasFirearms') === 'yes')       keys.push('firearmValue');
      if (s('hasCollectibles') === 'yes')   keys.push('collectiblesValue');
      return keys;
    }
    case 'annuities': {
      return ['hasAnnuities'];
    }
    case 'debts': {
      return ['securedDebt', 'creditCardDebt', 'medicalDebt', 'studentLoanDebt',
              'taxDebt', 'personalLoanDebt', 'otherUnsecured'];
    }
    case 'dsoGarnishment': {
      const keys = ['childSupport', 'alimony', 'dsoArrears', 'garnishment'];
      if (s('dsoArrears') === 'yes')   keys.push('dsoArrearsAmount');
      if (s('garnishment') === 'yes')  keys.push('garnishmentCreditor', 'garnishmentMonthlyAmount');
      return keys;
    }
    case 'business': {
      // Always require ownedBusiness + the five business-debt buckets (the
      // engine reads ALL of them; blanks are not the same as zero). Business
      // details required only when ownedBusiness === 'yes'.
      const keys = ['ownedBusiness',
                    'otherBusinessDebt', 'businessCreditCardDebt',
                    'businessMortgageDebt', 'businessEquipmentDebt', 'supplyVendorDebt'];
      if (s('ownedBusiness') === 'yes') keys.push('businessDetails');
      return keys;
    }
    case 'history': {
      const keys = ['priorBankruptcy', 'pendingLawsuits', 'transferredProperty',
                    'preferentialPayments', 'preferentialPaymentsInsider',
                    'recentLuxury', 'recentCashAdvance'];
      if (s('pendingLawsuits') === 'yes') keys.push('lawsuitDetails');
      return keys;
    }
    case 'refund': {
      const keys = ['expectedRefund'];
      if (s('expectedRefund') === 'yes') keys.push('refundAmount');
      return keys;
    }
    default: return [];
  }
}

// ─── Reusable input atoms ────────────────────────────────────────────────────

const inputCx =
  "w-full bg-slate-900 border border-slate-700 text-slate-100 text-[12px] rounded px-2 py-1.5 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50";

function Field({ label, hint, children, required }: {
  label: string; hint?: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
        {label}{required && <span className="text-rose-400 ml-1">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[10px] text-slate-500 mt-1 italic">{hint}</span>}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className={inputCx} />
  );
}

function MoneyInput({ value, onChange, hint, prefilled }: {
  value: string; onChange: (v: string) => void; hint?: string; prefilled?: boolean;
}) {
  return (
    <div>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-[11px]">$</span>
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`${inputCx} pl-5 ${prefilled ? 'border-sky-500/40' : ''}`}
          placeholder="0"
        />
      </div>
      {prefilled && (
        <span className="block text-[9px] text-sky-400 mt-0.5 italic">Pre-filled from IRS Standard — edit to override</span>
      )}
      {hint && <span className="block text-[9px] text-slate-500 mt-0.5 italic">{hint}</span>}
    </div>
  );
}

function SelectInput({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={inputCx}>
      <option value="">— select —</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function YesNo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-md border border-slate-700 overflow-hidden">
      {(['yes', 'no'] as const).map(v => (
        <button key={v} type="button"
          onClick={() => onChange(v)}
          className={`text-[11px] font-bold uppercase tracking-widest px-3 py-1 ${
            value === v ? (v === 'yes' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-200')
                        : 'bg-transparent text-slate-500 hover:text-slate-200'
          }`}>
          {v}
        </button>
      ))}
    </div>
  );
}

function TextArea({ value, onChange, placeholder, rows = 2 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea value={value} placeholder={placeholder} rows={rows}
      onChange={e => onChange(e.target.value)}
      className={`${inputCx} resize-none`} />
  );
}

// ─── Verification banner (shown once at the top of every section while any
//     IRS Standards row remains pending verification). ────────────────────────

function StandardsVerificationBanner() {
  if (!anyStandardsPendingVerification()) return null;
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/8 px-3 py-2 mb-3">
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0 text-[11px] text-amber-200 leading-relaxed">
          <p className="font-semibold">Verify IRS Standards against current UST tables.</p>
          <p className="mt-0.5 text-amber-300/80">
            Loaded data is stamped <span className="font-mono text-amber-200">{EFFECTIVE_DATE}</span>.
            Confirm at{' '}
            <a href={UST_SOURCE_URL} target="_blank" rel="noreferrer" className="underline hover:text-amber-100">
              justice.gov/ust/means-testing
            </a>
            {' '}before any case determination relies on these numbers. {NEXT_REFRESH_HINT}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Repeating-array helpers ────────────────────────────────────────────────

function arr<T extends Record<string, unknown>>(fd: DetFormData, key: string): T[] {
  const v = fd[key];
  return Array.isArray(v) ? (v as T[]) : [];
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function DeterminationQuestionnaire({
  initialData, leadDefaults, onSubmit, onCancel, onSectionChange,
}: DeterminationQuestionnaireProps) {
  // Merge: leadDefaults < initialData (initialData wins on conflict).
  const [fd, setFd] = useState<DetFormData>(() => ({
    ...(leadDefaults ?? {}),
    ...(initialData ?? {}),
  }));
  const [sectionIdx, setSectionIdx] = useState(0);

  // Emit section change to host so the sidebar can mirror the flow script.
  useEffect(() => {
    if (onSectionChange) onSectionChange(sectionIdx, SECTIONS[sectionIdx]?.id ?? '');
  }, [sectionIdx, onSectionChange]);

  // ── form_data mutation helpers ─────────────────────────────────────────
  const set = (key: string, value: unknown) =>
    setFd(prev => ({ ...prev, [key]: value }));
  const get = (key: string): string => {
    const v = fd[key];
    return v == null ? '' : String(v);
  };

  // ── Derived helpers for expense pre-fill ───────────────────────────────
  const houseSize = useMemo(() => {
    const deps = parseInt(get('numDependents') || '0') || 0;
    const ft = get('filingType');
    const spouseInHousehold =
      ft === 'joint' || ft === 'individual-nonfiling-spouse';
    return Math.max(1, 1 + (spouseInHousehold ? 1 : 0) + deps);
  }, [fd]); // eslint-disable-line react-hooks/exhaustive-deps

  const carCount = useMemo(() => {
    const list = arr<Record<string, unknown>>(fd, 'vehicles');
    return Math.min(2, list.length) as 1 | 2 | 0;
  }, [fd]);

  // National Standards row (food / apparel / etc.) — household-size scaled.
  const ns = useMemo(() => scaleNationalStandards(houseSize), [houseSize]);

  // Health-care monthly per the OOP table. We default to under-65 unless
  // a dependent or filer is flagged as senior; for v1 the determination
  // questionnaire treats EVERY household member as under-65 and the staffer
  // overrides if appropriate. TODO Phase B: add per-person age inputs to
  // split correctly.
  const healthMonthly = useMemo(
    () => (OUT_OF_POCKET_HEALTH_CARE.find(r => r.ageBracket === 'under65')?.perPersonMonthly ?? 0) * houseSize,
    [houseSize],
  );

  // Local Standards housing & utilities (non-mortgage). null when not loaded.
  const localHousing = useMemo(() => {
    const st = get('state');
    const co = get('county');
    if (!st || !co) return { value: null, row: null };
    return localHousingForCountyHouseholdSize(st, co, houseSize);
  }, [fd, houseSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Transportation Ownership (national, capped at 2 cars).
  const transOwnership = useMemo(() => {
    if (carCount === 0) return 0;
    const row = TRANSPORTATION_OWNERSHIP.find(r => r.carCount === carCount);
    return row?.monthly ?? 0;
  }, [carCount]);

  // Transportation Operating (by MSA).
  const transOperating = useMemo(() => {
    if (carCount === 0) return { value: 0, row: null };
    const st = get('state');
    const co = get('county');
    if (!st || !co) return { value: null, row: null };
    return transportationOperatingForCounty(st, co, carCount as 1 | 2);
  }, [fd, carCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mortgage / rent and car payment — pulled from properties[0] and vehicles[].
  // These are "actuals" the means test allows even when over-median.
  const actualMortgage = useMemo(() => {
    const props = arr<Record<string, unknown>>(fd, 'properties');
    const p = props[0];
    if (!p) return 0;
    return parseFloat(String(p.monthlyPayment ?? '0')) || 0;
  }, [fd]);

  const actualCarPayment = useMemo(() => {
    const list = arr<Record<string, unknown>>(fd, 'vehicles');
    return list.reduce((s, v) => s + (parseFloat(String(v.monthlyPayment ?? '0')) || 0), 0);
  }, [fd]);

  // ── Auto-prefill expense fields — only when they're empty.
  //    Overrides are preserved verbatim. Triggered when household / state /
  //    county / cars change.
  useEffect(() => {
    setFd(prev => {
      const next: DetFormData = { ...prev };
      const fill = (key: string, value: number | null) => {
        if (value == null || value <= 0) return;
        if (prev[key] != null && prev[key] !== '') return; // don't overwrite
        next[key] = String(value);
      };
      // National Standards
      fill('expFood',             ns.food);
      fill('expApparel',          ns.apparelServices);
      fill('expPersonalCare',     ns.personalCare);
      fill('expHousekeeping',     ns.housekeepingSupplies);
      fill('expMiscellaneous',    ns.miscellaneous);
      fill('expHealthOutOfPocket', healthMonthly);
      // Local Standards
      fill('expUtilities',        localHousing.value);
      fill('expTransportationOp', transOperating.value);
      fill('expTransportationOwn', transOwnership);
      // Actuals
      fill('expRentMortgage',     actualMortgage);
      fill('expCarPayment',       actualCarPayment);
      return next;
    });
  // we intentionally re-run only when the derived inputs change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseSize, get('state'), get('county'), carCount, actualMortgage, actualCarPayment]);

  // ── Section navigation ─────────────────────────────────────────────────
  const current = SECTIONS[sectionIdx];
  const canBack = sectionIdx > 0;
  const isLast  = sectionIdx === SECTIONS.length - 1;

  // ── Mandatory-answer validation ────────────────────────────────────────
  // The current section's required keys (conditional on the form_data so
  // far) and the subset that are still blank. Computed live so the
  // missing-fields banner clears the instant the staffer fills them in.
  const requiredKeys = useMemo(
    () => requiredKeysForSection(current.id, fd),
    [current.id, fd],
  );
  const missingKeys = useMemo(
    () => requiredKeys.filter(k => isBlank(fd[k])),
    [requiredKeys, fd],
  );
  const canAdvance = missingKeys.length === 0;

  function next() {
    if (!canAdvance) return; // gate: every required answer must be filled
    if (sectionIdx < SECTIONS.length - 1) setSectionIdx(sectionIdx + 1);
  }
  function back() {
    if (sectionIdx > 0) setSectionIdx(sectionIdx - 1);
    else if (onCancel) onCancel();
  }
  function submitFinal() {
    if (!canAdvance) return; // last section's gate too
    onSubmit(fd);
  }

  // ── Section renderers ──────────────────────────────────────────────────
  function renderSection() {
    switch (current.id) {

      // ── 1. Identity ────────────────────────────────────────────────────
      case 'identity':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="First name" required><TextInput value={get('firstName')} onChange={v => set('firstName', v)} /></Field>
            <Field label="Last name" required><TextInput value={get('lastName')} onChange={v => set('lastName', v)} /></Field>
            <Field label="Email"><TextInput type="email" value={get('email')} onChange={v => set('email', v)} /></Field>
            <Field label="Phone"><TextInput type="tel" value={get('phone')} onChange={v => set('phone', v)} /></Field>
            <Field label="Filing type" required>
              <SelectInput value={get('filingType')} onChange={v => set('filingType', v)} options={[
                { value: 'individual', label: 'Individual' },
                { value: 'individual-nonfiling-spouse', label: 'Individual (married, spouse not filing)' },
                { value: 'joint', label: 'Joint' },
              ]} />
            </Field>
            <Field label="Chapter being considered" required>
              <SelectInput value={get('chapterType')} onChange={v => set('chapterType', v)} options={[
                { value: 'chapter_7',  label: 'Chapter 7' },
                { value: 'chapter_13', label: 'Chapter 13' },
              ]} />
            </Field>
            <Field label="Marital status">
              <SelectInput value={get('maritalStatus')} onChange={v => set('maritalStatus', v)} options={[
                { value: 'single', label: 'Single' },
                { value: 'married', label: 'Married' },
                { value: 'separated', label: 'Separated' },
                { value: 'divorced', label: 'Divorced' },
                { value: 'widowed', label: 'Widowed' },
              ]} />
            </Field>
            {(get('maritalStatus') === 'married' || get('filingType') === 'joint' || get('filingType') === 'individual-nonfiling-spouse') && (
              <>
                <Field label="Spouse first name"><TextInput value={get('spouseFirstName')} onChange={v => set('spouseFirstName', v)} /></Field>
                <Field label="Spouse last name"><TextInput value={get('spouseLastName')} onChange={v => set('spouseLastName', v)} /></Field>
              </>
            )}
          </div>
        );

      // ── 2. Residence ───────────────────────────────────────────────────
      case 'residence':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Street address" required><TextInput value={get('address')} onChange={v => set('address', v)} /></Field>
            <Field label="City" required><TextInput value={get('city')} onChange={v => set('city', v)} /></Field>
            <Field label="State" required hint={`Local IRS Standards loaded for: ${LOADED_STATES.join(', ')}`}>
              <TextInput value={get('state')} onChange={v => set('state', v.toUpperCase().slice(0, 2))} placeholder="AZ" />
            </Field>
            <Field label="ZIP"><TextInput value={get('zip')} onChange={v => set('zip', v)} /></Field>
            <Field label="County" required hint="Drives Local Standards lookup + district routing"><TextInput value={get('county')} onChange={v => set('county', v)} /></Field>
            <Field label="Years at current address" required>
              <SelectInput value={get('addressYears')} onChange={v => set('addressYears', v)} options={[
                { value: 'Less than 91 days',     label: 'Less than 91 days' },
                { value: '91 days – 6 months',    label: '91 days – 6 months' },
                { value: '6 months – 2 years',    label: '6 months – 2 years' },
                { value: '2+ years',              label: '2+ years' },
              ]} />
            </Field>
            {get('addressYears') !== '2+ years' && get('addressYears') !== '' && (
              <>
                <Field label="Prior domicile state" hint="Triggers § 522(b)(3) 730-day analysis">
                  <TextInput value={get('priorDomicileState')} onChange={v => set('priorDomicileState', v.toUpperCase().slice(0, 2))} placeholder="CA" />
                </Field>
                <Field label="Date moved to current state"><TextInput type="date" value={get('movedToStateDate')} onChange={v => set('movedToStateDate', v)} /></Field>
              </>
            )}
            <Field label="Date home was acquired" hint="Feeds WA homestead + § 522(p) 1215-day cap"><TextInput type="date" value={get('homeAcquiredDate')} onChange={v => set('homeAcquiredDate', v)} /></Field>
            <Field label="Home is debtor's primary residence?"><YesNo value={get('isOccupiedPrimary')} onChange={v => set('isOccupiedPrimary', v)} /></Field>
          </div>
        );

      // ── 3. Household ───────────────────────────────────────────────────
      case 'household': {
        const dependents = arr<{ name: string; relationship: string; age: string }>(fd, 'dependents');
        return (
          <div className="space-y-3">
            <Field label="Number of dependents" required hint={`Household size for IRS Standards: ${houseSize}`}>
              <TextInput type="number" value={get('numDependents')} onChange={v => {
                set('numDependents', v);
                // Sync the dependents array length to match.
                const n = Math.max(0, parseInt(v) || 0);
                const existing = arr<{ name: string; relationship: string; age: string }>(fd, 'dependents');
                if (n === existing.length) return;
                const next = [...existing];
                while (next.length < n) next.push({ name: '', relationship: '', age: '' });
                while (next.length > n) next.pop();
                set('dependents', next);
              }} />
            </Field>
            {dependents.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Dependents</p>
                {dependents.map((d, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 rounded border border-slate-800 bg-slate-900/40 p-2">
                    <TextInput value={d.name} onChange={v => {
                      const next = [...dependents]; next[i] = { ...next[i], name: v }; set('dependents', next);
                    }} placeholder="Name" />
                    <TextInput value={d.relationship} onChange={v => {
                      const next = [...dependents]; next[i] = { ...next[i], relationship: v }; set('dependents', next);
                    }} placeholder="Relationship" />
                    <TextInput type="number" value={d.age} onChange={v => {
                      const next = [...dependents]; next[i] = { ...next[i], age: v }; set('dependents', next);
                    }} placeholder="Age" />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      // ── 4. Income ──────────────────────────────────────────────────────
      case 'income': {
        const isJointOrNonfiling = get('filingType') === 'joint' || get('filingType') === 'individual-nonfiling-spouse';
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Debtor employment status" required>
                <SelectInput value={get('debtorWorkStatus')} onChange={v => set('debtorWorkStatus', v)} options={[
                  { value: 'employed', label: 'Employed' },
                  { value: 'self_employed', label: 'Self-employed' },
                  { value: 'unemployed', label: 'Unemployed' },
                  { value: 'retired', label: 'Retired' },
                  { value: 'disabled', label: 'Disabled' },
                ]} />
              </Field>
              <Field label="Debtor employer"><TextInput value={get('debtorEmployer')} onChange={v => set('debtorEmployer', v)} /></Field>
              <Field label="Debtor: average monthly income from ALL sources" required hint="Wages + bonuses + self-employment net + rental net + investment + family contributions">
                <MoneyInput value={get('debtorMonthlyGross')} onChange={v => set('debtorMonthlyGross', v)} />
              </Field>
              {isJointOrNonfiling && (
                <>
                  <Field label="Spouse employment status">
                    <SelectInput value={get('spouseWorkStatus')} onChange={v => set('spouseWorkStatus', v)} options={[
                      { value: 'employed', label: 'Employed' },
                      { value: 'self_employed', label: 'Self-employed' },
                      { value: 'unemployed', label: 'Unemployed' },
                      { value: 'retired', label: 'Retired' },
                      { value: 'disabled', label: 'Disabled' },
                      { value: 'not_employed', label: 'Not employed' },
                    ]} />
                  </Field>
                  <Field label="Spouse employer"><TextInput value={get('spouseEmployer')} onChange={v => set('spouseEmployer', v)} /></Field>
                  <Field label="Spouse: average monthly income from ALL sources"><MoneyInput value={get('spouseMonthlyGross')} onChange={v => set('spouseMonthlyGross', v)} /></Field>
                </>
              )}
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Non-CMI income (Form 122A-1 exclusions)</p>
              <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                These don't count toward CMI for the means test but the attorney still needs to see them.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Field label="SS retirement (debtor) / mo"><MoneyInput value={get('dSsRetirement')} onChange={v => set('dSsRetirement', v)} /></Field>
                <Field label="SS disability (debtor) / mo"><MoneyInput value={get('dSsDisability')} onChange={v => set('dSsDisability', v)} /></Field>
                <Field label="VA benefits (debtor) / mo"><MoneyInput value={get('dVeterans')} onChange={v => set('dVeterans', v)} /></Field>
              </div>
            </div>
          </div>
        );
      }

      // ── 5. Expenses (with IRS pre-fill) ────────────────────────────────
      case 'expenses':
        return (
          <div className="space-y-3">
            <StandardsVerificationBanner />
            <div className="rounded border border-sky-500/30 bg-sky-500/5 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="text-sky-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-[11px] text-sky-200/90 leading-relaxed">
                  <p className="font-semibold">Form 122A-2 pre-fill in effect</p>
                  <p className="mt-0.5">
                    Household size <span className="font-mono text-white">{houseSize}</span> ·
                    {get('state') && get('county')
                      ? ` Local Standards: ${get('state')} / ${get('county')} ·`
                      : ' Local Standards: enter state + county to enable ·'}
                    {' '}Cars on Vehicles section: <span className="font-mono text-white">{carCount}</span>
                  </p>
                  {localHousing.value == null && (get('state') && get('county')) && (
                    <p className="mt-1 text-amber-200/80">
                      Local housing standard not yet loaded for {get('county')}, {get('state')} —
                      staff enters actual housing & utilities amount.
                    </p>
                  )}
                  {transOperating.value == null && carCount > 0 && (
                    <p className="text-amber-200/80">
                      Local transportation operating standard not yet loaded for this MSA —
                      staff enters actual amount.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* National Standards — household-size driven */}
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">National Standards (household-size driven)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Food / mo"><MoneyInput value={get('expFood')} onChange={v => set('expFood', v)} prefilled={ns.food > 0 && get('expFood') === String(ns.food)} /></Field>
              <Field label="Apparel & services / mo"><MoneyInput value={get('expApparel')} onChange={v => set('expApparel', v)} prefilled={ns.apparelServices > 0 && get('expApparel') === String(ns.apparelServices)} /></Field>
              <Field label="Personal care products & services / mo"><MoneyInput value={get('expPersonalCare')} onChange={v => set('expPersonalCare', v)} prefilled={ns.personalCare > 0 && get('expPersonalCare') === String(ns.personalCare)} /></Field>
              <Field label="Housekeeping supplies / mo"><MoneyInput value={get('expHousekeeping')} onChange={v => set('expHousekeeping', v)} prefilled={ns.housekeepingSupplies > 0 && get('expHousekeeping') === String(ns.housekeepingSupplies)} /></Field>
              <Field label="Miscellaneous / mo"><MoneyInput value={get('expMiscellaneous')} onChange={v => set('expMiscellaneous', v)} prefilled={ns.miscellaneous > 0 && get('expMiscellaneous') === String(ns.miscellaneous)} /></Field>
              <Field label="Out-of-pocket health care / mo" hint="Per-person × household size (defaults to under-65 bracket)"><MoneyInput value={get('expHealthOutOfPocket')} onChange={v => set('expHealthOutOfPocket', v)} prefilled={healthMonthly > 0 && get('expHealthOutOfPocket') === String(healthMonthly)} /></Field>
            </div>

            {/* Local Standards — county-driven */}
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 pt-2">Local Standards (county / MSA driven)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Housing & utilities — non-mortgage / mo" hint="Insurance + operating expenses (does NOT include mortgage)">
                <MoneyInput value={get('expUtilities')} onChange={v => set('expUtilities', v)} prefilled={localHousing.value != null && get('expUtilities') === String(localHousing.value)} />
              </Field>
              <Field label="Mortgage / rent / mo (actual)" hint={actualMortgage > 0 ? `Pulled from Real Property section: ${actualMortgage}` : 'No real property entered yet'}>
                <MoneyInput value={get('expRentMortgage')} onChange={v => set('expRentMortgage', v)} prefilled={actualMortgage > 0 && get('expRentMortgage') === String(actualMortgage)} />
              </Field>
              <Field label="Transportation — operating / mo" hint="Gas, maintenance, insurance, parking, transit — Local Standard by MSA">
                <MoneyInput value={get('expTransportationOp')} onChange={v => set('expTransportationOp', v)} prefilled={transOperating.value != null && get('expTransportationOp') === String(transOperating.value)} />
              </Field>
              <Field label="Transportation — ownership / mo" hint="Capped at 2 cars — national figure">
                <MoneyInput value={get('expTransportationOwn')} onChange={v => set('expTransportationOwn', v)} prefilled={transOwnership > 0 && get('expTransportationOwn') === String(transOwnership)} />
              </Field>
              <Field label="Car payment / mo (actual)" hint={actualCarPayment > 0 ? `Pulled from Vehicles section: ${actualCarPayment}` : 'No vehicles entered yet'}>
                <MoneyInput value={get('expCarPayment')} onChange={v => set('expCarPayment', v)} prefilled={actualCarPayment > 0 && get('expCarPayment') === String(actualCarPayment)} />
              </Field>
            </div>

            {/* Actuals — means test allows even when over-median */}
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 pt-2">Actual amounts (means-test-allowable)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Health insurance premiums / mo" hint="Actual — not the IRS health standard"><MoneyInput value={get('expHealthInsurance')} onChange={v => set('expHealthInsurance', v)} /></Field>
              <Field label="Childcare / mo (actual)"><MoneyInput value={get('expChildcare')} onChange={v => set('expChildcare', v)} /></Field>
              <Field label="Taxes (income/property withholding) / mo"><MoneyInput value={get('expTaxes')} onChange={v => set('expTaxes', v)} /></Field>
              <Field label="Court-ordered DSO paid / mo"><MoneyInput value={get('expDsoPaid')} onChange={v => set('expDsoPaid', v)} /></Field>
            </div>

            {/* Catch-all */}
            <div className="grid grid-cols-1 gap-3">
              <Field label="Other monthly expenses (catch-all)"><MoneyInput value={get('expOther')} onChange={v => set('expOther', v)} /></Field>
            </div>
          </div>
        );

      // ── 6. Real Property ───────────────────────────────────────────────
      case 'realProperty': {
        const props = arr<Record<string, unknown>>(fd, 'properties');
        return (
          <div className="space-y-3">
            <Field label="Owns real estate?"><YesNo value={get('ownsRealEstate')} onChange={v => {
              set('ownsRealEstate', v);
              if (v === 'yes' && props.length === 0) {
                set('properties', [{ address: '', propType: '', propertyValue: '', loanBalance: '', monthlyPayment: '', arrearsAmount: '', lenderName: '', intent: '', interestRate: '' }]);
              }
            }} /></Field>
            {get('ownsRealEstate') === 'yes' && (
              <>
                {props.map((p, i) => (
                  <div key={i} className="rounded border border-slate-800 bg-slate-900/40 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Property {i + 1}</p>
                      {props.length > 1 && (
                        <button type="button" onClick={() => set('properties', props.filter((_, j) => j !== i))} className="text-rose-400 hover:text-rose-300">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <Field label="Address"><TextInput value={String(p.address ?? '')} onChange={v => { const next = [...props]; next[i] = { ...next[i], address: v }; set('properties', next); }} /></Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Type">
                        <SelectInput value={String(p.propType ?? '')} onChange={v => { const next = [...props]; next[i] = { ...next[i], propType: v }; set('properties', next); }} options={[
                          { value: 'Primary Residence',          label: 'Primary Residence' },
                          { value: 'Second Home',                label: 'Second Home' },
                          { value: 'Investment/Rental Property', label: 'Investment / Rental' },
                          { value: 'Land',                       label: 'Land' },
                          { value: 'Mobile Home',                label: 'Mobile Home' },
                          { value: 'Other',                      label: 'Other' },
                        ]} />
                      </Field>
                      <Field label="Lender"><TextInput value={String(p.lenderName ?? '')} onChange={v => { const next = [...props]; next[i] = { ...next[i], lenderName: v }; set('properties', next); }} /></Field>
                      <Field label="Property value"><MoneyInput value={String(p.propertyValue ?? '')} onChange={v => { const next = [...props]; next[i] = { ...next[i], propertyValue: v }; set('properties', next); }} /></Field>
                      <Field label="Mortgage owed"><MoneyInput value={String(p.loanBalance ?? '')} onChange={v => { const next = [...props]; next[i] = { ...next[i], loanBalance: v }; set('properties', next); }} /></Field>
                      <Field label="Monthly payment"><MoneyInput value={String(p.monthlyPayment ?? '')} onChange={v => { const next = [...props]; next[i] = { ...next[i], monthlyPayment: v }; set('properties', next); }} /></Field>
                      <Field label="Arrears amount"><MoneyInput value={String(p.arrearsAmount ?? '')} onChange={v => { const next = [...props]; next[i] = { ...next[i], arrearsAmount: v }; set('properties', next); }} /></Field>
                      <Field label="Intent">
                        <SelectInput value={String(p.intent ?? '')} onChange={v => { const next = [...props]; next[i] = { ...next[i], intent: v }; set('properties', next); }} options={[
                          { value: 'keep',      label: 'Keep' },
                          { value: 'cramdown',  label: 'Cramdown (Ch.13)' },
                          { value: 'surrender', label: 'Surrender' },
                        ]} />
                      </Field>
                      <Field label="Interest rate (%)"><TextInput value={String(p.interestRate ?? '')} onChange={v => { const next = [...props]; next[i] = { ...next[i], interestRate: v }; set('properties', next); }} /></Field>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => set('properties', [...props, { address: '', propType: '', propertyValue: '', loanBalance: '', monthlyPayment: '', arrearsAmount: '', lenderName: '', intent: '', interestRate: '' }])}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 rounded px-2 py-1">
                  <Plus size={12} /> Add property
                </button>
              </>
            )}
          </div>
        );
      }

      // ── 7. Vehicles ────────────────────────────────────────────────────
      case 'vehicles': {
        const list = arr<Record<string, unknown>>(fd, 'vehicles');
        return (
          <div className="space-y-3">
            <Field label="No vehicles owned?"><YesNo value={get('noVehicles')} onChange={v => {
              set('noVehicles', v);
              if (v === 'yes') { set('numVehicles', '0'); set('vehicles', []); }
            }} /></Field>
            {get('noVehicles') !== 'yes' && (
              <>
                <Field label="Number of vehicles"><TextInput type="number" value={get('numVehicles')} onChange={v => {
                  set('numVehicles', v);
                  const n = Math.max(0, parseInt(v) || 0);
                  const existing = arr<Record<string, unknown>>(fd, 'vehicles');
                  if (n === existing.length) return;
                  const next = [...existing];
                  while (next.length < n) next.push({ year: '', make: '', model: '', value: '', loanBalance: '', monthlyPayment: '', lenderName: '', intent: '' });
                  while (next.length > n) next.pop();
                  set('vehicles', next);
                }} /></Field>
                {list.map((v, i) => (
                  <div key={i} className="rounded border border-slate-800 bg-slate-900/40 p-3 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vehicle {i + 1}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Year"><TextInput value={String(v.year ?? '')} onChange={val => { const next = [...list]; next[i] = { ...next[i], year: val }; set('vehicles', next); }} /></Field>
                      <Field label="Make"><TextInput value={String(v.make ?? '')} onChange={val => { const next = [...list]; next[i] = { ...next[i], make: val }; set('vehicles', next); }} /></Field>
                      <Field label="Model"><TextInput value={String(v.model ?? '')} onChange={val => { const next = [...list]; next[i] = { ...next[i], model: val }; set('vehicles', next); }} /></Field>
                      <Field label="Current value"><MoneyInput value={String(v.value ?? '')} onChange={val => { const next = [...list]; next[i] = { ...next[i], value: val }; set('vehicles', next); }} /></Field>
                      <Field label="Loan owed"><MoneyInput value={String(v.loanBalance ?? '')} onChange={val => { const next = [...list]; next[i] = { ...next[i], loanBalance: val }; set('vehicles', next); }} /></Field>
                      <Field label="Monthly payment"><MoneyInput value={String(v.monthlyPayment ?? '')} onChange={val => { const next = [...list]; next[i] = { ...next[i], monthlyPayment: val }; set('vehicles', next); }} /></Field>
                      <Field label="Lender"><TextInput value={String(v.lenderName ?? '')} onChange={val => { const next = [...list]; next[i] = { ...next[i], lenderName: val }; set('vehicles', next); }} /></Field>
                      <Field label="Intent">
                        <SelectInput value={String(v.intent ?? '')} onChange={val => { const next = [...list]; next[i] = { ...next[i], intent: val }; set('vehicles', next); }} options={[
                          { value: 'keep',      label: 'Keep' },
                          { value: 'cramdown',  label: 'Cramdown' },
                          { value: 'surrender', label: 'Surrender' },
                        ]} />
                      </Field>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        );
      }

      // ── 8. Personal Property ────────────────────────────────────────────
      case 'personalProperty':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Total bank balances (all accounts)"><MoneyInput value={get('bankBalance')} onChange={v => set('bankBalance', v)} /></Field>
            <Field label="Total retirement balances (ERISA)"><MoneyInput value={get('retirementBalance')} onChange={v => set('retirementBalance', v)} /></Field>
            <Field label="Has stocks / brokerage?"><YesNo value={get('hasStocks')} onChange={v => set('hasStocks', v)} /></Field>
            {get('hasStocks') === 'yes' && <Field label="Stocks value"><MoneyInput value={get('stocksValue')} onChange={v => set('stocksValue', v)} /></Field>}
            <Field label="Has crypto?"><YesNo value={get('hasCrypto')} onChange={v => set('hasCrypto', v)} /></Field>
            {get('hasCrypto') === 'yes' && <Field label="Crypto value"><MoneyInput value={get('cryptoValue')} onChange={v => set('cryptoValue', v)} /></Field>}
            <Field label="Has life insurance?"><YesNo value={get('hasLifeInsurance')} onChange={v => set('hasLifeInsurance', v)} /></Field>
            {get('hasLifeInsurance') === 'yes' && <Field label="Life insurance cash value (combined)"><MoneyInput value={get('lifeInsuranceCashValue')} onChange={v => set('lifeInsuranceCashValue', v)} /></Field>}
            <Field label="Has firearms?"><YesNo value={get('hasFirearms')} onChange={v => set('hasFirearms', v)} /></Field>
            {get('hasFirearms') === 'yes' && <Field label="Firearm value (combined estimate)"><MoneyInput value={get('firearmValue')} onChange={v => set('firearmValue', v)} /></Field>}
            <Field label="Has collectibles?"><YesNo value={get('hasCollectibles')} onChange={v => set('hasCollectibles', v)} /></Field>
            {get('hasCollectibles') === 'yes' && <Field label="Collectibles value"><MoneyInput value={get('collectiblesValue')} onChange={v => set('collectiblesValue', v)} /></Field>}
            <Field label="Household goods (estimate)"><MoneyInput value={get('householdGoodsValue')} onChange={v => set('householdGoodsValue', v)} /></Field>
            <Field label="Jewelry"><MoneyInput value={get('jewelryValue')} onChange={v => set('jewelryValue', v)} /></Field>
            <Field label="Tools of trade"><MoneyInput value={get('toolsValue')} onChange={v => set('toolsValue', v)} /></Field>
            <Field label="Other personal property (description)"><TextArea value={get('otherPersonalPropDesc')} onChange={v => set('otherPersonalPropDesc', v)} /></Field>
          </div>
        );

      // ── 9. Annuities ───────────────────────────────────────────────────
      case 'annuities': {
        const list = arr<Record<string, unknown>>(fd, 'annuities');
        return (
          <div className="space-y-3">
            <Field label="Has annuities?"><YesNo value={get('hasAnnuities')} onChange={v => {
              set('hasAnnuities', v);
              if (v === 'yes' && list.length === 0) set('annuities', [{ annuityType: '', issuerName: '', currentValue: '', yearsHeld: '', beneficiary: '', purchaseDate: '' }]);
            }} /></Field>
            {get('hasAnnuities') === 'yes' && (
              <>
                {list.map((a, i) => (
                  <div key={i} className="rounded border border-slate-800 bg-slate-900/40 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Annuity {i + 1}</p>
                      <button type="button" onClick={() => set('annuities', list.filter((_, j) => j !== i))} className="text-rose-400 hover:text-rose-300"><Trash2 size={12} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Type"><TextInput value={String(a.annuityType ?? '')} onChange={val => { const next = [...list]; next[i] = { ...next[i], annuityType: val }; set('annuities', next); }} /></Field>
                      <Field label="Issuer"><TextInput value={String(a.issuerName ?? '')} onChange={val => { const next = [...list]; next[i] = { ...next[i], issuerName: val }; set('annuities', next); }} /></Field>
                      <Field label="Current value"><MoneyInput value={String(a.currentValue ?? '')} onChange={val => { const next = [...list]; next[i] = { ...next[i], currentValue: val }; set('annuities', next); }} /></Field>
                      <Field label="Years held"><TextInput value={String(a.yearsHeld ?? '')} onChange={val => { const next = [...list]; next[i] = { ...next[i], yearsHeld: val }; set('annuities', next); }} /></Field>
                      <Field label="Beneficiary" hint="AZ § 20-1131(D): spouse/dependent beneficiary + 2y ownership = exempt"><TextInput value={String(a.beneficiary ?? '')} onChange={val => { const next = [...list]; next[i] = { ...next[i], beneficiary: val }; set('annuities', next); }} /></Field>
                      <Field label="Purchase date"><TextInput type="date" value={String(a.purchaseDate ?? '')} onChange={val => { const next = [...list]; next[i] = { ...next[i], purchaseDate: val }; set('annuities', next); }} /></Field>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => set('annuities', [...list, { annuityType: '', issuerName: '', currentValue: '', yearsHeld: '', beneficiary: '', purchaseDate: '' }])}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 rounded px-2 py-1">
                  <Plus size={12} /> Add annuity
                </button>
              </>
            )}
          </div>
        );
      }

      // ── 10. Consumer Debts ─────────────────────────────────────────────
      case 'debts': {
        const pri = arr<Record<string, unknown>>(fd, 'priorityDebts');
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Total secured debt (aggregate)" hint="Mortgages + vehicle loans + other secured"><MoneyInput value={get('securedDebt')} onChange={v => set('securedDebt', v)} /></Field>
              <Field label="Credit card debt"><MoneyInput value={get('creditCardDebt')} onChange={v => set('creditCardDebt', v)} /></Field>
              <Field label="Medical debt"><MoneyInput value={get('medicalDebt')} onChange={v => set('medicalDebt', v)} /></Field>
              <Field label="Student loan debt"><MoneyInput value={get('studentLoanDebt')} onChange={v => set('studentLoanDebt', v)} /></Field>
              <Field label="Tax debt (personal income tax on wages)"><MoneyInput value={get('taxDebt')} onChange={v => set('taxDebt', v)} /></Field>
              <Field label="Personal loans / other unsecured consumer debt" hint="Do NOT include business or SBA loans — list those under Business Debts. The means-test bypass depends on this distinction.">
                <MoneyInput value={get('personalLoanDebt')} onChange={v => set('personalLoanDebt', v)} />
              </Field>
              <Field label="Other unsecured"><MoneyInput value={get('otherUnsecured')} onChange={v => set('otherUnsecured', v)} /></Field>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/40 p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Priority debts</p>
              {pri.map((p, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <TextInput value={String(p.creditor ?? '')} onChange={v => { const next = [...pri]; next[i] = { ...next[i], creditor: v }; set('priorityDebts', next); }} placeholder="Creditor" />
                  <MoneyInput value={String(p.amount ?? '')} onChange={v => { const next = [...pri]; next[i] = { ...next[i], amount: v }; set('priorityDebts', next); }} />
                  <TextInput value={String(p.type ?? '')} onChange={v => { const next = [...pri]; next[i] = { ...next[i], type: v }; set('priorityDebts', next); }} placeholder="Type (e.g., income_tax_2024)" />
                </div>
              ))}
              <button type="button" onClick={() => set('priorityDebts', [...pri, { creditor: '', amount: '', type: '' }])}
                className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 rounded px-2 py-1">
                <Plus size={11} /> Add priority debt
              </button>
            </div>
          </div>
        );
      }

      // ── 11. DSO & Garnishment ──────────────────────────────────────────
      case 'dsoGarnishment':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Monthly child support paid"><MoneyInput value={get('childSupport')} onChange={v => set('childSupport', v)} /></Field>
            <Field label="Monthly alimony paid"><MoneyInput value={get('alimony')} onChange={v => set('alimony', v)} /></Field>
            <Field label="Has past-due DSO arrears?"><YesNo value={get('dsoArrears')} onChange={v => set('dsoArrears', v)} /></Field>
            {get('dsoArrears') === 'yes' && <Field label="DSO arrears amount"><MoneyInput value={get('dsoArrearsAmount')} onChange={v => set('dsoArrearsAmount', v)} /></Field>}
            <Field label="Active wage garnishment?"><YesNo value={get('garnishment')} onChange={v => set('garnishment', v)} /></Field>
            {get('garnishment') === 'yes' && (
              <>
                <Field label="Garnishment creditor"><TextInput value={get('garnishmentCreditor')} onChange={v => set('garnishmentCreditor', v)} /></Field>
                <Field label="Garnishment / mo"><MoneyInput value={get('garnishmentMonthlyAmount')} onChange={v => set('garnishmentMonthlyAmount', v)} /></Field>
              </>
            )}
          </div>
        );

      // ── 12. Business (NEW — closes the bypass gap) ─────────────────────
      case 'business':
        return (
          <div className="space-y-3">
            <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="flex items-start gap-2">
                <Briefcase size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <div className="text-[11px] text-emerald-200/90 leading-relaxed">
                  <p className="font-semibold">§ 707(b)(1) primarily-business-debt bypass</p>
                  <p className="mt-0.5">
                    When the sum of the five business-debt fields below exceeds 50% of total debt, the means test does
                    not apply and Chapter 7 is available regardless of income. Be specific about each category — the
                    classification drives the eligibility recommendation.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Has owned a business in the last 4 years?"><YesNo value={get('ownedBusiness')} onChange={v => set('ownedBusiness', v)} /></Field>
              <Field label="Business details" hint="Entity name, role, status (operating/closed), dates"><TextArea value={get('businessDetails')} onChange={v => set('businessDetails', v)} rows={3} /></Field>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 pt-2">Business debts</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="SBA / other business-loan balance" hint="7(a), EIDL, microloans, personal guarantees on biz loans"><MoneyInput value={get('otherBusinessDebt')} onChange={v => set('otherBusinessDebt', v)} /></Field>
              <Field label="Business credit card debt" hint="Cards used for business purchases (even if in personal name)"><MoneyInput value={get('businessCreditCardDebt')} onChange={v => set('businessCreditCardDebt', v)} /></Field>
              <Field label="Business real-estate mortgage" hint="Commercial / investment property mortgage"><MoneyInput value={get('businessMortgageDebt')} onChange={v => set('businessMortgageDebt', v)} /></Field>
              <Field label="Business equipment financing" hint="Presses, vehicles, machinery"><MoneyInput value={get('businessEquipmentDebt')} onChange={v => set('businessEquipmentDebt', v)} /></Field>
              <Field label="Supply / vendor / trade payables"><MoneyInput value={get('supplyVendorDebt')} onChange={v => set('supplyVendorDebt', v)} /></Field>
            </div>
          </div>
        );

      // ── 13. Financial History (SOFA subset) ────────────────────────────
      case 'history': {
        const priors = arr<Record<string, unknown>>(fd, 'priorBankruptcies');
        const xfers  = arr<Record<string, unknown>>(fd, 'transfers');
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Prior bankruptcy filed?"><YesNo value={get('priorBankruptcy')} onChange={v => {
                set('priorBankruptcy', v);
                if (v === 'yes' && priors.length === 0) set('priorBankruptcies', [{ chapter: '', yearFiled: '', discharged: '', dischargeDate: '' }]);
              }} /></Field>
              <Field label="Pending lawsuits?"><YesNo value={get('pendingLawsuits')} onChange={v => set('pendingLawsuits', v)} /></Field>
              <Field label="Property transfers in last 2 years (§ 548)?"><YesNo value={get('transferredProperty')} onChange={v => {
                set('transferredProperty', v);
                if (v === 'yes' && xfers.length === 0) set('transfers', [{ description: '', recipient: '', amount: '', date: '' }]);
              }} /></Field>
              <Field label="Preferential payments (90-day non-insider)?"><YesNo value={get('preferentialPayments')} onChange={v => set('preferentialPayments', v)} /></Field>
              <Field label="Insider preferential payments (1-year)?"><YesNo value={get('preferentialPaymentsInsider')} onChange={v => set('preferentialPaymentsInsider', v)} /></Field>
              <Field label="Luxury purchases > $800 in 90 days (§ 523(a)(2)(C))?"><YesNo value={get('recentLuxury')} onChange={v => set('recentLuxury', v)} /></Field>
              <Field label="Cash advance > $1,100 in 70 days?"><YesNo value={get('recentCashAdvance')} onChange={v => set('recentCashAdvance', v)} /></Field>
            </div>
            {get('priorBankruptcy') === 'yes' && (
              <div className="rounded border border-slate-800 bg-slate-900/40 p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Prior filings — eligibility timing</p>
                {priors.map((p, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2">
                    <SelectInput value={String(p.chapter ?? '')} onChange={v => { const next = [...priors]; next[i] = { ...next[i], chapter: v }; set('priorBankruptcies', next); }} options={[{value:'7',label:'Ch.7'},{value:'13',label:'Ch.13'},{value:'11',label:'Ch.11'}]} />
                    <TextInput value={String(p.yearFiled ?? '')} onChange={v => { const next = [...priors]; next[i] = { ...next[i], yearFiled: v }; set('priorBankruptcies', next); }} placeholder="Year filed" />
                    <SelectInput value={String(p.discharged ?? '')} onChange={v => { const next = [...priors]; next[i] = { ...next[i], discharged: v }; set('priorBankruptcies', next); }} options={[{value:'yes',label:'Discharged'},{value:'no',label:'Not discharged'}]} />
                    <TextInput type="date" value={String(p.dischargeDate ?? '')} onChange={v => { const next = [...priors]; next[i] = { ...next[i], dischargeDate: v }; set('priorBankruptcies', next); }} />
                  </div>
                ))}
              </div>
            )}
            {get('pendingLawsuits') === 'yes' && (
              <Field label="Lawsuit details"><TextArea value={get('lawsuitDetails')} onChange={v => set('lawsuitDetails', v)} rows={2} /></Field>
            )}
            {get('transferredProperty') === 'yes' && (
              <div className="rounded border border-slate-800 bg-slate-900/40 p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Transfers</p>
                {xfers.map((t, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2">
                    <TextInput value={String(t.description ?? '')} onChange={v => { const next = [...xfers]; next[i] = { ...next[i], description: v }; set('transfers', next); }} placeholder="Description" />
                    <TextInput value={String(t.recipient ?? '')} onChange={v => { const next = [...xfers]; next[i] = { ...next[i], recipient: v }; set('transfers', next); }} placeholder="Recipient" />
                    <MoneyInput value={String(t.amount ?? '')} onChange={v => { const next = [...xfers]; next[i] = { ...next[i], amount: v }; set('transfers', next); }} />
                    <TextInput type="date" value={String(t.date ?? '')} onChange={v => { const next = [...xfers]; next[i] = { ...next[i], date: v }; set('transfers', next); }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      // ── 14. Refund ─────────────────────────────────────────────────────
      case 'refund':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Expecting a tax refund?"><YesNo value={get('expectedRefund')} onChange={v => set('expectedRefund', v)} /></Field>
            {get('expectedRefund') === 'yes' && <Field label="Refund amount"><MoneyInput value={get('refundAmount')} onChange={v => set('refundAmount', v)} /></Field>}
          </div>
        );

      default:
        return null;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#0F0F0E] text-[#FAFAF7] min-h-full flex flex-col">
      {/* Section indicator */}
      <div className="sticky top-0 z-10 bg-[#0F0F0E] border-b border-[#2A2A28] px-5 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {current.icon}
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
              Section {sectionIdx + 1} / {SECTIONS.length}
            </span>
          </div>
          <h2 className="text-sm font-semibold text-white">{current.title}</h2>
          <div className="ml-auto flex items-center gap-1 overflow-x-auto">
            {SECTIONS.map((s, i) => (
              <button key={s.id} type="button" onClick={() => setSectionIdx(i)}
                className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded ${
                  i === sectionIdx
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : i < sectionIdx
                      ? 'text-emerald-500 hover:text-emerald-300'
                      : 'text-slate-600 hover:text-slate-400'
                }`}
                title={s.title}>
                {i < sectionIdx ? <Check size={9} /> : i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <p className="text-[12px] text-slate-400 italic mb-3 leading-relaxed">{current.flowScript}</p>
        {renderSection()}

        {/* Mandatory-answer banner — only renders when the current section
            has unfilled required fields. The Next / Complete button is
            disabled until this list clears. Per firm spec: every answer
            is mandatory and cannot be left blank. */}
        {missingKeys.length > 0 && (
          <div className="mt-5 rounded-xl border border-rose-500/40 bg-rose-500/8 p-4">
            <div className="flex items-start gap-2 mb-2">
              <AlertCircle size={14} className="text-rose-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[12px] font-bold text-rose-200">
                  {missingKeys.length} required answer{missingKeys.length === 1 ? '' : 's'} missing on this section
                </p>
                <p className="text-[10.5px] text-rose-200/80 leading-relaxed mt-0.5">
                  Every question on this section must be answered before moving on.
                  Money fields accept <span className="font-mono">0</span> as a valid answer.
                </p>
              </div>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
              {missingKeys.map(k => (
                <li key={k} className="text-[11px] text-rose-200/90 list-disc list-inside">
                  {KEY_LABELS[k] ?? k}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="sticky bottom-0 bg-[#0F0F0E] border-t border-[#2A2A28] px-5 py-3 flex items-center gap-2">
        <button type="button" onClick={back}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-3 py-2">
          <ArrowLeft size={14} /> {canBack ? 'Back' : (onCancel ? 'Back to intro' : 'Back')}
        </button>
        <div className="ml-auto flex items-center gap-2">
          {!isLast ? (
            <button type="button" onClick={next} disabled={!canAdvance}
              title={canAdvance ? '' : `Fill the ${missingKeys.length} required answer${missingKeys.length === 1 ? '' : 's'} listed below to continue.`}
              className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-4 py-2 transition-colors ${
                canAdvance
                  ? 'bg-amber-500 text-[#0F0F0E] hover:bg-amber-400'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}>
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button type="button" onClick={submitFinal} disabled={!canAdvance}
              title={canAdvance ? '' : `Fill the ${missingKeys.length} required answer${missingKeys.length === 1 ? '' : 's'} listed below to submit.`}
              className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-4 py-2 transition-colors ${
                canAdvance
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}>
              Complete determination <ChevronUp size={14} className="rotate-90" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
