// Reassignment request store + UI.
//
// Manual reassignment is performed from the CLIENT FILE in the File Cabinet
// (TODO link below). This panel surfaces the queue + lets the assigned
// staffer raise a request, and a supervisor / super-admin / owner approves
// or denies. Approval here is a soft-link — the actual reassignment write
// happens against the case record (TODO).

import { useState, createContext, useContext, useMemo, useCallback, type ReactNode } from "react";
import { RefreshCw, Check, X, Plus, ExternalLink } from "lucide-react";
import { useDepartmentStore } from "../department-management/store";
import { titleLabel } from "../department-management/seedData";
import type { ViewerRole, DepartmentId } from "../department-management/types";

export interface ReassignmentRequest {
  id: string;
  caseId: string;            // opaque — points at the File Cabinet record
  clientName: string;
  departmentId: DepartmentId;
  currentStaffId: string;
  requestedByStaffId: string;
  preferredStaffId: string | null;
  reason: string;
  status: "pending" | "approved" | "denied";
  requestedAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

interface ReassignApi {
  requests: ReassignmentRequest[];
  open(input: Omit<ReassignmentRequest, "id" | "status" | "requestedAt">): void;
  approve(id: string, resolver: string): void;
  deny(id: string, resolver: string): void;
}

const Ctx = createContext<ReassignApi | null>(null);

function uid(p: string) { return `${p}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`; }

export function ReassignmentProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<ReassignmentRequest[]>([]);

