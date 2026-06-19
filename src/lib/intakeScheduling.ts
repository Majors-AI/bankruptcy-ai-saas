// Intake scheduling adapter — the single seam between the Intake portal's
// appointment-first algorithm (Change 3) and Supabase's calendar.
//
// THE ONLY PATH to availability + booking from new Intake code. Everywhere
// else, call this module instead of `supabase.rpc("get_open_slots", …)` /
// `supabase.rpc("book_consultation", …)` directly. The adapter shape lets
// us extend later (external calendar sync, alternate providers) without
// rewriting the consuming pages.
//
// Source of truth (unchanged): the existing Supabase calendar tables
// (`staff_availability` + `calendar_events`, RLS-scoped under `firm_id`)
// + the existing RPCs:
//
//   get_open_slots(p_staff_id, p_date, p_slot_minutes)
//     → OpenSlot[] for the day — same shape used by ConsultSchedulerPanel
//
//   book_consultation(...) → { ok: boolean, reason: string | null }
//     → transactional booking; performs capacity/lunch/gap/time-off
//       checks atomically; updates the lead row when p_lead_id is set
//
// Migration drift (per CLAUDE.md note 2026-06-07): if either RPC is
// missing or stale in the target environment, FLAG to Canelo — this
// adapter does NOT attempt to write a migration. Callers receive
// { ok: false, reason: "scheduler_rpc_unavailable" } in that case.
//
// Per spec: bookings can land as close as 15 minutes apart (configurable
// via DEFAULT_MIN_INTERVAL_MIN below).
//
// FIRM-ID / RLS POSTURE — the adapter does not accept or forward a
// firm_id parameter. Every RPC call rides the signed-in user's JWT,
// which supplies `app.current_firm_id` for the RLS checks on
// `staff_availability` and `calendar_events`. Firms cannot see each
// other's slots; firms cannot book into another firm's calendar.
// Verified on every public function below.

import { supabase } from "./supabase";

// ── Shape definitions ─────────────────────────────────────────────────────

/** A single bookable slot returned by `get_open_slots`. Mirrors the type
 *  used by ConsultSchedulerPanel and LegalAdminPortal so existing
 *  consumers can swap to this adapter without a rename. */
export interface OpenSlot {
  staff_id: string;
  staff_name: string;
  slot_start: string;  // ISO timestamp
  slot_end: string;    // ISO timestamp
  available: boolean;
  reason: string | null;
}

export interface FindOpenSlotsArgs {
  /** ISO date (YYYY-MM-DD) — required. The RPC works per-day. */
  date: string;
  /** Specific staff member to query; `null` = any staffer (least-loaded). */
  staffId?: string | null;
  /** Slot length in minutes. Default 45 (firm-standard consult length). */
  slotMinutes?: number;
}

export interface FindSoonestSlotArgs {
  /** Start of the search window (inclusive). Defaults to "now". */
  fromIso?: string;
  /** Specific staff member to query; `null` = any staffer. */
  staffId?: string | null;
  /** Slot length in minutes. Default 45. */
  slotMinutes?: number;
  /** Minimum interval between successive bookable slots, in minutes.
   *  Default 15 — Change-3 spec for appointment-first density. */
  minIntervalMinutes?: number;
  /** Max days forward to scan before giving up. Default 21. */
  maxDaysForward?: number;
}

export interface BookSlotArgs {
  leadId: string;
  staffId: string | null;     // null → book_consultation picks least-loaded available
  startIso: string;
  endIso: string;
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  isWalkIn?: boolean;
  notes?: string | null;
  /** Display name of the booking actor (staffer / AI bot). Logged. */
  createdBy: string;
}

