// Staff-guided intake wrapper.
//
// Hosts the rich New Client Intake Form (BankruptcyIntake) inside a meta-flow
// that walks the staffer through the call:
//
//     INTRO  →  FORM (10 sections)  →  CLOSING  →  (submit-for-attorney-review)
//
// The locked Client Portal questionnaire is NOT referenced or touched.
// BankruptcyIntake (the staff-facing form) is consumed via its existing
// additive props (leadId, initialData, onStepChange, onSubmitted) — those
// were already part of its public surface before this change. The form's
// internal navigation + 10-section structure is untouched.
//
// What this wrapper adds on top of the form:
//   - INTRO meta-step — read-aloud role-disclosure script (placeholders
//     {firmName}/{staffName}/{staffTitle}/{supervisingAttorney} are left
//     literal for now; live build interpolates from firm + auth context)
//   - CLOSING meta-step — read-aloud post-filing education + attorney-
//     reviewed banner, shown BEFORE the final submit-for-attorney-review
//     action
//   - Wrapper-level NEXT / BACK that move between meta-sections (Intro ↔
//     Form ↔ Closing). The form's own internal next/prev between its 10
//     sections is untouched.
//   - Form state is preserved across meta-step navigation: the form stays
//     mounted (display:none when hidden) so going Form → Intro → Form does
//     not reset answers.
//   - Pre-fill from the lead row (name/email/phone/state).
//   - Final-submit handler: lead-row update to sent_for_attorney_review
//     (existing flow, same field set the LegalAdminPortal lead-detail panel
//     uses today) + SCAFFOLD client-message dispatch ("bankruptcy
//     questionnaire" — no real send today; TODO for Twilio / SendGrid).
//   - Exit confirm guard for unsaved progress.
//
// BankruptcyIntake additions consumed here (all pre-existing optional props):
//   - leadId?: string         → included in intake_submissions insert
//   - initialData?: Partial   → merged into the data state on mount
//   - onStepChange?: (n)=>void → emits step transitions for the script panel
//   - onSubmitted?: (id)=>void → fires after the form's own insert completes

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, AlertCircle, ChevronRight, Info, FileText, X,
  Send, Sparkles, CheckCircle,
} from "lucide-react";
// The locked client questionnaire (BankruptcyIntake.jsx) was the previous
// inner-form here. The staff-guided flow now uses the SHORT staff-facing
// DETERMINATION questionnaire (DeterminationQuestionnaire.tsx) which
// mirrors the same form_data keys but trims to what the eligibility
// engine reads. The locked questionnaire is NOT touched or imported.
import DeterminationQuestionnaire, {
  DETERMINATION_SECTION_COUNT, getDeterminationFlowScript,
  type DetFormData,
} from "./DeterminationQuestionnaire";
import { supabase } from "../../lib/supabase";
import {
  INTAKE_INTRO_SCRIPT, INTAKE_CLOSING_LEAD_IN, INTAKE_CLOSING_BANNER,
  INTAKE_CLOSING_BLOCKS,
} from "./scripts";

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

type MetaStep = 'intro' | 'form' | 'closing';

