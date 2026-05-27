import { useState, useEffect, useCallback, useRef } from "react";
import {
  Scale, RefreshCw, CheckCircle2, AlertTriangle, Clock, ChevronRight,
  User, DollarSign, MapPin, TrendingUp, TrendingDown, Minus,
  Flag, X, PenLine, CheckCheck, Info, Plus, Circle, Save,
  BarChart2, Zap, Eye, Activity, ArrowRight, Filter, Search,
  Building, CreditCard, ChevronDown, Home, Banknote,
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY    = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  chapter_interest: number | null;
  status: string;
  debt_estimate: number | null;
  income_estimate: number | null;
  pre_screen_notes: string | null;
  intake_completed: boolean | null;
  sent_for_review: boolean | null;
  sent_for_review_at: string | null;
  submission_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Submission {
  id: string;
  lead_id: string | null;
  filing_type: string | null;
  first_name: string | null;
  last_name: string | null;
  state: string | null;
  marital_status: string | null;
  num_dependents: number | null;
  income_sources_json: IncomeSource[] | null;
  debtor_gross_monthly: number | null;
  exp_rent_mortgage: number | null;
  exp_utilities: number | null;
  exp_food: number | null;
  exp_transportation: number | null;
  exp_healthcare: number | null;
  exp_insurance: number | null;
  exp_childcare: number | null;
  exp_other: number | null;
  credit_card_debt: number | null;
  medical_debt: number | null;
  secured_debt: number | null;
  student_loan_debt: number | null;
  tax_debt: number | null;
  personal_loan_debt: number | null;
  other_unsecured: number | null;
  has_preferential_payments: boolean | null;
  preferential_payments_json: PrefPay[] | null;
  vehicles_json: Vehicle[] | null;
  has_prior_bk: boolean | null;
  prior_bankruptcies_json: { chapter: string; yearFiled: number; discharged: boolean }[] | null;
  recent_luxury: boolean | null;
  luxury_details: string | null;
  bank_balance: number | null;
  retirement_balance: number | null;
  real_properties_json: RealProperty[] | null;
  has_transfers: boolean | null;
  transfers_json: Transfer[] | null;
  garnishment: boolean | null;
  exemption_state: string | null;
  submitted_at: string;
}

interface IncomeSource {
  grossPerPeriod?: number;
  payFrequency?: string;
  sourceType?: string;
  employerOrSource?: string;
  person?: string;
}

interface PrefPay {
  creditor: string;
  amount: number;
  date: string;
  relationship: string;
}

interface Vehicle {
  year: number;
  make: string;
  model: string;
  value: number;
  hasLoan: boolean;
  loanBalance: number;
}

interface RealProperty {
  address?: string;
  type?: string;
  value?: number;
  mortgageBalance?: number;
  lender?: string;
  isCurrent?: boolean;
}

interface Transfer {
  description?: string;
  recipient?: string;
  relationship?: string;
  amount?: number;
  date?: string;
  transferType?: string;
}

interface IntakeReview {
  id: string;
  lead_id: string | null;
  submission_id: string | null;
  attorney_name: string;
  review_status: string;
  ch7_eligible: boolean | null;
  ch13_eligible: boolean | null;
  eligibility_notes: string | null;
  household_size: number | null;
  current_monthly_income: number | null;
  state_median_income: number | null;
  above_median: boolean | null;
  disposable_income: number | null;
  means_test_result: string | null;
  qualify_target_monthly: number | null;
  pref_pay_flagged: boolean;
  pref_pay_insider_total: number | null;
  qualify_analysis_notes: string | null;
  pref_pay_notes: string | null;
  decision: string;
  case_type: string | null;
  chapter: number | null;
  attorney_fee: number | null;
  court_filing_fee: number | null;
  total_fee: number | null;
  down_payment: number | null;
  plan_months: number | null;
  ch13_upfront_amount: number | null;
  ch13_plan_portion: number | null;
  limited_scope_desc: string | null;
  decision_notes: string | null;
  decided_at: string | null;
  created_at: string;
}

interface IntakeIssue {
  id: string;
  review_id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  attorney_note: string | null;
  client_acknowledged: boolean;
  client_initials: string | null;
  acknowledged_at: string | null;
  sort_order: number;
}

type EligibilityCheckItem = { label: string; pass: boolean; detail: string };
type AutoAlert = { level: "urgent" | "warning" | "info"; message: string; category: string };
type Ch13Plan = {
  vehicleCramDown: number; arrearsPayment: number; priorityPayment: number;
  liquidationMin: number; basePayment: number; withTrustee: number;
  planPayment: number; planFeasible: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sbGet<T>(path: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  return r.ok ? r.json() : [];
}

async function sbPost<T = unknown>(table: string, body: object): Promise<T | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return Array.isArray(data) ? data[0] ?? null : data;
}

async function sbPatch(table: string, id: string, body: object) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 0,
  }).format(n);
}

