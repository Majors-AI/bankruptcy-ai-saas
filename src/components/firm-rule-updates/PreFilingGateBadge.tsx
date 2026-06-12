// Slice 5 — HARD pre-filing gate.
//
// Mounted near the file/advance action on each case-level surface
// (SigningReview / Ch13SigningReview). Compares the case's stamped
// review version against the firm's currently-applied ruleset version
// (from firmRuleUpdates). If stale, blocks filing with two actions:
//
//   1. Re-review now (attorney-gated) → routes to the attorney review
//      surface; on completion, the attorney's review writes a new
//      AttorneyReviewRecord with the current effective stampedVersionId,
//      which clears the gate.
//   2. Do not file — seek update (any role) → marks the case as
//      "filing held pending update" so the firm doesn't accidentally
//      advance. Holds state in-memory; the next attorney-review step
//      clears it.
//
// Non-lawyers see the blocked state but cannot clear it via re-review —
// the "Re-review now" action is gated. They can still "Do not file —
// seek update" to make the held state explicit.

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, ArrowRight, PauseCircle, Lock } from "lucide-react";
import {
  useFirmAppliedRulesVersion, evaluatePreFilingGate,
} from "../../lib/firmRuleUpdates";

interface Props {
  firmId: string;
  caseId: string;
  clientName?: string;
  /** Last-reviewed ruleset version stamped on the case (from
   *  AttorneyReviewRecord.stampedVersionId). Null when the case has
   *  never been formally reviewed. */
  caseStampedVersionId: string | null;
  /** Whether the viewer is an attorney (eligible to clear the gate via
   *  re-review). Mirrors the existing isLawyer flag used elsewhere. */
  isLawyer: boolean;
  /** Optional callback that opens the re-review surface for this case.
   *  When omitted the button reads "Re-review now" and the host is
   *  expected to navigate. */
  onReReviewNow?: () => void;
  /** Optional callback when the user holds filing. */
  onHoldFiling?: () => void;
}

export default function PreFilingGateBadge({
  firmId, caseId, clientName, caseStampedVersionId,
  isLawyer, onReReviewNow, onHoldFiling,
}: Props) {
  const firmApplied = useFirmAppliedRulesVersion(firmId);
  const gate = evaluatePreFilingGate({
    firmAppliedVersionId: firmApplied,
    caseStampedVersionId,
  });
  const [held, setHeld] = useState(false);

  if (gate.ok) {
    return (
      <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/10 p-3 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-emerald-100">Pre-filing rules check — passed.</p>
          <p className="text-[10px] text-emerald-200/80">
            {firmApplied
              ? <>Case reviewed against firm-applied <span className="font-mono">v{firmApplied}</span>.</>
              : <>Firm has no accepted ruleset version yet — gate not applied.</>}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 p-3">
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="w-5 h-5 text-rose-300 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-rose-100">
            Filing blocked — updated rules apply{clientName ? ` (${clientName})` : ""}
          </p>
          <p className="text-[11px] text-rose-100/85 mt-0.5 leading-relaxed">
            {gate.reason}
          </p>
          <ul className="mt-2 text-[10px] text-rose-100/80 space-y-0.5 font-mono">
            <li>Firm applied: <span className="text-rose-200">v{gate.firmAppliedVersionId ?? "—"}</span></li>
            <li>Case stamp:  <span className="text-rose-200">v{gate.caseStampedVersionId ?? "—"}</span></li>
            <li>caseId:      <span className="text-rose-200">{caseId}</span></li>
          </ul>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {isLawyer ? (
          <button
            type="button"
            onClick={onReReviewNow}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded border border-amber-500/60 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            Re-review now
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded border border-slate-700 bg-slate-900 text-slate-400">
            <Lock className="w-3.5 h-3.5" />
            Re-review now — attorney only
          </span>
        )}
        <button
          type="button"
          onClick={() => { setHeld(true); onHoldFiling?.(); }}
          disabled={held}
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded border ${
            held
              ? "border-amber-600/40 bg-amber-900/30 text-amber-200"
              : "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
          }`}
        >
          <PauseCircle className="w-3.5 h-3.5" />
          {held ? "Filing held — attorney follow-up flagged" : "Do not file — seek update"}
        </button>
      </div>

      <p className="text-[10px] text-rose-100/60 italic mt-2 leading-snug">
        <AlertTriangle className="w-3 h-3 inline mr-1" />
        Filing is blocked until an attorney completes the re-review and the case is
        stamped against the firm's current ruleset version.
      </p>
    </div>
  );
}
