// Per-employee reporting — tasks handled (by type), goals set (quarterly per
// metric), goal met / not vs. goal. Dual columns for anyone in >1 dept.
//
// Visible to: department supervisor (own dept) + super admin / firm owner.
// The dual-column pattern means each staffer's row contains one block per
// department they belong to, so cross-department visibility lands without
// duplicating rows.
//
// Persistence today: in-memory tasksHandled aggregation lives on the
// ReportingRow seed (none seeded — values appear once the metrics backend
// rolls them up). Goals are editable; goal-vs-actual chart renders empty
// until results data exists. No fabricated numbers.

import { useState } from "react";
import { Activity, Plus, Save } from "lucide-react";
import { ALL_QUARTERS, useDepartmentStore } from "../store";
import { titleLabel } from "../seedData";
import type { Department, GoalQuarter, ViewerRole } from "../types";

interface Props { department: Department; viewerRole: ViewerRole; }

export default function ReportingSection({ department, viewerRole }: Props) {
  const store = useDepartmentStore();
  const canSet =
    viewerRole === "law_firm_owner"
    || viewerRole === "super_admin"
    || (viewerRole === "department_supervisor"
        && department.supervisorId
        && store.actor.id === department.supervisorId);
  const inDept = store.staff.filter(s => s.departmentIds.includes(department.id));
  const year = new Date().getFullYear();

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-amber-300" />
        <p className="text-sm font-semibold text-[#FAFAF7]">Per-employee reporting · {department.label}</p>
      </div>
      <p className="text-[11px] text-[#6B6B66] mb-4 leading-relaxed">
        Tasks-handled counts come from the metrics backend (intake_contact_log + status
        transitions + task-completion events). NO fabricated numbers — the table renders
        whatever the rollup returns. Goals are settable here; the goal-vs-actual cells
        populate once a quarter closes.
      </p>

      {inDept.length === 0 ? (
        <p className="text-[11px] text-[#6B6B66] italic">No team members yet.</p>
      ) : (
        <div className="space-y-4">
          {inDept.map(s => (
            <EmployeeRow
              key={s.id}
              staffId={s.id}
              departmentId={department.id}
              canSet={!!canSet}
              year={year}
            />
          ))}
        </div>
      )}

      <p className="text-[10px] text-[#6B6B66] italic mt-4 leading-snug">
        Dual columns appear automatically for any staffer assigned to more than one
        department — each block is scoped to a single department's tasks + goals so the
        supervisor sees only their own scope and super admins see everything side-by-side.
      </p>
    </div>
  );
}

function EmployeeRow({
  staffId, departmentId, canSet, year,
}: { staffId: string; departmentId: string; canSet: boolean; year: number }) {
  const store = useDepartmentStore();
  const staff = store.staff.find(s => s.id === staffId);
  if (!staff) return null;

  const otherDepts = staff.departmentIds.filter(d => d !== departmentId);

  return (
    <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-3">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div>
          <p className="text-[12px] font-semibold text-[#FAFAF7]">{staff.name}</p>
          <p className="text-[10px] text-[#6B6B66]">{titleLabel(staff.title)}</p>
        </div>
        {otherDepts.length > 0 && (
          <span className="text-[10px] text-[#6B6B66]">
            Also in: <span className="text-amber-200 font-semibold">{otherDepts.join(", ")}</span>
          </span>
        )}
      </div>

      {/* Dual columns: one for the current department + one each for any
          extra departments the staffer is in (super-admin / firm owner only
          sees the extras; supervisor branch sees only their own deptId
          because the host scopes which DepartmentPanel mounts). */}
      <div className={`grid gap-3 ${otherDepts.length > 0 ? "md:grid-cols-2" : "grid-cols-1"}`}>
        <DeptBlock staffId={staffId} departmentId={departmentId} canSet={canSet} year={year} primary />
        {otherDepts.map(d => (
          <DeptBlock key={d} staffId={staffId} departmentId={d} canSet={false} year={year} />
        ))}
      </div>
    </div>
  );
}