const META_STEP_LABEL: Record<MetaStep, string> = {
  intro:   'Intro',
  form:    'Questionnaire',
  closing: 'Closing',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function StaffGuidedIntake({
  lead, session: _session, onExit, onSubmitted,
}: StaffGuidedIntakeProps) {
  // Wrapper-level meta-step (Intro / Form / Closing). Independent of the
  // form's internal 10-section step.
  const [metaStep, setMetaStep] = useState<MetaStep>('intro');
  // The form's own internal step — emitted via BankruptcyIntake.onStepChange.
  // Used for the sidebar step list and the header step indicator.
  const [step, setStep] = useState(0);
  // "Unsaved progress" guard: once we've moved past intro OR past form step 0,
  // treat the form as dirty and ask before exiting.
  const [hasProgressed, setHasProgressed] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  // Captured after the form's own internal submit completes — used to gate
  // the closing's "Submit for attorney review" button + to thread through to
  // the parent onSubmitted callback at the very end.
  const [capturedSubmissionId, setCapturedSubmissionId] = useState<string | null>(null);
  // Determination questionnaire's final form_data — captured at completion
  // so the host can ship it server-side when persistence lands (TODO Phase B).
  // Today's wrapper holds it in memory only; nothing persists.
  // The state-getter (capturedFormData) is intentionally unused right now —
  // the value lives here ready for the future finalizeIntake() write.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_capturedFormData, setCapturedFormData] = useState<DetFormData | null>(null);
  // After closing's submit-for-attorney-review runs:
  //   - 'finalizing': writing the lead-row update
  //   - 'done':       lead routed; scaffold message marked queued; staying
  //                   on the closing view until the parent navigates away
  const [finalizeState, setFinalizeState] = useState<'idle' | 'finalizing' | 'done'>('idle');
  // Scaffold-only client-message dispatch state. No real send today; the
  // submit handler flips this to 'queued' so the staffer sees confirmation.
  const [clientMessageScaffold, setClientMessageScaffold] = useState<'idle' | 'queued'>('idle');

  // Pre-fill from the lead. Only the contact fields the lead already has —
  // everything else stays blank per spec.
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

  // Mark progressed once the staffer moves past the intro or advances the
  // form past its first step. Either signal is enough to consider the call
  // mid-stream for the exit-confirm guard.
  useEffect(() => {
    if (!hasProgressed && (metaStep !== 'intro' || step > 0)) {
      setHasProgressed(true);
    }
  }, [metaStep, step, hasProgressed]);

  function handleStepChange(nextStep: number) {
    setStep(nextStep);
  }

  // BankruptcyIntake calls this once its own intake_submissions insert
  // completes. We capture the id and advance the wrapper to the closing
  // meta-step. The lead-row update (status='sent_for_attorney_review') is
  // GATED behind the closing's "Submit for attorney review" button so the
  // staffer reads the closing script to the client before the case actually
  // routes to the attorney queue.
  //
  // Note: if the staffer navigates BACK from closing to form and re-submits
  // the form, the locked form will create a NEW intake_submissions row. The
  // wrapper captures the latest id; the earlier row is orphaned. That's an
  // existing behavior of the locked form and is intentionally not handled
  // here (would require touching the locked file).
  function handleAfterFormSubmit(submissionId: string | null) {
    setCapturedSubmissionId(submissionId);
    setMetaStep('closing');
  }

  // Closing's "Submit for attorney review" handler.
  // Existing flow: mark intake complete + route to attorney review queue.
  // Same field set the LegalAdminPortal lead-detail panel uses today.
  // No new status invented; no migrations.
  async function finalizeIntake() {
    if (finalizeState !== 'idle') return;
    setFinalizeState('finalizing');
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

      // ── SCAFFOLD client message ────────────────────────────────────────
      // The "bankruptcy questionnaire" notification the client receives
      // after intake completes. NO REAL SEND TODAY.
      //
      // TODO Phase B — real send pipeline:
      //   1. Compose from `firm_message_templates` (template key
      //      'intake_questionnaire_received') with {firmName} +
      //      {clientFirstName} interpolated.
      //   2. Dispatch via the firm's configured Twilio (SMS) + SendGrid
      //      (email) integration, gated by the consent system's opt-out
      //      flag (sms_consent / email_consent on intake_leads).
      //   3. Record the dispatch on `intake_contact_log` so the lead's
      //      comms history shows it (direction='outbound',
      //      channel='sms'|'email', message_kind='intake_questionnaire').
      //   4. If both channels are opted out, fall back to in-portal
      //      notification only and surface a warning here.
      //
      // Today: flip local state to 'queued' so the staffer sees confirmation.
      setClientMessageScaffold('queued');

      setFinalizeState('done');
    } catch (e) {
      // Roll back UI state on failure so the staffer can retry.
      setFinalizeState('idle');
      throw e;
    }
  }

  // Once finalize is done, hand control back to the parent (which closes the
  // guided-intake view and returns to LegalAdminPortal). Slight delay so the
  // staffer sees the "queued" confirmation before navigation.
  useEffect(() => {
    if (finalizeState === 'done') {
      const t = window.setTimeout(() => onSubmitted(capturedSubmissionId), 1200);
      return () => window.clearTimeout(t);
    }
  }, [finalizeState, capturedSubmissionId, onSubmitted]);

  function attemptExit() {
    if (hasProgressed && finalizeState === 'idle') setExitConfirmOpen(true);
    else onExit();
  }

  // ─── Navigation handlers (wrapper-level NEXT / BACK) ───────────────────────
  // Move between Intro ↔ Form ↔ Closing. The form's internal next/prev
  // between its 10 sections is unchanged.
  const canGoBack = (metaStep === 'form' && finalizeState === 'idle')
                 || (metaStep === 'closing' && finalizeState === 'idle');
  const backLabel =
    metaStep === 'form'    ? 'Back to intro' :
    metaStep === 'closing' ? 'Back to questionnaire' :
                             '';
  function goBack() {
    if (metaStep === 'form')    setMetaStep('intro');
    if (metaStep === 'closing') setMetaStep('form');
  }

  // NEXT label/handler depends on the meta-step.
  //
  // Intro    → "Begin intake"      → setMetaStep('form')
  // Form     → "Continue to closing" — disabled until form has submitted
  //            internally (capturedSubmissionId set). Note: the form's own
  //            internal Submit auto-advances to closing via
  //            handleAfterFormSubmit; this button is a manual fallback that
  //            re-advances after a BACK trip without requiring re-submit.
  // Closing  → "Submit for attorney review" → finalizeIntake()
  const nextSpec: { label: string; disabled: boolean; onClick: () => void; tone: 'primary' | 'gold' | 'submit' } =
    metaStep === 'intro' ? {
      label: 'Begin intake',
      disabled: false,
      onClick: () => setMetaStep('form'),
      tone: 'primary',
    } : metaStep === 'form' ? {
      label: capturedSubmissionId ? 'Continue to closing' : 'Continue to closing (complete the questionnaire first)',
      disabled: !capturedSubmissionId,
      onClick: () => setMetaStep('closing'),
      tone: 'gold',
    } : {
      label:
        finalizeState === 'finalizing' ? 'Routing to attorney…' :
        finalizeState === 'done'       ? 'Sent to attorney review ✓' :
                                         'Submit for attorney review',
      disabled: finalizeState !== 'idle',
      onClick: () => { void finalizeIntake(); },
      tone: 'submit',
    };

  // Per-section flow script for the determination questionnaire. `step` is
  // emitted by DeterminationQuestionnaire.onSectionChange (0-indexed section
  // number, NOT the locked-form's 10-step index).
  const currentScript = getDeterminationFlowScript(step);

  return (
    <div className="min-h-screen flex flex-col text-[#FAFAF7]" style={{ background: "#0F0F0E" }}>
      {/* ─── Top bar ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 px-6 flex-shrink-0"
        style={{ height: 56, background: "#0F0F0E", borderBottom: "1px solid #2A2A28", display: "flex", alignItems: "center" }}
      >
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
        <span className="text-[11px] font-mono text-[#6B6B66] ml-auto">
          {metaStep === 'form' ? `section ${step + 1}/${DETERMINATION_SECTION_COUNT}` : META_STEP_LABEL[metaStep]}
        </span>
      </header>

      {/* ─── Body — script sidebar + main area ──────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[340px_1fr] min-h-0">

        {/* Script sidebar — content switches per metaStep */}
        <aside className="hidden lg:flex flex-col border-r border-[#2A2A28] overflow-y-auto" style={{ background: "#141412" }}>
          {/* Meta-step indicator + step list */}
          <div className="px-5 py-4 border-b border-[#2A2A28]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-2">
              Intake call
            </p>
            <ol className="space-y-1">
              {/* Intro entry */}
              <li>
                <MetaStepRow active={metaStep === 'intro'} done={metaStep !== 'intro'} index="I" label="Intro & role disclosure" />
              </li>
              {/* Determination questionnaire sections — section index emitted
                  by DeterminationQuestionnaire.onSectionChange. */}
              {Array.from({ length: DETERMINATION_SECTION_COUNT }).map((_, i) => {
                const s = getDeterminationFlowScript(i);
                return (
                  <li key={i}>
                    <MetaStepRow
                      active={metaStep === 'form' && i === step}
                      done={metaStep === 'closing' || (metaStep === 'form' && i < step)}
                      index={String(i + 1)}
                      label={s?.title ?? `Section ${i + 1}`}
                    />
                  </li>
                );
              })}
              {/* Closing entry */}
              <li>
                <MetaStepRow active={metaStep === 'closing'} done={false} index="C" label="Closing & education" />
              </li>
            </ol>
          </div>

          {/* Sidebar script panel — content swapped per metaStep */}
          <div className="px-5 py-4 flex-1">
            {metaStep === 'intro' && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#B8945F]" />
                  <p className="text-xs font-semibold text-[#FAFAF7]" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                    Read this aloud
                  </p>
                </div>
                <p className="text-[11px] text-[#6B6B66] leading-relaxed italic">
                  The intro script is read prominently in the main panel. Click <span className="text-[#FAFAF7] font-semibold">Begin intake</span> when ready.
                </p>
              </>
            )}

            {metaStep === 'form' && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-3.5 h-3.5 text-[#B8945F]" />
                  <p className="text-xs font-semibold text-[#FAFAF7]" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                    {currentScript?.title ?? "—"}
                  </p>
                </div>
                {currentScript ? (
                  <p className="text-[13px] text-[#FAFAF7] leading-relaxed whitespace-pre-wrap italic" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                    {currentScript.flowScript}
                  </p>
                ) : (
                  <p className="text-xs text-[#6B6B66] italic">No script for this section.</p>
                )}
                <p className="text-[10px] text-[#6B6B66] mt-4 italic leading-relaxed">
                  The determination questionnaire fills the main panel — work through each section's
                  questions, then click Next. The IRS Standards pre-fill expense lines automatically.
                </p>
              </>
            )}

            {metaStep === 'closing' && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#B8945F]" />
                  <p className="text-xs font-semibold text-[#FAFAF7]" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                    Closing outline
                  </p>
                </div>
                <ul className="space-y-1.5">
                  {INTAKE_CLOSING_BLOCKS.map(b => (
                    <li key={b.heading} className="text-[11px] text-[#6B6B66] leading-snug">
                      <span className="text-[#B8945F]">·</span> {b.heading}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[10px] text-[#6B6B66] italic leading-relaxed">
                  Read each section to the client in the main panel before submitting.
                </p>
              </>
            )}
          </div>
        </aside>

        {/* ─── Main area — content swaps per metaStep ─────────────────── */}
        <main className="overflow-y-auto">
          {/* INTRO ─────────────────────────────────────────────────────── */}
          {metaStep === 'intro' && (
            <div className="mx-auto max-w-3xl px-6 py-10">
              <div className="rounded-2xl border border-[#2A2A28] bg-[#1A1A18] p-6 lg:p-8 shadow-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-[#B8945F]" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#B8945F]">
                    Read aloud — Intro
                  </p>
                </div>
                <p
                  className="text-[17px] leading-relaxed text-[#FAFAF7]"
                  style={{ fontFamily: "'Fraunces', Georgia, serif" }}
                >
                  {INTAKE_INTRO_SCRIPT}
                </p>
                <p className="mt-5 text-[11px] text-[#6B6B66] italic leading-relaxed">
                  Placeholders (<code className="font-mono text-[#FAFAF7]">{`{firmName}`}</code>,{" "}
                  <code className="font-mono text-[#FAFAF7]">{`{staffName}`}</code>,{" "}
                  <code className="font-mono text-[#FAFAF7]">{`{staffTitle}`}</code>,{" "}
                  <code className="font-mono text-[#FAFAF7]">{`{supervisingAttorney}`}</code>) are
                  resolved by the live build from firm + auth context. Until that wiring lands,
                  the script reads them literally so the firm can validate before substitution
                  goes live.
                </p>
              </div>

              <div className="mt-4 rounded-lg border border-dashed border-[#2A2A28] bg-[#0F0F0E] p-4 text-[11px] text-[#6B6B66] leading-relaxed">
                <p className="font-semibold text-[#FAFAF7] mb-1">What happens next</p>
                <p>
                  Click <span className="text-[#B8945F] font-semibold">Begin intake</span> below to
                  open the questionnaire. The form has its own 10-section flow with internal
                  next/previous buttons — those are unchanged. When the form's own Submit button
                  is pressed, you'll be brought to the closing script before the case routes to
                  the attorney.
                </p>
              </div>
            </div>
          )}

          {/* FORM ──────────────────────────────────────────────────────── */}
          {/* Determination questionnaire — short, staff-facing, mirrors the
              locked questionnaire's form_data keys. Always mounted so
              meta-step navigation preserves answers; hidden via
              display:none when not active. */}
          <div style={{ display: metaStep === 'form' ? 'block' : 'none' }} className="min-h-full">
            {finalizeState === 'finalizing' && (
              <div className="px-6 py-3 text-center text-xs text-[#B8945F] bg-[#1A1A18] border-b border-[#2A2A28]">
                Routing intake to attorney review…
              </div>
            )}
            <DeterminationQuestionnaire
              leadDefaults={initialData}
              onSectionChange={(idx) => handleStepChange(idx)}
              onCancel={() => setMetaStep('intro')}
              onSubmit={(determinationFd: DetFormData) => {
                // TODO Phase B — persist the determination questionnaire's
                // form_data to a new intake_submissions row (or attach to
                // the existing row keyed by lead_id). Today's wrapper only
                // updates the lead row in finalizeIntake() — the
                // questionnaire's answers are kept in memory until then.
                // Capture a synthetic submission id so the closing footer
                // looks consistent with the prior flow; nothing persists.
                handleAfterFormSubmit(`det-${Date.now()}`);
                // Stash the answers on the closure for the host's eventual
                // server-side write. Held on the component-level capturedSubmissionId
                // sibling state until persistence lands.
                setCapturedFormData(determinationFd);
              }}
            />
          </div>

          {/* CLOSING ──────────────────────────────────────────────────── */}
          {metaStep === 'closing' && (
            <div className="mx-auto max-w-3xl px-6 py-10 space-y-5">

              {/* Lead-in — prominent, read aloud */}
              <div className="rounded-2xl border border-[#2A2A28] bg-[#1A1A18] p-6 lg:p-8">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-[#B8945F]" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#B8945F]">
                    Read aloud — Closing
                  </p>
                </div>
                <p
                  className="text-[17px] leading-relaxed text-[#FAFAF7]"
                  style={{ fontFamily: "'Fraunces', Georgia, serif" }}
                >
                  {INTAKE_CLOSING_LEAD_IN}
                </p>
              </div>

              {/* Attorney-reviewed banner */}
              <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 px-4 py-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-[12px] text-amber-200/90 leading-relaxed">
                  {INTAKE_CLOSING_BANNER}
                </p>
              </div>

              {/* Verbatim heading + body blocks */}
              {INTAKE_CLOSING_BLOCKS.map((b, i) => (
                <section key={b.heading} className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-mono text-[#6B6B66]">{String(i + 1).padStart(2, '0')}</span>
                    <p
                      className="text-[11px] font-bold uppercase tracking-widest text-[#B8945F]"
                      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
                    >
                      — {b.heading} —
                    </p>
                  </div>
                  <p
                    className="text-[14px] leading-relaxed text-[#FAFAF7] whitespace-pre-line"
                    style={{ fontFamily: "'Fraunces', Georgia, serif" }}
                  >
                    {b.body}
                  </p>
                </section>
              ))}

              {/* Scaffold submit state confirmation */}
              {clientMessageScaffold === 'queued' && (
                <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 px-4 py-3 flex items-start gap-2">
                  <Send className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-emerald-300">
                      Client message "bankruptcy questionnaire" — queued (scaffold)
                    </p>
                    <p className="text-[10.5px] text-emerald-200/70 mt-0.5 leading-relaxed">
                      No real send today. Live build composes from
                      <code className="font-mono mx-1">firm_message_templates</code>
                      (template key <code className="font-mono mx-1">intake_questionnaire_received</code>) and
                      dispatches via Twilio / SendGrid, gated by consent flags. See in-file TODO.
                    </p>
                  </div>
                </div>
              )}

              {finalizeState === 'done' && (
                <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/30 px-4 py-3 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[12px] text-emerald-200 leading-relaxed">
                    Intake routed to attorney review. Lead status set to{" "}
                    <code className="font-mono text-emerald-300">sent_for_attorney_review</code>;
                    returning to the lead list…
                  </p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ─── Footer — wrapper-level NEXT / BACK ─────────────────────────── */}
      <footer
        className="sticky bottom-0 z-30 px-6 py-3 flex items-center gap-3 flex-shrink-0"
        style={{ background: "#0F0F0E", borderTop: "1px solid #2A2A28" }}
      >
        <button
          type="button"
          onClick={goBack}
          disabled={!canGoBack}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
            canGoBack
              ? 'border-[#3A3A36] text-[#FAFAF7] hover:bg-[#1A1A18]'
              : 'border-[#2A2A28] text-[#3A3A36] cursor-not-allowed opacity-60'
          }`}
          title={canGoBack ? backLabel : 'No previous section'}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {canGoBack ? backLabel : 'Back'}
        </button>

        <div className="mx-auto text-[10px] uppercase tracking-widest text-[#6B6B66]">
          {metaStep === 'form'
            ? `${META_STEP_LABEL[metaStep]} · step ${step + 1}/10`
            : META_STEP_LABEL[metaStep]}
        </div>

        <button
          type="button"
          onClick={nextSpec.onClick}
          disabled={nextSpec.disabled}
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg transition-colors ${
            nextSpec.disabled
              ? 'bg-[#1A1A18] text-[#3A3A36] border border-[#2A2A28] cursor-not-allowed'
              : nextSpec.tone === 'primary'
                ? 'bg-[#B8945F] text-[#0F0F0E] hover:bg-[#C8A46F]'
                : nextSpec.tone === 'gold'
                  ? 'bg-[#1E3A2F] text-[#FAFAF7] hover:bg-[#2E4A3F] border border-[#B8945F]/40'
                  : 'bg-emerald-700 text-white hover:bg-emerald-600 border border-emerald-500/40'
          }`}
          title={nextSpec.disabled ? nextSpec.label : ''}
        >
          {nextSpec.label} <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </footer>

      {/* ─── Exit confirm modal ─────────────────────────────────────────── */}
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

// ─── Sidebar row for the meta-step list ──────────────────────────────────────

function MetaStepRow({
  active, done, index, label,
}: {
  active: boolean;
  done: boolean;
  index: string;
  label: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
        active ? "bg-[#1E3A2F]/30 text-[#FAFAF7]" :
        done   ? "text-[#6B6B66]" :
                 "text-[#6B6B66]"
      }`}
    >
      <span className={`font-mono text-[10px] w-4 flex-shrink-0 ${active ? "text-[#B8945F]" : ""}`}>
        {index}
      </span>
      <span className={`truncate ${active ? "font-semibold" : ""}`}>{label}</span>
      {active && <ChevronRight className="w-3 h-3 text-[#B8945F] ml-auto flex-shrink-0" />}
    </div>
  );
}
