// Team members section — staff in the department; add/remove for super
// admin + owner; supervisors can manage their own department.

import { Plus, X, Crown } from "lucide-react";
import { useState } from "react";
import { useDepartmentStore } from "../store";
import { titleLabel } from "../seedData";
import type { Department, ViewerRole } from "../types";

interface Props { department: Department; viewerRole: ViewerRole; }

export default function TeamMembersSection({ department, viewerRole }: Props) {
  const store = useDepartmentStore();
  const inDept = store.staff.filter(s => s.departmentIds.includes(department.id));
  const outsiders = store.staff.filter(s => !s.departmentIds.includes(department.id));
  const canEdit =
    viewerRole === "law_firm_owner"
    || viewerRole === "super_admin"
    || (viewerRole === "department_supervisor"
        && department.supervisorId
        && store.actor.id === department.supervisorId);

  const [showAdd, setShowAdd] = useState(false);
  const [addingId, setAddingId] = useState("");

  function addExisting() {
    if (!addingId) return;
    const staff = store.staff.find(s => s.id === addingId);
    if (!staff) return;
    store.updateStaff(staff.id, { departmentIds: [...staff.departmentIds, department.id] });
    setAddingId("");
    setShowAdd(false);
  }

  function removeFromDept(staffId: string) {
    const staff = store.staff.find(s => s.id === staffId);
    if (!staff) return;
    store.updateStaff(staff.id, { departmentIds: staff.departmentIds.filter(d => d !== department.id) });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm font-semibold text-[#FAFAF7]">Team members</p>
        {canEdit && outsiders.length > 0 && (
          <button
            onClick={() => setShowAdd(s => !s)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-200 border border-amber-700/50 bg-amber-900/30 px-2.5 py-1 rounded hover:bg-amber-900/50"
          >
            <Plus className="w-3 h-3" /> Add to {department.label}
          </button>
        )}
      </div>

      {showAdd && canEdit && (
        <div className="mb-3 flex items-center gap-2">
          <select
            value={addingId}
            onChange={e => setAddingId(e.target.value)}
            className="bg-[#0F0F0E] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5"
          >
            <option value="">— pick from existing staff —</option>
            {outsiders.map(s => (
              <option key={s.id} value={s.id}>{s.name} · {titleLabel(s.title)}</option>
            ))}
          </select>
          <button
            onClick={addExisting}
            className="text-[11px] font-semibold px-2.5 py-1 rounded border border-amber-700 bg-amber-700/40 text-amber-100"
          >
            Add
          </button>
        </div>
      )}

      {inDept.length === 0 ? (
        <p className="text-[11px] text-[#6B6B66] italic">No team members in this department yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {inDept.map(s => {
            const isSupervisor = department.supervisorId === s.id;
            return (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-[#0F0F0E] border border-[#2A2A28]"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-[#FAFAF7] truncate">{s.name}</span>
                  <span className="text-[10px] text-[#6B6B66]">{titleLabel(s.title)}</span>
                  {isSupervisor && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-amber-300 border border-amber-700/50 px-1.5 py-0.5 rounded">
                      <Crown className="w-2.5 h-2.5" /> supervisor
                    </span>
                  )}
                </div>
                {canEdit && !isSupervisor && (
                  <button
                    onClick={() => removeFromDept(s.id)}
                    title="Remove from department"
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
    </div>
  );
}
