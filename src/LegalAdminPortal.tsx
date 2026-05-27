import { useState, useEffect, useCallback } from "react";
import { Users, Phone, Mail, MessageSquare, Calendar, Clock, CheckCircle2, Circle, AlertTriangle, ChevronRight, RefreshCw, Plus, X, Send, Search, Filter, ChevronDown, Bot, UserCheck, FileText, DollarSign, Scale, MapPin, ArrowRight, Flag, Zap, Info, CreditCard as Edit3, Save, Eye, Briefcase, Hash, CheckCheck, PenLine, Star, TrendingUp, BarChart2, ArrowLeft, Shield, Mic, ChevronLeft, Building, Car, PiggyBank, CreditCard, Home, User, Trash2, Play, PhoneCall, PhoneMissed, PhoneOutgoing, MailCheck, MessageCircle, ListChecks, Import as SortAsc, BellRing, BellOff, Inbox } from "lucide-react";
import { getApplicableExemptions, getWaHomesteadEligibility, getCaHomesteadByCounty, FEDERAL_EXEMPTIONS } from "./components/admin/exemptions";
import CaseAcceptanceFlow, { AcceptanceData as CaseAcceptanceData } from "./components/CaseAcceptanceFlow";
import { CASE_TYPES, CHAPTER_FILING_FEES, ATTORNEY_FEES, CREDIT_COUNSELING_FEE } from "./lib/feeSchedule";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY    = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  chapter_interest: number | null;
  status: string;
  assigned_name: string | null;
  first_contact_at: string;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  consultation_date: string | null;
  retained_at: string | null;
  notes: string | null;
  urgency: string | null;
  preferred_contact: string | null;
  pre_screen_notes: string | null;
  ai_scheduled: boolean | null;
  intake_completed: boolean | null;
  sent_for_review: boolean | null;
  sent_for_review_at: string | null;
  client_prefilled: boolean | null;
  debt_estimate: number | null;
  income_estimate: number | null;
  state: string | null;
  submission_id: string | null;
  follow_up_queue: "priority" | "normal" | "none" | null;
  bot_followup_enabled: boolean | null;
  bot_followup_count: number | null;
  last_bot_followup_at: string | null;
  created_at: string;
}

interface ContactLogEntry {
  id: string;
  lead_id: string;
  channel: "sms" | "email" | "phone" | "in_person" | "bot_sms" | "bot_email";
  direction: "outbound" | "inbound";
  outcome: "no_answer" | "left_voicemail" | "reached" | "replied" | "bounced" | "scheduled" | "not_interested" | "other";
  notes: string | null;
  contacted_by: string;
  is_bot: boolean;
  follow_up_queue: "priority" | "normal" | null;
  contacted_at: string;
  created_at: string;
}

interface Acceptance {
  id: string;
  lead_id: string | null;
  attorney_name: string;
  decision: string;
  case_type: string | null;
  chapter: number | null;
  attorney_fee: number | null;
  court_filing_fee: number | null;
  total_fee: number | null;
  down_payment: number | null;
  plan_months: number | null;
  filing_fee_handling: string | null;
  limited_scope_desc: string | null;
  ch13_upfront_amount: number | null;
  ch13_plan_portion: number | null;
  decision_notes: string | null;
  decided_at: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sbGet<T>(path: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  return r.ok ? r.json() : [];
}

async function sbPost(table: string, body: object) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  return r.ok ? r.json() : null;
}

async function sbPatch(table: string, id: string, body: object) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function timeAgo(s: string) {
  const diff = Date.now() - new Date(s).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  new:                       { label: "New — Needs Contact",          color: "text-red-400",     bg: "bg-red-500/10",      border: "border-red-500/20" },
  contacted:                 { label: "Contacted — Schedule Now",     color: "text-sky-400",     bg: "bg-sky-500/10",      border: "border-sky-500/20" },
  consultation_scheduled:    { label: "Consult Scheduled",            color: "text-teal-400",    bg: "bg-teal-500/10",     border: "border-teal-500/20" },
  consultation_complete:     { label: "Intake Complete",              color: "text-amber-400",   bg: "bg-amber-500/10",    border: "border-amber-500/20" },
  intake_in_progress:        { label: "Intake Complete",              color: "text-amber-400",   bg: "bg-amber-500/10",    border: "border-amber-500/20" },
  intake_complete:           { label: "Intake Complete",              color: "text-amber-400",   bg: "bg-amber-500/10",    border: "border-amber-500/20" },
  sent_for_attorney_review:  { label: "Pending Attorney Review",      color: "text-amber-300",   bg: "bg-amber-500/15",    border: "border-amber-500/30" },
  attorney_accepted:         { label: "Attorney Accepted — Present",  color: "text-emerald-400", bg: "bg-emerald-500/10",  border: "border-emerald-500/20" },
  fee_quoted:                { label: "Fee Quoted — Follow Up",       color: "text-orange-400",  bg: "bg-orange-500/10",   border: "border-orange-500/25" },
  retained:                  { label: "Retained",                     color: "text-green-400",   bg: "bg-green-500/10",    border: "border-green-500/20" },
  declined:                  { label: "Declined",                     color: "text-red-400",     bg: "bg-red-500/10",      border: "border-red-500/20" },
  no_case:                   { label: "No Case",                      color: "text-slate-500",   bg: "bg-slate-700/30",    border: "border-slate-700/40" },
  no_show:                   { label: "No Show — Re-schedule",        color: "text-slate-500",   bg: "bg-slate-700/30",    border: "border-slate-700/40" },
};

const URGENCY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  normal:    { label: "Normal",    color: "text-slate-400", bg: "bg-slate-700/30" },
  urgent:    { label: "Urgent",    color: "text-amber-400", bg: "bg-amber-500/15" },
  emergency: { label: "Emergency", color: "text-red-400",   bg: "bg-red-500/15" },
};

// ─── Colorado Means Test Data ─────────────────────────────────────────────────
// Annual median income by state + household size (2024 Census data for Form 122A-1)
// CO figures used here; extend as needed for other states
// Full 50-state + DC median income table — November 1, 2025 (DOJ Form 122A-1 data)
// Structure: { 1–4: annual for household size 1–4, extra: per additional person above 4 }
const MEDIAN_INCOME: Record<string, { 1: number; 2: number; 3: number; 4: number; extra: number }> = {
  "Alabama":        { 1:62672,  2:75465,  3:90321,  4:104003, extra:11100 },
  "Alaska":         { 1:83617,  2:109882, 3:109882, 4:138492, extra:11100 },
  "Arizona":        { 1:72039,  2:86745,  3:102274, 4:118067, extra:11100 },
  "Arkansas":       { 1:56923,  2:71742,  3:80218,  4:94586,  extra:11100 },
  "California":     { 1:77221,  2:100161, 3:113553, 4:135505, extra:11100 },
  "Colorado":       { 1:85685,  2:106890, 3:127495, 4:149566, extra:11100 },
  "Connecticut":    { 1:82141,  2:103501, 3:131022, 4:155834, extra:11100 },
  "Delaware":       { 1:67733,  2:92445,  3:108420, 4:128854, extra:11100 },
  "District of Columbia": { 1:93588, 2:120000, 3:140000, 4:165000, extra:11100 },
  "Florida":        { 1:68085,  2:84385,  3:95039,  4:111819, extra:11100 },
  "Georgia":        { 1:66722,  2:82787,  3:98877,  4:120315, extra:11100 },
  "Hawaii":         { 1:83068,  2:103479, 3:120289, 4:138536, extra:11100 },
  "Idaho":          { 1:71531,  2:83951,  3:95859,  4:116594, extra:11100 },
  "Illinois":       { 1:71304,  2:91526,  3:110712, 4:134366, extra:11100 },
  "Indiana":        { 1:62808,  2:79884,  3:93175,  4:112691, extra:11100 },
  "Iowa":           { 1:65883,  2:86523,  3:101463, 4:122826, extra:11100 },
  "Kansas":         { 1:67423,  2:85199,  3:101189, 4:122741, extra:11100 },
  "Kentucky":       { 1:60071,  2:71998,  3:83027,  4:108637, extra:11100 },
  "Louisiana":      { 1:57923,  2:70493,  3:82433,  4:100971, extra:11100 },
  "Maine":          { 1:73946,  2:88126,  3:104083, 4:128204, extra:11100 },
  "Maryland":       { 1:84699,  2:111673, 3:132464, 4:161913, extra:11100 },
  "Massachusetts":  { 1:85941,  2:109818, 3:135837, 4:173947, extra:11100 },
  "Michigan":       { 1:65625,  2:81293,  3:100797, 4:134254, extra:11100 },
  "Minnesota":      { 1:75704,  2:95807,  3:123244, 4:146039, extra:11100 },
  "Mississippi":    { 1:52594,  2:68525,  3:80722,  4:94965,  extra:11100 },
  "Missouri":       { 1:63306,  2:79971,  3:97658,  4:115491, extra:11100 },
  "Montana":        { 1:69482,  2:88107,  3:100637, 4:118578, extra:11100 },
  "Nebraska":       { 1:65206,  2:88402,  3:100754, 4:121867, extra:11100 },
  "Nevada":         { 1:65868,  2:85860,  3:99032,  4:111184, extra:11100 },
  "New Hampshire":  { 1:85049,  2:106521, 3:137902, 4:151224, extra:11100 },
  "New Jersey":     { 1:84938,  2:104138, 3:133620, 4:163817, extra:11100 },
  "New Mexico":     { 1:64537,  2:77534,  3:85784,  4:96074,  extra:11100 },
  "New York":       { 1:71393,  2:90520,  3:112616, 4:135475, extra:11100 },
  "North Carolina": { 1:65396,  2:82221,  3:98932,  4:113744, extra:11100 },
  "North Dakota":   { 1:71683,  2:93882,  3:103951, 4:134254, extra:11100 },
  "Ohio":           { 1:64541,  2:81578,  3:99876,  4:120531, extra:11100 },
  "Oklahoma":       { 1:59611,  2:75229,  3:84618,  4:99188,  extra:11100 },
  "Oregon":         { 1:77061,  2:91268,  3:113736, 4:136434, extra:11100 },
  "Pennsylvania":   { 1:70378,  2:85290,  3:107327, 4:132379, extra:11100 },
  "Rhode Island":   { 1:75662,  2:96205,  3:116357, 4:133954, extra:11100 },
  "South Carolina": { 1:63140,  2:81614,  3:93219,  4:113332, extra:11100 },
  "South Dakota":   { 1:67415,  2:87598,  3:88297,  4:127386, extra:11100 },
  "Tennessee":      { 1:62339,  2:80722,  3:95011,  4:106775, extra:11100 },
  "Texas":          { 1:65123,  2:84491,  3:96728,  4:114938, extra:11100 },
  "Utah":           { 1:85644,  2:93302,  3:109860, 4:128363, extra:11100 },
  "Vermont":        { 1:70603,  2:94477,  3:111150, 4:134056, extra:11100 },
  "Virginia":       { 1:76479,  2:98577,  3:120001, 4:141113, extra:11100 },
  "Washington":     { 1:86314,  2:104354, 3:128369, 4:152553, extra:11100 },
  "West Virginia":  { 1:62270,  2:66833,  3:89690,  4:91270,  extra:11100 },
  "Wisconsin":      { 1:69343,  2:87938,  3:105734, 4:129964, extra:11100 },
  "Wyoming":        { 1:69906,  2:88156,  3:95951,  4:107469, extra:11100 },
};

function stateMedian(state: string, houseSize: number): number {
  const t = MEDIAN_INCOME[state];
  if (!t) {
    // Unknown state — use national approximation as fallback
    const fallback: Record<number, number> = { 1:66000, 2:84000, 3:99000, 4:118000 };
    const size = Math.min(houseSize, 4);
    const base = fallback[size] ?? fallback[4];
    return base + (houseSize > 4 ? (houseSize - 4) * 11100 : 0);
  }
  return houseSize <= 4
    ? (t[houseSize as 1|2|3|4] || t[4])
    : t[4] + (houseSize - 4) * t.extra;
}

// Income source types excluded from CMI per 11 U.S.C. § 101(10A) and Form 122A-1.
// Social Security (all types) and VA benefits are not "current monthly income."
const CMI_EXCLUDED_SOURCE_TYPES = new Set([
  // ClientIntakeForm.tsx full-string labels
  "Social Security – Retirement",
  "Social Security – Disability (SSDI)",
  "Supplemental Security Income (SSI)",
  "VA Benefits",
  // Dependent income short codes (ClientIntakeForm.tsx)
  "social_security",
  "ssdi",
  "ssi",
  "va_benefits",
]);

// Compute current monthly income per Form 122A-1 (6-month lookback ÷ 6).
// Excludes SS and VA benefits as required by statute.
// For individual filers with a non-filing spouse (filing_type = "individual-nonfiling-spouse"),
// NFS income (owner: "nfs") is INCLUDED per 11 U.S.C. § 101(10A). A marital adjustment
// deduction for NFS expenses not benefiting the household is applied separately by the attorney
// on Form 122A-1 Part 2 — that adjustment is NOT reflected in this CMI figure.
function computeCMI(sub: Record<string, unknown>): number {
  const sources = (sub.income_sources_json as {
    grossPerPeriod?: number | string;
    payFrequency?: string;
    sourceType?: string;
    owner?: string;  // "debtor" | "spouse" | "nfs" | "household" — set by ClientIntakeForm.tsx
  }[] | null) ?? [];
  let monthly = 0;
  for (const s of sources) {
    // Skip SS / VA — excluded from CMI per Form 122A-1
    if (s.sourceType && CMI_EXCLUDED_SOURCE_TYPES.has(s.sourceType)) continue;
    // NFS income (owner: "nfs") is included per § 101(10A) for married individual filers.
    // Debtor (owner: "debtor") and joint co-debtor (owner: "spouse") income are always included.
    // Records without owner field (older submissions, BankruptcyIntake.jsx) are included by default.
    const gp = Number(s.grossPerPeriod ?? 0);
    // Normalize frequency to lowercase-hyphenated for consistent matching
    const freq = (s.payFrequency ?? "").toLowerCase().replace(/[\s/]+/g, "-");
    switch (freq) {
      case "weekly":        monthly += gp * 4.333; break;
      case "bi-weekly":     monthly += gp * 2.167; break;
      case "semi-monthly":  monthly += gp * 2;     break;
      case "monthly":       monthly += gp;         break;
      case "quarterly":     monthly += gp / 3;     break;
      case "annual":        monthly += gp / 12;    break;
      default:              monthly += gp;          // Variable / unknown → treat as monthly
    }
  }
  // Fallback to legacy debtor_gross_monthly if no income_sources_json stored
  if (monthly === 0) monthly = Number(sub.debtor_gross_monthly ?? 0);
  return Math.round(monthly * 100) / 100;
}

function computeHouseholdSize(sub: Record<string, unknown>): number {
  const deps = Number(sub.num_dependents ?? 0);
  const isJoint = sub.filing_type === "joint";
  return 1 + (isJoint ? 1 : 0) + deps;
}

