import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Users, Phone, Mail, MessageSquare, Calendar, Clock, CheckCircle2, Circle, AlertTriangle, ChevronRight, RefreshCw, Plus, X, Send, Search, Filter, ChevronDown, Bot, UserCheck, FileText, DollarSign, Scale, MapPin, ArrowRight, Flag, Zap, Info, CreditCard as Edit3, Save, Eye, Briefcase, Hash, CheckCheck, PenLine, Star, TrendingUp, BarChart2, ArrowLeft, Shield, Mic, ChevronLeft, Building, Car, PiggyBank, CreditCard, Home, User, Trash2, Play, PhoneCall, PhoneMissed, PhoneOutgoing, MailCheck, MessageCircle, ListChecks, Import as SortAsc, BellRing, BellOff, Inbox, Thermometer } from "lucide-react";
import { getApplicableExemptions, getWaHomesteadEligibility, getCaHomesteadByCounty, FEDERAL_EXEMPTIONS } from "./components/admin/exemptions";
import CaseAcceptanceFlow, { AcceptanceData as CaseAcceptanceData } from "./components/CaseAcceptanceFlow";
import { CASE_TYPES, CHAPTER_FILING_FEES, ATTORNEY_FEES, CREDIT_COUNSELING_FEE } from "./lib/feeSchedule";
import { mapIntakePortalRoleToPlatformRole, canAcceptCase } from "./lib/auth";
import { getFirmFeatures } from "./lib/featureFlags";
import NewClientModal from "./admin/NewClientModal";
import { supabase } from "./lib/supabase";
import IntakeDashboard, {
  ConsolidatedMessagingWidget,
  type ClientMessageThread as DashClientMessageThread,
  type ClientMessage as DashClientMessage,
  type StaffMessage as DashStaffMessage,
} from "./components/intake-dashboard/IntakeDashboard";
import LeadsByMonthChart from "./components/intake-dashboard/LeadsByMonthChart";
import StaffGuidedIntake from "./components/intake-script/StaffGuidedIntake";
import NewLeadInline from "./components/intake-new-lead/NewLeadInline";
import ConsultSchedulerPanel, {
  StaffAvailabilityList, todayInFirmTz,
  StaffDetail as SchedulerStaffDetail,
  CalEvent as SchedulerCalEvent,
  SchedulerSelection,
} from "./components/scheduler/ConsultSchedulerPanel";
import { isClaimedByOther, LeadClaimBadge, LeadClaimBanner } from "./components/lead-claim/LeadClaim";
import FloatingChat from "./components/floating-chat/FloatingChat";
import AllAnswersView, { ALL_ANSWERS_SCHEMA, renderAnswerValue } from "./components/intake-review/AllAnswersView";
import FormDataInventory from "./components/intake-dashboard/FormDataInventory";
import { calcDebtComposition } from "./AttorneyIntakeDashboard";
import CaseAdvancementStatusBar from "./components/intake-review/CaseAdvancementStatusBar";
import ClientTimeLog, { useClientTimeLog } from "./components/intake-review/ClientTimeLog";
import UpdateIntakeInfoModal from "./components/intake-review/UpdateIntakeInfoModal";
// Simplified attorney portal — read-only Completed Reviews tab (firm-wide
// history of decided attorney_intake_reviews). Only rendered for the
// pure-attorney role (isAtty && !isSuperAdmin).
import AttorneyCompletedReviews from "./legal-portal/AttorneyCompletedReviews";
import StaffSettingsPanel, { type StaffSettingsViewerRole } from "./components/staff-settings/StaffSettingsPanel";
import DepartmentSettingsPanel, { type DepartmentSettingsViewerRole } from "./components/admin-settings/DepartmentSettingsPanel";
import { setCurrentAttorneyName, clearCurrentAttorneyName, getCurrentAttorneyName } from "./lib/currentAttorney";
import { scaleNationalStandards2025, getMedianAnnualIncome as storeGetMedian, getCurrentRulesetVersion, diffRulesetVersions } from "./lib/irsMeansStandards";
import { evaluateReviewStaleness } from "./lib/ruleStaleness";
import { getEffectiveLivingStandard } from "./components/law-firm-settings/livingStandardsOverlay";
import { useFirmDmiTriageThreshold, useFirmMinimumDebtThreshold } from "./lib/firmPolicy";
import {
  isExcludedFromCMI, sumHouseholdContributionsForCMI,
  type HouseholdContributor,
} from "./lib/cmi";
import { classifyCommitmentPeriod } from "./lib/ch13Commitment";

// V1 TODO BAN-40 phase 2: thread firm_id from auth/firm context. Both pilot
// firms get the same feature-flag config per Section 6 of the V1 migration,
// so the hardcoded MLG id is functionally equivalent to whichever firm a
// user belongs to during the pilot.
const V1_DEFAULT_FIRM_ID = "00000000-0000-0000-0000-000000000001";

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
  // ─── Lead-locking scaffold (read-only) ────────────────────────────────
  // Optional today — column doesn't exist yet. Once the migration lands
  // (see src/components/lead-claim/LeadClaim.tsx for the spec), the lock
  // surfaces start enforcing automatically without further frontend work.
  claimed_by?: string | null;
  claimed_by_name?: string | null;
  claimed_at?: string | null;
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
  /** Stage-5 presentation tracking (Prompt 52). Optional — the columns
   *  may not yet exist in the DB; PostgREST omits the keys when so. The
   *  CaseAdvancementStatusBar tolerates undefined values gracefully. */
  presentation_scheduled_at?: string | null;
  presented_at?: string | null;
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

async function sbUpsert(table: string, body: object) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
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

// Means-test median income — reads LIVE from the centralized legal-reference
// store (src/lib/irsMeansStandards.ts → MEDIAN_INCOME_BY_STATE). The old
// hardcoded MEDIAN_INCOME fallback table was removed; the store covers all
// 50 states + DC + territories from the 4/1/2026 UST table and applies the
// per-person add-on for households > 4. Editing the median page propagates
// here automatically because every call goes through storeGetMedian().
function stateMedian(state: string, houseSize: number): number {
  // Single source of truth. Returns 0 when the state isn't loaded — callers
  // should treat 0 as "median not loaded" and surface the verification flag
  // rather than silently using a stale fallback.
  return storeGetMedian(state, houseSize) ?? 0;
}

// CMI excluded sources + helpers — now consumed from the centralized
// src/lib/cmi.ts module so every CMI-consuming surface (LegalAdminPortal,
// AttorneyIntakeDashboard) reads the same SS-exclusion list. SS is
// statutorily excluded; this is enforced, NOT a firm setting. SS still
// appears on Schedule I (current-monthly-income-at-filing snapshot) —
// the exclusion applies only to CMI / means-test / over-median checks.
// (See src/lib/cmi.ts header for the full contract.)

