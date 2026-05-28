import { useState, useEffect, useCallback } from "react";
import { FolderOpen, User, Search, FileText, Clock, DollarSign, Calendar, MessageCircle, Shield, CheckCircle2, AlertTriangle, ChevronRight, RefreshCw, Hash, Phone, Mail, MapPin, Scale, X, ArrowLeft, Activity, Briefcase, CreditCard, Upload, Flag, CheckCheck, Lock, Eye, Filter, ChevronDown, Info, Home, Car, Landmark, Building, Users, BarChart2, ArrowRightLeft, Clipboard, GitBranch, Banknote, PenLine, SendHorizontal as Send } from "lucide-react";
import { CASE_FILE_PHASES, PHASE_LABELS, PHASE_DESCRIPTIONS, type CaseFilePhase } from "./lib/casePhases";
import TrusteeSubmissionWidget from "./admin/TrusteeSubmissionWidget";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  chapter: number | null;
  case_type: string | null;
  status: string | null;
  extended_status: string | null;
  case_number: string | null;
  filed_date: string | null;
  intake_date: string | null;
  notes: string | null;
  last_contact_date: string | null;
  intake_review_status: string | null;
  intake_submitted_at: string | null;
  assigned_attorney: string | null;
  assigned_paralegal: string | null;
}

interface FeeStructure {
  attorney_fee: number;
  court_filing_fee: number;
  total_fee: number;
  down_payment: number;
  plan_months: number | null;
  payment_frequency: string | null;
  cff_paid: boolean;
  approved_for_signing: boolean;
  iolta_balance: number;
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  payment_type: string;
  destination_account: string;
  voided: boolean;
  refunded: boolean;
  payment_method: string | null;
}

interface TimeLogEntry {
  id: string;
  staff_name: string;
  activity_type: string;
  duration_minutes: number;
  billable: boolean;
  notes: string | null;
  started_at: string;
  billing_rate: number | null;
  billable_amount: number | null;
}

interface Message {
  id: string;
  sender_name: string;
  sender_role: string;
  subject: string | null;
  body: string;
  channel: string;
  is_internal: boolean;
  delivery_status: string;
  created_at: string;
}

interface WorkflowStatus {
  stage: string;
  paralegal_review_complete: boolean;
  paralegal_reviewed_by: string | null;
  attorney_review_complete: boolean;
  attorney_reviewed_by: string | null;
  filing_fee_paid: boolean;
  missing_docs_cleared: boolean;
  missing_docs_list: string[] | null;
  scheduling_approved: boolean;
  signed_at: string | null;
  filed_at: string | null;
}

interface Task {
  id: string;
  title: string;
  task_type: string;
  priority: string;
  status: string;
  due_date: string | null;
  created_at: string;
}

interface Document {
  id: string;
  document_type: string;
  document_category: string;
  original_filename: string;
  storage_path: string | null;
  mime_type: string | null;
  ai_verified: boolean;
  ai_note: string | null;
  uploaded_at: string;
  // BAN-30: nullable until backfill is reviewed manually.
  phase: CaseFilePhase | null;
}

interface IntakeSubmission {
  id: string;
  filing_type: string | null;
  chapter_type: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  dob: string | null;
  ssn_last4: string | null;
  email: string | null;
  phone: string | null;
  alt_phone: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  county: string | null;
  marital_status: string | null;
  spouse_first_name: string | null;
  spouse_last_name: string | null;
  dependents_json: unknown;
  income_sources_json: unknown;
  debtor_gross_monthly: number | null;
  debtor_net_monthly: number | null;
  real_properties_json: unknown;
  owns_real_estate: boolean | null;
  real_prop_value: number | null;
  mortgage_balance: number | null;
  vehicles_json: unknown;
  no_vehicles: boolean | null;
  bank_balance: number | null;
  retirement_balance: number | null;
  stocks_value: number | null;
  crypto_value: number | null;
  household_goods_value: number | null;
  secured_debt: number | null;
  credit_card_debt: number | null;
  medical_debt: number | null;
  student_loan_debt: number | null;
  tax_debt: number | null;
  personal_loan_debt: number | null;
  other_unsecured: number | null;
  exp_rent_mortgage: number | null;
  exp_utilities: number | null;
  exp_food: number | null;
  exp_transportation: number | null;
  exp_healthcare: number | null;
  exp_insurance: number | null;
  exp_childcare: number | null;
  exp_other: number | null;
  prior_bankruptcy: boolean | null;
  pending_lawsuits: boolean | null;
  garnishment: boolean | null;
  primary_reason: string | null;
  status: string | null;
  review_status: string | null;
  submitted_at: string | null;
}

interface CaseTypeSwitch {
  id: string;
  original_chapter: number;
  original_case_type: string;
  new_chapter: number;
  new_case_type: string;
  status: string;
  earned_fee_amount: number;
  unearned_credit: number;
  net_new_fee: number | null;
  new_attorney_fee: number | null;
  requested_by: string;
  requested_at: string;
}

type ClientTab = "overview" | "payments" | "docs" | "messages" | "timelog" | "tasks";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtNum(n: number | null | undefined) {
  if (n == null || n === 0) return "—";
  return `$${n.toLocaleString()}`;
}

async function sbGet<T>(path: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  return r.ok ? r.json() : [];
}

async function sbPatch(table: string, id: string, body: object) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
}

async function sbPost(table: string, body: object) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  return r.ok ? r.json() : null;
}

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  intake:              { label: "Intake",                color: "text-slate-400",   bg: "bg-slate-700/30" },
  paralegal_review:    { label: "Paralegal Review",      color: "text-sky-400",     bg: "bg-sky-500/10" },
  attorney_review:     { label: "Attorney Review",       color: "text-amber-400",   bg: "bg-amber-500/10" },
  filing_fee_pending:  { label: "Filing Fee Pending",    color: "text-orange-400",  bg: "bg-orange-500/10" },
  docs_missing:        { label: "Docs Missing",          color: "text-red-400",     bg: "bg-red-500/10" },
  ready_to_schedule:   { label: "Ready to Schedule",     color: "text-emerald-400", bg: "bg-emerald-500/10" },
  scheduled:           { label: "Signing Scheduled",     color: "text-teal-400",    bg: "bg-teal-500/10" },
  filed:               { label: "Filed",                 color: "text-green-400",   bg: "bg-green-500/10" },
  closed:              { label: "Closed",                color: "text-slate-500",   bg: "bg-slate-700/20" },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  active:   { color: "text-emerald-400", bg: "bg-emerald-500/10" },
  filed:    { color: "text-sky-400",     bg: "bg-sky-500/10" },
  closed:   { color: "text-slate-500",   bg: "bg-slate-700/20" },
  on_hold:  { color: "text-amber-400",   bg: "bg-amber-500/10" },
};

const CASE_TYPES = [
  { value: "regular",         label: "Ch. 7 Regular" },
  { value: "bifurcated",      label: "Ch. 7 Bifurcated" },
  { value: "ch13",            label: "Ch. 13" },
  { value: "flat_fee",        label: "Flat Fee" },
  { value: "hourly",          label: "Hourly" },
  { value: "limited_scope",   label: "Limited Scope" },
];

// ─── CaseSwitchModal ──────────────────────────────────────────────────────────

