// New-lead logging window (Phase A).
//
// Full-window experience opened when a legal admin logs a NEW inbound caller
// who is not yet in the system. Replaces the modal-only NewLeadModal flow.
//
// What's REAL:
//   - lead row creation in intake_leads (assigned_name = session.name)
//   - in-system dedup check (intake_leads + clients) on phone/email
//   - inline today's availability strip via get_open_slots RPC
//   - smart-routing recommendation client-side (role_level + load + Layer-1 nextTask)
//   - "Do consult now" — books an immediate consult via book_consultation RPC
//   - "Schedule consult" — defers to the existing lead-detail flow
//
// What's NOT real this phase (per spec):
//   - "Send intake invite" / "Send SMS request" buttons — render only, click
//     logs to console. Real dispatch wires in Phase B when intake_leads gains
//     an sms_email_consent column and sendGate's resolver is extended.
//   - The consent checkbox captures form state only — no persistence this phase.
//
// Locked Client Portal questionnaire is NOT referenced or modified.
// BankruptcyIntake is NOT referenced or modified.

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, AlertCircle, Calendar, ChevronLeft, ChevronRight,
  MessageSquare, PhoneCall, Plus, RefreshCw, Send,
  Sparkles, UserCheck, Users,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

// TODO firm-aware refactor (BAN-40 phase 2): read from firms.id / firms.state
// for the current admin's firm context. For the MLG pilot, hardcoded constant.
const V1_DEFAULT_FIRM_ID = "00000000-0000-0000-0000-000000000001";
// TODO firm-aware refactor: replace with firms.state when available.
const DEFAULT_FIRM_STATE = "AZ";

// Mirrors the constant in IntakeDashboard.tsx (Layer 1 Next Task engine).
const IMMINENT_APPT_WINDOW_MIN = 15;
const FIRM_TZ = "America/Los_Angeles";  // TODO: per-firm tz (firms.timezone)

const DEFAULT_SLOT_MINUTES = 45;
// Buffer so book_consultation's "p_start_time < now() - 1 minute" check never
// trips on round-trip latency between the client clock and the server clock.
const IMMEDIATE_START_BUFFER_MS = 60_000;

// ─── Date helpers (firm-tz, calendar-date-string arithmetic) ─────────────────
// All date strings are YYYY-MM-DD in firm tz. Lexicographic compare on these
// strings is equivalent to chronological compare, which we lean on for the
// "is past day?" floor check in the date picker.

function todayInFirmTz(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: FIRM_TZ });
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// Next business day from today in firm tz. Sat → Mon, Sun → Mon, Fri → Mon,
// Mon-Thu → next day. Used as the day-view default so staff land on a date
// that's likely to have open slots (today is often back-loaded, and the firm
// is closed on weekends).
function nextBusinessDayFromTodayInFirmTz(): string {
  let d = shiftDate(todayInFirmTz(), 1);
  while (true) {
    const [y, m, day] = d.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
    if (dow !== 0 && dow !== 6) break;
    d = shiftDate(d, 1);
  }
  return d;
}

