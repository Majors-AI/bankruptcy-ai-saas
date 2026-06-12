// Performance Goals — supervisors / super-admins set per-employee
// monthly targets for the four Intake metrics. Powers the
// Intake-dashboard Performance/Goals card.
//
// Gating (per spec):
//   - Super-admin / law-firm-owner: set any employee's targets.
//   - Department supervisor:        set ONLY their own department's
//                                   staff.
//
// Today the dept-supervisor signal isn't plumbed through LawFirmSettings,
// so this page exposes a "Preview as" scope selector at the top that lets
// the operator pretend to be a dept-supervisor and see the gating in
// action. Real role plumbing wires when BAN-40 auth lands.
//
// Storage: in-memory + localStorage via perfGoalsStore.ts. TODO Phase B —
// firm_perf_goals table.

import { useMemo, useState } from "react";
import {
  Target, Save, RefreshCcw, Lock, Users, Briefcase, Phone, FileText, Scale,
} from "lucide-react";
import {
  PERF_METRICS, STAFF_SEED, currentMonthIso,
  setGoal, useEmployeeGoals, canSetGoalsForEmployee,
  type PerfMetricKey, type StaffSeed,
} from "../../lib/perfGoalsStore";
import type { CalendarDepartmentId } from "../../lib/firmPolicy";
import type { ViewerRole } from "../department-management/types";

interface Props {
  viewerRole: ViewerRole;
}

const DEPT_ICON: Record<CalendarDepartmentId, React.FC<{ className?: string }>> = {
  intake:           Users,
  accounting:       Briefcase,
  client_relations: Phone,
  court:            Scale,
  legal:            FileText,
};

const DEPT_LABEL: Record<CalendarDepartmentId, string> = {
  intake:           "Intake",
  accounting:       "Accounting",
  client_relations: "Client Relations",
  court:            "Court",
  legal:            "Legal",
};