function CaseSwitchModal({
  client,
  fee,
  timelog,
  onClose,
  onSaved,
}: {
  client: Client;
  fee: FeeStructure | null;
  timelog: TimeLogEntry[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const totalUnits = timelog.reduce((s, e) => {
    const u = (e.duration_minutes / 60);
    return s + Math.max(0.2, Math.round(u * 10) / 10);
  }, 0);

  const avgRate = timelog.length > 0
    ? timelog.reduce((s, e) => s + (e.billing_rate ?? 225), 0) / timelog.length
    : 225;

  const earnedFee = Math.round(totalUnits * avgRate * 100) / 100;
  const unearnedCredit = Math.max(0, (fee?.attorney_fee ?? 0) - earnedFee);

  const [newChapter, setNewChapter] = useState<"7" | "13">("13");
  const [newCaseType, setNewCaseType] = useState("ch13");
  const [newAttorneyFee, setNewAttorneyFee] = useState("");
  const [newDownPayment, setNewDownPayment] = useState("");
  const [newPlanMonths, setNewPlanMonths] = useState("");
  const [newPaymentFreq, setNewPaymentFreq] = useState("monthly");
  const [requestedBy, setRequestedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const proposedNewFee = parseFloat(newAttorneyFee) || 0;
  const netNewFee = Math.max(0, proposedNewFee - unearnedCredit);

  async function save() {
    if (!requestedBy.trim()) { setErr("Enter the requesting staff name."); return; }
    if (!newAttorneyFee || isNaN(parseFloat(newAttorneyFee))) { setErr("Enter new attorney fee."); return; }
    setSaving(true);
    await sbPost("case_type_switches", {
      client_id: client.id,
      client_name: client.full_name,
      requested_by: requestedBy.trim(),
      original_chapter: client.chapter ?? 7,
      original_case_type: client.case_type ?? "regular",
      new_chapter: parseInt(newChapter),
      new_case_type: newCaseType,
      original_attorney_fee: fee?.attorney_fee ?? 0,
      total_time_units: totalUnits,
      hourly_rate_used: Math.round(avgRate),
      earned_fee_amount: earnedFee,
      unearned_credit: unearnedCredit,
      new_attorney_fee: proposedNewFee,
      credit_applied: Math.min(unearnedCredit, proposedNewFee),
      net_new_fee: netNewFee,
      new_down_payment: parseFloat(newDownPayment) || null,
      new_plan_months: parseInt(newPlanMonths) || null,
      new_payment_frequency: newPaymentFreq,
      status: "pending",
      notes: notes.trim() || null,
    });
    setSaving(false);
    onSaved();
  }

  const inp = "w-full bg-slate-800/60 border border-slate-700/60 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors";
  const lbl = "text-xs font-semibold text-slate-400 mb-1.5 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="font-bold text-white">Switch Case Type</p>
            <p className="text-xs text-slate-500">{client.full_name}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{err}</p>}

          {/* Current case summary */}
          <div className="bg-slate-800/40 rounded-xl p-4 text-xs space-y-1.5">
            <p className="font-semibold text-slate-300 mb-2">Current Case</p>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Type</span>
              <span className="text-slate-300 capitalize">Ch. {client.chapter} — {client.case_type?.replace(/_/g, " ")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Attorney Fee</span>
              <span className="text-slate-300">{fmt(fee?.attorney_fee ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Time Logged</span>
              <span className="text-slate-300">{totalUnits.toFixed(1)} units @ avg {fmt(Math.round(avgRate))}/hr</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-700 pt-1.5 mt-1.5">
              <span className="text-slate-400 font-semibold">Earned Fee</span>
              <span className="text-white font-bold">{fmt(earnedFee)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-amber-400 font-semibold">Unearned Credit</span>
              <span className="text-amber-400 font-bold">{fmt(unearnedCredit)}</span>
            </div>
          </div>

          {/* New case type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>New Chapter</label>
              <select value={newChapter} onChange={e => { setNewChapter(e.target.value as "7" | "13"); setNewCaseType(e.target.value === "13" ? "ch13" : "regular"); }} className={inp}>
                <option value="7">Chapter 7</option>
                <option value="13">Chapter 13</option>
              </select>
            </div>
            <div>
              <label className={lbl}>New Case Type</label>
              <select value={newCaseType} onChange={e => setNewCaseType(e.target.value)} className={inp}>
                {newChapter === "7"
                  ? [{ v: "regular", l: "Regular" }, { v: "bifurcated", l: "Bifurcated" }, { v: "flat_fee", l: "Flat Fee" }].map(o => <option key={o.v} value={o.v}>{o.l}</option>)
                  : [{ v: "ch13", l: "Chapter 13" }, { v: "hourly", l: "Hourly" }].map(o => <option key={o.v} value={o.v}>{o.l}</option>)
                }
              </select>
            </div>
          </div>

          {/* New fee */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>New Attorney Fee ($)</label>
              <input type="number" value={newAttorneyFee} onChange={e => setNewAttorneyFee(e.target.value)} placeholder="e.g. 3500" className={inp} />
            </div>
            <div>
              <label className={lbl}>Down Payment ($)</label>
              <input type="number" value={newDownPayment} onChange={e => setNewDownPayment(e.target.value)} placeholder="e.g. 500" className={inp} />
            </div>
            <div>
              <label className={lbl}>Plan Months</label>
              <input type="number" value={newPlanMonths} onChange={e => setNewPlanMonths(e.target.value)} placeholder="e.g. 36" className={inp} />
            </div>
            <div>
              <label className={lbl}>Payment Frequency</label>
              <select value={newPaymentFreq} onChange={e => setNewPaymentFreq(e.target.value)} className={inp}>
                {["weekly", "biweekly", "semi_monthly", "monthly", "paid_in_full"].map(f => (
                  <option key={f} value={f}>{f.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>

          {proposedNewFee > 0 && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 text-xs space-y-1.5">
              <p className="font-semibold text-emerald-400 mb-2">Fee Calculation</p>
              <div className="flex justify-between"><span className="text-slate-400">New Attorney Fee</span><span className="text-white">{fmt(proposedNewFee)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Unearned Credit Applied</span><span className="text-amber-400">− {fmt(Math.min(unearnedCredit, proposedNewFee))}</span></div>
              <div className="flex justify-between border-t border-slate-700 pt-1.5 mt-1.5">
                <span className="text-white font-bold">Net New Fee</span>
                <span className="text-emerald-400 font-bold">{fmt(netNewFee)}</span>
              </div>
              <p className="text-slate-500 pt-1">Client will receive email + portal notice to sign new fee agreement and set up payment.</p>
            </div>
          )}

          <div>
            <label className={lbl}>Requested By</label>
            <input value={requestedBy} onChange={e => setRequestedBy(e.target.value)} placeholder="Staff member name" className={inp} />
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Reason for switch, any context…" className={inp + " resize-none"} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="px-5 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-black rounded-xl transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Propose Switch"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ChapterChangeModal ───────────────────────────────────────────────────────
// Replaces direct case type switch — staff proposes a chapter/type change that
// gets submitted to the super admin attorney for approval.

function ChapterChangeModal({
  client, fee, timelog, onClose, onSaved,
}: {
  client: Client;
  fee: FeeStructure | null;
  timelog: TimeLogEntry[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const totalUnits  = timelog.reduce((s, e) => s + Math.max(0.2, Math.round(e.duration_minutes / 60 * 10) / 10), 0);
  const avgRate     = timelog.length > 0 ? timelog.reduce((s, e) => s + (e.billing_rate ?? 225), 0) / timelog.length : 225;
  const earnedFee   = Math.round(totalUnits * avgRate * 100) / 100;
  const unearnedCredit = Math.max(0, (fee?.attorney_fee ?? 0) - earnedFee);

  const [newChapter,     setNewChapter]     = useState<"7" | "13">("13");
  const [newCaseType,    setNewCaseType]    = useState("flat_fee");
  const [newAttorneyFee, setNewAttorneyFee] = useState("");
  const [newDownPayment, setNewDownPayment] = useState("");
  const [newPlanMonths,  setNewPlanMonths]  = useState("");
  const [newPaymentFreq, setNewPaymentFreq] = useState("monthly");
  const [requestedBy,    setRequestedBy]    = useState("");
  const [notes,          setNotes]          = useState("");
  const [saving,         setSaving]         = useState(false);
  const [err,            setErr]            = useState("");

  const proposedNewFee = parseFloat(newAttorneyFee) || 0;
  const netNewFee      = Math.max(0, proposedNewFee - unearnedCredit);

  const inp = "w-full bg-slate-800/60 border border-slate-700/60 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors";
  const lbl = "text-xs font-semibold text-slate-400 mb-1.5 block";

  async function save() {
    if (!requestedBy.trim()) { setErr("Enter the requesting staff name."); return; }
    if (!newAttorneyFee || isNaN(parseFloat(newAttorneyFee))) { setErr("Enter proposed attorney fee."); return; }
    setSaving(true);
    // Post to case_type_switches as "pending" — super admin attorney must approve
    await sbPost("case_type_switches", {
      client_id:             client.id,
      client_name:           client.full_name,
      requested_by:          requestedBy.trim(),
      original_chapter:      client.chapter ?? 7,
      original_case_type:    client.case_type ?? "regular",
      new_chapter:           parseInt(newChapter),
      new_case_type:         newCaseType,
      original_attorney_fee: fee?.attorney_fee ?? 0,
      total_time_units:      totalUnits,
      hourly_rate_used:      Math.round(avgRate),
      earned_fee_amount:     earnedFee,
      unearned_credit:       unearnedCredit,
      new_attorney_fee:      proposedNewFee,
      credit_applied:        Math.min(unearnedCredit, proposedNewFee),
      net_new_fee:           netNewFee,
      new_down_payment:      parseFloat(newDownPayment) || null,
      new_plan_months:       parseInt(newPlanMonths) || null,
      new_payment_frequency: newPaymentFreq,
      status:                "pending",
      notes:                 notes.trim() || null,
    });
    // Create a staff task for the super admin attorney
    await sbPost("staff_tasks", {
      client_id:    client.id,
      client_name:  client.full_name,
      task_type:    "chapter_change_approval",
      assigned_to:  "attorney_superadmin",
      title:        `Chapter Change Approval Needed — ${client.full_name}`,
      description:  `Staff member ${requestedBy} has requested a chapter/case type change for ${client.full_name}: Ch. ${client.chapter} ${client.case_type} → Ch. ${newChapter} ${newCaseType}. New attorney fee: $${proposedNewFee}. Net after credit: $${netNewFee}. Notes: ${notes || "None"}.`,
      status:       "pending",
      priority:     "high",
      created_at:   new Date().toISOString(),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="font-bold text-white">Propose Chapter Change</p>
            <p className="text-xs text-slate-500">{client.full_name} · Requires super admin attorney approval</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="bg-amber-400/8 border border-amber-400/20 rounded-xl px-3.5 py-2.5">
            <p className="text-[11px] text-amber-300 font-semibold">Super Admin Attorney Approval Required</p>
            <p className="text-[10px] text-slate-500 mt-0.5">This request will be submitted for approval. A task will be created and assigned to the attorney super admin.</p>
          </div>

          {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{err}</p>}

          <div className="bg-slate-800/40 rounded-xl p-4 text-xs space-y-1.5">
            <p className="font-semibold text-slate-300 mb-2">Current Case</p>
            <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="text-slate-300">Ch. {client.chapter} — {client.case_type?.replace(/_/g, " ")}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Attorney Fee</span><span className="text-slate-300">{fmt(fee?.attorney_fee ?? 0)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Time Logged</span><span className="text-slate-300">{totalUnits.toFixed(1)} units</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1.5 mt-1"><span className="text-amber-400 font-semibold">Unearned Credit</span><span className="text-amber-400 font-bold">{fmt(unearnedCredit)}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>New Chapter</label>
              <select value={newChapter} onChange={e => { setNewChapter(e.target.value as "7" | "13"); setNewCaseType(e.target.value === "13" ? "flat_fee" : "regular"); }} className={inp}>
                <option value="7">Chapter 7</option>
                <option value="13">Chapter 13</option>
              </select>
            </div>
            <div>
              <label className={lbl}>New Case Type</label>
              <select value={newCaseType} onChange={e => setNewCaseType(e.target.value)} className={inp}>
                {newChapter === "7"
                  ? [{ v: "regular", l: "Regular (Prepaid)" }, { v: "bifurcated", l: "Bifurcated" }].map(o => <option key={o.v} value={o.v}>{o.l}</option>)
                  : [{ v: "flat_fee", l: "Ch. 13 Flat Fee" }, { v: "hourly", l: "Ch. 13 Hourly" }].map(o => <option key={o.v} value={o.v}>{o.l}</option>)
                }
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Proposed Attorney Fee ($) *</label>
              <input type="number" value={newAttorneyFee} onChange={e => setNewAttorneyFee(e.target.value)} placeholder="e.g. 3500" className={inp} />
            </div>
            <div>
              <label className={lbl}>Down Payment ($)</label>
              <input type="number" value={newDownPayment} onChange={e => setNewDownPayment(e.target.value)} placeholder="e.g. 500" className={inp} />
            </div>
          </div>

          {proposedNewFee > 0 && (
            <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-3.5 text-xs space-y-1.5">
              <p className="font-semibold text-sky-400 mb-1.5">Fee Preview</p>
              <div className="flex justify-between"><span className="text-slate-400">Proposed Fee</span><span className="text-white">{fmt(proposedNewFee)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Unearned Credit</span><span className="text-amber-400">− {fmt(Math.min(unearnedCredit, proposedNewFee))}</span></div>
              <div className="flex justify-between border-t border-slate-700 pt-1.5 mt-1"><span className="text-white font-bold">Net New Fee</span><span className="text-sky-400 font-bold">{fmt(netNewFee)}</span></div>
            </div>
          )}

          <div>
            <label className={lbl}>Requested By *</label>
            <input value={requestedBy} onChange={e => setRequestedBy(e.target.value)} placeholder="Staff member name" className={inp} />
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Reason for change, any context…" className={inp + " resize-none"} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="px-5 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-black rounded-xl transition-colors disabled:opacity-50">
            {saving ? "Submitting…" : "Submit for Approval"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FileCabinetCancelModal ───────────────────────────────────────────────────
// Quick cancel request submission from within the file cabinet. Notifies the
// super admin attorney and creates a task for follow-up.

function FileCabinetCancelModal({
  client, onClose, onSaved,
}: {
  client: Client;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason,   setReason]   = useState("");
  const [detail,   setDetail]   = useState("");
  const [channel,  setChannel]  = useState("in_person");
  const [staffName, setStaffName] = useState("");
  const [saving,   setSaving]   = useState(false);

  const REASONS = [
    { value: "financial_hardship",    label: "Financial Hardship" },
    { value: "changed_attorney",      label: "Changed Attorney" },
    { value: "circumstances_changed", label: "Circumstances Changed" },
    { value: "dissatisfied",          label: "Dissatisfied with Service" },
    { value: "other",                 label: "Other" },
  ];

  const inp = "w-full bg-slate-800/60 border border-slate-700/60 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors";
  const lbl = "text-xs font-semibold text-slate-400 mb-1.5 block";

  async function submit() {
    if (!reason) return;
    setSaving(true);
    await sbPost("accounting_cancel_requests", {
      client_id:            client.id,
      request_channel:      channel,
      reason_category:      reason,
      reason_detail:        detail || null,
      ai_retention_outcome: "escalated",
      status:               "pending",
      created_at:           new Date().toISOString(),
      updated_at:           new Date().toISOString(),
    });
    // Create task for super admin attorney
    await sbPost("staff_tasks", {
      client_id:    client.id,
      client_name:  client.full_name,
      task_type:    "cancel_request_attorney_outreach",
      assigned_to:  "attorney_superadmin",
      title:        `Cancel Request — Client Outreach Required: ${client.full_name}`,
      description:  `${client.full_name} has requested to cancel. Reason: ${reason.replace(/_/g, " ")}${detail ? ` — "${detail}"` : ""}. Channel: ${channel}. Logged by: ${staffName || "Staff"}. Please reach out to the client to attempt to address their concerns.`,
      status:       "pending",
      priority:     "high",
      created_at:   new Date().toISOString(),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800">
          <div className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center">
            <X className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <p className="font-bold text-white">Cancel Request</p>
            <p className="text-xs text-slate-500">{client.full_name} · Will notify super admin attorney</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-3.5 py-2.5">
            <p className="text-[11px] text-red-300 font-semibold">Super Admin Attorney Will Be Notified</p>
            <p className="text-[10px] text-slate-500 mt-0.5">A task will be created for the attorney super admin to reach out to the client and attempt to resolve their concerns before processing any cancellation.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Contact Channel</label>
              <select value={channel} onChange={e => setChannel(e.target.value)} className={inp}>
                <option value="in_person">In Person</option>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="portal">Client Portal</option>
                <option value="text">Text / SMS</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Reason *</label>
              <select value={reason} onChange={e => setReason(e.target.value)} className={inp}>
                <option value="">Select…</option>
                {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>Client's Statement</label>
            <textarea value={detail} onChange={e => setDetail(e.target.value)} rows={3}
              placeholder="What did the client say?" className={inp + " resize-none"} />
          </div>

          <div>
            <label className={lbl}>Staff Member Name</label>
            <input value={staffName} onChange={e => setStaffName(e.target.value)} placeholder="Your name" className={inp} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving || !reason}
            className="px-5 py-2.5 text-sm font-semibold bg-red-500 hover:bg-red-400 text-white rounded-xl transition-colors disabled:opacity-50">
            {saving ? "Submitting…" : "Submit Cancel Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bankruptcy Document Sections ─────────────────────────────────────────────

// Each section maps directly to a bankruptcy schedule or form.
// Documents are grouped by their document_type (slotKey) prefix.

const BKDOC_SECTIONS: Array<{
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: { bg: string; border: string; text: string; badge: string };
  // slotKey prefixes or exact matches that belong to this section
  matchFn: (docType: string) => boolean;
}> = [
  {
    id: "petition_identity",
    title: "Voluntary Petition — Identity",
    subtitle: "Official Form 101 · Government-issued IDs and Social Security cards",
    icon: <User className="w-4 h-4" />,
    color: { bg: "bg-red-500/5", border: "border-red-500/25", text: "text-red-400", badge: "bg-red-500/10 text-red-400 border-red-500/20" },
    matchFn: (t) => t.startsWith("debtor1_") || t.startsWith("debtor2_") || t === "petition_identity",
  },
  {
    id: "means_test",
    title: "Means Test — Income Documentation",
    subtitle: "Official Form 122A-1 · 6-month income history for Chapter 7 eligibility",
    icon: <DollarSign className="w-4 h-4" />,
    color: { bg: "bg-amber-500/5", border: "border-amber-500/25", text: "text-amber-400", badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    matchFn: (t) => t.startsWith("means_"),
  },
  {
    id: "schedule_ab",
    title: "Schedule A/B — Property",
    subtitle: "Official Form 106A/B · All real and personal property of the estate",
    icon: <Home className="w-4 h-4" />,
    color: { bg: "bg-blue-500/5", border: "border-blue-500/25", text: "text-blue-400", badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    matchFn: (t) =>
      t.startsWith("bank_stmt_") || t.startsWith("retirement_") ||
      t.startsWith("stocks_") || t.startsWith("bonds_") || t.startsWith("crypto_") ||
      t.startsWith("vehicle_registration") || t.startsWith("vehicle_loan") ||
      t.startsWith("mortgage_stmt") || t === "schedule_ab",
  },
  {
    id: "schedule_c",
    title: "Schedule C — Exemptions",
    subtitle: "Official Form 106C · Property claimed as exempt from the estate",
    icon: <Shield className="w-4 h-4" />,
    color: { bg: "bg-teal-500/5", border: "border-teal-500/25", text: "text-teal-400", badge: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
    matchFn: (t) => t.startsWith("sched_c_") || t === "schedule_c",
  },
  {
    id: "schedule_d",
    title: "Schedule D — Secured Creditors",
    subtitle: "Official Form 106D · Creditors holding secured claims",
    icon: <Landmark className="w-4 h-4" />,
    color: { bg: "bg-orange-500/5", border: "border-orange-500/25", text: "text-orange-400", badge: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
    matchFn: (t) => t.startsWith("sched_d_"),
  },
  {
    id: "schedule_ef",
    title: "Schedule E/F — Unsecured Creditors",
    subtitle: "Official Form 106E/F · Priority and non-priority unsecured claims",
    icon: <CreditCard className="w-4 h-4" />,
    color: { bg: "bg-sky-500/5", border: "border-sky-500/25", text: "text-sky-400", badge: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
    matchFn: (t) =>
      t.startsWith("sched_e_") || t.startsWith("sched_f_") ||
      t.startsWith("credit_report_"),
  },
  {
    id: "schedule_g",
    title: "Schedule G — Executory Contracts & Leases",
    subtitle: "Official Form 106G · Active leases and unexpired contracts",
    icon: <FileText className="w-4 h-4" />,
    color: { bg: "bg-emerald-500/5", border: "border-emerald-500/25", text: "text-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    matchFn: (t) => t.startsWith("sched_g_"),
  },
  {
    id: "schedule_h",
    title: "Schedule H — Co-Debtors",
    subtitle: "Official Form 106H · Co-signers and joint obligors",
    icon: <Users className="w-4 h-4" />,
    color: { bg: "bg-slate-500/5", border: "border-slate-500/25", text: "text-slate-400", badge: "bg-slate-700/40 text-slate-400 border-slate-600/40" },
    matchFn: (t) => t.startsWith("sched_h_"),
  },
  {
    id: "schedule_i",
    title: "Schedule I — Current Income",
    subtitle: "Official Form 106I · Debtor's current monthly income",
    icon: <Banknote className="w-4 h-4" />,
    color: { bg: "bg-amber-500/5", border: "border-amber-500/25", text: "text-amber-400", badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    matchFn: (t) => t.startsWith("sched_i_"),
  },
  {
    id: "schedule_j",
    title: "Schedule J — Monthly Expenses",
    subtitle: "Official Form 106J · Debtor's current monthly expenses",
    icon: <BarChart2 className="w-4 h-4" />,
    color: { bg: "bg-sky-500/5", border: "border-sky-500/25", text: "text-sky-400", badge: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
    matchFn: (t) => t.startsWith("sched_j_"),
  },
  {
    id: "tax_returns",
    title: "Tax Returns — Last 2 Years",
    subtitle: "IRS Form 1040 · Required for bankruptcy eligibility and means test",
    icon: <Clipboard className="w-4 h-4" />,
    color: { bg: "bg-emerald-500/5", border: "border-emerald-500/25", text: "text-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    matchFn: (t) => t.startsWith("tax_return_"),
  },
  {
    id: "bank_balances",
    title: "Bank Balances — Date of Filing",
    subtitle: "Form 106Sum · Account balances on the date the petition is filed",
    icon: <Building className="w-4 h-4" />,
    color: { bg: "bg-blue-500/5", border: "border-blue-500/25", text: "text-blue-400", badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    matchFn: (t) => t.startsWith("bank_bal_"),
  },
  {
    id: "creditor_listing",
    title: "Creditor Listing — iSoftpull / Manual Upload",
    subtitle: "Credit report from iSoftpull (if opted in) or manually uploaded creditor statements",
    icon: <CreditCard className="w-4 h-4" />,
    color: { bg: "bg-sky-500/5", border: "border-sky-600/30", text: "text-sky-400", badge: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
    matchFn: (t) =>
      t.startsWith("isoftpull_") || t.startsWith("creditor_manual_") || t.startsWith("creditor_listing_"),
  },
];

// Friendly label map for common slotKey values
const SLOT_LABEL_MAP: Record<string, string> = {
  debtor1_license:              "Photo ID — Debtor",
  debtor1_ssn_card:             "Social Security Card — Debtor",
  debtor2_license:              "Photo ID — Debtor 2",
  debtor2_ssn_card:             "Social Security Card — Debtor 2",
  credit_report_equifax:        "Credit Report — Equifax",
  credit_report_experian:       "Credit Report — Experian",
  credit_report_transunion:     "Credit Report — TransUnion",
  isoftpull_credit_report:      "iSoftpull Credit Report (Soft Pull)",
  isoftpull_transunion:         "iSoftpull — TransUnion Pre-Qualification Report",
  isoftpull_equifax:            "iSoftpull — Equifax Pre-Qualification Report",
  isoftpull_experian:           "iSoftpull — Experian Pre-Qualification Report",
  creditor_manual_upload:       "Manual Creditor Upload",
  creditor_listing_full:        "Full Creditor Listing (Manual)",
  creditor_manual_credit_card:  "Credit Card Statement — Manual Upload",
  creditor_manual_medical:      "Medical Bill — Manual Upload",
  creditor_manual_student_loan: "Student Loan Statement — Manual Upload",
  creditor_manual_auto_loan:    "Auto Loan Statement — Manual Upload",
  creditor_manual_personal_loan:"Personal Loan Statement — Manual Upload",
  creditor_manual_collection:   "Collection Notice — Manual Upload",
  creditor_manual_utility:      "Utility Past-Due Notice — Manual Upload",
  creditor_manual_other:        "Other Creditor Document — Manual Upload",
  tax_return_debtor1_year_1:    "Federal Tax Return — Debtor — Most Recent Year",
  tax_return_debtor1_year_2:    "Federal Tax Return — Debtor — Prior Year",
  tax_return_debtor2_year_1:    "Federal Tax Return — Debtor 2 — Most Recent Year",
  tax_return_debtor2_year_2:    "Federal Tax Return — Debtor 2 — Prior Year",
  means_ss_award_letter:        "SSA Benefit Award / Verification Letter",
  means_ssdi_award_letter:      "SSDI Award / Benefit Letter",
  means_va_award_letter:        "VA Benefit Award Letter",
  means_workers_comp_letter:    "Workers' Compensation Award / Statement",
  means_pension_statement:      "Pension Award Letter or Statement",
  means_alimony_order:          "Divorce Decree / Alimony Order",
  means_child_support_order:    "Child Support Order",
  means_other_income_docs:      "Other Income — Supporting Documentation",
  means_rental_lease:           "Rental Lease Agreement",
  retirement_401k:              "401(k) / 403(b) — Most Recent Statement",
  retirement_ira:               "IRA / Roth IRA — Most Recent Statement",
  retirement_pension_stmt:      "Pension Account — Most Recent Statement",
  sched_d_heloc:                "HELOC Statement",
  sched_e_child_support:        "Child Support Arrearage Statement",
  sched_e_alimony:              "Alimony / Spousal Support Arrearage",
  sched_e_irs_tax:              "IRS Tax Liability Notice / Transcript",
  sched_e_state_tax:            "State Tax Liability Notice",
  sched_e_other_priority:       "Other Priority Debt Documentation",
  sched_f_lawsuit:              "Lawsuit Summons / Complaint",
  sched_f_other_creditor:       "Other Creditor Statement",
  sched_g_res_lease:            "Residential Lease Agreement",
  sched_g_vehicle_lease:        "Vehicle Lease Agreement",
  sched_g_storage_lease:        "Storage Unit or Other Lease",
  sched_g_other_contract:       "Other Executory Contract",
  sched_h_divorce_decree:       "Divorce Decree",
  sched_h_separation_agreement: "Separation Agreement",
  sched_h_coborrower_id:        "Co-Borrower / Co-Signer — Photo ID",
  sched_i_ss_award:             "Social Security Award Letter",
  sched_i_va_award:             "VA Benefit Award Letter",
  sched_i_pension_stmt:         "Pension Statement",
  sched_i_support_stmt:         "Debtor Statement — Support from Friends or Family",
  sched_j_mortgage_stmt:        "Mortgage Statement (Residence)",
  sched_j_hoa_stmt:             "HOA Statement (Residence)",
  sched_j_res_lease:            "Residential Lease Agreement",
  sched_j_utilities:            "Utility Bill",
  sched_j_childcare:            "Childcare / School Tuition Statement",
  sched_j_medical:              "Medical / Health Insurance Premium Statement",
};

function slotLabel(docType: string): string {
  if (SLOT_LABEL_MAP[docType]) return SLOT_LABEL_MAP[docType];
  // Pattern-based label generation for numbered slots
  const m = docType.match(/(.+)_month_(\d+)$/);
  if (m) {
    const base = slotLabel(m[1]) || m[1].replace(/_/g, " ");
    return `${base} — Month ${m[2]}`;
  }
  const m2 = docType.match(/(.+)_(\d+)$/);
  if (m2) {
    const base = slotLabel(m2[1]) || m2[1].replace(/_/g, " ");
    const suffix = ["1","2","3"].includes(m2[2]) ? ["1st","2nd","3rd"][+m2[2]-1] : `#${m2[2]}`;
    return `${base} — ${suffix}`;
  }
  const m3 = docType.match(/(.+)_year_(\d+)$/);
  if (m3) {
    const base = slotLabel(m3[1]) || m3[1].replace(/_/g, " ");
    return `${base} — ${m3[2] === "1" ? "Most Recent Year" : "Prior Year"}`;
  }
  return docType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

type DocViewMode = "by_schedule" | "by_phase";

function BankruptcyDocumentSections({
  documents, supabaseUrl, anonKey,
}: {
  documents: Document[];
  supabaseUrl: string;
  anonKey: string;
}) {
  // BAN-30: view-mode toggle. "by_schedule" keeps the legacy BKDOC_SECTIONS
  // grouping (matches document_type prefix against bankruptcy schedule slots).
  // "by_phase" groups by case_file_phase from the docs table — useful for
  // reviewing what's been collected at each stage of the case lifecycle.
  const [viewMode, setViewMode] = useState<DocViewMode>("by_schedule");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(
    // Auto-expand sections that have documents
    BKDOC_SECTIONS.filter(s => documents.some(d => s.matchFn(d.document_type))).map(s => s.id)
  ));
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(
    // Auto-expand phases that have documents
    CASE_FILE_PHASES.filter(p => documents.some(d => d.phase === p)) as string[]
  ));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

  function togglePhase(phaseKey: string) {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseKey)) next.delete(phaseKey);
      else next.add(phaseKey);
      return next;
    });
  }

  function toggleSection(id: string) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function openDocument(doc: Document) {
    if (!doc.storage_path) return;
    setLoadingPreview(doc.id);
    try {
      const res = await fetch(
        `${supabaseUrl}/storage/v1/object/authenticated/${doc.storage_path}`,
        { headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey } }
      );
      if (!res.ok) {
        // Try public bucket fallback
        const pubRes = await fetch(
          `${supabaseUrl}/storage/v1/object/public/${doc.storage_path}`,
          { headers: { apikey: anonKey } }
        );
        if (!pubRes.ok) { setLoadingPreview(null); return; }
        const blob = await pubRes.blob();
        setPreviewUrl(URL.createObjectURL(blob));
      } else {
        const blob = await res.blob();
        setPreviewUrl(URL.createObjectURL(blob));
      }
      setPreviewName(doc.original_filename);
    } catch {
      // silent
    }
    setLoadingPreview(null);
  }

  const uncategorized = documents.filter(
    d => !BKDOC_SECTIONS.some(s => s.matchFn(d.document_type))
  );

  const totalDocs = documents.length;

  // Phase-grouped view buckets. NULL-phase docs land in "unclassified" so
  // they're still visible (matches behavior of the schedule-view "uncategorized" bucket).
  const docsByPhase: Record<string, Document[]> = {};
  for (const p of CASE_FILE_PHASES) docsByPhase[p] = [];
  const unclassifiedPhase: Document[] = [];
  for (const d of documents) {
    if (d.phase && docsByPhase[d.phase]) docsByPhase[d.phase].push(d);
    else unclassifiedPhase.push(d);
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-slate-500">
          {totalDocs} document{totalDocs !== 1 ? "s" : ""} on file
        </p>
        <div className="flex items-center gap-3">
          {/* BAN-30: view-mode toggle */}
          <div className="flex items-center gap-0.5 p-0.5 bg-slate-800/60 border border-slate-700 rounded-lg">
            {([
              { id: "by_schedule" as const, label: "By Schedule" },
              { id: "by_phase" as const,    label: "By Phase" },
            ]).map(opt => (
              <button
                key={opt.id}
                onClick={() => setViewMode(opt.id)}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded transition-colors ${
                  viewMode === opt.id
                    ? "bg-slate-700 text-white"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {viewMode === "by_schedule" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpandedSections(new Set(BKDOC_SECTIONS.map(s => s.id).concat(["uncategorized"])))}
                className="text-[10px] font-semibold text-slate-500 hover:text-white transition-colors"
              >Expand All</button>
              <span className="text-slate-700">·</span>
              <button
                onClick={() => setExpandedSections(new Set())}
                className="text-[10px] font-semibold text-slate-500 hover:text-white transition-colors"
              >Collapse All</button>
            </div>
          )}
          {viewMode === "by_phase" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpandedPhases(new Set([...CASE_FILE_PHASES, "unclassified"]))}
                className="text-[10px] font-semibold text-slate-500 hover:text-white transition-colors"
              >Expand All</button>
              <span className="text-slate-700">·</span>
              <button
                onClick={() => setExpandedPhases(new Set())}
                className="text-[10px] font-semibold text-slate-500 hover:text-white transition-colors"
              >Collapse All</button>
            </div>
          )}
        </div>
      </div>

      {viewMode === "by_phase" && (
        <>
          {CASE_FILE_PHASES.map(phaseKey => {
            const phaseDocs = docsByPhase[phaseKey];
            const isExpanded = expandedPhases.has(phaseKey);
            const hasDocs = phaseDocs.length > 0;
            return (
              <div key={phaseKey} className={`rounded-2xl border overflow-hidden ${hasDocs ? "bg-slate-800/30 border-slate-700/60" : "bg-[#0d1221] border-slate-800"}`}>
                <button
                  onClick={() => togglePhase(phaseKey)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${hasDocs ? "bg-amber-500/10 border border-amber-500/20" : "bg-slate-800/60 border border-slate-700/60"}`}>
                    <span className={`text-xs font-mono font-bold ${hasDocs ? "text-amber-400" : "text-slate-600"}`}>
                      {phaseKey.slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-bold ${hasDocs ? "text-white" : "text-slate-600"}`}>{PHASE_LABELS[phaseKey]}</p>
                      {hasDocs ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
                          {phaseDocs.length} file{phaseDocs.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-[9px] font-semibold text-slate-600 bg-slate-800/50 border border-slate-700/40 rounded-full px-1.5 py-0.5">
                          No documents
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5 truncate">{PHASE_DESCRIPTIONS[phaseKey]}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>
                {isExpanded && hasDocs && (
                  <div className="border-t border-slate-800/60 divide-y divide-slate-800/40">
                    {phaseDocs.map(doc => (
                      <div key={doc.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                        <div className="w-8 h-8 rounded-xl bg-slate-800/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {(doc.mime_type?.includes("image") || doc.original_filename?.match(/\.(jpg|jpeg|png|webp|gif)$/i))
                            ? <Eye className="w-3.5 h-3.5 text-sky-400" />
                            : <FileText className="w-3.5 h-3.5 text-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white">{slotLabel(doc.document_type)}</p>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">{doc.original_filename}</p>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-[9px] text-slate-600">{fmtDate(doc.uploaded_at)}</span>
                            {doc.ai_verified ? (
                              <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                              </span>
                            ) : (
                              <span className="text-[9px] font-semibold text-slate-600 bg-slate-800/50 border border-slate-700/40 rounded-full px-1.5 py-0.5">
                                Pending Review
                              </span>
                            )}
                          </div>
                        </div>
                        {doc.storage_path && (
                          <button
                            onClick={() => openDocument(doc)}
                            disabled={loadingPreview === doc.id}
                            className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 rounded-xl px-2.5 py-1.5 transition-colors disabled:opacity-50"
                          >
                            {loadingPreview === doc.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                            View
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {unclassifiedPhase.length > 0 && (
            <div className="rounded-2xl border border-slate-700/60 overflow-hidden bg-[#0d1221]">
              <button
                onClick={() => togglePhase("unclassified")}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-400">Unclassified (pending phase assignment)</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-slate-700/40 text-slate-400 border-slate-600/40">{unclassifiedPhase.length}</span>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-0.5">Docs uploaded before BAN-30 backfill or where the doc type didn't match a known phase pattern.</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${expandedPhases.has("unclassified") ? "rotate-180" : ""}`} />
              </button>
              {expandedPhases.has("unclassified") && (
                <div className="border-t border-slate-800/60 divide-y divide-slate-800/40">
                  {unclassifiedPhase.map(doc => (
                    <div key={doc.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                      <div className="w-8 h-8 rounded-xl bg-slate-800/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white">{slotLabel(doc.document_type)}</p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{doc.original_filename}</p>
                        <p className="text-[9px] text-slate-600 mt-1">{fmtDate(doc.uploaded_at)}</p>
                      </div>
                      {doc.storage_path && (
                        <button
                          onClick={() => openDocument(doc)}
                          disabled={loadingPreview === doc.id}
                          className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 rounded-xl px-2.5 py-1.5 transition-colors"
                        >
                          {loadingPreview === doc.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                          View
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {viewMode === "by_schedule" && (<>

      {/* Per-section cards */}
      {BKDOC_SECTIONS.map(section => {
        const sectionDocs = documents.filter(d => section.matchFn(d.document_type));
        const isExpanded = expandedSections.has(section.id);
        return (
          <div key={section.id} className={`rounded-2xl border overflow-hidden ${section.color.border} ${sectionDocs.length > 0 ? section.color.bg : "bg-[#0d1221]"}`}>
            {/* Section header */}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${sectionDocs.length > 0 ? section.color.bg : "bg-slate-800/60"} border ${sectionDocs.length > 0 ? section.color.border : "border-slate-700/60"}`}>
                <span className={sectionDocs.length > 0 ? section.color.text : "text-slate-600"}>{section.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-bold ${sectionDocs.length > 0 ? "text-white" : "text-slate-600"}`}>{section.title}</p>
                  {sectionDocs.length > 0 ? (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${section.color.badge}`}>
                      {sectionDocs.length} file{sectionDocs.length !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="text-[9px] font-semibold text-slate-600 bg-slate-800/50 border border-slate-700/40 rounded-full px-1.5 py-0.5">
                      No documents
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-600 mt-0.5 truncate">{section.subtitle}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            </button>

            {/* Document list */}
            {isExpanded && (
              <div className="border-t border-slate-800/60 divide-y divide-slate-800/40">
                {sectionDocs.length === 0 ? (
                  <div className="px-5 py-6 text-center">
                    <p className="text-xs text-slate-700">No documents uploaded for this section yet</p>
                  </div>
                ) : (
                  sectionDocs.map(doc => (
                    <div key={doc.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                      {/* File icon */}
                      <div className="w-8 h-8 rounded-xl bg-slate-800/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {(doc.mime_type?.includes("image") || doc.original_filename?.match(/\.(jpg|jpeg|png|webp|gif)$/i))
                          ? <Eye className="w-3.5 h-3.5 text-sky-400" />
                          : <FileText className="w-3.5 h-3.5 text-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Label from slot key */}
                        <p className="text-xs font-semibold text-white">{slotLabel(doc.document_type)}</p>
                        {/* Original filename */}
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{doc.original_filename}</p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="text-[9px] text-slate-600">{fmtDate(doc.uploaded_at)}</span>
                          {doc.ai_verified ? (
                            <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold text-slate-600 bg-slate-800/50 border border-slate-700/40 rounded-full px-1.5 py-0.5">
                              Pending Review
                            </span>
                          )}
                          {doc.ai_note && (
                            <span className="text-[9px] text-amber-400">{doc.ai_note}</span>
                          )}
                        </div>
                      </div>
                      {/* View button */}
                      {doc.storage_path && (
                        <button
                          onClick={() => openDocument(doc)}
                          disabled={loadingPreview === doc.id}
                          className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 rounded-xl px-2.5 py-1.5 transition-colors disabled:opacity-50"
                        >
                          {loadingPreview === doc.id
                            ? <RefreshCw className="w-3 h-3 animate-spin" />
                            : <Eye className="w-3 h-3" />}
                          View
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Uncategorized documents */}
      {uncategorized.length > 0 && (
        <div className="rounded-2xl border border-slate-700/60 overflow-hidden bg-[#0d1221]">
          <button
            onClick={() => toggleSection("uncategorized")}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center flex-shrink-0">
              <FolderOpen className="w-4 h-4 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-400">Other Documents</p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-slate-700/40 text-slate-400 border-slate-600/40">{uncategorized.length}</span>
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5">Uploaded files not yet assigned to a bankruptcy schedule</p>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${expandedSections.has("uncategorized") ? "rotate-180" : ""}`} />
          </button>
          {expandedSections.has("uncategorized") && (
            <div className="border-t border-slate-800/60 divide-y divide-slate-800/40">
              {uncategorized.map(doc => (
                <div key={doc.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-slate-800/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white">{doc.original_filename}</p>
                    <p className="text-[10px] text-slate-500 capitalize mt-0.5">{doc.document_type.replace(/_/g, " ")}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[9px] text-slate-600">{fmtDate(doc.uploaded_at)}</span>
                      {doc.ai_verified && (
                        <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                        </span>
                      )}
                    </div>
                  </div>
                  {doc.storage_path && (
                    <button
                      onClick={() => openDocument(doc)}
                      disabled={loadingPreview === doc.id}
                      className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 rounded-xl px-2.5 py-1.5 transition-colors"
                    >
                      {loadingPreview === doc.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                      View
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </>)}

      {documents.length === 0 && (
        <div className="bg-[#0d1221] border border-slate-800 rounded-2xl text-center py-16">
          <Upload className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No documents uploaded yet</p>
          <p className="text-slate-700 text-xs mt-1">Documents submitted through the client portal appear here, organized by bankruptcy schedule</p>
        </div>
      )}

      {/* Document preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setPreviewUrl(null); URL.revokeObjectURL(previewUrl); }}>
          <div className="bg-[#0d1221] border border-slate-700 rounded-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <p className="text-sm font-semibold text-white truncate">{previewName}</p>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  download={previewName}
                  className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-xl px-3 py-1.5 transition-colors"
                >
                  Download
                </a>
                <button onClick={() => { setPreviewUrl(null); URL.revokeObjectURL(previewUrl); }} className="text-slate-500 hover:text-white transition-colors p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 min-h-0">
              {previewName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img src={previewUrl} alt={previewName} className="max-w-full mx-auto rounded-xl" />
              ) : (
                <iframe src={previewUrl} className="w-full h-full min-h-[60vh] rounded-xl bg-white" title={previewName} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FileCabinet ──────────────────────────────────────────────────────────────

interface FileCabinetProps {
  onClientView?: (clientName: string, clientId: string) => void;
}

export default function FileCabinet({ onClientView }: FileCabinetProps = {}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [chapterFilter, setChapterFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [caseTypeFilter, setCaseTypeFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // Detail data
  const [fee, setFee] = useState<FeeStructure | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [timeLog, setTimeLog] = useState<TimeLogEntry[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowStatus | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [clientIsoftpullConsent, setClientIsoftpullConsent] = useState<boolean | null>(null);
  const [intakeSubmission, setIntakeSubmission] = useState<IntakeSubmission | null>(null);
  const [caseTypeSwitches, setCaseTypeSwitches] = useState<CaseTypeSwitch[]>([]);
  const [activeTab, setActiveTab] = useState<ClientTab>("overview");
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showCaseActionDropdown, setShowCaseActionDropdown] = useState(false);
  const [showChapterChangeModal, setShowChapterChangeModal] = useState(false);
  const [showCancelRequestModal, setShowCancelRequestModal] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Exit time entry state
  const [showExitTimeModal, setShowExitTimeModal] = useState(false);
  const [fileOpenedAt, setFileOpenedAt] = useState<Date | null>(null);

  // Manual time entry state (Time Logs tab)
  const [showAddTimeEntry, setShowAddTimeEntry] = useState(false);
  const [newEntryStaff, setNewEntryStaff] = useState("James Thompson");
  const [newEntryActivity, setNewEntryActivity] = useState("manual_note");
  const [newEntryMinutes, setNewEntryMinutes] = useState("12");
  const [newEntryBillable, setNewEntryBillable] = useState(true);
  const [newEntryRate, setNewEntryRate] = useState("225");
  const [newEntryNotes, setNewEntryNotes] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);

  const loadClients = useCallback(async () => {
    const data = await sbGet<Client>(
      "accounting_clients?select=id,full_name,email,phone,state,chapter,case_type,status,extended_status,case_number,filed_date,intake_date,notes,last_contact_date,intake_review_status,intake_submitted_at,assigned_attorney,assigned_paralegal&order=full_name.asc"
    );
    setClients(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const loadDetail = useCallback(async (clientId: string) => {
    setDetailLoading(true);
    const [fs, pmts, tl, msgs, wf, tks, docs, intake, switches] = await Promise.all([
      sbGet<FeeStructure>(`accounting_fee_structures?client_id=eq.${clientId}&limit=1`),
      sbGet<Payment>(`accounting_payments?client_id=eq.${clientId}&order=payment_date.desc&limit=50`),
      sbGet<TimeLogEntry>(`case_time_log?client_id=eq.${clientId}&order=started_at.desc&limit=100`),
      sbGet<Message>(`client_messages?client_id=eq.${clientId}&order=created_at.desc&limit=50`),
      sbGet<WorkflowStatus>(`case_workflow_status?client_id=eq.${clientId}&limit=1`),
      sbGet<Task>(`staff_tasks?client_id=eq.${clientId}&order=created_at.desc&limit=50`),
      sbGet<Document>(`client_documents?select=id,document_type,document_category,original_filename,storage_path,mime_type,ai_verified,ai_note,uploaded_at,phase&client_id=eq.${clientId}&order=uploaded_at.desc&limit=200`),
      sbGet<IntakeSubmission>(`intake_submissions?lead_id=eq.${clientId}&limit=1`).catch(() =>
        Promise.resolve([] as IntakeSubmission[])
      ),
      sbGet<CaseTypeSwitch>(`case_type_switches?client_id=eq.${clientId}&order=requested_at.desc&limit=10`),
    ]);
    setFee(fs[0] ?? null);
    setPayments(pmts);
    setTimeLog(tl);
    setMessages(msgs);
    setWorkflow(wf[0] ?? null);
    setTasks(tks);
    setDocuments(docs);
    setIntakeSubmission((intake as IntakeSubmission[])[0] ?? null);
    setCaseTypeSwitches(switches);

    // Check iSoftpull consent from client_registrations (keyed by email match)
    const clientEmail = clients.find(c => c.id === clientId)?.email;
    if (clientEmail) {
      const consentRows = await sbGet<{ consented_isoftpull_fcra: boolean }>(
        `client_registrations?email=eq.${encodeURIComponent(clientEmail)}&select=consented_isoftpull_fcra&limit=1`
      ).catch(() => [] as { consented_isoftpull_fcra: boolean }[]);
      setClientIsoftpullConsent(consentRows[0]?.consented_isoftpull_fcra ?? false);
    } else {
      setClientIsoftpullConsent(false);
    }

    setDetailLoading(false);
  }, []);

  useEffect(() => {
    if (selectedId) {
      setActiveTab("overview");
      setFileOpenedAt(new Date());
      setShowAddTimeEntry(false);
      loadDetail(selectedId);
    }
  }, [selectedId, loadDetail]);

  const selectedClient = clients.find(c => c.id === selectedId) ?? null;

  const uniqueStates = [...new Set(clients.map(c => c.state).filter(Boolean) as string[])].sort();

  const filtered = clients.filter(c => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (chapterFilter !== "all" && String(c.chapter) !== chapterFilter) return false;
    if (stateFilter !== "all" && c.state !== stateFilter) return false;
    if (caseTypeFilter !== "all" && c.case_type !== caseTypeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.full_name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.case_number ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q);
    }
    return true;
  });

  const reviewQueue = clients.filter(c =>
    c.intake_review_status === "submitted" || c.intake_review_status === "in_review"
  );

  function handleExitClient() {
    // Only prompt if file was open for more than 30 seconds
    if (fileOpenedAt && (Date.now() - fileOpenedAt.getTime()) > 30000) {
      const elapsed = Math.round((Date.now() - fileOpenedAt.getTime()) / 60000);
      setNewEntryMinutes(String(Math.max(6, elapsed)));
      setNewEntryActivity("file_open");
      setNewEntryNotes("");
      setNewEntryBillable(true);
      setShowExitTimeModal(true);
    } else {
      setSelectedId(null);
    }
  }

  async function saveTimeEntry(clientId: string, opts?: { activity?: string; minutes?: string; notes?: string; billable?: boolean; rate?: string; staff?: string }) {
    const activity = opts?.activity ?? newEntryActivity;
    const minutes  = parseFloat(opts?.minutes  ?? newEntryMinutes)  || 6;
    const notes    = opts?.notes    ?? newEntryNotes;
    const billable = opts?.billable ?? newEntryBillable;
    const rate     = parseFloat(opts?.rate  ?? newEntryRate) || 225;
    const staff    = opts?.staff    ?? newEntryStaff;
    const billableAmount = billable ? Math.round(minutes / 60 * rate * 100) / 100 : 0;
    setSavingEntry(true);
    await sbPost("case_time_log", {
      client_id: clientId,
      staff_name: staff,
      activity_type: activity,
      duration_minutes: minutes,
      billable,
      notes: notes || null,
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      billing_rate: billable ? rate : null,
      billable_amount: billable ? billableAmount : null,
      source_type: "manual",
      is_auto_logged: false,
    });
    setSavingEntry(false);
  }

  async function markInReview(clientId: string) {
    setReviewingId(clientId);
    await sbPatch("accounting_clients", clientId, { intake_review_status: "in_review" });
    await loadClients();
    setSelectedId(clientId);
    setActiveTab("overview");
    setReviewingId(null);
  }

  const tabBtn = (id: ClientTab) =>
    `px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
      activeTab === id
        ? "bg-slate-700 text-white"
        : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/60"
    }`;

  const hasActiveFilters = chapterFilter !== "all" || stateFilter !== "all" || caseTypeFilter !== "all";

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#090e1a] text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#090e1a]/95 backdrop-blur border-b border-slate-800 px-6 py-4">
        <div className="max-w-screen-xl mx-auto flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <FolderOpen className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-none">File Cabinet</h1>
            <p className="text-xs text-slate-500 mt-0.5">All client files — staff view</p>
          </div>
          {selectedClient && (
            <button
              onClick={handleExitClient}
              className="ml-4 flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> All Clients
            </button>
          )}
          <div className="ml-auto flex items-center gap-3">
            {reviewQueue.length > 0 && !selectedId && (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1">
                {reviewQueue.length} in review queue
              </span>
            )}
            <span className="text-xs text-slate-600">{clients.length} clients</span>
            <button onClick={loadClients} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6">
        {!selectedId ? (
          /* ── Client list ──────────────────────────────────────────────────── */
          <div className="space-y-4">
            {/* Review queue banner */}
            {reviewQueue.length > 0 && (
              <div className="bg-amber-500/8 border border-amber-500/25 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Flag className="w-4 h-4 text-amber-400" />
                  <p className="text-sm font-bold text-amber-400">Intake Review Queue</p>
                  <span className="text-xs text-amber-500/70">— clients who have submitted their questionnaire and are ready for attorney or paralegal review</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {reviewQueue.map(c => (
                    <button
                      key={c.id}
                      onClick={() => markInReview(c.id)}
                      disabled={reviewingId === c.id}
                      className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl px-3 py-2 transition-colors text-xs"
                    >
                      <User className="w-3 h-3 text-amber-400" />
                      <span className="text-amber-300 font-semibold">{c.full_name}</span>
                      <span className="text-amber-500">·</span>
                      <span className="text-amber-500">Ch. {c.chapter} {c.state}</span>
                      {c.intake_submitted_at && <span className="text-amber-600 text-[10px]">{fmtDate(c.intake_submitted_at)}</span>}
                      <span className="text-[10px] font-bold bg-amber-500 text-black rounded-full px-2 py-0.5">
                        {reviewingId === c.id ? "Opening…" : "Review"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, email, case #, phone..."
                    className="w-full bg-slate-800/60 border border-slate-700/60 text-white text-sm rounded-xl pl-9 pr-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-500"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["all", "active", "filed", "on_hold", "closed"].map(s => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                        statusFilter === s
                          ? "bg-slate-700 text-white border-slate-600"
                          : "bg-transparent text-slate-500 border-slate-700/60 hover:border-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowFilters(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                    hasActiveFilters || showFilters
                      ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                      : "bg-transparent text-slate-500 border-slate-700/60 hover:border-slate-500 hover:text-slate-300"
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filters {hasActiveFilters && <span className="bg-sky-500 text-white rounded-full text-[9px] px-1.5">on</span>}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
                </button>
              </div>

              {showFilters && (
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 flex flex-wrap gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Chapter</label>
                    <div className="flex gap-1.5">
                      {["all", "7", "13"].map(v => (
                        <button key={v} onClick={() => setChapterFilter(v)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${chapterFilter === v ? "bg-slate-700 text-white border-slate-600" : "text-slate-500 border-slate-700/60 hover:text-slate-300"}`}>
                          {v === "all" ? "All" : `Ch. ${v}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Case Type</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {[{ v: "all", l: "All" }, ...CASE_TYPES.map(t => ({ v: t.value, l: t.label }))].map(o => (
                        <button key={o.v} onClick={() => setCaseTypeFilter(o.v)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${caseTypeFilter === o.v ? "bg-slate-700 text-white border-slate-600" : "text-slate-500 border-slate-700/60 hover:text-slate-300"}`}>
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">State</label>
                    <select
                      value={stateFilter}
                      onChange={e => setStateFilter(e.target.value)}
                      className="bg-slate-800/60 border border-slate-700/60 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none"
                    >
                      <option value="all">All States</option>
                      {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {hasActiveFilters && (
                    <button
                      onClick={() => { setChapterFilter("all"); setStateFilter("all"); setCaseTypeFilter("all"); }}
                      className="self-end text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <RefreshCw className="w-6 h-6 text-slate-600 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <FolderOpen className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500">No clients found</p>
              </div>
            ) : (
              <div className="bg-[#0d1221] border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Client</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden sm:table-cell">Case</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell">Contact</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden lg:table-cell">Intake</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {filtered.map(c => {
                      const sc = STATUS_CONFIG[c.status ?? "active"];
                      const inQueue = c.intake_review_status === "submitted" || c.intake_review_status === "in_review";
                      return (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedId(c.id)}
                          className="hover:bg-slate-800/30 cursor-pointer transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-slate-700/60 flex items-center justify-center flex-shrink-0">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-white">{c.full_name}</p>
                                <p className="text-[10px] text-slate-600">{c.state ?? "—"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 hidden sm:table-cell">
                            <p className="text-xs font-mono text-slate-400">{c.case_number ?? "Pending"}</p>
                            <p className="text-[10px] text-slate-600 capitalize">Ch. {c.chapter} · {c.case_type?.replace(/_/g, " ")}</p>
                          </td>
                          <td className="px-4 py-3.5 hidden md:table-cell">
                            <p className="text-xs text-slate-400">{c.email ?? "—"}</p>
                            <p className="text-[10px] text-slate-600">{c.phone ?? "—"}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`text-xs font-semibold capitalize ${sc?.color ?? "text-slate-400"}`}>
                              {c.status?.replace("_", " ") ?? "—"}
                            </span>
                            {inQueue && (
                              <p className="text-[9px] font-bold text-amber-400 flex items-center gap-0.5 mt-0.5">
                                <Flag className="w-2.5 h-2.5" /> Review Queue
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3.5 hidden lg:table-cell">
                            <p className="text-xs text-slate-500">{fmtDate(c.intake_date)}</p>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {inQueue ? (
                              <span className="text-[10px] font-bold bg-amber-500 text-black rounded-full px-2 py-0.5">Review</span>
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-600 inline" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* ── Client detail ───────────────────────────────────────────────── */
          <div className="space-y-5">
            {/* Client header card */}
            <div className="bg-[#0d1221] border border-slate-800 rounded-2xl p-5">
              <div className="flex flex-wrap items-start gap-5">
                <div className="w-12 h-12 rounded-2xl bg-slate-700/60 flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold text-white">{selectedClient?.full_name}</h2>
                    <span className={`text-xs font-semibold capitalize px-2.5 py-1 rounded-lg ${STATUS_CONFIG[selectedClient?.status ?? "active"]?.color ?? "text-slate-400"} ${STATUS_CONFIG[selectedClient?.status ?? "active"]?.bg ?? "bg-slate-700/40"}`}>
                      {selectedClient?.status?.replace("_", " ") ?? "—"}
                    </span>
                    {workflow && (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${STAGE_CONFIG[workflow.stage]?.color ?? "text-slate-400"} ${STAGE_CONFIG[workflow.stage]?.bg ?? ""}`}>
                        {STAGE_CONFIG[workflow.stage]?.label ?? workflow.stage}
                      </span>
                    )}
                    {(selectedClient?.intake_review_status === "submitted" || selectedClient?.intake_review_status === "in_review") && (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 flex items-center gap-1">
                        <Flag className="w-2.5 h-2.5" /> In Review Queue
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1.5"><Scale className="w-3 h-3" />Ch. {selectedClient?.chapter} · {selectedClient?.case_type?.replace(/_/g, " ")}</span>
                    {selectedClient?.case_number && <span className="flex items-center gap-1.5"><Hash className="w-3 h-3" />{selectedClient.case_number}</span>}
                    {selectedClient?.state && <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />{selectedClient.state}</span>}
                    {selectedClient?.email && <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{selectedClient.email}</span>}
                    {selectedClient?.phone && <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{selectedClient.phone}</span>}
                    <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" />Intake: {fmtDate(selectedClient?.intake_date ?? null)}</span>
                    {selectedClient?.filed_date && <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" />Filed: {fmtDate(selectedClient.filed_date)}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs mt-2">
                    {selectedClient?.assigned_attorney && (
                      <span className="flex items-center gap-1.5 text-sky-400/80">
                        <Briefcase className="w-3 h-3" />
                        <span className="text-slate-500">Atty:</span> {selectedClient.assigned_attorney}
                      </span>
                    )}
                    {selectedClient?.assigned_paralegal && (
                      <span className="flex items-center gap-1.5 text-emerald-400/80">
                        <Users className="w-3 h-3" />
                        <span className="text-slate-500">Paralegal:</span> {selectedClient.assigned_paralegal}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  {/* Review This Case */}
                  {(selectedClient?.intake_review_status === "submitted" || selectedClient?.intake_review_status === "in_review") && (
                    <button
                      onClick={() => setActiveTab("portal")}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-xl transition-colors"
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      Review This Case
                    </button>
                  )}
                  {/* Client View */}
                  <button
                    onClick={() => onClientView
                      ? onClientView(selectedClient.full_name, selectedClient.id)
                      : setActiveTab("portal")
                    }
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-xl transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Client View
                  </button>
                  {/* Case Actions Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowCaseActionDropdown(v => !v)}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-700/60 hover:bg-slate-700 text-slate-300 border border-slate-600/60 rounded-xl transition-colors"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      Case Actions
                      <ChevronDown className="w-3 h-3 ml-0.5" />
                    </button>
                    {showCaseActionDropdown && (
                      <div className="absolute top-full mt-1 left-0 z-50 w-52 bg-[#0d1221] border border-slate-700 rounded-xl shadow-2xl overflow-hidden" onClick={() => setShowCaseActionDropdown(false)}>
                        <button
                          onClick={() => setShowChapterChangeModal(true)}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-xs text-left hover:bg-slate-800 transition-colors"
                        >
                          <GitBranch className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-white">Change Chapter</p>
                            <p className="text-slate-500 mt-0.5">Switch bankruptcy chapter or case type</p>
                          </div>
                        </button>
                        <div className="border-t border-slate-800" />
                        <button
                          onClick={() => setShowCancelRequestModal(true)}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-xs text-left hover:bg-slate-800 transition-colors"
                        >
                          <X className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-red-400">Cancel Request</p>
                            <p className="text-slate-500 mt-0.5">Notify super admin attorney</p>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Log Time */}
                  <button
                    onClick={() => { setActiveTab("timelog"); setShowAddTimeEntry(true); }}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Log Time
                  </button>
                </div>

                {fee && (
                  <div className="w-full grid grid-cols-3 sm:grid-cols-6 gap-2 mt-1">
                    {[
                      { label: "Attorney Fee", val: fmt(fee.attorney_fee) },
                      { label: "Filing Fee",   val: fmt(fee.court_filing_fee), highlight: fee.cff_paid ? "green" : "orange" },
                      { label: "Total Fee",    val: fmt(fee.total_fee) },
                      { label: "IOLTA",        val: fmt(fee.iolta_balance) },
                      { label: "Payments",     val: fmt(payments.filter(p => !p.voided).reduce((s, p) => s + p.amount, 0)) },
                      { label: "Balance",      val: fmt(fee.total_fee - payments.filter(p => !p.voided).reduce((s, p) => s + p.amount, 0)) },
                    ].map(item => (
                      <div key={item.label} className="bg-slate-800/40 rounded-xl p-2.5 text-center">
                        <p className="text-[10px] text-slate-500">{item.label}</p>
                        <p className={`text-sm font-bold ${item.highlight === "green" ? "text-emerald-400" : item.highlight === "orange" ? "text-orange-400" : "text-white"}`}>{item.val}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Case type switch history */}
            {caseTypeSwitches.length > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-5 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <GitBranch className="w-3.5 h-3.5 text-amber-400" />
                  <p className="text-xs font-bold text-amber-400">Case Type Switch History</p>
                </div>
                <div className="space-y-1.5">
                  {caseTypeSwitches.map(sw => (
                    <div key={sw.id} className="flex items-center gap-3 text-xs">
                      <span className="text-slate-500">Ch. {sw.original_chapter} {sw.original_case_type}</span>
                      <ArrowRightLeft className="w-3 h-3 text-slate-600" />
                      <span className="text-slate-300 font-medium">Ch. {sw.new_chapter} {sw.new_case_type.replace(/_/g, " ")}</span>
                      <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold ${sw.status === "active" ? "bg-emerald-500/10 text-emerald-400" : sw.status === "pending" ? "bg-amber-500/10 text-amber-400" : "bg-slate-700/40 text-slate-500"}`}>{sw.status}</span>
                      <span className="text-slate-600">{fmtDate(sw.requested_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab nav */}
            <div className="flex items-center gap-1 flex-wrap">
              {(["overview", "payments", "docs", "messages", "timelog", "tasks"] as ClientTab[]).map(t => (
                <button key={t} onClick={() => setActiveTab(t)} className={tabBtn(t)}>
                  {t === "overview" && <Activity className="w-3.5 h-3.5 inline mr-1.5" />}
                  {t === "payments" && <DollarSign className="w-3.5 h-3.5 inline mr-1.5" />}
                  {t === "docs" && <FileText className="w-3.5 h-3.5 inline mr-1.5" />}
                  {t === "messages" && <MessageCircle className="w-3.5 h-3.5 inline mr-1.5" />}
                  {t === "timelog" && <Clock className="w-3.5 h-3.5 inline mr-1.5" />}
                  {t === "tasks" && <CheckCheck className="w-3.5 h-3.5 inline mr-1.5" />}
                  {t === "overview" && "Overview"}
                  {t === "payments" && "Payments"}
                  {t === "docs" && "Documents"}
                  {t === "messages" && <>Messages {messages.length > 0 && <span className="ml-1 text-[9px] bg-slate-600 rounded px-1">{messages.length}</span>}</>}
                  {t === "timelog" && "Time Logs"}
                  {t === "tasks" && <>Tasks {tasks.filter(t => t.status === "pending" || t.status === "in_progress").length > 0 && <span className="ml-1 text-[9px] bg-amber-500/30 text-amber-400 rounded px-1">{tasks.filter(t => t.status === "pending" || t.status === "in_progress").length}</span>}</>}
                </button>
              ))}
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-5 h-5 text-slate-600 animate-spin" />
              </div>
            ) : (
              <>
                {/* Overview tab */}
                {activeTab === "overview" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 11-Stage Progress Tracker — full width */}
                    <div className="md:col-span-2 bg-[#0d1221] border border-slate-800 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Case Progress</p>
                          <p className="text-xs text-slate-600 mt-0.5">Mirrors the client portal — what the client sees as their journey</p>
                        </div>
                        {(() => {
                          // Determine current stage number from workflow
                          const s = workflow;
                          let current = 1;
                          if (!s) current = 1;
                          else if (s.filed_at) current = 11;
                          else if (s.signed_at) current = 8;
                          else if (s.scheduling_approved) current = 7;
                          else if (s.filing_fee_paid && s.missing_docs_cleared && s.attorney_review_complete) current = 7;
                          else if (s.attorney_review_complete) current = 6;
                          else if (s.paralegal_review_complete) current = 5;
                          else if (s.missing_docs_cleared) current = 4;
                          else if (s.stage === "docs_missing") current = 3;
                          else if (s.stage === "intake" || s.stage === "paralegal_review") current = 2;
                          else current = 2;
                          const pct = Math.round(((current - 1) / 10) * 100);
                          return (
                            <div className="text-right">
                              <p className="text-2xl font-bold text-white">Stage {current}<span className="text-slate-600 text-sm font-normal"> / 11</span></p>
                              <p className="text-xs text-slate-500">{pct}% complete</p>
                            </div>
                          );
                        })()}
                      </div>

                      {(() => {
                        const s = workflow;
                        // Derive completion state for each of 11 stages
                        const stages: { num: number; label: string; sub: string; status: "complete" | "active" | "upcoming" | "blocked"; detail?: string }[] = [
                          {
                            num: 1,
                            label: "Intake & Retention",
                            sub: "Signed retainer, completed initial intake",
                            status: "complete",
                          },
                          {
                            num: 2,
                            label: "Information & Questionnaire",
                            sub: "Financial questionnaire submitted",
                            status: selectedClient?.intake_review_status === "submitted" || selectedClient?.intake_review_status === "in_review" || selectedClient?.intake_review_status === "reviewed" || selectedClient?.intake_review_status === "approved"
                              ? "complete"
                              : s && s.stage !== "intake"
                              ? "complete"
                              : "active",
                          },
                          {
                            num: 3,
                            label: "Document Upload",
                            sub: "All required documents submitted",
                            status: !s ? "upcoming"
                              : s.missing_docs_cleared ? "complete"
                              : s.stage === "docs_missing" ? "blocked"
                              : s.stage === "paralegal_review" || s.stage === "attorney_review" || s.stage === "filing_fee_pending" || s.stage === "ready_to_schedule" || s.stage === "scheduled" || s.stage === "filed" ? "complete"
                              : "active",
                            detail: !s?.missing_docs_cleared && s?.missing_docs_list && s.missing_docs_list.length > 0
                              ? `Missing: ${s.missing_docs_list.slice(0, 2).join(", ")}${s.missing_docs_list.length > 2 ? ` +${s.missing_docs_list.length - 2} more` : ""}`
                              : undefined,
                          },
                          {
                            num: 4,
                            label: "Paralegal Review",
                            sub: "Paralegal reviews completeness",
                            status: !s ? "upcoming"
                              : s.paralegal_review_complete ? "complete"
                              : s.stage === "paralegal_review" ? "active"
                              : "upcoming",
                            detail: s?.paralegal_reviewed_by ? `Reviewed by ${s.paralegal_reviewed_by}` : undefined,
                          },
                          {
                            num: 5,
                            label: "Attorney Review",
                            sub: "Attorney prepares & verifies petition",
                            status: !s ? "upcoming"
                              : s.attorney_review_complete ? "complete"
                              : s.stage === "attorney_review" ? "active"
                              : "upcoming",
                            detail: s?.attorney_reviewed_by ? `Reviewed by ${s.attorney_reviewed_by}` : undefined,
                          },
                          {
                            num: 6,
                            label: "Filing Fee Paid",
                            sub: "Court filing fee cleared",
                            status: !s ? "upcoming"
                              : (fee?.cff_paid || s.filing_fee_paid) ? "complete"
                              : s.stage === "filing_fee_pending" ? "active"
                              : s.attorney_review_complete ? "active"
                              : "upcoming",
                          },
                          {
                            num: 7,
                            label: "Signing Appointment",
                            sub: "Client signs petition & schedules",
                            status: !s ? "upcoming"
                              : s.signed_at ? "complete"
                              : s.scheduling_approved ? "active"
                              : s.stage === "scheduled" ? "active"
                              : s.stage === "ready_to_schedule" ? "active"
                              : "upcoming",
                            detail: s?.signed_at ? `Signed ${fmtDate(s.signed_at)}` : undefined,
                          },
                          {
                            num: 8,
                            label: "Filed with Court",
                            sub: "Petition electronically filed, auto stay in effect",
                            status: !s ? "upcoming"
                              : s.filed_at ? "complete"
                              : s.signed_at ? "active"
                              : "upcoming",
                            detail: s?.filed_at ? `Filed ${fmtDate(s.filed_at)}` : undefined,
                          },
                          {
                            num: 9,
                            label: "341 Meeting of Creditors",
                            sub: "Mandatory hearing with bankruptcy trustee",
                            status: !s ? "upcoming"
                              : selectedClient?.status === "filed" && s.filed_at ? "active"
                              : "upcoming",
                          },
                          {
                            num: 10,
                            label: "60-Day Objection Period",
                            sub: "No creditor objections — case proceeds",
                            status: "upcoming",
                          },
                          {
                            num: 11,
                            label: "Discharge",
                            sub: "Eligible debts legally eliminated by court order",
                            status: selectedClient?.extended_status === "case_closed" || selectedClient?.status === "closed" ? "complete" : "upcoming",
                          },
                        ];

                        const completedCount = stages.filter(s => s.status === "complete").length;
                        const currentStage = stages.find(s => s.status === "active") ?? stages[0];

                        return (
                          <div className="space-y-1">
                            {/* Progress bar */}
                            <div className="relative h-1.5 bg-slate-800 rounded-full mb-6 overflow-hidden">
                              <div
                                className="absolute left-0 top-0 h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full transition-all duration-700"
                                style={{ width: `${(completedCount / 11) * 100}%` }}
                              />
                            </div>

                            {stages.map((stage, idx) => {
                              const isLast = idx === stages.length - 1;
                              const statusColor = stage.status === "complete"
                                ? { dot: "bg-emerald-500", num: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40", label: "text-slate-300", connector: "bg-emerald-500/30" }
                                : stage.status === "active"
                                ? { dot: "bg-sky-500 ring-4 ring-sky-500/20", num: "bg-sky-500/20 text-sky-400 border-sky-500/40", label: "text-white font-semibold", connector: "bg-slate-700" }
                                : stage.status === "blocked"
                                ? { dot: "bg-red-500", num: "bg-red-500/10 text-red-400 border-red-500/30", label: "text-red-400", connector: "bg-slate-700" }
                                : { dot: "bg-slate-700", num: "bg-slate-800/60 text-slate-600 border-slate-700/60", label: "text-slate-600", connector: "bg-slate-800" };

                              return (
                                <div key={stage.num} className="flex items-start gap-3">
                                  {/* Number + connector */}
                                  <div className="flex flex-col items-center flex-shrink-0">
                                    <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-all ${statusColor.num}`}>
                                      {stage.status === "complete"
                                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        : stage.status === "blocked"
                                        ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                        : <span>{stage.num}</span>}
                                    </div>
                                    {!isLast && <div className={`w-0.5 h-5 mt-0.5 ${statusColor.connector}`} />}
                                  </div>

                                  {/* Content */}
                                  <div className={`pb-${isLast ? "0" : "1"} flex-1 min-w-0`}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`text-sm ${statusColor.label}`}>{stage.label}</span>
                                      {stage.status === "active" && (
                                        <span className="text-[9px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-full px-2 py-0.5 uppercase tracking-wide">Current</span>
                                      )}
                                      {stage.status === "blocked" && (
                                        <span className="text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-full px-2 py-0.5 uppercase tracking-wide">Action Required</span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-600 mt-0.5">{stage.sub}</p>
                                    {stage.detail && (
                                      <p className={`text-[10px] mt-0.5 ${stage.status === "blocked" ? "text-red-400" : "text-slate-500"}`}>{stage.detail}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Fee summary */}
                    <div className="bg-[#0d1221] border border-slate-800 rounded-2xl p-5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Fee Summary</p>
                      {fee ? (
                        <div className="space-y-2">
                          {[
                            ["Attorney Fee",    fmt(fee.attorney_fee)],
                            ["Court Filing Fee",fmt(fee.court_filing_fee)],
                            ["Total Fee",       fmt(fee.total_fee)],
                            ["Down Payment",    fmt(fee.down_payment)],
                            ["IOLTA Balance",   fmt(fee.iolta_balance)],
                            ["Plan Months",     fee.plan_months ? `${fee.plan_months} months (${fee.payment_frequency?.replace(/_/g, " ")})` : "Paid in full"],
                          ].map(([label, val]) => (
                            <div key={label} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/60 last:border-0">
                              <span className="text-slate-500">{label}</span>
                              <span className="text-slate-200 font-medium">{val}</span>
                            </div>
                          ))}
                          <div className="pt-2 flex items-center gap-2">
                            {fee.cff_paid
                              ? <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Filing fee paid</span>
                              : <span className="text-xs text-orange-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Filing fee outstanding</span>}
                            {fee.approved_for_signing
                              ? <span className="text-xs text-emerald-400 flex items-center gap-1 ml-auto"><Shield className="w-3 h-3" />Approved to sign</span>
                              : <span className="text-xs text-slate-600 flex items-center gap-1 ml-auto"><Lock className="w-3 h-3" />Not approved</span>}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600 text-center py-6">No fee structure on file</p>
                      )}
                    </div>

                    {/* Notes */}
                    {selectedClient?.notes && (
                      <div className="bg-[#0d1221] border border-slate-800 rounded-2xl p-5">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Case Notes</p>
                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedClient.notes}</p>
                      </div>
                    )}

                    {/* Recent activity */}
                    <div className={`bg-[#0d1221] border border-slate-800 rounded-2xl p-5 ${selectedClient?.notes ? "" : "md:col-span-2"}`}>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Recent Activity</p>
                      {timeLog.length === 0 ? (
                        <p className="text-xs text-slate-600 text-center py-4">No activity logged</p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {timeLog.slice(0, 20).map(entry => (
                            <div key={entry.id} className="flex items-start gap-3 text-xs py-2 border-b border-slate-800/40 last:border-0">
                              <Activity className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <span className="text-slate-400 font-medium">{entry.staff_name}</span>
                                <span className="text-slate-600 mx-1.5">·</span>
                                <span className="text-slate-500 capitalize">{entry.activity_type.replace(/_/g, " ")}</span>
                                {entry.billable_amount && <span className="text-emerald-400 ml-1.5 font-medium">{fmt(entry.billable_amount)}</span>}
                                {entry.notes && <p className="text-slate-600 mt-0.5 truncate">{entry.notes}</p>}
                              </div>
                              <span className="text-slate-700 flex-shrink-0">{fmtDate(entry.started_at)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Payments tab */}
                {activeTab === "payments" && (
                  <div className="bg-[#0d1221] border border-slate-800 rounded-2xl overflow-hidden">
                    {payments.length === 0 ? (
                      <div className="text-center py-16"><DollarSign className="w-8 h-8 text-slate-700 mx-auto mb-3" /><p className="text-slate-500">No payments recorded</p></div>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-800">
                            {["Date", "Type", "Amount", "Account", "Method", "Status"].map(h => (
                              <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {payments.map(p => (
                            <tr key={p.id} className="hover:bg-slate-800/20">
                              <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(p.payment_date)}</td>
                              <td className="px-4 py-3 text-xs text-slate-300 capitalize">{p.payment_type.replace(/_/g, " ")}</td>
                              <td className="px-4 py-3 text-sm font-bold text-white">{fmt(p.amount)}</td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${p.destination_account === "iolta" ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                                  {p.destination_account?.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500">{p.payment_method ?? "—"}</td>
                              <td className="px-4 py-3">
                                {p.voided ? <span className="text-xs text-red-400">Voided</span>
                                  : p.refunded ? <span className="text-xs text-orange-400">Refunded</span>
                                  : <span className="text-xs text-emerald-400">Confirmed</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Documents tab */}
                {activeTab === "docs" && (
                  <div className="space-y-4">
                    {/* Creditor Listing Source Panel */}
                    <div className="bg-[#0d1221] border border-sky-500/20 rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <CreditCard className="w-4 h-4 text-sky-400" />
                        <h3 className="text-sm font-bold text-white">Creditor Listing Source</h3>
                        <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          clientIsoftpullConsent
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          {clientIsoftpullConsent === null ? 'Checking...' : clientIsoftpullConsent ? 'iSoftpull Active' : 'Manual Upload'}
                        </span>
                      </div>

                      {clientIsoftpullConsent ? (
                        <div className="space-y-3">
                          <div className="flex items-start gap-3 bg-sky-900/10 border border-sky-500/20 rounded-xl p-3">
                            <svg className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <div>
                              <p className="text-sky-300 text-xs font-semibold">Client has consented to iSoftpull credit pre-qualification</p>
                              <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                                A soft credit pull may be initiated through iSoftpull / TransUnion. The resulting pre-qualification report will appear in the <strong className="text-slate-300">Creditor Listing</strong> section below once pulled. This does not affect the client's credit score.
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-2.5">
                              <p className="text-slate-500 text-[10px] uppercase tracking-wide font-semibold mb-1">Source</p>
                              <p className="text-slate-300">iSoftpull / TransUnion</p>
                            </div>
                            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-2.5">
                              <p className="text-slate-500 text-[10px] uppercase tracking-wide font-semibold mb-1">Pull Type</p>
                              <p className="text-sky-400">Soft Pull — No Score Impact</p>
                            </div>
                            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-2.5">
                              <p className="text-slate-500 text-[10px] uppercase tracking-wide font-semibold mb-1">Billing</p>
                              <p className="text-slate-300">Per-pull via BankruptcyDocs.ai</p>
                            </div>
                            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-2.5">
                              <p className="text-slate-500 text-[10px] uppercase tracking-wide font-semibold mb-1">FCRA Consent</p>
                              <p className="text-emerald-400">Captured &amp; Timestamped</p>
                            </div>
                          </div>
                          {documents.filter(d => d.document_type.startsWith("isoftpull_")).length === 0 && (
                            <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5">
                              <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                              </svg>
                              <p className="text-amber-300 text-xs">No iSoftpull report uploaded yet. Initiate a pull through iSoftpull or upload the report manually below.</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-start gap-3 bg-amber-900/10 border border-amber-500/20 rounded-xl p-3">
                            <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <div>
                              <p className="text-amber-300 text-xs font-semibold">Client did not opt in to iSoftpull — manual creditor upload required</p>
                              <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                                This client has not consented to credit pre-qualification via iSoftpull. Creditor information must be collected manually. Upload individual creditor statements, bills, or collection notices to the <strong className="text-slate-300">Creditor Listing</strong> section below using the document checklist.
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {['Credit Card Statements', 'Medical Bills', 'Collection Notices', 'Student Loan Statements', 'Personal Loan Docs', 'Other Creditor Docs'].map(label => (
                              <div key={label} className="bg-slate-800/60 border border-slate-700 rounded-lg p-2.5 flex items-center gap-1.5">
                                <svg className="w-3 h-3 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                                </svg>
                                <span className="text-slate-300">{label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <BankruptcyDocumentSections
                      documents={documents}
                      supabaseUrl={SUPABASE_URL}
                      anonKey={ANON_KEY}
                    />

                    {/* BAN-29: per-case trustee submission widget. Renders below
                        the documents grid whenever the client has any docs in
                        phase 07-trustee so firm staff can submit them. The
                        widget itself further short-circuits when no trustees
                        are configured for the firm yet. */}
                    {selectedClient && documents.some(d => d.phase === '07-trustee') && (
                      <TrusteeSubmissionWidget clientId={selectedClient.id} />
                    )}
                  </div>
                )}

                {/* Messages tab */}
                {activeTab === "messages" && (
                  <div className="space-y-3">
                    {messages.length === 0 ? (
                      <div className="bg-[#0d1221] border border-slate-800 rounded-2xl text-center py-16">
                        <MessageCircle className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-500">No messages</p>
                      </div>
                    ) : (
                      messages.map(msg => (
                        <div key={msg.id} className={`rounded-2xl px-5 py-4 border ${msg.is_internal ? "bg-amber-500/5 border-amber-500/15 border-dashed" : "bg-[#0d1221] border-slate-800"}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-semibold text-slate-300">{msg.sender_name}</span>
                            <span className="text-[10px] text-slate-600 capitalize">{msg.sender_role}</span>
                            {msg.is_internal && <span className="text-[10px] text-amber-400 bg-amber-500/10 rounded px-1.5">Internal</span>}
                            <span className="ml-auto text-[10px] text-slate-600">{fmtDate(msg.created_at)}</span>
                          </div>
                          {msg.subject && <p className="text-xs font-semibold text-white mb-1">{msg.subject}</p>}
                          <p className="text-sm text-slate-300 leading-relaxed">{msg.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Time Logs tab */}
                {activeTab === "timelog" && (
                  <div className="space-y-4">
                    {/* Manual entry form */}
                    {showAddTimeEntry ? (
                      <div className="bg-[#0d1221] border border-emerald-500/25 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <PenLine className="w-4 h-4 text-emerald-400" />
                            <p className="text-sm font-bold text-white">Add Time Entry</p>
                          </div>
                          <button onClick={() => setShowAddTimeEntry(false)} className="text-slate-500 hover:text-white transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Staff Member</label>
                            <select
                              value={newEntryStaff}
                              onChange={e => setNewEntryStaff(e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 transition-colors"
                            >
                              <option>James Thompson</option>
                              <option>Maria Garcia</option>
                              <option>Sarah Lee</option>
                              <option>David Reeves</option>
                              <option>Lisa Chen</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Activity Type</label>
                            <select
                              value={newEntryActivity}
                              onChange={e => setNewEntryActivity(e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 transition-colors"
                            >
                              {[
                                ["manual_note",      "Manual Note"],
                                ["file_open",        "File Review"],
                                ["client_call",      "Client Call"],
                                ["creditor_call",    "Creditor Call"],
                                ["email",            "Email"],
                                ["sms_thread",       "SMS / Text"],
                                ["video_call",       "Video Call"],
                                ["paralegal_review", "Paralegal Review"],
                                ["attorney_review",  "Attorney Review"],
                                ["document_upload",  "Document Review"],
                                ["payment_adjustment","Payment Adjustment"],
                                ["other",            "Other"],
                              ].map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Duration (minutes)</label>
                            <input
                              type="number"
                              min="1"
                              value={newEntryMinutes}
                              onChange={e => setNewEntryMinutes(e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Billing Rate ($/hr)</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                value={newEntryRate}
                                onChange={e => setNewEntryRate(e.target.value)}
                                disabled={!newEntryBillable}
                                className="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-40"
                              />
                              <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={newEntryBillable}
                                  onChange={e => setNewEntryBillable(e.target.checked)}
                                  className="accent-emerald-500 w-3.5 h-3.5"
                                />
                                Billable
                              </label>
                            </div>
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Notes</label>
                          <textarea
                            rows={2}
                            value={newEntryNotes}
                            onChange={e => setNewEntryNotes(e.target.value)}
                            placeholder="Brief description of activity…"
                            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none transition-colors"
                          />
                        </div>
                        {newEntryBillable && (
                          <p className="text-xs text-emerald-400 mb-3">
                            Billable amount: {fmt(Math.round((parseFloat(newEntryMinutes) || 0) / 60 * (parseFloat(newEntryRate) || 0) * 100) / 100)}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => setShowAddTimeEntry(false)} className="flex-1 py-2.5 text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-all">Cancel</button>
                          <button
                            disabled={savingEntry}
                            onClick={async () => {
                              if (!selectedId) return;
                              await saveTimeEntry(selectedId);
                              setShowAddTimeEntry(false);
                              setNewEntryNotes("");
                              await loadDetail(selectedId);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl transition-all"
                          >
                            {savingEntry ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            Save Entry
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddTimeEntry(true)}
                        className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl transition-colors"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                        Add Manual Time Entry
                      </button>
                    )}

                    <div className="bg-[#0d1221] border border-slate-800 rounded-2xl overflow-hidden">
                      {timeLog.length === 0 ? (
                        <div className="text-center py-16"><Clock className="w-8 h-8 text-slate-700 mx-auto mb-3" /><p className="text-slate-500">No time entries yet</p></div>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 divide-x divide-slate-800 border-b border-slate-800">
                            {[
                              { label: "Total Units", val: timeLog.reduce((s, e) => s + Math.max(0.2, Math.round((e.duration_minutes / 60) * 10) / 10), 0).toFixed(1) },
                              { label: "Billable Hours", val: timeLog.filter(e => e.billable).reduce((s, e) => s + Math.max(0.2, Math.round((e.duration_minutes / 60) * 10) / 10), 0).toFixed(1) },
                              { label: "Billable $", val: fmt(timeLog.reduce((s, e) => s + (e.billable_amount ?? 0), 0)) },
                            ].map(s => (
                              <div key={s.label} className="p-4 text-center">
                                <p className="text-[10px] text-slate-500 mb-1">{s.label}</p>
                                <p className="text-lg font-bold text-white">{s.val}</p>
                              </div>
                            ))}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px]">
                              <thead>
                                <tr className="border-b border-slate-800">
                                  {["Date", "Staff", "Activity", "Units", "Rate", "Amount", "Notes"].map(h => (
                                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/40">
                                {timeLog.map(e => {
                                  const units = Math.max(0.2, Math.round((e.duration_minutes / 60) * 10) / 10);
                                  return (
                                    <tr key={e.id} className="hover:bg-slate-800/20">
                                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(e.started_at)}</td>
                                      <td className="px-4 py-3 text-xs text-slate-300 whitespace-nowrap">{e.staff_name}</td>
                                      <td className="px-4 py-3 text-xs text-slate-400 capitalize whitespace-nowrap">{e.activity_type.replace(/_/g, " ")}</td>
                                      <td className="px-4 py-3 text-xs text-slate-300 font-mono">{units.toFixed(1)}</td>
                                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{e.billing_rate ? fmt(e.billing_rate) : "—"}</td>
                                      <td className="px-4 py-3 text-xs font-semibold text-emerald-400 whitespace-nowrap">{e.billable_amount ? fmt(e.billable_amount) : "—"}</td>
                                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">{e.notes ?? "—"}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Tasks tab */}
                {activeTab === "tasks" && (
                  <div className="space-y-3">
                    {tasks.length === 0 ? (
                      <div className="bg-[#0d1221] border border-slate-800 rounded-2xl text-center py-16">
                        <CheckCheck className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-500">No tasks assigned</p>
                      </div>
                    ) : (
                      tasks.map(task => {
                        const prioColor = task.priority === "urgent" ? "text-red-400" : task.priority === "high" ? "text-orange-400" : task.priority === "normal" ? "text-sky-400" : "text-slate-500";
                        const statusColor = task.status === "completed" ? "text-emerald-400" : task.status === "in_progress" ? "text-sky-400" : task.status === "blocked" ? "text-red-400" : "text-slate-400";
                        return (
                          <div key={task.id} className="bg-[#0d1221] border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-semibold text-white">{task.title}</span>
                                <span className={`text-[10px] font-bold uppercase ${prioColor}`}>{task.priority}</span>
                              </div>
                              <p className="text-xs text-slate-500 capitalize">{task.task_type.replace(/_/g, " ")}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className={`text-xs font-semibold capitalize ${statusColor}`}>{task.status}</span>
                              {task.due_date && <p className="text-[10px] text-slate-600 mt-0.5">Due {fmtDate(task.due_date)}</p>}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Switch Case Type tab */}
                {activeTab === "switch_case" && (
                  <div className="space-y-4">
                    <div className="bg-[#0d1221] border border-slate-800 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Case Type Switch</p>
                          <p className="text-xs text-slate-600 mt-0.5">Switch between Ch. 7 regular, bifurcated, or Ch. 13. Requires new fee agreement.</p>
                        </div>
                        <button
                          onClick={() => setShowSwitchModal(true)}
                          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-xl transition-colors"
                        >
                          <GitBranch className="w-3.5 h-3.5" />
                          Propose Switch
                        </button>
                      </div>

                      {caseTypeSwitches.length === 0 ? (
                        <div className="text-center py-8">
                          <GitBranch className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                          <p className="text-slate-500 text-sm">No case type switches on record</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {caseTypeSwitches.map(sw => (
                            <div key={sw.id} className="bg-slate-800/30 rounded-xl p-4">
                              <div className="flex items-start gap-3 mb-3">
                                <div className="flex items-center gap-2 flex-1 flex-wrap">
                                  <span className="text-sm font-semibold text-slate-300">Ch. {sw.original_chapter} {sw.original_case_type.replace(/_/g, " ")}</span>
                                  <ArrowRightLeft className="w-3.5 h-3.5 text-slate-600" />
                                  <span className="text-sm font-bold text-white">Ch. {sw.new_chapter} {sw.new_case_type.replace(/_/g, " ")}</span>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sw.status === "active" ? "bg-emerald-500/10 text-emerald-400" : sw.status === "pending" ? "bg-amber-500/10 text-amber-400" : sw.status === "agreement_sent" ? "bg-sky-500/10 text-sky-400" : "bg-slate-700/40 text-slate-500"}`}>{sw.status.replace(/_/g, " ")}</span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                <div className="bg-slate-800/50 rounded-lg p-2">
                                  <p className="text-slate-500 text-[10px]">Earned Fee</p>
                                  <p className="text-slate-200 font-medium">{fmt(sw.earned_fee_amount)}</p>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-2">
                                  <p className="text-slate-500 text-[10px]">Unearned Credit</p>
                                  <p className="text-amber-400 font-medium">{fmt(sw.unearned_credit)}</p>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-2">
                                  <p className="text-slate-500 text-[10px]">New Fee</p>
                                  <p className="text-white font-medium">{sw.new_attorney_fee ? fmt(sw.new_attorney_fee) : "—"}</p>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-2">
                                  <p className="text-slate-500 text-[10px]">Net Fee</p>
                                  <p className="text-emerald-400 font-medium">{sw.net_new_fee ? fmt(sw.net_new_fee) : "—"}</p>
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-600 mt-2">Requested by {sw.requested_by} on {fmtDate(sw.requested_at)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Exit time entry modal */}
      {showExitTimeModal && selectedId && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Log Time Before Leaving?</p>
                <p className="text-xs text-slate-500">{selectedClient.full_name}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 mb-4 leading-relaxed">
              You've been in this file for a while. Would you like to log the time spent before returning to the client list?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Staff Member</label>
                <select
                  value={newEntryStaff}
                  onChange={e => setNewEntryStaff(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option>James Thompson</option>
                  <option>Maria Garcia</option>
                  <option>Sarah Lee</option>
                  <option>David Reeves</option>
                  <option>Lisa Chen</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Activity</label>
                <select
                  value={newEntryActivity}
                  onChange={e => setNewEntryActivity(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  {[
                    ["file_open",        "File Review"],
                    ["manual_note",      "Manual Note"],
                    ["client_call",      "Client Call"],
                    ["attorney_review",  "Attorney Review"],
                    ["paralegal_review", "Paralegal Review"],
                    ["document_upload",  "Document Review"],
                    ["other",            "Other"],
                  ].map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Duration (minutes)</label>
                <input
                  type="number"
                  min="1"
                  value={newEntryMinutes}
                  onChange={e => setNewEntryMinutes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Rate ($/hr)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={newEntryRate}
                    onChange={e => setNewEntryRate(e.target.value)}
                    disabled={!newEntryBillable}
                    className="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 disabled:opacity-40 transition-colors"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
                    <input type="checkbox" checked={newEntryBillable} onChange={e => setNewEntryBillable(e.target.checked)} className="accent-emerald-500" />
                    Billable
                  </label>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Notes (optional)</label>
              <textarea
                rows={2}
                value={newEntryNotes}
                onChange={e => setNewEntryNotes(e.target.value)}
                placeholder="Brief description of work done…"
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none transition-colors"
              />
            </div>
            {newEntryBillable && (
              <p className="text-xs text-emerald-400 mb-3">
                Billable: {fmt(Math.round((parseFloat(newEntryMinutes) || 0) / 60 * (parseFloat(newEntryRate) || 0) * 100) / 100)}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowExitTimeModal(false); setSelectedId(null); }}
                className="flex-1 py-2.5 text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-all"
              >
                Skip & Exit
              </button>
              <button
                disabled={savingEntry}
                onClick={async () => {
                  await saveTimeEntry(selectedId);
                  setShowExitTimeModal(false);
                  setSelectedId(null);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl transition-all"
              >
                {savingEntry ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                Log & Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case switch modal (kept for backward compat with switch history display) */}
      {showSwitchModal && selectedClient && (
        <CaseSwitchModal
          client={selectedClient}
          fee={fee}
          timelog={timeLog}
          onClose={() => setShowSwitchModal(false)}
          onSaved={() => {
            setShowSwitchModal(false);
            if (selectedId) loadDetail(selectedId);
          }}
        />
      )}

      {/* Chapter change modal */}
      {showChapterChangeModal && selectedClient && (
        <ChapterChangeModal
          client={selectedClient}
          fee={fee}
          timelog={timeLog}
          onClose={() => setShowChapterChangeModal(false)}
          onSaved={() => {
            setShowChapterChangeModal(false);
            if (selectedId) loadDetail(selectedId);
          }}
        />
      )}

      {/* Cancel request modal */}
      {showCancelRequestModal && selectedClient && (
        <FileCabinetCancelModal
          client={selectedClient}
          onClose={() => setShowCancelRequestModal(false)}
          onSaved={() => {
            setShowCancelRequestModal(false);
          }}
        />
      )}
    </div>
  );
}
