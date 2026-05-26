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
  recent_luxury: boolean | null;
  luxury_details: string | null;
  bank_balance: number | null;
  retirement_balance: number | null;
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

// ─── State Median Income Data ─────────────────────────────────────────────────

const STATE_MEDIAN: Record<string, Record<number, number>> = {
  CO: { 1: 59412, 2: 79300, 3: 87216, 4: 93864, 5: 101580, 6: 109296 },
  TX: { 1: 51000, 2: 68000, 3: 76000, 4: 86000, 5: 93000, 6: 100000 },
  AZ: { 1: 50000, 2: 66000, 3: 74000, 4: 83000, 5: 90000, 6: 97000 },
  WA: { 1: 60000, 2: 80000, 3: 89000, 4: 99000, 5: 107000, 6: 115000 },
  IL: { 1: 53000, 2: 72000, 3: 81000, 4: 91000, 5: 99000, 6: 107000 },
  // Fallback for unlisted states
  DEFAULT: { 1: 52000, 2: 70000, 3: 79000, 4: 88000, 5: 96000, 6: 104000 },
};

function getMedian(state: string | null, houseSize: number): number {
  const tbl = STATE_MEDIAN[state ?? "DEFAULT"] ?? STATE_MEDIAN.DEFAULT;
  return (tbl[Math.min(houseSize, 6)] ?? tbl[6]) / 12; // monthly
}

function computeCMI(sub: Submission): number {
  const sources = sub.income_sources_json ?? [];
  let monthly = 0;
  for (const s of sources) {
    const gp = Number(s.grossPerPeriod ?? 0);
    switch (s.payFrequency) {
      case "weekly":       monthly += gp * 4.333; break;
      case "bi-weekly":    monthly += gp * 2.167; break;
      case "semi-monthly": monthly += gp * 2;     break;
      case "monthly":      monthly += gp;         break;
      case "annual":       monthly += gp / 12;    break;
      default:             monthly += gp;
    }
  }
  if (monthly === 0) monthly = Number(sub.debtor_gross_monthly ?? 0);
  return Math.round(monthly * 100) / 100;
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
  cmi: number;
  houseSize: number;
  medianMonthly: number;
  medianAnnual: number;
  aboveMedian: boolean;
  expenses: number;
  disposable: number;
  result: "pass" | "borderline" | "fail";
  ch7: boolean;
  ch13: boolean;
  totalDebt: number;
  prefPayFlagged: boolean;
  insiderTotal: number;
  nonExemptEquity: number;
  hasVehicleIssue: boolean;
};

