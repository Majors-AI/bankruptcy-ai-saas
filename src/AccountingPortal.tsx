import { useState, useEffect, useCallback } from "react";
import { DollarSign, Users, TrendingUp, FileText, Plus, Check, X, AlertTriangle, CheckCircle2, Clock, RefreshCw, Scale, CreditCard as Edit2, Unlock, BarChart2, Search, ArrowUpRight, CreditCard, Building, Landmark, ChevronUp, ChevronDown, ChevronRight, Info, Banknote, Receipt, Bell, ArrowLeftRight, Shield, Eye, EyeOff, Bot, MessageSquare, Ban, RotateCcw, Zap, Calendar, WifiOff, TrendingDown, SendHorizontal as SendHorizonal, ClipboardList, History, BadgeDollarSign, ArrowRightLeft, CheckSquare, Square, Vault, PauseCircle, UserPlus, Pencil, Trash2, UserCheck, XCircle, UserX } from "lucide-react";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const ACTIVE_STATES = ["AZ", "WA", "TX"] as const;
type ActiveState = typeof ACTIVE_STATES[number];

// ─── REST helpers ─────────────────────────────────────────────────────────────

const api = {
  get: async (path: string) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });
    return r.ok ? r.json() : [];
  },
  post: async (table: string, body: object) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    return r.ok ? r.json() : null;
  },
  patch: async (table: string, id: string, body: object) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    return r.ok ? r.json() : null;
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ExtendedStatus = "active" | "on_hold" | "completed" | "inactive" | "case_closed" | "cancelled";

interface AClient {
  id: string;
  client_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  chapter: 7 | 13;
  case_type: "regular" | "bifurcated" | "flat_fee" | "hourly" | "limited_scope";
  status: "active" | "filed" | "closed" | "on_hold";
  extended_status: ExtendedStatus;
  case_number: string | null;
  filed_date: string | null;
  intake_date: string | null;
  notes: string | null;
  case_closed_date: string | null;
  case_closed_reason: string | null;
  case_closed_notes: string | null;
  discharge_date: string | null;
  dismissal_reason: string | null;
  created_at: string;
  autopay_enabled: boolean;
  preferred_processor: "paycompass" | "lawpay" | null;
  autopay_enrolled_at: string | null;
  last_contact_date: string | null;
  no_contact_drop_flagged: boolean;
  drop_requested_at: string | null;
}

interface FeeStructure {
  id: string;
  client_id: string;
  attorney_fee: number;
  court_filing_fee: number;
  total_fee: number;
  down_payment: number;
  plan_months: number;
  first_payment_date: string | null;
  cff_payment_link_sent: boolean;
  cff_payment_link_sent_at: string | null;
  cff_paid: boolean;
  cff_paid_at: string | null;
  approved_for_signing: boolean;
  semi_monthly_day_1: number | null;
  semi_monthly_day_2: number | null;
  biweekly_start_date: string | null;
  payment_frequency: "weekly" | "biweekly" | "semi_monthly" | "monthly" | "paid_in_full";
  bifurcated_signing_threshold: number;
  threshold_bypassed: boolean;
  threshold_bypass_reason: string | null;
  threshold_bypassed_by: string | null;
  ch13_upfront_amount: number | null;
  ch13_plan_remainder: number | null;
  hourly_rate: number | null;
  retainer_amount: number | null;
  iolta_balance: number;
}

interface Payment {
  id: string;
  client_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  payment_type: string;
  is_iolta: boolean;
  destination_account: "operating" | "iolta" | null;
  account_state: string | null;
  applied_to: string | null;
  notes: string | null;
  recorded_by: string | null;
  voided: boolean;
  processor_confirmation: string | null;
  confirmed_at: string | null;
}

interface FirmStaff {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: "attorney" | "paralegal" | "accounting" | "admin" | "receptionist";
  is_active: boolean;
  created_at: string;
}

interface ScheduleEntry {
  id: string;
  client_id: string;
  installment_number: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: "pending" | "paid" | "late" | "waived" | "partial";
  paid_date: string | null;
}

interface TrustAccount {
  id: string;
  state: ActiveState;
  account_type: "operating" | "iolta";
  account_name: string;
  account_number_last4: string | null;
  bank_name: string | null;
  current_balance: number;
  is_active: boolean;
}

interface FundTransfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_date: string;
  reason: string;
  related_client_id: string | null;
  executed_by: string;
  status: "pending" | "executed" | "cancelled";
  notes: string | null;
  created_at: string;
}

interface TransferNotification {
  id: string;
  client_id: string;
  case_number: string;
  filed_date: string;
  amount: number;
  state: ActiveState;
  notify_after: string;
  status: "pending" | "actioned" | "dismissed";
  actioned_by: string | null;
  actioned_at: string | null;
  transfer_id: string | null;
  created_at: string;
}

type ClientTab = "overview" | "payments" | "schedule" | "autopay" | "timelog" | "matters";

interface AdditionalMatter {
  id: string;
  client_id: string;
  description: string;
  fee_type: "flat_fee" | "hourly" | "fixed";
  amount: number;
  hours_billed: number | null;
  hourly_rate: number | null;
  status: "draft" | "pending_approval" | "approved" | "invoiced" | "paid" | "cancelled";
  requires_new_agreement: boolean;
  approval_method: "client_email" | "attorney" | "both";
  client_approved_at: string | null;
  attorney_approved_at: string | null;
  attorney_approved_by: string | null;
  approval_email_sent_at: string | null;
  boldsign_document_id: string | null;
  boldsign_signed_at: string | null;
  invoiced_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface TimeLogEntry {
  id: string;
  client_id: string;
  staff_name: string;
  staff_role: string | null;
  staff_member_id: string | null;
  activity_type: string;
  duration_minutes: number;
  duration_units: number | null;
  billing_rate: number | null;
  billable_amount: number | null;
  billable: boolean;
  notes: string | null;
  reference_id: string | null;
  reference_table: string | null;
  source_type: string | null;
  is_auto_logged: boolean;
  communication_id: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

interface FiledCaseRegistry {
  id: string;
  client_id: string;
  case_number: string;
  filed_date: string;
  chapter: 7 | 13;
  state: string;
  case_number_verified: boolean;
  case_number_verified_by: string | null;
  case_number_verified_at: string | null;
  verification_notes: string | null;
  iolta_balance_verified: boolean;
  iolta_verified_by: string | null;
  iolta_verified_at: string | null;
  iolta_verified_amount: number | null;
  iolta_signoff_notes: string | null;
  transfer_status: "not_ready" | "pending_signoff" | "signed_off" | "transferred";
  transferred_at: string | null;
  transferred_by: string | null;
  transfer_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface IoltaSignoff {
  id: string;
  registry_id: string;
  client_id: string;
  attorney_name: string;
  action: "verified" | "rejected" | "transfer_approved";
  iolta_amount: number;
  notes: string | null;
  signed_at: string;
}

interface MerchantAccount {
  id: string;
  processor: "paycompass" | "lawpay";
  account_key: "az_operating" | "az_trust" | "wa_operating" | "wa_trust";
  account_label: string;
  bank_name: string;
  account_last4: string | null;
  is_active: boolean;
  notes: string | null;
}

interface AutopayEnrollment {
  id: string;
  client_id: string;
  processor: "paycompass" | "lawpay";
  payment_method_type: "card" | "ach" | null;
  payment_method_last4: string | null;
  card_brand: string | null;
  card_expiry: string | null;
  billing_address_line1: string | null;
  billing_address_city: string | null;
  billing_address_state: string | null;
  billing_address_zip: string | null;
  enrolled_by: string | null;
  enrolled_at: string;
  is_active: boolean;
  paused_until: string | null;
  notes: string | null;
  // approval workflow
  approval_required: boolean;
  approval_status: "pending" | "sent" | "approved" | "declined" | "overridden" | null;
  approval_sent_at: string | null;
  approval_sent_via: "sms" | "email" | null;
  approval_response_at: string | null;
  approval_override: boolean;
  approval_override_by: string | null;
  approval_override_at: string | null;
  approval_override_reason: string | null;
  // third-party payee
  is_third_party: boolean;
  third_party_name: string | null;
  third_party_email: string | null;
  third_party_phone: string | null;
  third_party_method: "pay_link" | "card_auth" | null;
  third_party_link_sent_at: string | null;
  third_party_client_signed: boolean;
  third_party_payee_signed: boolean;
  third_party_paid_at: string | null;
  third_party_amount_paid: number | null;
}

interface PaymentRetry {
  id: string;
  client_id: string;
  schedule_entry_id: string | null;
  original_due_date: string;
  rescheduled_due_date: string | null;
  max_retry_date: string;
  amount: number;
  processor: string | null;
  decline_reason: string | null;
  attempt_count: number;
  last_attempt_at: string;
  next_retry_at: string | null;
  status: "retrying" | "collected" | "expired" | "cancelled";
  reschedule_requested_by: string | null;
  reschedule_requested_at: string | null;
  resolved_at: string | null;
  notes: string | null;
  created_at: string;
}

interface CancelRequest {
  id: string;
  client_id: string;
  requested_by: string | null;
  request_channel: string;
  reason_category: string | null;
  reason_detail: string | null;
  ai_chat_log: { role: "ai" | "client"; message: string; ts: string }[] | null;
  ai_retention_outcome: "saved" | "escalated" | "irreversible" | null;
  staff_reviewer: string | null;
  staff_notes: string | null;
  status: "pending" | "saved" | "cancelled";
  outcome_reason: string | null;
  resolved_at: string | null;
  created_at: string;
  retention_type: string | null;
  adj_authorized_by: string | null;
}

interface LifecycleAlert {
  id: string;
  client_id: string;
  client_name: string;
  alert_type: "paid_in_full_60day_warning" | "billable_hours_exceed_fee" | "drop_notice_task" | "paralegal_overdue";
  triggered_at: string;
  paid_full_date: string | null;
  total_billable_hours: number | null;
  billable_amount: number | null;
  total_fee: number | null;
  email_sent_to: string | null;
  email_sent_at: string | null;
  task_created_for: string | null;
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  resolved_by: string | null;
  resolved_at: string | null;
  notes: string | null;
}

interface CancelRequestTask {
  id: string;
  cancel_request_id: string;
  client_id: string;
  task_type: "pause_payments" | "attorney_outreach" | "refund_unearned" | "send_disengagement" | "other";
  assigned_role: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "dismissed";
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
}

interface DisengagementNotice {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string | null;
  cancel_request_id: string | null;
  email_sent_at: string | null;
  total_paid: number;
  earned_fees: number;
  unearned_fees: number;
  refund_amount: number;
  refund_status: "pending" | "calculated" | "approved" | "issued" | "not_applicable";
  refund_authorized_by: string | null;
  refund_issued_at: string | null;
  refund_notes: string | null;
  status: "pending" | "sent" | "refund_pending" | "refund_issued" | "closed";
  created_at: string;
}

interface RetentionAdjustment {
  id: string;
  cancel_request_id: string;
  client_id: string;
  adjustment_type: "reduce_fee" | "push_payments" | "reduce_payments" | "waive_fee" | "change_frequency" | "other";
  description: string;
  original_value: number | null;
  new_value: number | null;
  original_date: string | null;
  new_date: string | null;
  original_frequency: string | null;
  new_frequency: string | null;
  authorized_by: string;
  notes: string | null;
  applied_at: string;
}

interface HoldRequest {
  id: string;
  client_id: string;
  request_type: "hold" | "push_payment";
  requested_by: string;
  reason: string;
  push_to_date: string | null;
  status: "pending_approval" | "approved" | "denied";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

type TabId = "clients" | "accounts" | "filed" | "cancellations" | "trust_hub" | "reports" | "collections";

// ─── Collections types ────────────────────────────────────────────────────────

interface CollectionCase {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  total_owed: number;
  total_paid: number;
  outstanding_balance: number;
  days_past_due: number;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  first_missed_payment_date: string | null;
  status: "active" | "payment_arrangement" | "resolved" | "written_off" | "on_hold";
  ai_followup_enabled: boolean;
  last_ai_contact_at: string | null;
  next_ai_contact_at: string | null;
  ai_contact_count: number;
  staff_assigned: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CollectionContact {
  id: string;
  case_id: string;
  client_id: string;
  contact_type: string;
  channel: string;
  message_sent: string | null;
  client_response: string | null;
  payment_made_after: boolean;
  payment_amount_after: number | null;
  ai_model: string | null;
  sent_by: string | null;
  sent_at: string;
  notes: string | null;
}

interface BatchTransferRequest {
  id: string;
  state: string;
  iolta_account_id: string | null;
  operating_account_id: string | null;
  total_amount: number;
  client_count: number;
  status: "pending_approval" | "approved" | "rejected" | "executed";
  submitted_by: string;
  submitted_at: string;
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  executed_at: string | null;
  executed_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface BatchTransferItem {
  id: string;
  batch_id: string;
  registry_id: string | null;
  client_id: string;
  iolta_amount: number;
  included: boolean;
  notes: string | null;
  created_at: string;
}

interface IoltaBalanceLog {
  id: string;
  trust_account_id: string;
  state: string;
  account_type: string;
  event_type: "transfer_in" | "transfer_out" | "adjustment" | "snapshot";
  amount: number;
  balance_after: number;
  related_batch_id: string | null;
  related_registry_id: string | null;
  related_client_id: string | null;
  description: string | null;
  recorded_by: string | null;
  recorded_at: string;
}

// ─── Role helpers ─────────────────────────────────────────────────────────────
// "super_admin"            — Attorney Super Admin: Trust Hub approval, Reports, all actions (PIN 8888)
// "accounting_super_admin" — Accounting Super Admin: Trust Hub submissions, Reports, full accounting (PIN 7777)
// "admin"                  — Accounting Admin: standard accounting, no Reports/Trust Hub (PIN 9999)
function roleOf(adminUser: string | null): "none" | "admin" | "accounting_super_admin" | "super_admin" {
  if (!adminUser) return "none";
  // "**" suffix = accounting super admin; "*" suffix = attorney super admin
  if (adminUser.endsWith("**")) return "accounting_super_admin";
  if (adminUser.endsWith("*")) return "super_admin";
  return "admin";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

const fmtDate = (d: string | null) =>
  d ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(d)) : "—";

const fmtDateTime = (d: string | null) =>
  d ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(d)) : "—";

const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly", biweekly: "Bi-Weekly", semi_monthly: "Semi-Monthly",
  monthly: "Monthly", paid_in_full: "Paid in Full",
};

const CASE_TYPE_LABELS: Record<string, string> = {
  regular:       "Ch. 7 — Prepaid",
  bifurcated:    "Ch. 7 — Bifurcated",
  flat_fee:      "Ch. 13 — Flat Fee",
  hourly:        "Ch. 13 — Hourly",
  limited_scope: "Limited Scope",
};

const METHOD_ICONS: Record<string, JSX.Element> = {
  credit_card: <CreditCard className="w-3 h-3" />,
  debit_card:  <CreditCard className="w-3 h-3" />,
  check:       <FileText   className="w-3 h-3" />,
  cash:        <Banknote   className="w-3 h-3" />,
  wire:        <ArrowUpRight className="w-3 h-3" />,
  ach:         <Building   className="w-3 h-3" />,
  other:       <Receipt    className="w-3 h-3" />,
};

// Determines correct account destination based on case type + payment type
function resolveDestination(caseType: AClient["case_type"], paymentType: string): "operating" | "iolta" {
  // Court filing fees always go to IOLTA until case is filed
  if (paymentType === "court_filing_fee") return "iolta";
  // Retainers always go to IOLTA
  if (paymentType === "retainer") return "iolta";
  // Hourly case payments go to IOLTA
  if (caseType === "hourly") return "iolta";
  // Ch.13 upfront/plan go to operating (non-retainer)
  // Regular and bifurcated Ch.7 attorney fees go to operating
  return "operating";
}

function chapterBadge(chapter: 7 | 13) {
  return chapter === 7
    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-sky-50 border-sky-500/25 text-sky-700">Ch. 7</span>
    : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 border-amber-500/25 text-amber-700">Ch. 13</span>;
}

function statusBadge(status: AClient["status"]) {
  const cfgs = {
    active:  "text-emerald-700 bg-emerald-50 border-emerald-500/25",
    filed:   "text-sky-700 bg-sky-50 border-sky-500/25",
    closed:  "text-slate-500 bg-slate-200/30 border-slate-200",
    on_hold: "text-amber-700 bg-amber-50 border-amber-500/25",
  };
  const labels = { active: "Active", filed: "Filed", closed: "Closed", on_hold: "On Hold" };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfgs[status]}`}>
      {labels[status]}
    </span>
  );
}

function destBadge(dest: "operating" | "iolta" | null) {
  if (!dest) return null;
  return dest === "iolta"
    ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-amber-700 bg-amber-50 border-amber-500/20">IOLTA</span>
    : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-emerald-700 bg-emerald-50 border-emerald-500/20">Operating</span>;
}

// ─── Admin Auth Context ───────────────────────────────────────────────────────

// In-session admin auth (no backend auth in this demo — role is scoped to session)
function AdminLoginModal({ onLogin, onClose }: { onLogin: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [pin, setPin]   = useState("");
  const [err, setErr]   = useState(false);
  const [show, setShow] = useState(false);

  function attempt() {
    // PIN 8888 = Attorney Super Admin (name gets "*" suffix)
    // PIN 7777 = Accounting Super Admin (name gets "**" suffix)
    // PIN 9999 = Accounting Admin (standard)
    if (pin === "8888" && name.trim()) { onLogin(name.trim() + "*"); }
    else if (pin === "7777" && name.trim()) { onLogin(name.trim() + "**"); }
    else if (pin === "9999" && name.trim()) { onLogin(name.trim()); }
    else { setErr(true); setTimeout(() => setErr(false), 2000); }
  }

  const PROFILES = [
    { label: "Accounting Admin",         pin: "9999", color: "text-slate-600",   bg: "bg-slate-100",  border: "border-slate-200",    desc: "Standard access — clients, payments, filed cases, cancellations" },
    { label: "Accounting Super Admin",   pin: "7777", color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-400/25", desc: "Full accounting access — Trust Hub, Reports, batch transfers" },
    { label: "Attorney Super Admin",     pin: "8888", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-500/20",desc: "Full firm access — approve transfers, view all reports" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
            <Shield className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Admin Login</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Enter your name and role PIN to authenticate</p>
          </div>
        </div>

        {/* Profile reference */}
        <div className="px-5 pt-4 space-y-2">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Available Profiles</p>
          {PROFILES.map(p => (
            <div key={p.label} className={`flex items-center justify-between px-3 py-2 rounded-xl border ${p.bg} ${p.border}`}>
              <div>
                <p className={`text-xs font-bold ${p.color}`}>{p.label}</p>
                <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">{p.desc}</p>
              </div>
              <div className="flex-shrink-0 ml-3">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${p.bg} ${p.border} ${p.color} font-mono tracking-widest`}>PIN ••••</span>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Your Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-300" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">PIN</label>
            <div className="relative">
              <input type={show ? "text" : "password"} value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === "Enter" && attempt()} placeholder="••••" maxLength={4} className={`w-full bg-slate-100 border text-slate-900 text-sm rounded-xl px-3 py-2.5 pr-10 placeholder-slate-600 focus:outline-none ${err ? "border-red-500" : "border-slate-200 focus:border-slate-300"}`} />
              <button onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700">
                {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {err && <p className="text-xs text-rose-700 mt-1">Invalid name or PIN. Try again.</p>}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button onClick={attempt} disabled={!name.trim() || !pin} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold px-5 py-2 rounded-xl text-sm transition-all">
            <Shield className="w-4 h-4" /> Authenticate
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Staff Modal ──────────────────────────────────────────────────────────────

const STAFF_ROLE_LABELS: Record<string, string> = {
  attorney:     "Attorney",
  paralegal:    "Paralegal",
  accounting:   "Accounting",
  admin:        "Admin",
  receptionist: "Receptionist",
};

const STAFF_ROLE_COLORS: Record<string, string> = {
  attorney:     "bg-amber-100 text-amber-500 border-amber-400/25",
  paralegal:    "bg-teal-500/15 text-teal-400 border-teal-500/25",
  accounting:   "bg-emerald-100 text-emerald-700 border-emerald-500/25",
  admin:        "bg-sky-100 text-sky-700 border-sky-500/25",
  receptionist: "bg-slate-200/60 text-slate-600 border-slate-200",
};

function StaffModal({ staff, onClose, onSaved }: {
  staff: FirmStaff[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState<FirmStaff | null>(null);
  const [adding, setAdding]   = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", role: "admin" as FirmStaff["role"] });
  const [saving, setSaving]   = useState(false);

  const inp = "w-full bg-[var(--bg-surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-xl px-3 py-2.5 placeholder-[var(--text-faint)] focus:outline-none focus:border-amber-400/50 transition-colors";
  const lbl = "text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-1.5 block";

  function startAdd() {
    setEditing(null);
    setForm({ full_name: "", email: "", phone: "", role: "admin" });
    setAdding(true);
  }

  function startEdit(s: FirmStaff) {
    setEditing(s);
    setForm({ full_name: s.full_name, email: s.email ?? "", phone: s.phone ?? "", role: s.role });
    setAdding(true);
  }

  async function save() {
    if (!form.full_name.trim()) return;
    setSaving(true);
    if (editing) {
      await api.patch("firm_staff", editing.id, {
        full_name: form.full_name.trim(),
        email:     form.email.trim() || null,
        phone:     form.phone.trim() || null,
        role:      form.role,
      });
    } else {
      await api.post("firm_staff", {
        full_name: form.full_name.trim(),
        email:     form.email.trim() || null,
        phone:     form.phone.trim() || null,
        role:      form.role,
        is_active: true,
      });
    }
    setSaving(false);
    setAdding(false);
    setEditing(null);
    onSaved();
  }

  async function toggleActive(s: FirmStaff) {
    await api.patch("firm_staff", s.id, { is_active: !s.is_active });
    onSaved();
  }

  const activeStaff   = staff.filter(s => s.is_active);
  const inactiveStaff = staff.filter(s => !s.is_active);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-sky-700" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">Firm Staff</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{activeStaff.length} active member{activeStaff.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={startAdd} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-xs px-3 py-1.5 rounded-xl transition-all">
              <UserPlus className="w-3.5 h-3.5" /> Add Staff
            </button>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 transition-colors"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Add / Edit form */}
        {adding && (
          <div className="px-5 py-4 bg-[var(--bg-surface-2)] border-b border-[var(--border)] flex-shrink-0">
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">
              {editing ? "Edit Staff Member" : "New Staff Member"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className={lbl}>Full Name *</label>
                <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. Maria Garcia" className={inp} />
              </div>
              <div>
                <label className={lbl}>Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as FirmStaff["role"] }))} className={inp}>
                  {Object.entries(STAFF_ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Email</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@firm.com" className={inp} />
              </div>
              <div>
                <label className={lbl}>Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(xxx) xxx-xxxx" className={inp} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => { setAdding(false); setEditing(null); }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-3 py-2 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving || !form.full_name.trim()} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-900 font-bold text-xs px-4 py-2 rounded-xl transition-all">
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {editing ? "Save Changes" : "Add Member"}
              </button>
            </div>
          </div>
        )}

        {/* Staff list */}
        <div className="flex-1 overflow-y-auto">
          {/* Active */}
          <div className="px-5 py-4 space-y-2">
            {activeStaff.length === 0 ? (
              <p className="text-xs text-[var(--text-faint)] text-center py-6">No active staff members.</p>
            ) : activeStaff.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-2)] hover:bg-[var(--bg-surface-3)] transition-colors">
                <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-3)] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-[var(--text-secondary)]">
                    {s.full_name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{s.full_name}</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${STAFF_ROLE_COLORS[s.role]}`}>
                      {STAFF_ROLE_LABELS[s.role]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {s.email && <p className="text-[10px] text-[var(--text-muted)] truncate">{s.email}</p>}
                    {s.phone && <p className="text-[10px] text-[var(--text-muted)]">{s.phone}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => startEdit(s)} className="w-7 h-7 rounded-lg bg-[var(--bg-surface-3)] hover:bg-amber-100 text-[var(--text-muted)] hover:text-amber-500 flex items-center justify-center transition-all">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => toggleActive(s)} title="Deactivate" className="w-7 h-7 rounded-lg bg-[var(--bg-surface-3)] hover:bg-rose-50 text-[var(--text-muted)] hover:text-rose-700 flex items-center justify-center transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Inactive */}
          {inactiveStaff.length > 0 && (
            <div className="px-5 pb-4">
              <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest mb-2">Inactive</p>
              {inactiveStaff.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] opacity-50 hover:opacity-75 transition-opacity mb-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--text-muted)] line-through">{s.full_name}</p>
                  </div>
                  <button onClick={() => toggleActive(s)} className="text-[10px] font-bold text-sky-700 hover:text-sky-300 transition-colors">Reactivate</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Case Summary Modal ───────────────────────────────────────────────────────

const PROCESS_STAGES: { key: string; label: string; desc: string }[] = [
  { key: "intake",       label: "Intake",          desc: "Client intake form completed" },
  { key: "docs",         label: "Documents",        desc: "Documents collected & reviewed" },
  { key: "paralegal",    label: "Paralegal Review", desc: "Paralegal review complete" },
  { key: "attorney",     label: "Attorney Review",  desc: "Attorney reviewed & approved" },
  { key: "signing",      label: "Signing",          desc: "Petition signed by client" },
  { key: "filed",        label: "Filed",            desc: "Case filed with court" },
  { key: "discharged",   label: "Discharged",       desc: "Discharge granted" },
];

function getProcessStage(client: AClient): number {
  if (client.extended_status === "case_closed" && client.discharge_date) return 6;
  if (client.extended_status === "case_closed") return 6;
  if (client.status === "filed" || client.status === "closed") return 5;
  if (client.extended_status === "cancelled") return 1;
  return 2; // default: docs stage
}

function CaseSummaryModal({ client, feeStructure, payments, timeLog, onClose, onViewTimelog }: {
  client: AClient;
  feeStructure: FeeStructure | null;
  payments: Payment[];
  timeLog: TimeLogEntry[];
  onClose: () => void;
  onViewTimelog: () => void;
}) {
  const clientPayments = payments.filter(p => p.client_id === client.id && !p.voided);
  const totalPaid = clientPayments.reduce((s, p) => s + p.amount, 0);
  const totalFee  = feeStructure?.total_fee ?? 0;
  const balance   = Math.max(0, totalFee - totalPaid);
  const pct       = totalFee > 0 ? Math.min(100, (totalPaid / totalFee) * 100) : 0;
  const stageIdx  = getProcessStage(client);
  const clientLogs = timeLog.filter(e => e.client_id === client.id);
  const totalMins = clientLogs.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);

  const extSt = (client.extended_status ?? client.status) as string;
  const EXT_COLORS: Record<string, string> = {
    active:     "bg-emerald-100 text-emerald-700 border-emerald-500/25",
    on_hold:    "bg-amber-100 text-amber-700 border-amber-400/25",
    inactive:   "bg-slate-200/60 text-slate-600 border-slate-200",
    case_closed:"bg-slate-100/80 text-slate-600 border-slate-200",
    cancelled:  "bg-rose-100 text-rose-700 border-red-500/25",
    completed:  "bg-sky-100 text-sky-700 border-sky-500/25",
    filed:      "bg-sky-100 text-sky-700 border-sky-500/25",
    closed:     "bg-slate-100/80 text-slate-600 border-slate-200",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{client.full_name}</h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${EXT_COLORS[extSt] ?? EXT_COLORS.active}`}>
                  {extSt.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                </span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${client.chapter === 7 ? "text-sky-700 bg-sky-50 border-sky-500/25" : "text-amber-700 bg-amber-50 border-amber-500/25"}`}>
                  Ch. {client.chapter}
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                  {CASE_TYPE_LABELS[client.case_type] ?? client.case_type}
                </span>
                {client.state && <span className="text-[10px] text-[var(--text-muted)]">{client.state}</span>}
              </div>
            </div>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 flex-shrink-0 transition-colors"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Key info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[
              { label: "Intake Date",     val: client.intake_date ? fmtDate(client.intake_date) : "—" },
              { label: "Case Number",     val: client.case_number ?? "Not filed" },
              { label: "Filed Date",      val: client.filed_date ? fmtDate(client.filed_date) : "—" },
              { label: "Total Fee",       val: fmt(totalFee), color: "text-[var(--text-primary)] font-bold" },
              { label: "Total Paid",      val: fmt(totalPaid), color: "text-emerald-500 font-bold" },
              { label: "Balance Due",     val: fmt(balance), color: balance > 0 ? "text-rose-700 font-bold" : "text-emerald-500 font-bold" },
            ].map(item => (
              <div key={item.label} className="bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5">
                <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest">{item.label}</p>
                <p className={`text-sm mt-0.5 ${item.color ?? "text-[var(--text-primary)]"}`}>{item.val}</p>
              </div>
            ))}
          </div>

          {/* Payment progress */}
          {totalFee > 0 && (
            <div>
              <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1.5">
                <span>Fee Collection Progress</span>
                <span className="font-semibold text-[var(--text-secondary)]">{pct.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-[var(--bg-surface-3)] rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {/* Case closed disposition */}
          {(client.extended_status === "case_closed" || client.extended_status === "cancelled") && (
            <div className={`rounded-xl border px-4 py-3 ${client.extended_status === "cancelled" ? "bg-red-500/5 border-red-500/20" : "bg-[var(--bg-surface-2)] border-[var(--border)]"}`}>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Disposition</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {client.case_closed_date && <div><p className="text-[9px] text-[var(--text-muted)]">Closed</p><p className="font-semibold text-[var(--text-primary)]">{fmtDate(client.case_closed_date)}</p></div>}
                {client.case_closed_reason && <div><p className="text-[9px] text-[var(--text-muted)]">Reason</p><p className={`font-semibold capitalize ${client.case_closed_reason === "discharged" ? "text-emerald-500" : "text-rose-700"}`}>{client.case_closed_reason.replace(/_/g, " ")}</p></div>}
                {client.discharge_date && <div><p className="text-[9px] text-[var(--text-muted)]">Discharge</p><p className="font-semibold text-emerald-500">{fmtDate(client.discharge_date)}</p></div>}
              </div>
              {client.case_closed_notes && <p className="text-[11px] text-[var(--text-muted)] mt-2 leading-relaxed border-t border-[var(--border-subtle)] pt-2">{client.case_closed_notes}</p>}
            </div>
          )}

          {/* Process stages */}
          {client.case_type !== "limited_scope" && (
            <div>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">Case Progress</p>
              <div className="relative">
                {/* Progress line */}
                <div className="absolute left-3.5 top-4 bottom-4 w-px bg-[var(--border)]" />
                <div className="space-y-1">
                  {PROCESS_STAGES.map((stage, i) => {
                    const done    = i <= stageIdx;
                    const current = i === stageIdx;
                    return (
                      <div key={stage.key} className={`relative flex items-start gap-3 px-3 py-2 rounded-xl transition-colors ${current ? "bg-amber-500/8 border border-amber-500/20" : done ? "opacity-70" : "opacity-30"}`}>
                        <div className={`w-4 h-4 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center z-10 relative ${done ? current ? "bg-amber-500" : "bg-emerald-500" : "bg-[var(--bg-surface-3)] border border-[var(--border)]"}`}>
                          {done && !current && <Check className="w-2.5 h-2.5 text-slate-900" />}
                          {current && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div>
                          <p className={`text-xs font-semibold ${current ? "text-amber-700" : done ? "text-[var(--text-secondary)]" : "text-[var(--text-faint)]"}`}>{stage.label}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">{stage.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Limited scope scope description */}
          {client.case_type === "limited_scope" && feeStructure && (
            <div className="bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Scope of Work</p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{(feeStructure as FeeStructure & { limited_scope_description?: string }).limited_scope_description ?? client.notes ?? "No scope description provided."}</p>
            </div>
          )}

          {/* Time log link */}
          <div className="flex items-center justify-between bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-sky-700 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">Time Log</p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {clientLogs.length} {clientLogs.length === 1 ? "entry" : "entries"} · {fmtDuration(totalMins)} total
                </p>
              </div>
            </div>
            <button
              onClick={() => { onClose(); onViewTimelog(); }}
              className="flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-300 bg-sky-50 hover:bg-sky-100 border border-sky-500/20 px-3 py-1.5 rounded-xl transition-all"
            >
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Case notes */}
          {client.notes && (
            <div className="flex items-start gap-2 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl px-3.5 py-3">
              <Info className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{client.notes}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--border)] flex-shrink-0">
          <button onClick={onClose} className="w-full text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] py-2 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Additional Matters Panel ─────────────────────────────────────────────────

const MATTER_STATUS_COLORS: Record<string, string> = {
  draft:            "bg-slate-200/60 text-slate-600 border-slate-200",
  pending_approval: "bg-amber-100 text-amber-700 border-amber-400/25",
  approved:         "bg-emerald-100 text-emerald-700 border-emerald-500/25",
  invoiced:         "bg-sky-100 text-sky-700 border-sky-500/25",
  paid:             "bg-emerald-100 text-emerald-500 border-emerald-500/30",
  cancelled:        "bg-rose-100 text-rose-700 border-red-500/25",
};

function AdditionalMattersPanel({ client, matters, adminUser, onRefresh }: {
  client: AClient;
  matters: AdditionalMatter[];
  adminUser: string | null;
  onRefresh: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm] = useState({
    description:            "",
    fee_type:               "flat_fee" as AdditionalMatter["fee_type"],
    amount:                 "",
    hours_billed:           "",
    hourly_rate:            "",
    requires_new_agreement: true,
    approval_method:        "client_email" as AdditionalMatter["approval_method"],
    notes:                  "",
  });

  const inp = "w-full bg-[var(--bg-surface-3)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl px-3 py-2 placeholder-[var(--text-faint)] focus:outline-none focus:border-amber-400/50 transition-colors";
  const lbl = "text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1 block";

  async function save() {
    if (!form.description.trim()) return;
    setSaving(true);
    const amt = form.fee_type === "hourly"
      ? (parseFloat(form.hours_billed) || 0) * (parseFloat(form.hourly_rate) || 0)
      : parseFloat(form.amount) || 0;
    await api.post("client_additional_matters", {
      client_id:              client.id,
      description:            form.description.trim(),
      fee_type:               form.fee_type,
      amount:                 amt,
      hours_billed:           form.fee_type === "hourly" ? parseFloat(form.hours_billed) || null : null,
      hourly_rate:            form.fee_type === "hourly" ? parseFloat(form.hourly_rate) || null : null,
      status:                 "draft",
      requires_new_agreement: form.requires_new_agreement,
      approval_method:        form.approval_method,
      notes:                  form.notes.trim() || null,
      created_by:             adminUser?.replace(/\*+$/, "") ?? "Staff",
    });
    await api.post("case_time_log", {
      client_id: client.id, staff_name: adminUser?.replace(/\*+$/, "") ?? "Staff",
      activity_type: "other", duration_minutes: 0, billable: false,
      notes: `Additional matter added: ${form.description.trim()} — ${fmt(amt)}`,
      started_at: new Date().toISOString(),
    });
    setSaving(false);
    setShowAdd(false);
    setForm(f => ({ ...f, description: "", amount: "", hours_billed: "", hourly_rate: "", notes: "" }));
    onRefresh();
  }

  async function updateStatus(matter: AdditionalMatter, status: AdditionalMatter["status"]) {
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "approved")  patch.attorney_approved_at  = new Date().toISOString();
    if (status === "invoiced")  patch.invoiced_at           = new Date().toISOString();
    if (status === "paid")      patch.paid_at               = new Date().toISOString();
    await api.patch("client_additional_matters", matter.id, patch);
    await api.post("case_time_log", {
      client_id: client.id, staff_name: adminUser?.replace(/\*+$/, "") ?? "Staff",
      activity_type: "payment_adjustment", duration_minutes: 0, billable: false,
      notes: `Matter "${matter.description}" status → ${status}`,
      started_at: new Date().toISOString(),
    });
    onRefresh();
  }

  const totalPending = matters.filter(m => m.status === "pending_approval").reduce((s, m) => s + m.amount, 0);
  const totalInvoiced = matters.filter(m => m.status === "invoiced").reduce((s, m) => s + m.amount, 0);
  const totalPaid     = matters.filter(m => m.status === "paid").reduce((s, m) => s + m.amount, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-center">
          <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wide">Matters</p>
          <p className="text-base font-bold text-[var(--text-primary)] mt-0.5">{matters.length}</p>
        </div>
        <div className="bg-amber-50 border border-amber-400/20 rounded-xl px-3 py-2.5 text-center">
          <p className="text-[9px] text-amber-500 uppercase tracking-wide">Invoiced</p>
          <p className="text-base font-bold text-amber-700 mt-0.5">{fmt(totalInvoiced)}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-500/20 rounded-xl px-3 py-2.5 text-center">
          <p className="text-[9px] text-emerald-500 uppercase tracking-wide">Collected</p>
          <p className="text-base font-bold text-emerald-700 mt-0.5">{fmt(totalPaid)}</p>
        </div>
      </div>

      {totalPending > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-400/20 rounded-xl px-3.5 py-2.5">
          <Bell className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
          <p className="text-xs text-amber-700">{fmt(totalPending)} pending client approval</p>
        </div>
      )}

      {/* Add button */}
      {!showAdd && (
        <button onClick={() => setShowAdd(true)} className="w-full flex items-center justify-center gap-2 bg-[var(--bg-surface-2)] hover:bg-[var(--bg-surface-3)] border border-[var(--border)] text-[var(--text-secondary)] font-bold text-xs py-2.5 rounded-xl transition-all">
          <Plus className="w-3.5 h-3.5" /> Add Matter / Invoice
        </button>
      )}

      {showAdd && (
        <div className="bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">New Additional Matter</p>
          <div>
            <label className={lbl}>Description *</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Creditor negotiation — Bank of America" className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>Fee Type</label>
              <select value={form.fee_type} onChange={e => setForm(f => ({ ...f, fee_type: e.target.value as AdditionalMatter["fee_type"] }))} className={inp}>
                <option value="flat_fee">Flat Fee</option>
                <option value="hourly">Hourly</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            {form.fee_type === "hourly" ? (
              <>
                <div>
                  <label className={lbl}>Hourly Rate ($)</label>
                  <input type="number" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))} placeholder="e.g. 250" className={inp} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Hours Billed</label>
                  <input type="number" step="0.25" value={form.hours_billed} onChange={e => setForm(f => ({ ...f, hours_billed: e.target.value }))} placeholder="e.g. 2.5" className={inp} />
                </div>
                <div className="col-span-2 bg-[var(--bg-surface-3)] rounded-xl px-3 py-2 text-xs">
                  <span className="text-[var(--text-muted)]">Total: </span>
                  <span className="font-bold text-amber-700">{fmt((parseFloat(form.hours_billed) || 0) * (parseFloat(form.hourly_rate) || 0))}</span>
                </div>
              </>
            ) : (
              <div>
                <label className={lbl}>Amount ($)</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 350" className={inp} />
              </div>
            )}
            <div>
              <label className={lbl}>Approval Method</label>
              <select value={form.approval_method} onChange={e => setForm(f => ({ ...f, approval_method: e.target.value as AdditionalMatter["approval_method"] }))} className={inp}>
                <option value="client_email">Client Email + BoldSign</option>
                <option value="attorney">Attorney Only</option>
                <option value="both">Client + Attorney</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-4">
              <div onClick={() => setForm(f => ({ ...f, requires_new_agreement: !f.requires_new_agreement }))}
                className={`w-8 h-4 rounded-full cursor-pointer transition-all flex items-center ${form.requires_new_agreement ? "bg-amber-500" : "bg-[var(--bg-surface-3)]"}`}>
                <div className={`w-3 h-3 rounded-full bg-white mx-0.5 transition-all ${form.requires_new_agreement ? "translate-x-4" : ""}`} />
              </div>
              <label className="text-[10px] text-[var(--text-muted)] cursor-pointer" onClick={() => setForm(f => ({ ...f, requires_new_agreement: !f.requires_new_agreement }))}>New Fee Agreement Required</label>
            </div>
          </div>
          {form.approval_method === "client_email" && (
            <div className="flex items-start gap-2 bg-sky-50 border border-sky-500/20 rounded-xl px-3 py-2.5">
              <Info className="w-3 h-3 text-sky-700 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-600 leading-relaxed">
                Client will receive an email requesting approval. On acceptance, they will be redirected to <strong className="text-slate-900">BoldSign</strong> to e-sign the fee agreement. Attorney approval is required by default.
              </p>
            </div>
          )}
          <div>
            <label className={lbl}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Additional context…" className={`${inp} resize-none`} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-3 py-1.5 transition-colors">Cancel</button>
            <button onClick={save} disabled={saving || !form.description.trim()} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-900 font-bold text-xs px-4 py-1.5 rounded-xl transition-all">
              {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add Matter
            </button>
          </div>
        </div>
      )}

      {/* Matters list */}
      <div className="space-y-2">
        {matters.length === 0 ? (
          <p className="text-xs text-[var(--text-faint)] text-center py-6">No additional matters on file.</p>
        ) : matters.map(m => (
          <div key={m.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface-2)] p-3.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-[var(--text-primary)] leading-snug flex-1">{m.description}</p>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${MATTER_STATUS_COLORS[m.status] ?? MATTER_STATUS_COLORS.draft}`}>
                {m.status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-bold text-amber-700">{fmt(m.amount)}</span>
              <span className="text-[10px] text-[var(--text-muted)] capitalize">{m.fee_type.replace(/_/g, " ")}</span>
              {m.hours_billed && <span className="text-[10px] text-[var(--text-muted)]">{m.hours_billed}h @ {fmt(m.hourly_rate ?? 0)}/hr</span>}
              <span className="text-[10px] text-[var(--text-muted)]">by {m.created_by}</span>
              {m.created_at && <span className="text-[10px] text-[var(--text-faint)]">{fmtDate(m.created_at.slice(0,10))}</span>}
            </div>
            {m.notes && <p className="text-[10px] text-[var(--text-muted)] italic leading-relaxed">{m.notes}</p>}
            {/* Approval indicators */}
            <div className="flex items-center gap-2 flex-wrap text-[9px]">
              {m.approval_email_sent_at && <span className="flex items-center gap-1 text-sky-700"><Check className="w-2.5 h-2.5" /> Email sent</span>}
              {m.client_approved_at     && <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-2.5 h-2.5" /> Client approved</span>}
              {m.boldsign_signed_at     && <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-2.5 h-2.5" /> Signed</span>}
              {m.attorney_approved_at   && <span className="flex items-center gap-1 text-amber-700"><CheckCircle2 className="w-2.5 h-2.5" /> Atty approved</span>}
            </div>
            {/* Action buttons */}
            <div className="flex gap-1.5 flex-wrap pt-1">
              {m.status === "draft" && (
                <>
                  <button onClick={() => updateStatus(m, "pending_approval")} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-100 border border-amber-500/25 transition-all">
                    Send for Approval
                  </button>
                  <button onClick={() => updateStatus(m, "cancelled")} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-red-500/20 transition-all">
                    Cancel
                  </button>
                </>
              )}
              {m.status === "pending_approval" && (
                <button onClick={() => updateStatus(m, "approved")} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border border-emerald-500/25 transition-all">
                  Mark Approved
                </button>
              )}
              {m.status === "approved" && (
                <button onClick={() => updateStatus(m, "invoiced")} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-sky-100 text-sky-700 hover:bg-sky-500/25 border border-sky-500/25 transition-all">
                  Mark Invoiced
                </button>
              )}
              {m.status === "invoiced" && (
                <button onClick={() => updateStatus(m, "paid")} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border border-emerald-500/25 transition-all">
                  Mark Paid
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Schedule Adjust Modal ────────────────────────────────────────────────────

type FreqOption = "weekly" | "biweekly" | "semi_monthly" | "monthly" | "custom";

interface DraftInstallment {
  id: string;          // existing schedule entry id (empty string = new)
  installment_number: number;
  due_date: string;
  amount_due: number;
  status: ScheduleEntry["status"];
  amount_paid: number;
}

function ScheduleAdjustModal({ client, feeStructure, schedule, adminUser, onClose, onSaved }: {
  client: AClient;
  feeStructure: FeeStructure | null;
  schedule: ScheduleEntry[];
  adminUser: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const staffName = adminUser?.replace(/\*+$/, "") ?? "Staff";
  const existingBalance = schedule.reduce((s, e) => s + (e.amount_due - e.amount_paid), 0);
  const paidEntries   = schedule.filter(e => e.status === "paid" || e.status === "waived");
  const pendingEntries = schedule.filter(e => e.status !== "paid" && e.status !== "waived");

  // ── Frequency settings ──
  const [freq, setFreq] = useState<FreqOption>(
    (feeStructure?.payment_frequency as FreqOption) ?? "monthly"
  );
  const [startDate, setStartDate]   = useState(
    pendingEntries[0]?.due_date ?? new Date().toISOString().slice(0, 10)
  );
  const [smDay1, setSmDay1]         = useState(feeStructure?.semi_monthly_day_1 ?? 1);
  const [smDay2, setSmDay2]         = useState(feeStructure?.semi_monthly_day_2 ?? 15);

  // ── Balance & installment count ──
  const remaining = Math.max(0, existingBalance);
  const [installCount, setInstallCount] = useState(pendingEntries.length || 1);
  const [uniformAmount, setUniformAmount] = useState(
    pendingEntries.length > 0
      ? String((remaining / pendingEntries.length).toFixed(2))
      : ""
  );

  // ── Draft installments (for custom / preview) ──
  const [drafts, setDrafts] = useState<DraftInstallment[]>([]);
  const [previewGenerated, setPreviewGenerated] = useState(false);
  const [saving, setSaving] = useState(false);

  const inp  = "w-full bg-[var(--bg-surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-xl px-3 py-2.5 placeholder-[var(--text-faint)] focus:outline-none focus:border-amber-400/50 transition-colors";
  const lbl  = "text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-1.5 block";
  const smIn = "bg-[var(--bg-surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-400/50 transition-colors";

  // ── Date generation (mirrors AddClientModal logic) ──
  function genDates(count: number): string[] {
    const dates: string[] = [];
    const base = new Date(startDate + "T12:00:00");
    if (freq === "biweekly") {
      for (let i = 0; i < count; i++) {
        const d = new Date(base); d.setDate(d.getDate() + i * 14);
        dates.push(d.toISOString().slice(0, 10));
      }
    } else if (freq === "semi_monthly") {
      const allDates: Date[] = [];
      let month = base.getFullYear() * 12 + base.getMonth();
      let safety = 0;
      while (allDates.length < count && safety++ < 300) {
        const yr = Math.floor(month / 12), mo = month % 12;
        const da1 = new Date(yr, mo, smDay1, 12);
        const da2 = new Date(yr, mo, smDay2, 12);
        if (da1 >= base) allDates.push(da1);
        if (da2 >= base) allDates.push(da2);
        month++;
      }
      allDates.sort((a, b) => a.getTime() - b.getTime());
      for (let i = 0; i < Math.min(count, allDates.length); i++)
        dates.push(allDates[i].toISOString().slice(0, 10));
    } else if (freq === "weekly") {
      for (let i = 0; i < count; i++) {
        const d = new Date(base); d.setDate(d.getDate() + i * 7);
        dates.push(d.toISOString().slice(0, 10));
      }
    } else {
      for (let i = 0; i < count; i++) {
        const d = new Date(base); d.setMonth(d.getMonth() + i);
        dates.push(d.toISOString().slice(0, 10));
      }
    }
    return dates;
  }

  function buildDrafts(): DraftInstallment[] {
    const cnt  = Math.max(1, installCount);
    const amt  = parseFloat(uniformAmount) || (remaining > 0 ? remaining / cnt : 0);
    const lastNum = paidEntries.length;

    if (freq === "custom") {
      // Start from existing pending or create blank
      return pendingEntries.length > 0
        ? pendingEntries.map((e, i) => ({
            id: e.id,
            installment_number: lastNum + i + 1,
            due_date: e.due_date,
            amount_due: e.amount_due,
            status: e.status,
            amount_paid: e.amount_paid,
          }))
        : Array.from({ length: cnt }, (_, i) => ({
            id: "",
            installment_number: lastNum + i + 1,
            due_date: startDate,
            amount_due: amt,
            status: "pending" as const,
            amount_paid: 0,
          }));
    }

    const dates = genDates(cnt);
    return dates.map((d, i) => {
      const isLast  = i === cnt - 1;
      const instAmt = isLast
        ? Math.max(0, parseFloat((remaining - amt * (cnt - 1)).toFixed(2)))
        : parseFloat(amt.toFixed(2));
      return {
        id: pendingEntries[i]?.id ?? "",
        installment_number: lastNum + i + 1,
        due_date: d,
        amount_due: instAmt > 0 ? instAmt : amt,
        status: "pending" as const,
        amount_paid: 0,
      };
    });
  }

  function handlePreview() {
    setDrafts(buildDrafts());
    setPreviewGenerated(true);
  }

  function updateDraft(index: number, field: keyof DraftInstallment, value: string | number) {
    setDrafts(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  }

  function addCustomRow() {
    const last = drafts[drafts.length - 1];
    setDrafts(prev => [...prev, {
      id: "",
      installment_number: (last?.installment_number ?? paidEntries.length) + 1,
      due_date: last?.due_date ?? startDate,
      amount_due: 0,
      status: "pending",
      amount_paid: 0,
    }]);
  }

  function removeCustomRow(index: number) {
    setDrafts(prev => prev.filter((_, i) => i !== index).map((d, i) => ({
      ...d, installment_number: paidEntries.length + i + 1,
    })));
  }

  const draftTotal = drafts.reduce((s, d) => s + (parseFloat(String(d.amount_due)) || 0), 0);
  const balanceDiff = draftTotal - remaining;

  async function save() {
    if (!previewGenerated && freq !== "custom") return;
    if (drafts.length === 0) return;
    setSaving(true);

    // Delete all existing pending entries
    for (const e of pendingEntries) {
      await fetch(`${SUPABASE_URL}/rest/v1/accounting_payment_schedule?id=eq.${e.id}`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
      });
    }

    // Insert new drafts
    for (const d of drafts) {
      await api.post("accounting_payment_schedule", {
        client_id:           client.id,
        installment_number:  d.installment_number,
        due_date:            d.due_date,
        amount_due:          parseFloat(String(d.amount_due)) || 0,
        amount_paid:         0,
        status:              "pending",
      });
    }

    // Update fee structure frequency settings
    if (feeStructure) {
      await api.patch("accounting_fee_structures", feeStructure.id, {
        payment_frequency:    freq === "custom" ? "monthly" : freq,
        semi_monthly_day_1:   freq === "semi_monthly" ? smDay1 : null,
        semi_monthly_day_2:   freq === "semi_monthly" ? smDay2 : null,
        biweekly_start_date:  freq === "biweekly"     ? startDate : null,
        first_payment_date:   startDate,
        plan_months:          freq === "custom" ? null : Math.ceil(drafts.length / (
          freq === "weekly" ? 4.33 : freq === "biweekly" ? 2.17 : freq === "semi_monthly" ? 2 : 1
        )),
        updated_at: new Date().toISOString(),
      });
    }

    await api.post("case_time_log", {
      client_id:        client.id,
      staff_name:       staffName,
      activity_type:    "payment_adjustment",
      duration_minutes: 0,
      billable:         false,
      notes:            `Payment schedule adjusted by ${staffName}: ${drafts.length} installments (${FREQ_LABELS[freq === "custom" ? "monthly" : freq]}) starting ${startDate}. Balance remaining: ${fmt(draftTotal)}.`,
      started_at:       new Date().toISOString(),
    });

    setSaving(false);
    onSaved();
  }

  const totalDrafted = drafts.reduce((s, d) => s + d.amount_due, 0);
  const canSave = previewGenerated && drafts.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Adjust Payment Schedule</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {client.full_name} · {paidEntries.length} paid · {pendingEntries.length} pending · <span className="text-amber-700 font-semibold">{fmt(remaining)} remaining balance</span>
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* Frequency selector */}
          <div>
            <label className={lbl}>Payment Frequency</label>
            <div className="grid grid-cols-5 gap-1.5">
              {(["weekly","biweekly","semi_monthly","monthly","custom"] as FreqOption[]).map(f => (
                <button key={f} onClick={() => { setFreq(f); setPreviewGenerated(false); }}
                  className={`py-2 px-1 text-[10px] font-bold rounded-xl border transition-all ${freq === f
                    ? "bg-amber-100 text-amber-700 border-amber-500/30"
                    : "text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-secondary)]"}`}>
                  {f === "semi_monthly" ? "Semi-Monthly" : f === "biweekly" ? "Bi-Weekly" : f === "custom" ? "Custom" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Semi-monthly day pickers */}
          {freq === "semi_monthly" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>First Payment Day of Month</label>
                <input type="number" value={smDay1} onChange={e => { setSmDay1(parseInt(e.target.value)||1); setPreviewGenerated(false); }} min={1} max={28} className={inp} />
              </div>
              <div>
                <label className={lbl}>Second Payment Day of Month</label>
                <input type="number" value={smDay2} onChange={e => { setSmDay2(parseInt(e.target.value)||15); setPreviewGenerated(false); }} min={1} max={28} className={inp} />
              </div>
            </div>
          )}

          {/* Start date + count + amount */}
          {freq !== "custom" && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Start Date</label>
                <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPreviewGenerated(false); }} className={inp} />
              </div>
              <div>
                <label className={lbl}>Number of Installments</label>
                <input type="number" value={installCount} onChange={e => { setInstallCount(parseInt(e.target.value)||1); setPreviewGenerated(false); }} min={1} max={260} className={inp} />
              </div>
              <div>
                <label className={lbl}>Amount Per Installment</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">$</span>
                  <input value={uniformAmount} onChange={e => { setUniformAmount(e.target.value); setPreviewGenerated(false); }} className={`${inp} pl-7`} placeholder="auto" />
                </div>
              </div>
            </div>
          )}

          {/* Balance summary */}
          <div className="bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 grid grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-[var(--text-muted)] mb-0.5">Remaining Balance</p>
              <p className="font-bold text-[var(--text-primary)]">{fmt(remaining)}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)] mb-0.5">Installments</p>
              <p className="font-bold text-[var(--text-primary)]">{freq === "custom" ? drafts.length : installCount}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)] mb-0.5">Drafted Total</p>
              <p className={`font-bold ${Math.abs(balanceDiff) < 0.02 ? "text-emerald-700" : "text-amber-700"}`}>
                {fmt(totalDrafted)}
                {previewGenerated && Math.abs(balanceDiff) > 0.01 && (
                  <span className="text-[10px] text-amber-700 ml-1">({balanceDiff > 0 ? "+" : ""}{fmt(balanceDiff)})</span>
                )}
              </p>
            </div>
          </div>

          {/* Generate preview button */}
          {freq !== "custom" && !previewGenerated && (
            <button onClick={handlePreview}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-amber-500/30 bg-amber-50 text-amber-700 text-sm font-bold hover:bg-amber-100 transition-all">
              <RefreshCw className="w-3.5 h-3.5" /> Generate Schedule Preview
            </button>
          )}

          {/* Custom: start with blank or existing pending */}
          {freq === "custom" && !previewGenerated && (
            <button onClick={() => { setDrafts(buildDrafts()); setPreviewGenerated(true); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-amber-500/30 bg-amber-50 text-amber-700 text-sm font-bold hover:bg-amber-100 transition-all">
              <Pencil className="w-3.5 h-3.5" /> Load Existing Pending as Custom
            </button>
          )}

          {/* Draft installments table */}
          {previewGenerated && drafts.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
                  {freq === "custom" ? "Custom Schedule" : "Generated Schedule"} — {drafts.length} installments
                </p>
                {freq === "custom" && (
                  <button onClick={addCustomRow}
                    className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-700 transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    Add Row
                  </button>
                )}
              </div>

              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="grid grid-cols-12 gap-0 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest px-3 py-2 bg-[var(--bg-surface-2)] border-b border-[var(--border)]">
                  <span className="col-span-1">#</span>
                  <span className="col-span-5">Due Date</span>
                  <span className="col-span-4">Amount</span>
                  <span className="col-span-2 text-right">Status</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-[var(--border)]">
                  {drafts.map((d, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center px-3 py-2 hover:bg-[var(--bg-surface-2)]/50 transition-colors group">
                      <span className="col-span-1 text-[10px] text-[var(--text-faint)] font-mono">#{d.installment_number}</span>
                      <div className="col-span-5">
                        <input type="date" value={d.due_date}
                          onChange={e => updateDraft(i, "due_date", e.target.value)}
                          className={`${smIn} w-full`} />
                      </div>
                      <div className="col-span-4 relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-xs">$</span>
                        <input type="number" value={d.amount_due}
                          onChange={e => updateDraft(i, "amount_due", parseFloat(e.target.value) || 0)}
                          className={`${smIn} w-full pl-5`} step="0.01" min={0} />
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                          d.status === "paid"    ? "text-emerald-700 bg-emerald-50 border-emerald-500/25" :
                          d.status === "partial" ? "text-amber-700 bg-amber-50 border-amber-500/25" :
                          d.status === "late"    ? "text-rose-700 bg-rose-50 border-red-500/25" :
                                                   "text-slate-600 bg-slate-200/30 border-slate-200"
                        }`}>{d.status}</span>
                        {freq === "custom" && (
                          <button onClick={() => removeCustomRow(i)}
                            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-700 transition-all">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {Math.abs(balanceDiff) > 0.01 && (
                <p className="text-[11px] text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  Drafted total ({fmt(totalDrafted)}) differs from remaining balance ({fmt(remaining)}) by {fmt(Math.abs(balanceDiff))}.
                  The last installment will be auto-adjusted on save to close the balance.
                </p>
              )}

              <button onClick={() => { setPreviewGenerated(false); setDrafts([]); }}
                className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors">
                ← Regenerate with different settings
              </button>
            </div>
          )}

          {/* Already-paid entries (read-only display) */}
          {paidEntries.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2">
                Paid / Waived ({paidEntries.length}) — not modified
              </p>
              <div className="space-y-1">
                {paidEntries.map(e => (
                  <div key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15 opacity-60">
                    <span className="text-[10px] font-mono text-[var(--text-faint)] w-6">#{e.installment_number}</span>
                    <span className="text-xs text-[var(--text-secondary)] flex-1">{fmtDate(e.due_date)}</span>
                    <span className="text-xs font-semibold text-emerald-700">{fmt(e.amount_due)}</span>
                    <span className="text-[9px] font-bold text-emerald-700 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-500/25">{e.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[var(--border)] flex items-center justify-between flex-shrink-0">
          <p className="text-[10px] text-[var(--text-faint)]">
            Replaces {pendingEntries.length} pending installment{pendingEntries.length !== 1 ? "s" : ""} · By {staffName}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
            <button onClick={save} disabled={!canSave || saving}
              className="flex items-center gap-1.5 font-bold text-xs px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 transition-all disabled:opacity-40">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save Schedule ({drafts.length} installments)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Adjust Payment Modal ─────────────────────────────────────────────────────

function AdjustPaymentModal({ payment, client, adminUser, role, feeStructure, onClose, onSaved }: {
  payment: Payment;
  client: AClient;
  adminUser: string | null;
  role: ReturnType<typeof roleOf>;
  feeStructure?: FeeStructure | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isSuperAdmin = role === "super_admin" || role === "accounting_super_admin";
  const staffName = adminUser?.replace(/\*+$/, "") ?? "Staff";

  type Mode = "edit" | "void" | "fee_adjustment";
  const [mode, setMode]   = useState<Mode>(isSuperAdmin ? "fee_adjustment" : "edit");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  // Edit / void form
  const [form, setForm] = useState({
    amount:              String(payment.amount),
    payment_date:        payment.payment_date,
    payment_method:      payment.payment_method,
    payment_type:        payment.payment_type,
    destination_account: payment.destination_account ?? resolveDestination(client.case_type, payment.payment_type),
    notes:               payment.notes ?? "",
  });

  // Fee adjustment form
  const [feeForm, setFeeForm] = useState({
    adj_type:       "payment_plan" as "attorney_fee" | "court_filing_fee" | "payment_plan",
    new_amount:     "",
    new_plan_months:"",
    reason:         "",
  });

  const autoDest = resolveDestination(client.case_type, form.payment_type);
  const effectiveDest = form.destination_account as "operating" | "iolta";

  const inp = "w-full bg-[var(--bg-surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-xl px-3 py-2.5 placeholder-[var(--text-faint)] focus:outline-none focus:border-amber-400/50 transition-colors";
  const lbl = "text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-1.5 block";

  async function save() {
    setSaving(true);

    if (mode === "void") {
      await api.patch("accounting_payments", payment.id, {
        voided: true,
        notes: form.notes || "Voided by staff.",
      });
      await api.post("case_time_log", {
        client_id:        client.id,
        staff_name:       staffName,
        activity_type:    "payment_adjustment",
        duration_minutes: 0,
        billable:         false,
        notes:            `Payment voided by ${staffName}: ${fmt(payment.amount)} (${payment.payment_type.replace(/_/g," ")}) — dated ${payment.payment_date}${form.notes ? ` — ${form.notes}` : ""}`,
        started_at:       new Date().toISOString(),
      });

    } else if (mode === "edit") {
      const newAmt = parseFloat(form.amount) || payment.amount;
      await api.patch("accounting_payments", payment.id, {
        amount:              newAmt,
        payment_date:        form.payment_date,
        payment_method:      form.payment_method,
        payment_type:        form.payment_type,
        is_iolta:            effectiveDest === "iolta",
        destination_account: effectiveDest,
        notes:               form.notes || null,
      });
      await api.post("case_time_log", {
        client_id:        client.id,
        staff_name:       staffName,
        activity_type:    "payment_adjustment",
        duration_minutes: 0,
        billable:         false,
        notes:            `Payment adjusted by ${staffName}: ${fmt(newAmt)} on ${form.payment_date} → ${effectiveDest.toUpperCase()} (was ${fmt(payment.amount)} on ${payment.payment_date})${form.notes ? ` — ${form.notes}` : ""}`,
        started_at:       new Date().toISOString(),
      });

    } else if (mode === "fee_adjustment") {
      // Fee adjustments always go through the approval queue for non-super-admins
      const proposed = parseFloat(feeForm.new_amount) || null;
      const proposedMonths = feeForm.adj_type === "payment_plan" && feeForm.new_plan_months ? parseInt(feeForm.new_plan_months) : null;
      const reqStatus = isSuperAdmin ? "approved" : "pending";

      const reqData: Record<string, unknown> = {
        client_id:             client.id,
        client_name:           client.full_name,
        fee_structure_id:      feeStructure?.id ?? null,
        adjustment_type:       feeForm.adj_type,
        original_attorney_fee: feeStructure?.attorney_fee ?? null,
        original_court_filing_fee: feeStructure?.court_filing_fee ?? null,
        original_total_fee:    feeStructure?.total_fee ?? null,
        original_payment_amount: feeStructure?.down_payment ?? null,
        original_plan_months:  feeStructure?.plan_months ?? null,
        proposed_attorney_fee:      feeForm.adj_type === "attorney_fee"    ? proposed : null,
        proposed_court_filing_fee:  feeForm.adj_type === "court_filing_fee"? proposed : null,
        proposed_payment_amount:    feeForm.adj_type === "payment_plan"    ? proposed : null,
        proposed_plan_months:       proposedMonths,
        reason:                feeForm.reason.trim(),
        requested_by:          staffName,
        status:                reqStatus,
      };

      await api.post("fee_adjustment_requests", reqData);

      // Super admins apply immediately
      if (isSuperAdmin && feeStructure && proposed !== null) {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (feeForm.adj_type === "attorney_fee") {
          patch.attorney_fee = proposed;
          patch.total_fee    = proposed + (feeStructure.court_filing_fee ?? 0);
        } else if (feeForm.adj_type === "court_filing_fee") {
          patch.court_filing_fee = proposed;
          patch.total_fee        = (feeStructure.attorney_fee ?? 0) + proposed;
        } else if (feeForm.adj_type === "payment_plan") {
          patch.down_payment  = proposed;
          if (proposedMonths) patch.plan_months = proposedMonths;
        }
        await api.patch("accounting_fee_structures", feeStructure.id, patch);
      }

      await api.post("case_time_log", {
        client_id:        client.id,
        staff_name:       staffName,
        activity_type:    "fee_adjustment_request",
        duration_minutes: 0,
        billable:         false,
        notes:            `Fee adjustment ${reqStatus === "approved" ? "applied" : "requested"} by ${staffName}: ${feeForm.adj_type.replace(/_/g," ")} → ${proposed !== null ? fmt(proposed) : "n/a"}${proposedMonths ? ` (${proposedMonths} months)` : ""}. ${feeForm.reason}`,
        started_at:       new Date().toISOString(),
      });

      setSaving(false);
      setSaved(true);
      setTimeout(onSaved, 1400);
      return;
    }

    setSaving(false);
    onSaved();
  }

  const modeBtn = (m: Mode, label: string, icon: React.ReactNode, activeColor: string) => (
    <button onClick={() => setMode(m)}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-all ${mode === m ? activeColor : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>
      {icon} {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Payment Adjustment</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{client.full_name} · {fmt(payment.amount)} · {fmtDate(payment.payment_date)}</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"><X className="w-4 h-4" /></button>
        </div>

        {/* Mode tabs */}
        <div className="px-5 pt-4 flex-shrink-0">
          <div className="flex rounded-xl overflow-hidden border border-[var(--border)] mb-4">
            {modeBtn("edit",           "Edit Payment",   <Pencil className="w-3 h-3" />,       "bg-amber-100 text-amber-500")}
            {modeBtn("fee_adjustment", "Fee Adjustment", <DollarSign className="w-3 h-3" />,   "bg-sky-100 text-sky-700")}
            {modeBtn("void",           "Void Payment",   <X className="w-3 h-3" />,             "bg-rose-100 text-rose-700")}
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pb-4 overflow-y-auto flex-1 space-y-3">

          {/* ── Edit mode ── */}
          {mode === "edit" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">$</span>
                    <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={`${inp} pl-7`} placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Payment Date</label>
                  <input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Method</label>
                  <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className={inp}>
                    <option value="credit_card">Credit Card</option>
                    <option value="debit_card">Debit Card</option>
                    <option value="check">Check</option>
                    <option value="cash">Cash</option>
                    <option value="wire">Wire Transfer</option>
                    <option value="ach">ACH</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Type</label>
                  <select value={form.payment_type} onChange={e => setForm(f => ({
                    ...f,
                    payment_type: e.target.value,
                    destination_account: resolveDestination(client.case_type, e.target.value),
                  }))} className={inp}>
                    <option value="attorney_fee">Attorney Fee</option>
                    <option value="court_filing_fee">Court Filing Fee</option>
                    <option value="plan_payment">Plan Payment</option>
                    <option value="retainer">Retainer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Destination override */}
              <div>
                <label className={lbl}>Destination Account</label>
                <div className="flex gap-2">
                  {(["operating", "iolta"] as const).map(d => (
                    <button key={d} onClick={() => setForm(f => ({ ...f, destination_account: d }))}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${effectiveDest === d
                        ? d === "iolta"
                          ? "bg-amber-100 text-amber-700 border-amber-400/30"
                          : "bg-emerald-100 text-emerald-700 border-emerald-500/30"
                        : "text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-secondary)]"}`}>
                      {d === "iolta" ? "IOLTA / Trust" : "Operating"}
                    </button>
                  ))}
                </div>
                {effectiveDest !== autoDest && (
                  <p className="text-[10px] text-amber-700 mt-1">
                    Note: auto-destination for this type is <strong>{autoDest.toUpperCase()}</strong> — you've overridden it.
                  </p>
                )}
              </div>

              <div>
                <label className={lbl}>Notes / Reason</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Reason for adjustment…" className={inp} />
              </div>
            </>
          )}

          {/* ── Fee Adjustment mode ── */}
          {mode === "fee_adjustment" && (
            <>
              {!isSuperAdmin && (
                <div className="flex items-start gap-2.5 bg-sky-50 border border-sky-500/20 rounded-xl px-3.5 py-3">
                  <AlertTriangle className="w-4 h-4 text-sky-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-sky-700">Requires Approval</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                      Fee adjustments require super admin approval. Your request will be submitted for review.
                    </p>
                  </div>
                </div>
              )}
              {isSuperAdmin && (
                <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-500/20 rounded-xl px-3.5 py-3">
                  <Check className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    Super admin — fee adjustment will be applied immediately.
                  </p>
                </div>
              )}

              <div>
                <label className={lbl}>Adjustment Type</label>
                <select value={feeForm.adj_type} onChange={e => setFeeForm(f => ({ ...f, adj_type: e.target.value as typeof f.adj_type }))} className={inp}>
                  <option value="attorney_fee">Attorney Fee</option>
                  <option value="court_filing_fee">Court Filing Fee</option>
                  <option value="payment_plan">Payment Plan Amount / Months</option>
                </select>
              </div>

              {/* Current values */}
              {feeStructure && (
                <div className="bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  <span className="text-[var(--text-muted)]">Current Attorney Fee</span>
                  <span className="text-[var(--text-primary)] font-semibold text-right">{fmt(feeStructure.attorney_fee ?? 0)}</span>
                  <span className="text-[var(--text-muted)]">Court Filing Fee</span>
                  <span className="text-[var(--text-primary)] font-semibold text-right">{fmt(feeStructure.court_filing_fee ?? 0)}</span>
                  <span className="text-[var(--text-muted)]">Plan Payment</span>
                  <span className="text-[var(--text-primary)] font-semibold text-right">{feeStructure.down_payment ? fmt(feeStructure.down_payment) : "—"}</span>
                  <span className="text-[var(--text-muted)]">Plan Months</span>
                  <span className="text-[var(--text-primary)] font-semibold text-right">{feeStructure.plan_months ?? "—"}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className={feeForm.adj_type === "payment_plan" ? "" : "col-span-2"}>
                  <label className={lbl}>New Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">$</span>
                    <input value={feeForm.new_amount} onChange={e => setFeeForm(f => ({ ...f, new_amount: e.target.value }))}
                      className={`${inp} pl-7`} placeholder="0.00" />
                  </div>
                </div>
                {feeForm.adj_type === "payment_plan" && (
                  <div>
                    <label className={lbl}>New Plan Months</label>
                    <input type="number" value={feeForm.new_plan_months} onChange={e => setFeeForm(f => ({ ...f, new_plan_months: e.target.value }))}
                      className={inp} placeholder="e.g. 60" min={1} max={84} />
                  </div>
                )}
              </div>

              <div>
                <label className={lbl}>Reason *</label>
                <textarea value={feeForm.reason} onChange={e => setFeeForm(f => ({ ...f, reason: e.target.value }))}
                  rows={3} placeholder="Explain why this fee adjustment is necessary…" className={`${inp} resize-none`} />
              </div>

              {saved && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-500/20 rounded-xl px-4 py-3">
                  <Check className="w-4 h-4 text-emerald-700" />
                  <p className="text-sm font-semibold text-emerald-700">
                    {isSuperAdmin ? "Fee adjustment applied." : "Request submitted for approval."}
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Void mode ── */}
          {mode === "void" && (
            <>
              <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/20 rounded-xl px-3.5 py-3">
                <AlertTriangle className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-rose-700">Void this payment?</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                    This marks the payment as voided and removes it from all totals. A time log entry will be created. This cannot be undone.
                  </p>
                </div>
              </div>
              <div className="bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Amount</span><span className="font-bold text-[var(--text-primary)]">{fmt(payment.amount)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Date</span><span className="text-[var(--text-secondary)]">{fmtDate(payment.payment_date)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Method</span><span className="text-[var(--text-secondary)] capitalize">{payment.payment_method.replace(/_/g," ")}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Type</span><span className="text-[var(--text-secondary)] capitalize">{payment.payment_type.replace(/_/g," ")}</span></div>
              </div>
              <div>
                <label className={lbl}>Reason (optional)</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  placeholder="Reason for voiding…" className={`${inp} resize-none`} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center justify-between flex-shrink-0">
          <p className="text-[10px] text-[var(--text-faint)]">By: {staffName}</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
            <button onClick={save} disabled={saving || saved ||
              (mode === "fee_adjustment" && (!feeForm.new_amount || !feeForm.reason.trim()))
            } className={`flex items-center gap-1.5 font-bold text-xs px-5 py-2 rounded-xl transition-all disabled:opacity-50 ${
              mode === "void"           ? "bg-red-500 hover:bg-red-400 text-slate-900" :
              mode === "fee_adjustment" ? "bg-sky-500 hover:bg-sky-400 text-slate-900" :
                                         "bg-amber-500 hover:bg-amber-400 text-slate-900"
            }`}>
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> :
               mode === "void"           ? <><X className="w-3.5 h-3.5" /> Void Payment</> :
               mode === "fee_adjustment" ? <><DollarSign className="w-3.5 h-3.5" /> {isSuperAdmin ? "Apply Now" : "Submit for Approval"}</> :
                                           <><Check className="w-3.5 h-3.5" /> Save Changes</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Client Modal ─────────────────────────────────────────────────────────

function AddClientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", state: "IL",
    chapter: "7" as "7" | "13", case_type: "regular" as AClient["case_type"],
    intake_date: new Date().toISOString().slice(0, 10),
  });
  const [fee, setFee] = useState({
    attorney_fee: "", court_filing_fee: "",
    down_payment: "",
    plan_months: "4",
    first_payment_date: "",
    payment_frequency: "monthly",
    semi_monthly_day_1: "1",
    semi_monthly_day_2: "15",
    bifurcated_signing_threshold: "338",
    ch13_upfront_amount: "", ch13_plan_remainder: "",
    hourly_rate: "", retainer_amount: "",
  });
  const [saving, setSaving] = useState(false);

  const ch = form.chapter;
  const ct = form.case_type;
  const isRegularCh7 = ct === "regular";

  const caseTypeOptions: { value: AClient["case_type"]; label: string }[] =
    ch === "7"
      ? [{ value: "regular", label: "Regular (all fees paid before filing)" }, { value: "bifurcated", label: "Bifurcated (file then pay)" }]
      : [{ value: "flat_fee", label: "Flat Fee" }, { value: "hourly", label: "Hourly / IOLTA" }];

  // Compute installment preview for regular Ch.7
  const attyFeeNum    = parseFloat(fee.attorney_fee) || 0;
  const downPmtNum    = parseFloat(fee.down_payment) || 0;
  const planMonths    = Math.min(6, Math.max(4, parseInt(fee.plan_months) || 4));
  const remaining     = Math.max(0, attyFeeNum - downPmtNum);
  const smDay1        = parseInt(fee.semi_monthly_day_1) || 1;
  const smDay2        = parseInt(fee.semi_monthly_day_2) || 15;
  const installCount  = calcInstallmentCount(planMonths, fee.payment_frequency);
  const installment   = installCount > 0 ? remaining / installCount : 0;

  // Generate installment dates based on frequency
  function genScheduleDates(startDate: string, count: number, frequency: string, smDay1?: number, smDay2?: number): string[] {
    const dates: string[] = [];
    const base = new Date(startDate + "T12:00:00");

    if (frequency === "biweekly") {
      // Every 14 days from startDate
      for (let i = 0; i < count; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() + i * 14);
        dates.push(d.toISOString().slice(0, 10));
      }
    } else if (frequency === "semi_monthly") {
      // Alternates between day1 and day2 of each month
      const d1 = smDay1 ?? 1;
      const d2 = smDay2 ?? 15;
      // Start from the first semi-monthly date on or after startDate
      let month = base.getFullYear() * 12 + base.getMonth();
      // Build a sorted list of upcoming semi-monthly dates
      const allDates: Date[] = [];
      let safety = 0;
      while (allDates.length < count && safety++ < 200) {
        const yr  = Math.floor(month / 12);
        const mo  = month % 12;
        const da1 = new Date(yr, mo, d1, 12);
        const da2 = new Date(yr, mo, d2, 12);
        if (da1 >= base) allDates.push(da1);
        if (da2 >= base) allDates.push(da2);
        month++;
      }
      allDates.sort((a, b) => a.getTime() - b.getTime());
      for (let i = 0; i < count; i++) {
        if (allDates[i]) dates.push(allDates[i].toISOString().slice(0, 10));
      }
    } else if (frequency === "weekly") {
      for (let i = 0; i < count; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() + i * 7);
        dates.push(d.toISOString().slice(0, 10));
      }
    } else {
      // monthly (default)
      for (let i = 0; i < count; i++) {
        const d = new Date(base);
        d.setMonth(d.getMonth() + i);
        dates.push(d.toISOString().slice(0, 10));
      }
    }
    return dates;
  }

  // Count of installments needed based on frequency + plan_months
  function calcInstallmentCount(months: number, frequency: string): number {
    if (frequency === "biweekly")    return Math.round(months * 2.17); // ~26/yr
    if (frequency === "semi_monthly") return months * 2;
    if (frequency === "weekly")       return Math.round(months * 4.33);
    return months; // monthly
  }

  async function save() {
    if (!form.full_name.trim()) return;
    setSaving(true);

    const clientRes = await api.post("accounting_clients", {
      client_id: `client-${Date.now()}`,
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      state: form.state,
      chapter: parseInt(form.chapter),
      case_type: form.case_type,
      status: "active",
      intake_date: form.intake_date,
    });
    const client = clientRes?.[0];
    if (client) {
      const courtFee = fee.court_filing_fee ? parseFloat(fee.court_filing_fee) : (ch === "7" ? 338 : 313);
      const fsRes = await api.post("accounting_fee_structures", {
        client_id: client.id,
        attorney_fee: attyFeeNum,
        court_filing_fee: courtFee,
        down_payment: downPmtNum,
        plan_months: isRegularCh7 ? planMonths : null,
        first_payment_date: fee.first_payment_date || null,
        payment_frequency: fee.payment_frequency,
        semi_monthly_day_1: fee.payment_frequency === "semi_monthly" ? smDay1 : null,
        semi_monthly_day_2: fee.payment_frequency === "semi_monthly" ? smDay2 : null,
        biweekly_start_date: fee.payment_frequency === "biweekly" ? (fee.first_payment_date || null) : null,
        bifurcated_signing_threshold: parseFloat(fee.bifurcated_signing_threshold) || 400,
        ch13_upfront_amount: fee.ch13_upfront_amount ? parseFloat(fee.ch13_upfront_amount) : null,
        ch13_plan_remainder: fee.ch13_plan_remainder ? parseFloat(fee.ch13_plan_remainder) : null,
        hourly_rate: fee.hourly_rate ? parseFloat(fee.hourly_rate) : null,
        retainer_amount: fee.retainer_amount ? parseFloat(fee.retainer_amount) : null,
        iolta_balance: ct === "hourly" && fee.retainer_amount ? parseFloat(fee.retainer_amount) : 0,
      });

      // Auto-generate payment schedule for regular Ch.7 with down payment + installments
      if (isRegularCh7 && fee.first_payment_date && attyFeeNum > 0) {
        const dates = genScheduleDates(fee.first_payment_date, installCount, fee.payment_frequency, smDay1, smDay2);
        let installNum = 1;

        // Down payment entry (due on first_payment_date)
        if (downPmtNum > 0) {
          await api.post("accounting_payment_schedule", {
            client_id: client.id,
            installment_number: installNum++,
            due_date: fee.first_payment_date,
            amount_due: downPmtNum,
            amount_paid: 0,
            status: "pending",
          });
        }

        // Recurring installments
        for (let i = 0; i < installCount; i++) {
          if (remaining > 0) {
            const amt = i === installCount - 1
              ? parseFloat((remaining - installment * (installCount - 1)).toFixed(2))
              : parseFloat(installment.toFixed(2));
            await api.post("accounting_payment_schedule", {
              client_id: client.id,
              installment_number: installNum++,
              due_date: dates[i],
              amount_due: amt,
              amount_paid: 0,
              status: "pending",
            });
          }
        }
      }

      void fsRes;
    }
    setSaving(false);
    onSaved();
  }

  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-300";
  const lbl = "text-xs font-semibold text-slate-600 mb-1.5 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Add New Client</h3>
            <p className="text-xs text-slate-500 mt-0.5">Set up client billing and fee structure</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-5 overflow-y-auto flex-1">

          {/* Client Info */}
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Client Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lbl}>Full Name *</label>
                <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Full legal name" className={inp} />
              </div>
              <div>
                <label className={lbl}>Email</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" className={inp} />
              </div>
              <div>
                <label className={lbl}>Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(xxx) xxx-xxxx" className={inp} />
              </div>
              <div>
                <label className={lbl}>State</label>
                <select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} className={inp}>
                  {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Intake Date</label>
                <input type="date" value={form.intake_date} onChange={e => setForm(f => ({ ...f, intake_date: e.target.value }))} className={inp} />
              </div>
            </div>
          </div>

          {/* Case Type */}
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Case Type</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Chapter</label>
                <select value={form.chapter} onChange={e => {
                  const c = e.target.value as "7" | "13";
                  setForm(f => ({ ...f, chapter: c, case_type: c === "7" ? "regular" : "flat_fee" }));
                  setFee(f => ({ ...f, court_filing_fee: c === "7" ? "338" : "313" }));
                }} className={inp}>
                  <option value="7">Chapter 7</option>
                  <option value="13">Chapter 13</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Case Structure</label>
                <select value={form.case_type} onChange={e => setForm(f => ({ ...f, case_type: e.target.value as AClient["case_type"] }))} className={inp}>
                  {caseTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Fee Structure */}
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Fee Structure</p>
            <div className="grid grid-cols-2 gap-3">
              {ct !== "hourly" && (
                <div>
                  <label className={lbl}>Attorney Fee</label>
                  <input value={fee.attorney_fee} onChange={e => setFee(f => ({ ...f, attorney_fee: e.target.value }))} placeholder="e.g. 1500" className={inp} />
                </div>
              )}
              <div>
                <label className={lbl}>
                  Court Filing Fee
                  <span className="ml-1.5 text-[10px] font-normal text-amber-700">(collected separately — not in payment plan)</span>
                </label>
                <input value={fee.court_filing_fee} onChange={e => setFee(f => ({ ...f, court_filing_fee: e.target.value }))} placeholder={ch === "7" ? "338" : "313"} className={inp} />
              </div>

              {ct === "bifurcated" && (
                <div>
                  <label className={lbl}>Signing Threshold</label>
                  <input value={fee.bifurcated_signing_threshold} onChange={e => setFee(f => ({ ...f, bifurcated_signing_threshold: e.target.value }))} placeholder="338" className={inp} />
                </div>
              )}
              {ct === "flat_fee" && <>
                <div>
                  <label className={lbl}>Upfront Amount</label>
                  <input value={fee.ch13_upfront_amount} onChange={e => setFee(f => ({ ...f, ch13_upfront_amount: e.target.value }))} placeholder="e.g. 2500" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Plan Remainder</label>
                  <input value={fee.ch13_plan_remainder} onChange={e => setFee(f => ({ ...f, ch13_plan_remainder: e.target.value }))} placeholder="e.g. 2500" className={inp} />
                </div>
              </>}
              {ct === "hourly" && <>
                <div>
                  <label className={lbl}>Hourly Rate</label>
                  <input value={fee.hourly_rate} onChange={e => setFee(f => ({ ...f, hourly_rate: e.target.value }))} placeholder="e.g. 350" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Retainer (IOLTA)</label>
                  <input value={fee.retainer_amount} onChange={e => setFee(f => ({ ...f, retainer_amount: e.target.value }))} placeholder="e.g. 2500" className={inp} />
                </div>
              </>}
            </div>
          </div>

          {/* Payment Plan — regular Ch.7 only */}
          {isRegularCh7 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-4">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Payment Plan</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Down Payment (due at intake)</label>
                  <input value={fee.down_payment} onChange={e => setFee(f => ({ ...f, down_payment: e.target.value }))} placeholder="e.g. 300" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Payment Plan (months)</label>
                  <select value={fee.plan_months} onChange={e => setFee(f => ({ ...f, plan_months: e.target.value }))} className={inp}>
                    <option value="4">4 months</option>
                    <option value="5">5 months</option>
                    <option value="6">6 months</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Payment Frequency</label>
                  <select value={fee.payment_frequency} onChange={e => setFee(f => ({ ...f, payment_frequency: e.target.value }))} className={inp}>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-Weekly (auto every 14 days)</option>
                    <option value="semi_monthly">Semi-Monthly (2x/month)</option>
                    <option value="monthly">Monthly</option>
                    <option value="paid_in_full">Paid in Full</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>First Payment Date</label>
                  <input type="date" value={fee.first_payment_date} onChange={e => setFee(f => ({ ...f, first_payment_date: e.target.value }))} className={inp} />
                </div>

                {/* Semi-monthly: confirm both days of the month */}
                {fee.payment_frequency === "semi_monthly" && (
                  <>
                    <div>
                      <label className={lbl}>1st Payment Day of Month</label>
                      <select value={fee.semi_monthly_day_1} onChange={e => setFee(f => ({ ...f, semi_monthly_day_1: e.target.value }))} className={inp}>
                        {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(d => (
                          <option key={d} value={d}>{d}{d===1?"st":d===2?"nd":d===3?"rd":"th"} of the month</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>2nd Payment Day of Month</label>
                      <select value={fee.semi_monthly_day_2} onChange={e => setFee(f => ({ ...f, semi_monthly_day_2: e.target.value }))} className={inp}>
                        {[15,16,17,18,19,20,21,22,23,24,25,26,27,28].map(d => (
                          <option key={d} value={d}>{d}{d===21?"st":d===22?"nd":d===23?"rd":"th"} of the month</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center gap-2 bg-sky-50 border border-sky-500/20 rounded-xl px-3 py-2.5">
                        <Info className="w-3 h-3 text-sky-700 flex-shrink-0" />
                        <p className="text-[10px] text-slate-600">
                          Payments will be collected on the <strong className="text-slate-900">{smDay1}{smDay1===1?"st":smDay1===2?"nd":smDay1===3?"rd":"th"}</strong> and <strong className="text-slate-900">{smDay2}{smDay2===21?"st":smDay2===22?"nd":smDay2===23?"rd":"th"}</strong> of each month.
                          Common pairs: 1st &amp; 15th · 5th &amp; 20th.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Bi-weekly: auto info */}
                {fee.payment_frequency === "biweekly" && fee.first_payment_date && (
                  <div className="col-span-2">
                    <div className="flex items-center gap-2 bg-sky-50 border border-sky-500/20 rounded-xl px-3 py-2.5">
                      <Info className="w-3 h-3 text-sky-700 flex-shrink-0" />
                      <p className="text-[10px] text-slate-600">
                        Payments auto-calculated every <strong className="text-slate-900">14 days</strong> from {fee.first_payment_date}.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Preview */}
              {attyFeeNum > 0 && (
                <div className="bg-slate-100 rounded-xl px-4 py-3 space-y-1.5">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Schedule Preview</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Attorney Fee</span>
                    <span className="text-slate-900 font-semibold">{fmt(attyFeeNum)}</span>
                  </div>
                  {downPmtNum > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">Down Payment (Day 1)</span>
                      <span className="text-emerald-700 font-semibold">−{fmt(downPmtNum)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs border-t border-slate-200 pt-1.5">
                    <span className="text-slate-600">Remaining over {planMonths} months</span>
                    <span className="text-slate-900 font-semibold">{fmt(remaining)}</span>
                  </div>
                  {remaining > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-amber-700">
                        {FREQ_LABELS[fee.payment_frequency] ?? "Installment"} × {installCount}
                      </span>
                      <span className="text-amber-700 font-bold">{fmt(installment)}/pmt</span>
                    </div>
                  )}
                  {fee.payment_frequency === "semi_monthly" && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Payment days</span>
                      <span className="text-slate-700">{smDay1}{smDay1===1?"st":smDay1===2?"nd":smDay1===3?"rd":"th"} &amp; {smDay2}{smDay2===21?"st":smDay2===22?"nd":smDay2===23?"rd":"th"}</span>
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t border-slate-200 flex items-start gap-1.5">
                    <Info className="w-3 h-3 text-sky-700 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Court filing fee ({fee.court_filing_fee || (ch === "7" ? "338" : "313")}) is <strong className="text-amber-700">not included</strong> in this plan. It is collected separately once the client is approved to schedule signing.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment frequency for non-regular-ch7 */}
          {!isRegularCh7 && ct !== "flat_fee" && ct !== "hourly" && (
            <div>
              <label className={lbl}>Payment Frequency</label>
              <select value={fee.payment_frequency} onChange={e => setFee(f => ({ ...f, payment_frequency: e.target.value }))} className={inp}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-Weekly</option>
                <option value="semi_monthly">Semi-Monthly</option>
                <option value="monthly">Monthly</option>
                <option value="paid_in_full">Paid in Full</option>
              </select>
            </div>
          )}

        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button onClick={save} disabled={saving || !form.full_name.trim()} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold px-5 py-2 rounded-xl text-sm transition-all">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Client
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentModal({ client, onClose, onSaved }: {
  client: AClient;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    amount: "", payment_date: new Date().toISOString().slice(0, 10),
    payment_method: "credit_card", payment_type: "attorney_fee",
    notes: "", recorded_by: "",
  });
  const [saving, setSaving] = useState(false);

  const destination = resolveDestination(client.case_type, form.payment_type);
  const isActiveState = (ACTIVE_STATES as readonly string[]).includes(client.state ?? "");
  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-300";
  const lbl = "text-xs font-semibold text-slate-600 mb-1.5 block";

  async function save() {
    if (!form.amount) return;
    setSaving(true);
    await api.post("accounting_payments", {
      client_id: client.id,
      amount: parseFloat(form.amount),
      payment_date: form.payment_date,
      payment_method: form.payment_method,
      payment_type: form.payment_type,
      is_iolta: destination === "iolta",
      destination_account: destination,
      account_state: client.state,
      notes: form.notes || null,
      recorded_by: form.recorded_by || null,
    });
    // Auto-log payment adjustment
    await api.post("case_time_log", {
      client_id:        client.id,
      staff_name:       form.recorded_by || "Staff",
      activity_type:    "payment_adjustment",
      duration_minutes: 0,
      billable:         false,
      notes:            `Payment recorded: ${fmt(parseFloat(form.amount))} via ${form.payment_method.replace("_"," ")} (${form.payment_type.replace(/_/g," ")}) → ${destination}`,
      started_at:       new Date().toISOString(),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Record Payment</h3>
            <p className="text-xs text-slate-500 mt-0.5">{client.full_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Amount *</label>
              <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className={inp} />
            </div>
            <div>
              <label className={lbl}>Date</label>
              <input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Method</label>
              <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className={inp}>
                <option value="credit_card">Credit Card</option>
                <option value="debit_card">Debit Card</option>
                <option value="check">Check</option>
                <option value="cash">Cash</option>
                <option value="wire">Wire</option>
                <option value="ach">ACH</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Payment Type</label>
              <select value={form.payment_type} onChange={e => setForm(f => ({ ...f, payment_type: e.target.value }))} className={inp}>
                <option value="attorney_fee">Attorney Fee</option>
                <option value="court_filing_fee">Court Filing Fee</option>
                <option value="retainer">Retainer</option>
                <option value="plan_payment">Plan Payment</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Auto-routing indicator */}
          <div className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 border ${destination === "iolta" ? "bg-amber-500/8 border-amber-500/20" : "bg-emerald-50 border-emerald-500/20"}`}>
            {destination === "iolta"
              ? <Landmark className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
              : <Building className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold ${destination === "iolta" ? "text-amber-700" : "text-emerald-700"}`}>
                {destination === "iolta" ? "IOLTA Trust Account" : "Operating Account"}
                {isActiveState && client.state ? ` — ${client.state}` : ""}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {form.payment_type === "court_filing_fee"
                  ? "Filing fees held in IOLTA until case is filed + 48 hrs, then released to operating"
                  : form.payment_type === "retainer" || client.case_type === "hourly"
                    ? "Retainers and hourly funds held in IOLTA trust account"
                    : "Attorney fees deposited to operating account"}
              </p>
            </div>
          </div>

          <div>
            <label className={lbl}>Recorded By</label>
            <input value={form.recorded_by} onChange={e => setForm(f => ({ ...f, recorded_by: e.target.value }))} placeholder="Staff name" className={inp} />
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional note…" className={inp + " resize-none"} />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button onClick={save} disabled={saving || !form.amount} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-900 font-bold px-5 py-2 rounded-xl text-sm transition-all">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />} Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Threshold Modal ──────────────────────────────────────────────────────────

function ThresholdModal({ client, feeStructure, onClose, onSaved }: {
  client: AClient;
  feeStructure: FeeStructure;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode]         = useState<"edit" | "bypass">("edit");
  const [threshold, setThreshold] = useState(String(feeStructure.bifurcated_signing_threshold));
  const [reason, setReason]     = useState("");
  const [bypassedBy, setBypassedBy] = useState("");
  const [saving, setSaving]     = useState(false);
  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-300";
  const lbl = "text-xs font-semibold text-slate-600 mb-1.5 block";

  async function save() {
    setSaving(true);
    const payload = mode === "bypass"
      ? { threshold_bypassed: true, threshold_bypass_reason: reason || null, threshold_bypassed_by: bypassedBy || null }
      : { bifurcated_signing_threshold: parseFloat(threshold) || 338, threshold_bypassed: false };
    await api.patch("accounting_fee_structures", feeStructure.id, payload);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Signing Threshold</h3>
            <p className="text-xs text-slate-500 mt-0.5">{client.full_name} — Bifurcated Ch. 7</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex rounded-xl overflow-hidden border border-slate-200">
            <button onClick={() => setMode("edit")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition-all ${mode === "edit" ? "bg-slate-200 text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              <Edit2 className="w-3.5 h-3.5" /> Modify Threshold
            </button>
            <button onClick={() => setMode("bypass")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition-all ${mode === "bypass" ? "bg-amber-100 text-amber-700" : "text-slate-500 hover:text-slate-700"}`}>
              <Unlock className="w-3.5 h-3.5" /> Bypass Threshold
            </button>
          </div>
          {mode === "edit" ? (
            <div>
              <label className={lbl}>Minimum Payment to Schedule Signing</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <input value={threshold} onChange={e => setThreshold(e.target.value)} className={inp + " pl-7"} placeholder="400" />
              </div>
              <p className="text-[11px] text-slate-600 mt-1.5">Default is $400. Client must have this amount paid before scheduling.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/25 rounded-xl px-3 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">Bypassing allows the client to schedule their signing appointment immediately regardless of payment amount.</p>
              </div>
              <div>
                <label className={lbl}>Bypassed By</label>
                <input value={bypassedBy} onChange={e => setBypassedBy(e.target.value)} placeholder="Staff name" className={inp} />
              </div>
              <div>
                <label className={lbl}>Reason</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Reason for bypass…" className={inp + " resize-none"} />
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold px-5 py-2 rounded-xl text-sm transition-all">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {mode === "bypass" ? "Bypass Threshold" : "Update Threshold"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Transfer Notification Card ───────────────────────────────────────────────

function TransferNotificationCard({ notification, client, adminUser, trustAccounts, onActioned, onDismiss }: {
  notification: TransferNotification;
  client: AClient | undefined;
  adminUser: string | null;
  trustAccounts: TrustAccount[];
  onActioned: () => void;
  onDismiss: () => void;
}) {
  const [executing, setExecuting] = useState(false);
  const [showAdminReq, setShowAdminReq] = useState(false);
  const [form, setForm] = useState({ processor_confirmation: "", confirmed_at: "" });
  const isReady = new Date() >= new Date(notification.notify_after);
  const lbl = "text-xs font-semibold text-slate-600 mb-1.5 block";
  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-300";
  const fromAcct = trustAccounts.find(a => a.state === notification.state && a.account_type === "iolta");
  const toAcct   = trustAccounts.find(a => a.state === notification.state && a.account_type === "operating");

  async function executeTransfer() {
    if (!adminUser) { setShowAdminReq(true); return; }
    if (!fromAcct || !toAcct) return;
    setExecuting(true);
    const transfer = await api.post("accounting_fund_transfers", {
      from_account_id: fromAcct.id,
      to_account_id: toAcct.id,
      amount: notification.amount,
      transfer_date: new Date().toISOString().slice(0, 10),
      reason: `Filing fee release — Case ${notification.case_number} (filed ${notification.filed_date})`,
      related_client_id: notification.client_id,
      executed_by: adminUser,
      status: "executed",
    });
    if (transfer?.[0]) {
      // Update account balances
      await Promise.all([
        api.patch("accounting_trust_accounts", fromAcct.id, { current_balance: Math.max(0, fromAcct.current_balance - notification.amount), updated_at: new Date().toISOString() }),
        api.patch("accounting_trust_accounts", toAcct.id, { current_balance: toAcct.current_balance + notification.amount, updated_at: new Date().toISOString() }),
      ]);
      await api.patch("accounting_transfer_notifications", notification.id, {
        status: "actioned",
        actioned_by: adminUser,
        actioned_at: new Date().toISOString(),
        transfer_id: transfer[0].id,
      });
    }
    setExecuting(false);
    onActioned();
  }

  async function dismiss() {
    if (!adminUser) { setShowAdminReq(true); return; }
    await api.patch("accounting_transfer_notifications", notification.id, {
      status: "dismissed",
      actioned_by: adminUser,
      actioned_at: new Date().toISOString(),
    });
    onDismiss();
  }

  return (
    <div className={`rounded-2xl border overflow-hidden ${isReady ? "border-amber-500/30 bg-amber-500/5" : "border-slate-200 bg-white"}`}>
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isReady ? "bg-amber-100" : "bg-slate-100"}`}>
            {isReady ? <Bell className="w-4 h-4 text-amber-700" /> : <Clock className="w-4 h-4 text-slate-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-bold ${isReady ? "text-amber-700" : "text-slate-900"}`}>
                {isReady ? "Filing Fee Ready to Transfer" : "Filing Fee Transfer Pending"}
              </p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isReady ? "text-amber-700 bg-amber-50 border-amber-500/25" : "text-slate-500 bg-slate-200/30 border-slate-200"}`}>
                {notification.state}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              {client && <span className="text-xs text-slate-600">{client.full_name}</span>}
              <span className="text-slate-700 text-[10px]">·</span>
              <span className="text-xs text-slate-500">Case {notification.case_number}</span>
              <span className="text-slate-700 text-[10px]">·</span>
              <span className="text-xs text-slate-500">Filed {fmtDate(notification.filed_date)}</span>
            </div>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Landmark className="w-3 h-3 text-amber-700" />
                <span className="text-[11px] text-amber-700">IOLTA → </span>
                <Building className="w-3 h-3 text-emerald-700" />
                <span className="text-[11px] text-emerald-700">Operating</span>
                <span className="text-[11px] font-bold text-slate-900 ml-1">{fmt(notification.amount)}</span>
              </div>
              {!isReady && (
                <span className="text-[10px] text-slate-500">Available {fmtDateTime(notification.notify_after)}</span>
              )}
            </div>
          </div>
          {isReady && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={dismiss}
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={executeTransfer}
                disabled={executing}
                className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition-all"
              >
                {executing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowLeftRight className="w-3 h-3" />}
                {adminUser ? "Execute Transfer" : "Transfer (Admin)"}
              </button>
            </div>
          )}
        </div>
        {!adminUser && isReady && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Processor Confirmation #</label>
                <input value={form.processor_confirmation} onChange={e => setForm(f => ({ ...f, processor_confirmation: e.target.value }))} placeholder="e.g. TXN-123456" className={inp} />
              </div>
              <div>
                <label className={lbl}>Confirmation Date/Time</label>
                <input type="datetime-local" value={form.confirmed_at} onChange={e => setForm(f => ({ ...f, confirmed_at: e.target.value }))} className={inp} />
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
              <Shield className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
              <p className="text-[11px] text-slate-600">Accounting admin authentication required to execute transfers.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Accounts View ────────────────────────────────────────────────────────────

function AccountsView({ trustAccounts, transfers, notifications, clients, feeStructures, scheduleEntries, payments, adminUser, onRequestAdmin, onRefresh }: {
  trustAccounts: TrustAccount[];
  transfers: FundTransfer[];
  notifications: TransferNotification[];
  clients: AClient[];
  feeStructures: FeeStructure[];
  scheduleEntries: ScheduleEntry[];
  payments: Payment[];
  adminUser: string | null;
  onRequestAdmin: () => void;
  onRefresh: () => void;
}) {
  const pendingNotifs = notifications.filter(n => n.status === "pending");
  const [activeState, setActiveState] = useState<typeof ACTIVE_STATES[number]>(ACTIVE_STATES[0]);
  const [sendingCff, setSendingCff] = useState<string | null>(null);

  async function markCffLinkSent(fsId: string) {
    setSendingCff(fsId);
    await api.patch("accounting_fee_structures", fsId, {
      cff_payment_link_sent: true,
      cff_payment_link_sent_at: new Date().toISOString(),
    });
    setSendingCff(null);
    onRefresh();
  }

  async function markApprovedForSigning(fsId: string) {
    await api.patch("accounting_fee_structures", fsId, { approved_for_signing: true });
    onRefresh();
  }

  // Determine CFF workflow stage for a client
  function cffStage(fs: FeeStructure): "awaiting_approval" | "send_link" | "awaiting_payment" | "paid_schedule" {
    if (fs.cff_paid) return "paid_schedule";
    if (fs.cff_payment_link_sent) return "awaiting_payment";
    if (fs.approved_for_signing) return "send_link";
    return "awaiting_approval";
  }

  const operating = trustAccounts.find(a => a.state === activeState && a.account_type === "operating");
  const iolta     = trustAccounts.find(a => a.state === activeState && a.account_type === "iolta");
  const stateClients = clients.filter(c => c.state === activeState && (c.status === "active" || c.status === "filed"));
  const stateTransfers = transfers.filter(t =>
    (operating && (t.from_account_id === operating.id || t.to_account_id === operating.id)) ||
    (iolta && (t.from_account_id === iolta.id || t.to_account_id === iolta.id))
  ).slice(0, 8);

  // Aggregate scheduled vs collected for each client in this state
  function clientScheduleSummary(c: AClient) {
    const fs     = feeStructures.find(f => f.client_id === c.id);
    const sched  = scheduleEntries.filter(s => s.client_id === c.id);
    const paid   = payments.filter(p => p.client_id === c.id && !p.voided).reduce((s, p) => s + p.amount, 0);
    const total  = fs?.total_fee ?? 0;
    const balance = Math.max(0, total - paid);
    const nextDue = sched.filter(s => s.status === "pending").sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ?? null;
    const overdue = sched.filter(s => s.status === "late").length;
    return { fs, paid, total, balance, nextDue, overdue };
  }

  const CFF_STAGE_CONFIG = {
    awaiting_approval: { label: "Awaiting Approval", color: "bg-slate-200/60 text-slate-600 border-slate-200", dot: "bg-slate-300" },
    send_link:         { label: "Send CFF Link",      color: "bg-sky-100 text-sky-700 border-sky-500/25",   dot: "bg-sky-500" },
    awaiting_payment:  { label: "CFF Link Sent",       color: "bg-amber-100 text-amber-700 border-amber-400/25", dot: "bg-amber-400 animate-pulse" },
    paid_schedule:     { label: "CFF Paid",            color: "bg-emerald-100 text-emerald-700 border-emerald-500/25", dot: "bg-emerald-500" },
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">

      {/* Transfer alert bar */}
      {pendingNotifs.length > 0 && (
        <div className="flex-shrink-0 bg-amber-50 border-b border-amber-400/20 px-4 sm:px-6 py-2 flex items-center gap-3">
          <Bell className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 animate-pulse" />
          <p className="text-xs font-bold text-amber-700">{pendingNotifs.length} filing fee transfer alert{pendingNotifs.length !== 1 ? "s" : ""} pending</p>
          <div className="flex gap-2 flex-wrap">
            {pendingNotifs.map(n => (
              <TransferNotificationCard
                key={n.id}
                notification={n}
                client={clients.find(c => c.id === n.client_id)}
                adminUser={adminUser}
                trustAccounts={trustAccounts}
                onActioned={onRefresh}
                onDismiss={onRefresh}
              />
            ))}
          </div>
        </div>
      )}

      {/* State selector tabs */}
      <div className="flex-shrink-0 border-b border-slate-200 bg-white/80 px-4 sm:px-6 flex items-center gap-1">
        {ACTIVE_STATES.map(st => {
          const count = clients.filter(c => c.state === st && (c.status === "active" || c.status === "filed")).length;
          return (
            <button key={st} onClick={() => setActiveState(st)}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all -mb-px flex-shrink-0 ${
                activeState === st ? "border-amber-400 text-amber-700" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>
              {st}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeState === st ? "bg-amber-400/20 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{count}</span>
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Operating
          <span className="w-2 h-2 rounded-full bg-amber-400 ml-2" /> IOLTA
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-6 py-5 space-y-6">

          {/* Account balance cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Operating */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Building className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-700">Operating Account</p>
                  <p className="text-[10px] text-slate-600">{operating?.bank_name ?? "—"} · ···{operating?.account_number_last4 ?? "0000"}</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 tracking-tight">{fmt(operating?.current_balance ?? 0)}</p>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                Attorney fees (Ch. 7 regular & bifurcated). CFF transferred here 48 hrs after filing.
              </p>
            </div>

            {/* IOLTA */}
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Landmark className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-700">IOLTA Trust Account</p>
                  <p className="text-[10px] text-slate-600">{iolta?.bank_name ?? "—"} · ···{iolta?.account_number_last4 ?? "0000"}</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 tracking-tight">{fmt(iolta?.current_balance ?? 0)}</p>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                CFF (pre-filing), retainers, hourly Ch. 13 client funds. Released 48 hrs post-filing.
              </p>
            </div>
          </div>

          {/* Client payment schedules */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Active Client Payment Schedules — {activeState}</p>
              <span className="text-[10px] text-slate-600">{stateClients.length} client{stateClients.length !== 1 ? "s" : ""}</span>
            </div>

            {stateClients.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center">
                <Users className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-600">No active clients in {activeState}.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-white/80 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Client</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Type</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Total Fee</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Down Pmt</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Collected</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Balance</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Next Due</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">CFF Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {stateClients.map(c => {
                      const { fs, paid, total, balance, nextDue, overdue } = clientScheduleSummary(c);
                      const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
                      const stage = fs ? cffStage(fs) : "awaiting_approval";
                      const stageCfg = CFF_STAGE_CONFIG[stage];

                      return (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{c.full_name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${c.chapter === 7 ? "bg-sky-50 text-sky-700 border-sky-500/20" : "bg-amber-50 text-amber-700 border-amber-400/20"}`}>
                                Ch. {c.chapter}
                              </span>
                              {overdue > 0 && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-rose-100 text-rose-700 border-red-500/25 flex items-center gap-1">
                                  <AlertTriangle className="w-2.5 h-2.5" /> {overdue} late
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-slate-600">{CASE_TYPE_LABELS[c.case_type]}</td>
                          <td className="px-3 py-3 text-right">
                            <p className="text-slate-900 font-semibold">{fmt(total)}</p>
                            {fs?.plan_months ? <p className="text-[10px] text-slate-600">{fs.plan_months}-mo plan</p> : null}
                          </td>
                          <td className="px-3 py-3 text-right">
                            {fs?.down_payment ? (
                              <span className="text-emerald-700 font-semibold">{fmt(fs.down_payment)}</span>
                            ) : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <p className="text-slate-900 font-semibold">{fmt(paid)}</p>
                            <div className="mt-1 w-16 ml-auto bg-slate-200/50 rounded-full h-1">
                              <div className="h-1 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className={`font-semibold ${balance > 0 ? "text-slate-900" : "text-emerald-700"}`}>
                              {balance > 0 ? fmt(balance) : "Paid"}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {nextDue ? (
                              <div>
                                <p className="text-slate-900 font-semibold">{fmt(nextDue.amount_due)}</p>
                                <p className="text-[10px] text-slate-600">{nextDue.due_date}</p>
                              </div>
                            ) : (
                              <span className="text-slate-600 text-[10px]">
                                {balance === 0 ? "All paid" : "No schedule"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-1.5">
                              {c.status === "filed" ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border w-fit bg-emerald-50 text-emerald-700 border-emerald-500/20">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Case Filed {c.filed_date ? `· ${fmtDate(c.filed_date)}` : ""}
                                </span>
                              ) : (
                              <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border w-fit ${stageCfg.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${stageCfg.dot}`} />
                                {stageCfg.label}
                              </span>
                              )}
                              {c.status !== "filed" && stage === "send_link" && fs && (
                                <button
                                  onClick={() => markCffLinkSent(fs.id)}
                                  disabled={sendingCff === fs.id}
                                  className="flex items-center gap-1 text-[9px] font-bold text-sky-700 hover:text-sky-300 bg-sky-50 hover:bg-sky-100 border border-sky-500/20 px-2 py-1 rounded-lg transition-all disabled:opacity-50"
                                >
                                  {sendingCff === fs.id ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <SendHorizonal className="w-2.5 h-2.5" />}
                                  Send CFF Link
                                </button>
                              )}
                              {c.status !== "filed" && stage === "awaiting_approval" && fs && (() => {
                                const isBifurcated = c.case_type === "bifurcated";
                                const bifThreshold = fs.bifurcated_signing_threshold ?? 338;
                                const cffRequired = !isBifurcated && !fs.cff_paid;
                                const bifThresholdMet = !isBifurcated || fs.threshold_bypassed || paid >= bifThreshold;
                                const canApprove = !cffRequired && bifThresholdMet;
                                return canApprove ? (
                                  <button
                                    onClick={() => markApprovedForSigning(fs.id)}
                                    className="flex items-center gap-1 text-[9px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-1 rounded-lg transition-all"
                                  >
                                    <CheckCircle2 className="w-2.5 h-2.5" /> Approve
                                  </button>
                                ) : (
                                  <span className="flex items-center gap-1 text-[9px] font-bold text-rose-700/70 bg-red-500/5 border border-red-500/15 px-2 py-1 rounded-lg cursor-not-allowed" title={cffRequired ? "Court filing fee must be paid before approval" : `$${bifThreshold} threshold not yet met`}>
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    {cffRequired ? "CFF Required" : `Need ${fmt(bifThreshold - paid)} more`}
                                  </span>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent transfers */}
          {stateTransfers.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Recent Transfers — {activeState}</p>
              <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-800/40 overflow-hidden">
                {stateTransfers.map(t => {
                  const fromOp = operating && t.from_account_id === operating.id;
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3 text-xs hover:bg-slate-50 transition-colors">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${fromOp ? "bg-rose-50" : "bg-emerald-50"}`}>
                        <ArrowLeftRight className={`w-3 h-3 ${fromOp ? "text-rose-700" : "text-emerald-700"}`} />
                      </div>
                      <span className={`font-bold flex-shrink-0 ${fromOp ? "text-rose-700" : "text-emerald-700"}`}>{fromOp ? "−" : "+"}{fmt(t.amount)}</span>
                      <span className="text-slate-600 truncate flex-1">{t.reason}</span>
                      <span className="text-slate-600 flex-shrink-0 text-[10px]">{fmtDate(t.transfer_date)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CFF workflow explainer */}
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Court Filing Fee Workflow</p>
            <div className="flex items-start gap-3 flex-wrap">
              {[
                { step: "1", label: "Attorney Approval", desc: "Attorney approves client to schedule signing", color: "text-slate-600", bg: "bg-slate-100" },
                { step: "2", label: "CFF Link Sent",     desc: "Payment link sent to client for court filing fee", color: "text-sky-700",    bg: "bg-sky-50" },
                { step: "3", label: "CFF Collected",     desc: "Client pays CFF — deposited to IOLTA trust", color: "text-amber-700",  bg: "bg-amber-50" },
                { step: "4", label: "Signing Scheduled", desc: "Client books appointment after CFF confirmed", color: "text-emerald-700", bg: "bg-emerald-50" },
                { step: "5", label: "IOLTA → Operating", desc: "CFF transferred from IOLTA to operating 48 hrs after filing", color: "text-slate-700", bg: "bg-slate-100" },
              ].map((s, i, arr) => (
                <div key={s.step} className="flex items-center gap-2">
                  <div className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border border-slate-200 ${s.bg} min-w-[120px]`}>
                    <span className={`text-[10px] font-bold ${s.color}`}>Step {s.step}</span>
                    <p className={`text-xs font-bold ${s.color}`}>{s.label}</p>
                    <p className="text-[10px] text-slate-600 text-center leading-snug">{s.desc}</p>
                  </div>
                  {i < arr.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>

          {/* Account routing rules */}
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Account Routing Rules</p>
            <div className="space-y-2">
              {[
                { label: "Ch. 7 Regular — Attorney Fee (incl. down payment + installments)", dest: "Operating", color: "text-emerald-700", note: "Deposited immediately upon receipt" },
                { label: "Ch. 7 Regular — Court Filing Fee",  dest: "IOLTA",    color: "text-amber-700", note: "Held until case filed + 48 hrs, then admin transfers to operating" },
                { label: "Ch. 7 Bifurcated — Attorney Fee",   dest: "Operating", color: "text-emerald-700", note: "Deposited to operating as received" },
                { label: "Ch. 7 Bifurcated — Filing Fee",     dest: "IOLTA",    color: "text-amber-700", note: "Held in IOLTA — same 48hr release rule applies" },
                { label: "Ch. 13 Flat Fee — Upfront",          dest: "Operating", color: "text-emerald-700", note: "Attorney fee portion to operating" },
                { label: "Ch. 13 Flat Fee — Filing Fee",       dest: "IOLTA",    color: "text-amber-700", note: "Held in IOLTA until filed + 48 hrs" },
                { label: "Ch. 13 Hourly — Retainer",           dest: "IOLTA",    color: "text-amber-700", note: "Held in trust; earned fees transferred as billed" },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-3 py-1.5 border-b border-slate-200 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-200 flex-shrink-0" />
                  <span className="text-xs text-slate-700 flex-1">{r.label}</span>
                  <span className={`text-xs font-bold flex-shrink-0 ${r.color}`}>{r.dest}</span>
                  <span className="text-[10px] text-slate-600 hidden sm:block w-64 text-right">{r.note}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Client Detail Panel ──────────────────────────────────────────────────────

function ClientDetail({ client, payments, feeStructure, schedule, enrollment, retries, merchantAccounts, timeLog, additionalMatters, staffList, adminUser, onRefresh }: {
  client: AClient;
  payments: Payment[];
  feeStructure: FeeStructure | null;
  schedule: ScheduleEntry[];
  enrollment: AutopayEnrollment | undefined;
  retries: PaymentRetry[];
  merchantAccounts: MerchantAccount[];
  timeLog: TimeLogEntry[];
  additionalMatters: AdditionalMatter[];
  staffList: { id: string; name: string; role: string; hourly_rate: number | null }[];
  adminUser: string | null;
  onRefresh: () => void;
}) {
  const [tab, setTab]               = useState<ClientTab>("overview");
  const [showPayModal, setShowPayModal]   = useState(false);
  const [showThreshModal, setShowThreshModal] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [adjustPayment, setAdjustPayment] = useState<Payment | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showScheduleAdjust, setShowScheduleAdjust] = useState(false);

  // Auto-log file open when component mounts
  useEffect(() => {
    api.post("case_time_log", {
      client_id:     client.id,
      staff_name:    adminUser?.replace(/\*+$/, "") ?? "Staff",
      activity_type: "file_open",
      duration_minutes: 0,
      billable:      false,
      notes:         `File opened.`,
      started_at:    new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  const clientPayments = payments.filter(p => p.client_id === client.id && !p.voided);
  const totalPaid    = clientPayments.reduce((s, p) => s + p.amount, 0);
  const ioltaHeld    = clientPayments.filter(p => p.destination_account === "iolta").reduce((s, p) => s + p.amount, 0);
  const operatingHeld = clientPayments.filter(p => p.destination_account === "operating").reduce((s, p) => s + p.amount, 0);
  const ioltaBalance = feeStructure?.iolta_balance ?? 0;
  const totalFee     = feeStructure?.total_fee ?? 0;
  const balance      = totalFee - totalPaid;
  const threshold    = feeStructure?.bifurcated_signing_threshold ?? 338;
  const thresholdMet = feeStructure?.threshold_bypassed || totalPaid >= threshold;
  const pct          = totalFee > 0 ? Math.min(100, (totalPaid / totalFee) * 100) : 0;
  const isActiveState = (ACTIVE_STATES as readonly string[]).includes(client.state ?? "");

  const activeRetryCount = retries.filter(r => r.status === "retrying").length;

  const TABS: { id: ClientTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "payments", label: `Payments (${clientPayments.length})` },
    { id: "schedule", label: `Schedule (${schedule.length})` },
    { id: "autopay",  label: `Autopay${activeRetryCount > 0 ? ` (${activeRetryCount} declined)` : ""}` },
    { id: "timelog",  label: `Time Log (${timeLog.length})` },
    { id: "matters",  label: `Matters${additionalMatters.length > 0 ? ` (${additionalMatters.length})` : ""}` },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 pt-6 pb-4 border-b border-slate-200">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">{client.full_name}</h2>
              {statusBadge(client.status)}
            </div>
            {(client.phone || client.email) && (
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {client.phone && (
                  <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors">
                    <svg className="w-3 h-3 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                    {client.phone}
                  </a>
                )}
                {client.phone && client.email && <span className="text-slate-700">·</span>}
                {client.email && (
                  <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors">
                    <svg className="w-3 h-3 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    {client.email}
                  </a>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${client.chapter === 7 ? "text-sky-700 bg-sky-50 border-sky-500/25" : "text-amber-700 bg-amber-50 border-amber-500/25"}`}>{CASE_TYPE_LABELS[client.case_type]}</span>
              {client.state && <><span className="text-slate-700">·</span><span className="text-xs text-slate-500">{client.state}{isActiveState ? " ✓" : ""}</span></>}
              {client.case_number && <><span className="text-slate-700">·</span><span className="text-xs text-slate-600 font-mono">{client.case_number}</span></>}
              {client.intake_date && <><span className="text-slate-700">·</span><span className="text-xs text-slate-500">Intake: {fmtDate(client.intake_date)}</span></>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowSummary(true)} className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] bg-[var(--bg-surface-2)] hover:bg-[var(--bg-surface-3)] border border-[var(--border)] font-bold text-xs px-3 py-2 rounded-xl transition-all">
              <ClipboardList className="w-3.5 h-3.5" /> Summary
            </button>
            <button onClick={() => setShowPayModal(true)} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-xs px-4 py-2 rounded-xl transition-all">
              <Plus className="w-3.5 h-3.5" /> Record Payment
            </button>
          </div>
        </div>

        {totalFee > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-slate-500">Total Collected</span>
              <span className="text-[11px] text-slate-600">{fmt(totalPaid)} / {fmt(totalFee)}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {/* Account routing breakdown */}
        {(operatingHeld > 0 || ioltaHeld > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-3 py-2.5">
              <Building className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500">Operating{isActiveState && client.state ? ` (${client.state})` : ""}</p>
                <p className="text-sm font-bold text-emerald-700">{fmt(operatingHeld)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-2.5">
              <Landmark className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500">IOLTA{isActiveState && client.state ? ` (${client.state})` : ""}</p>
                <p className="text-sm font-bold text-amber-700">{fmt(ioltaHeld)}</p>
              </div>
            </div>
          </div>
        )}

        {client.case_type === "bifurcated" && (
          <div className={`mt-3 flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 border ${thresholdMet ? "bg-emerald-50 border-emerald-500/20" : "bg-amber-500/8 border-amber-500/20"}`}>
            <div className="flex items-center gap-2">
              {thresholdMet ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" /> : <Clock className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />}
              <div>
                <p className={`text-xs font-bold ${thresholdMet ? "text-emerald-700" : "text-amber-700"}`}>
                  {feeStructure?.threshold_bypassed ? "Threshold Bypassed" : thresholdMet ? "Signing Threshold Met" : `Signing Threshold: ${fmt(threshold)} required`}
                </p>
                {!feeStructure?.threshold_bypassed && (
                  <p className="text-[10px] text-slate-500 mt-0.5">{fmt(totalPaid)} paid · {fmt(Math.max(0, threshold - totalPaid))} remaining</p>
                )}
                {feeStructure?.threshold_bypass_reason && <p className="text-[10px] text-slate-500 mt-0.5 italic">{feeStructure.threshold_bypass_reason}</p>}
              </div>
            </div>
            <button onClick={() => setShowThreshModal(true)} className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-all flex-shrink-0">
              <Edit2 className="w-3 h-3" /> Modify
            </button>
          </div>
        )}

        {client.case_type === "hourly" && (
          <div className="mt-3 flex items-center gap-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3.5 py-2.5">
            <Landmark className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-700">IOLTA Trust Balance: {fmt(ioltaBalance)}</p>
              {feeStructure?.hourly_rate && <p className="text-[10px] text-slate-500 mt-0.5">Rate: {fmt(feeStructure.hourly_rate)}/hr</p>}
            </div>
          </div>
        )}

        {client.case_type === "flat_fee" && feeStructure?.ch13_upfront_amount && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Upfront Required</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{fmt(feeStructure.ch13_upfront_amount)}</p>
            </div>
            <div className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Through Plan</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{fmt(feeStructure.ch13_plan_remainder ?? 0)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex border-b border-slate-200 px-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`py-3 px-1 mr-5 text-xs font-semibold border-b-2 transition-all -mb-px ${tab === t.id ? "border-amber-400 text-amber-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-6 py-4 space-y-4">
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Attorney Fee",       val: fmt(feeStructure?.attorney_fee ?? 0) },
                { label: "Court Filing Fee",   val: fmt(feeStructure?.court_filing_fee ?? 0) },
                { label: "Total Fee",          val: fmt(totalFee), highlight: true },
                { label: "Total Paid",         val: fmt(totalPaid), color: "text-emerald-700" },
                { label: "Balance Due",        val: fmt(Math.max(0, balance)), color: balance > 0 ? "text-rose-700" : "text-emerald-700" },
                { label: "Payment Frequency",  val: FREQ_LABELS[feeStructure?.payment_frequency ?? ""] ?? "—" },
              ].map(item => (
                <div key={item.label} className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{item.label}</p>
                  <p className={`text-sm font-bold mt-0.5 ${item.color ?? "text-slate-900"}`}>{item.val}</p>
                </div>
              ))}
            </div>
            {/* Filing Readiness Gate */}
            {client.status === "active" && feeStructure && (() => {
              const isBifurcated = client.case_type === "bifurcated";
              const bifThreshold = feeStructure.bifurcated_signing_threshold ?? 338;
              const cffPaid = feeStructure.cff_paid;
              const approvedForSigning = feeStructure.approved_for_signing;
              const bifThresholdMet = feeStructure.threshold_bypassed || totalPaid >= bifThreshold;

              // Determine gates
              const gates: { met: boolean; label: string; detail: string }[] = [];

              if (!isBifurcated) {
                gates.push({
                  met: cffPaid,
                  label: "Court Filing Fee Paid",
                  detail: cffPaid
                    ? `${fmt(feeStructure.court_filing_fee)} collected in IOLTA`
                    : `${fmt(feeStructure.court_filing_fee)} required before case can be filed`,
                });
              }

              if (isBifurcated) {
                gates.push({
                  met: bifThresholdMet,
                  label: `Signing Threshold (${fmt(bifThreshold)})`,
                  detail: bifThresholdMet
                    ? `${fmt(totalPaid)} paid — threshold met`
                    : `${fmt(totalPaid)} paid · ${fmt(bifThreshold - totalPaid)} remaining`,
                });
              }

              gates.push({
                met: approvedForSigning,
                label: "Approved for Signing",
                detail: approvedForSigning ? "Attorney approved" : "Pending attorney approval",
              });

              const allMet = gates.every(g => g.met);

              return (
                <div className={`rounded-xl border px-4 py-3 ${allMet ? "bg-emerald-500/5 border-emerald-500/20" : "bg-slate-50 border-slate-200"}`}>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                    <Shield className="w-3 h-3" /> Filing Readiness
                  </p>
                  <div className="space-y-1.5">
                    {gates.map(g => (
                      <div key={g.label} className="flex items-center gap-2.5">
                        {g.met
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                          : <Clock className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs font-semibold ${g.met ? "text-emerald-700" : "text-slate-700"}`}>{g.label}</span>
                          <span className="text-[10px] text-slate-500 ml-2">{g.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {allMet && (
                    <p className="text-[10px] text-emerald-700 font-semibold mt-2.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Ready to file
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Case closed / cancelled summary */}
            {(client.extended_status === "case_closed" || client.extended_status === "cancelled") && (
              <div className={`rounded-xl border px-4 py-3.5 space-y-2 ${
                client.extended_status === "case_closed"
                  ? "bg-slate-50 border-slate-200"
                  : "bg-red-500/5 border-red-500/20"
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {client.extended_status === "case_closed"
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
                    : <Ban className="w-3.5 h-3.5 text-rose-700" />}
                  <p className={`text-xs font-bold ${client.extended_status === "case_closed" ? "text-slate-700" : "text-rose-700"}`}>
                    {client.extended_status === "case_closed" ? "Case Closed — Disposition" : "Cancelled"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {client.filed_date && (
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Filed</p>
                      <p className="text-slate-900 font-semibold">{fmtDate(client.filed_date)}</p>
                    </div>
                  )}
                  {client.case_closed_date && (
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Closed</p>
                      <p className="text-slate-900 font-semibold">{fmtDate(client.case_closed_date)}</p>
                    </div>
                  )}
                  {client.discharge_date && (
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Discharge</p>
                      <p className="text-emerald-700 font-semibold">{fmtDate(client.discharge_date)}</p>
                    </div>
                  )}
                  {client.case_closed_reason && (
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Reason</p>
                      <p className={`font-semibold capitalize ${
                        client.case_closed_reason === "discharged" ? "text-emerald-700" :
                        client.case_closed_reason === "dismissed"  ? "text-rose-700" :
                        "text-slate-700"
                      }`}>{client.case_closed_reason.replace(/_/g, " ")}</p>
                    </div>
                  )}
                </div>
                {client.case_closed_notes && (
                  <p className="text-[11px] text-slate-600 leading-relaxed border-t border-slate-200 pt-2 mt-1">{client.case_closed_notes}</p>
                )}
              </div>
            )}

            {/* On hold / inactive context */}
            {client.extended_status === "on_hold" && client.notes && (
              <div className="flex items-start gap-2 bg-amber-400/5 border border-amber-400/20 rounded-xl px-3.5 py-3">
                <PauseCircle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600">{client.notes}</p>
              </div>
            )}
            {client.extended_status === "inactive" && client.notes && (
              <div className="flex items-start gap-2 bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-3">
                <AlertTriangle className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600">{client.notes}</p>
              </div>
            )}
            {!(client.extended_status === "on_hold" || client.extended_status === "inactive") && client.notes && (
              <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
                <Info className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600">{client.notes}</p>
              </div>
            )}
          </>
        )}

        {tab === "payments" && (
          <div className="space-y-2">
            {clientPayments.length === 0 ? (
              <p className="text-xs text-slate-600 py-4 text-center">No payments recorded yet.</p>
            ) : clientPayments.slice().reverse().map(p => (
              <div key={p.id} className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border group ${
                p.voided ? "opacity-40 bg-slate-50 border-slate-200 line-through" :
                p.destination_account === "iolta" ? "bg-amber-500/5 border-amber-500/20" : "bg-emerald-500/5 border-emerald-500/15"
              }`}>
                <div className="w-7 h-7 rounded-lg bg-slate-200/60 flex items-center justify-center flex-shrink-0 text-slate-600">
                  {METHOD_ICONS[p.payment_method] ?? <DollarSign className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">{fmt(p.amount)}</span>
                    <span className="text-[10px] font-semibold text-slate-600 capitalize">{p.payment_type.replace(/_/g, " ")}</span>
                    {destBadge(p.destination_account)}
                    {p.voided && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-rose-50 text-rose-700 border-red-500/20">Voided</span>}
                    {p.account_state && (ACTIVE_STATES as readonly string[]).includes(p.account_state) && (
                      <span className="text-[10px] text-slate-600">{p.account_state}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-slate-600">{fmtDate(p.payment_date)}</span>
                    <span className="text-[10px] text-slate-700">·</span>
                    <span className="text-[10px] text-slate-600 capitalize">{p.payment_method.replace("_", " ")}</span>
                    {p.notes && <><span className="text-[10px] text-slate-700">·</span><span className="text-[10px] text-slate-500 italic truncate max-w-[140px]">{p.notes}</span></>}
                  </div>
                </div>
                {!p.voided && (
                  <button
                    onClick={() => setAdjustPayment(p)}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-slate-200/60 hover:bg-amber-100 text-slate-500 hover:text-amber-700 flex items-center justify-center transition-all flex-shrink-0"
                    title="Adjust payment"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "schedule" && (
          <div className="space-y-2">
            {/* Header row with Adjust Schedule button */}
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] text-[var(--text-muted)]">
                {schedule.filter(s => s.status === "paid" || s.status === "waived").length} paid ·{" "}
                {schedule.filter(s => s.status !== "paid" && s.status !== "waived").length} pending ·{" "}
                {feeStructure?.payment_frequency ? <span className="font-semibold text-amber-700">{FREQ_LABELS[feeStructure.payment_frequency]}</span> : "—"}
              </div>
              <button
                onClick={() => setShowScheduleAdjust(true)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 hover:text-amber-700 border border-amber-500/25 hover:border-amber-400/40 bg-amber-500/8 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-all">
                <Pencil className="w-3 h-3" /> Adjust Schedule
              </button>
            </div>

            {schedule.length === 0 ? (
              <p className="text-xs text-slate-600 py-4 text-center">No payment schedule set up. Click "Adjust Schedule" to create one.</p>
            ) : schedule.map(s => (
              <div key={s.id} className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border ${
                s.status === "paid" ? "bg-emerald-500/5 border-emerald-500/20" :
                s.status === "late" ? "bg-red-500/5 border-red-500/20" :
                s.status === "partial" ? "bg-amber-500/5 border-amber-500/20" :
                "bg-slate-50 border-slate-200"
              }`}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-600">#{s.installment_number}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{fmt(s.amount_due)}</span>
                    {s.amount_paid > 0 && s.amount_paid < s.amount_due && <span className="text-[10px] text-amber-700">{fmt(s.amount_paid)} paid</span>}
                  </div>
                  <span className="text-[10px] text-slate-600">Due {fmtDate(s.due_date)}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${
                  s.status === "paid"    ? "text-emerald-700 bg-emerald-50 border-emerald-500/25" :
                  s.status === "late"    ? "text-rose-700 bg-rose-50 border-red-500/25" :
                  s.status === "partial" ? "text-amber-700 bg-amber-50 border-amber-500/25" :
                  s.status === "waived"  ? "text-slate-500 bg-slate-200/30 border-slate-200" :
                                           "text-slate-600 bg-slate-200/30 border-slate-200"
                }`}>{s.status}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "autopay" && (
          <AutopayPanel
            client={client}
            enrollment={enrollment}
            retries={retries}
            merchantAccounts={merchantAccounts}
            onRefresh={onRefresh}
          />
        )}

        {tab === "timelog" && (
          <CaseTimeLogPanel
            client={client}
            entries={timeLog}
            adminUser={adminUser}
            staffList={staffList}
            onRefresh={onRefresh}
          />
        )}

        {tab === "matters" && (
          <AdditionalMattersPanel
            client={client}
            matters={additionalMatters}
            adminUser={adminUser}
            onRefresh={onRefresh}
          />
        )}
      </div>

      {showPayModal && (
        <RecordPaymentModal client={client} onClose={() => setShowPayModal(false)} onSaved={() => { setShowPayModal(false); onRefresh(); }} />
      )}
      {showThreshModal && feeStructure && (
        <ThresholdModal client={client} feeStructure={feeStructure} onClose={() => setShowThreshModal(false)} onSaved={() => { setShowThreshModal(false); onRefresh(); }} />
      )}
      {showExitPrompt && (
        <FileOpenPrompt
          client={client}
          adminUser={adminUser}
          onDismiss={() => setShowExitPrompt(false)}
          onLogged={() => { setShowExitPrompt(false); onRefresh(); }}
        />
      )}
      {adjustPayment && (
        <AdjustPaymentModal
          payment={adjustPayment}
          client={client}
          adminUser={adminUser}
          role={roleOf(adminUser)}
          feeStructure={feeStructure}
          onClose={() => setAdjustPayment(null)}
          onSaved={() => { setAdjustPayment(null); onRefresh(); }}
        />
      )}
      {showScheduleAdjust && (
        <ScheduleAdjustModal
          client={client}
          feeStructure={feeStructure}
          schedule={schedule}
          adminUser={adminUser}
          onClose={() => setShowScheduleAdjust(false)}
          onSaved={() => { setShowScheduleAdjust(false); onRefresh(); }}
        />
      )}
      {showSummary && (
        <CaseSummaryModal
          client={client}
          feeStructure={feeStructure}
          payments={payments}
          timeLog={timeLog}
          onClose={() => setShowSummary(false)}
          onViewTimelog={() => { setShowSummary(false); setTab("timelog"); }}
        />
      )}
    </div>
  );
}

// ─── Reports View ─────────────────────────────────────────────────────────────

type ReportSection = "overview" | "collection" | "filing" | "nonpaying" | "cancellations" | "daily_report" | "check_deposits";

// ─── Check Deposit Form ───────────────────────────────────────────────────────

function CheckDepositForm({ clients, adminUser, onClose, onSaved }: {
  clients: AClient[];
  adminUser: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [trustee,    setTrustee]    = useState("");
  const [tState,     setTState]     = useState("AZ");
  const [checkNum,   setCheckNum]   = useState("");
  const [checkDate,  setCheckDate]  = useState("");
  const [amount,     setAmount]     = useState("");
  const [dest,       setDest]       = useState<"operating" | "iolta">("iolta");
  const [depDate,    setDepDate]    = useState(new Date().toISOString().slice(0, 10));
  const [depBy,      setDepBy]      = useState(adminUser?.replace(/\*+$/, "") ?? "");
  const [bankName,   setBankName]   = useState("");
  const [confirm,    setConfirm]    = useState("");
  const [payType,    setPayType]    = useState<TrusteeCheckDeposit["payment_type"]>("plan_payment");
  const [clientId,   setClientId]   = useState("");
  const [notes,      setNotes]      = useState("");
  const [status,     setStatus]     = useState<TrusteeCheckDeposit["status"]>("pending_deposit");
  const [saving,     setSaving]     = useState(false);

  // Image upload state
  const [frontImg,   setFrontImg]   = useState<File | null>(null);
  const [backImg,    setBackImg]    = useState<File | null>(null);
  const [slipImg,    setSlipImg]    = useState<File | null>(null);
  const [frontPrev,  setFrontPrev]  = useState<string | null>(null);
  const [backPrev,   setBackPrev]   = useState<string | null>(null);
  const [slipPrev,   setSlipPrev]   = useState<string | null>(null);
  const [uploading,  setUploading]  = useState(false);

  function handleImgChange(file: File | null, setFile: (f: File | null) => void, setPreview: (s: string | null) => void) {
    if (!file) return;
    setFile(file);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadImg(file: File, path: string): Promise<string | null> {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/check-images/${path}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        "Content-Type": file.type,
        "x-upsert": "true",
      },
      body: file,
    });
    if (!res.ok) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/check-images/${path}`;
  }

  async function save() {
    if (!trustee.trim() || !amount) return;
    setSaving(true);
    setUploading(true);
    const id = crypto.randomUUID();
    let frontUrl: string | null = null;
    let backUrl:  string | null = null;
    let slipUrl:  string | null = null;
    if (frontImg) frontUrl = await uploadImg(frontImg, `${id}/front_${frontImg.name}`);
    if (backImg)  backUrl  = await uploadImg(backImg,  `${id}/back_${backImg.name}`);
    if (slipImg)  slipUrl  = await uploadImg(slipImg,  `${id}/slip_${slipImg.name}`);
    setUploading(false);

    const selectedClient = clients.find(c => c.id === clientId);
    await api.post("trustee_check_deposits", {
      id,
      client_id:             clientId || null,
      client_name:           selectedClient?.full_name ?? null,
      trustee_name:          trustee.trim(),
      trustee_state:         tState,
      check_number:          checkNum || null,
      check_date:            checkDate || null,
      amount:                parseFloat(amount),
      destination_account:   dest,
      deposit_date:          depDate || null,
      deposited_by:          depBy || null,
      bank_name:             bankName || null,
      deposit_confirmation:  confirm || null,
      check_image_url:       frontUrl,
      check_image_back_url:  backUrl,
      deposit_slip_url:      slipUrl,
      payment_type:          payType,
      notes:                 notes || null,
      status,
    });
    setSaving(false);
    onSaved();
  }

  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-300";
  const lbl = "text-xs font-semibold text-slate-600 mb-1.5 block";

  function ImgUploadSlot({ label, preview, onChange }: { label: string; preview: string | null; onChange: (f: File) => void }) {
    return (
      <div>
        <p className={lbl}>{label}</p>
        <label className={`flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${preview ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-200 hover:border-slate-300 bg-slate-50"}`}>
          {preview
            ? <img src={preview} alt={label} className="h-full w-full object-cover rounded-xl" />
            : <div className="flex flex-col items-center gap-1 text-slate-500">
                <Receipt className="w-5 h-5" />
                <span className="text-[10px]">Tap to upload</span>
              </div>
          }
          <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) onChange(f); }} />
        </label>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Receipt className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Log Trustee Check Deposit</h3>
            <p className="text-[11px] text-slate-500">Physical checks received from trustees</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-900"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Check photos */}
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Check Photos</p>
            <div className="grid grid-cols-3 gap-3">
              <ImgUploadSlot label="Front of Check" preview={frontPrev}
                onChange={f => handleImgChange(f, setFrontImg, setFrontPrev)} />
              <ImgUploadSlot label="Back of Check" preview={backPrev}
                onChange={f => handleImgChange(f, setBackImg, setBackPrev)} />
              <ImgUploadSlot label="Deposit Slip" preview={slipPrev}
                onChange={f => handleImgChange(f, setSlipImg, setSlipPrev)} />
            </div>
          </div>

          {/* Trustee info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className={lbl}>Trustee Name *</label>
              <input value={trustee} onChange={e => setTrustee(e.target.value)} placeholder="e.g. Dianne Kerns" className={inp} />
            </div>
            <div>
              <label className={lbl}>Trustee State</label>
              <select value={tState} onChange={e => setTState(e.target.value)} className={inp}>
                <option value="AZ">Arizona</option>
                <option value="WA">Washington</option>
                <option value="TX">Texas</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Check details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Check Number</label>
              <input value={checkNum} onChange={e => setCheckNum(e.target.value)} placeholder="e.g. 10045" className={inp} />
            </div>
            <div>
              <label className={lbl}>Check Date</label>
              <input type="date" value={checkDate} onChange={e => setCheckDate(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Amount *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={inp} />
            </div>
            <div>
              <label className={lbl}>Destination Account</label>
              <select value={dest} onChange={e => setDest(e.target.value as typeof dest)} className={inp}>
                <option value="iolta">IOLTA / Trust</option>
                <option value="operating">Operating</option>
              </select>
            </div>
          </div>

          {/* Client link */}
          <div>
            <label className={lbl}>Associated Client (Optional)</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={inp}>
              <option value="">No specific client / batch</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>

          {/* Deposit info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Deposit Date</label>
              <input type="date" value={depDate} onChange={e => setDepDate(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Deposited By</label>
              <input value={depBy} onChange={e => setDepBy(e.target.value)} placeholder="Staff name" className={inp} />
            </div>
            <div>
              <label className={lbl}>Bank Name</label>
              <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Chase Bank" className={inp} />
            </div>
            <div>
              <label className={lbl}>Deposit Confirmation #</label>
              <input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Deposit slip ref" className={inp} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Payment Type</label>
              <select value={payType} onChange={e => setPayType(e.target.value as typeof payType)} className={inp}>
                <option value="plan_payment">Plan Payment</option>
                <option value="refund">Refund from Trustee</option>
                <option value="disbursement">Disbursement</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className={inp}>
                <option value="pending_deposit">Pending Deposit</option>
                <option value="deposited">Deposited</option>
                <option value="reconciled">Reconciled</option>
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any additional notes…" className={inp + " resize-none"} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button onClick={save} disabled={saving || !trustee.trim() || !amount}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-900 font-bold px-5 py-2 rounded-xl text-sm transition-all">
            <Check className="w-4 h-4" />
            {uploading ? "Uploading…" : saving ? "Saving…" : "Save Deposit"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface TrusteeCheckDeposit {
  id: string;
  client_id: string | null;
  client_name: string | null;
  trustee_name: string;
  trustee_state: string | null;
  check_number: string | null;
  check_date: string | null;
  amount: number;
  destination_account: "operating" | "iolta";
  deposit_date: string | null;
  deposited_by: string | null;
  bank_name: string | null;
  deposit_confirmation: string | null;
  check_image_url: string | null;
  check_image_back_url: string | null;
  deposit_slip_url: string | null;
  payment_type: "plan_payment" | "refund" | "disbursement" | "other";
  notes: string | null;
  linked_payment_id: string | null;
  status: "pending_deposit" | "deposited" | "reconciled" | "returned";
  created_at: string;
}

function ReportsView({ clients, payments, feeStructures, cancelRequests, adminUser }: {
  clients: AClient[];
  payments: Payment[];
  feeStructures: FeeStructure[];
  cancelRequests: CancelRequest[];
  adminUser: string | null;
}) {
  const [section, setSection] = useState<ReportSection>("overview");

  // ── Primary Filters ──
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [fState,      setFState]      = useState("all");
  const [fChapter,    setFChapter]    = useState<"all" | "7" | "13">("all");
  const [fCaseType,   setFCaseType]   = useState("all");
  const [fPayDay,     setFPayDay]     = useState("all"); // filter by payment day of month (1-31 or "all")
  const [fMonth,      setFMonth]      = useState(""); // YYYY-MM for comparison primary
  const [cmpMonth,    setCmpMonth]    = useState(""); // YYYY-MM for comparison baseline
  const [showCompare, setShowCompare] = useState(false);

  // ── Daily report state ──
  const today = new Date().toISOString().slice(0, 10);
  const [dailyDate,     setDailyDate]     = useState(today);
  const [dailyState,    setDailyState]    = useState("all");
  const [dailyDest,     setDailyDest]     = useState<"all" | "operating" | "iolta">("all");

  // ── Check deposits state ──
  const [checkDeposits,      setCheckDeposits]      = useState<TrusteeCheckDeposit[]>([]);
  const [checkDepositsLoaded, setCheckDepositsLoaded] = useState(false);
  const [showCheckForm,       setShowCheckForm]       = useState(false);
  const [checkViewImg,        setCheckViewImg]        = useState<string | null>(null);
  const [checkFilter,         setCheckFilter]         = useState<"all" | "pending_deposit" | "deposited" | "reconciled">("all");

  async function loadCheckDeposits() {
    const data = await api.get("trustee_check_deposits?order=created_at.desc");
    setCheckDeposits(Array.isArray(data) ? data : []);
    setCheckDepositsLoaded(true);
  }

  useEffect(() => {
    if (section === "check_deposits" && !checkDepositsLoaded) {
      loadCheckDeposits();
    }
  }, [section, checkDepositsLoaded]);

  const allStates = Array.from(new Set(clients.map(c => c.state).filter(Boolean) as string[])).sort();

  // Month/year quick-selectors: last 24 months
  const monthOptions = (() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      });
    }
    return opts;
  })();

  // Apply client-level filters
  const filteredClients = clients.filter(c => {
    if (fState    !== "all" && c.state !== fState) return false;
    if (fChapter  !== "all" && String(c.chapter) !== fChapter) return false;
    if (fCaseType !== "all" && c.case_type !== fCaseType) return false;
    if (dateFrom && (c.intake_date ?? "") < dateFrom) return false;
    if (dateTo   && (c.intake_date ?? "") > dateTo)   return false;
    return true;
  });

  const clientIds = new Set(filteredClients.map(c => c.id));

  function matchesPaymentDateFilters(p: Payment): boolean {
    if (!clientIds.has(p.client_id)) return false;
    // Date range filters
    if (dateFrom && p.payment_date < dateFrom) return false;
    if (dateTo   && p.payment_date > dateTo)   return false;
    // Month filter (YYYY-MM)
    if (fMonth && !p.payment_date.startsWith(fMonth)) return false;
    // Day-of-month filter
    if (fPayDay !== "all") {
      const day = new Date(p.payment_date + "T12:00:00").getDate();
      if (String(day) !== fPayDay) return false;
    }
    return true;
  }

  // Payments scoped to filtered clients + optional date range on payment_date
  const filteredPayments = payments.filter(matchesPaymentDateFilters);

  // Comparison period payments (for month-over-month)
  const cmpPayments = cmpMonth
    ? payments.filter(p => clientIds.has(p.client_id) && p.payment_date.startsWith(cmpMonth) && !p.voided)
    : [];

  const activePayments  = filteredPayments.filter(p => !p.voided);
  const voidedPayments  = filteredPayments.filter(p => p.voided);
  const refundPayments  = filteredPayments.filter(p => p.payment_type === "refund");
  const cancelPayments  = filteredPayments.filter(p => p.payment_type === "cancellation" || p.payment_type === "cancel");

  // ── Overview metrics ──
  const totalRevenue   = activePayments.reduce((s, p) => s + p.amount, 0);
  const totalVoided    = voidedPayments.reduce((s, p) => s + p.amount, 0);
  const totalRefunds   = refundPayments.reduce((s, p) => s + p.amount, 0);
  const ioltaTotal     = feeStructures
    .filter(f => clientIds.has(f.client_id))
    .reduce((s, f) => s + (f.iolta_balance ?? 0), 0);

  const collectionRates = filteredClients.map(c => {
    const fs   = feeStructures.find(f => f.client_id === c.id);
    const paid = activePayments.filter(p => p.client_id === c.id).reduce((s, p) => s + p.amount, 0);
    const total = fs?.total_fee ?? 0;
    // Cap rate at 1.0 — overpayments show as 100%
    const rate  = total > 0 ? Math.min(1, paid / total) : 0;
    const pastDue = Math.max(0, total - paid);
    return { client: c, paid, total, rate, pastDue };
  });

  const avgCollectionRate = collectionRates.length > 0
    ? collectionRates.reduce((s, r) => s + r.rate, 0) / collectionRates.length * 100
    : 0;

  // Paying clients: those with at least one payment in the date range
  const payingClientIds = new Set(activePayments.map(p => p.client_id));
  const payingClientsCount = filteredClients.filter(c => payingClientIds.has(c.id)).length;

  // Total past due across filtered clients
  const totalPastDue = collectionRates.reduce((s, r) => s + r.pastDue, 0);

  const avgPayment = activePayments.length > 0
    ? totalRevenue / activePayments.length
    : 0;

  // ── Filing metrics ──
  const retainedClients = filteredClients; // everyone in the system has been retained
  const filedClients    = filteredClients.filter(c => c.status === "filed" || c.status === "closed");
  const filedRate       = retainedClients.length > 0 ? filedClients.length / retainedClients.length * 100 : 0;
  const closedClients   = filteredClients.filter(c => c.status === "closed");
  const onHoldClients   = filteredClients.filter(c => c.status === "on_hold");

  // ── Non-paying clients: retained but $0 paid ──
  const nonPayingClients = filteredClients.filter(c => {
    const paid = activePayments.filter(p => p.client_id === c.id).reduce((s, p) => s + p.amount, 0);
    return paid === 0;
  });

  // ── By-state breakdown ──
  const byState = filteredClients.reduce((acc, c) => {
    const key = c.state ?? "Unknown";
    if (!acc[key]) acc[key] = { count: 0, revenue: 0, filed: 0, iolta: 0, operating: 0 };
    acc[key].count++;
    if (c.status === "filed" || c.status === "closed") acc[key].filed++;
    const cp = activePayments.filter(p => p.client_id === c.id);
    acc[key].revenue   += cp.reduce((s, p) => s + p.amount, 0);
    acc[key].iolta     += cp.filter(p => p.destination_account === "iolta").reduce((s, p) => s + p.amount, 0);
    acc[key].operating += cp.filter(p => p.destination_account === "operating").reduce((s, p) => s + p.amount, 0);
    return acc;
  }, {} as Record<string, { count: number; revenue: number; filed: number; iolta: number; operating: number }>);

  // ── Monthly bar chart ──
  const monthlyRevenue = activePayments.reduce((acc, p) => {
    const key = p.payment_date.slice(0, 7);
    acc[key] = (acc[key] ?? 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);
  const monthKeys = Object.keys(monthlyRevenue).sort().slice(-6);

  // ── Stat card helper ──
  const sc = (label: string, value: string, sub?: string, color?: string) => (
    <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
      <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ?? "text-slate-900"}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );

  const hasActiveFilters = dateFrom || dateTo || fState !== "all" || fChapter !== "all" || fCaseType !== "all" || fPayDay !== "all" || fMonth;
  const filterBar = (
    <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 mb-5 space-y-3">
      {/* Row 1: Date range + payment day + month */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Filters</span>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-slate-500 whitespace-nowrap">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="bg-slate-100 border border-slate-200 text-slate-900 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-slate-300 w-32" />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-slate-500 whitespace-nowrap">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="bg-slate-100 border border-slate-200 text-slate-900 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-slate-300 w-32" />
        </div>
        <select value={fMonth} onChange={e => { setFMonth(e.target.value); if (e.target.value) { setDateFrom(""); setDateTo(""); } }}
          className="bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1.5 focus:outline-none min-w-[140px]">
          <option value="">All Months</option>
          {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select value={fPayDay} onChange={e => setFPayDay(e.target.value)}
          className="bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1.5 focus:outline-none">
          <option value="all">Any Pay Day</option>
          {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
            <option key={d} value={String(d)}>Day {d}</option>
          ))}
          <option value="29">Day 29</option>
          <option value="30">Day 30</option>
          <option value="31">Day 31</option>
        </select>
        {hasActiveFilters && (
          <button onClick={() => { setDateFrom(""); setDateTo(""); setFState("all"); setFChapter("all"); setFCaseType("all"); setFPayDay("all"); setFMonth(""); setCmpMonth(""); }}
            className="flex items-center gap-1 text-[10px] text-rose-700 hover:text-rose-700 bg-rose-50 border border-red-500/20 rounded-lg px-2 py-1.5 transition-colors">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
        <span className="text-[10px] text-slate-600 ml-auto">{filteredClients.length} clients · {filteredPayments.length} payments</span>
      </div>
      {/* Row 2: Segmentation filters + comparison */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={fState} onChange={e => setFState(e.target.value)}
          className="bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1.5 focus:outline-none">
          <option value="all">All States</option>
          {allStates.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fChapter} onChange={e => setFChapter(e.target.value as typeof fChapter)}
          className="bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1.5 focus:outline-none">
          <option value="all">All Chapters</option>
          <option value="7">Chapter 7</option>
          <option value="13">Chapter 13</option>
        </select>
        <select value={fCaseType} onChange={e => setFCaseType(e.target.value)}
          className="bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1.5 focus:outline-none">
          <option value="all">All Types</option>
          <option value="regular">Ch. 7 Prepaid</option>
          <option value="bifurcated">Ch. 7 Bifurcated</option>
          <option value="flat_fee">Ch. 13 Flat Fee</option>
          <option value="hourly">Ch. 13 Hourly</option>
          <option value="limited_scope">Limited Scope</option>
        </select>
        <button onClick={() => setShowCompare(v => !v)}
          className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${showCompare ? "bg-sky-100 border-sky-500/30 text-sky-300" : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-700"}`}>
          <BarChart2 className="w-3 h-3" /> Compare Periods
        </button>
        {showCompare && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">vs.</span>
            <select value={cmpMonth} onChange={e => setCmpMonth(e.target.value)}
              className="bg-slate-100 border border-sky-500/30 text-slate-700 text-xs rounded-lg px-2 py-1.5 focus:outline-none min-w-[140px]">
              <option value="">Select comparison month</option>
              {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  );

  const savedCancels    = cancelRequests.filter(r => r.status === "saved");
  const confirmedCancels = cancelRequests.filter(r => r.status === "cancelled");
  const cancelSaveRate  = cancelRequests.length > 0
    ? Math.round(savedCancels.length / (savedCancels.length + confirmedCancels.length || 1) * 100) : 0;

  const SECTIONS: { id: ReportSection; label: string }[] = [
    { id: "daily_report",  label: "Daily Report" },
    { id: "overview",      label: "Overview" },
    { id: "collection",    label: "Collection Rates" },
    { id: "filing",        label: "Retain → File" },
    { id: "nonpaying",     label: `Non-Paying (${nonPayingClients.length})` },
    { id: "cancellations", label: `Cancellations` },
    { id: "check_deposits", label: "Check Deposits" },
  ];

  return (
    <div className="px-6 py-6 overflow-y-auto h-full space-y-0">

      {/* Section tabs */}
      <div className="flex gap-1 mb-5 bg-white/80 border border-slate-200 rounded-xl p-1 w-fit">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all ${section === s.id ? "bg-amber-400 text-slate-950" : "text-slate-500 hover:text-slate-700"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      {filterBar}

      {/* ── Overview ── */}
      {section === "overview" && (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Key Metrics</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sc("Total Clients", String(filteredClients.length),
                `${filteredClients.filter(c => c.status === "active").length} active · ${filedClients.length} filed`)}
              {sc("Paying Clients", String(payingClientsCount),
                `${filteredClients.length > 0 ? ((payingClientsCount / filteredClients.length) * 100).toFixed(0) : 0}% of total`,
                payingClientsCount > 0 ? "text-emerald-700" : "text-rose-700")}
              {sc("Total Collected", fmt(totalRevenue), `${activePayments.length} payments`, "text-emerald-700")}
              {sc("Total Past Due", fmt(totalPastDue), "Across filtered clients", totalPastDue > 0 ? "text-rose-700" : "text-emerald-700")}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Cancellations & Refunds</p>
            <div className="grid grid-cols-3 gap-3">
              {sc("Voided Payments", String(voidedPayments.length), fmt(totalVoided), "text-rose-700")}
              {sc("Refunds", String(refundPayments.length), fmt(totalRefunds), "text-orange-400")}
              {sc("IOLTA Held", fmt(ioltaTotal), "Trust accounts", "text-amber-700")}
            </div>
          </div>

          {/* ── Period Comparison ── */}
          {showCompare && cmpMonth && (
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Period Comparison</p>
              <div className="bg-white border border-sky-500/20 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-slate-800">
                  {/* Primary period */}
                  <div className="px-5 py-4">
                    <p className="text-[11px] font-bold text-sky-700 mb-3">
                      {fMonth ? monthOptions.find(m => m.value === fMonth)?.label ?? fMonth : dateFrom || dateTo ? `${dateFrom || "Start"} → ${dateTo || "Now"}` : "Current Filter"}
                    </p>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Payments</span>
                        <span className="text-slate-900 font-semibold">{activePayments.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Revenue</span>
                        <span className="text-emerald-700 font-bold">{fmt(totalRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Avg Payment</span>
                        <span className="text-slate-900">{fmt(avgPayment)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Voided</span>
                        <span className="text-rose-700">{voidedPayments.length} · {fmt(totalVoided)}</span>
                      </div>
                    </div>
                  </div>
                  {/* Comparison period */}
                  <div className="px-5 py-4">
                    <p className="text-[11px] font-bold text-slate-600 mb-3">
                      {monthOptions.find(m => m.value === cmpMonth)?.label ?? cmpMonth} <span className="text-slate-600">(comparison)</span>
                    </p>
                    {(() => {
                      const cmpRevenue = cmpPayments.reduce((s, p) => s + p.amount, 0);
                      const cmpAvg     = cmpPayments.length > 0 ? cmpRevenue / cmpPayments.length : 0;
                      const cmpVoided  = payments.filter(p => clientIds.has(p.client_id) && p.payment_date.startsWith(cmpMonth) && p.voided);
                      const revDelta   = totalRevenue - cmpRevenue;
                      const cntDelta   = activePayments.length - cmpPayments.length;
                      return (
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Payments</span>
                            <span className="text-slate-900 font-semibold">{cmpPayments.length}
                              <span className={`ml-1.5 text-[10px] ${cntDelta > 0 ? "text-emerald-700" : cntDelta < 0 ? "text-rose-700" : "text-slate-500"}`}>
                                {cntDelta > 0 ? `+${cntDelta}` : cntDelta}
                              </span>
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Revenue</span>
                            <span className="font-bold text-slate-900">{fmt(cmpRevenue)}
                              <span className={`ml-1.5 text-[10px] ${revDelta > 0 ? "text-emerald-700" : revDelta < 0 ? "text-rose-700" : "text-slate-500"}`}>
                                {revDelta > 0 ? `+${fmt(revDelta)}` : fmt(revDelta)}
                              </span>
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Avg Payment</span>
                            <span className="text-slate-900">{fmt(cmpAvg)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Voided</span>
                            <span className="text-rose-700">{cmpVoided.length} · {fmt(cmpVoided.reduce((s, p) => s + p.amount, 0))}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {monthKeys.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Monthly Collections</p>
              <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
                <div className="flex items-end gap-3 h-28">
                  {(() => {
                    const maxVal = Math.max(...monthKeys.map(k => monthlyRevenue[k]));
                    return monthKeys.map(k => (
                      <div key={k} className="flex-1 flex flex-col items-center gap-1.5">
                        <span className="text-[10px] text-slate-500">{fmt(monthlyRevenue[k])}</span>
                        <div className="w-full bg-amber-400 rounded-t transition-all" style={{ height: `${maxVal > 0 ? (monthlyRevenue[k] / maxVal) * 80 : 0}px` }} />
                        <span className="text-[10px] text-slate-600">
                          {new Date(k + "-01").toLocaleDateString("en-US", { month: "short" })}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {Object.keys(byState).length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">By State</p>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">State</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Clients</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Filed</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Total</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest hidden sm:table-cell">Operating</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest hidden sm:table-cell">IOLTA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(byState).sort((a, b) => b[1].count - a[1].count).map(([state, d]) => (
                      <tr key={state} className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{state}</span>
                            {(ACTIVE_STATES as readonly string[]).includes(state) && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-500/20 px-1.5 py-0.5 rounded">Active</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 text-right">{d.count}</td>
                        <td className="px-4 py-3 text-sm text-sky-700 text-right">{d.filed}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 font-semibold text-right">{fmt(d.revenue)}</td>
                        <td className="px-4 py-3 text-sm text-emerald-700 font-semibold text-right hidden sm:table-cell">{fmt(d.operating)}</td>
                        <td className="px-4 py-3 text-sm text-amber-700 font-semibold text-right hidden sm:table-cell">{fmt(d.iolta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Collection Rates ── */}
      {section === "collection" && (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Summary</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sc("Avg. Collection Rate", `${avgCollectionRate.toFixed(0)}%`, "Across filtered clients",
                avgCollectionRate >= 75 ? "text-emerald-700" : "text-amber-700")}
              {sc("Fully Paid", String(collectionRates.filter(r => r.rate >= 1).length),
                "At or above 100%", "text-emerald-700")}
              {sc("Partial (>50%)", String(collectionRates.filter(r => r.rate >= 0.5 && r.rate < 1).length),
                "50–99% collected", "text-amber-700")}
              {sc("Under 50%", String(collectionRates.filter(r => r.rate < 0.5).length),
                "Below 50%", "text-rose-700")}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Per-Client Collection Rate</p>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {collectionRates.length === 0
                ? <p className="text-xs text-slate-600 text-center py-8">No clients match filters.</p>
                : (
                <div className="divide-y divide-slate-800/40">
                  {collectionRates.sort((a, b) => a.rate - b.rate).map(({ client, paid, total, rate }) => (
                    <div key={client.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-900 truncate">{client.full_name}</span>
                          {chapterBadge(client.chapter)}
                          {client.state && <span className="text-[10px] text-slate-600">{client.state}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 bg-slate-100 rounded-full h-1">
                            <div className={`h-1 rounded-full transition-all ${rate >= 1 ? "bg-emerald-500" : rate >= 0.5 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${Math.min(100, rate * 100)}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-500 flex-shrink-0 w-28 text-right">{fmt(paid)} / {fmt(total)}</span>
                        </div>
                      </div>
                      <span className={`text-sm font-bold flex-shrink-0 w-12 text-right ${rate >= 1 ? "text-emerald-700" : rate >= 0.5 ? "text-amber-700" : "text-rose-700"}`}>
                        {(rate * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Retain → File ── */}
      {section === "filing" && (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Retention to Filing</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sc("Retained", String(retainedClients.length), "Total clients", "text-slate-900")}
              {sc("Filed", String(filedClients.length), `${filedRate.toFixed(0)}% of retained`, "text-sky-700")}
              {sc("Closed", String(closedClients.length), "Completed cases", "text-slate-600")}
              {sc("On Hold", String(onHoldClients.length), "Paused cases", "text-amber-700")}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Retain → File Funnel</p>
            <div className="bg-white border border-slate-200 rounded-2xl px-5 py-5 space-y-4">
              {([
                { label: "Retained (All Clients)", count: retainedClients.length, color: "bg-slate-300", pct: 100 },
                { label: "Active", count: filteredClients.filter(c => c.status === "active").length, color: "bg-amber-500", pct: retainedClients.length > 0 ? filteredClients.filter(c => c.status === "active").length / retainedClients.length * 100 : 0 },
                { label: "Filed / Case Active", count: filedClients.length, color: "bg-sky-500", pct: filedRate },
                { label: "Closed / Discharged", count: closedClients.length, color: "bg-emerald-500", pct: retainedClients.length > 0 ? closedClients.length / retainedClients.length * 100 : 0 },
              ] as const).map(({ label, count, color, pct }) => (
                <div key={label}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-slate-700">{label}</span>
                    <span className="text-xs font-bold text-slate-900">{count} <span className="text-slate-500 font-normal">({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Avg. Payment by Status</p>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Clients</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Total Paid</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Avg. Paid</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Avg. Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(["active", "filed", "closed", "on_hold"] as const).map(st => {
                    const sts = filteredClients.filter(c => c.status === st);
                    if (sts.length === 0) return null;
                    const stPaid  = sts.map(c => activePayments.filter(p => p.client_id === c.id).reduce((s, p) => s + p.amount, 0));
                    const total   = stPaid.reduce((s, v) => s + v, 0);
                    const avg     = total / sts.length;
                    const avgRate = sts.map(c => {
                      const fs   = feeStructures.find(f => f.client_id === c.id);
                      const paid = activePayments.filter(p => p.client_id === c.id).reduce((s, p) => s + p.amount, 0);
                      return fs?.total_fee ? paid / fs.total_fee : 0;
                    }).reduce((s, v) => s + v, 0) / sts.length * 100;
                    const labels = { active: "Active", filed: "Filed", closed: "Closed", on_hold: "On Hold" };
                    const colors = { active: "text-emerald-700", filed: "text-sky-700", closed: "text-slate-600", on_hold: "text-amber-700" };
                    return (
                      <tr key={st} className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold ${colors[st]}`}>{labels[st]}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 text-right">{sts.length}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 font-semibold text-right">{fmt(total)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700 text-right">{fmt(avg)}</td>
                        <td className={`px-4 py-3 text-sm font-semibold text-right ${avgRate >= 75 ? "text-emerald-700" : avgRate >= 40 ? "text-amber-700" : "text-rose-700"}`}>
                          {avgRate.toFixed(0)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Non-Paying Clients ── */}
      {section === "nonpaying" && (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Retained with No Payments</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {sc("Non-Paying Clients", String(nonPayingClients.length),
                `${filteredClients.length > 0 ? (nonPayingClients.length / filteredClients.length * 100).toFixed(0) : 0}% of filtered`, "text-rose-700")}
              {sc("Outstanding Owed", fmt(nonPayingClients.reduce((s, c) => {
                const fs = feeStructures.find(f => f.client_id === c.id);
                return s + (fs?.total_fee ?? 0);
              }, 0)), "Total fees not yet paid", "text-orange-400")}
              {sc("Paying Clients", String(filteredClients.length - nonPayingClients.length),
                "Have made at least 1 payment", "text-emerald-700")}
            </div>
          </div>

          {nonPayingClients.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl px-5 py-10 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-900">All clients have made at least one payment</p>
              <p className="text-xs text-slate-500 mt-1">No non-paying clients found for the current filters.</p>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Client List</p>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Client</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest hidden sm:table-cell">State</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest hidden sm:table-cell">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Fee Owed</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest hidden md:table-cell">Intake</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nonPayingClients.sort((a, b) => (a.intake_date ?? "").localeCompare(b.intake_date ?? "")).map(c => {
                      const fs = feeStructures.find(f => f.client_id === c.id);
                      return (
                        <tr key={c.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{c.full_name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {chapterBadge(c.chapter)}
                                  <span className="text-[10px] text-slate-600">{CASE_TYPE_LABELS[c.case_type]}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 hidden sm:table-cell">{c.state ?? "—"}</td>
                          <td className="px-4 py-3 hidden sm:table-cell">{statusBadge(c.status)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-rose-700 text-right">{fmt(fs?.total_fee ?? 0)}</td>
                          <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{fmtDate(c.intake_date)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Cancellations Report ── */}
      {section === "cancellations" && (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Retention Performance</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Requests", value: String(cancelRequests.length), color: "text-slate-900", sub: "All time" },
                { label: "Clients Saved", value: String(savedCancels.length), color: "text-emerald-700", sub: "Retention wins" },
                { label: "Confirmed Cancels", value: String(confirmedCancels.length), color: "text-rose-700", sub: "Lost clients" },
                { label: "Save Rate", value: `${cancelSaveRate}%`, color: cancelSaveRate >= 60 ? "text-emerald-700" : "text-amber-700", sub: "Saves vs cancels" },
              ].map(s => (
                <div key={s.label} className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Cancellations by Reason</p>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Reason</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Requests</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Saved</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Cancelled</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Save Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {["cannot_afford","changed_mind","circumstances_changed","other"].map(cat => {
                    const rows     = cancelRequests.filter(r => r.reason_category === cat);
                    if (rows.length === 0) return null;
                    const sv       = rows.filter(r => r.status === "saved").length;
                    const cn       = rows.filter(r => r.status === "cancelled").length;
                    const rate     = rows.length > 0 ? Math.round(sv / (sv + cn || 1) * 100) : 0;
                    const labels: Record<string, string> = {
                      cannot_afford: "Cannot Afford", changed_mind: "Changed Mind",
                      circumstances_changed: "Changed Circumstances", other: "Other",
                    };
                    return (
                      <tr key={cat} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-900">{labels[cat]}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 text-right">{rows.length}</td>
                        <td className="px-4 py-3 text-sm text-emerald-700 font-semibold text-right">{sv}</td>
                        <td className="px-4 py-3 text-sm text-rose-700 font-semibold text-right">{cn}</td>
                        <td className={`px-4 py-3 text-sm font-bold text-right ${rate >= 60 ? "text-emerald-700" : rate >= 30 ? "text-amber-700" : "text-rose-700"}`}>{rate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">AI Retention Outcomes</p>
            <div className="grid grid-cols-3 gap-3">
              {(["saved","escalated","irreversible"] as const).map(outcome => {
                const count = cancelRequests.filter(r => r.ai_retention_outcome === outcome).length;
                const colors = { saved: "text-emerald-700", escalated: "text-sky-700", irreversible: "text-rose-700" };
                const labels = { saved: "AI Saved", escalated: "Escalated to Staff", irreversible: "Irreversible" };
                return (
                  <div key={outcome} className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1">{labels[outcome]}</p>
                    <p className={`text-2xl font-bold ${colors[outcome]}`}>{count}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Daily Accounting Report ── */}
      {section === "daily_report" && (() => {
        // Compute prior-30-day date
        const priorDate = new Date(dailyDate);
        priorDate.setDate(priorDate.getDate() - 30);
        const prior30 = priorDate.toISOString().slice(0, 10);

        const allActive = payments.filter(p => !p.voided);

        // Daily payments for chosen date + filters
        const dayPayments = allActive.filter(p => {
          if (p.payment_date !== dailyDate) return false;
          if (dailyState !== "all" && p.account_state !== dailyState) return false;
          if (dailyDest  !== "all" && p.destination_account !== dailyDest) return false;
          return true;
        });
        const dayOperating = dayPayments.filter(p => p.destination_account === "operating");
        const dayIolta     = dayPayments.filter(p => p.destination_account === "iolta");
        const dayTotal     = dayPayments.reduce((s, p) => s + p.amount, 0);
        const dayOpTotal   = dayOperating.reduce((s, p) => s + p.amount, 0);
        const dayIoltaTotal = dayIolta.reduce((s, p) => s + p.amount, 0);

        // Same day 30 days ago
        const prior30Payments = allActive.filter(p => p.payment_date === prior30 &&
          (dailyState === "all" || p.account_state === dailyState) &&
          (dailyDest  === "all" || p.destination_account === dailyDest));
        const prior30Total = prior30Payments.reduce((s, p) => s + p.amount, 0);
        const dayDelta     = dayTotal - prior30Total;
        const dayPct       = prior30Total > 0 ? ((dayDelta / prior30Total) * 100) : 0;

        // YTD by state
        const currentYear = dailyDate.slice(0, 4);
        const ytdPayments = allActive.filter(p => p.payment_date.startsWith(currentYear));
        const ytdByState  = ytdPayments.reduce((acc, p) => {
          const st = p.account_state ?? "Unknown";
          if (!acc[st]) acc[st] = { operating: 0, iolta: 0 };
          if (p.destination_account === "iolta") acc[st].iolta += p.amount;
          else acc[st].operating += p.amount;
          return acc;
        }, {} as Record<string, { operating: number; iolta: number }>);

        // Monthly summary (last 6 months, split by dest)
        const monthlyMap: Record<string, { operating: number; iolta: number; total: number }> = {};
        allActive.forEach(p => {
          const k = p.payment_date.slice(0, 7);
          if (!monthlyMap[k]) monthlyMap[k] = { operating: 0, iolta: 0, total: 0 };
          if (p.destination_account === "iolta") monthlyMap[k].iolta += p.amount;
          else monthlyMap[k].operating += p.amount;
          monthlyMap[k].total += p.amount;
        });
        const mKeys = Object.keys(monthlyMap).sort().slice(-6);
        const avgMonthly = mKeys.length > 0 ? mKeys.reduce((s, k) => s + monthlyMap[k].total, 0) / mKeys.length : 0;

        // Client details for the day
        const dayByClient = dayPayments.reduce((acc, p) => {
          if (!acc[p.client_id]) {
            const cl = clients.find(c => c.id === p.client_id);
            acc[p.client_id] = { name: cl?.full_name ?? "Unknown", payments: [], total: 0 };
          }
          acc[p.client_id].payments.push(p);
          acc[p.client_id].total += p.amount;
          return acc;
        }, {} as Record<string, { name: string; payments: Payment[]; total: number }>);

        return (
          <div className="space-y-6">
            {/* Date + filter controls */}
            <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-2xl px-5 py-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-700" />
                <span className="text-xs font-bold text-amber-700 uppercase tracking-widest">Daily Report</span>
              </div>
              <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)}
                className="bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-400" />
              <select value={dailyState} onChange={e => setDailyState(e.target.value)}
                className="bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1.5 focus:outline-none">
                <option value="all">All States</option>
                {allStates.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={dailyDest} onChange={e => setDailyDest(e.target.value as typeof dailyDest)}
                className="bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1.5 focus:outline-none">
                <option value="all">All Accounts</option>
                <option value="operating">Operating Only</option>
                <option value="iolta">IOLTA Only</option>
              </select>
              <span className="text-[11px] text-slate-500 ml-auto">Compared to {fmtDate(prior30)} (30 days prior)</span>
            </div>

            {/* Summary KPIs */}
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">
                {new Date(dailyDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1">Total Collected</p>
                  <p className="text-2xl font-bold text-slate-900">{fmt(dayTotal)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-[10px] font-semibold ${dayDelta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {dayDelta >= 0 ? "+" : ""}{dayPct.toFixed(1)}% vs 30d prior
                    </span>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1">Operating</p>
                  <p className="text-2xl font-bold text-emerald-700">{fmt(dayOpTotal)}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{dayOperating.length} payment{dayOperating.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="bg-white border border-amber-400/20 rounded-2xl px-5 py-4">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1">IOLTA / Trust</p>
                  <p className="text-2xl font-bold text-amber-700">{fmt(dayIoltaTotal)}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{dayIolta.length} payment{dayIolta.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1">Clients Paid</p>
                  <p className="text-2xl font-bold text-sky-700">{Object.keys(dayByClient).length}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{dayPayments.length} transactions</p>
                </div>
              </div>
            </div>

            {/* 30-day prior comparison strip */}
            <div className="bg-white/80 border border-slate-200 rounded-xl px-5 py-3 flex items-center gap-6 flex-wrap text-xs">
              <span className="text-slate-500 font-semibold">30-Day Prior ({prior30}):</span>
              <span className="text-slate-700">{prior30Payments.length} payments · <span className="font-bold text-slate-900">{fmt(prior30Total)}</span></span>
              {prior30Total > 0 && (
                <span className={`font-bold px-2 py-0.5 rounded-full border text-[11px] ${dayDelta >= 0 ? "text-emerald-700 bg-emerald-50 border-emerald-500/20" : "text-rose-700 bg-rose-50 border-red-500/20"}`}>
                  {dayDelta >= 0 ? "+" : ""}{fmt(Math.abs(dayDelta))} ({dayDelta >= 0 ? "+" : ""}{dayPct.toFixed(1)}%)
                </span>
              )}
            </div>

            {/* Individual payment list */}
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Individual Payments — {dailyDate}</p>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                {dayPayments.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <DollarSign className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No payments recorded for this date.</p>
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Client</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs hidden sm:table-cell">State</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Method</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Type</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Account</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {dayPayments.map(p => {
                        const cl = clients.find(c => c.id === p.client_id);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2.5">
                              <p className="font-semibold text-slate-900">{cl?.full_name ?? "Unknown"}</p>
                              <p className="text-[10px] text-slate-600">{p.id.slice(0, 8)}</p>
                            </td>
                            <td className="px-3 py-2.5 text-slate-600 hidden sm:table-cell">{p.account_state ?? cl?.state ?? "—"}</td>
                            <td className="px-3 py-2.5 capitalize text-slate-700">{(p.payment_method ?? "—").replace(/_/g, " ")}</td>
                            <td className="px-3 py-2.5 capitalize text-slate-600">{(p.payment_type ?? "—").replace(/_/g, " ")}</td>
                            <td className="px-3 py-2.5">
                              {p.destination_account === "iolta"
                                ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-amber-700 bg-amber-50 border-amber-500/20">IOLTA</span>
                                : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-emerald-700 bg-emerald-50 border-emerald-500/20">Operating</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-900">{fmt(p.amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t border-slate-200">
                      <tr>
                        <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-slate-600">Totals</td>
                        <td className="px-3 py-2.5">
                          <div className="space-y-0.5">
                            <p className="text-[10px] text-emerald-700 font-semibold">Op: {fmt(dayOpTotal)}</p>
                            <p className="text-[10px] text-amber-700 font-semibold">IOLTA: {fmt(dayIoltaTotal)}</p>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-900">{fmt(dayTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>

            {/* Monthly breakdown — Operating vs IOLTA */}
            {mKeys.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Monthly Collections — Operating vs IOLTA</p>
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Month</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-emerald-700 uppercase tracking-wide text-xs">Operating</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-amber-700 uppercase tracking-wide text-xs">IOLTA</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Total</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">vs Avg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {mKeys.map(k => {
                        const m = monthlyMap[k];
                        const delta = m.total - avgMonthly;
                        return (
                          <tr key={k} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 text-slate-900 font-semibold">
                              {new Date(k + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                            </td>
                            <td className="px-3 py-2.5 text-right text-emerald-700 font-semibold">{fmt(m.operating)}</td>
                            <td className="px-3 py-2.5 text-right text-amber-700 font-semibold">{fmt(m.iolta)}</td>
                            <td className="px-4 py-2.5 text-right text-slate-900 font-bold">{fmt(m.total)}</td>
                            <td className={`px-4 py-2.5 text-right text-[11px] font-semibold ${delta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                              {delta >= 0 ? "+" : ""}{fmt(delta)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t border-slate-200 bg-slate-100/30">
                      <tr>
                        <td className="px-4 py-2.5 text-sm font-bold text-slate-600 uppercase">Avg / Month</td>
                        <td colSpan={2} className="px-3 py-2.5" />
                        <td className="px-4 py-2.5 text-right text-sm font-bold text-amber-700">{fmt(avgMonthly)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* YTD by state — split Operating / IOLTA */}
            {Object.keys(ytdByState).length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Year-to-Date by State ({currentYear}) — Operating vs IOLTA</p>
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">State</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-emerald-700 uppercase tracking-wide text-xs">Operating</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-amber-700 uppercase tracking-wide text-xs">IOLTA</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {Object.entries(ytdByState)
                        .sort((a, b) => (b[1].operating + b[1].iolta) - (a[1].operating + a[1].iolta))
                        .map(([state, v]) => (
                          <tr key={state} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-900 font-semibold">{state}</span>
                                {(ACTIVE_STATES as readonly string[]).includes(state) && (
                                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-500/20 px-1.5 py-0.5 rounded">Active</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right text-emerald-700 font-semibold">{fmt(v.operating)}</td>
                            <td className="px-3 py-2.5 text-right text-amber-700 font-semibold">{fmt(v.iolta)}</td>
                            <td className="px-4 py-2.5 text-right text-slate-900 font-bold">{fmt(v.operating + v.iolta)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Trustee Check Deposits ── */}
      {section === "check_deposits" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {(["all","pending_deposit","deposited","reconciled"] as const).map(f => (
                <button key={f} onClick={() => setCheckFilter(f)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all capitalize ${checkFilter === f ? "bg-amber-400 text-slate-950" : "text-slate-500 hover:text-slate-700"}`}>
                  {f === "all" ? "All" : f.replace(/_/g, " ")}
                </button>
              ))}
            </div>
            <button onClick={() => setShowCheckForm(true)}
              className="ml-auto flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-xs px-4 py-2 rounded-xl transition-all">
              <Plus className="w-3.5 h-3.5" /> Log Check Deposit
            </button>
          </div>

          {/* Summary */}
          {(() => {
            const visible = checkDeposits.filter(d => checkFilter === "all" || d.status === checkFilter);
            const opTotal  = checkDeposits.filter(d => d.destination_account === "operating" && d.status !== "returned").reduce((s, d) => s + d.amount, 0);
            const ioTotal  = checkDeposits.filter(d => d.destination_account === "iolta"     && d.status !== "returned").reduce((s, d) => s + d.amount, 0);
            const pending  = checkDeposits.filter(d => d.status === "pending_deposit").length;
            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Checks", value: String(checkDeposits.length), color: "text-slate-900" },
                    { label: "Pending Deposit", value: String(pending), color: pending > 0 ? "text-amber-700" : "text-slate-600" },
                    { label: "Operating Total", value: fmt(opTotal), color: "text-emerald-700" },
                    { label: "IOLTA Total",     value: fmt(ioTotal),  color: "text-amber-700" },
                  ].map(s => (
                    <div key={s.label} className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1">{s.label}</p>
                      <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  {visible.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <Receipt className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">{checkDepositsLoaded ? "No checks in this view." : "Loading…"}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/50">
                      {visible.map(dep => (
                        <div key={dep.id} className="px-4 py-4 flex items-start gap-4">
                          {/* Check image thumbnail */}
                          <div className="flex-shrink-0">
                            {dep.check_image_url ? (
                              <button onClick={() => setCheckViewImg(dep.check_image_url)}
                                className="w-16 h-12 rounded-lg overflow-hidden border border-slate-200 hover:border-amber-400/50 transition-colors">
                                <img src={dep.check_image_url} alt="Check" className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <div className="w-16 h-12 rounded-lg border border-dashed border-slate-200 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-slate-600" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-slate-900">{dep.trustee_name}</span>
                              {dep.trustee_state && <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">{dep.trustee_state}</span>}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                dep.status === "reconciled"     ? "bg-emerald-50 border-emerald-500/25 text-emerald-700" :
                                dep.status === "deposited"      ? "bg-sky-50 border-sky-500/25 text-sky-700" :
                                dep.status === "pending_deposit"? "bg-amber-50 border-amber-400/25 text-amber-700" :
                                "bg-rose-50 border-red-500/25 text-rose-700"
                              }`}>{dep.status.replace(/_/g, " ")}</span>
                              {dep.destination_account === "iolta"
                                ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-amber-700 bg-amber-50 border-amber-500/20">IOLTA</span>
                                : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-emerald-700 bg-emerald-50 border-emerald-500/20">Operating</span>}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
                              {dep.client_name && <span>Client: <span className="text-slate-700">{dep.client_name}</span></span>}
                              {dep.check_number && <span>Check #<span className="text-slate-700">{dep.check_number}</span></span>}
                              {dep.check_date && <span>Dated: <span className="text-slate-700">{fmtDate(dep.check_date)}</span></span>}
                              {dep.deposit_date && <span>Deposited: <span className="text-slate-700">{fmtDate(dep.deposit_date)}</span></span>}
                              {dep.deposited_by && <span>By: <span className="text-slate-700">{dep.deposited_by}</span></span>}
                            </div>
                            {dep.notes && <p className="text-[10px] text-slate-600 mt-1 truncate">{dep.notes}</p>}
                          </div>

                          <div className="flex-shrink-0 text-right">
                            <p className="text-sm font-bold text-slate-900">{fmt(dep.amount)}</p>
                            <p className="text-[10px] text-slate-500 capitalize mt-0.5">{dep.payment_type.replace(/_/g, " ")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {/* Log Check Deposit Form */}
          {showCheckForm && (
            <CheckDepositForm
              clients={clients}
              adminUser={adminUser}
              onClose={() => setShowCheckForm(false)}
              onSaved={() => { setShowCheckForm(false); loadCheckDeposits(); }}
            />
          )}

          {/* Image lightbox */}
          {checkViewImg && (
            <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-6" onClick={() => setCheckViewImg(null)}>
              <div className="relative max-w-2xl w-full">
                <button onClick={() => setCheckViewImg(null)} className="absolute -top-10 right-0 text-slate-900 text-sm flex items-center gap-1.5">
                  <X className="w-4 h-4" /> Close
                </button>
                <img src={checkViewImg} alt="Check" className="w-full rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Filed Cases View ─────────────────────────────────────────────────────────

function FiledCasesView({ clients, payments, feeStructures, filedRegistry, ioltaSignoffs, adminUser, onRequestAdmin, onRefresh }: {
  clients: AClient[];
  payments: Payment[];
  feeStructures: FeeStructure[];
  filedRegistry: FiledCaseRegistry[];
  ioltaSignoffs: IoltaSignoff[];
  adminUser: string | null;
  onRequestAdmin: () => void;
  onRefresh: () => void;
}) {
  const [filterState, setFilterState]     = useState("all");
  const [filterStatus, setFilterStatus]   = useState<"all" | FiledCaseRegistry["transfer_status"]>("all");
  const [filterChapter, setFilterChapter] = useState<"all" | "7" | "13">("all");
  const [search, setSearch]               = useState("");

  const [verifyModal, setVerifyModal]     = useState<FiledCaseRegistry | null>(null);
  const [signoffModal, setSignoffModal]   = useState<FiledCaseRegistry | null>(null);
  const [transferModal, setTransferModal] = useState<FiledCaseRegistry | null>(null);
  const [addModal, setAddModal]           = useState(false);

  const allStates = Array.from(new Set(filedRegistry.map(r => r.state).filter(Boolean))).sort();

  const filtered = filedRegistry.filter(r => {
    const client = clients.find(c => c.id === r.client_id);
    if (filterState   !== "all" && r.state !== filterState) return false;
    if (filterStatus  !== "all" && r.transfer_status !== filterStatus) return false;
    if (filterChapter !== "all" && String(r.chapter) !== filterChapter) return false;
    if (search && !client?.full_name.toLowerCase().includes(search.toLowerCase()) &&
        !r.case_number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => new Date(b.filed_date).getTime() - new Date(a.filed_date).getTime());

  const pendingSignoff  = filedRegistry.filter(r => r.transfer_status === "pending_signoff").length;
  const signedOff       = filedRegistry.filter(r => r.transfer_status === "signed_off").length;
  const transferred     = filedRegistry.filter(r => r.transfer_status === "transferred").length;

  const statusConfig: Record<FiledCaseRegistry["transfer_status"], { label: string; color: string; bg: string }> = {
    not_ready:       { label: "Not Ready",      color: "text-slate-500", bg: "bg-slate-200/30 border-slate-200" },
    pending_signoff: { label: "Pending Signoff", color: "text-amber-700", bg: "bg-amber-50 border-amber-500/25" },
    signed_off:      { label: "Signed Off",      color: "text-sky-700",   bg: "bg-sky-50 border-sky-500/25" },
    transferred:     { label: "Transferred",     color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-500/25" },
  };

  return (
    <div className="px-6 py-6 overflow-y-auto h-full space-y-5">

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Filed", value: filedRegistry.length, color: "text-slate-900" },
          { label: "Pending Signoff", value: pendingSignoff, color: "text-amber-700" },
          { label: "Signed Off", value: signedOff, color: "text-sky-700" },
          { label: "Transferred", value: transferred, color: "text-emerald-700" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter + action bar */}
      <div className="flex flex-wrap gap-2 items-center bg-white border border-slate-200 rounded-2xl px-4 py-3">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or case #…"
            className="w-full bg-slate-100 border border-slate-200 text-slate-900 text-xs rounded-xl pl-9 pr-3 py-2 placeholder-slate-600 focus:outline-none focus:border-slate-300" />
        </div>
        <select value={filterState} onChange={e => setFilterState(e.target.value)}
          className="bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-2 focus:outline-none">
          <option value="all">All States</option>
          {allStates.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterChapter} onChange={e => setFilterChapter(e.target.value as typeof filterChapter)}
          className="bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-2 focus:outline-none">
          <option value="all">All Chapters</option>
          <option value="7">Chapter 7</option>
          <option value="13">Chapter 13</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
          className="bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-2 focus:outline-none">
          <option value="all">All Statuses</option>
          <option value="not_ready">Not Ready</option>
          <option value="pending_signoff">Pending Signoff</option>
          <option value="signed_off">Signed Off</option>
          <option value="transferred">Transferred</option>
        </select>
        <button onClick={() => setAddModal(true)}
          className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs px-3 py-2 rounded-xl transition-all flex-shrink-0">
          <Plus className="w-3.5 h-3.5" /> Add Filed Case
        </button>
      </div>

      {/* Case list */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileText className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500">No filed cases found</p>
            <p className="text-xs text-slate-700 mt-1">Adjust filters or add a filed case above.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {filtered.map(r => {
              const client   = clients.find(c => c.id === r.client_id);
              const fs       = feeStructures.find(f => f.client_id === r.client_id);
              const paid     = payments.filter(p => p.client_id === r.client_id && !p.voided).reduce((s, p) => s + p.amount, 0);
              const ioltaPaid = payments.filter(p => p.client_id === r.client_id && !p.voided && p.destination_account === "iolta").reduce((s, p) => s + p.amount, 0);
              const sc  = statusConfig[r.transfer_status];
              const history = ioltaSignoffs.filter(s => s.registry_id === r.id);
              const lastSignoff = history.length > 0 ? history.sort((a, b) => new Date(b.signed_at).getTime() - new Date(a.signed_at).getTime())[0] : null;

              return (
                <div key={r.id} className="px-4 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">{client?.full_name ?? "Unknown Client"}</span>
                        {client && chapterBadge(client.chapter)}
                        {client?.state && <span className="text-[10px] text-slate-600 font-medium">{client.state}</span>}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.bg} ${sc.color}`}>{sc.label}</span>
                        {client?.case_type === "bifurcated" && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-sky-50 border-sky-500/25 text-sky-700" title="Bifurcated: filing fee included in attorney fee → Operating only">
                            BIFURCATED · Filing Fee → Operating
                          </span>
                        )}
                        {client && client.case_type !== "bifurcated" && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 border-amber-500/25 text-amber-700" title="Regular/Ch.13: filing fee transferred from IOLTA to filing fee transfer account">
                            Filing Fee → IOLTA Transfer
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {/* Case number */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-600">Case #</span>
                          <span className={`text-xs font-mono font-semibold ${r.case_number ? "text-slate-900" : "text-rose-700"}`}>
                            {r.case_number || "Not entered"}
                          </span>
                          {r.case_number_verified
                            ? <span title="Verified"><CheckCircle2 className="w-3 h-3 text-emerald-700" /></span>
                            : r.case_number
                              ? <span title="Unverified"><AlertTriangle className="w-3 h-3 text-amber-700" /></span>
                              : null}
                        </div>
                        <span className="text-slate-700">·</span>
                        <span className="text-[10px] text-slate-500">Filed {fmtDate(r.filed_date)}</span>
                        {r.iolta_balance_verified && (
                          <>
                            <span className="text-slate-700">·</span>
                            <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                              <Shield className="w-2.5 h-2.5" /> IOLTA verified {fmt(r.iolta_verified_amount ?? 0)}
                            </span>
                          </>
                        )}
                      </div>

                      {/* IOLTA / payment summary */}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-600">
                          Paid: <span className="text-slate-700">{fmt(paid)}</span>
                        </span>
                        {ioltaPaid > 0 && (
                          <span className="text-[10px] text-amber-700">
                            IOLTA: {fmt(ioltaPaid)}
                          </span>
                        )}
                        {fs && <span className="text-[10px] text-slate-600">
                          Total fee: <span className="text-slate-600">{fmt(fs.total_fee)}</span>
                        </span>}
                      </div>

                      {lastSignoff && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <Shield className="w-2.5 h-2.5 text-slate-600" />
                          <span className="text-[10px] text-slate-600">
                            Last signoff: <span className="text-slate-600">{lastSignoff.attorney_name}</span>
                            {" · "}<span className={lastSignoff.action === "rejected" ? "text-rose-700" : "text-emerald-700"}>
                              {lastSignoff.action === "verified" ? "Verified" : lastSignoff.action === "transfer_approved" ? "Approved Transfer" : "Rejected"}
                            </span>
                            {" · "}{fmtDate(lastSignoff.signed_at)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                      {!r.case_number_verified && r.case_number && (
                        <button onClick={() => setVerifyModal(r)}
                          className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-500/25 text-amber-700 hover:bg-amber-100 transition-colors whitespace-nowrap">
                          Verify #
                        </button>
                      )}
                      {r.case_number_verified && !r.iolta_balance_verified && ioltaPaid > 0 && (
                        <button onClick={() => { if (!adminUser) { onRequestAdmin(); return; } setSignoffModal(r); }}
                          className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-sky-50 border border-sky-500/25 text-sky-700 hover:bg-sky-100 transition-colors whitespace-nowrap">
                          <Shield className="w-3 h-3 inline mr-1" />IOLTA Sign-Off
                        </button>
                      )}
                      {r.transfer_status === "signed_off" && (
                        <button onClick={() => { if (!adminUser) { onRequestAdmin(); return; } setTransferModal(r); }}
                          className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-500/25 text-emerald-700 hover:bg-emerald-100 transition-colors whitespace-nowrap">
                          <ArrowLeftRight className="w-3 h-3 inline mr-1" />Execute Transfer
                        </button>
                      )}
                      {r.transfer_status === "transferred" && (
                        <span className="text-[11px] text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Transferred {fmtDate(r.transferred_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Verify Case # Modal ── */}
      {verifyModal && (
        <VerifyCaseModal
          registry={verifyModal}
          client={clients.find(c => c.id === verifyModal.client_id)}
          onClose={() => setVerifyModal(null)}
          onSaved={() => { setVerifyModal(null); onRefresh(); }}
        />
      )}

      {/* ── Attorney IOLTA Sign-Off Modal ── */}
      {signoffModal && adminUser && (
        <IoltaSignoffModal
          registry={signoffModal}
          client={clients.find(c => c.id === signoffModal.client_id)}
          payments={payments.filter(p => p.client_id === signoffModal.client_id && !p.voided)}
          feeStructure={feeStructures.find(f => f.client_id === signoffModal.client_id) ?? null}
          adminUser={adminUser}
          onClose={() => setSignoffModal(null)}
          onSaved={() => { setSignoffModal(null); onRefresh(); }}
        />
      )}

      {/* ── Execute Transfer Modal ── */}
      {transferModal && adminUser && (
        <ExecuteTransferModal
          registry={transferModal}
          client={clients.find(c => c.id === transferModal.client_id)}
          adminUser={adminUser}
          onClose={() => setTransferModal(null)}
          onSaved={() => { setTransferModal(null); onRefresh(); }}
        />
      )}

      {/* ── Add Filed Case Modal ── */}
      {addModal && (
        <AddFiledCaseModal
          clients={clients}
          existingRegistry={filedRegistry}
          onClose={() => setAddModal(false)}
          onSaved={() => { setAddModal(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Verify Case Number Modal ─────────────────────────────────────────────────

function VerifyCaseModal({ registry, client, onClose, onSaved }: {
  registry: FiledCaseRegistry;
  client: AClient | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [caseNumber, setCaseNumber]   = useState(registry.case_number);
  const [verifiedBy, setVerifiedBy]   = useState("");
  const [notes, setNotes]             = useState(registry.verification_notes ?? "");
  const [saving, setSaving]           = useState(false);
  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-300";
  const lbl = "text-xs font-semibold text-slate-600 mb-1.5 block";

  async function save() {
    if (!caseNumber.trim() || !verifiedBy.trim()) return;
    setSaving(true);
    await api.patch("accounting_filed_case_registry", registry.id, {
      case_number: caseNumber.trim(),
      case_number_verified: true,
      case_number_verified_by: verifiedBy.trim(),
      case_number_verified_at: new Date().toISOString(),
      verification_notes: notes || null,
      transfer_status: registry.transfer_status === "not_ready" ? "pending_signoff" : registry.transfer_status,
      updated_at: new Date().toISOString(),
    });
    // Also update the accounting_clients case_number
    await api.patch("accounting_clients", registry.client_id, {
      case_number: caseNumber.trim(),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Verify Case Number</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{client?.full_name ?? "Client"}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-900"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className={lbl}>Court Case Number *</label>
            <input value={caseNumber} onChange={e => setCaseNumber(e.target.value)}
              placeholder="e.g. 2:26-bk-04812" className={inp} />
          </div>
          <div>
            <label className={lbl}>Verified By *</label>
            <input value={verifiedBy} onChange={e => setVerifiedBy(e.target.value)}
              placeholder="Staff name" className={inp} />
          </div>
          <div>
            <label className={lbl}>Verification Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Confirmed via PACER / court portal…" rows={2}
              className={`${inp} resize-none`} />
          </div>
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-3.5 py-2.5">
            <p className="text-[11px] text-amber-700 font-semibold">After verification</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Case will move to "Pending Signoff" — attorney IOLTA review required before transfer.</p>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button onClick={save} disabled={!caseNumber.trim() || !verifiedBy.trim() || saving}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold px-5 py-2 rounded-xl text-sm transition-all">
            <CheckCircle2 className="w-4 h-4" />{saving ? "Saving…" : "Confirm Verification"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── IOLTA Sign-Off Modal ─────────────────────────────────────────────────────

function IoltaSignoffModal({ registry, client, payments, feeStructure, adminUser, onClose, onSaved }: {
  registry: FiledCaseRegistry;
  client: AClient | undefined;
  payments: Payment[];
  feeStructure: FeeStructure | null;
  adminUser: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isBifurcated = client?.case_type === "bifurcated";
  const ioltaPayments  = payments.filter(p => p.destination_account === "iolta");
  // For bifurcated: the filing fee is included in the attorney fee and deposited into Operating only.
  // For regular Ch.7 and Ch.13: court_filing_fee held in IOLTA is transferred to the filing fee transfer account post-filing.
  const filingFeePayments = ioltaPayments.filter(p => p.payment_type === "court_filing_fee");
  const filingFeeTotal = filingFeePayments.reduce((s, p) => s + p.amount, 0);
  // Fall back to the fee structure's court_filing_fee if no payment recorded yet
  const ioltaTotal = filingFeeTotal > 0 ? filingFeeTotal : (feeStructure?.court_filing_fee ?? 0);
  const [action, setAction]   = useState<"verified" | "rejected">("verified");
  const [notes, setNotes]     = useState("");
  const [saving, setSaving]   = useState(false);
  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-300";
  const lbl = "text-xs font-semibold text-slate-600 mb-1.5 block";

  async function save() {
    setSaving(true);
    // Insert signoff audit record
    await api.post("accounting_iolta_signoffs", {
      registry_id: registry.id,
      client_id: registry.client_id,
      attorney_name: adminUser,
      action,
      iolta_amount: ioltaTotal,
      notes: notes || null,
      signed_at: new Date().toISOString(),
    });
    // Update registry
    await api.patch("accounting_filed_case_registry", registry.id, {
      iolta_balance_verified: action === "verified",
      iolta_verified_by: adminUser,
      iolta_verified_at: new Date().toISOString(),
      iolta_verified_amount: ioltaTotal,
      iolta_signoff_notes: notes || null,
      transfer_status: action === "verified" ? "signed_off" : "pending_signoff",
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-sky-400/15 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-sky-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Attorney IOLTA Sign-Off</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{client?.full_name ?? "Client"} — Case #{registry.case_number}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-900"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Case type routing notice */}
          {isBifurcated ? (
            <div className="bg-sky-50 border border-sky-500/20 rounded-xl px-4 py-3 space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 border border-sky-500/25 text-sky-700">Bifurcated Ch. 7</span>
              </div>
              <p className="text-xs text-sky-300 font-semibold">Filing fee is included in attorney fee — Operating account only.</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Bifurcated cases: the court filing fee is bundled into the attorney fee and deposited directly into the firm's Operating account. No IOLTA → filing fee transfer is required for the filing fee.</p>
            </div>
          ) : (
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 space-y-2">
              <p className="text-xs font-bold text-amber-700 mb-2">Court Filing Fee — IOLTA → Filing Fee Transfer Account</p>
              <p className="text-[10px] text-slate-500 mb-2">Regular Ch. 7 and Ch. 13: court filing fee held in IOLTA is transferred to the designated filing fee transfer account after case is filed and verified.</p>
              {filingFeePayments.length > 0 ? (
                <>
                  {filingFeePayments.map(p => (
                    <div key={p.id} className="flex justify-between text-[11px]">
                      <span className="text-slate-600 capitalize">{p.payment_type.replace(/_/g, " ")} — {fmtDate(p.payment_date)}</span>
                      <span className="text-amber-700 font-semibold">{fmt(p.amount)}</span>
                    </div>
                  ))}
                  <div className="border-t border-amber-500/20 pt-2 flex justify-between text-xs font-bold">
                    <span className="text-amber-700">Transfer Amount</span>
                    <span className="text-amber-700">{fmt(ioltaTotal)}</span>
                  </div>
                </>
              ) : feeStructure?.court_filing_fee ? (
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-600">Court filing fee (from fee structure)</span>
                  <span className="text-amber-700 font-semibold">{fmt(feeStructure.court_filing_fee)}</span>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No court filing fee payment found for this client.</p>
              )}
            </div>
          )}

          {feeStructure && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 rounded-xl p-2.5">
                <p className="text-[10px] text-slate-500 mb-0.5">Total Fee</p>
                <p className="text-sm font-bold text-slate-900">{fmt(feeStructure.total_fee)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5">
                <p className="text-[10px] text-slate-500 mb-0.5">IOLTA Held</p>
                <p className="text-sm font-bold text-amber-700">{fmt(ioltaTotal)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5">
                <p className="text-[10px] text-slate-500 mb-0.5">Chapter</p>
                <p className="text-sm font-bold text-slate-900">Ch. {client?.chapter}</p>
              </div>
            </div>
          )}

          <div>
            <label className={lbl}>Attorney Decision *</label>
            <div className="flex gap-2">
              {(["verified", "rejected"] as const).map(opt => (
                <button key={opt} onClick={() => setAction(opt)}
                  className={`flex-1 text-xs font-bold py-2.5 rounded-xl border transition-all ${
                    action === opt
                      ? opt === "verified" ? "bg-emerald-100 border-emerald-500/40 text-emerald-700" : "bg-rose-100 border-red-500/40 text-rose-700"
                      : "bg-slate-100 border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}>
                  {opt === "verified" ? "Verify & Approve" : "Reject / Flag Issue"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={lbl}>Signoff Notes {action === "rejected" ? "*" : "(optional)"}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={action === "verified" ? "IOLTA balance confirmed correct, ready for transfer…" : "Describe the discrepancy or issue found…"}
              rows={3} className={`${inp} resize-none`} />
          </div>

          <div className={`rounded-xl px-3.5 py-2.5 border ${action === "verified" ? "bg-emerald-50 border-emerald-500/20" : "bg-red-500/8 border-red-500/20"}`}>
            <p className={`text-[11px] font-semibold ${action === "verified" ? "text-emerald-700" : "text-rose-700"}`}>
              {action === "verified" ? "Signing off as: " : "Flagging issue — signed by: "}<span className="font-bold">{adminUser}</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {action === "verified"
                ? "This action confirms IOLTA funds are correct and authorizes transfer execution."
                : "Case will remain in Pending Signoff until issues are resolved."}
            </p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button onClick={save} disabled={saving || (action === "rejected" && !notes.trim())}
            className={`flex items-center gap-2 disabled:opacity-40 font-bold px-5 py-2 rounded-xl text-sm transition-all ${
              action === "verified" ? "bg-emerald-500 hover:bg-emerald-400 text-slate-900" : "bg-red-500 hover:bg-red-400 text-slate-900"
            }`}>
            <Shield className="w-4 h-4" />{saving ? "Saving…" : action === "verified" ? "Sign Off & Approve" : "Submit Rejection"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Execute Transfer Modal ───────────────────────────────────────────────────

function ExecuteTransferModal({ registry, client, adminUser, onClose, onSaved }: {
  registry: FiledCaseRegistry;
  client: AClient | undefined;
  adminUser: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isBifurcated = client?.case_type === "bifurcated";
  const [transferNotes, setTransferNotes] = useState("");
  const [saving, setSaving]               = useState(false);
  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-300";
  const lbl = "text-xs font-semibold text-slate-600 mb-1.5 block";

  async function execute() {
    setSaving(true);
    await api.patch("accounting_filed_case_registry", registry.id, {
      transfer_status: "transferred",
      transferred_at: new Date().toISOString(),
      transferred_by: adminUser,
      transfer_notes: transferNotes || null,
      updated_at: new Date().toISOString(),
    });
    // Add final signoff audit entry
    await api.post("accounting_iolta_signoffs", {
      registry_id: registry.id,
      client_id: registry.client_id,
      attorney_name: adminUser,
      action: "transfer_approved",
      iolta_amount: registry.iolta_verified_amount ?? 0,
      notes: transferNotes || "Transfer executed",
      signed_at: new Date().toISOString(),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-400/15 flex items-center justify-center flex-shrink-0">
            <ArrowLeftRight className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Execute IOLTA Transfer</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{client?.full_name} — Case #{registry.case_number}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-900"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Routing indicator */}
          {isBifurcated ? (
            <div className="bg-sky-50 border border-sky-500/20 rounded-xl px-4 py-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 border border-sky-500/25 text-sky-700">Bifurcated Ch. 7</span>
              </div>
              <p className="text-[11px] text-sky-300 font-semibold">Filing fee included in attorney fee → Firm Operating Account only.</p>
              <p className="text-[10px] text-slate-500 mt-0.5">No IOLTA filing fee transfer required. This action closes the registry entry.</p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-400/20 rounded-xl px-4 py-2.5">
              <p className="text-[11px] text-amber-700 font-semibold">
                {client?.chapter === 13 ? "Ch. 13" : "Regular Ch. 7"}: Court filing fee — IOLTA → Filing Fee Transfer Account
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Transfer verified amount from IOLTA to the designated filing fee transfer account for this state.</p>
            </div>
          )}
          <div className="bg-emerald-50 border border-emerald-500/20 rounded-xl px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Attorney Sign-Off By</span>
              <span className="text-emerald-700 font-semibold">{registry.iolta_verified_by}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Verified {isBifurcated ? "Amount" : "IOLTA"} Amount</span>
              <span className="text-emerald-700 font-semibold">{fmt(registry.iolta_verified_amount ?? 0)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Verified At</span>
              <span className="text-slate-700">{fmtDateTime(registry.iolta_verified_at)}</span>
            </div>
          </div>
          <div>
            <label className={lbl}>Transfer Notes (optional)</label>
            <textarea value={transferNotes} onChange={e => setTransferNotes(e.target.value)}
              placeholder="Reference #, bank confirmation, etc…" rows={2}
              className={`${inp} resize-none`} />
          </div>
          <div className="bg-slate-50 rounded-xl px-3.5 py-2.5">
            <p className="text-[11px] text-slate-600">Executing as: <span className="text-slate-900 font-bold">{adminUser}</span></p>
            <p className="text-[10px] text-slate-600 mt-0.5">
              {isBifurcated
                ? "This action marks the bifurcated case fee as processed (Operating account) and closes this case in the registry."
                : "This action marks the court filing fee as transferred from IOLTA to the filing fee transfer account and closes this case in the registry."}
            </p>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button onClick={execute} disabled={saving}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-900 font-bold px-5 py-2 rounded-xl text-sm transition-all">
            <ArrowLeftRight className="w-4 h-4" />{saving ? "Processing…" : "Confirm Transfer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Filed Case Modal ─────────────────────────────────────────────────────

function AddFiledCaseModal({ clients, existingRegistry, onClose, onSaved }: {
  clients: AClient[];
  existingRegistry: FiledCaseRegistry[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existingIds = new Set(existingRegistry.map(r => r.client_id));
  const eligible    = clients.filter(c =>
    (c.status === "filed" || c.status === "closed") && !existingIds.has(c.id)
  );
  const [clientId, setClientId]       = useState(eligible[0]?.id ?? "");
  const [caseNumber, setCaseNumber]   = useState("");
  const [filedDate, setFiledDate]     = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving]           = useState(false);
  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-300";
  const lbl = "text-xs font-semibold text-slate-600 mb-1.5 block";

  const selectedClient = clients.find(c => c.id === clientId);

  async function save() {
    if (!clientId || !caseNumber.trim()) return;
    setSaving(true);
    await api.post("accounting_filed_case_registry", {
      client_id: clientId,
      case_number: caseNumber.trim(),
      filed_date: filedDate,
      chapter: selectedClient?.chapter ?? 7,
      state: selectedClient?.state ?? "AZ",
      transfer_status: caseNumber.trim() ? "pending_signoff" : "not_ready",
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Add Filed Case</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Register a new filed case in the transfer registry</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {eligible.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">All filed clients are already in the registry.</p>
          ) : (
            <>
              <div>
                <label className={lbl}>Client *</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)} className={inp}>
                  {eligible.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name} — Ch. {c.chapter} ({c.state})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Court Case Number *</label>
                <input value={caseNumber} onChange={e => setCaseNumber(e.target.value)}
                  placeholder="e.g. 2:26-bk-04812" className={inp} />
              </div>
              <div>
                <label className={lbl}>Filed Date *</label>
                <input type="date" value={filedDate} onChange={e => setFiledDate(e.target.value)} className={inp} />
              </div>
            </>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          {eligible.length > 0 && (
            <button onClick={save} disabled={!clientId || !caseNumber.trim() || saving}
              className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold px-5 py-2 rounded-xl text-sm transition-all">
              <Plus className="w-4 h-4" />{saving ? "Adding…" : "Add to Registry"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Autopay Panel (inside ClientDetail) ─────────────────────────────────────

type EnrollStep = "method" | "card_info" | "billing_addr" | "approval" | "third_party";

function AutopayPanel({ client, enrollment, retries, merchantAccounts, onRefresh }: {
  client: AClient;
  enrollment: AutopayEnrollment | undefined;
  retries: PaymentRetry[];
  merchantAccounts: MerchantAccount[];
  onRefresh: () => void;
}) {
  const [step, setStep]             = useState<EnrollStep>("method");
  const [enrolling, setEnrolling]   = useState(false);
  const [isThirdParty, setIsThirdParty] = useState(false);
  const [processor, setProcessor]   = useState<"paycompass" | "lawpay">("lawpay");
  const [methodType, setMethodType] = useState<"card" | "ach">("card");
  // card fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv]       = useState("");
  const [cardBrand, setCardBrand]   = useState("");
  // billing address
  const [addrLine1, setAddrLine1]   = useState("");
  const [addrCity, setAddrCity]     = useState("");
  const [addrState, setAddrState]   = useState("");
  const [addrZip, setAddrZip]       = useState("");
  // approval
  const [sendApproval, setSendApproval] = useState(true);
  const [approvalVia, setApprovalVia]   = useState<"sms" | "email">("sms");
  const [overrideApproval, setOverrideApproval] = useState(false);
  const [overrideReason, setOverrideReason]     = useState("");
  // third party
  const [tpName, setTpName]         = useState("");
  const [tpEmail, setTpEmail]       = useState("");
  const [tpPhone, setTpPhone]       = useState("");
  const [tpMethod, setTpMethod]     = useState<"pay_link" | "card_auth">("pay_link");
  // misc
  const [enrolledBy, setEnrolledBy] = useState("");
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState("");

  const activeRetries = retries.filter(r => r.status === "retrying");
  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-400/60 transition-colors";
  const lbl = "text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1.5 block";

  const last4 = cardNumber.replace(/\s/g, "").slice(-4);

  function resetForm() {
    setStep("method"); setEnrolling(false); setIsThirdParty(false);
    setCardNumber(""); setCardExpiry(""); setCardCvv(""); setCardBrand("");
    setAddrLine1(""); setAddrCity(""); setAddrState(""); setAddrZip("");
    setSendApproval(true); setApprovalVia("sms"); setOverrideApproval(false); setOverrideReason("");
    setTpName(""); setTpEmail(""); setTpPhone(""); setTpMethod("pay_link");
    setEnrolledBy(""); setErr("");
  }

  async function enroll() {
    setErr("");
    if (!enrolledBy.trim()) { setErr("Please enter who is enrolling this client."); return; }
    if (methodType === "card" && !overrideApproval) {
      if (!cardNumber.replace(/\s/g,"") || cardNumber.replace(/\s/g,"").length < 13) { setErr("Enter the full card number."); return; }
      if (!cardExpiry) { setErr("Enter the card expiration date."); return; }
      if (!cardCvv || cardCvv.length < 3) { setErr("Enter the 3-digit security code."); return; }
      if (!addrZip) { setErr("Billing ZIP code is required."); return; }
    }
    if (isThirdParty && !tpName.trim()) { setErr("Third-party name is required."); return; }

    setSaving(true);
    const approvalStatus = overrideApproval ? "overridden" : sendApproval ? "sent" : "approved";

    const payload = {
      processor,
      payment_method_type:    methodType,
      payment_method_last4:   last4 || null,
      card_brand:             cardBrand || null,
      card_expiry:            cardExpiry || null,
      card_number_encrypted:  cardNumber.replace(/\s/g, "") || null,
      card_cvv_hash:          cardCvv || null,
      billing_address_line1:  addrLine1 || null,
      billing_address_city:   addrCity || null,
      billing_address_state:  addrState || null,
      billing_address_zip:    addrZip || null,
      enrolled_by:            enrolledBy,
      is_active:              overrideApproval || !sendApproval,
      approval_required:      sendApproval && !overrideApproval,
      approval_status:        approvalStatus,
      approval_sent_at:       sendApproval && !overrideApproval ? new Date().toISOString() : null,
      approval_sent_via:      sendApproval && !overrideApproval ? approvalVia : null,
      approval_override:      overrideApproval,
      approval_override_by:   overrideApproval ? enrolledBy : null,
      approval_override_at:   overrideApproval ? new Date().toISOString() : null,
      approval_override_reason: overrideApproval ? overrideReason : null,
      is_third_party:         isThirdParty,
      third_party_name:       isThirdParty ? tpName : null,
      third_party_email:      isThirdParty ? tpEmail : null,
      third_party_phone:      isThirdParty ? tpPhone : null,
      third_party_method:     isThirdParty ? tpMethod : null,
      third_party_link_sent_at: isThirdParty && tpMethod === "pay_link" ? new Date().toISOString() : null,
      updated_at:             new Date().toISOString(),
    };

    if (enrollment) {
      await api.patch("accounting_autopay_enrollments", enrollment.id, payload);
    } else {
      await api.post("accounting_autopay_enrollments", { client_id: client.id, enrolled_at: new Date().toISOString(), ...payload });
    }
    await api.patch("accounting_clients", client.id, {
      autopay_enabled: overrideApproval || !sendApproval,
      preferred_processor: processor,
      autopay_enrolled_at: new Date().toISOString(),
    });
    setSaving(false);
    resetForm();
    onRefresh();
  }

  async function markApproved() {
    if (!enrollment) return;
    await api.patch("accounting_autopay_enrollments", enrollment.id, {
      approval_status: "approved", approval_response_at: new Date().toISOString(), is_active: true,
    });
    await api.patch("accounting_clients", client.id, { autopay_enabled: true });
    onRefresh();
  }

  async function deactivate() {
    if (!enrollment) return;
    await api.patch("accounting_autopay_enrollments", enrollment.id, { is_active: false, approval_status: "declined" });
    await api.patch("accounting_clients", client.id, { autopay_enabled: false });
    onRefresh();
  }

  async function reschedule(retry: PaymentRetry, days: number) {
    const orig = new Date(retry.original_due_date);
    const max  = new Date(retry.max_retry_date);
    const proposed = new Date(orig);
    proposed.setDate(proposed.getDate() + days);
    const newDate = proposed > max ? max : proposed;
    await api.patch("accounting_payment_retries", retry.id, {
      rescheduled_due_date: newDate.toISOString().slice(0, 10),
      next_retry_at: new Date(newDate).toISOString(),
      reschedule_requested_by: "staff",
      reschedule_requested_at: new Date().toISOString(),
    });
    onRefresh();
  }

  async function markCollected(retry: PaymentRetry) {
    await api.patch("accounting_payment_retries", retry.id, { status: "collected", resolved_at: new Date().toISOString() });
    onRefresh();
  }

  async function cancelRetry(retry: PaymentRetry) {
    await api.patch("accounting_payment_retries", retry.id, { status: "cancelled", resolved_at: new Date().toISOString() });
    onRefresh();
  }

  const PROCESSOR_LABELS: Record<string, string> = { paycompass: "PayCompass / Amex", lawpay: "LawPay" };

  const STEPS: EnrollStep[] = isThirdParty
    ? ["method", "third_party", "approval"]
    : methodType === "card"
      ? ["method", "card_info", "billing_addr", "approval"]
      : ["method", "approval"];

  const stepIdx   = STEPS.indexOf(step);
  const isLastStep = stepIdx === STEPS.length - 1;

  function formatCardNumber(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  }

  function formatExpiry(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
    return digits;
  }

  const APPROVAL_STATUS_CFG: Record<string, { label: string; color: string }> = {
    pending:    { label: "Pending",    color: "text-slate-600" },
    sent:       { label: "Sent — Awaiting Response", color: "text-amber-700" },
    approved:   { label: "Client Approved", color: "text-emerald-700" },
    declined:   { label: "Client Declined", color: "text-rose-700" },
    overridden: { label: "Staff Override (verbal auth)", color: "text-sky-700" },
  };

  return (
    <div className="space-y-5">
      {/* Enrollment status card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-700" />
            <p className="text-xs font-bold text-slate-900 uppercase tracking-wide">Autopay Enrollment</p>
          </div>
          {enrollment?.is_active && (
            <button onClick={deactivate} className="text-[10px] text-rose-700 hover:text-rose-700 border border-red-500/20 rounded-lg px-2 py-1 transition-colors">
              Deactivate
            </button>
          )}
        </div>

        {enrollment ? (
          <div className="space-y-4">
            {/* Status row */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${enrollment.is_active ? "bg-emerald-400 animate-pulse" : "bg-slate-300"}`} />
              <span className={`text-sm font-semibold ${enrollment.is_active ? "text-emerald-700" : "text-slate-600"}`}>
                {enrollment.is_active ? "Active" : "Inactive"}
              </span>
              {enrollment.approval_status && (
                <span className={`text-[10px] font-bold ml-1 ${APPROVAL_STATUS_CFG[enrollment.approval_status]?.color ?? "text-slate-600"}`}>
                  · {APPROVAL_STATUS_CFG[enrollment.approval_status]?.label}
                </span>
              )}
            </div>

            {/* Awaiting approval banner */}
            {enrollment.approval_status === "sent" && !enrollment.is_active && (
              <div className="flex items-center gap-3 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
                <Clock className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900">Awaiting client approval via {enrollment.approval_sent_via?.toUpperCase()}</p>
                  <p className="text-[10px] text-slate-600">Sent {fmtDate(enrollment.approval_sent_at)}. Autopay will activate once approved.</p>
                </div>
                <button onClick={markApproved} className="flex-shrink-0 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-900 px-3 py-1.5 rounded-xl transition-colors">
                  Mark Approved
                </button>
              </div>
            )}

            {/* Payment info grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-slate-500">Processor: </span><span className="text-slate-900">{PROCESSOR_LABELS[enrollment.processor] ?? enrollment.processor}</span></div>
              <div><span className="text-slate-500">Method: </span><span className="text-slate-900 capitalize">{enrollment.payment_method_type ?? "—"} {enrollment.payment_method_last4 ? `····${enrollment.payment_method_last4}` : ""}{enrollment.card_brand ? ` · ${enrollment.card_brand}` : ""}</span></div>
              {enrollment.card_expiry && <div><span className="text-slate-500">Expires: </span><span className="text-slate-900">{enrollment.card_expiry}</span></div>}
              {enrollment.billing_address_zip && <div><span className="text-slate-500">Billing ZIP: </span><span className="text-slate-900">{enrollment.billing_address_zip}</span></div>}
              <div><span className="text-slate-500">Enrolled by: </span><span className="text-slate-900">{enrollment.enrolled_by ?? "—"}</span></div>
              <div><span className="text-slate-500">Date: </span><span className="text-slate-900">{fmtDate(enrollment.enrolled_at)}</span></div>
              {enrollment.approval_override && <div className="col-span-2 text-sky-700 text-[10px]">Staff override: {enrollment.approval_override_reason}</div>}
            </div>

            {/* 3rd party info */}
            {enrollment.is_third_party && (
              <div className="bg-sky-50 border border-sky-500/20 rounded-xl px-4 py-3 space-y-1">
                <p className="text-[10px] font-bold text-sky-700 uppercase tracking-widest">3rd Party Payee</p>
                <p className="text-xs text-slate-900">{enrollment.third_party_name}</p>
                <div className="text-[10px] text-slate-600 flex gap-3 flex-wrap">
                  {enrollment.third_party_email && <span>{enrollment.third_party_email}</span>}
                  {enrollment.third_party_phone && <span>{enrollment.third_party_phone}</span>}
                  <span className="capitalize">{enrollment.third_party_method?.replace("_", " ") ?? ""}</span>
                  {enrollment.third_party_paid_at && <span className="text-emerald-700">Paid {fmtDate(enrollment.third_party_paid_at)}</span>}
                </div>
                <div className="flex gap-3 text-[10px]">
                  <span className={enrollment.third_party_client_signed ? "text-emerald-700" : "text-slate-500"}>
                    {enrollment.third_party_client_signed ? "✓ Client signed" : "Client signature pending"}
                  </span>
                  <span className={enrollment.third_party_payee_signed ? "text-emerald-700" : "text-slate-500"}>
                    {enrollment.third_party_payee_signed ? "✓ 3rd party signed" : "3rd party signature pending"}
                  </span>
                </div>
              </div>
            )}

            <button onClick={() => { setEnrolling(true); setStep("method"); }} className="text-xs text-slate-500 hover:text-slate-900 transition-colors underline underline-offset-2">
              Edit enrollment
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-slate-300" />
              <span className="text-sm text-slate-500">Not enrolled in autopay</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setIsThirdParty(false); setEnrolling(true); setStep("method"); }}
                className="flex items-center gap-2 bg-amber-100 border border-amber-400/30 hover:bg-amber-400/25 text-amber-700 text-xs font-bold px-3 py-2 rounded-xl transition-all">
                <Plus className="w-3.5 h-3.5" /> Enroll Client
              </button>
              <button onClick={() => { setIsThirdParty(true); setEnrolling(true); setStep("third_party"); }}
                className="flex items-center gap-2 bg-sky-50 border border-sky-500/20 hover:bg-sky-100 text-sky-300 text-xs font-bold px-3 py-2 rounded-xl transition-all">
                <Users className="w-3.5 h-3.5" /> 3rd Party Payee
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Enrollment wizard ── */}
      {enrolling && (
        <div className="bg-white border border-amber-400/20 rounded-2xl overflow-hidden">
          {/* Step progress */}
          <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                {i > 0 && <div className="w-4 h-px bg-slate-200" />}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${s === step ? "bg-amber-400/20 text-amber-700 border border-amber-400/30" : i < stepIdx ? "text-emerald-700" : "text-slate-600"}`}>
                  {i < stepIdx ? "✓ " : ""}{s === "method" ? "Payment Method" : s === "card_info" ? "Card Info" : s === "billing_addr" ? "Billing Address" : s === "approval" ? "Approval" : "3rd Party"}
                </span>
              </div>
            ))}
            <button onClick={resetForm} className="ml-auto text-slate-500 hover:text-slate-900 transition-colors"><X className="w-3.5 h-3.5" /></button>
          </div>

          {err && <div className="mx-5 mt-4 text-xs text-rose-700 bg-rose-50 border border-red-500/20 rounded-xl px-3 py-2">{err}</div>}

          <div className="p-5 space-y-4">

            {/* ── Step: Method ── */}
            {step === "method" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Processor</label>
                    <select value={processor} onChange={e => setProcessor(e.target.value as typeof processor)} className={inp}>
                      <option value="lawpay">LawPay</option>
                      <option value="paycompass">PayCompass / Amex</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Payment Method</label>
                    <select value={methodType} onChange={e => setMethodType(e.target.value as typeof methodType)} className={inp}>
                      <option value="card">Credit / Debit Card</option>
                      <option value="ach">ACH / Bank Account</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={lbl}>Enrolled By (staff)</label>
                    <input value={enrolledBy} onChange={e => setEnrolledBy(e.target.value)} placeholder="Your name" className={inp} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step: Card Info ── */}
            {step === "card_info" && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[10px] text-slate-600">
                  <Shield className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0 mt-0.5" />
                  Full card details are collected and stored encrypted. Client approval will be requested before autopay activates.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={lbl}>Card Number</label>
                    <input value={cardNumber} onChange={e => setCardNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" maxLength={19} className={inp + " font-mono tracking-widest"} />
                  </div>
                  <div>
                    <label className={lbl}>Expiration (MM/YY)</label>
                    <input value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" maxLength={5} className={inp + " font-mono"} />
                  </div>
                  <div>
                    <label className={lbl}>CVV / Security Code</label>
                    <input value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="000" maxLength={4} className={inp + " font-mono"} />
                  </div>
                  <div className="col-span-2">
                    <label className={lbl}>Card Brand</label>
                    <select value={cardBrand} onChange={e => setCardBrand(e.target.value)} className={inp}>
                      <option value="">Auto-detect / Unknown</option>
                      <option>Visa</option><option>Mastercard</option><option>Amex</option><option>Discover</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step: Billing Address ── */}
            {step === "billing_addr" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={lbl}>Billing Address</label>
                    <input value={addrLine1} onChange={e => setAddrLine1(e.target.value)} placeholder="123 Main St" className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>City</label>
                    <input value={addrCity} onChange={e => setAddrCity(e.target.value)} placeholder="Chicago" className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>State</label>
                    <input value={addrState} onChange={e => setAddrState(e.target.value.toUpperCase().slice(0,2))} placeholder="IL" maxLength={2} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>ZIP Code</label>
                    <input value={addrZip} onChange={e => setAddrZip(e.target.value.replace(/\D/g,"").slice(0,5))} placeholder="60601" maxLength={5} className={inp} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step: 3rd Party ── */}
            {step === "third_party" && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 bg-sky-50 border border-sky-500/20 rounded-xl px-4 py-3 text-[10px] text-slate-600">
                  <Users className="w-3.5 h-3.5 text-sky-700 flex-shrink-0 mt-0.5" />
                  A third party will assist with fees. Provide at least a name plus either email or phone. Both the client and the third party must sign the authorization before the card is run.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={lbl}>Third Party Name <span className="text-rose-700">*</span></label>
                    <input value={tpName} onChange={e => setTpName(e.target.value)} placeholder="Full name" className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Email</label>
                    <input type="email" value={tpEmail} onChange={e => setTpEmail(e.target.value)} placeholder="email@example.com" className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Phone</label>
                    <input value={tpPhone} onChange={e => setTpPhone(e.target.value)} placeholder="(312) 555-0000" className={inp} />
                  </div>
                  <div className="col-span-2">
                    <label className={lbl}>Payment Method</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([["pay_link", "Send Payment Link", "We send a payment link — they pay and system records it automatically."], ["card_auth", "Card Authorization", "Collect their card info. Both must sign authorization form before charging."]] as const).map(([val, label, desc]) => (
                        <button key={val} type="button" onClick={() => setTpMethod(val)}
                          className={`text-left p-3 rounded-xl border transition-all ${tpMethod === val ? "border-sky-500/40 bg-sky-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"}`}>
                          <p className={`text-xs font-bold mb-0.5 ${tpMethod === val ? "text-sky-300" : "text-slate-700"}`}>{label}</p>
                          <p className="text-[10px] text-slate-500 leading-relaxed">{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step: Approval ── */}
            {step === "approval" && (
              <div className="space-y-4">
                <div className="bg-slate-100/50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-slate-900">Client Approval</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    By default, we send the client a confirmation request before activating autopay.
                    If the client has already verbally authorized (per our retainer agreement), you may override.
                  </p>

                  {/* Send approval toggle */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div onClick={() => { setSendApproval(v => !v); if (!sendApproval) setOverrideApproval(false); }}
                      className={`w-9 h-5 rounded-full transition-all flex items-center px-0.5 ${sendApproval ? "bg-emerald-500" : "bg-slate-200"}`}>
                      <div className={`w-4 h-4 rounded-full bg-white transition-all ${sendApproval ? "translate-x-4" : ""}`} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">Send approval request to client</p>
                      <p className="text-[10px] text-slate-500">Default — recommended</p>
                    </div>
                  </label>

                  {sendApproval && !overrideApproval && (
                    <div>
                      <label className={lbl}>Send via</label>
                      <div className="flex gap-2">
                        {(["sms", "email"] as const).map(v => (
                          <button key={v} type="button" onClick={() => setApprovalVia(v)}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${approvalVia === v ? "border-emerald-500/40 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                            {v === "sms" ? "Text Message" : "Email"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Override section */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div onClick={() => { setOverrideApproval(v => !v); if (!overrideApproval) setSendApproval(false); }}
                      className={`w-9 h-5 rounded-full transition-all flex items-center px-0.5 ${overrideApproval ? "bg-sky-500" : "bg-slate-200"}`}>
                      <div className={`w-4 h-4 rounded-full bg-white transition-all ${overrideApproval ? "translate-x-4" : ""}`} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">Staff override — verbal authorization</p>
                      <p className="text-[10px] text-slate-500">Client authorized over the phone per retainer agreement</p>
                    </div>
                  </label>
                  {overrideApproval && (
                    <div>
                      <label className={lbl}>Override reason / note</label>
                      <input value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="e.g. Client confirmed by phone on 5/4/2026" className={inp} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Nav buttons */}
            <div className="flex justify-between gap-2 pt-1">
              <button onClick={() => stepIdx > 0 ? setStep(STEPS[stepIdx - 1]) : resetForm()} className="text-xs text-slate-600 hover:text-slate-900 px-3 py-2 transition-colors">
                {stepIdx === 0 ? "Cancel" : "← Back"}
              </button>
              {isLastStep ? (
                <button onClick={enroll} disabled={saving}
                  className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold text-xs px-5 py-2 rounded-xl transition-all">
                  {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {saving ? "Saving…" : (sendApproval && !overrideApproval) ? "Save & Send Approval" : "Activate Autopay"}
                </button>
              ) : (
                <button onClick={() => setStep(STEPS[stepIdx + 1])}
                  className="flex items-center gap-1.5 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold text-xs px-5 py-2 rounded-xl transition-all">
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Processor → Account routing reference */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Processor → Account Routing</p>
        <div className="space-y-1.5">
          {merchantAccounts.filter(m => m.is_active).map(m => (
            <div key={m.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${m.processor === "lawpay" ? "bg-sky-100 text-sky-700" : "bg-orange-500/15 text-orange-400"}`}>
                  {m.processor === "lawpay" ? "LawPay" : "PayCompass"}
                </span>
                <span className="text-slate-600">{m.account_label}</span>
              </div>
              <span className="text-slate-600">{m.bank_name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Active declined retries */}
      {activeRetries.length > 0 && (
        <div className="bg-white border border-red-500/25 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <WifiOff className="w-4 h-4 text-rose-700" />
            <p className="text-xs font-bold text-rose-700 uppercase tracking-wide">Declined Payments — Active Retries</p>
          </div>
          <div className="space-y-3">
            {activeRetries.map(retry => {
              const maxDate = new Date(retry.max_retry_date);
              const daysLeft = Math.ceil((maxDate.getTime() - Date.now()) / 86400000);
              return (
                <div key={retry.id} className="bg-white/80 border border-slate-200 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{fmt(retry.amount)}</p>
                      <p className="text-[10px] text-slate-500">
                        Original due: {fmtDate(retry.original_due_date)} · Attempt #{retry.attempt_count}
                        {retry.rescheduled_due_date && ` · Rescheduled to: ${fmtDate(retry.rescheduled_due_date)}`}
                      </p>
                      {retry.decline_reason && <p className="text-[10px] text-rose-700 mt-0.5">{retry.decline_reason}</p>}
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-1 rounded-lg ${daysLeft <= 3 ? "bg-rose-100 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                      {daysLeft > 0 ? `${daysLeft}d left` : "Expired"}
                    </div>
                  </div>
                  <div className="text-[10px] text-amber-700 mb-2">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Hard deadline: {fmtDate(retry.max_retry_date)} (14 days from original due date — cannot be extended)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => reschedule(retry, 3)} className="text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> +3 days
                    </button>
                    <button onClick={() => reschedule(retry, 7)} className="text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> +7 days
                    </button>
                    <button onClick={() => reschedule(retry, 14)} className="text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Max (14d)
                    </button>
                    <button onClick={() => markCollected(retry)} className="text-[10px] font-semibold bg-emerald-100 hover:bg-emerald-100 text-emerald-700 border border-emerald-500/25 px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
                      <Check className="w-3 h-3" /> Mark Collected
                    </button>
                    <button onClick={() => cancelRetry(retry)} className="text-[10px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-red-500/20 px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
                      <Ban className="w-3 h-3" /> Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cancellations View ───────────────────────────────────────────────────────

// AI retention bot responses keyed by reason category
const AI_RETENTION_SCRIPTS: Record<string, string[]> = {
  cannot_afford: [
    "I completely understand — financial stress is exactly why bankruptcy protection exists. Before we discuss cancellation, I want to make sure you know a few things that might help.",
    "We can adjust your payment schedule to a smaller amount spread over a longer period. Would a reduction in your installment amount make it more manageable right now?",
    "Our firm also has a hardship deferral option. If you are experiencing a short-term setback, we can pause your payments for up to 60 days without any penalty. Would that help?",
    "It is also worth noting: if you cancel now, your debts remain — and without the automatic stay bankruptcy provides, creditors can resume garnishments, lawsuits, and collection calls. Your case can be refiled, but you would likely lose any fees already paid. Is there any arrangement we can offer that would allow you to continue?",
  ],
  changed_mind: [
    "I hear you, and I want to make sure this is the right decision for you. Before we proceed, may I ask — what specifically changed your mind?",
    "Sometimes clients have concerns about the process, privacy, or impact on credit that can be addressed. If there is anything specific worrying you, I am happy to clarify.",
    "If the concern is about your credit score — yes, bankruptcy does impact credit, but so do ongoing charge-offs, judgments, and garnishments. Many clients see their credit improve within 12–18 months after discharge. Is that a factor?",
    "Our attorney is also happy to schedule a quick 15-minute call at no charge to address any specific concerns you have before you make a final decision.",
  ],
  circumstances_changed: [
    "Thank you for letting us know. Changes in circumstances — a new job, an inheritance, a settlement — can genuinely affect whether bankruptcy is still the right path.",
    "However, it is worth having our attorney review your updated situation before cancelling. In some cases, the change actually strengthens your case or shifts you to a more favorable chapter.",
    "Would you be open to a brief call with our attorney to review how your changed circumstances affect your options? It is a 15-minute no-cost call and could save you significant money and stress.",
  ],
  other: [
    "I am sorry to hear you are considering cancellation. Could you tell me a little more about what is driving this decision? Understanding your specific concern helps me see if there is anything we can do.",
    "Our goal is to make sure you get the best possible outcome. If something about the process or communication has not met your expectations, I want to know so we can address it.",
    "Please know that our attorneys are available to speak with you directly. A brief call can often resolve concerns that feel insurmountable in writing. Would you like us to schedule one?",
  ],
};

function CancellationsView({ clients, cancelRequests, cancelTasks, disengagementNotices, feeStructures, payments, timeLog, adminUser, onRefresh }: {
  clients: AClient[];
  cancelRequests: CancelRequest[];
  cancelTasks: CancelRequestTask[];
  disengagementNotices: DisengagementNotice[];
  feeStructures: FeeStructure[];
  payments: Payment[];
  timeLog: TimeLogEntry[];
  adminUser: string | null;
  onRefresh: () => void;
}) {
  const role = roleOf(adminUser);
  const [filter, setFilter] = useState<"all" | "pending" | "saved" | "cancelled">("all");
  const [selected, setSelected] = useState<CancelRequest | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [completingTask, setCompletingTask] = useState<string | null>(null);
  const [issuingRefund, setIssuingRefund] = useState<string | null>(null);

  async function completeTask(taskId: string) {
    setCompletingTask(taskId);
    await api.patch("cancel_request_tasks", taskId, {
      status: "completed",
      completed_by: adminUser ?? "Staff",
      completed_at: new Date().toISOString(),
    });
    setCompletingTask(null);
    onRefresh();
  }

  async function markRefundIssued(noticeId: string) {
    setIssuingRefund(noticeId);
    await api.patch("disengagement_notices", noticeId, {
      refund_status: "issued",
      refund_issued_at: new Date().toISOString(),
      refund_authorized_by: adminUser ?? "Staff",
      status: "refund_issued",
    });
    setIssuingRefund(null);
    onRefresh();
  }

  const pendingTasks       = cancelTasks.filter(t => t.status === "pending" || t.status === "in_progress");
  const pendingRefundItems = disengagementNotices.filter(n => n.refund_status === "calculated" || n.refund_status === "approved");

  const filtered = cancelRequests
    .filter(r => filter === "all" || r.status === filter)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const pending   = cancelRequests.filter(r => r.status === "pending").length;
  const saved     = cancelRequests.filter(r => r.status === "saved").length;
  const cancelled = cancelRequests.filter(r => r.status === "cancelled").length;
  const savedRate = cancelRequests.length > 0 ? Math.round(saved / (saved + cancelled || 1) * 100) : 0;

  const STATUS_STYLES = {
    pending:   "bg-amber-50 border-amber-400/25 text-amber-700",
    saved:     "bg-emerald-50 border-emerald-500/25 text-emerald-700",
    cancelled: "bg-rose-50 border-red-500/25 text-rose-700",
  };

  return (
    <div className="px-6 py-6 overflow-y-auto h-full space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pending Review", value: pending, color: "text-amber-700" },
          { label: "Clients Saved", value: saved, color: "text-emerald-700" },
          { label: "Cancelled", value: cancelled, color: "text-rose-700" },
          { label: "Save Rate", value: `${savedRate}%`, color: savedRate >= 60 ? "text-emerald-700" : "text-amber-700" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pending cancel tasks */}
      {pendingTasks.length > 0 && (
        <div className="bg-white border border-amber-400/20 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-700" />
            <span className="text-xs font-bold text-amber-700">Pending Action Items ({pendingTasks.length})</span>
          </div>
          <div className="divide-y divide-slate-800/40">
            {pendingTasks.map(task => {
              const client = clients.find(c => c.id === task.client_id);
              return (
                <div key={task.id} className="px-4 py-3 flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${task.task_type === "pause_payments" ? "bg-amber-50" : task.task_type === "attorney_outreach" ? "bg-sky-50" : "bg-rose-50"}`}>
                    {task.task_type === "pause_payments" ? <PauseCircle className="w-3.5 h-3.5 text-amber-700" /> :
                     task.task_type === "attorney_outreach" ? <UserCheck className="w-3.5 h-3.5 text-sky-700" /> :
                     <BadgeDollarSign className="w-3.5 h-3.5 text-rose-700" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900">{task.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{client?.full_name ?? "Unknown"} · {task.assigned_role.replace(/_/g, " ")}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${task.status === "pending" ? "bg-amber-50 border-amber-400/25 text-amber-700" : "bg-sky-50 border-sky-500/25 text-sky-700"}`}>
                    {task.status}
                  </span>
                  {(role === "accounting_super_admin" || role === "super_admin") && (
                    <button onClick={() => completeTask(task.id)} disabled={completingTask === task.id}
                      className="flex-shrink-0 flex items-center gap-1 text-[11px] bg-emerald-50 hover:bg-emerald-100 border border-emerald-500/25 text-emerald-700 font-semibold px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40">
                      <Check className="w-3 h-3" /> Done
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending refunds */}
      {pendingRefundItems.length > 0 && (
        <div className="bg-white border border-red-500/20 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
            <BadgeDollarSign className="w-4 h-4 text-rose-700" />
            <span className="text-xs font-bold text-rose-700">Unearned Fee Refunds ({pendingRefundItems.length})</span>
          </div>
          <div className="divide-y divide-slate-800/40">
            {pendingRefundItems.map(notice => (
              <div key={notice.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900">{notice.client_name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{notice.client_email ?? "No email"}</p>
                  <div className="flex gap-3 mt-1.5 text-[11px]">
                    <span className="text-slate-600">Total Paid: <span className="text-slate-900 font-medium">{fmt(notice.total_paid)}</span></span>
                    <span className="text-slate-600">Earned: <span className="text-emerald-700 font-medium">{fmt(notice.earned_fees)}</span></span>
                    <span className="text-slate-600">Refund: <span className="text-rose-700 font-bold">{fmt(notice.refund_amount)}</span></span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border block mb-2 ${notice.refund_status === "approved" ? "bg-emerald-50 border-emerald-500/25 text-emerald-700" : "bg-amber-50 border-amber-400/25 text-amber-700"}`}>
                    {notice.refund_status}
                  </span>
                  {role === "accounting_super_admin" && notice.refund_status !== "issued" && (
                    <button onClick={() => markRefundIssued(notice.id)} disabled={issuingRefund === notice.id}
                      className="flex items-center gap-1 text-[11px] bg-emerald-50 hover:bg-emerald-100 border border-emerald-500/25 text-emerald-700 font-semibold px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40">
                      <Check className="w-3 h-3" /> Mark Issued
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter + add */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-3">
        <div className="flex gap-1">
          {(["all","pending","saved","cancelled"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all capitalize ${filter === f ? "bg-amber-400 text-slate-950" : "text-slate-500 hover:text-slate-700"}`}>
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={() => setShowNew(true)}
          className="ml-auto flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs px-3 py-2 rounded-xl transition-all">
          <Plus className="w-3.5 h-3.5" /> New Cancel Request
        </button>
      </div>

      {/* Request list */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle2 className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500">No cancel requests in this view</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {filtered.map(req => {
              const client = clients.find(c => c.id === req.client_id);
              return (
                <div key={req.id}
                  className="px-4 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setSelected(req)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-bold text-slate-900">{client?.full_name ?? "Unknown"}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[req.status]}`}>
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </span>
                        {req.ai_retention_outcome && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                            req.ai_retention_outcome === "saved" ? "bg-emerald-50 border-emerald-500/20 text-emerald-700" :
                            req.ai_retention_outcome === "irreversible" ? "bg-rose-50 border-red-500/20 text-rose-700" :
                            "bg-sky-50 border-sky-500/20 text-sky-700"
                          }`}>
                            {req.ai_retention_outcome === "saved" ? "Retained" : req.ai_retention_outcome === "irreversible" ? "Irreversible" : "AI: Escalated"}
                          </span>
                        )}
                        {req.retention_type && req.retention_type !== "cancelled" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold bg-teal-500/10 border-teal-500/20 text-teal-400">
                            {req.retention_type.replace(/^saved_/, "").replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600">
                        {req.reason_category ? req.reason_category.replace(/_/g, " ") : "No reason"} ·{" "}
                        {req.request_channel} · {fmtDate(req.created_at)}
                      </p>
                      {req.reason_detail && <p className="text-xs text-slate-600 mt-0.5 truncate">{req.reason_detail}</p>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0 mt-1" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <CancelRequestModal
          request={selected}
          client={clients.find(c => c.id === selected.client_id)}
          adminUser={adminUser}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); onRefresh(); }}
        />
      )}

      {/* New request modal */}
      {showNew && (
        <NewCancelRequestModal
          clients={clients}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Fee Adjustment Modal ─────────────────────────────────────────────────────

function FeeAdjustmentModal({ client, feeStructure, adminUser, onClose, onSaved }: {
  client: AClient;
  feeStructure: FeeStructure | null;
  adminUser: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const role = roleOf(adminUser);
  const origAttyFee  = feeStructure?.attorney_fee  ?? 0;
  const origCFF      = feeStructure?.court_filing_fee ?? 0;
  const origTotal    = feeStructure?.total_fee ?? 0;
  const origPayAmt   = feeStructure?.down_payment ?? 0;
  const origMonths   = feeStructure?.plan_months ?? 0;
  const origFreq     = feeStructure?.payment_frequency ?? "monthly";

  const [adjType,     setAdjType]     = useState<"attorney_fee" | "court_filing_fee" | "payment_plan" | "multiple">("attorney_fee");
  const [propAttyFee, setPropAttyFee] = useState(String(origAttyFee));
  const [propCFF,     setPropCFF]     = useState(String(origCFF));
  const [propPayAmt,  setPropPayAmt]  = useState(String(origPayAmt));
  const [propMonths,  setPropMonths]  = useState(String(origMonths));
  const [propFreq,    setPropFreq]    = useState(origFreq ?? "monthly");
  const [reason,      setReason]      = useState("");
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState("");

  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-300";
  const lbl = "text-xs font-semibold text-slate-600 mb-1.5 block";

  const isSuperAdmin = role === "super_admin" || role === "accounting_super_admin";

  const showAttyFee = adjType === "attorney_fee" || adjType === "multiple";
  const showCFF     = adjType === "court_filing_fee" || adjType === "multiple";
  const showPlan    = adjType === "payment_plan" || adjType === "multiple";

  async function submit() {
    if (!reason.trim()) { setErr("Please provide a reason for this adjustment."); return; }
    if (!adminUser) { setErr("You must be logged in to submit an adjustment."); return; }
    setSaving(true);
    setErr("");
    const proposedAttyFee = showAttyFee ? parseFloat(propAttyFee) || null : null;
    const proposedCFF     = showCFF     ? parseFloat(propCFF)     || null : null;
    const proposedPayAmt  = showPlan    ? parseFloat(propPayAmt)  || null : null;
    const proposedMonths  = showPlan    ? parseInt(propMonths)    || null : null;
    const proposedFreqVal = showPlan    ? propFreq                         : null;

    const reqData = {
      client_id: client.id,
      client_name: client.full_name,
      fee_structure_id: feeStructure?.id ?? null,
      adjustment_type: adjType,
      original_attorney_fee: origAttyFee,
      original_court_filing_fee: origCFF,
      original_total_fee: origTotal,
      original_payment_amount: origPayAmt,
      original_plan_months: origMonths,
      original_payment_frequency: origFreq,
      proposed_attorney_fee: proposedAttyFee,
      proposed_court_filing_fee: proposedCFF,
      proposed_payment_amount: proposedPayAmt,
      proposed_plan_months: proposedMonths,
      proposed_payment_frequency: proposedFreqVal,
      reason: reason.trim(),
      requested_by: adminUser ?? "Staff",
      status: isSuperAdmin ? "approved" : "pending",
    };

    await api.post("fee_adjustment_requests", reqData);

    // If super admin, apply immediately
    if (isSuperAdmin && feeStructure) {
      const patch: Record<string, number | string | null> = {};
      if (proposedAttyFee !== null) {
        patch.attorney_fee = proposedAttyFee;
        patch.total_fee    = proposedAttyFee + (proposedCFF ?? origCFF);
      }
      if (proposedCFF !== null) {
        patch.court_filing_fee = proposedCFF;
        patch.total_fee = (proposedAttyFee ?? origAttyFee) + proposedCFF;
      }
      if (proposedPayAmt !== null) patch.down_payment = proposedPayAmt;
      if (proposedMonths !== null) patch.plan_months  = proposedMonths;
      if (proposedFreqVal !== null) patch.payment_frequency = proposedFreqVal;
      if (Object.keys(patch).length > 0) {
        patch.updated_at = new Date().toISOString();
        await api.patch("accounting_fee_structures", feeStructure.id, patch);
      }
    }

    setSaving(false);
    onSaved();
  }

  const propAttyFeeNum = parseFloat(propAttyFee) || 0;
  const propCFFNum     = parseFloat(propCFF)     || 0;
  const newTotal = showAttyFee && showCFF ? propAttyFeeNum + propCFFNum
    : showAttyFee ? propAttyFeeNum + origCFF
    : showCFF     ? origAttyFee + propCFFNum
    : origTotal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Pencil className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Fee / Payment Adjustment</h3>
            <p className="text-[11px] text-slate-500">{client.full_name} · {client.client_id}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-900"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!isSuperAdmin && (
            <div className="bg-amber-50 border border-amber-400/20 rounded-xl px-3.5 py-2.5">
              <p className="text-[11px] text-amber-700 font-semibold">Requires Super Admin Attorney Approval</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Attorney fee and court filing fee changes must be reviewed and approved. Your request will be queued.</p>
            </div>
          )}
          {isSuperAdmin && (
            <div className="bg-emerald-50 border border-emerald-500/20 rounded-xl px-3.5 py-2.5">
              <p className="text-[11px] text-emerald-700 font-semibold">Super Admin — Changes Applied Immediately</p>
              <p className="text-[10px] text-slate-500 mt-0.5">As super admin, fee adjustments will be applied to the fee structure immediately.</p>
            </div>
          )}

          {err && <p className="text-xs text-rose-700 bg-rose-50 border border-red-500/20 rounded-xl px-3 py-2">{err}</p>}

          {/* Current values */}
          <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs space-y-1.5">
            <p className="font-semibold text-slate-700 mb-2">Current Fee Structure</p>
            <div className="grid grid-cols-3 gap-2">
              <div><p className="text-slate-500">Attorney Fee</p><p className="text-slate-900 font-semibold">{fmt(origAttyFee)}</p></div>
              <div><p className="text-slate-500">Court Filing Fee</p><p className="text-amber-700 font-semibold">{fmt(origCFF)}</p></div>
              <div><p className="text-slate-500">Total Fee</p><p className="text-slate-900 font-semibold">{fmt(origTotal)}</p></div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-slate-200/50 mt-1">
              <div><p className="text-slate-500">Payment Amt</p><p className="text-slate-900 font-semibold">{fmt(origPayAmt)}</p></div>
              <div><p className="text-slate-500">Plan Months</p><p className="text-slate-900 font-semibold">{origMonths || "—"}</p></div>
              <div><p className="text-slate-500">Frequency</p><p className="text-slate-900 font-semibold capitalize">{(origFreq ?? "—").replace(/_/g, " ")}</p></div>
            </div>
          </div>

          {/* Adjustment type */}
          <div>
            <label className={lbl}>Adjustment Type</label>
            <select value={adjType} onChange={e => setAdjType(e.target.value as typeof adjType)} className={inp}>
              <option value="attorney_fee">Attorney Fee Only</option>
              <option value="court_filing_fee">Court Filing Fee Only</option>
              <option value="payment_plan">Payment Plan (Amount / Months / Frequency)</option>
              <option value="multiple">Multiple (Fees + Plan)</option>
            </select>
          </div>

          {/* Proposed values */}
          <div className="space-y-3">
            {showAttyFee && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Original Attorney Fee</label>
                  <input readOnly value={fmt(origAttyFee)} className={inp + " text-slate-500 cursor-default"} />
                </div>
                <div>
                  <label className={lbl}>Proposed Attorney Fee <span className="text-amber-700">*</span></label>
                  <input type="number" value={propAttyFee} onChange={e => setPropAttyFee(e.target.value)} placeholder="e.g. 1500" className={inp} />
                </div>
              </div>
            )}
            {showCFF && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Original Court Filing Fee</label>
                  <input readOnly value={fmt(origCFF)} className={inp + " text-slate-500 cursor-default"} />
                </div>
                <div>
                  <label className={lbl}>Proposed Court Filing Fee <span className="text-amber-700">*</span></label>
                  <input type="number" value={propCFF} onChange={e => setPropCFF(e.target.value)} placeholder="e.g. 338" className={inp} />
                </div>
              </div>
            )}
            {showPlan && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Original Payment Amount</label>
                    <input readOnly value={fmt(origPayAmt)} className={inp + " text-slate-500 cursor-default"} />
                  </div>
                  <div>
                    <label className={lbl}>Proposed Payment Amount</label>
                    <input type="number" value={propPayAmt} onChange={e => setPropPayAmt(e.target.value)} placeholder="e.g. 200" className={inp} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Original Plan Months</label>
                    <input readOnly value={origMonths || "—"} className={inp + " text-slate-500 cursor-default"} />
                  </div>
                  <div>
                    <label className={lbl}>Proposed Plan Months</label>
                    <input type="number" value={propMonths} onChange={e => setPropMonths(e.target.value)} placeholder="e.g. 36" className={inp} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Original Frequency</label>
                    <input readOnly value={(origFreq ?? "—").replace(/_/g, " ")} className={inp + " text-slate-500 cursor-default capitalize"} />
                  </div>
                  <div>
                    <label className={lbl}>Proposed Frequency</label>
                    <select value={propFreq} onChange={e => setPropFreq(e.target.value)} className={inp}>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-Weekly</option>
                      <option value="semi_monthly">Semi-Monthly</option>
                      <option value="monthly">Monthly</option>
                      <option value="paid_in_full">Paid in Full</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* New total preview */}
            {(showAttyFee || showCFF) && (
              <div className="bg-sky-50 border border-sky-500/20 rounded-xl px-4 py-3 text-xs flex items-center justify-between">
                <span className="text-slate-600">New Total Fee</span>
                <span className="text-sky-300 font-bold text-base">{fmt(newTotal)}</span>
              </div>
            )}
          </div>

          <div>
            <label className={lbl}>Reason for Adjustment <span className="text-amber-700">*</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Explain the reason for this adjustment…" className={inp + " resize-none"} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button onClick={submit} disabled={saving || !reason.trim()}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold px-5 py-2 rounded-xl text-sm transition-all">
            <Check className="w-4 h-4" />
            {saving ? "Submitting…" : isSuperAdmin ? "Apply Adjustment" : "Submit for Approval"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Cancel Request Modal ─────────────────────────────────────────────────

function NewCancelRequestModal({ clients, onClose, onSaved }: {
  clients: AClient[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [channel, setChannel] = useState("phone");
  const [category, setCategory] = useState("");
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-300";

  async function save() {
    if (!clientId || !category) return;
    setSaving(true);
    const scripts = AI_RETENTION_SCRIPTS[category] ?? AI_RETENTION_SCRIPTS.other;
    const chatLog = scripts.map((msg, i) => ({
      role: "ai" as const,
      message: msg,
      ts: new Date(Date.now() + i * 1000).toISOString(),
    }));
    const result = await api.post("accounting_cancel_requests", {
      client_id: clientId,
      request_channel: channel,
      reason_category: category,
      reason_detail: detail || null,
      ai_chat_log: chatLog,
      ai_retention_outcome: category === "circumstances_changed" ? "irreversible" : "escalated",
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const cancelRequestId = Array.isArray(result) ? result[0]?.id : result?.id;
    const client = clients.find(c => c.id === clientId);
    if (cancelRequestId && client) {
      fetch(`${SUPABASE_URL}/functions/v1/client-lifecycle-alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON}` },
        body: JSON.stringify({
          action: "handle_cancel_request",
          cancel_request_id: cancelRequestId,
          client_id: clientId,
          client_name: client.full_name,
          client_email: client.email,
          reason: category,
        }),
      }).catch(() => {});
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
            <Ban className="w-4 h-4 text-rose-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">New Cancellation Request</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">AI retention bot will be loaded with appropriate scripts</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-900"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Client *</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={inp}>
              <option value="">Select client</option>
              {clients.filter(c => c.status === "active").map(c => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Channel</label>
              <select value={channel} onChange={e => setChannel(e.target.value)} className={inp}>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="portal">Client Portal</option>
                <option value="in_person">In Person</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Reason Category *</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className={inp}>
                <option value="">Select reason</option>
                <option value="cannot_afford">Cannot Afford Payments</option>
                <option value="changed_mind">Changed Mind</option>
                <option value="circumstances_changed">Change in Circumstances</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Client's Stated Reason</label>
            <textarea value={detail} onChange={e => setDetail(e.target.value)} rows={3}
              placeholder="What did the client say?"
              className={`${inp} resize-none`} />
          </div>
          {category === "circumstances_changed" && (
            <div className="bg-sky-50 border border-sky-500/20 rounded-xl px-3.5 py-2.5">
              <p className="text-[11px] text-sky-300 font-semibold">Change in Circumstances</p>
              <p className="text-[10px] text-slate-500 mt-0.5">This category will be flagged as potentially irreversible. Attorney review will be recommended before final cancellation.</p>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button onClick={save} disabled={!clientId || !category || saving}
            className="flex items-center gap-2 bg-red-500/80 hover:bg-red-500 disabled:opacity-40 text-slate-900 font-bold px-5 py-2 rounded-xl text-sm transition-all">
            <Ban className="w-4 h-4" />{saving ? "Creating…" : "Create Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cancel Request Detail Modal ──────────────────────────────────────────────

function CancelRequestModal({ request, client, adminUser, onClose, onSaved }: {
  request: CancelRequest;
  client: AClient | undefined;
  adminUser: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [staffNotes, setStaffNotes] = useState(request.staff_notes ?? "");
  const [outcome, setOutcome] = useState<"saved" | "cancelled">(request.status === "cancelled" ? "cancelled" : "saved");
  const [saving, setSaving] = useState(false);
  const [clientMsg, setClientMsg] = useState("");
  const [adjustments, setAdjustments] = useState<RetentionAdjustment[]>([]);
  const [chatLog, setChatLog] = useState<{ role: "ai" | "client"; message: string; ts: string }[]>(
    request.ai_chat_log ?? []
  );
  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-300";

  useEffect(() => {
    api.get(`cancel_retention_adjustments?cancel_request_id=eq.${request.id}&order=applied_at.asc`)
      .then(data => setAdjustments(Array.isArray(data) ? data : []));
  }, [request.id]);

  function sendClientMessage() {
    if (!clientMsg.trim()) return;
    const newMsg = { role: "client" as const, message: clientMsg.trim(), ts: new Date().toISOString() };
    // Generate a contextual AI response
    const aiResponse = getAIResponse(clientMsg.trim(), request.reason_category ?? "other");
    const aiMsg = { role: "ai" as const, message: aiResponse, ts: new Date(Date.now() + 500).toISOString() };
    setChatLog(prev => [...prev, newMsg, aiMsg]);
    setClientMsg("");
  }

  function getAIResponse(clientMessage: string, category: string): string {
    const msg = clientMessage.toLowerCase();
    if (msg.includes("yes") || msg.includes("okay") || msg.includes("sure") || msg.includes("agree")) {
      return "I am glad we can work something out. Our team will follow up with the adjusted arrangement within 1 business day. Thank you for giving us the opportunity to help you through this process.";
    }
    if (msg.includes("no") || msg.includes("cancel") || msg.includes("done") || msg.includes("final")) {
      return "I understand, and I respect your decision. Before we process the cancellation, I want to make sure you know that our attorney is available for a final 15-minute call if you have any last questions. Your fees paid to date will be reviewed for any applicable refund per your retainer agreement.";
    }
    if (msg.includes("money") || msg.includes("afford") || msg.includes("payment") || msg.includes("cost")) {
      return "Financial concerns are exactly why we offer flexible arrangements. Would it help to reduce your installment to the minimum required to keep your case active? Our billing team can restructure your schedule with no additional fees.";
    }
    if (msg.includes("time") || msg.includes("busy") || msg.includes("work")) {
      return "We understand life gets busy. Our process is designed to be as hands-off as possible for you — most of the work is done by our team. Would it help to assign you a dedicated paralegal point-of-contact so you do not need to manage the details?";
    }
    // Default fallback by category
    const fallbacks: Record<string, string> = {
      cannot_afford: "I hear you. Let me check what our minimum installment option would be — in some cases we can bring it down to $50–75/month to keep your case active while things stabilize.",
      changed_mind: "Could you help me understand what specific concern is driving this? There may be a misunderstanding about the process I can clear up, or our attorney can address directly.",
      circumstances_changed: "That is understandable. Given your changed situation, our attorney would still like a brief call to confirm whether bankruptcy is still the right path — sometimes it still is, and sometimes there are better alternatives we can suggest.",
      other: "Thank you for sharing that. I want to make sure we have explored every option before proceeding. Is there a specific outcome you were hoping for from our firm that we have not yet provided?",
    };
    return fallbacks[category] ?? fallbacks.other;
  }

  async function resolve() {
    setSaving(true);
    await api.patch("accounting_cancel_requests", request.id, {
      status: outcome,
      staff_reviewer: adminUser,
      staff_notes: staffNotes || null,
      ai_chat_log: chatLog,
      ai_retention_outcome: outcome === "saved" ? "saved" : request.reason_category === "circumstances_changed" ? "irreversible" : "escalated",
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    // If cancelled, mark client on_hold
    if (outcome === "cancelled") {
      await api.patch("accounting_clients", request.client_id, { status: "on_hold" });
    }
    setSaving(false);
    onSaved();
  }

  const STATUS_COLOR = { pending: "text-amber-700", saved: "text-emerald-700", cancelled: "text-rose-700" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
            <Ban className="w-4 h-4 text-rose-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{client?.full_name ?? "Unknown"} — Cancellation Request</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {request.reason_category?.replace(/_/g, " ")} · {request.request_channel} · {fmtDate(request.created_at)}
              {" · "}<span className={`font-semibold ${STATUS_COLOR[request.status]}`}>{request.status}</span>
            </p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-900 flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Client's stated reason */}
          {request.reason_detail && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1">Client's Stated Reason</p>
              <p className="text-sm text-slate-700">{request.reason_detail}</p>
            </div>
          )}

          {/* AI Retention Chat */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4 text-amber-700" />
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">AI Retention Conversation</p>
            </div>
            <div className="bg-white/80 border border-slate-200 rounded-xl p-3 space-y-2.5 max-h-64 overflow-y-auto">
              {chatLog.length === 0 && (
                <p className="text-xs text-slate-600 text-center py-4">No messages yet</p>
              )}
              {chatLog.map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.role === "client" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "ai" ? "bg-amber-400/20" : "bg-sky-100"}`}>
                    {msg.role === "ai" ? <Bot className="w-3 h-3 text-amber-700" /> : <Users className="w-3 h-3 text-sky-700" />}
                  </div>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${msg.role === "ai" ? "bg-slate-100 text-slate-700" : "bg-sky-100 border border-sky-500/20 text-sky-200"}`}>
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>
            {request.status === "pending" && (
              <div className="flex gap-2 mt-2">
                <input value={clientMsg} onChange={e => setClientMsg(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendClientMessage()}
                  placeholder="Enter client's response to continue the conversation…"
                  className="flex-1 bg-slate-100 border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-amber-400/60" />
                <button onClick={sendClientMessage} disabled={!clientMsg.trim()}
                  className="flex items-center gap-1.5 bg-amber-100 border border-amber-400/30 hover:bg-amber-400/25 text-amber-700 text-xs font-bold px-3 py-2 rounded-xl transition-all disabled:opacity-40">
                  <MessageSquare className="w-3.5 h-3.5" /> Send
                </button>
              </div>
            )}
          </div>

          {/* Retention adjustments history */}
          {adjustments.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-emerald-700" />
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Retention Adjustments Offered</p>
              </div>
              <div className="space-y-2">
                {adjustments.map(adj => (
                  <div key={adj.id} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900">{adj.description}</p>
                        <p className="text-[10px] text-slate-500 capitalize mt-0.5">{adj.adjustment_type.replace(/_/g, " ")}
                          {adj.original_value != null && adj.new_value != null && ` — ${fmt(adj.original_value)} → ${fmt(adj.new_value)}`}
                          {adj.original_date && adj.new_date && ` — ${adj.original_date} → ${adj.new_date}`}
                          {adj.original_frequency && adj.new_frequency && ` — ${adj.original_frequency} → ${adj.new_frequency}`}
                        </p>
                        {adj.notes && <p className="text-[10px] text-slate-600 mt-0.5">{adj.notes}</p>}
                      </div>
                      <span className="text-[9px] text-slate-600 flex-shrink-0">{fmtDate(adj.applied_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staff resolution */}
          {request.status === "pending" && (
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Staff Resolution</p>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Staff Notes</label>
                <textarea value={staffNotes} onChange={e => setStaffNotes(e.target.value)} rows={2}
                  placeholder="Internal notes — outcome, arrangement made, reason for cancellation…"
                  className={`${inp} resize-none text-xs`} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Resolution</label>
                <div className="flex gap-2">
                  <button onClick={() => setOutcome("saved")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold transition-all ${outcome === "saved" ? "bg-emerald-100 border-emerald-500/40 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    <CheckCircle2 className="w-4 h-4" /> Client Saved
                  </button>
                  <button onClick={() => setOutcome("cancelled")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold transition-all ${outcome === "cancelled" ? "bg-rose-100 border-red-500/40 text-rose-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    <Ban className="w-4 h-4" /> Confirm Cancellation
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {request.status === "pending" && (
          <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Close</button>
            <button onClick={resolve} disabled={saving}
              className={`flex items-center gap-2 font-bold px-5 py-2 rounded-xl text-sm transition-all disabled:opacity-40 ${
                outcome === "saved" ? "bg-emerald-500 hover:bg-emerald-400 text-slate-900" : "bg-red-500/80 hover:bg-red-500 text-slate-900"
              }`}>
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : outcome === "saved" ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
              {saving ? "Saving…" : outcome === "saved" ? "Save Client" : "Process Cancellation"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Trust Transfer Hub ───────────────────────────────────────────────────────

function TrustTransferHub({
  clients, payments, feeStructures, filedRegistry, ioltaSignoffs,
  trustAccounts, transfers, adminUser, onRefresh,
}: {
  clients: AClient[];
  payments: Payment[];
  feeStructures: FeeStructure[];
  filedRegistry: FiledCaseRegistry[];
  ioltaSignoffs: IoltaSignoff[];
  trustAccounts: TrustAccount[];
  transfers: FundTransfer[];
  adminUser: string | null;
  onRefresh: () => void;
}) {
  type HubTab = "pending" | "AZ" | "WA" | "TX" | "batches" | "log";
  const [hubTab, setHubTab]               = useState<HubTab>("pending");
  const [selected, setSelected]           = useState<Set<string>>(new Set()); // registry IDs
  const [batches, setBatches]             = useState<BatchTransferRequest[]>([]);
  const [batchItems, setBatchItems]       = useState<BatchTransferItem[]>([]);
  const [ioltaLog, setIoltaLog]           = useState<IoltaBalanceLog[]>([]);
  const [loadingData, setLoadingData]     = useState(true);
  const [submitting, setSubmitting]       = useState(false);
  const [submittedBy, setSubmittedBy]     = useState(adminUser ?? "");
  const [approveModal, setApproveModal]   = useState<BatchTransferRequest | null>(null);
  const [executeModal, setExecuteModal]   = useState<BatchTransferRequest | null>(null);
  const [logFilter, setLogFilter]         = useState("all");

  const loadHub = useCallback(async () => {
    setLoadingData(true);
    const [b, bi, il] = await Promise.all([
      api.get("accounting_batch_transfer_requests?order=created_at.desc"),
      api.get("accounting_batch_transfer_items?order=created_at.desc"),
      api.get("accounting_iolta_balance_log?order=recorded_at.desc&limit=200"),
    ]);
    setBatches(b ?? []);
    setBatchItems(bi ?? []);
    setIoltaLog(il ?? []);
    setLoadingData(false);
  }, []);

  useEffect(() => { loadHub(); }, [loadHub]);

  // ── Clients eligible for trust transfer ──────────────────────────────────────
  // Criteria: registry entry exists, transfer_status === "signed_off",
  // iolta_balance_verified === true, iolta_verified_amount > 0,
  // AND not already in a pending/approved/executed batch
  const inFlightRegistryIds = new Set(
    batchItems
      .filter(bi => {
        const batch = batches.find(b => b.id === bi.batch_id);
        return batch && ["pending_approval","approved","executed"].includes(batch.status);
      })
      .map(bi => bi.registry_id)
      .filter(Boolean) as string[]
  );

  const readyEntries = filedRegistry.filter(r =>
    r.transfer_status === "signed_off" &&
    r.iolta_balance_verified &&
    (r.iolta_verified_amount ?? 0) > 0 &&
    !inFlightRegistryIds.has(r.id)
  );

  // Group ready entries by state
  const byState: Record<string, typeof readyEntries> = {};
  for (const r of readyEntries) {
    const st = r.state ?? "Unknown";
    if (!byState[st]) byState[st] = [];
    byState[st].push(r);
  }

  const totalSelectedAmount = readyEntries
    .filter(r => selected.has(r.id))
    .reduce((s, r) => s + (r.iolta_verified_amount ?? 0), 0);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(readyEntries.map(r => r.id)));
  }

  function selectNone() { setSelected(new Set()); }

  function selectState(st: string) {
    const ids = (byState[st] ?? []).map(r => r.id);
    const allIn = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allIn) { ids.forEach(id => next.delete(id)); }
      else { ids.forEach(id => next.add(id)); }
      return next;
    });
  }

  async function submitBatch() {
    if (selected.size === 0) return;
    setSubmitting(true);

    // Group selected by state so each state gets its own batch
    const byStateSel: Record<string, FiledCaseRegistry[]> = {};
    for (const r of readyEntries.filter(r => selected.has(r.id))) {
      const st = r.state ?? "Unknown";
      if (!byStateSel[st]) byStateSel[st] = [];
      byStateSel[st].push(r);
    }

    for (const [st, entries] of Object.entries(byStateSel)) {
      const stateKey = st.toLowerCase();
      const ioltaAcct  = trustAccounts.find(a => a.state === st && a.account_type === "iolta");
      const operAcct   = trustAccounts.find(a => a.state === st && a.account_type === "operating");
      const total = entries.reduce((s, r) => s + (r.iolta_verified_amount ?? 0), 0);

      const batchRes = await api.post("accounting_batch_transfer_requests", {
        state: st,
        iolta_account_id: ioltaAcct?.id ?? null,
        operating_account_id: operAcct?.id ?? null,
        total_amount: total,
        client_count: entries.length,
        status: "pending_approval",
        submitted_by: submittedBy || adminUser || "Staff",
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (batchRes && batchRes[0]) {
        const batchId = batchRes[0].id;
        for (const r of entries) {
          await api.post("accounting_batch_transfer_items", {
            batch_id: batchId,
            registry_id: r.id,
            client_id: r.client_id,
            iolta_amount: r.iolta_verified_amount ?? 0,
            included: true,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    setSelected(new Set());
    setSubmitting(false);
    await loadHub();
    onRefresh();
    setHubTab("batches");
  }

  async function approveBatch(batch: BatchTransferRequest, notes: string) {
    await api.patch("accounting_batch_transfer_requests", batch.id, {
      status: "approved",
      approved_by: adminUser,
      approved_at: new Date().toISOString(),
      approval_notes: notes || null,
      updated_at: new Date().toISOString(),
    });
    setApproveModal(null);
    await loadHub();
  }

  async function rejectBatch(batch: BatchTransferRequest, reason: string) {
    await api.patch("accounting_batch_transfer_requests", batch.id, {
      status: "rejected",
      approved_by: adminUser,
      approved_at: new Date().toISOString(),
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    });
    setApproveModal(null);
    await loadHub();
  }

  async function executeBatch(batch: BatchTransferRequest, execNotes: string) {
    // Get included items for this batch
    const items = batchItems.filter(bi => bi.batch_id === batch.id && bi.included);
    const now = new Date().toISOString();
    const executor = adminUser ?? "Staff";

    // 1. Mark each registry entry as transferred
    for (const item of items) {
      if (item.registry_id) {
        await api.patch("accounting_filed_case_registry", item.registry_id, {
          transfer_status: "transferred",
          transferred_at: now,
          transferred_by: executor,
          transfer_notes: execNotes || null,
          updated_at: now,
        });
      }
    }

    // 2. Record fund transfer in accounting_fund_transfers
    if (batch.iolta_account_id && batch.operating_account_id) {
      await api.post("accounting_fund_transfers", {
        from_account_id: batch.iolta_account_id,
        to_account_id: batch.operating_account_id,
        amount: batch.total_amount,
        transfer_date: now,
        reason: `Batch transfer — ${batch.client_count} client(s) — ${batch.state}`,
        executed_by: executor,
        status: "executed",
        notes: execNotes || null,
        created_at: now,
      });

      // 3. Update IOLTA account balance
      const ioltaAcct = trustAccounts.find(a => a.id === batch.iolta_account_id);
      if (ioltaAcct) {
        const newBalance = ioltaAcct.current_balance - batch.total_amount;
        await api.patch("accounting_trust_accounts", ioltaAcct.id, {
          current_balance: newBalance,
          updated_at: now,
        });

        // 4. Log the debit
        await api.post("accounting_iolta_balance_log", {
          trust_account_id: ioltaAcct.id,
          state: batch.state,
          account_type: "iolta",
          event_type: "transfer_out",
          amount: -batch.total_amount,
          balance_after: newBalance,
          related_batch_id: batch.id,
          description: `Batch transfer to operating — ${batch.client_count} client(s) approved by ${batch.approved_by}`,
          recorded_by: executor,
          recorded_at: now,
        });
      }

      // 5. Update operating account balance
      const operAcct = trustAccounts.find(a => a.id === batch.operating_account_id);
      if (operAcct) {
        const newBalance = operAcct.current_balance + batch.total_amount;
        await api.patch("accounting_trust_accounts", operAcct.id, {
          current_balance: newBalance,
          updated_at: now,
        });

        // Log the credit
        await api.post("accounting_iolta_balance_log", {
          trust_account_id: operAcct.id,
          state: batch.state,
          account_type: "operating",
          event_type: "transfer_in",
          amount: batch.total_amount,
          balance_after: newBalance,
          related_batch_id: batch.id,
          description: `Received from IOLTA — batch ${batch.id.slice(0, 8)} — ${batch.client_count} client(s)`,
          recorded_by: executor,
          recorded_at: now,
        });
      }
    }

    // 6. Mark batch executed
    await api.patch("accounting_batch_transfer_requests", batch.id, {
      status: "executed",
      executed_at: now,
      executed_by: executor,
      updated_at: now,
    });

    setExecuteModal(null);
    await loadHub();
    onRefresh();
  }

  // ── IOLTA balance by state (live from trustAccounts) ─────────────────────────
  const ioltaByState = ACTIVE_STATES.map(st => ({
    state: st,
    iolta: trustAccounts.find(a => a.state === st && a.account_type === "iolta"),
    operating: trustAccounts.find(a => a.state === st && a.account_type === "operating"),
  }));

  const STATUS_STYLES: Record<string, string> = {
    pending_approval: "bg-amber-50 border-amber-400/25 text-amber-700",
    approved:         "bg-sky-50 border-sky-500/25 text-sky-700",
    rejected:         "bg-rose-50 border-red-500/25 text-rose-700",
    executed:         "bg-emerald-50 border-emerald-500/25 text-emerald-700",
  };
  const STATUS_LABELS: Record<string, string> = {
    pending_approval: "Pending Attorney Approval",
    approved:         "Approved — Ready to Execute",
    rejected:         "Rejected",
    executed:         "Executed",
  };

  const filteredLog = logFilter === "all"
    ? ioltaLog
    : ioltaLog.filter(l => l.state === logFilter);

  // Pending transfers: filed cases not yet in signed_off/transferred status
  const pendingTransferEntries = filedRegistry.filter(r =>
    r.transfer_status !== "transferred" && r.transfer_status !== "signed_off"
  );

  const HUB_TABS: { id: HubTab; label: string; badge?: number }[] = [
    { id: "pending", label: "Pending Transfers", badge: pendingTransferEntries.length || undefined },
    { id: "AZ",      label: "AZ Trust", badge: readyEntries.filter(r => r.state === "AZ").length || undefined },
    { id: "WA",      label: "WA Trust", badge: readyEntries.filter(r => r.state === "WA").length || undefined },
    { id: "TX",      label: "TX Trust", badge: readyEntries.filter(r => r.state === "TX").length || undefined },
    { id: "batches", label: "Batch Requests",
      badge: batches.filter(b => b.status === "pending_approval" || b.status === "approved").length || undefined },
    { id: "log",     label: "IOLTA Balance Log" },
  ];

  return (
    <div className="px-6 py-6 overflow-y-auto h-full space-y-5">

      {/* Live IOLTA balances by state */}
      <div>
        <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Live Trust Account Balances</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ioltaByState.map(({ state: st, iolta, operating }) => (
            <div key={st} className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Vault className="w-3.5 h-3.5 text-amber-700" />
                </div>
                <span className="text-sm font-bold text-slate-900">{st}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">IOLTA / Trust</span>
                  <span className="text-sm font-bold text-amber-700">{fmt(iolta?.current_balance ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">Operating</span>
                  <span className="text-sm font-bold text-emerald-700">{fmt(operating?.current_balance ?? 0)}</span>
                </div>
                {iolta && <p className="text-[9px] text-slate-700 mt-1">{iolta.bank_name} · ····{iolta.account_number_last4 ?? "—"}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-white/80 border border-slate-200 rounded-xl p-1 w-fit">
        {HUB_TABS.map(t => (
          <button key={t.id} onClick={() => setHubTab(t.id)}
            className={`relative flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-lg transition-all ${
              hubTab === t.id ? "bg-amber-400 text-slate-950" : "text-slate-500 hover:text-slate-700"
            }`}>
            {t.label}
            {t.badge ? (
              <span className={`absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full ${
                hubTab === t.id ? "bg-slate-50 text-amber-700" : "bg-amber-400 text-slate-950"
              }`}>{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Pending Transfers ── */}
      {hubTab === "pending" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Cases that have been filed but trust funds have not yet been transferred out.</p>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-400/20 rounded-lg px-2.5 py-1">{pendingTransferEntries.length} case{pendingTransferEntries.length !== 1 ? "s" : ""}</span>
          </div>
          {pendingTransferEntries.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl px-6 py-12 text-center">
              <CheckCircle2 className="w-8 h-8 text-slate-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-500">No pending transfers</p>
              <p className="text-xs text-slate-700 mt-1">All filed cases have completed trust account transfers.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Client</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Case #</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Filed</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">State</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Chapter</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Transfer Status</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">IOLTA Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {pendingTransferEntries.map(r => {
                    const client = clients.find(c => c.id === r.client_id);
                    const statusColor =
                      r.transfer_status === "not_ready" ? "text-yellow-400" :
                      r.transfer_status === "pending_signoff" ? "text-sky-700" :
                      r.transfer_status === "signed_off" ? "text-emerald-700" : "text-slate-500";
                    const statusLabel =
                      r.transfer_status === "not_ready" ? "Pending Review" :
                      r.transfer_status === "pending_signoff" ? "IOLTA Verified" :
                      r.transfer_status === "signed_off" ? "Attorney Signed Off" :
                      r.transfer_status ?? "Unknown";
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{client?.full_name ?? "Unknown"}</td>
                        <td className="px-4 py-3 text-[11px] font-mono text-slate-600">{r.case_number ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{fmtDate(r.filed_date)}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{r.state ?? "—"}</td>
                        <td className="px-4 py-3">{chapterBadge(r.chapter)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-amber-700">
                          {r.iolta_verified_amount ? fmt(r.iolta_verified_amount) : <span className="text-slate-600 font-normal text-xs">Not set</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Per-State Trust Tabs (AZ / WA / TX) ── */}
      {(hubTab === "AZ" || hubTab === "WA" || hubTab === "TX") && (() => {
        const stateEntries = readyEntries.filter(r => r.state === hubTab);
        const stateTotal = stateEntries.reduce((s, r) => s + (r.iolta_verified_amount ?? 0), 0);
        const ioltaAcct = trustAccounts.find(a => a.state === hubTab && a.account_type === "iolta");
        const operAcct  = trustAccounts.find(a => a.state === hubTab && a.account_type === "operating");
        const allSelectedInState = stateEntries.every(r => selected.has(r.id));
        return (
          <div className="space-y-4">
            {/* Account info banner */}
            {(ioltaAcct || operAcct) && (
              <div className="flex flex-wrap items-center gap-4 bg-white border border-slate-200 rounded-2xl px-4 py-3">
                {ioltaAcct && (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Vault className="w-3.5 h-3.5 text-amber-700" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">IOLTA / Trust</p>
                      <p className="text-xs font-bold text-slate-900">{ioltaAcct.account_name}</p>
                      <p className="text-[10px] text-slate-600">{ioltaAcct.bank_name} · ····{ioltaAcct.account_number_last4 ?? "—"}</p>
                    </div>
                    <span className="text-sm font-bold text-amber-700 ml-4">{fmt(ioltaAcct.current_balance ?? 0)}</span>
                  </div>
                )}
                {operAcct && (
                  <div className="flex items-center gap-2 ml-auto">
                    <ArrowRightLeft className="w-4 h-4 text-slate-600" />
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Operating</p>
                      <p className="text-xs font-bold text-slate-900">{operAcct.account_name}</p>
                      <p className="text-[10px] text-slate-600">{operAcct.bank_name} · ····{operAcct.account_number_last4 ?? "—"}</p>
                    </div>
                    <span className="text-sm font-bold text-emerald-700 ml-4">{fmt(operAcct.current_balance ?? 0)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Selection toolbar */}
            <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => allSelectedInState ? stateEntries.forEach(r => setSelected(p => { const n = new Set(p); n.delete(r.id); return n; })) : stateEntries.forEach(r => setSelected(p => new Set([...p, r.id])))}
                  className="text-[10px] font-bold text-amber-700 hover:text-amber-700 bg-amber-50 border border-amber-400/20 rounded-lg px-2.5 py-1.5 transition-colors flex items-center gap-1">
                  <CheckSquare className="w-3 h-3" /> {allSelectedInState ? "Deselect All" : "Select All"}
                </button>
                <button onClick={selectNone} className="text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 transition-colors flex items-center gap-1">
                  <Square className="w-3 h-3" /> None
                </button>
              </div>
              <div className="flex-1 text-xs text-slate-600">
                {selected.size > 0
                  ? <span><span className="font-bold text-slate-900">{selected.size}</span> selected · <span className="font-bold text-amber-700">{fmt(totalSelectedAmount)}</span></span>
                  : <span className="text-slate-600">{stateEntries.length} {hubTab} entries ready for transfer · <span className="font-bold text-amber-700">{fmt(stateTotal)}</span> total</span>}
              </div>
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <input
                    value={submittedBy}
                    onChange={e => setSubmittedBy(e.target.value)}
                    placeholder="Your name"
                    className="bg-slate-100 border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-amber-400/60 w-36"
                  />
                  <button
                    onClick={submitBatch}
                    disabled={submitting || !submittedBy.trim()}
                    className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl transition-all">
                    {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <SendHorizonal className="w-3.5 h-3.5" />}
                    {submitting ? "Submitting…" : "Submit for Attorney Approval"}
                  </button>
                </div>
              )}
            </div>

            {stateEntries.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl px-6 py-12 text-center">
                <CheckCircle2 className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-500">No {hubTab} clients ready for transfer</p>
                <p className="text-xs text-slate-700 mt-1">Entries appear here once the attorney has signed off on the IOLTA balance.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="divide-y divide-slate-800/50">
                  {stateEntries.map(r => {
                    const client = clients.find(c => c.id === r.client_id);
                    const lastSO = ioltaSignoffs.filter(s => s.registry_id === r.id).sort((a,b) => new Date(b.signed_at).getTime() - new Date(a.signed_at).getTime())[0];
                    const isSel  = selected.has(r.id);
                    return (
                      <div key={r.id}
                        onClick={() => toggleSelect(r.id)}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isSel ? "bg-amber-400/5" : "hover:bg-slate-100/30"}`}>
                        <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-all ${isSel ? "bg-amber-400 border-amber-400" : "border-slate-300"}`}>
                          {isSel && <Check className="w-3 h-3 text-slate-950" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-900">{client?.full_name ?? "Unknown"}</span>
                            {chapterBadge(r.chapter)}
                            <span className="text-[10px] text-slate-600 font-mono">{r.case_number}</span>
                            <span className="text-[10px] text-slate-600">Filed {fmtDate(r.filed_date)}</span>
                          </div>
                          {lastSO && (
                            <p className="text-[10px] text-slate-600 mt-0.5">
                              Signed off by {lastSO.attorney_name} on {fmtDate(lastSO.signed_at)}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-amber-700">{fmt(r.iolta_verified_amount ?? 0)}</p>
                          <p className="text-[10px] text-slate-600">IOLTA verified</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-200">
                  <span className="text-[10px] text-slate-500">{stateEntries.filter(r => selected.has(r.id)).length} of {stateEntries.length} selected</span>
                  <span className="text-xs font-bold text-amber-700">{fmt(stateEntries.filter(r => selected.has(r.id)).reduce((s,r) => s + (r.iolta_verified_amount ?? 0), 0))} selected</span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Batch Requests ── */}
      {hubTab === "batches" && (
        <div className="space-y-4">
          {batches.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl px-6 py-12 text-center">
              <ClipboardList className="w-8 h-8 text-slate-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-500">No batch requests yet</p>
              <p className="text-xs text-slate-700 mt-1">Select clients from the "Ready to Transfer" tab and submit for attorney approval.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {batches.map(batch => {
                const items = batchItems.filter(bi => bi.batch_id === batch.id && bi.included);
                const ioltaAcct = trustAccounts.find(a => a.id === batch.iolta_account_id);
                const operAcct  = trustAccounts.find(a => a.id === batch.operating_account_id);
                return (
                  <div key={batch.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    {/* Batch header */}
                    <div className="px-4 py-3.5 border-b border-slate-200 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap mb-1">
                          <span className="text-sm font-bold text-slate-900">{batch.state} — Batch Transfer</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[batch.status]}`}>
                            {STATUS_LABELS[batch.status]}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
                          <span>{batch.client_count} client{batch.client_count !== 1 ? "s" : ""}</span>
                          <span className="font-bold text-amber-700">{fmt(batch.total_amount)}</span>
                          <span>Submitted by {batch.submitted_by} on {fmtDate(batch.submitted_at)}</span>
                          {ioltaAcct && <span>From: {ioltaAcct.account_name}</span>}
                          {operAcct  && <span>To: {operAcct.account_name}</span>}
                        </div>
                        {batch.approved_by && (
                          <p className="text-[10px] text-sky-700 mt-1">
                            {batch.status === "rejected" ? "Rejected" : "Approved"} by {batch.approved_by} · {fmtDate(batch.approved_at)}
                            {batch.approval_notes && <span className="text-slate-500"> — {batch.approval_notes}</span>}
                            {batch.rejection_reason && <span className="text-rose-700"> — {batch.rejection_reason}</span>}
                          </p>
                        )}
                        {batch.executed_at && (
                          <p className="text-[10px] text-emerald-700 mt-0.5">
                            Executed by {batch.executed_by} on {fmtDateTime(batch.executed_at)}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {batch.status === "pending_approval" && (
                          <button onClick={() => setApproveModal(batch)}
                            className="flex items-center gap-1.5 bg-sky-100 border border-sky-500/30 hover:bg-sky-500/25 text-sky-300 text-xs font-bold px-3 py-2 rounded-xl transition-all">
                            <Shield className="w-3.5 h-3.5" /> Review & Approve
                          </button>
                        )}
                        {batch.status === "approved" && (
                          <button onClick={() => setExecuteModal(batch)}
                            className="flex items-center gap-1.5 bg-emerald-100 border border-emerald-500/30 hover:bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-2 rounded-xl transition-all">
                            <ArrowRightLeft className="w-3.5 h-3.5" /> Execute Transfer
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Client list within batch */}
                    <div className="divide-y divide-slate-800/40">
                      {items.map(item => {
                        const client = clients.find(c => c.id === item.client_id);
                        const reg    = filedRegistry.find(r => r.id === item.registry_id);
                        return (
                          <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                            <div>
                              <span className="text-xs font-semibold text-slate-900">{client?.full_name ?? "Unknown"}</span>
                              {reg && <span className="text-[10px] text-slate-600 ml-2 font-mono">{reg.case_number}</span>}
                            </div>
                            <span className="text-xs font-bold text-amber-700">{fmt(item.iolta_amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── IOLTA Balance Log ── */}
      {hubTab === "log" && (
        <div className="space-y-4">
          {/* Filter + live balances */}
          <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-3">
            <span className="text-xs font-semibold text-slate-600">Filter by state:</span>
            {["all", ...ACTIVE_STATES].map(s => (
              <button key={s} onClick={() => setLogFilter(s)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${logFilter === s ? "bg-amber-400 text-slate-950" : "text-slate-500 hover:text-slate-700"}`}>
                {s === "all" ? "All" : s}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-slate-600">{filteredLog.length} entries</span>
          </div>

          {filteredLog.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl px-6 py-12 text-center">
              <History className="w-8 h-8 text-slate-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-500">No IOLTA balance entries yet</p>
              <p className="text-xs text-slate-700 mt-1">Log entries are created when trust transfers are executed.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">State</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Account</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Event</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Amount</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Balance After</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest hidden md:table-cell">Description</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest hidden sm:table-cell">By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLog.map(entry => {
                    const EVENT_COLORS: Record<string, string> = {
                      transfer_out: "text-rose-700",
                      transfer_in:  "text-emerald-700",
                      adjustment:   "text-amber-700",
                      snapshot:     "text-slate-600",
                    };
                    const EVENT_LABELS: Record<string, string> = {
                      transfer_out: "Transfer Out",
                      transfer_in:  "Transfer In",
                      adjustment:   "Adjustment",
                      snapshot:     "Snapshot",
                    };
                    return (
                      <tr key={entry.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtDateTime(entry.recorded_at)}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-900">{entry.state}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 capitalize">{entry.account_type}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold ${EVENT_COLORS[entry.event_type]}`}>
                            {EVENT_LABELS[entry.event_type]}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm font-bold text-right ${entry.amount < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                          {entry.amount < 0 ? "−" : "+"}{fmt(Math.abs(entry.amount))}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">{fmt(entry.balance_after)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell max-w-xs truncate">{entry.description ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">{entry.recorded_by ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Approve/Reject Modal ── */}
      {approveModal && (
        <ApproveTransferModal
          batch={approveModal}
          items={batchItems.filter(bi => bi.batch_id === approveModal.id && bi.included)}
          clients={clients}
          filedRegistry={filedRegistry}
          adminUser={adminUser}
          onApprove={(notes) => approveBatch(approveModal, notes)}
          onReject={(reason) => rejectBatch(approveModal, reason)}
          onClose={() => setApproveModal(null)}
        />
      )}

      {/* ── Execute Modal ── */}
      {executeModal && (
        <ExecuteBatchModal
          batch={executeModal}
          items={batchItems.filter(bi => bi.batch_id === executeModal.id && bi.included)}
          clients={clients}
          filedRegistry={filedRegistry}
          trustAccounts={trustAccounts}
          adminUser={adminUser}
          onExecute={(notes) => executeBatch(executeModal, notes)}
          onClose={() => setExecuteModal(null)}
        />
      )}
    </div>
  );
}

// ─── Approve Transfer Modal ───────────────────────────────────────────────────

function ApproveTransferModal({ batch, items, clients, filedRegistry, adminUser, onApprove, onReject, onClose }: {
  batch: BatchTransferRequest;
  items: BatchTransferItem[];
  clients: AClient[];
  filedRegistry: FiledCaseRegistry[];
  adminUser: string | null;
  onApprove: (notes: string) => void;
  onReject: (reason: string) => void;
  onClose: () => void;
}) {
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-300";

  async function confirm() {
    setSaving(true);
    if (decision === "approve") onApprove(notes);
    else onReject(notes);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-sky-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Attorney Review — {batch.state} Batch Transfer</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{batch.client_count} client{batch.client_count !== 1 ? "s" : ""} · {fmt(batch.total_amount)} total · Submitted by {batch.submitted_by}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-900 flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Client list */}
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Clients in This Batch</p>
            <div className="bg-white/80 border border-slate-200 rounded-xl divide-y divide-slate-800/50">
              {items.map(item => {
                const client = clients.find(c => c.id === item.client_id);
                const reg    = filedRegistry.find(r => r.id === item.registry_id);
                return (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{client?.full_name ?? "Unknown"}</p>
                      {reg && <p className="text-[10px] text-slate-500 font-mono">{reg.case_number} · Filed {fmtDate(reg.filed_date)}</p>}
                    </div>
                    <span className="text-sm font-bold text-amber-700">{fmt(item.iolta_amount)}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between px-3 py-2.5 bg-slate-100/30">
                <span className="text-xs font-bold text-slate-600">Total</span>
                <span className="text-sm font-bold text-amber-700">{fmt(batch.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Decision */}
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Attorney Decision</p>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setDecision("approve")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold transition-all ${decision === "approve" ? "bg-emerald-100 border-emerald-500/40 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                <CheckCircle2 className="w-4 h-4" /> Approve Transfer
              </button>
              <button onClick={() => setDecision("reject")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold transition-all ${decision === "reject" ? "bg-rose-100 border-red-500/40 text-rose-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                <X className="w-4 h-4" /> Reject
              </button>
            </div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">{decision === "approve" ? "Approval Notes (optional)" : "Rejection Reason *"}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder={decision === "approve" ? "Authorization notes, reference number…" : "Why is this being rejected?"}
              className={`${inp} resize-none`} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button onClick={confirm} disabled={saving || (decision === "reject" && !notes.trim())}
            className={`flex items-center gap-2 font-bold px-5 py-2 rounded-xl text-sm transition-all disabled:opacity-40 ${
              decision === "approve" ? "bg-emerald-500 hover:bg-emerald-400 text-slate-900" : "bg-red-500/80 hover:bg-red-500 text-slate-900"
            }`}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : decision === "approve" ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {saving ? "Saving…" : decision === "approve" ? `Approve — ${fmt(batch.total_amount)}` : "Reject Batch"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Execute Batch Modal ──────────────────────────────────────────────────────

function ExecuteBatchModal({ batch, items, clients, filedRegistry, trustAccounts, adminUser, onExecute, onClose }: {
  batch: BatchTransferRequest;
  items: BatchTransferItem[];
  clients: AClient[];
  filedRegistry: FiledCaseRegistry[];
  trustAccounts: TrustAccount[];
  adminUser: string | null;
  onExecute: (notes: string) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const ioltaAcct = trustAccounts.find(a => a.id === batch.iolta_account_id);
  const operAcct  = trustAccounts.find(a => a.id === batch.operating_account_id);
  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <ArrowRightLeft className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Execute Trust Transfer — {batch.state}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Approved by {batch.approved_by} · {fmt(batch.total_amount)} · {batch.client_count} client{batch.client_count !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-900 flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Transfer summary */}
          <div className="bg-emerald-50 border border-emerald-500/20 rounded-xl px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-center flex-1">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">From</p>
                <p className="text-sm font-bold text-amber-700">{ioltaAcct?.account_name ?? "IOLTA Trust"}</p>
                <p className="text-[10px] text-slate-600">{ioltaAcct?.bank_name}</p>
                <p className="text-lg font-bold text-slate-900 mt-1">{fmt(ioltaAcct?.current_balance ?? 0)}</p>
                <p className="text-[10px] text-slate-600">current balance</p>
              </div>
              <ArrowRightLeft className="w-5 h-5 text-emerald-700 flex-shrink-0" />
              <div className="text-center flex-1">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">To</p>
                <p className="text-sm font-bold text-emerald-700">{operAcct?.account_name ?? "Operating"}</p>
                <p className="text-[10px] text-slate-600">{operAcct?.bank_name}</p>
                <p className="text-lg font-bold text-slate-900 mt-1">{fmt(operAcct?.current_balance ?? 0)}</p>
                <p className="text-[10px] text-slate-600">current balance</p>
              </div>
            </div>
            <div className="border-t border-emerald-500/15 pt-3 text-center">
              <p className="text-[10px] text-slate-500 mb-0.5">Transfer Amount</p>
              <p className="text-2xl font-bold text-emerald-700">{fmt(batch.total_amount)}</p>
            </div>
          </div>

          {/* Client list */}
          <div className="bg-white/80 border border-slate-200 rounded-xl divide-y divide-slate-800/50">
            {items.map(item => {
              const client = clients.find(c => c.id === item.client_id);
              const reg    = filedRegistry.find(r => r.id === item.registry_id);
              return (
                <div key={item.id} className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{client?.full_name ?? "Unknown"}</p>
                    {reg && <p className="text-[10px] text-slate-500 font-mono">{reg.case_number}</p>}
                  </div>
                  <span className="text-sm font-bold text-amber-700">{fmt(item.iolta_amount)}</span>
                </div>
              );
            })}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Reference / Confirmation Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Bank wire reference number, confirmation code…"
              className={`${inp} resize-none`} />
          </div>

          <div className="bg-amber-50 border border-amber-400/20 rounded-xl px-3.5 py-2.5">
            <p className="text-[11px] text-amber-700 font-semibold">This action is final</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Executing will mark all {batch.client_count} client case(s) as Transferred, update trust account balances, and log the transaction. This cannot be undone.</p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button onClick={async () => { setSaving(true); onExecute(notes); }} disabled={saving}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-900 font-bold px-5 py-2 rounded-xl text-sm transition-all">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
            {saving ? "Executing…" : `Execute — ${fmt(batch.total_amount)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Case Time Log Panel ─────────────────────────────────────────────────────

const ACTIVITY_LABELS: Record<string, string> = {
  file_open:        "File Opened",
  file_close:       "File Closed",
  manual_note:      "Note",
  payment_adjustment:"Payment Adjustment",
  cancel_request:   "Cancellation",
  hold_request:     "Hold Request",
  paralegal_review: "Paralegal Review",
  attorney_review:  "Attorney Review",
  client_call:      "Client Call",
  creditor_call:    "Creditor Call",
  sms_thread:       "SMS Thread",
  email:            "Email",
  video_call:       "Video Call",
  message:          "Message",
  document_upload:  "Document Upload",
  other:            "Other",
};

const ACTIVITY_COLORS: Record<string, string> = {
  file_open:        "text-slate-600 bg-slate-100 border-slate-200",
  file_close:       "text-slate-600 bg-slate-100 border-slate-200",
  manual_note:      "text-sky-700 bg-sky-50 border-sky-500/20",
  payment_adjustment:"text-emerald-700 bg-emerald-50 border-emerald-500/20",
  cancel_request:   "text-rose-700 bg-rose-50 border-red-500/20",
  hold_request:     "text-amber-700 bg-amber-50 border-amber-400/20",
  paralegal_review: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  attorney_review:  "text-amber-700 bg-amber-50 border-amber-500/20",
  client_call:      "text-sky-700 bg-sky-50 border-sky-500/20",
  creditor_call:    "text-orange-400 bg-orange-500/10 border-orange-500/20",
  sms_thread:       "text-emerald-700 bg-emerald-50 border-emerald-500/20",
  email:            "text-slate-700 bg-slate-100 border-slate-200",
  video_call:       "text-sky-700 bg-sky-50 border-sky-500/20",
  message:          "text-emerald-700 bg-emerald-50 border-emerald-500/20",
  document_upload:  "text-teal-400 bg-teal-500/10 border-teal-500/20",
  other:            "text-slate-600 bg-slate-100 border-slate-200",
};

function fmtDuration(mins: number): string {
  if (!mins) return "< 1 min";
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Default hourly rates by role
const DEFAULT_HOURLY_RATES: Record<string, number> = {
  attorney_owner:        450,
  attorney_superadmin:   450,
  attorney:              450,
  paralegal:             225,
  legal_admin:           175,
  accounting_admin:      175,
  accounting_superadmin: 175,
  custom:                175,
};

function minsToUnits(mins: number): number {
  // Convert minutes to decimal billing units, minimum 0.2
  const raw = mins / 60;
  const rounded = Math.round(raw * 10) / 10;
  return Math.max(0.2, rounded);
}

const SOURCE_TYPE_ICONS: Record<string, string> = {
  message:     "MSG",
  email:       "EMAIL",
  phone_call:  "CALL",
  file_open:   "OPEN",
  file_close:  "CLOSE",
  manual:      "NOTE",
  manual_note: "NOTE",
  auto:        "AUTO",
};

const SOURCE_TYPE_COLORS: Record<string, string> = {
  message:     "bg-sky-50 text-sky-700 border-sky-500/25",
  email:       "bg-blue-500/10 text-blue-400 border-blue-500/25",
  phone_call:  "bg-emerald-50 text-emerald-700 border-emerald-500/25",
  file_open:   "bg-slate-300/20 text-slate-600 border-slate-300/30",
  file_close:  "bg-slate-300/20 text-slate-600 border-slate-300/30",
  manual:      "bg-amber-50 text-amber-700 border-amber-500/25",
  manual_note: "bg-amber-50 text-amber-700 border-amber-500/25",
  auto:        "bg-slate-200/30 text-slate-500 border-slate-300/20",
};

function CaseTimeLogPanel({ client, entries, adminUser, staffList, onRefresh }: {
  client: AClient;
  entries: TimeLogEntry[];
  adminUser: string | null;
  staffList?: { id: string; name: string; role: string; hourly_rate: number | null }[];
  onRefresh: () => void;
}) {
  const [showAdd, setShowAdd]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBillable, setEditBillable] = useState(false);
  const [editRate, setEditRate]   = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const cleanAdmin = adminUser?.replace(/\*+$/, "") ?? "";
  const matchedStaff = staffList?.find(s => s.name === cleanAdmin || s.name.toLowerCase() === cleanAdmin.toLowerCase());
  const defaultRate  = matchedStaff?.hourly_rate ?? DEFAULT_HOURLY_RATES[matchedStaff?.role ?? "paralegal"] ?? 225;

  const [form, setForm] = useState({
    activity_type:   "manual_note",
    duration_mins:   "12",
    billable:        false,
    billing_rate:    String(defaultRate),
    notes:           "",
    staff_name:      cleanAdmin || "Staff",
    staff_role:      matchedStaff?.role ?? "",
    staff_member_id: matchedStaff?.id ?? "",
  });

  const units       = minsToUnits(parseFloat(form.duration_mins) || 0);
  const rate        = parseFloat(form.billing_rate) || 0;
  const billableAmt = form.billable ? units * rate : 0;

  const totalMins    = entries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
  const billableMins = entries.filter(e => e.billable).reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
  const totalBillableAmt = entries.filter(e => e.billable).reduce((s, e) => {
    if (e.billable_amount != null) return s + Number(e.billable_amount);
    const u = e.duration_units ?? minsToUnits(e.duration_minutes ?? 0);
    const r = e.billing_rate ?? 0;
    return s + u * r;
  }, 0);

  // Staff grouped by assigned — count entries per staff
  const staffSummary = entries.reduce<Record<string, { mins: number; billable_mins: number; billable_amt: number; role: string | null }>>((acc, e) => {
    const key = e.staff_name || "Unknown";
    if (!acc[key]) acc[key] = { mins: 0, billable_mins: 0, billable_amt: 0, role: e.staff_role };
    acc[key].mins += e.duration_minutes ?? 0;
    if (e.billable) {
      acc[key].billable_mins += e.duration_minutes ?? 0;
      const u = e.duration_units ?? minsToUnits(e.duration_minutes ?? 0);
      const r = e.billing_rate ?? 0;
      acc[key].billable_amt += e.billable_amount != null ? Number(e.billable_amount) : u * r;
    }
    return acc;
  }, {});

  function handleStaffChange(name: string) {
    const matched = staffList?.find(s => s.name === name);
    const r = matched?.hourly_rate ?? DEFAULT_HOURLY_RATES[matched?.role ?? ""] ?? 225;
    setForm(f => ({
      ...f,
      staff_name:      name,
      staff_role:      matched?.role ?? f.staff_role,
      staff_member_id: matched?.id ?? "",
      billing_rate:    String(r),
    }));
  }

  function startEdit(e: TimeLogEntry) {
    setEditingId(e.id);
    setEditBillable(e.billable);
    const existingRate = e.billing_rate ?? defaultRate;
    setEditRate(String(existingRate));
  }

  async function saveEdit(e: TimeLogEntry) {
    setSavingEdit(true);
    const u = e.duration_units ?? minsToUnits(e.duration_minutes ?? 0);
    const r = parseFloat(editRate) || 0;
    const amt = editBillable ? u * r : null;
    await api.patch("case_time_log", e.id, {
      billable:        editBillable,
      billing_rate:    editBillable ? r : null,
      billable_amount: amt,
    });
    setSavingEdit(false);
    setEditingId(null);
    onRefresh();
  }

  async function save() {
    if (!form.notes.trim() && !form.duration_mins) return;
    setSaving(true);
    const durMins  = Math.max(0, parseFloat(form.duration_mins) || 0);
    const durUnits = minsToUnits(durMins);
    const bRate    = parseFloat(form.billing_rate) || 0;
    const bAmt     = form.billable ? durUnits * bRate : null;
    await api.post("case_time_log", {
      client_id:        client.id,
      staff_name:       form.staff_name || "Staff",
      staff_role:       form.staff_role || null,
      staff_member_id:  form.staff_member_id || null,
      activity_type:    form.activity_type,
      duration_minutes: durMins,
      duration_units:   durUnits,
      billing_rate:     form.billable ? bRate : null,
      billable_amount:  bAmt,
      billable:         form.billable,
      notes:            form.notes.trim() || null,
      source_type:      "manual",
      is_auto_logged:   false,
      started_at:       new Date().toISOString(),
    });
    setSaving(false);
    setShowAdd(false);
    setForm(f => ({ ...f, duration_mins: "12", notes: "", billable: false }));
    onRefresh();
  }

  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-amber-400/50 transition-colors";
  const lbl = "text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block";

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Entries</p>
          <p className="text-base font-bold text-slate-900 mt-0.5">{entries.length}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Total Time</p>
          <p className="text-base font-bold text-slate-900 mt-0.5">{fmtDuration(totalMins)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-400/20 rounded-xl px-3 py-2.5 text-center">
          <p className="text-[10px] text-amber-500 uppercase tracking-wide">Billable Time</p>
          <p className="text-base font-bold text-amber-700 mt-0.5">{fmtDuration(billableMins)}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-500/20 rounded-xl px-3 py-2.5 text-center">
          <p className="text-[10px] text-emerald-500 uppercase tracking-wide">Billable $</p>
          <p className="text-base font-bold text-emerald-700 mt-0.5">${totalBillableAmt.toFixed(2)}</p>
        </div>
      </div>

      {/* Staff time breakdown */}
      {Object.keys(staffSummary).length > 0 && (
        <div className="bg-slate-100/30 border border-slate-200/40 rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200/40">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Time by Staff Member</p>
          </div>
          <div className="divide-y divide-slate-700/30">
            {Object.entries(staffSummary).map(([name, s]) => {
              const staffRec = staffList?.find(sl => sl.name === name);
              const hrRate = staffRec?.hourly_rate ?? DEFAULT_HOURLY_RATES[s.role ?? ""] ?? 225;
              return (
                <div key={name} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-700">{name.charAt(0)}</div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{name}</p>
                      <p className="text-[9px] text-slate-600 capitalize">{(s.role ?? "staff").replace("_"," ")} · ${hrRate}/hr</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-[10px] text-slate-600 font-semibold">{fmtDuration(s.mins)}</p>
                      <p className="text-[9px] text-slate-600">total</p>
                    </div>
                    {s.billable_mins > 0 && (
                      <div>
                        <p className="text-[10px] text-amber-700 font-semibold">{fmtDuration(s.billable_mins)}</p>
                        <p className="text-[9px] text-slate-600">billable</p>
                      </div>
                    )}
                    {s.billable_amt > 0 && (
                      <div>
                        <p className="text-[10px] text-emerald-700 font-bold">${s.billable_amt.toFixed(2)}</p>
                        <p className="text-[9px] text-slate-600">amount</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rate reference */}
      <div className="bg-slate-100/30 border border-slate-200/40 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Default Rates:</p>
        {[["Attorney", 450], ["Paralegal", 225], ["Legal Admin", 175]].map(([r, v]) => (
          <span key={r as string} className="text-[10px] text-slate-600"><span className="font-semibold text-slate-700">{r}</span> ${v}/hr</span>
        ))}
        <span className="text-[10px] text-slate-600 ml-auto">Min. 0.2 billing units per entry</span>
      </div>

      {/* Add entry */}
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="w-full flex items-center justify-center gap-2 bg-sky-50 hover:bg-sky-100 border border-sky-500/20 text-sky-700 font-bold text-xs py-2.5 rounded-xl transition-all">
          <Plus className="w-3.5 h-3.5" /> Add Time Entry
        </button>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Activity Type</label>
              <select value={form.activity_type} onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))} className={inp}>
                {Object.entries(ACTIVITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Duration (minutes) <span className="text-slate-600 normal-case">min 12 = 0.2 units</span></label>
              <input type="number" min="1" step="1" value={form.duration_mins} onChange={e => setForm(f => ({ ...f, duration_mins: e.target.value }))} placeholder="12" className={inp} />
              <p className="text-[9px] text-slate-600 mt-1">= <span className="text-amber-700 font-bold">{units} units</span> {form.billable && rate > 0 && <span className="text-emerald-700">· ${billableAmt.toFixed(2)}</span>}</p>
            </div>
            <div>
              <label className={lbl}>Staff Member</label>
              {staffList && staffList.length > 0 ? (
                <select value={form.staff_name} onChange={e => handleStaffChange(e.target.value)} className={inp}>
                  {staffList.map(s => <option key={s.id} value={s.name}>{s.name} — ${s.hourly_rate ?? DEFAULT_HOURLY_RATES[s.role] ?? 225}/hr</option>)}
                  <option value="">Other</option>
                </select>
              ) : (
                <input value={form.staff_name} onChange={e => setForm(f => ({ ...f, staff_name: e.target.value }))} placeholder="Staff name" className={inp} />
              )}
            </div>
            <div>
              <label className={lbl}>Hourly Rate ($/hr)</label>
              <input type="number" min="0" step="25" value={form.billing_rate} onChange={e => setForm(f => ({ ...f, billing_rate: e.target.value }))} placeholder="225" className={inp} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="What was done…" className={`${inp} resize-none`} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setForm(f => ({ ...f, billable: !f.billable }))}
                className={`w-8 h-4 rounded-full transition-all flex items-center ${form.billable ? "bg-amber-400" : "bg-slate-200"}`}>
                <div className={`w-3 h-3 rounded-full bg-white mx-0.5 transition-all ${form.billable ? "translate-x-4" : ""}`} />
              </div>
              <span className="text-xs text-slate-600">Billable</span>
              {form.billable && billableAmt > 0 && (
                <span className="text-xs font-bold text-emerald-700 ml-1">${billableAmt.toFixed(2)}</span>
              )}
            </label>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5">Cancel</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-xs px-4 py-1.5 rounded-xl transition-all disabled:opacity-50">
                {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entries list */}
      <div className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-xs text-slate-600 py-6 text-center">No time entries yet.</p>
        ) : entries.map(e => {
          const entryUnits = e.duration_units ?? minsToUnits(e.duration_minutes ?? 0);
          const isEditing  = editingId === e.id;
          const editR      = parseFloat(editRate) || 0;
          const editAmt    = editBillable ? entryUnits * editR : 0;
          const entryAmt   = e.billable_amount != null ? Number(e.billable_amount) : (e.billable && e.billing_rate ? entryUnits * Number(e.billing_rate) : null);
          const srcType    = e.source_type ?? (e.activity_type === "file_open" ? "file_open" : e.is_auto_logged ? "auto" : "manual");
          const srcLabel   = SOURCE_TYPE_ICONS[srcType] ?? "NOTE";
          const srcColor   = SOURCE_TYPE_COLORS[srcType] ?? SOURCE_TYPE_COLORS.manual;
          return (
            <div key={e.id} className={`rounded-xl border transition-colors ${isEditing ? "bg-slate-100 border-amber-500/30" : "bg-slate-100/30 border-slate-200/50 hover:bg-slate-100/50"}`}>
              <div className="flex items-start gap-3 px-3.5 py-3">
                {/* Source badge */}
                <div className={`text-[8px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap flex-shrink-0 mt-0.5 ${srcColor}`}>
                  {srcLabel}
                </div>
                {/* Activity badge */}
                <div className={`text-[9px] font-bold px-2 py-0.5 rounded border whitespace-nowrap flex-shrink-0 mt-0.5 ${ACTIVITY_COLORS[e.activity_type] ?? ACTIVITY_COLORS.other}`}>
                  {ACTIVITY_LABELS[e.activity_type] ?? e.activity_type}
                </div>
                <div className="flex-1 min-w-0">
                  {e.notes && <p className="text-xs text-slate-700 leading-relaxed">{e.notes}</p>}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-medium">{e.staff_name}</span>
                    {e.staff_role && <span className="text-[9px] text-slate-600 capitalize">{e.staff_role.replace("_"," ")}</span>}
                    <span className="text-[10px] text-slate-700">·</span>
                    <span className="text-[10px] text-slate-500">{new Date(e.started_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    {(e.duration_minutes ?? 0) > 0 && <>
                      <span className="text-[10px] text-slate-700">·</span>
                      <span className="text-[10px] text-slate-600 font-semibold">{fmtDuration(e.duration_minutes)}</span>
                      <span className="text-[10px] text-slate-600">({entryUnits} units)</span>
                    </>}
                    {!isEditing && e.billable && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-400/20">Billable</span>}
                    {!isEditing && e.billing_rate != null && <span className="text-[9px] text-slate-600">${Number(e.billing_rate)}/hr</span>}
                    {!isEditing && entryAmt != null && <span className="text-[9px] font-bold text-emerald-700">${entryAmt.toFixed(2)}</span>}
                  </div>
                </div>
                {/* Edit toggle */}
                {!isEditing ? (
                  <button onClick={() => startEdit(e)} className="flex-shrink-0 text-[9px] text-slate-600 hover:text-amber-700 px-1.5 py-0.5 rounded border border-slate-200/50 hover:border-amber-500/30 transition-all mt-0.5">
                    Edit
                  </button>
                ) : (
                  <button onClick={() => setEditingId(null)} className="flex-shrink-0 text-[9px] text-slate-500 hover:text-slate-900 px-1.5 py-0.5 mt-0.5">✕</button>
                )}
              </div>

              {/* Inline edit panel */}
              {isEditing && (
                <div className="px-3.5 pb-3 pt-0 border-t border-slate-200/40 mt-0">
                  <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                    {/* Billable toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div onClick={() => setEditBillable(b => !b)}
                        className={`w-8 h-4 rounded-full transition-all flex items-center ${editBillable ? "bg-amber-400" : "bg-slate-200"}`}>
                        <div className={`w-3 h-3 rounded-full bg-white mx-0.5 transition-all ${editBillable ? "translate-x-4" : ""}`} />
                      </div>
                      <span className="text-xs text-slate-600">Billable</span>
                    </label>
                    {/* Rate input */}
                    {editBillable && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500">$/hr</span>
                        <input
                          type="number" min="0" step="25" value={editRate}
                          onChange={e => setEditRate(e.target.value)}
                          className="w-20 bg-slate-100 border border-slate-200 text-slate-900 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-amber-400/50"
                        />
                        {editAmt > 0 && <span className="text-[10px] font-bold text-emerald-700">${editAmt.toFixed(2)}</span>}
                      </div>
                    )}
                    <div className="flex gap-2 ml-auto">
                      <button onClick={() => setEditingId(null)} className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5">Cancel</button>
                      <button onClick={() => saveEdit(e)} disabled={savingEdit}
                        className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
                        {savingEdit ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── File-Open Prompt ─────────────────────────────────────────────────────────

function FileOpenPrompt({ client, adminUser, onDismiss, onLogged }: {
  client: AClient;
  adminUser: string | null;
  onDismiss: () => void;
  onLogged: () => void;
}) {
  const [duration, setDuration] = useState("");
  const [notes, setNotes]       = useState("");
  const [saving, setSaving]     = useState(false);

  async function logAndClose() {
    setSaving(true);
    await api.post("case_time_log", {
      client_id:        client.id,
      staff_name:       adminUser?.replace(/\*+$/, "") ?? "Staff",
      activity_type:    "file_close",
      duration_minutes: parseFloat(duration) || 0,
      billable:         false,
      notes:            notes.trim() || "File reviewed.",
      started_at:       new Date().toISOString(),
    });
    setSaving(false);
    onLogged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-sky-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Log Time Entry</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{client.full_name} — leaving file</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Time Spent (minutes)</label>
            <input type="number" min="0" value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 15" className="w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-sky-400/50" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="What was reviewed or done…" className="w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-sky-400/50 resize-none" />
          </div>
        </div>
        <div className="px-5 py-3.5 border-t border-slate-200 flex gap-2">
          <button onClick={onDismiss} className="flex-1 text-xs text-slate-500 hover:text-slate-900 py-2.5 rounded-xl transition-colors">Skip</button>
          <button onClick={logAndClose} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold text-xs py-2.5 rounded-xl transition-all disabled:opacity-50">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Log & Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hold / Push-Payment Request Modal ───────────────────────────────────────

function HoldRequestModal({
  client,
  requestType,
  adminUser,
  role,
  holdRequests,
  onClose,
  onSaved,
}: {
  client: AClient;
  requestType: "hold" | "push_payment";
  adminUser: string | null;
  role: ReturnType<typeof roleOf>;
  holdRequests: HoldRequest[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason]       = useState("");
  const [pushDate, setPushDate]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approved" | "denied" | null>(null);
  const [reviewNotes, setReviewNotes]   = useState("");

  const canApprove = role === "accounting_super_admin" || role === "super_admin";

  // Pending request for this client+type
  const pending = holdRequests.find(
    r => r.client_id === client.id && r.request_type === requestType && r.status === "pending_approval"
  );

  async function submitRequest() {
    if (!reason.trim()) return;
    if (requestType === "push_payment" && !pushDate) return;
    setSubmitting(true);
    try {
      await api.post("client_hold_requests", {
        client_id: client.id,
        request_type: requestType,
        requested_by: adminUser?.replace(/\*+$/, "") ?? "Staff",
        reason: reason.trim(),
        push_to_date: requestType === "push_payment" ? pushDate : null,
        status: canApprove ? "approved" : "pending_approval",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (canApprove && requestType === "hold") {
        await api.patch("accounting_clients", client.id, {
          extended_status: "on_hold",
          updated_at: new Date().toISOString(),
        });
      }
      // Auto-log
      await api.post("case_time_log", {
        client_id:        client.id,
        staff_name:       adminUser?.replace(/\*+$/, "") ?? "Staff",
        activity_type:    "hold_request",
        duration_minutes: 0,
        billable:         false,
        notes:            requestType === "hold"
          ? `Hold request ${canApprove ? "applied" : "submitted"}: ${reason.trim()}`
          : `Push-payment request ${canApprove ? "applied" : "submitted"} to ${pushDate}: ${reason.trim()}`,
        started_at:       new Date().toISOString(),
      });
      setSubmitted(true);
      onSaved();
    } catch {
      setSubmitted(true);
    }
    setSubmitting(false);
  }

  async function reviewRequest(action: "approved" | "denied") {
    if (!pending) return;
    setSubmitting(true);
    try {
      await api.patch("client_hold_requests", pending.id, {
        status: action,
        reviewed_by: adminUser?.replace(/\*+$/, "") ?? "Super Admin",
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || null,
        updated_at: new Date().toISOString(),
      });
      if (action === "approved" && requestType === "hold") {
        await api.patch("accounting_clients", client.id, {
          extended_status: "on_hold",
          updated_at: new Date().toISOString(),
        });
      }
      setReviewAction(action);
      onSaved();
    } catch {
      setReviewAction(action);
    }
    setSubmitting(false);
  }

  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-400/60 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${requestType === "hold" ? "bg-amber-100" : "bg-sky-100"}`}>
            {requestType === "hold" ? <PauseCircle className="w-4 h-4 text-amber-700" /> : <Calendar className="w-4 h-4 text-sky-700" />}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-900">
              {requestType === "hold" ? "Place Client On Hold" : "Push Out Payment"}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{client.full_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Show pending approval banner if one exists and user is a reviewer */}
          {pending && canApprove && !reviewAction && (
            <div className="bg-amber-50 border border-amber-400/25 rounded-xl px-4 py-3 space-y-3">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-700">Pending Approval</p>
                  <p className="text-xs text-slate-600 mt-0.5">Requested by <strong className="text-slate-900">{pending.requested_by}</strong> on {new Date(pending.created_at).toLocaleDateString()}</p>
                  <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">"{pending.reason}"</p>
                  {pending.push_to_date && <p className="text-xs text-slate-600 mt-1">Defer to: <strong className="text-slate-900">{pending.push_to_date}</strong></p>}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Review Notes (optional)</label>
                <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={2} className={`${inp} resize-none`} placeholder="Notes for your decision…" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => reviewRequest("approved")} disabled={submitting} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-900 font-bold text-xs py-2.5 rounded-xl transition-all">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </button>
                <button onClick={() => reviewRequest("denied")} disabled={submitting} className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/80 hover:bg-red-500 disabled:opacity-50 text-slate-900 font-bold text-xs py-2.5 rounded-xl transition-all">
                  <X className="w-3.5 h-3.5" /> Deny
                </button>
              </div>
            </div>
          )}

          {reviewAction && (
            <div className="flex flex-col items-center py-4 text-center">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${reviewAction === "approved" ? "bg-emerald-100" : "bg-rose-100"}`}>
                {reviewAction === "approved" ? <CheckCircle2 className="w-6 h-6 text-emerald-700" /> : <X className="w-6 h-6 text-rose-700" />}
              </div>
              <p className="text-sm font-bold text-slate-900">{reviewAction === "approved" ? "Request Approved" : "Request Denied"}</p>
              <button onClick={onClose} className="mt-4 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold text-xs px-5 py-2 rounded-xl">Close</button>
            </div>
          )}

          {submitted && !reviewAction && (
            <div className="flex flex-col items-center py-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-700" />
              </div>
              <p className="text-sm font-bold text-slate-900">{canApprove ? "Applied" : "Request Submitted"}</p>
              <p className="text-xs text-slate-600 mt-1">{canApprove ? "The change has been applied immediately." : "Awaiting Accounting Super Admin approval."}</p>
              <button onClick={onClose} className="mt-4 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold text-xs px-5 py-2 rounded-xl">Close</button>
            </div>
          )}

          {!submitted && !pending && !reviewAction && (
            <>
              {!canApprove && (
                <div className="bg-sky-50 border border-sky-500/20 rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-sky-700 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-600 leading-relaxed">This request requires <strong className="text-slate-900">Accounting Super Admin</strong> approval before taking effect.</p>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Reason <span className="text-rose-700">*</span></label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className={`${inp} resize-none`} placeholder={requestType === "hold" ? "Explain why this client should be placed on hold…" : "Explain why this payment should be deferred…"} />
              </div>
              {requestType === "push_payment" && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Defer Next Payment To <span className="text-rose-700">*</span></label>
                  <input type="date" value={pushDate} onChange={e => setPushDate(e.target.value)} className={inp} />
                </div>
              )}
              <button
                onClick={submitRequest}
                disabled={submitting || !reason.trim() || (requestType === "push_payment" && !pushDate)}
                className={`w-full flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-xl transition-all disabled:opacity-40 ${requestType === "hold" ? "bg-amber-400 hover:bg-amber-300 text-slate-950" : "bg-sky-500 hover:bg-sky-400 text-slate-900"}`}
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : requestType === "hold" ? <PauseCircle className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                {submitting ? "Submitting…" : canApprove ? (requestType === "hold" ? "Place On Hold" : "Push Payment") : "Submit for Approval"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Quick Cancel Modal ───────────────────────────────────────────────────────

// ─── Cancel Review Modal ──────────────────────────────────────────────────────
// Replaces QuickCancelModal. Staff must first attempt retention (reduce fee,
// push payments, reduce payments, change frequency). If saved, adjustments are
// logged. If cancelled, the case is marked cancelled.

function QuickCancelModal({ client, feeStructure, adminUser, onClose, onSaved }: {
  client: AClient;
  feeStructure?: FeeStructure | null;
  adminUser: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const origAttyFee = feeStructure?.attorney_fee  ?? 0;
  const origPayAmt  = feeStructure?.down_payment  ?? 0;
  const origFreq    = feeStructure?.payment_frequency ?? "monthly";

  type Step = "review" | "adjust" | "confirm_cancel";
  const [step,     setStep]     = useState<Step>("review");
  const [channel,  setChannel]  = useState("phone");
  const [category, setCategory] = useState("financial_hardship");
  const [detail,   setDetail]   = useState("");
  const [saving,   setSaving]   = useState(false);

  // Retention adjustment fields — autopopulate originals based on adjType
  const [adjType,       setAdjType]       = useState<RetentionAdjustment["adjustment_type"]>("reduce_payments");
  const [adjDesc,       setAdjDesc]       = useState("");
  const [adjOrigVal,    setAdjOrigVal]    = useState(String(origPayAmt));
  const [adjNewVal,     setAdjNewVal]     = useState("");
  const [adjOrigDate,   setAdjOrigDate]   = useState("");
  const [adjNewDate,    setAdjNewDate]    = useState("");
  const [adjOrigFreq,   setAdjOrigFreq]   = useState(origFreq ?? "monthly");
  const [adjNewFreq,    setAdjNewFreq]    = useState("");
  const [adjNotes,      setAdjNotes]      = useState("");
  const [adjustments,   setAdjustments]   = useState<Omit<RetentionAdjustment, "id" | "cancel_request_id">[]>([]);
  const [pendingApproval, setPendingApproval] = useState(false);

  // When adjType changes, autopopulate the original value
  function handleAdjTypeChange(newType: RetentionAdjustment["adjustment_type"]) {
    setAdjType(newType);
    setAdjOrigVal(
      newType === "reduce_fee" || newType === "waive_fee" ? String(origAttyFee) :
      newType === "reduce_payments" ? String(origPayAmt) :
      newType === "change_frequency" ? "" : ""
    );
    setAdjOrigFreq(newType === "change_frequency" ? (origFreq ?? "monthly") : "");
    setAdjNewVal("");
    setAdjNewFreq("");
  }

  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-300";
  const lbl = "text-xs font-semibold text-slate-600 mb-1.5 block";

  const CATEGORIES = [
    { value: "financial_hardship",    label: "Financial Hardship" },
    { value: "changed_attorney",      label: "Changed Attorney" },
    { value: "circumstances_changed", label: "Circumstances Changed" },
    { value: "dissatisfied",          label: "Dissatisfied with Service" },
    { value: "other",                 label: "Other" },
  ];
  const ADJ_TYPES: { value: RetentionAdjustment["adjustment_type"]; label: string; icon: string }[] = [
    { value: "reduce_payments",  label: "Reduce Payment Amount",  icon: "↓$" },
    { value: "push_payments",    label: "Push Out Payments",      icon: "→📅" },
    { value: "reduce_fee",       label: "Reduce Attorney Fee",    icon: "↓Fee" },
    { value: "waive_fee",        label: "Waive a Fee",            icon: "✕Fee" },
    { value: "change_frequency", label: "Change Pay Frequency",   icon: "⟳" },
    { value: "other",            label: "Other Arrangement",      icon: "✎" },
  ];

  function addAdjustment() {
    if (!adjDesc.trim()) return;
    setAdjustments(prev => [...prev, {
      client_id: client.id,
      adjustment_type: adjType,
      description: adjDesc.trim(),
      original_value: adjOrigVal ? parseFloat(adjOrigVal) : null,
      new_value: adjNewVal ? parseFloat(adjNewVal) : null,
      original_date: adjOrigDate || null,
      new_date: adjNewDate || null,
      original_frequency: adjOrigFreq || null,
      new_frequency: adjNewFreq || null,
      authorized_by: adminUser ?? "Staff",
      notes: adjNotes.trim() || null,
      applied_at: new Date().toISOString(),
    }]);
    setAdjDesc(""); setAdjOrigVal(""); setAdjNewVal("");
    setAdjOrigDate(""); setAdjNewDate(""); setAdjOrigFreq(""); setAdjNewFreq(""); setAdjNotes("");
  }

  async function saveAsRetained() {
    setSaving(true);
    const req = await api.post("accounting_cancel_requests", {
      client_id:            client.id,
      request_channel:      channel,
      reason_category:      category,
      reason_detail:        detail || null,
      ai_retention_outcome: "saved",
      status:               "saved",
      staff_reviewer:       adminUser,
      retention_type:       adjustments.length > 0 ? `saved_${adjustments[0].adjustment_type}` : "saved_other",
      adj_authorized_by:    adminUser,
      adj_authorized_at:    new Date().toISOString(),
      resolved_at:          new Date().toISOString(),
      created_at:           new Date().toISOString(),
      updated_at:           new Date().toISOString(),
    });
    const reqId = Array.isArray(req) ? req[0]?.id : req?.id;
    if (reqId) {
      for (const adj of adjustments) {
        await api.post("cancel_retention_adjustments", { ...adj, cancel_request_id: reqId });
      }
    }
    // If fee reduction adjustments exist, create a fee_adjustment_request for super admin approval
    const feeAdjs = adjustments.filter(a => a.adjustment_type === "reduce_fee" || a.adjustment_type === "waive_fee");
    for (const fa of feeAdjs) {
      await api.post("fee_adjustment_requests", {
        client_id:              client.id,
        client_name:            client.full_name,
        adjustment_type:        "attorney_fee",
        original_attorney_fee:  fa.original_value ?? origAttyFee,
        original_court_filing_fee: feeStructure?.court_filing_fee ?? 0,
        original_total_fee:     feeStructure?.total_fee ?? 0,
        original_payment_amount: origPayAmt,
        proposed_attorney_fee:  fa.new_value ?? 0,
        reason:                 `Retention offer during cancel review — ${fa.description}. Requested by: ${adminUser ?? "Staff"}`,
        requested_by:           adminUser ?? "Staff",
        status:                 "pending",
      });
      setPendingApproval(true);
    }
    await api.post("case_time_log", {
      client_id:        client.id,
      staff_name:       adminUser || "Staff",
      activity_type:    "retention_save",
      duration_minutes: 0,
      billable:         false,
      notes:            `Cancel review — client retained. Adjustments: ${adjustments.map(a => a.adjustment_type.replace(/_/g, " ")).join(", ") || "none"}`,
      started_at:       new Date().toISOString(),
    });
    setSaving(false);
    onSaved();
  }

  async function saveAsCancelled() {
    setSaving(true);
    const cancelResult = await api.post("accounting_cancel_requests", {
      client_id:            client.id,
      request_channel:      channel,
      reason_category:      category,
      reason_detail:        detail || null,
      ai_retention_outcome: "irreversible",
      status:               "cancelled",
      staff_reviewer:       adminUser,
      retention_type:       "cancelled",
      resolved_at:          new Date().toISOString(),
      created_at:           new Date().toISOString(),
      updated_at:           new Date().toISOString(),
    });
    await api.patch("accounting_clients", client.id, {
      extended_status: "cancelled",
      updated_at:      new Date().toISOString(),
    });
    const cancelReqId = Array.isArray(cancelResult) ? cancelResult[0]?.id : cancelResult?.id;
    fetch(`${SUPABASE_URL}/functions/v1/client-lifecycle-alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({
        action: "handle_disengagement",
        cancel_request_id: cancelReqId ?? null,
        client_id: client.id,
        client_name: client.full_name,
        client_email: client.email,
        reason: category,
        authorized_by: adminUser ?? "Staff",
      }),
    }).catch(() => {});
    await api.post("case_time_log", {
      client_id:        client.id,
      staff_name:       adminUser || "Staff",
      activity_type:    "case_closed",
      duration_minutes: 0,
      billable:         false,
      notes:            `Case cancelled — reason: ${category.replace(/_/g, " ")}${detail ? ` — ${detail}` : ""}`,
      started_at:       new Date().toISOString(),
    });
    setSaving(false);
    onSaved();
  }

  const stepLabel = step === "review" ? "1. Client Info" : step === "adjust" ? "2. Retention Options" : "3. Confirm Cancellation";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-rose-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Ban className="w-4 h-4 text-rose-700" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900">Cancel Review</h3>
            <p className="text-xs text-slate-500 mt-0.5">{client.full_name} · {client.client_id}</p>
            <div className="flex items-center gap-2 mt-2">
              {(["review","adjust","confirm_cancel"] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  {i > 0 && <div className="w-4 h-px bg-slate-200" />}
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-colors ${step === s ? "bg-amber-100 border-amber-400/30 text-amber-700" : "border-slate-200 text-slate-600"}`}>
                    {s === "review" ? "Intake" : s === "adjust" ? "Retention" : "Cancel"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 p-1 flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* ── STEP 1: Intake ── */}
          {step === "review" && (
            <>
              <div className="bg-amber-50 border border-amber-400/20 rounded-xl px-4 py-3 text-xs text-amber-700">
                <p className="font-semibold mb-1">Before cancelling, explore retention options.</p>
                <p className="text-slate-600">Capture the reason, then offer the client a fee reduction, payment push, or restructured plan. Only proceed to cancellation if all options are exhausted.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Contact Channel</label>
                  <select value={channel} onChange={e => setChannel(e.target.value)} className={inp}>
                    <option value="phone">Phone</option>
                    <option value="email">Email</option>
                    <option value="in_person">In Person</option>
                    <option value="text">Text / SMS</option>
                    <option value="portal">Client Portal</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Cancellation Reason</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className={inp}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>Client's Stated Reason</label>
                <textarea value={detail} onChange={e => setDetail(e.target.value)} rows={3}
                  placeholder="What did the client say? Why do they want to cancel?"
                  className={`${inp} resize-none text-xs`} />
              </div>
            </>
          )}

          {/* ── STEP 2: Retention Adjustments ── */}
          {step === "adjust" && (
            <>
              <div className="bg-emerald-50 border border-emerald-500/20 rounded-xl px-4 py-3 text-xs text-emerald-700">
                <p className="font-semibold mb-1">Offer Retention Options</p>
                <p className="text-slate-600">Add one or more adjustments offered to the client. If the client accepts, click "Client Saved". If no options work, proceed to cancellation.</p>
              </div>

              {/* Adjustment form */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Add Adjustment</p>
                <div className="grid grid-cols-3 gap-2">
                  {ADJ_TYPES.map(t => (
                    <button key={t.value} onClick={() => handleAdjTypeChange(t.value)}
                      className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-[10px] font-semibold transition-all ${adjType === t.value ? "bg-sky-100 border-sky-500/30 text-sky-300" : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"}`}>
                      <span className="text-xs">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
                <div>
                  <label className={lbl}>Description *</label>
                  <input value={adjDesc} onChange={e => setAdjDesc(e.target.value)}
                    placeholder={adjType === "reduce_payments" ? "e.g. Reduced monthly from $200 to $125" : adjType === "push_payments" ? "e.g. Pushed next payment 30 days" : "Describe the arrangement…"}
                    className={inp} />
                </div>
                {(adjType === "reduce_fee" || adjType === "waive_fee") && (
                  <div className="bg-amber-50 border border-amber-400/20 rounded-xl px-3 py-2 mb-1">
                    <p className="text-[10px] text-amber-700 font-semibold">Requires Super Admin Attorney Approval</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Attorney fee reductions must be approved by the super admin attorney. A fee adjustment request will be created automatically when this retention is saved.</p>
                  </div>
                )}
                {(adjType === "reduce_payments" || adjType === "reduce_fee" || adjType === "waive_fee") && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>{adjType === "reduce_payments" ? "Original Payment ($)" : "Original Attorney Fee ($)"}</label>
                      <input type="number" value={adjOrigVal} onChange={e => setAdjOrigVal(e.target.value)} placeholder="0.00" className={inp + " bg-white/80 text-slate-600"} />
                    </div>
                    <div>
                      <label className={lbl}>{adjType === "reduce_payments" ? "Proposed Payment ($)" : adjType === "waive_fee" ? "Waive Amount ($)" : "Proposed Reduced Fee ($)"} <span className="text-amber-700">*</span></label>
                      <input type="number" value={adjNewVal} onChange={e => setAdjNewVal(e.target.value)} placeholder="0.00" className={inp} />
                    </div>
                  </div>
                )}
                {adjType === "push_payments" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Original Next Payment Date</label>
                      <input type="date" value={adjOrigDate} onChange={e => setAdjOrigDate(e.target.value)} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>New Payment Date</label>
                      <input type="date" value={adjNewDate} onChange={e => setAdjNewDate(e.target.value)} className={inp} />
                    </div>
                  </div>
                )}
                {adjType === "change_frequency" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Current Frequency</label>
                      <select value={adjOrigFreq} onChange={e => setAdjOrigFreq(e.target.value)} className={inp}>
                        <option value="">Select…</option>
                        {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>New Frequency</label>
                      <select value={adjNewFreq} onChange={e => setAdjNewFreq(e.target.value)} className={inp}>
                        <option value="">Select…</option>
                        {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <div>
                  <label className={lbl}>Internal Notes</label>
                  <input value={adjNotes} onChange={e => setAdjNotes(e.target.value)} placeholder="Optional notes…" className={inp} />
                </div>
                <button onClick={addAdjustment} disabled={!adjDesc.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-500/20 hover:bg-emerald-100 disabled:opacity-40 rounded-xl transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add to List
                </button>
              </div>

              {/* Adjustments applied */}
              {adjustments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Adjustments Offered ({adjustments.length})</p>
                  {adjustments.map((adj, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900">{adj.description}</p>
                        <p className="text-[10px] text-slate-500 capitalize">{adj.adjustment_type.replace(/_/g, " ")}
                          {adj.original_value != null && adj.new_value != null && ` — ${fmt(adj.original_value)} → ${fmt(adj.new_value)}`}
                          {adj.original_date && adj.new_date && ` — ${adj.original_date} → ${adj.new_date}`}
                        </p>
                      </div>
                      <button onClick={() => setAdjustments(p => p.filter((_, j) => j !== i))} className="text-slate-600 hover:text-rose-700 flex-shrink-0 p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── STEP 3: Confirm Cancellation ── */}
          {step === "confirm_cancel" && (
            <>
              <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-rose-700">
                <p className="font-semibold mb-1">No retention options accepted.</p>
                <p className="text-slate-600">This will permanently mark the case as <span className="font-bold text-rose-700">Cancelled</span> and record a cancellation in the time log. This cannot be undone without a supervisor override.</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Client</span><span className="text-slate-900 font-semibold">{client.full_name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Channel</span><span className="text-slate-700 capitalize">{channel}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Reason</span><span className="text-slate-700 capitalize">{category.replace(/_/g, " ")}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Adjustments offered</span><span className={adjustments.length > 0 ? "text-amber-700" : "text-slate-500"}>{adjustments.length > 0 ? `${adjustments.length} (declined)` : "None"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Authorized by</span><span className="text-slate-700">{adminUser ?? "—"}</span></div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Close</button>
          <div className="flex items-center gap-2">
            {step === "review" && (
              <button onClick={() => setStep("adjust")}
                className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-slate-900 font-bold px-5 py-2 rounded-xl text-sm transition-all">
                Next: Retention Options <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === "adjust" && (
              <>
                <button onClick={() => setStep("review")} className="px-3 py-2 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl">Back</button>
                {adjustments.length > 0 && (
                  <button onClick={saveAsRetained} disabled={saving}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-900 font-bold px-4 py-2 rounded-xl text-sm transition-all">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Client Saved
                  </button>
                )}
                <button onClick={() => setStep("confirm_cancel")}
                  className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold px-4 py-2 rounded-xl text-sm transition-all">
                  Proceed to Cancel <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
            {step === "confirm_cancel" && (
              <>
                <button onClick={() => setStep("adjust")} className="px-3 py-2 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl">Back</button>
                <button onClick={saveAsCancelled} disabled={saving}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-slate-900 font-bold px-5 py-2 rounded-xl text-sm transition-all">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  {saving ? "Processing…" : "Confirm Cancellation"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Drop Client Modal (6-month no-contact rule) ──────────────────────────────
// Requires Attorney Super Admin approval before case is marked cancelled.

function DropClientModal({ client, adminUser, role, onClose, onSaved }: {
  client: AClient;
  adminUser: string | null;
  role: ReturnType<typeof roleOf>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [approved, setApproved] = useState(false);

  const isSuperAdmin = role === "super_admin";
  const daysSinceContact = client.last_contact_date
    ? Math.floor((Date.now() - new Date(client.last_contact_date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const inp = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-300";

  async function submitDrop() {
    setSaving(true);
    // Create a cancel request flagged as no_contact_drop, status pending if not super admin
    const dropStatus = isSuperAdmin ? "cancelled" : "pending";
    await api.post("accounting_cancel_requests", {
      client_id:            client.id,
      requested_by:         adminUser || "Staff",
      request_channel:      "internal",
      reason_category:      "no_contact_drop",
      reason_detail:        notes || `No contact for ${daysSinceContact ?? "180+"} days. Firm-initiated drop per 6-month no-contact policy.`,
      ai_retention_outcome: "irreversible",
      status:               dropStatus,
      created_at:           new Date().toISOString(),
    });
    // Flag the client record
    await api.patch("accounting_clients", client.id, {
      no_contact_drop_flagged: true,
      drop_requested_at:       new Date().toISOString(),
      ...(isSuperAdmin ? { extended_status: "cancelled", case_closed_reason: "no_contact_drop", case_closed_date: new Date().toISOString().slice(0, 10) } : {}),
    });
    await api.post("case_time_log", {
      client_id:        client.id,
      staff_name:       adminUser || "Staff",
      activity_type:    "case_closed",
      duration_minutes: 0,
      billable:         false,
      notes:            `Drop email initiated — 6-month no-contact rule. ${isSuperAdmin ? "Approved by Attorney Super Admin." : "Pending Attorney Super Admin approval."}`,
      started_at:       new Date().toISOString(),
    });
    setSaving(false);
    if (isSuperAdmin) {
      setApproved(true);
    } else {
      setSubmitted(true);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
            <UserX className="w-4.5 h-4.5 text-rose-700" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900">Drop Client — No-Contact Policy</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{client.full_name} · {client.client_id}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 p-1"><X className="w-4 h-4" /></button>
        </div>

        {(submitted || approved) ? (
          <div className="px-5 py-8 flex flex-col items-center text-center space-y-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${approved ? "bg-rose-100" : "bg-amber-100"}`}>
              {approved ? <XCircle className="w-7 h-7 text-rose-700" /> : <Clock className="w-7 h-7 text-amber-700" />}
            </div>
            <p className="text-base font-bold text-slate-900">{approved ? "Client Dropped" : "Drop Request Submitted"}</p>
            <p className="text-xs text-slate-600 max-w-sm leading-relaxed">
              {approved
                ? "The drop email has been logged. The client's case has been marked cancelled."
                : "A drop request has been submitted for Attorney Super Admin review. The client will be notified once approved."}
            </p>
            <button onClick={() => { onSaved(); onClose(); }} className="mt-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold text-xs px-6 py-2.5 rounded-xl">Close</button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            {/* No-contact summary */}
            <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700 flex-shrink-0" />
                <p className="text-xs font-bold text-rose-700">6-Month No-Contact Rule Triggered</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-slate-500">Last Contact</p>
                  <p className="text-slate-900 font-semibold">
                    {client.last_contact_date
                      ? new Date(client.last_contact_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Days Since Contact</p>
                  <p className={`font-bold ${(daysSinceContact ?? 0) >= 180 ? "text-rose-700" : "text-amber-700"}`}>
                    {daysSinceContact !== null ? `${daysSinceContact} days` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Client Status</p>
                  <p className="text-slate-900 font-semibold capitalize">{client.extended_status ?? client.status}</p>
                </div>
                <div>
                  <p className="text-slate-500">Intake Date</p>
                  <p className="text-slate-900 font-semibold">
                    {client.intake_date ? new Date(client.intake_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Approval requirement */}
            {!isSuperAdmin && (
              <div className="bg-amber-50 border border-amber-400/25 rounded-xl px-4 py-3 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-700">Attorney Super Admin Approval Required</p>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Submitting this drop request will notify the Attorney Super Admin. The drop email will be sent and the case closed only after their approval.
                  </p>
                </div>
              </div>
            )}
            {isSuperAdmin && (
              <div className="bg-emerald-50 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-700">You are logged in as <strong className="text-emerald-700">Attorney Super Admin</strong>. This drop will be approved immediately.</p>
              </div>
            )}

            {/* What happens */}
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-800 text-xs overflow-hidden">
              <p className="px-4 py-2.5 font-bold text-slate-600 uppercase tracking-wider text-[10px] bg-slate-50">What This Does</p>
              {[
                { icon: "📧", text: "Sends a formal drop/disengagement email to the client" },
                { icon: "📋", text: "Logs a cancellation request under No-Contact Drop policy" },
                { icon: "🔒", text: `Marks case as Cancelled once ${isSuperAdmin ? "confirmed" : "approved by Attorney Super Admin"}` },
                { icon: "📝", text: "Creates a time log entry on this client's file" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-white">
                  <span className="text-sm">{item.icon}</span>
                  <p className="text-slate-600">{item.text}</p>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Additional Notes <span className="text-slate-600">(optional)</span></label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Any additional context for the drop email or case record…"
                className={`${inp} resize-none`} />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl transition-colors">Cancel</button>
              <button
                onClick={submitDrop}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-slate-900 font-bold text-sm py-2.5 rounded-xl transition-all"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                {saving ? "Processing…" : isSuperAdmin ? "Confirm Drop" : "Submit Drop Request"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Clients Table View ───────────────────────────────────────────────────────

type ClientSubTab = "all" | "active" | "on_hold" | "completed" | "inactive" | "case_closed" | "cancelled";

function ClientsTableView({
  clients,
  feeStructures,
  payments,
  scheduleEntries,
  autopayEnrollments,
  paymentRetries,
  merchantAccounts,
  holdRequests,
  cancelRequests,
  lifecycleAlerts,
  timeLog,
  additionalMatters,
  staffMembers,
  adminUser,
  role,
  onRefresh,
}: {
  clients: AClient[];
  feeStructures: FeeStructure[];
  payments: Payment[];
  scheduleEntries: ScheduleEntry[];
  autopayEnrollments: AutopayEnrollment[];
  paymentRetries: PaymentRetry[];
  merchantAccounts: MerchantAccount[];
  cancelRequests: CancelRequest[];
  lifecycleAlerts: LifecycleAlert[];
  timeLog: TimeLogEntry[];
  additionalMatters: AdditionalMatter[];
  staffMembers: { id: string; name: string; role: string; hourly_rate: number | null }[];
  holdRequests: HoldRequest[];
  adminUser: string | null;
  role: ReturnType<typeof roleOf>;
  onRefresh: () => void;
}) {
  const [subTab, setSubTab]           = useState<ClientSubTab>("all");
  const [search, setSearch]           = useState("");
  const [filterChapter, setFilterChapter] = useState<"all" | "7" | "13">("all");
  const [selectedClient, setSelectedClient] = useState<AClient | null>(null);
  const [holdTarget, setHoldTarget]   = useState<{ client: AClient; type: "hold" | "push_payment" } | null>(null);
  const [quickPayClient, setQuickPayClient] = useState<AClient | null>(null);
  const [cxlTarget, setCxlTarget]     = useState<AClient | null>(null);
  const [dropTarget, setDropTarget]   = useState<AClient | null>(null);
  const [feeAdjTarget, setFeeAdjTarget] = useState<AClient | null>(null);
  const [exitPromptClient, setExitPromptClient] = useState<AClient | null>(null);
  const [exitForm, setExitForm]       = useState({ activity_type: "manual_note", duration_mins: "12", billable: false, billing_rate: "", notes: "" });
  const [exitSaving, setExitSaving]   = useState(false);

  function openExitPrompt(client: AClient) {
    const matched = staffMembers?.find(s => s.name === (adminUser?.replace(/\*+$/, "") ?? ""));
    const defRate = matched?.hourly_rate ?? DEFAULT_HOURLY_RATES[matched?.role ?? "paralegal"] ?? 225;
    setExitForm({ activity_type: "manual_note", duration_mins: "12", billable: false, billing_rate: String(defRate), notes: "" });
    setExitPromptClient(client);
  }

  async function saveExitEntry(skipEntry: boolean) {
    if (!exitPromptClient) return;
    if (!skipEntry) {
      setExitSaving(true);
      const cleanAdmin = adminUser?.replace(/\*+$/, "") ?? "Staff";
      const matched = staffMembers?.find(s => s.name === cleanAdmin);
      const durMins = Math.max(0, parseFloat(exitForm.duration_mins) || 0);
      const durUnits = minsToUnits(durMins);
      const bRate = parseFloat(exitForm.billing_rate) || 0;
      const bAmt = exitForm.billable ? durUnits * bRate : null;
      await api.post("case_time_log", {
        client_id:        exitPromptClient.id,
        staff_name:       cleanAdmin,
        staff_role:       matched?.role ?? null,
        staff_member_id:  matched?.id ?? null,
        activity_type:    exitForm.activity_type,
        duration_minutes: durMins,
        duration_units:   durUnits,
        billing_rate:     exitForm.billable ? bRate : null,
        billable_amount:  bAmt,
        billable:         exitForm.billable,
        notes:            exitForm.notes.trim() || `File closed.`,
        source_type:      "file_close",
        is_auto_logged:   false,
        started_at:       new Date().toISOString(),
      });
      setExitSaving(false);
      onRefresh();
    }
    setExitPromptClient(null);
    setSelectedClient(null);
  }

  // 6-month no-contact rule: flag clients with no contact in 180+ days
  function noContactDays(c: AClient): number | null {
    if (!c.last_contact_date) return null;
    return Math.floor((Date.now() - new Date(c.last_contact_date).getTime()) / (1000 * 60 * 60 * 24));
  }
  function isNoContactFlagged(c: AClient): boolean {
    const days = noContactDays(c);
    const es = extStatus(c);
    return days !== null && days >= 180 && (es === "inactive" || es === "active" || es === "on_hold");
  }

  // Derive extended_status with fallback for rows that don't have it yet
  function extStatus(c: AClient): ExtendedStatus {
    if (c.extended_status) return c.extended_status as ExtendedStatus;
    if (c.status === "on_hold")  return "on_hold";
    if (c.status === "closed")   return "case_closed";
    return "active";
  }

  const SUB_TABS: { id: ClientSubTab; label: string; filter: (c: AClient) => boolean; alert?: boolean }[] = [
    { id: "all",        label: "All Clients",  filter: () => true },
    { id: "active",     label: "Active",       filter: c => extStatus(c) === "active" || c.status === "active" || c.status === "filed" },
    { id: "on_hold",    label: "On Hold",      filter: c => extStatus(c) === "on_hold" || c.status === "on_hold" },
    { id: "completed",  label: "Completed",    filter: c => extStatus(c) === "completed" },
    { id: "inactive",   label: "Inactive",     filter: c => extStatus(c) === "inactive", alert: clients.some(c => extStatus(c) === "inactive" && isNoContactFlagged(c)) },
    { id: "case_closed",label: "Case Closed",  filter: c => extStatus(c) === "case_closed" || c.status === "closed" },
    { id: "cancelled",  label: "Cancelled",    filter: c => extStatus(c) === "cancelled" },
  ];

  const EXT_STATUS_LABELS: Record<ExtendedStatus, string> = {
    active: "Active", on_hold: "On Hold", completed: "Completed",
    inactive: "Inactive", case_closed: "Case Closed", cancelled: "Cancelled",
  };
  const EXT_STATUS_COLORS: Record<ExtendedStatus, string> = {
    active:     "bg-emerald-100 text-emerald-700 border-emerald-500/25",
    on_hold:    "bg-amber-100 text-amber-700 border-amber-400/25",
    completed:  "bg-sky-100 text-sky-700 border-sky-500/25",
    inactive:   "bg-slate-200/60 text-slate-500 border-slate-200",
    case_closed:"bg-slate-100/80 text-slate-600 border-slate-200",
    cancelled:  "bg-rose-100 text-rose-700 border-red-500/25",
  };

  const currentFilter = SUB_TABS.find(t => t.id === subTab)?.filter ?? (() => true);

  const filtered = clients
    .filter(currentFilter)
    .filter(c => {
      if (filterChapter !== "all" && String(c.chapter) !== filterChapter) return false;
      if (search && !c.full_name.toLowerCase().includes(search.toLowerCase()) && !c.client_id.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

  function clientStats(c: AClient) {
    const fs      = feeStructures.find(f => f.client_id === c.id);
    const paid    = payments.filter(p => p.client_id === c.id && !p.voided).reduce((s, p) => s + p.amount, 0);
    const total   = fs?.total_fee ?? 0;
    const balance = Math.max(0, total - paid);
    const today   = new Date().toISOString().slice(0, 10);
    const overdueEntries = scheduleEntries.filter(s => s.client_id === c.id && s.status !== "paid" && s.due_date < today);
    const overdueCount  = overdueEntries.length;
    const pastDueAmount = overdueEntries.reduce((s, e) => s + (e.amount_due ?? 0), 0);
    const upcoming = scheduleEntries
      .filter(s => s.client_id === c.id && s.status === "pending")
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    const nextDue = upcoming[0] ?? null;
    return { fs, paid, total, balance, nextDue, overdueCount, pastDueAmount };
  }

  const pendingHolds   = holdRequests.filter(r => r.status === "pending_approval").length;
  const openAlerts     = lifecycleAlerts.filter(a => a.status === "open");
  const dropTasks      = openAlerts.filter(a => a.alert_type === "drop_notice_task");
  const warnAlerts     = openAlerts.filter(a => a.alert_type === "paid_in_full_60day_warning");

  async function dismissAlert(id: string) {
    await api.patch("client_lifecycle_alerts", id, { status: "acknowledged", resolved_at: new Date().toISOString() });
    onRefresh();
  }

  async function runLifecycleCheck() {
    await fetch(`${SUPABASE_URL}/functions/v1/client-lifecycle-alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({ action: "run_paid_in_full_warnings" }),
    });
    onRefresh();
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Lifecycle Alerts Panel */}
      {openAlerts.length > 0 && (
        <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-b border-slate-200 space-y-2">
          {dropTasks.map(alert => (
            <div key={alert.id} className="flex items-start gap-3 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-rose-700">DROP / WITHDRAWAL REQUIRED: {alert.client_name}</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  60-day warning expired. Client paid in full {alert.paid_full_date ? `since ${fmtDate(alert.paid_full_date)}` : ""} and has not entered paralegal review.
                  {alert.billable_amount != null && alert.total_fee != null && ` Billable hours (${fmt(alert.billable_amount)}) exceed flat fee (${fmt(alert.total_fee)}).`}
                </p>
              </div>
              <button onClick={() => dismissAlert(alert.id)} className="text-[10px] font-bold text-slate-500 hover:text-slate-900 border border-slate-200 px-2 py-1 rounded-lg flex-shrink-0">Ack</button>
            </div>
          ))}
          {warnAlerts.length > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-400/20 rounded-xl px-4 py-3">
              <Clock className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-700">{warnAlerts.length} Client{warnAlerts.length !== 1 ? "s" : ""} — 60-Day Document Deadline Active</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  These clients are paid in full (6+ months) with billable hours exceeding the flat fee. 60-day warning emails have been sent.{" "}
                  {warnAlerts.map(a => a.client_name).join(", ")}
                </p>
              </div>
              <button onClick={() => Promise.all(warnAlerts.map(a => dismissAlert(a.id)))} className="text-[10px] font-bold text-slate-500 hover:text-slate-900 border border-slate-200 px-2 py-1 rounded-lg flex-shrink-0">Ack All</button>
            </div>
          )}
        </div>
      )}
      {/* Sub-tab bar */}
      <div className="flex-shrink-0 border-b border-slate-200 bg-white/60">
        <div className="px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {SUB_TABS.map(t => {
            const count = t.id === "all" ? clients.length : clients.filter(t.filter).length;
            const noContactCount = t.id === "inactive"
              ? clients.filter(c => extStatus(c) === "inactive" && isNoContactFlagged(c)).length
              : 0;
            return (
              <button key={t.id} onClick={() => setSubTab(t.id)}
                className={`relative flex items-center gap-1.5 py-3 px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all -mb-px flex-shrink-0 ${
                  subTab === t.id ? "border-amber-400 text-amber-700" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}>
                {t.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${subTab === t.id ? "bg-amber-400/20 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                  {count}
                </span>
                {t.id === "on_hold" && pendingHolds > 0 && (
                  <span className="w-4 h-4 flex items-center justify-center text-[9px] font-bold bg-amber-400 text-slate-950 rounded-full">{pendingHolds}</span>
                )}
                {noContactCount > 0 && (
                  <span className="w-4 h-4 flex items-center justify-center text-[9px] font-bold bg-red-500 text-slate-900 rounded-full" title={`${noContactCount} client${noContactCount !== 1 ? "s" : ""} flagged for drop`}>{noContactCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or client ID…" className="w-full bg-slate-100 border border-slate-200 text-slate-900 text-xs rounded-xl pl-9 pr-3 py-2 placeholder-slate-600 focus:outline-none focus:border-slate-300" />
        </div>
        <select value={filterChapter} onChange={e => setFilterChapter(e.target.value as typeof filterChapter)} className="bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-2 focus:outline-none">
          <option value="all">All Chapters</option>
          <option value="7">Chapter 7</option>
          <option value="13">Chapter 13</option>
        </select>
        <span className="text-[11px] text-slate-600 ml-auto">{filtered.length} client{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* No-contact alert banner */}
      {(() => {
        const flagged = clients.filter(c => isNoContactFlagged(c) && !c.drop_requested_at && extStatus(c) !== "cancelled" && extStatus(c) !== "case_closed");
        if (flagged.length === 0) return null;
        return (
          <div className="flex-shrink-0 mx-4 sm:mx-6 mt-3 flex items-center gap-3 px-4 py-3 bg-red-500/8 border border-red-500/25 rounded-xl text-xs">
            <UserX className="w-4 h-4 text-rose-700 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-bold text-rose-700">{flagged.length} client{flagged.length !== 1 ? "s" : ""} flagged under the 6-month no-contact rule.</span>
              <span className="text-slate-600 ml-1.5">No contact in 180+ days. A drop email requires Attorney Super Admin approval.</span>
            </div>
            <button onClick={() => setSubTab("inactive")} className="flex-shrink-0 text-[10px] font-bold text-rose-700 bg-rose-50 border border-red-500/25 px-2.5 py-1 rounded-lg hover:bg-rose-100 transition-colors">
              View {flagged.length} Client{flagged.length !== 1 ? "s" : ""}
            </button>
          </div>
        );
      })()}

      {/* Split: table left, detail right */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Table */}
        <div className={`${selectedClient ? "hidden sm:flex" : "flex"} flex-col flex-1 overflow-hidden`}>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs w-48">Client Name</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">State</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Ch.</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Type</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Total Fee</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Balance</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Amt Due</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Status</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-wide text-xs">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-10 text-slate-600 text-xs">No clients in this category.</td></tr>
                )}
                {filtered.map(c => {
                  const { fs, paid, total, balance, nextDue, overdueCount, pastDueAmount } = clientStats(c);
                  const es = extStatus(c);
                  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
                  const isSelected = selectedClient?.id === c.id;
                  const hasPendingHold = holdRequests.some(r => r.client_id === c.id && r.status === "pending_approval");
                  const isPastDue = overdueCount > 0 && (es === "active" || es === "on_hold" || es === "inactive");
                  const isCurrent = balance > 0 && !isPastDue && (es === "active" || es === "on_hold");
                  const noContact = isNoContactFlagged(c);
                  const ncDays = noContactDays(c);

                  return (
                    <tr key={c.id}
                      onClick={() => setSelectedClient(isSelected ? null : c)}
                      className={`cursor-pointer transition-colors ${isSelected ? "bg-slate-100 border-l-2 border-amber-400" : noContact ? "bg-red-500/5 hover:bg-red-500/8 border-l-2 border-red-500/40" : isPastDue ? "bg-red-500/3 hover:bg-red-500/6" : "hover:bg-slate-100/25"}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${noContact ? "bg-rose-100 text-rose-700" : isPastDue ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-600"}`}>
                            {c.full_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{c.full_name}</p>
                            <p className="text-[10px] text-slate-600 truncate">{c.client_id}</p>
                          </div>
                          {hasPendingHold && (
                            <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-400/25">HOLD REQ</span>
                          )}
                          {noContact && !c.drop_requested_at && (
                            <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border bg-rose-100 text-rose-700 border-red-500/25">NO CONTACT {ncDays}d</span>
                          )}
                          {c.drop_requested_at && (
                            <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border bg-orange-500/15 text-orange-400 border-orange-500/25">DROP PENDING</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{c.state ?? "—"}</td>
                      <td className="px-3 py-3">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${c.chapter === 7 ? "bg-sky-50 text-sky-700 border-sky-500/20" : "bg-amber-50 text-amber-700 border-amber-400/20"}`}>
                          Ch. {c.chapter}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{CASE_TYPE_LABELS[c.case_type]}</td>
                      <td className="px-3 py-3 text-right">
                        <p className="text-slate-900 font-semibold">{fmt(total)}</p>
                        {total > 0 && (
                          <div className="mt-1 w-16 ml-auto bg-slate-200/50 rounded-full h-1">
                            <div className={`h-1 rounded-full ${isPastDue ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {balance === 0 ? (
                          <span className="text-emerald-700 font-semibold">Paid</span>
                        ) : (
                          <div>
                            <p className={`font-semibold ${isPastDue ? "text-rose-700" : "text-slate-900"}`}>{fmt(balance)}</p>
                            {isPastDue ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 bg-rose-50 border border-red-500/20 rounded px-1.5 py-0.5 mt-0.5">
                                <AlertTriangle className="w-2 h-2" /> {overdueCount} PAST DUE · {fmt(pastDueAmount)}
                              </span>
                            ) : isCurrent ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-500/20 rounded px-1.5 py-0.5 mt-0.5">
                                <CheckCircle2 className="w-2 h-2" /> Current
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {nextDue ? (
                          <div>
                            <p className="text-slate-900 font-semibold">{fmt(nextDue.amount_due ?? 0)}</p>
                            <p className="text-[10px] text-slate-600">{nextDue.due_date}</p>
                          </div>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${EXT_STATUS_COLORS[es]}`}>
                            {EXT_STATUS_LABELS[es]}
                          </span>
                          {balance === 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-500/20 rounded-full px-1.5 py-0.5">
                              <CheckCircle2 className="w-2 h-2" /> Paid in Full
                            </span>
                          ) : isPastDue ? (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 bg-rose-50 border border-red-500/20 rounded-full px-1.5 py-0.5">
                              <AlertTriangle className="w-2 h-2" /> Past Due
                            </span>
                          ) : isCurrent ? (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-sky-700 bg-sky-50 border border-sky-500/20 rounded-full px-1.5 py-0.5">
                              <CheckCircle2 className="w-2 h-2" /> Current
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          {/* Pay */}
                          {es !== "case_closed" && es !== "cancelled" && balance > 0 && (
                            <button
                              onClick={() => setQuickPayClient(c)}
                              title="Record payment"
                              className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-500/18 border border-emerald-500/20 px-2 py-1 rounded-lg transition-all"
                            >
                              <DollarSign className="w-3 h-3" /> Pay
                            </button>
                          )}
                          {/* Push */}
                          {(es === "active" || es === "on_hold") && (
                            <button
                              onClick={() => setHoldTarget({ client: c, type: "push_payment" })}
                              title="Push out next payment"
                              className="flex items-center gap-1 text-[10px] font-semibold text-sky-500 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-500/20 px-2 py-1 rounded-lg transition-all"
                            >
                              <Calendar className="w-3 h-3" /> Push
                            </button>
                          )}
                          {/* Hold */}
                          {es !== "on_hold" && es !== "case_closed" && es !== "cancelled" && (
                            <button
                              onClick={() => setHoldTarget({ client: c, type: "hold" })}
                              title="Place on hold"
                              className="flex items-center gap-1 text-[10px] font-semibold text-amber-500 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-400/20 px-2 py-1 rounded-lg transition-all"
                            >
                              <PauseCircle className="w-3 h-3" /> Hold
                            </button>
                          )}
                          {/* Drop (no-contact rule) */}
                          {noContact && !c.drop_requested_at && es !== "case_closed" && es !== "cancelled" && (
                            <button
                              onClick={() => setDropTarget(c)}
                              title="Drop client — 6-month no-contact rule"
                              className="flex items-center gap-1 text-[10px] font-bold text-rose-700 hover:text-rose-700 bg-red-500/12 hover:bg-rose-100 border border-red-500/30 px-2 py-1 rounded-lg transition-all"
                            >
                              <UserX className="w-3 h-3" /> Drop
                            </button>
                          )}
                          {/* Fee Adjust */}
                          {es !== "case_closed" && (
                            <button
                              onClick={() => setFeeAdjTarget(c)}
                              title="Adjust fees or payment plan"
                              className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-400/20 px-2 py-1 rounded-lg transition-all"
                            >
                              <Pencil className="w-3 h-3" /> Adjust
                            </button>
                          )}
                          {/* Cancel Review */}
                          {es !== "case_closed" && es !== "cancelled" && (
                            <button
                              onClick={() => setCxlTarget(c)}
                              title="Cancel Review — attempt retention before cancelling"
                              className="flex items-center gap-1 text-[10px] font-semibold text-rose-700 hover:text-rose-300 bg-rose-500/8 hover:bg-rose-500/15 border border-rose-500/20 px-2 py-1 rounded-lg transition-all"
                            >
                              <Ban className="w-3 h-3" /> Cancel Review
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail panel */}
        {selectedClient && (
          <div className="w-full sm:w-[420px] lg:w-[480px] flex-shrink-0 border-l border-slate-200 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 flex-shrink-0">
              <button onClick={() => openExitPrompt(selectedClient)} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900">
                <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Close
              </button>
              <button
                onClick={() => openExitPrompt(selectedClient)}
                className="flex items-center gap-1.5 text-[10px] font-semibold text-sky-700 hover:text-sky-300 bg-sky-50 hover:bg-sky-100 border border-sky-500/20 px-2.5 py-1.5 rounded-lg transition-all"
                title="Log time and close file"
              >
                <Clock className="w-3 h-3" /> Log &amp; Close
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ClientDetail
                client={selectedClient}
                payments={payments}
                feeStructure={feeStructures.find(f => f.client_id === selectedClient.id) ?? null}
                schedule={scheduleEntries.filter(s => s.client_id === selectedClient.id)}
                enrollment={autopayEnrollments.find(e => e.client_id === selectedClient.id && e.is_active)}
                retries={paymentRetries.filter(r => r.client_id === selectedClient.id)}
                merchantAccounts={merchantAccounts}
                timeLog={timeLog.filter(e => e.client_id === selectedClient.id)}
                additionalMatters={additionalMatters.filter(m => m.client_id === selectedClient.id)}
                staffList={staffMembers}
                adminUser={adminUser}
                onRefresh={onRefresh}
              />
            </div>
          </div>
        )}
      </div>

      {/* Exit / Log-time prompt modal */}
      {exitPromptClient && (() => {
        const inpE = "w-full bg-slate-100 border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-sky-400/50 transition-colors";
        const lblE = "text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block";
        const matched = staffMembers?.find(s => s.name === (adminUser?.replace(/\*+$/, "") ?? ""));
        const defRate = matched?.hourly_rate ?? DEFAULT_HOURLY_RATES[matched?.role ?? "paralegal"] ?? 225;
        const durMins = parseFloat(exitForm.duration_mins) || 0;
        const units   = minsToUnits(durMins);
        const bRate   = parseFloat(exitForm.billing_rate || String(defRate)) || 0;
        const bAmt    = exitForm.billable ? units * bRate : 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white border border-sky-500/20 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-sky-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">Log Time Before Closing</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">{exitPromptClient.full_name} · {exitPromptClient.client_id}</p>
                </div>
                <button onClick={() => saveExitEntry(true)} className="text-slate-500 hover:text-slate-900 p-1"><X className="w-4 h-4" /></button>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lblE}>Activity Type</label>
                    <select value={exitForm.activity_type} onChange={e => setExitForm(f => ({ ...f, activity_type: e.target.value }))} className={inpE}>
                      {Object.entries(ACTIVITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lblE}>Duration (minutes)</label>
                    <input type="number" min="1" step="1" value={exitForm.duration_mins} onChange={e => setExitForm(f => ({ ...f, duration_mins: e.target.value }))} placeholder="12" className={inpE} />
                    <p className="text-[9px] text-slate-600 mt-1">= <span className="text-amber-700 font-bold">{units} units</span></p>
                  </div>
                  <div>
                    <label className={lblE}>Staff Member</label>
                    {staffMembers && staffMembers.length > 0 ? (
                      <select
                        value={exitForm.billing_rate ? undefined : matched?.name}
                        onChange={e => {
                          const s = staffMembers.find(sm => sm.name === e.target.value);
                          setExitForm(f => ({ ...f, billing_rate: String(s?.hourly_rate ?? defRate) }));
                        }}
                        className={inpE}
                      >
                        {staffMembers.map(s => <option key={s.id} value={s.name}>{s.name} — ${s.hourly_rate ?? DEFAULT_HOURLY_RATES[s.role] ?? 225}/hr</option>)}
                      </select>
                    ) : (
                      <input value={adminUser?.replace(/\*+$/, "") ?? "Staff"} readOnly className={inpE} />
                    )}
                  </div>
                  <div>
                    <label className={lblE}>Hourly Rate ($/hr)</label>
                    <input type="number" min="0" step="25" value={exitForm.billing_rate || String(defRate)} onChange={e => setExitForm(f => ({ ...f, billing_rate: e.target.value }))} placeholder={String(defRate)} className={inpE} />
                  </div>
                  <div className="col-span-2">
                    <label className={lblE}>Notes</label>
                    <textarea value={exitForm.notes} onChange={e => setExitForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="What was done on this file…" className={`${inpE} resize-none`} />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div onClick={() => setExitForm(f => ({ ...f, billable: !f.billable }))}
                    className={`w-8 h-4 rounded-full transition-all flex items-center ${exitForm.billable ? "bg-amber-400" : "bg-slate-200"}`}>
                    <div className={`w-3 h-3 rounded-full bg-white mx-0.5 transition-all ${exitForm.billable ? "translate-x-4" : ""}`} />
                  </div>
                  <span className="text-xs text-slate-600">Billable</span>
                  {exitForm.billable && bAmt > 0 && <span className="text-xs font-bold text-emerald-700 ml-1">${bAmt.toFixed(2)}</span>}
                </label>
              </div>
              <div className="px-5 pb-5 flex gap-2 justify-end border-t border-slate-200 pt-4">
                <button onClick={() => saveExitEntry(true)} className="text-xs text-slate-500 hover:text-slate-900 px-4 py-2 rounded-xl border border-slate-200/50 hover:border-slate-300 transition-all">
                  Skip &amp; Close
                </button>
                <button onClick={() => saveExitEntry(false)} disabled={exitSaving}
                  className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold text-xs px-5 py-2 rounded-xl transition-all disabled:opacity-50">
                  {exitSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Log &amp; Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {holdTarget && (
        <HoldRequestModal
          client={holdTarget.client}
          requestType={holdTarget.type}
          adminUser={adminUser}
          role={role}
          holdRequests={holdRequests}
          onClose={() => setHoldTarget(null)}
          onSaved={() => { setHoldTarget(null); onRefresh(); }}
        />
      )}

      {quickPayClient && (
        <RecordPaymentModal
          client={quickPayClient}
          onClose={() => setQuickPayClient(null)}
          onSaved={() => { setQuickPayClient(null); onRefresh(); }}
        />
      )}

      {cxlTarget && (
        <QuickCancelModal
          client={cxlTarget}
          feeStructure={feeStructures.find(f => f.client_id === cxlTarget.id) ?? null}
          adminUser={adminUser}
          onClose={() => setCxlTarget(null)}
          onSaved={() => { setCxlTarget(null); onRefresh(); }}
        />
      )}
      {dropTarget && (
        <DropClientModal
          client={dropTarget}
          adminUser={adminUser}
          role={role}
          onClose={() => setDropTarget(null)}
          onSaved={() => { setDropTarget(null); onRefresh(); }}
        />
      )}
      {feeAdjTarget && (
        <FeeAdjustmentModal
          client={feeAdjTarget}
          feeStructure={feeStructures.find(f => f.client_id === feeAdjTarget.id) ?? null}
          adminUser={adminUser}
          onClose={() => setFeeAdjTarget(null)}
          onSaved={() => { setFeeAdjTarget(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Collections View ─────────────────────────────────────────────────────────

type CollectionsTier = "active" | "pending_withdrawal" | "inactive";

function CollectionsView({ adminUser }: { adminUser: string | null }) {
  const [cases, setCases]               = useState<CollectionCase[]>([]);
  const [contacts, setContacts]         = useState<CollectionContact[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedCase, setSelectedCase] = useState<CollectionCase | null>(null);
  const [previewMsg, setPreviewMsg]     = useState<string | null>(null);
  const [previewCase, setPreviewCase]   = useState<CollectionCase | null>(null);
  const [sending, setSending]           = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierTab, setTierTab]           = useState<CollectionsTier>("active");
  const [search, setSearch]             = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [cc, ct] = await Promise.all([
      api.get("collection_cases?order=days_past_due.desc"),
      api.get("collection_contacts?order=sent_at.desc"),
    ]);
    setCases(cc ?? []);
    setContacts(ct ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const urgencyColor = (days: number) => {
    if (days >= 90) return { bg: "bg-rose-50", text: "text-red-600 dark:text-rose-700", border: "border-red-500/20", badge: "bg-red-500" };
    if (days >= 60) return { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/20", badge: "bg-orange-500" };
    if (days >= 30) return { bg: "bg-amber-50", text: "text-amber-600 dark:text-amber-700", border: "border-amber-500/20", badge: "bg-amber-500" };
    return { bg: "bg-slate-100 dark:bg-slate-100", text: "text-slate-500", border: "border-slate-200 dark:border-slate-200", badge: "bg-slate-400" };
  };

  const previewFollowup = async (c: CollectionCase) => {
    setPreviewCase(c);
    setPreviewMsg(null);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/collections-ai-followup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({ case_id: c.id, channel: "in_app", preview_only: true }),
    });
    const data = await res.json();
    setPreviewMsg(data.message ?? "Unable to generate preview.");
  };

  const sendFollowup = async (c: CollectionCase) => {
    setSending(c.id);
    await fetch(`${SUPABASE_URL}/functions/v1/collections-ai-followup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({ case_id: c.id, channel: "in_app", preview_only: false }),
    });
    setSending(null);
    setPreviewCase(null);
    setPreviewMsg(null);
    await load();
  };

  const updateStatus = async (c: CollectionCase, status: CollectionCase["status"]) => {
    await api.patch("collection_cases", c.id, { status, updated_at: new Date().toISOString() });
    await load();
  };

  const updateTier = async (c: CollectionCase, tier: CollectionsTier) => {
    const extra: Record<string, unknown> = { collection_tier: tier, updated_at: new Date().toISOString() };
    if (tier === "pending_withdrawal") extra.pending_withdrawal_at = new Date().toISOString();
    if (tier === "inactive") extra.inactive_flagged_at = new Date().toISOString();
    await api.patch("collection_cases", c.id, extra);
    await load();
  };

  const processWithdrawal = async (c: CollectionCase, action: "returned_to_collections" | "processed_withdrawal") => {
    const extra: Record<string, unknown> = {
      withdrawal_action: action,
      withdrawal_processed_at: new Date().toISOString(),
      collection_tier: action === "returned_to_collections" ? "active" : "inactive",
      status: action === "returned_to_collections" ? "active" : "written_off",
      updated_at: new Date().toISOString(),
    };
    await api.patch("collection_cases", c.id, extra);
    await load();
  };

  // Tier classification: active = 90+ days past due in collections; inactive = paid or no contact 6mo; pending = 6mo into active collections
  const activeCases         = cases.filter(c => (c as CollectionCase & { collection_tier?: string }).collection_tier !== "inactive" && (c as CollectionCase & { collection_tier?: string }).collection_tier !== "pending_withdrawal" && c.days_past_due >= 90 && c.status !== "resolved" && c.status !== "written_off");
  const pendingWithdrawal   = cases.filter(c => (c as CollectionCase & { collection_tier?: string }).collection_tier === "pending_withdrawal");
  const inactiveCases       = cases.filter(c => (c as CollectionCase & { collection_tier?: string }).collection_tier === "inactive" || c.status === "resolved" || c.status === "written_off");

  const tierCases = tierTab === "active" ? activeCases : tierTab === "pending_withdrawal" ? pendingWithdrawal : inactiveCases;

  const filtered = tierCases.filter(c => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (search && !c.client_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const delinquent   = activeCases;
  const totalOwed    = delinquent.reduce((s, c) => s + c.outstanding_balance, 0);
  const band30       = cases.filter(c => c.days_past_due >= 30 && c.days_past_due < 60 && c.status === "active").length;
  const band90       = cases.filter(c => c.days_past_due >= 90 && c.status === "active").length;

  const STATUS_LABELS: Record<CollectionCase["status"], string> = {
    active: "Active", payment_arrangement: "Arrangement", resolved: "Resolved",
    written_off: "Written Off", on_hold: "On Hold",
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center p-12">
      <RefreshCw className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active Collections", value: activeCases.length.toString(), sub: "90+ days past due", color: "text-rose-700", icon: <AlertTriangle className="w-4 h-4" /> },
          { label: "Outstanding Balance", value: fmt(totalOwed), sub: "active cases", color: "text-rose-700", icon: <DollarSign className="w-4 h-4" /> },
          { label: "Pending Withdrawal", value: pendingWithdrawal.length.toString(), sub: "awaiting decision", color: "text-amber-700", icon: <Clock className="w-4 h-4" /> },
          { label: "Inactive / Resolved", value: inactiveCases.length.toString(), sub: "resolved or written off", color: "text-slate-600", icon: <TrendingDown className="w-4 h-4" /> },
        ].map(s => (
          <div key={s.label} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-3.5">
            <div className={`flex items-center gap-1.5 ${s.color} mb-1`}>{s.icon}<span className="text-[10px] font-semibold uppercase tracking-widest">{s.label}</span></div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-[var(--text-faint)] mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tier tabs */}
      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/50 rounded-xl p-1">
        {([
          { id: "active" as const, label: "Active Collections", badge: activeCases.length, color: "bg-red-500" },
          { id: "pending_withdrawal" as const, label: "Pending Withdrawal", badge: pendingWithdrawal.length, color: "bg-amber-500" },
          { id: "inactive" as const, label: "Inactive", badge: inactiveCases.length, color: "bg-slate-500" },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => { setTierTab(t.id); setStatusFilter("all"); }}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${tierTab === t.id ? "bg-slate-200 text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
          >
            {t.label}
            {t.badge > 0 && <span className={`text-[9px] font-bold text-slate-900 px-1.5 py-0.5 rounded-full ${t.color}`}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* Tier descriptions */}
      {tierTab === "active" && (
        <div className="bg-red-500/5 border border-red-500/15 rounded-xl px-4 py-2.5 text-xs text-rose-700">
          <strong>Active Collections:</strong> Clients 90+ days past due. AI follow-up enabled. Cases that remain unresolved for 6 months from 90-day entry will move to <strong>Pending Withdrawal</strong>.
        </div>
      )}
      {tierTab === "pending_withdrawal" && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-2.5 text-xs text-amber-700">
          <strong>Pending Withdrawal:</strong> Cases 6 months into active collections with no resolution. Staff must choose: <strong>Return to Collections</strong> (resume pursuit) or <strong>Process Withdrawal</strong> (close the case).
        </div>
      )}
      {tierTab === "inactive" && (
        <div className="bg-slate-200/20 border border-slate-200/30 rounded-xl px-4 py-2.5 text-xs text-slate-600">
          <strong>Inactive:</strong> Clients who paid all fees without filing, resolved accounts, written-off cases, or no pay/contact in 6+ months after collection efforts. These are archived but visible.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-faint)]" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search client…"
            className="w-full pl-8 pr-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl focus:outline-none focus:border-amber-500/50"
          />
        </div>
        {(["all", "active", "payment_arrangement", "on_hold", "resolved", "written_off"] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
              statusFilter === s
                ? "bg-amber-500 text-slate-900 border-amber-500"
                : "bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {s === "all" ? "All" : STATUS_LABELS[s as CollectionCase["status"]]}
          </button>
        ))}
        <button onClick={load} className="ml-auto flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Cases table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-faint)] text-sm">No collection cases match this filter.</div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(c => {
            const col = urgencyColor(c.days_past_due);
            const isSending = sending === c.id;
            const caseContacts = contacts.filter(ct => ct.case_id === c.id);
            const isExpanded = selectedCase?.id === c.id;
            const escalated = c.ai_contact_count >= 6 || c.days_past_due > 90;
            return (
              <div key={c.id} className={`bg-[var(--bg-surface)] border rounded-xl overflow-hidden transition-all ${col.border}`}>
                {/* Row header */}
                <div className="p-3.5 sm:p-4 flex flex-wrap items-start gap-3">
                  {/* Urgency badge */}
                  <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${col.badge}`} />

                  {/* Client info */}
                  <div className="flex-1 min-w-[140px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[var(--text-primary)]">{c.client_name}</span>
                      {escalated && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-rose-50 text-red-600 dark:text-rose-700 border border-red-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                          <AlertTriangle className="w-2.5 h-2.5" /> Escalate
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${col.bg} ${col.text} ${col.border}`}>
                        {c.days_past_due}d overdue
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-[var(--text-muted)]">{fmt(c.outstanding_balance)} outstanding</span>
                      <span className="text-xs text-[var(--text-faint)]">
                        {c.ai_contact_count} AI contact{c.ai_contact_count !== 1 ? "s" : ""}
                        {c.last_ai_contact_at && ` · last ${fmtDate(c.last_ai_contact_at)}`}
                      </span>
                    </div>
                  </div>

                  {/* Status pill */}
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                    c.status === "resolved" ? "bg-emerald-50 text-emerald-600 dark:text-emerald-700 border-emerald-500/20" :
                    c.status === "payment_arrangement" ? "bg-sky-50 text-sky-600 dark:text-sky-700 border-sky-500/20" :
                    c.status === "written_off" ? "bg-slate-500/10 text-slate-500 border-slate-300/20" :
                    c.status === "on_hold" ? "bg-amber-50 text-amber-600 dark:text-amber-700 border-amber-500/20" :
                    `${col.bg} ${col.text} ${col.border}`
                  }`}>
                    {STATUS_LABELS[c.status]}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Active collections actions */}
                    {tierTab === "active" && (
                      <>
                        {c.status === "active" && c.ai_followup_enabled && (
                          <button
                            onClick={() => previewFollowup(c)}
                            className="flex items-center gap-1.5 text-[10px] font-bold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-500/20 px-2.5 py-1.5 rounded-lg transition-all"
                          >
                            <Bot className="w-3 h-3" /> AI Follow-up
                          </button>
                        )}
                        {c.status === "active" && (
                          <button
                            onClick={() => updateStatus(c, "payment_arrangement")}
                            className="text-[10px] font-bold text-slate-600 hover:text-sky-700 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg transition-all"
                            title="Mark payment arrangement"
                          >
                            <CheckSquare className="w-3 h-3" />
                          </button>
                        )}
                        {(c.status === "active" || c.status === "payment_arrangement") && (
                          <button
                            onClick={() => updateStatus(c, "resolved")}
                            className="text-[10px] font-bold text-slate-600 hover:text-emerald-700 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg transition-all"
                            title="Mark resolved"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                          </button>
                        )}
                        {c.status === "active" && (
                          <button
                            onClick={() => updateTier(c, "pending_withdrawal")}
                            className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-500/20 px-2.5 py-1.5 rounded-lg transition-all hover:bg-amber-100"
                            title="Move to pending withdrawal"
                          >
                            Pending Withdrawal
                          </button>
                        )}
                        {c.status === "active" && (
                          <button
                            onClick={() => updateStatus(c, "written_off")}
                            className="text-[10px] font-bold text-slate-600 hover:text-rose-700 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg transition-all"
                            title="Write off"
                          >
                            <Ban className="w-3 h-3" />
                          </button>
                        )}
                      </>
                    )}

                    {/* Pending withdrawal actions */}
                    {tierTab === "pending_withdrawal" && (
                      <>
                        <button
                          onClick={() => processWithdrawal(c, "returned_to_collections")}
                          className="flex items-center gap-1.5 text-[10px] font-bold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-500/20 px-2.5 py-1.5 rounded-lg transition-all"
                        >
                          <RotateCcw className="w-3 h-3" /> Return to Collections
                        </button>
                        <button
                          onClick={() => processWithdrawal(c, "processed_withdrawal")}
                          className="flex items-center gap-1.5 text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-red-500/20 px-2.5 py-1.5 rounded-lg transition-all"
                        >
                          <Ban className="w-3 h-3" /> Process Withdrawal
                        </button>
                      </>
                    )}

                    {/* Inactive: no action buttons, read-only */}

                    <button
                      onClick={() => setSelectedCase(isExpanded ? null : c)}
                      className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      <History className="w-3 h-3" /> {isExpanded ? "Hide" : "History"}
                    </button>
                  </div>
                </div>

                {/* Expanded contact history */}
                {isExpanded && (
                  <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] mb-2">Contact History</p>
                    {caseContacts.length === 0 ? (
                      <p className="text-xs text-[var(--text-faint)] py-2">No contacts recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {caseContacts.map(ct => (
                          <div key={ct.id} className="flex gap-3 text-xs">
                            <div className="flex-shrink-0 w-20 text-[var(--text-faint)]">{fmtDate(ct.sent_at)}</div>
                            <div className="flex-1">
                              <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full mr-2 ${
                                ct.contact_type === "escalated" ? "bg-rose-50 text-red-600 dark:text-rose-700" : "bg-sky-50 text-sky-600 dark:text-sky-700"
                              }`}>
                                {ct.contact_type === "ai_followup" ? "AI" : ct.contact_type === "escalated" ? "Escalated" : ct.contact_type}
                              </span>
                              <span className="text-[var(--text-muted)]">{ct.sent_by ?? "Agent"}</span>
                              {ct.message_sent && (
                                <p className="text-[var(--text-faint)] mt-1 leading-relaxed text-[11px]">{ct.message_sent}</p>
                              )}
                              {ct.payment_made_after && ct.payment_amount_after && (
                                <p className="text-emerald-600 dark:text-emerald-700 text-[10px] mt-0.5 font-semibold">Payment received: {fmt(ct.payment_amount_after)}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AI Preview Modal */}
      {previewCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center">
                <Bot className="w-4 h-4 text-sky-600 dark:text-sky-700" />
              </div>
              <div>
                <p className="font-bold text-sm text-[var(--text-primary)]">AI Follow-up Preview</p>
                <p className="text-[11px] text-[var(--text-muted)]">{previewCase.client_name} · Contact #{previewCase.ai_contact_count + 1}</p>
              </div>
              <button onClick={() => { setPreviewCase(null); setPreviewMsg(null); }} className="ml-auto text-[var(--text-faint)] hover:text-[var(--text-secondary)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-xl p-4 mb-4 min-h-[80px]">
              {previewMsg === null ? (
                <div className="flex items-center gap-2 text-[var(--text-faint)] text-xs">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating message…
                </div>
              ) : (
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{previewMsg}</p>
              )}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-[var(--text-faint)] mb-4">
              <MessageSquare className="w-3 h-3" />
              This message will be sent as an in-app notification to the client portal.
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setPreviewCase(null); setPreviewMsg(null); }}
                className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-2)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => sendFollowup(previewCase)}
                disabled={previewMsg === null || sending === previewCase.id}
                className="flex items-center gap-1.5 text-xs font-bold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-slate-900 px-4 py-2 rounded-xl transition-all"
              >
                {sending === previewCase.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <SendHorizonal className="w-3.5 h-3.5" />}
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AccountingPortal() {
  const [tab, setTab]                   = useState<TabId>("clients");
  const [clients, setClients]           = useState<AClient[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments]         = useState<Payment[]>([]);
  const [scheduleEntries, setSchedule]  = useState<ScheduleEntry[]>([]);
  const [trustAccounts, setTrustAccounts] = useState<TrustAccount[]>([]);
  const [transfers, setTransfers]       = useState<FundTransfer[]>([]);
  const [notifications, setNotifications] = useState<TransferNotification[]>([]);
  const [filedRegistry, setFiledRegistry] = useState<FiledCaseRegistry[]>([]);
  const [ioltaSignoffs, setIoltaSignoffs] = useState<IoltaSignoff[]>([]);
  const [merchantAccounts, setMerchantAccounts] = useState<MerchantAccount[]>([]);
  const [autopayEnrollments, setAutopayEnrollments] = useState<AutopayEnrollment[]>([]);
  const [paymentRetries, setPaymentRetries] = useState<PaymentRetry[]>([]);
  const [cancelRequests, setCancelRequests] = useState<CancelRequest[]>([]);
  const [lifecycleAlerts, setLifecycleAlerts] = useState<LifecycleAlert[]>([]);
  const [cancelTasks, setCancelTasks] = useState<CancelRequestTask[]>([]);
  const [disengagementNotices, setDisengagementNotices] = useState<DisengagementNotice[]>([]);
  const [batchRequests, setBatchRequests] = useState<BatchTransferRequest[]>([]);
  const [holdRequests, setHoldRequests] = useState<HoldRequest[]>([]);
  const [timeLog, setTimeLog] = useState<TimeLogEntry[]>([]);
  const [firmStaff, setFirmStaff] = useState<FirmStaff[]>([]);
  const [staffMembers, setStaffMembers] = useState<{ id: string; name: string; role: string; hourly_rate: number | null }[]>([]);
  const [additionalMatters, setAdditionalMatters] = useState<AdditionalMatter[]>([]);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [showAddClient, setShowAddClient] = useState(false);
  const [adminUser, setAdminUser]       = useState<string | null>(null);

  const role = roleOf(adminUser);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, f, p, s, ta, tr, nt, fr, so, ma, ae, pr, cr, br, hr, tl, st, am, sm, la, ct, dn] = await Promise.all([
      api.get("accounting_clients?order=created_at.desc"),
      api.get("accounting_fee_structures"),
      api.get("accounting_payments?order=payment_date.desc"),
      api.get("accounting_payment_schedule?order=due_date.asc"),
      api.get("accounting_trust_accounts?order=state.asc,account_type.asc"),
      api.get("accounting_fund_transfers?order=created_at.desc"),
      api.get("accounting_transfer_notifications?order=created_at.desc"),
      api.get("accounting_filed_case_registry?order=filed_date.desc"),
      api.get("accounting_iolta_signoffs?order=signed_at.desc"),
      api.get("accounting_merchant_accounts?order=processor.asc,account_key.asc"),
      api.get("accounting_autopay_enrollments?order=enrolled_at.desc"),
      api.get("accounting_payment_retries?order=created_at.desc"),
      api.get("accounting_cancel_requests?order=created_at.desc"),
      api.get("accounting_batch_transfer_requests?order=created_at.desc"),
      api.get("client_hold_requests?order=created_at.desc"),
      api.get("case_time_log?order=started_at.desc"),
      api.get("firm_staff?order=full_name.asc"),
      api.get("client_additional_matters?order=created_at.desc"),
      api.get("staff_members?select=id,name,role,hourly_rate&is_active=eq.true&order=name.asc"),
      api.get("client_lifecycle_alerts?order=triggered_at.desc"),
      api.get("cancel_request_tasks?order=created_at.desc"),
      api.get("disengagement_notices?order=created_at.desc"),
    ]);
    setClients(c ?? []);
    setFeeStructures(f ?? []);
    setPayments(p ?? []);
    setSchedule(s ?? []);
    setTrustAccounts(ta ?? []);
    setTransfers(tr ?? []);
    setNotifications(nt ?? []);
    setFiledRegistry(fr ?? []);
    setIoltaSignoffs(so ?? []);
    setMerchantAccounts(ma ?? []);
    setAutopayEnrollments(ae ?? []);
    setPaymentRetries(pr ?? []);
    setCancelRequests(cr ?? []);
    setBatchRequests(br ?? []);
    setHoldRequests(hr ?? []);
    setTimeLog((tl as TimeLogEntry[]) ?? []);
    setFirmStaff((st as FirmStaff[]) ?? []);
    setAdditionalMatters((am as AdditionalMatter[]) ?? []);
    setStaffMembers((sm as { id: string; name: string; role: string; hourly_rate: number | null }[]) ?? []);
    setLifecycleAlerts((la as LifecycleAlert[]) ?? []);
    setCancelTasks((ct as CancelRequestTask[]) ?? []);
    setDisengagementNotices((dn as DisengagementNotice[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingNotifCount = notifications.filter(n => n.status === "pending" && new Date() >= new Date(n.notify_after)).length;

  const totalCollected = payments.filter(p => !p.voided).reduce((s, p) => s + p.amount, 0);

  const pendingSignoffCount = filedRegistry.filter(r =>
    r.transfer_status === "pending_signoff" && r.case_number_verified && !r.iolta_balance_verified
  ).length;

  const pendingCancelCount   = cancelRequests.filter(r => r.status === "pending").length;
  const activeRetryCount     = paymentRetries.filter(r => r.status === "retrying").length;
  const openLifecycleAlerts  = lifecycleAlerts.filter(a => a.status === "open").length;
  const pendingCancelTasks   = cancelTasks.filter(t => t.status === "pending").length;
  const pendingRefunds       = disengagementNotices.filter(n => n.refund_status === "calculated" || n.refund_status === "approved").length;

  const readyForTransferCount = filedRegistry.filter(r => r.transfer_status === "signed_off" && r.iolta_balance_verified && (r.iolta_verified_amount ?? 0) > 0).length;
  const pendingBatchCount     = batchRequests.filter(b => b.status === "pending_approval" || b.status === "approved").length;

  const TABS: { id: TabId; label: string; icon: JSX.Element; badge?: number; superAdminOnly?: boolean; adminOnly?: boolean }[] = [
    { id: "clients",       label: "Clients",       icon: <Users className="w-3.5 h-3.5" />, badge: (activeRetryCount + openLifecycleAlerts) || undefined },
    { id: "cancellations", label: "Cancellations", icon: <Ban className="w-3.5 h-3.5" />, badge: (pendingCancelCount + pendingCancelTasks + pendingRefunds) || undefined },
    { id: "collections",   label: "Collections",   icon: <TrendingDown className="w-3.5 h-3.5" /> },
    { id: "accounts",      label: "Accounts",      icon: <Landmark className="w-3.5 h-3.5" />, badge: pendingNotifCount || undefined, superAdminOnly: true },
    { id: "trust_hub",     label: "Trust Hub",     icon: <Vault className="w-3.5 h-3.5" />, badge: (readyForTransferCount + pendingBatchCount) || undefined, superAdminOnly: true },
    { id: "reports",       label: "Reports",       icon: <BarChart2 className="w-3.5 h-3.5" />, superAdminOnly: true },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)]" style={{ fontFamily: "'Inter', 'Trebuchet MS', sans-serif" }}>

      <header className="sticky top-0 z-30 flex-shrink-0 bg-[var(--bg-surface)]/95 backdrop-blur border-b border-[var(--border)]">
        {/* Top bar */}
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-700 flex items-center justify-center flex-shrink-0 shadow-sm shadow-red-700/30">
              <Scale className="w-4 h-4 text-slate-900" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[var(--text-primary)] text-sm tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>
                bankruptcy<span className="text-red-700">.ai</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full">
                Accounting
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Role switcher */}
            <div className="hidden sm:flex items-center gap-0.5 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl p-0.5">
              {(["none","admin","accounting_super_admin","super_admin"] as const).map(r => {
                const LABELS: Record<string, string> = { none: "None", admin: "Acct Admin", accounting_super_admin: "Acct Super", super_admin: "Atty Super" };
                const ACTIVE_CLS: Record<string, string> = {
                  none: "bg-[var(--bg-surface-3)] text-[var(--text-secondary)]",
                  admin: "bg-[var(--bg-surface-3)] text-[var(--text-primary)]",
                  accounting_super_admin: "bg-red-700/10 text-red-700 dark:text-rose-700 border border-red-700/30",
                  super_admin: "bg-emerald-100 text-emerald-600 dark:text-emerald-700 border border-emerald-500/25",
                };
                const INACTIVE_CLS = "text-[var(--text-muted)] hover:text-[var(--text-secondary)]";
                const isActive = role === r;
                return (
                  <button
                    key={r}
                    onClick={() => setAdminUser(r === "none" ? null : r === "accounting_super_admin" ? "Demo User**" : r === "super_admin" ? "Demo User*" : "Demo User")}
                    className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all ${isActive ? ACTIVE_CLS[r] : INACTIVE_CLS}`}
                  >
                    {LABELS[r]}
                  </button>
                );
              })}
            </div>

            {/* Total collected */}
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl px-2.5 py-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span className="font-semibold text-[var(--text-secondary)]">{fmt(totalCollected)}</span>
            </span>

            {/* Staff management — visible to admin and above */}
            {(role === "admin" || role === "accounting_super_admin" || role === "super_admin") && (
              <button onClick={() => setShowStaffModal(true)} className="flex items-center gap-1.5 bg-[var(--bg-surface-2)] hover:bg-[var(--bg-surface-3)] border border-[var(--border)] text-[var(--text-secondary)] font-bold text-xs px-3 py-2 rounded-xl transition-all">
                <UserCheck className="w-3.5 h-3.5" /> Staff
              </button>
            )}

            {/* Add client */}
            <button onClick={() => setShowAddClient(true)} className="flex items-center gap-1.5 bg-red-700 hover:bg-red-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm shadow-red-700/20">
              <Plus className="w-3.5 h-3.5" /> Add Client
            </button>
          </div>
        </div>

        {/* Tab nav */}
        <div className="px-4 sm:px-6 flex items-center border-t border-[var(--border-subtle)]">
          {TABS.filter(t => !t.superAdminOnly || role === "super_admin" || role === "accounting_super_admin").map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-1.5 py-2.5 px-1 mr-5 text-xs font-semibold border-b-2 transition-all -mb-px ${
                tab === t.id
                  ? "border-red-700 text-red-700 dark:text-rose-700"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {t.icon}{t.label}
              {t.badge ? (
                <span className="absolute -top-0.5 -right-2 min-w-[1rem] h-4 flex items-center justify-center text-[9px] font-bold bg-red-700 text-white rounded-full px-1">{t.badge}</span>
              ) : null}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 text-[var(--text-muted)]">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        </div>
      ) : tab === "reports" ? (
        (role === "super_admin" || role === "accounting_super_admin") ? (
          <div className="flex-1 overflow-hidden">
            <ReportsView clients={clients} payments={payments} feeStructures={feeStructures} cancelRequests={cancelRequests} adminUser={adminUser} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Shield className="w-10 h-10 text-[var(--text-faint)] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[var(--text-muted)]">Accounting Super Admin access required</p>
              <p className="text-xs text-[var(--text-faint)] mt-1">Use the role switcher in the header to switch roles.</p>
            </div>
          </div>
        )
      ) : tab === "trust_hub" ? (
        (role === "super_admin" || role === "accounting_super_admin") ? (
          <div className="flex-1 overflow-hidden">
            <TrustTransferHub
              clients={clients}
              payments={payments}
              feeStructures={feeStructures}
              filedRegistry={filedRegistry}
              ioltaSignoffs={ioltaSignoffs}
              trustAccounts={trustAccounts}
              transfers={transfers}
              adminUser={adminUser}
              onRefresh={load}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Vault className="w-10 h-10 text-[var(--text-faint)] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[var(--text-muted)]">Accounting Super Admin access required</p>
              <p className="text-xs text-[var(--text-faint)] mt-1">Use the role switcher in the header to switch roles.</p>
            </div>
          </div>
        )
      ) : tab === "collections" ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          <CollectionsView adminUser={adminUser} />
        </div>
      ) : tab === "cancellations" ? (
        <div className="flex-1 overflow-hidden">
          <CancellationsView
            clients={clients}
            cancelRequests={cancelRequests}
            cancelTasks={cancelTasks}
            disengagementNotices={disengagementNotices}
            feeStructures={feeStructures}
            payments={payments}
            timeLog={timeLog}
            adminUser={adminUser}
            onRefresh={load}
          />
        </div>
      ) : tab === "filed" ? (
        <div className="flex-1 overflow-hidden">
          <FiledCasesView
            clients={clients}
            payments={payments}
            feeStructures={feeStructures}
            filedRegistry={filedRegistry}
            ioltaSignoffs={ioltaSignoffs}
            adminUser={adminUser}
            onRequestAdmin={() => {}}
            onRefresh={load}
          />
        </div>
      ) : tab === "accounts" ? (
        (role === "super_admin" || role === "accounting_super_admin") ? (
          <div className="flex-1 overflow-hidden">
            <AccountsView
              trustAccounts={trustAccounts}
              transfers={transfers}
              notifications={notifications}
              clients={clients}
              feeStructures={feeStructures}
              scheduleEntries={scheduleEntries}
              payments={payments}
              adminUser={adminUser}
              onRequestAdmin={() => {}}
              onRefresh={load}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Landmark className="w-10 h-10 text-[var(--text-faint)] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[var(--text-muted)]">Accounting Super Admin access required</p>
              <p className="text-xs text-[var(--text-faint)] mt-1">Use the role switcher in the header to switch roles.</p>
            </div>
          </div>
        )
      ) : (
        <ClientsTableView
          clients={clients}
          feeStructures={feeStructures}
          payments={payments}
          scheduleEntries={scheduleEntries}
          autopayEnrollments={autopayEnrollments}
          paymentRetries={paymentRetries}
          merchantAccounts={merchantAccounts}
          holdRequests={holdRequests}
          cancelRequests={cancelRequests}
          lifecycleAlerts={lifecycleAlerts}
          timeLog={timeLog}
          additionalMatters={additionalMatters}
          staffMembers={staffMembers}
          adminUser={adminUser}
          role={role}
          onRefresh={load}
        />
      )}

      {showAddClient && (
        <AddClientModal onClose={() => setShowAddClient(false)} onSaved={() => { setShowAddClient(false); load(); }} />
      )}
      {showStaffModal && (
        <StaffModal staff={firmStaff} onClose={() => setShowStaffModal(false)} onSaved={load} />
      )}
    </div>
  );
}