function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric", timeZone: "UTC",
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PortalSession {
  id: string;
  name: string;
  role: string;
  title: string | null;
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

interface StaffDetail {
  id: string;
  name: string;
  role: string | null;
  role_level: number | null;
  intake_portal_role: string | null;
  is_active: boolean;
}

interface OpenSlot {
  staff_id: string;
  staff_name: string;
  slot_start: string;
  slot_end: string;
  available: boolean;
  reason: string | null;
}

interface DedupHit {
  source: "intake_leads" | "clients";
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status?: string;
}

interface RecommendedStaff {
  staff: StaffDetail;
  hasImmediateSlot: boolean;       // a >= DEFAULT_SLOT_MINUTES window opens within IMMINENT_APPT_WINDOW_MIN
  hasImminentAppt: boolean;        // they have an appt starting within IMMINENT_APPT_WINDOW_MIN
  nextSlotStart: string | null;    // earliest available slot today, ISO
  todayLoad: number;               // count of consults already today
  rankTier: 1 | 2 | 3;
}

interface NewLeadInlineProps {
  session: PortalSession;
  /** Used for "today's load" + imminent-appt detection in smart routing. */
  calEvents: CalEvent[];
  onExit: () => void;
  onSaved: (leadId: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NewLeadInline({
  session, calEvents, onExit, onSaved,
}: NewLeadInlineProps) {
  // ── Form state ────────────────────────────────────────────────────────────
  // Name split into First/Last so the joint-filing flow (Phase B) can drive
  // both Debtor 1 and Debtor 2 records directly. Joined to intake_leads.full_name
  // on insert — no schema change this phase.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [phone, setPhone]         = useState("");
  const [email, setEmail]         = useState("");
  const [source, setSource]       = useState("inbound");
  const [chapter, setChapter]     = useState<string>("7");
  const [state, setState]         = useState(DEFAULT_FIRM_STATE);
  // Marital status + optional spouse name. Stored inside notes for Phase A —
  // structured marital_status / spouse_name columns are a Phase B migration
  // (they unlock the joint Debtor 1 / Debtor 2 record split downstream).
  const [maritalStatus, setMaritalStatus] = useState<"individual" | "married_joint">("individual");
  const [spouseName, setSpouseName]       = useState("");
  // Urgent-matter selector replaces the legacy free-form urgency dropdown.
  // Mapped to the existing urgency enum on insert so the Up Next priority
  // engine keeps ranking by 'emergency' / 'urgent' / 'normal' today.
  // Structured urgent_matter_type / foreclosure_date columns are a Phase B
  // migration so the priority engine can read them directly instead of
  // parsing free text out of pre_screen_notes.
  const [urgentMatter, setUrgentMatter] =
    useState<"none" | "foreclosure" | "garnishment" | "legal_action" | "other">("none");
  const [foreclosureDate, setForeclosureDate] = useState("");
  const [urgentDetail, setUrgentDetail]       = useState("");
  const [preferred, setPreferred] = useState("phone");
  const [notes, setNotes]         = useState("");
  // SMS / email consent for invite buttons. Captured in form state only —
  // persistence to intake_leads.sms_email_consent is a Phase B migration.
  const [consent, setConsent]     = useState(false);

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const mappedUrgency: "normal" | "urgent" | "emergency" =
    urgentMatter === "foreclosure" || urgentMatter === "legal_action" ? "emergency" :
    urgentMatter === "garnishment"                                    ? "urgent"    :
    urgentMatter === "other"                                          ? "urgent"    :
                                                                        "normal";

  // ── In-flight state ───────────────────────────────────────────────────────
  const [saving, setSaving]               = useState(false);
  const [bookingNow, setBookingNow]       = useState(false);
  const [bookError, setBookError]         = useState<string | null>(null);

  // ── Dedup ─────────────────────────────────────────────────────────────────
  const [dedupHits, setDedupHits] = useState<DedupHit[]>([]);
  useEffect(() => {
    const e = email.trim().toLowerCase();
    const digits = phone.replace(/\D/g, "");
    const last4 = digits.slice(-4);
    if (e.length < 4 && last4.length < 4) {
      setDedupHits([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const hits: DedupHit[] = [];
      // intake_leads — match by email OR by phone-last-4 (covers (xxx) xxx-XXXX formatting)
      try {
        const orParts: string[] = [];
        if (e.length >= 4) orParts.push(`email.ilike.${e}`);
        if (last4.length === 4) orParts.push(`phone.ilike.%${last4}%`);
        if (orParts.length > 0) {
          const { data } = await supabase
            .from("intake_leads")
            .select("id,full_name,phone,email,status")
            .or(orParts.join(","))
            .limit(5);
          if (!cancelled && data) {
            for (const r of data) {
              hits.push({ source: "intake_leads", id: r.id, name: r.full_name, phone: r.phone, email: r.email, status: r.status });
            }
          }
        }
      } catch { /* best-effort */ }
      // clients — same heuristic
      try {
        const orParts: string[] = [];
        if (e.length >= 4) orParts.push(`email.ilike.${e}`);
        if (last4.length === 4) orParts.push(`phone.ilike.%${last4}%`);
        if (orParts.length > 0) {
          const { data } = await supabase
            .from("clients")
            .select("id,name,phone,email,status")
            .or(orParts.join(","))
            .limit(5);
          if (!cancelled && data) {
            for (const r of data) {
              hits.push({ source: "clients", id: r.id, name: r.name, phone: r.phone, email: r.email, status: r.status });
            }
          }
        }
      } catch { /* best-effort */ }
      if (!cancelled) setDedupHits(hits);
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [phone, email]);

  // ── Staff details (role_level + intake_portal_role) ──────────────────────
  const [staffDetails, setStaffDetails] = useState<StaffDetail[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("staff_members")
        .select("id,name,role,role_level,intake_portal_role,is_active")
        .eq("is_active", true)
        .in("intake_portal_role", ["legal_admin", "super_admin", "attorney_super_admin"])
        .order("role_level", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      if (!cancelled && data) setStaffDetails(data as StaffDetail[]);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Day-view selection + slot map per staff (REAL via get_open_slots RPC) ─
  // todayLocal is the "today" floor used by the date picker + the
  // is-selected-today decision (drives whether "Do Consult Now" can fire).
  // selectedDate defaults to the next business day — staff land on a day
  // that's likely to have open slots rather than today (often back-loaded
  // or, on weekends, completely closed).
  const todayLocal = useMemo(() => todayInFirmTz(), []);
  const [selectedDate, setSelectedDate] = useState<string>(() => nextBusinessDayFromTodayInFirmTz());
  const isSelectedToday = selectedDate === todayLocal;

  const [slotsByStaff, setSlotsByStaff] = useState<Map<string, OpenSlot[]>>(new Map());
  const [slotsLoading, setSlotsLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setSlotsLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("get_open_slots", {
        p_staff_id: null,
        p_date: selectedDate,
        p_firm_id: V1_DEFAULT_FIRM_ID,
        p_slot_minutes: DEFAULT_SLOT_MINUTES,
      });
      if (cancelled) return;
      const map = new Map<string, OpenSlot[]>();
      if (!error && Array.isArray(data)) {
        for (const s of data as OpenSlot[]) {
          if (!map.has(s.staff_id)) map.set(s.staff_id, []);
          map.get(s.staff_id)!.push(s);
        }
        for (const arr of map.values()) {
          arr.sort((a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime());
        }
      }
      setSlotsByStaff(map);
      setSlotsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedDate]);

  // ── Per-staff recommendation metrics ──────────────────────────────────────
  // Metrics are computed relative to the currently selected day. "Imminent"
  // and "immediate" are TODAY-only concepts — they never apply when the
  // staffer is browsing a future date (so the Do-Consult-Now button hides
  // and the routing falls back to "earliest slot on this day").
  const recommendations: RecommendedStaff[] = useMemo(() => {
    const nowMs = Date.now();
    const out: RecommendedStaff[] = [];
    for (const staff of staffDetails) {
      const slots = slotsByStaff.get(staff.id) ?? [];
      // Load on the selected day — count of consults this staff has booked
      // on the date currently in view.
      const todayLoad = calEvents.filter(e => {
        if (e.staff_id !== staff.id) return false;
        if (e.event_subtype !== "consultation") return false;
        if (["cancelled", "no_show", "rescheduled"].includes(e.status)) return false;
        const d = new Date(e.start_time).toLocaleDateString("en-CA", { timeZone: FIRM_TZ });
        return d === selectedDate;
      }).length;
      const hasImminentAppt = isSelectedToday && calEvents.some(e => {
        if (e.staff_id !== staff.id) return false;
        if (e.event_subtype !== "consultation") return false;
        if (["cancelled", "no_show", "rescheduled"].includes(e.status)) return false;
        const startMs = new Date(e.start_time).getTime();
        const endMs = new Date(e.end_time).getTime();
        if (nowMs >= startMs && nowMs < endMs) return true;
        const minsUntil = (startMs - nowMs) / 60_000;
        return minsUntil > 0 && minsUntil <= IMMINENT_APPT_WINDOW_MIN;
      });
      const availableSlots = slots.filter(s => s.available);
      const hasImmediateSlot = isSelectedToday && availableSlots.some(s => {
        const startMs = new Date(s.slot_start).getTime();
        const minsUntil = (startMs - nowMs) / 60_000;
        return minsUntil >= -DEFAULT_SLOT_MINUTES && minsUntil <= IMMINENT_APPT_WINDOW_MIN;
      });
      // For today: future slots only (start > now). For future days: every
      // available slot on the calendar qualifies — nothing has happened yet.
      const futureAvail = isSelectedToday
        ? availableSlots.filter(s => new Date(s.slot_start).getTime() > nowMs)
        : availableSlots;
      const nextSlotStart = futureAvail.length > 0 ? futureAvail[0].slot_start : null;

      const rankTier: 1 | 2 | 3 =
        !hasImminentAppt && hasImmediateSlot ? 1 :
        !hasImminentAppt && nextSlotStart    ? 2 :
                                                3;
      out.push({ staff, hasImmediateSlot, hasImminentAppt, nextSlotStart, todayLoad, rankTier });
    }
    out.sort((a, b) => {
      if (a.rankTier !== b.rankTier) return a.rankTier - b.rankTier;
      const ar = a.staff.role_level ?? 99;
      const br = b.staff.role_level ?? 99;
      if (ar !== br) return ar - br;
      if (a.todayLoad !== b.todayLoad) return a.todayLoad - b.todayLoad;
      return a.staff.name.localeCompare(b.staff.name);
    });
    return out;
  }, [staffDetails, slotsByStaff, calEvents, selectedDate, isSelectedToday]);

  // Choose default admin: prefer current session admin if they're in tier 1;
  // otherwise the top-ranked recommendation. Outranked surfaces in UI.
  const currentAdminRec = recommendations.find(r => r.staff.id === session.id) ?? null;
  const topRec = recommendations[0] ?? null;
  const defaultPickRec: RecommendedStaff | null =
    currentAdminRec && currentAdminRec.rankTier === 1 ? currentAdminRec : topRec;
  const isOutranked = !!defaultPickRec && !!currentAdminRec && defaultPickRec.staff.id !== session.id;
  const currentIsBlocked = !!currentAdminRec && (currentAdminRec.hasImminentAppt || !currentAdminRec.hasImmediateSlot);

  const [pickedStaffId, setPickedStaffId] = useState<string | null>(null);
  const effectiveStaffId = pickedStaffId ?? defaultPickRec?.staff.id ?? null;
  const effectiveRec = effectiveStaffId
    ? recommendations.find(r => r.staff.id === effectiveStaffId) ?? null
    : null;

  // ── Save / book handlers ──────────────────────────────────────────────────

  async function createLeadOnly(): Promise<string | null> {
    if (!fullName) return null;
    // Phone OR email required — we drive follow-up by text/call.
    if (!phone.trim() && !email.trim()) return null;
    setSaving(true);
    try {
      // Compose the structured-data-as-text additions. These migrate to
      // dedicated columns in Phase B (marital_status, spouse_name,
      // urgent_matter_type, foreclosure_date) so the priority engine and
      // joint-filing flow can read them without parsing free text.
      const maritalLine =
        maritalStatus === "married_joint"
          ? `[Married — joint filing${spouseName.trim() ? `; Spouse (Debtor 2): ${spouseName.trim()}` : ""}]`
          : `[Individual filer]`;
      const composedNotes = [maritalLine, notes.trim()].filter(Boolean).join("\n");

      const urgentLabel =
        urgentMatter === "foreclosure"   ? `Foreclosure${foreclosureDate ? ` — sale date ${foreclosureDate}` : ""}` :
        urgentMatter === "garnishment"   ? `Garnishment` :
        urgentMatter === "legal_action"  ? `Legal action` :
        urgentMatter === "other"         ? `Other${urgentDetail.trim() ? ` — ${urgentDetail.trim()}` : ""}` :
                                            null;
      const composedPreScreen = urgentLabel ? `[Urgent: ${urgentLabel}]` : null;

      const { data, error } = await supabase
        .from("intake_leads")
        .insert({
          full_name: fullName,
          phone: phone || null,
          email: email || null,
          source,
          chapter_interest: chapter ? parseInt(chapter) : null,
          state: state || null,
          status: "new",
          urgency: mappedUrgency,
          preferred_contact: preferred,
          notes: composedNotes || null,
          pre_screen_notes: composedPreScreen,
          assigned_name: session.name,
        })
        .select("id")
        .single();
      if (error || !data) return null;
      return data.id as string;
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateOnly() {
    const id = await createLeadOnly();
    if (id) onSaved(id);
  }

  async function handleDoConsultNow() {
    if (!effectiveRec) return;
    setBookError(null);
    setBookingNow(true);
    try {
      const leadId = await createLeadOnly();
      if (!leadId) {
        setBookError("Could not create lead row.");
        return;
      }
      const startMs = Date.now() + IMMEDIATE_START_BUFFER_MS;
      const endMs = startMs + DEFAULT_SLOT_MINUTES * 60_000;
      const { data, error } = await supabase.rpc("book_consultation", {
        p_staff_id:    effectiveRec.staff.id,
        p_lead_id:     leadId,
        p_start_time:  new Date(startMs).toISOString(),
        p_end_time:    new Date(endMs).toISOString(),
        p_client_name: fullName,
        p_firm_id:     V1_DEFAULT_FIRM_ID,
        p_client_phone: phone || null,
        p_client_email: email || null,
        p_is_walk_in:  true,
        p_notes:       `Walk-in lead — logged by ${session.name}`,
        p_created_by:  session.name,
      });
      const result = (data ?? null) as { ok: boolean; reason: string | null } | null;
      if (error || !result?.ok) {
        setBookError(result?.reason ?? error?.message ?? "Booking failed");
        // Lead still exists — bounce so staff can recover.
        onSaved(leadId);
        return;
      }
      onSaved(leadId);
    } finally {
      setBookingNow(false);
    }
  }

  // Transfer target — best non-current admin who has a future slot today.
  // Used when "Do Consult Now" isn't applicable but there's still a clean
  // hand-off to a specific admin we can offer.
  const transferTarget: RecommendedStaff | null = useMemo(() => {
    if (!effectiveRec) return null;
    if (effectiveRec.hasImmediateSlot && !effectiveRec.hasImminentAppt) return null;
    const withSlots = recommendations.filter(r =>
      r.nextSlotStart && !r.hasImminentAppt && r.staff.id !== session.id,
    );
    return withSlots[0] ?? null;
  }, [effectiveRec, recommendations, session.id]);

  async function handleTransfer() {
    if (!transferTarget || !transferTarget.nextSlotStart) return;
    setBookError(null);
    setBookingNow(true);
    try {
      const leadId = await createLeadOnly();
      if (!leadId) { setBookError("Could not create lead row."); return; }
      const startMs = new Date(transferTarget.nextSlotStart).getTime();
      const endMs = startMs + DEFAULT_SLOT_MINUTES * 60_000;
      const { data, error } = await supabase.rpc("book_consultation", {
        p_staff_id:    transferTarget.staff.id,
        p_lead_id:     leadId,
        p_start_time:  new Date(startMs).toISOString(),
        p_end_time:    new Date(endMs).toISOString(),
        p_client_name: fullName,
        p_firm_id:     V1_DEFAULT_FIRM_ID,
        p_client_phone: phone || null,
        p_client_email: email || null,
        p_is_walk_in:  false,
        p_notes:       `Transferred to ${transferTarget.staff.name} — logged by ${session.name}`,
        p_created_by:  session.name,
      });
      const result = (data ?? null) as { ok: boolean; reason: string | null } | null;
      if (error || !result?.ok) {
        setBookError(result?.reason ?? error?.message ?? "Booking failed");
        onSaved(leadId);
        return;
      }
      onSaved(leadId);
    } finally {
      setBookingNow(false);
    }
  }

  // Schedule next available — books the earliest open slot across intake
  // staff ON THE SELECTED DAY. Uses the already-fetched slotsByStaff map
  // (no extra RPC), since selectedDate's slots are already in state.
  async function handleScheduleNextAvailable() {
    setBookError(null);
    setBookingNow(true);
    try {
      const eligibleStaffIds = new Set(staffDetails.map(s => s.id));
      if (eligibleStaffIds.size === 0) {
        setBookError("No eligible intake staff configured.");
        return;
      }
      const nowMs = Date.now();
      const all: OpenSlot[] = [];
      for (const arr of slotsByStaff.values()) all.push(...arr);
      const candidates = all
        .filter(s =>
          eligibleStaffIds.has(s.staff_id) &&
          s.available &&
          (!isSelectedToday || new Date(s.slot_start).getTime() > nowMs)
        )
        .sort((a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime());
      if (candidates.length === 0) {
        setBookError(`No open slots on ${formatDayLabel(selectedDate)}.`);
        return;
      }
      const chosen = candidates[0];
      const leadId = await createLeadOnly();
      if (!leadId) { setBookError("Could not create lead row."); return; }
      const startMs = new Date(chosen.slot_start).getTime();
      const endMs = startMs + DEFAULT_SLOT_MINUTES * 60_000;
      const { data, error } = await supabase.rpc("book_consultation", {
        p_staff_id:    chosen.staff_id,
        p_lead_id:     leadId,
        p_start_time:  new Date(startMs).toISOString(),
        p_end_time:    new Date(endMs).toISOString(),
        p_client_name: fullName,
        p_firm_id:     V1_DEFAULT_FIRM_ID,
        p_client_phone: phone || null,
        p_client_email: email || null,
        p_is_walk_in:  false,
        p_notes:       `Scheduled with ${chosen.staff_name} (${formatDayLabel(selectedDate)} earliest) — logged by ${session.name}`,
        p_created_by:  session.name,
      });
      const result = (data ?? null) as { ok: boolean; reason: string | null } | null;
      if (error || !result?.ok) {
        setBookError(result?.reason ?? error?.message ?? "Booking failed");
        onSaved(leadId);
        return;
      }
      onSaved(leadId);
    } finally {
      setBookingNow(false);
    }
  }

  // Invite buttons — Phase A render-only. No real dispatch.
  function handleSendIntakeInvite() {
    // Eventual destination: public BankruptcyIntake route, pre-filled with
    // this lead's context (NOT an account-registration flow).
    // Real wiring in Phase B (consent gate + sendGate resolver extension).
    // eslint-disable-next-line no-console
    console.log(
      "[NewLeadInline] PHASE A no-op: would send intake invite (email) for lead",
      { name: fullName, email: email || null, phone: phone || null, consent },
      "→ purpose: have the client complete the New Client Intake Form online before the scheduled call",
    );
  }
  function handleSendSmsRequest() {
    // eslint-disable-next-line no-console
    console.log(
      "[NewLeadInline] PHASE A no-op: would send intake invite (SMS) for lead",
      { name: fullName, phone: phone || null, consent },
      "→ same intent as the email invite, sent over SMS",
    );
  }

  const hasContactMethod = phone.trim().length > 0 || email.trim().length > 0;
  const canCreate = fullName.length > 0 && hasContactMethod && dedupHits.length === 0 && !saving && !bookingNow;
  const canSendInvites = consent && fullName.length > 0 && hasContactMethod;

  return (
    <div className="min-h-screen flex flex-col text-[#FAFAF7]" style={{ background: "#0F0F0E" }}>
      {/* Top bar */}
      <header className="sticky top-0 z-30 px-6 flex-shrink-0" style={{ height: 56, background: "#0F0F0E", borderBottom: "1px solid #2A2A28", display: "flex", alignItems: "center" }}>
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-xs text-[#6B6B66] hover:text-[#FAFAF7] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="mx-auto flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#B8945F]" />
          <span className="text-sm font-semibold" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
            Log new caller
          </span>
        </div>
        <span className="text-[11px] font-mono text-[#6B6B66]">{session.name}</span>
      </header>

      {/* Body — form left, availability + actions right */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] min-h-0 overflow-y-auto">

        {/* Left — lead capture form */}
        <section className="px-6 py-5 lg:px-8 lg:py-8 border-b lg:border-b-0 lg:border-r border-[#2A2A28]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-4">
            Caller details
          </p>
          <div className="space-y-3 max-w-md">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name *">
                <Input value={firstName} onChange={setFirstName} placeholder="First" autoFocus />
              </Field>
              <Field label="Last Name *">
                <Input value={lastName} onChange={setLastName} placeholder="Last" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <Input value={phone} onChange={setPhone} placeholder="(312) 555-0000" />
              </Field>
              <Field label="Email">
                <Input value={email} onChange={setEmail} placeholder="email@example.com" />
              </Field>
            </div>
            {!hasContactMethod && (firstName.trim() || lastName.trim()) && (
              <p className="text-[10px] text-amber-300/80 italic -mt-1">
                At least one of phone or email is required — we drive follow-up by text or call.
              </p>
            )}

            {/* Dedup banner */}
            {dedupHits.length > 0 && (
              <div className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-300">
                      Already in the system — {dedupHits.length} match{dedupHits.length === 1 ? "" : "es"}
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {dedupHits.slice(0, 3).map(h => (
                        <li key={`${h.source}_${h.id}`} className="text-[11px] text-[#FAFAF7]">
                          <span className="font-semibold">{h.name}</span>
                          {h.status && <span className="text-[#6B6B66]"> · {h.status}</span>}
                          <span className="text-[10px] text-[#6B6B66] ml-1">({h.source.replace("_", " ")})</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-amber-200/80 mt-1.5">
                      New-lead logging is for genuinely new callers only — open the existing record instead.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Filing type — joint-filing reveal. Stored in notes text for
                Phase A; Phase B adds structured marital_status / spouse_name. */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Filing Type">
                <Select value={maritalStatus} onChange={(v) => setMaritalStatus(v as typeof maritalStatus)} options={[
                  ["individual",    "Individual"],
                  ["married_joint", "Married (joint filing)"],
                ]} />
              </Field>
              {maritalStatus === "married_joint" && (
                <Field label="Spouse Name (Debtor 2)">
                  <Input value={spouseName} onChange={setSpouseName} placeholder="Spouse's full name" />
                </Field>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Source">
                <Select value={source} onChange={setSource} options={[
                  ["inbound", "Inbound Call / Walk-In"],
                  ["referral", "Referral"],
                  ["ad", "Online Ad"],
                  ["website", "Website Form"],
                  ["other", "Other"],
                ]} />
              </Field>
              <Field label="Chapter Interest">
                <Select value={chapter} onChange={setChapter} options={[
                  ["", "Undecided"],
                  ["7", "Chapter 7"],
                  ["13", "Chapter 13"],
                ]} />
              </Field>
              <Field label="State">
                <Select value={state} onChange={setState} options={[
                  "AZ","CA","CO","FL","GA","IL","MI","NV","NM","NY","OH","TX","WA",
                ].map(s => [s, s])} />
              </Field>
              <Field label="Preferred Contact">
                <Select value={preferred} onChange={setPreferred} options={[
                  ["phone", "Phone Call"], ["email", "Email"], ["text", "Text / SMS"],
                ]} />
              </Field>
            </div>

            {/* Urgent-matter selector — replaces the free-form urgency dropdown.
                Maps to the existing urgency enum for the priority engine; raw
                detail lands in pre_screen_notes until the Phase B columns ship. */}
            <Field label="Any urgent matters?">
              <Select value={urgentMatter} onChange={(v) => setUrgentMatter(v as typeof urgentMatter)} options={[
                ["none",         "None"],
                ["foreclosure",  "Foreclosure (sale scheduled)"],
                ["garnishment",  "Garnishment"],
                ["legal_action", "Legal action / lawsuit"],
                ["other",        "Other"],
              ]} />
            </Field>
            {urgentMatter === "foreclosure" && (
              <Field label="Foreclosure Sale Date">
                <input
                  type="date"
                  value={foreclosureDate}
                  onChange={e => setForeclosureDate(e.target.value)}
                  className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[#FAFAF7] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#B8945F] transition-colors"
                />
                <p className="text-[10px] text-amber-300/80 italic mt-1">
                  Hard filing deadline — the priority engine reads urgency = emergency for this case.
                </p>
              </Field>
            )}
            {urgentMatter === "other" && (
              <Field label="Brief detail">
                <Input value={urgentDetail} onChange={setUrgentDetail} placeholder="What's pressing? (one line)" />
              </Field>
            )}
            <Field label="Notes">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Brief description of situation, reason for contact…"
                className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[#FAFAF7] text-sm rounded-lg px-3 py-2.5 placeholder-[#3A3A36] focus:outline-none focus:border-[#B8945F] resize-none transition-colors"
              />
            </Field>

            {/* Consent — gates invite buttons */}
            <label className="flex items-start gap-2.5 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#B8945F] flex-shrink-0"
              />
              <span className="text-[11px] text-[#FAFAF7] leading-relaxed">
                Caller consents to receive a follow-up by email and SMS at the phone and email provided.
                <span className="block text-[10px] text-[#6B6B66] mt-0.5">
                  Captured in session only this phase — persisted consent column lands with real send wiring.
                </span>
              </span>
            </label>
          </div>
        </section>

        {/* Right — availability + actions */}
        <section className="px-6 py-5 lg:px-8 lg:py-8 space-y-4">
          {/* Recommendation card */}
          <RecommendationCard
            recommendations={recommendations}
            effectiveRec={effectiveRec}
            defaultPickRec={defaultPickRec}
            currentAdminRec={currentAdminRec}
            currentSessionId={session.id}
            isOutranked={isOutranked}
            currentIsBlocked={currentIsBlocked}
            onPickStaff={setPickedStaffId}
            slotsLoading={slotsLoading}
          />

          {/* Action row — decision-driven booking ladder + always-available fallback. */}
          <div className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-3">Action</p>
            <div className="flex flex-wrap items-center gap-2">
              {/* Do Consult Now — immediate booking with effectiveRec (you or recommended). */}
              {effectiveRec && effectiveRec.hasImmediateSlot && !effectiveRec.hasImminentAppt && (
                <button
                  disabled={!canCreate || bookingNow}
                  onClick={handleDoConsultNow}
                  className="flex items-center gap-2 bg-[#B8945F] hover:bg-[#C8A46F] disabled:opacity-40 disabled:cursor-not-allowed text-[#0F0F0E] font-bold text-xs px-4 py-2 rounded transition-colors"
                  title="Books a consult right now (start = now + 1m, length = 45m)."
                >
                  {bookingNow ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}
                  Do Consult Now{effectiveRec.staff.id !== session.id ? ` with ${effectiveRec.staff.name}` : ""}
                </button>
              )}

              {/* Transfer to Next Available [Name] — books a different admin at their soonest slot. */}
              {transferTarget && transferTarget.nextSlotStart && (
                <button
                  disabled={!canCreate || bookingNow}
                  onClick={handleTransfer}
                  className="flex items-center gap-2 bg-[#1A1A18] hover:bg-[#2A2A28] border border-[#B8945F]/40 disabled:opacity-40 disabled:cursor-not-allowed text-[#FAFAF7] font-semibold text-xs px-4 py-2 rounded transition-colors"
                  title={`Books ${transferTarget.staff.name} at ${new Date(transferTarget.nextSlotStart).toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: FIRM_TZ })}.`}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Transfer to Next Available — {transferTarget.staff.name}
                </button>
              )}

              {/* Schedule Next Available — earliest open slot across intake staff (today or future). */}
              <button
                disabled={!canCreate || bookingNow || staffDetails.length === 0}
                onClick={handleScheduleNextAvailable}
                className="flex items-center gap-2 bg-[#1A1A18] hover:bg-[#2A2A28] border border-[#2A2A28] disabled:opacity-40 disabled:cursor-not-allowed text-[#FAFAF7] font-semibold text-xs px-4 py-2 rounded transition-colors"
                title={`Books the earliest open slot across intake staff on ${formatDayLabel(selectedDate)}.`}
              >
                {bookingNow ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                Schedule next available
              </button>

              {/* Create lead only — fallback, no booking. */}
              <button
                disabled={!canCreate}
                onClick={handleCreateOnly}
                className="flex items-center gap-2 bg-[#2A2A28] hover:bg-[#3A3A36] disabled:opacity-40 text-[#FAFAF7] font-semibold text-xs px-4 py-2 rounded transition-colors"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                Create lead only
              </button>

              {bookError && (
                <div className="basis-full mt-2 text-[11px] text-rose-300 bg-rose-950/30 border border-rose-700/40 rounded px-3 py-1.5">
                  <span className="font-semibold">Booking failed:</span> {bookError}
                </div>
              )}
              {!hasContactMethod && fullName.length > 0 && (
                <p className="basis-full mt-2 text-[10px] text-amber-300/80 italic">
                  Provide a phone or email above before booking — we drive follow-up by text or call.
                </p>
              )}
              {dedupHits.length > 0 && (
                <p className="basis-full mt-2 text-[10px] text-amber-300/80 italic">
                  Resolve the dedup match above before creating this lead.
                </p>
              )}
            </div>
          </div>

          {/* Availability strip — navigable day view, defaults to next business day. */}
          <AvailabilityStrip
            recommendations={recommendations}
            slotsByStaff={slotsByStaff}
            currentSessionId={session.id}
            slotsLoading={slotsLoading}
            effectiveStaffId={effectiveStaffId}
            selectedDate={selectedDate}
            todayLocal={todayLocal}
            onChangeDate={setSelectedDate}
          />

          {/* Invite buttons — Phase A render-only */}
          <div className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-2">Pre-call intake invite</p>
            <p className="text-[11px] text-[#6B6B66] leading-relaxed mb-3">
              Send the caller a link to fill the New Client Intake Form online before the scheduled call.
              The intake answers feed into the case file once they submit.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={!canSendInvites}
                onClick={handleSendIntakeInvite}
                title={!canSendInvites ? "Check the consent box and provide an email or phone to enable" : "PHASE A — no-op; real send wires in Phase B"}
                className="flex items-center gap-2 bg-[#2A2A28] hover:bg-[#3A3A36] disabled:opacity-40 disabled:cursor-not-allowed text-[#FAFAF7] font-semibold text-xs px-4 py-2 rounded transition-colors"
              >
                <Send className="w-3.5 h-3.5" /> Send intake invite
              </button>
              <button
                disabled={!canSendInvites}
                onClick={handleSendSmsRequest}
                title={!canSendInvites ? "Check the consent box and provide a phone to enable" : "PHASE A — no-op; real send wires in Phase B"}
                className="flex items-center gap-2 bg-[#2A2A28] hover:bg-[#3A3A36] disabled:opacity-40 disabled:cursor-not-allowed text-[#FAFAF7] font-semibold text-xs px-4 py-2 rounded transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Send SMS request
              </button>
              <span className="text-[10px] text-[#6B6B66] italic">
                Phase A — buttons render only; real dispatch wires in Phase B (consent column + sendGate resolver).
              </span>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-[#6B6B66] uppercase tracking-widest block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <input
      autoFocus={autoFocus}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[#FAFAF7] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#B8945F] transition-colors placeholder-[#3A3A36]"
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[#FAFAF7] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#B8945F] transition-colors"
    >
      {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  );
}

function RecommendationCard({
  recommendations, effectiveRec, defaultPickRec, currentAdminRec, currentSessionId,
  isOutranked, currentIsBlocked, onPickStaff, slotsLoading,
}: {
  recommendations: RecommendedStaff[];
  effectiveRec: RecommendedStaff | null;
  defaultPickRec: RecommendedStaff | null;
  currentAdminRec: RecommendedStaff | null;
  currentSessionId: string;
  isOutranked: boolean;
  currentIsBlocked: boolean;
  onPickStaff: (staffId: string | null) => void;
  slotsLoading: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  if (slotsLoading) {
    return (
      <div className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-4">
        <p className="text-xs text-[#6B6B66] italic">Loading availability…</p>
      </div>
    );
  }

  if (!effectiveRec) {
    return (
      <div className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-4">
        <p className="text-xs text-[#6B6B66] italic">No eligible intake staff are configured. Create the lead and route manually.</p>
      </div>
    );
  }

  const isCurrent = effectiveRec.staff.id === currentSessionId;
  const reasonNote =
    isOutranked && currentIsBlocked ? `${currentAdminRec?.staff.name ?? "You"} ${currentAdminRec?.hasImminentAppt ? "has an imminent appointment" : "isn't free right now"}. Routing to ${effectiveRec.staff.name}.` :
    isOutranked                       ? `A stronger staffer is available.` :
                                        null;

  return (
    <div className="rounded-xl border border-[#B8945F]/40 bg-[#1A1A18] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-[#B8945F]" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#B8945F]">Recommended</p>
        {!isCurrent && (
          <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border bg-amber-900/40 text-amber-300 border-amber-700/60">
            transfer
          </span>
        )}
      </div>
      <div className="flex items-start gap-3">
        <Users className="w-4 h-4 text-[#FAFAF7] mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#FAFAF7] truncate">{effectiveRec.staff.name}</p>
          <p className="text-[10px] text-[#6B6B66] truncate mt-0.5">
            {effectiveRec.staff.role ?? "staff"}
            {typeof effectiveRec.staff.role_level === "number" && <span> · level {effectiveRec.staff.role_level}</span>}
            <span> · {effectiveRec.todayLoad} consult{effectiveRec.todayLoad === 1 ? "" : "s"} today</span>
          </p>
          {reasonNote && (
            <p className="text-[10px] text-amber-300/80 italic mt-1">{reasonNote}</p>
          )}
          {effectiveRec.rankTier !== 1 && (
            <p className="text-[10px] text-[#6B6B66] mt-1">
              {effectiveRec.nextSlotStart
                ? `Earliest open slot today: ${new Date(effectiveRec.nextSlotStart).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: FIRM_TZ })}`
                : "No remaining slots today."}
            </p>
          )}
        </div>
        <button
          onClick={() => setPickerOpen(o => !o)}
          className="text-[11px] text-[#6B6B66] hover:text-[#FAFAF7] transition-colors flex-shrink-0"
        >
          {pickerOpen ? "Close" : "Pick someone else"}
        </button>
      </div>

      {pickerOpen && (
        <div className="mt-3 rounded border border-[#2A2A28] bg-[#0F0F0E] max-h-56 overflow-y-auto">
          <div className="flex items-center px-3 py-1.5 border-b border-[#2A2A28]">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66]">Choose staff</span>
            <button
              onClick={() => { onPickStaff(null); setPickerOpen(false); }}
              className="ml-auto text-[10px] font-semibold text-[#B8945F] hover:text-[#FAFAF7] transition-colors"
            >
              Use default
            </button>
          </div>
          <ul>
            {recommendations.map(r => (
              <li key={r.staff.id}>
                <button
                  onClick={() => { onPickStaff(r.staff.id); setPickerOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                    r.staff.id === effectiveRec.staff.id ? "bg-[#2A2A28]" : "hover:bg-[#1A1A18]"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    r.rankTier === 1 ? "bg-emerald-500" : r.rankTier === 2 ? "bg-amber-500" : "bg-[#3A3A36]"
                  }`} />
                  <span className="text-[#FAFAF7] truncate flex-1">{r.staff.name}</span>
                  <span className="text-[10px] text-[#6B6B66]">
                    {r.rankTier === 1 ? "free now" :
                     r.rankTier === 2 ? (r.nextSlotStart ? `next at ${new Date(r.nextSlotStart).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: FIRM_TZ })}` : "next slot") :
                                        "no slots"}
                  </span>
                  {r.staff.id === currentSessionId && (
                    <span className="text-[9px] uppercase tracking-widest text-[#B8945F]">you</span>
                  )}
                  {defaultPickRec && r.staff.id === defaultPickRec.staff.id && (
                    <ChevronRight className="w-3 h-3 text-[#B8945F]" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AvailabilityStrip({
  recommendations, slotsByStaff, currentSessionId, slotsLoading, effectiveStaffId,
  selectedDate, todayLocal, onChangeDate,
}: {
  recommendations: RecommendedStaff[];
  slotsByStaff: Map<string, OpenSlot[]>;
  currentSessionId: string;
  slotsLoading: boolean;
  effectiveStaffId: string | null;
  selectedDate: string;
  todayLocal: string;
  onChangeDate: (d: string) => void;
}) {
  // Hourly columns derived from union of all staff slot starts (firm-tz hour).
  const hours = useMemo(() => {
    const set = new Set<number>();
    for (const arr of slotsByStaff.values()) {
      for (const s of arr) {
        const h = parseInt(
          new Date(s.slot_start).toLocaleTimeString("en-US", {
            hour: "numeric", hour12: false, timeZone: FIRM_TZ,
          }),
          10,
        );
        set.add(h);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [slotsByStaff]);

  const isToday = selectedDate === todayLocal;
  const atFloor = selectedDate <= todayLocal;  // YYYY-MM-DD lexicographic == chronological

  return (
    <div className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-[#B8945F]" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66]">
          Availability — intake staff
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChangeDate(shiftDate(selectedDate, -1))}
            disabled={atFloor}
            title="Previous day"
            className="p-1 text-[#FAFAF7] hover:text-[#B8945F] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <input
            type="date"
            value={selectedDate}
            min={todayLocal}
            onChange={e => { if (e.target.value) onChangeDate(e.target.value); }}
            className="bg-[#0F0F0E] border border-[#2A2A28] text-[#FAFAF7] text-[11px] rounded px-2 py-1 focus:outline-none focus:border-[#B8945F] transition-colors"
          />
          <button
            type="button"
            onClick={() => onChangeDate(shiftDate(selectedDate, 1))}
            title="Next day"
            className="p-1 text-[#FAFAF7] hover:text-[#B8945F] transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <p className="text-[11px] text-[#FAFAF7] mb-2 flex items-center gap-2">
        <span className="font-semibold">{formatDayLabel(selectedDate)}</span>
        {isToday && <span className="text-[10px] uppercase tracking-widest text-[#B8945F] font-semibold">today</span>}
        {!isToday && <span className="text-[10px] text-[#6B6B66]">scheduling view — lead still logs as today</span>}
      </p>
      {slotsLoading ? (
        <p className="text-xs text-[#6B6B66] italic">Loading slots…</p>
      ) : recommendations.length === 0 ? (
        <p className="text-xs text-[#6B6B66] italic">No eligible intake staff configured.</p>
      ) : hours.length === 0 ? (
        <p className="text-xs text-[#6B6B66] italic">
          No availability windows on {formatDayLabel(selectedDate)}. If this should be a working day,
          check the Availability tab — weekday windows may not be seeded for these staff.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr>
                <th className="text-left font-semibold text-[#6B6B66] uppercase tracking-wide pr-2 py-1">Staff</th>
                {hours.map(h => (
                  <th key={h} className="text-center font-mono text-[#6B6B66] px-1 py-1">
                    {h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recommendations.map(r => {
                const slots = slotsByStaff.get(r.staff.id) ?? [];
                const isEffective = r.staff.id === effectiveStaffId;
                return (
                  <tr key={r.staff.id} className={isEffective ? "bg-[#B8945F]/8" : ""}>
                    <td className="pr-2 py-1.5 truncate max-w-[120px]">
                      <span className="text-[#FAFAF7] font-semibold">{r.staff.name}</span>
                      {r.staff.id === currentSessionId && (
                        <span className="text-[9px] uppercase tracking-widest text-[#B8945F] ml-1">you</span>
                      )}
                    </td>
                    {hours.map(h => {
                      const slot = slots.find(s => {
                        const sh = parseInt(
                          new Date(s.slot_start).toLocaleTimeString("en-US", {
                            hour: "numeric", hour12: false, timeZone: FIRM_TZ,
                          }),
                          10,
                        );
                        return sh === h;
                      });
                      const cls =
                        !slot                     ? "bg-[#0F0F0E] border-[#2A2A28]" :
                        slot.available            ? "bg-emerald-900/40 border-emerald-700/60" :
                        slot.reason === "lunch"   ? "bg-amber-950/40 border-amber-700/40" :
                        slot.reason === "booked"  ? "bg-rose-900/30 border-rose-700/40" :
                                                    "bg-[#1A1A18] border-[#2A2A28]";
                      const title = !slot ? "outside working hours" :
                        slot.available ? "available" : (slot.reason ?? "blocked");
                      return (
                        <td key={h} className="px-0.5 py-1" title={title}>
                          <div className={`h-4 rounded border ${cls}`} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-[#6B6B66]">
            <Legend dot="bg-emerald-900/40 border-emerald-700/60" label="open" />
            <Legend dot="bg-amber-950/40 border-amber-700/40" label="lunch" />
            <Legend dot="bg-rose-900/30 border-rose-700/40" label="booked" />
            <Legend dot="bg-[#0F0F0E] border-[#2A2A28]" label="off hours" />
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`w-3 h-2 rounded border ${dot}`} />
      <span>{label}</span>
    </span>
  );
}

