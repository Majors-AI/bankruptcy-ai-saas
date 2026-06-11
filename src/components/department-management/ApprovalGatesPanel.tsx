// Approval gates — Law Firm Owner can mark selected department functions as
// requiring approval before they take effect. Approver is the department
// supervisor by default, or a specifically-selected approver (any staff
// member, typically a supervising attorney).
//
// Owner-only. Non-owner viewers see the queue list (so they can see what is
// pending against them) but cannot edit gate config. The store's
// guardedWrite() honors enabled gates by routing the write into pending; the
// owner / supervisor approves or rejects from here.

import { useState } from "react";
import { ShieldCheck, Clock, Check, X, Plus } from "lucide-react";
import { FN, useDepartmentStore } from "./store";
import { titleLabel } from "./seedData";
import type { ViewerRole, DepartmentId } from "./types";

interface Props { viewerRole: ViewerRole; }

// Human labels for the gateable function keys.
const GATEABLE: Array<{ key: string; label: string }> = [
  { key: FN.STAFF_ADD,                  label: "Add staff" },
  { key: FN.STAFF_REMOVE,               label: "Remove staff" },
  { key: FN.STAFF_UPDATE,               label: "Update staff (title, dept, supervisor)" },
  { key: FN.TASK_ADD,                   label: "Add task" },
  { key: FN.TASK_REMOVE,                label: "Remove task" },
  { key: FN.TASK_UPDATE,                label: "Update task" },
  { key: FN.TASK_UPDATE_PRIORITY,       label: "Change task priority" },
  { key: FN.SCORE_SET,                  label: "Set strength score" },
  { key: FN.DEPT_UPDATE_SUPERVISOR,     label: "Change department supervisor" },
  { key: FN.DEPT_UPDATE_HOURS,          label: "Change department hours" },
  { key: FN.TEMPLATE_ADD,               label: "Add response template" },
  { key: FN.TEMPLATE_UPDATE,            label: "Update template" },
  { key: FN.TEMPLATE_REMOVE,            label: "Remove template" },
  { key: FN.KB_ADD,                     label: "Add KB document" },
  { key: FN.KB_TOGGLE_AUTHORIZED,       label: "Toggle KB authorization" },
  { key: FN.KB_REMOVE,                  label: "Remove KB document" },
  { key: FN.GOAL_SET,                   label: "Set quarterly goal" },
];

