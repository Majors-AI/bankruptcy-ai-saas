// Tasks section — add/remove, each with High/Medium/Low priority.
//
// Non-lawyer gate: tasks marked lawyerOnly (e.g. case review) can only be
// edited by attorneys, attorney supervisors, super admins, or the firm
// owner. Non-lawyers see them read-only.

import { useState } from "react";
import { Plus, X, Lock } from "lucide-react";
import { useDepartmentStore } from "../store";
import { PRIORITY_TONE } from "../seedData";
import type { Department, Priority, ViewerRole } from "../types";

interface Props { department: Department; viewerRole: ViewerRole; }

export default function TasksSection({ department, viewerRole }: Props) {
  const store = useDepartmentStore();
  const isLawyerViewer =
    viewerRole === "attorney" || viewerRole === "law_firm_owner" || viewerRole === "super_admin";
  const canManage =
    viewerRole === "law_firm_owner"
    || viewerRole === "super_admin"
    || (viewerRole === "department_supervisor"
        && department.supervisorId
        && store.actor.id === department.supervisorId);

  const tasks = store.tasks.filter(t => t.departmentId === department.id);

  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [lawyerOnly, setLawyerOnly] = useState(false);

  function add() {
    if (!label.trim()) return;
    if (lawyerOnly && !isLawyerViewer) return;
    store.addTask({
      departmentId: department.id,
      label: label.trim(),
      priority,
      lawyerOnly,
    });
    setLabel(""); setPriority("medium"); setLawyerOnly(false); setShowAdd(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm font-semibold text-[#FAFAF7]">Tasks · {department.label}</p>
        {canManage && (
          <button
            onClick={() => setShowAdd(s => !s)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-200 border border-amber-700/50 bg-amber-900/30 px-2.5 py-1 rounded hover:bg-amber-900/50"
          >
            <Plus className="w-3 h-3" /> Add task
          </button>
        )}
      </div>

      {showAdd && canManage && (
        <div className="mb-3 rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Task label"
              className="flex-1 min-w-[180px] bg-[#1A1A18] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5"
            />
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as Priority)}
              className="bg-[#1A1A18] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            {isLawyerViewer && (
              <label className="flex items-center gap-1 text-[10px] text-[#6B6B66]">
                <input
                  type="checkbox"
                  checked={lawyerOnly}
                  onChange={e => setLawyerOnly(e.target.checked)}
                />
                Lawyer-only
              </label>
            )}
            <button
              onClick={add}
              className="text-[11px] font-semibold px-2.5 py-1 rounded border border-amber-700 bg-amber-700/40 text-amber-100"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="text-[11px] text-[#6B6B66] italic">No tasks yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map(t => {
            const canEditTask = canManage && (!t.lawyerOnly || isLawyerViewer);
            return (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-[#0F0F0E] border border-[#2A2A28]"
              >
                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-semibold text-[#FAFAF7]">{t.label}</span>
                  <select
                    value={t.priority}
                    disabled={!canEditTask}
                    onChange={e => store.setTaskPriority(t.id, e.target.value as Priority)}
                    className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${PRIORITY_TONE[t.priority]} ${
                      canEditTask ? "" : "opacity-70 cursor-not-allowed"
                    }`}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  {t.lawyerOnly && (
                    <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-amber-200 border border-amber-700/40 px-1.5 py-0.5 rounded">
                      <Lock className="w-2.5 h-2.5" /> lawyer-only
                    </span>
                  )}
                  {t.note && (
                    <span className="text-[10px] text-[#6B6B66] italic">{t.note}</span>
                  )}
                </div>
                {canEditTask && (
                  <button
                    onClick={() => store.removeTask(t.id)}
                    title="Remove"
                    className="text-[#6B6B66] hover:text-rose-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[10px] text-[#6B6B66] italic mt-3 leading-snug">
        Lawyer-only tasks (e.g. case review, exemption / IRS-standards edits, BK code rules)
        can be edited only by attorneys, attorney supervisors, super admins, or the firm
        owner. Non-lawyer staff see them read-only.
      </p>
    </div>
  );
}