  const open = useCallback<ReassignApi["open"]>((input) => {
    setRequests(prev => [{ id: uid("rea"), status: "pending", requestedAt: new Date().toISOString(), ...input }, ...prev]);
  }, []);
  const approve = useCallback<ReassignApi["approve"]>((id, resolver) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "approved", resolvedBy: resolver, resolvedAt: new Date().toISOString() } : r));
  }, []);
  const deny = useCallback<ReassignApi["deny"]>((id, resolver) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "denied", resolvedBy: resolver, resolvedAt: new Date().toISOString() } : r));
  }, []);

  const api: ReassignApi = useMemo(() => ({ requests, open, approve, deny }), [requests, open, approve, deny]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useReassign(): ReassignApi { const v = useContext(Ctx); if (!v) throw new Error("useReassign must be used inside ReassignmentProvider"); return v; }

// ─── UI ────────────────────────────────────────────────────────────────────

interface Props {
  departmentId: DepartmentId;
  viewerRole: ViewerRole;
}

export default function ReassignmentRequestsSection({ departmentId, viewerRole }: Props) {
  const store = useDepartmentStore();
  const re = useReassign();
  const isApprover =
    viewerRole === "law_firm_owner"
    || viewerRole === "super_admin"
    || (viewerRole === "department_supervisor"
        && store.departments.find(d => d.id === departmentId)?.supervisorId === store.actor.id);

  const candidates = store.staff.filter(s => s.departmentIds.includes(departmentId));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ caseId: string; clientName: string; currentStaffId: string; preferredStaffId: string; reason: string }>({
    caseId: "", clientName: "", currentStaffId: "", preferredStaffId: "", reason: "",
  });

  function openRequest() {
    if (!form.clientName.trim() || !form.currentStaffId || !form.reason.trim()) return;
    re.open({
      caseId: form.caseId.trim() || uid("case"),
      clientName: form.clientName.trim(),
      departmentId,
      currentStaffId: form.currentStaffId,
      preferredStaffId: form.preferredStaffId || null,
      requestedByStaffId: store.actor.id,
      reason: form.reason.trim(),
    });
    setShowForm(false);
    setForm({ caseId: "", clientName: "", currentStaffId: "", preferredStaffId: "", reason: "" });
  }

  const rows = re.requests.filter(r => r.departmentId === departmentId);

  return (
    <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5" style={{ color: "var(--lfs-accent)" }} />
          <p className="text-xs font-semibold uppercase tracking-widest text-[#FAFAF7]">Reassignment requests</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="#"
            onClick={e => { e.preventDefault(); alert("Open client file in File Cabinet — TODO link."); }}
            className="text-[10px] font-semibold text-[#6B6B66] hover:text-white inline-flex items-center gap-1"
          >
            Manual reassignment lives in the client file <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={() => setShowForm(s => !s)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded border"
            style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" }}
          >
            <Plus className="w-3 h-3" /> Request reassignment
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded border border-dashed border-[#2A2A28] p-3 mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Client name"><input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} className={inputCls} /></Field>
          <Field label="Case ID (optional)"><input value={form.caseId} onChange={e => setForm(f => ({ ...f, caseId: e.target.value }))} className={inputCls} /></Field>
          <Field label="Currently assigned">
            <select value={form.currentStaffId} onChange={e => setForm(f => ({ ...f, currentStaffId: e.target.value }))} className={inputCls}>
              <option value="">— pick —</option>
              {candidates.map(c => <option key={c.id} value={c.id}>{c.name} · {titleLabel(c.title)}</option>)}
            </select>
          </Field>
          <Field label="Preferred (optional)">
            <select value={form.preferredStaffId} onChange={e => setForm(f => ({ ...f, preferredStaffId: e.target.value }))} className={inputCls}>
              <option value="">— none —</option>
              {candidates.filter(c => c.id !== form.currentStaffId).map(c => <option key={c.id} value={c.id}>{c.name} · {titleLabel(c.title)}</option>)}
            </select>
          </Field>
          <Field label="Reason" className="sm:col-span-2">
            <textarea rows={2} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className={inputCls} />
          </Field>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-[11px] px-3 py-1.5 rounded border border-[#2A2A28] text-[#6B6B66]">Cancel</button>
            <button onClick={openRequest} className="text-[11px] font-semibold px-3 py-1.5 rounded border" style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" }}>Submit</button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-[11px] text-[#6B6B66] italic">No requests.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map(r => {
            const current = store.staff.find(s => s.id === r.currentStaffId)?.name ?? r.currentStaffId;
            const preferred = r.preferredStaffId ? (store.staff.find(s => s.id === r.preferredStaffId)?.name ?? r.preferredStaffId) : null;
            const requester = store.staff.find(s => s.id === r.requestedByStaffId)?.name ?? r.requestedByStaffId;
            return (
              <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-[#1A1A18] border border-[#2A2A28]">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#FAFAF7]">
                    {r.clientName} <span className="text-[#6B6B66]">— from <strong>{current}</strong>{preferred && <> → preferred <strong>{preferred}</strong></>}</span>
                  </p>
                  <p className="text-[10px] text-[#6B6B66]">Reason: {r.reason}</p>
                  <p className="text-[10px] text-[#6B6B66]">Requested by {requester} · {new Date(r.requestedAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                    r.status === "approved" ? "border-emerald-700/60 bg-emerald-900/30 text-emerald-200"
                    : r.status === "denied" ? "border-rose-700/60 bg-rose-900/30 text-rose-200"
                    : "border-[#2A2A28] text-[#6B6B66]"
                  }`}>
                    {r.status}
                  </span>
                  {isApprover && r.status === "pending" && (
                    <>
                      <button onClick={() => re.approve(r.id, store.actor.name)} className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-100 border border-emerald-700/60 bg-emerald-900/30 px-2 py-0.5 rounded">
                        <Check className="w-3 h-3" /> Approve
                      </button>
                      <button onClick={() => re.deny(r.id, store.actor.name)} className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-100 border border-rose-700/60 bg-rose-900/30 px-2 py-0.5 rounded">
                        <X className="w-3 h-3" /> Deny
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[10px] text-[#6B6B66] italic mt-2 leading-snug">
        {/* TODO Phase B — persistence + the actual reassignment write against
            the case record (and notification to the originally assigned staffer). */}
        Approval here is a soft-link; the assignment write happens in the File Cabinet.
      </p>
    </div>
  );
}

const inputCls = "w-full bg-[#0F0F0E] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5";

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block min-w-0 ${className ?? ""}`}>
      <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">{label}</span>
      {children}
    </label>
  );
}
