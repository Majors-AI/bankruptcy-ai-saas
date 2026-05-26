import { useState, useMemo } from "react";
import {
  Scale, User, Users, Home, Briefcase, CreditCard, FileText,
  ChevronRight, ChevronLeft, CheckCircle2, AlertTriangle, ArrowRight,
  Info, Heart, Building, Car, PiggyBank, ReceiptText, Landmark,
  DollarSign, Plus, Trash2, Shield, Clock, Gavel, MapPin,
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
  "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio",
  "Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
  "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
  "Wisconsin","Wyoming","District of Columbia",
];

// ── Types ──────────────────────────────────────────────────────────────────────

type FilingType = "individual" | "individual-nonfiling-spouse" | "joint";

interface PriorResidence {
  id: number;
  state: string;
  city: string;
  fromDate: string; // YYYY-MM
  toDate: string;   // YYYY-MM
}

interface DependentIncomeSource {
  sourceType: string;   // "employed" | "self_employed" | "retirement" | "social_security" | "ssdi" | "ssi" | "other"
  employer: string;
  grossMonthly: string;
}

interface Dependent {
  id: number;
  relationship: string;
  age: string;
  name: string;
  disabled: boolean;
  disabledDesc: string;
  monthlyContribution: string;
  contributesToHousehold: string;  // "yes" | "no"
  incomeSources: DependentIncomeSource[];
}

interface IncomeSource {
  id: number;
  person: "debtor" | "spouse" | "household";
  personLabel: string;
  sourceType: string;
  employerOrSource: string;
  payFrequency: string;
  grossPerPeriod: string;
  netPerPeriod: string;
}

interface RealProperty {
  id: number;
  address: string;
  type: string;
  value: string;
  mortgageBalance: string;
  lender: string;
  isCurrent: string;
}

interface Vehicle {
  id: number;
  year: string;
  make: string;
  model: string;
  value: string;
  hasLoan: string;
  loanBalance: string;
}

interface PriorBKCase {
  id: number;
  chapter: string;
  yearFiled: string;
  district: string;
  discharged: string;
  dismissedReason: string;
  caseNumber: string;
}

interface Transfer {
  id: number;
  description: string;
  recipient: string;
  relationship: string;
  amount: string;
  date: string;
  transferType: string;
}

interface PreferentialPayment {
  id: number;
  creditor: string;
  amount: string;
  date: string;
  relationship: string;
}

interface FormData {
  // Step 0 — Filing type & residency
  filingType: FilingType | "";
  state: string;
  county: string;
  city: string;
  streetAddress: string;
  zipCode: string;
  movedToStateDate: string;      // YYYY-MM — when they moved to current state
  inStateOver2Years: string;     // "yes" | "no" — shortcut question
  priorResidences: PriorResidence[];
  // computed / display — not stored separately
  exemptionState: string;        // resolved state whose exemptions apply

  // Step 1 — Debtor identity
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  dob: string;
  ssn: string;
  email: string;
  phone: string;
  altPhone: string;

  // Spouse identity (conditional)
  spouseFirstName: string;
  spouseMiddleName: string;
  spouseLastName: string;
  spouseDob: string;
  spouseEmail: string;
  spousePhone: string;

  // Step 2 — Household & dependents
  maritalStatus: string;
  dependents: Dependent[];

  // Step 3 — Income
  incomeSources: IncomeSource[];
  hasOtherHouseholdMembers: string;
  avgMonthly6: string;

  // Step 4 — Monthly expenses
  expRentMortgage: string;
  expUtilities: string;
  expFood: string;
  expTransportation: string;
  expHealthcare: string;
  expInsurance: string;
  expChildcare: string;
  expOtherExpenses: string;
  expOtherDesc: string;

  // Step 5 — Real property
  realProperties: RealProperty[];
  ownsRealEstate: string;

  // Step 6 — Personal property
  vehicles: Vehicle[];
  noVehicles: boolean;
  bankBalance: string;
  retirementBalance: string;
  hasStocks: string;
  stocksValue: string;
  hasCrypto: string;
  cryptoValue: string;
  hasLifeInsurance: string;
  lifeInsuranceCashValue: string;
  hasFirearms: string;
  firearmValue: string;
  hasCollectibles: string;
  collectiblesValue: string;
  householdGoodsValue: string;
  otherPropertyDesc: string;

  // Step 7 — Debts
  securedDebt: string;
  creditCardDebt: string;
  medicalDebt: string;
  studentLoanDebt: string;
  taxDebt: string;
  personalLoanDebt: string;
  otherUnsecured: string;
  primaryReason: string;

  // Step 8 — Financial history / SOFA
  priorBankruptcies: PriorBKCase[];
  hasPriorBK: string;
  pendingLawsuits: string;
  lawsuitDetails: string;
  garnishment: string;
  garnishmentDetails: string;
  hasTransfers: string;
  transfers: Transfer[];
  hasPreferentialPayments: string;
  preferentialPayments: PreferentialPayment[];
  ownedBusiness: string;
  businessDetails: string;
  expectedRefund: string;
  refundAmount: string;
  recentLuxury: string;
  luxuryDetails: string;
}

const mkDependentIncomeSource = (): DependentIncomeSource => ({
  sourceType: "", employer: "", grossMonthly: "",
});

const mkDependent = (id: number): Dependent => ({
  id, relationship: "", age: "", name: "", disabled: false, disabledDesc: "",
  monthlyContribution: "", contributesToHousehold: "", incomeSources: [],
});

const mkIncomeSource = (id: number, person: "debtor" | "spouse" | "household" = "debtor"): IncomeSource => ({
  id, person, personLabel: person === "debtor" ? "Debtor" : person === "spouse" ? "Spouse" : "Household Member",
  sourceType: "", employerOrSource: "", payFrequency: "", grossPerPeriod: "", netPerPeriod: "",
});

const mkProperty = (id: number): RealProperty => ({
  id, address: "", type: "", value: "", mortgageBalance: "", lender: "", isCurrent: "",
});

const mkVehicle = (id: number): Vehicle => ({
  id, year: "", make: "", model: "", value: "", hasLoan: "", loanBalance: "",
});

const mkBKCase = (id: number): PriorBKCase => ({
  id, chapter: "", yearFiled: "", district: "", discharged: "", dismissedReason: "", caseNumber: "",
});

const mkTransfer = (id: number): Transfer => ({
  id, description: "", recipient: "", relationship: "", amount: "", date: "", transferType: "",
});

const mkPrefPayment = (id: number): PreferentialPayment => ({
  id, creditor: "", amount: "", date: "", relationship: "",
});

const mkPriorResidence = (id: number): PriorResidence => ({
  id, state: "", city: "", fromDate: "", toDate: "",
});

// ── Exemption window calculator ────────────────────────────────────────────────
// 11 U.S.C. § 522(b)(3)(A): exemptions are governed by the state where the
// debtor was domiciled for the 2 years (730 days) before filing.
// If the debtor has NOT lived in the current state for 2 full years, we look
// at the 6-month window that ends exactly 2 years before the filing date
// (i.e., the period from 2½ years ago to 2 years ago). Whichever state the
// debtor lived in for the greater portion of that 6-month window governs.
//
// We use EXACT calendar arithmetic (year/month subtraction) so the window
// always lands on clean month boundaries. TODAY is the proxy for filing date.
function getExemptionWindow(): { twoYearsAgo: Date; twoAndHalfYearsAgo: Date } {
  const today = new Date();
  // Exactly 2 years back — same month/day, 2 years prior
  const twoYearsAgo = new Date(today);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  // Exactly 6 months before that
  const twoAndHalfYearsAgo = new Date(twoYearsAgo);
  twoAndHalfYearsAgo.setMonth(twoAndHalfYearsAgo.getMonth() - 6);
  return { twoYearsAgo, twoAndHalfYearsAgo };
}

function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function fmtDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Compute how many days in [windowStart, windowEnd) a given prior residence covers
function daysInWindow(fromStr: string, toStr: string, windowStart: Date, windowEnd: Date): number {
  if (!fromStr) return 0;
  const from = new Date(fromStr + "-01");
  // If toStr is empty it means "present" — use windowEnd as cap
  const to = toStr ? new Date(toStr + "-01") : new Date(windowEnd);
  // Clamp to window
  const start = from < windowStart ? windowStart : from;
  const end   = to   > windowEnd   ? windowEnd   : to;
  if (start >= end) return 0;
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function computeMajorityState(priorResidences: PriorResidence[], windowStart: Date, windowEnd: Date): string {
  const daysPerState: Record<string, number> = {};
  for (const r of priorResidences) {
    if (!r.state) continue;
    const d = daysInWindow(r.fromDate, r.toDate, windowStart, windowEnd);
    daysPerState[r.state] = (daysPerState[r.state] ?? 0) + d;
  }
  let best = "";
  let bestDays = 0;
  for (const [st, days] of Object.entries(daysPerState)) {
    if (days > bestDays) { bestDays = days; best = st; }
  }
  return best;
}

function computeExemptionState(data: FormData): {
  exemptionState: string;
  reason: string;
  windowStart: Date;
  windowEnd: Date;
  inCurrentStateFullPeriod: boolean;
  majorityDays: number;
  windowTotalDays: number;
} {
  const { twoYearsAgo, twoAndHalfYearsAgo } = getExemptionWindow();
  const windowStart = twoAndHalfYearsAgo;
  const windowEnd   = twoYearsAgo;
  const windowTotalDays = Math.round((windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24));

  if (data.inStateOver2Years === "yes") {
    return {
      exemptionState: data.state,
      reason: `You have lived in ${data.state} for the full 2-year period — ${data.state} exemptions apply.`,
      windowStart, windowEnd, inCurrentStateFullPeriod: true,
      majorityDays: windowTotalDays, windowTotalDays,
    };
  }

  if (data.inStateOver2Years === "no" && data.movedToStateDate) {
    const movedIn = new Date(data.movedToStateDate + "-01");

    if (movedIn <= twoYearsAgo) {
      return {
        exemptionState: data.state,
        reason: `Your move-in date (${fmtMonthYear(movedIn)}) is on or before the 2-year mark (${fmtMonthYear(twoYearsAgo)}), so ${data.state} exemptions apply.`,
        windowStart, windowEnd, inCurrentStateFullPeriod: true,
        majorityDays: windowTotalDays, windowTotalDays,
      };
    }

    // They moved in after the 2-year mark — compute majority from actual address history
    if (data.priorResidences.length > 0) {
      const majorityState = computeMajorityState(data.priorResidences, windowStart, windowEnd);
      if (majorityState) {
        const majorityDays = Math.round(
          data.priorResidences
            .filter(r => r.state === majorityState)
            .reduce((s, r) => s + daysInWindow(r.fromDate, r.toDate, windowStart, windowEnd), 0)
        );
        const isCurrent = majorityState === data.state;
        return {
          exemptionState: majorityState,
          reason: `You moved to ${data.state} in ${fmtMonthYear(movedIn)}, after the 2-year mark (${fmtMonthYear(twoYearsAgo)}). Based on your address history, you lived in ${majorityState} for approximately ${majorityDays} of the 180-day lookback window (${fmtMonthYear(windowStart)} – ${fmtMonthYear(windowEnd)}) — ${majorityState} exemptions apply.${isCurrent ? "" : " Your attorney will verify this before filing."}`,
          windowStart, windowEnd, inCurrentStateFullPeriod: false,
          majorityDays, windowTotalDays,
        };
      }
    }

    return {
      exemptionState: "", reason: "",
      windowStart, windowEnd, inCurrentStateFullPeriod: false,
      majorityDays: 0, windowTotalDays,
    };
  }

  return {
    exemptionState: data.state || "", reason: "",
    windowStart, windowEnd, inCurrentStateFullPeriod: false,
    majorityDays: 0, windowTotalDays,
  };
}

const INITIAL: FormData = {
  filingType: "", state: "", county: "", city: "", streetAddress: "", zipCode: "",
  movedToStateDate: "", inStateOver2Years: "", priorResidences: [], exemptionState: "",
  firstName: "", middleName: "", lastName: "", suffix: "", dob: "", ssn: "", email: "", phone: "", altPhone: "",
  spouseFirstName: "", spouseMiddleName: "", spouseLastName: "", spouseDob: "", spouseEmail: "", spousePhone: "",
  maritalStatus: "", dependents: [],
  incomeSources: [mkIncomeSource(1, "debtor")], hasOtherHouseholdMembers: "", avgMonthly6: "",
  expRentMortgage: "", expUtilities: "", expFood: "", expTransportation: "", expHealthcare: "",
  expInsurance: "", expChildcare: "", expOtherExpenses: "", expOtherDesc: "",
  ownsRealEstate: "", realProperties: [],
  vehicles: [], noVehicles: false,
  bankBalance: "", retirementBalance: "", hasStocks: "", stocksValue: "", hasCrypto: "", cryptoValue: "",
  hasLifeInsurance: "", lifeInsuranceCashValue: "", hasFirearms: "", firearmValue: "",
  hasCollectibles: "", collectiblesValue: "", householdGoodsValue: "", otherPropertyDesc: "",
  securedDebt: "", creditCardDebt: "", medicalDebt: "", studentLoanDebt: "", taxDebt: "",
  personalLoanDebt: "", otherUnsecured: "", primaryReason: "",
  hasPriorBK: "", priorBankruptcies: [],
  pendingLawsuits: "", lawsuitDetails: "", garnishment: "", garnishmentDetails: "",
  hasTransfers: "", transfers: [], hasPreferentialPayments: "", preferentialPayments: [],
  ownedBusiness: "", businessDetails: "", expectedRefund: "", refundAmount: "",
  recentLuxury: "", luxuryDetails: "",
};

const STEPS = [
  { id: "residency",   label: "Residency",          icon: Home },
  { id: "identity",    label: "Identity",            icon: User },
  { id: "household",   label: "Household",           icon: Users },
  { id: "income",      label: "Income",              icon: Briefcase },
  { id: "expenses",    label: "Expenses",            icon: ReceiptText },
  { id: "real-prop",   label: "Real Property",       icon: Building },
  { id: "personal-prop", label: "Personal Property", icon: PiggyBank },
  { id: "debts",       label: "Debts",               icon: CreditCard },
  { id: "history",     label: "Financial History",   icon: FileText },
  { id: "review",      label: "Review & Submit",     icon: CheckCircle2 },
];

// ── Shared UI ──────────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">
      {children}{required && <span className="text-red-400 ml-1">*</span>}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-4 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-400/60 focus:bg-slate-800 transition-all"
    />
  );
}

