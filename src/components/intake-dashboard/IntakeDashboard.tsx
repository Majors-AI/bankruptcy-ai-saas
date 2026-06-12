// Intake Portal (Staff) — Dashboard view.
//
// Default landing for legal_admin / super_admin roles inside IntakePortalInner.
// Attorneys do NOT receive this view — handled by the role gate in
// LegalAdminPortal.tsx where the Dashboard tab and the defaultTab branch are
// scoped to non-attorneys.
//
// Layout (top â†’ bottom):
//   - Client search row (above the header buttons): name/phone search of the
//     existing `leads` prop; click opens the lead detail panel.
//   - Header row: greeting, [phone-icon popover], [Escalate to Supervisor],
//     [Existing Client Leads], [New Client Lead]
//   - Top bubbles row: [Clock | Overview | Retention]
//       Replaces the legacy 4-stat strip that lived in LegalAdminPortal
//       (it's now conditionally hidden on the dashboard tab).
//   - 3-column grid:
//       LEFT (compact)  — AllTasksWidget OR ScheduleColumnView (toggle).
//                          Tasks are color-coded RED/ORANGE/YELLOW/BLUE and
//                          drawn from a SHARED firm-wide pool (no per-staff
//                          filter — see TODO at toDoQueue/sharedTasks).
//                          Schedule view: Next-day / 5-day / Monthly filters;
//                          5-day reuses ConsultSchedulerPanel verbatim.
//       MIDDLE          — Up Next & Outreach Queue (existing widget) with a
//                          "Start the next task" cue in the header.
//       RIGHT           — ConsolidatedMessagingWidget (All / SMS / Email /
//                          Team / Direct / Voicemails tabs; client threads +
//                          staff_messages combined).
//   - Below the grid:   Today hour-by-hour (full-width).
//
// Data sources actually wired:
//   - leads / calEvents — passed in from LegalAdminPortal (REAL)
//   - client_message_threads + staff_messages — fetched here (REAL)
//   - voicemails — NO source yet; rendered as a "Coming soon" scaffold
//   - phone dialer (PhoneDialerWidget) — still SAMPLE data; relocated from
//     the bottom of the grid to a popover triggered by the header phone icon
//
// REMOVED in this rework (flagged in the PR description):
//   - EmailInboxWidget (was UI-complete against SAMPLE Microsoft Graph data;
//     never connected) — drop from layout and from this file
//   - Bottom-of-grid PhoneDialerWidget placement — replaced by header popover
//   - "Coming up — next on your calendar" Section — replaced by TODAY grid
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

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock,
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Search,
  Users, Voicemail, ListChecks, Delete, PlayCircle,
  AlertCircle, AlertTriangle, Sparkles, ClipboardList, BellRing, X,
} from "lucide-react";
import ConsultSchedulerPanel, {
  type StaffDetail as SchedulerStaffDetail,
  type CalEvent as SchedulerCalEvent,
  type SchedulerSelection,
} from "../scheduler/ConsultSchedulerPanel";
import ClientSearchBar from "../client-search/ClientSearchBar";
import PostCallScheduledModal from "../lead-comms/PostCallScheduledModal";
import CommsPillBar from "../comms-pill/CommsPillBar";
// Prompt 54 — shared department-dashboard shell. The shell pieces below
// used to live inline in this file; they were extracted so Accounting +
// Legal dashboards can mount the same widgets. Every component receives
// data via props — no intake-specific assumptions inside the module.
import {
  DashboardGrid,
  AllTasksWidget, LeftModeToggle,
  AttentionBubble,
  TopBubblesRow,
  ConsolidatedMessagingWidget,
  Card, CardHeader, CountBadge, EmptyHint, SampleChip,
  INTAKE_METRICS,
  FIRM_TZ, todayInFirmTz, nextBusinessDay, relativeTime,
} from "../department-dashboard";
import type {
  TaskColor, TaskEntry,
  TimeClockState, TimeClockActions,
  ClientMessageThread, ClientMessage, StaffMessage,
} from "../department-dashboard";

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
  /** Optional explicit follow-up timestamp; used as "due" on lead-derived tasks. */
  next_follow_up_at?: string | null;
  // Lead-locking scaffold — see src/components/lead-claim/LeadClaim.tsx.
  // Optional reads only; the column doesn't exist yet (no migration here).
  claimed_by?: string | null;
  claimed_by_name?: string | null;
  claimed_at?: string | null;
  // SMS consent scaffold (PostCallScheduledModal reads this to suppress the
  // outbound preview when the client has opted out). Column doesn't exist
  // yet — TODO: planned consent table tracks opt_in_status + opted_out_at +
  // source. Until then this is always undefined and the modal renders the
  // normal preview.
  sms_opt_out?: boolean | null;
  sms_opt_in_status?: "unknown" | "opted_in" | "opted_out" | null;
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
  | "messages" | "staff_tasks"
  | "my_schedule"
  | "availability" | "timeoff" | "sick_admin" | "manual_clients";

interface ApptRow {
  id: string;
  start_time: string;
  end_time: string;
  client_name: string;
  chapter: number | null;
}

// Outreach Queue tiers. `yellow` (= attorney_accepted, "present the case")
// was added when the prioritization rules made YELLOW > NEW intake explicit.
type ToDoTier = "emergency" | "yellow" | "new" | "followup";
interface ToDoRow { lead: Lead; tier: ToDoTier; }

// TaskColor + TaskEntry moved to ../department-dashboard during Slice-1
// (Prompt 54). Re-imported at the top of this file; type stays usable
// here unchanged.

// Layer 1 — what "Up Next" returns.
type NextTask =
  | { kind: "appointment";    appt: ApptRow; minutesUntilStart: number; isInProgress: boolean }
  | { kind: "lead-emergency"; lead: Lead }
  | { kind: "lead-yellow";    lead: Lead; isOverdue: boolean }
  | { kind: "lead-new";       lead: Lead; isOverdue: boolean }
  | { kind: "lead-followup";  lead: Lead; isOverdue: boolean }
  | { kind: "msg-unread";     threadId: string; clientName: string; preview: string; unreadCount: number }
  | { kind: "none" };

// ClientMessageThread / ClientMessage / StaffMessage moved to
// ../department-dashboard during Slice-1 (Prompt 54). Re-exported below
// so LegalAdminPortal's existing
//   import { type ClientMessageThread, ... } from ".../IntakeDashboard"
// path keeps working.
export type { ClientMessageThread, ClientMessage, StaffMessage } from "../department-dashboard";
// Also re-export ConsolidatedMessagingWidget for the same reason —
// LegalAdminPortal imports it as a named export from this file.
export { ConsolidatedMessagingWidget } from "../department-dashboard";

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

// FIRM_TZ moved to ../department-dashboard during Slice-1 (Prompt 54).
// Imported at the top of this file under the same name. Same TODO still
// applies: read firm timezone from firms.timezone instead of hardcoded LA.

// TODO per-staffer work-hours config doesn't exist yet — using firm default 8a–6p.
// When the work-hours surface lands (likely a staff_availability extension or
// a new staff_work_hours table), swap to the signed-in staffer's hours.
const BUSINESS_HOUR_START = 8;   // 8 AM
const BUSINESS_HOUR_END   = 18;  // 6 PM (exclusive upper bound — last slot is 5pm–6pm)

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
// emergency (RED) â†’ yellow (present the case) â†’ new (set appointment) â†’
// followup (fee-quoted). Within each tier sort by overdue-first â†’ urgency
// â†’ created_at (see toDoQueue derivation).
const TIER_RANK:    Record<ToDoTier, number> = { emergency: 0, yellow: 1, new: 2, followup: 3 };

// ─── Time / format helpers ──────────────────────────────────────────────────

// todayInFirmTz + nextBusinessDay moved to ../department-dashboard
// during Slice-1 (Prompt 54). Imported under the same names. The
// intake-only helper hourOfIsoInFirmTz stays here.

/** Hour (0–23) in the firm timezone for the given ISO timestamp. */
function hourOfIsoInFirmTz(iso: string): number {
  return parseInt(
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric", hour12: false, timeZone: FIRM_TZ,
    }),
    10,
  );
}

/** Localized "Tue, Jun 10" style label from a YYYY-MM-DD string. */
function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric", timeZone: "UTC",
  });
}

// relativeTime moved to ../department-dashboard during Slice-1 (Prompt 54).

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

