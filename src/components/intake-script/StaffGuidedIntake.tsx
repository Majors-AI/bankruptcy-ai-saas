// Staff-guided intake wrapper.
//
// Hosts the rich New Client Intake Form (BankruptcyIntake) inside a sidebar
// frame that walks the staffer through a per-step script during a live call.
//
// The form keeps full ownership of its 10 sections, conditional branching,
// validation, issue-spotting, and submit path. This wrapper only adds:
//   - a script panel keyed to the current step,
//   - a lead-context chip,
//   - pre-fill from the lead row (name/email/phone/state),
//   - lead-row status advancement after submit (mirrors the existing
//     `markIntakeCompleteAndSendForReview` path used by the lead detail
//     panel — same field set, no new status invented),
//   - an exit confirm guard for unsaved progress.
//
// The locked Client Portal questionnaire is NOT referenced or touched.
//
// BankruptcyIntake additions consumed here (all optional props, additive):
//   - leadId?: string         → included in intake_submissions insert
//   - initialData?: Partial   → merged into the data state on mount
//   - onStepChange?: (n)=>void → emits step transitions for the script panel

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, AlertCircle, ChevronRight, Info, FileText, X } from "lucide-react";
import BankruptcyIntake from "../../BankruptcyIntake";
import { supabase } from "../../lib/supabase";
import { STAFF_INTAKE_SCRIPTS, getScriptForStep } from "./scripts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  chapter_interest: number | null;
}

interface PortalSession {
  id: string;
  name: string;
  role: string;
  title: string | null;
}

