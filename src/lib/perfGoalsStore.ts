// Performance Goals store — supervisors set per-employee monthly targets
// for the four Intake metrics (Retained, Show/answer rate, Appointments
// set, Presented). Powers:
//   - Law Firm Settings → Performance Goals editor (write)
//   - Intake dashboard Performance/Goals card (read)
//
// Storage: in-memory + per-tab localStorage. Same module-singleton +
// subscriber pattern as the other firm-policy knobs.
// TODO Phase B — firm_perf_goals(firm_id, employee_id, month_iso, metric,
// target_value, set_by, set_at) + firm_perf_goal_results(...) for the
// aggregated actuals.

import { useEffect, useState } from "react";
import type { CalendarDepartmentId } from "./firmPolicy";

// ─── Types ─────────────────────────────────────────────────────────────────

export type PerfMetricKey = "retained" | "show_answer_rate" | "appts_set" | "presented";

export const PERF_METRICS: ReadonlyArray<{
  key: PerfMetricKey;
  label: string;
  isPercentage?: boolean;
}> = [
  { key: "retained",         label: "Retained" },
  { key: "show_answer_rate", label: "Show / answer rate", isPercentage: true },
  { key: "appts_set",        label: "Appointments set" },
  { key: "presented",        label: "Presented" },
];

export interface StaffSeed {
  id: string;
  name: string;
  /** Department the staffer belongs to — controls own-dept supervisor
   *  gating. Defined as the calendar department enum so it lines up with
   *  the Calendar Configuration / Department Settings surface. */
  departmentId: CalendarDepartmentId;
}

// In production this comes from the firm's staff roster (the existing
// department-management store has the canonical list). Seeded here so
// the page has something to render in the scaffold.
// TODO: wire from staff_members / department_management roster.
export const STAFF_SEED: ReadonlyArray<StaffSeed> = [
  { id: "emp-int-1", name: "Jordan Reyes",    departmentId: "intake" },
  { id: "emp-int-2", name: "Priya Patel",     departmentId: "intake" },
  { id: "emp-int-3", name: "Marcus Johnson",  departmentId: "intake" },
  { id: "emp-leg-1", name: "Jennifer Smith",  departmentId: "legal" },
  { id: "emp-acc-1", name: "Lin Chen",        departmentId: "accounting" },
  { id: "emp-cr-1",  name: "Avery Park",      departmentId: "client_relations" },
];

// ─── Targets store ─────────────────────────────────────────────────────────

const STORAGE_KEY_GOALS = "firmPolicy.perfGoals";

/** Key for a single goal — {employeeId}|{monthIso}|{metric}. */
function goalKey(employeeId: string, monthIso: string, metric: PerfMetricKey): string {
  return `${employeeId}|${monthIso}|${metric}`;
}

/** Month-ISO format: YYYY-MM (e.g. "2026-06"). */
export function currentMonthIso(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

let _goals: Map<string, number> = (() => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY_GOALS) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, number>;
      const m = new Map<string, number>();
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "number" && Number.isFinite(v) && v >= 0) m.set(k, v);
      }
      return m;
    }
  } catch { /* ignore */ }
  return new Map();
})();

const _subscribers = new Set<() => void>();
function _notify() { _subscribers.forEach(fn => fn()); }
function _persist() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(Object.fromEntries(_goals)));
  } catch { /* ignore */ }
}

/** Read a single goal value. Returns null when unset. */
export function getGoal(
  employeeId: string,
  monthIso: string,
  metric: PerfMetricKey,
): number | null {
  const v = _goals.get(goalKey(employeeId, monthIso, metric));
  return typeof v === "number" ? v : null;
}

/** Set / clear a single goal. Passing null clears. */
export function setGoal(
  employeeId: string,
  monthIso: string,
  metric: PerfMetricKey,
  value: number | null,
): void {
  const k = goalKey(employeeId, monthIso, metric);
  if (value == null || !Number.isFinite(value) || value < 0) {
    _goals.delete(k);
  } else {
    _goals.set(k, value);
  }
  _persist();
  _notify();
}

/** Reactive hook returning the full {metric → goalValue|null} map for an
 *  employee in the given month. Re-renders on any goal write. */