function timeAgo(s: string) {
  const d = Date.now() - new Date(s).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── State Median Income — all 50 states, November 1, 2025 (annual) ──────────

type MedianRow = { 1: number; 2: number; 3: number; 4: number; extra: number };
const STATE_MEDIAN: Record<string, MedianRow> = {
  AL:{1:62672, 2:75465, 3:90321,  4:104003,extra:11100}, AK:{1:83617, 2:109882,3:109882,4:138492,extra:11100},
  AZ:{1:72039, 2:86745, 3:102274, 4:118067,extra:11100}, AR:{1:56923, 2:71742, 3:80218, 4:94586, extra:11100},
  CA:{1:77221, 2:100161,3:113553, 4:135505,extra:11100}, CO:{1:85685, 2:106890,3:127495,4:149566,extra:11100},
  CT:{1:82141, 2:103501,3:131022, 4:155834,extra:11100}, DE:{1:67733, 2:92445, 3:108420,4:128854,extra:11100},
  FL:{1:68085, 2:84385, 3:95039,  4:111819,extra:11100}, GA:{1:66722, 2:82787, 3:98877, 4:120315,extra:11100},
  HI:{1:83068, 2:103479,3:120289, 4:138536,extra:11100}, ID:{1:71531, 2:83951, 3:95859, 4:116594,extra:11100},
  IL:{1:71304, 2:91526, 3:110712, 4:134366,extra:11100}, IN:{1:62808, 2:79884, 3:93175, 4:112691,extra:11100},
  IA:{1:65883, 2:86523, 3:101463, 4:122826,extra:11100}, KS:{1:67423, 2:85199, 3:101189,4:122741,extra:11100},
  KY:{1:60071, 2:71998, 3:83027,  4:108637,extra:11100}, LA:{1:57923, 2:70493, 3:82433, 4:100971,extra:11100},
  ME:{1:73946, 2:88126, 3:104083, 4:128204,extra:11100}, MD:{1:84699, 2:111673,3:132464,4:161913,extra:11100},
  MA:{1:85941, 2:109818,3:135837, 4:173947,extra:11100}, MI:{1:65625, 2:81293, 3:100797,4:134254,extra:11100},
  MN:{1:75704, 2:95807, 3:123244, 4:146039,extra:11100}, MS:{1:52594, 2:68525, 3:80722, 4:94965, extra:11100},
  MO:{1:63306, 2:79971, 3:97658,  4:115491,extra:11100}, MT:{1:69482, 2:88107, 3:100637,4:118578,extra:11100},
  NE:{1:65206, 2:88402, 3:100754, 4:121867,extra:11100}, NV:{1:65868, 2:85860, 3:99032, 4:111184,extra:11100},
  NH:{1:85049, 2:106521,3:137902, 4:151224,extra:11100}, NJ:{1:84938, 2:104138,3:133620,4:163817,extra:11100},
  NM:{1:64537, 2:77534, 3:85784,  4:96074, extra:11100}, NY:{1:71393, 2:90520, 3:112616,4:135475,extra:11100},
  NC:{1:65396, 2:82221, 3:98932,  4:113744,extra:11100}, ND:{1:71683, 2:93882, 3:103951,4:134254,extra:11100},
  OH:{1:64541, 2:81578, 3:99876,  4:120531,extra:11100}, OK:{1:59611, 2:75229, 3:84618, 4:99188, extra:11100},
  OR:{1:77061, 2:91268, 3:113736, 4:136434,extra:11100}, PA:{1:70378, 2:85290, 3:107327,4:132379,extra:11100},
  RI:{1:75662, 2:96205, 3:116357, 4:133954,extra:11100}, SC:{1:63140, 2:81614, 3:93219, 4:113332,extra:11100},
  SD:{1:67415, 2:87598, 3:88297,  4:127386,extra:11100}, TN:{1:62339, 2:80722, 3:95011, 4:106775,extra:11100},
  TX:{1:65123, 2:84491, 3:96728,  4:114938,extra:11100}, UT:{1:85644, 2:93302, 3:109860,4:128363,extra:11100},
  VT:{1:70603, 2:94477, 3:111150, 4:134056,extra:11100}, VA:{1:76479, 2:98577, 3:120001,4:141113,extra:11100},
  WA:{1:86314, 2:104354,3:128369, 4:152553,extra:11100}, WV:{1:62270, 2:66833, 3:89690, 4:91270, extra:11100},
  WI:{1:69343, 2:87938, 3:105734, 4:129964,extra:11100}, WY:{1:69906, 2:88156, 3:95951, 4:107469,extra:11100},
};

// Maps full state names (from BankruptcyIntake.jsx) to 2-letter codes
const STATE_NAME_TO_ABBR: Record<string, string> = {
  Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",
  Connecticut:"CT",Delaware:"DE",Florida:"FL",Georgia:"GA",Hawaii:"HI",Idaho:"ID",
  Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",
  Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",
  Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV",
  "New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY",
  "North Carolina":"NC","North Dakota":"ND",Ohio:"OH",Oklahoma:"OK",Oregon:"OR",
  Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",
  Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA",
  "West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY",
};

function normalizeState(state: string | null | undefined): string {
  if (!state) return "";
  const s = state.trim();
  return s.length === 2 ? s.toUpperCase() : (STATE_NAME_TO_ABBR[s] ?? "");
}

function getMedianData(state: string | null, houseSize: number): { monthly: number; annual: number } {
  const abbr = normalizeState(state);
  const tbl = STATE_MEDIAN[abbr];
  const hhKey = Math.min(houseSize, 4) as 1 | 2 | 3 | 4;
  const annual = tbl
    ? (houseSize <= 4 ? tbl[hhKey] : tbl[4] + (houseSize - 4) * tbl.extra)
    : (52000 + (houseSize - 1) * 9000);
  return { annual, monthly: Math.round(annual / 12) };
}

// Vehicle exemption by state (single filer, approximate)
const VEHICLE_EX: Record<string, number> = {
  AL:3000,AK:3750,AZ:6000,AR:1200,CA:3625,CO:7500,CT:3750,DE:4425,FL:1000,GA:5000,
  HI:2575,ID:10000,IL:2400,IN:10250,IA:7000,KS:20000,KY:3000,LA:7500,ME:5000,MD:6000,
  MA:7500,MI:3775,MN:5000,MS:10000,MO:3000,MT:4500,NE:5000,NV:15000,NH:10000,NJ:0,
  NM:5000,NY:11975,NC:3500,ND:5000,OH:4000,OK:7500,OR:3000,PA:0,RI:12350,SC:6325,
  SD:7000,TN:10000,TX:100000,UT:3500,VT:5000,VA:6000,WA:15000,WV:5000,WI:4000,WY:5000,
};

// Homestead exemption by state (single filer; 9_999_999 = unlimited)
const HOMESTEAD_EX: Record<string, number> = {
  AL:16450,AK:75000,AZ:400000,AR:27000,CA:349402,CO:250000,CT:75000,DE:125000,
  FL:9999999,GA:43000,HI:0,ID:175000,IL:30000,IN:22400,IA:9999999,KS:9999999,
  KY:30000,LA:45000,ME:90000,MD:35000,MA:1000000,MI:50000,MN:450000,MS:150000,
  MO:15000,MT:350000,NE:80000,NV:605000,NH:400000,NJ:0,NM:90000,NY:165550,
  NC:42000,ND:150000,OH:145425,OK:9999999,OR:100000,PA:0,RI:500000,SC:87000,
  SD:9999999,TN:20000,TX:9999999,UT:67410,VT:200000,VA:25000,WA:250000,
  WV:35000,WI:75000,WY:80000,
};

// Legacy: keep old getMedian signature for CaseRow which uses monthly return
function getMedian(state: string | null, houseSize: number): number {
  return getMedianData(state, houseSize).monthly;
}

function toMonthly(gp: number, freq: string | undefined): number {
  switch (freq) {
    case "weekly":       return gp * 4.333;
    case "bi-weekly":    return gp * 2.167;
    case "semi-monthly": return gp * 2;
    case "monthly":      return gp;
    case "annual":       return gp / 12;
    default:             return gp;
  }
}

function isSSOrVA(sourceType: string | undefined): boolean {
  if (!sourceType) return false;
  const t = sourceType.toLowerCase();
  return t.includes("ss_") || t.includes("ssdi") || t.includes("social_security") ||
    t.includes("va_disability") || t.includes("veterans_disability") || t === "ssa" || t === "va";
}

// CMI per Form 122A-1: excludes SS retirement, SSDI, VA disability (§ 101(10A))
function computeCMI(sub: Submission): number {
  const sources = sub.income_sources_json ?? [];
  let monthly = 0;
  for (const s of sources) {
    if (isSSOrVA(s.sourceType)) continue;
    monthly += toMonthly(Number(s.grossPerPeriod ?? 0), s.payFrequency);
  }
  if (monthly === 0) monthly = Number(sub.debtor_gross_monthly ?? 0);
  return Math.round(monthly * 100) / 100;
}

function computeCMIExcluded(sub: Submission): number {
  return (sub.income_sources_json ?? [])
    .filter(s => isSSOrVA(s.sourceType))
    .reduce((sum, s) => sum + toMonthly(Number(s.grossPerPeriod ?? 0), s.payFrequency), 0);
}

function computeHouseSize(sub: Submission): number {
  return 1 + (sub.filing_type === "joint" ? 1 : 0) + Number(sub.num_dependents ?? 0);
}

function computeExpenses(sub: Submission): number {
  return (
    Number(sub.exp_rent_mortgage ?? 0) + Number(sub.exp_utilities ?? 0) +
    Number(sub.exp_food ?? 0) + Number(sub.exp_transportation ?? 0) +
    Number(sub.exp_healthcare ?? 0) + Number(sub.exp_insurance ?? 0) +
    Number(sub.exp_childcare ?? 0) + Number(sub.exp_other ?? 0)
  );
}

function computeTotalDebt(sub: Submission): number {
  return (
    Number(sub.credit_card_debt ?? 0) + Number(sub.medical_debt ?? 0) +
    Number(sub.secured_debt ?? 0) + Number(sub.student_loan_debt ?? 0) +
    Number(sub.tax_debt ?? 0) + Number(sub.personal_loan_debt ?? 0) +
    Number(sub.other_unsecured ?? 0)
  );
}

type EligibilityResult = {
  cmi: number; cmiAnnual: number; cmiExcluded: number;
  houseSize: number; stateAbbr: string;
  medianMonthly: number; medianAnnual: number; aboveMedian: boolean;
  expenses: number; dmi: number; dmiEligible: boolean;
  result: "pass" | "borderline" | "fail";
  dischargeable: number; nonDischargeable: number; totalDebt: number;
  nonExemptVehicle: number; nonExemptHome: number; totalNonExemptAssets: number;
  hasAssetIssue: boolean; homeEquity: number; mortgageArrears: number; hasForeclosure: boolean;
  liquid: number; retirement: number;
  prefPayFlagged: boolean; insiderTotal: number;
  hasSofaIssue: boolean; hasNonDischargeableIssue: boolean;
  ch7Eligible: boolean; ch7Checks: EligibilityCheckItem[];
  ch13Feasible: boolean; ch13Checks: EligibilityCheckItem[];
  ch13Plan: Ch13Plan;
  recommendation: { chapter: "7" | "13"; reason: string; urgency: "normal" | "urgent" };
  autoAlerts: AutoAlert[];
  // legacy aliases for CaseRow
  disposable: number; ch7: boolean; ch13: boolean;
  prefPayFlagged2: boolean; nonExemptEquity: number; hasVehicleIssue: boolean;
};

function analyzeEligibility(sub: Submission): EligibilityResult {
  const stateAbbr = normalizeState(sub.exemption_state ?? sub.state);
  const houseSize = computeHouseSize(sub);
  const cmi = computeCMI(sub);
  const cmiExcluded = computeCMIExcluded(sub);
  const cmiAnnual = cmi * 12;
  const { monthly: medianMonthly, annual: medianAnnual } = getMedianData(sub.state, houseSize);
  const aboveMedian = cmiAnnual > medianAnnual;
  const expenses = computeExpenses(sub);
  const dmi = Math.round((cmi - expenses) * 100) / 100;
  const dmiEligible = dmi <= 500;
  const result: "pass" | "borderline" | "fail" =
    !aboveMedian ? "pass" : dmi > 214 ? "fail" : "borderline";

  // Debt
  const dischargeable = Number(sub.credit_card_debt??0)+Number(sub.medical_debt??0)+Number(sub.personal_loan_debt??0)+Number(sub.other_unsecured??0);
  const hasStudentLoan = Number(sub.student_loan_debt??0) > 0;
  const hasTaxDebt = Number(sub.tax_debt??0) > 0;
  const nonDischargeable = Number(sub.student_loan_debt??0)+Number(sub.tax_debt??0);
  const totalDebt = dischargeable + nonDischargeable + Number(sub.secured_debt??0);

  // Assets
  const vehEx = VEHICLE_EX[stateAbbr] ?? 4450;
  const homeEx = HOMESTEAD_EX[stateAbbr] ?? 31575;
  const vehicles = sub.vehicles_json ?? [];
  let nonExemptVehicle = 0;
  for (const v of vehicles) {
    const eq = Math.max(0, Number(v.value??0) - Number(v.loanBalance??0));
    nonExemptVehicle += Math.max(0, eq - vehEx);
  }
  const props = sub.real_properties_json ?? [];
  let homeEquity = 0, mortgageArrears = 0, hasForeclosure = false;
  for (const p of props) {
    homeEquity += Math.max(0, Number(p.value??0) - Number(p.mortgageBalance??0));
    if (p.isCurrent === false) {
      hasForeclosure = true;
      mortgageArrears += Number(p.mortgageBalance??0) * 0.05;
    }
  }
  const nonExemptHome = Math.max(0, homeEquity - homeEx);
  const totalNonExemptAssets = nonExemptVehicle + nonExemptHome;
  const hasAssetIssue = totalNonExemptAssets > 1000;
  const liquid = Number(sub.bank_balance??0);
  const retirement = Number(sub.retirement_balance??0);

  // SOFA
  const prefPays = sub.preferential_payments_json ?? [];
  const insiderTotal = prefPays
    .filter(p => /aunt|uncle|parent|sibling|relative|friend|insider|family/i.test(p.relationship))
    .reduce((s, p) => s + Number(p.amount), 0);
  const prefPayFlagged = Boolean(sub.has_preferential_payments) && prefPays.length > 0;
  const hasTransfers = Boolean(sub.has_transfers);
  const hasLuxury = Boolean(sub.recent_luxury);
  const hasSofaIssue = prefPayFlagged || hasTransfers || hasLuxury;
  const hasNonDischargeableIssue = hasStudentLoan || hasTaxDebt;

  // Five-point Ch.7 checks
  const ch7Checks: EligibilityCheckItem[] = [
    { label:"Under State Median Income (Means Test)", pass:!aboveMedian,
      detail:`${fmt(cmiAnnual)}/yr CMI vs. ${fmt(medianAnnual)}/yr ${stateAbbr||sub.state||"state"} median` },
    { label:"Schedule J DMI ≤ $500/mo", pass:dmiEligible,
      detail:`DMI: ${fmt(dmi)}/mo (income minus reported expenses)` },
    { label:"No Non-Exempt Assets", pass:!hasAssetIssue,
      detail:hasAssetIssue ? `${fmt(totalNonExemptAssets)} non-exempt exposure (vehicle+home equity over exemptions)` : "All assets within exemption limits" },
    { label:"No SOFA / Pre-Filing Issues", pass:!hasSofaIssue,
      detail:hasSofaIssue ? [prefPayFlagged&&"Preferential payments",hasTransfers&&"Asset transfers",hasLuxury&&"Luxury purchases"].filter(Boolean).join(", ") : "No preferential payments, transfers, or luxury issues" },
    { label:"No Non-Dischargeable Debt Concerns", pass:!hasNonDischargeableIssue,
      detail:hasNonDischargeableIssue ? [hasStudentLoan&&`Student loans ${fmt(Number(sub.student_loan_debt))}`,hasTaxDebt&&`Tax debt ${fmt(Number(sub.tax_debt))}`].filter(Boolean).join("; ") : "No material non-dischargeable debt" },
  ];
  const ch7Eligible = ch7Checks.every(c => c.pass);

  // Ch.13 plan (60-month)
  const vehCramDown = vehicles.reduce((sum, v) => {
    if (!v.hasLoan || !Number(v.loanBalance)) return sum;
    const cramVal = Math.min(Number(v.loanBalance), Number(v.value??0));
    const r = 0.10 / 12;
    return sum + cramVal * r / (1 - Math.pow(1 + r, -60));
  }, 0);
  const arrearsPayment = mortgageArrears / 60;
  const priorityPayment = Number(sub.tax_debt??0) / 60;
  const liquidationMin = totalNonExemptAssets / 60;
  const basePayment = vehCramDown + arrearsPayment + priorityPayment + liquidationMin;
  const withTrustee = basePayment / 0.90;
  const planPayment = Math.max(withTrustee, Math.max(0, dmi));
  const planFeasible = dmi >= withTrustee || totalDebt <= planPayment * 60;
  const ch13Plan: Ch13Plan = { vehicleCramDown:vehCramDown, arrearsPayment, priorityPayment, liquidationMin, basePayment, withTrustee, planPayment, planFeasible };

  // Four-point Ch.13 checks
  const ch13Checks: EligibilityCheckItem[] = [
    { label:"Regular Income Available", pass:cmi>0, detail:`${fmt(cmi)}/mo qualifies as regular income` },
    { label:"Plan Feasibility — DMI Funds Plan", pass:planFeasible, detail:`DMI ${fmt(dmi)}/mo vs. est. plan ${fmt(planPayment)}/mo` },
    { label:"Liquidation Test (§ 1325(a)(4))", pass:totalNonExemptAssets<planPayment*60, detail:`Plan pays ≥ ${fmt(totalNonExemptAssets)} liquidation value to unsecured` },
    { label:"Secured Debt Curable Through Plan", pass:true, detail:mortgageArrears>0?`${fmt(mortgageArrears)} mortgage arrears cured over 60 months`:"No mortgage arrears to cure" },
  ];
  const ch13Feasible = planFeasible;

  // Recommendation
  let recommendation: EligibilityResult["recommendation"];
  if (hasForeclosure)
    recommendation = { chapter:"13", reason:"Foreclosure pending — Ch. 13 triggers automatic stay and cures arrears over 60 months.", urgency:"urgent" };
  else if (!aboveMedian && dmiEligible && !hasAssetIssue && !hasSofaIssue && !hasNonDischargeableIssue)
    recommendation = { chapter:"7", reason:"Client meets all 5 Ch. 7 criteria: under median, DMI ≤ $500, assets exempt, no SOFA issues, no non-dischargeable debt.", urgency:"normal" };
  else if (!aboveMedian && hasAssetIssue && totalNonExemptAssets > 2000)
    recommendation = { chapter:"13", reason:`Non-exempt assets (${fmt(totalNonExemptAssets)}) would be liquidated in Ch. 7. Ch. 13 allows client to retain assets.`, urgency:"normal" };
  else if (!aboveMedian && hasSofaIssue)
    recommendation = { chapter:"13", reason:"SOFA issues present — Ch. 13 reduces trustee avoidance risk for preferential payments and transfers.", urgency:"normal" };
  else if (aboveMedian)
    recommendation = { chapter:"13", reason:"Over median income — full means test required. Ch. 13 likely required if disposable income supports plan.", urgency:"normal" };
  else if (ch13Feasible)
    recommendation = { chapter:"13", reason:"Case profile favors Ch. 13. Plan appears feasible based on reported income and expenses.", urgency:"normal" };
  else
    recommendation = { chapter:"7", reason:"Based on available information, Ch. 7 appears most appropriate. Attorney should verify all factors.", urgency:"normal" };

  // Auto-detected alerts
  const autoAlerts: AutoAlert[] = [];
  if (hasForeclosure) autoAlerts.push({ level:"urgent", message:"Foreclosure detected — automatic stay is critical; file immediately", category:"assets" });
  if (Boolean(sub.garnishment)) autoAlerts.push({ level:"urgent", message:"Active wage garnishment — filing stops it immediately via automatic stay", category:"income" });
  if (prefPayFlagged && insiderTotal>0) autoAlerts.push({ level:"warning", message:`Insider preferential payment: ${fmt(insiderTotal)} — trustee may avoid within 12mo (§ 547)`, category:"pref_payments" });
  if (prefPayFlagged && insiderTotal===0) autoAlerts.push({ level:"warning", message:"Non-insider preferential payment detected — trustee may avoid within 90 days (§ 547)", category:"pref_payments" });
  if (hasLuxury) autoAlerts.push({ level:"warning", message:"Recent luxury purchases — may be non-dischargeable under § 523(a)(2)(C) if > $800 within 90 days", category:"luxury" });
  if (hasTransfers) autoAlerts.push({ level:"warning", message:"Asset transfers within prior 2 years — trustee may avoid as fraudulent transfer (§ 548)", category:"transfers" });
  if (Boolean(sub.has_prior_bk)) autoAlerts.push({ level:"warning", message:"Prior bankruptcy on record — verify discharge eligibility and automatic stay availability", category:"prior_bk" });
  if (hasTaxDebt) autoAlerts.push({ level:"info", message:`Tax debt ${fmt(Number(sub.tax_debt))} — not dischargeable if < 3 years old; may qualify for priority treatment in Ch. 13`, category:"other" });
  if (hasStudentLoan) autoAlerts.push({ level:"info", message:`Student loans ${fmt(Number(sub.student_loan_debt))} — generally non-dischargeable; undue hardship required for discharge`, category:"other" });
  if (cmiExcluded > 0) autoAlerts.push({ level:"info", message:`${fmt(cmiExcluded)}/mo SS/VA income excluded from CMI per § 101(10A) — included in household budget only`, category:"income" });

  return {
    cmi, cmiAnnual, cmiExcluded, houseSize, stateAbbr,
    medianMonthly, medianAnnual, aboveMedian, expenses, dmi, dmiEligible, result,
    dischargeable, nonDischargeable, totalDebt,
    nonExemptVehicle, nonExemptHome, totalNonExemptAssets, hasAssetIssue,
    homeEquity, mortgageArrears, hasForeclosure, liquid, retirement,
    prefPayFlagged, insiderTotal, hasSofaIssue, hasNonDischargeableIssue,
    ch7Eligible, ch7Checks, ch13Feasible, ch13Checks, ch13Plan, recommendation, autoAlerts,
    // legacy aliases
    disposable: dmi, ch7: result !== "fail", ch13: true,
    prefPayFlagged2: prefPayFlagged, nonExemptEquity: nonExemptVehicle, hasVehicleIssue: nonExemptVehicle > 0,
  };
}

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGE_ORDER = [
  "sent_for_attorney_review",
  "attorney_accepted",
  "intake_complete",
  "intake_in_progress",
  "consultation_complete",
  "consultation_scheduled",
  "contacted",
  "new",
  "fee_quoted",
  "retained",
  "declined",
  "no_case",
];

const STAGE_CFG: Record<string, {
  label: string; short: string;
  bg: string; border: string; text: string; dot: string;
  priority: number;
}> = {
  sent_for_attorney_review: { label: "Pending Attorney Review", short: "Pending Review", bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-300", dot: "bg-amber-400", priority: 0 },
  attorney_accepted:        { label: "Attorney Accepted", short: "Accepted", bg: "bg-emerald-500/10", border: "border-emerald-500/25", text: "text-emerald-300", dot: "bg-emerald-400", priority: 1 },
  fee_quoted:               { label: "Fee Quoted", short: "Fee Quoted", bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-300", dot: "bg-orange-400", priority: 2 },
  retained:                 { label: "Retained", short: "Retained", bg: "bg-green-500/10", border: "border-green-500/20", text: "text-green-300", dot: "bg-green-400", priority: 3 },
  intake_complete:          { label: "Intake Complete", short: "Intake Done", bg: "bg-sky-500/10", border: "border-sky-500/20", text: "text-sky-300", dot: "bg-sky-400", priority: 4 },
  intake_in_progress:       { label: "Intake In Progress", short: "In Progress", bg: "bg-sky-500/8", border: "border-sky-500/15", text: "text-sky-400", dot: "bg-sky-500", priority: 5 },
  consultation_complete:    { label: "Consultation Complete", short: "Consult Done", bg: "bg-teal-500/10", border: "border-teal-500/20", text: "text-teal-300", dot: "bg-teal-400", priority: 6 },
  consultation_scheduled:   { label: "Consult Scheduled", short: "Scheduled", bg: "bg-teal-500/8", border: "border-teal-500/15", text: "text-teal-400", dot: "bg-teal-500", priority: 7 },
  contacted:                { label: "Contacted", short: "Contacted", bg: "bg-slate-700/20", border: "border-slate-600/30", text: "text-slate-400", dot: "bg-slate-500", priority: 8 },
  new:                      { label: "New Lead", short: "New", bg: "bg-slate-700/20", border: "border-slate-600/30", text: "text-slate-400", dot: "bg-slate-500", priority: 9 },
  declined:                 { label: "Declined", short: "Declined", bg: "bg-red-500/8", border: "border-red-500/15", text: "text-red-400", dot: "bg-red-500", priority: 10 },
  no_case:                  { label: "No Case", short: "No Case", bg: "bg-slate-700/20", border: "border-slate-600/30", text: "text-slate-400", dot: "bg-slate-500", priority: 11 },
};

// ─── Case Type / Fee Constants ─────────────────────────────────────────────────

const CASE_TYPES = [
  { value: "ch7_regular",    label: "Ch. 7 Regular",    sub: "Filing fee separate" },
  { value: "ch7_bifurcated", label: "Ch. 7 Bifurcated", sub: "Filing fee rolled in" },
  { value: "ch13_flat_fee",  label: "Ch. 13 Flat Fee",  sub: "Portion upfront, rest through plan" },
  { value: "limited_scope",  label: "Limited Scope",    sub: "Defined scope, flat fee" },
];

const ATTY_FEES: Record<string, number> = {
  ch7_regular: 1500, ch7_bifurcated: 1838, ch13_flat_fee: 4000, limited_scope: 750,
};
const FILING_FEES: Record<string, number> = {
  ch7_regular: 338, ch7_bifurcated: 338, ch13_flat_fee: 313, limited_scope: 0,
};

// ─── Eligibility Badge ────────────────────────────────────────────────────────

function EligBadge({ result, chapter }: { result: "pass" | "borderline" | "fail" | null; chapter: 7 | 13 }) {
  if (chapter === 13) {
    return (
      <span className="flex items-center gap-1 text-[9px] font-bold text-sky-300 bg-sky-500/15 border border-sky-500/20 rounded-full px-1.5 py-0.5">
        <CheckCircle2 className="w-2.5 h-2.5" /> Ch.13
      </span>
    );
  }
  if (!result) return null;
  const cfg = {
    pass: { bg: "bg-emerald-500/15 border-emerald-500/25 text-emerald-300", icon: <CheckCircle2 className="w-2.5 h-2.5" />, label: "Ch.7 ✓" },
    borderline: { bg: "bg-amber-500/15 border-amber-500/25 text-amber-300", icon: <AlertTriangle className="w-2.5 h-2.5" />, label: "Ch.7 ~" },
    fail: { bg: "bg-red-500/15 border-red-500/25 text-red-300", icon: <X className="w-2.5 h-2.5" />, label: "Ch.7 ✗" },
  }[result];
  return (
    <span className={`flex items-center gap-1 text-[9px] font-bold border rounded-full px-1.5 py-0.5 ${cfg.bg}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ─── Issue Ack Button ─────────────────────────────────────────────────────────

function IssueAckButton({ issue, onAck }: { issue: IntakeIssue; onAck: (id: string, initials: string) => void }) {
  const [open, setOpen] = useState(false);
  const [init, setInit] = useState("");
  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="text-[10px] text-slate-600 hover:text-amber-400 border border-slate-700/50 border-dashed rounded-xl px-3 py-1.5 w-full text-left transition-colors flex items-center gap-1.5">
      <Circle className="w-2.5 h-2.5" /> Record client acknowledgment
    </button>
  );
  return (
    <div className="flex items-center gap-2">
      <input type="text" maxLength={4} value={init} onChange={e => setInit(e.target.value.toUpperCase())}
        placeholder="Initials" className="w-20 bg-slate-800 border border-slate-700 text-white text-xs text-center rounded-xl px-2 py-1.5 focus:outline-none focus:border-emerald-500 uppercase tracking-widest" />
      <button disabled={!init.trim()} onClick={() => onAck(issue.id, init.trim())}
        className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl disabled:opacity-50 transition-colors">
        <CheckCheck className="w-3 h-3" /> Record
      </button>
      <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ─── Review Modal ─────────────────────────────────────────────────────────────

function ReviewModal({
  lead, submission, review: initialReview, issues: initialIssues,
  onClose, onSaved,
}: {
  lead: Lead;
  submission: Submission | null;
  review: IntakeReview | null;
  issues: IntakeIssue[];
  onClose: () => void;
  onSaved: (review: IntakeReview) => void;
}) {
  const [tab, setTab] = useState<"eligibility" | "issues" | "decision">("eligibility");
  const [review, setReview] = useState<IntakeReview | null>(initialReview);
  const [issues, setIssues] = useState<IntakeIssue[]>(initialIssues);
  const [saving, setSaving] = useState(false);
  const [eligNotes, setEligNotes]   = useState(initialReview?.eligibility_notes ?? "");
  const [qualNotes, setQualNotes]   = useState(initialReview?.qualify_analysis_notes ?? "");
  const [prefNotes, setPrefNotes]   = useState(initialReview?.pref_pay_notes ?? "");
  const [decision, setDecision]     = useState(initialReview?.decision ?? "accepted");
  const [caseType, setCaseType]     = useState(initialReview?.case_type ?? "ch7_regular");
  const [attFee, setAttFee]         = useState(String(initialReview?.attorney_fee ?? ATTY_FEES.ch7_regular));
  const [filFee, setFilFee]         = useState(String(initialReview?.court_filing_fee ?? FILING_FEES.ch7_regular));
  const [down, setDown]             = useState(String(initialReview?.down_payment ?? 500));
  const [months, setMonths]         = useState(String(initialReview?.plan_months ?? 4));
  const [up13, setUp13]             = useState(String(initialReview?.ch13_upfront_amount ?? 1500));
  const [pl13, setPl13]             = useState(String(initialReview?.ch13_plan_portion ?? 2500));
  const [lScope, setLScope]         = useState(initialReview?.limited_scope_desc ?? "");
  const [decNotes, setDecNotes]     = useState(initialReview?.decision_notes ?? "");
  const [showAddIssue, setShowAddIssue] = useState(false);
  const [newCat, setNewCat]   = useState("income");
  const [newSev, setNewSev]   = useState("warning");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc]  = useState("");
  const [addingIssue, setAddingIssue] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");

  const elig = submission ? analyzeEligibility(submission) : null;

  async function patchReview(fields: Partial<IntakeReview>) {
    if (!review) return;
    await fetch(`${SUPABASE_URL}/rest/v1/attorney_intake_reviews?id=eq.${review.id}`, {
      method: "PATCH",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
    });
    setReview(r => r ? { ...r, ...fields } : r);
  }

  async function addIssue() {
    if (!review || !newTitle.trim()) return;
    setAddingIssue(true);
    const created = await sbPost<IntakeIssue>("attorney_intake_issues", {
      review_id: review.id, category: newCat, severity: newSev,
      title: newTitle, description: newDesc, sort_order: issues.length,
    });
    if (created) setIssues(p => [...p, created]);
    setNewTitle(""); setNewDesc(""); setShowAddIssue(false); setAddingIssue(false);
  }

  async function saveNote(id: string, note: string) {
    await fetch(`${SUPABASE_URL}/rest/v1/attorney_intake_issues?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ attorney_note: note }),
    });
    setIssues(p => p.map(i => i.id === id ? { ...i, attorney_note: note } : i));
    setEditingId(null);
  }

  async function ackIssue(id: string, initials: string) {
    const now = new Date().toISOString();
    await fetch(`${SUPABASE_URL}/rest/v1/attorney_intake_issues?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ client_acknowledged: true, client_initials: initials, acknowledged_at: now }),
    });
    setIssues(p => p.map(i => i.id === id ? { ...i, client_acknowledged: true, client_initials: initials, acknowledged_at: now } : i));
  }

  async function saveDecision() {
    if (!review) return;
    setSaving(true);
    const ch = caseType.startsWith("ch7") ? 7 : caseType.startsWith("ch13") ? 13 : null;
    const totalFee =
      caseType === "ch13_flat_fee"
        ? (parseFloat(up13) || 0) + (parseFloat(pl13) || 0) + (parseFloat(filFee) || 0)
        : (parseFloat(attFee) || 0) + (caseType === "ch7_regular" ? (parseFloat(filFee) || 0) : 0);
    const fields: Partial<IntakeReview> = {
      decision, case_type: decision === "accepted" ? caseType : null,
      chapter: decision === "accepted" ? ch : null,
      attorney_fee: parseFloat(attFee) || null,
      court_filing_fee: caseType !== "limited_scope" ? parseFloat(filFee) || null : null,
      total_fee: decision === "accepted" ? totalFee : null,
      down_payment: (caseType === "ch7_regular" || caseType === "ch7_bifurcated") ? parseFloat(down) || null : null,
      plan_months: (caseType === "ch7_regular" || caseType === "ch7_bifurcated") ? parseInt(months) || null : null,
      ch13_upfront_amount: caseType === "ch13_flat_fee" ? parseFloat(up13) || null : null,
      ch13_plan_portion: caseType === "ch13_flat_fee" ? parseFloat(pl13) || null : null,
      limited_scope_desc: caseType === "limited_scope" ? lScope : null,
      decision_notes: decNotes || null,
      eligibility_notes: eligNotes || null,
      qualify_analysis_notes: qualNotes || null,
      pref_pay_notes: prefNotes || null,
      review_status: "complete",
      decided_at: new Date().toISOString(),
    };
    await patchReview(fields);
    // Legacy table
    await sbPost("attorney_case_acceptances", {
      lead_id: lead.id, submission_id: submission?.id ?? null,
      attorney_name: "Jennifer Smith, Esq.", decision,
      case_type: fields.case_type, chapter: fields.chapter,
      attorney_fee: fields.attorney_fee, court_filing_fee: fields.court_filing_fee,
      total_fee: fields.total_fee, down_payment: fields.down_payment,
      plan_months: fields.plan_months, ch13_upfront_amount: fields.ch13_upfront_amount,
      ch13_plan_portion: fields.ch13_plan_portion, limited_scope_desc: fields.limited_scope_desc,
      decision_notes: fields.decision_notes, decided_at: fields.decided_at,
    });
    const newStatus = decision === "accepted" ? "attorney_accepted" : decision === "declined" ? "declined" : "sent_for_attorney_review";
    await sbPatch("intake_leads", lead.id, { status: newStatus });
    setSaving(false);
    onSaved({ ...review, ...fields } as IntakeReview);
  }

  const totalFeeDisplay =
    caseType === "ch13_flat_fee"
      ? (parseFloat(up13) || 0) + (parseFloat(pl13) || 0) + (parseFloat(filFee) || 0)
      : (parseFloat(attFee) || 0) + (caseType === "ch7_regular" ? (parseFloat(filFee) || 0) : 0);

  const openIssues = issues.filter(i => !i.client_acknowledged).length;
  const errors = issues.filter(i => i.severity === "error").length;
  const prefPays = submission?.preferential_payments_json ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-6 bg-slate-950/90 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-3xl bg-[#080e1a] border border-slate-700 rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Scale className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Attorney Intake Review</span>
              {errors > 0 && <span className="text-[9px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5">{errors} ERROR{errors > 1 ? "S" : ""}</span>}
            </div>
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Georgia', serif" }}>{lead.full_name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ch.{lead.chapter_interest ?? "?"} interest · {lead.state ?? "—"}
              {elig && ` · ${elig.houseSize}-person household`}
              {submission && ` · ${submission.marital_status ?? "single"}`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          {([
            { id: "eligibility" as const, label: "Eligibility Analysis" },
            { id: "issues" as const, label: `Issues${issues.length > 0 ? ` (${issues.length})` : ""}` },
            { id: "decision" as const, label: "Decision & Fees" },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 ${tab === t.id ? "text-amber-400 border-amber-400" : "text-slate-500 border-transparent hover:text-slate-300"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 max-h-[70vh]">

          {/* ─── ELIGIBILITY ─── */}
          {tab === "eligibility" && elig && (
            <div className="space-y-4">

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "CMI · Form 122A-1", val: fmt(elig.cmi)+"/mo", sub: fmt(elig.cmiAnnual)+"/yr" },
                  { label: `${elig.stateAbbr||lead.state||"State"} Median (${elig.houseSize}-person)`, val: fmt(elig.medianMonthly)+"/mo", sub: fmt(elig.medianAnnual)+"/yr" },
                  { label: "Monthly Expenses", val: fmt(elig.expenses), sub: "Reported Schedule J" },
                  { label: "Schedule J DMI", val: fmt(elig.dmi)+"/mo", sub: elig.dmiEligible ? "≤ $500 threshold ✓" : "> $500 threshold ✗", warn: !elig.dmiEligible },
                ].map(s => (
                  <div key={s.label} className="bg-slate-800/40 rounded-xl p-3 text-center">
                    <p className="text-[9px] text-slate-500 leading-tight mb-1">{s.label}</p>
                    <p className={`text-sm font-bold ${"warn" in s && s.warn ? "text-red-400" : "text-white"}`}>{s.val}</p>
                    <p className="text-[9px] text-slate-600 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Case Recommendation */}
              <div className={`rounded-2xl border p-4 ${elig.recommendation.urgency==="urgent" ? "bg-red-500/8 border-red-500/25" : elig.recommendation.chapter==="7" ? "bg-emerald-500/5 border-emerald-500/20" : "bg-sky-500/5 border-sky-500/20"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${elig.recommendation.urgency==="urgent"?"bg-red-500/15":elig.recommendation.chapter==="7"?"bg-emerald-500/15":"bg-sky-500/15"}`}>
                    <Scale className={`w-5 h-5 ${elig.recommendation.urgency==="urgent"?"text-red-400":elig.recommendation.chapter==="7"?"text-emerald-400":"text-sky-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Case Recommendation</p>
                      {elig.recommendation.urgency==="urgent" && <span className="text-[9px] font-bold text-red-300 bg-red-500/20 border border-red-500/30 rounded-full px-1.5 py-0.5">URGENT</span>}
                    </div>
                    <p className={`text-sm font-bold ${elig.recommendation.urgency==="urgent"?"text-red-300":elig.recommendation.chapter==="7"?"text-emerald-300":"text-sky-300"}`}>
                      Recommend Chapter {elig.recommendation.chapter}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{elig.recommendation.reason}</p>
                  </div>
                </div>
              </div>

              {/* Ch.7 — 5-point eligibility checks */}
              <div className={`rounded-2xl border p-4 ${elig.ch7Eligible?"bg-emerald-500/5 border-emerald-500/20":"bg-red-500/5 border-red-500/20"}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${elig.ch7Eligible?"bg-emerald-500/15":"bg-red-500/15"}`}>
                    {elig.ch7Eligible ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                  </div>
                  <p className={`text-sm font-bold flex-1 ${elig.ch7Eligible?"text-emerald-300":"text-red-300"}`}>
                    Chapter 7 Eligibility — {elig.ch7Eligible ? "ALL CRITERIA MET" : "CRITERIA NOT MET"}
                  </p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${elig.result==="pass"?"bg-emerald-500/15 text-emerald-400":elig.result==="borderline"?"bg-amber-500/15 text-amber-400":"bg-red-500/15 text-red-400"}`}>
                    {elig.result.toUpperCase()}
                  </span>
                </div>
                {/* Income bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                    <span>CMI {fmt(elig.cmi)}/mo</span>
                    <span>{elig.stateAbbr||lead.state} Median {fmt(elig.medianMonthly)}/mo</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${elig.aboveMedian?"bg-red-500":"bg-emerald-500"}`}
                      style={{ width:`${Math.min(100,(elig.cmi/(elig.medianMonthly*1.4))*100)}%` }} />
                  </div>
                </div>
                {/* 5 checks */}
                <div className="space-y-1.5">
                  {elig.ch7Checks.map((chk, i) => (
                    <div key={i} className={`flex items-start gap-2 rounded-xl px-3 py-2 ${chk.pass?"bg-emerald-500/5":"bg-red-500/5"}`}>
                      <div className="flex-shrink-0 mt-0.5">
                        {chk.pass ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-red-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${chk.pass?"text-emerald-300":"text-red-300"}`}>{chk.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{chk.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Dischargeable summary */}
                {elig.dischargeable > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-2 gap-2">
                    <div className="bg-slate-800/40 rounded-xl p-2.5">
                      <p className="text-[9px] text-slate-500">Dischargeable Debt</p>
                      <p className="text-sm font-bold text-emerald-400 mt-0.5">{fmt(elig.dischargeable)}</p>
                      <p className="text-[9px] text-slate-600">CC, medical, personal</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-xl p-2.5">
                      <p className="text-[9px] text-slate-500">Non-Dischargeable</p>
                      <p className="text-sm font-bold text-amber-400 mt-0.5">{fmt(elig.nonDischargeable)}</p>
                      <p className="text-[9px] text-slate-600">Student loans, recent taxes</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Ch.13 — 4-point checks + plan funding */}
              <div className={`rounded-2xl border p-4 ${elig.ch13Feasible?"bg-sky-500/5 border-sky-500/20":"bg-amber-500/5 border-amber-500/20"}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${elig.ch13Feasible?"bg-sky-500/15":"bg-amber-500/15"}`}>
                    <CheckCircle2 className={`w-4 h-4 ${elig.ch13Feasible?"text-sky-400":"text-amber-400"}`} />
                  </div>
                  <p className={`text-sm font-bold flex-1 ${elig.ch13Feasible?"text-sky-300":"text-amber-300"}`}>
                    Chapter 13 — Plan {elig.ch13Feasible ? "FEASIBLE" : "AT RISK"}
                  </p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${elig.ch13Feasible?"bg-sky-500/15 text-sky-400":"bg-amber-500/15 text-amber-400"}`}>
                    {elig.ch13Feasible?"FEASIBLE":"AT RISK"}
                  </span>
                </div>
                {/* 4 checks */}
                <div className="space-y-1.5 mb-3">
                  {elig.ch13Checks.map((chk, i) => (
                    <div key={i} className={`flex items-start gap-2 rounded-xl px-3 py-2 ${chk.pass?"bg-sky-500/5":"bg-amber-500/5"}`}>
                      <div className="flex-shrink-0 mt-0.5">
                        {chk.pass ? <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${chk.pass?"text-sky-300":"text-amber-300"}`}>{chk.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{chk.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Plan Funding Analysis */}
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Plan Funding Analysis — 60-Month Plan</p>
                  <div className="space-y-1">
                    {([
                      { label:"Vehicle Cram-Down (10%, 60mo)", val:elig.ch13Plan.vehicleCramDown, show:elig.ch13Plan.vehicleCramDown>0 },
                      { label:"Mortgage Arrears Cure", val:elig.ch13Plan.arrearsPayment, show:elig.ch13Plan.arrearsPayment>0 },
                      { label:"Priority Debt (Tax)", val:elig.ch13Plan.priorityPayment, show:elig.ch13Plan.priorityPayment>0 },
                      { label:"Liquidation Minimum (§ 1325(a)(4))", val:elig.ch13Plan.liquidationMin, show:elig.ch13Plan.liquidationMin>0 },
                    ] as { label:string; val:number; show:boolean }[]).filter(r => r.show).map(row => (
                      <div key={row.label} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{row.label}</span>
                        <span className="text-white font-semibold">{fmt(row.val)}/mo</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-700/50">
                      <span>+ 10% Chapter 13 Trustee Fee</span>
                      <span className="text-slate-400">{fmt(elig.ch13Plan.withTrustee - elig.ch13Plan.basePayment)}/mo</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-bold pt-1 border-t border-slate-600/50 mt-1">
                      <span className="text-white">Est. Plan Payment</span>
                      <span className={elig.ch13Plan.planFeasible?"text-sky-300":"text-amber-300"}>{fmt(elig.ch13Plan.planPayment)}/mo</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-slate-500">Client DMI Available</span>
                      <span className={elig.dmi>=elig.ch13Plan.planPayment?"text-emerald-400 font-semibold":"text-red-400 font-semibold"}>{fmt(elig.dmi)}/mo</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Total Plan (60 months)</span>
                      <span className="text-slate-400">{fmt(elig.ch13Plan.planPayment*60)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SS/VA excluded note */}
              {elig.cmiExcluded > 0 && (
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-sky-300 leading-relaxed">
                    <span className="font-semibold">{fmt(elig.cmiExcluded)}/mo</span> SS/VA income excluded from CMI per 11 U.S.C. § 101(10A). Included in household budget only — does not affect the means test.
                  </p>
                </div>
              )}

              {/* Income-to-qualify projection */}
              {(elig.result === "fail" || elig.result === "borderline") && (
                <div className="rounded-2xl border p-4 bg-amber-500/5 border-amber-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <p className="text-sm font-bold text-amber-300">Income-to-Qualify Projection</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    To qualify for Ch. 7, 6-month average CMI must be below the {elig.stateAbbr||lead.state} {elig.houseSize}-person median of <span className="text-white font-semibold">{fmt(elig.medianMonthly)}/mo</span>. Current CMI is <span className="text-amber-300 font-semibold">{fmt(elig.cmi)}/mo</span>
                    {elig.aboveMedian && <span className="text-red-400"> — {fmt(elig.cmi - elig.medianMonthly)} above median</span>}.
                  </p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label:"Target Monthly", val:fmt(elig.medianMonthly*0.98), sub:"Stay below this" },
                      { label:"Avg Needed (3-mo)", val:fmt(elig.medianMonthly*0.98), sub:"Filing in 3 months" },
                      { label:"Avg Needed (6-mo)", val:fmt(elig.medianMonthly*0.98), sub:"Filing in 6 months" },
                    ].map(s => (
                      <div key={s.label} className="bg-slate-800/50 border border-amber-500/15 rounded-xl p-2.5 text-center">
                        <p className="text-[9px] text-slate-500">{s.label}</p>
                        <p className="text-sm font-bold text-amber-300 mt-0.5">{s.val}</p>
                        <p className="text-[9px] text-slate-600 mt-0.5">{s.sub}</p>
                      </div>
                    ))}
                  </div>
                  <textarea rows={2} value={qualNotes} onChange={e => setQualNotes(e.target.value)}
                    onBlur={() => review && patchReview({ qualify_analysis_notes: qualNotes })}
                    placeholder="Attorney analysis: income trend, timing recommendation, Ch.13 vs wait…"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none" />
                </div>
              )}

              {/* Pref pay */}
              {elig.prefPayFlagged && (
                <div className="rounded-2xl border p-4 bg-red-500/5 border-red-500/25">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <p className="text-sm font-bold text-red-300">Preferential Payment Flag</p>
                    {elig.insiderTotal > 0 && <span className="ml-auto text-[10px] font-bold text-red-300 bg-red-500/15 border border-red-500/25 rounded-full px-1.5 py-0.5">{fmt(elig.insiderTotal)} insider</span>}
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {prefPays.map((pp, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-800/40 rounded-xl px-3 py-2">
                        <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white">{pp.creditor}</p>
                          <p className="text-[10px] text-slate-500">{pp.relationship} · {pp.date}</p>
                        </div>
                        <p className="text-xs font-bold text-red-300">{fmt(pp.amount)}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">11 U.S.C. § 547: Trustee may avoid insider payments within 12 months; non-insider within 90 days. Recipient may be required to return funds to estate.</p>
                  <textarea rows={2} value={prefNotes} onChange={e => setPrefNotes(e.target.value)}
                    onBlur={() => review && patchReview({ pref_pay_notes: prefNotes })}
                    placeholder="Attorney strategy notes on preferential payments…"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none" />
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Attorney Eligibility Notes</label>
                <textarea rows={3} value={eligNotes} onChange={e => setEligNotes(e.target.value)}
                  onBlur={() => review && patchReview({ eligibility_notes: eligNotes })}
                  placeholder="Overall eligibility assessment, chapter recommendation, strategy notes…"
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none" />
              </div>
            </div>
          )}

          {/* ─── ISSUES ─── */}
          {tab === "issues" && (
            <div className="space-y-3">

              {/* Auto-detected alerts (read-only, computed from intake data) */}
              {elig && elig.autoAlerts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Auto-Detected from Intake Data</p>
                  {elig.autoAlerts.map((alert, i) => {
                    const ac = alert.level === "urgent"
                      ? { bg:"bg-red-500/8 border-red-500/25", icon:<AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />, text:"text-red-300", badge:"bg-red-500 text-white", label:"URGENT" }
                      : alert.level === "warning"
                      ? { bg:"bg-amber-500/8 border-amber-500/20", icon:<Flag className="w-3 h-3 text-amber-400 flex-shrink-0" />, text:"text-amber-300", badge:"bg-amber-500/20 text-amber-300 border border-amber-500/30", label:"WARNING" }
                      : { bg:"bg-sky-500/5 border-sky-500/20", icon:<Info className="w-3 h-3 text-sky-400 flex-shrink-0" />, text:"text-sky-300", badge:"bg-sky-500/20 text-sky-300 border border-sky-500/30", label:"INFO" };
                    return (
                      <div key={i} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${ac.bg}`}>
                        {ac.icon}
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${ac.badge}`}>{ac.label}</span>
                        <p className={`text-xs ${ac.text} leading-snug`}>{alert.message}</p>
                      </div>
                    );
                  })}
                  <div className="border-t border-slate-800 pt-1" />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-white">{issues.length} Issue{issues.length !== 1 ? "s" : ""}</p>
                  {errors > 0 && <span className="text-[9px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5">{errors} ERROR</span>}
                  {openIssues > 0 && <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/20 rounded-full px-1.5 py-0.5">{openIssues} UNACK'D</span>}
                </div>
                <button onClick={() => setShowAddIssue(s => !s)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-1.5 hover:bg-amber-500/15 transition-colors">
                  <Plus className="w-3 h-3" /> Add Issue
                </button>
              </div>

              {showAddIssue && (
                <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Category</label>
                      <select value={newCat} onChange={e => setNewCat(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500">
                        {[["income","Income / Means Test"],["pref_payments","Pref. Payments"],["assets","Assets"],["prior_bk","Prior BK"],["luxury","Luxury"],["transfers","Transfers"],["other","Other"]].map(([v,l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Severity</label>
                      <select value={newSev} onChange={e => setNewSev(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500">
                        <option value="error">Error — Must Resolve</option>
                        <option value="warning">Warning</option>
                        <option value="info">Info / Note</option>
                      </select>
                    </div>
                  </div>
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Issue title…"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-500" />
                  <textarea rows={2} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description / legal basis…"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddIssue(false)} className="flex-1 py-2 text-xs font-semibold text-slate-400 border border-slate-700 rounded-xl hover:text-white">Cancel</button>
                    <button onClick={addIssue} disabled={addingIssue || !newTitle.trim()}
                      className="flex-1 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl disabled:opacity-50">
                      {addingIssue ? <RefreshCw className="w-3 h-3 animate-spin mx-auto" /> : "Add Issue"}
                    </button>
                  </div>
                </div>
              )}

              {issues.length === 0 && !showAddIssue && (
                <div className="text-center py-10 bg-slate-800/20 rounded-2xl border border-slate-800">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500/50 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No issues flagged</p>
                </div>
              )}

              {issues.map(issue => {
                const sev = issue.severity === "error"
                  ? { bg: "bg-red-500/8", border: "border-red-500/25", icon: <AlertTriangle className="w-3.5 h-3.5 text-red-400" />, badge: "bg-red-500 text-white", label: "ERROR" }
                  : issue.severity === "warning"
                  ? { bg: "bg-amber-500/8", border: "border-amber-500/20", icon: <Flag className="w-3.5 h-3.5 text-amber-400" />, badge: "bg-amber-500/20 text-amber-300 border border-amber-500/30", label: "WARNING" }
                  : { bg: "bg-sky-500/5", border: "border-sky-500/20", icon: <Info className="w-3.5 h-3.5 text-sky-400" />, badge: "bg-sky-500/20 text-sky-300 border border-sky-500/30", label: "INFO" };
                const catL: Record<string,string> = { income:"Income", pref_payments:"Pref. Pay", assets:"Assets", prior_bk:"Prior BK", luxury:"Luxury", transfers:"Transfers", other:"Other" };
                return (
                  <div key={issue.id} className={`rounded-2xl border p-4 space-y-3 ${sev.bg} ${sev.border}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">{sev.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sev.badge}`}>{sev.label}</span>
                          <span className="text-[9px] text-slate-500 bg-slate-800/60 rounded-full px-1.5 py-0.5">{catL[issue.category] ?? issue.category}</span>
                          {issue.client_acknowledged && (
                            <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5 flex items-center gap-1">
                              <CheckCheck className="w-2.5 h-2.5" /> Ack{issue.client_initials ? ` · ${issue.client_initials}` : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-white">{issue.title}</p>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{issue.description}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Attorney Note</p>
                      {editingId === issue.id ? (
                        <div className="space-y-2">
                          <textarea rows={2} value={editNote} onChange={e => setEditNote(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none" />
                          <div className="flex gap-2">
                            <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 text-[10px] font-semibold text-slate-400 border border-slate-700 rounded-xl hover:text-white">Cancel</button>
                            <button onClick={() => saveNote(issue.id, editNote)} className="flex-1 py-1.5 text-[10px] font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl">Save</button>
                          </div>
                        </div>
                      ) : issue.attorney_note ? (
                        <div className="flex items-start gap-2">
                          <div className="flex-1 bg-slate-800/60 rounded-xl px-3 py-2">
                            <p className="text-xs text-slate-300">{issue.attorney_note}</p>
                          </div>
                          <button onClick={() => { setEditingId(issue.id); setEditNote(issue.attorney_note ?? ""); }}
                            className="text-slate-500 hover:text-white flex-shrink-0"><PenLine className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingId(issue.id); setEditNote(""); }}
                          className="w-full text-left text-xs text-slate-600 hover:text-slate-400 bg-slate-800/30 border border-slate-700/50 border-dashed rounded-xl px-3 py-2 transition-colors">
                          + Add attorney note…
                        </button>
                      )}
                    </div>
                    {!issue.client_acknowledged
                      ? <IssueAckButton issue={issue} onAck={ackIssue} />
                      : (
                        <div className="flex items-center gap-2 bg-emerald-500/8 border border-emerald-500/15 rounded-xl px-3 py-2">
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <p className="text-xs text-emerald-400">Acknowledged{issue.client_initials ? ` — "${issue.client_initials}"` : ""}</p>
                          {issue.acknowledged_at && <p className="text-[9px] text-slate-600 ml-auto">{fmtDate(issue.acknowledged_at)}</p>}
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── DECISION ─── */}
          {tab === "decision" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Total Debt", val: fmt(elig?.totalDebt) },
                  { label: "Monthly Income", val: fmt(elig?.cmi) },
                  { label: "Ch.7 Eligible", val: elig ? (elig.ch7Eligible ? "Yes" : elig.result === "borderline" ? "Borderline" : "No") : "—", color: elig?.ch7Eligible ? "text-emerald-400" : elig?.result === "borderline" ? "text-amber-400" : "text-red-400" },
                  { label: "Open Issues", val: String(openIssues), color: openIssues > 0 ? "text-amber-400" : "text-emerald-400" },
                ].map(s => (
                  <div key={s.label} className="bg-slate-800/40 rounded-xl p-3 text-center">
                    <p className="text-[9px] text-slate-500">{s.label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${"color" in s ? s.color : "text-white"}`}>{s.val}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Attorney Decision</p>
                <div className="grid grid-cols-3 gap-2">
                  {[["accepted","Accept Case"],["needs_more_info","Need More Info"],["declined","Decline"]].map(([v,l]) => (
                    <button key={v} onClick={() => setDecision(v)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${decision === v
                        ? v === "accepted" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        : v === "declined" ? "bg-red-500/20 border-red-500/40 text-red-300"
                        : "bg-amber-500/20 border-amber-500/40 text-amber-300"
                        : "bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-500"
                      }`}>{l}</button>
                  ))}
                </div>
              </div>

              {decision === "accepted" && (
                <>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Case Type</p>
                    <div className="space-y-2">
                      {CASE_TYPES.map(ct => (
                        <button key={ct.value} onClick={() => { setCaseType(ct.value); setAttFee(String(ATTY_FEES[ct.value])); setFilFee(String(FILING_FEES[ct.value])); }}
                          className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${caseType === ct.value ? "bg-amber-500/10 border-amber-500/30 text-white" : "bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">{ct.label}</p>
                            {caseType === ct.value && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{ct.sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Attorney Fee</label>
                      <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                        <input type="number" value={attFee} onChange={e => setAttFee(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:border-amber-500" /></div>
                    </div>
                    {caseType !== "limited_scope" && caseType !== "ch7_bifurcated" && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Court Filing Fee</label>
                        <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                          <input type="number" value={filFee} onChange={e => setFilFee(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:border-amber-500" /></div>
                      </div>
                    )}
                    {(caseType === "ch7_regular" || caseType === "ch7_bifurcated") && (<>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Down Payment</label>
                        <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                          <input type="number" value={down} onChange={e => setDown(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:border-amber-500" /></div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Plan Months</label>
                        <input type="number" value={months} onChange={e => setMonths(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500" />
                      </div>
                    </>)}
                    {caseType === "ch13_flat_fee" && (<>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Upfront Amount</label>
                        <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                          <input type="number" value={up13} onChange={e => setUp13(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:border-amber-500" /></div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Through Plan</label>
                        <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                          <input type="number" value={pl13} onChange={e => setPl13(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:border-amber-500" /></div>
                      </div>
                    </>)}
                  </div>
                  <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Total Fee</span>
                    <span className="text-lg font-bold text-white">{fmt(totalFeeDisplay)}</span>
                  </div>
                  {caseType === "limited_scope" && (
                    <textarea rows={2} value={lScope} onChange={e => setLScope(e.target.value)}
                      placeholder="Scope of services…"
                      className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none" />
                  )}
                </>
              )}

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
                  {decision === "accepted" ? "Notes & Advice" : decision === "declined" ? "Reason for Declination" : "Info Needed"}
                </label>
                <textarea rows={3} value={decNotes} onChange={e => setDecNotes(e.target.value)}
                  placeholder={decision === "accepted" ? "Strategy notes, instructions for paralegal…" : decision === "declined" ? "Reason for declining…" : "What additional information is needed…"}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="py-2.5 px-4 text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 rounded-xl">Cancel</button>
          <div className="flex gap-1.5 flex-1 justify-end">
            {tab !== "eligibility" && (
              <button onClick={() => setTab(tab === "issues" ? "eligibility" : "issues")}
                className="py-2.5 px-4 text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 rounded-xl">Back</button>
            )}
            {tab !== "decision" ? (
              <button onClick={() => setTab(tab === "eligibility" ? "issues" : "decision")}
                className="flex items-center gap-1.5 py-2.5 px-5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button disabled={saving} onClick={saveDecision}
                className={`flex items-center gap-2 py-2.5 px-5 text-xs font-bold text-white rounded-xl disabled:opacity-50 ${decision === "accepted" ? "bg-emerald-600 hover:bg-emerald-500" : decision === "declined" ? "bg-red-700 hover:bg-red-600" : "bg-amber-600 hover:bg-amber-500"}`}>
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {decision === "accepted" ? "Accept & Record" : decision === "declined" ? "Record Declination" : "Request More Info"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Case Row Card ─────────────────────────────────────────────────────────────

function CaseRow({
  lead, submission, review, issues, onOpenReview, isNew,
}: {
  lead: Lead;
  submission: Submission | null;
  review: IntakeReview | null;
  issues: IntakeIssue[];
  onOpenReview: () => void;
  isNew: boolean;
}) {
  const elig = submission ? analyzeEligibility(submission) : null;
  const cfg = STAGE_CFG[lead.status] ?? STAGE_CFG.new;
  const hasPrefPay = elig?.prefPayFlagged;
  const hasUrgentAlerts = elig?.recommendation.urgency === "urgent";
  const hasErrors = issues.some(i => i.severity === "error");
  const pendingReview = lead.status === "sent_for_attorney_review";
  const isDecided = Boolean(review?.decided_at);

  return (
    <div className={`group relative flex items-start gap-3 px-4 py-3.5 rounded-2xl border transition-all hover:bg-white/[0.02] ${pendingReview && !isDecided ? "bg-amber-500/5 border-amber-500/25" : "bg-[#0d1221] border-slate-800/60"} ${isNew ? "ring-1 ring-amber-400/40 animate-pulse" : ""}`}>

      {/* Avatar */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${cfg.bg} border ${cfg.border}`}>
        <span className={cfg.text}>{lead.full_name.charAt(0)}</span>
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="text-sm font-bold text-white">{lead.full_name}</p>
          {lead.state && <span className="text-[9px] font-semibold text-slate-500">{lead.state}</span>}
          {lead.chapter_interest && (
            <span className="text-[9px] font-bold text-slate-400 bg-slate-800 rounded-full px-1.5 py-0.5">Ch.{lead.chapter_interest}</span>
          )}
          {isNew && (
            <span className="text-[9px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 rounded-full px-1.5 py-0.5 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> NEW
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status badge */}
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            {cfg.short}
          </span>

          {/* Eligibility badges */}
          {elig && (
            <>
              <EligBadge result={elig.result} chapter={7} />
              <EligBadge result={null} chapter={13} />
              {hasUrgentAlerts && (
                <span className="flex items-center gap-1 text-[9px] font-bold text-red-300 bg-red-500/10 border border-red-500/20 rounded-full px-1.5 py-0.5">
                  <AlertTriangle className="w-2.5 h-2.5" /> Urgent
                </span>
              )}
            </>
          )}
          {!elig && lead.income_estimate && (
            <span className="text-[9px] text-slate-600">Est. income: {fmt(lead.income_estimate)}/mo</span>
          )}

          {/* Flags */}
          {hasPrefPay && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-red-300 bg-red-500/10 border border-red-500/20 rounded-full px-1.5 py-0.5">
              <AlertTriangle className="w-2.5 h-2.5" /> Pref Pay
            </span>
          )}
          {hasErrors && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-red-300 bg-red-500/10 border border-red-500/20 rounded-full px-1.5 py-0.5">
              <Flag className="w-2.5 h-2.5" /> {issues.filter(i=>i.severity==="error").length} Error{issues.filter(i=>i.severity==="error").length>1?"s":""}
            </span>
          )}

          {/* Debt / income */}
          {elig && (
            <span className="text-[9px] text-slate-600">{fmt(elig.totalDebt)} debt · {fmt(elig.cmi)}/mo</span>
          )}

          <span className="text-[9px] text-slate-700 ml-auto">{timeAgo(lead.updated_at ?? lead.created_at)}</span>
        </div>

        {/* Decision recorded */}
        {isDecided && review && (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${review.decision === "accepted" ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" : review.decision === "declined" ? "text-red-400 bg-red-500/10 border border-red-500/20" : "text-amber-400 bg-amber-500/10 border border-amber-500/20"}`}>
              {review.decision === "accepted" ? `Accepted · ${review.case_type?.replace(/_/g," ") ?? ""} · ${fmt(review.total_fee)}` : review.decision === "declined" ? "Declined" : "More Info Needed"}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        <button
          onClick={onOpenReview}
          className={`flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 transition-colors ${
            pendingReview && !isDecided
              ? "bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/20"
              : "bg-slate-700/60 hover:bg-slate-700 text-slate-300"
          }`}
        >
          {pendingReview && !isDecided ? (
            <><Scale className="w-3 h-3" /> Review</>
          ) : (
            <><Eye className="w-3 h-3" /> {isDecided ? "View" : "Open"}</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Pipeline Column ──────────────────────────────────────────────────────────

function PipelineCol({ stage, count }: { stage: string; count: number }) {
  const cfg = STAGE_CFG[stage] ?? STAGE_CFG.new;
  return (
    <div className="flex-shrink-0 text-center min-w-[90px]">
      <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${cfg.dot}`} />
      <p className="text-[9px] font-bold text-slate-400">{cfg.short}</p>
      <p className={`text-lg font-black ${cfg.text}`}>{count}</p>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AttorneyIntakeDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [submissionMap, setSubmissionMap] = useState<Record<string, Submission>>({});
  const [reviewMap, setReviewMap] = useState<Record<string, IntakeReview>>({});
  const [issueMap, setIssueMap] = useState<Record<string, IntakeIssue[]>>({});
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [newLeadIds, setNewLeadIds] = useState<Set<string>>(new Set());
  const [openReviewLead, setOpenReviewLead] = useState<Lead | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showDecided, setShowDecided] = useState(true);
  const prevLeadIds = useRef<Set<string>>(new Set());
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const [rawLeads, rawSubs, rawReviews, rawIssues] = await Promise.all([
      sbGet<Lead>("intake_leads?order=updated_at.desc&limit=300"),
      sbGet<Submission>("intake_submissions?select=id,lead_id,filing_type,first_name,last_name,state,marital_status,num_dependents,income_sources_json,debtor_gross_monthly,exp_rent_mortgage,exp_utilities,exp_food,exp_transportation,exp_healthcare,exp_insurance,exp_childcare,exp_other,credit_card_debt,medical_debt,secured_debt,student_loan_debt,tax_debt,personal_loan_debt,other_unsecured,has_preferential_payments,preferential_payments_json,vehicles_json,has_prior_bk,prior_bankruptcies_json,recent_luxury,luxury_details,bank_balance,retirement_balance,real_properties_json,has_transfers,transfers_json,garnishment,exemption_state,submitted_at&order=submitted_at.desc&limit=300"),
      sbGet<IntakeReview>("attorney_intake_reviews?order=created_at.desc&limit=300"),
      sbGet<IntakeIssue>("attorney_intake_issues?order=sort_order.asc&limit=1000"),
    ]);

    // Detect new leads since last load
    const freshIds = new Set(rawLeads.filter(l => l.status === "sent_for_attorney_review").map(l => l.id));
    const brandNew = new Set([...freshIds].filter(id => !prevLeadIds.current.has(id)));
    if (brandNew.size > 0) setNewLeadIds(brandNew);
    prevLeadIds.current = freshIds;

    // Build maps
    const sMap: Record<string, Submission> = {};
    for (const s of rawSubs) {
      if (s.lead_id) sMap[s.lead_id] = s;
      sMap[s.id] = s;
    }

    const rMap: Record<string, IntakeReview> = {};
    for (const r of rawReviews) {
      if (r.lead_id) rMap[r.lead_id] = r;
    }

    const iMap: Record<string, IntakeIssue[]> = {};
    for (const issue of rawIssues) {
      const rev = rawReviews.find(r => r.id === issue.review_id);
      if (rev?.lead_id) {
        if (!iMap[rev.lead_id]) iMap[rev.lead_id] = [];
        iMap[rev.lead_id].push(issue);
      }
    }

    setLeads(rawLeads);
    setSubmissionMap(sMap);
    setReviewMap(rMap);
    setIssueMap(iMap);
    setLoading(false);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh every 30 seconds
    refreshTimer.current = setInterval(load, 30_000);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [load]);

  // Clear "new" pulse after 8s
  useEffect(() => {
    if (newLeadIds.size > 0) {
      const t = setTimeout(() => setNewLeadIds(new Set()), 8000);
      return () => clearTimeout(t);
    }
  }, [newLeadIds]);

  // Filtered + sorted leads
  const filteredLeads = leads.filter(l => {
    if (!showDecided && reviewMap[l.id]?.decided_at) return false;
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.full_name.toLowerCase().includes(q) && !l.email?.toLowerCase().includes(q) && !l.state?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Priority-sort: pending review first, then by updated_at
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    const pa = STAGE_CFG[a.status]?.priority ?? 99;
    const pb = STAGE_CFG[b.status]?.priority ?? 99;
    if (pa !== pb) return pa - pb;
    return new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime();
  });

  // Counts for pipeline bar
  const stageCounts: Record<string, number> = {};
  for (const l of leads) stageCounts[l.status] = (stageCounts[l.status] ?? 0) + 1;

  const pendingCount = leads.filter(l => l.status === "sent_for_attorney_review" && !reviewMap[l.id]?.decided_at).length;
  const completedToday = leads.filter(l => {
    const d = reviewMap[l.id]?.decided_at;
    if (!d) return false;
    return new Date(d).toDateString() === new Date().toDateString();
  }).length;

  const openReviewSubmission = openReviewLead ? (submissionMap[openReviewLead.id] ?? submissionMap[openReviewLead.submission_id ?? ""] ?? null) : null;
  const openReviewReview = openReviewLead ? (reviewMap[openReviewLead.id] ?? null) : null;
  const openReviewIssues = openReviewLead ? (issueMap[openReviewLead.id] ?? []) : [];

  return (
    <div className="min-h-screen bg-[#050a14] text-white">

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 bg-[#050a14]/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Scale className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Attorney Intake Review</p>
              <p className="text-[10px] text-slate-500">Live pipeline · refreshes every 30s</p>
            </div>
          </div>

          {/* Pending badge */}
          {pendingCount > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 rounded-xl px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-bold text-amber-300">{pendingCount} Awaiting Review</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-slate-600 hidden sm:block">
              Updated {timeAgo(lastRefresh.toISOString())}
            </span>
            <button onClick={load} disabled={loading}
              className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Pending Review", val: pendingCount, icon: <Clock className="w-4 h-4 text-amber-400" />, bg: "bg-amber-500/8 border-amber-500/20", val_color: "text-amber-300" },
            { label: "Total Active", val: leads.filter(l => !["declined","no_case","retained"].includes(l.status)).length, icon: <Activity className="w-4 h-4 text-sky-400" />, bg: "bg-sky-500/8 border-sky-500/20", val_color: "text-sky-300" },
            { label: "Reviewed Today", val: completedToday, icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, bg: "bg-emerald-500/8 border-emerald-500/20", val_color: "text-emerald-300" },
            { label: "Total Cases", val: leads.length, icon: <BarChart2 className="w-4 h-4 text-slate-400" />, bg: "bg-slate-700/20 border-slate-700/40", val_color: "text-slate-300" },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <div className="flex items-center gap-2 mb-2">{s.icon}<p className="text-xs text-slate-500">{s.label}</p></div>
              <p className={`text-2xl font-black ${s.val_color}`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* ── Pipeline bar ── */}
        <div className="bg-[#0d1221] border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRight className="w-4 h-4 text-slate-500" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Intake Pipeline</p>
          </div>
          <div className="flex items-center gap-4 overflow-x-auto pb-1">
            {["sent_for_attorney_review","attorney_accepted","fee_quoted","retained","intake_complete","consultation_complete","consultation_scheduled","contacted","new","declined"].map(stage => (
              stageCounts[stage] ? <PipelineCol key={stage} stage={stage} count={stageCounts[stage]} /> : null
            ))}
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, state…"
              className="w-full bg-[#0d1221] border border-slate-800 text-white text-sm rounded-xl pl-9 pr-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-[#0d1221] border border-slate-800 text-white text-sm rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:border-amber-500/50 appearance-none">
              <option value="all">All Stages</option>
              <option value="sent_for_attorney_review">Pending Review</option>
              <option value="attorney_accepted">Attorney Accepted</option>
              <option value="fee_quoted">Fee Quoted</option>
              <option value="retained">Retained</option>
              <option value="intake_complete">Intake Complete</option>
              <option value="consultation_complete">Consult Complete</option>
              <option value="consultation_scheduled">Consult Scheduled</option>
              <option value="contacted">Contacted</option>
              <option value="new">New Lead</option>
              <option value="declined">Declined</option>
            </select>
          </div>
          <button onClick={() => setShowDecided(s => !s)}
            className={`flex items-center gap-1.5 text-xs font-semibold rounded-xl px-3 py-2.5 border transition-colors ${showDecided ? "bg-slate-700/40 border-slate-600/40 text-slate-300" : "bg-slate-800/40 border-slate-700/40 text-slate-500"}`}>
            <Eye className="w-3.5 h-3.5" /> {showDecided ? "Hide Decided" : "Show Decided"}
          </button>
        </div>

        {/* ── Cases list ── */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-800/30 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : sortedLeads.length === 0 ? (
          <div className="bg-[#0d1221] border border-slate-800 rounded-2xl text-center py-16">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No cases match your filters</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Section: Needs immediate review */}
            {sortedLeads.some(l => l.status === "sent_for_attorney_review" && !reviewMap[l.id]?.decided_at) && (
              <div className="mb-1">
                <div className="flex items-center gap-2 px-1 mb-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">Awaiting Your Review</p>
                </div>
                {sortedLeads
                  .filter(l => l.status === "sent_for_attorney_review" && !reviewMap[l.id]?.decided_at)
                  .map(lead => (
                    <div key={lead.id} className="mb-2">
                      <CaseRow
                        lead={lead}
                        submission={submissionMap[lead.id] ?? submissionMap[lead.submission_id ?? ""] ?? null}
                        review={reviewMap[lead.id] ?? null}
                        issues={issueMap[lead.id] ?? []}
                        onOpenReview={() => setOpenReviewLead(lead)}
                        isNew={newLeadIds.has(lead.id)}
                      />
                    </div>
                  ))}
                <div className="border-b border-slate-800/60 my-3" />
              </div>
            )}

            {/* All other cases */}
            {sortedLeads
              .filter(l => !(l.status === "sent_for_attorney_review" && !reviewMap[l.id]?.decided_at))
              .map(lead => (
                <CaseRow
                  key={lead.id}
                  lead={lead}
                  submission={submissionMap[lead.id] ?? submissionMap[lead.submission_id ?? ""] ?? null}
                  review={reviewMap[lead.id] ?? null}
                  issues={issueMap[lead.id] ?? []}
                  onOpenReview={() => setOpenReviewLead(lead)}
                  isNew={newLeadIds.has(lead.id)}
                />
              ))}
          </div>
        )}
      </div>

      {/* ── Review modal ── */}
      {openReviewLead && (
        <ReviewModal
          lead={openReviewLead}
          submission={openReviewSubmission}
          review={openReviewReview}
          issues={openReviewIssues}
          onClose={() => setOpenReviewLead(null)}
          onSaved={(updatedReview) => {
            setReviewMap(m => ({ ...m, [openReviewLead.id]: updatedReview }));
            setOpenReviewLead(null);
            load();
          }}
        />
      )}
    </div>
  );
}
