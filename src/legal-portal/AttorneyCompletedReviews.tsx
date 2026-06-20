// AttorneyCompletedReviews — read-only history surface for the
// simplified attorney portal (LegalAdminPortal "Completed Reviews" tab).
//
// One row per LEAD (collapsed from N review rounds via
// buildAttorneyCompletedReviews). Each row expands inline to show the
// attorney's decision notes + fee summary. Permanently attached to the
// case via lead_id (§12 matter spine).
//
// READ-ONLY. No edit affordances by design — historical record stays
// stable. If a re-review is needed, the case re-enters the live Review
// Queue when its status is rolled back upstream.

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, RotateCcw, FileText } from "lucide-react";
import {
  buildAttorneyCompletedReviews,
  DECISION_LABELS,
  OUTCOME_LABELS,
  type CompletedReviewRow,
  type CompletedReviewOutcome,
} from "../lib/buildAttorneyCompletedReviews";
import type {
  AttorneyIntakeReviewRow,
  IntakeLeadRow,
  AcceptanceRow,
} from "../components/legal/legalTasks";

export interface AttorneyCompletedReviewsProps {
  attorneyIntakeReviews: ReadonlyArray<AttorneyIntakeReviewRow>;
  intakeLeads:           ReadonlyArray<IntakeLeadRow>;
  acceptances:           ReadonlyArray<AcceptanceRow>;
}

export default function AttorneyCompletedReviews({
  attorneyIntakeReviews,
  intakeLeads,
  acceptances,
}: AttorneyCompletedReviewsProps) {
  const rows = useMemo<CompletedReviewRow[]>(
    () => buildAttorneyCompletedReviews({ attorneyIntakeReviews, intakeLeads, acceptances }),
    [attorneyIntakeReviews, intakeLeads, acceptances],
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  const acceptedCount = rows.filter(r => r.decision === "accepted").length;
  const declinedCount = rows.filter(r => r.decision === "declined").length;
  const retainedCount = rows.filter(r => r.outcome === "retained").length;

  return (
    <div className="space-y-4">
      {/* Header — muted, no colored banner */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-white">Completed Reviews</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Historical attorney case reviews for the firm. Read-only record — notes and
            retention outcomes stay attached to the case permanently.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>{rows.length} total</span>
          <span className="text-slate-700">·</span>
          <span>{acceptedCount} accepted</span>
          <span className="text-slate-700">·</span>
          <span>{declinedCount} declined</span>
          <span className="text-slate-700">·</span>
          <span>{retainedCount} retained</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-[#0d1221] border border-slate-800 rounded-2xl text-center py-16">
          <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">No completed reviews yet.</p>
          <p className="text-xs text-slate-600 mt-1">
            Cases appear here once an accept or decline decision is recorded.
          </p>
        </div>
      ) : (
        <div className="bg-[#0d1221] border border-slate-700/60 rounded-2xl divide-y divide-slate-800">
          {rows.map(row => (
            <CompletedRow
              key={row.leadId}
              row={row}
              isOpen={expanded === row.leadId}
              onToggle={() => setExpanded(expanded === row.leadId ? null : row.leadId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────

function CompletedRow({
  row, isOpen, onToggle,
}: {
  row: CompletedReviewRow;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const dec = row.decision;
  const decTone =
    dec === "accepted"
      ? { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" }
      : { color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/20" };

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/40 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="shrink-0 text-slate-600">
          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{row.clientName}</span>
            {row.chapter && (
              <span className="text-[9px] font-bold text-slate-500">Ch.{row.chapter}</span>
            )}
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${decTone.color} ${decTone.bg} ${decTone.border}`}
            >
              {dec === "accepted" ? <CheckCircle2 className="w-2.5 h-2.5 inline -mt-px mr-0.5" /> : <XCircle className="w-2.5 h-2.5 inline -mt-px mr-0.5" />}
              {DECISION_LABELS[dec]}
            </span>
            <OutcomeChip outcome={row.outcome} />
            {row.reviewCount > 1 && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-1.5 py-0.5">
                <RotateCcw className="w-2.5 h-2.5" /> Re-reviewed {row.reviewCount}×
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px] text-slate-500">{row.attorneyName}</span>
            <span className="text-[11px] text-slate-600">·</span>
            <span className="text-[11px] text-slate-500">{formatDecidedAt(row.decidedAt)}</span>
            {row.feeSummary && (
              <>
                <span className="text-[11px] text-slate-600">·</span>
                <span className="text-[11px] text-slate-500">{row.feeSummary}</span>
              </>
            )}
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="px-10 pb-4 -mt-1">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Attorney decision notes
          </p>
          {row.decisionNotes ? (
            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-900/40 border border-slate-800 rounded-lg p-3">
              {row.decisionNotes}
            </p>
          ) : (
            <p className="text-xs text-slate-600 italic">No notes recorded for this review.</p>
          )}
        </div>
      )}
    </div>
  );
}

function OutcomeChip({ outcome }: { outcome: CompletedReviewOutcome }) {
  const palette: Record<CompletedReviewOutcome, { color: string; bg: string; border: string }> = {
    retained:           { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    declined:           { color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/20" },
    no_case:            { color: "text-slate-400",   bg: "bg-slate-700/30",   border: "border-slate-600/30" },
    no_show:            { color: "text-slate-400",   bg: "bg-slate-700/30",   border: "border-slate-600/30" },
    fee_quoted_pending: { color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/20" },
    unknown:            { color: "text-slate-500",   bg: "bg-slate-800/40",   border: "border-slate-700/40" },
  };
  const p = palette[outcome];
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${p.color} ${p.bg} ${p.border}`}>
      {OUTCOME_LABELS[outcome]}
    </span>
  );
}

function formatDecidedAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}
