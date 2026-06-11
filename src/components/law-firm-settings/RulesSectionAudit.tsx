// Per-section audit log — mounted inside each rules page.

import { History } from "lucide-react";
import { useRulesAudit, type RulesSection } from "./rulesAuditStore";

export default function RulesSectionAudit({ section }: { section: RulesSection }) {
  const audit = useRulesAudit();
  const entries = audit.logFor(section);
  return (
    <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4">
      <div className="flex items-center gap-2 mb-2">
        <History className="w-4 h-4" style={{ color: "var(--lfs-accent)" }} />
        <p className="text-sm font-semibold text-[#FAFAF7]">Audit log — {section.replace(/_/g, " ")}</p>
        <span className="text-[10px] text-[#6B6B66]">{entries.length} entries</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-[11px] text-[#6B6B66] italic">No changes yet.</p>
      ) : (
        <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
          {entries.map(e => (
            <li key={e.id} className="rounded border border-[#2A2A28] bg-[#1A1A18] p-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2 text-[10px] text-[#6B6B66]">
                <span className="font-mono" style={{ color: "var(--lfs-accent)" }}>{e.path}</span>
                <span>{new Date(e.ts).toLocaleString()}</span>
              </div>
              <p className="text-[11px] text-[#FAFAF7] mt-0.5">
                {String(e.oldValue ?? "—")} → {String(e.newValue ?? "—")}
              </p>
              <p className="text-[10px] text-[#6B6B66] mt-0.5">
                by {e.actor}
                {e.source && <> · source: {e.source}</>}
                {typeof e.affectedCases === "number" && e.affectedCases > 0 && (
                  <> · {e.affectedCases} case(s) queued for re-review</>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-[#6B6B66] italic mt-2 leading-snug">
        {/* TODO Phase B — persistence into legal_reference_audit_log scoped by section. */}
        Today the log lives in memory; firm-wide persistence lands with legal_reference_audit_log.
      </p>
    </div>
  );
}