// Compute current monthly income per Form 122A-1 (6-month lookback ÷ 6).
// Excludes SS and VA benefits as required by statute via isExcludedFromCMI().
// Includes regular household-member contributions per § 101(10A)(B); SS-
// sourced contributions are excluded via the shared SS-exclusion logic.
//
// For individual filers with a non-filing spouse (filing_type =
// "individual-nonfiling-spouse"), NFS income (owner: "nfs") is INCLUDED
// per § 101(10A). The marital adjustment deduction for NFS expenses not
// benefiting the household is applied separately at the Signing Review
// attorney surface (Form 122A-1 line 17a) — see MaritalAdjustmentPanel.
function computeCMI(sub: Record<string, unknown>): number {
  const sources = (sub.income_sources_json as {
    grossPerPeriod?: number | string;
    payFrequency?: string;
    sourceType?: string;
    owner?: string;  // "debtor" | "spouse" | "nfs" | "household" — set by ClientIntakeForm.tsx
  }[] | null) ?? [];
  let monthly = 0;
  for (const s of sources) {
    // Skip SS / VA — excluded from CMI per Form 122A-1 (centralized in cmi.ts).
    if (isExcludedFromCMI(s.sourceType)) continue;
    const gp = Number(s.grossPerPeriod ?? 0);
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

  // § 101(10A)(B) — regular household-member contributions toward the
  // debtor's household expenses count toward CMI as the contribution
  // amount. SS-sourced contributions are dropped by
  // sumHouseholdContributionsForCMI per Part B spec.
  const dependents = (sub.dependents_json as HouseholdContributor[] | null) ?? [];
  const contribCMI = sumHouseholdContributionsForCMI(dependents);
  monthly += contribCMI;

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
  // Ruleset version this review was completed against. Scaffold field —
  // TODO Phase B: add `reviewed_ruleset_version text` column to
  // attorney_intake_reviews. Until the DB column exists this comes through
  // null and `needsReReview` falls into the "tracking not enabled" branch.
  reviewed_ruleset_version?: string | null;
  // Lifecycle status flags — TODO Phase B: drive from a `case_status`
  // enum column (intake_leads or attorney_intake_reviews). Today derived
  // from review_status + decided_at heuristic in deriveCaseLifecycle().
  case_status?: 'reviewed_pending_signing' | 'filed' | 'closed' | string | null;
  // Per-case attorney override on the firm DMI triage flag. Attorney-only
  // edit; audit-logged via the existing saveReviewFields path. Toggling
  // ON proceeds under Ch.7 despite the triage flag; the warning and the
  // seeded Issue STAY visible by design — the override does not erase
  // the screen, it just records the attorney's call. TODO Phase B —
  // add `attorney_override_dmi_triage boolean` column.
  attorney_override_dmi_triage?: boolean | null;
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
  const [activeTab, setActiveTab] = useState<"eligibility" | "issues" | "allAnswers" | "decision">("eligibility");
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
  //
  // FIRM DMI TRIAGE SCREEN (NOT the statutory § 707(b)(2) presumption).
  // This is the firm-policy screen that routes intake between Ch.7 and
  // Ch.13 attorney review. The threshold is firm-set (default $500/mo)
  // and adjusted in Law Firm Settings → Firm Policy. The statutory
  // means-test two-bracket presumption + IRS-allowable long-form
  // deductions are a SEPARATE evaluation (the #6/#7 build).
  //
  // Income side: CMI per Form 122A-1 (6-mo lookback ÷ 6). NOTE — what we
  // really want for triage is the Schedule J net (Schedule I current
  // monthly income at filing − Schedule J expenses). Schedule I (current
  // at filing) is NOT computed in the codebase yet — see Part C gap
  // report in PROMPT 5. We use CMI − actual expenses as the interim
  // disposable-income proxy.
  const cmi = submission ? computeCMI(submission) : (lead.income_estimate ?? 0);
  const houseSize = submission ? computeHouseholdSize(submission) : 1 + (Number(submission?.num_dependents ?? 0));
  const medianAnnual = stateMedian(lead.state ?? "CO", houseSize);
  const medianMonthly = medianAnnual / 12;
  const aboveMedian = cmi > medianMonthly;
  const totalExpenses = submission ? computeTotalExpenses(submission) : 0;
  const disposableIncome = cmi - totalExpenses;
  const firmDmiThreshold = useFirmDmiTriageThreshold();
  const firmMinDebt = useFirmMinimumDebtThreshold();
  // Triage routing: ≤ threshold → Ch.7 path; > threshold → Ch.13 review
  // path. Non-blocking — both chapters stay available; the warning + the
  // seeded Issue surface the recommended path, and the attorney decides.
  const overFirmDmiThreshold = disposableIncome > firmDmiThreshold;
  // Total debt for the firm-minimum-debt check (Part B). Same composition
  // as the existing Est. Total Debt display sites in this file.
  const totalDebt = submission
    ? (Number(submission.credit_card_debt ?? 0)
       + Number(submission.medical_debt ?? 0)
       + Number(submission.secured_debt ?? 0)
       + Number(submission.personal_loan_debt ?? 0)
       + Number(submission.other_unsecured ?? 0))
    : (Number(lead.debt_estimate ?? 0));
  const belowFirmMinDebt = totalDebt > 0 && totalDebt < firmMinDebt;
  // Both chapters remain available; the screen never blocks acceptance.
  const ch7Eligible = true;
  const ch13Eligible = true;
  // Downstream `meansTestResult` consumers (DB write, decision badge,
  // qualify-target callout) still receive the same "pass" | "borderline" |
  // "fail" enum so we don't churn the database column and the existing UI.
  // The enum is now derived from the FIRM TRIAGE screen — copy elsewhere
  // is relabeled as firm intake-triage, NOT § 707(b)(2) statutory
  // presumption.
  const meansTestResult: "pass" | "fail" | "borderline" =
    !aboveMedian ? "pass"
    : overFirmDmiThreshold ? "fail"
    : "borderline";

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
        // Auto-generate review record with computed data.
        // attorney_name is the LOGGED-IN attorney (set on PortalLogin via
        // setCurrentAttorneyName + persisted to sessionStorage); was
        // hardcoded "Jennifer Smith, Esq." and would attribute every
        // auto-generated review to Jennifer regardless of who logged in.
        const body: Partial<IntakeReview> = {
          lead_id: lead.id,
          submission_id: String(submission.id ?? ""),
          attorney_name: getCurrentAttorneyName(),
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

    // ── Firm minimum-debt threshold Issue (Part B) ──
    //
    // Fires when the case's total debt falls below the firm-policy
    // minimum. Non-blocking — the firm can still accept; the warning +
    // Issue persist so the attorney addresses it on review. Reuses the
    // Part E attorney-review Issue pattern.
    if (belowFirmMinDebt) {
      toInsert.push({
        review_id: reviewId, category: "income", severity: "warning", sort_order: order++,
        title: `Total debt ${fmt(totalDebt)} below firm minimum ${fmt(firmMinDebt)} — review case acceptance`,
        description:
          `Total debt of approximately ${fmt(totalDebt)} is below the firm's case-acceptance ` +
          `minimum of ${fmt(firmMinDebt)}. This is a firm-policy threshold, not a statutory ` +
          `bar — the case is still acceptable. Confirm with the attorney whether the case ` +
          `warrants firm representation at this debt level (or consider a referral / brief- ` +
          `service alternative). Adjust the threshold in Law Firm Settings → Firm Policy.`,
      });
    }

    // ── Firm DMI triage Issue (NOT § 707(b)(2) statutory presumption) ──
    //
    // Fires when the case's positive monthly disposable income exceeds the
    // firm-set threshold (default $500/mo, configurable in Law Firm
    // Settings → Firm Policy). Routes the case to Ch.13 attorney-review.
    // Non-blocking: the case is still accepted; the Issue and the warning
    // STAY even if the attorney toggles the per-case override.
    if (overFirmDmiThreshold) {
      toInsert.push({
        review_id: reviewId, category: "income", severity: "warning", sort_order: order++,
        title: `Positive disposable income more than $${firmDmiThreshold.toLocaleString()}`,
        description:
          `Disposable income ≈ ${fmt(disposableIncome)}/mo exceeds the firm's intake-triage ` +
          `threshold of $${firmDmiThreshold.toLocaleString()}/mo — routing to Chapter 13 ` +
          `attorney-review. This is the firm's intake screen, NOT the statutory § 707(b)(2) ` +
          `means-test presumption; the formal two-bracket presumption (with IRS allowable ` +
          `long-form deductions on Form 122A-2 / 122C-2) is a separate evaluation. ` +
          `CMI ${fmt(cmi)} vs ${lead.state ?? "CO"} ${houseSize}-person median ${fmt(medianMonthly)}/mo. ` +
          `The case remains acceptable; the attorney decides whether to proceed under Ch.13 or override.`,
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

    // Priority Debts — Unfiled tax returns. Client self-reported on the intake
    // form that a priority back-tax entry has taxFiled === "no". The IRS
    // generally requires returns for the 4 most recent tax years be filed
    // before bankruptcy; unfiled returns can lead to dismissal under § 1308
    // (Ch.13) or delay/discharge issues. Surface this as an attorney action item.
    {
      const fd = (submission?.form_data as Record<string, unknown> | undefined) ?? null;
      const priorityDebts = Array.isArray(fd?.priorityDebts) ? (fd!.priorityDebts as Array<Record<string, unknown>>) : [];
      const unfiled = priorityDebts.filter(d => d.type === "back_taxes" && d.taxFiled === "no");
      if (unfiled.length > 0) {
        const years = unfiled.map(d => String(d.taxYear ?? "—")).filter(Boolean).join(", ");
        const total = unfiled.reduce((a, d) => a + (parseFloat((d.amount as string) ?? "0") || 0), 0);
        toInsert.push({
          review_id: reviewId, category: "tax_compliance", severity: "error", sort_order: order++,
          title: `Unfiled Tax Returns — ${unfiled.length} year(s) flagged${years ? ` (${years})` : ""}`,
          description: `Client self-reported unfiled tax returns for ${unfiled.length} priority tax year(s)${years ? ` (${years})` : ""}, total approx ${fmt(total)} owed. The IRS generally requires returns for the 4 most recent tax years be filed before bankruptcy. Under 11 U.S.C. § 1308, the Ch.13 trustee may move to dismiss if pre-petition returns are not filed. Advise client to file all delinquent returns — typically BEFORE the petition is filed.`,
        });
      }
    }

    // Pending personal injury claim — disclosed in Personal Property step.
    // PI claims are an asset of the bankruptcy estate and must be listed on
    // Schedule A/B; exemption treatment varies by state. Flag for review.
    {
      const fd = (submission?.form_data as Record<string, unknown> | undefined) ?? null;
      const piFlag = String(fd?.hasPiClaimInProperty ?? "") === "yes";
      const piDetails = String(fd?.piClaimInPropertyDetails ?? "").trim();
      if (piFlag) {
        toInsert.push({
          review_id: reviewId, category: "assets", severity: "error", sort_order: order++,
          title: "Pending Personal Injury Claim — Asset Disclosure Required",
          description: `Client disclosed a pending personal injury claim${piDetails ? `: "${piDetails}"` : "."} The claim is an asset of the bankruptcy estate (Schedule A/B). Confirm exemption treatment under the applicable state PI-claim exemption (or wildcard) and ensure proceeds are properly disclosed if received post-petition.`,
        });
      }
    }

    // Inheritance / will / trust / estate expectation. § 541(a)(5) sweeps in
    // bequests, devises, inheritances, life-insurance proceeds, and property-
    // settlement payments received within 180 days POST-petition into the
    // estate. Timing the filing matters. Flag for review.
    {
      const fd = (submission?.form_data as Record<string, unknown> | undefined) ?? null;
      const inhFlag = String(fd?.expectsInheritance ?? "") === "yes";
      const inhDetails = String(fd?.inheritanceDetails ?? "").trim();
      if (inhFlag) {
        toInsert.push({
          review_id: reviewId, category: "assets", severity: "error", sort_order: order++,
          title: "Expected Inheritance / Trust / Estate Distribution — 180-Day Rule",
          description: `Client expects to receive money from a will, trust, or estate${inhDetails ? `: "${inhDetails}"` : "."} Under 11 U.S.C. § 541(a)(5), any inheritance, bequest, devise, or life-insurance proceeds the debtor becomes entitled to within 180 days AFTER filing belongs to the bankruptcy estate. Time the filing carefully (consider filing after the 180-day window passes or after the distribution is received and spent on exempt assets / necessities).`,
        });
      }
    }

    // Tax filing compliance — § 1308 (Ch.13) requires pre-petition returns
    // be filed; § 521(e)(2)(A) requires the most recent return in Ch.7.
    // Surface unfiled-tax disclosures and "not required" claims for follow-up.
    {
      const fd = (submission?.form_data as Record<string, unknown> | undefined) ?? null;
      const taxStatus = String(fd?.hasFiledAllTaxReturns ?? "");
      if (taxStatus === "no") {
        const years = String(fd?.unfiledTaxYears ?? "").trim();
        const ack = fd?.confirmedMustFileBeforeFiling === true;
        toInsert.push({
          review_id: reviewId,
          category: "tax_compliance",
          severity: "error",
          sort_order: order++,
          title: `Unfiled Tax Returns — Filing Gate (${years || "years not specified"})`,
          description:
            `Client self-reported unfiled tax returns${years ? ` for ${years}` : ""}. ` +
            `Under § 1308 (Ch.13) the trustee may move to dismiss if pre-petition returns aren't filed; § 521(e)(2)(A) requires the most recent return in Ch.7. ` +
            `Client acknowledgment captured: ${ack ? "YES — they confirmed they must file before bankruptcy" : "NO — acknowledgment NOT captured, follow up"}. ` +
            `Work with the client to get all required returns filed BEFORE the petition is filed. Revisit this item before any case decision.`,
        });
      } else if (taxStatus === "not_required") {
        const reason = String(fd?.notRequiredReason ?? "");
        const otherDetail = String(fd?.notRequiredOtherDetails ?? "").trim();
        toInsert.push({
          review_id: reviewId,
          category: "tax_compliance",
          severity: "warning",
          sort_order: order++,
          title: "Client Claims No Filing Obligation — Verify",
          description:
            `Client says they are not required to file tax returns. Reason: ${reason || "—"}` +
            (reason === "other" && otherDetail ? ` ("${otherDetail}")` : "") +
            `. Confirm with the client there is truly no filing obligation (SS-only income, below filing threshold, etc.) and document the basis in the case file. If a return is required, work with the client to file before the petition.`,
        });
      }
    }

    // Pending claims / money owed (Schedule A/B) — these are estate assets
    // that must be valued and disclosed. Surface for attorney review of
    // exemption treatment + collectability analysis.
    {
      const fd = (submission?.form_data as Record<string, unknown> | undefined) ?? null;
      if (String(fd?.hasPendingClaims ?? "") === "yes") {
        const valueUnknown = fd?.pendingClaimsValueUnknown === true;
        const value = parseFloat(String(fd?.pendingClaimsValue ?? "0")) || 0;
        const desc = String(fd?.pendingClaimsDesc ?? "").trim();
        toInsert.push({
          review_id: reviewId,
          category: "assets",
          severity: "warning",
          sort_order: order++,
          title: `Pending Claim / Money Owed — ${valueUnknown ? "value unknown" : fmt(value)}`,
          description:
            `Client disclosed a pending claim or money owed to them${desc ? `: "${desc}"` : "."} ` +
            (valueUnknown
              ? `Value listed as unknown — attorney should estimate for Schedule A/B and exemption analysis. `
              : `Estimated value ${fmt(value)}. `) +
            `This is an asset of the bankruptcy estate. Confirm exemption coverage (wildcard or specific category) and document the collection prospects.`,
        });
      }
    }

    // Pending lawsuits against the client (SOFA) — affects automatic stay
    // timing, potential non-dischargeability (fraud, intentional torts),
    // and Schedule E/F treatment of the claim.
    {
      const fd = (submission?.form_data as Record<string, unknown> | undefined) ?? null;
      if (String(fd?.pendingLawsuits ?? "") === "yes") {
        const entries = Array.isArray(fd?.lawsuitEntries) ? (fd!.lawsuitEntries as Array<Record<string, unknown>>) : [];
        const lines = entries
          .filter(ls => ls.plaintiff || ls.suitType)
          .map(ls => {
            const plaintiff = String(ls.plaintiff ?? "—");
            const type = String(ls.suitType ?? "");
            const typeOther = String(ls.suitTypeOther ?? "");
            const typeLabel = type === "other" && typeOther ? typeOther : type;
            const valueUnknown = ls.claimValueUnknown === true;
            const value = parseFloat(String(ls.claimValue ?? "0")) || 0;
            const details = String(ls.details ?? "");
            return `${plaintiff} (${typeLabel || "type ?"}) — value: ${valueUnknown ? "unknown" : fmt(value)}; details: ${details || "—"}`;
          });
        toInsert.push({
          review_id: reviewId,
          category: "lawsuits",
          severity: "error",
          sort_order: order++,
          title: `Pending Lawsuit(s) — ${entries.length} case(s) disclosed`,
          description:
            `Client disclosed ${entries.length} pending lawsuit(s) against them. ` +
            (lines.length ? `Detail: ${lines.join(" · ")}. ` : "") +
            `Review for: (1) automatic-stay applicability (§ 362), (2) non-dischargeability triggers (§ 523 — fraud, willful/malicious injury, DUI judgments), (3) classification on Schedule E/F (disputed/unliquidated/contingent), (4) timing of filing relative to any imminent judgment.`,
        });
      }
    }

    // Trust disclosure — client said yes to creating / transferring assets
    // into a trust in the last 10 years. § 548 fraudulent-transfer lookback
    // is 2 years federal / up to 10 years under most state UFTA/UVTA
    // adoptions. § 541 estate inclusion depends on revocable vs. irrevocable.
    // Surface every trust entry so the attorney can analyze.
    {
      const fd = (submission?.form_data as Record<string, unknown> | undefined) ?? null;
      if (String(fd?.createdTrust ?? "") === "yes") {
        const trusts = Array.isArray(fd?.trustEntries) ? (fd!.trustEntries as Array<Record<string, unknown>>) : [];
        const totalValue = trusts.reduce((a, t) => a + (parseFloat(String(t.propertyValue ?? "0")) || 0), 0);
        const lines = trusts
          .filter(t => t.trustName || t.propertyTransferred)
          .map(t => {
            const name = String(t.trustName ?? "(unnamed)");
            const prop = String(t.propertyTransferred ?? "");
            const val = parseFloat(String(t.propertyValue ?? "0")) || 0;
            const trustee = String(t.trusteeName ?? "");
            const bene = String(t.beneficiaryName ?? "");
            const type = String(t.trustType ?? "");
            return `${name} (${type || "type unknown"}) — transferred: ${prop || "—"} (${fmt(val)}); trustee: ${trustee || "—"}; beneficiary: ${bene || "—"}`;
          });
        toInsert.push({
          review_id: reviewId,
          category: "trust_transfers",
          severity: "error",
          sort_order: order++,
          title: `Trust Transfer Disclosure — ${trusts.length} trust(s), ~${fmt(totalValue)} total`,
          description:
            `Client disclosed creating or transferring assets into ${trusts.length} trust(s) in the last 10 years (~${fmt(totalValue)} total). ` +
            (lines.length ? `Detail: ${lines.join(" · ")}. ` : "") +
            `Analyze under § 548 (federal 2-yr lookback for fraudulent transfers) + state UFTA/UVTA (up to 10 yrs in most states). For § 541 estate inclusion: revocable trust assets are generally still property of the estate; irrevocable trusts may be excluded depending on terms (spendthrift clauses, third-party settlors). Confirm self-settled vs. third-party-settled status.`,
        });
      }
    }

    // Vehicle purchase date analysis. Two checks per financed/leased vehicle:
    //   (1) Purchased within 90 days → lien-perfection check (§ 547)
    //   (2) Owned ≥ 910 days + financed → Ch.13 cramdown eligibility
    //       (§ 1325(a) "hanging paragraph" — 910-day rule on PMSI cars)
    {
      const fd = (submission?.form_data as Record<string, unknown> | undefined) ?? null;
      const vehicles = Array.isArray(fd?.vehicles) ? (fd!.vehicles as Array<Record<string, unknown>>) : [];
      vehicles.forEach((v, vi) => {
        const purchaseDateRaw = String(v.purchaseDate ?? "");
        if (!purchaseDateRaw) return;
        const purchaseDate = new Date(purchaseDateRaw);
        if (isNaN(purchaseDate.getTime())) return;
        const daysSince = Math.floor((Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        const desc = `${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""}`.trim() || `Vehicle #${vi + 1}`;
        const isFinanced = v.hasLoan === "yes" || v.isLease === "loan";

        if (daysSince < 90 && isFinanced) {
          toInsert.push({
            review_id: reviewId,
            category: "vehicles",
            severity: "error",
            sort_order: order++,
            title: `Recent Vehicle Purchase (${daysSince}d) — Verify Lien Perfection`,
            description:
              `${desc} was purchased ${daysSince} day(s) ago (within the 90-day preference window). ` +
              `Confirm the lender perfected the lien within 30 days of attachment per § 547(c)(3); late-perfected liens can be voidable as preferential transfers. ` +
              `Also relevant to § 522(f) lien avoidance + hanging-paragraph analysis.`,
          });
        }
        if (daysSince >= 910 && isFinanced) {
          const balance = parseFloat(String(v.loanBalance ?? "0")) || 0;
          const value = parseFloat(String(v.value ?? "0")) || 0;
          const underwater = balance > value;
          toInsert.push({
            review_id: reviewId,
            category: "vehicles",
            severity: underwater ? "warning" : "info",
            sort_order: order++,
            title: `${desc} — Owned ${Math.floor(daysSince/365)}y, Possible Ch.13 Cramdown`,
            description:
              `${desc} owned ${daysSince} days (>910). The § 1325(a) hanging-paragraph 910-day rule does NOT apply, so the secured claim can be bifurcated and crammed down to the vehicle's current value in Ch.13. ` +
              (underwater
                ? `Loan balance ${fmt(balance)} > value ${fmt(value)} (underwater by ${fmt(balance - value)}). Cramdown could save the client ${fmt(balance - value)} + interest savings (Till rate vs. contract rate). `
                : `Loan balance ${fmt(balance)} vs. value ${fmt(value)}. `) +
              `Confirm in attorney review whether cramdown is part of the plan strategy.`,
          });
        }
      });
    }

    // Borrowed-vehicle disclosure — client regularly drives a vehicle owned
    // by someone else. May affect the IRS transportation "ownership cost"
    // allowance on the means test. Flag for attorney review.
    {
      const fd = (submission?.form_data as Record<string, unknown> | undefined) ?? null;
      if (String(fd?.borrowedVehicleUse ?? "") === "yes") {
        const pays = String(fd?.borrowedVehiclePays ?? "");
        const amt = parseFloat(String(fd?.borrowedVehicleAmount ?? "0")) || 0;
        const desc = String(fd?.borrowedVehicleDescription ?? "").trim();
        toInsert.push({
          review_id: reviewId,
          category: "expenses",
          severity: "warning",
          sort_order: order++,
          title: "Borrowed Vehicle Use — IRS Transportation Allowance May Need Adjustment",
          description:
            `Client regularly drives a vehicle that belongs to someone else${desc ? `: "${desc}"` : "."} ` +
            (pays === "yes"
              ? `Client pays ${fmt(amt)}/mo toward that vehicle. `
              : "Client does not pay for the vehicle. ") +
            `Review whether the IRS transportation "ownership cost" allowance applies (typically denied if the debtor doesn't make payments on a titled vehicle, per In re Ransom). Document the arrangement on Form 122A and Schedule J.`,
        });
      }
    }

    // Expenses over IRS National Standards. The five National-Standards
    // categories (food, housekeeping, apparel, personal care, miscellaneous)
    // are capped at the IRS amount for the means test. If the client's
    // ACTUAL spending exceeds the standard and substituting the standard
    // would push monthly disposable income past $500/mo, that's a Ch.7
    // risk because the trustee will likely allow only the standard amount.
    // Per firm spec: surface even smaller overages so the attorney sees the
    // comparison, but escalate severity when the swing matters.
    {
      const fd = (submission?.form_data as Record<string, unknown> | undefined) ?? null;
      if (fd) {
        const num = (v: unknown) => parseFloat(String(v ?? "0")) || 0;
        // Actuals — sum the line items the form captures for each category.
        const actualFood = num(fd.expFood);
        const actualHousekeeping = num(fd.expHouseholdSupplies);
        const actualApparel = num(fd.expClothing);
        const actualPersonalCare = num(fd.expPersonalCare);
        const actualMisc = num(fd.expMisc);
        const actualTotal = actualFood + actualHousekeeping + actualApparel + actualPersonalCare + actualMisc;

        // Read the EFFECTIVE National Standards for this household size:
        // canonical (from scaleNationalStandards2025) layered with the
        // firm overlay (set in Law Firm Settings → Living Standards by an
        // attorney supervisor/owner). The static reader works across
        // provider trees, so an overlay set in LawFirmSettings flows into
        // this means-test substitution in LegalAdminPortal.
        //
        // The stale May-2024 `scaleNationalStandards` legacy fallback was
        // removed — null cells from the 2025 publication (e.g.
        // outOfPocketHealth) stay null and the line drops out of the
        // standard total rather than being filled with stale numbers.
        const ns2025 = scaleNationalStandards2025(houseSize);
        const sizeKey = houseSize <= 4 ? houseSize : -1;
        const effectiveStd = (field: keyof typeof ns2025, canonical: number | null): number => {
          const path = `living_standards.national.${field}.size${sizeKey}`;
          return getEffectiveLivingStandard(path, canonical) ?? 0;
        };
        const ns = {
          food:                  effectiveStd("food",                 ns2025.food),
          housekeepingSupplies:  effectiveStd("housekeepingSupplies", ns2025.housekeepingSupplies),
          apparelServices:       effectiveStd("apparelServices",      ns2025.apparelServices),
          personalCare:          effectiveStd("personalCare",         ns2025.personalCare),
          miscellaneous:         effectiveStd("miscellaneous",        ns2025.miscellaneous),
        };
        const standardTotal = ns.food + ns.housekeepingSupplies + ns.apparelServices + ns.personalCare + ns.miscellaneous;

        const overage = actualTotal - standardTotal;
        if (overage > 0) {
          // Disposable income IF we substitute the IRS standard for the
          // five National-Standards categories. That's currentDMI + overage.
          // We compare against the FIRM DMI TRIAGE THRESHOLD (firm-policy,
          // not statutory) — the same cutoff that routes the intake screen
          // between Ch.7 and Ch.13. The hardcoded $500 "means_test_707b"
          // fallback was removed (Part E #5); the threshold now reads from
          // Law Firm Settings → Firm Policy.
          const projectedDMI = disposableIncome + overage;
          const meansTestCeiling = firmDmiThreshold;
          const flipsMeansTest = projectedDMI > meansTestCeiling;
          const lines: string[] = [];
          if (actualFood > ns.food) lines.push(`Food: actual ${fmt(actualFood)} vs IRS ${fmt(ns.food)} (+${fmt(actualFood - ns.food)})`);
          if (actualHousekeeping > ns.housekeepingSupplies) lines.push(`Housekeeping: actual ${fmt(actualHousekeeping)} vs IRS ${fmt(ns.housekeepingSupplies)} (+${fmt(actualHousekeeping - ns.housekeepingSupplies)})`);
          if (actualApparel > ns.apparelServices) lines.push(`Apparel: actual ${fmt(actualApparel)} vs IRS ${fmt(ns.apparelServices)} (+${fmt(actualApparel - ns.apparelServices)})`);
          if (actualPersonalCare > ns.personalCare) lines.push(`Personal care: actual ${fmt(actualPersonalCare)} vs IRS ${fmt(ns.personalCare)} (+${fmt(actualPersonalCare - ns.personalCare)})`);
          if (actualMisc > ns.miscellaneous) lines.push(`Miscellaneous: actual ${fmt(actualMisc)} vs IRS ${fmt(ns.miscellaneous)} (+${fmt(actualMisc - ns.miscellaneous)})`);
          toInsert.push({
            review_id: reviewId,
            category: "expenses",
            severity: flipsMeansTest ? "warning" : "warning",
            sort_order: order++,
            title: flipsMeansTest
              ? `Expenses Over IRS Standard — Triage At Risk (substituted DMI ${fmt(projectedDMI)}/mo)`
              : `Expenses Over IRS Standard — Review (overage ${fmt(overage)}/mo)`,
            description:
              `Client's actual spending in IRS National-Standards categories exceeds the standard by ${fmt(overage)}/mo. ${lines.join(" · ")}. ` +
              `If the trustee allows only the IRS standard, projected disposable income would be ${fmt(projectedDMI)}/mo` +
              (flipsMeansTest
                ? ` — over the firm's $${firmDmiThreshold.toLocaleString()}/mo intake-triage threshold. This is the firm screen (NOT § 707(b)(2) statutory presumption); the substituted DMI may route the case to Ch.13 review even when actual numbers point to Ch.7. Confirm the overage is reasonable and documented, or counsel the client on reducing the overage before filing.`
                : `. Under the firm's $${firmDmiThreshold.toLocaleString()}/mo intake-triage threshold, but worth confirming the overage is reasonable and documented.`),
          });
        }
      }
    }

    // Income changes — client self-reported either (a) current income differs
    // from the past 6 months, or (b) expects income to change. Means-test CMI
    // is calculated on a 6-month lookback by default but the attorney can
    // adjust forward-looking based on the explanation. Flag for review.
    {
      const fd = (submission?.form_data as Record<string, unknown> | undefined) ?? null;
      const matchAns = String(fd?.incomeMatches6Mo ?? "");
      const futureAns = String(fd?.incomeFutureChange ?? "");
      const matchDetails = String(fd?.incomeMatchDetails ?? "").trim();
      const futureDetails = String(fd?.incomeFutureChangeDetails ?? "").trim();
      const flagged = matchAns === "no" || futureAns === "up" || futureAns === "down";
      if (flagged) {
        const parts: string[] = [];
        if (matchAns === "no") parts.push(`Current income differs from the last 6 months${matchDetails ? `: "${matchDetails}"` : "."}`);
        if (futureAns === "up") parts.push(`Client expects income to go UP${futureDetails ? `: "${futureDetails}"` : "."}`);
        if (futureAns === "down") parts.push(`Client expects income to go DOWN${futureDetails ? `: "${futureDetails}"` : "."}`);
        toInsert.push({
          review_id: reviewId, category: "income", severity: "warning", sort_order: order++,
          title: "Income Change Disclosed — Means-Test Analysis Should Account",
          description: parts.join(" ") + " Means-test CMI is the 6-month average by default. Consider whether to adjust the projected disposable income calculation based on actual or expected income going forward.",
        });
      }
    }

    for (const issue of toInsert) {
      await sbPost("attorney_intake_issues", issue);
    }
  }

  async function saveReviewFields(fields: Partial<IntakeReview>) {
    if (!review) return;
    // Stamp the current ruleset version on every save so the most recent
    // attorney review carries the version it was completed against. The
    // Cases-Needing-Review queue compares this against the live store
    // version to flag stale reviews — see needsReReview() below.
    const currentVersion = getCurrentRulesetVersion().id;
    const fieldsWithVersion: Partial<IntakeReview> = {
      ...fields,
      reviewed_ruleset_version: currentVersion,
    };
    await fetch(`${SUPABASE_URL}/rest/v1/attorney_intake_reviews?id=eq.${review.id}`, {
      method: "PATCH",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      // PATCH body intentionally drops reviewed_ruleset_version until the
      // DB column exists — see IntakeReview interface comment. Local state
      // tracks it for the in-session re-review check.
      body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
    });
    setReview(prev => prev ? { ...prev, ...fieldsWithVersion } : prev);
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

    // Update attorney_case_acceptances table (legacy compatibility).
    // attorney_name resolves to the logged-in attorney; was hardcoded
    // "Jennifer Smith, Esq." in the original implementation.
    const legacyBody = {
      lead_id: lead.id,
      submission_id: String(submission?.id ?? ""),
      attorney_name: getCurrentAttorneyName(),
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

    if (decision === "accepted") {
      await sbUpsert("clients", {
        id: lead.id,
        lead_id: lead.id,
        name: lead.full_name,
        email: lead.email ?? null,
        phone: lead.phone ?? null,
        status: "intake_complete",
      });
      await sbPost("case_acceptances", {
        client_id: lead.id,
        lead_id: lead.id,
        chapter: String(fields.chapter ?? "7"),
        attorney_fee: fields.attorney_fee ?? null,
        filing_fee: fields.court_filing_fee ?? null,
        is_bifurcated: fields.case_type === "ch7_bifurcated",
        accepted_by: legacyBody.attorney_name,
        acceptance_notes: fields.decision_notes ?? null,
        decided_at: fields.decided_at ?? null,
      });
    }

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

        {/* ── Rule-change re-review banner ──
              Compares the stored ruleset version on this review against
              the live store version. Cases that have been reviewed but
              are NOT YET FILED or CLOSED show the banner with the reason
              and a "Re-confirm" action; filed/closed cases are LOCKED and
              never re-flagged. */}
        {(() => {
          const caseStatus = (review?.case_status ?? "").toLowerCase();
          const locked = caseStatus === "filed" || caseStatus === "closed";
          if (locked) return null;
          const decided = !!review?.decided_at; // attorney has signed off → in-window
          if (!decided) return null;
          const current = getCurrentRulesetVersion();
          const reason = diffRulesetVersions(review?.reviewed_ruleset_version ?? null, current);
          if (!reason) return null;
          return (
            <div className="mx-6 mt-4 mb-2 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs text-amber-100 leading-relaxed">
                <p className="font-bold text-amber-300 mb-1">⚑ Needs re-review — rules changed</p>
                <p>{reason}</p>
                <p className="mt-1 text-amber-200/80">This case was reviewed against an older ruleset. Signing / marking-filed is blocked until the attorney re-confirms against the current rules.</p>
              </div>
              <button type="button"
                onClick={()=>saveReviewFields({})}
                className="flex-shrink-0 text-[11px] font-semibold bg-amber-400 hover:bg-amber-300 text-slate-900 px-3 py-1.5 rounded">
                Re-confirm against current rules
              </button>
            </div>
          );
        })()}

        {/* ── Tabs ── Consolidated lawyer flow: Eligibility / Summary →
            Issues → All Answers (read-only mirror of the locked
            questionnaire) → Decision. "All Answers" sits immediately
            BEFORE Decision so the attorney can scan answers + missing
            fields right before signing off. The standalone "Review Intake"
            modal in LeadDetailPanel is now hidden for lawyers — All Answers
            IS the review-intake surface for them. */}
        <div className="flex border-b border-slate-800 flex-shrink-0">
          {([
            { id: "eligibility", label: "Eligibility / Summary" },
            { id: "issues",      label: `Issues ${issues.length > 0 ? `(${issues.length})` : ""}` },
            { id: "allAnswers",  label: "All Answers" },
            { id: "decision",    label: "Decision" },
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

          {/* ══════════ ELIGIBILITY / SUMMARY TAB ══════════ */}
          {activeTab === "eligibility" && (
            <div className="space-y-5">
              {/* ── SUMMARY: Assets / Income / Expenses + Rules + Recommendation ── */}
              {(() => {
                const fd = (submission?.form_data as Record<string, unknown> | undefined) ?? null;

                // ── Helpers — read from form_data with safe coercion ──────
                const num = (v: unknown): number => {
                  if (v == null || v === '') return 0;
                  const n = typeof v === 'number' ? v : parseFloat(String(v));
                  return Number.isFinite(n) ? n : 0;
                };
                const arr = (v: unknown): Array<Record<string, unknown>> =>
                  Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];

                // ── Assets ────────────────────────────────────────────────
                type Row = { label: string; value: number };
                const assetRows: Row[] = fd ? [
                  ...arr(fd.properties).map((p, i) => ({
                    label: `Real property #${i + 1}${p.address ? ` — ${String(p.address).slice(0, 40)}` : ''}`,
                    value: num(p.propertyValue),
                  })),
                  ...arr(fd.vehicles).map((v, i) => ({
                    label: `Vehicle #${i + 1}${v.year ? ` — ${v.year} ${v.make ?? ''} ${v.model ?? ''}` : ''}`.trim(),
                    value: num(v.value),
                  })),
                  { label: 'Bank balances',           value: num(fd.bankBalance) },
                  { label: 'Retirement (ERISA)',     value: num(fd.retirementBalance) },
                  { label: 'Stocks / brokerage',     value: num(fd.stocksValue) },
                  { label: 'Crypto',                 value: num(fd.cryptoValue) },
                  { label: 'Life insurance cash value', value: num(fd.lifeInsuranceCashValue) },
                  { label: 'Firearms',               value: num(fd.firearmValue) },
                  { label: 'Collectibles',           value: num(fd.collectiblesValue) },
                  { label: 'Household goods',        value: num(fd.householdGoodsValue) },
                  { label: 'Jewelry',                value: num(fd.jewelryValue) },
                  { label: 'Tools of trade',         value: num(fd.toolsValue) },
                  ...arr(fd.annuities).map((a, i) => ({
                    label: `Annuity #${i + 1}${a.annuityType ? ` — ${a.annuityType}` : ''}`,
                    value: num(a.currentValue),
                  })),
                ].filter(r => r.value > 0) : [];
                const assetsTotal = assetRows.reduce((s, r) => s + r.value, 0);

                // ── Income ────────────────────────────────────────────────
                const incomeRows: Row[] = fd ? [
                  { label: 'Debtor monthly gross',   value: num(fd.debtorMonthlyGross) },
                  { label: 'Spouse monthly gross',   value: num(fd.spouseMonthlyGross) },
                  { label: 'SS retirement (debtor)', value: num(fd.dSsRetirement) },
                  { label: 'SS disability (debtor)', value: num(fd.dSsDisability) },
                  { label: 'VA benefits (debtor)',   value: num(fd.dVeterans) },
                ].filter(r => r.value > 0) : [];
                const incomeTotal = incomeRows.reduce((s, r) => s + r.value, 0);

                // ── Expenses (Schedule J) ────────────────────────────────
                const expenseRows: Row[] = fd ? [
                  { label: 'Rent / mortgage',  value: num(fd.expRentMortgage) },
                  { label: 'Utilities',        value: num(fd.expUtilities) },
                  { label: 'Food',             value: num(fd.expFood) },
                  { label: 'Transportation',   value: num(fd.expTransportation) },
                  { label: 'Medical',          value: num(fd.expMedical) },
                  { label: 'Insurance',        value: num(fd.expInsurance) },
                  { label: 'Childcare',        value: num(fd.expChildcare) },
                  { label: 'Other',            value: num(fd.expOther) },
                ].filter(r => r.value > 0) : [];
                const expensesTotalFd = expenseRows.reduce((s, r) => s + r.value, 0);

                // ── Business-debt composition (current + potential bypass) ──
                // calcDebtComposition with no overrides reflects current state
                // (all classifiable buckets default to consumer).
                // potentialComp simulates classifying personalLoanDebt as business
                // — surfaces the resolving explanation BEFORE the attorney
                // actually flips the toggle in the AttorneyIntakeDashboard's
                // Issues tab, so the auto-text is visible here on first view.
                const currentComp = fd ? calcDebtComposition(fd, {}) : null;
                const potentialComp = fd ? calcDebtComposition(fd, { personalLoanDebt: 'business' }) : null;
                const meansTestResolvedByBizDebt =
                  aboveMedian && !!potentialComp && potentialComp.primarilyBusiness;
                const bizDebtResolvingPct = potentialComp?.pct ?? 0;

                // ── Missing required fields ──────────────────────────────
                // Walk ALL_ANSWERS_SCHEMA, count blanks per the same logic
                // AllAnswersView uses so the count matches the tab badge.
                let missingFieldCount = 0;
                if (fd) {
                  ALL_ANSWERS_SCHEMA.forEach(sec => {
                    sec.fields.forEach(f => {
                      if (f.format === 'multi') {
                        if (!Array.isArray((fd as Record<string, unknown>)[f.key])) missingFieldCount++;
                      } else {
                        const v = (fd as Record<string, unknown>)[f.key];
                        const { isBlank } = renderAnswerValue(v, f.format);
                        if (isBlank) missingFieldCount++;
                      }
                    });
                  });
                }

                // ── Rules comparison ─────────────────────────────────────
                type RuleResult = 'pass' | 'fail' | 'na' | 'warn' | 'pending';
                const rules: Array<{
                  name: string; statute: string;
                  clientFigure: string; ruleText: string;
                  result: RuleResult;
                  /** Resolving auto-text — appears when a flagged rule has a
                   *  known resolving path. The supervising attorney can edit
                   *  this in the Decision tab quick-review below. */
                  resolveText?: string;
                }> = [];

                // Means test rule
                rules.push({
                  name: 'Means Test',
                  statute: '§ 707(b)',
                  clientFigure: `CMI ${fmt(cmi)}/mo`,
                  ruleText: `${lead.state ?? '?'} ${houseSize}-person median ${fmt(medianMonthly)}/mo`,
                  result: meansTestResolvedByBizDebt ? 'na' :
                          !aboveMedian ? 'pass' :
                          meansTestResult === 'borderline' ? 'warn' : 'fail',
                  resolveText: meansTestResolvedByBizDebt
                    ? `Client reports more than 50% business debt of overall debt (${bizDebtResolvingPct}%); therefore the means test is not an issue and we can file Chapter 7.`
                    : undefined,
                });

                // Non-exempt vehicle equity rule
                if (vehicles.length > 0 || nonExemptVehicleEquity > 0) {
                  rules.push({
                    name: 'Non-exempt vehicle equity',
                    statute: '§ 522 / § 1325(a)(4)',
                    clientFigure: nonExemptVehicleEquity > 0
                      ? `${fmt(nonExemptVehicleEquity)} above ${lead.state ?? '?'} cap`
                      : 'Within exemption',
                    ruleText: `${lead.state ?? '?'} motor vehicle exemption $${CO_VEHICLE_EXEMPTION.toLocaleString()}`,
                    result: nonExemptVehicleEquity > 0 ? 'warn' : 'pass',
                  });
                }

                // Preferential payments rule
                if (prefPayFlagged) {
                  rules.push({
                    name: insiderPrefTotal > 0 ? 'Insider preferential payment' : 'Preferential payment',
                    statute: insiderPrefTotal > 0 ? '§ 547(b) + § 101(31)' : '§ 547(b)',
                    clientFigure: insiderPrefTotal > 0
                      ? `${fmt(insiderPrefTotal)} to insider in 1y`
                      : `${fmt(nonInsiderPrefTotal)} to non-insider in 90d`,
                    ruleText: insiderPrefTotal > 0
                      ? '1-year lookback; trustee may recover'
                      : '90-day lookback; trustee scrutinizes > $600',
                    result: insiderPrefTotal > 0 ? 'fail' : 'warn',
                  });
                }

                // Prior BK rule
                if (submission?.has_prior_bk) {
                  rules.push({
                    name: 'Prior bankruptcy discharge timing',
                    statute: '§ 727(a)(8) / § 1328(f)',
                    clientFigure: 'Disclosed — verify dates',
                    ruleText: '8y Ch.7→Ch.7; 4y Ch.7→Ch.13; 6y Ch.13→Ch.7; 2y Ch.13→Ch.13',
                    result: 'pending',
                  });
                }

                // Recent luxury rule
                if (submission?.recent_luxury) {
                  rules.push({
                    name: 'Recent luxury purchases',
                    statute: '§ 523(a)(2)(C)',
                    clientFigure: 'Disclosed within 90 days',
                    ruleText: '> $800 single creditor 90d pre-petition is presumptively non-dischargeable',
                    result: 'warn',
                  });
                }

                // Recommended chapter
                const ch7AvailableAfterBypass = ch7Eligible || meansTestResolvedByBizDebt;
                const recommended: { chapter: string; rationale: string } = ch7AvailableAfterBypass
                  ? meansTestResolvedByBizDebt
                    ? { chapter: 'Chapter 7', rationale: `Means-test bypass applies (business debt ${bizDebtResolvingPct}%); Ch.7 available despite over-median income.` }
                    : { chapter: 'Chapter 7', rationale: `CMI below median; means test satisfied; Ch.7 is the faster discharge path.` }
                  : { chapter: 'Chapter 13', rationale: `Above median + disposable income exceeds the means-test threshold; Ch.13 plan is the available path unless income drops.` };

                // ── Render ───────────────────────────────────────────────
                const tone = (r: RuleResult) =>
                  r === 'pass' ? { dot: 'bg-emerald-400', txt: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'PASS' } :
                  r === 'na'   ? { dot: 'bg-sky-400',     txt: 'text-sky-300',     bg: 'bg-sky-500/10',     border: 'border-sky-500/30',     label: 'N/A' } :
                  r === 'warn' ? { dot: 'bg-amber-400',   txt: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   label: 'REVIEW' } :
                  r === 'pending' ? { dot: 'bg-slate-400', txt: 'text-slate-300',  bg: 'bg-slate-500/10',   border: 'border-slate-500/30',   label: 'PENDING' } :
                                  { dot: 'bg-red-400',    txt: 'text-red-300',    bg: 'bg-red-500/10',     border: 'border-red-500/30',     label: 'FAIL' };

                return (
                  <div className="space-y-3">
                    {/* Recommendation banner */}
                    <div className={`rounded-2xl border p-4 ${
                      recommended.chapter === 'Chapter 7' ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-sky-500/5 border-sky-500/30'
                    }`}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Scale className={`w-4 h-4 ${recommended.chapter === 'Chapter 7' ? 'text-emerald-400' : 'text-sky-400'}`} />
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-300">Recommended chapter</p>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          recommended.chapter === 'Chapter 7' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-sky-500/15 text-sky-300'
                        }`}>{recommended.chapter}</span>
                        {missingFieldCount > 0 && (
                          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
                            {missingFieldCount} required field{missingFieldCount === 1 ? '' : 's'} missing
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{recommended.rationale}</p>
                      {missingFieldCount > 0 && (
                        <p className="mt-2 text-[10px] text-amber-300/80 italic">
                          {missingFieldCount} answer{missingFieldCount === 1 ? '' : 's'} blank in the All Answers tab — review before accepting.
                        </p>
                      )}
                    </div>

                    {/* Rules comparison grid */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Rules comparison — client vs. rule</p>
                      <div className="space-y-2">
                        {rules.map((r, i) => {
                          const t = tone(r.result);
                          return (
                            <div key={i} className={`rounded-xl border p-3 ${t.bg} ${t.border}`}>
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                                <span className="text-xs font-bold text-white">{r.name}</span>
                                <span className="text-[9px] font-mono text-slate-400 bg-slate-900/60 border border-slate-700/40 rounded-full px-1.5 py-0.5">{r.statute}</span>
                                <span className={`ml-auto text-[10px] font-bold uppercase tracking-widest ${t.txt}`}>{t.label}</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
                                <div className="text-[11px]">
                                  <span className="text-slate-500">Client: </span>
                                  <span className="text-slate-200">{r.clientFigure}</span>
                                </div>
                                <div className="text-[11px]">
                                  <span className="text-slate-500">Rule: </span>
                                  <span className="text-slate-200">{r.ruleText}</span>
                                </div>
                              </div>
                              {r.resolveText && (
                                <div className="mt-2 pt-2 border-t border-sky-500/20">
                                  <p className="text-[10px] uppercase tracking-widest font-bold text-sky-300 mb-1">Why this is not an issue</p>
                                  <p className="text-[11px] text-sky-200/90 leading-relaxed">{r.resolveText}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Three-column Assets / Income / Expenses summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Assets */}
                      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Assets</p>
                          <p className="text-xs font-bold text-emerald-300">{fmt(assetsTotal)}</p>
                        </div>
                        {assetRows.length === 0 ? (
                          <p className="text-[11px] text-slate-500 italic">No assets reported (or submission missing).</p>
                        ) : (
                          <ul className="space-y-1">
                            {assetRows.map((r, i) => (
                              <li key={i} className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-300 truncate pr-2">{r.label}</span>
                                <span className="text-slate-200 font-mono flex-shrink-0">{fmt(r.value)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Income */}
                      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Income</p>
                          <p className="text-xs font-bold text-emerald-300">{fmt(incomeTotal)}/mo</p>
                        </div>
                        {incomeRows.length === 0 ? (
                          <p className="text-[11px] text-slate-500 italic">No income reported (or submission missing).</p>
                        ) : (
                          <ul className="space-y-1">
                            {incomeRows.map((r, i) => (
                              <li key={i} className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-300 truncate pr-2">{r.label}</span>
                                <span className="text-slate-200 font-mono flex-shrink-0">{fmt(r.value)}/mo</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Expenses */}
                      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Expenses (Sch. J)</p>
                          <p className="text-xs font-bold text-rose-300">{fmt(expensesTotalFd)}/mo</p>
                        </div>
                        {expenseRows.length === 0 ? (
                          <p className="text-[11px] text-slate-500 italic">No expenses reported (or submission missing).</p>
                        ) : (
                          <ul className="space-y-1">
                            {expenseRows.map((r, i) => (
                              <li key={i} className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-300 truncate pr-2">{r.label}</span>
                                <span className="text-slate-200 font-mono flex-shrink-0">{fmt(r.value)}/mo</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* Stash the resolving auto-texts so the Decision tab's
                        quick-review can render them too. We expose them via a
                        hidden DOM marker the Decision tab can read in lieu of
                        lifting the computation; simpler than redoing the work.
                        TODO Phase B: lift this whole derivation into a hook
                        used by both tabs. */}
                    {currentComp && (
                      <p className="hidden" data-rules-summary>
                        {JSON.stringify({ rules, recommended })}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Current Monthly Income", val: fmt(cmi), sub: "CMI per Form 122A-1 (interim — Sched. I gap)" },
                  { label: `${lead.state ?? "CO"} Median (${houseSize}-person)`, val: fmt(medianMonthly)+"/mo", sub: fmt(medianAnnual)+"/yr" },
                  { label: "Monthly Expenses", val: fmt(totalExpenses), sub: "Reported by client" },
                  { label: "Disposable Income", val: fmt(disposableIncome), sub: `Firm triage threshold $${firmDmiThreshold.toLocaleString()}/mo` },
                ].map(s => (
                  <div key={s.label} className="bg-slate-800/40 rounded-xl p-3 text-center">
                    <p className="text-[9px] text-slate-500 leading-tight mb-1">{s.label}</p>
                    <p className={`text-sm font-bold ${s.label.includes("Disposable") && overFirmDmiThreshold ? "text-amber-300" : "text-white"}`}>{s.val}</p>
                    <p className="text-[9px] text-slate-600 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Firm DMI triage warning — non-blocking. Stays visible
                  even when the per-case attorney override is toggled. */}
              {overFirmDmiThreshold && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-amber-200">
                        Positive disposable income more than ${firmDmiThreshold.toLocaleString()}
                      </p>
                      <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                        DMI ≈ <strong>{fmt(disposableIncome)}/mo</strong> exceeds the firm&apos;s
                        intake-triage threshold of <strong>${firmDmiThreshold.toLocaleString()}/mo</strong> —
                        routing to <strong>Chapter 13</strong> attorney-review. The case is still
                        acceptable; the attorney decides whether to proceed under Ch.13 or apply
                        the per-case override.
                      </p>
                      <p className="text-[10px] text-amber-200/60 italic mt-2">
                        Firm intake triage, NOT § 707(b)(2) statutory presumption. The formal
                        presumption (two-bracket; IRS allowable long-form deductions) is a separate
                        evaluation. Adjust the firm threshold in Law Firm Settings → Firm Policy.
                      </p>

                      {/* Per-case attorney override — toggles routing but does
                          NOT clear this warning or the seeded Issue. Audit-logged
                          via the existing review-edit path (saveReviewFields).
                          The modal mount is already lawyer-gated upstream via
                          LeadDetailPanel.canOpenAttorneyReview, so no extra
                          isAtty check needed here. */}
                      <label className="mt-3 inline-flex items-center gap-2 text-[11px] text-amber-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!review?.attorney_override_dmi_triage}
                          onChange={async (e) => {
                            const next = e.target.checked;
                            await saveReviewFields({ attorney_override_dmi_triage: next });
                          }}
                          className="rounded border-amber-500/50"
                        />
                        <span>
                          Attorney override — proceed under Ch.7 despite firm triage flag
                          {review?.attorney_override_dmi_triage && (
                            <span className="ml-1 text-amber-300 font-semibold">(audit-logged)</span>
                          )}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

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

                {/* § 1325(b)(4) applicable commitment period — emit-only,
                    derived from CMI vs state median (by household size).
                    Display only; no statutory math altered. */}
                {(() => {
                  const cmt = classifyCommitmentPeriod({ cmiMonthly: cmi, medianAnnual });
                  return (
                    <div className="mt-3 rounded-xl border border-sky-500/20 bg-sky-950/30 p-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-[11px] font-bold text-sky-300">
                          Applicable commitment period · {cmt.period.months}-month
                          {cmt.period.basis === "below_median_minimum" && (
                            <span className="text-[10px] text-sky-400/80 font-normal"> (60-month always electable)</span>
                          )}
                        </p>
                        <span className={`text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded border ${
                          cmt.aboveMedian
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        }`}>
                          {cmt.aboveMedian ? "Above median" : "Below median"}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed mt-1">{cmt.period.description}</p>
                      <p className="text-[9px] text-slate-600 italic mt-1">
                        § 1325(b)(1)(A): a plan that pays 100% of allowed unsecured claims satisfies the
                        all-DMI-devotion requirement; surplus income is permitted. Many districts allow a 100% plan
                        to complete in fewer than {cmt.period.months} months — confirm local rules + trustee
                        position before assuming a shorter term.
                      </p>
                    </div>
                  );
                })()}
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

          {/* ══════════ ALL ANSWERS TAB ══════════
              Prompt 84 (expanded) — replaced the curated read-only
              AllAnswersView with FormDataInventory. FormDataInventory
              still reuses ALL_ANSWERS_SCHEMA for the filing-document
              groupings but additionally surfaces any top-level
              form_data key the schema doesn't yet cover under an
              "Other captured fields" panel, and recursively renders
              nested objects/arrays as indented sub-lists instead of
              raw JSON. Honest blanks throughout; strictly read-only.
              The attorney-review-mode AllAnswersView (with per-section
              flag toggles + submit-back-to-client) still lives on the
              AttorneyIntakeDashboard tab and is unaffected. */}
          {activeTab === "allAnswers" && (
            <div className="space-y-3">
              {submission && submission.form_data ? (
                <FormDataInventory
                  fd={submission.form_data as Record<string, unknown>}
                  title="All Answers"
                  subtitle="Read-only mirror of every field the locked client questionnaire wrote to intake_submissions.form_data. Grouped by filing document; any top-level keys the curated schema doesn't yet cover are listed under 'Other captured fields' so nothing the client submitted is hidden from review."
                />
              ) : (
                <div className="text-center py-10 bg-slate-900 border border-slate-800 rounded-2xl">
                  <FileText className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 italic">
                    No questionnaire submission attached to this lead yet.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ══════════ DECISION TAB ══════════ */}
          {activeTab === "decision" && (
            <div className="space-y-5">
              {/* ── QUICK REVIEW — flagged issues with auto-populated explanations ──
                  Surfaces each issue alongside its "why this is not an issue"
                  resolving text so the attorney can scan and accept fast.
                  The means-test bypass auto-text is computed the same way the
                  Eligibility tab does it (calcDebtComposition with a what-if
                  personalLoanDebt → business override). The supervising
                  attorney can edit each prefilled explanation; a non-lawyer
                  cannot reach this surface at all (modal is gated upstream by
                  canOpenAttorneyReview). */}
              {decision === "accepted" && issues.length > 0 && (() => {
                const fd = (submission?.form_data as Record<string, unknown> | undefined) ?? null;
                const potentialComp = fd ? calcDebtComposition(fd, { personalLoanDebt: 'business' }) : null;
                const meansTestResolvedByBizDebt = aboveMedian && !!potentialComp && potentialComp.primarilyBusiness;
                const bizDebtPct = potentialComp?.pct ?? 0;

                // Map an issue → auto-populated resolving text (when the
                // category has a known resolving path). The attorney can
                // override via the attorney_note field on each issue (already
                // wired via saveIssueNote elsewhere).
                function autoResolveText(issue: IntakeIssue): string | null {
                  // Income / means-test resolving path: primarily-business-debt bypass
                  if (issue.category === 'income' && meansTestResolvedByBizDebt) {
                    return `Client reports more than 50% business debt of overall debt (${bizDebtPct}%); therefore the means test is not an issue and we can file Chapter 7.`;
                  }
                  // TODO Phase B — auto-resolving paths for other categories:
                  //   - 'pref_payments' / insider: explain waiting-period / disclosure cure
                  //   - 'prior_bk': confirm discharge timing satisfied
                  //   - 'assets' / non-exempt equity: cite applicable exemption + cap
                  //   - 'luxury' / cash advance: address §523(a)(2)(C) presumption
                  return null;
                }

                const resolvable = issues.map(i => ({ issue: i, autoText: autoResolveText(i) }));
                if (resolvable.every(r => !r.autoText && !r.issue.attorney_note)) return null;

                return (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <CheckCheck className="w-4 h-4 text-emerald-400" />
                      <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
                        Quick Review — flagged issues + resolving explanations
                      </p>
                      <span className="ml-auto text-[10px] uppercase tracking-widest text-emerald-300/80 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2 py-0.5">
                        for the supervising attorney
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                      Each flagged issue is shown with its auto-populated "why this is not an issue"
                      explanation drawn from the Rules Comparison. The supervising attorney can edit
                      any prefilled response (the standard issue-note field below); a non-lawyer
                      can't reach this surface.
                    </p>

                    <div className="space-y-2">
                      {resolvable.map(({ issue, autoText }) => {
                        if (!autoText && !issue.attorney_note) return null;
                        const sevDot = issue.severity === 'error' ? 'bg-red-400' : 'bg-amber-400';
                        return (
                          <div key={issue.id} className="rounded-xl border border-emerald-500/20 bg-slate-900/40 p-3">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`w-1.5 h-1.5 rounded-full ${sevDot}`} />
                              <span className="text-[11px] font-bold text-white">{issue.title}</span>
                              <span className="ml-auto text-[9px] font-mono text-slate-500 bg-slate-900/60 border border-slate-700/40 rounded-full px-1.5 py-0.5">
                                {issue.category}
                              </span>
                            </div>
                            {autoText && (
                              <div className="mt-1 rounded-lg bg-emerald-500/8 border border-emerald-500/20 p-2">
                                <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-300 mb-1">Auto-populated resolving explanation</p>
                                <p className="text-[11px] text-emerald-100/90 leading-relaxed whitespace-pre-line">{autoText}</p>
                              </div>
                            )}
                            {issue.attorney_note && (
                              <div className="mt-1.5">
                                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Attorney note</p>
                                <p className="text-[11px] text-slate-200 leading-relaxed whitespace-pre-line">{issue.attorney_note}</p>
                              </div>
                            )}
                            {/* Edit affordance — opens the existing per-issue note editor on the Issues tab. */}
                            <button
                              onClick={() => {
                                setEditingIssueId(issue.id);
                                setEditingNote(issue.attorney_note ?? autoText ?? '');
                                setActiveTab('issues');
                              }}
                              className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded px-2 py-1 transition-colors"
                            >
                              Edit explanation
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

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
                      {/* Down-payment input HIDDEN and Payment-Plan (months)
                          input REMOVED from this surface per the firm's
                          workflow change: fees are worked out by admin, not
                          decided by the attorney here. The down_payment field
                          on the underlying review row stays in sync with its
                          state default (see useState above) so any prior
                          value is preserved on save; plan_months is no
                          longer collected from this UI (the saveDecision
                          path still writes parseInt(planMonths) || null, so
                          the default state of "4" continues to be persisted
                          until the planMonths state is fully retired in the
                          backend cleanup pass). */}
                      {/* (no inputs rendered for ch7_regular / ch7_bifurcated) */}
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
              <button
                onClick={() => setActiveTab(
                  activeTab === "issues"     ? "eligibility" :
                  activeTab === "allAnswers" ? "issues"      :
                                               "allAnswers"   // from "decision"
                )}
                className="py-2.5 px-4 text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-all">
                Back
              </button>
            )}
            {activeTab !== "decision" ? (
              <button
                onClick={() => setActiveTab(
                  activeTab === "eligibility" ? "issues"     :
                  activeTab === "issues"      ? "allAnswers" :
                                                "decision"     // from "allAnswers"
                )}
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
      if (decision === "accepted") {
        await sbUpsert("clients", {
          id: lead.id,
          lead_id: lead.id,
          name: lead.full_name,
          email: lead.email ?? null,
          phone: lead.phone ?? null,
          status: "intake_complete",
        });
        await sbPost("case_acceptances", {
          client_id: lead.id,
          lead_id: lead.id,
          chapter: String(body.chapter ?? "7"),
          attorney_fee: body.attorney_fee ?? null,
          filing_fee: body.court_filing_fee ?? null,
          is_bifurcated: body.case_type === "ch7_bifurcated",
          accepted_by: body.attorney_name ?? "",
          acceptance_notes: body.decision_notes ?? null,
          decided_at: body.decided_at ?? null,
        });
      }
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

// ─── Re-review chip — Cases Needing Review queue surface ──────────────────
//
// Fetches the most recent attorney_intake_reviews row for a lead and
// surfaces a banner whenever the stored ruleset version is stale vs. the
// current store version AND the case is in the post-review pre-filing
// window. Cases marked filed/closed are never flagged. Today's case-status
// derivation is heuristic (uses `decided_at` + the lead's stage); TODO
// Phase B wires this to the real `case_status` column.

function ReReviewChip({ leadId }: { leadId: string }) {
  const [reason, setReason] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await sbGet<IntakeReview>(
          `attorney_intake_reviews?lead_id=eq.${leadId}&order=created_at.desc&limit=1`
        );
        if (cancelled) return;
        const r = rows[0] ?? null;
        if (!r) { setReason(null); setLocked(false); return; }
        // Slice L-10 (Prompt 68) — delegate to the shared predicate.
        // Same decision tree as the chip's previous inline logic; the
        // dashboard's RED re-review tier consumes the same helper so
        // the two surfaces cannot drift.
        const verdict = evaluateReviewStaleness(
          {
            case_status: r.case_status ?? null,
            decided_at: r.decided_at ?? null,
            reviewed_ruleset_version: r.reviewed_ruleset_version ?? null,
          },
          getCurrentRulesetVersion(),
        );
        if (verdict.kind === "locked") { setLocked(true);  setReason(null); return; }
        if (verdict.kind === "stale")  { setLocked(false); setReason(verdict.reason); return; }
        setLocked(false); setReason(null);
      } catch {
        setReason(null);
      }
    })();
    return () => { cancelled = true; };
  }, [leadId]);

  if (locked) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-[11px] text-slate-400 mb-2 flex items-center gap-2">
        <span className="text-slate-500">🔒</span>
        <span><strong className="text-slate-300">Case locked</strong> — filed or closed; ruleset changes no longer require re-review.</span>
      </div>
    );
  }
  if (!reason) return null;
  return (
    <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-[11px] mb-2 flex items-start gap-2">
      <span className="text-amber-300 flex-shrink-0">⚑</span>
      <div className="flex-1 text-amber-100 leading-relaxed">
        <p className="font-bold text-amber-300">Needs re-review — rules changed</p>
        <p className="mt-0.5">{reason}</p>
        <p className="mt-0.5 text-amber-200/80">Open Attorney Review and re-confirm against the current rules before signing.</p>
      </div>
    </div>
  );
}

// ─── Stage-5 set-control (Prompt 52) ──────────────────────────────────────
// Staff-only inline panel rendered beneath the CaseAdvancementStatusBar.
// Patches presentation_scheduled_at / presented_at on
// attorney_case_acceptances. Tolerates the columns not yet existing —
// PostgREST returns an error which is surfaced inline; the status bar
// continues to render "—" until the schema lands.

function Stage5SetControl({
  acceptance, onRefresh,
}: {
  acceptance: Acceptance;
  onRefresh: () => void;
}) {
  const [saving, setSaving] = useState<null | 'scheduled' | 'presented' | 'clear'>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState<null | 'scheduled' | 'presented'>(null);
  const [draftIso, setDraftIso] = useState<string>(() => {
    // Pre-fill with current local datetime (HTML datetime-local format).
    const d = new Date();
    d.setSeconds(0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  async function patch(body: Record<string, unknown>, kind: 'scheduled' | 'presented' | 'clear') {
    setSaving(kind);
    setErr(null);
    try {
      // Inline fetch (not sbPatch) so we can inspect the response status.
      // sbPatch is fire-and-forget; here we want to surface "column does
      // not exist" cleanly to the staffer so they know to run the SQL.
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/attorney_case_acceptances?id=eq.${acceptance.id}`,
        {
          method: 'PATCH',
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(body),
        },
      );
      if (!r.ok) {
        setErr(
          'Patch failed — the presentation_scheduled_at / presented_at columns ' +
          'may not yet exist on attorney_case_acceptances. Run the column SQL ' +
          '(reported with this commit) and try again.'
        );
      } else {
        setPickerOpen(null);
        onRefresh();
      }
    } finally {
      setSaving(null);
    }
  }

  const scheduledFmt = acceptance.presentation_scheduled_at
    ? new Date(acceptance.presentation_scheduled_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null;
  const presentedFmt = acceptance.presented_at
    ? new Date(acceptance.presented_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3 mt-2 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Stage 5 · Presentation
        </span>
        <span className="text-[10px] text-slate-600">— staff-only</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Scheduled:</span>
          <span className="text-slate-300 tabular-nums">{scheduledFmt ?? '—'}</span>
          <button
            type="button"
            onClick={() => setPickerOpen(pickerOpen === 'scheduled' ? null : 'scheduled')}
            disabled={saving !== null}
            className="text-[10px] text-amber-300 hover:text-amber-200 disabled:opacity-50 underline"
          >
            {scheduledFmt ? 'Edit' : 'Set'}
          </button>
          {scheduledFmt && (
            <button
              type="button"
              onClick={() => patch({ presentation_scheduled_at: null }, 'clear')}
              disabled={saving !== null}
              className="text-[10px] text-slate-500 hover:text-rose-300 disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
        <span className="text-slate-700">·</span>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Presented:</span>
          <span className="text-slate-300 tabular-nums">{presentedFmt ?? '—'}</span>
          <button
            type="button"
            onClick={() => setPickerOpen(pickerOpen === 'presented' ? null : 'presented')}
            disabled={saving !== null}
            className="text-[10px] text-amber-300 hover:text-amber-200 disabled:opacity-50 underline"
          >
            {presentedFmt ? 'Edit' : 'Mark'}
          </button>
          {presentedFmt && (
            <button
              type="button"
              onClick={() => patch({ presented_at: null }, 'clear')}
              disabled={saving !== null}
              className="text-[10px] text-slate-500 hover:text-rose-300 disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      {pickerOpen && (
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-800/50">
          <span className="text-[10px] text-slate-400">
            {pickerOpen === 'scheduled' ? 'Scheduled for' : 'Presented at'}:
          </span>
          <input
            type="datetime-local"
            value={draftIso}
            onChange={e => setDraftIso(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs rounded px-2 py-1"
          />
          <button
            type="button"
            onClick={() => {
              // datetime-local has no timezone — interpret as local + convert to ISO.
              const iso = new Date(draftIso).toISOString();
              const field = pickerOpen === 'scheduled' ? 'presentation_scheduled_at' : 'presented_at';
              patch({ [field]: iso }, pickerOpen);
            }}
            disabled={saving !== null || !draftIso}
            className="text-[10px] font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded px-2 py-1 disabled:opacity-50"
          >
            {saving === pickerOpen ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen(null)}
            disabled={saving !== null}
            className="text-[10px] text-slate-500 hover:text-slate-300 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
      {err && (
        <p className="text-[10px] text-rose-300 leading-snug">{err}</p>
      )}
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
  onLaunchGuidedIntake,
}: {
  lead: Lead;
  acceptance: Acceptance | null;
  session: PortalSession;
  onBack: () => void;
  onRefresh: () => void;
  onLaunchPresentation: (lead: Lead, acceptance: Acceptance, submission: Record<string, unknown> | null) => void;
  /** Launch the staff-guided intake wrapper for this lead. Replaces the
   *  former ConsultIntakeModal launch path. Wired in IntakePortalInner. */
  onLaunchGuidedIntake: (lead: Lead) => void;
}) {
  const panelRole    = session.role;
  const panelIsAtty  = isAttorney(panelRole);
  const panelIsSuperAdmin = isSuperAdminRole(panelRole);
  const canDoIntake  = !panelIsAtty || panelIsSuperAdmin;  // legal_admin, super_admin, attorney_super_admin
  const canReview    = panelIsAtty || panelIsSuperAdmin;   // attorneys + super admins
  // Strict lawyer gate — used for the Attorney Review surface. `canReview`
  // still drives stage labels + various display affordances that are fine for
  // super-admin viewers, but the Attorney Review BUTTON + MODAL gate on
  // canOpenAttorneyReview = isLawyer only.
  // TODO Phase B: server-side enforcement via RLS on attorney_intake_reviews
  // so the gate survives a tampered client.
  const canOpenAttorneyReview = isLawyer(panelRole);
  const [showAcceptanceModal, setShowAcceptanceModal]   = useState(false);
  // showConsult state removed — ConsultIntakeModal is no longer launched.
  // The new staff-guided intake flow (StaffGuidedIntake) is launched via
  // `onLaunchGuidedIntake(lead)` callback from IntakePortalInner.
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

  // ── New intake-review surface state (BAN-XX) ───────────────────────────────
  // "Review Intake" opens the shared AllAnswersView in read-only mode.
  // "Update Intake Information" opens the safe-fields editor.
  // The client time log is local-state only (TODO Phase B: persist to
  // client_time_logs table; on retention, transfer with the lead).
  const [showReviewIntake, setShowReviewIntake] = useState(false);
  const [showUpdateIntake, setShowUpdateIntake] = useState(false);
  const { entries: timeLogEntries, appendEntry: appendTimeLogEntry, toggleVisibility: toggleTimeLogVisibility } = useClientTimeLog();
  // Convenience wrapper — every internal-side action in LeadDetailPanel routes
  // through this so the entries carry a consistent actor field.
  const logAction = useCallback((
    type: Parameters<typeof appendTimeLogEntry>[0],
    message: string,
    opts?: { clientVisible?: boolean },
  ) => {
    appendTimeLogEntry(type, session.name ?? 'staff', message, opts);
  }, [appendTimeLogEntry, session.name]);

  // Load the latest questionnaire submission linked to this lead.
  //
  // Bug fix: the previous implementation used a hand-rolled sbGet() with the
  // anon REST endpoint and queried by intake_leads.submission_id first. When
  // that soft-link was stale (e.g. legacy rows missing it, or rows created
  // before the link was set), the fallback by-lead-id query sometimes returned
  // empty even when a submission existed — likely an RLS or column-projection
  // edge case on the REST path that doesn't reproduce with the typed client.
  // The attorney intake dashboard reads from the SAME source via
  // `supabase.from('intake_submissions').select('*')` and it works there, so
  // we mirror that path here exactly.
  //
  // Strategy:
  //   1. Query by lead_id (the canonical FK set when the questionnaire was
  //      submitted). Most recent submitted_at wins.
  //   2. Fall back to submission_id ONLY if the lead_id query returns nothing
  //      and the lead row carries a soft-link id (defense in depth).
  //
  // tracking-loading state separately so the UI can distinguish "still
  // fetching" from "genuinely no submission" — the prior implementation
  // showed the "no submission" copy during the brief loading window.
  const [submissionLoading, setSubmissionLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setSubmissionLoading(true);
    setSubmission(null);
    (async () => {
      // Primary: by lead_id (same path the attorney dashboard uses).
      const { data: byLead } = await supabase
        .from("intake_submissions")
        .select("*")
        .eq("lead_id", lead.id)
        .order("submitted_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      let row = (byLead && byLead[0]) ? (byLead[0] as Record<string, unknown>) : null;

      // Fallback: by intake_leads.submission_id soft-link, in case lead_id
      // wasn't set on a legacy row.
      if (!row && lead.submission_id) {
        const { data: byId } = await supabase
          .from("intake_submissions")
          .select("*")
          .eq("id", lead.submission_id)
          .limit(1);
        if (cancelled) return;
        if (byId && byId[0]) row = byId[0] as Record<string, unknown>;
      }

      setSubmission(row);
      setSubmissionLoading(false);
    })();
    return () => { cancelled = true; };
  }, [lead.id, lead.submission_id]);

  function loadContactLog() {
    sbGet<ContactLogEntry>(`intake_contact_log?lead_id=eq.${lead.id}&order=contacted_at.desc&limit=50`)
      .then(rows => setContactLog(rows));
  }
  useEffect(() => { loadContactLog(); }, [lead.id]);

  const sc = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG["new"];
  const uc = URGENCY_CONFIG[lead.urgency ?? "normal"] ?? URGENCY_CONFIG["normal"];

  // Existing intake-action handlers — pre-existing sbPatch behavior preserved.
  // Each is now wrapped with a time-log append so the client time log records
  // every state change (TODO Phase B: persist via the append_client_time_log
  // RPC instead of local state, and stitch payload before/after diffs).

  async function savePreScreenNotes() {
    setSavingNotes(true);
    await sbPatch("intake_leads", lead.id, { pre_screen_notes: preScreenNotes });
    setSavingNotes(false);
    setEditingNotes(false);
    logAction('intake_update', `Pre-screen notes updated`);
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
    logAction('status_change', `Intake completed — sent for attorney review`);
    onRefresh();
  }

  async function markFeeQuoted() {
    setMarkingFeeQuoted(true);
    await sbPatch("intake_leads", lead.id, { status: "fee_quoted" });
    setMarkingFeeQuoted(false);
    logAction('status_change', `Status → fee_quoted (pending client acceptance)`);
    onRefresh();
  }

  async function markRetained() {
    setMarkingRetained(true);
    await sbPatch("intake_leads", lead.id, { status: "retained", retained_at: new Date().toISOString() });
    setMarkingRetained(false);
    // Retention is the moment the lead's info + this time log transfer into
    // the client folder under "time logs" (see RULE comment in
    // ClientTimeLog.tsx). The server-side retention RPC handles the actual
    // re-parenting; we just log the client-visible event here so the timeline
    // ends with the retention milestone in the same view.
    logAction('status_change', `Client retained`, { clientVisible: true });
    onRefresh();
  }

  async function markNoCase() {
    setMarkingNoCase(true);
    await sbPatch("intake_leads", lead.id, { status: "no_case" });
    setMarkingNoCase(false);
    logAction('status_change', `Marked no case`);
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
    logAction('status_change', `Sent for attorney review`);
    onRefresh();
  }

  return (
    <div className="space-y-5">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> All Leads
      </button>

      {/* Lead-locking banner — safety net for any open-path that bypasses the
          requestOpenLead gate (e.g. a direct nav). Read-only scaffold today;
          no claim mutation here. See src/components/lead-claim/LeadClaim.tsx. */}
      <LeadClaimBanner lead={lead} currentSessionId={session.id} />

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
            {/* Attorney Review button + surface — LAWYER-ONLY.
                A plain super_admin / non-lawyer superuser does NOT see this
                button and cannot open the attorney-review modal even via
                direct nav (the modal mount below is also gated on
                canOpenAttorneyReview). Non-lawyers see the case-advancement
                status bar (rendered below) instead, which surfaces
                "Submitted to attorney" / "Case accepted" as completed
                stages without exposing the review surface. */}
            {canOpenAttorneyReview && (
              <button
                onClick={() => {
                  logAction('review_opened', `Opened attorney review surface for ${lead.full_name}`);
                  setShowAcceptanceModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl transition-colors"
              >
                <Scale className="w-3.5 h-3.5" />
                {acceptance ? "View Decision" : "Attorney Review"}
              </button>
            )}
            {/* "Review Intake" — read-only ALL-answers view for NON-LAWYERS.
                Lawyers see the same surface as the "All Answers" tab inside
                the consolidated Attorney Review modal (one window, four tabs:
                Eligibility / Issues / All Answers / Decision), so they don't
                need a separate Review Intake button. Hiding it for lawyers
                also removes the "two windows for the same thing" confusion.
                Non-lawyers don't get the Attorney Review modal, so this
                button is their only path to the answers — kept visible. */}
            {!canOpenAttorneyReview && (
              <button
                onClick={() => {
                  logAction('review_opened', `Opened Review Intake (read-only) for ${lead.full_name}`);
                  setShowReviewIntake(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-slate-700/40 hover:bg-slate-700/60 text-slate-200 border border-slate-700/60 rounded-xl transition-colors"
              >
                <FileText className="w-3.5 h-3.5" /> Review Intake
              </button>
            )}
            {/* "Update Intake Information" — safe-field editor for lead/intake
                metadata. Excludes the locked questionnaire AND
                attorney-originated content. */}
            <button
              onClick={() => setShowUpdateIntake(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-slate-700/40 hover:bg-slate-700/60 text-slate-200 border border-slate-700/60 rounded-xl transition-colors"
            >
              <PenLine className="w-3.5 h-3.5" /> Update Intake Information
            </button>
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

      {/* ── Case Advancement Status Bar (client-visible, all viewers) ────── */}
      {/* Shown to lawyers AND non-lawyers. Drives stages from the lead row
          + acceptance record. Stage 5 (presentation) is "—" until a
          presentation_scheduled_at / presented_at field is wired; stage 7
          surfaces the most recent next_follow_up_at but the FU CADENCE RULES
          themselves live in the supervisor-configured Staff Settings
          framework (TODO Phase B). */}
      {/* Re-review chip — surfaces stale-ruleset cases in the queue.
            Fetches the latest attorney_intake_review for this lead and
            compares its stored ruleset version against the live store
            version. Filed/closed cases (case_status === 'filed' | 'closed')
            are never flagged here. */}
      <ReReviewChip leadId={lead.id} />

      <CaseAdvancementStatusBar lead={lead} acceptance={acceptance} />

      {/* Stage-5 set-control (Prompt 52) — staff-only inline panel for
          presentation_scheduled_at / presented_at. Patches
          attorney_case_acceptances directly. Hidden until acceptance
          exists AND has been accepted (the stage doesn't apply pre-
          acceptance). If the columns aren't yet seeded server-side, the
          patch still ships the keys and PostgREST returns an error
          surfaced inline — the status bar continues to render "—". */}
      {acceptance && acceptance.decision === 'accepted' && (
        <Stage5SetControl
          acceptance={acceptance}
          onRefresh={onRefresh}
        />
      )}

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
                <button onClick={() => onLaunchGuidedIntake(lead)}
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
                <button onClick={() => onLaunchGuidedIntake(lead)}
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
                <button onClick={() => onLaunchGuidedIntake(lead)}
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

        // Stage 5 — Pending attorney review. LAWYER-ONLY: the CTA opens the
        // consolidated attorney review modal, so non-lawyer super_admins are
        // explicitly excluded (canOpenAttorneyReview, not canReview).
        else if (lead.status === "sent_for_attorney_review" && canOpenAttorneyReview) {
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
                  onClick={() => acceptance && onLaunchPresentation(lead, acceptance, submission)}
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
          {/* Edit Decision re-opens the consolidated attorney review modal —
              lawyer-only. Non-lawyer super_admins see the recorded decision
              read-only without the edit affordance. */}
          {canOpenAttorneyReview && (
            <button
              onClick={() => setShowAcceptanceModal(true)}
              className="mt-3 text-xs font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" /> Edit Decision
            </button>
          )}
        </div>
      )}

      {/* ── Client Time Log (internal by default) ────────────────────────── */}
      <ClientTimeLog
        entries={timeLogEntries}
        onToggleVisibility={toggleTimeLogVisibility}
        canToggleVisibility={true}
      />

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

      {/* Attorney-review modal mount is double-gated: state can only flip
          true via the button above (also lawyer-gated), AND the mount itself
          re-checks isLawyer. Belt-and-suspenders so a stale state or a
          future caller can't accidentally surface the modal to a non-lawyer. */}
      {canOpenAttorneyReview && showAcceptanceModal && (
        <IntakeAttorneyReviewModal
          lead={lead}
          submission={submission}
          onClose={() => setShowAcceptanceModal(false)}
          onSaved={() => { setShowAcceptanceModal(false); onRefresh(); }}
        />
      )}

      {/* Review Intake — read-only AllAnswersView in a modal (everyone) */}
      {showReviewIntake && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-bold text-white">Review Intake — {lead.full_name}</p>
              <span className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5 ml-2">
                read-only
              </span>
              <button
                onClick={() => setShowReviewIntake(false)}
                className="ml-auto text-slate-500 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {submissionLoading ? (
                <div className="text-center py-10">
                  <RefreshCw className="w-6 h-6 text-slate-500 mx-auto mb-2 animate-spin" />
                  <p className="text-xs text-slate-500 italic">Loading questionnaire answers…</p>
                </div>
              ) : submission && submission.form_data ? (
                <AllAnswersView
                  fd={submission.form_data as Record<string, unknown>}
                  title="All Answers"
                  subtitle="Read-only mirror of the locked client questionnaire. Blank answers are highlighted. To request additional information from the client, use the attorney-review surface — that flow is lawyer-only."
                />
              ) : (
                <div className="text-center py-10">
                  <FileText className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 italic">
                    No questionnaire submission found for this lead yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Update Intake Information — safe-field editor (everyone) */}
      {showUpdateIntake && (
        <UpdateIntakeInfoModal
          lead={lead}
          canEdit={true}
          onClose={() => setShowUpdateIntake(false)}
          onSavedScaffold={(summary, _changedFields) => {
            // TODO Phase B — wire the actual sbPatch('intake_leads', ...) here.
            // Today: just log the action; no DB write so onRefresh() isn't called.
            logAction('intake_update', `Updated intake info:\n${summary}`);
          }}
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
          session={session}
          onClose={() => setShowSchedule(false)}
          onSaved={() => { setShowSchedule(false); onRefresh(); }}
          onLaunchGuidedIntake={(l) => { setShowSchedule(false); onLaunchGuidedIntake(l); }}
        />
      )}
      {/* ConsultIntakeModal render branch removed — superseded by
          StaffGuidedIntake wrapper around BankruptcyIntake. The function body
          below is marked @deprecated and retained as dead code; it will be
          deleted in the follow-up cleanup pass once the guided flow is
          field-tested. CONSULT_SCRIPTS was copied (not moved) into
          src/components/intake-script/scripts.ts so this dead code still
          type-checks until removal. */}
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

// Front-end-only time-clock state. Persisted to sessionStorage; no DB writes.
// Real backend is the planned staff_time_entries / time-tracking surface.
export interface TimeClockState {
  /** ms timestamp the staffer clocked in for this session, or null. */
  clockedInAt: number | null;
  /** ms when the active lunch break started, or null. */
  onLunchSince: number | null;
  /** ms when the active short break started, or null. */
  onBreakSince: number | null;
  /** Cumulative minutes spent on lunch today (closed segments only). */
  lunchMinutes: number;
  /** Cumulative minutes spent on short breaks today (closed segments only). */
  breakMinutes: number;
}

export interface TimeClockActions {
  clockIn: () => void;
  clockOut: () => void;
  startLunch: () => void;
  endLunch: () => void;
  startBreak: () => void;
  endBreak: () => void;
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

// Lawyer / super-admin gates — single source of truth for the intake portal.
// isLawyer is the AUTHORITATIVE gate for the Attorney Review surface; both
// `attorney` and `attorney_super_admin` carry a bar number. A plain
// `super_admin` / superuser is NOT automatically a lawyer — they're an
// admin tier without a bar number and must NOT see the attorney review.
//
// `isLegalAdmin` is the legal-admin tier check (non-lawyer paralegal-tier).
export function isLawyer(role: PortalRole) {
  return role === "attorney" || role === "attorney_super_admin";
}
export function isSuperAdminRole(role: PortalRole) {
  return role === "attorney_super_admin" || role === "super_admin";
}
function isLegalAdmin(role: PortalRole) {
  return role === "legal_admin";
}
// Back-compat shim: internal callsites used isAttorney() identically — alias
// to the canonical isLawyer() so the lawyer gate has one source.
const isAttorney = isLawyer;
// ─── Staff Settings viewer-role stub ────────────────────────────────────────
// Determines whether a viewer reaches the Staff Settings surface via the
// MyScheduleTab entry point (the supervisor-gated link added in the dashboard
// rework). Returns:
//   - { role: 'super_admin' }                              → see all departments
//   - { role: 'department_supervisor', department: '...' } → see own dept only
//   - { role: 'none' }                                     → link hidden
//
// Today's mapping:
//   - intake_portal_role super_admin / attorney_super_admin → super_admin
//   - Otherwise: consult the VITE_VIEWER_STAFF_ROLE env-var override so the
//     supervisor branch is testable locally without persisted data.
//     VITE_VIEWER_DEPARTMENT supplies the supervisor's department display
//     string (defaults to "Intake").
//
// TODO Phase B — REAL department-scoped enforcement:
//   - Replace this stub with a lookup against `staff_department_supervisors
//     (staff_id, department_id, supervisor_staff_id, assigned_by, assigned_at)`
//     populated from the new-employee-setup flow (see SuperAdminConsole's
//     "Department supervisor(s)" design notes). The viewer is a
//     department_supervisor when ANY row exists where supervisor_staff_id
//     equals viewer.staff_id; the department(s) come from that table.
//   - Multi-department supervisors: extend the return to `departments: string[]`
//     and surface a department-picker in the Staff Settings panel scoped to
//     that allow-list.
//   - Server-side gate: every read + write underneath Staff Settings filters
//     to viewer.department_id; a tampered client cannot escape its scope.
function deriveStaffSettingsViewer(
  isFirmSuperAdmin: boolean,
): { role: 'super_admin' | 'department_supervisor' | 'none'; department?: string } {
  if (isFirmSuperAdmin) return { role: 'super_admin' };
  const envRole = (import.meta.env.VITE_VIEWER_STAFF_ROLE as string | undefined)?.toLowerCase();
  if (envRole === 'department_supervisor') {
    return {
      role: 'department_supervisor',
      department: (import.meta.env.VITE_VIEWER_DEPARTMENT as string | undefined) ?? 'Intake',
    };
  }
  return { role: 'none' };
}

// isLawyer is defined once above (next to isAttorney + isSuperAdminRole) and
// exported as the single source of truth for the lawyer gate on the
// Attorney Review surface. Server-side gating lands when Supabase auth is
// wired (TODO Phase B: re-check via RLS on the attorney_intake_reviews /
// attorney_case_acceptances tables).

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
// Exported so the component remains reachable while it's not mounted in this
// file. Was removed from the top bar; the implementation is intact for the
// next surface (e.g., a staff settings menu) to mount.

export function IAmSickButton({ onMarked, session }: { onMarked: () => void; session: PortalSession }) {
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

// ─── Force-Clock-In overlay ──────────────────────────────────────────────────
//
// Fills the screen the moment a staffer finishes PIN entry without having
// clocked in. Everything behind it is intentionally non-interactive — the
// user can either clock in or sign out. NO DB writes; clock state lives in
// sessionStorage (see TimeClockState).

function ForceClockInOverlay({
  session, onClockIn, onCancel,
}: { session: PortalSession; onClockIn: () => void; onCancel: () => void }) {
  // Local UX state. Three "modes":
  //   "default"   → the three action buttons (Clock In, Report sick, Can't make it)
  //   "sick"      → confirmation for the sick-day path (writes via the same
  //                 staff_sick_overrides + intake_staff_time_off pattern the
  //                 existing IAmSickButton uses; afterwards we sign the
  //                 staffer out)
  //   "absent"    → SCAFFOLD confirmation for "not able to make it today"
  //                 (no DB write — TODO: same write pattern with
  //                 reason_type='absent_other' once the column accepts it)
  const [mode, setMode] = useState<"default" | "sick" | "absent">("default");
  const [submitting, setSubmitting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function reportSick() {
    setSubmitting(true);
    try {
      // Reuses the IAmSickButton write pattern verbatim (search this file
      // for the original `markSick` to compare). Two real writes:
      //   - staff_sick_overrides (today's sick flag)
      //   - intake_staff_time_off (calendar block, reason_type='sick')
      // No new tables, no migration.
      await sbPost("staff_sick_overrides", {
        staff_id:  session.id,
        staff_name: session.name,
        date:      today,
        reason:    "sick",
        marked_by: "self",
        is_active: true,
      });
      await sbPost("intake_staff_time_off", {
        staff_id:      session.id,
        staff_name:    session.name,
        date:          today,
        time_off_type: "full_day",
        reason_type:   "sick",
        reason:        "Reported sick at clock-in gate",
        approved:      true,
      });
      // TODO Phase B — reassignment routing:
      //   1. Find today's appts + tasks assigned to this staffer.
      //   2. For each, attempt auto-reassign to a same-department staffer
      //      who is available (uses staff_availability + intake_staff_time_off).
      //   3. If no coverage found, write a `staff_coverage_request` row
      //      with status='unresolved' so the on-duty supervisor sees it.
      //   4. Notify supervisor (Twilio SMS / SendGrid email — same TODO
      //      list as PostCallScheduledModal).
      onCancel();
    } finally {
      setSubmitting(false);
    }
  }

  function reportAbsent() {
    setSubmitting(true);
    // SCAFFOLD — no DB write today. TODO same pattern as reportSick but
    // with reason_type='absent_other' (or a new dedicated reason_type
    // once the consent + leave-balances model is wired). Reassignment +
    // supervisor flag share the TODO list above.
    setTimeout(() => {
      setSubmitting(false);
      onCancel();
    }, 300);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0F0F0E' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8" style={{ paddingLeft: '2px' }}>
          <Briefcase style={{ width: 24, height: 24, color: '#FAFAF7', strokeWidth: 1.5 }} />
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.1, color: '#FAFAF7', marginTop: 12 }}>
            Employee Time Clock
          </h1>
          <p style={{ fontSize: 13, color: '#6B6B66', marginTop: 4 }}>
            {session.name} · {ROLE_CONFIG[session.role].label}
          </p>
        </div>

        <div className="rounded-2xl border border-[#2A2A28] bg-[#1A1A18] p-5 space-y-4">
          {mode === "default" && (
            <>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-[#B8945F] mt-0.5 flex-shrink-0" />
                <p className="text-sm text-[#FAFAF7] leading-relaxed">
                  You're signed in but not clocked in. Clock in to start your shift,
                  or let us know you can't make it today.
                </p>
              </div>
              <button
                onClick={onClockIn}
                className="w-full flex items-center justify-center gap-2 bg-[#1E3A2F] hover:bg-[#264A3B] text-[#FAFAF7] font-bold text-sm py-3 rounded-xl transition-colors"
              >
                <Play className="w-4 h-4" /> Clock In
              </button>

              <div className="space-y-2 pt-2 border-t border-[#2A2A28]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66]">
                  Can't make it today?
                </p>
                <button
                  onClick={() => setMode("sick")}
                  className="w-full flex items-center justify-center gap-1.5 bg-amber-900/30 hover:bg-amber-900/50 border border-amber-700/50 text-amber-200 font-semibold text-xs py-2 rounded-xl transition-colors"
                >
                  <Thermometer className="w-3.5 h-3.5" /> Report I'm sick
                </button>
                <button
                  onClick={() => setMode("absent")}
                  className="w-full flex items-center justify-center gap-1.5 bg-rose-900/25 hover:bg-rose-900/40 border border-rose-700/40 text-rose-200 font-semibold text-xs py-2 rounded-xl transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> Not able to make it in today
                </button>
              </div>

              <button
                onClick={onCancel}
                className="w-full text-xs text-[#6B6B66] hover:text-[#FAFAF7] transition-colors"
              >
                Not me — sign out
              </button>
              <p className="text-[10px] text-slate-700 leading-snug">
                Scaffold — clock state lives in sessionStorage only. Wiring to the
                real time-tracking backend (staff_time_entries + week aggregator)
                is planned but not built.
              </p>
            </>
          )}

          {mode === "sick" && (
            <>
              <div className="flex items-start gap-2">
                <Thermometer className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-[#FAFAF7]">Report sick — confirm</p>
                  <p className="text-[11px] text-[#6B6B66] leading-snug mt-1">
                    Marks you out sick for {today}. Today's intake appointments and
                    tasks will be flagged for coverage; if none is available, the
                    supervisor is notified.
                  </p>
                  <p className="text-[10px] text-[#6B6B66] italic mt-2 leading-snug">
                    Reassignment routing + supervisor notification are scaffolded
                    (TODO). The sick-day write itself is real — same pattern as the
                    existing I'm-Sick button (staff_sick_overrides + intake_staff_time_off).
                  </p>
                </div>
              </div>
              <button
                onClick={reportSick}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-600 text-white font-bold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Thermometer className="w-4 h-4" />}
                Confirm — I'm out sick
              </button>
              <button
                onClick={() => setMode("default")}
                disabled={submitting}
                className="w-full text-xs text-[#6B6B66] hover:text-[#FAFAF7] transition-colors"
              >
                Back
              </button>
            </>
          )}

          {mode === "absent" && (
            <>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-300 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-[#FAFAF7]">Not making it in — confirm</p>
                  <p className="text-[11px] text-[#6B6B66] leading-snug mt-1">
                    Reports you out today (non-sick reason). Today's appointments and
                    tasks will be flagged for coverage; if none is available, the
                    supervisor is notified.
                  </p>
                  <p className="text-[10px] text-rose-300/80 italic mt-2 leading-snug">
                    SCAFFOLD — no DB write today. TODO: write a row to
                    intake_staff_time_off with reason_type=&apos;absent_other&apos;
                    once that reason_type is in the form's allowed set; mirror the
                    reassignment + supervisor-flag routing from the sick-day path.
                  </p>
                </div>
              </div>
              <button
                onClick={reportAbsent}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-rose-700 hover:bg-rose-600 text-white font-bold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                Confirm — I'm out today
              </button>
              <button
                onClick={() => setMode("default")}
                disabled={submitting}
                className="w-full text-xs text-[#6B6B66] hover:text-[#FAFAF7] transition-colors"
              >
                Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Idle Warning modal ──────────────────────────────────────────────────────
//
// Surfaces at ~14 minutes of inactivity (see IntakePortalInner). Shows a
// 60-second countdown; if the user clicks "I'm here" or interacts with the
// page, the watcher resets and the modal closes. If the countdown reaches
// zero, the parent's `onLogoutNow` is invoked, which clears the clock state
// and signs out.

function IdleWarningModal({
  onStillHere, onLogoutNow,
}: { onStillHere: () => void; onLogoutNow: () => void }) {
  const [remaining, setRemaining] = useState(60);
  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(id);
          onLogoutNow();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [onLogoutNow]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Idle warning"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#0d1221] shadow-2xl">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Are you still there?</h3>
          <span className="ml-auto text-[11px] font-mono text-amber-300">{remaining}s</span>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed">
            You'll be clocked out and signed out automatically in
            <span className="text-amber-300 font-bold"> {remaining} </span>
            second{remaining === 1 ? "" : "s"} due to inactivity.
          </p>
          <p className="text-xs text-slate-500 leading-snug">
            Any mouse move, keypress, or click cancels the timer.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onLogoutNow}
              className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 transition-colors"
            >
              Sign out now
            </button>
            <button
              onClick={onStillHere}
              className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-xl transition-colors"
            >
              I'm here
            </button>
          </div>
        </div>
      </div>
    </div>
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

type OpenSlot = { staff_id: string; staff_name: string; slot_start: string; slot_end: string; available: boolean; reason: string | null };

// Monday-of-week helper: returns the Date for Monday of the week containing d.
function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffFromMon = (day === 0 ? -6 : 1 - day); // Mon = 1
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffFromMon);
  return r;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function CalendarTab({ events, leads, timeOff, availability, staffMembers, onRefresh }: {
  events: CalEvent[];
  leads: Lead[];
  timeOff: TimeOff[];
  availability: StaffAvailability[];
  staffMembers: Array<{ id: string; name: string }>;
  onRefresh: () => void;
}) {
  const today = new Date();
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [weekAnchor, setWeekAnchor] = useState<Date>(mondayOf(today));
  const [selectedDay, setSelectedDay] = useState<Date | null>(today);
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookDate, setBookDate] = useState<string>("");
  // Open slots for the selected day — fetched from get_open_slots RPC so the
  // UI shows exactly what book_consultation will accept (same rules).
  const [openSlots, setOpenSlots] = useState<OpenSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    if (!selectedDay) { setOpenSlots([]); return; }
    setSlotsLoading(true);
    const dateStr = `${selectedDay.getFullYear()}-${String(selectedDay.getMonth()+1).padStart(2,"0")}-${String(selectedDay.getDate()).padStart(2,"0")}`;
    supabase.rpc("get_open_slots", { p_staff_id: null, p_date: dateStr, p_slot_minutes: 45 })
      .then(({ data, error }) => {
        if (error) { setOpenSlots([]); }
        else { setOpenSlots((data as OpenSlot[]) ?? []); }
        setSlotsLoading(false);
      });
  }, [selectedDay?.toISOString().slice(0,10)]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Weekly view data prep ────────────────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)); // Mon..Sun
  // Working-hours range — union across all availability rows in the current week.
  const workingHourRange = (() => {
    let minH = 24, maxH = 0;
    for (const a of availability) {
      if (!a.is_available) continue;
      const sh = parseInt(String(a.start_time).slice(0,2)) || 9;
      const eh = parseInt(String(a.end_time).slice(0,2)) || 17;
      if (sh < minH) minH = sh;
      if (eh > maxH) maxH = eh;
    }
    if (minH === 24) { minH = 9; maxH = 17; }
    return { startHour: Math.min(minH, 8), endHour: Math.max(maxH, 17) };
  })();
  const weekHours = Array.from({ length: workingHourRange.endHour - workingHourRange.startHour }, (_, i) => workingHourRange.startHour + i);

  function eventsOnDate(dateStr: string) {
    return events.filter(e => e.start_time?.slice(0,10) === dateStr);
  }
  function timeOffOnDate(dateStr: string) {
    return timeOff.filter(t => t.date === dateStr);
  }
  function capacityForDow(dow: number): number {
    // Sum max_consultations_per_day across all is_available rows for that weekday.
    return availability
      .filter(a => a.day_of_week === dow && a.is_available)
      .reduce((s, a) => s + (a.max_consultations_per_day ?? 8), 0);
  }
  function staffName(staffId: string | null | undefined): string {
    if (!staffId) return "—";
    return staffMembers.find(s => s.id === staffId)?.name ?? "staff";
  }

  function prevWeek() { setWeekAnchor(addDays(weekAnchor, -7)); }
  function nextWeek() { setWeekAnchor(addDays(weekAnchor,  7)); }
  function goThisWeek() { const m = mondayOf(today); setWeekAnchor(m); setSelectedDay(today); }

  const weekLabel = (() => {
    const sat = addDays(weekAnchor, 6);
    if (weekAnchor.getMonth() === sat.getMonth()) {
      return `${MONTHS[weekAnchor.getMonth()]} ${weekAnchor.getDate()}–${sat.getDate()}, ${sat.getFullYear()}`;
    }
    return `${MONTHS[weekAnchor.getMonth()].slice(0,3)} ${weekAnchor.getDate()} – ${MONTHS[sat.getMonth()].slice(0,3)} ${sat.getDate()}, ${sat.getFullYear()}`;
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Calendar (Week or Month) */}
      <div className="lg:col-span-2 bg-[#0d1221] border border-slate-800 rounded-2xl overflow-hidden">
        {/* Calendar nav + Week/Month toggle */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 gap-3">
          <button
            onClick={viewMode === 'week' ? prevWeek : prevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          <div className="flex items-center gap-2 flex-1 justify-center">
            <h2 className="text-base font-bold text-white">
              {viewMode === 'week' ? weekLabel : `${MONTHS[month]} ${year}`}
            </h2>
            <button
              onClick={viewMode === 'week' ? goThisWeek : goToday}
              className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-lg hover:bg-sky-500/20 transition-colors">
              {viewMode === 'week' ? 'This week' : 'Today'}
            </button>
            <div className="ml-3 flex items-center gap-0.5 bg-slate-800/60 border border-slate-700/60 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('week')}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded ${viewMode === 'week' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-500 hover:text-slate-300'}`}>
                Week
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded ${viewMode === 'month' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-500 hover:text-slate-300'}`}>
                Month
              </button>
            </div>
          </div>
          <button
            onClick={viewMode === 'week' ? nextWeek : nextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* WEEKLY GRID */}
        {viewMode === 'week' && (
          <div className="overflow-x-auto">
            {/* Day headers — show date + booked/capacity */}
            <div className="grid grid-cols-[60px_repeat(7,minmax(120px,1fr))] border-b border-slate-800">
              <div className="py-2 text-center text-[9px] font-bold text-slate-700 uppercase tracking-widest border-r border-slate-800/40">PT</div>
              {weekDays.map(d => {
                const dateStr = ymd(d);
                const isTodayCol = dateStr === ymd(today);
                const isSelectedCol = selectedDay && dateStr === ymd(selectedDay);
                const consults = eventsOnDate(dateStr).filter(e => e.event_subtype === 'consultation' && !['cancelled','no_show','rescheduled'].includes(e.status));
                const cap = capacityForDow(d.getDay());
                const dow = d.getDay();
                const load = cap > 0 ? consults.length / cap : 0;
                const loadCls = load >= 1 ? 'text-red-400' : load >= 0.75 ? 'text-amber-400' : 'text-slate-500';
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDay(d)}
                    className={`py-2 text-center border-r border-slate-800/40 cursor-pointer transition-colors ${
                      isSelectedCol ? 'bg-sky-500/10' : isTodayCol ? 'bg-slate-800/40' : 'hover:bg-slate-800/20'
                    }`}>
                    <div className={`text-[10px] font-bold uppercase tracking-widest ${isTodayCol ? 'text-sky-400' : 'text-slate-500'}`}>
                      {DAYS[dow === 0 ? 6 : dow - 1]}
                    </div>
                    <div className={`text-sm font-bold ${isTodayCol ? 'text-white' : 'text-slate-300'}`}>{d.getDate()}</div>
                    <div className={`text-[10px] font-mono ${loadCls}`}>{consults.length}/{cap > 0 ? cap : '–'}</div>
                  </button>
                );
              })}
            </div>

            {/* Hour rows */}
            <div className="relative">
              {weekHours.map(hour => (
                <div key={hour} className="grid grid-cols-[60px_repeat(7,minmax(120px,1fr))] border-b border-slate-800/30">
                  <div className="py-1.5 text-right pr-2 text-[10px] font-mono text-slate-600 border-r border-slate-800/40">
                    {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </div>
                  {weekDays.map(d => {
                    const dateStr = ymd(d);
                    const hourEvents = eventsOnDate(dateStr).filter(e => {
                      if (!e.start_time) return false;
                      const eh = new Date(e.start_time).toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Los_Angeles' });
                      return parseInt(eh) === hour;
                    });
                    return (
                      <div key={dateStr + hour} className="min-h-[40px] p-0.5 border-r border-slate-800/30 space-y-0.5">
                        {hourEvents.map(e => {
                          const tLocal = e.start_time ? new Date(e.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Los_Angeles' }) : '';
                          const cls = EVENT_STATUS_COLOR[e.status] ?? 'bg-slate-500';
                          return (
                            <div
                              key={e.id}
                              onClick={() => setSelectedDay(d)}
                              title={`${tLocal} · ${e.client_name ?? '—'} · ${staffName(e.staff_id)} · ${e.status}`}
                              className={`text-[9px] leading-tight px-1.5 py-1 rounded cursor-pointer text-white/95 ${cls.replace('bg-','bg-').replace('-500', '-500/85')} hover:opacity-90`}
                            >
                              <div className="font-bold truncate">{tLocal} {e.client_name ?? '—'}</div>
                              <div className="opacity-80 truncate">{staffName(e.staff_id)} · {e.status}</div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MONTHLY GRID — unchanged below, gated on viewMode */}
        {viewMode === 'month' && (<>


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
        </>)}
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

          {/* Open slots — hourly grid from get_open_slots, same rules as book_consultation */}
          {selectedDay && (
            <div className="px-4 py-3 border-b border-slate-800/40">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Open slots ({slotsLoading ? "loading…" : `${openSlots.filter(s => s.available).length} available`})</p>
              {slotsLoading ? (
                <p className="text-[11px] text-slate-600">Loading slots…</p>
              ) : openSlots.length === 0 ? (
                <p className="text-[11px] text-slate-600">No staff configured for this day.</p>
              ) : (
                <div className="space-y-2">
                  {/* Group by staffer */}
                  {Array.from(new Set(openSlots.map(s => s.staff_id))).map(staffId => {
                    const rows = openSlots.filter(s => s.staff_id === staffId);
                    const name = rows[0]?.staff_name ?? "—";
                    return (
                      <div key={staffId}>
                        <p className="text-[10px] font-semibold text-slate-400 mb-1">{name}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {rows.map((s, i) => {
                            const t = new Date(s.slot_start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Los_Angeles" });
                            const cls = s.available
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                              : s.reason === "lunch" ? "bg-amber-500/10 border-amber-500/30 text-amber-400 cursor-not-allowed"
                              : s.reason === "time_off" ? "bg-orange-500/10 border-orange-500/30 text-orange-400 cursor-not-allowed"
                              : s.reason === "daily_capacity_reached" ? "bg-slate-700/30 border-slate-600 text-slate-500 cursor-not-allowed"
                              : "bg-slate-700/30 border-slate-600 text-slate-500 cursor-not-allowed";
                            return (
                              <button
                                key={`${staffId}-${i}`}
                                disabled={!s.available}
                                onClick={() => { if (s.available && selectedDay) { setBookDate(selectedDay.toISOString().slice(0,10)); setShowBookModal(true); } }}
                                title={s.reason ? `Unavailable — ${s.reason}` : `Book ${t}`}
                                className={`text-[10px] font-semibold px-2 py-1 rounded border ${cls}`}
                              >
                                {t}{!s.available && s.reason ? ` · ${s.reason}` : ""}
                              </button>
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

  const [bookError, setBookError] = useState<string | null>(null);
  async function save() {
    if (!date || (!leadId && !isWalkIn)) return;
    setSaving(true);
    setBookError(null);
    const startDt = new Date(`${date}T${startTime}:00`);
    const endDt   = new Date(startDt.getTime() + parseInt(duration) * 60000);
    const clientName = isWalkIn ? walkInName : (selectedLead?.full_name ?? "");
    const phone      = isWalkIn ? walkInPhone : (selectedLead?.phone ?? null);

    // Route through book_consultation RPC — capacity, lunch, gap, time-off,
    // sick, collision all enforced server-side atomically.
    const { data, error } = await supabase.rpc("book_consultation", {
      p_staff_id: null,              // least-loaded staffer chosen by RPC
      p_lead_id: leadId || null,
      p_start_time: startDt.toISOString(),
      p_end_time: endDt.toISOString(),
      p_client_name: clientName,
      p_client_phone: phone,
      p_client_email: isWalkIn ? null : (selectedLead?.email ?? null),
      p_is_walk_in: isWalkIn,
      p_event_subtype: "consultation",
      p_calendar_type: "intake",
      p_department: "intake",
      p_notes: notes || null,
      p_created_by: "admin",
    });

    const result = data as { ok: boolean; reason: string | null } | null;
    if (error || !result?.ok) {
      setBookError(result?.reason ?? error?.message ?? "Booking failed");
      setSaving(false);
      return;
    }

    // Lead-link update happens atomically inside book_consultation —
    // no separate sbPatch needed here. The lead's consultation_event_id,
    // consultation_date, status, and last_contact_at are all set in the
    // same transaction as the calendar_events INSERT.
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
        {bookError && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-xs">
            <span className="font-semibold">Cannot book this slot:</span> {bookError}
          </div>
        )}
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

function AvailabilityTab({ availability, onRefresh, canEdit }: { availability: StaffAvailability[]; onRefresh: () => void; canEdit: boolean; }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState<Partial<StaffAvailability>>({});

  function startEdit(a: StaffAvailability) {
    if (!canEdit) return; // Server-side enforcement is a Phase 1A.5 follow-up — see plan doc.
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

// ─── My Schedule Tab — consolidates the prior Availability + Time Off tabs ─
//
// Surfaces:
//   1. Action row
//       - I'm sick → leave now  (existing IAmSickButton; writes to
//          staff_sick_overrides + intake_staff_time_off — same as before)
//       - Family emergency → leave now  (SCAFFOLD modal; no DB write, TODO
//          notes that real wiring would mirror IAmSickButton with reason_type
//          = 'family_emergency')
//       - Request future time off  (header CTA + scrolls to the existing
//          TimeOffTab inline below)
//   2. Balances row — PTO · Sick · FMLA  (ALL SCAFFOLD, no fake numbers)
//       Real balances need a `staff_leave_balances` table (id, staff_id,
//       pto_hours, sick_hours, fmla_hours_remaining, fmla_eligible bool,
//       updated_at). "FMLA eligible" is selected when entering employees
//       per the planned staff-setup model (not built yet).
//   3. Time Off section (real) — mounts existing TimeOffTab verbatim
//   4. Weekly availability (real) — mounts existing AvailabilityTab verbatim
//
// TODO Phase B — wiring required to make the balances + family-emergency
// surfaces real:
//   - new `staff_leave_balances` table + accrual ledger
//   - new field on staff_members: `fmla_eligible` (admin-set during onboarding)
//   - mirror IAmSickButton flow for family-emergency reason_type

function MyScheduleTab({
  session, timeOff, availability, canEdit, onRefresh, isSuperAdmin,
}: {
  session: PortalSession;
  timeOff: TimeOff[];
  availability: StaffAvailability[];
  canEdit: boolean;
  onRefresh: () => void;
  /** Drives whether the Out-of-Office (super-admin sick overrides) panel
   *  is mounted at the bottom. Replaces the standalone "Out-of-Office"
   *  nav entry that was removed in the nav rework. */
  isSuperAdmin: boolean;
}) {
  const [familyOpen, setFamilyOpen] = useState(false);
  const [showStaffSettings, setShowStaffSettings] = useState(false);

  // Staff Settings supervisor gate — see deriveStaffSettingsViewer for the
  // role-stub + TODO Phase B note. Non-supervisors get { role: 'none' } and
  // the link is hidden entirely.
  const staffSettingsViewer = deriveStaffSettingsViewer(isSuperAdmin);
  const canSeeStaffSettings =
    staffSettingsViewer.role === 'super_admin' ||
    staffSettingsViewer.role === 'department_supervisor';
  return (
    <div className="space-y-6">
      {/* Header strip */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">My Schedule</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Request future time off, manage your weekly hours, and signal when
            you need to step away today.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <IAmSickButton onMarked={onRefresh} session={session} />
          <button
            onClick={() => setFamilyOpen(true)}
            title="Family emergency — leave now"
            className="flex items-center gap-1.5 text-xs font-bold text-rose-200 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 rounded-xl px-3 py-1.5 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Family emergency
          </button>
        </div>
      </div>

      {/* Balances row — SCAFFOLD: no fake numbers shown as real. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <LeaveBalanceCard label="PTO"  hint="Vacation / personal time" />
        <LeaveBalanceCard label="Sick" hint="Sick leave balance" />
        <LeaveBalanceCard
          label="FMLA"
          hint="FMLA-eligible employees only"
          eligibilityNote="FMLA eligibility is selected when entering employees (planned staff-setup model — not built yet)."
        />
      </div>

      {/* Time Off section (existing functionality, REAL). */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Time Off</p>
        </div>
        <TimeOffTab timeOff={timeOff} onRefresh={onRefresh} />
      </div>

      {/* Availability section (existing functionality, REAL). */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-3.5 h-3.5 text-sky-400" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Weekly availability</p>
        </div>
        <AvailabilityTab availability={availability} onRefresh={onRefresh} canEdit={canEdit} />
      </div>

      {/* Out-of-Office (super admin only) — was a standalone nav tab; the
          nav rework hides that entry and mounts the panel HERE so the
          super-admin's sick-override admin still has a home inside My
          Schedule. Panel code is unchanged. */}
      {isSuperAdmin && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm leading-none">🤒</span>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Out-of-Office (super admin)</p>
          </div>
          <SuperAdminSickPanel onRefresh={onRefresh} />
        </div>
      )}

      {/* ── Staff Settings (supervisor-gated entry) ─────────────────────────
          Visible ONLY when the viewerStaffRole stub resolves to
          'department_supervisor' or 'super_admin'. Non-supervisors don't
          see this link at all.

          A department_supervisor sees ONLY their own department's Staff
          Settings (strength scores + task assignments + that department's
          reporting metrics). Firm-wide sections from the Super Admin
          Setting Portal (firm settings, feature toggles, Performance Goals
          firm-wide config, automated messaging, knowledge base) are NOT
          rendered here — those remain inside the super-admin-only console.

          A super_admin sees the same panel with full-firm scope (and also
          reaches it from the Super Admin Setting Portal — both entry
          points mount the same `<StaffSettingsPanel>` component).

          TODO Phase B — real department-scoped enforcement:
            - viewer.staff_role + viewer.department_id derived from the
              staff_department_supervisors table at auth time
            - server-side filter on every read (and every write once
              persistence lands) so supervisors see + edit ONLY their own
              department's staff
            - nav/dashboard re-renders the link as the supervisor's
              assignments change (e.g., promoted, reassigned, retired) */}
      {canSeeStaffSettings && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Staff Settings</p>
            {staffSettingsViewer.role === 'department_supervisor' && staffSettingsViewer.department && (
              <span className="ml-auto text-[10px] uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
                Supervisor · {staffSettingsViewer.department}
              </span>
            )}
            {staffSettingsViewer.role === 'super_admin' && (
              <span className="ml-auto text-[10px] uppercase tracking-widest text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
                Super Admin · all departments
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowStaffSettings(v => !v)}
              className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded border transition-colors ${
                staffSettingsViewer.role === 'super_admin' ? '' : 'ml-auto'
              } border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500`}
            >
              {showStaffSettings ? 'Hide' : 'Open Staff Settings'}
            </button>
          </div>

          {showStaffSettings && staffSettingsViewer.role !== 'none' && (
            <div className="rounded-2xl border border-slate-800 bg-[#0d1221] p-5">
              <StaffSettingsPanel
                viewerStaffRole={staffSettingsViewer.role as StaffSettingsViewerRole}
                viewerDepartment={staffSettingsViewer.department}
              />
            </div>
          )}

          {!showStaffSettings && (
            <p className="text-[11px] text-slate-500 italic">
              {staffSettingsViewer.role === 'department_supervisor'
                ? `Open to manage strength scores, task assignments, and reporting metrics for ${staffSettingsViewer.department ?? 'your department'}. Other departments and firm-wide Setting Portal sections are not visible to you.`
                : 'Open to manage strength scores, task assignments, and reporting across all departments. (Also reachable from the Super Admin Setting Portal — same panel.)'}
            </p>
          )}
        </div>
      )}

      {familyOpen && (
        <FamilyEmergencyModal session={session} onClose={() => setFamilyOpen(false)} />
      )}
    </div>
  );
}

// ─── MessagingTabView — full-page Messages nav surface ──────────────────────
//
// Reuses the dashboard's `ConsolidatedMessagingWidget` verbatim — same
// component instance, same data shape, just mounted at the tab level so
// staff can work the inbox without leaving the portal. Fetch mirrors the
// dashboard's fetch (one-off on mount; Realtime push is a TODO listed
// elsewhere).

function MessagingTabView({
  session, onOpenView,
}: {
  session: PortalSession;
  onOpenView: (view: "messages" | "staff_comms") => void;
}) {
  const [threads, setThreads] = useState<(DashClientMessageThread & { client_name?: string; preview?: string; last_channel?: string | null })[]>([]);
  const [staffMsgs, setStaffMsgs] = useState<DashStaffMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tRows, sRows] = await Promise.all([
          sbGet<DashClientMessageThread>(`client_message_threads?order=last_message_at.desc.nullslast,updated_at.desc&limit=20`),
          sbGet<DashStaffMessage>(`staff_messages?recipient_id=eq.${session.id}&order=created_at.desc&limit=20`),
        ]);
        if (cancelled) return;
        const clientIds = tRows.map(t => t.client_id).filter(Boolean);
        const threadIds = tRows.map(t => t.id);
        const [clients, latestMsgs] = await Promise.all([
          clientIds.length
            ? sbGet<{ id: string; name: string }>(`clients?id=in.(${clientIds.join(",")})&select=id,name`)
            : Promise.resolve([] as { id: string; name: string }[]),
          threadIds.length
            ? sbGet<DashClientMessage>(`client_messages?thread_id=in.(${threadIds.join(",")})&select=id,thread_id,body,channel,sender_role,sender_name,created_at&order=created_at.desc&limit=${threadIds.length * 3}`)
            : Promise.resolve([] as DashClientMessage[]),
        ]);
        if (cancelled) return;
        const nameById = new Map(clients.map(c => [c.id, c.name]));
        const firstByThread = new Map<string, DashClientMessage>();
        for (const m of latestMsgs) if (!firstByThread.has(m.thread_id)) firstByThread.set(m.thread_id, m);
        setThreads(tRows.map(t => ({
          ...t,
          client_name: nameById.get(t.client_id) ?? "Client",
          preview: firstByThread.get(t.id)?.body ?? "",
          last_channel: firstByThread.get(t.id)?.channel ?? null,
        })));
        setStaffMsgs(sRows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session.id]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-white">Messages</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Same tabbed inbox the dashboard's messaging panel shows — full-width here.
        </p>
      </div>
      <ConsolidatedMessagingWidget
        threads={threads}
        staffMsgs={staffMsgs}
        loading={loading}
        onOpenView={onOpenView}
      />
    </div>
  );
}

// ─── StaffMemberTasksPage — full per-staffer task page ──────────────────────
//
// Resolved + outstanding tasks for the current viewer + a metrics row. Real
// task counts come from the existing `leads` array (status-based buckets);
// the work-metrics row is SCAFFOLD with `—` placeholders until the metrics
// backend (firm_perf_metrics + firm_perf_goal_results — spec'd in
// SuperAdminConsole's Performance Goals subsection) is wired.
//
// Reachable from the new "My Tasks" nav tab AND a link in the dashboard's
// AllTasksWidget header.

function StaffMemberTasksPage({
  session, leads, onOpenLead,
}: {
  session: PortalSession;
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
}) {
  // Outstanding — leads with an active status that this staffer either
  // owns (assigned_name matches) OR isn't yet assigned to anyone. The
  // "own + unclaimed" rule matches the shared-pool semantics on the dashboard.
  const OUTSTANDING_STATUSES = new Set<string>([
    "new", "contacted", "consultation_scheduled", "consultation_complete",
    "intake_in_progress", "intake_complete", "sent_for_attorney_review",
    "attorney_accepted", "fee_quoted",
  ]);
  const RESOLVED_STATUSES = new Set<string>([
    "retained", "declined", "no_case", "no_show",
  ]);

  const outstanding = leads.filter(l =>
    OUTSTANDING_STATUSES.has(l.status) &&
    (l.assigned_name === session.name || !l.assigned_name)
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const resolved = leads.filter(l =>
    RESOLVED_STATUSES.has(l.status) &&
    l.assigned_name === session.name
  ).sort((a, b) =>
    new Date(b.retained_at ?? b.created_at).getTime() -
    new Date(a.retained_at ?? a.created_at).getTime()
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-white">My Tasks — {session.name}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Your outstanding + resolved tasks, plus work-metrics scaffolds. Counts come
          from active leads in <code className="font-mono">intake_leads</code>; full
          metrics arrive with the Performance Goals backend.
        </p>
      </div>

      {/* Metrics row — SCAFFOLD. No fabricated numbers. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <StaffMetricCard label="Outstanding" value={String(outstanding.length)} kind="real" />
        <StaffMetricCard label="Resolved"    value={String(resolved.length)}    kind="real" />
        <StaffMetricCard label="Calls today"  value="—" kind="scaffold"
          tooltip="Needs intake_contact_log roll-up + the firm_perf_metrics 'calls' source_query." />
        <StaffMetricCard label="Appts set"    value="—" kind="scaffold"
          tooltip="Needs status-transition log (consultation_scheduled events attributed to this staffer)." />
        <StaffMetricCard label="Presented"    value="—" kind="scaffold"
          tooltip="Needs status-transition log (attorney_accepted → fee_quoted events attributed to this staffer)." />
        <StaffMetricCard label="Retained MTD" value="—" kind="scaffold"
          tooltip="Needs intake_leads.retained_at + month-window rollup attributed to this staffer." />
      </div>

      {/* Outstanding section */}
      <StaffTaskSection
        title="Outstanding"
        count={outstanding.length}
        emptyLabel="Nothing outstanding right now."
        leads={outstanding}
        onOpenLead={onOpenLead}
        session={session}
        showWhen={false}
      />

      {/* Resolved section */}
      <StaffTaskSection
        title="Resolved"
        count={resolved.length}
        emptyLabel="No resolved leads recorded for you yet."
        leads={resolved}
        onOpenLead={onOpenLead}
        session={session}
        showWhen
      />

      <p className="text-[11px] text-slate-500 italic leading-snug">
        {/* TODO Phase B — metrics + period selectors:
            - Period picker (today / week / month / quarter) once the
              metrics backend supports time windows
            - "Calls", "Appts set", "Presented" fed by firm_perf_metrics
              with the source_query allow-listed validator
            - "Retained MTD" pulled from a nightly rollup of
              intake_leads.retained_at attributed to staff_id */}
        Real outstanding + resolved counts come from <code className="font-mono">intake_leads.status</code> + <code className="font-mono">assigned_name</code> today. Work metrics light up when the Performance Goals backend lands.
      </p>
    </div>
  );
}

function StaffMetricCard({
  label, value, kind, tooltip,
}: { label: string; value: string; kind: "real" | "scaffold"; tooltip?: string }) {
  const isScaffold = kind === "scaffold";
  return (
    <div className="bg-[#0d1221] border border-slate-800 rounded-2xl p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">{label}</p>
        {isScaffold && (
          <span className="text-[8px] font-semibold uppercase tracking-widest text-slate-600 border border-slate-700 rounded px-1 py-0.5">
            Scaffold
          </span>
        )}
      </div>
      <p
        className={`text-xl font-mono ${isScaffold ? "text-slate-600 italic" : "text-white"}`}
        title={tooltip}
      >
        {value}
      </p>
    </div>
  );
}

function StaffTaskSection({
  title, count, emptyLabel, leads, onOpenLead, session, showWhen,
}: {
  title: string;
  count: number;
  emptyLabel: string;
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
  session: PortalSession;
  /** True for the Resolved section — shows retained_at / last update timestamp. */
  showWhen: boolean;
}) {
  const sc = (s: string) => STATUS_CONFIG[s] ?? STATUS_CONFIG["new"];
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</p>
        <span className="text-[10px] font-mono text-slate-600">{count}</span>
      </div>
      {leads.length === 0 ? (
        <div className="bg-[#0d1221] border border-slate-800 rounded-2xl py-8 text-center">
          <p className="text-xs text-slate-500 italic">{emptyLabel}</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {leads.slice(0, 20).map(l => {
            const cfg = sc(l.status);
            const locked = isClaimedByOther(l, session.id);
            return (
              <li key={l.id}>
                <button
                  onClick={() => { if (!locked) onOpenLead(l); }}
                  disabled={locked}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors text-left ${
                    locked
                      ? "bg-slate-800/15 border-slate-700/30 opacity-60 cursor-not-allowed"
                      : "bg-slate-800/30 hover:bg-slate-800/60 border-slate-700/40"
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-700/60 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-300">
                    {l.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-white truncate">{l.full_name}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cfg.color} ${cfg.bg}`}>{cfg.label}</span>
                      {l.chapter_interest && <span className="text-[9px] text-slate-500">Ch.{l.chapter_interest}</span>}
                      <LeadClaimBadge lead={l} currentSessionId={session.id} size="xs" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                      {l.phone ?? l.email ?? "—"}
                      {showWhen && (l.retained_at || l.last_contact_at) && (
                        <span> · {timeAgo(l.retained_at ?? l.last_contact_at ?? l.created_at)}</span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-700 flex-shrink-0" />
                </button>
              </li>
            );
          })}
          {leads.length > 20 && (
            <li className="text-[10px] text-slate-600 italic px-3 py-1">
              + {leads.length - 20} more — refine via the Leads tab filters.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function LeaveBalanceCard({
  label, hint, eligibilityNote,
}: { label: string; hint: string; eligibilityNote?: string }) {
  return (
    <div className="bg-[#0d1221] border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
        <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 border border-slate-700 rounded px-1.5 py-0.5">
          Scaffold
        </span>
      </div>
      <p className="text-2xl font-mono text-slate-500" title="Placeholder — needs staff_leave_balances table">
        —<span className="text-xs text-slate-700 ml-1">hrs</span>
      </p>
      <p className="text-[11px] text-slate-500 mt-1 leading-snug">{hint}</p>
      {eligibilityNote && (
        <p className="text-[10px] text-slate-600 italic mt-2 leading-snug">{eligibilityNote}</p>
      )}
    </div>
  );
}

function FamilyEmergencyModal({
  session, onClose,
}: { session: PortalSession; onClose: () => void }) {
  // SCAFFOLD: no DB write. Confirmation only.
  // TODO Phase B: route through staff_sick_overrides + intake_staff_time_off
  // with reason_type='family_emergency', same pattern as IAmSickButton.
  void session;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Family emergency — leave now"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-[#0d1221] shadow-2xl">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-bold text-white">Family Emergency</h3>
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-widest text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
            Coming soon
          </span>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed">
            Take care of what matters. The supervisor will be notified and
            today's remaining consults will be redistributed.
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Wiring is not yet connected. When it lands, this routes through the
            same flow as the "I'm sick" button (writes to
            <code className="font-mono text-slate-400"> staff_sick_overrides</code> +
            <code className="font-mono text-slate-400"> intake_staff_time_off</code>
            with reason_type=<code className="font-mono text-slate-400">family_emergency</code>)
            and notifies the on-duty supervisor.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 transition-colors"
            >
              Close
            </button>
            <button
              onClick={onClose}
              className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 px-3 py-1.5 rounded-xl transition-colors"
              title="Send — wiring pending"
            >
              I understand
            </button>
          </div>
        </div>
      </div>
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

// Simplified attorney review queue per the role-strip spec. Three sections:
//   1. Cases Needing Review (status='sent_for_attorney_review')
//   2. Pending Case Presentations (status='attorney_accepted')
//   3. Welcome Calls Needed (status IN consultation_scheduled / new / contacted)
//
// The legacy "Fee Quoted — Follow Up" section and the 4 colored summary
// tiles at the top were removed: lead-list / colored-banner surfaces are
// out-of-scope for the attorney view. Intake-specialist roles retain
// their full set of leads tools elsewhere in this portal.
function AttorneyReviewQueue({ leads, acceptances, onSelect }: {
  leads: Lead[];
  acceptances: Acceptance[];
  onSelect: (lead: Lead) => void;
}) {
  const needsReview   = leads.filter(l => l.status === "sent_for_attorney_review");
  const readyPresent  = leads.filter(l => l.status === "attorney_accepted");
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

  const total = needsReview.length + readyPresent.length + welcomeCalls.length;

  return (
    <div className="space-y-5">
      {/* Caseload summary — single muted line replacing the prior colored
          4-tile banner. Intentionally low-visual: this surface is for
          reviewing cases, not for monitoring KPIs. */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <span>{needsReview.length} needing review</span>
        <span className="text-slate-700">·</span>
        <span>{readyPresent.length} pending presentation</span>
        <span className="text-slate-700">·</span>
        <span>{welcomeCalls.length} welcome calls</span>
      </div>

      {total === 0 && (
        <div className="bg-[#0d1221] border border-slate-800 rounded-2xl text-center py-16">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto mb-3" />
          <p className="text-slate-500">All caught up — no pending attorney actions</p>
        </div>
      )}

      <Section title="Cases Needing Review" desc="Intake complete — awaiting attorney case review and decision"
        leads={needsReview} accent="bg-amber-500/15 text-amber-400" icon={<Scale className="w-3.5 h-3.5 text-amber-400" />} />

      <Section title="Pending Case Presentations" desc="Case accepted — present options to client (welcome call may be needed first)"
        leads={readyPresent} accent="bg-emerald-500/15 text-emerald-400" icon={<UserCheck className="w-3.5 h-3.5 text-emerald-400" />} />

      <Section title="Welcome Calls Needed" desc="New leads and scheduled consultations awaiting an attorney welcome call"
        leads={welcomeCalls} accent="bg-sky-500/15 text-sky-400" icon={<PhoneCall className="w-3.5 h-3.5 text-sky-400" />} />
    </div>
  );
}

function FollowUpQueue({ leads, currentSessionId, onSelect }: {
  leads: Lead[];
  /** For the lead-claim lock — when set, leads claimed by others show as locked. */
  currentSessionId?: string | null;
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
    const locked = isClaimedByOther(lead, currentSessionId);
    return (
      <button
        onClick={() => { if (!locked) onSelect(lead); }}
        disabled={locked}
        aria-disabled={locked}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left group ${
          locked
            ? "bg-slate-800/15 border-slate-700/30 opacity-60 cursor-not-allowed"
            : "bg-slate-800/30 hover:bg-slate-800/60 border-slate-700/40 hover:border-slate-600"
        }`}
      >
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
            <LeadClaimBadge lead={lead} currentSessionId={currentSessionId} size="xs" />
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
        const rows = active.filter(stage.filter);
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

// ─── Leads metrics panel (REAL where status field supports it, SCAFFOLD otherwise) ─
//
// Maps the requested 11 metrics to the `intake_leads.status` field. Real
// counts are derived from the existing leads array — NO new fetches, NO
// fabricated numbers. Scaffold cells render "—" and carry a TODO naming the
// field the metric needs.

const APPT_SET_STATUSES = new Set<string>([
  "consultation_scheduled", "consultation_complete",
  "intake_in_progress", "intake_complete",
  "sent_for_attorney_review", "attorney_accepted",
  "fee_quoted", "retained", "no_show",
]);
const APPT_SHOWN_STATUSES = new Set<string>([
  "consultation_complete",
  "intake_in_progress", "intake_complete",
  "sent_for_attorney_review", "attorney_accepted",
  "fee_quoted", "retained",
]);
const INTAKE_NO_FEE_STATUSES = new Set<string>([
  "intake_complete", "sent_for_attorney_review", "attorney_accepted",
]);

interface LeadsMetricsPanelProps { leads: Lead[]; }

function LeadsMetricsPanel({ leads }: LeadsMetricsPanelProps) {
  const total       = leads.length;
  const apptsSet    = leads.filter(l => APPT_SET_STATUSES.has(l.status)).length;
  const apptsShown  = leads.filter(l => APPT_SHOWN_STATUSES.has(l.status)).length;
  const retained    = leads.filter(l => l.status === "retained").length;
  const noShow      = leads.filter(l => l.status === "no_show").length;
  const noCase      = leads.filter(l => l.status === "no_case").length;
  // Best-effort proxy: status='declined' typically lands AFTER attorney_accepted
  // and fee_quoted in this codebase (see LegalAdminPortal status writes).
  const presentedNoMove = leads.filter(l => l.status === "declined").length;
  const intakeNoFee = leads.filter(l => INTAKE_NO_FEE_STATUSES.has(l.status)).length;
  const conversion  = total > 0 ? (retained / total) * 100 : 0;

  return (
    <div className="bg-[#0d1221] border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 className="w-4 h-4 text-[#B8945F]" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-white">Leads Metrics</h3>
      </div>
      <dl className="space-y-1">
        <MetricRow label="Total leads received"          value={total}            />
        <MetricRow label="Appointments set"              value={apptsSet}         />
        <MetricRow label="Appointments shown"            value={apptsShown}       />
        <MetricRow label="Retained"                      value={retained}         tone="good" />
        <MetricRow label="Appt set + no-show"            value={noShow}           tone="warn" />
        <MetricRow label="No cases"                      value={noCase}           />
        <MetricRow label="Consult done · no move forward" value={presentedNoMove}  tone="warn" />
        <MetricRow label="Intake done · no fee quoted"   value={intakeNoFee}      />
        {/* SCAFFOLD — no decline_reason / sub-status on declined yet. */}
        <MetricRow
          label="Not interested"
          value={null}
          scaffoldTooltip="Needs a decline_reason field on intake_leads (e.g. 'not_interested')."
        />
        <MetricRow
          label="Went elsewhere"
          value={null}
          scaffoldTooltip="Needs a decline_reason field on intake_leads (e.g. 'retained_elsewhere')."
        />
        <MetricRow
          label="Conversion %"
          value={total > 0 ? `${conversion.toFixed(1)}%` : "—"}
          tone="good"
          captionRight={total > 0 ? `${retained} / ${total}` : undefined}
        />
      </dl>
      <p className="text-[10px] text-slate-500 italic mt-3 leading-snug">
        Counts derive from <code className="font-mono">intake_leads.status</code> only.
        Scaffold rows need a new decline-reason field; "Consult done · no move forward"
        currently uses <code className="font-mono">status='declined'</code> as a proxy until
        a status-history table lands.
        {/* TODO Phase B: status_history table for accurate stage funnels,
            decline_reason column for the two scaffold rows. */}
      </p>
    </div>
  );
}

function MetricRow({
  label, value, tone, scaffoldTooltip, captionRight,
}: {
  label: string;
  /** number → real count · string → preformatted · null → scaffold ("—") */
  value: number | string | null;
  tone?: "good" | "warn";
  scaffoldTooltip?: string;
  captionRight?: string;
}) {
  const isScaffold = value === null;
  const display = isScaffold ? "—" : String(value);
  const valueCls =
    isScaffold       ? "text-slate-600 italic" :
    tone === "good"  ? "text-emerald-400" :
    tone === "warn"  ? "text-amber-300" :
                       "text-white";
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-[11px] text-slate-400 flex-1 truncate">
        {label}
        {isScaffold && (
          <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-widest text-slate-600 border border-slate-700 rounded px-1 py-0.5">
            Scaffold
          </span>
        )}
      </dt>
      {captionRight && (
        <span className="text-[10px] font-mono text-slate-500">{captionRight}</span>
      )}
      <dd
        className={`text-sm font-mono ${valueCls} min-w-[2.5rem] text-right`}
        title={scaffoldTooltip}
      >
        {display}
      </dd>
    </div>
  );
}

// ─── Leads-by-date column — chronological feed with status filter ────────────
//
// Reuses the existing `leads` array (no new fetch). Displays every lead sorted
// by created_at desc. Filter is a status dropdown — "All" by default, plus an
// "Active" bucket that excludes closed states (retained/declined/no_case/no_show).
// Clicking a row routes via the existing setSelectedLead handler.

const CLOSED_STATUSES = new Set<string>(["retained", "declined", "no_case", "no_show"]);

interface LeadsByDateColumnProps {
  leads: Lead[];
  /** For the lead-claim lock — when set, leads claimed by others show as locked. */
  currentSessionId?: string | null;
  onSelect: (lead: Lead) => void;
}

function LeadsByDateColumn({ leads, currentSessionId, onSelect }: LeadsByDateColumnProps) {
  const [filter, setFilter] = useState<"all" | "active" | "retained" | "declined" | "no_case" | "no_show" | "fee_quoted">("all");

  const rows = useMemo(() => {
    let list = leads;
    if (filter === "active") list = list.filter(l => !CLOSED_STATUSES.has(l.status));
    else if (filter !== "all") list = list.filter(l => l.status === filter);
    return [...list].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [leads, filter]);

  return (
    <div className="bg-[#0d1221] border border-slate-800 rounded-2xl flex flex-col">
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Inbox className="w-4 h-4 text-[#B8945F]" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-white flex-1">All Submissions</h3>
          <span className="text-[10px] font-mono text-slate-500">{rows.length}</span>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="w-full mt-2 bg-slate-800 border border-slate-700 text-slate-200 text-[11px] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#B8945F]/60"
        >
          <option value="all">All ({leads.length})</option>
          <option value="active">Active (open pipeline)</option>
          <option value="fee_quoted">Fee quoted</option>
          <option value="retained">Retained</option>
          <option value="declined">Declined</option>
          <option value="no_case">No case</option>
          <option value="no_show">No-show</option>
        </select>
      </div>
      <ul className="overflow-y-auto" style={{ maxHeight: 640 }}>
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-center text-[11px] text-slate-500 italic">
            No leads match this filter.
          </li>
        ) : rows.map(l => {
          const locked = isClaimedByOther(l, currentSessionId);
          return (
            <li key={l.id}>
              <button
                onClick={() => { if (!locked) onSelect(l); }}
                disabled={locked}
                aria-disabled={locked}
                className={`w-full text-left px-4 py-2.5 border-b border-slate-800 transition-colors ${
                  locked ? "opacity-60 cursor-not-allowed" : "hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-white truncate flex-1">{l.full_name}</p>
                  <LeadClaimBadge lead={l} currentSessionId={currentSessionId} size="xs" />
                  <span className="text-[9px] font-mono text-slate-500 flex-shrink-0">
                    {timeAgo(l.created_at)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                  {l.phone ?? l.email ?? "—"} · <span className="text-slate-400">{l.status}</span>
                  {l.chapter_interest && <span className="ml-1">· Ch.{l.chapter_interest}</span>}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Schedule Consult Modal ───────────────────────────────────────────────────
// Books a consultation for a specific lead and sends them an email with the
// pre-intake form link so they can complete it before the appointment.

// Unified scheduling experience for existing leads — full-screen overlay that
// renders the SAME 5-day ConsultSchedulerPanel + 3-action ladder as the
// new-lead window. The legacy free date/time + duration picker and the
// "Schedule & Send Invite" email send were removed in this build (no real
// sends, no DB writes outside book_consultation).
function ScheduleConsultModal({ lead, session, onClose, onSaved, onLaunchGuidedIntake }: {
  lead: Lead;
  session: PortalSession;
  onClose: () => void;
  onSaved: () => void;
  /** Launches StaffGuidedIntake for this lead after an immediate consult books. */
  onLaunchGuidedIntake: (lead: Lead) => void;
}) {
  const [bookingNow, setBookingNow] = useState(false);
  const [bookError, setBookError]   = useState<string | null>(null);
  const [showWhosAvailable, setShowWhosAvailable] = useState(false);

  // Staff pool + cal events for the panel's recommendation logic.
  const [staffPool, setStaffPool] = useState<SchedulerStaffDetail[]>([]);
  const [calEvents, setCalEvents] = useState<SchedulerCalEvent[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [staffRes, eventsRes] = await Promise.all([
        supabase
          .from("staff_members")
          .select("id,name,role,role_level,intake_portal_role,is_active")
          .eq("is_active", true)
          .in("intake_portal_role", ["legal_admin", "super_admin", "attorney_super_admin"])
          .order("role_level", { ascending: true, nullsFirst: false })
          .order("name", { ascending: true }),
        supabase
          .from("calendar_events")
          .select("id,start_time,end_time,staff_id,lead_id,client_name,title,event_subtype,status,department")
          .gte("start_time", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .lte("start_time", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);
      if (cancelled) return;
      if (staffRes.data) setStaffPool(staffRes.data as SchedulerStaffDetail[]);
      if (eventsRes.data) setCalEvents(eventsRes.data as SchedulerCalEvent[]);
    })();
    return () => { cancelled = true; };
  }, []);

  const todayLocal = todayInFirmTz();
  const [selection, setSelection] = useState<SchedulerSelection>({
    staffId: null, slotStartIso: null, dateStr: null,
  });

  const DEFAULT_SLOT_MINUTES = 45;
  const IMMEDIATE_START_BUFFER_MS = 60_000;

  // Schedule — books the slot/staff picked in the calendar.
  async function handleSchedule() {
    if (!selection.staffId || !selection.slotStartIso) return;
    setBookError(null);
    setBookingNow(true);
    try {
      const startMs = new Date(selection.slotStartIso).getTime();
      const endMs   = startMs + DEFAULT_SLOT_MINUTES * 60_000;
      const { data, error } = await supabase.rpc("book_consultation", {
        p_staff_id:    selection.staffId,
        p_lead_id:     lead.id,
        p_start_time:  new Date(startMs).toISOString(),
        p_end_time:    new Date(endMs).toISOString(),
        p_client_name: lead.full_name,
        p_client_phone: lead.phone ?? null,
        p_client_email: lead.email ?? null,
        p_is_walk_in:  false,
        p_notes:       `Scheduled by ${session.name}`,
        p_created_by:  session.name,
      });
      const result = (data ?? null) as { ok: boolean; reason: string | null } | null;
      if (error || !result?.ok) {
        setBookError(result?.reason ?? error?.message ?? "Booking failed");
        return;
      }
      onSaved();
    } finally {
      setBookingNow(false);
    }
  }

  // Do Consult Now — books immediate (least-loaded if no staff picked) and
  // bounces to StaffGuidedIntake. Matches the new-lead window behavior.
  async function handleDoConsultNow() {
    setBookError(null);
    setBookingNow(true);
    try {
      const startMs = Date.now() + IMMEDIATE_START_BUFFER_MS;
      const endMs   = startMs + DEFAULT_SLOT_MINUTES * 60_000;
      const { data, error } = await supabase.rpc("book_consultation", {
        p_staff_id:    selection.staffId,
        p_lead_id:     lead.id,
        p_start_time:  new Date(startMs).toISOString(),
        p_end_time:    new Date(endMs).toISOString(),
        p_client_name: lead.full_name,
        p_client_phone: lead.phone ?? null,
        p_client_email: lead.email ?? null,
        p_is_walk_in:  true,
        p_notes:       `Walk-in consult — logged by ${session.name}`,
        p_created_by:  session.name,
      });
      const result = (data ?? null) as { ok: boolean; reason: string | null } | null;
      if (error || !result?.ok) {
        setBookError(result?.reason ?? error?.message ?? "Booking failed");
        return;
      }
      onLaunchGuidedIntake(lead);
    } finally {
      setBookingNow(false);
    }
  }

  const canSchedule = !!selection.staffId && !!selection.slotStartIso && !bookingNow;
  const canDoConsultNow = !bookingNow;

  return (
    <div className="fixed inset-0 z-50 flex flex-col text-[#FAFAF7]" style={{ background: "#0F0F0E" }}>
      {/* Top bar */}
      <header
        className="sticky top-0 z-30 px-6 flex-shrink-0"
        style={{ height: 56, background: "#0F0F0E", borderBottom: "1px solid #2A2A28", display: "flex", alignItems: "center" }}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-[#6B6B66] hover:text-[#FAFAF7] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="mx-auto flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#B8945F]" />
          <span className="text-sm font-semibold" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
            Schedule consult
          </span>
        </div>
        <span className="text-[11px] font-mono text-[#6B6B66]">{session.name}</span>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-6 py-6 lg:px-8 lg:py-8 space-y-6">

          {/* Lead summary header */}
          <section className="rounded-xl border border-[#B8945F]/30 bg-[#1A1A18] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#B8945F] mb-2">Scheduling for</p>
            <p className="text-lg font-semibold text-[#FAFAF7]">{lead.full_name}</p>
            <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-[#6B6B66]">
              {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>}
              {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
              <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{lead.status}</span>
              {lead.chapter_interest && <span className="flex items-center gap-1">Ch. {lead.chapter_interest}</span>}
            </div>
          </section>

          {/* Actions (3) — same set as the new-lead window */}
          <section className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-3">Action</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={!canDoConsultNow}
                onClick={handleDoConsultNow}
                className="flex items-center gap-2 bg-[#B8945F] hover:bg-[#C8A46F] disabled:opacity-40 disabled:cursor-not-allowed text-[#0F0F0E] font-bold text-xs px-4 py-2 rounded transition-colors"
                title="Books an immediate consult and opens the staff-guided intake call."
              >
                {bookingNow ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}
                Do Consult Now
              </button>

              <button
                type="button"
                onClick={() => setShowWhosAvailable(v => !v)}
                className="flex items-center gap-2 bg-[#1A1A18] hover:bg-[#2A2A28] border border-[#B8945F]/40 text-[#FAFAF7] font-semibold text-xs px-4 py-2 rounded transition-colors"
                title="Shows each intake staffer's current status."
              >
                <Users className="w-3.5 h-3.5" />
                {showWhosAvailable ? "Hide Who's Available" : "See Who's Available"}
              </button>

              <button
                disabled={!canSchedule}
                onClick={handleSchedule}
                className="flex items-center gap-2 bg-[#1A1A18] hover:bg-[#2A2A28] border border-[#2A2A28] disabled:opacity-40 disabled:cursor-not-allowed text-[#FAFAF7] font-semibold text-xs px-4 py-2 rounded transition-colors"
                title={selection.slotStartIso ? "Books the slot picked in the calendar below." : "Pick a time bubble in the calendar below first."}
              >
                {bookingNow ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                Schedule
              </button>

              <button
                onClick={onClose}
                className="ml-auto flex items-center gap-2 bg-[#2A2A28] hover:bg-[#3A3A36] text-[#FAFAF7] font-semibold text-xs px-3 py-2 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>

            {bookError && (
              <div className="mt-3 text-[11px] text-rose-300 bg-rose-950/30 border border-rose-700/40 rounded px-3 py-1.5">
                <span className="font-semibold">Booking failed:</span> {bookError}
              </div>
            )}
          </section>

          {/* See Who's Available — toggleable read-only roster. */}
          {showWhosAvailable && (
            <StaffAvailabilityList
              staffPool={staffPool}
              calEvents={calEvents}
              currentSessionId={session.id}
              todayLocal={todayLocal}
            />
          )}

          {/* Unified 5-day scheduler */}
          <ConsultSchedulerPanel
            staffPool={staffPool}
            calEvents={calEvents}
            currentSessionId={session.id}
            selection={selection}
            onChangeSelection={setSelection}
            todayLocal={todayLocal}
          />

        </div>
      </div>
    </div>
  );
}

// ─── Consult Intake Modal ─────────────────────────────────────────────────────
// @deprecated Superseded by `StaffGuidedIntake` (src/components/intake-script/
// StaffGuidedIntake.tsx), which wraps the rich BankruptcyIntake form with the
// same scripted call flow this modal pioneered. All launchers in this file
// have been repointed to the new wrapper; this function is retained as dead
// code so the file still type-checks until the follow-up cleanup deletes it.
//
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

function IntakePortalInner({ session, onLogout, onOpenAttorneyReview, onOpenView }: { session: PortalSession; onLogout: () => void; onOpenAttorneyReview?: (leadId: string) => void; onOpenView?: (view: 'messages' | 'staff_comms') => void }) {
  const role      = session.role;
  const isAtty    = isAttorney(role);
  const isSuperAdmin = isSuperAdminRole(role);
  const canManageLeads  = !isAtty || isSuperAdmin; // legal_admin, super_admin, attorney_super_admin
  // canReviewCases was used by the "pending review" chip in the top bar
  // before that chip was removed. Restore here if the chip comes back.
  const canManageStaff  = isSuperAdmin;

  // ─── Employee Time Clock (front-end scaffold) ─────────────────────────────
  //
  // Persisted to sessionStorage keyed by session.id so a reload during the
  // same browser session restores the state. NO DB writes today — real
  // wiring (staff_time_entries table + clock_in/clock_out mutations + week
  // aggregator + OT thresholds) is the planned time-tracking backend.
  //
  // Surfaces driven by this state:
  //   - ForceClockInOverlay: blocks the portal until clockedInAt is set.
  //   - ClockBubble (Employee Time Clock): shows live counters + lunch/break
  //     toggles.
  //   - Idle watcher (below): if no activity for ~15 minutes, warns the user
  //     and then signs them out (which also clears the clock state).
  const TIME_CLOCK_KEY = `time_clock:${session.id}`;
  const [clockState, setClockStateRaw] = useState<TimeClockState>(() => {
    try {
      const raw = sessionStorage.getItem(TIME_CLOCK_KEY);
      if (raw) return JSON.parse(raw) as TimeClockState;
    } catch {/* fall through */}
    return { clockedInAt: null, onLunchSince: null, onBreakSince: null, lunchMinutes: 0, breakMinutes: 0 };
  });
  function setClockState(next: TimeClockState) {
    setClockStateRaw(next);
    try { sessionStorage.setItem(TIME_CLOCK_KEY, JSON.stringify(next)); } catch {/* ignore */}
  }
  function clearClockState() {
    setClockStateRaw({ clockedInAt: null, onLunchSince: null, onBreakSince: null, lunchMinutes: 0, breakMinutes: 0 });
    try { sessionStorage.removeItem(TIME_CLOCK_KEY); } catch {/* ignore */}
  }

  // ─── Idle watcher — warns at 14 min, auto-logout at 15 min ────────────────
  //
  // Only armed while clockedInAt !== null. The user said: "if idle for 15
  // minutes or more — please sign them out and clock out. Must be given a
  // warning." We pop a warning at 14 min with a 60s countdown; if no
  // activity in that window, we clear the clock state and call onLogout().
  const IDLE_WARNING_AT_MS = 14 * 60 * 1000;
  const IDLE_LOGOUT_AT_MS  = 15 * 60 * 1000;
  const lastActivityRef = useRef<number>(Date.now());
  const [idleWarning, setIdleWarning] = useState(false);

  useEffect(() => {
    // Bump activity on any meaningful interaction.
    function bump() {
      lastActivityRef.current = Date.now();
      if (idleWarning) setIdleWarning(false);
    }
    const events: (keyof DocumentEventMap)[] = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    for (const e of events) document.addEventListener(e, bump, { passive: true });
    return () => { for (const e of events) document.removeEventListener(e, bump); };
  }, [idleWarning]);

  useEffect(() => {
    if (clockState.clockedInAt == null) return;
    const tick = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs >= IDLE_LOGOUT_AT_MS) {
        clearClockState();
        onLogout();
      } else if (idleMs >= IDLE_WARNING_AT_MS) {
        setIdleWarning(true);
      }
    }, 15_000);
    return () => clearInterval(tick);
    // We intentionally omit `clearClockState` + `onLogout` from deps — both
    // are stable for the lifetime of the portal session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockState.clockedInAt]);

  // Idle warning overlay — rendered via createPortal so it sits ABOVE
  // every IntakePortalInner return path (presentation, new-lead window,
  // guided intake, selected lead detail, AND the main portal). Previously
  // only the main return mounted the modal, so a staffer in a full-screen
  // flow could be auto-logged-out without seeing the 60s warning + dismiss
  // affordance — losing in-progress work. The auto-logout still only fires
  // AFTER this modal has been on screen for the countdown (the tick loop in
  // the watcher above checks idleMs >= IDLE_LOGOUT_AT_MS independently).
  //
  // Including {idleWarningOverlay} as a sibling in each early-return path
  // is safe even when idleWarning is false (overlay is null and renders
  // nothing). createPortal anchors to document.body so the visual layer is
  // independent of which return path's JSX it sits in.
  const idleWarningOverlay = idleWarning
    ? createPortal(
        <IdleWarningModal
          onStillHere={() => { lastActivityRef.current = Date.now(); setIdleWarning(false); }}
          onLogoutNow={() => { clearClockState(); onLogout(); }}
        />,
        document.body,
      )
    : null;

  const [leads, setLeads]             = useState<Lead[]>([]);
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  // attorney_intake_reviews — used by the simplified attorney portal's
  // Completed Reviews tab (read-only firm-wide history). The fuller
  // portal uses per-lead lookups elsewhere; this list is the at-mount
  // snapshot for the history surface.
  const [attyReviews, setAttyReviews] = useState<IntakeReview[]>([]);
  const [calEvents, setCalEvents]     = useState<CalEvent[]>([]);
  const [availability, setAvailability] = useState<StaffAvailability[]>([]);
  const [timeOff, setTimeOff]         = useState<TimeOff[]>([]);
  const [staffMembers, setStaffMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  // Lead-locking gate — every user-initiated "open lead" path routes through
  // this wrapper so a claimed lead refuses to open in the detail panel.
  // Direct setSelectedLead() calls (e.g. closing the panel, post-create
  // bounces) intentionally bypass — those aren't user-initiated discovery.
  // TODO Phase B: a small "Take it over" affordance when the claim is stale,
  // wired to a claim_lead RPC; until then the gate is silent (no-op).
  function requestOpenLead(lead: Lead) {
    if (isClaimedByOther(lead, session.id)) return;
    setSelectedLead(lead);
  }
  // showNewLead + NewLeadModal kept as DEAD CODE intentionally (Phase A spec).
  // All launchers now route to setNewLeadWindow(true) for the full-window flow.
  const [showNewLead, setShowNewLead] = useState(false);
  const [newLeadWindow, setNewLeadWindow] = useState(false);
  const [presentationContext, setPresentationContext] = useState<{ lead: Lead; acceptance: Acceptance; submission: Record<string, unknown> | null } | null>(null);
  // Staff-guided intake takeover — when set, renders <StaffGuidedIntake> full-screen.
  // Set from (a) the dashboard's To-do "Do intake now" action and (b) the lead detail
  // panel's "Start Intake Now" / "Complete Intake" buttons (previously launched
  // ConsultIntakeModal). On submit the wrapper advances the lead and bounces back.
  const [guidedIntakeLead, setGuidedIntakeLead] = useState<Lead | null>(null);

  // Attorney review mode is the simplified review-only experience (Review
  // Queue + Completed Reviews). Every attorney role lands here by default,
  // including attorney_super_admin — that's how most working attorneys at
  // this firm are configured. Toggling it off (header button below) opens
  // the fuller admin portal for users who also hold admin permissions.
  // Pure non-attorney roles (legal_admin, super_admin, intake, etc.)
  // default to admin mode — the toggle isn't shown to them (attorney
  // review queue isn't theirs to enter).
  const [attorneyReviewMode, setAttorneyReviewMode] = useState<boolean>(isAtty);
  // The user can flip back to admin mode in two cases: (1) they hold
  // admin permissions (canManageLeads || isSuperAdmin), (2) they are an
  // attorney_super_admin (covered by both). This drives whether the
  // toggle button renders in the header.
  const canEnterAdminMode = canManageLeads || isSuperAdmin;

  // Default tab routing follows the mode. Attorneys in review mode land
  // on the Review Queue; everyone else (and any attorney who toggled
  // into admin mode) lands on the Dashboard.
  const defaultTab = attorneyReviewMode ? "followup" : "dashboard";
  // "availability" + "timeoff" were consolidated into "my_schedule"; the
  // union keeps the historical values as safe fallbacks for any external
  // caller passing a stale tab id.
  // "messages" + "staff_tasks" added with the nav rework. "sick_admin" is
  // kept in the union as a fallback target — its nav entry was hidden and
  // the panel moved INSIDE MyScheduleTab, but the standalone render branch
  // still works if anything routes to it programmatically.
  const [activeTab, setActiveTab]     = useState<"dashboard" | "leads" | "followup" | "calendar" | "messages" | "staff_tasks" | "my_schedule" | "availability" | "timeoff" | "sick_admin" | "manual_clients" | "staff_settings" | "department_settings" | "attorney_completed">(defaultTab);
  // Leads tab now contains both the lead table view and the Follow-Up
  // pipeline (FollowUpQueue) as a sub-section. The standalone Follow-Up
  // tab was removed for legal_admin/super_admin; attorneys still see it
  // separately as "Review Queue".
  const [leadsSubTab, setLeadsSubTab] = useState<"leads" | "followup">("leads");

  // Layer 1 (Up Next): skipped task ids live here so they persist across
  // sidebar tab switches for the session. Resets on portal refresh / logout
  // (component unmount) and on next-day rollover (the engine only acts on
  // today's queue anyway). Layer 2 will persist this server-side.
  const [dashboardSkippedIds, setDashboardSkippedIds] = useState<Set<string>>(() => new Set());

  // V1: firm feature flags drive nav visibility (Leads hidden when intake_bot
  // is off; Manual Clients always visible). NewClientModal is gated to roles
  // that pass canAcceptCase per the platform_role mapping.
  const [firmFlags, setFirmFlags] = useState<Record<string, boolean>>({});
  const [showNewClient, setShowNewClient] = useState(false);
  const [manualClients, setManualClients] = useState<Array<{ id: string; name: string; email: string | null; phone: string | null; status: string | null; case_status: string | null; created_at: string }>>([]);
  const platformRole = mapIntakePortalRoleToPlatformRole(session.role);
  const canCreateClient = canAcceptCase(platformRole);
  useEffect(() => {
    getFirmFeatures(V1_DEFAULT_FIRM_ID).then(setFirmFlags).catch(err => {
      console.error("[LegalAdminPortal] getFirmFeatures failed", err);
    });
  }, []);
  const showLeadsTab = firmFlags.intake_bot !== false; // default visible until flags load

  const load = useCallback(async () => {
    setLoading(true);
    const [ls, acs, evts, avail, toff, staff, atr] = await Promise.all([
      sbGet<Lead>("intake_leads?order=created_at.desc&limit=200"),
      sbGet<Acceptance>("attorney_case_acceptances?order=created_at.desc&limit=200"),
      sbGet<CalEvent>("calendar_events?department=eq.intake&order=start_time.asc&limit=300"),
      sbGet<StaffAvailability>("staff_availability?department=eq.intake&order=day_of_week.asc"),
      sbGet<TimeOff>("intake_staff_time_off?order=date.asc&limit=100"),
      sbGet<{ id: string; name: string }>("staff_members?is_active=eq.true&select=id,name&order=name.asc"),
      // attorney_intake_reviews — broad load so the simplified attorney
      // portal's Completed Reviews tab can render its firm-wide history.
      // Filtered client-side to decision IN (accepted, declined) inside
      // buildAttorneyCompletedReviews().
      sbGet<IntakeReview>("attorney_intake_reviews?order=decided_at.desc.nullslast&limit=300"),
    ]);
    setLeads(ls);
    setAcceptances(acs);
    setCalEvents(evts);
    setAvailability(avail);
    setTimeOff(toff);
    setAttyReviews(atr);
    setStaffMembers(staff);
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

  // V1: load manual clients (onboarding_source='manual') for the current
  // pilot firm. Refreshes whenever a new client is created via NewClientModal.
  const loadManualClients = useCallback(async () => {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/clients?onboarding_source=eq.manual&firm_id=eq.${V1_DEFAULT_FIRM_ID}&order=created_at.desc&limit=200&select=id,name,email,phone,status,case_status,created_at`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
    );
    if (r.ok) {
      const rows = await r.json();
      setManualClients(rows.map((c: { id: string; name: string; email: string | null; phone: string | null; status: string | null; case_status: string | null; created_at: string }) => ({ ...c })));
    }
  }, []);
  useEffect(() => { loadManualClients(); }, [loadManualClients]);

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

  // Prompt 88 — today-in-firm-tz buckets for the relabeled stat cards.
  // Both derivations use real columns (intake_leads.created_at +
  // intake_leads.retained_at) and never fabricate a count when the
  // backing data is absent (lead with no retained_at simply doesn't
  // contribute). BAN-84 is the contacted-signal follow-up.
  const todayStrTz_StatRow = todayInFirmTz();
  const leadsToday = leads.filter(l => {
    if (!l.created_at) return false;
    return new Date(l.created_at).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }) === todayStrTz_StatRow;
  }).length;
  const retainedToday = leads.filter(l => {
    if (l.status !== "retained" || !l.retained_at) return false;
    return new Date(l.retained_at).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }) === todayStrTz_StatRow;
  }).length;

  function getAcceptance(leadId: string) {
    return acceptances.find(a => a.lead_id === leadId) ?? null;
  }

  // Full-screen case presentation flow — role-gated via PortalLogin upstream
  //
  // ── MAJ-61 BLOCKING DB ISSUES — needs Dom before these writes work ────────────
  //
  // ISSUE 1 — clientId mismatch:
  //   CaseAcceptanceFlow writes to the `clients` table (.eq("id", clientId)).
  //   `clients` is a SOURCE REPO table (majorslawgroup-intake). It has NO migration in this
  //   repo and does not exist in the destination Supabase project. intake_leads.id is NOT
  //   the same as clients.id — they are separate pipelines with no FK relationship.
  //   Fix options: (a) add a CREATE TABLE migration for `clients` in this repo and link
  //   intake_leads to it, or (b) remap CaseAcceptanceFlow's DB writes to use intake_leads.
  //
  // ISSUE 2 — case_acceptances table missing:
  //   CaseAcceptanceFlow writes to `case_acceptances` (.eq("client_id", clientId)).
  //   This table also does NOT exist in the destination repo — only `attorney_case_acceptances`
  //   exists (keyed by lead_id, not client_id). Source: 20260505234127_create_legal_admin_portal_schema.sql.
  //   Fix options: (a) add a CREATE TABLE migration for `case_acceptances`, or (b) remap
  //   the writes to update attorney_case_acceptances by lead_id instead.
  //
  // Until one of these options is resolved, the presentation UI works (all local state)
  // but the DB persistence steps (step tracking, payment plan save, welcome call) will no-op.
  // ─────────────────────────────────────────────────────────────────────────────────────────

  // ── Clock-in actions exposed to the dashboard ─────────────────────────────
  const clockActions: TimeClockActions = {
    clockIn: () => setClockState({ ...clockState, clockedInAt: Date.now() }),
    clockOut: () => {
      // Ending the workday clears the clock state AND signs out — the next
      // login will land back at the force-clock-in gate.
      clearClockState();
      onLogout();
    },
    startLunch: () => {
      if (clockState.onLunchSince || clockState.onBreakSince) return;
      setClockState({ ...clockState, onLunchSince: Date.now() });
    },
    endLunch: () => {
      if (!clockState.onLunchSince) return;
      const minutes = Math.floor((Date.now() - clockState.onLunchSince) / 60_000);
      setClockState({ ...clockState, onLunchSince: null, lunchMinutes: clockState.lunchMinutes + minutes });
    },
    startBreak: () => {
      if (clockState.onLunchSince || clockState.onBreakSince) return;
      setClockState({ ...clockState, onBreakSince: Date.now() });
    },
    endBreak: () => {
      if (!clockState.onBreakSince) return;
      const minutes = Math.floor((Date.now() - clockState.onBreakSince) / 60_000);
      setClockState({ ...clockState, onBreakSince: null, breakMinutes: clockState.breakMinutes + minutes });
    },
  };

  // ── Force-clock-in gate ───────────────────────────────────────────────────
  // Must be ABOVE every other early-return path — even specialized full-screen
  // flows (selected lead / presentation / new-lead / guided intake) sit behind
  // the clock-in screen. The user can either clock in or sign back out.
  if (clockState.clockedInAt == null) {
    return (
      <ForceClockInOverlay
        session={session}
        onClockIn={clockActions.clockIn}
        onCancel={onLogout}
      />
    );
  }

  if (presentationContext) {
    const { lead: pLead, acceptance: pAcc, submission: pSub } = presentationContext;
    const isBif = pAcc.case_type === "ch7_bifurcated";
    const chapter = String(pAcc.chapter ?? pLead.chapter_interest ?? "7");
    const incomeSources = Array.isArray(pSub?.income_sources_json)
      ? (pSub.income_sources_json as { payFrequency?: string; owner?: string }[])
      : [];
    const debtorSource = incomeSources.find(s => !s.owner || s.owner === "debtor");
    const payFreq = (debtorSource?.payFrequency as string | undefined) || "Bi-Weekly";
    const accData: CaseAcceptanceData = {
      chapter,
      attorney_fee:          pAcc.attorney_fee ?? ATTORNEY_FEES[pAcc.case_type ?? "ch7_regular"] ?? 0,
      filing_fee:            pAcc.court_filing_fee ?? CHAPTER_FILING_FEES[pAcc.case_type ?? "ch7_regular"] ?? 0,
      credit_counseling_fee: CREDIT_COUNSELING_FEE,
      is_bifurcated:         isBif,
      client_pay_frequency:  payFreq,
      acceptance_notes:      pAcc.decision_notes ?? "",
      accepted_by:           pAcc.attorney_name ?? session.name,
    };
    return (
      <>
        <CaseAcceptanceFlow
          clientId={pLead.id}
          clientName={pLead.full_name}
          acceptanceData={accData}
          onCompleted={() => { setPresentationContext(null); load(); }}
          onDefer={() => { setPresentationContext(null); load(); }}
          currentUserRole={mapIntakePortalRoleToPlatformRole(session.role)}
        />
        {idleWarningOverlay}
      </>
    );
  }

  // New-lead logging window — full-screen. Pre-empts the lead detail panel
  // and the leads table for the duration of the new-caller capture.
  if (newLeadWindow) {
    return (
      <>
      <NewLeadInline
        session={session}
        calEvents={calEvents}
        existingLeads={leads}
        onOpenExistingLead={async (leadId) => {
          setNewLeadWindow(false);
          const { data } = await supabase.from("intake_leads").select("*").eq("id", leadId).single();
          if (data) setSelectedLead(data as Lead);
        }}
        onExit={() => setNewLeadWindow(false)}
        onSaved={async (leadId) => {
          setNewLeadWindow(false);
          // Fetch the just-created lead row directly (load() runs in parallel,
          // but its leads array won't be in scope synchronously) so we can
          // bounce into the lead detail panel for the next action.
          const { data } = await supabase.from("intake_leads").select("*").eq("id", leadId).single();
          if (data) setSelectedLead(data as Lead);
          load();
        }}
        onDoIntakeNow={async (leadId) => {
          setNewLeadWindow(false);
          const { data } = await supabase.from("intake_leads").select("*").eq("id", leadId).single();
          if (data) setGuidedIntakeLead(data as Lead);
          load();
        }}
      />
      {idleWarningOverlay}
      </>
    );
  }

  // Staff-guided intake takeover — full-screen. Renders before selectedLead so
  // it pre-empts the lead detail panel for the duration of the intake call.
  if (guidedIntakeLead) {
    return (
      <>
        <StaffGuidedIntake
          lead={guidedIntakeLead}
          session={session}
          onExit={() => setGuidedIntakeLead(null)}
          onSubmitted={(_submissionId) => {
            // Drop into the lead detail panel for the same lead so the staffer
            // can take the next action (send for review, schedule, mark fee
            // quoted, etc.) without re-finding the lead in the queue.
            setSelectedLead(guidedIntakeLead);
            setGuidedIntakeLead(null);
            load();
          }}
        />
        {idleWarningOverlay}
      </>
    );
  }

  if (selectedLead) {
    return (
      <>
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
              onLaunchGuidedIntake={(l) => { setSelectedLead(null); setGuidedIntakeLead(l); }}
              onLaunchPresentation={(lead, acc, sub) => setPresentationContext({ lead, acceptance: acc, submission: sub })}
            />
          </div>
        </div>
        {idleWarningOverlay}
      </>
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

  // Attorney review mode collapses the portal to two tabs — Review Queue +
  // Completed Reviews — for ANY attorney role (attorney or
  // attorney_super_admin). Other admin roles (legal_admin, pure
  // super_admin without attorney) skip this branch. attorney_super_admin
  // toggles back to admin mode via the header button to reach Leads /
  // Calendar / Messages / Settings on demand.
  //
  // Tabs visible per mode:
  // attorneyReviewMode === true:  Review Queue + Completed Reviews ONLY
  // attorneyReviewMode === false: Dashboard, Leads, Calendar, Messages,
  //                               My Tasks, My Schedule, Settings (per
  //                               existing canManageLeads / isSuperAdmin
  //                               sub-gates)
  const TABS = [
    // Dashboard — legal_admin / super_admin only, and only in admin mode.
    ...( canManageLeads && !attorneyReviewMode
      ? [{ id: "dashboard" as const, label: "Dashboard", icon: <ListChecks className="w-3.5 h-3.5" />, badge: null }]
      : []),
    ...( (canManageLeads || isSuperAdmin) && showLeadsTab && !attorneyReviewMode
      ? [{ id: "leads" as const, label: "Leads", icon: <Users className="w-3.5 h-3.5" />, badge: newLeads.length > 0 ? newLeads.length : null }]
      : []),
    // V1 — Manual Clients tab HIDDEN from the inner nav (being replaced later).
    //       The render branch + state are intentionally kept intact so flipping
    //       the gate below back to true restores the tab. Do not delete.
    ...(false
      ? [{ id: "manual_clients" as const, label: "Manual Clients", icon: <UserCheck className="w-3.5 h-3.5" />, badge: manualClients.length > 0 ? manualClients.length : null }]
      : []),
    // Review Queue — surfaces the AttorneyReviewQueue component when an
    // attorney is in review mode. In admin mode it shows the FollowUpQueue
    // (the legal_admin/super_admin pipeline view) — same tab id, different
    // body in the render branch below.
    ...(isAtty
      ? [{ id: "followup" as const, label: "Review Queue", icon: <BellRing className="w-3.5 h-3.5" />, badge: (reviewQueue.length + feeQuotedLeads.length) || null }]
      : []),
    // Completed Reviews — review mode only. Read-only firm-wide history
    // of decided attorney_intake_reviews.
    ...(attorneyReviewMode
      ? [{ id: "attorney_completed" as const, label: "Completed Reviews", icon: <CheckCircle2 className="w-3.5 h-3.5" />, badge: null }]
      : []),
    ...(!attorneyReviewMode
      ? [{ id: "calendar" as const,     label: "Calendar",     icon: <Calendar className="w-3.5 h-3.5" />,  badge: todayConsult.length > 0 ? todayConsult.length : null }]
      : []),
    // Messages — opens the same ConsolidatedMessagingWidget the dashboard
    // mounts, full-width here. Hidden in attorney review mode.
    ...(!attorneyReviewMode
      ? [{ id: "messages" as const,     label: "Messages",     icon: <MessageCircle className="w-3.5 h-3.5" />, badge: null }]
      : []),
    // My Tasks — staff-member task page. Hidden in attorney review mode.
    ...(!attorneyReviewMode
      ? [{ id: "staff_tasks" as const,  label: "My Tasks",     icon: <ListChecks className="w-3.5 h-3.5" />, badge: null }]
      : []),
    // My Schedule consolidates the prior "Availability" + "Time Off" tabs.
    // The Out-of-Office surface (SuperAdminSickPanel) previously had its own
    // nav entry; it now lives INSIDE this tab (super-admin gated).
    // Pending-approval count surfaces as the nav badge so the user notices
    // outstanding requests.
    ...( canManageLeads || isSuperAdmin
      ? [{
          id: "my_schedule" as const,
          label: "My Schedule",
          icon: <Calendar className="w-3.5 h-3.5" />,
          badge: timeOff.filter(t => !t.approved && new Date(t.date) >= new Date()).length || null,
        }]
      : []),
    // Staff Settings + Department Settings — top-level nav entries for
    // super admins (and department supervisors via the role stub). Both
    // tabs were previously only reachable from inside My Schedule; lifting
    // them to the top nav makes them first-class. Department Settings
    // gates IRS standards / exemptions / AI prompts to attorneys w/ super
    // admin or the law firm owner — see DepartmentSettingsPanel.
    ...( isSuperAdmin || canManageStaff
      ? [{ id: "staff_settings" as const,      label: "Staff Settings",      icon: <Shield className="w-3.5 h-3.5" />, badge: null }]
      : []),
    ...( isSuperAdmin || canManageStaff
      ? [{ id: "department_settings" as const, label: "Department Settings", icon: <Shield className="w-3.5 h-3.5" />, badge: null }]
      : []),
    // sick_admin nav entry intentionally removed — the panel is mounted
    // inside MyScheduleTab below for super admins. Render branch retained
    // as a defensive fallback.
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
            {/* Removed from this top bar (now lives elsewhere or has been retired
                for this surface): emergency + pending-review chips, the user
                identity span, and IAmSickButton. The greeting block inside the
                dashboard already personalizes the surface; the chips were
                duplicating the badges already shown on the side-nav tabs. */}
            {canManageLeads && activeTab === "leads" && (
              <button
                onClick={() => setNewLeadWindow(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111111', color: '#FAFAF7', border: 'none', borderRadius: 4, padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background 150ms ease-out' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1E3A2F'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#111111'; }}
              >
                <Plus style={{ width: 14, height: 14, strokeWidth: 1.5 }} /> New Client Lead
              </button>
            )}
            {/* Attorney review / admin mode toggle. Shown only to users
                who can use both surfaces — i.e. attorneys who ALSO hold
                admin permissions (attorney_super_admin / similar). Pure
                attorneys have no admin to switch to; non-attorney admins
                have no review queue to switch to — neither sees this
                button. */}
            {isAtty && canEnterAdminMode && (
              <button
                onClick={() => {
                  const next = !attorneyReviewMode;
                  setAttorneyReviewMode(next);
                  // Route to the mode's natural landing tab so the user
                  // doesn't get stuck on a tab that's now hidden.
                  setActiveTab(next ? "followup" : "dashboard");
                }}
                title={attorneyReviewMode
                  ? "Switch to admin tools (Leads, Calendar, Messages, Settings)"
                  : "Switch back to the attorney review queue"}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1A1A18', color: '#FAFAF7', border: '1px solid #2A2A28', borderRadius: 4, padding: '8px 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background 150ms ease-out' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2A2A28'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1A1A18'; }}
              >
                {attorneyReviewMode ? (
                  <>
                    <Shield style={{ width: 14, height: 14, strokeWidth: 1.5 }} />
                    Admin tools
                    <ArrowRight style={{ width: 12, height: 12, strokeWidth: 1.5 }} />
                  </>
                ) : (
                  <>
                    <ArrowLeft style={{ width: 12, height: 12, strokeWidth: 1.5 }} />
                    Back to review queue
                  </>
                )}
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
        <aside className="hidden lg:flex" style={{ width: 220, flexShrink: 0, borderRight: '1px solid #2A2A28', padding: '24px 0', flexDirection: 'column', gap: 2 }}>
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
        <div className="flex-1 min-w-0 py-6 px-4 lg:px-8">
          <div className="space-y-5">

        {/* Prompt 88 — stat cards row. Hidden on the dashboard tab
            (replaced there by the TopBubbles inside IntakeDashboard).
            "Fee Quoted / Follow-Up" was removed; "Total Leads Received
            Today" + "Retained Today" replace the lifetime totals with
            today-scoped real counts. */}
        {activeTab !== "dashboard" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {[
              // Real — created_at filtered to today (firm tz).
              { label: "Total Leads Received Today", val: leadsToday,          color: "text-slate-300",   icon: <Users className="w-4 h-4" />,       tab: "leads" as const },
              // Real status filter today; BAN-84 will narrow this to
              // "after SMS + email sent" when a contacted_at column
              // (or equivalent contacted signal) lands on intake_leads.
              // TODO BAN-84: precision upgrade once the contacted
              // signal exists.
              { label: "Need Scheduling",            val: newLeads.length,     color: "text-sky-400",     icon: <PhoneMissed className="w-4 h-4" />, tab: "leads" as const },
              { label: "Today Appointments",         val: todayConsult.length, color: "text-teal-400",    icon: <Calendar className="w-4 h-4" />,    tab: "calendar" as const },
              { label: "Pending Atty Review",        val: reviewQueue.length,  color: "text-amber-400",   icon: <Scale className="w-4 h-4" />,       tab: "leads" as const },
              // Real — retained_at + status filter to today. If no lead
              // has retained_at populated yet, this renders 0 (NOT a
              // fabricated number). TODO BAN-84: revisit when the
              // retention-event aggregator lands.
              { label: "Retained Today",             val: retainedToday,       color: "text-emerald-400", icon: <CheckCircle2 className="w-4 h-4" />, tab: "leads" as const },
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
        )}

        {/* Prompt 88 — leads-by-month bar graph. Uses the same `leads`
            array the stat cards do. Annual = 12 months of selected year;
            Monthly = days of selected month. Honest empty state if no
            leads in the period; never fabricated. */}
        {activeTab !== "dashboard" && (
          <LeadsByMonthChart leads={leads} />
        )}

        {/* ── DASHBOARD TAB (legal_admin / super_admin only — attorneys never see this) ── */}
        {activeTab === "dashboard" && (
          <IntakeDashboard
            session={session}
            leads={leads}
            calEvents={calEvents}
            onOpenLead={(l) => requestOpenLead(l)}
            onChangeTab={(t) => setActiveTab(t)}
            onOpenView={onOpenView ?? (() => {})}
            onScheduleConsult={(l) => requestOpenLead(l)}
            onDoIntakeNow={(l) => setGuidedIntakeLead(l)}
            onLogNewLead={() => setNewLeadWindow(true)}
            onRefresh={load}
            skippedIds={dashboardSkippedIds}
            setSkippedIds={setDashboardSkippedIds}
            timeClock={clockState}
            timeClockActions={clockActions}
          />
        )}

        {/* ── LEADS TAB (now contains Leads + Follow-Up sub-views) ── */}
        {activeTab === "leads" && (
          <>
            {/* Sub-nav — Leads (table view) vs Follow-Up (pipeline view).
                Consolidates the former standalone Follow-Up tab. */}
            <div className="flex items-center gap-1 bg-[#0d1221] border border-slate-800 rounded-xl p-1 w-fit">
              {([
                { id: "leads"   as const, label: "Leads",     badge: newLeads.length || null },
                { id: "followup" as const, label: "Follow-Up", badge: followUpBadge          },
              ]).map(s => {
                const isActive = leadsSubTab === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setLeadsSubTab(s.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      isActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {s.label}
                    {s.badge != null && s.badge > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isActive ? "bg-slate-700 text-slate-100" : "bg-slate-800 text-slate-400"
                      }`}>
                        {s.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {leadsSubTab === "followup" ? (
              <FollowUpQueue leads={leads} currentSessionId={session.id} onSelect={l => {
                if (l.status === "sent_for_attorney_review" && l.submission_id && onOpenAttorneyReview) {
                  onOpenAttorneyReview(l.id);
                } else {
                  requestOpenLead(l);
                }
              }} />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
                <div className="space-y-5">
            {emergencies.length > 0 && (
              <div className="bg-red-500/8 border border-red-500/25 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <p className="text-sm font-bold text-red-400">Emergency Leads — Immediate Attention Required</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {emergencies.map(l => {
                    const locked = isClaimedByOther(l, session.id);
                    return (
                      <button
                        key={l.id}
                        onClick={() => requestOpenLead(l)}
                        disabled={locked}
                        aria-disabled={locked}
                        className={`flex items-center gap-2 border rounded-xl px-3 py-2 transition-colors text-xs ${
                          locked
                            ? "bg-slate-800/30 border-slate-700/40 cursor-not-allowed opacity-60"
                            : "bg-red-500/10 hover:bg-red-500/20 border-red-500/30"
                        }`}
                      >
                        <Flag className={`w-3 h-3 ${locked ? "text-slate-500" : "text-red-400"}`} />
                        <span className={`font-semibold ${locked ? "text-slate-300" : "text-red-200"}`}>{l.full_name}</span>
                        {l.phone && <span className={locked ? "text-slate-500" : "text-red-400"}>{l.phone}</span>}
                        <LeadClaimBadge lead={l} currentSessionId={session.id} size="xs" />
                        {!locked && <ChevronRight className="w-3 h-3 text-red-600" />}
                      </button>
                    );
                  })}
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
                  {reviewQueue.map(l => {
                    const locked = isClaimedByOther(l, session.id);
                    return (
                      <button
                        key={l.id}
                        onClick={() => requestOpenLead(l)}
                        disabled={locked}
                        aria-disabled={locked}
                        className={`flex items-center gap-2 border rounded-xl px-3 py-2 transition-colors text-xs ${
                          locked
                            ? "bg-slate-800/30 border-slate-700/40 cursor-not-allowed opacity-60"
                            : "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30"
                        }`}
                      >
                        <UserCheck className={`w-3 h-3 ${locked ? "text-slate-500" : "text-amber-400"}`} />
                        <span className={`font-semibold ${locked ? "text-slate-300" : "text-amber-200"}`}>{l.full_name}</span>
                        {l.chapter_interest && <span className={locked ? "text-slate-500" : "text-amber-500"}>Ch. {l.chapter_interest}</span>}
                        {l.sent_for_review_at && <span className={locked ? "text-slate-600" : "text-amber-600"}>{timeAgo(l.sent_for_review_at)}</span>}
                        <LeadClaimBadge lead={l} currentSessionId={session.id} size="xs" />
                        {!locked && <ChevronRight className="w-3 h-3 text-amber-600" />}
                      </button>
                    );
                  })}
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
                <button onClick={() => setNewLeadWindow(true)} className="mt-4 flex items-center gap-2 mx-auto text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl transition-colors">
                  <Plus className="w-3.5 h-3.5" /> New Client Lead
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
                        const locked = isClaimedByOther(lead, session.id);
                        return (
                          <tr
                            key={lead.id}
                            onClick={() => { if (!locked) requestOpenLead(lead); }}
                            className={`transition-colors ${
                              locked
                                ? "opacity-60 cursor-not-allowed"
                                : "hover:bg-slate-800/30 cursor-pointer"
                            }`}
                            aria-disabled={locked}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-slate-700/60 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">{lead.full_name.charAt(0)}</div>
                                <div>
                                  <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                                    {lead.full_name}
                                    {lead.ai_scheduled && <Bot className="w-3 h-3 text-sky-400 flex-shrink-0" />}
                                    <LeadClaimBadge lead={lead} currentSessionId={session.id} size="xs" />
                                  </p>
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
                </div>
                {/* Right column — metrics + chronological submissions list. */}
                <aside className="space-y-4">
                  <LeadsMetricsPanel leads={leads} />
                  <LeadsByDateColumn leads={leads} currentSessionId={session.id} onSelect={(l) => requestOpenLead(l)} />
                </aside>
              </div>
            )}
          </>
        )}

        {/* ── COMPLETED REVIEWS TAB (attorney review mode — read-only history) ── */}
        {activeTab === "attorney_completed" && attorneyReviewMode && (
          <AttorneyCompletedReviews
            // Local IntakeReview lacks `updated_at` in its TS surface (it
            // does exist on the DB row); shared AttorneyIntakeReviewRow
            // requires it. Cast widens structurally — buildAttorney-
            // CompletedReviews never reads updated_at, only decided_at +
            // created_at, so this is safe.
            attorneyIntakeReviews={attyReviews as unknown as Parameters<typeof AttorneyCompletedReviews>[0]["attorneyIntakeReviews"]}
            intakeLeads={leads}
            acceptances={acceptances}
          />
        )}

        {/* ── FOLLOW-UP TAB (Review Queue for attorneys in review mode;
             FollowUpQueue otherwise — see attorneyReviewMode state) ── */}
        {activeTab === "followup" && (
          attorneyReviewMode
            ? <AttorneyReviewQueue leads={leads} acceptances={acceptances} onSelect={l => {
                // Sent for attorney review + has linked submission → route to
                // AttorneyIntakeDashboard (canonical attorney review surface).
                // Leads without a submission_id fall back to LegalAdminPortal's
                // LeadDetailPanel — interim until paired-row seeding is fixed.
                if (l.status === 'sent_for_attorney_review' && l.submission_id && onOpenAttorneyReview) {
                  onOpenAttorneyReview(l.id);
                } else {
                  requestOpenLead(l);
                }
              }} />
            : <FollowUpQueue leads={leads} currentSessionId={session.id} onSelect={l => {
                // LAWYER-GATED: routing to AttorneyIntakeDashboard would
                // surface the consolidated attorney review to a non-lawyer.
                // Non-lawyers always fall back to LeadDetailPanel (which
                // itself gates the modal mount on isLawyer).
                if (
                  l.status === 'sent_for_attorney_review'
                  && l.submission_id
                  && onOpenAttorneyReview
                  && isLawyer(role)
                ) {
                  onOpenAttorneyReview(l.id);
                } else {
                  requestOpenLead(l);
                }
              }} />
        )}

        {/* ── CALENDAR TAB ── */}
        {activeTab === "calendar" && (
          <CalendarTab events={calEvents} leads={leads} timeOff={timeOff} availability={availability} staffMembers={staffMembers} onRefresh={load} />
        )}

        {/* ── MY SCHEDULE TAB (consolidates Availability + Time Off; also
              mounts the super-admin Out-of-Office panel after the nav
              rework hid that standalone entry) ── */}
        {activeTab === "my_schedule" && (
          <MyScheduleTab
            session={session}
            timeOff={timeOff}
            availability={availability}
            canEdit={isSuperAdmin}
            onRefresh={load}
            isSuperAdmin={isSuperAdmin}
          />
        )}

        {/* ── MESSAGES TAB ── opens the same tabbed Messaging panel the
              dashboard widget uses, full-width here. */}
        {activeTab === "messages" && (
          <MessagingTabView session={session} onOpenView={onOpenView ?? (() => {})} />
        )}

        {/* ── MY TASKS TAB ── per-staffer task page (resolved + outstanding).
              Also reachable from the dashboard's AllTasksWidget header link. */}
        {activeTab === "staff_tasks" && (
          <StaffMemberTasksPage
            session={session}
            leads={leads}
            onOpenLead={(l) => requestOpenLead(l)}
          />
        )}

        {/* ── STAFF SETTINGS TAB ── top-level nav entry (was previously only
              reachable from inside My Schedule). Department supervisors see
              their own department; super admins see all departments. */}
        {activeTab === "staff_settings" && (isSuperAdmin || canManageStaff) && (() => {
          const staffViewer = deriveStaffSettingsViewer(isSuperAdmin);
          if (staffViewer.role === "none") return null;
          return (
            <div className="rounded-2xl border border-slate-800 bg-[#0d1221] p-5">
              <StaffSettingsPanel
                viewerStaffRole={staffViewer.role as StaffSettingsViewerRole}
                viewerDepartment={staffViewer.department}
              />
            </div>
          );
        })()}

        {/* ── DEPARTMENT SETTINGS TAB ── intake-form copy overrides + IRS
              auto-fill toggle + role-gated IRS/exemption/AI-prompt edits.
              Edits to standards / exemptions / prompts are restricted to
              attorneys w/ super admin or the law firm owner. Every save
              notifies the law firm owner (stubbed in the panel). */}
        {activeTab === "department_settings" && (isSuperAdmin || canManageStaff) && (() => {
          // Map the existing supervisor stub into the DepartmentSettings
          // viewer role union. The "attorney_super_admin" + "law_firm_owner"
          // branches gate the lock-icon sections. Real role binding lands
          // when auth gives us the firm-owner flag.
          const staffViewer = deriveStaffSettingsViewer(isSuperAdmin);
          // TODO Phase B — read role from auth context. For today, derive
          // the most-privileged role this user could plausibly have:
          //   - isLawyer(role) && isSuperAdmin → "attorney_super_admin"
          //   - non-lawyer super_admin        → "super_admin"
          //   - department supervisor         → "department_supervisor"
          const deptRole: DepartmentSettingsViewerRole =
            isLawyer(role) && isSuperAdmin ? "attorney_super_admin" :
            isSuperAdmin ? "super_admin" :
            staffViewer.role === "department_supervisor" ? "department_supervisor" :
            "none";
          if (deptRole === "none") return null;
          return (
            <div className="rounded-2xl border border-slate-800 bg-[#0d1221] p-5">
              <DepartmentSettingsPanel
                viewerStaffRole={deptRole}
                viewerDepartment={staffViewer.department}
                initialEnableIrsAutoFill={true}
              />
            </div>
          );
        })()}

        {/* ── OUT-OF-OFFICE ADMIN TAB ── */}
        {activeTab === "sick_admin" && isSuperAdmin && (
          <SuperAdminSickPanel onRefresh={load} />
        )}

        {/* ── MANUAL CLIENTS TAB (V1) ── */}
        {activeTab === "manual_clients" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-bold text-white">Manual Clients</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Already-accepted clients onboarded outside the AI intake bot. Each gets a magic-link portal URL.
                </p>
              </div>
              {canCreateClient && (
                <button
                  onClick={() => setShowNewClient(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> New Client
                </button>
              )}
            </div>
            {manualClients.length === 0 ? (
              <div className="bg-[#0d1221] border border-slate-800 rounded-2xl py-12 text-center">
                <Users className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No manually-onboarded clients yet.</p>
                {canCreateClient && (
                  <p className="text-[11px] text-slate-700 mt-1">
                    Click <span className="text-amber-400 font-semibold">+ New Client</span> to onboard one.
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-[#0d1221] border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <th className="text-left px-5 py-3">Client</th>
                      <th className="text-left px-4 py-3">Contact</th>
                      <th className="text-left px-4 py-3">Case status</th>
                      <th className="text-left px-4 py-3">Onboarded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {manualClients.map(c => (
                      <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3">
                          <p className="text-sm font-semibold text-white">{c.name}</p>
                        </td>
                        <td className="px-4 py-3">
                          {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                          {c.phone && <p className="text-[10px] text-slate-600">{c.phone}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {c.case_status ?? c.status ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(c.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

          {/* Spacer so fixed mobile nav doesn't overlap last content item */}
          <div className="lg:hidden h-16" />
          </div>{/* end space-y-5 */}
        </div>{/* end main content */}
      </div>{/* end body flex */}

      {/* Mobile bottom nav — hidden on lg+, horizontal scroll, scrollbar hidden */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex overflow-x-auto scrollbar-hide"
        style={{ background: '#0F0F0E', borderTop: '1px solid #2A2A28' }}
      >
        {TABS.map(t => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                flex: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '10px 8px',
                minWidth: 60,
                background: 'transparent',
                border: 'none',
                borderTop: isActive ? '2px solid #1E3A2F' : '2px solid transparent',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <span style={{ color: isActive ? '#FAFAF7' : '#6B6B66' }}>{t.icon}</span>
              <span style={{ fontSize: 10, fontWeight: isActive ? 500 : 400, color: isActive ? '#FAFAF7' : '#6B6B66', whiteSpace: 'nowrap', fontFamily: "'Inter', system-ui, sans-serif" }}>
                {t.label}
              </span>
              {t.badge != null && (
                <span style={{ position: 'absolute', top: 6, right: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#FAFAF7', background: '#B45309', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {showNewLead && (
        <NewLeadModal
          onClose={() => setShowNewLead(false)}
          onSaved={() => { setShowNewLead(false); load(); }}
          session={session}
        />
      )}

      {showNewClient && (
        <NewClientModal
          firmId={V1_DEFAULT_FIRM_ID}
          firmName="Majors Law Group"
          onClose={() => setShowNewClient(false)}
          onCreated={() => { setShowNewClient(false); loadManualClients(); }}
        />
      )}

      {/* Floating chat — small bubble that follows the staffer across the
          main portal views (dashboard / leads / calendar / etc). Specialized
          full-screen flows (presentation / new lead / guided intake / lead
          detail) sit above this return so they don't see it. */}
      <FloatingChat
        currentSessionId={session.id}
        onOpenMessagingPanel={onOpenView ?? (() => {})}
      />

      {/* Idle warning — uses the same {idleWarningOverlay} variable that the
          full-screen flows (presentation / new lead / guided intake /
          selected lead) include, so the 14-min warning + 60s countdown +
          "I'm here" dismiss reach the staffer on every screen now. The
          overlay itself is a createPortal anchor (see IntakePortalInner). */}
      {idleWarningOverlay}
    </div>
  );
}

// ─── Export with login gate ───────────────────────────────────────────────────

export default function LegalAdminPortal({
  onOpenAttorneyReview,
  onOpenView,
}: {
  onOpenAttorneyReview?: (leadId: string) => void;
  onOpenView?: (view: 'messages' | 'staff_comms') => void;
} = {}) {
  const [session, setSession] = useState<PortalSession | null>(null);

  if (!session) {
    return <PortalLogin onLogin={s => {
      // Persist the logged-in staffer's display name to sessionStorage so
      // OTHER portal surfaces (AttorneyIntakeDashboard greeting,
      // AttorneyTaskPanel task query, etc.) read the SAME identity. The
      // surfaces consume this via lib/currentAttorney.ts → getCurrentAttorneyName().
      // Was the source of the "Sarah Kim logs in but Attorney Review shows
      // Jennifer Smith" mismatch: the dashboard was reading the env-var
      // default because nothing was lifting the session out of this
      // component's local state.
      setCurrentAttorneyName(s.name);
      setSession(s);
    }} />;
  }

  return (
    <IntakePortalInner
      session={session}
      onLogout={() => {
        clearCurrentAttorneyName();
        setSession(null);
      }}
      onOpenAttorneyReview={onOpenAttorneyReview}
      onOpenView={onOpenView}
    />
  );
}