export default function ApprovalGatesPanel({ viewerRole }: Props) {
  const store = useDepartmentStore();
  const isOwner = viewerRole === "law_firm_owner";

  return (
    <div className="space-y-5">
      {/* ── Configure gates (owner only) ─────────────────────────────────── */}
      <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-amber-300" />
          <p className="text-sm font-semibold text-[#FAFAF7]">Approval gate configuration</p>
          {!isOwner && (
            <span className="ml-auto text-[10px] uppercase tracking-widest text-[#6B6B66]">Owner-only · read-only here</span>
          )}
        </div>
        <p className="text-[11px] text-[#6B6B66] mb-3 leading-relaxed">
          The Law Firm Owner selects which functions hold for approval before taking effect.
          Default approver is the affected department's supervisor; the Owner can pin a
          specific approver (typically a supervising attorney). Changes from owner / super
          admin bypass gates by design — gates protect against unsupervised lower-role writes.
        </p>

        {isOwner && <GateAdder />}

        {store.approvalGates.length === 0 ? (
          <p className="text-[11px] text-[#6B6B66] italic mt-2">No gates configured — every write applies immediately.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {store.approvalGates.map(g => {
              const fnLabel = GATEABLE.find(x => x.key === g.function_key)?.label ?? g.function_key;
              const deptLabel = g.departmentId ? store.departments.find(d => d.id === g.departmentId)?.label : "Firm-wide";
              const approver = g.approverStaffId ? store.staff.find(s => s.id === g.approverStaffId)?.name : "Default (supervisor → owner)";
              return (
                <li key={g.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-[#1A1A18] border border-[#2A2A28]">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#FAFAF7]">{fnLabel}</p>
                    <p className="text-[10px] text-[#6B6B66]">
                      Scope: <span className="text-amber-200">{deptLabel}</span> · Approver: <span className="text-amber-200">{approver}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                      g.enabled ? "border-emerald-700/60 text-emerald-200 bg-emerald-900/30" : "border-[#2A2A28] text-[#6B6B66]"
                    }`}>
                      {g.enabled ? "Enabled" : "Disabled"}
                    </span>
                    {isOwner && (
                      <button
                        onClick={() => store.upsertGate({ ...g, enabled: !g.enabled })}
                        className="text-[10px] font-semibold text-amber-200 border border-amber-700/50 px-2 py-0.5 rounded hover:bg-amber-900/40"
                      >
                        {g.enabled ? "Disable" : "Enable"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Pending approvals ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-amber-300" />
          <p className="text-sm font-semibold text-[#FAFAF7]">Pending changes</p>
        </div>
        {store.pending.filter(p => p.status === "pending").length === 0 ? (
          <p className="text-[11px] text-[#6B6B66] italic">No changes pending approval.</p>
        ) : (
          <ul className="space-y-1.5">
            {store.pending.filter(p => p.status === "pending").map(p => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-[#1A1A18] border border-[#2A2A28]">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#FAFAF7]">{p.description}</p>
                  <p className="text-[10px] text-[#6B6B66]">Requested by {p.requestedBy} · {new Date(p.requestedAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => store.approvePending(p.id)}
                    title="Approve"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-100 border border-emerald-700/60 bg-emerald-900/30 px-2 py-0.5 rounded hover:bg-emerald-900/50"
                  >
                    <Check className="w-3 h-3" /> Approve
                  </button>
                  <button
                    onClick={() => {
                      const reason = window.prompt("Reject reason (optional)") || undefined;
                      store.rejectPending(p.id, reason);
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-100 border border-rose-700/60 bg-rose-900/30 px-2 py-0.5 rounded hover:bg-rose-900/50"
                  >
                    <X className="w-3 h-3" /> Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Resolved log (last 5). */}
        {store.pending.filter(p => p.status !== "pending").length > 0 && (
          <details className="mt-3">
            <summary className="text-[10px] font-semibold text-[#6B6B66] uppercase tracking-widest cursor-pointer">Resolved (last few)</summary>
            <ul className="mt-2 space-y-1.5">
              {store.pending.filter(p => p.status !== "pending").slice(0, 5).map(p => (
                <li key={p.id} className="px-3 py-2 rounded bg-[#1A1A18] border border-[#2A2A28] text-[10px] text-[#6B6B66]">
                  <span className={p.status === "approved" ? "text-emerald-300 font-semibold" : "text-rose-300 font-semibold"}>{p.status}</span> · {p.description}
                  {p.resolvedBy && <> · by {p.resolvedBy}</>}
                  {p.rejectReason && <> · reason: {p.rejectReason}</>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <p className="text-[10px] text-[#6B6B66] italic leading-snug">
        {/* TODO Phase B — server-side enforcement:
            - new tables approval_gates + pending_changes (mirrors store shape)
            - INSERT/UPDATE RPC routes any gated write into pending_changes;
              direct table mutations are denied for non-bypass roles
            - approver resolution: if gate.approverStaffId is null, look up
              the department supervisor; fall back to the firm owner
            - the in-memory wrapper here is defense-in-depth only */}
        Today the gates run in-memory. Server-side enforcement + persistence land with
        approval_gates + pending_changes.
      </p>
    </div>
  );
}

function GateAdder() {
  const store = useDepartmentStore();
  const [fn, setFn] = useState(GATEABLE[0]?.key ?? "");
  const [scope, setScope] = useState<DepartmentId | "">("");
  const [approverStaffId, setApproverStaffId] = useState<string>("");

  function add() {
    if (!fn) return;
    store.upsertGate({
      function_key: fn,
      departmentId: scope || null,
      approverStaffId: approverStaffId || null,
      enabled: true,
    });
    setFn(GATEABLE[0]?.key ?? ""); setScope(""); setApproverStaffId("");
  }

  return (
    <div className="rounded border border-dashed border-[#2A2A28] p-2.5 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <Field label="Function">
          <select value={fn} onChange={e => setFn(e.target.value)} className={inputCls}>
            {GATEABLE.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
        </Field>
        <Field label="Scope">
          <select value={scope} onChange={e => setScope(e.target.value)} className={inputCls}>
            <option value="">Firm-wide</option>
            {store.departments.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </Field>
        <Field label="Approver (optional)">
          <select value={approverStaffId} onChange={e => setApproverStaffId(e.target.value)} className={inputCls}>
            <option value="">Default (supervisor → owner)</option>
            {store.staff.map(s => <option key={s.id} value={s.id}>{s.name} · {titleLabel(s.title)}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex justify-end">
        <button onClick={add} className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-100 border border-amber-700 bg-amber-700/40 px-2.5 py-1 rounded">
          <Plus className="w-3 h-3" /> Add gate
        </button>
      </div>
    </div>
  );
}

const inputCls = "w-full bg-[#1A1A18] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">{label}</span>
      {children}
    </label>
  );
}