function analyzeEligibility(sub: Submission): EligibilityResult {
  const cmi = computeCMI(sub);
  const houseSize = computeHouseSize(sub);
  const medianMonthly = getMedian(sub.state, houseSize);
  const medianAnnual = medianMonthly * 12;
  const aboveMedian = cmi > medianMonthly;
  const expenses = computeExpenses(sub);
  const disposable = cmi - expenses;
  const result: "pass" | "borderline" | "fail" =
    !aboveMedian ? "pass" : disposable > 214 ? "fail" : "borderline";

  const prefPays = sub.preferential_payments_json ?? [];
  const insiderTotal = prefPays
    .filter(p => /aunt|uncle|parent|sibling|relative|friend|insider/i.test(p.relationship))
    .reduce((s, p) => s + Number(p.amount), 0);
  const prefPayFlagged = Boolean(sub.has_preferential_payments) && prefPays.length > 0;

  const vehicles = sub.vehicles_json ?? [];
  const CO_VEH_EX = 7500; // simplified; use state-specific in production
  const nonExemptEquity = vehicles.reduce((s, v) => {
    const eq = Number(v.value ?? 0) - Number(v.loanBalance ?? 0);
    return s + Math.max(0, eq - CO_VEH_EX);
  }, 0);

  return {
    cmi, houseSize, medianMonthly, medianAnnual, aboveMedian, expenses, disposable,
    result, ch7: result !== "fail", ch13: true,
    totalDebt: computeTotalDebt(sub),
    prefPayFlagged, insiderTotal,
    nonExemptEquity, hasVehicleIssue: nonExemptEquity > 0,
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
      <button disabled={false} onClick={() => onAck(issue.id, init.trim())}
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
    // if (!review || !newTitle.trim()) return;
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
                  { label: "Current Monthly Income", val: fmt(elig.cmi), sub: "CMI · Form 122A-1" },
                  { label: `${lead.state ?? "CO"} Median (${elig.houseSize}-person)`, val: fmt(elig.medianMonthly)+"/mo", sub: fmt(elig.medianAnnual)+"/yr" },
                  { label: "Monthly Expenses", val: fmt(elig.expenses), sub: "Reported" },
                  { label: "Disposable Income", val: fmt(elig.disposable), sub: "After expenses", warn: elig.disposable > 214 },
                ].map(s => (
                  <div key={s.label} className="bg-slate-800/40 rounded-xl p-3 text-center">
                    <p className="text-[9px] text-slate-500 leading-tight mb-1">{s.label}</p>
                    <p className={`text-sm font-bold ${"warn" in s && s.warn ? "text-red-400" : "text-white"}`}>{s.val}</p>
                    <p className="text-[9px] text-slate-600 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Ch.7 card */}
              <div className={`rounded-2xl border p-4 ${elig.ch7 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/25"}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${elig.ch7 ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
                    {elig.ch7 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${elig.ch7 ? "text-emerald-300" : "text-red-300"}`}>
                      Chapter 7 — {elig.ch7 ? "Likely Eligible" : "Likely Ineligible"}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {elig.result === "pass" ? "Below state median — means test satisfied"
                       : elig.result === "borderline" ? "Borderline — detailed expense analysis required"
                       : "Above median; disposable income exceeds §707(b) threshold"}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${elig.result === "pass" ? "bg-emerald-500/15 text-emerald-400" : elig.result === "borderline" ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>
                    {elig.result.toUpperCase()}
                  </span>
                </div>
                {/* Income bar */}
                <div>
                  <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                    <span>CMI: {fmt(elig.cmi)}/mo</span>
                    <span>Median: {fmt(elig.medianMonthly)}/mo</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${elig.aboveMedian ? "bg-red-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(100, (elig.cmi / (elig.medianMonthly * 1.4)) * 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] mt-1">
                    <span className="text-slate-600">$0</span>
                    <span className="text-amber-400/80 font-semibold">↑ Median {fmt(elig.medianMonthly)}</span>
                    <span className="text-slate-600">{fmt(elig.medianMonthly * 1.4)}</span>
                  </div>
                </div>
              </div>

              {/* Ch.13 card */}
              <div className="rounded-2xl border p-4 bg-sky-500/5 border-sky-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-xl bg-sky-500/15 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-sky-300">Chapter 13 — Eligible</p>
                    <p className="text-[10px] text-slate-500">Reorganization; 3–5 yr plan; protects assets; no income ceiling</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400">ELIGIBLE</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Total Debt", val: fmt(elig.totalDebt) },
                    { label: "Monthly Disposable", val: fmt(elig.disposable) },
                    { label: "Est. Plan/mo", val: fmt(Math.max(0, elig.disposable)) },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-800/40 rounded-xl p-2 text-center">
                      <p className="text-[9px] text-slate-500">{s.label}</p>
                      <p className="text-xs font-bold text-white mt-0.5">{s.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Income-to-qualify projection */}
              {(elig.result === "fail" || elig.result === "borderline") && (
                <div className="rounded-2xl border p-4 bg-amber-500/5 border-amber-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <p className="text-sm font-bold text-amber-300">Income-to-Qualify Projection</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    To qualify for Chapter 7, this client's 6-month average CMI must fall below the {lead.state ?? "CO"} {elig.houseSize}-person median of <span className="text-white font-semibold">{fmt(elig.medianMonthly)}/mo</span>.
                    Current CMI is <span className="text-amber-300 font-semibold">{fmt(elig.cmi)}/mo</span>
                    {elig.aboveMedian ? <span className="text-red-400"> — {fmt(elig.cmi - elig.medianMonthly)} above median</span> : null}.
                  </p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: "Target Income", val: fmt(elig.medianMonthly * 0.98), sub: "Stay below this" },
                      { label: "Avg Needed (3-mo)", val: fmt(elig.medianMonthly * 0.98), sub: "Filing in 3 months" },
                      { label: "Avg Needed (6-mo)", val: fmt(elig.medianMonthly * 0.98), sub: "Filing in 6 months" },
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
                    <span className="ml-auto text-[10px] font-bold text-red-300 bg-red-500/15 border border-red-500/25 rounded-full px-1.5 py-0.5">
                      {fmt(elig.insiderTotal)} insider
                    </span>
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
                  <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
                    11 U.S.C. § 547: Trustee may avoid and recover insider payments within 12 months. Recipient may be required to return funds to estate.
                  </p>
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
                    <button onClick={addIssue} disabled={addingIssue}
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
                  { label: "Ch.7 Eligible", val: elig ? (elig.result === "pass" ? "Yes" : elig.result === "borderline" ? "Borderline" : "No") : "—", color: elig?.result === "pass" ? "text-emerald-400" : elig?.result === "borderline" ? "text-amber-400" : "text-red-400" },
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
      sbGet<Submission>("intake_submissions?select=id,lead_id,filing_type,first_name,last_name,state,marital_status,num_dependents,income_sources_json,debtor_gross_monthly,exp_rent_mortgage,exp_utilities,exp_food,exp_transportation,exp_healthcare,exp_insurance,exp_childcare,exp_other,credit_card_debt,medical_debt,secured_debt,student_loan_debt,tax_debt,personal_loan_debt,other_unsecured,has_preferential_payments,preferential_payments_json,vehicles_json,has_prior_bk,recent_luxury,luxury_details,bank_balance,retirement_balance,submitted_at&order=submitted_at.desc&limit=300"),
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
