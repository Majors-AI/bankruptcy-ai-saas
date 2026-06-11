// Portal-level staff roster — columns by title. Add/remove team members.
//
// Visible to: super_admin + law_firm_owner only. Department supervisors see
// the same data scoped to their own department from inside the Department
// Panel's "Team members" surface; they don't get the firm-wide roster.

import { useState } from "react";
import { Plus, X, Users } from "lucide-react";
import { useDepartmentStore } from "./store";
import { TITLE_CATALOG, titleLabel } from "./seedData";
import type { StaffMember, Title, DepartmentId, ViewerRole } from "./types";

interface Props { viewerRole: ViewerRole; }

export default function StaffRosterByTitle({ viewerRole }: Props) {
  const store = useDepartmentStore();
  const canEdit = viewerRole === "law_firm_owner" || viewerRole === "super_admin";
  const [adding, setAdding] = useState(false);

  // Group by title (and an "Other" bucket for custom titles).
  const grouped = new Map<string, StaffMember[]>();
  for (const t of TITLE_CATALOG) grouped.set(t.key, []);
  grouped.set("other", []);
  for (const s of store.staff) {
    const key = grouped.has(s.title) ? s.title : "other";
    grouped.get(key)!.push(s);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#B8945F]" />
          <p className="text-sm font-semibold text-[#FAFAF7]">Staff roster — by title</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-200 border border-amber-700/50 bg-amber-900/30 px-2.5 py-1 rounded hover:bg-amber-900/50"
          >
            <Plus className="w-3 h-3" /> Add team member
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {[...TITLE_CATALOG.map(t => t.key), "other"].map(key => {
          const members = grouped.get(key) ?? [];
          if (key === "other" && members.length === 0) return null;
          return (
            <div
              key={key}
              className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-3 min-h-[120px]"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#B8945F] mb-2">
                {key === "other" ? "Other (custom roles)" : titleLabel(key)}
              </p>
              {members.length === 0 ? (
                <p className="text-[11px] text-[#6B6B66] italic">No staff in this title.</p>
              ) : (
                <ul className="space-y-1.5">
                  {members.map(m => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-[#1A1A18] border border-[#2A2A28]"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-[#FAFAF7] truncate">{m.name}</p>
                        <p className="text-[10px] text-[#6B6B66] truncate">
                          {m.departmentIds.length > 0
                            ? m.departmentIds.join(" · ")
                            : "no department"}
                        </p>
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => store.removeStaff(m.id)}
                          title="Remove"
                          className="text-[#6B6B66] hover:text-rose-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {adding && <AddStaffModal onClose={() => setAdding(false)} />}
    </div>
  );
}

// ─── Add Staff modal ───────────────────────────────────────────────────────

function AddStaffModal({ onClose }: { onClose: () => void }) {
  const store = useDepartmentStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState<Title>(TITLE_CATALOG[0].key);
  const [customTitle, setCustomTitle] = useState("");
  const [departmentIds, setDepartmentIds] = useState<DepartmentId[]>([]);
  const [supervisorId, setSupervisorId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  function toggleDept(id: DepartmentId) {
    setDepartmentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function save() {
    if (!name.trim()) { setError("Name is required."); return; }
    const finalTitle = title === "__custom" ? customTitle.trim() : title;
    if (!finalTitle) { setError("Title is required."); return; }
    store.addStaff({
      name: name.trim(),
      email: email.trim(),
      title: finalTitle,
      departmentIds,
      supervisorId: supervisorId || null,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1A1A18] border border-[#3A3A36] rounded-xl w-full max-w-md shadow-2xl">
        <div className="px-5 py-3.5 border-b border-[#2A2A28] flex items-center justify-between">
          <p className="text-sm font-semibold text-[#FAFAF7]">Add team member</p>
          <button onClick={onClose} className="text-[#6B6B66] hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <Field label="Name">
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Email">
            <input value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Title">
            <select value={title} onChange={e => setTitle(e.target.value)} className={inputCls}>
              {TITLE_CATALOG.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              <option value="__custom">+ Create custom title…</option>
            </select>
            {title === "__custom" && (
              <input
                value={customTitle}
                onChange={e => setCustomTitle(e.target.value)}
                placeholder="Custom title"
                className={`${inputCls} mt-2`}
              />
            )}
          </Field>
          <Field label="Department(s)">
            <div className="flex flex-wrap gap-2">
              {store.departments.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDept(d.id)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded border ${
                    departmentIds.includes(d.id)
                      ? "bg-amber-700/40 border-amber-600 text-amber-100"
                      : "bg-[#0F0F0E] border-[#2A2A28] text-[#6B6B66] hover:border-[#3A3A36]"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Supervisor">
            <select value={supervisorId} onChange={e => setSupervisorId(e.target.value)} className={inputCls}>
              <option value="">— none —</option>
              {store.staff.map(s => <option key={s.id} value={s.id}>{s.name} ({titleLabel(s.title)})</option>)}
            </select>
          </Field>
          {error && <p className="text-[11px] text-rose-300">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-[#2A2A28] flex justify-end gap-2">
          <button onClick={onClose} className="text-[11px] px-3 py-1.5 rounded border border-[#2A2A28] text-[#6B6B66] hover:text-white">Cancel</button>
          <button onClick={save} className="text-[11px] font-semibold px-3 py-1.5 rounded border border-amber-700 bg-amber-700/40 text-amber-100 hover:bg-amber-700/60">Save</button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full bg-[#0F0F0E] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5 focus:outline-none focus:border-[#3A3A36]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">{label}</span>
      {children}
    </label>
  );
}