function StyledSelect({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-400/60 focus:bg-slate-800 transition-all appearance-none"
    >
      {children}
    </select>
  );
}

function StyledTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-4 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-400/60 focus:bg-slate-800 transition-all resize-none"
    />
  );
}

function YesNo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {["yes", "no"].map(v => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
            value === v
              ? "bg-amber-400/15 border-amber-400/50 text-amber-300"
              : "bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300"
          }`}>
          {v === "yes" ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

function SectionHead({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/25 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-amber-400" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Georgia', serif" }}>{title}</h2>
        {sub && <p className="text-sm text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function InfoBox({ children, variant = "sky" }: { children: React.ReactNode; variant?: "sky" | "amber" | "red" }) {
  const colors = {
    sky:   "bg-sky-500/8 border-sky-500/20 text-sky-200/80",
    amber: "bg-amber-400/8 border-amber-400/20 text-amber-200/80",
    red:   "bg-red-500/8 border-red-500/25 text-red-200/80",
  };
  const icons = { sky: Info, amber: AlertTriangle, red: AlertTriangle };
  const IconComp = icons[variant];
  return (
    <div className={`flex items-start gap-2.5 border rounded-xl px-4 py-3 mb-5 ${colors[variant]}`}>
      <IconComp className="w-4 h-4 flex-shrink-0 mt-0.5 opacity-80" />
      <p className="text-xs leading-relaxed">{children}</p>
    </div>
  );
}

function CardRow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 space-y-3 ${className}`}>
      {children}
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 text-xs font-semibold text-amber-400 hover:text-amber-300 border border-dashed border-amber-400/30 hover:border-amber-400/60 px-3 py-2 rounded-xl transition-all mt-2">
      <Plus className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1 text-xs font-semibold text-red-400/70 hover:text-red-400 transition-colors ml-auto">
      <Trash2 className="w-3 h-3" /> Remove
    </button>
  );
}

// ── Step 0: Residency & Filing Type ───────────────────────────────────────────

