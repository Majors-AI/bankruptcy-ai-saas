// Top bubbles row + Overview + Performance / Goals bubble.
//
// Extracted from IntakeDashboard.tsx (Prompt 54). Behavior preserved
// exactly. To stay free of intake-specific assumptions, RetentionBubble
// now accepts a `departments` prop instead of hard-coding [INTAKE_METRICS]
// inside the function body. The Intake host passes `[INTAKE_METRICS]`
// from the new `types.ts` re-export; Accounting / Legal hosts will pass
// `[ACCOUNTING_METRICS]` / `[LEGAL_METRICS]` when they mount the same
// shell.

import { CheckCircle2, ListChecks, Target } from "lucide-react";
import type { TaskColor, TaskEntry, DeptMetricDef, DeptMetricSet } from "./types";
import { BubbleCard, PlaceholderValue } from "./primitives";
import {
  currentMonthIso, getCurrentStaffId,
  useCurrentMonthActuals, useEmployeeGoals,
  type PerfMetricKey,
} from "../../lib/perfGoalsStore";

// ─── Top bubbles row ─────────────────────────────────────────────────────────
//
// Two bubble cards across the top of the dashboard:
//   1. Overview   — REAL where the data exists (task counts by priority).
//   2. Performance / Goals — SCAFFOLD; mirrors the per-employee goals UI.

export interface TopBubblesRowProps {
  /** All entries from the shared color-coded task pool. OverviewBubble
   *  counts by color (RED/ORANGE/YELLOW/BLUE) for the priority breakdown. */
  sharedTasks: TaskEntry[];
  /** Departments to render in the Performance / Goals column. Today the
   *  Intake host passes `[INTAKE_METRICS]`. When the staff-setup model
   *  adds multi-department assignment, hosts will pass the staffer's
   *  assigned set and the grid renders them side-by-side automatically. */
  departments: DeptMetricSet[];
}

export function TopBubblesRow({ sharedTasks, departments }: TopBubblesRowProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <OverviewBubble sharedTasks={sharedTasks} />
      <RetentionBubble departments={departments} />
    </div>
  );
}

// ─── Bubble 2 — Overview (REAL where possible) ───────────────────────────────

interface OverviewBubbleProps {
  sharedTasks: TaskEntry[];
}

