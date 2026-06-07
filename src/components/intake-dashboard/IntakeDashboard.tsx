// Intake Portal (Staff) — Dashboard view.
//
// Default landing for legal_admin / super_admin roles inside IntakePortalInner.
// Attorneys do NOT receive this view — handled by the role gate in
// LegalAdminPortal.tsx where the Dashboard tab and the defaultTab branch are
// scoped to non-attorneys.
//
// Four widgets in a responsive grid:
//   (1) Today's Work          — REAL. Two sections: "Coming up" (consults) +
//                                "To do" (call/case queue) with an "Up Next"
//                                suggestion card (Layer 1 Next Task engine).
//   (2) Shared Email Inbox    — UI-COMPLETE on SAMPLE data (Graph shape).
//   (3) Messaging             — REAL. client_message_threads + staff_messages.
//   (4) Phone + Voicemail     — UI-COMPLETE on SAMPLE data (Twilio Voice shape).
//
// TODO templating pass: every relative-time / day-of-week calc here hardcodes
// the America/Los_Angeles tz. Make this America/Phoenix-aware (or read from
// firms.timezone) when the firm-aware foundation lands.
//
// TODO Layer 2 (Next Task engine): real start/finish time-tracking, overrun
// detection, live mid-task recompute, work-order logging, and the office-wide
// productivity rollup (staff_productivity_log is sitting there waiting).
// The case-presentation tier — currently named TIER_NEW_CALL to make room —
// will get its own lead-state filter at that time.

import { useEffect, useMemo, useState } from "react";
import {
  Calendar, CheckCircle2, ChevronRight, Clock, Inbox, MessageCircle,
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Reply,
  UserCheck, Users, Voicemail, ListChecks, Mail, Delete,
  AlertCircle, Sparkles, ClipboardList, BellRing, X,
} from "lucide-react";

// ─── Types (kept local to avoid coupling to LegalAdminPortal) ────────────────

interface PortalSession {
  id: string;
  name: string;
  role: string;
  title: string | null;
}

interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  assigned_name: string | null;
  urgency: string | null;
  preferred_contact: string | null;
  follow_up_queue: string | null;
  created_at: string;
  consultation_date: string | null;
  chapter_interest: number | null;
  submission_id?: string | null;
}

interface CalEvent {
  id: string;
  start_time: string;
  end_time: string;
  staff_id: string | null;
  lead_id: string | null;
  client_name: string;
  title: string;
  event_subtype: string;
  status: string;
  department: string;
}

type TabId =
  | "dashboard" | "leads" | "followup" | "calendar"
  | "availability" | "timeoff" | "sick_admin" | "manual_clients";

interface ApptRow {
  id: string;
  start_time: string;
  end_time: string;
  client_name: string;
  chapter: number | null;
}

type ToDoTier = "emergency" | "new" | "followup";
interface ToDoRow { lead: Lead; tier: ToDoTier; }

// Layer 1 — what "Up Next" returns.
type NextTask =
  | { kind: "appointment";    appt: ApptRow; minutesUntilStart: number; isInProgress: boolean }
  | { kind: "lead-emergency"; lead: Lead }
  | { kind: "lead-new";       lead: Lead }
  | { kind: "lead-followup";  lead: Lead }
  | { kind: "none" };

interface ClientMessageThread {
  id: string;
  client_id: string;
  unread_count: number;
  last_message_at: string | null;
  updated_at: string;
}

interface ClientMessage {
  id: string;
  thread_id: string;
  body: string;
  channel: string;
  sender_role: string;
  sender_name: string;
  created_at: string;
}

interface StaffMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string | null;
  channel: "email" | "sms" | "phone_note" | "dm";
  subject: string | null;
  body: string;
  read: boolean;
  created_at: string;
}

// ─── Supabase REST helpers (match LegalAdminPortal's sbGet/sbPatch pattern) ──

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  "Content-Type": "application/json",
};

async function sbGet<T>(path: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  return r.ok ? r.json() : [];
}

async function sbPost(table: string, body: object): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

async function sbPatch(table: string, id: string, body: object): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

// ─── Constants ───────────────────────────────────────────────────────────────

// TODO templating pass: read firm timezone from firms.timezone instead of hardcoded LA.
const FIRM_TZ = "America/Los_Angeles";

// Layer 1 — Next Task engine.
const IMMINENT_APPT_WINDOW_MIN = 15;
const NEXT_TASK_TICK_MS = 60_000;

// Priority tier ranks (lower = higher). Kept as named constants so case
// presentations can slot in alongside new calls in Layer 2 without a rename.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TIER_APPOINTMENT = 0;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TIER_EMERGENCY   = 1;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TIER_NEW_CALL    = 2;  // includes case presentations once that bucket exists
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TIER_FOLLOWUP    = 3;

const URGENCY_RANK: Record<string, number> = { emergency: 0, urgent: 1, normal: 2 };
const TIER_RANK:    Record<ToDoTier, number> = { emergency: 0, new: 1, followup: 2 };

// ─── Time / format helpers ──────────────────────────────────────────────────

function todayInFirmTz(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: FIRM_TZ });
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: FIRM_TZ });
}

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: FIRM_TZ,
  });
}

function formatTimeRange(startIso: string, endIso: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: FIRM_TZ,
  };
  const startStr = new Date(startIso).toLocaleTimeString("en-US", opts);
  const endStr = new Date(endIso).toLocaleTimeString("en-US", opts);
  const startMatch = startStr.match(/^(.+)\s(AM|PM)$/);
  const endMatch = endStr.match(/^(.+)\s(AM|PM)$/);
  if (!startMatch || !endMatch) return `${startStr}–${endStr}`;
  const [, startTime, startPer] = startMatch;
  const [, endTime, endPer] = endMatch;
  if (startPer === endPer) return `${startTime}–${endTime} ${endPer}`;
  return `${startTime} ${startPer}–${endTime} ${endPer}`;
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Sample data — Widget 2 (Microsoft Graph message shape) ─────────────────

interface SampleEmail {
  id: string;
  from: { name: string; address: string };
  subject: string;
  receivedDateTime: string;
  bodyPreview: string;
  isRead: boolean;
  assignee: string | null;
  status: "unhandled" | "in_progress" | "handled";
}