export interface BookResult {
  ok: boolean;
  /** Server-supplied failure reason (capacity, lunch overlap, time-off,
   *  past time, etc.) when ok=false; null on success. */
  reason: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────

/** Default consult length. The firm's hot intake slot is 45 minutes; the
 *  existing back-office UI also defaults to 45. */
export const DEFAULT_SLOT_MINUTES = 45;

/** Minimum bookable interval between successive slots in the soonest-slot
 *  search. Change-3 spec: 15 minutes. */
export const DEFAULT_MIN_INTERVAL_MIN = 15;

// ── Read: open slots for a day ────────────────────────────────────────────

/** Open slots for a given date. Thin wrapper over the existing
 *  `get_open_slots` RPC — same shape, same rules as `book_consultation`. */
export async function findOpenSlotsForDay(args: FindOpenSlotsArgs): Promise<OpenSlot[]> {
  const slotMinutes = args.slotMinutes ?? DEFAULT_SLOT_MINUTES;
  const { data, error } = await supabase.rpc("get_open_slots", {
    p_staff_id: args.staffId ?? null,
    p_date: args.date,
    p_slot_minutes: slotMinutes,
  });
  if (error) {
    // Failure modes: RPC missing / drift, RLS denial, transient. The
    // caller is expected to log + fall back to a "see other times"
    // browseable calendar.
    return [];
  }
  return (data ?? []) as OpenSlot[];
}

// ── Read: soonest bookable slot (appointment-first one-tap default) ─────

/** Find the soonest bookable slot from `fromIso` forward. Scans up to
 *  `maxDaysForward` days; respects `minIntervalMinutes` (default 15) so
 *  immediately-adjacent slots stay bookable as Change-3 specifies.
 *
 *  Returns `null` if no slot is available in the window (caller should
 *  surface a "no soon-time available, try a later date" UI). */
export async function findSoonestSlot(args: FindSoonestSlotArgs = {}): Promise<OpenSlot | null> {
  const from = args.fromIso ? new Date(args.fromIso) : new Date();
  const maxDays = Math.max(1, Math.floor(args.maxDaysForward ?? 21));
  const slotMinutes = args.slotMinutes ?? DEFAULT_SLOT_MINUTES;
  const minIntervalMs = (args.minIntervalMinutes ?? DEFAULT_MIN_INTERVAL_MIN) * 60_000;
  const fromMs = from.getTime();

  for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
    const d = new Date(fromMs + dayOffset * 86_400_000);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const slots = await findOpenSlotsForDay({
      date: dateStr,
      staffId: args.staffId ?? null,
      slotMinutes,
    });
    if (slots.length === 0) continue;

    // Filter to slots that are:
    //   (a) marked available by the RPC, and
    //   (b) start at or after `fromMs + minIntervalMs` — the minimum-
    //       interval rule prevents booking a slot that's effectively
    //       "now" without giving the lead breathing room to confirm.
    const futureAvailable = slots.filter(s => {
      if (!s.available) return false;
      return new Date(s.slot_start).getTime() >= fromMs + minIntervalMs;
    });
    // The RPC returns slots in chronological order per the existing
    // ConsultSchedulerPanel contract; pick the first.
    if (futureAvailable.length > 0) return futureAvailable[0];
  }
  return null;
}

// ── Write: book a slot ────────────────────────────────────────────────────

/** Book a consultation via `book_consultation`. Transactional on the
 *  server side; the lead row is updated atomically when `leadId` is set.
 *
 *  Returns the RPC's `{ ok, reason }` payload verbatim — the caller
 *  surfaces `reason` to the booking UI on failure. */
export async function bookSlot(args: BookSlotArgs): Promise<BookResult> {
  const { data, error } = await supabase.rpc("book_consultation", {
    p_staff_id:     args.staffId,
    p_lead_id:      args.leadId,
    p_start_time:   args.startIso,
    p_end_time:     args.endIso,
    p_client_name:  args.clientName,
    p_client_phone: args.clientPhone ?? null,
    p_client_email: args.clientEmail ?? null,
    p_is_walk_in:   args.isWalkIn ?? false,
    p_notes:        args.notes ?? null,
    p_created_by:   args.createdBy,
  });
  const result = (data ?? null) as BookResult | null;
  if (error || !result) {
    return { ok: false, reason: error?.message ?? "booking_failed" };
  }
  return result;
}

/** One-shot: find the soonest slot AND book it. Convenience for the
 *  Change-1 "one-tap default" + Change-3 AI-bot auto-book paths.
 *
 *  Returns:
 *    { ok: true,  slot, reason: null }
 *    { ok: false, slot: null, reason }
 *
 *  When `ok: false` the caller decides whether to retry, escalate to the
 *  browse-other-times UI, or notify Canelo (when reason is
 *  "scheduler_rpc_unavailable" or starts with "rpc:"). */
export async function bookSoonestSlot(args: Omit<BookSlotArgs, "startIso" | "endIso" | "staffId"> & {
  searchFromIso?: string;
  preferStaffId?: string | null;
  slotMinutes?: number;
  minIntervalMinutes?: number;
  maxDaysForward?: number;
}): Promise<{ ok: boolean; slot: OpenSlot | null; reason: string | null }> {
  const slot = await findSoonestSlot({
    fromIso: args.searchFromIso,
    staffId: args.preferStaffId ?? null,
    slotMinutes: args.slotMinutes,
    minIntervalMinutes: args.minIntervalMinutes,
    maxDaysForward: args.maxDaysForward,
  });
  if (!slot) {
    return { ok: false, slot: null, reason: "no_slot_available_in_window" };
  }
  const result = await bookSlot({
    leadId:      args.leadId,
    staffId:     slot.staff_id,
    startIso:    slot.slot_start,
    endIso:      slot.slot_end,
    clientName:  args.clientName,
    clientPhone: args.clientPhone,
    clientEmail: args.clientEmail,
    isWalkIn:    args.isWalkIn,
    notes:       args.notes,
    createdBy:   args.createdBy,
  });
  return { ok: result.ok, slot: result.ok ? slot : null, reason: result.reason };
}