function computeTotalExpenses(sub: Record<string, unknown>): number {
  return (
    Number(sub.exp_rent_mortgage ?? 0) +
    Number(sub.exp_utilities ?? 0) +
    Number(sub.exp_food ?? 0) +
    Number(sub.exp_transportation ?? 0) +
    Number(sub.exp_healthcare ?? 0) +
    Number(sub.exp_insurance ?? 0) +
    Number(sub.exp_childcare ?? 0) +
    Number(sub.exp_other ?? 0)
  );
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
  state: string | null;
  current_monthly_income: number | null;
  six_month_gross_total: number | null;
  state_median_income: number | null;
  median_income_label: string | null;
  above_median: boolean | null;
  disposable_income: number | null;
  means_test_result: string | null;
  qualify_target_monthly: number | null;
  qualify_target_3mo: number | null;
  qualify_target_6mo: number | null;
  qualify_analysis_notes: string | null;
  pref_pay_flagged: boolean;
  pref_pay_total: number | null;
  pref_pay_insider_total: number | null;
  pref_pay_non_insider_total: number | null;
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

// ─── Intake Attorney Review Modal ─────────────────────────────────────────────

function IntakeAttorneyReviewModal({
  lead,
  submission,
  onClose,
  onSaved,
}: {
  lead: Lead;
  submission: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"eligibility" | "issues" | "decision">("eligibility");
  const [review, setReview] = useState<IntakeReview | null>(null);
  const [issues, setIssues] = useState<IntakeIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eligNotes, setEligNotes] = useState("");
  const [qualifyNotes, setQualifyNotes] = useState("");
  const [prefPayNotes, setPrefPayNotes] = useState("");
  const [newIssueCategory, setNewIssueCategory] = useState("income");
  const [newIssueSeverity, setNewIssueSeverity] = useState("warning");
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueDesc, setNewIssueDesc] = useState("");
  const [addingIssue, setAddingIssue] = useState(false);
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const [decision, setDecision] = useState("accepted");
  const [caseType, setCaseType] = useState("ch7_regular");
  const [attFee, setAttFee] = useState(String(ATTORNEY_FEES["ch7_regular"]));
  const [filingFee, setFilingFee] = useState(String(CHAPTER_FILING_FEES["ch7_regular"]));
  const [downPayment, setDownPayment] = useState("500");
  const [planMonths, setPlanMonths] = useState("4");
  const [upfront13, setUpfront13] = useState("1500");
  const [plan13, setPlan13] = useState("2500");
  const [limitedDesc, setLimitedDesc] = useState("");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [showAddIssue, setShowAddIssue] = useState(false);

  // ── Computed eligibility from submission ──
  const cmi = submission ? computeCMI(submission) : (lead.income_estimate ?? 0);
  const houseSize = submission ? computeHouseholdSize(submission) : 1 + (Number(submission?.num_dependents ?? 0));
  const medianAnnual = stateMedian(lead.state ?? "CO", houseSize);
  const medianMonthly = medianAnnual / 12;
  const aboveMedian = cmi > medianMonthly;
  const totalExpenses = submission ? computeTotalExpenses(submission) : 0;
  const disposableIncome = cmi - totalExpenses;
  const meansTestResult: "pass" | "fail" | "borderline" =
    !aboveMedian ? "pass"
    : disposableIncome > 214 ? "fail"
    : "borderline";
  const ch7Eligible = meansTestResult !== "fail";
  const ch13Eligible = true; // always available

  // Income-to-qualify projection (if borderline/fail — what they need to avg)
  const qualifyTargetMonthly = medianMonthly * 0.98; // slight margin below median
  const qualifyTarget3mo = qualifyTargetMonthly; // avg needed over 3 months
  const qualifyTarget6mo = qualifyTargetMonthly; // avg needed over 6 months

  // Preferential payment analysis
  const prefPays = (submission?.preferential_payments_json as Array<{ creditor: string; amount: number; date: string; relationship: string }> | null) ?? [];
  const insiderPrefTotal = prefPays
    .filter(p => p.relationship?.toLowerCase().includes("insider") || p.relationship?.toLowerCase().includes("aunt") || p.relationship?.toLowerCase().includes("uncle") || p.relationship?.toLowerCase().includes("parent") || p.relationship?.toLowerCase().includes("sibling") || p.relationship?.toLowerCase().includes("relative") || p.relationship?.toLowerCase().includes("friend"))
    .reduce((s, p) => s + Number(p.amount), 0);
  const nonInsiderPrefTotal = prefPays
    .filter(p => !p.relationship?.toLowerCase().includes("insider") && !p.relationship?.toLowerCase().includes("aunt") && !p.relationship?.toLowerCase().includes("uncle") && !p.relationship?.toLowerCase().includes("parent") && !p.relationship?.toLowerCase().includes("sibling") && !p.relationship?.toLowerCase().includes("relative") && !p.relationship?.toLowerCase().includes("friend"))
    .reduce((s, p) => s + Number(p.amount), 0);
  const prefPayFlagged = submission?.has_preferential_payments === true && prefPays.length > 0;

  // Vehicle equity
  const vehicles = (submission?.vehicles_json as Array<{ year: number; make: string; model: string; value: number; hasLoan: boolean; loanBalance: number }> | null) ?? [];
  const CO_VEHICLE_EXEMPTION = 7500;
  const nonExemptVehicleEquity = vehicles.reduce((s, v) => {
    const equity = Number(v.value ?? 0) - Number(v.loanBalance ?? 0);
    const nonExempt = Math.max(0, equity - CO_VEHICLE_EXEMPTION);
    return s + nonExempt;
  }, 0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const rows = await sbGet<IntakeReview>(
        `attorney_intake_reviews?lead_id=eq.${lead.id}&order=created_at.desc&limit=1`
      );
      let rev = rows[0] ?? null;
      if (!rev && submission) {
        // Auto-generate review record with computed data
        const body: Partial<IntakeReview> = {
          lead_id: lead.id,
          submission_id: String(submission.id ?? ""),
          attorney_name: "Jennifer Smith, Esq.",
          review_status: "in_progress",
          ch7_eligible: ch7Eligible,
          ch13_eligible: ch13Eligible,
          household_size: houseSize,
          state: lead.state ?? "CO",
          current_monthly_income: cmi,
          six_month_gross_total: cmi * 6,
          state_median_income: medianMonthly,
          median_income_label: `${lead.state ?? "CO"} — ${houseSize}-person: ${fmt(medianAnnual)}/yr`,
          above_median: aboveMedian,
          disposable_income: disposableIncome,
          means_test_result: meansTestResult,
          qualify_target_monthly: qualifyTargetMonthly,
          qualify_target_3mo: qualifyTarget3mo,
          qualify_target_6mo: qualifyTarget6mo,
          pref_pay_flagged: prefPayFlagged,
          pref_pay_total: insiderPrefTotal + nonInsiderPrefTotal,
          pref_pay_insider_total: insiderPrefTotal,
          pref_pay_non_insider_total: nonInsiderPrefTotal,
          decision: "pending",
        };
        const created = await sbPost("attorney_intake_reviews", body);
        if (created && Array.isArray(created) && created[0]) {
          rev = created[0] as IntakeReview;
        }
      }
      if (rev) {
        setReview(rev);
        setEligNotes(rev.eligibility_notes ?? "");
        setQualifyNotes(rev.qualify_analysis_notes ?? "");
        setPrefPayNotes(rev.pref_pay_notes ?? "");
        setDecision(rev.decision ?? "accepted");
        setCaseType(rev.case_type ?? (ch7Eligible ? "ch7_regular" : "ch13_flat_fee"));
        setAttFee(String(rev.attorney_fee ?? ATTORNEY_FEES[rev.case_type ?? "ch7_regular"] ?? ATTORNEY_FEES["ch7_regular"]));
        setFilingFee(String(rev.court_filing_fee ?? CHAPTER_FILING_FEES[rev.case_type ?? "ch7_regular"] ?? CHAPTER_FILING_FEES["ch7_regular"]));
        setDownPayment(String(rev.down_payment ?? 500));
        setPlanMonths(String(rev.plan_months ?? 4));
        setUpfront13(String(rev.ch13_upfront_amount ?? 1500));
        setPlan13(String(rev.ch13_plan_portion ?? 2500));
        setLimitedDesc(rev.limited_scope_desc ?? "");
        setDecisionNotes(rev.decision_notes ?? "");
        // Load issues for this review
        const issueRows = await sbGet<IntakeIssue>(
          `attorney_intake_issues?review_id=eq.${rev.id}&order=sort_order.asc`
        );
        // Auto-seed issues if none exist and there are flags
        if (issueRows.length === 0 && rev.id) {
          await seedAutoIssues(rev.id);
          const fresh = await sbGet<IntakeIssue>(
            `attorney_intake_issues?review_id=eq.${rev.id}&order=sort_order.asc`
          );
          setIssues(fresh);
        } else {
          setIssues(issueRows);
        }
      }
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  async function seedAutoIssues(reviewId: string) {
    const toInsert: Partial<IntakeIssue>[] = [];
    let order = 0;

    if (meansTestResult === "fail") {
      toInsert.push({
        review_id: reviewId, category: "income", severity: "error", sort_order: order++,
        title: "Income Exceeds State Median — Chapter 7 Means Test Fails",
        description: `Client's current monthly income of ${fmt(cmi)} exceeds the ${lead.state ?? "CO"} ${houseSize}-person median of ${fmt(medianMonthly)}/mo ($${(medianAnnual / 1000).toFixed(0)}k/yr). Disposable income after expenses is approximately ${fmt(disposableIncome)}/mo, which exceeds the $214/mo Chapter 7 threshold.`,
      });
    } else if (meansTestResult === "borderline") {
      toInsert.push({
        review_id: reviewId, category: "income", severity: "warning", sort_order: order++,
        title: "Income Borderline — Means Test Analysis Required",
        description: `Client's CMI of ${fmt(cmi)}/mo is ${aboveMedian ? "above" : "below"} the ${lead.state ?? "CO"} ${houseSize}-person median of ${fmt(medianMonthly)}/mo. Detailed expense analysis needed to confirm Chapter 7 eligibility.`,
      });
    }

    if (prefPayFlagged && insiderPrefTotal > 0) {
      toInsert.push({
        review_id: reviewId, category: "pref_payments", severity: "error", sort_order: order++,
        title: `Preferential Payment to Insider — ${fmt(insiderPrefTotal)} Within 12 Months`,
        description: `Client made payment(s) totaling ${fmt(insiderPrefTotal)} to an insider (family member/relative) within the 12-month lookback period. This may constitute a voidable preference under 11 U.S.C. § 547. The Trustee can demand these funds back from the recipient.`,
      });
    }
    if (prefPayFlagged && nonInsiderPrefTotal > 600) {
      toInsert.push({
        review_id: reviewId, category: "pref_payments", severity: "warning", sort_order: order++,
        title: `Preferential Payment to Non-Insider — ${fmt(nonInsiderPrefTotal)} Within 90 Days`,
        description: `Client made payment(s) totaling ${fmt(nonInsiderPrefTotal)} to a non-insider creditor within 90 days of filing. The Trustee may scrutinize payments over $600.`,
      });
    }

    if (nonExemptVehicleEquity > 0) {
      toInsert.push({
        review_id: reviewId, category: "assets", severity: "warning", sort_order: order++,
        title: `Non-Exempt Vehicle Equity — ${fmt(nonExemptVehicleEquity)}`,
        description: `Client has vehicle equity exceeding the ${lead.state ?? "CO"} motor vehicle exemption ($${CO_VEHICLE_EXEMPTION.toLocaleString()}). Estimated non-exempt equity: ${fmt(nonExemptVehicleEquity)}. Chapter 7 Trustee may liquidate the vehicle. Client should consider Chapter 13, reaffirmation, or surrender.`,
      });
    }

    if (submission?.has_prior_bk) {
      toInsert.push({
        review_id: reviewId, category: "prior_bk", severity: "error", sort_order: order++,
        title: "Prior Bankruptcy — Discharge Timing Restriction May Apply",
        description: "Client disclosed a prior bankruptcy. Review discharge date and chapter to determine if the mandatory waiting period (e.g., 8 years Ch.7 → Ch.7; 4 years Ch.13 → Ch.7) has been satisfied.",
      });
    }

    if (submission?.recent_luxury) {
      toInsert.push({
        review_id: reviewId, category: "luxury", severity: "warning", sort_order: order++,
        title: "Recent Luxury Purchases — Non-Dischargeable If Within 90 Days",
        description: `Client disclosed recent luxury purchases: "${submission.luxury_details ?? "details not provided"}". Under 11 U.S.C. § 523(a)(2)(C), luxury goods or services on a single credit card exceeding $800 within 90 days of filing are presumptively non-dischargeable.`,
      });
    }

    for (const issue of toInsert) {
      await sbPost("attorney_intake_issues", issue);
    }
  }

  async function saveReviewFields(fields: Partial<IntakeReview>) {
    if (!review) return;
    await fetch(`${SUPABASE_URL}/rest/v1/attorney_intake_reviews?id=eq.${review.id}`, {
      method: "PATCH",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
    });
    setReview(prev => prev ? { ...prev, ...fields } : prev);
  }

  async function addIssue() {
    if (!review || !newIssueTitle.trim()) return;
    setAddingIssue(true);
    const body: Partial<IntakeIssue> = {
      review_id: review.id,
      category: newIssueCategory,
      severity: newIssueSeverity,
      title: newIssueTitle,
      description: newIssueDesc,
      sort_order: issues.length,
    };
    const created = await sbPost("attorney_intake_issues", body);
    if (created && Array.isArray(created) && created[0]) {
      setIssues(prev => [...prev, created[0] as IntakeIssue]);
    }
    setNewIssueTitle(""); setNewIssueDesc(""); setShowAddIssue(false);
    setAddingIssue(false);
  }

  async function saveIssueNote(issueId: string, note: string) {
    await fetch(`${SUPABASE_URL}/rest/v1/attorney_intake_issues?id=eq.${issueId}`, {
      method: "PATCH",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ attorney_note: note }),
    });
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, attorney_note: note } : i));
    setEditingIssueId(null);
  }

  async function acknowledgeIssue(issueId: string, initials: string) {
    const now = new Date().toISOString();
    await fetch(`${SUPABASE_URL}/rest/v1/attorney_intake_issues?id=eq.${issueId}`, {
      method: "PATCH",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ client_acknowledged: true, client_initials: initials, acknowledged_at: now }),
    });
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, client_acknowledged: true, client_initials: initials, acknowledged_at: now } : i));
  }

  async function saveDecision() {
    if (!review) return;
    setSaving(true);
    const ch = caseType.startsWith("ch7") ? 7 : caseType.startsWith("ch13") ? 13 : null;
    const totalFee = caseType === "ch7_regular" ? parseFloat(attFee) || 0
      : caseType === "ch7_bifurcated" ? parseFloat(attFee) || 0
      : caseType === "ch13_flat_fee" ? (parseFloat(upfront13) || 0) + (parseFloat(plan13) || 0) + (parseFloat(filingFee) || 0)
      : parseFloat(attFee) || 0;

    const fields: Partial<IntakeReview> = {
      decision, case_type: decision === "accepted" ? caseType : null,
      chapter: decision === "accepted" ? ch : null,
      attorney_fee: parseFloat(attFee) || null,
      court_filing_fee: caseType !== "limited_scope" ? parseFloat(filingFee) || null : null,
      total_fee: decision === "accepted" ? totalFee : null,
      down_payment: (caseType === "ch7_regular" || caseType === "ch7_bifurcated") ? parseFloat(downPayment) || null : null,
      plan_months: (caseType === "ch7_regular" || caseType === "ch7_bifurcated") ? parseInt(planMonths) || null : null,
      ch13_upfront_amount: caseType === "ch13_flat_fee" ? parseFloat(upfront13) || null : null,
      ch13_plan_portion: caseType === "ch13_flat_fee" ? parseFloat(plan13) || null : null,
      limited_scope_desc: caseType === "limited_scope" ? limitedDesc : null,
      decision_notes: decisionNotes || null,
      eligibility_notes: eligNotes || null,
      qualify_analysis_notes: qualifyNotes || null,
      pref_pay_notes: prefPayNotes || null,
      review_status: "complete",
      decided_at: new Date().toISOString(),
    };
    await saveReviewFields(fields);

    // Update attorney_case_acceptances table (legacy compatibility)
    const legacyBody = {
      lead_id: lead.id,
      submission_id: String(submission?.id ?? ""),
      attorney_name: "Jennifer Smith, Esq.",
      decision,
      case_type: fields.case_type,
      chapter: fields.chapter,
      attorney_fee: fields.attorney_fee,
      court_filing_fee: fields.court_filing_fee,
      total_fee: fields.total_fee,
      down_payment: fields.down_payment,
      plan_months: fields.plan_months,
      ch13_upfront_amount: fields.ch13_upfront_amount,
      ch13_plan_portion: fields.ch13_plan_portion,
      limited_scope_desc: fields.limited_scope_desc,
      decision_notes: fields.decision_notes,
      decided_at: fields.decided_at,
    };
    await sbPost("attorney_case_acceptances", legacyBody);

    // Update lead status
    const newStatus = decision === "accepted" ? "attorney_accepted" : decision === "declined" ? "declined" : "sent_for_attorney_review";
    await sbPatch("intake_leads", lead.id, { status: newStatus });

    setSaving(false);
    onSaved();
  }

  function handleCaseTypeChange(ct: string) {
    setCaseType(ct);
    setAttFee(String(ATTORNEY_FEES[ct] ?? ATTORNEY_FEES["ch7_regular"]));
    setFilingFee(String(CHAPTER_FILING_FEES[ct] ?? 0));
  }

  const totalFeeDisplay =
    caseType === "ch7_regular" ? (parseFloat(attFee) || 0) + (parseFloat(filingFee) || 0)
    : caseType === "ch7_bifurcated" ? parseFloat(attFee) || 0
    : caseType === "ch13_flat_fee" ? (parseFloat(upfront13) || 0) + (parseFloat(plan13) || 0) + (parseFloat(filingFee) || 0)
    : parseFloat(attFee) || 0;

  const openIssueCount = issues.filter(i => !i.client_acknowledged).length;
  const errorCount = issues.filter(i => i.severity === "error").length;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
        <div className="bg-[#0d1221] border border-slate-700 rounded-2xl p-8 flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
          <p className="text-white text-sm">Loading review...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-slate-950/90 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-[#080e1a] border border-slate-700 rounded-2xl shadow-2xl flex flex-col"
        style={{ minHeight: "70vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-start justify-between gap-4 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Scale className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Attorney Intake Review</span>
              {errorCount > 0 && (
                <span className="text-[9px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5">{errorCount} ISSUE{errorCount > 1 ? "S" : ""}</span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Georgia', serif" }}>{lead.full_name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ch. {lead.chapter_interest ?? "?"} interest · {lead.state ?? "—"} · {submission ? `${houseSize}-person household` : "household unknown"}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors mt-1"><X className="w-5 h-5" /></button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-slate-800 flex-shrink-0">
          {([
            { id: "eligibility", label: "Eligibility Analysis" },
            { id: "issues", label: `Issues ${issues.length > 0 ? `(${issues.length})` : ""}` },
            { id: "decision", label: "Decision & Fees" },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 ${
                activeTab === t.id
                  ? "text-amber-400 border-amber-400"
                  : "text-slate-500 border-transparent hover:text-slate-300"
              }`}
            >{t.label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ══════════ ELIGIBILITY TAB ══════════ */}
          {activeTab === "eligibility" && (
            <div className="space-y-5">
              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Current Monthly Income", val: fmt(cmi), sub: "CMI per Form 122A-1" },
                  { label: `${lead.state ?? "CO"} Median (${houseSize}-person)`, val: fmt(medianMonthly)+"/mo", sub: fmt(medianAnnual)+"/yr" },
                  { label: "Monthly Expenses", val: fmt(totalExpenses), sub: "Reported by client" },
                  { label: "Disposable Income", val: fmt(disposableIncome), sub: "After expenses" },
                ].map(s => (
                  <div key={s.label} className="bg-slate-800/40 rounded-xl p-3 text-center">
                    <p className="text-[9px] text-slate-500 leading-tight mb-1">{s.label}</p>
                    <p className={`text-sm font-bold ${s.label.includes("Disposable") && disposableIncome > 214 ? "text-red-400" : "text-white"}`}>{s.val}</p>
                    <p className="text-[9px] text-slate-600 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Chapter 7 eligibility card */}
              <div className={`rounded-2xl border p-4 ${ch7Eligible ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/25"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${ch7Eligible ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
                    {ch7Eligible ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${ch7Eligible ? "text-emerald-300" : "text-red-300"}`}>
                      Chapter 7 — {ch7Eligible ? "Likely Eligible" : "Likely Ineligible"}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {meansTestResult === "pass" ? "Below state median — means test satisfied" :
                       meansTestResult === "borderline" ? "Borderline — detailed expense analysis required" :
                       "Above median + disposable income exceeds threshold"}
                    </p>
                  </div>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    meansTestResult === "pass" ? "bg-emerald-500/15 text-emerald-400"
                    : meansTestResult === "borderline" ? "bg-amber-500/15 text-amber-400"
                    : "bg-red-500/15 text-red-400"
                  }`}>
                    {meansTestResult === "pass" ? "PASS" : meansTestResult === "borderline" ? "BORDERLINE" : "FAIL"}
                  </span>
                </div>

                {/* Means test bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[9px] text-slate-500 mb-1">
                    <span>Client CMI: {fmt(cmi)}/mo</span>
                    <span>Median: {fmt(medianMonthly)}/mo</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${cmi <= medianMonthly ? "bg-emerald-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(100, (cmi / (medianMonthly * 1.5)) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[9px] mt-1">
                    <span className="text-slate-600">$0</span>
                    <span className="text-amber-400 font-semibold">Median ↑ {fmt(medianMonthly)}</span>
                    <span className="text-slate-600">{fmt(medianMonthly * 1.5)}</span>
                  </div>
                </div>
              </div>

              {/* Chapter 13 eligibility card */}
              <div className="rounded-2xl border p-4 bg-sky-500/5 border-sky-500/20">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-sky-500/15 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-sky-300">Chapter 13 — Eligible</p>
                    <p className="text-[10px] text-slate-500">Reorganization plan — 3–5 year repayment; no income ceiling; protects non-exempt assets</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400">ELIGIBLE</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { label: "Est. Unsecured Debt", val: fmt((Number(submission?.credit_card_debt ?? 0) + Number(submission?.medical_debt ?? 0) + Number(submission?.other_unsecured ?? 0))) },
                    { label: "Est. Secured Debt", val: fmt(Number(submission?.secured_debt ?? 0)) },
                    { label: "Plan Disposable", val: fmt(disposableIncome) + "/mo" },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-800/40 rounded-xl p-2 text-center">
                      <p className="text-[9px] text-slate-500">{s.label}</p>
                      <p className="text-xs font-bold text-white mt-0.5">{s.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Income-to-qualify projection (shown when borderline/fail) */}
              {(meansTestResult === "fail" || meansTestResult === "borderline") && (
                <div className="rounded-2xl border p-4 bg-amber-500/5 border-amber-500/25">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <p className="text-sm font-bold text-amber-300">Income-to-Qualify Projection</p>
                    <p className="text-[10px] text-slate-500 ml-1">For Chapter 7 eligibility</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    For this client to qualify for Chapter 7, their 6-month average current monthly income must fall below the {lead.state ?? "CO"} {houseSize}-person median of <span className="text-white font-semibold">{fmt(medianMonthly)}/mo</span> ({fmt(medianAnnual)}/yr). Based on current income of <span className="text-amber-300 font-semibold">{fmt(cmi)}/mo</span>, here is what the client would need to average over the next filing window:
                  </p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: "Target Monthly Income", val: fmt(qualifyTargetMonthly), sub: "Must stay below this" },
                      { label: "Avg Needed (3-mo)", val: fmt(qualifyTarget3mo), sub: "If filing in 3 months" },
                      { label: "Avg Needed (6-mo)", val: fmt(qualifyTarget6mo), sub: "If filing in 6 months" },
                    ].map(s => (
                      <div key={s.label} className="bg-slate-800/50 border border-amber-500/15 rounded-xl p-2.5 text-center">
                        <p className="text-[9px] text-slate-500 leading-tight">{s.label}</p>
                        <p className="text-sm font-bold text-amber-300 mt-0.5">{s.val}</p>
                        <p className="text-[9px] text-slate-600 mt-0.5">{s.sub}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-600 leading-relaxed mb-2">
                    Income overage: <span className="text-red-400 font-semibold">{fmt(Math.max(0, cmi - medianMonthly))}/mo</span> above median.
                    If current income drops by this amount (e.g., reduced hours, job change, or seasonal employment), the client may qualify for Chapter 7 in the next 3–6 months.
                    Attorney should advise client to track pay stubs carefully.
                  </p>
                  <textarea
                    rows={2}
                    value={qualifyNotes}
                    onChange={e => setQualifyNotes(e.target.value)}
                    onBlur={() => review && saveReviewFields({ qualify_analysis_notes: qualifyNotes })}
                    placeholder="Attorney analysis: income trend, likelihood of qualifying, timing recommendation…"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none transition-colors"
                  />
                </div>
              )}

              {/* Preferential payment analysis */}
              {prefPayFlagged && (
                <div className="rounded-2xl border p-4 bg-red-500/5 border-red-500/25">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <p className="text-sm font-bold text-red-300">Preferential Payment Analysis</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: "Total Pref. Payments", val: fmt(insiderPrefTotal + nonInsiderPrefTotal), color: "text-red-300" },
                      { label: "Insider (12-mo lookback)", val: fmt(insiderPrefTotal), color: "text-red-300" },
                      { label: "Non-Insider (90-day)", val: fmt(nonInsiderPrefTotal), color: nonInsiderPrefTotal > 600 ? "text-amber-300" : "text-slate-400" },
                    ].map(s => (
                      <div key={s.label} className="bg-slate-800/50 border border-red-500/15 rounded-xl p-2.5 text-center">
                        <p className="text-[9px] text-slate-500">{s.label}</p>
                        <p className={`text-sm font-bold mt-0.5 ${s.color}`}>{s.val}</p>
                      </div>
                    ))}
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
                  <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
                    <span className="text-white font-semibold">Attorney note:</span> Under 11 U.S.C. § 547, the Trustee can avoid and recover payments made to insiders within 12 months if the debtor was insolvent at the time. The recipient (Aunt Charlotte) may be required to return these funds to the estate. Advise client to inform family member of this risk.
                  </p>
                  <textarea
                    rows={2}
                    value={prefPayNotes}
                    onChange={e => setPrefPayNotes(e.target.value)}
                    onBlur={() => review && saveReviewFields({ pref_pay_notes: prefPayNotes })}
                    placeholder="Attorney notes on preferential payment strategy…"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none transition-colors"
                  />
                </div>
              )}

              {/* ── Exemption Analyzer ───────────────────────────────────────────────────
                   Exemption state comes from intake_submissions.exemption_state, which is
                   computed by ClientIntakeForm.tsx using the full 11 U.S.C. § 522(b)(3)(A)
                   730-day domicile window. This is authoritative — do not fall back to the
                   source repo's simpler addressYears dropdown approach.
              ─────────────────────────────────────────────────────────────────────────── */}
              {(() => {
                const rawState = String(submission?.exemption_state || submission?.state || lead.state || "");
                const ownsRE = submission?.owns_real_estate === true || submission?.owns_real_estate === "yes";
                const exemptions = getApplicableExemptions(rawState, undefined, ownsRE);
                const isFederal = exemptions === FEDERAL_EXEMPTIONS;
                const isWA = exemptions.code === "WA";
                const isCA = exemptions.code === "CA";

                const waElig = isWA ? getWaHomesteadEligibility(
                  submission?.home_acquired_date as string | undefined,
                  submission?.is_primary_residence as string | undefined,
                  submission?.county as string | undefined,
                ) : null;

                const caCounty = isCA ? String(submission?.county || "") : "";
                const caCountyHomestead = isCA && ownsRE ? getCaHomesteadByCounty(caCounty) : null;

                const fmtEx = (v: number | 'unlimited') => {
                  if (v === 'unlimited' || v === -1) return "Unlimited";
                  if (v === 0) return "None";
                  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v as number);
                };

                const homesteadVal = isWA
                  ? (waElig?.eligible ? waElig.amount : 0)
                  : isCA && caCountyHomestead != null
                  ? caCountyHomestead
                  : (exemptions.homestead as number | 'unlimited');

                const isUnlimited = homesteadVal === -1 || homesteadVal === 'unlimited';

                return (
                  <div className="rounded-2xl border p-4 bg-purple-500/5 border-purple-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-xl bg-purple-500/15 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-purple-300">Exemption Analysis</p>
                        <p className="text-[10px] text-slate-500">
                          {isFederal ? "Federal exemptions (11 U.S.C. §522(d))" : `${exemptions.state} state exemptions`}
                          {isCA && ` — System ${ownsRE ? "704 (homeowner)" : "703 (non-homeowner)"}`}
                          {!rawState && " — state not on file"}
                        </p>
                      </div>
                      {isFederal && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">FEDERAL</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                      {[
                        {
                          label: "Homestead",
                          val: isWA && waElig != null
                            ? (waElig.eligible ? fmtEx(waElig.amount) : "Not eligible")
                            : isCA && caCountyHomestead != null
                            ? fmtEx(caCountyHomestead)
                            : fmtEx(exemptions.homestead),
                          color: isUnlimited ? "text-emerald-400" : "text-white",
                          note: isWA && waElig ? null : (isCA && caCounty ? `${caCounty} County` : null),
                        },
                        { label: "Vehicle", val: fmtEx(exemptions.vehicle), color: "text-white", note: null },
                        { label: "Wildcard", val: fmtEx(exemptions.wildcard), color: exemptions.wildcard > 0 ? "text-emerald-400" : "text-slate-500", note: null },
                      ].map(s => (
                        <div key={s.label} className="bg-slate-800/40 rounded-xl p-2.5 text-center">
                          <p className="text-[9px] text-slate-500 leading-tight">{s.label}</p>
                          <p className={`text-sm font-bold mt-0.5 ${s.color}`}>{s.val}</p>
                          {s.note && <p className="text-[9px] text-slate-600 mt-0.5">{s.note}</p>}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-start gap-2 bg-slate-800/30 rounded-xl px-3 py-2">
                        <p className="text-[9px] text-slate-500 w-20 flex-shrink-0 pt-0.5">Retirement</p>
                        <p className="text-[10px] text-slate-300 leading-snug">{exemptions.retirement}</p>
                      </div>
                      <div className="flex items-start gap-2 bg-slate-800/30 rounded-xl px-3 py-2">
                        <p className="text-[9px] text-slate-500 w-20 flex-shrink-0 pt-0.5">Wages</p>
                        <p className="text-[10px] text-slate-300 leading-snug">{exemptions.wages}</p>
                      </div>
                    </div>

                    {/* WA-specific: 1,215-day ownership check */}
                    {isWA && waElig && (
                      <div className={`rounded-xl px-3 py-2 text-[10px] leading-snug mb-2 ${
                        waElig.eligible ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                        : "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                      }`}>
                        {waElig.note}
                      </div>
                    )}

                    {/* Homestead citation note */}
                    {exemptions.homesteadNote && !isWA && (
                      <p className="text-[9px] text-slate-600 leading-snug mb-1.5">{exemptions.homesteadNote}</p>
                    )}

                    {/* Wildcard note */}
                    {exemptions.wildcardNote && (
                      <p className="text-[9px] text-slate-600 leading-snug mb-1.5">{exemptions.wildcardNote}</p>
                    )}

                    {/* State-specific notes */}
                    {exemptions.notes && (
                      <p className="text-[9px] text-slate-500 leading-snug border-t border-slate-800 pt-2 mt-1">{exemptions.notes}</p>
                    )}

                    {/* Federal option callout */}
                    {!isFederal && exemptions.federalOption && (
                      <p className="text-[9px] text-sky-500 leading-snug mt-1.5">
                        Federal exemptions also available — attorney should compare both systems for this client.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* General eligibility notes */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Attorney Eligibility Notes</label>
                <textarea
                  rows={3}
                  value={eligNotes}
                  onChange={e => setEligNotes(e.target.value)}
                  onBlur={() => review && saveReviewFields({ eligibility_notes: eligNotes })}
                  placeholder="Overall eligibility assessment, chapter recommendation, timing notes…"
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none transition-colors"
                />
              </div>
            </div>
          )}

          {/* ══════════ ISSUES TAB ══════════ */}
          {activeTab === "issues" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">{issues.length} Flagged Issue{issues.length !== 1 ? "s" : ""}</p>
                  {errorCount > 0 && <span className="text-[9px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5">{errorCount} ERROR</span>}
                  {openIssueCount > 0 && <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/20 rounded-full px-1.5 py-0.5">{openIssueCount} UNACKNOWLEDGED</span>}
                </div>
                <button onClick={() => setShowAddIssue(s => !s)} className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-1.5 transition-colors">
                  <Plus className="w-3 h-3" /> Add Issue
                </button>
              </div>

              {/* Add issue form */}
              {showAddIssue && (
                <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Category</label>
                      <select value={newIssueCategory} onChange={e => setNewIssueCategory(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500">
                        {[["income","Income / Means Test"],["pref_payments","Preferential Payments"],["assets","Assets / Exemptions"],["prior_bk","Prior Bankruptcy"],["luxury","Luxury Purchases"],["transfers","Property Transfers"],["timeline","Filing Timeline"],["other","Other"]].map(([v,l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Severity</label>
                      <select value={newIssueSeverity} onChange={e => setNewIssueSeverity(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500">
                        <option value="error">Error — Must Resolve</option>
                        <option value="warning">Warning — Review Needed</option>
                        <option value="info">Info — Note for Client</option>
                      </select>
                    </div>
                  </div>
                  <input type="text" value={newIssueTitle} onChange={e => setNewIssueTitle(e.target.value)}
                    placeholder="Issue title…"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-500" />
                  <textarea rows={2} value={newIssueDesc} onChange={e => setNewIssueDesc(e.target.value)}
                    placeholder="Description / legal basis…"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddIssue(false)} className="flex-1 py-2 text-xs font-semibold text-slate-400 border border-slate-700 rounded-xl hover:text-white transition-colors">Cancel</button>
                    <button onClick={addIssue} disabled={addingIssue || !newIssueTitle.trim()} className="flex-1 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl disabled:opacity-50 transition-colors">
                      {addingIssue ? <RefreshCw className="w-3 h-3 animate-spin mx-auto" /> : "Add Issue"}
                    </button>
                  </div>
                </div>
              )}

              {issues.length === 0 && !showAddIssue && (
                <div className="text-center py-10 bg-slate-800/20 rounded-2xl border border-slate-800">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500/50 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No issues flagged</p>
                  <p className="text-xs text-slate-700 mt-0.5">System will auto-flag issues based on intake data</p>
                </div>
              )}

              {issues.map(issue => {
                const sev = issue.severity === "error" ? { bg: "bg-red-500/8", border: "border-red-500/25", badge: "bg-red-500 text-white", icon: <AlertTriangle className="w-3.5 h-3.5 text-red-400" />, label: "ERROR" }
                  : issue.severity === "warning" ? { bg: "bg-amber-500/8", border: "border-amber-500/20", badge: "bg-amber-500/20 text-amber-300 border border-amber-500/30", icon: <Flag className="w-3.5 h-3.5 text-amber-400" />, label: "WARNING" }
                  : { bg: "bg-sky-500/5", border: "border-sky-500/20", badge: "bg-sky-500/20 text-sky-300 border border-sky-500/30", icon: <Info className="w-3.5 h-3.5 text-sky-400" />, label: "INFO" };
                const catLabel: Record<string, string> = { income: "Income", pref_payments: "Pref. Payments", assets: "Assets", prior_bk: "Prior Bankruptcy", luxury: "Luxury", transfers: "Transfers", timeline: "Timeline", other: "Other" };
                return (
                  <div key={issue.id} className={`rounded-2xl border p-4 space-y-3 ${sev.bg} ${sev.border}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">{sev.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sev.badge}`}>{sev.label}</span>
                          <span className="text-[9px] text-slate-500 bg-slate-800/60 rounded-full px-1.5 py-0.5 capitalize">{catLabel[issue.category] ?? issue.category}</span>
                          {issue.client_acknowledged && (
                            <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5 flex items-center gap-1">
                              <CheckCheck className="w-2.5 h-2.5" /> Acknowledged {issue.client_initials ? `· ${issue.client_initials}` : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-white">{issue.title}</p>
                        <p className="text-xs text-slate-400 leading-relaxed mt-1">{issue.description}</p>
                      </div>
                    </div>

                    {/* Attorney note */}
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Attorney Note / Advice</p>
                      {editingIssueId === issue.id ? (
                        <div className="space-y-2">
                          <textarea rows={2} value={editingNote} onChange={e => setEditingNote(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none" />
                          <div className="flex gap-2">
                            <button onClick={() => setEditingIssueId(null)} className="flex-1 py-1.5 text-[10px] font-semibold text-slate-400 border border-slate-700 rounded-xl hover:text-white">Cancel</button>
                            <button onClick={() => saveIssueNote(issue.id, editingNote)} className="flex-1 py-1.5 text-[10px] font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl">Save Note</button>
                          </div>
                        </div>
                      ) : issue.attorney_note ? (
                        <div className="flex items-start gap-2">
                          <div className="flex-1 bg-slate-800/60 rounded-xl px-3 py-2">
                            <p className="text-xs text-slate-300 leading-relaxed">{issue.attorney_note}</p>
                          </div>
                          <button onClick={() => { setEditingIssueId(issue.id); setEditingNote(issue.attorney_note ?? ""); }} className="text-slate-500 hover:text-white transition-colors flex-shrink-0 mt-0.5">
                            <PenLine className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingIssueId(issue.id); setEditingNote(""); }} className="w-full text-left text-xs text-slate-600 hover:text-slate-400 bg-slate-800/30 border border-slate-700/50 border-dashed rounded-xl px-3 py-2 transition-colors">
                          + Add attorney note / advice for client…
                        </button>
                      )}
                    </div>

                    {/* Client acknowledgment */}
                    {!issue.client_acknowledged ? (
                      <IssueAckButton issue={issue} onAcknowledge={acknowledgeIssue} />
                    ) : (
                      <div className="flex items-center gap-2 bg-emerald-500/8 border border-emerald-500/15 rounded-xl px-3 py-2">
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <p className="text-xs text-emerald-400">Client acknowledged this issue{issue.client_initials ? ` — initialed "${issue.client_initials}"` : ""}</p>
                        {issue.acknowledged_at && <p className="text-[9px] text-slate-600 ml-auto">{fmtDate(issue.acknowledged_at)}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ══════════ DECISION TAB ══════════ */}
          {activeTab === "decision" && (
            <div className="space-y-5">
              {/* Summary bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Total Debt", val: fmt((Number(submission?.credit_card_debt ?? 0) + Number(submission?.medical_debt ?? 0) + Number(submission?.secured_debt ?? 0) + Number(submission?.personal_loan_debt ?? 0) + Number(submission?.other_unsecured ?? 0))) },
                  { label: "Monthly Income", val: fmt(cmi) },
                  { label: "Ch. 7 Eligibility", val: meansTestResult === "pass" ? "Likely Eligible" : meansTestResult === "borderline" ? "Borderline" : "Ineligible", color: meansTestResult === "pass" ? "text-emerald-400" : meansTestResult === "borderline" ? "text-amber-400" : "text-red-400" },
                  { label: "Open Issues", val: String(openIssueCount), color: openIssueCount > 0 ? "text-amber-400" : "text-emerald-400" },
                ].map(s => (
                  <div key={s.label} className="bg-slate-800/40 rounded-xl p-3 text-center">
                    <p className="text-[9px] text-slate-500">{s.label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${(s as {color?: string}).color ?? "text-white"}`}>{s.val}</p>
                  </div>
                ))}
              </div>

              {/* Attorney decision */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Attorney Decision</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "accepted", label: "Accept Case" },
                    { value: "needs_more_info", label: "Need More Info" },
                    { value: "declined", label: "Decline" },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setDecision(opt.value)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                        decision === opt.value
                          ? opt.value === "accepted" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : opt.value === "declined" ? "bg-red-500/20 border-red-500/40 text-red-300"
                          : "bg-amber-500/20 border-amber-500/40 text-amber-300"
                          : "bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-500"
                      }`}>{opt.label}</button>
                  ))}
                </div>
              </div>

              {decision === "accepted" && (
                <>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Case Type</p>
                    <div className="space-y-2">
                      {CASE_TYPES.map(ct => (
                        <button key={ct.value} onClick={() => handleCaseTypeChange(ct.value)}
                          className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${caseType === ct.value ? "bg-amber-500/10 border-amber-500/30 text-white" : "bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{ct.label}</p>
                            {caseType === ct.value && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{ct.sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Fee Structure</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Attorney Fee</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                          <input type="number" value={attFee} onChange={e => setAttFee(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:border-amber-500" />
                        </div>
                      </div>
                      {caseType !== "limited_scope" && caseType !== "ch7_bifurcated" && (
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Court Filing Fee</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                            <input type="number" value={filingFee} onChange={e => setFilingFee(e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:border-amber-500" />
                          </div>
                        </div>
                      )}
                      {(caseType === "ch7_regular" || caseType === "ch7_bifurcated") && (
                        <>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Down Payment</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                              <input type="number" value={downPayment} onChange={e => setDownPayment(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:border-amber-500" />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Payment Plan (months)</label>
                            <input type="number" value={planMonths} onChange={e => setPlanMonths(e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500" />
                          </div>
                        </>
                      )}
                      {caseType === "ch13_flat_fee" && (
                        <>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Upfront Amount</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                              <input type="number" value={upfront13} onChange={e => setUpfront13(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:border-amber-500" />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Remaining Through Plan</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                              <input type="number" value={plan13} onChange={e => setPlan13(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:border-amber-500" />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="mt-3 bg-slate-800/30 border border-slate-700/50 rounded-xl px-4 py-3 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Total Fee Estimate</span>
                      <span className="text-lg font-bold text-white">{fmt(totalFeeDisplay)}</span>
                    </div>
                    {caseType === "limited_scope" && (
                      <div className="mt-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Scope of Services</label>
                        <textarea rows={2} value={limitedDesc} onChange={e => setLimitedDesc(e.target.value)}
                          placeholder="e.g. Debt negotiation with Capital One only…"
                          className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none" />
                      </div>
                    )}
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
                  {decision === "accepted" ? "Acceptance Notes & Advice" : decision === "declined" ? "Reason for Declination" : "Additional Info Needed"}
                </label>
                <textarea rows={3} value={decisionNotes} onChange={e => setDecisionNotes(e.target.value)}
                  placeholder={
                    decision === "accepted" ? "Notes for paralegal, special instructions, strategy advice…"
                    : decision === "declined" ? "Reason for declining (asset issues, income too high, etc.)…"
                    : "What information is needed before a decision can be made…"
                  }
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none transition-colors" />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-slate-800 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="py-2.5 px-4 text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-all">Cancel</button>
          <div className="flex gap-1.5 flex-1 justify-end">
            {activeTab !== "eligibility" && (
              <button onClick={() => setActiveTab(activeTab === "issues" ? "eligibility" : "issues")}
                className="py-2.5 px-4 text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-all">
                Back
              </button>
            )}
            {activeTab !== "decision" ? (
              <button onClick={() => setActiveTab(activeTab === "eligibility" ? "issues" : "decision")}
                className="flex items-center gap-1.5 py-2.5 px-5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl transition-colors">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button disabled={saving} onClick={saveDecision}
                className={`flex items-center justify-center gap-2 py-2.5 px-5 text-xs font-bold text-white rounded-xl transition-all disabled:opacity-50 ${
                  decision === "accepted" ? "bg-emerald-600 hover:bg-emerald-500"
                  : decision === "declined" ? "bg-red-700 hover:bg-red-600"
                  : "bg-amber-600 hover:bg-amber-500"
                }`}>
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {decision === "accepted" ? "Accept & Record Decision" : decision === "declined" ? "Record Declination" : "Request More Info"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Issue Acknowledgment Button ─────────────────────────────────────────────

function IssueAckButton({ issue, onAcknowledge }: { issue: IntakeIssue; onAcknowledge: (id: string, initials: string) => void }) {
  const [initials, setInitials] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full text-left text-xs text-slate-600 hover:text-amber-400 bg-slate-800/30 border border-slate-700/50 border-dashed rounded-xl px-3 py-1.5 transition-colors flex items-center gap-1.5">
        <Circle className="w-3 h-3" /> Client has not acknowledged this issue — click to record acknowledgment
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input type="text" maxLength={4} value={initials} onChange={e => setInitials(e.target.value.toUpperCase())}
        placeholder="Initials" className="w-20 bg-slate-800 border border-slate-700 text-white text-xs text-center rounded-xl px-2 py-1.5 focus:outline-none focus:border-emerald-500 uppercase tracking-widest" />
      <button disabled={!initials.trim()} onClick={() => onAcknowledge(issue.id, initials.trim())}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl disabled:opacity-50 transition-colors">
        <CheckCheck className="w-3 h-3" /> Record Ack.
      </button>
      <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ─── Attorney Acceptance Modal (legacy — now replaced by IntakeAttorneyReviewModal) ─

function AttorneyAcceptanceModal({
  lead,
  existing,
  onClose,
  onSaved,
}: {
  lead: Lead;
  existing: Acceptance | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [decision, setDecision]           = useState<string>(existing?.decision ?? "accepted");
  const [caseType, setCaseType]           = useState<string>(existing?.case_type ?? "ch7_regular");
  const [attFee, setAttFee]               = useState<string>(String(existing?.attorney_fee ?? ATTORNEY_FEES["ch7_regular"]));
  const [filingFee, setFilingFee]         = useState<string>(String(existing?.court_filing_fee ?? CHAPTER_FILING_FEES["ch7_regular"]));
  const [downPayment, setDownPayment]     = useState<string>(String(existing?.down_payment ?? 500));
  const [planMonths, setPlanMonths]       = useState<string>(String(existing?.plan_months ?? 4));
  const [upfront13, setUpfront13]         = useState<string>(String(existing?.ch13_upfront_amount ?? 1500));
  const [plan13, setPlan13]               = useState<string>(String(existing?.ch13_plan_portion ?? 2500));
  const [limitedDesc, setLimitedDesc]     = useState<string>(existing?.limited_scope_desc ?? "");
  const [decisionNotes, setDecisionNotes] = useState<string>(existing?.decision_notes ?? "");
  const [saving, setSaving]               = useState(false);

  const ctConfig = CASE_TYPES.find(c => c.value === caseType);
  const totalFee = caseType === "ch13_flat_fee"
    ? parseFloat(attFee || "0") + 313
    : caseType === "ch7_bifurcated"
      ? parseFloat(attFee || "0")
      : parseFloat(attFee || "0") + (decision === "accepted" && caseType !== "limited_scope" ? parseFloat(filingFee || "0") : 0);

  function handleCaseTypeChange(ct: string) {
    setCaseType(ct);
    setAttFee(String(ATTORNEY_FEES[ct] ?? 0));
    setFilingFee(String(CHAPTER_FILING_FEES[ct] ?? 0));
  }

  async function save() {
    setSaving(true);
    const chapter = caseType.startsWith("ch7") ? 7 : caseType === "ch13_flat_fee" ? 13 : null;
    const filingHandling = caseType === "ch7_regular" ? "separate_prepaid" : caseType === "ch7_bifurcated" ? "rolled_in" : caseType === "ch13_flat_fee" ? "ch13_standard" : "none";
    const body = {
      lead_id: lead.id,
      submission_id: lead.submission_id ?? null,
      attorney_name: "James Thompson",
      decision,
      case_type: decision === "accepted" ? caseType : null,
      chapter: decision === "accepted" ? chapter : null,
      attorney_fee: decision === "accepted" ? parseFloat(attFee) || null : null,
      court_filing_fee: decision === "accepted" && caseType !== "limited_scope" ? parseFloat(filingFee) || null : null,
      total_fee: decision === "accepted" ? totalFee : null,
      down_payment: decision === "accepted" && caseType !== "ch13_flat_fee" ? parseFloat(downPayment) || null : null,
      plan_months: decision === "accepted" && caseType !== "ch13_flat_fee" && caseType !== "limited_scope" ? parseInt(planMonths) || null : null,
      filing_fee_handling: decision === "accepted" ? filingHandling : null,
      limited_scope_desc: caseType === "limited_scope" ? limitedDesc : null,
      ch13_upfront_amount: caseType === "ch13_flat_fee" ? parseFloat(upfront13) || null : null,
      ch13_plan_portion: caseType === "ch13_flat_fee" ? parseFloat(plan13) || null : null,
      decision_notes: decisionNotes || null,
      decided_at: new Date().toISOString(),
    };
    if (existing) {
      await sbPatch("attorney_case_acceptances", existing.id, body);
    } else {
      await sbPost("attorney_case_acceptances", body);
    }
    // Update lead status
    await sbPatch("intake_leads", lead.id, {
      status: decision === "accepted" ? "attorney_accepted" : decision === "declined" ? "declined" : "sent_for_attorney_review",
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-start justify-between gap-4 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Scale className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Attorney Review</span>
            </div>
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Georgia', serif" }}>{lead.full_name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {lead.chapter_interest ? `Ch. ${lead.chapter_interest} interest` : "Chapter undetermined"} · {lead.state ?? "State TBD"}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors mt-1 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Lead summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Est. Total Debt",   val: fmt(lead.debt_estimate) },
              { label: "Est. Monthly Income", val: lead.income_estimate ? fmt(lead.income_estimate) : "—" },
              { label: "State",             val: lead.state ?? "—" },
              { label: "Chapter Interest",  val: lead.chapter_interest ? `Ch. ${lead.chapter_interest}` : "Undecided" },
            ].map(item => (
              <div key={item.label} className="bg-slate-800/40 rounded-xl p-3 text-center">
                <p className="text-[10px] text-slate-500">{item.label}</p>
                <p className="text-sm font-bold text-white mt-0.5">{item.val}</p>
              </div>
            ))}
          </div>

          {lead.pre_screen_notes && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Pre-Screen Notes</p>
              <p className="text-xs text-slate-300 leading-relaxed">{lead.pre_screen_notes}</p>
            </div>
          )}

          {/* Decision */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Attorney Decision</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "accepted", label: "Accept Case", color: "emerald" },
                { value: "needs_more_info", label: "Need More Info", color: "amber" },
                { value: "declined", label: "Decline", color: "red" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDecision(opt.value)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                    decision === opt.value
                      ? opt.color === "emerald" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      : opt.color === "amber"   ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                      : "bg-red-500/20 border-red-500/40 text-red-300"
                    : "bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-500"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {decision === "accepted" && (
            <>
              {/* Case type selection */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Case Type</p>
                <div className="space-y-2">
                  {CASE_TYPES.map(ct => (
                    <button
                      key={ct.value}
                      onClick={() => handleCaseTypeChange(ct.value)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                        caseType === ct.value
                          ? "bg-amber-500/10 border-amber-500/30 text-white"
                          : "bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{ct.label}</p>
                        {caseType === ct.value && <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{ct.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fee structure */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Fee Structure</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Attorney Fee</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                      <input
                        type="number"
                        value={attFee}
                        onChange={e => setAttFee(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                  </div>

                  {caseType !== "limited_scope" && caseType !== "ch7_bifurcated" && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                        Court Filing Fee
                        {caseType === "ch7_regular" && <span className="ml-1 text-orange-400 normal-case font-normal">(paid separate, before signing)</span>}
                        {caseType === "ch13_flat_fee" && <span className="ml-1 text-sky-400 normal-case font-normal">($313 — before filing)</span>}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                        <input
                          type="number"
                          value={filingFee}
                          onChange={e => setFilingFee(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  {caseType === "ch7_bifurcated" && (
                    <div className="flex items-center gap-2 bg-sky-500/8 border border-sky-500/20 rounded-xl px-3 py-2.5">
                      <Info className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                      <p className="text-xs text-sky-200/80">Filing fee of $338 rolled into attorney fee for bifurcated cases.</p>
                    </div>
                  )}

                  {(caseType === "ch7_regular" || caseType === "ch7_bifurcated") && (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Down Payment</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                          <input
                            type="number"
                            value={downPayment}
                            onChange={e => setDownPayment(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:border-amber-500 transition-colors"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Payment Plan (months)</label>
                        <input
                          type="number"
                          value={planMonths}
                          onChange={e => setPlanMonths(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>
                    </>
                  )}

                  {caseType === "ch13_flat_fee" && (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Upfront Amount (before plan)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                          <input
                            type="number"
                            value={upfront13}
                            onChange={e => setUpfront13(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:border-amber-500 transition-colors"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Remaining Through Plan</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                          <input
                            type="number"
                            value={plan13}
                            onChange={e => setPlan13(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:border-amber-500 transition-colors"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Total fee summary */}
                <div className="mt-3 bg-slate-800/30 border border-slate-700/50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Total Fee Estimate</span>
                  <span className="text-lg font-bold text-white">{fmt(totalFee)}</span>
                </div>

                {/* Filing fee note */}
                {ctConfig && (
                  <div className="mt-2 flex items-start gap-2 bg-amber-500/6 border border-amber-500/15 rounded-xl px-3 py-2.5">
                    <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200/70 leading-relaxed">{ctConfig.sub}</p>
                  </div>
                )}
              </div>

              {caseType === "limited_scope" && (
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Scope of Services Description</label>
                  <textarea
                    rows={3}
                    value={limitedDesc}
                    onChange={e => setLimitedDesc(e.target.value)}
                    placeholder="e.g. Debt negotiation with Capital One and Synchrony Bank. Does not include bankruptcy filing."
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none transition-colors"
                  />
                </div>
              )}
            </>
          )}

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
              {decision === "accepted" ? "Acceptance Notes (optional)" : decision === "declined" ? "Reason for Declination" : "Additional Info Needed"}
            </label>
            <textarea
              rows={3}
              value={decisionNotes}
              onChange={e => setDecisionNotes(e.target.value)}
              placeholder={
                decision === "accepted" ? "Any special instructions or notes for the paralegal…"
                : decision === "declined" ? "Reason for declining (asset issues, income too high, etc.)…"
                : "Specify what additional information is needed before a decision can be made…"
              }
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none transition-colors"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-all">Cancel</button>
          <button
            disabled={saving}
            onClick={save}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-white rounded-xl transition-all ${
              decision === "accepted" ? "bg-emerald-600 hover:bg-emerald-500"
              : decision === "declined" ? "bg-red-700 hover:bg-red-600"
              : "bg-amber-600 hover:bg-amber-500"
            } disabled:opacity-50`}
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {decision === "accepted" ? "Accept & Record" : decision === "declined" ? "Record Declination" : "Request More Info"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Lead Modal ───────────────────────────────────────────────────────────

function NewLeadModal({ onClose, onSaved, session }: { onClose: () => void; onSaved: () => void; session: PortalSession }) {
  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [email, setEmail]     = useState("");
  const [source, setSource]   = useState("inbound");
  const [chapter, setChapter] = useState<string>("7");
  const [state, setState]     = useState("IL");
  const [urgency, setUrgency] = useState("normal");
  const [preferred, setPreferred] = useState("phone");
  const [debtEst, setDebtEst] = useState("");
  const [incomeEst, setIncomeEst] = useState("");
  const [notes, setNotes]     = useState("");
  const [aiSchedule, setAiSchedule] = useState(false);
  const [saving, setSaving]   = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    await sbPost("intake_leads", {
      full_name: name.trim(),
      phone: phone || null,
      email: email || null,
      source,
      chapter_interest: chapter ? parseInt(chapter) : null,
      state: state || null,
      status: aiSchedule ? "consultation_scheduled" : "new",
      urgency,
      preferred_contact: preferred,
      debt_estimate: debtEst ? parseFloat(debtEst) : null,
      income_estimate: incomeEst ? parseFloat(incomeEst) : null,
      notes: notes || null,
      ai_scheduled: aiSchedule,
      assigned_name: session.name,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">Add New Lead</p>
            <p className="text-xs text-slate-500 mt-0.5">Create a new potential client record</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Full Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="First Last"
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors placeholder-slate-600"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(312) 555-0000"
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors placeholder-slate-600" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com"
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors placeholder-slate-600" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Source</label>
              <select value={source} onChange={e => setSource(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors">
                <option value="inbound">Inbound Call / Walk-In</option>
                <option value="referral">Referral</option>
                <option value="ad">Online Ad</option>
                <option value="website">Website Form</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Chapter Interest</label>
              <select value={chapter} onChange={e => setChapter(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors">
                <option value="">Undecided</option>
                <option value="7">Chapter 7</option>
                <option value="13">Chapter 13</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">State</label>
              <select value={state} onChange={e => setState(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors">
                {["AZ","CA","CO","FL","GA","IL","MI","NV","NM","NY","OH","TX","WA"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Urgency</label>
              <select value={urgency} onChange={e => setUrgency(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors">
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Preferred Contact</label>
              <select value={preferred} onChange={e => setPreferred(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors">
                <option value="phone">Phone Call</option>
                <option value="email">Email</option>
                <option value="text">Text / SMS</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Est. Total Debt ($)</label>
              <input type="number" value={debtEst} onChange={e => setDebtEst(e.target.value)} placeholder="e.g. 45000"
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors placeholder-slate-600" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Est. Monthly Income ($)</label>
              <input type="number" value={incomeEst} onChange={e => setIncomeEst(e.target.value)} placeholder="e.g. 3200"
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors placeholder-slate-600" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Initial Notes</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Brief description of situation, reason for contact…"
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-sky-500 resize-none transition-colors" />
          </div>

          <label className="flex items-center gap-3 cursor-pointer bg-slate-800/40 border border-slate-700 rounded-xl px-4 py-3">
            <div className={`w-10 h-5 rounded-full transition-colors flex items-center ${aiSchedule ? "bg-sky-500" : "bg-slate-700"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${aiSchedule ? "translate-x-5" : "translate-x-0"}`} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-sky-400" /> AI-Schedule Consultation
              </p>
              <p className="text-[10px] text-slate-500">Let the AI bot find and book the next available slot</p>
            </div>
            <input type="checkbox" className="sr-only" checked={aiSchedule} onChange={e => setAiSchedule(e.target.checked)} />
          </label>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-all">Cancel</button>
          <button
            disabled={!name.trim() || saving}
            onClick={save}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-xl transition-all"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Create Lead
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Lead Detail Panel ────────────────────────────────────────────────────────

function LeadDetailPanel({
  lead,
  acceptance,
  session,
  onBack,
  onRefresh,
  onLaunchPresentation,
}: {
  lead: Lead;
  acceptance: Acceptance | null;
  session: PortalSession;
  onBack: () => void;
  onRefresh: () => void;
  onLaunchPresentation: (lead: Lead, acceptance: Acceptance) => void;
}) {
  const panelRole    = session.role;
  const panelIsAtty  = isAttorney(panelRole);
  const panelIsSuperAdmin = isSuperAdminRole(panelRole);
  const canDoIntake  = !panelIsAtty || panelIsSuperAdmin;  // legal_admin, super_admin, attorney_super_admin
  const canReview    = panelIsAtty || panelIsSuperAdmin;   // attorneys + super admins
  const [showAcceptanceModal, setShowAcceptanceModal]   = useState(false);
  const [showConsult, setShowConsult]                   = useState(false);
  const [showSchedule, setShowSchedule]                 = useState(false);
  const [showLogContact, setShowLogContact]             = useState(false);
  const [markingFeeQuoted, setMarkingFeeQuoted]         = useState(false);
  const [markingRetained, setMarkingRetained]           = useState(false);
  const [markingNoCase, setMarkingNoCase]               = useState(false);
  const [editingNotes, setEditingNotes]                 = useState(false);
  const [preScreenNotes, setPreScreenNotes]             = useState(lead.pre_screen_notes ?? "");
  const [savingNotes, setSavingNotes]                   = useState(false);
  const [sendingForReview, setSendingForReview]         = useState(false);
  const [markingIntake, setMarkingIntake]               = useState(false);
  const [submission, setSubmission]                     = useState<Record<string, unknown> | null>(null);
  const [submissionExpanded, setSubmissionExpanded]     = useState(false);
  const [contactLog, setContactLog]                     = useState<ContactLogEntry[]>([]);
  const [contactLogExpanded, setContactLogExpanded]     = useState(true);

  // Load intake submission linked to this lead
  useEffect(() => {
    async function loadSubmission() {
      // Try by submission_id first, then by lead_id
      if (lead.submission_id) {
        const rows = await sbGet<Record<string, unknown>>(`intake_submissions?id=eq.${lead.submission_id}&limit=1`);
        if (rows[0]) { setSubmission(rows[0]); return; }
      }
      const rows = await sbGet<Record<string, unknown>>(`intake_submissions?lead_id=eq.${lead.id}&order=submitted_at.desc&limit=1`);
      if (rows[0]) setSubmission(rows[0]);
    }
    loadSubmission();
  }, [lead.id, lead.submission_id]);

  function loadContactLog() {
    sbGet<ContactLogEntry>(`intake_contact_log?lead_id=eq.${lead.id}&order=contacted_at.desc&limit=50`)
      .then(rows => setContactLog(rows));
  }
  useEffect(() => { loadContactLog(); }, [lead.id]);

  const sc = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG["new"];
  const uc = URGENCY_CONFIG[lead.urgency ?? "normal"] ?? URGENCY_CONFIG["normal"];

  async function savePreScreenNotes() {
    setSavingNotes(true);
    await sbPatch("intake_leads", lead.id, { pre_screen_notes: preScreenNotes });
    setSavingNotes(false);
    setEditingNotes(false);
    onRefresh();
  }

  async function markIntakeCompleteAndSendForReview() {
    setMarkingIntake(true);
    await sbPatch("intake_leads", lead.id, {
      intake_completed: true,
      status: "sent_for_attorney_review",
      sent_for_review: true,
      sent_for_review_at: new Date().toISOString(),
    });
    setMarkingIntake(false);
    onRefresh();
  }

  async function markFeeQuoted() {
    setMarkingFeeQuoted(true);
    await sbPatch("intake_leads", lead.id, { status: "fee_quoted" });
    setMarkingFeeQuoted(false);
    onRefresh();
  }

  async function markRetained() {
    setMarkingRetained(true);
    await sbPatch("intake_leads", lead.id, { status: "retained", retained_at: new Date().toISOString() });
    setMarkingRetained(false);
    onRefresh();
  }

  async function markNoCase() {
    setMarkingNoCase(true);
    await sbPatch("intake_leads", lead.id, { status: "no_case" });
    setMarkingNoCase(false);
    onRefresh();
  }

  async function sendForAttorneyReview() {
    setSendingForReview(true);
    await sbPatch("intake_leads", lead.id, {
      status: "sent_for_attorney_review",
      sent_for_review: true,
      sent_for_review_at: new Date().toISOString(),
    });
    setSendingForReview(false);
    onRefresh();
  }

  return (
    <div className="space-y-5">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> All Leads
      </button>

      {/* Header card */}
      <div className="bg-[#0d1221] border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-700/60 flex items-center justify-center flex-shrink-0 text-lg font-bold text-slate-300">
            {lead.full_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-white">{lead.full_name}</h2>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${sc.color} ${sc.bg}`}>{sc.label}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${uc.color} ${uc.bg}`}>{uc.label}</span>
              {lead.ai_scheduled && (
                <span className="flex items-center gap-1 text-xs font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-lg">
                  <Bot className="w-3 h-3" /> AI Scheduled
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500 mt-1">
              {lead.phone && <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{lead.phone}</span>}
              {lead.email && <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{lead.email}</span>}
              {lead.state && <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />{lead.state}</span>}
              {lead.chapter_interest && <span className="flex items-center gap-1.5"><Scale className="w-3 h-3" />Ch. {lead.chapter_interest} interest</span>}
              <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" />Added {fmtDate(lead.created_at)}</span>
            </div>
          </div>

          {/* Secondary actions — always available */}
          <div className="flex flex-wrap gap-2">
            {canDoIntake && !lead.intake_completed && (
              <button onClick={() => setShowSchedule(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/20 rounded-xl transition-colors">
                <Calendar className="w-3.5 h-3.5" /> Schedule Consult
              </button>
            )}
            {canReview && (
              <button onClick={() => setShowAcceptanceModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl transition-colors">
                <Scale className="w-3.5 h-3.5" />
                {acceptance ? "View Decision" : "Attorney Review"}
              </button>
            )}
            {!["retained","declined","no_case"].includes(lead.status) && (
              <button onClick={() => setShowLogContact(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-xl transition-colors">
                <PhoneCall className="w-3.5 h-3.5" /> Log Contact
              </button>
            )}
            {!["retained","declined","no_case"].includes(lead.status) && (canDoIntake || canReview) && (
              <button onClick={markNoCase} disabled={markingNoCase}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-slate-700/40 hover:bg-slate-700/60 text-slate-400 border border-slate-700/60 rounded-xl transition-colors">
                {markingNoCase ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                No Case
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {[
            { label: "Est. Total Debt",     val: fmt(lead.debt_estimate) },
            { label: "Est. Monthly Income", val: lead.income_estimate ? fmt(lead.income_estimate) : "—" },
            { label: "Preferred Contact",   val: lead.preferred_contact ? lead.preferred_contact.charAt(0).toUpperCase() + lead.preferred_contact.slice(1) : "—" },
            { label: "Source",              val: lead.source ? lead.source.charAt(0).toUpperCase() + lead.source.slice(1) : "—" },
          ].map(item => (
            <div key={item.label} className="bg-slate-800/40 rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-500">{item.label}</p>
              <p className="text-sm font-bold text-white mt-0.5">{item.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Retention-Priority Action Banner ─────────────────────────────── */}
      {lead.status !== "retained" && lead.status !== "declined" && lead.status !== "no_case" && (() => {
        // Determine the single most important next action for this lead
        type ActionStage = {
          icon: React.ReactNode;
          title: string;
          desc: string;
          cta: React.ReactNode;
          accent: string;
          bg: string;
          border: string;
        };

        let stage: ActionStage | null = null;

        // Stage 1 — No contact yet: call/schedule immediately
        if (!lead.intake_completed && (lead.status === "new" || lead.status === "contacted") && canDoIntake) {
          stage = {
            icon: <PhoneCall className="w-5 h-5 text-red-400" />,
            title: "Action Required — Contact This Lead",
            desc: "New lead hasn't been scheduled yet. Call now or schedule a consultation to keep them moving.",
            accent: "text-red-400",
            bg: "bg-red-500/5",
            border: "border-red-500/25",
            cta: (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowConsult(true)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-red-500 hover:bg-red-400 text-white rounded-xl transition-colors shadow-lg shadow-red-500/20">
                  <Mic className="w-4 h-4" /> Start Intake Now
                </button>
                <button onClick={() => setShowSchedule(true)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors">
                  <Calendar className="w-4 h-4" /> Schedule Consult
                </button>
                <button onClick={() => setShowLogContact(true)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors">
                  <PhoneCall className="w-4 h-4" /> Log Contact Attempt
                </button>
              </div>
            ),
          };
        }

        // Stage 2 — Appointment set: run intake after consult
        else if (!lead.intake_completed && lead.status === "consultation_scheduled" && canDoIntake) {
          stage = {
            icon: <Mic className="w-5 h-5 text-amber-400" />,
            title: "Consultation Scheduled — Complete Intake",
            desc: "Appointment is on the books. After the consult, complete intake and send directly to attorney for review.",
            accent: "text-amber-400",
            bg: "bg-amber-500/5",
            border: "border-amber-500/25",
            cta: (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowConsult(true)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-white rounded-xl transition-colors shadow-lg shadow-amber-500/20">
                  <Mic className="w-4 h-4" /> Complete Intake
                </button>
                <button onClick={markIntakeCompleteAndSendForReview} disabled={markingIntake}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors">
                  {markingIntake ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Intake Complete → Send for Review
                </button>
              </div>
            ),
          };
        }

        // Stage 3 — Intake in progress / not yet sent for review
        else if (!lead.intake_completed && canDoIntake) {
          stage = {
            icon: <CheckCheck className="w-5 h-5 text-blue-400" />,
            title: "Complete Intake & Send for Attorney Review",
            desc: "Finish the intake process and route to the attorney in one step to reduce delays.",
            accent: "text-blue-400",
            bg: "bg-blue-500/5",
            border: "border-blue-500/25",
            cta: (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowConsult(true)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-blue-500 hover:bg-blue-400 text-white rounded-xl transition-colors shadow-lg shadow-blue-500/20">
                  <Mic className="w-4 h-4" /> Complete Intake
                </button>
                <button onClick={markIntakeCompleteAndSendForReview} disabled={markingIntake}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors">
                  {markingIntake ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Mark Complete & Send for Review
                </button>
              </div>
            ),
          };
        }

        // Stage 4 — Intake done, not yet sent for attorney review
        else if (lead.intake_completed && !lead.sent_for_review && canDoIntake) {
          stage = {
            icon: <Send className="w-5 h-5 text-amber-400" />,
            title: "Send to Attorney for Review",
            desc: "Intake is complete. Route to attorney now — every hour waiting reduces retention odds.",
            accent: "text-amber-400",
            bg: "bg-amber-500/5",
            border: "border-amber-500/25",
            cta: (
              <button onClick={sendForAttorneyReview} disabled={sendingForReview}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-white rounded-xl transition-colors shadow-lg shadow-amber-500/20">
                {sendingForReview ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send for Attorney Review
              </button>
            ),
          };
        }

        // Stage 5 — Pending attorney review (attorney sees this)
        else if (lead.status === "sent_for_attorney_review" && canReview) {
          stage = {
            icon: <Scale className="w-5 h-5 text-amber-300" />,
            title: "Your Review Needed — Accept or Decline",
            desc: "This lead is waiting on your decision. Review the intake, make a determination, and set fees so the client can be presented options today.",
            accent: "text-amber-300",
            bg: "bg-amber-500/5",
            border: "border-amber-500/25",
            cta: (
              <button onClick={() => setShowAcceptanceModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-white rounded-xl transition-colors shadow-lg shadow-amber-500/20">
                <Scale className="w-4 h-4" /> {acceptance ? "Update Decision" : "Record Decision & Set Fees"}
              </button>
            ),
          };
        }

        // Stage 6 — Attorney accepted, present to client
        else if (lead.status === "attorney_accepted" && (canDoIntake || canReview)) {
          stage = {
            icon: <DollarSign className="w-5 h-5 text-emerald-400" />,
            title: "Present Fees to Client",
            desc: "Case accepted. Launch the guided presentation to walk the client through their options, fees, and payment plan.",
            accent: "text-emerald-400",
            bg: "bg-emerald-500/5",
            border: "border-emerald-500/25",
            cta: (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => acceptance && onLaunchPresentation(lead, acceptance)}
                  disabled={!acceptance}
                  title={!acceptance ? "No accepted case record found" : undefined}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Play className="w-4 h-4" /> Launch Case Presentation
                </button>
                {canReview && (
                  <button onClick={markFeeQuoted} disabled={markingFeeQuoted}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors">
                    {markingFeeQuoted ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                    Mark Fee Quoted
                  </button>
                )}
                <button onClick={() => setShowLogContact(true)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors">
                  <PhoneCall className="w-4 h-4" /> Log Contact
                </button>
              </div>
            ),
          };
        }

        // Stage 7 — Fee quoted, close the deal
        else if (lead.status === "fee_quoted") {
          stage = {
            icon: <UserCheck className="w-5 h-5 text-green-400" />,
            title: "Close — Mark as Retained",
            desc: "Fee has been quoted. Follow up and get commitment. Mark retained when the client signs on.",
            accent: "text-green-400",
            bg: "bg-green-500/5",
            border: "border-green-500/25",
            cta: (
              <div className="flex flex-wrap gap-2">
                {canReview && (
                  <button onClick={markRetained} disabled={markingRetained}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-green-500 hover:bg-green-400 text-white rounded-xl transition-colors shadow-lg shadow-green-500/20">
                    {markingRetained ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                    Mark Retained
                  </button>
                )}
                <button onClick={() => setShowLogContact(true)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors">
                  <PhoneCall className="w-4 h-4" /> Log Follow-Up
                </button>
              </div>
            ),
          };
        }

        if (!stage) return null;

        return (
          <div className={`rounded-2xl border p-5 ${stage.bg} ${stage.border}`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl bg-slate-900/60 flex items-center justify-center flex-shrink-0 mt-0.5`}>
                {stage.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold mb-0.5 ${stage.accent}`}>{stage.title}</p>
                <p className="text-xs text-slate-400 mb-4">{stage.desc}</p>
                {stage.cta}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Intake workflow checklist */}
      <div className="bg-[#0d1221] border border-slate-800 rounded-2xl p-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Intake Workflow</p>
        <div className="space-y-2">
          {[
            {
              label: "Lead received — initial contact",
              done: true,
              active: false,
            },
            {
              label: "Consultation scheduled",
              done: ["consultation_scheduled","consultation_complete","intake_in_progress","intake_complete","sent_for_attorney_review","attorney_accepted","fee_quoted","retained"].includes(lead.status),
              active: lead.status === "new" || lead.status === "contacted",
            },
            {
              label: "Intake complete — sent for attorney review",
              done: !!lead.sent_for_review || !!lead.intake_completed,
              active: lead.status === "consultation_scheduled",
            },
            {
              label: "Attorney reviewed — fees set",
              done: !!acceptance && acceptance.decision !== "pending",
              active: lead.status === "sent_for_attorney_review",
            },
            {
              label: "Fee quoted to client",
              done: ["fee_quoted","retained"].includes(lead.status),
              active: lead.status === "attorney_accepted",
            },
            {
              label: "Client retained",
              done: lead.status === "retained",
              active: lead.status === "fee_quoted",
            },
          ].map((step, i) => (
            <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${step.active ? "bg-slate-800/60 border border-slate-700/60" : ""}`}>
              {step.done
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                : step.active
                  ? <div className="w-4 h-4 rounded-full border-2 border-amber-400 flex-shrink-0 animate-pulse" />
                  : <Circle className="w-4 h-4 text-slate-700 flex-shrink-0" />}
              <span className={`text-sm font-medium ${step.done ? "text-slate-300" : step.active ? "text-amber-300" : "text-slate-600"}`}>{step.label}</span>
              {step.active && <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 ml-auto">Next Action</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Attorney acceptance summary */}
      {acceptance && acceptance.decision !== "pending" && (
        <div className={`border rounded-2xl p-5 ${acceptance.decision === "accepted" ? "bg-emerald-500/5 border-emerald-500/20" : acceptance.decision === "declined" ? "bg-red-500/5 border-red-500/20" : "bg-amber-500/5 border-amber-500/20"}`}>
          <div className="flex items-center gap-2 mb-3">
            <Scale className={`w-4 h-4 ${acceptance.decision === "accepted" ? "text-emerald-400" : acceptance.decision === "declined" ? "text-red-400" : "text-amber-400"}`} />
            <p className={`text-sm font-bold ${acceptance.decision === "accepted" ? "text-emerald-300" : acceptance.decision === "declined" ? "text-red-300" : "text-amber-300"}`}>
              Attorney {acceptance.decision === "accepted" ? "Accepted — Ready to Present" : acceptance.decision === "declined" ? "Declined — No Case" : "Requested More Info"}
            </p>
            <span className="text-xs text-slate-500 ml-auto">{fmtDateTime(acceptance.decided_at)}</span>
          </div>
          {acceptance.decision === "accepted" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {[
                { label: "Case Type", val: CASE_TYPES.find(c => c.value === acceptance.case_type)?.label ?? acceptance.case_type ?? "—" },
                { label: "Attorney Fee", val: fmt(acceptance.attorney_fee) },
                { label: "Total Fee", val: fmt(acceptance.total_fee) },
                acceptance.court_filing_fee ? { label: "Filing Fee", val: fmt(acceptance.court_filing_fee) } : null,
                acceptance.down_payment ? { label: "Down Payment", val: fmt(acceptance.down_payment) } : null,
                acceptance.plan_months ? { label: "Plan", val: `${acceptance.plan_months} months` } : null,
              ].filter(Boolean).map(item => (
                <div key={item!.label} className="bg-slate-800/40 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-slate-500">{item!.label}</p>
                  <p className="text-sm font-semibold text-white mt-0.5">{item!.val}</p>
                </div>
              ))}
            </div>
          )}
          {acceptance.limited_scope_desc && (
            <p className="text-xs text-slate-300 bg-slate-800/40 rounded-xl px-3 py-2 mb-2">{acceptance.limited_scope_desc}</p>
          )}
          {acceptance.decision_notes && (
            <p className="text-xs text-slate-400 leading-relaxed">{acceptance.decision_notes}</p>
          )}
          <button
            onClick={() => setShowAcceptanceModal(true)}
            className="mt-3 text-xs font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <Edit3 className="w-3 h-3" /> Edit Decision
          </button>
        </div>
      )}

      {/* Pre-screen notes */}
      <div className="bg-[#0d1221] border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pre-Screen Notes</p>
          {!editingNotes && (
            <button onClick={() => setEditingNotes(true)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors">
              <PenLine className="w-3 h-3" /> Edit
            </button>
          )}
        </div>
        {editingNotes ? (
          <div>
            <textarea
              rows={5}
              value={preScreenNotes}
              onChange={e => setPreScreenNotes(e.target.value)}
              placeholder="Document client situation, urgency, key debts, income flags, prior bankruptcy, pending lawsuits, etc."
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-sky-500 resize-none transition-colors mb-3"
            />
            <div className="flex gap-2">
              <button onClick={() => { setEditingNotes(false); setPreScreenNotes(lead.pre_screen_notes ?? ""); }} className="flex-1 py-2 text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-all">Cancel</button>
              <button
                disabled={savingNotes}
                onClick={savePreScreenNotes}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-xl transition-all"
              >
                {savingNotes ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save Notes
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 leading-relaxed">
            {lead.pre_screen_notes || <span className="text-slate-600 italic">No pre-screen notes yet. Click Edit to add notes.</span>}
          </p>
        )}
      </div>

      {/* Contact Log Timeline */}
      <div className="bg-[#0d1221] border border-slate-800 rounded-2xl overflow-hidden">
        <button
          onClick={() => setContactLogExpanded(x => !x)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
              <ListChecks className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-sky-400 uppercase tracking-widest">Contact History</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{contactLog.length} contact{contactLog.length !== 1 ? "s" : ""} logged</p>
            </div>
            {lead.follow_up_queue === "priority" && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/25 rounded-full px-2 py-0.5">
                <BellRing className="w-2.5 h-2.5" /> Priority Queue
              </span>
            )}
            {lead.follow_up_queue === "normal" && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 bg-slate-700/30 border border-slate-700 rounded-full px-2 py-0.5">
                <Bot className="w-2.5 h-2.5" /> Bot Queue
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={e => { e.stopPropagation(); setShowLogContact(true); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg transition-colors"
            >
              <Plus className="w-3 h-3" /> Log Contact
            </button>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${contactLogExpanded ? "rotate-180" : ""}`} />
          </div>
        </button>

        {contactLogExpanded && (
          <div className="border-t border-slate-800/60">
            {contactLog.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <PhoneCall className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-600">No contacts logged yet</p>
                <button onClick={() => setShowLogContact(true)}
                  className="mt-3 text-xs text-sky-400 hover:text-sky-300 font-semibold transition-colors">
                  Log first contact
                </button>
              </div>
            ) : (
              <div className="px-5 py-4 space-y-1">
                {contactLog.map((entry, i) => {
                  const ch = CHANNEL_CFG[entry.channel] ?? CHANNEL_CFG.phone;
                  const oc = OUTCOME_CFG[entry.outcome] ?? OUTCOME_CFG.other;
                  const ChIcon = ch.icon;
                  const OcIcon = oc.icon;
                  const isLast = i === contactLog.length - 1;
                  return (
                    <div key={entry.id} className="relative flex gap-3">
                      {/* Timeline line */}
                      {!isLast && <div className="absolute left-3.5 top-8 bottom-0 w-px bg-slate-800" />}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${ch.bg} border ${ch.border}`}>
                        <ChIcon className={`w-3 h-3 ${ch.color}`} />
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs font-bold ${ch.color}`}>{ch.label}</span>
                              <span className="text-slate-600 text-xs">·</span>
                              <span className={`flex items-center gap-1 text-[11px] font-semibold ${oc.color}`}>
                                <OcIcon className="w-2.5 h-2.5" /> {oc.label}
                              </span>
                              {entry.is_bot && (
                                <span className="text-[9px] font-bold text-slate-500 bg-slate-700/40 border border-slate-700 rounded px-1 py-0.5">BOT</span>
                              )}
                              {entry.direction === "inbound" && (
                                <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded px-1 py-0.5">INBOUND</span>
                              )}
                            </div>
                            {entry.notes && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{entry.notes}</p>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[10px] text-slate-600">
                              {new Date(entry.contacted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                            <p className="text-[10px] text-slate-700">{entry.contacted_by}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Initial notes */}
      {lead.notes && (
        <div className="bg-[#0d1221] border border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Initial Notes</p>
          <p className="text-sm text-slate-400 leading-relaxed">{lead.notes}</p>
        </div>
      )}

      {/* Intake submission results */}
      {submission && (
        <div className="bg-[#0d1221] border border-slate-800 rounded-2xl overflow-hidden">
          <button
            onClick={() => setSubmissionExpanded(x => !x)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Intake Form Submitted</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {submission.completed_by_staff ? "Completed by staff" : "Completed by client"} ·{" "}
                  {submission.submitted_at ? new Date(submission.submitted_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                </p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${submissionExpanded ? "rotate-180" : ""}`} />
          </button>

          {submissionExpanded && (
            <div className="px-5 pb-5 space-y-4 border-t border-slate-800/60">

              {/* Identity + Filing */}
              <div className="pt-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Identity & Filing</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  {[
                    ["Name", [submission.first_name, submission.middle_name, submission.last_name, submission.suffix].filter(Boolean).join(" ")],
                    ["Filing Type", (submission.filing_type as string)?.replace(/-/g, " ")],
                    ["DOB", submission.dob as string],
                    ["SSN Last 4", submission.ssn_last4 ? `••••${submission.ssn_last4}` : "—"],
                    ["Email", submission.email as string],
                    ["Phone", submission.phone as string],
                    ["State", submission.state as string],
                    ["City", submission.city as string],
                    ["Marital Status", submission.marital_status as string],
                    ["Dependents", String(submission.num_dependents ?? 0)],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex flex-col">
                      <span className="text-slate-600 text-[10px] uppercase tracking-wide">{label}</span>
                      <span className="text-slate-300 font-medium capitalize">{(val as string) || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Debts */}
              <div className="border-t border-slate-800/60 pt-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Debts</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  {[
                    ["Secured", submission.secured_debt],
                    ["Credit Cards", submission.credit_card_debt],
                    ["Medical", submission.medical_debt],
                    ["Student Loans", submission.student_loan_debt],
                    ["Tax Debt", submission.tax_debt],
                    ["Personal Loans", submission.personal_loan_debt],
                    ["Other Unsecured", submission.other_unsecured],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex flex-col">
                      <span className="text-slate-600 text-[10px] uppercase tracking-wide">{label}</span>
                      <span className="text-slate-300 font-medium">
                        {val ? `$${Number(val).toLocaleString()}` : "—"}
                      </span>
                    </div>
                  ))}
                  <div className="col-span-2 flex flex-col">
                    <span className="text-slate-600 text-[10px] uppercase tracking-wide">Primary Reason</span>
                    <span className="text-amber-400 font-semibold capitalize">{(submission.primary_reason as string)?.replace(/_/g, " ") || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Income & Expenses */}
              <div className="border-t border-slate-800/60 pt-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Income & Expenses</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  {[
                    ["Rent/Mortgage", submission.exp_rent_mortgage],
                    ["Utilities", submission.exp_utilities],
                    ["Food", submission.exp_food],
                    ["Transportation", submission.exp_transportation],
                    ["Healthcare", submission.exp_healthcare],
                    ["Insurance", submission.exp_insurance],
                    ["Childcare", submission.exp_childcare],
                    ["Other Expenses", submission.exp_other],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex flex-col">
                      <span className="text-slate-600 text-[10px] uppercase tracking-wide">{label}</span>
                      <span className="text-slate-300 font-medium">{val ? `$${Number(val).toLocaleString()}` : "—"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assets */}
              <div className="border-t border-slate-800/60 pt-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Assets</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  {[
                    ["Bank Balance", submission.bank_balance],
                    ["Retirement", submission.retirement_balance],
                    ["Household Goods", submission.household_goods_value],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex flex-col">
                      <span className="text-slate-600 text-[10px] uppercase tracking-wide">{label}</span>
                      <span className="text-slate-300 font-medium">{val ? `$${Number(val).toLocaleString()}` : "—"}</span>
                    </div>
                  ))}
                  <div className="flex flex-col">
                    <span className="text-slate-600 text-[10px] uppercase tracking-wide">Real Estate</span>
                    <span className="text-slate-300 font-medium">{submission.owns_real_estate ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-600 text-[10px] uppercase tracking-wide">Vehicles</span>
                    <span className="text-slate-300 font-medium">{submission.no_vehicles ? "None" : (submission.vehicles_json ? `${(submission.vehicles_json as unknown[]).length}` : "—")}</span>
                  </div>
                </div>
              </div>

              {/* History flags */}
              <div className="border-t border-slate-800/60 pt-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">History Flags</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Prior BK",          val: submission.has_prior_bk },
                    { label: "Pending Lawsuits",  val: submission.pending_lawsuits },
                    { label: "Garnishment",       val: submission.garnishment },
                    { label: "Transfers",         val: submission.has_transfers },
                    { label: "Pref. Payments",    val: submission.has_preferential_payments },
                    { label: "Owned Business",    val: submission.owned_business },
                    { label: "Tax Refund",        val: submission.expected_refund },
                    { label: "Recent Luxury",     val: submission.recent_luxury },
                  ].map(({ label, val }) => (
                    <span key={label} className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${
                      val ? "text-amber-400 bg-amber-500/10 border-amber-500/25" : "text-slate-600 bg-slate-800/40 border-slate-700/60"
                    }`}>
                      {val ? "⚠ " : ""}{label}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {showAcceptanceModal && (
        <IntakeAttorneyReviewModal
          lead={lead}
          submission={submission}
          onClose={() => setShowAcceptanceModal(false)}
          onSaved={() => { setShowAcceptanceModal(false); onRefresh(); }}
        />
      )}
      {showLogContact && (
        <LogContactModal
          lead={lead}
          onClose={() => setShowLogContact(false)}
          onSaved={() => { setShowLogContact(false); loadContactLog(); onRefresh(); }}
        />
      )}
      {showSchedule && (
        <ScheduleConsultModal
          lead={lead}
          onClose={() => setShowSchedule(false)}
          onSaved={() => { setShowSchedule(false); onRefresh(); }}
        />
      )}
      {showConsult && (
        <ConsultIntakeModal
          lead={lead}
          onClose={() => setShowConsult(false)}
          onSaved={() => { setShowConsult(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Types for calendar/availability ─────────────────────────────────────────

interface CalEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  client_name: string | null;
  phone: string | null;
  client_email: string | null;
  status: string;
  event_subtype: string | null;
  calendar_type: string;
  department: string | null;
  staff_id: string | null;
  lead_id: string | null;
  cal_notes: string | null;
  is_walk_in: boolean | null;
  ai_scheduled: boolean | null;
}

interface StaffAvailability {
  id: string;
  staff_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  max_consultations_per_day: number;
  min_gap_between_appts_min: number;
  preferred_gap_minutes: number;
  lunch_start: string;
  lunch_end: string;
  department: string | null;
}

interface TimeOff {
  id: string;
  staff_id: string | null;
  staff_name: string;
  date: string;
  time_off_type: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  reason_type: string;
  approved: boolean;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
}

interface SickOverride {
  id: string;
  staff_id: string;
  staff_name: string;
  date: string;
  reason: string;
  notes: string | null;
  marked_by: string;
  is_active: boolean;
  created_at: string;
}

// ─── Role System ─────────────────────────────────────────────────────────────

type PortalRole = "legal_admin" | "attorney" | "attorney_super_admin" | "super_admin";

interface PortalSession {
  id: string;
  name: string;
  role: PortalRole;
  title: string | null;
}

const ROLE_CONFIG: Record<PortalRole, {
  label: string;
  color: string;
  bg: string;
  border: string;
  description: string;
}> = {
  legal_admin: {
    label: "Legal Admin",
    color: "text-[#FAFAF7]",
    bg: "bg-[#2A2A28]",
    border: "border-[#3A3A36]",
    description: "Manages new leads, scheduling, intake & contact logging",
  },
  attorney: {
    label: "Attorney",
    color: "text-[#FAFAF7]",
    bg: "bg-[#2A2A28]",
    border: "border-[#3A3A36]",
    description: "Reviews cases, quotes fees & conducts welcome calls",
  },
  attorney_super_admin: {
    label: "Attorney / Super Admin",
    color: "text-[#FAFAF7]",
    bg: "bg-[#2A2A28]",
    border: "border-[#3A3A36]",
    description: "Full attorney access + staff management",
  },
  super_admin: {
    label: "Super Admin",
    color: "text-[#FAFAF7]",
    bg: "bg-[#2A2A28]",
    border: "border-[#3A3A36]",
    description: "Full portal access + staff management (non-attorney)",
  },
};

function isAttorney(role: PortalRole) {
  return role === "attorney" || role === "attorney_super_admin";
}
function isSuperAdminRole(role: PortalRole) {
  return role === "attorney_super_admin" || role === "super_admin";
}
function isLegalAdmin(role: PortalRole) {
  return role === "legal_admin";
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

interface StaffLoginRecord {
  id: string;
  name: string;
  intake_portal_role: PortalRole;
  intake_pin: string;
  title: string | null;
  is_active: boolean;
}

function PortalLogin({ onLogin }: { onLogin: (session: PortalSession) => void }) {
  const [staffList, setStaffList] = useState<StaffLoginRecord[]>([]);
  const [selected, setSelected]   = useState<StaffLoginRecord | null>(null);
  const [pin, setPin]             = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(true);
  const [checking, setChecking]   = useState(false);

  useEffect(() => {
    sbGet<StaffLoginRecord>("staff_members?is_active=eq.true&order=name.asc&select=id,name,intake_portal_role,intake_pin,title,is_active")
      .then(rows => {
        setStaffList(rows.filter(r => r.intake_portal_role != null));
        setLoading(false);
      });
  }, []);

  function handlePinDigit(digit: string) {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError("");
    if (next.length === 4) {
      setChecking(true);
      setTimeout(() => {
        if (selected && next === selected.intake_pin) {
          onLogin({
            id: selected.id,
            name: selected.name,
            role: selected.intake_portal_role,
            title: selected.title,
          });
        } else {
          setError("Incorrect PIN. Please try again.");
          setPin("");
          setChecking(false);
        }
      }, 400);
    }
  }

  function handleBackspace() {
    setPin(p => p.slice(0, -1));
    setError("");
  }

  const rc = selected ? ROLE_CONFIG[selected.intake_portal_role] : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0F0F0E' }}>
      <div className="w-full max-w-sm">
        {/* Logo — issue 3: bare icon, no container, Fraunces title */}
        <div className="mb-10" style={{ paddingLeft: '2px' }}>
          <Briefcase style={{ width: 24, height: 24, color: '#FAFAF7', strokeWidth: 1.5 }} />
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.1, color: '#FAFAF7', marginTop: 12 }}>
            Intake Portal
          </h1>
          <p style={{ fontSize: 13, color: '#6B6B66', marginTop: 4 }}>Majors Law Group</p>
          {/* Issue 6: antique gold prompt, 40px below title block */}
          {!selected && (
            <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B8945F', textAlign: 'center', marginTop: 40 }}>
              Select your name to continue
            </p>
          )}
        </div>

        {!selected ? (
          /* Staff selection — issue 2: list rows, no cards */
          <div>
            {loading ? (
              <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: '#6B6B66' }} /></div>
            ) : (
              <div>
                {staffList.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelected(s); setPin(""); setError(""); }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 0',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #2A2A28',
                      borderTop: idx === 0 ? '1px solid #2A2A28' : 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'border-left 150ms ease-out',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderLeft = '2px solid #1E3A2F'; (e.currentTarget as HTMLButtonElement).style.paddingLeft = '10px'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderLeft = 'none'; (e.currentTarget as HTMLButtonElement).style.paddingLeft = '0'; }}
                  >
                    {/* Issue 1: uniform avatar, no color variation */}
                    <div style={{ width: 36, height: 36, background: '#2A2A28', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, fontWeight: 500, color: '#FAFAF7' }}>
                        {s.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 15, fontWeight: 500, color: '#FAFAF7', lineHeight: 1.3 }}>{s.name}</p>
                      <p style={{ fontSize: 12, color: '#6B6B66', marginTop: 2 }}>{ROLE_CONFIG[s.intake_portal_role].label}</p>
                    </div>
                    <ChevronRight style={{ width: 16, height: 16, color: '#3A3A36', strokeWidth: 1.5 }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* PIN entry */
          <div className="space-y-6">
            <button onClick={() => { setSelected(null); setPin(""); setError(""); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B6B66', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <ArrowLeft style={{ width: 14, height: 14, strokeWidth: 1.5 }} /> Back
            </button>

            {/* Selected user row — same uniform avatar treatment */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderTop: '1px solid #2A2A28', borderBottom: '1px solid #2A2A28' }}>
              <div style={{ width: 36, height: 36, background: '#2A2A28', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, fontWeight: 500, color: '#FAFAF7' }}>
                  {selected.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 500, color: '#FAFAF7' }}>{selected.name}</p>
                <p style={{ fontSize: 12, color: '#6B6B66', marginTop: 2 }}>{rc!.label}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center mb-5">Enter your 4-digit PIN</p>
              {/* PIN dots */}
              <div className="flex justify-center gap-4 mb-6">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${
                    pin.length > i
                      ? checking ? "bg-emerald-400 border-emerald-400" : "bg-white border-white"
                      : "bg-transparent border-slate-600"
                  }`} />
                ))}
              </div>
              {error && (
                <p className="text-xs text-red-400 text-center mb-4 font-semibold">{error}</p>
              )}
              {/* Numpad */}
              <div className="grid grid-cols-3 gap-3">
                {["1","2","3","4","5","6","7","8","9","",  "0","⌫"].map((k, i) => (
                  k === "" ? <div key={i} /> :
                  <button key={i}
                    onClick={() => k === "⌫" ? handleBackspace() : handlePinDigit(k)}
                    disabled={checking}
                    className={`h-14 rounded-2xl text-lg font-bold transition-all ${
                      k === "⌫"
                        ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700"
                        : "bg-slate-800 text-white hover:bg-slate-700 active:bg-slate-600 border border-slate-700/60"
                    } disabled:opacity-40`}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-700 mt-8">Secure staff portal — authorized access only</p>
      </div>
    </div>
  );
}

// Staff list for super-admin panel — now loaded from DB, fallback for other uses
const ALL_STAFF = [
  { id: "11111111-0000-0000-0000-000000000005", name: "Sarah Kim",      role: "Attorney / Super Admin" },
  { id: "11111111-0000-0000-0000-000000000001", name: "Jennifer Smith", role: "Attorney" },
  { id: "11111111-0000-0000-0000-000000000004", name: "Carlos Vega",    role: "Super Admin" },
  { id: "11111111-0000-0000-0000-000000000002", name: "Marcus Rivera",  role: "Legal Admin" },
  { id: "11111111-0000-0000-0000-000000000003", name: "Tanya Brown",    role: "Legal Admin" },
];

// ─── I'm Sick Button ──────────────────────────────────────────────────────────

function IAmSickButton({ onMarked, session }: { onMarked: () => void; session: PortalSession }) {
  const [loading, setLoading]   = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [todaySick, setTodaySick]   = useState<SickOverride | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    sbGet<SickOverride>(
      `staff_sick_overrides?staff_id=eq.${session.id}&date=eq.${today}&is_active=eq.true`
    ).then(rows => setTodaySick(rows[0] ?? null));
  }, [today]);

  async function markSick() {
    setLoading(true);
    await sbPost("staff_sick_overrides", {
      staff_id:  session.id,
      staff_name: session.name,
      date:      today,
      reason:    "sick",
      marked_by: "self",
      is_active: true,
    });
    // Also add to intake_staff_time_off so calendar blocks automatically
    await sbPost("intake_staff_time_off", {
      staff_id:      session.id,
      staff_name:    session.name,
      date:          today,
      time_off_type: "full_day",
      reason_type:   "sick",
      reason:        "Sick day — marked via I'm Sick button",
      approved:      true,
    });
    const rows = await sbGet<SickOverride>(
      `staff_sick_overrides?staff_id=eq.${session.id}&date=eq.${today}&is_active=eq.true`
    );
    setTodaySick(rows[0] ?? null);
    setLoading(false);
    setConfirming(false);
    onMarked();
  }

  async function cancelSick() {
    if (!todaySick) return;
    setLoading(true);
    await fetch(`${SUPABASE_URL}/rest/v1/staff_sick_overrides?id=eq.${todaySick.id}`, {
      method: "PATCH",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ is_active: false }),
    });
    setTodaySick(null);
    setLoading(false);
    onMarked();
  }

  if (todaySick) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-red-300 bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-1.5 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
          Out Sick Today — Scheduling Blocked
        </span>
        <button
          onClick={cancelSick}
          disabled={loading}
          className="text-[10px] font-semibold text-slate-500 hover:text-white border border-slate-700 hover:border-slate-600 rounded-xl px-2.5 py-1.5 transition-colors"
        >
          {loading ? "..." : "I'm Back"}
        </button>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-300">Block today's schedule?</span>
        <button
          onClick={markSick}
          disabled={loading}
          className="text-xs font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-xl px-3 py-1.5 transition-colors"
        >
          {loading ? "Saving…" : "Yes, I'm Sick"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs font-semibold text-slate-500 hover:text-white border border-slate-700 rounded-xl px-2.5 py-1.5 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-xs font-bold text-red-300 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-xl px-3 py-1.5 transition-colors"
    >
      <span className="text-base leading-none">🤒</span>
      I'm Sick
    </button>
  );
}

// ─── Super Admin Sick Panel ───────────────────────────────────────────────────

function SuperAdminSickPanel({ onRefresh }: { onRefresh: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [overrides, setOverrides] = useState<SickOverride[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [notes, setNotes]         = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await sbGet<SickOverride>(
      `staff_sick_overrides?date=gte.${today}&is_active=eq.true&order=date.asc`
    );
    setOverrides(rows);
    setLoading(false);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  async function markOut(staffId: string, staffName: string) {
    setSaving(staffId);
    // Check if already marked
    const existing = await sbGet<SickOverride>(
      `staff_sick_overrides?staff_id=eq.${staffId}&date=eq.${selectedDate}&is_active=eq.true`
    );
    if (existing.length === 0) {
      await sbPost("staff_sick_overrides", {
        staff_id:   staffId,
        staff_name: staffName,
        date:       selectedDate,
        reason:     "sick",
        notes:      notes || null,
        marked_by:  "super_admin",
        is_active:  true,
      });
      await sbPost("intake_staff_time_off", {
        staff_id:      staffId,
        staff_name:    staffName,
        date:          selectedDate,
        time_off_type: "full_day",
        reason_type:   "sick",
        reason:        notes || "Marked out by admin",
        approved:      true,
      });
    }
    setSaving(null);
    load();
    onRefresh();
  }

  async function clearOut(id: string) {
    setSaving(id);
    await fetch(`${SUPABASE_URL}/rest/v1/staff_sick_overrides?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ is_active: false }),
    });
    setSaving(null);
    load();
    onRefresh();
  }

  const outIds = new Set(overrides.filter(o => o.date === selectedDate).map(o => o.staff_id));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-bold text-white">Staff Out-of-Office Manager</p>
          <p className="text-xs text-slate-500 mt-0.5">Mark any staff member as out sick or unavailable. Scheduling will automatically skip them for the selected date.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-red-500 transition-colors"
          />
          <button onClick={load} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Notes field */}
      <div>
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Reason / Notes (optional)</label>
        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Flu, family emergency, out of office…"
          className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-red-500 transition-colors placeholder-slate-600"
        />
      </div>

      {/* Staff grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ALL_STAFF.map(s => {
          const isOut = outIds.has(s.id);
          const override = overrides.find(o => o.staff_id === s.id && o.date === selectedDate);
          const isBusy   = saving === s.id || saving === override?.id;
          return (
            <div
              key={s.id}
              className={`flex items-center justify-between gap-3 rounded-2xl px-5 py-4 border transition-all ${
                isOut
                  ? "bg-red-950/30 border-red-500/30"
                  : "bg-[#0d1221] border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold ${isOut ? "bg-red-500/20 text-red-300" : "bg-slate-700 text-slate-300"}`}>
                  {s.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.role}</p>
                  {isOut && override && (
                    <p className="text-[10px] text-red-400 mt-0.5">
                      Out {override.date === today ? "today" : fmtDate(override.date)}
                      {override.notes ? ` — ${override.notes}` : ""}
                      {override.marked_by === "super_admin" ? " (admin)" : " (self)"}
                    </p>
                  )}
                </div>
              </div>
              {isOut ? (
                <button
                  onClick={() => clearOut(override!.id)}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-50 rounded-xl px-3 py-1.5 transition-all flex-shrink-0"
                >
                  {isBusy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  Back In
                </button>
              ) : (
                <button
                  onClick={() => markOut(s.id, s.name)}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 text-xs font-bold text-red-300 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 rounded-xl px-3 py-1.5 transition-all flex-shrink-0"
                >
                  {isBusy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <span className="text-sm leading-none">🤒</span>}
                  Mark Out
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Active out-sick summary */}
      {overrides.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Active Out-of-Office (Next 14 Days)</p>
          <div className="space-y-1.5">
            {overrides.map(o => (
              <div key={o.id} className="flex items-center justify-between gap-3 bg-red-950/20 border border-red-800/30 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-bold text-red-400 bg-red-900/30 px-2 py-0.5 rounded-lg flex-shrink-0">{fmtDate(o.date)}</span>
                  <span className="text-xs font-semibold text-white">{o.staff_name}</span>
                  {o.notes && <span className="text-xs text-slate-500 truncate">{o.notes}</span>}
                  <span className="text-[10px] text-slate-600">{o.marked_by === "super_admin" ? "admin" : "self"}</span>
                </div>
                <button
                  onClick={() => clearOut(o.id)}
                  disabled={saving === o.id}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function CalendarTab({ events, leads, timeOff, onRefresh }: {
  events: CalEvent[];
  leads: Lead[];
  timeOff: TimeOff[];
  onRefresh: () => void;
}) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<Date | null>(today);
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookDate, setBookDate] = useState<string>("");

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)); }
  function goToday()   { setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(today); }

  function eventsOnDay(d: number) {
    const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    return events.filter(e => e.start_time?.slice(0,10) === ds);
  }

  function timeOffOnDay(d: number) {
    const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    return timeOff.filter(t => t.date === ds);
  }

  const selectedDateStr = selectedDay
    ? `${selectedDay.getFullYear()}-${String(selectedDay.getMonth()+1).padStart(2,"0")}-${String(selectedDay.getDate()).padStart(2,"0")}`
    : null;

  const selectedEvents = selectedDay ? events.filter(e => e.start_time?.slice(0,10) === selectedDateStr) : [];
  const selectedTimeOff = selectedDay ? timeOff.filter(t => t.date === selectedDateStr) : [];

  const EVENT_STATUS_COLOR: Record<string,string> = {
    scheduled: "bg-sky-500",
    confirmed: "bg-emerald-500",
    completed: "bg-slate-500",
    cancelled: "bg-red-500",
    no_show: "bg-orange-500",
    rescheduled: "bg-amber-500",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Month calendar */}
      <div className="lg:col-span-2 bg-[#0d1221] border border-slate-800 rounded-2xl overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"><ChevronRight className="w-4 h-4 rotate-180" /></button>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-white">{MONTHS[month]} {year}</h2>
            <button onClick={goToday} className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-lg hover:bg-sky-500/20 transition-colors">Today</button>
          </div>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-800">
          {DAYS.map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-bold text-slate-600 uppercase tracking-widest">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-slate-800/40 bg-slate-900/20" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
            const dayEvts = eventsOnDay(d);
            const dayOff  = timeOffOnDay(d);
            const isToday = ds === today.toISOString().slice(0,10);
            const isSelected = ds === selectedDateStr;
            const col = (firstDay + i) % 7;
            const isWeekend = col === 0 || col === 6;

            return (
              <div
                key={d}
                onClick={() => setSelectedDay(new Date(year, month, d))}
                className={`min-h-[80px] border-b border-r border-slate-800/40 p-1.5 cursor-pointer transition-colors ${
                  isSelected ? "bg-sky-500/10" : isWeekend ? "bg-slate-900/30" : "hover:bg-slate-800/20"
                }`}
              >
                <div className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                  isToday ? "bg-sky-500 text-white" : isSelected ? "text-sky-400" : isWeekend ? "text-slate-600" : "text-slate-400"
                }`}>{d}</div>
                {dayOff.map(t => (
                  <div key={t.id} className="text-[9px] font-semibold bg-orange-500/20 text-orange-300 rounded px-1 py-0.5 mb-0.5 truncate">
                    {t.time_off_type === "full_day" ? "Off" : t.time_off_type === "morning" ? "Off AM" : "Off PM"}
                  </div>
                ))}
                {dayEvts.slice(0, 3).map(e => (
                  <div key={e.id} className="flex items-center gap-1 mb-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${EVENT_STATUS_COLOR[e.status] ?? "bg-slate-500"}`} />
                    <span className="text-[9px] text-slate-400 truncate">{e.client_name ?? e.title}</span>
                  </div>
                ))}
                {dayEvts.length > 3 && <div className="text-[9px] text-slate-600">+{dayEvts.length - 3} more</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day detail panel */}
      <div className="space-y-4">
        <div className="bg-[#0d1221] border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between">
            <p className="text-sm font-bold text-white">
              {selectedDay ? selectedDay.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}) : "Select a day"}
            </p>
            {selectedDay && (
              <button
                onClick={() => { setBookDate(selectedDateStr ?? ""); setShowBookModal(true); }}
                className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg hover:bg-emerald-500/20 transition-colors"
              >
                <Plus className="w-3 h-3" /> Book
              </button>
            )}
          </div>

          {selectedDay && selectedTimeOff.length > 0 && (
            <div className="px-4 py-3 bg-orange-500/5 border-b border-orange-500/15">
              {selectedTimeOff.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-xs text-orange-300">
                  <Clock className="w-3 h-3" />
                  <span className="font-semibold">{t.staff_name}</span>
                  <span className="text-orange-500">
                    {t.time_off_type === "full_day" ? "Full day off" : t.time_off_type === "morning" ? "Morning off" : t.time_off_type === "afternoon" ? "Afternoon off" : `${t.start_time}–${t.end_time}`}
                  </span>
                  {!t.approved && <span className="text-orange-600 text-[10px]">(pending)</span>}
                </div>
              ))}
            </div>
          )}

          <div className="divide-y divide-slate-800/40">
            {selectedEvents.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Calendar className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-600">No appointments</p>
              </div>
            ) : (
              selectedEvents
                .sort((a,b) => a.start_time.localeCompare(b.start_time))
                .map(e => {
                  const sc = EVENT_STATUS_COLOR[e.status] ?? "bg-slate-500";
                  const start = new Date(e.start_time).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
                  const end   = new Date(e.end_time).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
                  return (
                    <div key={e.id} className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sc}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{e.client_name ?? e.title}</p>
                          <p className="text-[10px] text-slate-500">{start} – {end}</p>
                          {e.phone && <p className="text-[10px] text-slate-600">{e.phone}</p>}
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="text-[9px] font-bold bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded capitalize">
                              {e.event_subtype ?? e.calendar_type}
                            </span>
                            {e.is_walk_in && <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">Walk-in</span>}
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded capitalize ${
                              e.status === "confirmed" ? "bg-emerald-500/20 text-emerald-400" :
                              e.status === "completed" ? "bg-slate-700/50 text-slate-400" :
                              e.status === "cancelled" ? "bg-red-500/20 text-red-400" :
                              "bg-sky-500/20 text-sky-400"
                            }`}>{e.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Upcoming this week */}
        <div className="bg-[#0d1221] border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Upcoming 7 Days</p>
          </div>
          <div className="divide-y divide-slate-800/40 max-h-64 overflow-y-auto">
            {(() => {
              const now = new Date();
              const in7 = new Date(now.getTime() + 7*24*60*60*1000);
              const upcoming = events
                .filter(e => {
                  const t = new Date(e.start_time);
                  return t >= now && t <= in7 && e.status !== "cancelled";
                })
                .sort((a,b) => a.start_time.localeCompare(b.start_time));
              if (!upcoming.length) return (
                <div className="px-4 py-6 text-center text-xs text-slate-600">No upcoming appointments</div>
              );
              return upcoming.map(e => {
                const dt = new Date(e.start_time);
                return (
                  <div key={e.id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="text-center flex-shrink-0 w-10">
                      <p className="text-[9px] font-bold text-slate-600 uppercase">{DAYS[dt.getDay()]}</p>
                      <p className="text-sm font-bold text-white">{dt.getDate()}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{e.client_name ?? e.title}</p>
                      <p className="text-[10px] text-slate-500">{dt.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</p>
                    </div>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${EVENT_STATUS_COLOR[e.status] ?? "bg-slate-500"}`} />
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {showBookModal && (
        <BookConsultModal
          defaultDate={bookDate}
          leads={leads}
          onClose={() => setShowBookModal(false)}
          onSaved={() => { setShowBookModal(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Book Consultation Modal ──────────────────────────────────────────────────

function BookConsultModal({ defaultDate, leads, onClose, onSaved }: {
  defaultDate: string;
  leads: Lead[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [leadId, setLeadId]     = useState<string>("");
  const [date, setDate]         = useState(defaultDate);
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState("45");
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [notes, setNotes]       = useState("");
  const [saving, setSaving]     = useState(false);

  const selectedLead = leads.find(l => l.id === leadId);

  async function save() {
    if (!date || (!leadId && !isWalkIn)) return;
    setSaving(true);
    const [h, m] = startTime.split(":").map(Number);
    const startDt = new Date(`${date}T${startTime}:00`);
    const endDt   = new Date(startDt.getTime() + parseInt(duration) * 60000);
    const clientName = isWalkIn ? walkInName : (selectedLead?.full_name ?? "");
    const phone      = isWalkIn ? walkInPhone : (selectedLead?.phone ?? null);

    await sbPost("calendar_events", {
      title: `Consultation — ${clientName}`,
      calendar_type: "intake",
      event_subtype: "consultation",
      department: "intake",
      client_name: clientName,
      phone,
      client_email: isWalkIn ? null : (selectedLead?.email ?? null),
      lead_id: leadId || null,
      start_time: startDt.toISOString(),
      end_time: endDt.toISOString(),
      status: "scheduled",
      is_walk_in: isWalkIn,
      cal_notes: notes || null,
      spacing_buffer_minutes: 20,
    });

    if (leadId) {
      await sbPatch("intake_leads", leadId, {
        status: "consultation_scheduled",
        consultation_date: date,
      });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <p className="text-sm font-bold text-white">Book Consultation</p>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`w-9 h-5 rounded-full transition-colors flex items-center ${isWalkIn ? "bg-amber-500" : "bg-slate-700"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${isWalkIn ? "translate-x-4" : "translate-x-0"}`} />
            </div>
            <span className="text-xs font-semibold text-slate-300">Walk-in (no existing lead record)</span>
            <input type="checkbox" className="sr-only" checked={isWalkIn} onChange={e => setIsWalkIn(e.target.checked)} />
          </label>

          {isWalkIn ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Client Name *</label>
                <input value={walkInName} onChange={e => setWalkInName(e.target.value)} placeholder="Full name"
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 placeholder-slate-600 transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Phone</label>
                <input value={walkInPhone} onChange={e => setWalkInPhone(e.target.value)} placeholder="(312) 555-0000"
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 placeholder-slate-600 transition-colors" />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Select Lead *</label>
              <select value={leadId} onChange={e => setLeadId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 transition-colors">
                <option value="">— Choose a lead —</option>
                {leads.filter(l => !["retained","declined","attorney_accepted","fee_quoted","no_case"].includes(l.status)).map(l => (
                  <option key={l.id} value={l.id}>{l.full_name}{l.chapter_interest ? ` (Ch. ${l.chapter_interest})` : ""}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Start Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Duration</label>
              <select value={duration} onChange={e => setDuration(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 transition-colors">
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Notes</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes for this appointment…"
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-sky-500 resize-none transition-colors" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-800 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-all">Cancel</button>
          <button
            disabled={saving || !date || (!leadId && !isWalkIn) || (isWalkIn && !walkInName)}
            onClick={save}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-xl transition-all"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
            Book Appointment
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Availability Tab ─────────────────────────────────────────────────────────

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function AvailabilityTab({ availability, onRefresh }: { availability: StaffAvailability[]; onRefresh: () => void; }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState<Partial<StaffAvailability>>({});

  function startEdit(a: StaffAvailability) {
    setEditing(a.day_of_week);
    setForm({ ...a });
  }

  function startNewDay(dow: number) {
    setEditing(dow);
    setForm({
      day_of_week: dow,
      start_time: "09:00",
      end_time: "17:00",
      is_available: true,
      max_consultations_per_day: 6,
      min_gap_between_appts_min: 15,
      preferred_gap_minutes: 20,
      lunch_start: "12:00",
      lunch_end: "13:00",
    });
  }

  async function saveDay() {
    setSaving(true);
    const existing = availability.find(a => a.day_of_week === editing);
    if (existing) {
      await sbPatch("staff_availability", existing.id, {
        start_time: form.start_time,
        end_time: form.end_time,
        is_available: form.is_available,
        max_consultations_per_day: form.max_consultations_per_day,
        min_gap_between_appts_min: form.min_gap_between_appts_min,
        preferred_gap_minutes: form.preferred_gap_minutes,
        lunch_start: form.lunch_start,
        lunch_end: form.lunch_end,
      });
    } else {
      await sbPost("staff_availability", {
        staff_id: "11111111-0000-0000-0000-000000000004",
        day_of_week: editing,
        start_time: form.start_time,
        end_time: form.end_time,
        is_available: form.is_available ?? true,
        max_consultations_per_day: form.max_consultations_per_day ?? 6,
        min_gap_between_appts_min: form.min_gap_between_appts_min ?? 15,
        preferred_gap_minutes: form.preferred_gap_minutes ?? 20,
        lunch_start: form.lunch_start ?? "12:00",
        lunch_end: form.lunch_end ?? "13:00",
        department: "intake",
      });
    }
    setSaving(false);
    setEditing(null);
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="bg-sky-500/5 border border-sky-500/15 rounded-2xl px-5 py-4 flex items-start gap-3">
        <Bot className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-400 leading-relaxed">
          The AI scheduling bot uses these availability windows to automatically assign consultations. Calls are distributed across all available intake staff based on remaining daily capacity and minimum gap requirements.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 7 }, (_, dow) => {
          const a = availability.find(x => x.day_of_week === dow);
          const isWeekend = dow === 0 || dow === 6;

          if (editing === dow) {
            return (
              <div key={dow} className="bg-[#0d1221] border border-sky-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-white">{DAY_NAMES[dow]}</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[10px] text-slate-500">{form.is_available ? "Available" : "Off"}</span>
                    <div className={`w-8 h-4 rounded-full transition-colors ${form.is_available ? "bg-emerald-500" : "bg-slate-700"}`}
                      onClick={() => setForm(f => ({ ...f, is_available: !f.is_available }))}>
                      <div className={`w-3 h-3 rounded-full bg-white shadow mt-0.5 mx-0.5 transition-transform ${form.is_available ? "translate-x-4" : "translate-x-0"}`} />
                    </div>
                  </label>
                </div>
                {form.is_available && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Start</label>
                        <input type="time" value={form.start_time ?? "09:00"} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                          className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-sky-500" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">End</label>
                        <input type="time" value={form.end_time ?? "17:00"} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                          className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-sky-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Lunch Start</label>
                        <input type="time" value={form.lunch_start ?? "12:00"} onChange={e => setForm(f => ({ ...f, lunch_start: e.target.value }))}
                          className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-sky-500" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Lunch End</label>
                        <input type="time" value={form.lunch_end ?? "13:00"} onChange={e => setForm(f => ({ ...f, lunch_end: e.target.value }))}
                          className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-sky-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Max Consults/Day</label>
                        <input type="number" min={1} max={20} value={form.max_consultations_per_day ?? 6} onChange={e => setForm(f => ({ ...f, max_consultations_per_day: parseInt(e.target.value) }))}
                          className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-sky-500" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Gap (min)</label>
                        <input type="number" min={5} max={60} value={form.preferred_gap_minutes ?? 20} onChange={e => setForm(f => ({ ...f, preferred_gap_minutes: parseInt(e.target.value) }))}
                          className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-sky-500" />
                      </div>
                    </div>
                  </>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditing(null)} className="flex-1 py-1.5 text-[10px] font-semibold text-slate-400 border border-slate-700 rounded-lg hover:text-white transition-colors">Cancel</button>
                  <button disabled={saving} onClick={saveDay} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg transition-colors">
                    {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={dow} className={`bg-[#0d1221] border rounded-2xl p-4 ${isWeekend && !a?.is_available ? "border-slate-800/40 opacity-60" : a?.is_available ? "border-slate-800" : "border-slate-800/40"}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-white">{DAY_NAMES[dow]}</p>
                {a ? (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${a.is_available ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700/40 text-slate-500"}`}>
                    {a.is_available ? "Available" : "Off"}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-700/40 text-slate-600">Not set</span>
                )}
              </div>
              {a?.is_available ? (
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="w-3 h-3 text-slate-600" />
                    {a.start_time.slice(0,5)} – {a.end_time.slice(0,5)}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="w-3 h-3 text-slate-600 flex items-center justify-center text-[9px] font-bold">L</span>
                    Lunch: {a.lunch_start?.slice(0,5)} – {a.lunch_end?.slice(0,5)}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Users className="w-3 h-3 text-slate-600" />
                    Max {a.max_consultations_per_day} consults · {a.preferred_gap_minutes}m gap
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600 mb-3">{isWeekend ? "Weekend" : "Day off"}</p>
              )}
              <button onClick={() => a ? startEdit(a) : startNewDay(dow)}
                className="w-full text-[10px] font-bold text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-white rounded-lg py-1.5 transition-colors">
                {a ? "Edit" : "Set Hours"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Time-Off Tab ─────────────────────────────────────────────────────────────

function TimeOffTab({ timeOff, onRefresh }: { timeOff: TimeOff[]; onRefresh: () => void; }) {
  const [showAdd, setShowAdd] = useState(false);
  const [date, setDate]       = useState("");
  const [type, setType]       = useState("full_day");
  const [startT, setStartT]   = useState("09:00");
  const [endT, setEndT]       = useState("13:00");
  const [reasonType, setReasonType] = useState("personal");
  const [reason, setReason]   = useState("");
  const [saving, setSaving]   = useState(false);

  async function save() {
    if (!date) return;
    setSaving(true);
    await sbPost("intake_staff_time_off", {
      staff_id: "11111111-0000-0000-0000-000000000004",
      staff_name: "Lisa Chen",
      date,
      time_off_type: type,
      start_time: type === "custom" ? startT : null,
      end_time: type === "custom" ? endT : null,
      reason_type: reasonType,
      reason: reason || null,
      approved: false,
    });
    setSaving(false);
    setShowAdd(false);
    setDate("");
    setReason("");
    onRefresh();
  }

  async function remove(id: string) {
    await fetch(`${SUPABASE_URL}/rest/v1/intake_staff_time_off?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    onRefresh();
  }

  const upcoming = timeOff.filter(t => new Date(t.date) >= new Date()).sort((a,b) => a.date.localeCompare(b.date));
  const past     = timeOff.filter(t => new Date(t.date) < new Date()).sort((a,b) => b.date.localeCompare(a.date));

  const REASON_LABELS: Record<string,string> = {
    vacation: "Vacation", sick: "Sick Leave", personal: "Personal", training: "Training / CLE", other: "Other",
  };
  const TYPE_LABELS: Record<string,string> = {
    full_day: "Full Day", morning: "Morning (AM)", afternoon: "Afternoon (PM)", custom: "Custom Hours",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-white">Time Off & Unavailability</p>
          <p className="text-xs text-slate-500 mt-0.5">When time off is recorded, the AI bot will skip those dates when scheduling consultations.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 px-3 py-2 rounded-xl transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Time Off
        </button>
      </div>

      {showAdd && (
        <div className="bg-[#0d1221] border border-sky-500/25 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">New Time Off Request</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Type</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 transition-colors">
                {Object.entries(TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Reason Type</label>
              <select value={reasonType} onChange={e => setReasonType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 transition-colors">
                {Object.entries(REASON_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {type === "custom" && (
              <>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Unavailable From</label>
                  <input type="time" value={startT} onChange={e => setStartT(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Unavailable Until</label>
                  <input type="time" value={endT} onChange={e => setEndT(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 transition-colors" />
                </div>
              </>
            )}
            <div className={type === "custom" ? "col-span-1" : "col-span-3"}>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Notes (optional)</label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Brief description…"
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 transition-colors placeholder-slate-600" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-all">Cancel</button>
            <button disabled={!date || saving} onClick={save}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-xl transition-all">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Submit Request
            </button>
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Upcoming / Scheduled</p>
        {upcoming.length === 0 ? (
          <div className="bg-[#0d1221] border border-slate-800 rounded-2xl py-10 text-center">
            <CheckCircle2 className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-xs text-slate-600">No upcoming time off recorded</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map(t => (
              <div key={t.id} className={`bg-[#0d1221] border rounded-2xl px-5 py-4 flex items-center gap-4 ${t.approved ? "border-emerald-500/20" : "border-slate-800"}`}>
                <div className="text-center flex-shrink-0 w-12">
                  <p className="text-xs font-bold text-slate-600 uppercase">{MONTHS[new Date(t.date + "T12:00").getMonth()].slice(0,3)}</p>
                  <p className="text-2xl font-bold text-white">{new Date(t.date + "T12:00").getDate()}</p>
                  <p className="text-[10px] text-slate-600">{new Date(t.date + "T12:00").getFullYear()}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{TYPE_LABELS[t.time_off_type] ?? t.time_off_type}</p>
                  <p className="text-xs text-slate-500">{REASON_LABELS[t.reason_type] ?? t.reason_type}{t.reason ? ` — ${t.reason}` : ""}</p>
                  {t.time_off_type === "custom" && t.start_time && t.end_time && (
                    <p className="text-xs text-slate-600">{t.start_time.slice(0,5)} – {t.end_time.slice(0,5)}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${t.approved ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                    {t.approved ? "Approved" : "Pending"}
                  </span>
                  <button onClick={() => remove(t.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Past</p>
          <div className="space-y-2">
            {past.slice(0, 5).map(t => (
              <div key={t.id} className="bg-[#0d1221] border border-slate-800/50 rounded-2xl px-5 py-3 flex items-center gap-4 opacity-50">
                <p className="text-xs text-slate-500 w-20 flex-shrink-0">{fmtDate(t.date)}</p>
                <p className="text-xs text-slate-400 flex-1">{TYPE_LABELS[t.time_off_type]} — {REASON_LABELS[t.reason_type]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Log Contact Modal ────────────────────────────────────────────────────────

const CHANNEL_CFG = {
  phone:      { label: "Phone Call",   icon: PhoneCall,      color: "text-sky-400",     bg: "bg-sky-500/10",     border: "border-sky-500/25" },
  sms:        { label: "SMS",          icon: MessageCircle,  color: "text-teal-400",    bg: "bg-teal-500/10",    border: "border-teal-500/25" },
  email:      { label: "Email",        icon: Mail,           color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25" },
  in_person:  { label: "In Person",    icon: User,           color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  bot_sms:    { label: "Bot SMS",      icon: Bot,            color: "text-slate-400",   bg: "bg-slate-700/30",   border: "border-slate-700" },
  bot_email:  { label: "Bot Email",    icon: Bot,            color: "text-slate-400",   bg: "bg-slate-700/30",   border: "border-slate-700" },
} as const;

const OUTCOME_CFG = {
  reached:       { label: "Reached / Spoke",   color: "text-emerald-400", icon: PhoneCall },
  replied:       { label: "Replied",            color: "text-emerald-400", icon: MailCheck },
  left_voicemail:{ label: "Left Voicemail",     color: "text-amber-400",   icon: PhoneOutgoing },
  scheduled:     { label: "Scheduled Appt.",    color: "text-teal-400",    icon: Calendar },
  no_answer:     { label: "No Answer",          color: "text-slate-400",   icon: PhoneMissed },
  bounced:       { label: "Bounced / Invalid",  color: "text-red-400",     icon: X },
  not_interested:{ label: "Not Interested",     color: "text-red-400",     icon: X },
  other:         { label: "Other",              color: "text-slate-400",   icon: MessageCircle },
} as const;

function LogContactModal({ lead, onClose, onSaved }: {
  lead: Lead;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [channel, setChannel]   = useState<keyof typeof CHANNEL_CFG>("phone");
  const [direction, setDirection] = useState<"outbound"|"inbound">("outbound");
  const [outcome, setOutcome]   = useState<keyof typeof OUTCOME_CFG>("no_answer");
  const [notes, setNotes]       = useState("");
  const [staffName, setStaffName] = useState("Lisa Chen");
  const [saving, setSaving]     = useState(false);

  async function save() {
    setSaving(true);
    await sbPost("intake_contact_log", {
      lead_id:      lead.id,
      channel,
      direction,
      outcome,
      notes:        notes.trim() || null,
      contacted_by: staffName,
      is_bot:       false,
      follow_up_queue: lead.follow_up_queue ?? null,
      contacted_at: new Date().toISOString(),
    });
    // Update lead's last_contact_at
    await sbPatch("intake_leads", lead.id, {
      last_contact_at: new Date().toISOString(),
      status: outcome === "scheduled" ? "consultation_scheduled" : lead.status,
    });
    setSaving(false);
    onSaved();
  }

  const txtA = "w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-400/60 transition-all resize-none";
  const inp  = "w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400/60 transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
              <PhoneCall className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Log Contact</h3>
              <p className="text-xs text-slate-500">{lead.full_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Channel */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Contact Method</p>
            <div className="grid grid-cols-2 gap-2">
              {(["phone","sms","email","in_person"] as const).map(ch => {
                const c = CHANNEL_CFG[ch];
                const Icon = c.icon;
                return (
                  <button key={ch} onClick={() => setChannel(ch)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                      channel === ch ? `${c.bg} ${c.color} ${c.border}` : "bg-slate-800/40 text-slate-500 border-slate-700/60 hover:text-slate-300"
                    }`}>
                    <Icon className="w-3.5 h-3.5" /> {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Direction */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Direction</p>
            <div className="flex gap-2">
              {(["outbound","inbound"] as const).map(d => (
                <button key={d} onClick={() => setDirection(d)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    direction === d ? "bg-slate-600 text-white border-slate-500" : "text-slate-500 border-slate-700/60 hover:text-slate-300"
                  }`}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Outcome */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Outcome</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(OUTCOME_CFG) as [keyof typeof OUTCOME_CFG, typeof OUTCOME_CFG[keyof typeof OUTCOME_CFG]][]).map(([k, v]) => {
                const Icon = v.icon;
                return (
                  <button key={k} onClick={() => setOutcome(k)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      outcome === k ? `bg-slate-700 ${v.color} border-slate-600` : "text-slate-600 border-slate-800 hover:text-slate-400 hover:border-slate-700"
                    }`}>
                    <Icon className="w-3 h-3 flex-shrink-0" /> {v.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Notes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={txtA}
              placeholder="What was discussed? Any follow-up needed?" />
          </div>

          {/* Staff */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Logged By</p>
            <input value={staffName} onChange={e => setStaffName(e.target.value)} className={inp} placeholder="Staff name" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-white transition-colors">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition-all">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
            Save Contact Log
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Follow-Up Queue ──────────────────────────────────────────────────────────

// ─── Attorney Review Queue ────────────────────────────────────────────────────

function AttorneyReviewQueue({ leads, acceptances, onSelect }: {
  leads: Lead[];
  acceptances: Acceptance[];
  onSelect: (lead: Lead) => void;
}) {
  const needsReview   = leads.filter(l => l.status === "sent_for_attorney_review");
  const readyPresent  = leads.filter(l => l.status === "attorney_accepted");
  const feeQuoted     = leads.filter(l => l.status === "fee_quoted");
  const welcomeCalls  = leads.filter(l => ["consultation_scheduled","new","contacted"].includes(l.status));

  function hasDecision(lead: Lead) {
    return acceptances.some(a => a.lead_id === lead.id);
  }

  function LeadCard({ lead, accent }: { lead: Lead; accent: string }) {
    const sc = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG["new"];
    const decided = hasDecision(lead);
    return (
      <button onClick={() => onSelect(lead)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/40 hover:border-slate-600 transition-all text-left group">
        <div className={`w-8 h-8 rounded-xl ${accent} flex items-center justify-center flex-shrink-0 text-sm font-bold`}>
          {lead.full_name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{lead.full_name}</span>
            {lead.chapter_interest && <span className="text-[9px] font-bold text-slate-500">Ch.{lead.chapter_interest}</span>}
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${sc.color} ${sc.bg} ${sc.border}`}>{sc.label}</span>
            {decided && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5">Decision Recorded</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {lead.phone && <span className="text-[11px] text-slate-500">{lead.phone}</span>}
            {lead.state && <span className="text-[11px] text-slate-500">{lead.state}</span>}
          </div>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 flex-shrink-0" />
      </button>
    );
  }

  function Section({ title, desc, leads: rows, accent, icon }: {
    title: string; desc: string; leads: Lead[]; accent: string; icon: React.ReactNode;
  }) {
    if (rows.length === 0) return null;
    return (
      <div className="bg-[#0d1221] border border-slate-700/60 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-slate-700/50 border border-slate-600 flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">{title}</p>
            <p className="text-xs text-slate-500">{desc}</p>
          </div>
          <span className="text-sm font-black text-slate-400">{rows.length}</span>
        </div>
        <div className="space-y-2">
          {rows.map(l => <LeadCard key={l.id} lead={l} accent={accent} />)}
        </div>
      </div>
    );
  }

  const total = needsReview.length + readyPresent.length + feeQuoted.length + welcomeCalls.length;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Needs Review",      val: needsReview.length,  color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20",   icon: <Scale className="w-4 h-4" /> },
          { label: "Ready to Present",  val: readyPresent.length, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: <UserCheck className="w-4 h-4" /> },
          { label: "Fee Quoted / FU",   val: feeQuoted.length,    color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20",  icon: <DollarSign className="w-4 h-4" /> },
          { label: "Welcome Calls",     val: welcomeCalls.length, color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/20",        icon: <PhoneCall className="w-4 h-4" /> },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
            <div className={`${s.color} opacity-70 mb-2`}>{s.icon}</div>
            <p className="text-2xl font-black text-white">{s.val}</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {total === 0 && (
        <div className="bg-[#0d1221] border border-slate-800 rounded-2xl text-center py-16">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto mb-3" />
          <p className="text-slate-500">All caught up — no pending attorney actions</p>
        </div>
      )}

      <Section title="Pending Your Review" desc="Intake complete — awaiting attorney case review and decision"
        leads={needsReview} accent="bg-amber-500/15 text-amber-400" icon={<Scale className="w-3.5 h-3.5 text-amber-400" />} />

      <Section title="Ready to Present to Client" desc="Case accepted — quote fees and present options to client"
        leads={readyPresent} accent="bg-emerald-500/15 text-emerald-400" icon={<UserCheck className="w-3.5 h-3.5 text-emerald-400" />} />

      <Section title="Fee Quoted — Follow Up" desc="Fee presented — follow up with client on decision"
        leads={feeQuoted} accent="bg-orange-500/15 text-orange-400" icon={<DollarSign className="w-3.5 h-3.5 text-orange-400" />} />

      <Section title="Welcome Calls" desc="New leads and scheduled consultations awaiting attorney welcome call"
        leads={welcomeCalls} accent="bg-sky-500/15 text-sky-400" icon={<PhoneCall className="w-3.5 h-3.5 text-sky-400" />} />
    </div>
  );
}

function FollowUpQueue({ leads, onSelect }: {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
}) {
  const now = new Date();

  const CLOSED = ["retained","declined","no_case","no_show"];
  const active = leads.filter(l => !CLOSED.includes(l.status));

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  function daysSince(dateStr: string | null) {
    if (!dateStr) return null;
    return Math.floor((now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  }

  // Retention-priority order — closest to signing go first
  const STAGE_ORDER = [
    {
      key: "close",
      title: "Close Now — Fee Quoted",
      desc: "Client has been presented fees. Follow up immediately and get commitment.",
      icon: <UserCheck className="w-3.5 h-3.5 text-green-400" />,
      border: "border-green-500/25",
      bg: "bg-green-500/5",
      badge: "text-green-400 bg-green-500/10 border-green-500/25",
      filter: (l: Lead) => l.status === "fee_quoted",
    },
    {
      key: "present",
      title: "Present to Client — Attorney Accepted",
      desc: "Attorney has accepted the case. Contact client now, present options, quote fees.",
      icon: <DollarSign className="w-3.5 h-3.5 text-emerald-400" />,
      border: "border-emerald-500/25",
      bg: "bg-emerald-500/5",
      badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
      filter: (l: Lead) => l.status === "attorney_accepted",
    },
    {
      key: "review",
      title: "Pending Attorney Review",
      desc: "Intake is complete. Awaiting attorney decision so the client can be presented options.",
      icon: <Scale className="w-3.5 h-3.5 text-amber-300" />,
      border: "border-amber-500/25",
      bg: "bg-amber-500/5",
      badge: "text-amber-300 bg-amber-500/10 border-amber-500/25",
      filter: (l: Lead) => l.status === "sent_for_attorney_review",
    },
    {
      key: "intake",
      title: "Complete Intake & Send for Review",
      desc: "Consultation done or in progress. Complete intake and send to attorney.",
      icon: <CheckCheck className="w-3.5 h-3.5 text-blue-400" />,
      border: "border-blue-500/25",
      bg: "bg-blue-500/5",
      badge: "text-blue-400 bg-blue-500/10 border-blue-500/25",
      filter: (l: Lead) => ["consultation_complete","intake_in_progress","intake_complete"].includes(l.status),
    },
    {
      key: "scheduled",
      title: "Upcoming Consultations",
      desc: "Appointment is on the books. Prepare intake form and confirm with client.",
      icon: <Calendar className="w-3.5 h-3.5 text-teal-400" />,
      border: "border-teal-500/20",
      bg: "bg-teal-500/5",
      badge: "text-teal-400 bg-teal-500/10 border-teal-500/20",
      filter: (l: Lead) => l.status === "consultation_scheduled",
    },
    {
      key: "schedule",
      title: "Need to Schedule — Contact Now",
      desc: "New leads or contacts not yet scheduled. Every hour of delay reduces retention.",
      icon: <PhoneMissed className="w-3.5 h-3.5 text-red-400" />,
      border: "border-red-500/20",
      bg: "bg-red-500/5",
      badge: "text-red-400 bg-red-500/10 border-red-500/20",
      filter: (l: Lead) => ["new","contacted"].includes(l.status),
    },
  ];

  // Bot queue: active leads with no contact in 30+ days
  const botQueue = active.filter(l => {
    const lastContact = l.last_contact_at ? new Date(l.last_contact_at) : new Date(l.created_at);
    return lastContact < thirtyDaysAgo;
  });

  const retentionReady = active.filter(l => ["fee_quoted","attorney_accepted"].includes(l.status));
  const totalActive    = active.length;

  function LeadRow({ lead }: { lead: Lead }) {
    const sc   = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG["new"];
    const days = daysSince(lead.last_contact_at ?? lead.created_at);
    return (
      <button onClick={() => onSelect(lead)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/40 hover:border-slate-600 transition-all text-left group">
        <div className="w-8 h-8 rounded-xl bg-slate-700/60 flex items-center justify-center flex-shrink-0 text-sm font-bold text-slate-400 group-hover:text-white transition-colors">
          {lead.full_name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{lead.full_name}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${sc.color} ${sc.bg} ${sc.border}`}>{sc.label}</span>
            {lead.chapter_interest && <span className="text-[9px] font-bold text-slate-500">Ch.{lead.chapter_interest}</span>}
            {lead.urgency === "emergency" && <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-1.5 py-0.5">Emergency</span>}
            {lead.urgency === "urgent"    && <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-1.5 py-0.5">Urgent</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {lead.phone && <span className="text-[11px] text-slate-500">{lead.phone}</span>}
            {lead.state && <span className="text-[11px] text-slate-500">{lead.state}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {days !== null && (
            <span className={`text-[10px] font-semibold ${days > 14 ? "text-red-400" : days > 7 ? "text-amber-400" : "text-slate-500"}`}>
              {days === 0 ? "Today" : `${days}d ago`}
            </span>
          )}
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 flex-shrink-0" />
      </button>
    );
  }

  return (
    <div className="space-y-5">
      {/* Retention scoreboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Close Now",          val: retentionReady.filter(l=>l.status==="fee_quoted").length,      color: "text-green-400",   bg: "bg-green-500/10 border-green-500/20",   icon: <UserCheck className="w-4 h-4" /> },
          { label: "Present to Client",  val: retentionReady.filter(l=>l.status==="attorney_accepted").length, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: <DollarSign className="w-4 h-4" /> },
          { label: "Pending Review",     val: active.filter(l=>l.status==="sent_for_attorney_review").length, color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20",   icon: <Scale className="w-4 h-4" /> },
          { label: "Need Scheduling",    val: active.filter(l=>["new","contacted"].includes(l.status)).length, color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",       icon: <PhoneMissed className="w-4 h-4" /> },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
            <div className={`${s.color} opacity-70 mb-2`}>{s.icon}</div>
            <p className="text-2xl font-black text-white">{s.val}</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {totalActive === 0 && (
        <div className="bg-[#0d1221] border border-slate-800 rounded-2xl text-center py-16">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto mb-3" />
          <p className="text-slate-500">No active leads in the queue</p>
        </div>
      )}

      {/* Retention-priority sections */}
      {STAGE_ORDER.map(stage => {
        const rows = stage.filter(active);
        if (rows.length === 0) return null;
        return (
          <div key={stage.key} className={`bg-[#0d1221] border rounded-2xl p-5 space-y-3 ${stage.border} ${stage.bg}`}>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-slate-900/70 border border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                {stage.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-white">{stage.title}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${stage.badge}`}>{rows.length}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{stage.desc}</p>
              </div>
            </div>
            <div className="space-y-2">
              {rows.map(l => <LeadRow key={l.id} lead={l} />)}
            </div>
          </div>
        );
      })}

      {/* Bot queue */}
      {botQueue.length > 0 && (
        <div className="bg-[#0d1221] border border-slate-700/60 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-700/50 border border-slate-600 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Bot Follow-Up Queue</p>
              <p className="text-xs text-slate-500">No contact in 30+ days · Automated outreach active</p>
            </div>
            <span className="ml-auto text-sm font-black text-slate-400">{botQueue.length}</span>
          </div>
          <div className="bg-sky-500/6 border border-sky-500/15 rounded-xl px-4 py-3 flex items-start gap-3">
            <Zap className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              These leads receive automated SMS and email follow-ups. No manual action needed — the bot will continue outreach until a response is received or status changes.
            </p>
          </div>
          <div className="space-y-2">
            {botQueue.map(l => <LeadRow key={l.id} lead={l} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Schedule Consult Modal ───────────────────────────────────────────────────
// Books a consultation for a specific lead and sends them an email with the
// pre-intake form link so they can complete it before the appointment.

function ScheduleConsultModal({ lead, onClose, onSaved }: {
  lead: Lead;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime]         = useState("10:00");
  const [duration, setDuration] = useState("45");
  const [notes, setNotes]       = useState("");
  const [sendEmail, setSendEmail] = useState(!!lead.email);
  const [saving, setSaving]     = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const inp = "w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400/60 transition-all";
  const lbl = "block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide";

  const apptDateFmt = date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";

  async function save() {
    if (!date) return;
    setSaving(true);

    const [h, m] = time.split(":").map(Number);
    const startDt = new Date(`${date}T${time}:00`);
    const endDt   = new Date(startDt.getTime() + parseInt(duration) * 60000);

    // Book calendar event
    await sbPost("calendar_events", {
      title:                  `Consultation — ${lead.full_name}`,
      calendar_type:          "intake",
      event_subtype:          "consultation",
      department:             "intake",
      client_name:            lead.full_name,
      phone:                  lead.phone ?? null,
      client_email:           lead.email ?? null,
      lead_id:                lead.id,
      start_time:             startDt.toISOString(),
      end_time:               endDt.toISOString(),
      status:                 "scheduled",
      is_walk_in:             false,
      cal_notes:              notes || null,
      spacing_buffer_minutes: 20,
    });

    // Update lead status
    await sbPatch("intake_leads", lead.id, {
      status:            "consultation_scheduled",
      consultation_date: date,
      last_contact_at:   new Date().toISOString(),
    });

    // Send invitation email with intake form link
    if (sendEmail && lead.email) {
      const intakeFormUrl = `${window.location.origin}/?intake_lead=${lead.id}`;
      await fetch(`${SUPABASE_URL}/functions/v1/send-intake-invite`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${ANON_KEY}`,
          "apikey":        ANON_KEY,
        },
        body: JSON.stringify({
          leadId:          lead.id,
          leadName:        lead.full_name,
          email:           lead.email,
          phone:           lead.phone ?? null,
          consultDate:     date,
          consultTime:     time,
          duration:        parseInt(duration),
          staffName:       "MAJORSLAW Intake Team",
          chapterInterest: lead.chapter_interest ?? 7,
          intakeFormUrl,
        }),
      });
      setEmailSent(true);
    }

    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Schedule Consultation</h3>
              <p className="text-xs text-slate-500">{lead.full_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Start Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className={inp} />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className={lbl}>Duration</label>
            <div className="grid grid-cols-4 gap-1.5">
              {["30","45","60","90"].map(d => (
                <button key={d} onClick={() => setDuration(d)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${duration === d
                    ? "bg-teal-500/15 text-teal-400 border-teal-500/30"
                    : "text-slate-500 border-slate-700/60 hover:text-slate-300"}`}>
                  {d} min
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={lbl}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-400/60 transition-all resize-none"
              placeholder="Any context or preparation notes…" />
          </div>

          {/* Appointment preview */}
          {date && (
            <div className="bg-teal-500/8 border border-teal-500/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-xs font-bold text-teal-400">Appointment Preview</span>
              </div>
              <p className="text-sm text-white font-semibold">{apptDateFmt}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {(() => {
                  const [h, mn] = time.split(":").map(Number);
                  const d = new Date(); d.setHours(h, mn, 0);
                  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
                })()} · {duration} minutes
              </p>
            </div>
          )}

          {/* Email invite toggle */}
          <div className={`rounded-xl border p-3.5 transition-all ${sendEmail ? "bg-amber-500/8 border-amber-500/20" : "bg-slate-800/30 border-slate-700/60"}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)}
                className="mt-0.5 accent-amber-400 w-4 h-4 flex-shrink-0" />
              <div>
                <p className={`text-sm font-semibold ${sendEmail ? "text-amber-300" : "text-slate-400"}`}>
                  Send email invite with intake form
                </p>
                {lead.email ? (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Will send to <span className="text-slate-300">{lead.email}</span> with appointment details and a link to complete the intake form before the consultation.
                  </p>
                ) : (
                  <p className="text-xs text-red-400 mt-0.5">No email on file — cannot send invite.</p>
                )}
              </div>
            </label>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-white transition-colors">Cancel</button>
          <button onClick={save} disabled={saving || !date}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition-all">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            Schedule{sendEmail && lead.email ? " & Send Invite" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Consult Intake Modal ─────────────────────────────────────────────────────
// Walks intake staff through a scripted consultation with the client, filling
// the intake form step by step. Opens with a required legal disclosure.

const CONSULT_SCRIPTS: { stepId: string; script: string }[] = [
  {
    stepId: "residency",
    script: `"Thank you for taking the time to speak with us today. Before we begin, I want to be clear: I am a legal intake specialist, not an attorney. I cannot give you legal advice, and nothing in our conversation today should be taken as legal advice. Your information will be reviewed by one of our licensed attorneys, who will evaluate your case and follow up with you directly.

Let's start with some basic residency information. This helps us determine which state's exemption laws may apply to your case."`,
  },
  {
    stepId: "identity",
    script: `"Now I'd like to confirm your personal information. Everything you share is kept strictly confidential and used only to prepare your case file for attorney review."`,
  },
  {
    stepId: "household",
    script: `"Next I'll ask about your household. This includes your marital status and any dependents — people who rely on your income. This information is used to calculate your household size, which affects your eligibility and the exemptions available to you."`,
  },
  {
    stepId: "income",
    script: `"Now let's talk about income. I'll need information about all sources of money coming into your household — employment, self-employment, benefits, or anything else. Please include income from all household members if it contributes to household expenses."`,
  },
  {
    stepId: "expenses",
    script: `"Next, let's go over your monthly living expenses. These are your regular, necessary costs — things like rent, food, utilities, and healthcare. This helps the attorney assess your financial picture and determine eligibility."`,
  },
  {
    stepId: "real-prop",
    script: `"Now I'd like to ask about any real estate you own — a home, land, investment property, and so on. If you own real estate, it's important to disclose it fully. Our attorney will assess how it fits into your case."`,
  },
  {
    stepId: "personal-prop",
    script: `"Next we'll go over your personal property — vehicles, bank accounts, retirement funds, and any other assets. I want to be thorough here: full disclosure of all assets is legally required, and the attorney will need this to advise you properly."`,
  },
  {
    stepId: "debts",
    script: `"Now let's talk about your debts. I'll need totals by category — secured debts like mortgages and car loans, and unsecured debts like credit cards and medical bills. Accurate debt amounts are essential for the attorney's eligibility analysis."`,
  },
  {
    stepId: "history",
    script: `"This section covers your financial history. I'll ask about prior bankruptcies, any pending lawsuits or wage garnishments, recent large transfers of money or property, and whether you've owned a business. Please be as complete as possible — the attorney needs this to protect you and avoid any issues with the court."`,
  },
  {
    stepId: "review",
    script: `"We're almost done. I'd like to review everything we've collected together to make sure it's accurate before it goes to the attorney. If anything needs to be corrected, now is the time. Once submitted, your case will be reviewed and someone from our office will be in touch within 1–2 business days."`,
  },
];

interface ConsultFormData {
  filingType: string; state: string; county: string; city: string; streetAddress: string; zipCode: string;
  movedToStateDate: string; inStateOver2Years: string; priorResidences: Array<{ id: number; state: string; city: string; fromDate: string; toDate: string }>;
  firstName: string; middleName: string; lastName: string; suffix: string; dob: string; ssn: string;
  email: string; phone: string; altPhone: string;
  spouseFirstName: string; spouseMiddleName: string; spouseLastName: string; spouseDob: string; spouseEmail: string; spousePhone: string;
  maritalStatus: string;
  dependents: Array<{ id: number; relationship: string; age: string; name: string; disabled: boolean; disabledDesc: string; monthlyContribution: string; contributesToHousehold: string; incomeSources: Array<{ sourceType: string; employer: string; grossMonthly: string }> }>;
  incomeSources: Array<{ id: number; person: string; personLabel: string; sourceType: string; employerOrSource: string; payFrequency: string; grossPerPeriod: string; netPerPeriod: string }>;
  hasOtherHouseholdMembers: string; avgMonthly6: string;
  expRentMortgage: string; expUtilities: string; expFood: string; expTransportation: string;
  expHealthcare: string; expInsurance: string; expChildcare: string; expOtherExpenses: string; expOtherDesc: string;
  ownsRealEstate: string;
  realProperties: Array<{ id: number; address: string; type: string; value: string; mortgageBalance: string; lender: string; isCurrent: string }>;
  vehicles: Array<{ id: number; year: string; make: string; model: string; value: string; hasLoan: string; loanBalance: string }>;
  noVehicles: boolean; bankBalance: string; retirementBalance: string;
  hasStocks: string; stocksValue: string; hasCrypto: string; cryptoValue: string;
  hasLifeInsurance: string; lifeInsuranceCashValue: string; hasFirearms: string; firearmValue: string;
  hasCollectibles: string; collectiblesValue: string; householdGoodsValue: string; otherPropertyDesc: string;
  securedDebt: string; creditCardDebt: string; medicalDebt: string; studentLoanDebt: string;
  taxDebt: string; personalLoanDebt: string; otherUnsecured: string; primaryReason: string;
  hasPriorBK: string; priorBankruptcies: Array<{ id: number; chapter: string; yearFiled: string; district: string; discharged: string; dismissedReason: string; caseNumber: string }>;
  pendingLawsuits: string; lawsuitDetails: string; garnishment: string; garnishmentDetails: string;
  hasTransfers: string;
  transfers: Array<{ id: number; description: string; recipient: string; relationship: string; amount: string; date: string; transferType: string }>;
  hasPreferentialPayments: string;
  preferentialPayments: Array<{ id: number; creditor: string; amount: string; date: string; relationship: string }>;
  ownedBusiness: string; businessDetails: string; expectedRefund: string; refundAmount: string;
  recentLuxury: string; luxuryDetails: string;
}

const US_STATES_CONSULT = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming","District of Columbia"];

const CONSULT_STEPS = [
  { id: "residency",     label: "Residency",         icon: Home },
  { id: "identity",      label: "Identity",           icon: User },
  { id: "household",     label: "Household",          icon: Users },
  { id: "income",        label: "Income",             icon: Briefcase },
  { id: "expenses",      label: "Expenses",           icon: DollarSign },
  { id: "real-prop",     label: "Real Property",      icon: Building },
  { id: "personal-prop", label: "Personal Property",  icon: PiggyBank },
  { id: "debts",         label: "Debts",              icon: CreditCard },
  { id: "history",       label: "Financial History",  icon: FileText },
  { id: "review",        label: "Review & Submit",    icon: CheckCircle2 },
];

function mkId() { return Date.now() + Math.random(); }

function ConsultIntakeModal({ lead, onClose, onSaved }: {
  lead: Lead;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [phase, setPhase]     = useState<"disclosure" | "intake" | "submitting" | "done">("disclosure");
  const [step, setStep]       = useState(0);
  const [scriptExpanded, setScriptExpanded] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill known lead data
  const nameParts = lead.full_name.trim().split(" ");
  const [data, setData] = useState<ConsultFormData>({
    filingType: "", state: lead.state ?? "", county: "", city: "", streetAddress: "", zipCode: "",
    movedToStateDate: "", inStateOver2Years: "",
    priorResidences: [],
    firstName: nameParts[0] ?? "", middleName: "", lastName: nameParts.slice(1).join(" ") ?? "",
    suffix: "", dob: "", ssn: "", email: lead.email ?? "", phone: lead.phone ?? "", altPhone: "",
    spouseFirstName: "", spouseMiddleName: "", spouseLastName: "", spouseDob: "", spouseEmail: "", spousePhone: "",
    maritalStatus: "", dependents: [],
    incomeSources: [{ id: 1, person: "debtor", personLabel: "Debtor", sourceType: "", employerOrSource: "", payFrequency: "", grossPerPeriod: "", netPerPeriod: "" }],
    hasOtherHouseholdMembers: "", avgMonthly6: "",
    expRentMortgage: "", expUtilities: "", expFood: "", expTransportation: "",
    expHealthcare: "", expInsurance: "", expChildcare: "", expOtherExpenses: "", expOtherDesc: "",
    ownsRealEstate: "", realProperties: [],
    vehicles: [], noVehicles: false, bankBalance: "", retirementBalance: "",
    hasStocks: "", stocksValue: "", hasCrypto: "", cryptoValue: "",
    hasLifeInsurance: "", lifeInsuranceCashValue: "", hasFirearms: "", firearmValue: "",
    hasCollectibles: "", collectiblesValue: "", householdGoodsValue: "", otherPropertyDesc: "",
    securedDebt: "", creditCardDebt: "", medicalDebt: "", studentLoanDebt: "",
    taxDebt: "", personalLoanDebt: "", otherUnsecured: "", primaryReason: "",
    hasPriorBK: "", priorBankruptcies: [],
    pendingLawsuits: "", lawsuitDetails: "", garnishment: "", garnishmentDetails: "",
    hasTransfers: "", transfers: [],
    hasPreferentialPayments: "", preferentialPayments: [],
    ownedBusiness: "", businessDetails: "", expectedRefund: "", refundAmount: "",
    recentLuxury: "", luxuryDetails: "",
  });

  function set(key: keyof ConsultFormData, value: unknown) {
    setData(prev => ({ ...prev, [key]: value }));
  }

  const inp   = "w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-400/60 transition-all";
  const sel   = "w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400/60 transition-all appearance-none";
  const lbl   = "block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide";
  const txtA  = "w-full bg-slate-800/60 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-400/60 transition-all resize-none";

  function YN({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <div className="flex gap-2">
        {["yes","no"].map(v => (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
              value === v ? (v === "yes" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/20")
              : "bg-slate-800/40 text-slate-500 border-slate-700/60 hover:border-slate-600"}`}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
    );
  }

  const currentScript = CONSULT_SCRIPTS[step]?.script ?? "";

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const payload = {
        filing_type: data.filingType || "individual",
        state: data.state, county: data.county || null, city: data.city, street_address: data.streetAddress,
        zip_code: data.zipCode, in_state_over_2_years: data.inStateOver2Years === "yes",
        moved_to_state_date: data.movedToStateDate || null,
        prior_residences_json: data.priorResidences.length > 0 ? data.priorResidences : null,
        exemption_state: data.state,
        first_name: data.firstName, middle_name: data.middleName || null,
        last_name: data.lastName, suffix: data.suffix || null,
        dob: data.dob, ssn_last4: data.ssn, email: data.email, phone: data.phone,
        alt_phone: data.altPhone || null,
        spouse_first_name: data.spouseFirstName || null, spouse_last_name: data.spouseLastName || null,
        spouse_dob: data.spouseDob || null, spouse_email: data.spouseEmail || null,
        marital_status: data.maritalStatus, num_dependents: data.dependents.length,
        dependents_json: data.dependents.length > 0 ? data.dependents : null,
        income_sources_json: data.incomeSources.filter(s => s.sourceType),
        exp_rent_mortgage: parseFloat(data.expRentMortgage) || 0,
        exp_utilities: parseFloat(data.expUtilities) || 0, exp_food: parseFloat(data.expFood) || 0,
        exp_transportation: parseFloat(data.expTransportation) || 0, exp_healthcare: parseFloat(data.expHealthcare) || 0,
        exp_insurance: parseFloat(data.expInsurance) || 0, exp_childcare: parseFloat(data.expChildcare) || 0,
        exp_other: parseFloat(data.expOtherExpenses) || 0,
        owns_real_estate: data.ownsRealEstate === "yes",
        real_properties_json: data.realProperties.length > 0 ? data.realProperties : null,
        vehicles_json: data.vehicles.length > 0 ? data.vehicles : null,
        no_vehicles: data.noVehicles,
        bank_balance: parseFloat(data.bankBalance) || 0,
        retirement_balance: parseFloat(data.retirementBalance) || 0,
        has_stocks: data.hasStocks === "yes", stocks_value: parseFloat(data.stocksValue) || null,
        has_crypto: data.hasCrypto === "yes", crypto_value: parseFloat(data.cryptoValue) || null,
        has_life_insurance: data.hasLifeInsurance === "yes", life_insurance_cash_value: parseFloat(data.lifeInsuranceCashValue) || null,
        has_firearms: data.hasFirearms === "yes", firearm_value: parseFloat(data.firearmValue) || null,
        has_collectibles: data.hasCollectibles === "yes", collectibles_value: parseFloat(data.collectiblesValue) || null,
        household_goods_value: parseFloat(data.householdGoodsValue) || 0,
        other_property_desc: data.otherPropertyDesc || null,
        secured_debt: parseFloat(data.securedDebt) || 0, credit_card_debt: parseFloat(data.creditCardDebt) || 0,
        medical_debt: parseFloat(data.medicalDebt) || 0, student_loan_debt: parseFloat(data.studentLoanDebt) || 0,
        tax_debt: parseFloat(data.taxDebt) || 0, personal_loan_debt: parseFloat(data.personalLoanDebt) || 0,
        other_unsecured: parseFloat(data.otherUnsecured) || 0, primary_reason: data.primaryReason,
        has_prior_bk: data.hasPriorBK === "yes",
        prior_bankruptcies_json: data.priorBankruptcies.length > 0 ? data.priorBankruptcies : null,
        pending_lawsuits: data.pendingLawsuits === "yes", lawsuit_details: data.lawsuitDetails || null,
        garnishment: data.garnishment === "yes", garnishment_details: data.garnishmentDetails || null,
        has_transfers: data.hasTransfers === "yes",
        transfers_json: data.transfers.length > 0 ? data.transfers : null,
        has_preferential_payments: data.hasPreferentialPayments === "yes",
        preferential_payments_json: data.preferentialPayments.length > 0 ? data.preferentialPayments : null,
        owned_business: data.ownedBusiness === "yes", business_details: data.businessDetails || null,
        expected_refund: data.expectedRefund === "yes", refund_amount: parseFloat(data.refundAmount) || null,
        recent_luxury: data.recentLuxury === "yes", luxury_details: data.luxuryDetails || null,
        status: "pending_review",
        submitted_at: new Date().toISOString(),
        completed_by_staff: true,
      };

      const res = await sbPost("intake_submissions", payload);
      const submissionId = Array.isArray(res) ? res[0]?.id : res?.id;

      await sbPatch("intake_leads", lead.id, {
        intake_completed: true,
        client_prefilled: false,
        status: "intake_complete",
        submission_id: submissionId ?? null,
        last_contact_at: new Date().toISOString(),
      });

      setPhase("done");
    } catch {
      // keep submitting false so user can retry
    }
    setSubmitting(false);
  }

  // ── Render: Disclosure ──
  if (phase === "disclosure") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-lg bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                <Shield className="w-4.5 h-4.5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Required Disclosure</h3>
                <p className="text-xs text-slate-500">Read to client before beginning the consultation</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white p-1 transition-colors"><X className="w-4 h-4" /></button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Mic className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">Read Aloud to Client</p>
                  <p className="text-sm text-slate-200 leading-relaxed italic">
                    "My name is [your name] and I'm a legal intake specialist with this firm. I am <strong className="not-italic text-white">not an attorney</strong> and I <strong className="not-italic text-white">cannot provide legal advice</strong>. Nothing I say during this call should be interpreted as legal advice.
                  </p>
                  <p className="text-sm text-slate-200 leading-relaxed italic mt-2">
                    The purpose of this consultation is to collect information about your financial situation. Your responses will be reviewed by one of our licensed attorneys, who will evaluate your eligibility and contact you directly with their findings.
                  </p>
                  <p className="text-sm text-slate-200 leading-relaxed italic mt-2">
                    Do you understand and agree to proceed on that basis?"
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-2.5">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Before You Begin</p>
              {[
                "Confirm client understands you are not an attorney",
                "Confirm client agrees to proceed",
                "Have client's ID or contact info available for verification",
                "Ensure you are in a private setting — this is confidential information",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[8px] font-bold text-slate-400">{i + 1}</span>
                  </div>
                  <p className="text-xs text-slate-400">{item}</p>
                </div>
              ))}
            </div>

            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                <User className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">{lead.full_name}</p>
                <p className="text-xs text-slate-500">{lead.phone ?? lead.email ?? "No contact info"}</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-800 flex justify-between">
            <button onClick={onClose} className="text-sm text-slate-500 hover:text-white transition-colors">Cancel</button>
            <button onClick={() => setPhase("intake")}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm rounded-xl transition-all">
              <Play className="w-4 h-4" /> Begin Consultation
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Done ──
  if (phase === "done") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-md bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl p-8 text-center" onClick={e => e.stopPropagation()}>
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Intake Complete</h3>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            {lead.full_name}'s intake has been saved and the status has been updated to <span className="text-blue-400 font-semibold">Intake Complete</span>. The case is ready to be sent for attorney review.
          </p>
          <button onClick={onSaved}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm rounded-xl transition-all">
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Intake Steps ──
  const StepIcon = CONSULT_STEPS[step].icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <StepIcon className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Step {step + 1} of {CONSULT_STEPS.length} · {lead.full_name}</p>
              <h3 className="text-sm font-bold text-white">{CONSULT_STEPS[step].label}</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {/* Step progress pills */}
        <div className="px-5 pt-3 pb-1 flex gap-1 flex-shrink-0 overflow-x-auto">
          {CONSULT_STEPS.map((s, i) => (
            <button key={s.id} onClick={() => i < step && setStep(i)}
              className={`flex-shrink-0 h-1.5 rounded-full transition-all ${
                i === step ? "bg-amber-400 w-8" :
                i < step   ? "bg-emerald-500/60 w-4 cursor-pointer hover:bg-emerald-400" :
                             "bg-slate-700 w-4 cursor-default"
              }`} />
          ))}
        </div>

        {/* Script banner */}
        <div className="px-5 py-2 flex-shrink-0">
          <button onClick={() => setScriptExpanded(x => !x)}
            className="w-full flex items-center gap-2 bg-amber-500/8 hover:bg-amber-500/12 border border-amber-500/20 rounded-xl px-3.5 py-2.5 transition-all text-left">
            <Mic className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex-1">Script — Read to Client</span>
            <ChevronLeft className={`w-3.5 h-3.5 text-amber-400 transition-transform ${scriptExpanded ? "-rotate-90" : "rotate-0"}`} />
          </button>
          {scriptExpanded && (
            <div className="mt-2 bg-slate-900/60 border border-slate-700/60 rounded-xl px-4 py-3">
              <p className="text-sm text-slate-300 leading-relaxed italic whitespace-pre-line">{currentScript}</p>
            </div>
          )}
        </div>

        {/* Form fields — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">

          {/* ── Step 0: Residency ── */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className={lbl}>Filing Type</label>
                <select value={data.filingType} onChange={e => set("filingType", e.target.value)} className={sel}>
                  <option value="">Select…</option>
                  <option value="individual">Individual (Single)</option>
                  <option value="individual-nonfiling-spouse">Married — Non-Filing Spouse</option>
                  <option value="joint">Married — Joint Filing</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>State</label>
                  <select value={data.state} onChange={e => set("state", e.target.value)} className={sel}>
                    <option value="">Select…</option>
                    {US_STATES_CONSULT.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>County</label>
                  <input value={data.county} onChange={e => set("county", e.target.value)} className={inp} placeholder="County" />
                </div>
                <div>
                  <label className={lbl}>City</label>
                  <input value={data.city} onChange={e => set("city", e.target.value)} className={inp} placeholder="City" />
                </div>
                <div>
                  <label className={lbl}>ZIP Code</label>
                  <input value={data.zipCode} onChange={e => set("zipCode", e.target.value)} className={inp} placeholder="ZIP" />
                </div>
              </div>
              <div>
                <label className={lbl}>Street Address</label>
                <input value={data.streetAddress} onChange={e => set("streetAddress", e.target.value)} className={inp} placeholder="123 Main St" />
              </div>
              <div>
                <label className={lbl}>Lived in {data.state || "this state"} for 2+ years?</label>
                <YN value={data.inStateOver2Years} onChange={v => set("inStateOver2Years", v)} />
              </div>
              {data.inStateOver2Years === "no" && (
                <div>
                  <label className={lbl}>When did you move to {data.state || "this state"}? (YYYY-MM)</label>
                  <input value={data.movedToStateDate} onChange={e => set("movedToStateDate", e.target.value)} className={inp} placeholder="2023-06" />
                  <p className="text-[11px] text-slate-500 mt-1">Add prior states below so we can calculate the correct exemptions.</p>
                  {data.priorResidences.map((r, i) => (
                    <div key={r.id} className="mt-2 bg-slate-800/40 rounded-xl p-3 grid grid-cols-2 gap-2">
                      <div><label className={lbl}>State</label>
                        <select value={r.state} onChange={e => { const a = [...data.priorResidences]; a[i].state = e.target.value; set("priorResidences", a); }} className={sel}>
                          <option value="">Select…</option>{US_STATES_CONSULT.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div><label className={lbl}>City</label>
                        <input value={r.city} onChange={e => { const a = [...data.priorResidences]; a[i].city = e.target.value; set("priorResidences", a); }} className={inp} placeholder="City" />
                      </div>
                      <div><label className={lbl}>From (YYYY-MM)</label>
                        <input value={r.fromDate} onChange={e => { const a = [...data.priorResidences]; a[i].fromDate = e.target.value; set("priorResidences", a); }} className={inp} placeholder="2020-01" />
                      </div>
                      <div><label className={lbl}>To (YYYY-MM / blank=present)</label>
                        <input value={r.toDate} onChange={e => { const a = [...data.priorResidences]; a[i].toDate = e.target.value; set("priorResidences", a); }} className={inp} placeholder="2023-05" />
                      </div>
                      <button onClick={() => set("priorResidences", data.priorResidences.filter((_, j) => j !== i))}
                        className="col-span-2 flex items-center gap-1 text-xs text-red-400 hover:text-red-300 mt-1"><Trash2 className="w-3 h-3" /> Remove</button>
                    </div>
                  ))}
                  <button onClick={() => set("priorResidences", [...data.priorResidences, { id: mkId(), state: "", city: "", fromDate: "", toDate: "" }])}
                    className="mt-2 flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add Prior State
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 1: Identity ── */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div><label className={lbl}>First Name *</label><input value={data.firstName} onChange={e => set("firstName", e.target.value)} className={inp} placeholder="First" /></div>
                <div><label className={lbl}>Middle Name</label><input value={data.middleName} onChange={e => set("middleName", e.target.value)} className={inp} placeholder="Middle" /></div>
                <div><label className={lbl}>Last Name *</label><input value={data.lastName} onChange={e => set("lastName", e.target.value)} className={inp} placeholder="Last" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Suffix</label>
                  <select value={data.suffix} onChange={e => set("suffix", e.target.value)} className={sel}>
                    <option value="">None</option><option>Jr.</option><option>Sr.</option><option>II</option><option>III</option><option>IV</option>
                  </select>
                </div>
                <div><label className={lbl}>Date of Birth *</label><input type="date" value={data.dob} onChange={e => set("dob", e.target.value)} className={inp} /></div>
                <div><label className={lbl}>SSN (Last 4) *</label><input value={data.ssn} onChange={e => set("ssn", e.target.value)} className={inp} placeholder="####" maxLength={4} /></div>
                <div><label className={lbl}>Email *</label><input type="email" value={data.email} onChange={e => set("email", e.target.value)} className={inp} placeholder="email@example.com" /></div>
                <div><label className={lbl}>Phone *</label><input value={data.phone} onChange={e => set("phone", e.target.value)} className={inp} placeholder="(555) 555-5555" /></div>
                <div><label className={lbl}>Alt Phone</label><input value={data.altPhone} onChange={e => set("altPhone", e.target.value)} className={inp} placeholder="Optional" /></div>
              </div>
              {(data.filingType === "individual-nonfiling-spouse" || data.filingType === "joint") && (
                <div className="border-t border-slate-700/60 pt-3 space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Spouse Information</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={lbl}>First Name</label><input value={data.spouseFirstName} onChange={e => set("spouseFirstName", e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Middle Name</label><input value={data.spouseMiddleName} onChange={e => set("spouseMiddleName", e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Last Name</label><input value={data.spouseLastName} onChange={e => set("spouseLastName", e.target.value)} className={inp} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Date of Birth</label><input type="date" value={data.spouseDob} onChange={e => set("spouseDob", e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Email</label><input type="email" value={data.spouseEmail} onChange={e => set("spouseEmail", e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Phone</label><input value={data.spousePhone} onChange={e => set("spousePhone", e.target.value)} className={inp} /></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Household ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className={lbl}>Marital Status *</label>
                <select value={data.maritalStatus} onChange={e => set("maritalStatus", e.target.value)} className={sel}>
                  <option value="">Select…</option>
                  <option value="single">Single</option><option value="married">Married</option>
                  <option value="separated">Separated</option><option value="divorced">Divorced</option><option value="widowed">Widowed</option>
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dependents</p>
                  <button onClick={() => set("dependents", [...data.dependents, { id: mkId(), relationship: "", age: "", name: "", disabled: false, disabledDesc: "", monthlyContribution: "", contributesToHousehold: "", incomeSources: [] }])}
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"><Plus className="w-3 h-3" /> Add</button>
                </div>
                {data.dependents.length === 0 && <p className="text-xs text-slate-600 italic">No dependents added.</p>}
                {data.dependents.map((dep, i) => (
                  <div key={dep.id} className="bg-slate-800/40 rounded-xl p-3 mb-2 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div><label className={lbl}>Relationship</label>
                        <select value={dep.relationship} onChange={e => { const a = [...data.dependents]; a[i].relationship = e.target.value; set("dependents", a); }} className={sel}>
                          <option value="">Select…</option><option>Child</option><option>Spouse</option><option>Parent</option><option>Sibling</option><option>Other</option>
                        </select>
                      </div>
                      <div><label className={lbl}>Name</label><input value={dep.name} onChange={e => { const a = [...data.dependents]; a[i].name = e.target.value; set("dependents", a); }} className={inp} placeholder="Name" /></div>
                      <div><label className={lbl}>Age</label><input value={dep.age} onChange={e => { const a = [...data.dependents]; a[i].age = e.target.value; set("dependents", a); }} className={inp} placeholder="Age" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={lbl}>Monthly Contribution</label><input value={dep.monthlyContribution} onChange={e => { const a = [...data.dependents]; a[i].monthlyContribution = e.target.value; set("dependents", a); }} className={inp} placeholder="$0" /></div>
                      <div><label className={lbl}>Contributes to Household?</label>
                        <select value={dep.contributesToHousehold} onChange={e => { const a = [...data.dependents]; a[i].contributesToHousehold = e.target.value; set("dependents", a); }} className={sel}>
                          <option value="">Select…</option><option value="yes">Yes</option><option value="no">No</option>
                        </select>
                      </div>
                    </div>
                    <button onClick={() => set("dependents", data.dependents.filter((_, j) => j !== i))}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"><Trash2 className="w-3 h-3" /> Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 3: Income ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Income Sources</p>
                <button onClick={() => set("incomeSources", [...data.incomeSources, { id: mkId(), person: "debtor", personLabel: "Debtor", sourceType: "", employerOrSource: "", payFrequency: "", grossPerPeriod: "", netPerPeriod: "" }])}
                  className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"><Plus className="w-3 h-3" /> Add Source</button>
              </div>
              {data.incomeSources.map((src, i) => (
                <div key={src.id} className="bg-slate-800/40 rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>Person</label>
                      <select value={src.person} onChange={e => { const a = [...data.incomeSources]; a[i].person = e.target.value; a[i].personLabel = e.target.value === "debtor" ? "Debtor" : e.target.value === "spouse" ? "Spouse" : "Household Member"; set("incomeSources", a); }} className={sel}>
                        <option value="debtor">Debtor</option><option value="spouse">Spouse</option><option value="household">Household Member</option>
                      </select>
                    </div>
                    <div><label className={lbl}>Source Type</label>
                      <select value={src.sourceType} onChange={e => { const a = [...data.incomeSources]; a[i].sourceType = e.target.value; set("incomeSources", a); }} className={sel}>
                        <option value="">Select…</option><option value="employed">Employed</option><option value="self_employed">Self-Employed</option>
                        <option value="retirement">Retirement/Pension</option><option value="social_security">Social Security</option>
                        <option value="ssdi">SSDI</option><option value="ssi">SSI</option><option value="unemployment">Unemployment</option><option value="other">Other</option>
                      </select>
                    </div>
                    <div><label className={lbl}>Employer / Source</label><input value={src.employerOrSource} onChange={e => { const a = [...data.incomeSources]; a[i].employerOrSource = e.target.value; set("incomeSources", a); }} className={inp} placeholder="Employer or source name" /></div>
                    <div><label className={lbl}>Pay Frequency</label>
                      <select value={src.payFrequency} onChange={e => { const a = [...data.incomeSources]; a[i].payFrequency = e.target.value; set("incomeSources", a); }} className={sel}>
                        <option value="">Select…</option><option value="weekly">Weekly</option><option value="biweekly">Bi-Weekly</option>
                        <option value="semi_monthly">Semi-Monthly</option><option value="monthly">Monthly</option><option value="annual">Annual</option>
                      </select>
                    </div>
                    <div><label className={lbl}>Gross Per Period</label><input value={src.grossPerPeriod} onChange={e => { const a = [...data.incomeSources]; a[i].grossPerPeriod = e.target.value; set("incomeSources", a); }} className={inp} placeholder="$0.00" /></div>
                    <div><label className={lbl}>Net Per Period</label><input value={src.netPerPeriod} onChange={e => { const a = [...data.incomeSources]; a[i].netPerPeriod = e.target.value; set("incomeSources", a); }} className={inp} placeholder="$0.00" /></div>
                  </div>
                  {i > 0 && <button onClick={() => set("incomeSources", data.incomeSources.filter((_, j) => j !== i))}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"><Trash2 className="w-3 h-3" /> Remove</button>}
                </div>
              ))}
              <div>
                <label className={lbl}>Average Monthly Income (Last 6 Months)</label>
                <input value={data.avgMonthly6} onChange={e => set("avgMonthly6", e.target.value)} className={inp} placeholder="$0.00" />
              </div>
            </div>
          )}

          {/* ── Step 4: Expenses ── */}
          {step === 4 && (
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Rent / Mortgage", "expRentMortgage"],
                ["Utilities", "expUtilities"],
                ["Food / Groceries", "expFood"],
                ["Transportation", "expTransportation"],
                ["Healthcare", "expHealthcare"],
                ["Insurance", "expInsurance"],
                ["Childcare", "expChildcare"],
                ["Other Expenses", "expOtherExpenses"],
              ].map(([label, key]) => (
                <div key={key}>
                  <label className={lbl}>{label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                    <input value={(data as Record<string, unknown>)[key] as string} onChange={e => set(key as keyof ConsultFormData, e.target.value)} className={`${inp} pl-7`} placeholder="0.00" />
                  </div>
                </div>
              ))}
              <div className="col-span-2">
                <label className={lbl}>Other Expenses — Description</label>
                <input value={data.expOtherDesc} onChange={e => set("expOtherDesc", e.target.value)} className={inp} placeholder="Describe other expenses" />
              </div>
            </div>
          )}

          {/* ── Step 5: Real Property ── */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <label className={lbl}>Do you own any real estate?</label>
                <YN value={data.ownsRealEstate} onChange={v => set("ownsRealEstate", v)} />
              </div>
              {data.ownsRealEstate === "yes" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Properties</p>
                    <button onClick={() => set("realProperties", [...data.realProperties, { id: mkId(), address: "", type: "", value: "", mortgageBalance: "", lender: "", isCurrent: "" }])}
                      className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"><Plus className="w-3 h-3" /> Add</button>
                  </div>
                  {data.realProperties.map((p, i) => (
                    <div key={p.id} className="bg-slate-800/40 rounded-xl p-3 space-y-2">
                      <div><label className={lbl}>Address</label><input value={p.address} onChange={e => { const a = [...data.realProperties]; a[i].address = e.target.value; set("realProperties", a); }} className={inp} placeholder="123 Main St, City, ST" /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className={lbl}>Type</label>
                          <select value={p.type} onChange={e => { const a = [...data.realProperties]; a[i].type = e.target.value; set("realProperties", a); }} className={sel}>
                            <option value="">Select…</option><option value="primary">Primary Residence</option><option value="investment">Investment</option><option value="other">Other</option>
                          </select>
                        </div>
                        <div><label className={lbl}>Estimated Value</label><input value={p.value} onChange={e => { const a = [...data.realProperties]; a[i].value = e.target.value; set("realProperties", a); }} className={inp} placeholder="$0" /></div>
                        <div><label className={lbl}>Mortgage Balance</label><input value={p.mortgageBalance} onChange={e => { const a = [...data.realProperties]; a[i].mortgageBalance = e.target.value; set("realProperties", a); }} className={inp} placeholder="$0" /></div>
                        <div><label className={lbl}>Lender</label><input value={p.lender} onChange={e => { const a = [...data.realProperties]; a[i].lender = e.target.value; set("realProperties", a); }} className={inp} placeholder="Lender name" /></div>
                      </div>
                      <div><label className={lbl}>Current on Payments?</label>
                        <YN value={p.isCurrent} onChange={v => { const a = [...data.realProperties]; a[i].isCurrent = v; set("realProperties", a); }} />
                      </div>
                      <button onClick={() => set("realProperties", data.realProperties.filter((_, j) => j !== i))}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"><Trash2 className="w-3 h-3" /> Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 6: Personal Property ── */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vehicles</p>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={data.noVehicles} onChange={e => set("noVehicles", e.target.checked)} className="accent-amber-400" />
                    No vehicles
                  </label>
                  {!data.noVehicles && <button onClick={() => set("vehicles", [...data.vehicles, { id: mkId(), year: "", make: "", model: "", value: "", hasLoan: "", loanBalance: "" }])}
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"><Plus className="w-3 h-3" /> Add</button>}
                </div>
              </div>
              {!data.noVehicles && data.vehicles.map((v, i) => (
                <div key={v.id} className="bg-slate-800/40 rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className={lbl}>Year</label><input value={v.year} onChange={e => { const a = [...data.vehicles]; a[i].year = e.target.value; set("vehicles", a); }} className={inp} placeholder="2020" /></div>
                    <div><label className={lbl}>Make</label><input value={v.make} onChange={e => { const a = [...data.vehicles]; a[i].make = e.target.value; set("vehicles", a); }} className={inp} placeholder="Toyota" /></div>
                    <div><label className={lbl}>Model</label><input value={v.model} onChange={e => { const a = [...data.vehicles]; a[i].model = e.target.value; set("vehicles", a); }} className={inp} placeholder="Camry" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>Value</label><input value={v.value} onChange={e => { const a = [...data.vehicles]; a[i].value = e.target.value; set("vehicles", a); }} className={inp} placeholder="$0" /></div>
                    <div><label className={lbl}>Has Loan?</label><YN value={v.hasLoan} onChange={val => { const a = [...data.vehicles]; a[i].hasLoan = val; set("vehicles", a); }} /></div>
                    {v.hasLoan === "yes" && <div><label className={lbl}>Loan Balance</label><input value={v.loanBalance} onChange={e => { const a = [...data.vehicles]; a[i].loanBalance = e.target.value; set("vehicles", a); }} className={inp} placeholder="$0" /></div>}
                  </div>
                  <button onClick={() => set("vehicles", data.vehicles.filter((_, j) => j !== i))}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"><Trash2 className="w-3 h-3" /> Remove</button>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Bank / Checking / Savings Balance", "bankBalance"],
                  ["Retirement Account Balance", "retirementBalance"],
                  ["Household Goods Value", "householdGoodsValue"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label className={lbl}>{label}</label>
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                      <input value={(data as Record<string, unknown>)[key] as string} onChange={e => set(key as keyof ConsultFormData, e.target.value)} className={`${inp} pl-7`} placeholder="0.00" />
                    </div>
                  </div>
                ))}
              </div>
              {[
                { label: "Stocks / Investments?", hasKey: "hasStocks", valKey: "stocksValue" },
                { label: "Cryptocurrency?",        hasKey: "hasCrypto", valKey: "cryptoValue" },
                { label: "Life Insurance (cash value)?", hasKey: "hasLifeInsurance", valKey: "lifeInsuranceCashValue" },
                { label: "Firearms?",              hasKey: "hasFirearms", valKey: "firearmValue" },
                { label: "Collectibles / Art?",    hasKey: "hasCollectibles", valKey: "collectiblesValue" },
              ].map(({ label, hasKey, valKey }) => (
                <div key={hasKey} className="bg-slate-800/30 rounded-xl p-3 space-y-2">
                  <div><label className={lbl}>{label}</label>
                    <YN value={(data as Record<string, unknown>)[hasKey] as string} onChange={v => set(hasKey as keyof ConsultFormData, v)} />
                  </div>
                  {(data as Record<string, unknown>)[hasKey] === "yes" && (
                    <div><label className={lbl}>Value</label>
                      <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                        <input value={(data as Record<string, unknown>)[valKey] as string} onChange={e => set(valKey as keyof ConsultFormData, e.target.value)} className={`${inp} pl-7`} placeholder="0.00" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div><label className={lbl}>Other Property — Description</label>
                <textarea value={data.otherPropertyDesc} onChange={e => set("otherPropertyDesc", e.target.value)} className={txtA} rows={2} placeholder="Describe any other property of value" />
              </div>
            </div>
          )}

          {/* ── Step 7: Debts ── */}
          {step === 7 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Secured Debt (mortgages, car loans)", "securedDebt"],
                  ["Credit Card Debt", "creditCardDebt"],
                  ["Medical Debt", "medicalDebt"],
                  ["Student Loan Debt", "studentLoanDebt"],
                  ["Tax Debt (IRS / state)", "taxDebt"],
                  ["Personal Loans", "personalLoanDebt"],
                  ["Other Unsecured Debt", "otherUnsecured"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label className={lbl}>{label}</label>
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                      <input value={(data as Record<string, unknown>)[key] as string} onChange={e => set(key as keyof ConsultFormData, e.target.value)} className={`${inp} pl-7`} placeholder="0.00" />
                    </div>
                  </div>
                ))}
              </div>
              <div><label className={lbl}>Primary Reason for Filing *</label>
                <select value={data.primaryReason} onChange={e => set("primaryReason", e.target.value)} className={sel}>
                  <option value="">Select…</option>
                  <option value="job_loss">Job Loss / Reduced Income</option>
                  <option value="medical">Medical Bills / Health Crisis</option>
                  <option value="divorce">Divorce / Separation</option>
                  <option value="credit_cards">Overwhelming Credit Card Debt</option>
                  <option value="foreclosure">Foreclosure Prevention</option>
                  <option value="garnishment">Wage Garnishment / Judgment</option>
                  <option value="business_failure">Business Failure</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          )}

          {/* ── Step 8: Financial History ── */}
          {step === 8 && (
            <div className="space-y-4">
              {[
                { label: "Prior bankruptcy filed?", key: "hasPriorBK" },
                { label: "Any pending lawsuits against you?", key: "pendingLawsuits" },
                { label: "Any wage garnishment or bank levies?", key: "garnishment" },
                { label: "Any transfers of property/money over $600 in last 2 years?", key: "hasTransfers" },
                { label: "Any payments to creditors over $600 in last 90 days?", key: "hasPreferentialPayments" },
                { label: "Have you owned a business in last 6 years?", key: "ownedBusiness" },
                { label: "Expecting a tax refund this year?", key: "expectedRefund" },
                { label: "Any luxury purchases over $500 in last 90 days?", key: "recentLuxury" },
              ].map(({ label, key }) => (
                <div key={key} className="space-y-2">
                  <label className={lbl}>{label}</label>
                  <YN value={(data as Record<string, unknown>)[key] as string} onChange={v => set(key as keyof ConsultFormData, v)} />
                  {key === "pendingLawsuits" && data.pendingLawsuits === "yes" && (
                    <textarea value={data.lawsuitDetails} onChange={e => set("lawsuitDetails", e.target.value)} className={txtA} rows={2} placeholder="Describe the lawsuits…" />
                  )}
                  {key === "garnishment" && data.garnishment === "yes" && (
                    <textarea value={data.garnishmentDetails} onChange={e => set("garnishmentDetails", e.target.value)} className={txtA} rows={2} placeholder="Describe the garnishment…" />
                  )}
                  {key === "ownedBusiness" && data.ownedBusiness === "yes" && (
                    <textarea value={data.businessDetails} onChange={e => set("businessDetails", e.target.value)} className={txtA} rows={2} placeholder="Business name, type, status…" />
                  )}
                  {key === "expectedRefund" && data.expectedRefund === "yes" && (
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                      <input value={data.refundAmount} onChange={e => set("refundAmount", e.target.value)} className={`${inp} pl-7`} placeholder="Estimated refund amount" />
                    </div>
                  )}
                  {key === "recentLuxury" && data.recentLuxury === "yes" && (
                    <textarea value={data.luxuryDetails} onChange={e => set("luxuryDetails", e.target.value)} className={txtA} rows={2} placeholder="Describe the purchases…" />
                  )}
                  {key === "hasPriorBK" && data.hasPriorBK === "yes" && (
                    <div className="space-y-2">
                      {data.priorBankruptcies.map((bk, i) => (
                        <div key={bk.id} className="bg-slate-800/40 rounded-xl p-3 grid grid-cols-2 gap-2">
                          <div><label className={lbl}>Chapter</label>
                            <select value={bk.chapter} onChange={e => { const a = [...data.priorBankruptcies]; a[i].chapter = e.target.value; set("priorBankruptcies", a); }} className={sel}>
                              <option value="">Select…</option><option value="7">Chapter 7</option><option value="13">Chapter 13</option><option value="other">Other</option>
                            </select>
                          </div>
                          <div><label className={lbl}>Year Filed</label><input value={bk.yearFiled} onChange={e => { const a = [...data.priorBankruptcies]; a[i].yearFiled = e.target.value; set("priorBankruptcies", a); }} className={inp} placeholder="2018" /></div>
                          <div><label className={lbl}>District</label><input value={bk.district} onChange={e => { const a = [...data.priorBankruptcies]; a[i].district = e.target.value; set("priorBankruptcies", a); }} className={inp} placeholder="N.D. Illinois" /></div>
                          <div><label className={lbl}>Case Number</label><input value={bk.caseNumber} onChange={e => { const a = [...data.priorBankruptcies]; a[i].caseNumber = e.target.value; set("priorBankruptcies", a); }} className={inp} placeholder="18-12345" /></div>
                          <div><label className={lbl}>Discharged?</label>
                            <YN value={bk.discharged} onChange={v => { const a = [...data.priorBankruptcies]; a[i].discharged = v; set("priorBankruptcies", a); }} />
                          </div>
                          <button onClick={() => set("priorBankruptcies", data.priorBankruptcies.filter((_, j) => j !== i))}
                            className="col-span-2 flex items-center gap-1 text-xs text-red-400 hover:text-red-300"><Trash2 className="w-3 h-3" /> Remove</button>
                        </div>
                      ))}
                      <button onClick={() => set("priorBankruptcies", [...data.priorBankruptcies, { id: mkId(), chapter: "", yearFiled: "", district: "", discharged: "", dismissedReason: "", caseNumber: "" }])}
                        className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"><Plus className="w-3 h-3" /> Add Prior BK</button>
                    </div>
                  )}
                  {key === "hasTransfers" && data.hasTransfers === "yes" && (
                    <div className="space-y-2">
                      {data.transfers.map((t, i) => (
                        <div key={t.id} className="bg-slate-800/40 rounded-xl p-3 grid grid-cols-2 gap-2">
                          <div className="col-span-2"><label className={lbl}>Description</label><input value={t.description} onChange={e => { const a = [...data.transfers]; a[i].description = e.target.value; set("transfers", a); }} className={inp} placeholder="What was transferred?" /></div>
                          <div><label className={lbl}>Recipient</label><input value={t.recipient} onChange={e => { const a = [...data.transfers]; a[i].recipient = e.target.value; set("transfers", a); }} className={inp} /></div>
                          <div><label className={lbl}>Amount</label><input value={t.amount} onChange={e => { const a = [...data.transfers]; a[i].amount = e.target.value; set("transfers", a); }} className={inp} placeholder="$0" /></div>
                          <div><label className={lbl}>Date</label><input type="date" value={t.date} onChange={e => { const a = [...data.transfers]; a[i].date = e.target.value; set("transfers", a); }} className={inp} /></div>
                          <div><label className={lbl}>Relationship</label><input value={t.relationship} onChange={e => { const a = [...data.transfers]; a[i].relationship = e.target.value; set("transfers", a); }} className={inp} placeholder="Family, friend, etc." /></div>
                          <button onClick={() => set("transfers", data.transfers.filter((_, j) => j !== i))}
                            className="col-span-2 flex items-center gap-1 text-xs text-red-400 hover:text-red-300"><Trash2 className="w-3 h-3" /> Remove</button>
                        </div>
                      ))}
                      <button onClick={() => set("transfers", [...data.transfers, { id: mkId(), description: "", recipient: "", relationship: "", amount: "", date: "", transferType: "" }])}
                        className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"><Plus className="w-3 h-3" /> Add Transfer</button>
                    </div>
                  )}
                  {key === "hasPreferentialPayments" && data.hasPreferentialPayments === "yes" && (
                    <div className="space-y-2">
                      {data.preferentialPayments.map((pp, i) => (
                        <div key={pp.id} className="bg-slate-800/40 rounded-xl p-3 grid grid-cols-2 gap-2">
                          <div><label className={lbl}>Creditor</label><input value={pp.creditor} onChange={e => { const a = [...data.preferentialPayments]; a[i].creditor = e.target.value; set("preferentialPayments", a); }} className={inp} /></div>
                          <div><label className={lbl}>Amount</label><input value={pp.amount} onChange={e => { const a = [...data.preferentialPayments]; a[i].amount = e.target.value; set("preferentialPayments", a); }} className={inp} placeholder="$0" /></div>
                          <div><label className={lbl}>Date</label><input type="date" value={pp.date} onChange={e => { const a = [...data.preferentialPayments]; a[i].date = e.target.value; set("preferentialPayments", a); }} className={inp} /></div>
                          <div><label className={lbl}>Relationship</label><input value={pp.relationship} onChange={e => { const a = [...data.preferentialPayments]; a[i].relationship = e.target.value; set("preferentialPayments", a); }} className={inp} placeholder="Insider / arm's length" /></div>
                          <button onClick={() => set("preferentialPayments", data.preferentialPayments.filter((_, j) => j !== i))}
                            className="col-span-2 flex items-center gap-1 text-xs text-red-400 hover:text-red-300"><Trash2 className="w-3 h-3" /> Remove</button>
                        </div>
                      ))}
                      <button onClick={() => set("preferentialPayments", [...data.preferentialPayments, { id: mkId(), creditor: "", amount: "", date: "", relationship: "" }])}
                        className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"><Plus className="w-3 h-3" /> Add Payment</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Step 9: Review ── */}
          {step === 9 && (
            <div className="space-y-4">
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3 text-xs">
                <p className="font-bold text-slate-300 uppercase tracking-widest text-[10px]">Summary</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  <div className="text-slate-500">Name</div><div className="text-white font-medium">{[data.firstName, data.middleName, data.lastName].filter(Boolean).join(" ")}</div>
                  <div className="text-slate-500">State</div><div className="text-white font-medium">{data.state || "—"}</div>
                  <div className="text-slate-500">Filing Type</div><div className="text-white font-medium capitalize">{data.filingType?.replace(/-/g," ") || "—"}</div>
                  <div className="text-slate-500">Marital Status</div><div className="text-white font-medium capitalize">{data.maritalStatus || "—"}</div>
                  <div className="text-slate-500">Dependents</div><div className="text-white font-medium">{data.dependents.length}</div>
                  <div className="text-slate-500">Income Sources</div><div className="text-white font-medium">{data.incomeSources.filter(s => s.sourceType).length}</div>
                  <div className="text-slate-500">Owns Real Estate</div><div className="text-white font-medium capitalize">{data.ownsRealEstate || "—"}</div>
                  <div className="text-slate-500">Vehicles</div><div className="text-white font-medium">{data.noVehicles ? "None" : data.vehicles.length}</div>
                  <div className="text-slate-500">Prior BK</div><div className="text-white font-medium capitalize">{data.hasPriorBK || "—"}</div>
                  <div className="text-slate-500">Primary Reason</div><div className="text-white font-medium">{data.primaryReason?.replace(/_/g," ") || "—"}</div>
                  <div className="text-slate-500">Total Debt (est.)</div>
                  <div className="text-amber-400 font-bold">
                    ${(
                      (parseFloat(data.securedDebt)||0)+(parseFloat(data.creditCardDebt)||0)+(parseFloat(data.medicalDebt)||0)+
                      (parseFloat(data.studentLoanDebt)||0)+(parseFloat(data.taxDebt)||0)+(parseFloat(data.personalLoanDebt)||0)+(parseFloat(data.otherUnsecured)||0)
                    ).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
                <p className="text-xs font-bold text-amber-400 mb-3">Read to Client — Final Acknowledgment</p>
                <p className="text-sm text-slate-300 italic leading-relaxed">
                  "I've reviewed everything we've collected today. Before I submit this to the attorney team, I want to confirm: to the best of your knowledge, is all of this information accurate and complete? Are there any debts, assets, transfers, or other financial matters we haven't covered?"
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Staff Confirmation</p>
                {[
                  "Client confirmed all information is accurate and complete",
                  "Client was informed this is not legal advice and understands the case will be reviewed by an attorney",
                  "All required sections have been completed to the best of the client's knowledge",
                ].map((label, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox" id={`ack-${i}`} className="mt-0.5 accent-amber-400 w-4 h-4 flex-shrink-0" />
                    <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="px-5 py-3.5 border-t border-slate-800 flex items-center justify-between flex-shrink-0">
          <button onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" /> {step === 0 ? "Cancel" : "Back"}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600">{step + 1} / {CONSULT_STEPS.length}</span>
            {step < CONSULT_STEPS.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm rounded-xl transition-all">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50">
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Submit Intake
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Portal ──────────────────────────────────────────────────────────────

function IntakePortalInner({ session, onLogout }: { session: PortalSession; onLogout: () => void }) {
  const role      = session.role;
  const isAtty    = isAttorney(role);
  const isSuperAdmin = isSuperAdminRole(role);
  const canManageLeads  = !isAtty || isSuperAdmin; // legal_admin, super_admin, attorney_super_admin
  const canReviewCases  = isAtty || isSuperAdmin;  // attorneys + super admins
  const canManageStaff  = isSuperAdmin;

  const [leads, setLeads]             = useState<Lead[]>([]);
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [calEvents, setCalEvents]     = useState<CalEvent[]>([]);
  const [availability, setAvailability] = useState<StaffAvailability[]>([]);
  const [timeOff, setTimeOff]         = useState<TimeOff[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [presentationContext, setPresentationContext] = useState<{ lead: Lead; acceptance: Acceptance } | null>(null);

  // Default tab by role: attorneys land on attorney review queue; legal admins on leads
  const defaultTab = isAtty && !isSuperAdmin ? "followup" : "leads";
  const [activeTab, setActiveTab]     = useState<"leads" | "followup" | "calendar" | "availability" | "timeoff" | "sick_admin">(defaultTab);

  const load = useCallback(async () => {
    setLoading(true);
    const [ls, acs, evts, avail, toff] = await Promise.all([
      sbGet<Lead>("intake_leads?order=created_at.desc&limit=200"),
      sbGet<Acceptance>("attorney_case_acceptances?order=created_at.desc&limit=200"),
      sbGet<CalEvent>("calendar_events?department=eq.intake&order=start_time.asc&limit=300"),
      sbGet<StaffAvailability>("staff_availability?department=eq.intake&order=day_of_week.asc"),
      sbGet<TimeOff>("intake_staff_time_off?order=date.asc&limit=100"),
    ]);
    setLeads(ls);
    setAcceptances(acs);
    setCalEvents(evts);
    setAvailability(avail);
    setTimeOff(toff);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh selected lead when data reloads
  useEffect(() => {
    if (selectedLead) {
      const refreshed = leads.find(l => l.id === selectedLead.id);
      if (refreshed) setSelectedLead(refreshed);
    }
  }, [leads]);

  const filtered = leads.filter(l => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (urgencyFilter !== "all" && (l.urgency ?? "normal") !== urgencyFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.full_name.toLowerCase().includes(q)
        || (l.email ?? "").toLowerCase().includes(q)
        || (l.phone ?? "").includes(q);
    }
    return true;
  });

  // Queue = needs action
  const reviewQueue   = leads.filter(l => l.status === "sent_for_attorney_review");
  const emergencies   = leads.filter(l => l.urgency === "emergency");
  const todayConsult  = leads.filter(l => l.consultation_date === new Date().toISOString().slice(0, 10));
  const newLeads      = leads.filter(l => l.status === "new" || l.status === "contacted");
  const feeQuotedLeads = leads.filter(l => l.status === "fee_quoted");
  const retainedCount = leads.filter(l => l.status === "retained").length;

  function getAcceptance(leadId: string) {
    return acceptances.find(a => a.lead_id === leadId) ?? null;
  }

  // Full-screen case presentation flow — role-gated via PortalLogin upstream
  if (presentationContext) {
    const { lead: pLead, acceptance: pAcc } = presentationContext;
    const isBif = pAcc.case_type === "ch7_bifurcated";
    const chapter = String(pAcc.chapter ?? pLead.chapter_interest ?? "7");
    // TODO (MAJ-61 Dom): confirm intake_leads.id == clients.id; CaseAcceptanceFlow writes
    // to `clients` + `case_acceptances` tables using clientId — verify these map correctly.
    const accData: CaseAcceptanceData = {
      chapter,
      attorney_fee:          pAcc.attorney_fee ?? ATTORNEY_FEES[pAcc.case_type ?? "ch7_regular"] ?? 0,
      filing_fee:            pAcc.court_filing_fee ?? CHAPTER_FILING_FEES[pAcc.case_type ?? "ch7_regular"] ?? 0,
      credit_counseling_fee: CREDIT_COUNSELING_FEE,
      is_bifurcated:         isBif,
      // TODO (MAJ-61 Dom): source from submission income_sources_json[0].payFrequency if available
      client_pay_frequency:  "Bi-Weekly",
      acceptance_notes:      pAcc.decision_notes ?? "",
      accepted_by:           pAcc.attorney_name ?? session.name,
    };
    return (
      <CaseAcceptanceFlow
        clientId={pLead.id}
        clientName={pLead.full_name}
        acceptanceData={accData}
        onCompleted={() => { setPresentationContext(null); load(); }}
        onDefer={() => { setPresentationContext(null); load(); }}
      />
    );
  }

  if (selectedLead) {
    return (
      <div className="min-h-screen bg-[#090e1a] text-white">
        <div className="sticky top-0 z-30 bg-[#090e1a]/95 backdrop-blur border-b border-slate-800 px-6 py-4">
          <div className="max-w-screen-xl mx-auto flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-none">Intake Portal</h1>
              <p className="text-xs text-slate-500 mt-0.5">{selectedLead.full_name}</p>
            </div>
            <div className="ml-auto">
              <button onClick={load} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-screen-xl mx-auto px-6 py-6">
          <LeadDetailPanel
            lead={selectedLead}
            acceptance={getAcceptance(selectedLead.id)}
            session={session}
            onBack={() => setSelectedLead(null)}
            onRefresh={load}
            onLaunchPresentation={(lead, acc) => setPresentationContext({ lead, acceptance: acc })}
          />
        </div>
      </div>
    );
  }

  // Follow-up queue counts
  const PRIORITY_EXCLUDED = ["retained","declined","no_case","no_show"];
  const priorityQueue = leads.filter(l => !PRIORITY_EXCLUDED.includes(l.status));
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const botQueueLeads = leads.filter(l => {
    if (["retained","declined","no_case","no_show"].includes(l.status)) return false;
    const lastContact = l.last_contact_at ? new Date(l.last_contact_at) : new Date(l.created_at);
    return lastContact < thirtyDaysAgo;
  });
  const followUpBadge = priorityQueue.length + botQueueLeads.length || null;

  // Tabs visible per role:
  // legal_admin: Leads, Follow-Up, Calendar, Availability, Time Off
  // attorney: Follow-Up (review queue), Calendar
  // attorney_super_admin / super_admin: all tabs
  const TABS = [
    ...( canManageLeads || isSuperAdmin ? [{ id: "leads" as const, label: "Leads", icon: <Users className="w-3.5 h-3.5" />, badge: newLeads.length > 0 ? newLeads.length : null }] : []),
    { id: "followup" as const,     label: isAtty && !isSuperAdmin ? "Review Queue" : "Follow-Up", icon: <BellRing className="w-3.5 h-3.5" />,  badge: isAtty ? (reviewQueue.length + feeQuotedLeads.length || null) : followUpBadge },
    { id: "calendar" as const,     label: "Calendar",     icon: <Calendar className="w-3.5 h-3.5" />,  badge: todayConsult.length > 0 ? todayConsult.length : null },
    ...( canManageLeads || isSuperAdmin ? [{ id: "availability" as const, label: "Availability", icon: <Clock className="w-3.5 h-3.5" />, badge: null }] : []),
    ...( canManageLeads || isSuperAdmin ? [{ id: "timeoff" as const, label: "Time Off", icon: <CheckCircle2 className="w-3.5 h-3.5" />, badge: timeOff.filter(t => !t.approved && new Date(t.date) >= new Date()).length || null }] : []),
    ...(isSuperAdmin ? [{ id: "sick_admin" as const, label: "Out-of-Office", icon: <span className="text-sm leading-none">🤒</span>, badge: null }] : []),
  ];

  return (
    <div className="min-h-screen text-white" style={{ background: '#0F0F0E' }}>
      {/* Top bar — 56px, 1px bottom border, no shadow */}
      <div className="sticky top-0 z-30 px-6" style={{ height: 56, background: '#0F0F0E', borderBottom: '1px solid #2A2A28', display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%' }}>
          {/* Issue 3: bare icon, no container */}
          <Briefcase style={{ width: 20, height: 20, color: '#FAFAF7', strokeWidth: 1.5, flexShrink: 0 }} />
          <div>
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 18, letterSpacing: '-0.02em', color: '#FAFAF7' }}>
              Intake Portal
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3 flex-wrap justify-end">
            {emergencies.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', border: '1px solid #991B1B', color: '#991B1B', background: 'transparent', borderRadius: 2, padding: '2px 6px' }}>
                {emergencies.length} emergency
              </span>
            )}
            {canReviewCases && reviewQueue.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', border: '1px solid #B45309', color: '#B45309', background: 'transparent', borderRadius: 2, padding: '2px 6px' }}>
                {reviewQueue.length} pending review
              </span>
            )}
            {/* User identity */}
            <span style={{ fontSize: 13, color: '#6B6B66' }}>
              {session.name} <span style={{ color: '#3A3A36' }}>·</span> {ROLE_CONFIG[role].label}
            </span>
            <IAmSickButton onMarked={load} session={session} />
            {canManageLeads && activeTab === "leads" && (
              <button
                onClick={() => setShowNewLead(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111111', color: '#FAFAF7', border: 'none', borderRadius: 4, padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background 150ms ease-out' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1E3A2F'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#111111'; }}
              >
                <Plus style={{ width: 14, height: 14, strokeWidth: 1.5 }} /> New Lead
              </button>
            )}
            <button onClick={load} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}>
              <RefreshCw style={{ width: 14, height: 14, color: '#6B6B66', strokeWidth: 1.5 }} />
            </button>
            <button onClick={onLogout} title="Sign out" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X style={{ width: 14, height: 14, color: '#6B6B66', strokeWidth: 1.5 }} />
            </button>
          </div>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>

        {/* Issue 5: Left sidebar nav, 220px, text-only, no icons */}
        <aside style={{ width: 220, flexShrink: 0, borderRight: '1px solid #2A2A28', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Staff identity block in sidebar */}
          <div style={{ padding: '0 20px 20px', borderBottom: '1px solid #2A2A28', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, background: '#2A2A28', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, fontWeight: 500, color: '#FAFAF7' }}>
                  {session.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#FAFAF7', lineHeight: 1.3 }}>{session.name}</p>
                <p style={{ fontSize: 11, color: '#6B6B66', marginTop: 1 }}>{ROLE_CONFIG[role].label}</p>
              </div>
            </div>
          </div>

          {TABS.map(t => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 20px',
                  background: 'transparent',
                  border: 'none',
                  borderLeft: isActive ? '2px solid #1E3A2F' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'border-color 150ms ease-out',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: isActive ? 500 : 400, color: isActive ? '#FAFAF7' : '#6B6B66', fontFamily: "'Inter', system-ui, sans-serif", transition: 'color 150ms ease-out' }}>
                  {t.label}
                </span>
                {t.badge != null && (
                  <span style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: 11, color: isActive ? '#FAFAF7' : '#6B6B66', marginLeft: 8 }}>
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0" style={{ padding: '24px 32px' }}>
          <div className="space-y-5">

        {/* Stats row — always visible */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {[
            { label: "Total Leads",    val: leads.length,       color: "text-slate-300",   icon: <Users className="w-4 h-4" />,       tab: "leads" as const },
            { label: "Need Scheduling",       val: newLeads.length,       color: "text-sky-400",     icon: <PhoneMissed className="w-4 h-4" />, tab: "leads" as const },
            { label: "Today Appointments",    val: todayConsult.length,   color: "text-teal-400",    icon: <Calendar className="w-4 h-4" />,    tab: "calendar" as const },
            { label: "Pending Atty Review",   val: reviewQueue.length,    color: "text-amber-400",   icon: <Scale className="w-4 h-4" />,       tab: "leads" as const },
            { label: "Fee Quoted / Follow-Up",val: feeQuotedLeads.length, color: "text-orange-400",  icon: <DollarSign className="w-4 h-4" />,  tab: "followup" as const },
          ].map(s => (
            <button key={s.label} onClick={() => setActiveTab(s.tab)}
              className="bg-[#0d1221] border border-slate-800 rounded-2xl p-4 flex items-center gap-3 hover:border-slate-700 transition-colors text-left">
              <span className={`${s.color} opacity-60`}>{s.icon}</span>
              <div>
                <p className="text-[10px] text-slate-500">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
              </div>
            </button>
          ))}
        </div>

        {/* ── LEADS TAB ── */}
        {activeTab === "leads" && (
          <>
            {emergencies.length > 0 && (
              <div className="bg-red-500/8 border border-red-500/25 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <p className="text-sm font-bold text-red-400">Emergency Leads — Immediate Attention Required</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {emergencies.map(l => (
                    <button key={l.id} onClick={() => setSelectedLead(l)}
                      className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl px-3 py-2 transition-colors text-xs">
                      <Flag className="w-3 h-3 text-red-400" />
                      <span className="text-red-200 font-semibold">{l.full_name}</span>
                      {l.phone && <span className="text-red-400">{l.phone}</span>}
                      <ChevronRight className="w-3 h-3 text-red-600" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {reviewQueue.length > 0 && (
              <div className="bg-amber-500/6 border border-amber-500/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Scale className="w-4 h-4 text-amber-400" />
                  <p className="text-sm font-bold text-amber-400">Pending Attorney Review</p>
                  <span className="text-xs text-amber-500/70">— intake complete, awaiting attorney decision</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {reviewQueue.map(l => (
                    <button key={l.id} onClick={() => setSelectedLead(l)}
                      className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl px-3 py-2 transition-colors text-xs">
                      <UserCheck className="w-3 h-3 text-amber-400" />
                      <span className="text-amber-200 font-semibold">{l.full_name}</span>
                      {l.chapter_interest && <span className="text-amber-500">Ch. {l.chapter_interest}</span>}
                      {l.sent_for_review_at && <span className="text-amber-600">{timeAgo(l.sent_for_review_at)}</span>}
                      <ChevronRight className="w-3 h-3 text-amber-600" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-sky-500/5 border border-sky-500/15 rounded-2xl px-5 py-4 flex items-start gap-4">
              <div className="w-9 h-9 rounded-xl bg-sky-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-sky-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">AI Scheduling Bot Active</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  The intake bot automatically assigns consultations to available staff based on their weekly schedule and remaining daily capacity. Time-off dates are excluded. AI-scheduled leads show a bot badge.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-full px-2.5 py-1 flex-shrink-0">
                <Zap className="w-3 h-3" /> Live
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or phone…"
                    className="w-full bg-slate-800/60 border border-slate-700/60 text-white text-sm rounded-xl pl-9 pr-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-500" />
                </div>
                <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-sm text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-500">
                  <option value="all">All Urgency</option>
                  <option value="emergency">Emergency</option>
                  <option value="urgent">Urgent</option>
                  <option value="normal">Normal</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all",                     label: "All" },
                  { value: "new",                     label: "No Contact" },
                  { value: "contacted",               label: "Need Scheduled" },
                  { value: "consultation_scheduled",  label: "Upcoming Appt." },
                  { value: "consultation_complete",   label: "Intake Done" },
                  { value: "intake_complete",         label: "Intake Done" },
                  { value: "sent_for_attorney_review",label: "Pending Atty Review" },
                  { value: "attorney_accepted",       label: "Ready to Present" },
                  { value: "fee_quoted",              label: "Fee Quoted / FU" },
                  { value: "retained",                label: "Retained / Complete" },
                  { value: "no_case",                 label: "No Case" },
                  { value: "declined",                label: "Declined" },
                ].map(s => (
                  <button key={s.value} onClick={() => setStatusFilter(s.value)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                      statusFilter === s.value ? "bg-slate-600 text-white border-slate-500" : "text-slate-500 border-slate-700/60 hover:text-slate-300 hover:border-slate-600"
                    }`}>{s.label}</button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20"><RefreshCw className="w-5 h-5 text-slate-600 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="bg-[#0d1221] border border-slate-800 rounded-2xl text-center py-20">
                <Users className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500">No leads found</p>
                <button onClick={() => setShowNewLead(true)} className="mt-4 flex items-center gap-2 mx-auto text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add First Lead
                </button>
              </div>
            ) : (
              <div className="bg-[#0d1221] border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="border-b border-slate-800">
                        {["Lead","Contact","Chapter","Urgency","Status","Assigned","Added",""].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {filtered.map(lead => {
                        const sc = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG["new"];
                        const uc = URGENCY_CONFIG[lead.urgency ?? "normal"] ?? URGENCY_CONFIG["normal"];
                        const acceptance = getAcceptance(lead.id);
                        return (
                          <tr key={lead.id} onClick={() => setSelectedLead(lead)} className="hover:bg-slate-800/30 cursor-pointer transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-slate-700/60 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">{lead.full_name.charAt(0)}</div>
                                <div>
                                  <p className="text-sm font-semibold text-white flex items-center gap-1.5">{lead.full_name}{lead.ai_scheduled && <Bot className="w-3 h-3 text-sky-400 flex-shrink-0" />}</p>
                                  {lead.state && <p className="text-[10px] text-slate-600">{lead.state}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-0.5">
                                {lead.phone && <p className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{lead.phone}</p>}
                                {lead.email && <p className="text-xs text-slate-500 flex items-center gap-1 truncate max-w-[140px]"><Mail className="w-2.5 h-2.5 flex-shrink-0" />{lead.email}</p>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400">{lead.chapter_interest ? `Ch. ${lead.chapter_interest}` : <span className="text-slate-600">—</span>}</td>
                            <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${uc.color} ${uc.bg}`}>{uc.label}</span></td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${sc.color} ${sc.bg} whitespace-nowrap`}>{sc.label}</span>
                              {acceptance?.decision === "accepted" && <p className="text-[9px] text-emerald-500 mt-0.5">{CASE_TYPES.find(c => c.value === acceptance.case_type)?.label}</p>}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">{lead.assigned_name ?? "—"}</td>
                            <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{timeAgo(lead.created_at)}</td>
                            <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-slate-700" /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── FOLLOW-UP TAB ── */}
        {activeTab === "followup" && (
          isAtty && !isSuperAdmin
            ? <AttorneyReviewQueue leads={leads} acceptances={acceptances} onSelect={l => setSelectedLead(l)} />
            : <FollowUpQueue leads={leads} onSelect={l => setSelectedLead(l)} />
        )}

        {/* ── CALENDAR TAB ── */}
        {activeTab === "calendar" && (
          <CalendarTab events={calEvents} leads={leads} timeOff={timeOff} onRefresh={load} />
        )}

        {/* ── AVAILABILITY TAB ── */}
        {activeTab === "availability" && (
          <AvailabilityTab availability={availability} onRefresh={load} />
        )}

        {/* ── TIME OFF TAB ── */}
        {activeTab === "timeoff" && (
          <TimeOffTab timeOff={timeOff} onRefresh={load} />
        )}

        {/* ── OUT-OF-OFFICE ADMIN TAB ── */}
        {activeTab === "sick_admin" && isSuperAdmin && (
          <SuperAdminSickPanel onRefresh={load} />
        )}

          </div>{/* end space-y-5 */}
        </div>{/* end main content */}
      </div>{/* end body flex */}

      {showNewLead && (
        <NewLeadModal
          onClose={() => setShowNewLead(false)}
          onSaved={() => { setShowNewLead(false); load(); }}
          session={session}
        />
      )}
    </div>
  );
}

// ─── Export with login gate ───────────────────────────────────────────────────

export default function LegalAdminPortal() {
  const [session, setSession] = useState<PortalSession | null>(null);

  if (!session) {
    return <PortalLogin onLogin={s => setSession(s)} />;
  }

  return (
    <IntakePortalInner
      session={session}
      onLogout={() => setSession(null)}
    />
  );
}