const SAMPLE_EMAILS: SampleEmail[] = [
  { id: "m1", from: { name: "Sarah Mitchell",    address: "smitchell@gmail.com"   }, subject: "Question about Chapter 7 eligibility",  receivedDateTime: new Date(Date.now() - 35   * 60_000).toISOString(), bodyPreview: "Hi — my husband and I are considering filing bankruptcy. We both work full time but the medical debt is overwhelming. Could we talk through what Chapter 7 would look like?", isRead: false, assignee: null,           status: "unhandled"  },
  { id: "m2", from: { name: "James Park",        address: "jpark@outlook.com"     }, subject: "Re: Consultation appointment",          receivedDateTime: new Date(Date.now() - 95   * 60_000).toISOString(), bodyPreview: "Thanks for the confirmation. Can we reschedule to Friday afternoon? Something came up at work for Thursday.",                                                                       isRead: true,  assignee: "Lisa Chen",    status: "in_progress" },
  { id: "m3", from: { name: "Maria Gonzalez",    address: "mgonzalez@yahoo.com"   }, subject: "Documents requested",                   receivedDateTime: new Date(Date.now() - 3    * 3_600_000).toISOString(), bodyPreview: "Attached are the pay stubs and bank statements you requested. Let me know if you need anything else.",                                                                          isRead: true,  assignee: "Lisa Chen",    status: "handled"    },
  { id: "m4", from: { name: "Robert Henderson",  address: "rhenderson@aol.com"    }, subject: "Wage garnishment — urgent",             receivedDateTime: new Date(Date.now() - 11   * 3_600_000).toISOString(), bodyPreview: "My employer just notified me that wage garnishment starts next week. I need to know my options ASAP. Can someone call me today?",                                                       isRead: false, assignee: null,           status: "unhandled"  },
  { id: "m5", from: { name: "Angela Thompson",   address: "athompson@gmail.com"   }, subject: "Fee breakdown",                          receivedDateTime: new Date(Date.now() - 16   * 3_600_000).toISOString(), bodyPreview: "Can you send me the breakdown of the attorney fee vs filing fee one more time? My spouse wants to see it before we sign.",                                                         isRead: true,  assignee: null,           status: "unhandled"  },
  { id: "m6", from: { name: "David Liu",         address: "dliu@hotmail.com"      }, subject: "New client inquiry — referral",          receivedDateTime: new Date(Date.now() - 22   * 3_600_000).toISOString(), bodyPreview: "I was referred by my friend Carlos Vega. I would like to schedule a consultation about Chapter 13.",                                                                                  isRead: true,  assignee: "Marcus Brown", status: "in_progress" },
];

// ─── Sample data — Widget 4 (Twilio Voice shape) ─────────────────────────────

interface SampleCall {
  id: string;
  direction: "inbound" | "outbound";
  number: string;
  contactName: string | null;
  leadOrClientId: string | null;
  time: string;
  durationSeconds: number;
  status: "completed" | "missed" | "voicemail";
  recordingUrl: string | null;
  isVoicemail: boolean;
  listened: boolean;
}

const SAMPLE_CALLS: SampleCall[] = [
  { id: "c1", direction: "inbound",  number: "(312) 555-0411", contactName: "Carlos Vega",      leadOrClientId: null, time: new Date(Date.now() - 18  * 60_000).toISOString(),   durationSeconds: 0,   status: "missed",    recordingUrl: null,                                                isVoicemail: false, listened: false },
  { id: "c2", direction: "inbound",  number: "(602) 555-0187", contactName: "Angela Ruiz",      leadOrClientId: null, time: new Date(Date.now() - 42  * 60_000).toISOString(),   durationSeconds: 47,  status: "voicemail", recordingUrl: "https://api.twilio.com/recordings/RE-sample-1.mp3", isVoicemail: true,  listened: false },
  { id: "c3", direction: "outbound", number: "(206) 555-0721", contactName: "Robert Osei",     leadOrClientId: null, time: new Date(Date.now() - 70  * 60_000).toISOString(),   durationSeconds: 312, status: "completed", recordingUrl: null,                                                isVoicemail: false, listened: false },
  { id: "c4", direction: "inbound",  number: "(214) 555-0376", contactName: "Brenda Castillo",  leadOrClientId: null, time: new Date(Date.now() - 4   * 3_600_000).toISOString(), durationSeconds: 188, status: "completed", recordingUrl: null,                                                isVoicemail: false, listened: true  },
  { id: "c5", direction: "outbound", number: "(312) 555-0512", contactName: "James Holloway",  leadOrClientId: null, time: new Date(Date.now() - 7   * 3_600_000).toISOString(), durationSeconds: 0,   status: "missed",    recordingUrl: null,                                                isVoicemail: false, listened: false },
  { id: "c6", direction: "inbound",  number: "(214) 555-0849", contactName: "Diane Kowalski",   leadOrClientId: null, time: new Date(Date.now() - 19  * 3_600_000).toISOString(), durationSeconds: 72,  status: "voicemail", recordingUrl: "https://api.twilio.com/recordings/RE-sample-2.mp3", isVoicemail: true,  listened: true  },
];

// ─── Common card chrome (matches IntakePortalInner's neutral dark look) ─────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[#2A2A28] bg-[#1A1A18] ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({
  icon, title, badge, chip,
}: { icon: React.ReactNode; title: string; badge?: React.ReactNode; chip?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2A2A28]">
      <span className="text-[#B8945F]">{icon}</span>
      <h3 className="text-sm font-semibold text-[#FAFAF7]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        {title}
      </h3>
      {badge}
      {chip && <div className="ml-auto">{chip}</div>}
    </div>
  );
}

function CountBadge({ value, tone = "neutral" }: { value: number; tone?: "neutral" | "warn" | "danger" }) {
  if (value <= 0) return null;
  const cls =
    tone === "danger" ? "bg-red-900/40 text-red-300 border-red-700/60" :
    tone === "warn"   ? "bg-amber-900/30 text-amber-300 border-amber-700/60" :
                         "bg-[#2A2A28] text-[#FAFAF7] border-[#3A3A36]";
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>{value}</span>
  );
}

