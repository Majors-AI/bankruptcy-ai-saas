// Shared consult scheduler — 5-business-day week view.
//
// Presentational: the panel fetches slot data + displays the week + tracks
// selection, but it does NOT call book_consultation. The parent reads the
// current selection back through the controlled props and runs booking itself.
// This lets the panel be reused unchanged by both the new-lead window and the
// existing-lead scheduling surface.
//
// Slot fetching lives here because the bubble aggregation is tightly bound to
// the per-(date,hour) availability data — splitting the fetch out would force
// every caller to duplicate the same derivation logic.
//
// Layout:
//   - Prev / This week / Next week nav (5 business days at a time)
//   - 5 columns, one per business day, each a vertical stack of hour bubbles
//   - A bubble shows when at least one active intake staffer is OPEN at that
//     hour. Lunch / booked / off-hours / capacity-reached are omitted.
//   - Tap a bubble → sets selection = { date, slotStartIso, staffId } where
//     staffId is the least-loaded staffer who's actually free at that bubble.
//   - Selected bubble: gold ring highlight.
//
// "See Who's Available" — a separate read-only roster the parent can render
// via the exported StaffAvailabilityList component. Visibility only — no
// transfer/reassign buttons (live transfer handshake is a separate phase that
// would need a new intake_transfer_requests table).

import { useEffect, useMemo, useState } from "react";
import {
  Calendar, ChevronLeft, ChevronRight, RefreshCw, Sparkles, Users,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

const FIRM_TZ = "America/Los_Angeles";
const DEFAULT_SLOT_MINUTES = 45;
// Mirrors NewLeadInline / IntakeDashboard Layer-1 "imminent" definition.
const IMMINENT_APPT_WINDOW_MIN = 15;

// ─── Date helpers (firm-tz, calendar-date-string arithmetic) ─────────────────

export function todayInFirmTz(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: FIRM_TZ });
}

export function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** First business day on or after the given calendar date (Sat→Mon, Sun→Mon). */
function firstBusinessDayOnOrAfter(dateStr: string): string {
  let d = dateStr;
  while (true) {
    const [y, m, day] = d.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
    if (dow !== 0 && dow !== 6) return d;
    d = shiftDate(d, 1);
  }
}

export function nextBusinessDayFromTodayInFirmTz(): string {
  return firstBusinessDayOnOrAfter(shiftDate(todayInFirmTz(), 1));
}

/** Five consecutive business days starting at `start` (skipping weekends). */
function fiveBusinessDaysFrom(start: string): string[] {
  const out: string[] = [];
  let d = firstBusinessDayOnOrAfter(start);
  while (out.length < 5) {
    out.push(d);
    d = firstBusinessDayOnOrAfter(shiftDate(d, 1));
  }
  return out;
}

/** Shift `weekStart` by N business days (positive or negative). */
function shiftBusinessDays(weekStart: string, n: number): string {
  let d = weekStart;
  if (n > 0) {
    for (let i = 0; i < n; i++) d = firstBusinessDayOnOrAfter(shiftDate(d, 1));
  } else if (n < 0) {
    for (let i = 0; i < -n; i++) {
      d = shiftDate(d, -1);
      while (true) {
        const [y, m, day] = d.split("-").map(Number);
        const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
        if (dow !== 0 && dow !== 6) break;
        d = shiftDate(d, -1);
      }
    }
  }
  return d;
}

export function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric", timeZone: "UTC",
  });
}

function formatDayShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });
}

function formatTimeFirmTz(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: FIRM_TZ,
  });
}

function hourOfIsoInFirmTz(iso: string): number {
  return parseInt(
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric", hour12: false, timeZone: FIRM_TZ,
    }),
    10,
  );
}

// ─── Shared types ────────────────────────────────────────────────────────────

export interface StaffDetail {
  id: string;
  name: string;
  role: string | null;
  role_level: number | null;
  intake_portal_role: string | null;
  is_active: boolean;
}