export function OverviewBubble({ sharedTasks }: OverviewBubbleProps) {
  const counts = sharedTasks.reduce(
    (acc, t) => { acc[t.color] = (acc[t.color] ?? 0) + 1; return acc; },
    { red: 0, orange: 0, yellow: 0, blue: 0 } as Record<TaskColor, number>,
  );
  const total = sharedTasks.length;

  return (
    <BubbleCard
      title="Overview — by priority"
      icon={<ListChecks className="w-4 h-4" />}
    >
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[#FAFAF7] leading-none">{total}</span>
          <span className="text-[10px] uppercase tracking-widest text-[#6B6B66]">open tasks</span>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <PriorityCount color="red"    count={counts.red} />
          <PriorityCount color="orange" count={counts.orange} />
          <PriorityCount color="yellow" count={counts.yellow} />
          <PriorityCount color="blue"   count={counts.blue} />
        </div>

        <p className="text-[10px] text-[#6B6B66] italic leading-snug">
          Same RED / ORANGE / YELLOW / BLUE rules as the left-column task list
          and the Up Next card.
        </p>

        {/* Pace nudge — SCAFFOLD. Gentle by design. */}
        <div className="flex items-start gap-2 rounded border border-emerald-700/30 bg-emerald-900/10 px-2.5 py-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-emerald-200 leading-snug">
            You're keeping up. Be mindful of the clock — and take a breath when you need one.
          </p>
        </div>
      </div>
    </BubbleCard>
  );
}

// Single priority-tier row inside the Overview bubble.
function PriorityCount({ color, count }: { color: TaskColor; count: number }) {
  const cfg = {
    red:    { label: "Hot (RED)",     desc: "appts · unread msgs · emergency",    dot: "bg-red-500" },
    orange: { label: "Mid (ORANGE)",  desc: "urgent leads",                         dot: "bg-orange-400" },
    yellow: { label: "Present (YEL)", desc: "attorney accepted · present case",     dot: "bg-yellow-400" },
    blue:   { label: "Sched (BLUE)",  desc: "new contact · fee-quoted follow-ups",  dot: "bg-sky-400" },
  }[color];
  return (
    <div className="flex items-start gap-1.5">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${cfg.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-[#6B6B66] truncate">{cfg.label}</p>
        <p className="text-[9px] text-[#3A3A36] leading-tight truncate">{cfg.desc}</p>
      </div>
      <span className={`text-xs font-bold flex-shrink-0 ${count > 0 ? "text-[#FAFAF7]" : "text-[#6B6B66]"}`}>{count}</span>
    </div>
  );
}

// ─── Bubble 3 — Performance / Goals Report (SCAFFOLD) ────────────────────────
//
// Each entry in `departments` becomes one column. With one entry (today's
// Intake host) it's a single-column grid; with two it switches to
// lg:grid-cols-2 automatically.

export function RetentionBubble({ departments }: { departments: DeptMetricSet[] }) {
  return (
    <BubbleCard
      title="Performance / Goals Report"
      icon={<Target className="w-4 h-4" />}
      scaffold
    >
      <div className="space-y-3">
        <div
          className={`grid grid-cols-1 gap-3 ${
            departments.length >= 2 ? "lg:grid-cols-2" : ""
          }`}
        >
          {departments.map(dept => (
            <DepartmentGoalColumn key={dept.key} dept={dept} />
          ))}
        </div>

        <GoalsFooterNote />
      </div>
    </BubbleCard>
  );
}

/** Renders one of two footer states for the Performance / Goals card:
 *    1. EMPTY  → no goals set for the staffer this month. Direct them
 *                to Law Firm Settings → Performance Goals.
 *    2. ACTIVE → at least one target is set. Show a brief "set in
 *                Performance Goals" reference so the source is clear. */
function GoalsFooterNote() {
  const staffId = getCurrentStaffId();
  const month = currentMonthIso();
  const goals = useEmployeeGoals(staffId, month);
  const anyGoalSet = (Object.keys(goals) as PerfMetricKey[]).some(k => goals[k] != null);
  if (!anyGoalSet) {
    return (
      <div className="rounded border border-dashed border-amber-500/40 bg-amber-500/5 px-2.5 py-2">
        <p className="text-[11px] text-amber-200 italic leading-snug">
          No monthly target set — set one in
          <span className="text-amber-100 font-semibold"> Law Firm Settings → Performance Goals</span>
          {" "}for {month}.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded border border-[#2A2A28] bg-[#0F0F0E] px-2.5 py-2">
      <p className="text-[10px] text-[#6B6B66] italic leading-snug">
        Targets sourced from
        <span className="text-[#FAFAF7] font-semibold"> Law Firm Settings → Performance Goals</span>
        {" "}for {month}. Actuals refresh from the lead/case event aggregator.
      </p>
    </div>
  );
}

function DepartmentGoalColumn({ dept }: { dept: DeptMetricSet }) {
  return (
    <div className="rounded border border-[#2A2A28] bg-[#0F0F0E] p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#FAFAF7]">
          {dept.label}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-[#6B6B66]">
          {dept.monthlyGoalLabel}
        </span>
      </div>

      {/* Header row — Current · Goal · Needed */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 items-center pb-1 mb-1 border-b border-[#2A2A28]">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-[#6B6B66]" />
        <span className="text-[9px] font-semibold uppercase tracking-widest text-[#6B6B66] text-right w-10">Now</span>
        <span className="text-[9px] font-semibold uppercase tracking-widest text-[#6B6B66] text-right w-10">Goal</span>
        <span className="text-[9px] font-semibold uppercase tracking-widest text-[#6B6B66] text-right w-12">Needed</span>
      </div>

      <dl>
        {dept.metrics.map(m => (
          <GoalMetricRow key={m.key} metric={m} />
        ))}
      </dl>
    </div>
  );
}

function GoalMetricRow({ metric }: { metric: DeptMetricDef }) {
  // Performance Goals backend (in-memory + per-tab localStorage today):
  //   - NOW    ← getCurrentMonthActuals(staffId)[metric] from perfGoalsStore
  //   - GOAL   ← getGoal(staffId, currentMonthIso(), metric) from same
  //   - NEEDED ← max(0, GOAL − NOW) when GOAL is set; "—" when not set
  // Tooltip explains the wiring so anyone hovering knows the source.
  const staffId = getCurrentStaffId();
  const month = currentMonthIso();
  const actuals = useCurrentMonthActuals(staffId);
  const goals = useEmployeeGoals(staffId, month);

  const nowRaw = actuals[metric.key as PerfMetricKey];
  const goalRaw = goals[metric.key as PerfMetricKey];
  const neededRaw = goalRaw != null ? Math.max(0, goalRaw - nowRaw) : null;

  const fmt = (v: number | null) => {
    if (v == null) return metric.isPercentage ? "—%" : "—";
    if (metric.isPercentage) return `${v}%`;
    return String(v);
  };

  const tooltipNow =
    "Current-month actual — sum of qualifying events tied to this staffer "
    + "(seed today; wired by lead/case event aggregation in Phase B).";
  const tooltipGoal = goalRaw != null
    ? `Monthly target for ${month} — set in Law Firm Settings → Performance Goals.`
    : "No monthly target set. Set one in Law Firm Settings → Performance Goals.";
  const tooltipNeeded =
    goalRaw != null
      ? "Math.max(0, GOAL − NOW) — what's still required to hit target."
      : "Pending — set a monthly target first.";

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 items-center py-0.5">
      <dt className="text-[10px] text-[#6B6B66] truncate">{metric.label}</dt>
      <dd className="text-[10px] text-right w-10">
        <span title={tooltipNow} className="text-[#FAFAF7] tabular-nums">{fmt(nowRaw)}</span>
      </dd>
      <dd className="text-[10px] text-right w-10">
        {goalRaw != null
          ? <span title={tooltipGoal} className="text-[#FAFAF7] tabular-nums">{fmt(goalRaw)}</span>
          : <PlaceholderValue title={tooltipGoal}>{metric.isPercentage ? "—%" : "—"}</PlaceholderValue>}
      </dd>
      <dd className="text-[10px] text-right w-12">
        {neededRaw != null
          ? <span title={tooltipNeeded} className={`tabular-nums ${neededRaw === 0 ? "text-emerald-400" : "text-amber-300"}`}>{fmt(neededRaw)}</span>
          : <PlaceholderValue title={tooltipNeeded}>{metric.isPercentage ? "—%" : "—"}</PlaceholderValue>}
      </dd>
    </div>
  );
}