export default function PerformanceGoalsPage({ viewerRole }: Props) {
  const isSuperAdmin = viewerRole === "law_firm_owner" || viewerRole === "super_admin";
  const isLawFirmOwner = viewerRole === "law_firm_owner";

  // Scope-preview selector. "all" = super-admin scope (see every staffer);
  // a dept id = pretend-dept-supervisor scope (own-dept only). When real
  // role plumbing lands, the visible scope is derived from the viewer's
  // assignment rather than this selector.
  const [previewScope, setPreviewScope] = useState<"all" | CalendarDepartmentId>("all");
  const month = currentMonthIso();

  const visibleStaff = useMemo(() => {
    if (previewScope === "all") return STAFF_SEED;
    return STAFF_SEED.filter(s => s.departmentId === previewScope);
  }, [previewScope]);

  const groupedByDept = useMemo(() => {
    const m = new Map<CalendarDepartmentId, StaffSeed[]>();
    visibleStaff.forEach(s => {
      const list = m.get(s.departmentId) ?? [];
      list.push(s);
      m.set(s.departmentId, list);
    });
    return Array.from(m.entries());
  }, [visibleStaff]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#1A1A18] border border-[#2A2A28] flex items-center justify-center"
             style={{ color: "var(--lfs-accent)" }}>
          <Target className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-[#FAFAF7]">Performance Goals</h2>
          <p className="text-[11px] text-[#6B6B66] mt-0.5 leading-relaxed max-w-2xl">
            Per-employee monthly targets for the four Intake metrics. Targets surface on each
            employee's <strong className="text-[#FAFAF7]">Intake dashboard → Performance / Goals
            Report</strong> card as NOW / GOAL / NEEDED. Current month:
            {" "}<span className="text-[#FAFAF7] font-semibold">{month}</span>.
          </p>
        </div>
        {!isSuperAdmin && (
          <span className="text-[10px] uppercase tracking-widest text-[#6B6B66] border border-[#2A2A28] rounded-full px-2 py-1 inline-flex items-center gap-1">
            <Lock className="w-3 h-3" /> Read-only — supervisor / super-admin required
          </span>
        )}
      </div>

      {/* Scope-preview selector */}
      <section className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-[11px] font-semibold text-[#FAFAF7]">Preview as</p>
          <select
            value={previewScope}
            onChange={e => setPreviewScope(e.target.value as "all" | CalendarDepartmentId)}
            className="bg-[#0F0F0E] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5"
          >
            <option value="all">Super-admin scope · every staffer</option>
            <option value="intake">           Intake supervisor scope</option>
            <option value="accounting">       Accounting supervisor scope</option>
            <option value="client_relations"> Client Relations supervisor scope</option>
            <option value="court">            Court supervisor scope</option>
            <option value="legal">            Legal supervisor scope</option>
          </select>
          <span className="text-[10px] text-[#6B6B66] italic">
            {/* TODO: replace with real role plumbing — dept-supervisor signal
                comes from staff_members.supervisor_dept once auth ships. */}
            scope preview · real role plumbing lands with auth
          </span>
        </div>
      </section>

      {/* Per-department staff editors */}
      {groupedByDept.length === 0 && (
        <section className="rounded-xl border border-dashed border-[#2A2A28] bg-[#0F0F0E] p-5 text-center">
          <p className="text-[12px] text-[#6B6B66] italic">
            No staff in this scope.
          </p>
        </section>
      )}
      {groupedByDept.map(([deptId, staff]) => (
        <DepartmentSection
          key={deptId}
          deptId={deptId}
          staff={staff}
          month={month}
          viewer={{
            isSuperAdmin,
            isLawFirmOwner,
            supervisorDeptId: previewScope === "all" ? null : previewScope,
          }}
        />
      ))}

      <p className="text-[10px] text-[#6B6B66] italic leading-snug">
        {/* TODO Phase B — firm_perf_goals(firm_id, employee_id, month_iso,
              metric, target_value, set_by, set_at). Audit each save +
              push real-time updates to open Intake dashboards. */}
        Today the goals live in memory + per-tab localStorage. Server persistence + audit
        land with the firm_perf_goals table.
      </p>
    </div>
  );
}

// ─── Per-department section ────────────────────────────────────────────────

function DepartmentSection({
  deptId, staff, month, viewer,
}: {
  deptId: CalendarDepartmentId;
  staff: ReadonlyArray<StaffSeed>;
  month: string;
  viewer: { isSuperAdmin: boolean; isLawFirmOwner: boolean; supervisorDeptId: CalendarDepartmentId | null };
}) {
  const Icon = DEPT_ICON[deptId];
  return (
    <section className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-5">
      <div className="flex items-center gap-2 mb-3" style={{ color: "var(--lfs-accent)" }}>
        <Icon className="w-4 h-4" />
        <p className="text-sm font-bold text-[#FAFAF7]">{DEPT_LABEL[deptId]}</p>
        <span className="text-[10px] uppercase tracking-widest text-[#6B6B66] border border-[#2A2A28] rounded-full px-2 py-0.5">
          {staff.length} staff
        </span>
      </div>
      <div className="space-y-2">
        {staff.map(s => (
          <EmployeeGoalRow key={s.id} employee={s} month={month} viewer={viewer} />
        ))}
      </div>
    </section>
  );
}

function EmployeeGoalRow({
  employee, month, viewer,
}: {
  employee: StaffSeed;
  month: string;
  viewer: { isSuperAdmin: boolean; isLawFirmOwner: boolean; supervisorDeptId: CalendarDepartmentId | null };
}) {
  const goals = useEmployeeGoals(employee.id, month);
  const canEdit = canSetGoalsForEmployee(viewer, employee);

  return (
    <div className={`rounded-lg border ${canEdit ? "border-[#2A2A28]" : "border-[#2A2A28]/50"} bg-[#0F0F0E] p-3`}>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-[#FAFAF7]">{employee.name}</span>
          <span className="text-[9px] uppercase tracking-widest text-[#6B6B66] font-mono">{employee.id}</span>
        </div>
        {!canEdit && (
          <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-[#6B6B66] border border-[#2A2A28] rounded-full px-2 py-0.5">
            <Lock className="w-3 h-3" /> out of scope
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {PERF_METRICS.map(m => (
          <GoalInput
            key={m.key}
            employeeId={employee.id}
            month={month}
            metricKey={m.key}
            metricLabel={m.label}
            isPercentage={m.isPercentage === true}
            value={goals[m.key]}
            canEdit={canEdit}
          />
        ))}
      </div>
    </div>
  );
}

function GoalInput({
  employeeId, month, metricKey, metricLabel, isPercentage, value, canEdit,
}: {
  employeeId: string;
  month: string;
  metricKey: PerfMetricKey;
  metricLabel: string;
  isPercentage: boolean;
  value: number | null;
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  // Keep the input in sync if the underlying value changes (e.g. another
  // session updates the same goal).
  const valueStr = value == null ? "" : String(value);
  const dirty = draft !== valueStr;

  function save() {
    if (draft.trim() === "") {
      setGoal(employeeId, month, metricKey, null);
      return;
    }
    const n = parseFloat(draft);
    if (!Number.isFinite(n) || n < 0) return;
    setGoal(employeeId, month, metricKey, n);
  }

  return (
    <div>
      <label className="block text-[9px] uppercase tracking-widest text-[#6B6B66] mb-1">
        {metricLabel}{isPercentage && " (%)"}
      </label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          step={isPercentage ? 1 : 1}
          value={draft}
          disabled={!canEdit}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { if (dirty) save(); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
          placeholder="—"
          className="bg-[#0F0F0E] border border-[#2A2A28] text-[12px] text-[#FAFAF7] rounded px-2 py-1.5 w-full tabular-nums disabled:opacity-50"
        />
        {canEdit && dirty && (
          <button
            type="button"
            onClick={save}
            className="text-[10px] font-semibold text-[#FAFAF7] border border-emerald-700/60 bg-emerald-900/30 rounded px-1.5 py-1.5"
            title="Save"
            aria-label="Save"
          >
            <Save className="w-3 h-3" />
          </button>
        )}
        {canEdit && value != null && !dirty && (
          <button
            type="button"
            onClick={() => { setDraft(""); setGoal(employeeId, month, metricKey, null); }}
            className="text-[10px] text-[#6B6B66] hover:text-amber-300 border border-[#2A2A28] rounded px-1.5 py-1.5"
            title="Clear goal"
            aria-label="Clear goal"
          >
            <RefreshCcw className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