export interface CalEvent {
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

export interface OpenSlot {
  staff_id: string;
  staff_name: string;
  slot_start: string;
  slot_end: string;
  available: boolean;
  reason: string | null;
}

/**
 * Parent's current selection. A booked slot is fully specified by all three
 * fields; tapping a bubble fills all three at once.
 */
export interface SchedulerSelection {
  staffId: string | null;
  slotStartIso: string | null;
  /** YYYY-MM-DD of the chosen day, for display continuity. */
  dateStr: string | null;
}

export interface ConsultSchedulerPanelProps {
  staffPool: StaffDetail[];
  /** Used for load + imminent-appt detection (today only). */
  calEvents: CalEvent[];
  /** Current session's staff id, for "you" badge / outranked messaging. */
  currentSessionId: string;
  selection: SchedulerSelection;
  onChangeSelection: (s: SchedulerSelection) => void;
  /** Firm-tz today (YYYY-MM-DD). */
  todayLocal: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ConsultSchedulerPanel({
  staffPool, calEvents, currentSessionId: _currentSessionId,
  selection, onChangeSelection, todayLocal,
}: ConsultSchedulerPanelProps) {
  // currentSessionId is part of the API for callers that wire the same prop
  // through to StaffAvailabilityList (where it drives the "you" badge). The
  // main panel doesn't need it directly — bubbles aggregate across staff and
  // don't reveal individual identity.
  // Week start defaults to next business day. Prev/next nav shifts by 5
  // business days at a time so the visible window is always a clean
  // Mon-Fri-style block (gaps over weekends collapse).
  const [weekStart, setWeekStart] = useState<string>(() => nextBusinessDayFromTodayInFirmTz());
  const weekDates = useMemo(() => fiveBusinessDaysFrom(weekStart), [weekStart]);

  // ── Slot fetch — one get_open_slots per date, parallelized ────────────────
  // Map<dateStr, Map<staffId, OpenSlot[]>>
  const [slotsByDateByStaff, setSlotsByDateByStaff] = useState<Map<string, Map<string, OpenSlot[]>>>(new Map());
  const [slotsLoading, setSlotsLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setSlotsLoading(true);
    (async () => {
      const fetches = weekDates.map(async (d) => {
        const { data, error } = await supabase.rpc("get_open_slots", {
          p_staff_id: null,
          p_date: d,
          p_slot_minutes: DEFAULT_SLOT_MINUTES,
        });
        if (error || !Array.isArray(data)) return [d, new Map<string, OpenSlot[]>()] as const;
        const byStaff = new Map<string, OpenSlot[]>();
        for (const s of data as OpenSlot[]) {
          if (!byStaff.has(s.staff_id)) byStaff.set(s.staff_id, []);
          byStaff.get(s.staff_id)!.push(s);
        }
        for (const arr of byStaff.values()) {
          arr.sort((a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime());
        }
        return [d, byStaff] as const;
      });
      const results = await Promise.all(fetches);
      if (cancelled) return;
      const map = new Map<string, Map<string, OpenSlot[]>>();
      for (const [d, byStaff] of results) map.set(d, byStaff);
      setSlotsByDateByStaff(map);
      setSlotsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [weekStart]); // weekDates is derived from weekStart — refetch on weekStart only

  // Filter to active intake staff (parent-supplied pool).
  const eligibleStaffIds = useMemo(() => new Set(staffPool.map(s => s.id)), [staffPool]);

  // For each (date, hour), aggregate availability across the eligible staff
  // pool. A bubble exists if at least one staffer in the pool has ANY slot
  // (available or otherwise) at that hour; `available` is true if at least
  // one of those slots is actually open.
  //
  // Booked / fully-blocked hours are KEPT in the list now (rendered gray /
  // disabled) so staff see real busy vs open at a glance instead of every
  // visible bubble looking the same shade of green.
  //
  // The "recommendedStaffId" for a tap is the staffer with the lowest
  // todayLoad among those whose slot is available at that hour. This mirrors
  // the existing least-loaded pick used in book_consultation when p_staff_id
  // is null, so a tap previews the same staffer the RPC would have chosen.
  type BubbleData = {
    hour: number;
    slotStartIso: string;            // anchor of the canonical slot
    available: boolean;
    recommendedStaffId: string | null;
    openCount: number;               // # staff actually open at this hour
    totalCount: number;              // # staff with ANY slot at this hour (open + booked)
  };

  // Today's per-staff consult load — used as the tiebreak for recommendation.
  const todayLoadByStaff = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of calEvents) {
      if (!e.staff_id) continue;
      if (e.event_subtype !== "consultation") continue;
      if (["cancelled", "no_show", "rescheduled"].includes(e.status)) continue;
      const d = new Date(e.start_time).toLocaleDateString("en-CA", { timeZone: FIRM_TZ });
      if (d !== todayLocal) continue;
      m.set(e.staff_id, (m.get(e.staff_id) ?? 0) + 1);
    }
    return m;
  }, [calEvents, todayLocal]);

  const bubblesByDate: Map<string, BubbleData[]> = useMemo(() => {
    const out = new Map<string, BubbleData[]>();
    const nowMs = Date.now();
    for (const date of weekDates) {
      const byStaff = slotsByDateByStaff.get(date);
      if (!byStaff) { out.set(date, []); continue; }
      const byHour = new Map<number, OpenSlot[]>();
      for (const [staffId, arr] of byStaff.entries()) {
        if (!eligibleStaffIds.has(staffId)) continue;
        for (const s of arr) {
          const h = hourOfIsoInFirmTz(s.slot_start);
          if (!byHour.has(h)) byHour.set(h, []);
          byHour.get(h)!.push(s);
        }
      }
      const isToday = date === todayLocal;
      const bubbles: BubbleData[] = [];
      const hours = Array.from(byHour.keys()).sort((a, b) => a - b);
      for (const h of hours) {
        const slots = byHour.get(h)!;
        // For "today", drop slots that have already started — booking the past
        // bounces in book_consultation anyway, so don't surface those bubbles.
        const futureSlots = isToday
          ? slots.filter(s => new Date(s.slot_start).getTime() > nowMs)
          : slots;
        if (futureSlots.length === 0) continue;
        const openSlots = futureSlots.filter(s => s.available);
        const anchor = futureSlots[0].slot_start;
        const isAvailable = openSlots.length > 0;
        // Pick least-loaded staffer among those open at this hour
        // (only meaningful for available bubbles).
        let best: { staffId: string; load: number } | null = null;
        if (isAvailable) {
          for (const s of openSlots) {
            const load = todayLoadByStaff.get(s.staff_id) ?? 0;
            if (!best || load < best.load) best = { staffId: s.staff_id, load };
          }
        }
        bubbles.push({
          hour: h,
          slotStartIso: anchor,
          available: isAvailable,
          recommendedStaffId: best?.staffId ?? null,
          openCount: openSlots.length,
          totalCount: futureSlots.length,
        });
      }
      out.set(date, bubbles);
    }
    return out;
  }, [weekDates, slotsByDateByStaff, eligibleStaffIds, todayLocal, todayLoadByStaff]);

  function pickBubble(date: string, b: BubbleData) {
    if (!b.recommendedStaffId) return;
    onChangeSelection({
      staffId: b.recommendedStaffId,
      slotStartIso: b.slotStartIso,
      dateStr: date,
    });
  }

  function clearSelection() {
    onChangeSelection({ staffId: null, slotStartIso: null, dateStr: null });
  }

  const atFloor = weekStart <= todayLocal;
  // Surrogate "you have a slot here" — used for the gold-ring highlight check.
  const selectedDate = selection.dateStr;
  const selectedHour = selection.slotStartIso ? hourOfIsoInFirmTz(selection.slotStartIso) : null;

  // Compact summary of the currently picked slot for the parent's status bar.
  // We also expose the panel's selected staffer name to the parent via the
  // selection itself (parent looks up by id from staffPool).

  return (
    <div className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-[#B8945F]" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66]">
          Availability — next 5 business days
        </p>
        <div className="ml-auto flex items-center gap-2">
          {selection.slotStartIso && selection.dateStr && (
            <button
              type="button"
              onClick={clearSelection}
              className="text-[10px] text-[#6B6B66] hover:text-[#FAFAF7] underline transition-colors"
            >
              Clear pick
            </button>
          )}
          <button
            type="button"
            onClick={() => setWeekStart(shiftBusinessDays(weekStart, -5))}
            disabled={atFloor}
            title="Previous 5 business days"
            className="p-1 text-[#FAFAF7] hover:text-[#B8945F] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-[#FAFAF7]">
            {formatDayShort(weekDates[0])} – {formatDayShort(weekDates[weekDates.length - 1])}
          </span>
          <button
            type="button"
            onClick={() => setWeekStart(shiftBusinessDays(weekStart, 5))}
            title="Next 5 business days"
            className="p-1 text-[#FAFAF7] hover:text-[#B8945F] transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {selection.slotStartIso && selection.dateStr && (
        <div className="mb-3 rounded border border-emerald-700/60 bg-emerald-900/20 px-3 py-2">
          <p className="text-[11px] text-emerald-200">
            <span className="font-semibold">Picked:</span> {formatDayLabel(selection.dateStr)} at {formatTimeFirmTz(selection.slotStartIso)}
            {(() => {
              const s = staffPool.find(s => s.id === selection.staffId);
              return s ? <span className="text-emerald-300/80"> · {s.name}</span> : null;
            })()}
          </p>
        </div>
      )}

      {slotsLoading ? (
        <p className="text-xs text-[#6B6B66] italic flex items-center gap-2">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Loading slots for {weekDates.length} days…
        </p>
      ) : staffPool.length === 0 ? (
        <p className="text-xs text-[#6B6B66] italic">No active intake staff are configured.</p>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {weekDates.map((date) => {
            const bubbles = bubblesByDate.get(date) ?? [];
            const isToday = date === todayLocal;
            // Day-level state — drives the at-a-glance availability tag.
            //   noSlots    → RPC returned zero rows for this date (lunch-only,
            //                holiday, or no staff on the schedule). Marked
            //                "Closed".
            //   fullyBooked → has slots but none available. Marked "Fully booked".
            //   else       → normal mix; show the bubbles.
            const noSlots = bubbles.length === 0;
            const openBubbleCount = bubbles.filter(b => b.available).length;
            const fullyBooked = !noSlots && openBubbleCount === 0;
            return (
              <div
                key={date}
                className={`rounded-lg border p-2 min-h-[300px] ${
                  noSlots || fullyBooked
                    ? "border-[#2A2A28] bg-[#0A0A09]"
                    : "border-[#2A2A28] bg-[#0F0F0E]"
                }`}
              >
                <div className="text-center mb-2 pb-2 border-b border-[#2A2A28]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#FAFAF7]">
                    {formatDayShort(date).split(",")[0]}
                  </p>
                  <p className="text-[10px] text-[#6B6B66]">
                    {(() => {
                      const [y, m, d] = date.split("-").map(Number);
                      return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
                        .toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
                    })()}
                  </p>
                  {isToday && (
                    <span className="inline-block mt-0.5 text-[9px] uppercase tracking-widest text-[#B8945F] font-semibold">
                      today
                    </span>
                  )}
                  {!isToday && (noSlots || fullyBooked) && (
                    <span
                      className={`inline-block mt-0.5 text-[9px] uppercase tracking-widest font-semibold ${
                        fullyBooked ? "text-red-300" : "text-[#6B6B66]"
                      }`}
                    >
                      {fullyBooked ? "fully booked" : "closed"}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {noSlots ? (
                    <p className="text-[10px] text-[#3A3A36] italic text-center py-4 leading-snug">
                      No working hours
                    </p>
                  ) : fullyBooked ? (
                    <>
                      <p className="text-[10px] text-red-300/80 italic text-center py-1">
                        Every slot is booked
                      </p>
                      {/* Render the booked bubbles muted so the hours are still
                          visible to staff scanning the column. */}
                      {bubbles.map((b) => (
                        <BookedBubble key={b.hour} timeLabel={formatTimeFirmTz(b.slotStartIso)} totalCount={b.totalCount} />
                      ))}
                    </>
                  ) : (
                    bubbles.map((b) => {
                      if (!b.available) {
                        return (
                          <BookedBubble
                            key={b.hour}
                            timeLabel={formatTimeFirmTz(b.slotStartIso)}
                            totalCount={b.totalCount}
                          />
                        );
                      }
                      const isPicked =
                        selectedDate === date && selectedHour === b.hour;
                      return (
                        <button
                          key={b.hour}
                          type="button"
                          onClick={() => pickBubble(date, b)}
                          title={`${b.openCount} of ${b.totalCount} open`}
                          className={`w-full text-[11px] font-semibold py-1.5 px-2 rounded border transition-all ${
                            isPicked
                              ? "bg-[#B8945F] border-[#B8945F] text-[#0F0F0E] ring-2 ring-[#B8945F] ring-offset-1 ring-offset-[#0F0F0E]"
                              : "bg-emerald-900/30 hover:bg-emerald-900/50 border-emerald-700/50 text-emerald-100"
                          }`}
                        >
                          {formatTimeFirmTz(b.slotStartIso)}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[10px] text-[#6B6B66]">
        <span className="inline-block w-2 h-2 rounded bg-emerald-700/70 align-middle mr-1" /> open ·
        <span className="inline-block w-2 h-2 rounded bg-[#3A3A36] align-middle mx-1" /> booked ·
        days with no open slots show <span className="text-red-300/90 font-semibold">Fully booked</span> /
        <span className="text-[#6B6B66] font-semibold"> Closed</span>.
        Tapping an open slot picks the least-loaded staffer free at that time.
      </p>
    </div>
  );
}

// ─── Booked-slot bubble (gray, disabled) ─────────────────────────────────────
//
// Renders an hour where the RPC returned slots but none are available — i.e.
// every staffer with a slot at that hour is already booked. Visually muted
// so open emerald bubbles in the same column pop out at a glance.

function BookedBubble({ timeLabel, totalCount }: { timeLabel: string; totalCount: number }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title={`Booked — all ${totalCount} staffer${totalCount === 1 ? "" : "s"} taken at this hour`}
      className="w-full text-[11px] font-semibold py-1.5 px-2 rounded border bg-[#1A1A18] border-[#2A2A28] text-[#6B6B66] line-through cursor-not-allowed opacity-70"
    >
      {timeLabel}
    </button>
  );
}

// ─── See Who's Available — read-only roster ──────────────────────────────────
//
// Renders today's status for each active intake staffer. Read-only: no
// reassign / transfer buttons in this build. A live transfer-request handshake
// would need a new intake_transfer_requests table (flagged but NOT built).

export interface StaffAvailabilityListProps {
  staffPool: StaffDetail[];
  calEvents: CalEvent[];
  currentSessionId: string;
  todayLocal: string;
}

export function StaffAvailabilityList({
  staffPool, calEvents, currentSessionId, todayLocal,
}: StaffAvailabilityListProps) {
  const [todaySlots, setTodaySlots] = useState<Map<string, OpenSlot[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("get_open_slots", {
        p_staff_id: null,
        p_date: todayLocal,
        p_slot_minutes: DEFAULT_SLOT_MINUTES,
      });
      if (cancelled) return;
      const m = new Map<string, OpenSlot[]>();
      if (!error && Array.isArray(data)) {
        for (const s of data as OpenSlot[]) {
          if (!m.has(s.staff_id)) m.set(s.staff_id, []);
          m.get(s.staff_id)!.push(s);
        }
        for (const arr of m.values()) {
          arr.sort((a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime());
        }
      }
      setTodaySlots(m);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [todayLocal]);

  const nowMs = Date.now();
  type RosterRow = {
    staff: StaffDetail;
    status: "free_now" | "next_slot" | "imminent_appt" | "no_slots";
    detail: string;
    nextSlotIso: string | null;
  };
  const roster: RosterRow[] = useMemo(() => {
    const rows: RosterRow[] = [];
    for (const staff of staffPool) {
      const arr = todaySlots.get(staff.id) ?? [];
      const futureAvail = arr.filter(s => s.available && new Date(s.slot_start).getTime() > nowMs);
      const imminent = calEvents.some(e => {
        if (e.staff_id !== staff.id) return false;
        if (e.event_subtype !== "consultation") return false;
        if (["cancelled", "no_show", "rescheduled"].includes(e.status)) return false;
        const startMs = new Date(e.start_time).getTime();
        const endMs = new Date(e.end_time).getTime();
        if (nowMs >= startMs && nowMs < endMs) return true;
        const minsUntil = (startMs - nowMs) / 60_000;
        return minsUntil > 0 && minsUntil <= IMMINENT_APPT_WINDOW_MIN;
      });
      const freeNow = futureAvail.some(s => {
        const startMs = new Date(s.slot_start).getTime();
        const minsUntil = (startMs - nowMs) / 60_000;
        return minsUntil >= -DEFAULT_SLOT_MINUTES && minsUntil <= IMMINENT_APPT_WINDOW_MIN;
      });
      if (arr.length === 0) {
        rows.push({ staff, status: "no_slots", detail: "Off today", nextSlotIso: null });
        continue;
      }
      if (imminent) {
        rows.push({ staff, status: "imminent_appt", detail: "In a consult", nextSlotIso: futureAvail[0]?.slot_start ?? null });
        continue;
      }
      if (freeNow) {
        rows.push({ staff, status: "free_now", detail: "Free now", nextSlotIso: futureAvail[0]?.slot_start ?? null });
        continue;
      }
      if (futureAvail.length > 0) {
        rows.push({
          staff, status: "next_slot",
          detail: `Next at ${formatTimeFirmTz(futureAvail[0].slot_start)}`,
          nextSlotIso: futureAvail[0].slot_start,
        });
        continue;
      }
      rows.push({ staff, status: "no_slots", detail: "No remaining slots today", nextSlotIso: null });
    }
    // Sort: free_now → next_slot → imminent → no_slots
    const order: Record<RosterRow["status"], number> = {
      free_now: 0, next_slot: 1, imminent_appt: 2, no_slots: 3,
    };
    rows.sort((a, b) => order[a.status] - order[b.status]
      || a.staff.name.localeCompare(b.staff.name));
    return rows;
  }, [staffPool, todaySlots, calEvents, nowMs]);

  return (
    <div className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-[#B8945F]" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66]">
          Who's available — today
        </p>
        {loading && <RefreshCw className="w-3 h-3 animate-spin text-[#6B6B66]" />}
      </div>
      {staffPool.length === 0 ? (
        <p className="text-xs text-[#6B6B66] italic">No active intake staff are configured.</p>
      ) : (
        <ul className="space-y-1.5">
          {roster.map(r => {
            const dot =
              r.status === "free_now"      ? "bg-emerald-500" :
              r.status === "next_slot"     ? "bg-amber-500"   :
              r.status === "imminent_appt" ? "bg-sky-500"     :
                                              "bg-[#3A3A36]";
            return (
              <li key={r.staff.id} className="flex items-center gap-2 px-2 py-1.5 rounded border border-[#2A2A28] bg-[#0F0F0E]">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                <span className="text-xs text-[#FAFAF7] font-semibold flex-1 truncate">
                  {r.staff.name}
                  {r.staff.id === currentSessionId && (
                    <span className="ml-1 text-[9px] uppercase tracking-widest text-[#B8945F]">you</span>
                  )}
                </span>
                <span className="text-[10px] text-[#6B6B66]">{r.detail}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[10px] text-[#6B6B66] italic">
        Read-only. Live transfer / reassign is the next phase — it needs an intake_transfer_requests table and a
        request → accept handshake (intentionally not built here).
      </p>
    </div>
  );
}

// Sparkles import kept for compatibility with prior consumers; no longer used
// inside this file but re-exported in case external imports expect it.
export { Sparkles };