function StepResidency({ data, set }: { data: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  // Compute exact calendar window once per render
  const { twoYearsAgo, twoAndHalfYearsAgo } = getExemptionWindow();
  const windowLabel = `${fmtMonthYear(twoAndHalfYearsAgo)} – ${fmtMonthYear(twoYearsAgo)}`;

  const exemptionResult = useMemo(() => computeExemptionState(data), [
    data.state, data.inStateOver2Years, data.movedToStateDate,
    data.priorResidences,
  ]);

  // Whether the debtor moved into the current state AFTER the 2-year mark
  // (meaning the lookback window question is relevant)
  const movedAfterTwoYearMark =
    data.inStateOver2Years === "no" &&
    data.movedToStateDate &&
    new Date(data.movedToStateDate + "-01") > twoYearsAgo;

  return (
    <div>
      <SectionHead icon={Home} title="Residency & Filing Type"
        sub="Determines where you file and which state's exemptions protect your property." />

      {/* Filing type selection */}
      <div className="space-y-3 mb-7">
        <FieldLabel required>What is your marital and filing status?</FieldLabel>
        <p className="text-xs text-slate-500 -mt-1 mb-2">This cannot be changed after you begin. Choose carefully — it determines which sections apply to your case.</p>
        {([
          {
            value: "individual",
            label: "Single / Unmarried",
            sub: "You are not currently married — filing on your own.",
            badge: null,
          },
          {
            value: "individual-nonfiling-spouse",
            label: "Married — My Spouse Does Not Want to File",
            sub: "You are married but filing alone. Your spouse's income and assets may still be relevant to the means test and household calculation.",
            badge: "married",
          },
          {
            value: "joint",
            label: "Married — Filing Jointly with My Spouse",
            sub: "Both spouses are filing together in a single joint bankruptcy case.",
            badge: "married",
          },
        ] as { value: FilingType; label: string; sub: string; badge: string | null }[]).map(opt => (
          <button key={opt.value} type="button"
            onClick={() => set("filingType", opt.value)}
            className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all ${
              data.filingType === opt.value
                ? "bg-amber-400/10 border-amber-400/40 text-white"
                : "bg-slate-800/40 border-slate-700 text-slate-300 hover:border-slate-600"
            }`}>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">{opt.label}</p>
              {opt.badge === "married" && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/25 uppercase tracking-wide">Married</span>
              )}
              {data.filingType === opt.value && (
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/25 uppercase tracking-wide flex items-center gap-1">
                  Selected
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{opt.sub}</p>
          </button>
        ))}
      </div>

      {/* Current address */}
      <div className="mb-4">
        <FieldLabel required>Current Street Address</FieldLabel>
        <TextInput value={data.streetAddress} onChange={e => set("streetAddress", e.target.value)} placeholder="1234 Main St" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="col-span-2 sm:col-span-1">
          <FieldLabel required>City</FieldLabel>
          <TextInput value={data.city} onChange={e => set("city", e.target.value)} placeholder="City" />
        </div>
        <div>
          <FieldLabel required>State</FieldLabel>
          <StyledSelect value={data.state} onChange={e => {
            set("state", e.target.value);
            set("inStateOver2Years", "");
            set("movedToStateDate", "");
            set("priorResidences", []);
          }}>
            <option value="">Select</option>
            {US_STATES.map(s => <option key={s}>{s}</option>)}
          </StyledSelect>
        </div>
        <div>
          <FieldLabel required>ZIP Code</FieldLabel>
          <TextInput value={data.zipCode} onChange={e => set("zipCode", e.target.value)} placeholder="00000" maxLength={10} />
        </div>
        <div>
          <FieldLabel>County</FieldLabel>
          <TextInput value={data.county} onChange={e => set("county", e.target.value)} placeholder="County" />
        </div>
      </div>

      {/* 2-year domicile question */}
      {data.state && (
        <div className="mb-5">
          <div className="flex items-start gap-2.5 bg-sky-500/8 border border-sky-500/20 rounded-xl px-4 py-3 mb-4">
            <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-sky-200/80 leading-relaxed">
              <strong className="text-white">Why this matters:</strong> Under 11 U.S.C. § 522(b)(3)(A), which state's exemptions apply is determined by where you lived for the <strong className="text-white">2 years before filing</strong>. If you have not been in {data.state} for 2 full years, we need to look back further.
            </div>
          </div>
          <FieldLabel required>Have you lived in {data.state} continuously for the past 2 years?</FieldLabel>
          <YesNo value={data.inStateOver2Years} onChange={v => {
            set("inStateOver2Years", v);
            if (v === "yes") {
              set("movedToStateDate", "");
              set("priorResidences", []);
            }
            if (v === "no" && data.priorResidences.length === 0) {
              set("priorResidences", [mkPriorResidence(Date.now())]);
            }
          }} />
        </div>
      )}

      {/* If NO — when did they move + majority state in the lookback window */}
      {data.inStateOver2Years === "no" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel required>When did you move to {data.state || "this state"}?</FieldLabel>
              <p className="text-xs text-slate-500 mb-1.5">Month and year</p>
              <TextInput
                type="month"
                value={data.movedToStateDate}
                onChange={e => set("movedToStateDate", e.target.value)}
                max={new Date().toISOString().slice(0, 7)}
              />
            </div>
          </div>

          {/* Only show the lookback window question if they moved in AFTER the 2-year mark */}
          {movedAfterTwoYearMark && (
            <>
              {/* Explain the window visually */}
              <div className="bg-amber-400/8 border border-amber-400/20 rounded-xl px-4 py-4">
                <div className="flex items-start gap-2.5 mb-3">
                  <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-300 uppercase tracking-wide mb-1">Prior Residency Lookback Required</p>
                    <p className="text-xs text-amber-200/80 leading-relaxed">
                      Because you moved to {data.state} after {fmtMonthYear(twoYearsAgo)}, federal law requires us to look at the <strong className="text-white">6-month period ending 2 years before today</strong> to determine which state's exemptions apply to your case.
                    </p>
                  </div>
                </div>

                {/* Visual timeline */}
                <div className="mt-3 flex items-center gap-0 text-[10px]">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-600 border-2 border-slate-500" />
                    <span className="text-slate-500 mt-1 whitespace-nowrap">{fmtMonthYear(twoAndHalfYearsAgo)}</span>
                  </div>
                  <div className="flex-1 mx-2 flex flex-col items-center gap-1">
                    <div className="w-full h-1.5 rounded-full bg-amber-400/40 relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-amber-300 bg-[#0a0e1a] px-1">6-month lookback window</span>
                      </div>
                    </div>
                    <span className="text-amber-400 font-semibold">{windowLabel}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-amber-300" />
                    <span className="text-amber-300 font-bold mt-1 whitespace-nowrap">{fmtMonthYear(twoYearsAgo)}</span>
                    <span className="text-slate-600 text-[9px]">2-yr mark</span>
                  </div>
                  <div className="flex-1 mx-2 h-px bg-slate-700" />
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-emerald-300" />
                    <span className="text-emerald-300 font-bold mt-1 whitespace-nowrap">Today</span>
                  </div>
                </div>
              </div>

              {/* Address history builder */}
              <div className="bg-[#0d1221] border border-slate-700 rounded-xl px-4 py-4 space-y-4">
                <div>
                  <p className="text-xs font-bold text-white mb-1">Prior Address History</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    List every address you lived at going back to at least <strong className="text-amber-300">{fmtMonthYear(twoAndHalfYearsAgo)}</strong>. Include the state and the dates you lived there. The system will automatically calculate which state's exemptions apply based on where you lived for the majority of the 180-day window.
                  </p>
                </div>

                {data.priorResidences.map((r, idx) => (
                  <div key={r.id} className="border border-slate-700/60 rounded-xl p-3 space-y-3 bg-slate-900/40">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Prior Address {idx + 1}</p>
                      {data.priorResidences.length > 1 && (
                        <button
                          type="button"
                          onClick={() => set("priorResidences", data.priorResidences.filter((_, i) => i !== idx))}
                          className="text-[10px] text-red-500 hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <FieldLabel required>State</FieldLabel>
                        <StyledSelect
                          value={r.state}
                          onChange={e => {
                            const list = [...data.priorResidences];
                            list[idx] = { ...list[idx], state: e.target.value };
                            set("priorResidences", list);
                          }}
                        >
                          <option value="">Select state</option>
                          {US_STATES.map(s => <option key={s}>{s}</option>)}
                        </StyledSelect>
                      </div>
                      <div>
                        <FieldLabel>City / County</FieldLabel>
                        <TextInput
                          value={r.city}
                          onChange={e => {
                            const list = [...data.priorResidences];
                            list[idx] = { ...list[idx], city: e.target.value };
                            set("priorResidences", list);
                          }}
                          placeholder="City or county"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel required>Moved In</FieldLabel>
                        <p className="text-[10px] text-slate-600 mb-1">Month &amp; Year</p>
                        <TextInput
                          type="month"
                          value={r.fromDate}
                          onChange={e => {
                            const list = [...data.priorResidences];
                            list[idx] = { ...list[idx], fromDate: e.target.value };
                            set("priorResidences", list);
                          }}
                          max={new Date().toISOString().slice(0, 7)}
                        />
                      </div>
                      <div>
                        <FieldLabel>Moved Out</FieldLabel>
                        <p className="text-[10px] text-slate-600 mb-1">Leave blank if current</p>
                        <TextInput
                          type="month"
                          value={r.toDate}
                          onChange={e => {
                            const list = [...data.priorResidences];
                            list[idx] = { ...list[idx], toDate: e.target.value };
                            set("priorResidences", list);
                          }}
                          max={new Date().toISOString().slice(0, 7)}
                        />
                      </div>
                    </div>
                    {/* Days in window indicator */}
                    {r.state && r.fromDate && (
                      (() => {
                        const d = daysInWindow(r.fromDate, r.toDate, twoAndHalfYearsAgo, twoYearsAgo);
                        if (d === 0) return null;
                        return (
                          <div className="flex items-center gap-2 text-[10px] text-amber-300 bg-amber-400/8 border border-amber-400/20 rounded-lg px-2.5 py-1.5">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span>{d} days of the 180-day lookback window spent in <strong>{r.state}</strong></span>
                          </div>
                        );
                      })()
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => set("priorResidences", [...data.priorResidences, mkPriorResidence(Date.now())])}
                  className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Another Prior Address
                </button>

                {/* Live majority state computation */}
                {data.priorResidences.some(r => r.state && r.fromDate) && (
                  (() => {
                    const majority = computeMajorityState(data.priorResidences, twoAndHalfYearsAgo, twoYearsAgo);
                    const majorityDays = majority ? Math.round(
                      data.priorResidences.filter(r => r.state === majority).reduce((s, r) => s + daysInWindow(r.fromDate, r.toDate, twoAndHalfYearsAgo, twoYearsAgo), 0)
                    ) : 0;
                    const windowTotalDays = Math.round((twoYearsAgo.getTime() - twoAndHalfYearsAgo.getTime()) / (1000 * 60 * 60 * 24));
                    if (!majority) return null;
                    return (
                      <div className="border border-amber-400/30 bg-amber-400/8 rounded-xl px-4 py-3 space-y-1">
                        <p className="text-xs font-bold text-amber-300">Computed Majority State: {majority}</p>
                        <p className="text-xs text-slate-400">{majorityDays} of {windowTotalDays} days ({Math.round(majorityDays / windowTotalDays * 100)}%) of the lookback window were spent in {majority}.</p>
                        <p className="text-[10px] text-slate-500 italic">This is calculated automatically from the dates you entered above. Your attorney will confirm before filing.</p>
                      </div>
                    );
                  })()
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Exemption state result card */}
      {exemptionResult.exemptionState && exemptionResult.reason && (
        <div className={`mt-6 border rounded-xl px-4 py-4 flex items-start gap-3 ${
          exemptionResult.inCurrentStateFullPeriod
            ? "bg-emerald-500/8 border-emerald-500/25"
            : "bg-sky-500/8 border-sky-500/25"
        }`}>
          <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${exemptionResult.inCurrentStateFullPeriod ? "text-emerald-400" : "text-sky-400"}`} />
          <div>
            <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${exemptionResult.inCurrentStateFullPeriod ? "text-emerald-300" : "text-sky-300"}`}>
              Applicable Exemption State: {exemptionResult.exemptionState}
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">{exemptionResult.reason}</p>
            <p className="text-xs text-slate-500 mt-1.5 italic">Preliminary — based on today as the estimated filing date. Your attorney will confirm before filing.</p>
          </div>
        </div>
      )}

      {/* Nudge when lookback answer is still needed */}
      {movedAfterTwoYearMark && !computeMajorityState(data.priorResidences, twoAndHalfYearsAgo, twoYearsAgo) && (
        <div className="mt-4 flex items-start gap-2.5 bg-amber-400/8 border border-amber-400/25 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200/80 leading-relaxed">
            Please add your prior addresses with move-in/move-out dates covering the period {windowLabel} so we can determine which state's exemptions apply.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Step 1: Identity ───────────────────────────────────────────────────────────

function StepIdentity({ data, set }: { data: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  const hasSpouse = data.filingType === "individual-nonfiling-spouse" || data.filingType === "joint";

  return (
    <div>
      <SectionHead icon={User} title="Personal Identification"
        sub="Legal names and contact information for all parties involved in the filing." />

      <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">Debtor</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div><FieldLabel required>First Name</FieldLabel><TextInput value={data.firstName} onChange={e => set("firstName", e.target.value)} placeholder="First" /></div>
        <div><FieldLabel>Middle Name</FieldLabel><TextInput value={data.middleName} onChange={e => set("middleName", e.target.value)} placeholder="Middle" /></div>
        <div><FieldLabel required>Last Name</FieldLabel><TextInput value={data.lastName} onChange={e => set("lastName", e.target.value)} placeholder="Last" /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
        <div>
          <FieldLabel>Suffix</FieldLabel>
          <StyledSelect value={data.suffix} onChange={e => set("suffix", e.target.value)}>
            <option value="">None</option>
            <option>Jr.</option><option>Sr.</option><option>II</option><option>III</option><option>IV</option>
          </StyledSelect>
        </div>
        <div>
          <FieldLabel required>Date of Birth</FieldLabel>
          <TextInput type="date" value={data.dob} onChange={e => set("dob", e.target.value)} />
        </div>
        <div>
          <FieldLabel required>Last 4 of SSN</FieldLabel>
          <TextInput value={data.ssn} onChange={e => set("ssn", e.target.value)} placeholder="XXXX" maxLength={4} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div><FieldLabel required>Email Address</FieldLabel><TextInput type="email" value={data.email} onChange={e => set("email", e.target.value)} placeholder="you@example.com" /></div>
        <div><FieldLabel required>Primary Phone</FieldLabel><TextInput type="tel" value={data.phone} onChange={e => set("phone", e.target.value)} placeholder="(555) 000-0000" /></div>
        <div><FieldLabel>Alternate Phone</FieldLabel><TextInput type="tel" value={data.altPhone} onChange={e => set("altPhone", e.target.value)} placeholder="(555) 000-0000" /></div>
      </div>

      {hasSpouse && (
        <div className="border-t border-slate-800 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-4 h-4 text-rose-400" />
            <p className="text-sm font-bold text-white">
              {data.filingType === "joint" ? "Co-Debtor — Spouse" : "Non-Filing Spouse"}
            </p>
            {data.filingType === "individual-nonfiling-spouse" && (
              <span className="text-xs text-slate-500 ml-1">(required for means test calculation)</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div><FieldLabel required>Spouse First Name</FieldLabel><TextInput value={data.spouseFirstName} onChange={e => set("spouseFirstName", e.target.value)} placeholder="First" /></div>
            <div><FieldLabel>Spouse Middle Name</FieldLabel><TextInput value={data.spouseMiddleName} onChange={e => set("spouseMiddleName", e.target.value)} placeholder="Middle" /></div>
            <div><FieldLabel required>Spouse Last Name</FieldLabel><TextInput value={data.spouseLastName} onChange={e => set("spouseLastName", e.target.value)} placeholder="Last" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><FieldLabel required>Spouse Date of Birth</FieldLabel><TextInput type="date" value={data.spouseDob} onChange={e => set("spouseDob", e.target.value)} /></div>
            <div><FieldLabel required>Spouse Email</FieldLabel><TextInput type="email" value={data.spouseEmail} onChange={e => set("spouseEmail", e.target.value)} placeholder="spouse@example.com" /></div>
            <div><FieldLabel>Spouse Phone</FieldLabel><TextInput type="tel" value={data.spousePhone} onChange={e => set("spousePhone", e.target.value)} placeholder="(555) 000-0000" /></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 2: Household & Dependents ────────────────────────────────────────────

function StepHousehold({ data, set }: { data: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  function addDependent() {
    set("dependents", [...data.dependents, mkDependent(Date.now())]);
  }
  function removeDependent(id: number) {
    set("dependents", data.dependents.filter(d => d.id !== id));
  }
  function updateDependent(id: number, field: keyof Dependent, value: unknown) {
    set("dependents", data.dependents.map(d => d.id === id ? { ...d, [field]: value } : d));
  }

  const RELATIONSHIPS = [
    "Child","Stepchild","Foster Child","Grandchild",
    "Parent","Stepparent","Grandparent",
    "Sibling","Other Relative","Other",
  ];

  // Derive marital status from filing type — locked, cannot be changed here
  const derivedMaritalStatus =
    data.filingType === "joint" ? "Married — Filing Jointly" :
    data.filingType === "individual-nonfiling-spouse" ? "Married — Spouse Not Filing" :
    data.filingType === "individual" ? "Single / Unmarried" :
    "";

  return (
    <div>
      <SectionHead icon={Users} title="Household & Dependents"
        sub="Everyone who relies on your income or contributes to your household expenses." />
      <InfoBox variant="sky">
        List every person in your household who you financially support or who contributes income. Dependents over 18 are generally not counted unless they are disabled, have a documented illness, or are elderly parents. Household members with income must have their contributions entered in the Income section.
      </InfoBox>

      {/* Marital status — read-only, derived from Step 0 filing type */}
      <div className="mb-6">
        <FieldLabel>Marital Status</FieldLabel>
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/40 border border-slate-700 rounded-xl">
          <Heart className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{derivedMaritalStatus || "Not set"}</p>
            <p className="text-xs text-slate-500">Based on your filing type selected in Step 1</p>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
            <Shield className="w-3 h-3" /> Locked
          </span>
        </div>
        {!data.filingType && (
          <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Please complete Step 1 (Residency &amp; Filing Type) first.
          </p>
        )}
      </div>

      <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">Dependents</p>

      {data.dependents.length === 0 && (
        <p className="text-sm text-slate-500 mb-3">No dependents added yet. Click below to add anyone you financially support.</p>
      )}

      <div className="space-y-3 mb-3">
        {data.dependents.map((dep, i) => {
          const age = parseInt(dep.age) || 0;
          const over18 = age >= 18;
          return (
            <CardRow key={dep.id}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">Dependent {i + 1}</p>
                <RemoveButton onClick={() => removeDependent(dep.id)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <FieldLabel required>Relationship</FieldLabel>
                  <StyledSelect value={dep.relationship} onChange={e => updateDependent(dep.id, "relationship", e.target.value)}>
                    <option value="">Select</option>
                    {RELATIONSHIPS.map(r => <option key={r}>{r}</option>)}
                  </StyledSelect>
                </div>
                <div>
                  <FieldLabel required>Full Name</FieldLabel>
                  <TextInput value={dep.name} onChange={e => updateDependent(dep.id, "name", e.target.value)} placeholder="Full name" />
                </div>
                <div>
                  <FieldLabel required>Age</FieldLabel>
                  <TextInput type="number" value={dep.age} onChange={e => updateDependent(dep.id, "age", e.target.value)} placeholder="Age" min="0" max="120" />
                </div>
              </div>

              {over18 && (
                <div className="mt-2 pt-2 border-t border-slate-700/60">
                  <div className="flex items-start gap-2 bg-amber-400/6 border border-amber-400/15 rounded-lg px-3 py-2 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200/80">Dependents 18 or older are generally not counted in household size for bankruptcy purposes unless disabled, chronically ill, or an elderly parent.</p>
                  </div>
                  <div className="mb-2">
                    <FieldLabel required>Is this person disabled, chronically ill, or an elderly parent who cannot fully support themselves?</FieldLabel>
                    <YesNo value={dep.disabled ? "yes" : "no"} onChange={v => updateDependent(dep.id, "disabled", v === "yes")} />
                  </div>
                  {dep.disabled && (
                    <div>
                      <FieldLabel>Brief explanation</FieldLabel>
                      <TextInput value={dep.disabledDesc} onChange={e => updateDependent(dep.id, "disabledDesc", e.target.value)} placeholder="e.g. Diagnosed with MS, unable to work" />
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-slate-700/60 space-y-3">
                <div>
                  <FieldLabel required>Does this person contribute income to the household?</FieldLabel>
                  <YesNo
                    value={dep.contributesToHousehold}
                    onChange={v => {
                      updateDependent(dep.id, "contributesToHousehold", v);
                      if (v === "yes" && dep.incomeSources.length === 0) {
                        updateDependent(dep.id, "incomeSources", [mkDependentIncomeSource()]);
                      }
                      if (v === "no") {
                        updateDependent(dep.id, "incomeSources", []);
                        updateDependent(dep.id, "monthlyContribution", "");
                      }
                    }}
                  />
                </div>

                {dep.contributesToHousehold === "yes" && (
                  <div className="space-y-3 pl-1">
                    {dep.incomeSources.map((src, si) => (
                      <div key={si} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Income Source {si + 1}</p>
                          {dep.incomeSources.length > 1 && (
                            <button type="button"
                              onClick={() => updateDependent(dep.id, "incomeSources", dep.incomeSources.filter((_, xi) => xi !== si))}
                              className="text-[10px] text-red-500 hover:text-red-400 transition-colors">Remove</button>
                          )}
                        </div>

                        <div>
                          <FieldLabel required>Type of Income</FieldLabel>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {[
                              { value: "employed",       label: "Employed (W-2)" },
                              { value: "self_employed",  label: "Self-Employed" },
                              { value: "retirement",     label: "Pension / Retirement" },
                              { value: "social_security",label: "Social Security (SS)" },
                              { value: "ssdi",           label: "Social Security Disability (SSDI)" },
                              { value: "ssi",            label: "Supplemental Security Income (SSI)" },
                              { value: "va_benefits",    label: "VA Benefits" },
                              { value: "other",          label: "Other" },
                            ].map(opt => (
                              <button key={opt.value} type="button"
                                onClick={() => {
                                  const updated = dep.incomeSources.map((x, xi) => xi === si ? { ...x, sourceType: opt.value } : x);
                                  updateDependent(dep.id, "incomeSources", updated);
                                }}
                                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-left text-xs transition-all ${
                                  src.sourceType === opt.value
                                    ? "bg-amber-400/10 border-amber-400/40 text-amber-300 font-semibold"
                                    : "bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-600"
                                }`}>
                                <span className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 ${src.sourceType === opt.value ? "border-amber-400 bg-amber-400" : "border-slate-600"}`} />
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {(src.sourceType === "employed" || src.sourceType === "self_employed") && (
                          <div>
                            <FieldLabel>Employer / Business Name</FieldLabel>
                            <TextInput
                              value={src.employer}
                              onChange={e => {
                                const updated = dep.incomeSources.map((x, xi) => xi === si ? { ...x, employer: e.target.value } : x);
                                updateDependent(dep.id, "incomeSources", updated);
                              }}
                              placeholder={src.sourceType === "self_employed" ? "Business name or 'Self'" : "Employer name"}
                            />
                          </div>
                        )}

                        <div>
                          <FieldLabel required>Gross Monthly Amount</FieldLabel>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 text-sm">$</span>
                            <TextInput
                              type="number"
                              value={src.grossMonthly}
                              onChange={e => {
                                const updated = dep.incomeSources.map((x, xi) => xi === si ? { ...x, grossMonthly: e.target.value } : x);
                                updateDependent(dep.id, "incomeSources", updated);
                                // Keep legacy monthlyContribution in sync as the sum
                                const total = dep.incomeSources
                                  .map((x, xi) => xi === si ? parseFloat(e.target.value) || 0 : parseFloat(x.grossMonthly) || 0)
                                  .reduce((a, b) => a + b, 0);
                                updateDependent(dep.id, "monthlyContribution", String(total));
                              }}
                              placeholder="0.00"
                            />
                            <span className="text-xs text-slate-500 whitespace-nowrap">/ mo</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    <button type="button"
                      onClick={() => updateDependent(dep.id, "incomeSources", [...dep.incomeSources, mkDependentIncomeSource()])}
                      className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add Another Income Source
                    </button>

                    {dep.incomeSources.some(s => parseFloat(s.grossMonthly) > 0) && (
                      <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-3 py-2">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        Total monthly contribution: <strong>
                          ${dep.incomeSources.reduce((s, x) => s + (parseFloat(x.grossMonthly) || 0), 0).toLocaleString()}
                        </strong> — this will be included in household income.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardRow>
          );
        })}
      </div>

      <AddButton onClick={addDependent} label="Add Dependent / Household Member" />
    </div>
  );
}

// ── Step 3: Income ─────────────────────────────────────────────────────────────

function StepIncome({ data, set }: { data: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  const hasSpouse = data.filingType === "individual-nonfiling-spouse" || data.filingType === "joint";

  function addSource(person: "debtor" | "spouse" | "household") {
    const label = person === "debtor" ? "Debtor" : person === "spouse" ? "Spouse" : "Household Member";
    set("incomeSources", [...data.incomeSources, { ...mkIncomeSource(Date.now(), person), personLabel: label }]);
  }
  function removeSource(id: number) {
    set("incomeSources", data.incomeSources.filter(s => s.id !== id));
  }
  function updateSource(id: number, field: keyof IncomeSource, value: string) {
    set("incomeSources", data.incomeSources.map(s => s.id === id ? { ...s, [field]: value } : s));
  }

  const INCOME_TYPES = [
    "Employment (W-2)", "Self-Employment / Business", "Social Security – Retirement",
    "Social Security – Disability (SSDI)", "Supplemental Security Income (SSI)",
    "VA Benefits", "Pension / Retirement", "Unemployment Benefits",
    "Workers' Compensation", "SNAP / Cash Assistance", "Child Support Received",
    "Alimony / Spousal Support Received", "Rental Income", "Investment / Dividend Income",
    "Royalties", "Family Support", "Other",
  ];

  const FREQUENCIES = ["Weekly","Bi-Weekly","Semi-Monthly","Monthly","Quarterly","Annual","Variable"];

  const debtorSources = data.incomeSources.filter(s => s.person === "debtor");
  const spouseSources = data.incomeSources.filter(s => s.person === "spouse");
  const householdSources = data.incomeSources.filter(s => s.person === "household");

  const renderGroup = (sources: IncomeSource[], person: "debtor" | "spouse" | "household", title: string) => (
    <div className="mb-6">
      <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">{title}</p>
      <div className="space-y-3">
        {sources.map((src, i) => (
          <CardRow key={src.id}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400">Income Source {i + 1}</p>
              {sources.length > (person === "debtor" ? 1 : 0) && <RemoveButton onClick={() => removeSource(src.id)} />}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <FieldLabel required>Type of Income</FieldLabel>
                <StyledSelect value={src.sourceType} onChange={e => updateSource(src.id, "sourceType", e.target.value)}>
                  <option value="">Select</option>
                  {INCOME_TYPES.map(t => <option key={t}>{t}</option>)}
                </StyledSelect>
              </div>
              {src.sourceType && (
                <div>
                  <FieldLabel>Employer / Source Name</FieldLabel>
                  <TextInput value={src.employerOrSource} onChange={e => updateSource(src.id, "employerOrSource", e.target.value)} placeholder="Employer, agency, or source" />
                </div>
              )}
            </div>
            {src.sourceType && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <FieldLabel required>Pay Frequency</FieldLabel>
                  <StyledSelect value={src.payFrequency} onChange={e => updateSource(src.id, "payFrequency", e.target.value)}>
                    <option value="">Select</option>
                    {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
                  </StyledSelect>
                </div>
                <div>
                  <FieldLabel required>Gross Per Period</FieldLabel>
                  <TextInput value={src.grossPerPeriod} onChange={e => updateSource(src.id, "grossPerPeriod", e.target.value)} placeholder="$0.00" />
                </div>
                <div>
                  <FieldLabel>Net Per Period</FieldLabel>
                  <TextInput value={src.netPerPeriod} onChange={e => updateSource(src.id, "netPerPeriod", e.target.value)} placeholder="$0.00" />
                </div>
              </div>
            )}
          </CardRow>
        ))}
      </div>
      <AddButton onClick={() => addSource(person)} label={`Add ${title} Income Source`} />
    </div>
  );

  return (
    <div>
      <SectionHead icon={Briefcase} title="Income — All Sources"
        sub="List every source of income for the debtor, spouse, and any household members who contribute." />
      <InfoBox variant="sky">
        The means test uses the average gross income for the 6 months prior to filing. Include all income — even amounts that feel minor. If a household member contributes money toward rent, food, or household bills, include their income here.
      </InfoBox>

      {renderGroup(debtorSources, "debtor", "Debtor Income")}

      {hasSpouse && renderGroup(spouseSources, "spouse", "Spouse Income")}

      {data.dependents.some(d => parseFloat(d.monthlyContribution) > 0) && (
        renderGroup(householdSources, "household", "Household Member Contributions")
      )}

      <div className="border-t border-slate-800 pt-5 mt-2">
        <FieldLabel>Approximate Average Monthly Gross Income (last 6 months)</FieldLabel>
        <p className="text-xs text-slate-500 mb-2">If known — our system will calculate this from the sources above otherwise.</p>
        <TextInput value={data.avgMonthly6} onChange={e => set("avgMonthly6", e.target.value)} placeholder="$0.00" />
      </div>
    </div>
  );
}

// ── Step 4: Monthly Expenses ───────────────────────────────────────────────────

function StepExpenses({ data, set }: { data: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  const expFields: { key: keyof FormData; label: string; sub?: string }[] = [
    { key: "expRentMortgage", label: "Rent / Mortgage", sub: "Include taxes and insurance if included in payment" },
    { key: "expUtilities",   label: "Utilities", sub: "Electric, gas, water, sewer, trash" },
    { key: "expFood",        label: "Food & Household Supplies", sub: "Groceries and household necessities" },
    { key: "expTransportation", label: "Transportation", sub: "Gas, car insurance, public transit, parking" },
    { key: "expHealthcare",  label: "Healthcare & Medical", sub: "Out-of-pocket medical, prescriptions, dental" },
    { key: "expInsurance",   label: "Insurance Premiums", sub: "Health, life, disability (not vehicle)" },
    { key: "expChildcare",   label: "Childcare / Education", sub: "Daycare, school tuition, after-school care" },
    { key: "expOtherExpenses", label: "Other Regular Expenses", sub: "Phone, internet, subscriptions, etc." },
  ];

  return (
    <div>
      <SectionHead icon={ReceiptText} title="Monthly Living Expenses"
        sub="Reasonable and necessary monthly expenses for you and your household." />
      <InfoBox variant="sky">
        Enter actual monthly amounts you pay. If an expense varies, use a 6-month average. Accurate expenses are critical to determining whether you have disposable income — which drives eligibility for Chapter 7 vs. Chapter 13.
      </InfoBox>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {expFields.map(({ key, label, sub }) => (
          <div key={key}>
            <label className="block mb-1.5">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{label}</span>
              {sub && <span className="block text-xs text-slate-600 mt-0.5">{sub}</span>}
            </label>
            <TextInput value={data[key] as string} onChange={e => set(key, e.target.value)} placeholder="$0" />
          </div>
        ))}
      </div>

      <div>
        <FieldLabel>Other Expenses — Description</FieldLabel>
        <TextInput value={data.expOtherDesc} onChange={e => set("expOtherDesc", e.target.value)} placeholder="Describe any other regular expenses" />
      </div>
    </div>
  );
}

// ── Step 5: Real Property ──────────────────────────────────────────────────────

function StepRealProperty({ data, set }: { data: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  function addProperty() {
    set("realProperties", [...data.realProperties, mkProperty(Date.now())]);
  }
  function removeProperty(id: number) {
    set("realProperties", data.realProperties.filter(p => p.id !== id));
  }
  function updateProperty(id: number, field: keyof RealProperty, value: string) {
    set("realProperties", data.realProperties.map(p => p.id === id ? { ...p, [field]: value } : p));
  }

  const PROP_TYPES = ["Primary Residence","Second Home / Vacation","Rental Property","Land / Lot","Commercial Property","Other"];

  return (
    <div>
      <SectionHead icon={Building} title="Real Property"
        sub="All real estate you own, co-own, or have an interest in anywhere in the world." />
      <InfoBox variant="amber">
        You must disclose every parcel of real estate, including property owned jointly with others, inherited property you have not received yet, and property transferred within the last 4 years. Exemptions vary significantly by state — we will evaluate your equity against applicable state or federal exemptions.
      </InfoBox>

      <div className="mb-4">
        <FieldLabel required>Do you own or have an ownership interest in any real property?</FieldLabel>
        <YesNo value={data.ownsRealEstate} onChange={v => {
          set("ownsRealEstate", v);
          if (v === "yes" && data.realProperties.length === 0) {
            set("realProperties", [mkProperty(Date.now())]);
          }
          if (v === "no") set("realProperties", []);
        }} />
      </div>

      {data.ownsRealEstate === "yes" && (
        <div className="space-y-3">
          {data.realProperties.map((prop, i) => (
            <CardRow key={prop.id}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">Property {i + 1}</p>
                {data.realProperties.length > 1 && <RemoveButton onClick={() => removeProperty(prop.id)} />}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <FieldLabel required>Full Property Address</FieldLabel>
                  <TextInput value={prop.address} onChange={e => updateProperty(prop.id, "address", e.target.value)} placeholder="123 Main St, City, State ZIP" />
                </div>
                <div>
                  <FieldLabel required>Property Type</FieldLabel>
                  <StyledSelect value={prop.type} onChange={e => updateProperty(prop.id, "type", e.target.value)}>
                    <option value="">Select</option>
                    {PROP_TYPES.map(t => <option key={t}>{t}</option>)}
                  </StyledSelect>
                </div>
                <div>
                  <FieldLabel required>Estimated Current Value</FieldLabel>
                  <TextInput value={prop.value} onChange={e => updateProperty(prop.id, "value", e.target.value)} placeholder="$000,000" />
                </div>
                <div>
                  <FieldLabel>Mortgage / Lien Balance</FieldLabel>
                  <TextInput value={prop.mortgageBalance} onChange={e => updateProperty(prop.id, "mortgageBalance", e.target.value)} placeholder="$000,000 or 0" />
                </div>
                <div>
                  <FieldLabel>Lender Name</FieldLabel>
                  <TextInput value={prop.lender} onChange={e => updateProperty(prop.id, "lender", e.target.value)} placeholder="Lender or bank name" />
                </div>
                <div>
                  <FieldLabel>Is mortgage current?</FieldLabel>
                  <YesNo value={prop.isCurrent} onChange={v => updateProperty(prop.id, "isCurrent", v)} />
                </div>
              </div>
            </CardRow>
          ))}
          <AddButton onClick={addProperty} label="Add Another Property" />
        </div>
      )}
    </div>
  );
}

// ── Step 6: Personal Property ──────────────────────────────────────────────────

function StepPersonalProperty({ data, set }: { data: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  function addVehicle() {
    set("vehicles", [...data.vehicles, mkVehicle(Date.now())]);
  }
  function removeVehicle(id: number) {
    set("vehicles", data.vehicles.filter(v => v.id !== id));
  }
  function updateVehicle(id: number, field: keyof Vehicle, value: string) {
    set("vehicles", data.vehicles.map(v => v.id === id ? { ...v, [field]: value } : v));
  }

  return (
    <div>
      <SectionHead icon={PiggyBank} title="Personal Property"
        sub="All personal property you own or have any interest in. Every asset must be disclosed." />
      <InfoBox variant="amber">
        Even items you believe are worthless or that you plan to surrender must be listed. Exemptions protect certain property — our job is to evaluate which exemptions apply to you. Never omit an asset.
      </InfoBox>

      {/* Vehicles */}
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3 flex items-center gap-1.5">
          <Car className="w-3.5 h-3.5" /> Vehicles
        </p>
        <div className="mb-3">
          <FieldLabel required>Do you own or co-own any vehicles (cars, trucks, motorcycles, boats, RVs, ATVs)?</FieldLabel>
          <YesNo value={data.noVehicles ? "no" : (data.vehicles.length > 0 ? "yes" : "")}
            onChange={v => {
              if (v === "no") { set("noVehicles", true); set("vehicles", []); }
              else { set("noVehicles", false); if (data.vehicles.length === 0) set("vehicles", [mkVehicle(Date.now())]); }
            }} />
        </div>
        {!data.noVehicles && data.vehicles.length > 0 && (
          <div className="space-y-3">
            {data.vehicles.map((v, i) => (
              <CardRow key={v.id}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">Vehicle {i + 1}</p>
                  {data.vehicles.length > 1 && <RemoveButton onClick={() => removeVehicle(v.id)} />}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><FieldLabel required>Year</FieldLabel><TextInput value={v.year} onChange={e => updateVehicle(v.id, "year", e.target.value)} placeholder="2020" maxLength={4} /></div>
                  <div><FieldLabel required>Make</FieldLabel><TextInput value={v.make} onChange={e => updateVehicle(v.id, "make", e.target.value)} placeholder="Toyota" /></div>
                  <div><FieldLabel required>Model</FieldLabel><TextInput value={v.model} onChange={e => updateVehicle(v.id, "model", e.target.value)} placeholder="Camry" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><FieldLabel required>Estimated Value</FieldLabel><TextInput value={v.value} onChange={e => updateVehicle(v.id, "value", e.target.value)} placeholder="$0" /></div>
                  <div>
                    <FieldLabel required>Loan on this vehicle?</FieldLabel>
                    <YesNo value={v.hasLoan} onChange={val => updateVehicle(v.id, "hasLoan", val)} />
                  </div>
                  {v.hasLoan === "yes" && (
                    <div><FieldLabel required>Loan Balance</FieldLabel><TextInput value={v.loanBalance} onChange={e => updateVehicle(v.id, "loanBalance", e.target.value)} placeholder="$0" /></div>
                  )}
                </div>
              </CardRow>
            ))}
            <AddButton onClick={addVehicle} label="Add Another Vehicle" />
          </div>
        )}
      </div>

      {/* Financial accounts */}
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3 flex items-center gap-1.5">
          <Landmark className="w-3.5 h-3.5" /> Financial Accounts
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel required>Total Bank / Checking / Savings Balance</FieldLabel>
            <TextInput value={data.bankBalance} onChange={e => set("bankBalance", e.target.value)} placeholder="$0.00" />
          </div>
          <div>
            <FieldLabel required>Total Retirement Accounts Balance (401k, IRA, etc.)</FieldLabel>
            <TextInput value={data.retirementBalance} onChange={e => set("retirementBalance", e.target.value)} placeholder="$0.00" />
          </div>
        </div>
      </div>

      {/* Investments & other */}
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3 flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5" /> Investments & Other Assets
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <FieldLabel required>Do you own stocks, bonds, or mutual funds?</FieldLabel>
            <YesNo value={data.hasStocks} onChange={v => set("hasStocks", v)} />
            {data.hasStocks === "yes" && (
              <div className="mt-2">
                <FieldLabel>Approximate Total Value</FieldLabel>
                <TextInput value={data.stocksValue} onChange={e => set("stocksValue", e.target.value)} placeholder="$0.00" />
              </div>
            )}
          </div>
          <div>
            <FieldLabel required>Do you own any cryptocurrency?</FieldLabel>
            <YesNo value={data.hasCrypto} onChange={v => set("hasCrypto", v)} />
            {data.hasCrypto === "yes" && (
              <div className="mt-2">
                <FieldLabel>Approximate Total Value</FieldLabel>
                <TextInput value={data.cryptoValue} onChange={e => set("cryptoValue", e.target.value)} placeholder="$0.00" />
              </div>
            )}
          </div>
          <div>
            <FieldLabel required>Do you have any life insurance with cash value?</FieldLabel>
            <YesNo value={data.hasLifeInsurance} onChange={v => set("hasLifeInsurance", v)} />
            {data.hasLifeInsurance === "yes" && (
              <div className="mt-2">
                <FieldLabel>Total Cash Value (not face value)</FieldLabel>
                <TextInput value={data.lifeInsuranceCashValue} onChange={e => set("lifeInsuranceCashValue", e.target.value)} placeholder="$0.00" />
              </div>
            )}
          </div>
          <div>
            <FieldLabel required>Do you own any firearms?</FieldLabel>
            <YesNo value={data.hasFirearms} onChange={v => set("hasFirearms", v)} />
            {data.hasFirearms === "yes" && (
              <div className="mt-2">
                <FieldLabel>Approximate Total Value</FieldLabel>
                <TextInput value={data.firearmValue} onChange={e => set("firearmValue", e.target.value)} placeholder="$0.00" />
              </div>
            )}
          </div>
          <div>
            <FieldLabel required>Do you own collectibles, art, jewelry, or coins?</FieldLabel>
            <YesNo value={data.hasCollectibles} onChange={v => set("hasCollectibles", v)} />
            {data.hasCollectibles === "yes" && (
              <div className="mt-2">
                <FieldLabel>Approximate Total Value</FieldLabel>
                <TextInput value={data.collectiblesValue} onChange={e => set("collectiblesValue", e.target.value)} placeholder="$0.00" />
              </div>
            )}
          </div>
          <div>
            <FieldLabel required>Household Goods & Furnishings (total estimated value)</FieldLabel>
            <TextInput value={data.householdGoodsValue} onChange={e => set("householdGoodsValue", e.target.value)} placeholder="$0.00" />
          </div>
        </div>
        <div>
          <FieldLabel>Any other assets to disclose?</FieldLabel>
          <p className="text-xs text-slate-500 mb-1.5">Pending lawsuits / settlements, money owed to you, business interests, tools, equipment, patents, etc.</p>
          <StyledTextarea value={data.otherPropertyDesc} onChange={e => set("otherPropertyDesc", e.target.value)} rows={2} placeholder="Brief description of any other assets" />
        </div>
      </div>
    </div>
  );
}

// ── Step 7: Debts ──────────────────────────────────────────────────────────────

function StepDebts({ data, set }: { data: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  const debtFields: { key: keyof FormData; label: string; sub?: string }[] = [
    { key: "securedDebt",      label: "Secured Debts",         sub: "Mortgage(s), auto loans, title loans — collateral-backed" },
    { key: "creditCardDebt",   label: "Credit Cards / Lines of Credit", sub: "All revolving accounts" },
    { key: "medicalDebt",      label: "Medical / Hospital Bills", sub: "All providers, including collections" },
    { key: "studentLoanDebt",  label: "Student Loans",          sub: "Federal and private — rarely dischargeable" },
    { key: "taxDebt",          label: "Tax Debt",               sub: "IRS, state, and local taxes owed" },
    { key: "personalLoanDebt", label: "Personal Loans / Payday Loans", sub: "Unsecured personal debt, payday lenders" },
    { key: "otherUnsecured",   label: "Other Unsecured Debts",  sub: "Judgments, repossession deficiencies, co-signed debt, family loans" },
  ];

  return (
    <div>
      <SectionHead icon={CreditCard} title="Debts & Liabilities"
        sub="Approximate total owed in each category. All creditors must be disclosed — including family members." />
      <InfoBox variant="amber">
        List approximate totals for each category. Exact creditor details, account numbers, and addresses are gathered in the full questionnaire after intake. Enter 0 if none — do not leave fields blank.
      </InfoBox>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {debtFields.map(({ key, label, sub }) => (
          <div key={key}>
            <label className="block mb-1.5">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{label}</span>
              {sub && <span className="block text-xs text-slate-600 mt-0.5">{sub}</span>}
            </label>
            <TextInput value={data[key] as string} onChange={e => set(key, e.target.value)} placeholder="$0" />
          </div>
        ))}
      </div>

      <div>
        <FieldLabel required>Primary reason for seeking bankruptcy relief</FieldLabel>
        <StyledSelect value={data.primaryReason} onChange={e => set("primaryReason", e.target.value)}>
          <option value="">Select primary reason</option>
          <option>Job loss / reduced income</option>
          <option>Medical bills / illness</option>
          <option>Divorce / separation</option>
          <option>Overwhelmed by credit card debt</option>
          <option>Business failure</option>
          <option>Foreclosure / housing crisis</option>
          <option>Wage garnishment or lawsuit</option>
          <option>Tax debt</option>
          <option>Death of a spouse or family member</option>
          <option>Other</option>
        </StyledSelect>
      </div>
    </div>
  );
}

// ── Step 8: Financial History (SOFA) ──────────────────────────────────────────

function StepHistory({ data, set }: { data: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  // Prior BK cases
  function addBKCase() { set("priorBankruptcies", [...data.priorBankruptcies, mkBKCase(Date.now())]); }
  function removeBKCase(id: number) { set("priorBankruptcies", data.priorBankruptcies.filter(c => c.id !== id)); }
  function updateBKCase(id: number, field: keyof PriorBKCase, value: string) {
    set("priorBankruptcies", data.priorBankruptcies.map(c => c.id === id ? { ...c, [field]: value } : c));
  }

  // Transfers
  function addTransfer() { set("transfers", [...data.transfers, mkTransfer(Date.now())]); }
  function removeTransfer(id: number) { set("transfers", data.transfers.filter(t => t.id !== id)); }
  function updateTransfer(id: number, field: keyof Transfer, value: string) {
    set("transfers", data.transfers.map(t => t.id === id ? { ...t, [field]: value } : t));
  }

  // Preferential payments
  function addPref() { set("preferentialPayments", [...data.preferentialPayments, mkPrefPayment(Date.now())]); }
  function removePref(id: number) { set("preferentialPayments", data.preferentialPayments.filter(p => p.id !== id)); }
  function updatePref(id: number, field: keyof PreferentialPayment, value: string) {
    set("preferentialPayments", data.preferentialPayments.map(p => p.id === id ? { ...p, [field]: value } : p));
  }

  return (
    <div>
      <SectionHead icon={FileText} title="Financial History"
        sub="Required by federal law — the Statement of Financial Affairs. Answer truthfully and completely." />

      <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/25 rounded-xl px-4 py-3 mb-6">
        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-red-200/80 leading-relaxed">
          <strong className="text-white">Federal Certification:</strong> All information is submitted under penalty of perjury. Intentionally hiding assets, omitting transfers, or providing false information can result in dismissal, denial of discharge, and up to 5 years in federal prison. When in doubt, answer <strong className="text-white">Yes</strong> — your attorney will review.
        </p>
      </div>

      {/* ── Prior Bankruptcies ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Gavel className="w-4 h-4 text-amber-400" />
          <p className="text-sm font-bold text-white">Prior Bankruptcy Filings</p>
        </div>
        <p className="text-xs text-slate-500 mb-3">Within the last 8 years. Multiple prior cases may affect your eligibility for an automatic stay and discharge.</p>
        <div className="mb-3">
          <FieldLabel required>Have you filed for bankruptcy before?</FieldLabel>
          <YesNo value={data.hasPriorBK} onChange={v => {
            set("hasPriorBK", v);
            if (v === "yes" && data.priorBankruptcies.length === 0) set("priorBankruptcies", [mkBKCase(Date.now())]);
            if (v === "no") set("priorBankruptcies", []);
          }} />
        </div>
        {data.hasPriorBK === "yes" && (
          <div className="space-y-3">
            {data.priorBankruptcies.map((c, i) => (
              <CardRow key={c.id}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">Case {i + 1}</p>
                  {data.priorBankruptcies.length > 1 && <RemoveButton onClick={() => removeBKCase(c.id)} />}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <FieldLabel required>Chapter Filed</FieldLabel>
                    <StyledSelect value={c.chapter} onChange={e => updateBKCase(c.id, "chapter", e.target.value)}>
                      <option value="">Select</option>
                      <option>Chapter 7</option><option>Chapter 11</option>
                      <option>Chapter 12</option><option>Chapter 13</option>
                    </StyledSelect>
                  </div>
                  <div>
                    <FieldLabel required>Year Filed</FieldLabel>
                    <TextInput value={c.yearFiled} onChange={e => updateBKCase(c.id, "yearFiled", e.target.value)} placeholder="YYYY" maxLength={4} />
                  </div>
                  <div>
                    <FieldLabel>District (State)</FieldLabel>
                    <StyledSelect value={c.district} onChange={e => updateBKCase(c.id, "district", e.target.value)}>
                      <option value="">Select</option>
                      {US_STATES.map(s => <option key={s}>{s}</option>)}
                    </StyledSelect>
                  </div>
                  <div>
                    <FieldLabel required>Was a discharge granted?</FieldLabel>
                    <StyledSelect value={c.discharged} onChange={e => updateBKCase(c.id, "discharged", e.target.value)}>
                      <option value="">Select</option>
                      <option>Yes — received discharge</option>
                      <option>No — case was dismissed</option>
                      <option>No — case was dismissed with prejudice</option>
                      <option>Pending — case is still open</option>
                      <option>Unknown</option>
                    </StyledSelect>
                  </div>
                  {c.discharged && c.discharged.includes("dismissed") && (
                    <div className="sm:col-span-2">
                      <FieldLabel>Reason for Dismissal</FieldLabel>
                      <TextInput value={c.dismissedReason} onChange={e => updateBKCase(c.id, "dismissedReason", e.target.value)} placeholder="Failure to pay fees, missed deadlines, trustee objection, etc." />
                    </div>
                  )}
                  <div>
                    <FieldLabel>Case Number (if known)</FieldLabel>
                    <TextInput value={c.caseNumber} onChange={e => updateBKCase(c.id, "caseNumber", e.target.value)} placeholder="XX-XXXXX" />
                  </div>
                </div>
              </CardRow>
            ))}
            <AddButton onClick={addBKCase} label="Add Another Prior Case" />
          </div>
        )}
      </div>

      {/* ── Lawsuits & Garnishment ── */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-amber-400" />
          <p className="text-sm font-bold text-white">Legal Actions & Garnishments</p>
        </div>
        <div>
          <FieldLabel required>Are there any pending or recent lawsuits, collections actions, or judgments against you?</FieldLabel>
          <p className="text-xs text-slate-500 mb-2">Including repossessions, foreclosures, or civil suits</p>
          <YesNo value={data.pendingLawsuits} onChange={v => set("pendingLawsuits", v)} />
          {data.pendingLawsuits === "yes" && (
            <div className="mt-2">
              <FieldLabel>Brief description</FieldLabel>
              <StyledTextarea value={data.lawsuitDetails} onChange={e => set("lawsuitDetails", e.target.value)} rows={2} placeholder="Plaintiff, court, type of action, current status" />
            </div>
          )}
        </div>
        <div>
          <FieldLabel required>Is your pay or bank account currently being garnished?</FieldLabel>
          <YesNo value={data.garnishment} onChange={v => set("garnishment", v)} />
          {data.garnishment === "yes" && (
            <div className="mt-2">
              <FieldLabel>Who is garnishing, and how much per period?</FieldLabel>
              <TextInput value={data.garnishmentDetails} onChange={e => set("garnishmentDetails", e.target.value)} placeholder="Creditor name and approximate amount" />
            </div>
          )}
        </div>
      </div>

      {/* ── Property Transfers ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-amber-400" />
          <p className="text-sm font-bold text-white">Property Transfers — Last 4 Years</p>
        </div>
        <p className="text-xs text-slate-500 mb-3">The trustee can pursue fraudulent or preferential transfers to recover assets for creditors. Transfers include sales, gifts, donations, title changes, and transfers to family members at below-market value.</p>
        <div className="mb-3">
          <FieldLabel required>Have you transferred, sold, gifted, or given away any property worth more than $600 in the last 4 years?</FieldLabel>
          <YesNo value={data.hasTransfers} onChange={v => {
            set("hasTransfers", v);
            if (v === "yes" && data.transfers.length === 0) set("transfers", [mkTransfer(Date.now())]);
            if (v === "no") set("transfers", []);
          }} />
        </div>
        {data.hasTransfers === "yes" && (
          <div className="space-y-3">
            {data.transfers.map((t, i) => (
              <CardRow key={t.id}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">Transfer {i + 1}</p>
                  {data.transfers.length > 1 && <RemoveButton onClick={() => removeTransfer(t.id)} />}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <FieldLabel required>What was transferred?</FieldLabel>
                    <TextInput value={t.description} onChange={e => updateTransfer(t.id, "description", e.target.value)} placeholder="e.g. 2015 Ford F-150, real estate at 123 Oak St, cash gift" />
                  </div>
                  <div>
                    <FieldLabel required>Transfer Type</FieldLabel>
                    <StyledSelect value={t.transferType} onChange={e => updateTransfer(t.id, "transferType", e.target.value)}>
                      <option value="">Select</option>
                      <option>Sale (at market value)</option>
                      <option>Sale (below market value)</option>
                      <option>Gift / Donation</option>
                      <option>Transfer to family member</option>
                      <option>Collateral / security interest</option>
                      <option>Other</option>
                    </StyledSelect>
                  </div>
                  <div>
                    <FieldLabel required>Recipient / Buyer</FieldLabel>
                    <TextInput value={t.recipient} onChange={e => updateTransfer(t.id, "recipient", e.target.value)} placeholder="Name or organization" />
                  </div>
                  <div>
                    <FieldLabel required>Relationship to Recipient</FieldLabel>
                    <StyledSelect value={t.relationship} onChange={e => updateTransfer(t.id, "relationship", e.target.value)}>
                      <option value="">Select</option>
                      <option>None — unrelated party</option>
                      <option>Spouse / partner</option>
                      <option>Parent / stepparent</option>
                      <option>Child / stepchild</option>
                      <option>Sibling</option>
                      <option>Other relative</option>
                      <option>Business associate</option>
                      <option>Friend</option>
                    </StyledSelect>
                  </div>
                  <div>
                    <FieldLabel required>Approximate Value / Amount</FieldLabel>
                    <TextInput value={t.amount} onChange={e => updateTransfer(t.id, "amount", e.target.value)} placeholder="$0" />
                  </div>
                  <div>
                    <FieldLabel required>Approximate Date</FieldLabel>
                    <TextInput type="month" value={t.date} onChange={e => updateTransfer(t.id, "date", e.target.value)} />
                  </div>
                </div>
              </CardRow>
            ))}
            <AddButton onClick={addTransfer} label="Add Another Transfer" />
          </div>
        )}
      </div>

      {/* ── Preferential Payments ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-4 h-4 text-amber-400" />
          <p className="text-sm font-bold text-white">Large Payments to Creditors — Last 90 Days / 1 Year</p>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          The trustee can recover payments of $600+ made to regular creditors within 90 days of filing, or up to 1 year for payments to insiders (family, business associates). This is called a preferential payment.
        </p>
        <div className="mb-3">
          <FieldLabel required>Have you made any large or unusual payments to any creditor in the last 12 months?</FieldLabel>
          <p className="text-xs text-slate-500 mb-2">Includes paying off a credit card, large lump-sum payment to any lender, or any payment to a family member or friend you owed money to</p>
          <YesNo value={data.hasPreferentialPayments} onChange={v => {
            set("hasPreferentialPayments", v);
            if (v === "yes" && data.preferentialPayments.length === 0) set("preferentialPayments", [mkPrefPayment(Date.now())]);
            if (v === "no") set("preferentialPayments", []);
          }} />
        </div>
        {data.hasPreferentialPayments === "yes" && (
          <div className="space-y-3">
            {data.preferentialPayments.map((p, i) => (
              <CardRow key={p.id}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">Payment {i + 1}</p>
                  {data.preferentialPayments.length > 1 && <RemoveButton onClick={() => removePref(p.id)} />}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel required>Creditor / Recipient</FieldLabel>
                    <TextInput value={p.creditor} onChange={e => updatePref(p.id, "creditor", e.target.value)} placeholder="Chase, Bank of America, Mom, etc." />
                  </div>
                  <div>
                    <FieldLabel required>Amount Paid</FieldLabel>
                    <TextInput value={p.amount} onChange={e => updatePref(p.id, "amount", e.target.value)} placeholder="$0" />
                  </div>
                  <div>
                    <FieldLabel required>Approximate Date</FieldLabel>
                    <TextInput type="month" value={p.date} onChange={e => updatePref(p.id, "date", e.target.value)} />
                  </div>
                  <div>
                    <FieldLabel required>Relationship to Creditor</FieldLabel>
                    <StyledSelect value={p.relationship} onChange={e => updatePref(p.id, "relationship", e.target.value)}>
                      <option value="">Select</option>
                      <option>None — commercial creditor</option>
                      <option>Family member / insider</option>
                      <option>Friend</option>
                      <option>Business associate</option>
                    </StyledSelect>
                  </div>
                </div>
              </CardRow>
            ))}
            <AddButton onClick={addPref} label="Add Another Payment" />
          </div>
        )}
      </div>

      {/* ── Business & Misc ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Briefcase className="w-4 h-4 text-amber-400" />
          <p className="text-sm font-bold text-white">Business & Other</p>
        </div>
        <div>
          <FieldLabel required>Have you owned, operated, or been an officer of a business in the last 6 years?</FieldLabel>
          <YesNo value={data.ownedBusiness} onChange={v => set("ownedBusiness", v)} />
          {data.ownedBusiness === "yes" && (
            <div className="mt-2">
              <FieldLabel>Business name, type, and status</FieldLabel>
              <StyledTextarea value={data.businessDetails} onChange={e => set("businessDetails", e.target.value)} rows={2} placeholder="Business name, sole proprietor / LLC / corp, open or closed" />
            </div>
          )}
        </div>
        <div>
          <FieldLabel required>Are you expecting a tax refund this year or next?</FieldLabel>
          <YesNo value={data.expectedRefund} onChange={v => set("expectedRefund", v)} />
          {data.expectedRefund === "yes" && (
            <div className="mt-2">
              <FieldLabel>Approximate refund amount</FieldLabel>
              <TextInput value={data.refundAmount} onChange={e => set("refundAmount", e.target.value)} placeholder="$0" />
            </div>
          )}
        </div>
        <div>
          <FieldLabel required>In the last 90 days, did you use credit cards or take on any new debt for luxury goods, travel, or non-essential purchases over $500?</FieldLabel>
          <YesNo value={data.recentLuxury} onChange={v => set("recentLuxury", v)} />
          {data.recentLuxury === "yes" && (
            <div className="mt-2">
              <FieldLabel>Brief description</FieldLabel>
              <StyledTextarea value={data.luxuryDetails} onChange={e => set("luxuryDetails", e.target.value)} rows={2} placeholder="What was purchased, approximate amount, date" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 9: Review ─────────────────────────────────────────────────────────────

function StepReview({ data }: { data: FormData }) {
  const hasSpouse = data.filingType === "individual-nonfiling-spouse" || data.filingType === "joint";
  const fmt = (v: string | number | undefined) =>
    v ? String(v) : <span className="text-slate-600 italic text-xs">Not provided</span>;
  const fmtBool = (v: string) =>
    v === "yes" ? <span className="text-emerald-400 font-semibold">Yes</span>
      : v === "no" ? <span className="text-slate-400">No</span>
      : <span className="text-slate-600 italic text-xs">Not answered</span>;

  function ReviewSection({ title, icon: Icon, rows }: { title: string; icon: React.ElementType; rows: [string, React.ReactNode][] }) {
    const visible = rows.filter(([, v]) => v);
    if (visible.length === 0) return null;
    return (
      <div className="bg-slate-800/30 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/50 border-b border-slate-800">
          <Icon className="w-3.5 h-3.5 text-amber-400" />
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400">{title}</p>
        </div>
        <div className="divide-y divide-slate-800/60">
          {visible.map(([label, value]) => (
            <div key={label} className="flex items-start gap-3 px-4 py-2">
              <span className="text-xs text-slate-500 w-44 flex-shrink-0 pt-0.5">{label}</span>
              <span className="text-xs text-slate-200 flex-1">{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalIncome = data.incomeSources.reduce((sum, s) => {
    const gross = parseFloat(s.grossPerPeriod) || 0;
    const freq = s.payFrequency;
    const monthly = freq === "Weekly" ? gross * 52 / 12
      : freq === "Bi-Weekly" ? gross * 26 / 12
      : freq === "Semi-Monthly" ? gross * 2
      : freq === "Monthly" ? gross
      : freq === "Quarterly" ? gross / 3
      : freq === "Annual" ? gross / 12
      : gross;
    return sum + monthly;
  }, 0);

  const totalExpenses =
    [data.expRentMortgage, data.expUtilities, data.expFood, data.expTransportation,
     data.expHealthcare, data.expInsurance, data.expChildcare, data.expOtherExpenses]
      .reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

  const disposable = totalIncome - totalExpenses;
  const totalDebt = [data.securedDebt, data.creditCardDebt, data.medicalDebt, data.studentLoanDebt,
    data.taxDebt, data.personalLoanDebt, data.otherUnsecured]
    .reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div>
      <SectionHead icon={CheckCircle2} title="Review Your Answers"
        sub="Please review everything carefully before submitting. You can go back to correct anything." />

      {/* Summary snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Est. Monthly Income", value: fmtCurrency(totalIncome), color: "emerald" },
          { label: "Est. Monthly Expenses", value: fmtCurrency(totalExpenses), color: "sky" },
          { label: "Est. Disposable Income", value: fmtCurrency(disposable), color: disposable > 0 ? "amber" : "emerald" },
          { label: "Est. Total Debt", value: fmtCurrency(totalDebt), color: "red" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`bg-slate-800/40 border border-slate-700 rounded-xl px-3 py-3 text-center`}>
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-sm font-bold text-${color}-400`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3 mb-6">
        <ReviewSection title="Residency & Filing Type" icon={Home} rows={(() => {
          const er = computeExemptionState(data);
          return [
            ["Filing Type", data.filingType],
            ["Address", [data.streetAddress, data.city, data.state, data.zipCode].filter(Boolean).join(", ")],
            ["2 Years in State", data.inStateOver2Years === "yes" ? "Yes" : data.inStateOver2Years === "no" ? "No" : ""],
            ["Moved to State", data.movedToStateDate || ""],
            ["Exemption State", er.exemptionState ? <span className="font-bold text-amber-300">{er.exemptionState}</span> : ""],
            ["Exemption Basis", er.reason || ""],
          ];
        })()} />
        <ReviewSection title="Identity" icon={User} rows={[
          ["Debtor", [data.firstName, data.middleName, data.lastName].filter(Boolean).join(" ")],
          ["Date of Birth", data.dob],
          ["Email", data.email],
          ["Phone", data.phone],
          ...(hasSpouse ? [
            ["Spouse", [data.spouseFirstName, data.spouseLastName].filter(Boolean).join(" ")] as [string, string],
            ["Spouse DOB", data.spouseDob] as [string, string],
          ] : []),
        ]} />
        <ReviewSection title="Household" icon={Users} rows={[
          ["Marital Status", data.maritalStatus],
          ["Dependents", data.dependents.length > 0 ? `${data.dependents.length} listed` : "None"],
        ]} />
        <ReviewSection title="Income" icon={Briefcase} rows={[
          ["Income Sources", `${data.incomeSources.filter(s => s.sourceType).length} source(s)`],
          ["Est. Monthly Gross", fmtCurrency(totalIncome)],
        ]} />
        <ReviewSection title="Assets" icon={PiggyBank} rows={[
          ["Real Property", data.ownsRealEstate === "yes" ? `${data.realProperties.length} property/ies` : "None"],
          ["Vehicles", data.noVehicles ? "None" : `${data.vehicles.length} listed`],
          ["Bank Balances", data.bankBalance ? `~${data.bankBalance}` : ""],
          ["Retirement", data.retirementBalance ? `~${data.retirementBalance}` : ""],
          ["Stocks / Bonds", fmtBool(data.hasStocks)],
          ["Cryptocurrency", fmtBool(data.hasCrypto)],
        ]} />
        <ReviewSection title="Debts" icon={CreditCard} rows={[
          ["Total Debt", fmtCurrency(totalDebt)],
          ["Primary Reason", data.primaryReason],
        ]} />
        <ReviewSection title="Financial History" icon={FileText} rows={[
          ["Prior Bankruptcy", fmtBool(data.hasPriorBK)],
          ...(data.hasPriorBK === "yes" ? [["Prior Cases", `${data.priorBankruptcies.length} case(s)`] as [string, React.ReactNode]] : []),
          ["Pending Lawsuits", fmtBool(data.pendingLawsuits)],
          ["Garnishment", fmtBool(data.garnishment)],
          ["Property Transfers", fmtBool(data.hasTransfers)],
          ["Preferential Payments", fmtBool(data.hasPreferentialPayments)],
          ["Owned Business", fmtBool(data.ownedBusiness)],
        ]} />
      </div>

      <div className="bg-red-500/8 border border-red-500/25 rounded-xl px-4 py-4">
        <div className="flex items-start gap-2.5 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-red-300 uppercase tracking-wide">Federal Certification — Penalty of Perjury</p>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          By submitting this form I certify that all information provided is true, accurate, and complete to the best of my knowledge. I understand that bankruptcy is a federal legal procedure and that intentionally omitting information or providing false answers can result in dismissal, denial of discharge, federal criminal charges, and up to 5 years in federal prison.
        </p>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  onBack?: () => void;
}

export default function ClientIntakeForm({ onBack }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(INITIAL);
  const [ackAccurate, setAckAccurate] = useState(false);
  const [ackComplete, setAckComplete] = useState(false);
  const [ackCooperate, setAckCooperate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof FormData, value: unknown) {
    setData(prev => ({ ...prev, [key]: value }));
  }

  function canProceed(): boolean {
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const exemptionResult = computeExemptionState(data);
      const payload = {
        filing_type: data.filingType,
        state: data.state,
        county: data.county || null,
        city: data.city,
        street_address: data.streetAddress,
        zip_code: data.zipCode,
        in_state_over_2_years: data.inStateOver2Years === "yes",
        moved_to_state_date: data.movedToStateDate || null,
        prior_residences_json: data.priorResidences.length > 0 ? data.priorResidences : null,
        exemption_state: exemptionResult.exemptionState || data.state,
        exemption_state_reason: exemptionResult.reason || null,
        first_name: data.firstName,
        middle_name: data.middleName || null,
        last_name: data.lastName,
        suffix: data.suffix || null,
        dob: data.dob,
        ssn_last4: data.ssn,
        email: data.email,
        phone: data.phone,
        alt_phone: data.altPhone || null,
        spouse_first_name: data.spouseFirstName || null,
        spouse_last_name: data.spouseLastName || null,
        spouse_dob: data.spouseDob || null,
        spouse_email: data.spouseEmail || null,
        marital_status: data.maritalStatus,
        num_dependents: data.dependents.length,
        dependents_json: data.dependents.length > 0 ? data.dependents : null,
        income_sources_json: data.incomeSources.filter(s => s.sourceType),
        exp_rent_mortgage: parseFloat(data.expRentMortgage) || 0,
        exp_utilities: parseFloat(data.expUtilities) || 0,
        exp_food: parseFloat(data.expFood) || 0,
        exp_transportation: parseFloat(data.expTransportation) || 0,
        exp_healthcare: parseFloat(data.expHealthcare) || 0,
        exp_insurance: parseFloat(data.expInsurance) || 0,
        exp_childcare: parseFloat(data.expChildcare) || 0,
        exp_other: parseFloat(data.expOtherExpenses) || 0,
        owns_real_estate: data.ownsRealEstate === "yes",
        real_properties_json: data.realProperties.length > 0 ? data.realProperties : null,
        vehicles_json: data.vehicles.length > 0 ? data.vehicles : null,
        no_vehicles: data.noVehicles,
        bank_balance: parseFloat(data.bankBalance) || 0,
        retirement_balance: parseFloat(data.retirementBalance) || 0,
        has_stocks: data.hasStocks === "yes",
        stocks_value: parseFloat(data.stocksValue) || null,
        has_crypto: data.hasCrypto === "yes",
        crypto_value: parseFloat(data.cryptoValue) || null,
        has_life_insurance: data.hasLifeInsurance === "yes",
        life_insurance_cash_value: parseFloat(data.lifeInsuranceCashValue) || null,
        has_firearms: data.hasFirearms === "yes",
        firearm_value: parseFloat(data.firearmValue) || null,
        has_collectibles: data.hasCollectibles === "yes",
        collectibles_value: parseFloat(data.collectiblesValue) || null,
        household_goods_value: parseFloat(data.householdGoodsValue) || 0,
        other_property_desc: data.otherPropertyDesc || null,
        secured_debt: parseFloat(data.securedDebt) || 0,
        credit_card_debt: parseFloat(data.creditCardDebt) || 0,
        medical_debt: parseFloat(data.medicalDebt) || 0,
        student_loan_debt: parseFloat(data.studentLoanDebt) || 0,
        tax_debt: parseFloat(data.taxDebt) || 0,
        personal_loan_debt: parseFloat(data.personalLoanDebt) || 0,
        other_unsecured: parseFloat(data.otherUnsecured) || 0,
        primary_reason: data.primaryReason,
        has_prior_bk: data.hasPriorBK === "yes",
        prior_bankruptcies_json: data.priorBankruptcies.length > 0 ? data.priorBankruptcies : null,
        pending_lawsuits: data.pendingLawsuits === "yes",
        lawsuit_details: data.lawsuitDetails || null,
        garnishment: data.garnishment === "yes",
        garnishment_details: data.garnishmentDetails || null,
        has_transfers: data.hasTransfers === "yes",
        transfers_json: data.transfers.length > 0 ? data.transfers : null,
        has_preferential_payments: data.hasPreferentialPayments === "yes",
        preferential_payments_json: data.preferentialPayments.length > 0 ? data.preferentialPayments : null,
        owned_business: data.ownedBusiness === "yes",
        business_details: data.businessDetails || null,
        expected_refund: data.expectedRefund === "yes",
        refund_amount: parseFloat(data.refundAmount) || null,
        recent_luxury: data.recentLuxury === "yes",
        luxury_details: data.luxuryDetails || null,
        status: "pending_review",
        submitted_at: new Date().toISOString(),
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/intake_submissions`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());
      setSubmitted(true);
    } catch {
      setError("There was a problem submitting your form. Please try again or contact our office directly.");
    }
    setSubmitting(false);
  }

  // ── Submitted confirmation ──────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: "'Georgia', serif" }}>
            Intake Form Received
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Thank you, <strong className="text-white">{data.firstName}</strong>. Your intake information has been submitted to MAJORSLAW.ai. A member of our team will review your eligibility and contact you within 1–2 business days to discuss next steps.
          </p>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-left space-y-2.5 mb-6">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">What happens next</p>
            {[
              "Our attorneys review your intake for eligibility — Chapter 7 vs. 13, filing district, and exemption analysis",
              "We will contact you to schedule a consultation to review our findings",
              "If you are a good candidate, we will send a retainer agreement",
              "Once retained, you gain access to the full client portal and detailed questionnaire",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-amber-400">{i + 1}</span>
                </div>
                <p className="text-xs text-slate-300">{item}</p>
              </div>
            ))}
          </div>
          {onBack && (
            <button onClick={onBack} className="text-sm text-slate-400 hover:text-white transition-colors">
              Return to portal
            </button>
          )}
        </div>
      </div>
    );
  }

  const progressPct = Math.round((step / (STEPS.length - 1)) * 100);

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0d1221]/95 border-b border-slate-800/60 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center">
              <Scale className="w-4 h-4 text-slate-950" />
            </div>
            <span className="font-bold text-white text-base tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>
              MAJORSLAW<span className="text-amber-400">.ai</span>
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Initial Client Intake</p>
            <p className="text-xs text-slate-600">Step {step + 1} of {STEPS.length}</p>
          </div>
        </div>
        <div className="h-0.5 bg-slate-800">
          <div className="h-0.5 bg-amber-400 transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Step pills */}
        <div className="flex items-center gap-1.5 mb-8 overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isDone = i < step;
            const isCurrent = i === step;
            return (
              <button key={s.id} onClick={() => i < step && setStep(i)} disabled={i > step}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                  isCurrent ? "bg-amber-400 text-slate-950" :
                  isDone    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 cursor-pointer" :
                              "bg-slate-800/50 text-slate-600 cursor-not-allowed"
                }`}>
                {isDone ? <CheckCircle2 className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Step content */}
        <div className="bg-[#0d1221] border border-slate-800 rounded-2xl p-6 sm:p-8 mb-6">
          {step === 0 && <StepResidency data={data} set={set} />}
          {step === 1 && <StepIdentity data={data} set={set} />}
          {step === 2 && <StepHousehold data={data} set={set} />}
          {step === 3 && <StepIncome data={data} set={set} />}
          {step === 4 && <StepExpenses data={data} set={set} />}
          {step === 5 && <StepRealProperty data={data} set={set} />}
          {step === 6 && <StepPersonalProperty data={data} set={set} />}
          {step === 7 && <StepDebts data={data} set={set} />}
          {step === 8 && <StepHistory data={data} set={set} />}
          {step === 9 && (
            <div>
              <StepReview data={data} />
              <div className="mt-6 space-y-3">
                {[
                  { state: ackAccurate, setter: setAckAccurate, text: "I certify that all information I have provided is true and accurate to the best of my knowledge." },
                  { state: ackComplete, setter: setAckComplete, text: "I understand I must disclose all assets, income, debts, and transactions — including those involving family members." },
                  { state: ackCooperate, setter: setAckCooperate, text: "I agree to cooperate fully with MAJORSLAW.ai and provide all requested documentation promptly." },
                ].map(({ state, setter, text }, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer group">
                    <div onClick={() => setter(!state)}
                      className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                        state ? "bg-amber-400 border-amber-400" : "border-slate-600 group-hover:border-amber-400/50"
                      }`}>
                      {state && <svg className="w-3 h-3 text-slate-950" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5 1 6.5l4 4 6-6.5z" /></svg>}
                    </div>
                    <span className="text-sm text-slate-300 leading-relaxed">{text}</span>
                  </label>
                ))}
              </div>
              {error && (
                <div className="mt-4 flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : onBack?.()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 text-sm font-semibold transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? "Back to Portal" : "Previous"}
          </button>

          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                canProceed()
                  ? "bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg shadow-amber-400/20"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              }`}>
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={!canProceed() || submitting}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                canProceed() && !submitting
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              }`}>
              {submitting ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Submitting...</>
              ) : (
                <>Submit Intake Form <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}




