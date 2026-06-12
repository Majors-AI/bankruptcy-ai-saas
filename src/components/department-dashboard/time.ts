// Shared time / date helpers used by the department-dashboard module.
//
// Hoisted from IntakeDashboard.tsx during the Slice-1 extraction (Prompt 54).
// Behavior preserved exactly — every helper here is a verbatim copy of the
// version that lived in the Intake host. Other intake-specific helpers
// (formatTimeRange, formatDateLabel, formatHourLabel, formatDuration,
// formatDayLabel, hourOfIsoInFirmTz) stay in IntakeDashboard.tsx because
// only intake surfaces use them.
//
// TODO templating pass: read firm timezone from firms.timezone instead of
// the hardcoded LA value. Same TODO that's in IntakeDashboard.

export const FIRM_TZ = "America/Los_Angeles";

export function todayInFirmTz(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: FIRM_TZ });
}

/** YYYY-MM-DD of the next business day (skips Sat/Sun) after `dateStr`. */
export function nextBusinessDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  while (true) {
    dt.setUTCDate(dt.getUTCDate() + 1);
    const dow = dt.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      const yy = dt.getUTCFullYear();
      const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(dt.getUTCDate()).padStart(2, "0");
      return `${yy}-${mm}-${dd}`;
    }
  }
}

export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: FIRM_TZ });
}

export function formatHm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/**
 * Compact due-time label for a task row.
 *   - overdue   → "5h ago"
 *   - today     → "Today 3:00 PM"
 *   - tomorrow  → "Tomorrow 9:00 AM"  (next business day, skips weekends)
 *   - this week → "Tue 9:00 AM"
 *   - else      → "Jun 12 · 9:00 AM"
 */
export function formatDueLabel(iso: string): string {
  const due = new Date(iso);
  const dueMs = due.getTime();
  const nowMs = Date.now();
  const diffMs = dueMs - nowMs;
  const dueDay = due.toLocaleDateString("en-CA", { timeZone: FIRM_TZ });
  const today = todayInFirmTz();
  const tomorrow = nextBusinessDay(today); // closest workday — informational only

  if (diffMs < 0) {
    const mins = Math.floor(-diffMs / 60_000);
    if (mins < 60)  return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  }

  const timeStr = due.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: FIRM_TZ,
  });

  if (dueDay === today)    return `Today ${timeStr}`;
  if (dueDay === tomorrow) return `Tomorrow ${timeStr}`;

  // Within the next 6 days → weekday short label
  const oneWeekMs = 6 * 24 * 60 * 60 * 1000;
  if (diffMs < oneWeekMs) {
    const dow = due.toLocaleDateString("en-US", { weekday: "short", timeZone: FIRM_TZ });
    return `${dow} ${timeStr}`;
  }
  const dateStr = due.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: FIRM_TZ });
  return `${dateStr} · ${timeStr}`;
}
