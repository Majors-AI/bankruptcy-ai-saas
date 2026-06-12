// Slice 5 — Firm-side Accept-and-apply gate.
//
// Mounted at the top of LawFirmSettings (Shell). Lists pending rule
// updates the operator has published but the firm hasn't accepted yet.
// Each item shows the published version, sections affected, effective
// date, and change summary; the firm owner / supervising attorney must
// click "Accept & apply" with an explicit acknowledgment before the new
// version applies to that firm.
//
// Until accepted, firm.appliedRulesVersion is unchanged. The existing
// rulesAuditStore re-review queue ALSO holds steady — the version
// mismatch only kicks in once acceptForFirm bumps the applied version.

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import {
  useFirmRuleState, acceptForFirm,
  type FirmPendingUpdate,
} from "../../lib/firmRuleUpdates";

interface Props {
  firmId: string;
  /** Viewer role. Only law_firm_owner OR attorney_super_admin may accept;
   *  others see the notice but the Accept button is disabled with an
   *  out-of-scope tooltip. */
  canAccept: boolean;
  /** Viewer display name (or email) — captured on the accepted record. */
  acceptedBy: string;
}

export default function FirmRuleUpdateAcceptNotice({
  firmId, canAccept, acceptedBy,
}: Props) {
  const state = useFirmRuleState(firmId);
  if (state.pending.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-100">
            {state.pending.length === 1
              ? "Rule update available"
              : `${state.pending.length} rule updates available`}
          </p>
          <p className="text-[11px] text-amber-200/90 mt-0.5 leading-relaxed">
            The Bankruptcy.AI operator published changes affecting your firm. Until accepted,
            your firm's <strong>applied ruleset version</strong> stays unchanged and these
            changes do not flow into case calculations or pre-filing checks.
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {state.pending.map(p => (
          <PendingRow
            key={p.publishEventId}
            firmId={firmId}
            pending={p}
            canAccept={canAccept}
            acceptedBy={acceptedBy}
          />
        ))}
      </ul>

      {!canAccept && (
        <p className="text-[10px] text-amber-200/70 italic mt-2">
          Read-only — only the Law Firm Owner or a supervising attorney may accept and apply.
        </p>
      )}
    </div>
  );
}

function PendingRow({
  firmId, pending, canAccept, acceptedBy,
}: {
  firmId: string;
  pending: FirmPendingUpdate;
  canAccept: boolean;
  acceptedBy: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);

  function onAccept() {
    if (!acknowledged || !canAccept || busy) return;
    setBusy(true);
    const ok = acceptForFirm(firmId, pending.publishEventId, acceptedBy);
    setBusy(false);
    if (!ok) {
      // shouldn't happen but surface defensively
      window.alert("Could not accept this update — it may already be applied.");
    }
  }

  const scopeStr = pending.scope === "all"
    ? "All sections"
    : pending.scope.map(s => s.replace(/_/g, " ")).join(", ");

  return (
    <li className="rounded-lg border border-amber-500/30 bg-amber-500/[0.03] p-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-amber-100">
            <span className="font-mono">v{pending.versionId}</span>
            <span className="text-amber-200/70 mx-1">·</span>
            <span>effective {pending.effectiveDate}</span>
          </p>
          <p className="text-[11px] text-amber-200/80 mt-0.5">
            Sections: <span className="text-amber-100 font-semibold">{scopeStr}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(o => !o)}
          className="text-[10px] uppercase tracking-widest text-amber-200/80 hover:text-amber-100 inline-flex items-center gap-1"
          aria-expanded={expanded}
        >
          {expanded
            ? <><ChevronDown className="w-3 h-3" />Hide changes</>
            : <><ChevronRight className="w-3 h-3" />Show changes</>}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 rounded border border-amber-500/20 bg-amber-500/[0.02] p-2">
          <p className="text-[10px] uppercase tracking-widest text-amber-200/70 mb-1">
            Change summary
          </p>
          <p className="text-[11px] text-amber-100/90 leading-relaxed whitespace-pre-wrap">
            {pending.changeSummary}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-start justify-between gap-3 flex-wrap">
        <label className={`inline-flex items-start gap-2 ${canAccept ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}>
          <input
            type="checkbox"
            checked={acknowledged}
            disabled={!canAccept}
            onChange={e => setAcknowledged(e.target.checked)}
            className="mt-0.5 accent-amber-500"
          />
          <span className="text-[11px] text-amber-100 leading-snug">
            I acknowledge this rule update will apply to my firm and trigger pre-filing
            re-review on in-window reviewed-but-not-yet-filed cases.
          </span>
        </label>
        <button
          type="button"
          onClick={onAccept}
          disabled={!canAccept || !acknowledged || busy}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded border border-emerald-500/60 bg-emerald-600/30 text-emerald-100 hover:bg-emerald-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {busy ? "Applying…" : "Accept & apply"}
        </button>
      </div>
    </li>
  );
}
