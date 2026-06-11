// Strength scores — sliding-scale slider per (member × dept-task).
// SCOPED PER DEPARTMENT: a staffer in two departments gets independent score
// sets per dept; values do not carry across. The grid renders only the tasks
// in the current department, so scoring elsewhere has no effect here.

import { useDepartmentStore } from "../store";
import { titleLabel, PRIORITY_TONE } from "../seedData";
import type { Department, ViewerRole } from "../types";

interface Props { department: Department; viewerRole: ViewerRole; }

export default function StrengthScoresSection({ department, viewerRole }: Props) {
  const store = useDepartmentStore();
  const isLawyerViewer =
    viewerRole === "attorney" || viewerRole === "law_firm_owner" || viewerRole === "super_admin";
  const canEdit =
    viewerRole === "law_firm_owner"
    || viewerRole === "super_admin"
    || (viewerRole === "department_supervisor"
        && department.supervisorId
        && store.actor.id === department.supervisorId);

  const inDept = store.staff.filter(s => s.departmentIds.includes(department.id));
  const tasks = store.tasks.filter(t => t.departmentId === department.id);

  function getScore(staffId: string, taskId: string): number {
    return store.scores.find(s =>
      s.staffId === staffId
      && s.departmentId === department.id
      && s.taskId === taskId
    )?.value ?? 0;
  }

  if (inDept.length === 0) {
    return <p className="text-[11px] text-[#6B6B66] italic">Add team members before recording strength scores.</p>;
  }
  if (tasks.length === 0) {
    return <p className="text-[11px] text-[#6B6B66] italic">Define tasks for {department.label} before recording scores.</p>;
  }

  return (
    <div>
      <p className="text-sm font-semibold text-[#FAFAF7] mb-2">Strength scores</p>
      <p className="text-[11px] text-[#6B6B66] mb-3 leading-relaxed">
        Sliding scale 0–100 per member × task within <span className="text-[#FAFAF7]">{department.label}</span>.
        Independent from any other department's scores for the same person. Used by the
        auto-assign engine — higher score wins; ties resolve to lighter workload; follow-ups
        route to the initial-contact owner (rule preserved).
      </p>

      <div className="overflow-x-auto rounded-lg border border-[#2A2A28] bg-[#0F0F0E]">
        <table className="min-w-full text-[11px]">
          <thead>
            <tr className="bg-[#1A1A18]">
              <th className="text-left px-3 py-2 font-semibold text-[#6B6B66] uppercase tracking-widest text-[10px] sticky left-0 bg-[#1A1A18]">
                Member
              </th>
              {tasks.map(t => (
                <th key={t.id} className="text-left px-3 py-2 font-semibold text-[#FAFAF7] min-w-[180px]">
                  <div className="flex flex-col gap-1">
                    <span>{t.label}</span>
                    <span className={`self-start text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border ${PRIORITY_TONE[t.priority]}`}>
                      {t.priority}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inDept.map(s => (
              <tr key={s.id} className="border-t border-[#2A2A28]">
                <td className="px-3 py-2 sticky left-0 bg-[#0F0F0E]">
                  <p className="text-[12px] font-semibold text-[#FAFAF7]">{s.name}</p>
                  <p className="text-[10px] text-[#6B6B66]">{titleLabel(s.title)}</p>
                </td>
                {tasks.map(t => {
                  const value = getScore(s.id, t.id);
                  const taskLocked = t.lawyerOnly && !isLawyerViewer;
                  const disabled = !canEdit || taskLocked;
                  return (
                    <td key={t.id} className="px-3 py-2 align-top">
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={value}
                          disabled={disabled}
                          onChange={e => store.setStrengthScore(s.id, department.id, t.id, parseInt(e.target.value))}
                          className="flex-1 accent-amber-500 disabled:opacity-50"
                        />
                        <span className="text-[10px] font-bold text-[#FAFAF7] tabular-nums w-8 text-right">
                          {value}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
