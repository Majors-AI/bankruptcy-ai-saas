// Firm Directory — master employee list with per-employee detail view.
//
// Extends the existing department-management staff store with the employment
// fields the spec calls for (contact info, hours of work, lunch hours, PTO,
// STO, FMLA, FT/PT, compensation, benefits) plus department add/remove and
// supervisor pick. The same StaffMember row inside DepartmentManagement
// remains the single source — this surface adds an "employment" sidecar via
// a local employment store (TODO: merge with the StaffMember model when the
// staff-setup tables land).

import { useState, useMemo, useCallback, createContext, useContext, type ReactNode } from "react";
import {
  Users, ChevronRight, Mail, Phone, Clock, Calendar, Briefcase,
  DollarSign, Heart, BookOpen, Plus, X, ArrowLeft, Save,
} from "lucide-react";
import { useDepartmentStore } from "../department-management/store";
import { TITLE_CATALOG, titleLabel } from "../department-management/seedData";
import type { ViewerRole, DepartmentId, Title } from "../department-management/types";

// ─── Employment sidecar (in-memory; TODO migrate into StaffMember) ─────────

export interface EmploymentRecord {
  phone: string;
  hoursPerWeek: number | null;
  lunchMinutes: number | null;
  ptoDaysPerYear: number | null;
  stoDaysPerYear: number | null;
  fmlaEligible: boolean;
  employmentType: "full_time" | "part_time" | "contract";
  compensationKind: "hourly" | "salary";
  compensationAmount: number | null;
  benefits: string[]; // free-form (Health, Dental, Vision, 401k…)
  notes: string;
}

interface EmploymentApi {
  records: Record<string, EmploymentRecord>;
  setRecord(staffId: string, patch: Partial<EmploymentRecord>): void;
}

const EmpCtx = createContext<EmploymentApi | null>(null);

const DEFAULT_RECORD: EmploymentRecord = {
  phone: "", hoursPerWeek: null, lunchMinutes: null, ptoDaysPerYear: null,
  stoDaysPerYear: null, fmlaEligible: false, employmentType: "full_time",
  compensationKind: "salary", compensationAmount: null, benefits: [], notes: "",
};

export function EmploymentProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<Record<string, EmploymentRecord>>({});
  const setRecord = useCallback((staffId: string, patch: Partial<EmploymentRecord>) => {
    setRecords(prev => ({ ...prev, [staffId]: { ...(prev[staffId] ?? DEFAULT_RECORD), ...patch } }));
    // TODO Phase B — upsert into staff_employment(staff_id, ...).
  }, []);
  return <EmpCtx.Provider value={{ records, setRecord }}>{children}</EmpCtx.Provider>;
}

export function useEmployment(): EmploymentApi {
  const v = useContext(EmpCtx);
  if (!v) throw new Error("useEmployment must be used inside EmploymentProvider");
  return v;
}

// ─── Component ─────────────────────────────────────────────────────────────

interface Props { viewerRole: ViewerRole; }

