// System-wide audit log view. Every mutator in the store appends here so the
// log is the single chronological record across the whole module.

import { useState } from "react";
import { ScrollText, Filter } from "lucide-react";
import { useDepartmentStore } from "./store";

export default function AuditLogView() {
  const store = useDepartmentStore();
  const [filterFn, setFilterFn] = useState("");
  const [filterActor, setFilterActor] = useState("");

  const fnKeys = Array.from(new Set(store.auditLog.map(a => a.function_key))).sort();
  const actors = Array.from(new Set(store.auditLog.map(a => a.actor))).sort();

  const filtered = store.auditLog.filter(a =>
    (!filterFn || a.function_key === filterFn)
    && (!filterActor || a.actor === filterActor)
  );

  return (
    <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4">
      <div className="flex items-center gap-2 mb-3">
        <ScrollText className="w-4 h-4 text-amber-300" />
        <p className="text-sm font-semibold text-[#FAFAF7]">Audit log · changes here mirror everywhere</p>
      </div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Filter className="w-3 h-3 text-[#6B6B66]" />
        <select value={filterFn} onChange={e => setFilterFn(e.target.value)} className={inputCls}>
          <option value="">All functions</option>
          {fnKeys.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={filterActor} onChange={e => setFilterActor(e.target.value)} className={inputCls}>
          <option value="">All actors</option>
          {actors.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-[10px] text-[#6B6B66]">{filtered.length} of {store.auditLog.length} entries</span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-[11px] text-[#6B6B66] italic">No audit entries yet.</p>
      ) : (
        <ul className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          {filtered.map(a => (
            <li key={a.id} className="rounded border border-[#2A2A28] bg-[#1A1A18] p-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] text-[#6B6B66]">
                <span className="font-mono text-amber-300">{a.function_key}</span>
                <span>{new Date(a.ts).toLocaleString()}</span>
              </div>
              <p className="text-[11px] text-[#FAFAF7] mt-0.5">{a.description}</p>
              <p className="text-[10px] text-[#6B6B66] mt-0.5">by {a.actor}</p>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[10px] text-[#6B6B66] italic mt-3 leading-snug">
        {/* TODO Phase B — persistence:
            - new table firm_audit_log (id, firm_id, ts, actor_user_id, function_key,
              description, meta jsonb)
            - append-only insert via the same wrapper used by the store; UI reads from
              the table after the in-memory cache invalidates
            - retain indefinitely; export for compliance review */}
        Today this log lives in memory. Persistence + system-wide propagation land with the
        firm_audit_log table; reads here will then mirror writes from other surfaces.
      </p>
    </div>
  );
}

const inputCls = "bg-[#1A1A18] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1 focus:outline-none focus:border-[#3A3A36]";