function SampleChip() {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#B8945F] border border-[#B8945F]/40 px-2 py-0.5 rounded">
      Sample — not yet connected
    </span>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface IntakeDashboardProps {
  session: PortalSession;
  leads: Lead[];
  calEvents: CalEvent[];
  // Layer 1 — skipped task ids lifted to parent so they survive tab switches.
  skippedIds: Set<string>;
  setSkippedIds: (s: Set<string>) => void;
  // Existing parent callbacks.
  onOpenLead: (lead: Lead) => void;
  onChangeTab: (tab: TabId) => void;
  onOpenView: (view: "messages" | "staff_comms") => void;
  // Today's Work primary actions.
  onScheduleConsult: (lead: Lead) => void;
  onDoIntakeNow: (lead: Lead) => void;
  /** Launch the full-window new-lead logging flow (NewLeadInline). */
  onLogNewLead?: () => void;
  onRefresh: () => void;
}

export default function IntakeDashboard({
  session, leads, calEvents,
  skippedIds, setSkippedIds,
  onOpenLead: _onOpenLead,
  onChangeTab, onOpenView,
  onScheduleConsult, onDoIntakeNow, onLogNewLead, onRefresh,
}: IntakeDashboardProps) {
  const todayLocal = useMemo(() => todayInFirmTz(), []);

  // ── Layer 1 — wall-clock tick for Up Next recompute ───────────────────────
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(Date.now()), NEXT_TASK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // ── Appointments — this staffer's intake consultations (derived) ──────────
  const { todaysAppts, upcomingAppts } = useMemo(() => {
    const leadById = new Map(leads.map(l => [l.id, l]));
    const all = calEvents
      .filter(e => {
        if (e.event_subtype !== "consultation") return false;
        if (["cancelled", "no_show", "rescheduled"].includes(e.status)) return false;
        if (e.staff_id !== session.id) return false;
        return true;
      })
      .map(e => ({
        id: e.id,
        start_time: e.start_time,
        end_time: e.end_time,
        client_name: e.client_name || e.title || "—",
        chapter: e.lead_id ? leadById.get(e.lead_id)?.chapter_interest ?? null : null,
      }))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    const today: ApptRow[] = [];
    const upcoming: ApptRow[] = [];
    const now = Date.now();
    for (const a of all) {
      const d = new Date(a.start_time).toLocaleDateString("en-CA", { timeZone: FIRM_TZ });
      if (d === todayLocal) today.push(a);
      else if (new Date(a.start_time).getTime() > now) upcoming.push(a);
    }
    return { todaysAppts: today, upcomingAppts: upcoming };
  }, [calEvents, leads, todayLocal, session.id]);

  // ── To-do queue — emergencies + new calls + follow-ups, this staffer's ────
  const toDoQueue: ToDoRow[] = useMemo(() => {
    const matchesStaff = (l: Lead) => !l.assigned_name || l.assigned_name === session.name;

    const emergencies = leads.filter(l => l.urgency === "emergency" && matchesStaff(l));
    const emergencyIds = new Set(emergencies.map(l => l.id));

    const newCalls = leads.filter(l =>
      !emergencyIds.has(l.id) &&
      (l.status === "new" || l.follow_up_queue === "priority") &&
      matchesStaff(l)
    );
    const followUps = leads.filter(l =>
      !emergencyIds.has(l.id) &&
      l.status === "fee_quoted" &&
      matchesStaff(l)
    );

    const rows: ToDoRow[] = [
      ...emergencies.map(lead => ({ lead, tier: "emergency" as const })),
      ...newCalls.map(lead => ({ lead, tier: "new" as const })),
      ...followUps.map(lead => ({ lead, tier: "followup" as const })),
    ];
    rows.sort((a, b) => {
      if (TIER_RANK[a.tier] !== TIER_RANK[b.tier]) return TIER_RANK[a.tier] - TIER_RANK[b.tier];
      const ua = URGENCY_RANK[a.lead.urgency ?? "normal"] ?? 2;
      const ub = URGENCY_RANK[b.lead.urgency ?? "normal"] ?? 2;
      if (ua !== ub) return ua - ub;
      return new Date(a.lead.created_at).getTime() - new Date(b.lead.created_at).getTime();
    });
    return rows.slice(0, 12);
  }, [leads, session.name]);

  // ── Layer 1 — Up Next computation ─────────────────────────────────────────
  const [manuallyChosenId, setManuallyChosenId] = useState<string | null>(null);
  // Single source of truth for which queue row's log-result panel is open.
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const nextTask: NextTask = useMemo(() => {
    // 1. Manual override
    if (manuallyChosenId) {
      const r = toDoQueue.find(x => x.lead.id === manuallyChosenId);
      if (r) {
        const k = r.tier === "emergency" ? "lead-emergency"
                : r.tier === "new"       ? "lead-new"
                :                          "lead-followup";
        return { kind: k, lead: r.lead };
      }
    }

    // 2. Imminent / in-progress appointment (today only)
    const nowMs = currentTime;
    const imminent = todaysAppts
      .map(a => {
        const startMs = new Date(a.start_time).getTime();
        const endMs   = new Date(a.end_time).getTime();
        const minsUntilStart = (startMs - nowMs) / 60_000;
        const isInProgress = nowMs >= startMs && nowMs < endMs;
        const startingSoon = minsUntilStart > 0 && minsUntilStart <= IMMINENT_APPT_WINDOW_MIN;
        return { a, startMs, minsUntilStart, isInProgress, qualifies: isInProgress || startingSoon };
      })
      .filter(x => x.qualifies)
      .sort((x, y) => x.startMs - y.startMs);
    if (imminent.length > 0) {
      const top = imminent[0];
      return {
        kind: "appointment",
        appt: top.a,
        minutesUntilStart: Math.max(0, Math.round(top.minsUntilStart)),
        isInProgress: top.isInProgress,
      };
    }

    // 3. Emergency lead — NEVER honors the skip set
    const emergencyRow = toDoQueue.find(r => r.tier === "emergency");
    if (emergencyRow) return { kind: "lead-emergency", lead: emergencyRow.lead };

    // 4. Tier 1 — new call (honors skip set)
    const newRow = toDoQueue.find(r => r.tier === "new" && !skippedIds.has(r.lead.id));
    if (newRow) return { kind: "lead-new", lead: newRow.lead };

    // 5. Tier 2 — follow-up (honors skip set)
    const followupRow = toDoQueue.find(r => r.tier === "followup" && !skippedIds.has(r.lead.id));
    if (followupRow) return { kind: "lead-followup", lead: followupRow.lead };

    return { kind: "none" };
  }, [todaysAppts, toDoQueue, skippedIds, manuallyChosenId, currentTime]);

  // ── Widget 3 — client messaging + staff DMs (REAL) ────────────────────────
  const [clientThreads, setClientThreads] = useState<(ClientMessageThread & { client_name?: string; preview?: string })[]>([]);
  const [staffMsgs, setStaffMsgs] = useState<StaffMessage[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [threads, dms] = await Promise.all([
        sbGet<ClientMessageThread>(`client_message_threads?order=last_message_at.desc.nullslast,updated_at.desc&limit=8`),
        sbGet<StaffMessage>(`staff_messages?recipient_id=eq.${session.id}&read=eq.false&order=created_at.desc&limit=8`),
      ]);
      if (cancelled) return;
      const clientIds = threads.map(t => t.client_id).filter(Boolean);
      const threadIds = threads.map(t => t.id);
      const [clients, latestMsgs] = await Promise.all([
        clientIds.length
          ? sbGet<{ id: string; name: string }>(`clients?id=in.(${clientIds.join(",")})&select=id,name`)
          : Promise.resolve([] as { id: string; name: string }[]),
        threadIds.length
          ? sbGet<ClientMessage>(`client_messages?thread_id=in.(${threadIds.join(",")})&select=id,thread_id,body,channel,sender_role,sender_name,created_at&order=created_at.desc&limit=${threadIds.length * 3}`)
          : Promise.resolve([] as ClientMessage[]),
      ]);
      if (cancelled) return;
      const nameById = new Map(clients.map(c => [c.id, c.name]));
      const firstByThread = new Map<string, ClientMessage>();
      for (const m of latestMsgs) {
        if (!firstByThread.has(m.thread_id)) firstByThread.set(m.thread_id, m);
      }
      setClientThreads(threads.map(t => ({
        ...t,
        client_name: nameById.get(t.client_id) ?? "Client",
        preview: firstByThread.get(t.id)?.body ?? "",
      })));
      setStaffMsgs(dms);
      setMsgsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session.id]);

  // ── Action handlers (Today's Work log-result panel) ───────────────────────

  function handleStartAppointment() {
    onChangeTab("calendar");
  }

  function handleStartLeadCall(leadId: string) {
    setManuallyChosenId(leadId);
    setExpandedRowId(leadId);
  }

  function handleSkip(taskId: string) {
    const next = new Set(skippedIds);
    next.add(taskId);
    setSkippedIds(next);
    setManuallyChosenId(null);
  }

  function handleChoose(leadId: string) {
    setManuallyChosenId(leadId);
  }

  function handleCollapse() {
    setExpandedRowId(null);
    setManuallyChosenId(null);
  }

  async function handleLeftMessage(lead: Lead) {
    try {
      await sbPost("intake_contact_log", {
        lead_id: lead.id,
        channel: "phone",
        direction: "outbound",
        outcome: "left_message",
        contacted_by: session.name,
        is_bot: false,
        notes: null,
      });
      const patch: { status?: string; last_contact_at: string } = {
        last_contact_at: new Date().toISOString(),
      };
      if (lead.status === "new") patch.status = "contacted";
      await sbPatch("intake_leads", lead.id, patch);
    } finally {
      handleCollapse();
      onRefresh();
    }
  }

  async function handleAddToFollowUp(lead: Lead) {
    try {
      await sbPatch("intake_leads", lead.id, {
        follow_up_queue: "priority",
        last_contact_at: new Date().toISOString(),
      });
    } finally {
      handleCollapse();
      onRefresh();
    }
  }

  function handleScheduleConsult(lead: Lead) {
    handleCollapse();
    onScheduleConsult(lead);
  }

  function handleDoIntakeNow(lead: Lead) {
    handleCollapse();
    onDoIntakeNow(lead);
  }

  // ── Greeting ──────────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-medium text-[#FAFAF7]" style={{ fontFamily: "'Fraunces', Georgia, serif", letterSpacing: "-0.01em" }}>
            {greeting}, {session.name.split(" ")[0]}.
          </h2>
          <p className="text-xs text-[#6B6B66] mt-0.5">
            Your day at a glance — {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: FIRM_TZ })}
          </p>
        </div>
        {onLogNewLead && (
          <button
            onClick={onLogNewLead}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[#0F0F0E] bg-[#B8945F] hover:bg-[#C8A46F] px-3 py-1.5 rounded transition-colors"
            title="Open the New Client Lead window"
          >
            <span className="text-base leading-none">+</span> New Client Lead
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TasksAndAppointmentsWidget
          todaysAppts={todaysAppts}
          upcomingAppts={upcomingAppts}
          toDoQueue={toDoQueue}
          nextTask={nextTask}
          expandedRowId={expandedRowId}
          setExpandedRowId={setExpandedRowId}
          onStartAppointment={handleStartAppointment}
          onStartLeadCall={handleStartLeadCall}
          onSkip={handleSkip}
          onChoose={handleChoose}
          onScheduleConsult={handleScheduleConsult}
          onDoIntakeNow={handleDoIntakeNow}
          onLeftMessage={handleLeftMessage}
          onAddToFollowUp={handleAddToFollowUp}
          onCancelExpansion={handleCollapse}
          onChangeTab={onChangeTab}
        />
        <MessagingWidget
          threads={clientThreads}
          staffMsgs={staffMsgs}
          loading={msgsLoading}
          onOpenView={onOpenView}
        />
        <div className="lg:col-span-2">
          <EmailInboxWidget />
        </div>
        <div className="lg:col-span-2">
          <PhoneDialerWidget />
        </div>
      </div>
    </div>
  );
}

// ─── Today's Work widget (Section A + Section B) ─────────────────────────────

interface TasksAndAppointmentsWidgetProps {
  todaysAppts: ApptRow[];
  upcomingAppts: ApptRow[];
  toDoQueue: ToDoRow[];
  nextTask: NextTask;
  expandedRowId: string | null;
  setExpandedRowId: (id: string | null) => void;
  onStartAppointment: () => void;
  onStartLeadCall: (leadId: string) => void;
  onSkip: (taskId: string) => void;
  onChoose: (leadId: string) => void;
  onScheduleConsult: (lead: Lead) => void;
  onDoIntakeNow: (lead: Lead) => void;
  onLeftMessage: (lead: Lead) => void;
  onAddToFollowUp: (lead: Lead) => void;
  onCancelExpansion: () => void;
  onChangeTab: (tab: TabId) => void;
}

function TasksAndAppointmentsWidget(props: TasksAndAppointmentsWidgetProps) {
  const { todaysAppts, upcomingAppts, toDoQueue, nextTask, onChangeTab } = props;
  const showingToday = todaysAppts.length > 0;
  const apptsToShow = showingToday ? todaysAppts : upcomingAppts.slice(0, 5);
  const totalToday = todaysAppts.length + toDoQueue.length;

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={<ListChecks className="w-4 h-4" />}
        title="Today's Work"
        badge={<CountBadge value={totalToday} />}
      />
      <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: 560 }}>

        {/* Section A — Coming up */}
        <Section
          title={showingToday ? "Coming up" : "Coming up — next on your calendar"}
          count={apptsToShow.length}
          onAll={() => onChangeTab("calendar")}
        >
          {apptsToShow.length === 0 ? (
            <EmptyHint>No consults on your calendar.</EmptyHint>
          ) : (
            <ul className="space-y-1.5">
              {apptsToShow.map(e => (
                <li key={e.id}>
                  <button
                    onClick={() => onChangeTab("calendar")}
                    className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-[#2A2A28] text-left transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#6B6B66] mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-mono text-[#B8945F] truncate">
                        {formatDateLabel(e.start_time)} · {formatTimeRange(e.start_time, e.end_time)}
                      </p>
                      <p className="text-xs text-[#FAFAF7] truncate mt-0.5">
                        {e.client_name}
                        <span className="text-[#6B6B66]">
                          {" — "}{e.chapter ? `Ch.${e.chapter}` : ""} consult
                        </span>
                      </p>
                    </div>
                    <ChevronRight className="w-3 h-3 text-[#6B6B66] mt-1 flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Section B — To do (Up Next + queue) */}
        <div>
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66]">To do</p>
            <span className="text-[10px] font-mono text-[#6B6B66]">{toDoQueue.length}</span>
            <button
              onClick={() => onChangeTab("leads")}
              className="ml-auto text-[10px] font-semibold text-[#B8945F] hover:text-[#FAFAF7] transition-colors"
            >
              View all →
            </button>
          </div>

          {/* Layer 1 — Up Next card */}
          <UpNextCard
            nextTask={nextTask}
            queue={toDoQueue}
            onStartAppointment={props.onStartAppointment}
            onStartLeadCall={props.onStartLeadCall}
            onSkip={props.onSkip}
            onChoose={props.onChoose}
          />

          {/* Queue list — always visible below the Up Next card */}
          {toDoQueue.length === 0 ? (
            <EmptyHint>No outstanding outreach.</EmptyHint>
          ) : (
            <ul className="space-y-1.5 mt-2">
              {toDoQueue.map(row => (
                <ToDoRowItem
                  key={row.lead.id}
                  row={row}
                  expanded={props.expandedRowId === row.lead.id}
                  onCall={() => props.onStartLeadCall(row.lead.id)}
                  onScheduleConsult={() => props.onScheduleConsult(row.lead)}
                  onDoIntakeNow={() => props.onDoIntakeNow(row.lead)}
                  onLeftMessage={() => props.onLeftMessage(row.lead)}
                  onAddToFollowUp={() => props.onAddToFollowUp(row.lead)}
                  onCancel={props.onCancelExpansion}
                />
              ))}
            </ul>
          )}
        </div>

      </div>
    </Card>
  );
}

function Section({
  title, count, onAll, children,
}: { title: string; count: number; onAll?: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5 px-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66]">{title}</p>
        <span className="text-[10px] font-mono text-[#6B6B66]">{count}</span>
        {onAll && (
          <button
            onClick={onAll}
            className="ml-auto text-[10px] font-semibold text-[#B8945F] hover:text-[#FAFAF7] transition-colors"
          >
            View all →
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-2 text-[11px] text-[#6B6B66] italic">{children}</p>;
}

function UrgencyDot({ urgency }: { urgency: string | null }) {
  const color =
    urgency === "emergency" ? "bg-red-500" :
    urgency === "urgent"    ? "bg-amber-500" :
                              "bg-[#3A3A36]";
  return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color}`} />;
}

function TierChip({ tier }: { tier: ToDoTier }) {
  const cfg = {
    emergency: { label: "Emergency",         cls: "bg-red-900/40 text-red-300 border-red-700/60" },
    new:       { label: "New call",          cls: "bg-[#2A2A28] text-[#B8945F] border-[#3A3A36]" },
    followup:  { label: "Follow-up — quoted", cls: "bg-[#2A2A28] text-[#6B6B66] border-[#3A3A36]" },
  }[tier];
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Up Next card (Layer 1) ──────────────────────────────────────────────────

function UpNextCard({
  nextTask, queue, onStartAppointment, onStartLeadCall, onSkip, onChoose,
}: {
  nextTask: NextTask;
  queue: ToDoRow[];
  onStartAppointment: () => void;
  onStartLeadCall: (leadId: string) => void;
  onSkip: (taskId: string) => void;
  onChoose: (leadId: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── Empty / "All clear" ──────────────────────────────────────────────────
  if (nextTask.kind === "none") {
    return (
      <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] px-4 py-3 flex items-center gap-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <p className="text-xs text-[#FAFAF7]">
          All caught up — nothing up next right now.
        </p>
      </div>
    );
  }

  // ── Appointment ──────────────────────────────────────────────────────────
  if (nextTask.kind === "appointment") {
    const { appt, minutesUntilStart, isInProgress } = nextTask;
    return (
      <UpNextShell tone="appointment">
        <UpNextHeader label={isInProgress ? "Up Next — in progress" : "Up Next"}>
          <span className="text-[10px] font-mono text-[#B8945F]">
            {isInProgress ? "running now" : `starts in ${minutesUntilStart} min`}
          </span>
        </UpNextHeader>
        <div className="flex items-start gap-3 mt-2">
          <Calendar className="w-4 h-4 text-[#B8945F] mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-mono text-[#B8945F]">
              {formatTimeRange(appt.start_time, appt.end_time)}
            </p>
            <p className="text-xs text-[#FAFAF7] mt-0.5 truncate">
              {appt.client_name}
              <span className="text-[#6B6B66]">{" — "}{appt.chapter ? `Ch.${appt.chapter}` : ""} consult</span>
            </p>
          </div>
        </div>
        <UpNextActions
          primary={
            <button
              onClick={onStartAppointment}
              className="flex items-center gap-1.5 bg-[#B8945F] hover:bg-[#C8A46F] text-[#0F0F0E] font-bold text-xs px-3 py-1.5 rounded transition-colors"
            >
              <Calendar className="w-3 h-3" /> Open in calendar
            </button>
          }
          allowSkip
          onSkip={() => onSkip(appt.id)}
          onChooseAnother={() => setPickerOpen(o => !o)}
          pickerOpen={pickerOpen}
        />
        {pickerOpen && <ChoosePicker queue={queue} onPick={(id) => { onChoose(id); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />}
      </UpNextShell>
    );
  }

  // ── Lead (emergency / new / follow-up) ───────────────────────────────────
  const lead = nextTask.lead;
  const isEmergency = nextTask.kind === "lead-emergency";
  const tier: ToDoTier = isEmergency ? "emergency" : nextTask.kind === "lead-new" ? "new" : "followup";

  return (
    <UpNextShell tone={isEmergency ? "emergency" : "lead"}>
      <UpNextHeader label={isEmergency ? "Up Next — emergency" : "Up Next"}>
        <TierChip tier={tier} />
      </UpNextHeader>
      <div className="flex items-start gap-3 mt-2">
        {isEmergency
          ? <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          : <Sparkles className="w-4 h-4 text-[#B8945F] mt-0.5 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[#FAFAF7] truncate">{lead.full_name}</p>
          <p className="text-[10px] text-[#6B6B66] truncate mt-0.5">
            {lead.phone ?? lead.email ?? "—"}
            {lead.preferred_contact && <span> · prefers {lead.preferred_contact}</span>}
            {lead.chapter_interest && <span> · Ch.{lead.chapter_interest}</span>}
            <span> · {lead.status}</span>
          </p>
        </div>
      </div>
      <UpNextActions
        primary={
          <button
            onClick={() => onStartLeadCall(lead.id)}
            className="flex items-center gap-1.5 bg-[#B8945F] hover:bg-[#C8A46F] text-[#0F0F0E] font-bold text-xs px-3 py-1.5 rounded transition-colors"
          >
            <Phone className="w-3 h-3" /> Start call
          </button>
        }
        allowSkip={!isEmergency}
        onSkip={() => onSkip(lead.id)}
        onChooseAnother={() => setPickerOpen(o => !o)}
        pickerOpen={pickerOpen}
      />
      {pickerOpen && <ChoosePicker queue={queue} onPick={(id) => { onChoose(id); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />}
    </UpNextShell>
  );
}

function UpNextShell({ tone, children }: { tone: "appointment" | "emergency" | "lead"; children: React.ReactNode }) {
  const border =
    tone === "emergency"   ? "border-red-700/60" :
    tone === "appointment" ? "border-[#B8945F]/40" :
                              "border-[#B8945F]/30";
  const bg =
    tone === "emergency" ? "bg-red-950/30" :
                            "bg-[#0F0F0E]";
  return (
    <div className={`rounded-lg border ${border} ${bg} px-4 py-3`}>
      {children}
    </div>
  );
}

function UpNextHeader({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#B8945F]">{label}</p>
      <div className="ml-auto flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function UpNextActions({
  primary, allowSkip, onSkip, onChooseAnother, pickerOpen,
}: {
  primary: React.ReactNode;
  allowSkip: boolean;
  onSkip: () => void;
  onChooseAnother: () => void;
  pickerOpen: boolean;
}) {
  return (
    <div className="flex items-center gap-3 mt-3">
      {primary}
      <div className="flex items-center gap-3 ml-auto">
        {allowSkip && (
          <button
            onClick={onSkip}
            className="text-[11px] text-[#6B6B66] hover:text-[#FAFAF7] transition-colors"
          >
            Skip
          </button>
        )}
        <button
          onClick={onChooseAnother}
          className={`text-[11px] transition-colors ${pickerOpen ? "text-[#FAFAF7]" : "text-[#6B6B66] hover:text-[#FAFAF7]"}`}
        >
          {pickerOpen ? "Close" : "Choose another"}
        </button>
      </div>
    </div>
  );
}

function ChoosePicker({
  queue, onPick, onClose,
}: { queue: ToDoRow[]; onPick: (leadId: string) => void; onClose: () => void }) {
  if (queue.length === 0) {
    return (
      <div className="mt-2 rounded border border-[#2A2A28] bg-[#1A1A18] px-3 py-2 text-[11px] text-[#6B6B66] italic">
        No alternatives in the queue.
      </div>
    );
  }
  return (
    <div className="mt-2 rounded border border-[#2A2A28] bg-[#1A1A18] max-h-48 overflow-y-auto">
      <div className="flex items-center px-3 py-1.5 border-b border-[#2A2A28]">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66]">Pick a task</span>
        <button onClick={onClose} className="ml-auto text-[#6B6B66] hover:text-[#FAFAF7]">
          <X className="w-3 h-3" />
        </button>
      </div>
      <ul>
        {queue.map(r => (
          <li key={r.lead.id}>
            <button
              onClick={() => onPick(r.lead.id)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2A2A28] transition-colors"
            >
              <UrgencyDot urgency={r.lead.urgency} />
              <span className="text-xs text-[#FAFAF7] truncate flex-1">{r.lead.full_name}</span>
              <TierChip tier={r.tier} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── To-do row + log-result panel ────────────────────────────────────────────

function ToDoRowItem({
  row, expanded, onCall,
  onScheduleConsult, onDoIntakeNow, onLeftMessage, onAddToFollowUp, onCancel,
}: {
  row: ToDoRow;
  expanded: boolean;
  onCall: () => void;
  onScheduleConsult: () => void;
  onDoIntakeNow: () => void;
  onLeftMessage: () => void;
  onAddToFollowUp: () => void;
  onCancel: () => void;
}) {
  const { lead, tier } = row;
  return (
    <li className="rounded-lg border border-transparent hover:border-[#2A2A28] transition-colors">
      <div className="flex items-center gap-3 px-3 py-2">
        <UrgencyDot urgency={lead.urgency} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#FAFAF7] truncate">{lead.full_name}</p>
          <p className="text-[10px] text-[#6B6B66] truncate">
            {lead.phone ?? lead.email ?? "—"}
            {lead.preferred_contact && <span> · prefers {lead.preferred_contact}</span>}
            {lead.chapter_interest && <span> · Ch.{lead.chapter_interest}</span>}
          </p>
        </div>
        <TierChip tier={tier} />
        {!expanded && (
          <button
            onClick={onCall}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#B8945F] hover:text-[#FAFAF7] border border-[#B8945F]/40 hover:border-[#B8945F] px-2 py-1 rounded transition-colors"
          >
            <Phone className="w-3 h-3" /> Call
          </button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-[#2A2A28] mx-3 mb-3 mt-1 pt-3 px-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-2">
            Log call result {lead.phone ? <span className="font-mono text-[#B8945F]">· {lead.phone}</span> : null}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary actions */}
            <button
              onClick={onScheduleConsult}
              className="flex items-center gap-1.5 bg-[#B8945F] hover:bg-[#C8A46F] text-[#0F0F0E] font-bold text-xs px-3 py-1.5 rounded transition-colors"
            >
              <Calendar className="w-3 h-3" /> Schedule consult
            </button>
            <button
              onClick={onDoIntakeNow}
              className="flex items-center gap-1.5 bg-[#B8945F] hover:bg-[#C8A46F] text-[#0F0F0E] font-bold text-xs px-3 py-1.5 rounded transition-colors"
            >
              <ClipboardList className="w-3 h-3" /> Do intake now
            </button>
            {/* Lighter secondary actions */}
            <div className="flex items-center gap-3 ml-auto">
              <button
                onClick={onLeftMessage}
                className="text-[11px] text-[#6B6B66] hover:text-[#FAFAF7] transition-colors"
              >
                Left message
              </button>
              <button
                onClick={onAddToFollowUp}
                className="text-[11px] text-[#6B6B66] hover:text-[#FAFAF7] transition-colors flex items-center gap-1"
              >
                <BellRing className="w-3 h-3" /> Add to follow-up
              </button>
              <button
                onClick={onCancel}
                className="text-[11px] text-[#6B6B66] hover:text-[#FAFAF7] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

// ─── Widget 3 — Messaging (REAL) ─────────────────────────────────────────────

function MessagingWidget({
  threads, staffMsgs, loading, onOpenView,
}: {
  threads: (ClientMessageThread & { client_name?: string; preview?: string })[];
  staffMsgs: StaffMessage[];
  loading: boolean;
  onOpenView: (view: "messages" | "staff_comms") => void;
}) {
  const clientUnread = threads.reduce((s, t) => s + (t.unread_count ?? 0), 0);
  const staffUnread = staffMsgs.length;
  const totalUnread = clientUnread + staffUnread;

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={<MessageCircle className="w-4 h-4" />}
        title="Messaging"
        badge={<CountBadge value={totalUnread} tone={totalUnread > 0 ? "warn" : "neutral"} />}
      />
      <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: 560 }}>
        <Section title="Client Threads" count={clientUnread} onAll={() => onOpenView("messages")}>
          {loading ? (
            <EmptyHint>Loading…</EmptyHint>
          ) : threads.length === 0 ? (
            <EmptyHint>No active client threads.</EmptyHint>
          ) : (
            <ul className="space-y-1.5">
              {threads.slice(0, 5).map(t => (
                <li key={t.id}>
                  <button
                    onClick={() => onOpenView("messages")}
                    className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-[#2A2A28] text-left transition-colors"
                  >
                    <Users className="w-3.5 h-3.5 text-[#6B6B66] mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs truncate ${t.unread_count > 0 ? "text-[#FAFAF7] font-semibold" : "text-[#FAFAF7]"}`}>
                          {t.client_name}
                        </p>
                        {t.unread_count > 0 && (
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700/60">
                            {t.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#6B6B66] truncate mt-0.5">
                        {t.preview || "(no preview)"}
                      </p>
                    </div>
                    <span className="text-[10px] text-[#6B6B66] flex-shrink-0 ml-2">
                      {t.last_message_at ? relativeTime(t.last_message_at) : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Internal Inbox" count={staffUnread} onAll={() => onOpenView("staff_comms")}>
          {loading ? (
            <EmptyHint>Loading…</EmptyHint>
          ) : staffMsgs.length === 0 ? (
            <EmptyHint>Inbox is clear.</EmptyHint>
          ) : (
            <ul className="space-y-1.5">
              {staffMsgs.slice(0, 5).map(m => (
                <li key={m.id}>
                  <button
                    onClick={() => onOpenView("staff_comms")}
                    className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-[#2A2A28] text-left transition-colors"
                  >
                    <ChannelIcon channel={m.channel} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-[#FAFAF7] truncate">{m.sender_name}</p>
                        <span className="text-[9px] uppercase tracking-widest text-[#6B6B66]">
                          {m.channel}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#6B6B66] truncate mt-0.5">
                        {m.subject || m.body.slice(0, 60)}
                      </p>
                    </div>
                    <span className="text-[10px] text-[#6B6B66] flex-shrink-0 ml-2">{relativeTime(m.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </Card>
  );
}

function ChannelIcon({ channel }: { channel: string }) {
  const cls = "w-3.5 h-3.5 text-[#6B6B66] mt-0.5 flex-shrink-0";
  if (channel === "email")       return <Mail className={cls} />;
  if (channel === "sms")         return <MessageCircle className={cls} />;
  if (channel === "phone_note")  return <Phone className={cls} />;
  return <MessageCircle className={cls} />;
}

// ─── Widget 2 — Shared Email Inbox (UI-COMPLETE on SAMPLE data) ──────────────
//
// TODO Phase B — wire against a shared Microsoft 365 mailbox via the Graph API:
//   1. Azure AD app registration with Mail.ReadWrite (Application) consent.
//   2. Token endpoint (edge function) that mints a Graph access token using
//      client_credentials grant; cache in memory with TTL.
//   3. Polling or webhook subscription (Microsoft Graph change notifications)
//      to surface new messages: GET /users/{intake-mailbox}/messages.
//   4. New table `inbox_assignments` for our local claim/status overlay.
//   5. Reply flow uses POST /messages/{id}/reply (server-side).

function EmailInboxWidget() {
  const [selectedId, setSelectedId] = useState<string | null>(SAMPLE_EMAILS[0].id);
  const [statusFilter, setStatusFilter] = useState<"all" | "unhandled" | "in_progress" | "handled">("all");

  const filtered = useMemo(() => {
    if (statusFilter === "all") return SAMPLE_EMAILS;
    return SAMPLE_EMAILS.filter(e => e.status === statusFilter);
  }, [statusFilter]);

  const selected = SAMPLE_EMAILS.find(e => e.id === selectedId) ?? null;
  const unhandledCount = SAMPLE_EMAILS.filter(e => e.status === "unhandled").length;

  return (
    <Card>
      <CardHeader
        icon={<Inbox className="w-4 h-4" />}
        title="Shared Intake Inbox"
        badge={<CountBadge value={unhandledCount} tone="warn" />}
        chip={<SampleChip />}
      />
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] divide-x divide-[#2A2A28]" style={{ minHeight: 360 }}>
        <div className="flex flex-col">
          <div className="flex items-center gap-1 px-3 py-2 border-b border-[#2A2A28]">
            {(["all", "unhandled", "in_progress", "handled"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-[10px] font-semibold px-2 py-1 rounded transition-colors ${
                  statusFilter === s
                    ? "bg-[#2A2A28] text-[#FAFAF7]"
                    : "text-[#6B6B66] hover:text-[#FAFAF7]"
                }`}
              >
                {s === "all" ? "All" : s === "in_progress" ? "In progress" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <ul className="flex-1 overflow-y-auto">
            {filtered.map(m => {
              const isSelected = m.id === selectedId;
              return (
                <li key={m.id}>
                  <button
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full text-left px-3 py-2.5 border-b border-[#2A2A28] transition-colors ${
                      isSelected ? "bg-[#2A2A28]" : "hover:bg-[#222220]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-xs truncate flex-1 ${m.isRead ? "text-[#FAFAF7]" : "text-[#FAFAF7] font-semibold"}`}>
                        {m.from.name}
                      </p>
                      <span className="text-[10px] text-[#6B6B66] flex-shrink-0">
                        {relativeTime(m.receivedDateTime)}
                      </span>
                    </div>
                    <p className={`text-[11px] truncate mb-1 ${m.isRead ? "text-[#6B6B66]" : "text-[#FAFAF7]"}`}>
                      {m.subject}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <StatusPill status={m.status} />
                      {m.assignee ? (
                        <span className="text-[9px] text-[#6B6B66] truncate">· {m.assignee}</span>
                      ) : (
                        <span className="text-[9px] text-[#B8945F]">· unclaimed</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col">
          {selected ? (
            <>
              <div className="px-4 py-3 border-b border-[#2A2A28]">
                <p className="text-sm font-semibold text-[#FAFAF7]">{selected.subject}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[11px] text-[#6B6B66] truncate">
                    {selected.from.name} <span className="text-[#3A3A36]">·</span> {selected.from.address}
                  </p>
                  <span className="text-[10px] text-[#6B6B66] ml-auto flex-shrink-0">
                    {new Date(selected.receivedDateTime).toLocaleString("en-US", { timeZone: FIRM_TZ })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <StatusPill status={selected.status} />
                  {selected.assignee ? (
                    <span className="text-[10px] text-[#6B6B66]">Assigned to {selected.assignee}</span>
                  ) : (
                    <button disabled title="Claim/Assign — wiring pending"
                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#B8945F]/15 border border-[#B8945F]/40 text-[#B8945F] opacity-70 cursor-not-allowed"
                    >Claim</button>
                  )}
                </div>
              </div>
              <div className="flex-1 px-4 py-3 overflow-y-auto">
                <p className="text-xs text-[#FAFAF7] leading-relaxed whitespace-pre-wrap">{selected.bodyPreview}</p>
              </div>
              <div className="px-4 py-3 border-t border-[#2A2A28] flex items-center gap-2">
                <button disabled title="Reply — wiring pending"
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#FAFAF7] bg-[#2A2A28] hover:bg-[#3A3A36] border border-[#3A3A36] px-3 py-1.5 rounded opacity-70 cursor-not-allowed transition-colors"
                ><Reply className="w-3 h-3" /> Reply</button>
                <button disabled title="Mark handled — wiring pending"
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#6B6B66] hover:text-[#FAFAF7] px-3 py-1.5 rounded opacity-70 cursor-not-allowed transition-colors"
                ><CheckCircle2 className="w-3 h-3" /> Mark handled</button>
                <button disabled title="Convert to lead — wiring pending"
                  className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-[#6B6B66] hover:text-[#FAFAF7] px-3 py-1.5 rounded opacity-70 cursor-not-allowed transition-colors"
                ><UserCheck className="w-3 h-3" /> Convert to lead</button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-[#6B6B66]">Select a message to read.</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function StatusPill({ status }: { status: SampleEmail["status"] }) {
  const cfg = {
    unhandled:   { label: "Unhandled",   cls: "bg-red-900/30 text-red-300 border-red-700/60" },
    in_progress: { label: "In progress", cls: "bg-amber-900/30 text-amber-300 border-amber-700/60" },
    handled:     { label: "Handled",     cls: "bg-emerald-900/30 text-emerald-300 border-emerald-700/60" },
  }[status];
  return (
    <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Widget 4 — Phone + Voicemail (UI-COMPLETE on SAMPLE data) ───────────────
//
// TODO Phase B — wire against Twilio Voice:
//   1. Twilio Voice JS SDK in the frontend.
//   2. New edge function for capability-token mint.
//   3. New edge function returning TwiML for inbound calls.
//   4. New edge function for recording status callback.
//   5. New table `calls` (id, direction, lead_id, client_id, from/to, staff_id,
//      started_at, ended_at, duration_seconds, status, recording_url,
//      voicemail_for_staff_id, listened_at).
//   6. Twilio Console wiring: incoming-call URL + recording-status callback.
//   7. Outbound click-to-call can reuse send-client-message channel='voice'.

function PhoneDialerWidget() {
  const [dialed, setDialed] = useState("");
  const [tab, setTab] = useState<"history" | "voicemails">("history");
  const voicemails = SAMPLE_CALLS.filter(c => c.isVoicemail);
  const unlistenedCount = voicemails.filter(v => !v.listened).length;

  function press(key: string) { if (dialed.length >= 20) return; setDialed(d => d + key); }
  function backspace() { setDialed(d => d.slice(0, -1)); }

  return (
    <Card>
      <CardHeader
        icon={<Phone className="w-4 h-4" />}
        title="Phone & Voicemail"
        badge={<CountBadge value={unlistenedCount} tone="warn" />}
        chip={<SampleChip />}
      />
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] divide-x divide-[#2A2A28]" style={{ minHeight: 360 }}>
        <div className="p-4 flex flex-col">
          <div className="bg-[#0F0F0E] border border-[#2A2A28] rounded-lg px-3 py-2.5 mb-3 min-h-[44px] flex items-center justify-between">
            <span className={`text-base font-mono tracking-wide ${dialed ? "text-[#FAFAF7]" : "text-[#3A3A36]"}`}>
              {dialed || "(000) 000-0000"}
            </span>
            {dialed && (
              <button onClick={backspace} className="text-[#6B6B66] hover:text-[#FAFAF7] p-1 transition-colors">
                <Delete className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {["1","2","3","4","5","6","7","8","9","*","0","#"].map(k => (
              <button key={k} onClick={() => press(k)}
                className="bg-[#2A2A28] hover:bg-[#3A3A36] border border-[#3A3A36] rounded-lg py-2.5 text-base font-semibold text-[#FAFAF7] transition-colors"
              >{k}</button>
            ))}
          </div>
          <button
            disabled={!dialed}
            title={dialed ? "Call — Twilio Voice wiring pending" : "Enter a number"}
            className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-[#2A2A28] disabled:text-[#6B6B66] disabled:cursor-not-allowed text-white font-bold text-xs py-2.5 rounded-lg transition-colors"
          ><Phone className="w-3.5 h-3.5" /> Call</button>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1 px-3 py-2 border-b border-[#2A2A28]">
            <button onClick={() => setTab("history")}
              className={`text-[10px] font-semibold px-2 py-1 rounded transition-colors ${tab === "history" ? "bg-[#2A2A28] text-[#FAFAF7]" : "text-[#6B6B66] hover:text-[#FAFAF7]"}`}
            >
              <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> History</span>
            </button>
            <button onClick={() => setTab("voicemails")}
              className={`text-[10px] font-semibold px-2 py-1 rounded transition-colors flex items-center gap-1.5 ${tab === "voicemails" ? "bg-[#2A2A28] text-[#FAFAF7]" : "text-[#6B6B66] hover:text-[#FAFAF7]"}`}
            >
              <Voicemail className="w-3 h-3" /> Voicemail
              {unlistenedCount > 0 && (
                <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700/60">
                  {unlistenedCount}
                </span>
              )}
            </button>
          </div>

          {tab === "history" ? (
            <ul className="flex-1 overflow-y-auto">
              {SAMPLE_CALLS.map(c => (
                <li key={c.id} className="px-3 py-2.5 border-b border-[#2A2A28] hover:bg-[#222220] transition-colors">
                  <div className="flex items-center gap-3">
                    <CallDirectionIcon direction={c.direction} status={c.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#FAFAF7] truncate">{c.contactName ?? c.number}</p>
                      <p className="text-[10px] text-[#6B6B66]">{c.number}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-[#6B6B66]">{relativeTime(c.time)}</p>
                      <p className="text-[10px] text-[#6B6B66] font-mono">{formatDuration(c.durationSeconds)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="flex-1 overflow-y-auto">
              {voicemails.length === 0 ? (
                <EmptyHint>No voicemails.</EmptyHint>
              ) : voicemails.map(v => (
                <li key={v.id} className="px-3 py-2.5 border-b border-[#2A2A28] hover:bg-[#222220] transition-colors">
                  <div className="flex items-center gap-3">
                    <Voicemail className={`w-4 h-4 flex-shrink-0 ${v.listened ? "text-[#6B6B66]" : "text-[#B8945F]"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs truncate ${v.listened ? "text-[#FAFAF7]" : "text-[#FAFAF7] font-semibold"}`}>
                        {v.contactName ?? v.number}
                      </p>
                      <p className="text-[10px] text-[#6B6B66]">{v.number} · {formatDuration(v.durationSeconds)}</p>
                    </div>
                    <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                      <p className="text-[10px] text-[#6B6B66]">{relativeTime(v.time)}</p>
                      <button disabled title="Play recording — Twilio wiring pending"
                        className="text-[10px] font-semibold text-[#B8945F] hover:text-[#FAFAF7] px-2 py-0.5 rounded bg-[#B8945F]/10 border border-[#B8945F]/40 opacity-70 cursor-not-allowed"
                      >Play</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

function CallDirectionIcon({ direction, status }: { direction: "inbound" | "outbound"; status: "completed" | "missed" | "voicemail" }) {
  if (status === "missed") return <PhoneMissed className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />;
  if (status === "voicemail") return <Voicemail className="w-3.5 h-3.5 text-[#B8945F] flex-shrink-0" />;
  return direction === "inbound"
    ? <PhoneIncoming className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
    : <PhoneOutgoing className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />;
}
