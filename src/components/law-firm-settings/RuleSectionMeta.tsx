// Shared section-header strip for the canonical reference pages.
//
// Renders:
//   - "Last updated: <date>" — the max of (datasetDate, latest operator
//     publishEvent for the rulesAuditStore section).
//   - A "Request a change" button — opens a modal capturing
//     { row, issue, suggested correction } and submits to
//     ruleChangeRequests.
//
// Mount on every section header (Median Income, Exemptions, the 3 Living
// Standards sub-headers, Means-Test Figures, Local Rules).

import { useMemo, useState } from "react";
import { CalendarClock, MessageSquarePlus, X, Check } from "lucide-react";
import { useRulesAudit } from "./rulesAuditStore";
import type { RulesSection } from "./rulesAuditStore";
import {
  submitRuleChangeRequest, useRuleChangeRequestCount,
  type RuleChangeSection,
} from "../../lib/ruleChangeRequests";

interface Props {
  /** Section identifier — drives publish-event lookup + change-request
   *  bucketing. */
  changeSection: RuleChangeSection;
  /** Optional audit-store section. If the change-request section maps to
   *  a rulesAuditStore section (Median, Exemptions, all Living Standards
   *  subs), pass it so the latest publishEvent can supersede the dataset
   *  effective date. Local Rules + Means-Test Figures aren't currently
   *  audit-stored at the section grain — pass undefined for those. */
  auditSection?: RulesSection;
  /** Dataset effective date (ISO yyyy-mm-dd or human-readable). */
  datasetDate: string;
  /** Optional human label used in the modal heading. Defaults to the
   *  section label. */
  headingOverride?: string;
}

export default function RuleSectionMeta({
  changeSection, auditSection, datasetDate, headingOverride,
}: Props) {
  const audit = useRulesAudit();
  const pendingCount = useRuleChangeRequestCount(changeSection);

  // Last-updated = max(datasetDate, latest publishEvent.effectiveDate
  // matching this section). publishEvents are newest first. "all"-scope
  // publishes apply to every section.
  const effectiveDisplay = useMemo(() => {
    if (!auditSection) return datasetDate;
    const matching = audit.publishEvents.find(
      p => p.scope === "all" || (Array.isArray(p.scope) && p.scope.includes(auditSection)),
    );
    if (!matching) return datasetDate;
    // Pick the later of the two dates (string compare works for ISO yyyy-mm-dd).
    if (matching.effectiveDate > datasetDate) return matching.effectiveDate;
    return datasetDate;
  }, [audit.publishEvents, auditSection, datasetDate]);

  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#6B6B66] border border-[#2A2A28] rounded-full px-2 py-0.5">
          <CalendarClock className="w-3 h-3" />
          Last updated: <span className="text-[#FAFAF7] normal-case tracking-normal font-mono">{effectiveDisplay}</span>
        </span>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold border border-amber-500/40 bg-amber-500/10 text-amber-200 rounded-full px-2.5 py-0.5 hover:bg-amber-500/20"
        >
          <MessageSquarePlus className="w-3 h-3" />
          Request a change
          {pendingCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-amber-500/30 text-amber-100 text-[9px] font-bold">
              {pendingCount}
            </span>
          )}
        </button>
      </div>
      {showModal && (
        <RequestChangeModal
          changeSection={changeSection}
          sectionLabel={headingOverride}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────

function RequestChangeModal({
  changeSection, sectionLabel, onClose,
}: {
  changeSection: RuleChangeSection;
  sectionLabel?: string;
  onClose: () => void;
}) {
  const [rowKey, setRowKey] = useState("");
  const [issue, setIssue] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [submittedBy, setSubmittedBy] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    if (!issue.trim()) return;
    submitRuleChangeRequest({
      section: changeSection,
      rowKey,
      issue,
      suggestion,
      submittedBy,
    });
    setSubmitted(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[#2A2A28] bg-[#0F0F0E] p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-sm font-bold text-[#FAFAF7]">Request a change</p>
            <p className="text-[11px] text-[#6B6B66] mt-0.5">
              {sectionLabel ?? changeSection.replace(/_/g, " ").replace(/\./g, " — ")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#6B6B66] hover:text-white"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/10 p-4 flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-300 flex-shrink-0 mt-0.5" />
            <div className="text-[12px] text-emerald-100 leading-relaxed">
              <p className="font-semibold">Request submitted.</p>
              <p className="text-emerald-200/80 mt-1">
                Your firm's attorney/admin and the Bankruptcy.AI operator have been notified.
                {/* TODO: route to firm attorney/admin + platform operator. */}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold border border-emerald-500/40 text-emerald-100 rounded px-2.5 py-1 hover:bg-emerald-900/30"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">
                  Row / value (optional)
                </label>
                <input
                  type="text"
                  value={rowKey}
                  onChange={e => setRowKey(e.target.value)}
                  placeholder='e.g. "AZ size-4 median", "WA — Pierce Co. housing size-3"'
                  className="w-full bg-[#0F0F0E] border border-[#2A2A28] text-[12px] text-[#FAFAF7] rounded px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">
                  What's wrong <span className="text-rose-300">*</span>
                </label>
                <textarea
                  rows={3}
                  value={issue}
                  onChange={e => setIssue(e.target.value)}
                  placeholder="Describe the issue you found."
                  className="w-full bg-[#0F0F0E] border border-[#2A2A28] text-[12px] text-[#FAFAF7] rounded px-2 py-1.5 resize-y"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">
                  Suggested correction
                </label>
                <textarea
                  rows={2}
                  value={suggestion}
                  onChange={e => setSuggestion(e.target.value)}
                  placeholder="Proposed value, citation, or source."
                  className="w-full bg-[#0F0F0E] border border-[#2A2A28] text-[12px] text-[#FAFAF7] rounded px-2 py-1.5 resize-y"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">
                  Your name (optional)
                </label>
                <input
                  type="text"
                  value={submittedBy}
                  onChange={e => setSubmittedBy(e.target.value)}
                  placeholder="Defaults to 'unknown' if blank."
                  className="w-full bg-[#0F0F0E] border border-[#2A2A28] text-[12px] text-[#FAFAF7] rounded px-2 py-1.5"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-[11px] font-semibold text-[#6B6B66] border border-[#2A2A28] rounded px-3 py-1.5 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!issue.trim()}
                className="inline-flex items-center gap-1 text-[11px] font-semibold border border-amber-500/50 bg-amber-500/15 text-amber-100 rounded px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit request
              </button>
            </div>
          </>
        )}

        <p className="text-[9px] text-[#6B6B66] italic mt-3 leading-snug">
          {/* TODO: persist + route to firm attorney/admin + platform operator. */}
          Today the request lives in memory + per-tab localStorage. Routing + audit land with
          the firm_rule_change_requests table.
        </p>
      </div>
    </div>
  );
}
