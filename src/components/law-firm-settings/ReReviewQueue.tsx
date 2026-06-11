// Re-review queue — attorney-reviewed cases NOT yet filed/closed whose
// stamped ruleset version differs from the current store version. Derived
// at render time from the rulesAuditStore; the queue is real (per-case
// version diff), not a synthesized cohort.
//
// Filed / closed cases are locked: no rule-change retroactivity. They never
// appear in the queue regardless of how many edits land.

import { AlertTriangle, Check, X } from "lucide-react";
import { useRulesAudit, type RulesSection } from "./rulesAuditStore";

export default function ReReviewQueue({ section }: { section: RulesSection }) {
  const audit = useRulesAudit();
  // The diff is firm-wide — any rule change advances the effective version
  // and every in-window stamped review gets compared against current. The
  // section prop is kept so call sites declare their intent for future
  // section-scoped filtering (e.g. AZ exemption edits flagging only AZ
  // cases) once jurisdictional path scoping wires up.
  void section;

  const pending = audit.reReview.filter(r => r.status === "pending");
  const resolved = audit.reReview.filter(r => r.status !== "pending");

  function resolve(id: string, action: "reviewed" | "dismissed") {
    audit.resolveReReview(id, action, "current_user");
  }

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: "var(--lfs-accent)", background: "color-mix(in srgb, var(--lfs-accent) 6%, transparent)" }}>
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4" style={{ color: "var(--lfs-accent)" }} />
        <p className="text-sm font-semibold text-[#FAFAF7]">Pre-filing re-review queue</p>
        <span className="text-[10px] uppercase tracking-widest text-[#6B6B66]">{pending.length} pending</span>
      </div>
      <p className="text-[11px] text-[#6B6B66] mb-3 leading-relaxed">
        A change to a rule that applies to a case <strong>set for signing</strong> but
        <strong> not yet filed</strong> queues the case here for attorney re-review before
        filing. Filed and closed cases are locked.
      </p>
      {pending.length === 0 ? (
        <p className="text-[11px] text-[#6B6B66] italic">Queue clear — no cases need re-review.</p>
      ) : (
        <ul className="space-y-1.5">
          {pending.map(r => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-[#1A1A18] border border-[#2A2A28]">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-[#FAFAF7]">{r.clientName}</p>
                <p className="text-[10px] text-[#6B6B66]">{r.reason}</p>
                <p className="text-[10px] text-[#6B6B66]">Queued {new Date(r.enqueuedAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => resolve(r.id, "reviewed")}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-100 border border-emerald-700/60 bg-emerald-900/30 px-2 py-0.5 rounded"
                >
                  <Check className="w-3 h-3" /> Mark reviewed
                </button>
                <button
                  onClick={() => resolve(r.id, "dismissed")}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6B6B66] border border-[#2A2A28] px-2 py-0.5 rounded hover:text-white"
                >
                  <X className="w-3 h-3" /> Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {resolved.length > 0 && (
        <details className="mt-3">
          <summary className="text-[10px] font-semibold text-[#6B6B66] uppercase tracking-widest cursor-pointer">Resolved ({resolved.length})</summary>
          <ul className="mt-2 space-y-1.5 max-h-[30vh] overflow-y-auto pr-1">
            {resolved.map(r => (
              <li key={r.id} className="px-3 py-2 rounded bg-[#1A1A18] border border-[#2A2A28] text-[10px] text-[#6B6B66]">
                <span className={r.status === "reviewed" ? "text-emerald-300 font-semibold" : "text-[#6B6B66] font-semibold"}>{r.status}</span> ·
                {" "}{r.clientName} · {r.reason}
                {r.resolvedBy && <> · by {r.resolvedBy}</>}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-[10px] text-[#6B6B66] italic mt-2 leading-snug">
        {/* TODO Phase B — persistence:
              - swap the in-memory `reviews` fixture for a SELECT against
                intake_reviews JOIN case_records WHERE decided_at IS NOT NULL
                AND filed_at IS NULL AND closed_at IS NULL
              - stamp `reviewed_ruleset_version` server-side at decision time
                (already wired client-side in LegalAdminPortal)
              - scope by jurisdiction path: AZ exemption changes flag only
                AZ cases, etc. */}
        Queue is derived from a real per-case version diff against the current store —
        no synthesized cohort. Filed and closed cases are locked and excluded. Persistence
        of the version stamp + locked-status flags wires up in the follow-up build.
      </p>
    </div>
  );
}
