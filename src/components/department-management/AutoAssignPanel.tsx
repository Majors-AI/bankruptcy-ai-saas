// Auto-assign tester — drives the engine against real store state so the
// Setting Portal can demonstrate routing without fabricating data. Lets the
// caller pick a task, simulate workload, mark as follow-up, and override the
// suggested assignee. Override writes an audit entry.

import { useMemo, useState } from "react";
import { Activity, ArrowRightCircle, Shield } from "lucide-react";
import { useDepartmentStore } from "./store";
import { assign, reasonLabel } from "./autoAssign";
import { titleLabel } from "./seedData";
import type { ViewerRole, DepartmentId } from "./types";

interface Props { viewerRole: ViewerRole; }

export default function AutoAssignPanel({ viewerRole }: Props) {
  const store = useDepartmentStore();
  const canOverride =
    viewerRole === "law_firm_owner" || viewerRole === "super_admin"
    || viewerRole === "department_supervisor";

  const [deptId, setDeptId] = useState<DepartmentId>(store.departments[0]?.id ?? "intake");
  const [taskId, setTaskId] = useState<string>("");
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [initialContactStaffId, setInitialContactStaffId] = useState<string>("");
  const [workload, setWorkload] = useState<Record<string, string>>({});

  const candidates = useMemo(
    () => store.staff.filter(s => s.departmentIds.includes(deptId)),
    [store.staff, deptId],
  );
  const tasks = useMemo(
    () => store.tasks.filter(t => t.departmentId === deptId),
    [store.tasks, deptId],
  );
  const task = tasks.find(t => t.id === taskId);

  const result = useMemo(() => {
    if (!task) return null;
    const workloadNum: Record<string, number> = {};
    for (const c of candidates) workloadNum[c.id] = parseInt(workload[c.id] || "0") || 0;
    return assign({
      task,
      candidates,
      scores: store.scores,
      workload: workloadNum,
      initialContactStaffId: initialContactStaffId || null,
      isFollowUp,
    });
  }, [task, candidates, store.scores, workload, initialContactStaffId, isFollowUp]);

  function override(staffId: string) {
    if (!task) return;
    store.appendAudit({
      function_key: "assignment.override",
      description: `Override assignment: task "${task.label}" → ${store.staff.find(s => s.id === staffId)?.name ?? staffId}`,
      meta: { taskId: task.id, deptId: deptId, staffId, basis: result?.reason },
    });
    alert(`Overridden — routed to ${store.staff.find(s => s.id === staffId)?.name}. Audit logged.`);
  }

  return (
    <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-amber-300" />
        <p className="text-sm font-semibold text-[#FAFAF7]">Auto-assign · live tester</p>
      </div>
      <p className="text-[11px] text-[#6B6B66] mb-3 leading-relaxed">
        Routes to the candidate with the highest strength score for the task. Ties go to the
        member with lighter workload. Follow-ups (prior contact) override to the
        initial-contact owner — rule preserved. Supervisors + super admins can override any
        assignment; every override logs to the audit view.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        <Field label="Department">
          <select value={deptId} onChange={e => { setDeptId(e.target.value); setTaskId(""); }} className={inputCls}>
            {store.departments.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </Field>
        <Field label="Task">
          <select value={taskId} onChange={e => setTaskId(e.target.value)} className={inputCls}>
            <option value="">— pick task —</option>
            {tasks.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Initial contact (for follow-ups)">
          <select value={initialContactStaffId} onChange={e => setInitialContactStaffId(e.target.value)} className={inputCls}>
            <option value="">— none —</option>
            {candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Is follow-up?">
          <label className="inline-flex items-center gap-1 text-[11px] text-[#FAFAF7]">
            <input type="checkbox" checked={isFollowUp} onChange={e => setIsFollowUp(e.target.checked)} />
            Yes — apply initial-contact override
          </label>
        </Field>
      </div>

      {candidates.length > 0 && (
        <details className="mb-3">
          <summary className="text-[10px] font-semibold text-[#6B6B66] uppercase tracking-widest cursor-pointer">
            Workload (in-progress tasks per member) — optional, ties resolve here
          </summary>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {candidates.map(c => (
              <label key={c.id} className="block">
                <span className="block text-[10px] text-[#6B6B66] mb-0.5">{c.name}</span>
                <input
                  type="number"
                  min={0}
                  value={workload[c.id] ?? ""}
                  onChange={e => setWorkload(w => ({ ...w, [c.id]: e.target.value }))}
                  placeholder="0"
                  className={inputCls}
                />
              </label>
            ))}
          </div>
        </details>
      )}

      {result && (
        <div className="rounded border border-amber-700/40 bg-amber-900/10 p-3">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <ArrowRightCircle className="w-4 h-4 text-amber-300" />
            <p className="text-[12px] font-semibold text-[#FAFAF7]">
              Suggested: {result.staffId
                ? store.staff.find(s => s.id === result.staffId)?.name
                : <span className="text-rose-300">no candidate</span>}
            </p>
            <span className="text-[10px] uppercase tracking-widest text-amber-200">{reasonLabel(result.reason)}</span>
          </div>
          {result.ranked.length > 0 && (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-[11px]">
                <thead>
                  <tr className="text-[#6B6B66]">
                    <th className="text-left px-2 py-1">Member</th>
                    <th className="text-right px-2 py-1">Score</th>
                    <th className="text-right px-2 py-1">Workload</th>
                    {canOverride && <th className="text-right px-2 py-1">Override</th>}
                  </tr>
                </thead>
                <tbody>
                  {result.ranked.map(r => {
                    const s = store.staff.find(x => x.id === r.staffId);
                    return (
                      <tr key={r.staffId} className="border-t border-[#2A2A28]">
                        <td className="px-2 py-1 text-[#FAFAF7]">{s?.name} <span className="text-[#6B6B66]">· {titleLabel(s?.title ?? "")}</span></td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.score}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.workload}</td>
                        {canOverride && (
                          <td className="px-2 py-1 text-right">
                            <button
                              onClick={() => override(r.staffId)}
                              className="text-[10px] font-semibold text-amber-200 border border-amber-700/50 px-2 py-0.5 rounded hover:bg-amber-900/40"
                            >
                              Route here
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!canOverride && (
        <p className="mt-3 text-[10px] text-[#6B6B66] inline-flex items-center gap-1">
          <Shield className="w-3 h-3 text-[#B8945F]" /> Read-only — overrides require supervisor or super-admin.
        </p>
      )}
    </div>
  );
}

const inputCls = "w-full bg-[#1A1A18] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5 focus:outline-none focus:border-[#3A3A36]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">{label}</span>
      {children}
    </label>
  );
}