export default function FirmDirectory({ viewerRole }: Props) {
  const store = useDepartmentStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const canEdit = viewerRole === "law_firm_owner" || viewerRole === "super_admin";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return store.staff.filter(s =>
      !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || titleLabel(s.title).toLowerCase().includes(q)
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [store.staff, search]);

  const selected = selectedId ? store.staff.find(s => s.id === selectedId) : null;

  if (selected) {
    return (
      <EmploymentProvider>
        <EmployeeDetail
          staffId={selected.id}
          onBack={() => setSelectedId(null)}
          canEdit={canEdit}
        />
      </EmploymentProvider>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: "var(--lfs-accent)" }} />
          <p className="text-sm font-semibold text-[#FAFAF7]">Firm Directory</p>
          <span className="text-[11px] text-[#6B6B66]">{store.staff.length} employees</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name / title / email"
            className="bg-[#0F0F0E] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5 w-64"
          />
          {canEdit && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded border"
              style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" }}
            >
              <Plus className="w-3 h-3" /> Add employee
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#2A2A28] bg-[#0F0F0E] p-6 text-center">
          <p className="text-[12px] text-[#6B6B66]">
            {store.staff.length === 0 ? "No employees yet — add the first one to get started." : "No matches for that search."}
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {filtered.map(s => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSelectedId(s.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded bg-[#0F0F0E] border border-[#2A2A28] hover:border-[#3A3A36]"
              >
                <div className="min-w-0 text-left">
                  <p className="text-[12px] font-semibold text-[#FAFAF7] truncate">{s.name}</p>
                  <p className="text-[10px] text-[#6B6B66] truncate">
                    {titleLabel(s.title)}
                    {s.email && <> · {s.email}</>}
                    {s.departmentIds.length > 0 && <> · {s.departmentIds.join(", ")}</>}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#6B6B66] flex-shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showAdd && <AddEmployeeModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

// ─── Detail view ────────────────────────────────────────────────────────────

function EmployeeDetail({ staffId, onBack, canEdit }: { staffId: string; onBack: () => void; canEdit: boolean }) {
  const store = useDepartmentStore();
  const emp = useEmployment();
  const staff = store.staff.find(s => s.id === staffId);
  const record = emp.records[staffId] ?? DEFAULT_RECORD;

  if (!staff) {
    return (
      <div>
        <button onClick={onBack} className="text-[12px] text-[#6B6B66] inline-flex items-center gap-1 mb-3">
          <ArrowLeft className="w-3 h-3" /> Back to directory
        </button>
        <p className="text-[12px] text-[#6B6B66]">Employee not found.</p>
      </div>
    );
  }

  function patchStaff(patch: Partial<typeof staff>) { store.updateStaff(staff!.id, patch); }
  function patchEmp(patch: Partial<EmploymentRecord>) { emp.setRecord(staff!.id, patch); }

  function toggleDept(deptId: DepartmentId) {
    const ids = staff!.departmentIds.includes(deptId)
      ? staff!.departmentIds.filter(d => d !== deptId)
      : [...staff!.departmentIds, deptId];
    patchStaff({ departmentIds: ids });
  }

  function toggleBenefit(b: string) {
    const benefits = record.benefits.includes(b)
      ? record.benefits.filter(x => x !== b)
      : [...record.benefits, b];
    patchEmp({ benefits });
  }

  const COMMON_BENEFITS = ["Health", "Dental", "Vision", "401(k)", "Life", "Disability"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={onBack} className="text-[12px] text-[#6B6B66] inline-flex items-center gap-1 hover:text-white">
          <ArrowLeft className="w-3 h-3" /> Back to directory
        </button>
        {canEdit && (
          <button
            onClick={() => alert("Saved (scaffold). Persistence TODO.")}
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded border"
            style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" }}
          >
            <Save className="w-3 h-3" /> Save changes
          </button>
        )}
      </div>

      {/* Header */}
      <div className="rounded-lg border border-[#2A2A28] bg-[#1A1A18] p-4 flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-[14px] flex-shrink-0"
          style={{ background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)", color: "var(--lfs-accent)" }}
        >
          {staff.name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase() || "•"}
        </div>
        <div className="flex-1 min-w-0">
          <input
            value={staff.name}
            disabled={!canEdit}
            onChange={e => patchStaff({ name: e.target.value })}
            className="w-full bg-transparent text-base font-semibold text-[#FAFAF7] focus:outline-none disabled:opacity-90"
          />
          <p className="text-[11px] text-[#6B6B66]">{titleLabel(staff.title)}</p>
        </div>
      </div>

      {/* Contact + Title */}
      <Section icon={<Mail className="w-3.5 h-3.5" />} label="Contact + role">
        <Grid>
          <Field label="Email">
            <input value={staff.email} disabled={!canEdit} onChange={e => patchStaff({ email: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Phone">
            <input value={record.phone} disabled={!canEdit} onChange={e => patchEmp({ phone: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Title">
            <select value={staff.title} disabled={!canEdit} onChange={e => patchStaff({ title: e.target.value as Title })} className={inputCls}>
              {TITLE_CATALOG.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              {!TITLE_CATALOG.some(t => t.key === staff.title) && <option value={staff.title}>{titleLabel(staff.title)} (custom)</option>}
            </select>
          </Field>
          <Field label="Supervisor">
            <select value={staff.supervisorId ?? ""} disabled={!canEdit} onChange={e => patchStaff({ supervisorId: e.target.value || null })} className={inputCls}>
              <option value="">— none —</option>
              {store.staff.filter(s => s.id !== staff.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </Grid>
      </Section>

      {/* Departments */}
      <Section icon={<Briefcase className="w-3.5 h-3.5" />} label="Departments">
        <div className="flex flex-wrap gap-2">
          {store.departments.map(d => {
            const on = staff.departmentIds.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                disabled={!canEdit}
                onClick={() => toggleDept(d.id)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded border ${
                  on
                    ? "text-[#FAFAF7]"
                    : "border-[#2A2A28] text-[#6B6B66] hover:border-[#3A3A36]"
                } disabled:opacity-70`}
                style={on ? { borderColor: "var(--lfs-accent)", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" } : undefined}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Hours of work */}
      <Section icon={<Clock className="w-3.5 h-3.5" />} label="Hours of work">
        <Grid>
          <Field label="Employment type">
            <select value={record.employmentType} disabled={!canEdit} onChange={e => patchEmp({ employmentType: e.target.value as EmploymentRecord["employmentType"] })} className={inputCls}>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
            </select>
          </Field>
          <Field label="Hours / week">
            <input type="number" min={0} max={80} value={record.hoursPerWeek ?? ""} disabled={!canEdit} onChange={e => patchEmp({ hoursPerWeek: parseInt(e.target.value) || null })} className={inputCls} />
          </Field>
          <Field label="Lunch (minutes)">
            <input type="number" min={0} max={180} value={record.lunchMinutes ?? ""} disabled={!canEdit} onChange={e => patchEmp({ lunchMinutes: parseInt(e.target.value) || null })} className={inputCls} />
          </Field>
        </Grid>
      </Section>

      {/* PTO / STO / FMLA */}
      <Section icon={<Calendar className="w-3.5 h-3.5" />} label="Leave">
        <Grid>
          <Field label="PTO days / year">
            <input type="number" min={0} max={60} value={record.ptoDaysPerYear ?? ""} disabled={!canEdit} onChange={e => patchEmp({ ptoDaysPerYear: parseInt(e.target.value) || null })} className={inputCls} />
          </Field>
          <Field label="Sick (STO) days / year">
            <input type="number" min={0} max={60} value={record.stoDaysPerYear ?? ""} disabled={!canEdit} onChange={e => patchEmp({ stoDaysPerYear: parseInt(e.target.value) || null })} className={inputCls} />
          </Field>
          <Field label="FMLA eligible">
            <label className="inline-flex items-center gap-2 text-[11px] text-[#FAFAF7] mt-1">
              <input type="checkbox" checked={record.fmlaEligible} disabled={!canEdit} onChange={e => patchEmp({ fmlaEligible: e.target.checked })} />
              Eligible (per HR review)
            </label>
          </Field>
        </Grid>
      </Section>

      {/* Compensation + benefits */}
      <Section icon={<DollarSign className="w-3.5 h-3.5" />} label="Compensation + benefits">
        <Grid>
          <Field label="Comp kind">
            <select value={record.compensationKind} disabled={!canEdit} onChange={e => patchEmp({ compensationKind: e.target.value as EmploymentRecord["compensationKind"] })} className={inputCls}>
              <option value="salary">Salary</option>
              <option value="hourly">Hourly</option>
            </select>
          </Field>
          <Field label={record.compensationKind === "hourly" ? "Hourly rate" : "Annual salary"}>
            <input type="number" min={0} value={record.compensationAmount ?? ""} disabled={!canEdit} onChange={e => patchEmp({ compensationAmount: parseFloat(e.target.value) || null })} className={inputCls} />
          </Field>
        </Grid>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1 mt-3">Benefits</p>
        <div className="flex flex-wrap gap-2">
          {COMMON_BENEFITS.map(b => {
            const on = record.benefits.includes(b);
            return (
              <button
                key={b}
                type="button"
                disabled={!canEdit}
                onClick={() => toggleBenefit(b)}
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded border ${
                  on ? "text-[#FAFAF7]" : "border-[#2A2A28] text-[#6B6B66] hover:border-[#3A3A36]"
                } disabled:opacity-70`}
                style={on ? { borderColor: "var(--lfs-accent)", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" } : undefined}
              >
                {on && <Heart className="w-3 h-3" />} {b}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Reporting block (placeholder shell) */}
      <Section icon={<BookOpen className="w-3.5 h-3.5" />} label="Reporting">
        <p className="text-[11px] text-[#6B6B66] leading-relaxed">
          Reporting roll-ups (tasks handled, goals set, met vs. target) appear here once the
          metrics backend feeds them. Same view a department supervisor sees inside the
          Department panel — dual columns for staff in &gt;1 department.
          {/* TODO Phase B — bind to ReportingRow + Goal queries scoped per staff_id. */}
        </p>
      </Section>

      <Section icon={<Phone className="w-3.5 h-3.5" />} label="Notes">
        <textarea
          rows={3}
          value={record.notes}
          disabled={!canEdit}
          onChange={e => patchEmp({ notes: e.target.value })}
          placeholder="Internal HR notes…"
          className="w-full bg-[#0F0F0E] border border-[#2A2A28] text-[12px] text-[#FAFAF7] rounded px-2 py-1.5"
        />
      </Section>

      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={() => { if (confirm("Remove this employee from the directory?")) { store.removeStaff(staff.id); onBack(); } }}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-200 border border-rose-700/40 bg-rose-900/20 px-2.5 py-1.5 rounded hover:bg-rose-900/40"
          >
            <X className="w-3 h-3" /> Remove employee
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Add employee modal ─────────────────────────────────────────────────────

function AddEmployeeModal({ onClose }: { onClose: () => void }) {
  const store = useDepartmentStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState<Title>(TITLE_CATALOG[0].key);
  const [departmentIds, setDepartmentIds] = useState<DepartmentId[]>([]);

  function toggleDept(id: DepartmentId) {
    setDepartmentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function save() {
    if (!name.trim()) return;
    store.addStaff({ name: name.trim(), email: email.trim(), title, departmentIds, supervisorId: null });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1A1A18] border border-[#3A3A36] rounded-xl w-full max-w-md shadow-2xl">
        <div className="px-5 py-3.5 border-b border-[#2A2A28] flex items-center justify-between">
          <p className="text-sm font-semibold text-[#FAFAF7]">Add employee</p>
          <button onClick={onClose} className="text-[#6B6B66] hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <Field label="Name"><input value={name} onChange={e => setName(e.target.value)} className={inputCls} /></Field>
          <Field label="Email"><input value={email} onChange={e => setEmail(e.target.value)} className={inputCls} /></Field>
          <Field label="Title">
            <select value={title} onChange={e => setTitle(e.target.value)} className={inputCls}>
              {TITLE_CATALOG.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Departments">
            <div className="flex flex-wrap gap-2">
              {store.departments.map(d => {
                const on = departmentIds.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDept(d.id)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded border ${on ? "text-[#FAFAF7]" : "border-[#2A2A28] text-[#6B6B66]"}`}
                    style={on ? { borderColor: "var(--lfs-accent)", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" } : undefined}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
        <div className="px-5 py-3 border-t border-[#2A2A28] flex justify-end gap-2">
          <button onClick={onClose} className="text-[11px] px-3 py-1.5 rounded border border-[#2A2A28] text-[#6B6B66] hover:text-white">Cancel</button>
          <button onClick={save} className="text-[11px] font-semibold px-3 py-1.5 rounded border" style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full bg-[#0F0F0E] border border-[#2A2A28] text-[12px] text-[#FAFAF7] rounded px-2 py-1.5 disabled:opacity-90";

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#2A2A28] bg-[#1A1A18] p-4">
      <div className="flex items-center gap-2 mb-2.5" style={{ color: "var(--lfs-accent)" }}>
        {icon}
        <p className="text-xs font-semibold uppercase tracking-widest text-[#FAFAF7]">{label}</p>
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">{label}</span>
      {children}
    </label>
  );
}