function formatHourLabel(hour: number): string {
  const am = hour < 12;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${am ? "AM" : "PM"}`;
}

/**
 * Compact due-time label for a task row.
 *   - overdue   â†’ "5h ago"
 *   - today     â†’ "Today 3:00 PM"
 *   - tomorrow  â†’ "Tomorrow 9:00 AM"
 *   - this week â†’ "Tue 9:00 AM"
 *   - else      â†’ "Jun 12 Â· 9:00 AM"
 */
// formatDueLabel moved to ../department-dashboard during Slice-1 (Prompt 54).

// ─── Sample data — PhoneDialerWidget (Twilio Voice shape) ───────────────────
// Kept ONLY because the dialer popover still uses these as placeholder history.
// Real Twilio Voice wiring is the same TODO list called out below the widget.

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

// Card / CardHeader / CountBadge / SampleChip moved to
// ../department-dashboard during Slice-1 (Prompt 54). Imported at the
// top of this file. The intake-only ComingSoonChip stays here.

function ComingSoonChip() {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-2 py-0.5 rounded">
      Coming soon
    </span>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

// TimeClockState + TimeClockActions moved to ../department-dashboard
// during Slice-1 (Prompt 54). Imported at the top of this file under
// their original names. LegalAdminPortal continues to pass a
// structurally-identical state/actions pair to AttentionBubble.

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
  // Time clock is owned by IntakePortalInner (force-clock-in gate + idle
  // watcher live there). The ClockBubble below just reflects + controls it.
  timeClock: TimeClockState;
  timeClockActions: TimeClockActions;
}

export default function IntakeDashboard({
  session, leads, calEvents,
  skippedIds, setSkippedIds,
  onOpenLead: _onOpenLead,
  onChangeTab, onOpenView,
  onScheduleConsult, onDoIntakeNow, onLogNewLead, onRefresh,
  timeClock, timeClockActions,
}: IntakeDashboardProps) {
  const todayLocal = useMemo(() => todayInFirmTz(), []);
  const nextDayLocal = useMemo(() => nextBusinessDay(todayLocal), [todayLocal]);

  // ── Layer 1 — wall-clock tick for Up Next recompute ───────────────────────
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(Date.now()), NEXT_TASK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // ── Header popover / modal state ─────────────────────────────────────────
  const [phonePopoverOpen, setPhonePopoverOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [askForHelpOpen, setAskForHelpOpen] = useState(false);

  // ── Left column — Tasks vs. Schedule toggle ──────────────────────────────
  const [leftMode, setLeftMode] = useState<"tasks" | "schedule">("tasks");
  // ── My-tasks vs Shared-pool scope (Prompt 52) ──────────────────────────
  //
  // Defaults to "mine" so the signed-in staffer's view is theirs by default;
  // "shared" reveals the whole firm-wide pool. Affects the LEFT-column
  // AllTasksWidget, the Up Next derivation in the middle column, and the
  // overdue banner that drives off overdueCount.
  //
  // "Mine" definition mirrors LegalAdminPortal.tsx:6340 — leads where
  // `assigned_name === session.name` OR not yet assigned (so unassigned
  // leads don't fall through the cracks when every staffer hides them).
  // Appointments are already pre-filtered to session.id upstream
  // (todaysAppts at :581), so no further filter applies to those.
  // Client message threads have no per-staff assignment today; they stay
  // visible in both modes so unanswered firm messages aren't hidden.
  const [taskScope, setTaskScope] = useState<"mine" | "shared">("mine");
  const [scheduleRange, setScheduleRange] = useState<"next_day" | "five_day" | "monthly">("five_day");
  // ConsultSchedulerPanel is a controlled component; we hold its selection
  // locally because this surface is view-only — picking a slot here is a
  // no-op and does NOT book anything (booking flows live elsewhere).
  const [schedSelection, setSchedSelection] = useState<SchedulerSelection>({
    staffId: null, slotStartIso: null, dateStr: null,
  });

  // ── Staff pool — needed by ConsultSchedulerPanel for the 5-day view ──────
  const [staffPool, setStaffPool] = useState<SchedulerStaffDetail[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await sbGet<SchedulerStaffDetail>(
        "staff_members?is_active=eq.true&order=name.asc&select=id,name,role,role_level,intake_portal_role,is_active"
      );
      if (!cancelled) setStaffPool(rows);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Appointments — this staffer's intake consultations (derived) ──────────
  // Same filter the prior "Coming up" section used. Today + next-business-day
  // buckets are split here so the hour-grid and the next-day list both read
  // from the same source of truth.
  const { todaysAppts, nextDayAppts, upcomingAppts } = useMemo(() => {
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
    const next: ApptRow[] = [];
    const upcoming: ApptRow[] = [];
    const now = Date.now();
    for (const a of all) {
      const d = new Date(a.start_time).toLocaleDateString("en-CA", { timeZone: FIRM_TZ });
      if (d === todayLocal) today.push(a);
      else if (d === nextDayLocal) next.push(a);
      else if (new Date(a.start_time).getTime() > now) upcoming.push(a);
    }
    return { todaysAppts: today, nextDayAppts: next, upcomingAppts: upcoming };
  }, [calEvents, leads, todayLocal, nextDayLocal, session.id]);

  // ── To-do queue — emergencies + new calls + follow-ups, SHARED firm-wide ──
  //
  // Tasks are a SHARED pool: every active staffer sees the same queue. The
  // per-staff filter (matchesStaff = assigned_name === session.name) was
  // intentionally removed when the dashboard moved to the 3-column layout.
  //
  // TODO per-staff weighting + closer-strength: reintroduce a ranking pass
  // (NOT a hard filter) here once the planned closer-strength config lands.
  // Each lead's effective rank will combine its tier + the current staffer's
  // suitability score for that lead. Until then, the same ordering is shown
  // to everyone.
  const toDoQueue: ToDoRow[] = useMemo(() => {
    const nowMs = Date.now();
    const isLeadOverdue = (l: Lead) =>
      !!l.next_follow_up_at && new Date(l.next_follow_up_at).getTime() < nowMs;

    const emergencies = leads.filter(l => l.urgency === "emergency");
    const emergencyIds = new Set(emergencies.map(l => l.id));

    // YELLOW — attorney_accepted = "present the case". Ranks ABOVE NEW so
    // presenting cases outranks setting appointments per the priority rules.
    const presentCases = leads.filter(l =>
      !emergencyIds.has(l.id) &&
      l.status === "attorney_accepted"
    );
    const presentIds = new Set(presentCases.map(l => l.id));

    const newCalls = leads.filter(l =>
      !emergencyIds.has(l.id) && !presentIds.has(l.id) &&
      (l.status === "new" || l.follow_up_queue === "priority")
    );
    const followUps = leads.filter(l =>
      !emergencyIds.has(l.id) && !presentIds.has(l.id) &&
      l.status === "fee_quoted"
    );

    const rows: ToDoRow[] = [
      ...emergencies.map(lead => ({ lead, tier: "emergency" as const })),
      ...presentCases.map(lead => ({ lead, tier: "yellow" as const })),
      ...newCalls.map(lead => ({ lead, tier: "new" as const })),
      ...followUps.map(lead => ({ lead, tier: "followup" as const })),
    ];
    rows.sort((a, b) => {
      if (TIER_RANK[a.tier] !== TIER_RANK[b.tier]) return TIER_RANK[a.tier] - TIER_RANK[b.tier];
      // Within a tier, OVERDUE next_follow_up_at jumps to the top. This is
      // the "at-risk follow-ups ahead of fresh items" rule.
      const oa = isLeadOverdue(a.lead) ? 0 : 1;
      const ob = isLeadOverdue(b.lead) ? 0 : 1;
      if (oa !== ob) return oa - ob;
      const ua = URGENCY_RANK[a.lead.urgency ?? "normal"] ?? 2;
      const ub = URGENCY_RANK[b.lead.urgency ?? "normal"] ?? 2;
      if (ua !== ub) return ua - ub;
      return new Date(a.lead.created_at).getTime() - new Date(b.lead.created_at).getTime();
    });
    return rows.slice(0, 12);
  }, [leads]);

  // ── Widget — client messaging + staff DMs (REAL) ──────────────────────────
  // Declared BEFORE the nextTask useMemo because the priority pipeline
  // checks clientThreads for the RED-tier "unread message" Up Next variant.
  // last_channel is the channel of the most-recent message in the thread —
  // used by the ConsolidatedMessagingWidget to bucket client threads into
  // the SMS / Email tabs (the threads table itself has no channel column).
  const [clientThreads, setClientThreads] = useState<(ClientMessageThread & { client_name?: string; preview?: string; last_channel?: string | null })[]>([]);
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
        last_channel: firstByThread.get(t.id)?.channel ?? null,
      })));
      setStaffMsgs(dms);
      setMsgsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session.id]);

  // ── Layer 1 — Up Next computation ─────────────────────────────────────────
  const [manuallyChosenId, setManuallyChosenId] = useState<string | null>(null);
  // Single source of truth for which queue row's log-result panel is open.
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Per-scope filter on the to-do queue (Prompt 52). Declared here so the
  // nextTask useMemo below can read it; the matching filteredTasks for
  // the LEFT widget lives further down with the sharedTasks derivation.
  const filteredToDoQueue = useMemo(() => {
    if (taskScope === "shared") return toDoQueue;
    return toDoQueue.filter(r => {
      const owner = r.lead.assigned_name;
      return owner === session.name || !owner;
    });
  }, [toDoQueue, taskScope, session.name]);

  const nextTask: NextTask = useMemo(() => {
    const nowMs = currentTime;
    const isLeadOverdueLocal = (l: Lead) =>
      !!l.next_follow_up_at && new Date(l.next_follow_up_at).getTime() < nowMs;

    // 1. Manual override — caller picked a specific lead from the queue.
    //    Honors the YELLOW tier as well now.
    if (manuallyChosenId) {
      const r = filteredToDoQueue.find(x => x.lead.id === manuallyChosenId);
      if (r) {
        if (r.tier === "emergency") return { kind: "lead-emergency", lead: r.lead };
        if (r.tier === "yellow")    return { kind: "lead-yellow",    lead: r.lead, isOverdue: isLeadOverdueLocal(r.lead) };
        if (r.tier === "new")       return { kind: "lead-new",       lead: r.lead, isOverdue: isLeadOverdueLocal(r.lead) };
        return { kind: "lead-followup", lead: r.lead, isOverdue: isLeadOverdueLocal(r.lead) };
      }
    }

    // 2. Imminent / in-progress appointment (today only) — RED tier per spec.
    //    Still surfaces specially so the card shows the "running now" /
    //    "starts in N min" visual instead of a generic lead row.
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

    // 3. Emergency lead — NEVER honors the skip set (per prior behavior).
    const emergencyRow = filteredToDoQueue.find(r => r.tier === "emergency");
    if (emergencyRow) return { kind: "lead-emergency", lead: emergencyRow.lead };

    // 4. RED — unread client messages. Slotted ahead of YELLOW / NEW so a
    //    client waiting on a reply outranks outbound work. Skipped ids
    //    include msg-{thread_id}.
    for (const t of clientThreads) {
      if ((t.unread_count ?? 0) <= 0) continue;
      if (skippedIds.has(`msg-${t.id}`)) continue;
      return {
        kind: "msg-unread",
        threadId: t.id,
        clientName: t.client_name ?? "Client",
        preview: t.preview ?? "",
        unreadCount: t.unread_count ?? 0,
      };
    }

    // 5. YELLOW — present-the-case (attorney_accepted). Overdue first.
    const yellowRow = filteredToDoQueue.find(r => r.tier === "yellow" && !skippedIds.has(r.lead.id));
    if (yellowRow) return { kind: "lead-yellow", lead: yellowRow.lead, isOverdue: isLeadOverdueLocal(yellowRow.lead) };

    // 6. BLUE — at-risk follow-ups (overdue fee-quoted) BEFORE fresh NEW
    //    intake. This is the explicit "at-risk follow-ups ahead of starting
    //    NEW intake" rule from the priority spec.
    const overdueFollowup = filteredToDoQueue.find(
      r => r.tier === "followup" && !skippedIds.has(r.lead.id) && isLeadOverdueLocal(r.lead)
    );
    if (overdueFollowup) {
      return { kind: "lead-followup", lead: overdueFollowup.lead, isOverdue: true };
    }

    // 7. BLUE — fresh new-intake (status='new' / priority queue).
    const newRow = filteredToDoQueue.find(r => r.tier === "new" && !skippedIds.has(r.lead.id));
    if (newRow) return { kind: "lead-new", lead: newRow.lead, isOverdue: isLeadOverdueLocal(newRow.lead) };

    // 8. BLUE — fresh fee-quoted follow-ups.
    const followupRow = filteredToDoQueue.find(r => r.tier === "followup" && !skippedIds.has(r.lead.id));
    if (followupRow) return { kind: "lead-followup", lead: followupRow.lead, isOverdue: false };

    return { kind: "none" };
  }, [todaysAppts, filteredToDoQueue, clientThreads, skippedIds, manuallyChosenId, currentTime]);

  // ── Shared color-coded task list (LEFT column AllTasksWidget) ─────────────
  //
  // Color rules (RED â†’ ORANGE â†’ YELLOW â†’ BLUE), sort within each tier.
  //
  //   RED (top): in-progress + imminent appointments today, then unread
  //     client message threads, then emergency-urgency leads.
  //     NOTE — appts are STAFF-personal (a consult is booked for a specific
  //     staffer, not a shared coverage item). Everything else in the list
  //     is firm-shared. Messages + leads are not assigned per-staff today.
  //   ORANGE: urgency='urgent' leads not already in red.
  //   YELLOW: status='attorney_accepted' — completed intake + attorney
  //     reviewed; needs a call to present the case.
  //   BLUE: status='new' or 'contacted' (need to schedule) and status=
  //     'fee_quoted' (have fee, follow up). Within blue, presenting/intake
  //     work would have been Yellow, so all that's left is scheduling work.
  //
  // TODO (planned staff-setup model): once per-staff assignment + closer-
  // strength weighting lands, swap this from a flat shared list to a
  // weighted per-staff view. For now everyone sees the same pool.
  //
  // TODO (medium-priority bucket): ORANGE currently only contains urgent-
  // flagged leads. Other medium buckets (e.g. intake_complete awaiting
  // attorney review, no-show risk on a scheduled consult) could slot in
  // here once the rules are defined.
  const sharedTasks: TaskEntry[] = useMemo(() => {
    const out: TaskEntry[] = [];
    const nowMs = currentTime;

    // RED — appointments (in-progress first, then imminent).
    // DUE = appt start_time. This is the most reliable due value we have.
    for (const a of todaysAppts) {
      const startMs = new Date(a.start_time).getTime();
      const endMs   = new Date(a.end_time).getTime();
      const isInProgress = nowMs >= startMs && nowMs < endMs;
      const minsUntilStart = (startMs - nowMs) / 60_000;
      // Include in-progress + future-today appts. Past-and-done appts drop off.
      if (isInProgress || minsUntilStart > -1) {
        out.push({
          id: `appt-${a.id}`,
          color: "red",
          title: a.client_name,
          subtitle: `${formatTimeRange(a.start_time, a.end_time)}${a.chapter ? ` Â· Ch.${a.chapter}` : ""}${isInProgress ? " Â· in progress" : ""}`,
          actionLabel: "Open",
          sortKey: isInProgress ? 0 : Math.max(1, startMs / 60_000),
          due: a.start_time,
          onSelect: () => onChangeTab("calendar"),
        });
      }
    }

    // RED — unread client message threads.
    // DUE = undefined. client_message_threads has no due/SLA field today;
    // showing a fabricated due ("respond by …") would be invented data.
    // TODO Phase B: introduce a reply-SLA on threads + surface it here.
    for (const t of clientThreads) {
      if ((t.unread_count ?? 0) <= 0) continue;
      out.push({
        id: `msg-${t.id}`,
        color: "red",
        title: t.client_name ?? "Client",
        subtitle: `${t.unread_count} unread${t.preview ? ` Â· ${t.preview.slice(0, 48)}` : ""}`,
        actionLabel: "Reply",
        sortKey: 1_000_000 + (t.last_message_at ? -new Date(t.last_message_at).getTime() / 60_000 : 0),
        // due intentionally omitted — see comment above
        onSelect: () => onOpenView("messages"),
      });
    }

    // RED — emergency-urgency leads. DUE = next_follow_up_at when set.
    for (const l of leads) {
      if (l.urgency !== "emergency") continue;
      out.push({
        id: `lead-${l.id}`,
        color: "red",
        title: l.full_name,
        subtitle: `Emergency Â· ${l.phone ?? l.email ?? "—"}`,
        actionLabel: "Call",
        sortKey: 2_000_000 - new Date(l.created_at).getTime() / 60_000,
        due: l.next_follow_up_at ?? null,
        leadRef: l,
        onSelect: () => onScheduleConsult(l),
      });
    }

    // ORANGE — urgent leads (not already red). DUE = next_follow_up_at when set.
    for (const l of leads) {
      if (l.urgency === "emergency") continue;
      if (l.urgency !== "urgent") continue;
      out.push({
        id: `lead-${l.id}`,
        color: "orange",
        title: l.full_name,
        subtitle: `Urgent Â· ${l.phone ?? l.email ?? "—"}${l.chapter_interest ? ` Â· Ch.${l.chapter_interest}` : ""}`,
        actionLabel: "Call",
        sortKey: 3_000_000 - new Date(l.created_at).getTime() / 60_000,
        due: l.next_follow_up_at ?? null,
        leadRef: l,
        onSelect: () => onScheduleConsult(l),
      });
    }

    // YELLOW — attorney_accepted: present-the-case calls.
    // DUE = next_follow_up_at when set.
    for (const l of leads) {
      if (l.status !== "attorney_accepted") continue;
      out.push({
        id: `lead-${l.id}`,
        color: "yellow",
        title: l.full_name,
        subtitle: `Present the case${l.chapter_interest ? ` Â· Ch.${l.chapter_interest}` : ""}`,
        actionLabel: "Call",
        sortKey: 4_000_000 - new Date(l.created_at).getTime() / 60_000,
        due: l.next_follow_up_at ?? null,
        leadRef: l,
        onSelect: () => onScheduleConsult(l),
      });
    }

    // BLUE — scheduling + fee follow-ups. DUE = next_follow_up_at when set.
    for (const l of leads) {
      if (l.urgency === "emergency" || l.urgency === "urgent") continue;
      if (l.status === "attorney_accepted") continue;
      const needsScheduling =
        l.status === "new" || l.status === "contacted" || l.follow_up_queue === "priority";
      const feeFollowup = l.status === "fee_quoted";
      if (!needsScheduling && !feeFollowup) continue;
      out.push({
        id: `lead-${l.id}`,
        color: "blue",
        title: l.full_name,
        subtitle: feeFollowup
          ? `Fee quoted Â· follow up${l.chapter_interest ? ` Â· Ch.${l.chapter_interest}` : ""}`
          : `${l.status === "contacted" ? "Re-contact" : "Schedule"} Â· ${l.phone ?? l.email ?? "—"}`,
        actionLabel: feeFollowup ? "Follow up" : "Schedule",
        sortKey: 5_000_000 - new Date(l.created_at).getTime() / 60_000,
        due: l.next_follow_up_at ?? null,
        leadRef: l,
        onSelect: () => onScheduleConsult(l),
      });
    }

    // Stable sort by color tier, then by sortKey within tier.
    const colorRank: Record<TaskColor, number> = { red: 0, orange: 1, yellow: 2, blue: 3 };
    // Sort: color tier â†’ overdue first (within color) â†’ sortKey.
    //
    // The "overdue first within color" tiebreaker is what satisfies the
    // prioritization rule that at-risk follow-ups (overdue YELLOW/BLUE)
    // rank ahead of fresh items in the same color tier — e.g. an overdue
    // fee-quoted lead jumps to the top of BLUE ahead of fresh new-intake
    // BLUE rows. YELLOW (present-the-case) > BLUE (set-appointment) is
    // already baked into the color rank.
    const isOverdue = (t: TaskEntry) =>
      !!t.due && new Date(t.due).getTime() < nowMs;
    out.sort((a, b) => {
      const r = colorRank[a.color] - colorRank[b.color];
      if (r !== 0) return r;
      const oa = isOverdue(a) ? 0 : 1;
      const ob = isOverdue(b) ? 0 : 1;
      if (oa !== ob) return oa - ob;
      return a.sortKey - b.sortKey;
    });

    // TODO Phase B — Anthropic "analyze what's pressing" pass:
    //   Replace this static sort with (or layer on top of) a model call that
    //   considers natural-language context (urgency phrases in lead notes,
    //   case-type sensitivity, time-of-day, staffer workload). See
    //   `analyzePressingTasksAI` below — currently a stub that returns the
    //   static ordering unchanged.
    return analyzePressingTasksAI(out);
  }, [todaysAppts, clientThreads, leads, currentTime, onChangeTab, onOpenView, onScheduleConsult]);

  // Per-scope filter (Prompt 52) — sharedTasks variant. "mine" keeps
  // appointments (already pre-filtered upstream), keeps unread client
  // messages (no per-staff assignment), and filters lead-derived tasks
  // to those owned by this staffer OR not yet assigned. "shared" passes
  // everything through. (The matching filteredToDoQueue is declared
  // earlier in the file because nextTask references it.)
  const filteredTasks = useMemo(() => {
    if (taskScope === "shared") return sharedTasks;
    return sharedTasks.filter(t => {
      if (!t.leadRef) return true; // appts + messages stay visible
      const owner = t.leadRef.assigned_name;
      return owner === session.name || !owner;
    });
  }, [sharedTasks, taskScope, session.name]);

  // Count of tasks whose due timestamp is in the past. Tasks without a due
  // can't be overdue (per spec — no fabricated due dates). Drives the banner.
  // Reads from filteredTasks so "Mine" mode's banner reflects MY overdue
  // count, not the firm-wide overdue count.
  const overdueTasks = useMemo(
    () => filteredTasks.filter(t => !!t.due && new Date(t.due).getTime() < Date.now()),
    [filteredTasks]
  );
  const overdueCount = overdueTasks.length;

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

  // Call-result handlers — these are the "task marked Called" outcomes.
  //
  // ROUTING RULES (per the post-call workflow):
  //   - Reached & scheduling     â†’ handleScheduleConsult opens the scaffold
  //                                modal (SMS opt-in + email confirmation
  //                                previews) then runs the existing scheduler.
  //   - Reached & doing intake   â†’ handleDoIntakeNow (unchanged).
  //   - Left message / No answer â†’ patch the lead with follow_up_queue=
  //                                'priority' so it lands in the unified
  //                                Leads view's Follow-Up sub-tab.
  //   - Manual follow-up tag     â†’ handleAddToFollowUp (unchanged).
  //
  // The follow-up routing is REAL data — intake_leads.follow_up_queue
  // already exists. Real sends + opt-out tracking are NOT here — see
  // PostCallScheduledModal.tsx for the Twilio/SendGrid + consent TODO list.

  async function logCallOutcomeAndFollowUp(lead: Lead, outcome: "left_message" | "no_answer") {
    try {
      await sbPost("intake_contact_log", {
        lead_id: lead.id,
        channel: "phone",
        direction: "outbound",
        outcome,
        contacted_by: session.name,
        is_bot: false,
        notes: null,
      });
      // Patch builds on the existing write path. Setting follow_up_queue=
      // 'priority' is what surfaces the lead in the Follow-Up filter inside
      // the unified Leads view.
      const patch: { status?: string; last_contact_at: string; follow_up_queue: "priority" } = {
        last_contact_at: new Date().toISOString(),
        follow_up_queue: "priority",
      };
      if (lead.status === "new") patch.status = "contacted";
      await sbPatch("intake_leads", lead.id, patch);
    } finally {
      handleCollapse();
      onRefresh();
    }
  }

  async function handleLeftMessage(lead: Lead) {
    await logCallOutcomeAndFollowUp(lead, "left_message");
  }

  async function handleNoAnswer(lead: Lead) {
    await logCallOutcomeAndFollowUp(lead, "no_answer");
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

  // PostCallScheduledModal — opens BEFORE the existing scheduler so staff
  // see exactly what scaffold sends will fire after they book. Continue
  // routes through to onScheduleConsult; Cancel collapses the row.
  const [scheduledModalLead, setScheduledModalLead] = useState<Lead | null>(null);
  function handleScheduleConsult(lead: Lead) {
    handleCollapse();
    setScheduledModalLead(lead);
  }
  function handleScheduledModalContinue() {
    if (scheduledModalLead) onScheduleConsult(scheduledModalLead);
    setScheduledModalLead(null);
  }
  function handleScheduledModalCancel() {
    setScheduledModalLead(null);
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
      {/*
        TOPMOST — greeting line. Was previously inside the header-row beside
        the comms pill + clock + action buttons; pulled out so the dashboard
        opens with a quiet personalized line before the attention-needed
        bubble. The date subtitle moves up with it.
      */}
      <div className="min-w-0">
        <h2 className="text-lg font-medium text-[#FAFAF7]" style={{ fontFamily: "'Fraunces', Georgia, serif", letterSpacing: "-0.01em" }}>
          {greeting}, {session.name.split(" ")[0]}.
        </h2>
        <p className="text-xs text-[#6B6B66] mt-0.5">
          Your day at a glance — {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: FIRM_TZ })}
        </p>
      </div>

      {/*
        AttentionBubble — the red overdue bubble now consolidates:
          - the "You have N overdue tasks" heading + overdue list (kept)
          - "Ask for help" button (new scaffold; opens AskForHelpModal)
          - the Employee Time Clock compact pill (MOVED from the header row)
          - a compact unread-by-type messaging summary (MOVED from
            OverviewBubble — Overview now shows priority breakdown instead)
        Always renders (so the moved clock + messaging summary have a home
        even when nothing is overdue). The heading + red tone toggle based
        on overdueCount.
      */}
      <AttentionBubble
        overdueCount={overdueCount}
        overdueTasks={overdueTasks}
        staffMsgs={staffMsgs}
        clientThreads={clientThreads}
        timeClock={timeClock}
        timeClockActions={timeClockActions}
        onOpenMessagingPanel={onOpenView}
        onAskForHelp={() => setAskForHelpOpen(true)}
        onRequestTimeOff={(_kind) => {
          void _kind;
          onChangeTab("my_schedule");
        }}
      />

      {/* Client search row — searches the existing `leads` array by
          name/phone/email and routes a click into the lead detail panel. */}
      <div className="flex items-center justify-end">
        <ClientSearchBar
          className="w-full sm:w-80 lg:w-96"
          leads={leads}
          onOpen={(l) => {
            const full = leads.find(x => x.id === l.id);
            if (full) _onOpenLead(full);
          }}
          onBrowseAll={() => onChangeTab("leads")}
          placeholder="Search clients by name or phone…"
        />
      </div>

      <div className="flex items-start gap-3 relative flex-wrap">
        <div className="flex-1 min-w-0 flex items-center gap-3">
          {/* Comms pill bar (header) — quick-reply popovers per channel +
              tasks-due indicator. Stays in the header; distinct from the
              AttentionBubble's read-only messaging summary which just shows
              unread counts by type. */}
          <CommsPillBar
            staffMsgs={staffMsgs}
            clientThreads={clientThreads}
            sharedTasksCount={sharedTasks.length}
            onOpenMessagingPanel={onOpenView}
            onOpenPhoneDialer={() => setPhonePopoverOpen(true)}
            onOpenTasks={() => { /* tasks live in the LEFT column below; no-op for now */ }}
          />
        </div>

        {/* Escalate to Supervisor — scaffold modal (TODO: route to supervisor). */}
        <button
          onClick={() => setEscalateOpen(true)}
          title="Escalate to supervisor"
          className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-900/20 hover:bg-amber-900/30 border border-amber-700/40 px-3 py-1.5 rounded transition-colors"
        >
          <AlertTriangle className="w-3.5 h-3.5" /> Escalate to Supervisor
        </button>

        {/* Existing Client Leads — directs to the Leads tab (search/filter all leads). */}
        <button
          onClick={() => onChangeTab("leads")}
          title="Browse all existing client leads"
          className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-600 px-3 py-1.5 rounded transition-colors"
        >
          <Users className="w-3.5 h-3.5" /> Existing Client Leads
        </button>

        {/* New Client Lead — unchanged (gold, far right). */}
        {onLogNewLead && (
          <button
            onClick={onLogNewLead}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[#0F0F0E] bg-[#B8945F] hover:bg-[#C8A46F] px-3 py-1.5 rounded transition-colors"
            title="Open the New Client Lead window"
          >
            <span className="text-base leading-none">+</span> New Client Lead
          </button>
        )}

        {phonePopoverOpen && (
          <PhoneDialerPopover onClose={() => setPhonePopoverOpen(false)} />
        )}
      </div>

      {/* Top bubbles — Overview (now priority breakdown) + Performance / Goals.
          Clock + messaging summary moved into the AttentionBubble above;
          this row is now two equal columns.
          departments={[INTAKE_METRICS]} preserves the pre-Slice-1 behavior;
          Accounting + Legal will pass their own DeptMetricSet entries. */}
      <TopBubblesRow
        sharedTasks={sharedTasks}
        departments={[INTAKE_METRICS]}
      />

      {/*
        Three-column body via the shared DashboardGrid primitive (Slice-1).
          LEFT   (compact)  — AllTasksWidget OR ScheduleColumnView (toggle)
          MIDDLE (flex)     — Up Next & Outreach Queue
          RIGHT  (flex)     — Today hour-by-hour
        On narrow viewports the columns stack vertically.
      */}
      <DashboardGrid
        left={leftMode === "tasks" ? (
          <AllTasksWidget
            tasks={filteredTasks}
            sharedCount={sharedTasks.length}
            mode={leftMode}
            onChangeMode={setLeftMode}
            scope={taskScope}
            onChangeScope={setTaskScope}
            onOpenMyTasks={() => onChangeTab("staff_tasks")}
          />
        ) : (
          <ScheduleColumnView
            mode={leftMode}
            onChangeMode={setLeftMode}
            range={scheduleRange}
            onChangeRange={setScheduleRange}
            calEvents={calEvents}
            todayLocal={todayLocal}
            nextDayLocal={nextDayLocal}
            nextDayAppts={nextDayAppts}
            upcomingAppts={upcomingAppts}
            staffPool={staffPool}
            schedSelection={schedSelection}
            onChangeSchedSelection={setSchedSelection}
            currentSessionId={session.id}
            onChangeTab={onChangeTab}
          />
        )}

        middle={
          <TasksAndAppointmentsWidget
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
            onNoAnswer={handleNoAnswer}
            onAddToFollowUp={handleAddToFollowUp}
            onCancelExpansion={handleCollapse}
            onChangeTab={onChangeTab}
            onOpenMessages={() => onOpenView("messages")}
          />
        }

        right={
          <ConsolidatedMessagingWidget
            threads={clientThreads}
            staffMsgs={staffMsgs}
            loading={msgsLoading}
            onOpenView={onOpenView}
          />
        }
      />

      {/* Today hour-by-hour — full-width row below the 3-column grid. */}
      <TodayByHourWidget
        todaysAppts={todaysAppts}
        todayLocal={todayLocal}
        onChangeTab={onChangeTab}
      />

      {escalateOpen && (
        <EscalateModal
          leads={leads}
          session={session}
          onClose={() => setEscalateOpen(false)}
        />
      )}

      {scheduledModalLead && (
        <PostCallScheduledModal
          lead={{
            full_name: scheduledModalLead.full_name,
            phone: scheduledModalLead.phone,
            email: scheduledModalLead.email,
            sms_opt_out: scheduledModalLead.sms_opt_out,
          }}
          onCancel={handleScheduledModalCancel}
          onContinue={handleScheduledModalContinue}
        />
      )}

      {askForHelpOpen && (
        <AskForHelpModal onClose={() => setAskForHelpOpen(false)} />
      )}
    </div>
  );
}

// ─── TODAY — hour-by-hour grid (REAL, from calEvents) ────────────────────────

function TodayByHourWidget({
  todaysAppts, todayLocal, onChangeTab,
}: {
  todaysAppts: ApptRow[];
  todayLocal: string;
  onChangeTab: (tab: TabId) => void;
}) {
  // Bucket appts by start-hour (firm tz). An appt belongs to the slot of its
  // start hour even if it spills into the next slot.
  const byHour = useMemo(() => {
    const m = new Map<number, ApptRow[]>();
    for (const a of todaysAppts) {
      const h = hourOfIsoInFirmTz(a.start_time);
      const list = m.get(h) ?? [];
      list.push(a);
      m.set(h, list);
    }
    return m;
  }, [todaysAppts]);

  const hours: number[] = [];
  for (let h = BUSINESS_HOUR_START; h < BUSINESS_HOUR_END; h++) hours.push(h);

  const currentHour = hourOfIsoInFirmTz(new Date().toISOString());

  return (
    <Card>
      <CardHeader
        icon={<Clock className="w-4 h-4" />}
        title={`Today — ${formatDayLabel(todayLocal)}`}
        badge={<CountBadge value={todaysAppts.length} />}
        chip={
          <button
            onClick={() => onChangeTab("calendar")}
            className="text-[10px] font-semibold text-[#B8945F] hover:text-[#FAFAF7] transition-colors"
          >
            Open calendar â†’
          </button>
        }
      />
      <div className="p-4">
        <ul className="space-y-1">
          {hours.map(h => {
            const items = byHour.get(h) ?? [];
            const isCurrent = h === currentHour;
            return (
              <li
                key={h}
                className={`flex items-start gap-3 px-2 py-1.5 rounded ${
                  isCurrent ? "bg-[#B8945F]/10 border border-[#B8945F]/30" : ""
                }`}
              >
                <div className="w-14 flex-shrink-0">
                  <p className={`text-[11px] font-mono ${isCurrent ? "text-[#B8945F] font-bold" : "text-[#6B6B66]"}`}>
                    {formatHourLabel(h)}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-[#3A3A36] italic">—</p>
                  ) : (
                    <ul className="space-y-1">
                      {items.map(e => (
                        <li key={e.id}>
                          <button
                            onClick={() => onChangeTab("calendar")}
                            className="w-full text-left flex items-center gap-2 px-2 py-1 rounded bg-[#0F0F0E] hover:bg-[#2A2A28] border border-[#2A2A28] transition-colors"
                          >
                            <Calendar className="w-3 h-3 text-[#B8945F] flex-shrink-0" />
                            <span className="text-[11px] font-mono text-[#B8945F] flex-shrink-0">
                              {formatTimeRange(e.start_time, e.end_time)}
                            </span>
                            <span className="text-xs text-[#FAFAF7] truncate flex-1">
                              {e.client_name}
                            </span>
                            {e.chapter && (
                              <span className="text-[10px] text-[#6B6B66] flex-shrink-0">Ch.{e.chapter}</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-[10px] text-[#6B6B66] italic mt-3 px-2">
          Showing firm business hours ({formatHourLabel(BUSINESS_HOUR_START)}–{formatHourLabel(BUSINESS_HOUR_END)}).
          {/* TODO: per-staff work-hours config doesn't exist yet — swap to staffer's hours when it lands. */}
        </p>
      </div>
    </Card>
  );
}

// ─── Up Next + Outreach queue widget ─────────────────────────────────────────
// (The standalone NextBusinessDayWidget that used to live here was folded into
// `NextDayList` inside ScheduleColumnView — same calEvents source, compact for
// the LEFT column.)

interface TasksAndAppointmentsWidgetProps {
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
  onNoAnswer: (lead: Lead) => void;
  onAddToFollowUp: (lead: Lead) => void;
  onCancelExpansion: () => void;
  onChangeTab: (tab: TabId) => void;
  /** Routes the msg-unread Up Next variant into the Messaging panel. */
  onOpenMessages: () => void;
}

function TasksAndAppointmentsWidget(props: TasksAndAppointmentsWidgetProps) {
  const { toDoQueue, nextTask, onChangeTab } = props;

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={<ListChecks className="w-4 h-4" />}
        title="Up Next & Outreach Queue"
        badge={<CountBadge value={toDoQueue.length} />}
        chip={
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-[#B8945F]">
            <PlayCircle className="w-3 h-3" /> Start the next task
          </span>
        }
      />
      <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: 560 }}>
        <div>
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66]">To do</p>
            <span className="text-[10px] font-mono text-[#6B6B66]">{toDoQueue.length}</span>
            <button
              onClick={() => onChangeTab("leads")}
              className="ml-auto text-[10px] font-semibold text-[#B8945F] hover:text-[#FAFAF7] transition-colors"
            >
              View all â†’
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
            onOpenMessages={props.onOpenMessages}
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
                  onNoAnswer={() => props.onNoAnswer(row.lead)}
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

// EmptyHint moved to ../department-dashboard during Slice-1 (Prompt 54).

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
    yellow:    { label: "Present case",      cls: "bg-yellow-900/30 text-yellow-300 border-yellow-700/60" },
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
  nextTask, queue, onStartAppointment, onStartLeadCall, onSkip, onChoose, onOpenMessages,
}: {
  nextTask: NextTask;
  queue: ToDoRow[];
  onStartAppointment: () => void;
  onStartLeadCall: (leadId: string) => void;
  onSkip: (taskId: string) => void;
  onChoose: (leadId: string) => void;
  onOpenMessages: () => void;
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

  // "DO THIS NEXT" cue — small pill above the card body. The label encodes
  // *why* this is the most-pressing task (per the prioritization rules).
  function PriorityReason({ children }: { children: React.ReactNode }) {
    return (
      <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-[#B8945F]">
        <ChevronRight className="w-3 h-3" /> Do this next Â· <span className="text-[#FAFAF7]">{children}</span>
      </span>
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
        <div className="mt-1.5">
          <PriorityReason>
            {isInProgress ? "appointment running now" : `appointment in ${minutesUntilStart} min`}
          </PriorityReason>
        </div>
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

  // ── Unread client message — RED tier, slotted ahead of leads ─────────────
  if (nextTask.kind === "msg-unread") {
    const { threadId, clientName, preview, unreadCount } = nextTask;
    return (
      <UpNextShell tone="appointment">
        <UpNextHeader label="Up Next — client message">
          <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700/60">
            {unreadCount} unread
          </span>
        </UpNextHeader>
        <div className="mt-1.5">
          <PriorityReason>client waiting on a reply</PriorityReason>
        </div>
        <div className="flex items-start gap-3 mt-2">
          <Sparkles className="w-4 h-4 text-[#B8945F] mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#FAFAF7] truncate">{clientName}</p>
            <p className="text-[10px] text-[#6B6B66] truncate mt-0.5">
              {preview || "(no preview)"}
            </p>
          </div>
        </div>
        <UpNextActions
          primary={
            <button
              onClick={onOpenMessages}
              className="flex items-center gap-1.5 bg-[#B8945F] hover:bg-[#C8A46F] text-[#0F0F0E] font-bold text-xs px-3 py-1.5 rounded transition-colors"
            >
              <Sparkles className="w-3 h-3" /> Reply
            </button>
          }
          allowSkip
          onSkip={() => onSkip(`msg-${threadId}`)}
          onChooseAnother={() => setPickerOpen(o => !o)}
          pickerOpen={pickerOpen}
        />
        {pickerOpen && <ChoosePicker queue={queue} onPick={(id) => { onChoose(id); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />}
      </UpNextShell>
    );
  }

  // ── Lead (emergency / yellow / new / follow-up) ──────────────────────────
  const lead = nextTask.lead;
  const isEmergency = nextTask.kind === "lead-emergency";
  const isYellow    = nextTask.kind === "lead-yellow";
  const overdue     = !isEmergency && "isOverdue" in nextTask && nextTask.isOverdue;
  const tier: ToDoTier =
    isEmergency ? "emergency" :
    isYellow    ? "yellow"    :
    nextTask.kind === "lead-new" ? "new" : "followup";

  const reason =
    isEmergency ? "emergency lead" :
    isYellow    ? "present the case (attorney accepted)" :
    overdue     ? "at-risk follow-up (overdue)" :
    nextTask.kind === "lead-new" ? "first contact / set appointment" :
    "fee-quoted follow-up";

  return (
    <UpNextShell tone={isEmergency ? "emergency" : "lead"}>
      <UpNextHeader label={isEmergency ? "Up Next — emergency" : "Up Next"}>
        <TierChip tier={tier} />
        {overdue && !isEmergency && (
          <span className="text-[9px] font-bold uppercase tracking-widest px-1 py-0.5 rounded border border-red-700/60 bg-red-900/30 text-red-300">
            Overdue
          </span>
        )}
      </UpNextHeader>
      <div className="mt-1.5">
        <PriorityReason>{reason}</PriorityReason>
      </div>
      <div className="flex items-start gap-3 mt-2">
        {isEmergency
          ? <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          : <Sparkles className="w-4 h-4 text-[#B8945F] mt-0.5 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[#FAFAF7] truncate">{lead.full_name}</p>
          <p className="text-[10px] text-[#6B6B66] truncate mt-0.5">
            {lead.phone ?? lead.email ?? "—"}
            {lead.preferred_contact && <span> Â· prefers {lead.preferred_contact}</span>}
            {lead.chapter_interest && <span> Â· Ch.{lead.chapter_interest}</span>}
            <span> Â· {lead.status}</span>
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
  onScheduleConsult, onDoIntakeNow, onLeftMessage, onNoAnswer, onAddToFollowUp, onCancel,
}: {
  row: ToDoRow;
  expanded: boolean;
  onCall: () => void;
  onScheduleConsult: () => void;
  onDoIntakeNow: () => void;
  onLeftMessage: () => void;
  onNoAnswer: () => void;
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
            {lead.preferred_contact && <span> Â· prefers {lead.preferred_contact}</span>}
            {lead.chapter_interest && <span> Â· Ch.{lead.chapter_interest}</span>}
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
            Log call result {lead.phone ? <span className="font-mono text-[#B8945F]">Â· {lead.phone}</span> : null}
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
            {/* Call-outcome shortcuts — both "Left message" and "No answer"
                route the lead to the Follow-Up sub-tab of the unified Leads
                view (sets intake_leads.follow_up_queue='priority'). */}
            <div className="flex items-center gap-3 ml-auto">
              <button
                onClick={onLeftMessage}
                title="Log: left a voicemail. Lead moves to Follow-Up."
                className="text-[11px] text-[#6B6B66] hover:text-[#FAFAF7] transition-colors"
              >
                Left message
              </button>
              <button
                onClick={onNoAnswer}
                title="Log: no answer. Lead moves to Follow-Up."
                className="text-[11px] text-[#6B6B66] hover:text-[#FAFAF7] transition-colors"
              >
                No answer
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

// ConsolidatedMessagingWidget + MsgTab/UnifiedMsgRow + UnifiedChannelIcon
// + ScaffoldTabBody moved to ../department-dashboard during Slice-1
// (Prompt 54). Imported at the top of this file and re-exported.
// The original docs/header below are preserved against the module copy.
// (deleted in Slice-1 — see ../department-dashboard for canonical copy)

// ─── Phone dialer — popover (relocated from bottom of grid) ──────────────────
// Uses the same PhoneDialerWidget that previously rendered full-width at the
// bottom. The popover is anchored to the header phone-icon button and dismisses
// on backdrop click. Voicemail data inside the dialer is still SAMPLE.

function PhoneDialerPopover({ onClose }: { onClose: () => void }) {
  // Close on Escape + outside click.
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("keydown", onKey);
    // setTimeout: defer the listener so the click that opened the popover
    // doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener("mousedown", onClick), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
      clearTimeout(t);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 z-40 w-[640px] max-w-[95vw] shadow-2xl"
    >
      <PhoneDialerWidget />
    </div>
  );
}

// ─── Phone dialer widget (UI-COMPLETE on SAMPLE data) ────────────────────────
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
                      <p className="text-[10px] text-[#6B6B66]">{v.number} Â· {formatDuration(v.durationSeconds)}</p>
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

// AllTasksWidget + LeftModeToggle + TaskScopeToggle + ColorTag + ColorDot
// + DueLine + COLOR_CFG moved to ../department-dashboard during Slice-1
// (Prompt 54). Imported at the top of this file.
// (deleted in Slice-1 — see ../department-dashboard for canonical copy)

// ─── Schedule column view — toggle alternate for the LEFT column ─────────────

interface ScheduleColumnViewProps {
  mode: "tasks" | "schedule";
  onChangeMode: (m: "tasks" | "schedule") => void;
  range: "next_day" | "five_day" | "monthly";
  onChangeRange: (r: "next_day" | "five_day" | "monthly") => void;
  calEvents: CalEvent[];
  todayLocal: string;
  nextDayLocal: string;
  nextDayAppts: ApptRow[];
  upcomingAppts: ApptRow[];
  staffPool: SchedulerStaffDetail[];
  schedSelection: SchedulerSelection;
  onChangeSchedSelection: (s: SchedulerSelection) => void;
  currentSessionId: string;
  onChangeTab: (tab: TabId) => void;
}

function ScheduleColumnView(props: ScheduleColumnViewProps) {
  const {
    mode, onChangeMode, range, onChangeRange,
    calEvents, todayLocal, nextDayLocal,
    nextDayAppts, upcomingAppts, staffPool,
    schedSelection, onChangeSchedSelection, currentSessionId,
    onChangeTab,
  } = props;

  return (
    <Card className="flex flex-col">
      <div className="px-4 py-3 border-b border-[#2A2A28]">
        <div className="flex items-center gap-2">
          <span className="text-[#B8945F]"><CalendarDays className="w-4 h-4" /></span>
          <h3 className="text-sm font-semibold text-[#FAFAF7]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            My Schedule
          </h3>
          <button
            onClick={() => onChangeTab("calendar")}
            className="ml-auto text-[10px] font-semibold text-[#B8945F] hover:text-[#FAFAF7] transition-colors"
          >
            Open full â†’
          </button>
        </div>
        <LeftModeToggle mode={mode} onChangeMode={onChangeMode} />
        <div className="flex items-center gap-1 mt-2 rounded border border-[#2A2A28] p-0.5 bg-[#0F0F0E]">
          {(["next_day", "five_day", "monthly"] as const).map(r => (
            <button
              key={r}
              onClick={() => onChangeRange(r)}
              className={`flex-1 text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded transition-colors ${
                range === r ? "bg-[#2A2A28] text-[#FAFAF7]" : "text-[#6B6B66] hover:text-[#FAFAF7]"
              }`}
            >
              {r === "next_day" ? "Next day" : r === "five_day" ? "5-day" : "Monthly"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 overflow-y-auto" style={{ maxHeight: 720 }}>
        {range === "next_day" && (
          <NextDayList
            appts={nextDayAppts}
            nextDayLocal={nextDayLocal}
            fallbackUpcoming={upcomingAppts}
            onSelect={() => onChangeTab("calendar")}
          />
        )}
        {range === "five_day" && (
          <div>
            <ConsultSchedulerPanel
              staffPool={staffPool}
              calEvents={calEvents as unknown as SchedulerCalEvent[]}
              currentSessionId={currentSessionId}
              selection={schedSelection}
              onChangeSelection={onChangeSchedSelection}
              todayLocal={todayLocal}
            />
            <p className="text-[10px] text-[#6B6B66] italic mt-3 px-1 leading-snug">
              View-only here Â· tapping a slot does not book.
              {/* TODO booking from the dashboard: route a confirmed slot pick
                  through the existing NewLeadInline booking RPC. */}
            </p>
          </div>
        )}
        {range === "monthly" && (
          <MonthGridView
            calEvents={calEvents}
            todayLocal={todayLocal}
            onSelectDay={() => onChangeTab("calendar")}
          />
        )}
      </div>
    </Card>
  );
}

function NextDayList({
  appts, nextDayLocal, fallbackUpcoming, onSelect,
}: {
  appts: ApptRow[];
  nextDayLocal: string;
  fallbackUpcoming: ApptRow[];
  onSelect: () => void;
}) {
  const showFallback = appts.length === 0 && fallbackUpcoming.length > 0;
  const rows = appts.length > 0 ? appts : fallbackUpcoming.slice(0, 5);
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1.5 px-1">
        {formatDayLabel(nextDayLocal)}
      </p>
      {showFallback && (
        <p className="text-[10px] text-[#6B6B66] italic px-1 mb-2">
          Nothing booked for the next business day — showing further upcoming.
        </p>
      )}
      {rows.length === 0 ? (
        <EmptyHint>No upcoming consults.</EmptyHint>
      ) : (
        <ul className="space-y-1.5">
          {rows.map(e => (
            <li key={e.id}>
              <button
                onClick={onSelect}
                className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-[#2A2A28] text-left transition-colors"
              >
                <Calendar className="w-3 h-3 text-[#6B6B66] mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono text-[#B8945F] truncate">
                    {formatDateLabel(e.start_time)} Â· {formatTimeRange(e.start_time, e.end_time)}
                  </p>
                  <p className="text-xs text-[#FAFAF7] truncate mt-0.5">
                    {e.client_name}
                    <span className="text-[#6B6B66]">{e.chapter ? ` Â· Ch.${e.chapter}` : ""}</span>
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Month grid (scaffold) — counts consult events per day from calEvents ────
// View-only. Reuses the same calEvents prop everything else here pulls from.

function MonthGridView({
  calEvents, todayLocal, onSelectDay,
}: {
  calEvents: CalEvent[];
  todayLocal: string;
  onSelectDay: (dateStr: string) => void;
}) {
  const [cursor, setCursor] = useState<{ year: number; month: number }>(() => {
    const [y, m] = todayLocal.split("-").map(Number);
    return { year: y, month: m - 1 };
  });

  const dayCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of calEvents) {
      if (e.event_subtype !== "consultation") continue;
      if (["cancelled", "no_show", "rescheduled"].includes(e.status)) continue;
      const d = new Date(e.start_time).toLocaleDateString("en-CA", { timeZone: FIRM_TZ });
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  }, [calEvents]);

  // 6Ã—7 month grid starting on Sunday.
  const firstOfMonth = new Date(Date.UTC(cursor.year, cursor.month, 1));
  const startDow = firstOfMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
  const cells: ({ dateStr: string; day: number; inMonth: boolean } | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(cursor.month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push({ dateStr: `${cursor.year}-${mm}-${dd}`, day: d, inMonth: true });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(Date.UTC(cursor.year, cursor.month, 1)).toLocaleDateString("en-US", {
    month: "long", year: "numeric", timeZone: "UTC",
  });

  function shift(delta: number) {
    setCursor(c => {
      const next = new Date(Date.UTC(c.year, c.month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <button
          onClick={() => shift(-1)}
          className="text-[#6B6B66] hover:text-[#FAFAF7] transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#FAFAF7] flex-1 text-center">
          {monthLabel}
        </p>
        <button
          onClick={() => shift(1)}
          className="text-[#6B6B66] hover:text-[#FAFAF7] transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="text-[9px] font-semibold text-[#6B6B66]">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c, i) => {
          if (!c) return <span key={i} className="aspect-square" />;
          const count = dayCounts.get(c.dateStr) ?? 0;
          const isToday = c.dateStr === todayLocal;
          return (
            <button
              key={i}
              onClick={() => onSelectDay(c.dateStr)}
              className={`aspect-square flex flex-col items-center justify-center rounded text-[10px] transition-colors ${
                isToday
                  ? "bg-[#B8945F]/20 border border-[#B8945F]/40 text-[#FAFAF7]"
                  : "border border-transparent hover:border-[#2A2A28] hover:bg-[#2A2A28] text-[#FAFAF7]"
              }`}
              title={count > 0 ? `${count} consult${count > 1 ? "s" : ""}` : ""}
            >
              <span className="font-mono leading-none">{c.day}</span>
              {count > 0 && (
                <span className="text-[8px] font-bold text-[#B8945F] mt-0.5">{count}</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-[#6B6B66] italic mt-3 px-1 leading-snug">
        Counts are consult events from calendar_events (this firm).
        {/* TODO: hover/click could expand a day-detail panel with the
            actual appts; for now we route the user to the full calendar tab. */}
      </p>
    </div>
  );
}

// TopBubblesRow + OverviewBubble + RetentionBubble + GoalMetricRow et al.
// + ClockBubble + ClockPopup + CompactStat + formatHm + BubbleCard +
// PlaceholderValue + AttentionBubble + UnreadStat moved to
// ../department-dashboard during Slice-1 (Prompt 54). Imported at the
// top of this file.
// (deleted in Slice-1 - see ../department-dashboard for canonical copy)

// ─── AskForHelpModal — SCAFFOLD reassignment-request flow ───────────────────
//
// Surfaces from the AttentionBubble's "Ask for help" button. Today's body is
// a placeholder explaining what the full flow will do — a staffer flags a
// task or lead for reassignment, picks a teammate (or "any available"),
// adds a one-line note, and sends. No real send today.
//
// TODO Phase B — reassignment request wiring:
//   - new table `staff_coverage_request (id, firm_id, requested_by,
//     target_id, target_kind ('task' | 'lead'), reason, assigned_to (nullable),
//     status, created_at, resolved_at)`
//   - notify same-department staffers via the existing CommsPillBar /
//     FloatingChat channels; supervisor surfaces unresolved requests
//   - the staffer's request appears in the recipient's Up Next as a RED
//     task until they accept or decline (shares the `requestOpenLead` gate)

function AskForHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ask for help"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[#2A2A28] bg-[#1A1A18] shadow-2xl">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#2A2A28]">
          <Users className="w-4 h-4 text-[#B8945F]" />
          <h3 className="text-sm font-bold text-[#FAFAF7]">Ask for help</h3>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-1.5 py-0.5 rounded">
            Scaffold
          </span>
          <button onClick={onClose} aria-label="Close" className="ml-auto text-[#6B6B66] hover:text-[#FAFAF7]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-[#FAFAF7] leading-relaxed">
            Need backup on something? Flag a task or lead for reassignment to a teammate —
            handy when you're stretched thin or stepping out.
          </p>

          {/* Disabled scaffold form — no submit handler. */}
          <div className="space-y-2">
            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">
                What needs help?
              </span>
              <select
                disabled
                className="w-full bg-[#0F0F0E] border border-[#2A2A28] text-[#6B6B66] text-xs rounded px-2 py-1.5 cursor-not-allowed"
              >
                <option>— pick a task or lead —</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">
                Assign to
              </span>
              <select
                disabled
                className="w-full bg-[#0F0F0E] border border-[#2A2A28] text-[#6B6B66] text-xs rounded px-2 py-1.5 cursor-not-allowed"
              >
                <option>Any available teammate (default)</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">
                Quick note (optional)
              </span>
              <textarea
                disabled
                rows={2}
                placeholder="Anything the teammate should know?"
                className="w-full bg-[#0F0F0E] border border-[#2A2A28] text-[#6B6B66] text-xs rounded px-2 py-1.5 cursor-not-allowed placeholder-[#3A3A36]"
              />
            </label>
          </div>

          <div className="rounded-lg border border-dashed border-[#3A3A36] bg-[#0F0F0E] px-3 py-2">
            <p className="text-[11px] text-[#6B6B66] leading-snug">
              Coming soon — reassignment routing needs the
              <code className="font-mono text-[#FAFAF7]"> staff_coverage_request </code>
              table + supervisor escalation if no coverage. The recipient sees the request as
              a RED task in their Up Next.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="text-xs font-semibold text-[#6B6B66] hover:text-[#FAFAF7] px-3 py-1.5 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled
              title="Send — wiring pending"
              className="text-xs font-bold text-[#0F0F0E] bg-[#B8945F]/60 px-3 py-1.5 rounded cursor-not-allowed"
            >
              Send request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI "analyze what's pressing" — SCAFFOLD ────────────────────────────────
//
// Today this is a pass-through: returns the statically-sorted list unchanged.
//
// TODO Phase B — Anthropic API integration:
//   1. Build a compact, privacy-aware payload for each task: color, due,
//      lead status, last-contact age, urgency phrases extracted from notes.
//   2. Call Anthropic with a system prompt that explains the firm's
//      priority rules + asks for a re-ranked list with one-sentence
//      justifications.
//   3. Cache by (taskIds-hash, hour-of-day) so the same set doesn't
//      hit the API every render.
//   4. Show the AI's reasoning chip on the Up Next card ("Anthropic: high
//      urgency — foreclosure mentioned in notes").
//   5. Add an opt-in toggle per staffer (some staffers may prefer the
//      static rules; the AI ranking shouldn't be the only path).
//
// Until those land, the static rule-based sort already does the work — no
// LLM call happens here.

function analyzePressingTasksAI(staticOrdered: TaskEntry[]): TaskEntry[] {
  // Scaffold — return the static ordering verbatim. See TODO above.
  return staticOrdered;
}

// ─── Escalate to Supervisor — SCAFFOLD modal ────────────────────────────────
//
// TODO Phase B — routing: pick a department supervisor (from staff_members
// where role/title matches) and either (a) create a staff_messages row to that
// supervisor with the lead context, or (b) write a new escalations row that
// surfaces in a supervisor inbox. Submit is currently no-op.

function EscalateModal({
  leads, session, onClose,
}: { leads: Lead[]; session: PortalSession; onClose: () => void }) {
  const [notRelatedToClient, setNotRelatedToClient] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const matches = useMemo(() => {
    if (notRelatedToClient) return [] as Lead[];
    if (!query.trim()) return [] as Lead[];
    const q = query.toLowerCase();
    return leads
      .filter(l =>
        l.full_name.toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        (l.phone ?? "").includes(q)
      )
      .slice(0, 8);
  }, [leads, query, notRelatedToClient]);

  const selectedLead = selectedLeadId ? leads.find(l => l.id === selectedLeadId) ?? null : null;

  function handleSubmit() {
    // SCAFFOLD: do not write anything. Show a small "coming soon" note then
    // close after the user dismisses.
    // TODO route the escalation to the department supervisor (see header comment).
    void session; // prevent unused-prop warnings while wiring is pending.
    setSubmitted(true);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Escalate to supervisor"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl border border-[#2A2A28] bg-[#1A1A18] shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2A2A28]">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-[#FAFAF7]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            Escalate to Supervisor
          </h3>
          <ComingSoonChip />
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto text-[#6B6B66] hover:text-[#FAFAF7] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-5 space-y-3">
            <p className="text-sm text-[#FAFAF7]">
              Coming soon — routing to the department supervisor isn't wired yet.
            </p>
            <p className="text-[11px] text-[#6B6B66]">
              Your reason and the selected lead were captured locally only; nothing was sent.
            </p>
            <div className="flex justify-end pt-1">
              <button
                onClick={onClose}
                className="text-xs font-semibold text-[#0F0F0E] bg-[#B8945F] hover:bg-[#C8A46F] px-3 py-1.5 rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div>
              <label className="flex items-center gap-2 text-xs text-[#FAFAF7] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={notRelatedToClient}
                  onChange={(e) => {
                    setNotRelatedToClient(e.target.checked);
                    if (e.target.checked) {
                      setSelectedLeadId(null);
                      setQuery("");
                    }
                  }}
                  className="accent-[#B8945F]"
                />
                Not related to a client — needs escalation
              </label>
            </div>

            {!notRelatedToClient && (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1.5">
                  Related client / lead
                </label>
                {selectedLead ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded border border-[#2A2A28] bg-[#0F0F0E]">
                    <Users className="w-3.5 h-3.5 text-[#B8945F]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#FAFAF7] truncate">{selectedLead.full_name}</p>
                      <p className="text-[10px] text-[#6B6B66] truncate">
                        {selectedLead.phone ?? selectedLead.email ?? "—"}
                      </p>
                    </div>
                    <button
                      onClick={() => { setSelectedLeadId(null); setQuery(""); }}
                      className="text-[#6B6B66] hover:text-[#FAFAF7] transition-colors"
                      aria-label="Clear selection"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 rounded border border-[#2A2A28] bg-[#0F0F0E]">
                      <Search className="w-3.5 h-3.5 text-[#6B6B66] flex-shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search name, phone, or email"
                        className="flex-1 bg-transparent text-xs text-[#FAFAF7] placeholder-[#6B6B66] outline-none"
                      />
                    </div>
                    {query.trim() && (
                      <ul className="mt-1 max-h-40 overflow-y-auto rounded border border-[#2A2A28] bg-[#0F0F0E]">
                        {matches.length === 0 ? (
                          <li className="px-3 py-2 text-[11px] text-[#6B6B66] italic">No matches.</li>
                        ) : (
                          matches.map(l => (
                            <li key={l.id}>
                              <button
                                onClick={() => setSelectedLeadId(l.id)}
                                className="w-full text-left px-3 py-2 hover:bg-[#2A2A28] transition-colors"
                              >
                                <p className="text-xs text-[#FAFAF7] truncate">{l.full_name}</p>
                                <p className="text-[10px] text-[#6B6B66] truncate">
                                  {l.phone ?? l.email ?? "—"} Â· {l.status}
                                </p>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1.5">
                Reason / details
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="What needs the supervisor's attention?"
                className="w-full bg-[#0F0F0E] border border-[#2A2A28] rounded px-3 py-2 text-xs text-[#FAFAF7] placeholder-[#6B6B66] outline-none focus:border-[#B8945F]/60"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                className="text-xs font-semibold text-[#6B6B66] hover:text-[#FAFAF7] px-3 py-1.5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason.trim() || (!notRelatedToClient && !selectedLeadId)}
                className="text-xs font-semibold text-[#0F0F0E] bg-[#B8945F] hover:bg-[#C8A46F] disabled:bg-[#2A2A28] disabled:text-[#6B6B66] disabled:cursor-not-allowed px-3 py-1.5 rounded transition-colors"
                title="Submit — routing pending"
              >
                Submit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}