export function useEmployeeGoals(
  employeeId: string,
  monthIso: string,
): Record<PerfMetricKey, number | null> {
  const read = () => {
    const out: Record<PerfMetricKey, number | null> = {
      retained: null, show_answer_rate: null, appts_set: null, presented: null,
    };
    PERF_METRICS.forEach(m => { out[m.key] = getGoal(employeeId, monthIso, m.key); });
    return out;
  };
  const [snapshot, setSnapshot] = useState(read);
  useEffect(() => {
    const sync = () => setSnapshot(read());
    _subscribers.add(sync);
    sync();
    return () => { _subscribers.delete(sync); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, monthIso]);
  return snapshot;
}

// ─── Gating ────────────────────────────────────────────────────────────────

/** Pure permission check — can the viewer set goals for the given employee?
 *  Super-admins / law-firm-owners pass for any employee. Department
 *  supervisors pass only when the employee belongs to their department.
 *  Anyone else fails. */
export function canSetGoalsForEmployee(
  viewer: {
    isSuperAdmin: boolean;
    isLawFirmOwner: boolean;
    supervisorDeptId?: CalendarDepartmentId | null;
  },
  employee: { departmentId: CalendarDepartmentId },
): boolean {
  if (viewer.isSuperAdmin) return true;
  if (viewer.isLawFirmOwner) return true;
  if (viewer.supervisorDeptId && viewer.supervisorDeptId === employee.departmentId) return true;
  return false;
}

// ─── Actuals aggregation (Part 2) ──────────────────────────────────────────
//
// Computes each staffer's current-month actuals for the four metrics.
// Today these are computed from a small per-employee seed so the Intake
// card has real numbers to render against the goals. Real-data wiring is
// flagged inline per metric.

interface ActualsSeed {
  retained:         number;
  appts_set:        number;
  presented:        number;
  /** show_answer_rate is presented (calls answered) / total inbound calls,
   *  expressed as a 0–100 percent. */
  show_answers:     number;
  total_inbound:    number;
}

// TODO: wire from real lead / case events. The actuals each metric needs:
//   retained         ← COUNT(leads WHERE retained_at IN current_month
//                         AND lead.assigned_employee_id = employee)
//   show_answer_rate ← presented / total_inbound (per-employee, current month)
//   appts_set        ← COUNT(scheduling_events WHERE created_in_month
//                         AND assigned_employee_id = employee)
//   presented        ← COUNT(consultations WHERE consult_held IN current_month
//                         AND employee_id = employee)
const ACTUALS_SEED: Readonly<Record<string, ActualsSeed>> = {
  "emp-int-1": { retained: 12, appts_set: 35, presented: 28, show_answers: 22, total_inbound: 31 },
  "emp-int-2": { retained:  8, appts_set: 29, presented: 24, show_answers: 19, total_inbound: 27 },
  "emp-int-3": { retained: 14, appts_set: 41, presented: 33, show_answers: 27, total_inbound: 35 },
  // Non-intake staff have zero Intake-metric actuals.
  "emp-leg-1": { retained: 0, appts_set: 0, presented: 0, show_answers: 0, total_inbound: 0 },
  "emp-acc-1": { retained: 0, appts_set: 0, presented: 0, show_answers: 0, total_inbound: 0 },
  "emp-cr-1":  { retained: 0, appts_set: 0, presented: 0, show_answers: 0, total_inbound: 0 },
};

export interface CurrentMonthActuals {
  retained:         number;
  show_answer_rate: number; // 0–100
  appts_set:        number;
  presented:        number;
}

/** Compute the current-month actuals for a staffer. Returns zeros for any
 *  metric the seed doesn't cover; the leaf-wiring TODOs above name the
 *  source events each metric needs. */
export function getCurrentMonthActuals(employeeId: string): CurrentMonthActuals {
  const a = ACTUALS_SEED[employeeId];
  if (!a) return { retained: 0, show_answer_rate: 0, appts_set: 0, presented: 0 };
  const rate = a.total_inbound > 0 ? (a.show_answers / a.total_inbound) * 100 : 0;
  return {
    retained:         a.retained,
    show_answer_rate: Math.round(rate * 10) / 10, // 1 dp
    appts_set:        a.appts_set,
    presented:        a.presented,
  };
}

/** Reactive hook — pure derivation, but exposed as a hook so future
 *  switches from seed → real query can be a swap. */
export function useCurrentMonthActuals(employeeId: string): CurrentMonthActuals {
  return getCurrentMonthActuals(employeeId);
}

// ─── "Logged-in staffer" id (placeholder until auth context lands) ─────────

const STORAGE_KEY_CURRENT_STAFF = "firmPolicy.currentStaffId";
const DEFAULT_CURRENT_STAFF_ID = "emp-int-1"; // Jordan Reyes (Intake)

/** Read the logged-in staffer id. Today defaults to the first Intake seed
 *  employee (Jordan Reyes) so the dashboard surfaces actual numbers in
 *  dev. Env override via localStorage so different test sessions can
 *  preview different staffers' cards.
 *  TODO: replace with the BAN-40 auth context staff_id. */
export function getCurrentStaffId(): string {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY_CURRENT_STAFF);
      if (raw && STAFF_SEED.some(s => s.id === raw)) return raw;
    }
  } catch { /* ignore */ }
  return DEFAULT_CURRENT_STAFF_ID;
}

/** Look up the staff seed for an id. */
export function getStaffSeed(employeeId: string): StaffSeed | undefined {
  return STAFF_SEED.find(s => s.id === employeeId);
}