function DeptBlock({
  staffId, departmentId, canSet, year, primary,
}: { staffId: string; departmentId: string; canSet: boolean; year: number; primary?: boolean }) {
  const store = useDepartmentStore();
  const dept = store.departments.find(d => d.id === departmentId);
  const tasks = store.tasks.filter(t => t.departmentId === departmentId);
  const reportingRow = store.reporting.find(r => r.staffId === staffId && r.departmentId === departmentId);
  const goals = store.goals.filter(g => g.staffId === staffId && g.departmentId === departmentId && g.year === year);

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [metric, setMetric] = useState(tasks[0]?.id ?? "");
  const [quarter, setQuarter] = useState<GoalQuarter>("Q1");
  const [value, setValue] = useState("");

  function save() {
    const n = parseInt(value);
    if (!metric || !Number.isFinite(n)) return;
    store.setGoal({ staffId, departmentId, metric, quarter, year, value: n });
    setShowGoalForm(false); setValue("");
  }

  return (
    <div className={`rounded border ${primary ? "border-amber-700/40" : "border-[#2A2A28]"} bg-[#1A1A18] p-2.5`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest ${primary ? "text-amber-300" : "text-[#6B6B66]"} mb-2`}>
        {dept?.label ?? departmentId}
      </p>

      {/* Tasks handled — only renders rows with data. */}
      <div className="mb-2">
        <p className="text-[10px] font-semibold text-[#6B6B66] uppercase tracking-widest mb-1">Tasks handled (this quarter)</p>
        {!reportingRow || Object.keys(reportingRow.tasksHandled).length === 0 ? (
          <p className="text-[10px] text-[#6B6B66] italic">No rollup data yet.</p>
        ) : (
          <ul className="text-[11px] text-[#FAFAF7] space-y-0.5">
            {tasks.map(t => {
              const n = reportingRow.tasksHandled[t.id];
              if (!n) return null;
              return (
                <li key={t.id} className="flex items-center justify-between">
                  <span>{t.label}</span>
                  <span className="tabular-nums font-bold text-amber-200">{n}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Goals + goal-vs-actual */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold text-[#6B6B66] uppercase tracking-widest">Goals · {year}</p>
          {canSet && (
            <button
              onClick={() => setShowGoalForm(s => !s)}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-200 border border-amber-700/50 bg-amber-900/30 px-2 py-0.5 rounded"
            >
              <Plus className="w-3 h-3" /> Set goal
            </button>
          )}
        </div>
        {showGoalForm && canSet && (
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <select value={metric} onChange={e => setMetric(e.target.value)} className="bg-[#0F0F0E] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-1.5 py-1">
              {tasks.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <select value={quarter} onChange={e => setQuarter(e.target.value as GoalQuarter)} className="bg-[#0F0F0E] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-1.5 py-1">
              {ALL_QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            <input
              value={value} onChange={e => setValue(e.target.value)} type="number" min={0}
              placeholder="Target"
              className="bg-[#0F0F0E] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-1.5 py-1 w-20"
            />
            <button onClick={save} className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-100 border border-amber-700 bg-amber-700/40 px-2 py-0.5 rounded">
              <Save className="w-3 h-3" /> Save
            </button>
          </div>
        )}
        {goals.length === 0 ? (
          <p className="text-[10px] text-[#6B6B66] italic">No goals set.</p>
        ) : (
          <ul className="text-[11px] space-y-0.5">
            {goals.map(g => {
              const result = reportingRow?.goalResults.find(r => r.metric === g.metric && r.quarter === g.quarter && r.year === g.year);
              const taskLabel = store.tasks.find(t => t.id === g.metric)?.label ?? g.metric;
              return (
                <li key={g.id} className="flex items-center justify-between">
                  <span className="text-[#FAFAF7]">{taskLabel} · {g.quarter}</span>
                  <span className="tabular-nums">
                    {result ? (
                      <>
                        <span className={result.actual >= result.goal ? "text-emerald-300 font-bold" : "text-rose-300 font-bold"}>
                          {result.actual}
                        </span>
                        <span className="text-[#6B6B66]"> / {g.value}</span>
                      </>
                    ) : (
                      <span className="text-[#6B6B66]">target {g.value} · awaiting roll-up</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