interface StaffGuidedIntakeProps {
  lead: Lead;
  session: PortalSession;
  /** Cancel / Exit — wrapper guards against unsaved progress before calling. */
  onExit: () => void;
  /** Intake successfully submitted — receives the new intake_submissions.id. */
  onSubmitted: (submissionId: string | null) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StaffGuidedIntake({
  lead, session: _session, onExit, onSubmitted,
}: StaffGuidedIntakeProps) {
  // The script panel keys off BankruptcyIntake's current step.
  const [step, setStep] = useState(0);
  // "Unsaved progress" guard: once we've moved past step 0, treat the form
  // as dirty and ask before exiting. Step 0 with no advancement = safe silent exit.
  const [hasProgressed, setHasProgressed] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  // After the form's own submit completes, advance the lead row.
  const [advancingLead, setAdvancingLead] = useState(false);

  // Pre-fill from the lead. Only the contact fields the lead already has —
  // everything else stays blank per spec. Chapter is included even though
  // BankruptcyIntake's data state doesn't currently surface a chapter field
  // (it's derived); a future field rename would pick this up automatically.
  const initialData = useMemo(() => {
    const parts = (lead.full_name ?? "").trim().split(/\s+/);
    const firstName = parts[0] ?? "";
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
    return {
      firstName,
      lastName,
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      state: lead.state ?? "",
      chapter: lead.chapter_interest ? String(lead.chapter_interest) : undefined,
    } as Record<string, unknown>;
  }, [lead]);

  function handleStepChange(nextStep: number) {
    setStep(nextStep);
    if (nextStep > 0 && !hasProgressed) setHasProgressed(true);
  }

  // BankruptcyIntake calls this once its own submission insert completes.
  // We then advance the lead row using the existing
  // markIntakeCompleteAndSendForReview field set (intake_completed +
  // status='sent_for_attorney_review' + sent_for_review flags). No new
  // status invented; same shape that lead-detail panel uses today.
  function handleAfterSubmit(submissionId: string | null) {
    setAdvancingLead(true);
    (async () => {
      try {
        await supabase
          .from("intake_leads")
          .update({
            intake_completed: true,
            status: "sent_for_attorney_review",
            sent_for_review: true,
            sent_for_review_at: new Date().toISOString(),
          })
          .eq("id", lead.id);
      } finally {
        setAdvancingLead(false);
        onSubmitted(submissionId);
      }
    })();
  }

  function attemptExit() {
    if (hasProgressed) setExitConfirmOpen(true);
    else onExit();
  }

  const currentScript = getScriptForStep(step);

  return (
    <div className="min-h-screen flex flex-col text-[#FAFAF7]" style={{ background: "#0F0F0E" }}>
      {/* Top bar — lead context + exit */}
      <header className="sticky top-0 z-30 px-6 flex-shrink-0" style={{ height: 56, background: "#0F0F0E", borderBottom: "1px solid #2A2A28", display: "flex", alignItems: "center" }}>
        <button
          onClick={attemptExit}
          className="flex items-center gap-1.5 text-xs text-[#6B6B66] hover:text-[#FAFAF7] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Exit guided intake
        </button>
        <div className="mx-auto flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-[#2A2A28] bg-[#1A1A18]">
            <span className="text-[10px] uppercase tracking-widest text-[#B8945F] font-semibold">Intake for</span>
            <span className="text-xs font-semibold text-[#FAFAF7]">{lead.full_name}</span>
            <span className="text-[10px] text-[#6B6B66]">·</span>
            <span className="text-[11px] font-mono text-[#FAFAF7]">{lead.phone ?? lead.email ?? "—"}</span>
          </div>
        </div>
        <span className="text-[11px] font-mono text-[#6B6B66] ml-auto">step {step + 1}/10</span>
      </header>

      {/* Body — script sidebar + form */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[340px_1fr] min-h-0">

        {/* Script sidebar */}
        <aside className="hidden lg:flex flex-col border-r border-[#2A2A28] overflow-y-auto" style={{ background: "#141412" }}>
          {/* Step list */}
          <div className="px-5 py-4 border-b border-[#2A2A28]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-2">
              Intake call · {STAFF_INTAKE_SCRIPTS.length} steps
            </p>
            <ol className="space-y-1">
              {STAFF_INTAKE_SCRIPTS.map(s => {
                const isCurrent = s.step === step;
                const isPast = s.step < step;
                return (
                  <li key={s.step}>
                    <div
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                        isCurrent ? "bg-[#1E3A2F]/30 text-[#FAFAF7]" :
                        isPast    ? "text-[#6B6B66]" :
                                    "text-[#6B6B66]"
                      }`}
                    >
                      <span className={`font-mono text-[10px] w-4 flex-shrink-0 ${isCurrent ? "text-[#B8945F]" : ""}`}>
                        {s.step + 1}
                      </span>
                      <span className={`truncate ${isCurrent ? "font-semibold" : ""}`}>{s.title}</span>
                      {isCurrent && <ChevronRight className="w-3 h-3 text-[#B8945F] ml-auto flex-shrink-0" />}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Current step script */}
          <div className="px-5 py-4 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-3.5 h-3.5 text-[#B8945F]" />
              <p className="text-xs font-semibold text-[#FAFAF7]" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                {currentScript?.title ?? "—"}
              </p>
            </div>
            {currentScript ? (
              <>
                <p className="text-[13px] text-[#FAFAF7] leading-relaxed whitespace-pre-wrap" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                  {currentScript.script}
                </p>
                {currentScript.conditionalNotes && currentScript.conditionalNotes.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#2A2A28]">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-2">If applicable</p>
                    <ul className="space-y-2">
                      {currentScript.conditionalNotes.map((note, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Info className="w-3 h-3 text-[#B8945F] mt-1 flex-shrink-0" />
                          <p className="text-[11px] text-[#FAFAF7] leading-relaxed italic">{note}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {currentScript.referenceNotes && currentScript.referenceNotes.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#2A2A28]">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-2">Side reference (not spoken)</p>
                    <ul className="space-y-2">
                      {currentScript.referenceNotes.map((note, i) => (
                        <li key={i} className="text-[10px] text-[#6B6B66] leading-relaxed">{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-[#6B6B66] italic">No script for this step.</p>
            )}
          </div>
        </aside>

        {/* Form area */}
        <main className="overflow-y-auto">
          {/* Loading overlay while the lead-row update runs after submit */}
          {advancingLead && (
            <div className="px-6 py-3 text-center text-xs text-[#B8945F] bg-[#1A1A18] border-b border-[#2A2A28]">
              Submitting intake and updating the lead…
            </div>
          )}
          {/* The form itself — its existing public route renders this with no
              props; we pass the additive props here. */}
          <BankruptcyIntake
            leadId={lead.id}
            initialData={initialData}
            onStepChange={handleStepChange}
            onSubmitted={handleAfterSubmit}
          />
        </main>
      </div>

      {/* Exit confirm modal — only renders when there's unsaved progress */}
      {exitConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#1A1A18] border border-[#2A2A28] rounded-xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2A2A28] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-semibold text-[#FAFAF7]">Exit guided intake?</p>
              <button
                onClick={() => setExitConfirmOpen(false)}
                className="ml-auto text-[#6B6B66] hover:text-[#FAFAF7] transition-colors"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="px-5 py-4 text-xs text-[#6B6B66] leading-relaxed">
              You have unsaved progress on this intake. If you exit now, the answers you've collected on this call will not be saved.
            </div>
            <div className="px-5 py-3 border-t border-[#2A2A28] flex justify-end gap-2">
              <button
                onClick={() => setExitConfirmOpen(false)}
                className="text-xs font-semibold text-[#6B6B66] hover:text-[#FAFAF7] px-3 py-1.5 transition-colors"
              >
                Stay in intake
              </button>
              <button
                onClick={() => { setExitConfirmOpen(false); onExit(); }}
                className="text-xs font-bold text-[#0F0F0E] bg-[#B8945F] hover:bg-[#C8A46F] px-3 py-1.5 rounded transition-colors"
              >
                Exit and discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
