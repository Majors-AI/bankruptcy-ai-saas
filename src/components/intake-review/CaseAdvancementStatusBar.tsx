// Case-advancement status bar — client-visible 7-stage indicator.
//
// Shown on the Intake Portal lead detail screen to every viewer (lawyers AND
// non-lawyers). For non-lawyers this stands in for the "Attorney Review"
// action they can't open — they can SEE the case was submitted to / accepted
// by the attorney as completed stages, just can't open the review surface.
//
// Each stage is one of:
//   - 'done':    earlier in the lifecycle than the current lead state.
//                Renders the relevant timestamp.
//   - 'current': matches the current lead state.
//   - 'pending': hasn't been reached. Renders "—".
//
// The bar is CLIENT-VISIBLE by design — the firm's mental model is that the
// stage progression itself is appropriate to share with the client even
// though specific internal log entries are not (see ClientTimeLog).
//
// Data wiring today:
//   - Stage 1 "Scheduled":          lead.consultation_date
//   - Stage 2 "Intake in process":  lead.last_contact_at (LAST UPDATE)
//   - Stage 3 "Intake completed →
//              Submitted to attorney":
//                                    sent_for_review_at (when intake routed)
//                                    TODO: separate intake_completed_at
//                                    column once the schema captures the
//                                    completed-but-not-yet-routed moment.
//   - Stage 4 "Case accepted":      acceptance.decided_at when
//                                    acceptance.decision === 'accepted'
//   - Stage 5 "Case presented or
//              scheduled for presentation":
//                                    NOT WIRED today. TODO: add
//                                    presentation_scheduled_at +
//                                    presented_at fields on either intake_leads
//                                    or attorney_case_acceptances. Render "—"
//                                    until persistence exists.
//   - Stage 6 "Retained":           lead.retained_at
//   - Stage 7 "Fee quoted, pending
//              client acceptance /
//              FU scheduled":      lead.next_follow_up_at (LAST FU)
//                                    TODO: the follow-up RULES (cadence,
//                                    escalation, FU template selection) are
//                                    configured by a supervisor or superuser
//                                    in the Staff Settings supervisor framework
//                                    — not built here. This bar just surfaces
//                                    the most recent FU timestamp the lead
//                                    row already carries.

import { CheckCircle2, Clock, Circle } from "lucide-react";

// ─── Minimal lead/acceptance shapes (kept loose so the bar can be reused
//     without dragging in the host's full Lead / Acceptance types). ──────────

export interface CaseAdvancementLead {
  status: string;
  consultation_date: string | null;
  last_contact_at: string | null;
  intake_completed: boolean | null;
  sent_for_review: boolean | null;
  sent_for_review_at: string | null;
  retained_at: string | null;
  next_follow_up_at: string | null;
}
export interface CaseAdvancementAcceptance {
  decision: string;
  decided_at: string | null;
}

// ─── Stage definitions ───────────────────────────────────────────────────────

type StageStatus = 'done' | 'current' | 'pending';
interface Stage {
  id: number;
  label: string;
  /** Short caption rendered under the label. Either a real timestamp or
   *  "—" when the underlying field isn't wired yet (Stage 5) or hasn't
   *  been reached yet. */
  caption: string;
  status: StageStatus;
}

function fmtTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!isFinite(d.valueOf())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = iso.length > 10 ? iso.slice(0, 10) : iso;
  const d = new Date(s);
  if (!isFinite(d.valueOf())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Map lead.status → current stage index (1-based).
// 'sent_for_attorney_review' is the post-stage-3 state: stage 3 is DONE,
// stage 4 (Case accepted) is the next active state. Once acceptance arrives
// with a definitive decision, stage 4 flips done and stage 5 becomes current.
function deriveCurrentStage(lead: CaseAdvancementLead, acceptance: CaseAdvancementAcceptance | null): number {
  const s = lead.status;
  if (s === 'retained') return 6;
  if (s === 'fee_quoted') return 7;
  if (acceptance?.decision === 'accepted') return 5;
  if (s === 'sent_for_attorney_review') return 4;
  if (s === 'intake_complete' || (lead.intake_completed && !lead.sent_for_review)) return 3;
  if (s === 'consultation_complete' || s === 'intake_in_progress') return 2;
  if (s === 'consultation_scheduled') return 2;
  if (s === 'contacted') return 1;
  if (s === 'new') return 1;
  // Terminal off-paths (declined / no_case / no_show) — don't highlight a stage.
  return 0;
}

function statusFor(stageId: number, currentStage: number): StageStatus {
  if (currentStage === 0) return 'pending';
  if (stageId < currentStage) return 'done';
  if (stageId === currentStage) return 'current';
  return 'pending';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CaseAdvancementStatusBar({
  lead, acceptance,
}: {
  lead: CaseAdvancementLead;
  acceptance: CaseAdvancementAcceptance | null;
}) {
  const current = deriveCurrentStage(lead, acceptance);

  const stages: Stage[] = [
    {
      id: 1,
      label: 'Scheduled',
      caption: fmtDate(lead.consultation_date),
      status: statusFor(1, current),
    },
    {
      id: 2,
      label: 'Intake in process',
      // Per spec: LAST UPDATE timestamp.
      caption: `Last update: ${fmtTimestamp(lead.last_contact_at)}`,
      status: statusFor(2, current),
    },
    {
      id: 3,
      // The spec calls this one stage with two sub-events ("Intake completed
      // → Submitted to attorney"). Both lean on `sent_for_review_at` until
      // intake_completed_at is wired.
      label: 'Intake completed → Submitted to attorney',
      caption: fmtTimestamp(lead.sent_for_review_at),
      status: statusFor(3, current),
    },
    {
      id: 4,
      label: 'Case accepted',
      caption: acceptance?.decision === 'accepted'
        ? fmtTimestamp(acceptance.decided_at)
        : '—',
      status: statusFor(4, current),
    },
    {
      id: 5,
      label: 'Case presented or scheduled for presentation',
      // TODO: no presentation_scheduled_at / presented_at fields exist on
      // intake_leads or attorney_case_acceptances today. Render "—" until
      // the schema captures these. When the column lands, replace the
      // following line with fmtTimestamp(lead.presented_at ?? lead.presentation_scheduled_at).
      caption: '— (presentation timestamp not wired)',
      status: statusFor(5, current),
    },
    {
      id: 6,
      label: 'Retained',
      caption: fmtTimestamp(lead.retained_at),
      status: statusFor(6, current),
    },
    {
      id: 7,
      label: 'Fee quoted, pending client acceptance / FU scheduled',
      // Per spec: LAST FU date.
      // TODO: the follow-up cadence + escalation RULES live in the Staff
      // Settings supervisor framework, configured by a supervisor or
      // superuser — not built here. This caption just surfaces the most
      // recent next_follow_up_at the lead row already carries.
      caption: `Last FU: ${fmtTimestamp(lead.next_follow_up_at)}`,
      status: statusFor(7, current),
    },
  ];

  return (
    <div className="bg-[#0d1221] border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Case advancement
        </p>
        <span className="text-[10px] uppercase tracking-widest text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
          client-visible
        </span>
      </div>

      <div className="flex flex-wrap gap-x-2 gap-y-3">
        {stages.map((s, idx) => {
          const tone =
            s.status === 'done'    ? { ring: 'border-emerald-500/40 bg-emerald-500/8',  label: 'text-emerald-200', caption: 'text-emerald-300/80', dot: 'text-emerald-400' } :
            s.status === 'current' ? { ring: 'border-amber-500/50 bg-amber-500/10',     label: 'text-amber-200',   caption: 'text-amber-300/80',   dot: 'text-amber-400' } :
                                     { ring: 'border-slate-800 bg-slate-900/30',        label: 'text-slate-500',   caption: 'text-slate-600',      dot: 'text-slate-700' };
          return (
            <div key={s.id} className="flex items-start gap-2 flex-1 min-w-[160px]">
              <div className={`rounded-xl border px-3 py-2 w-full ${tone.ring}`}>
                <div className="flex items-center gap-2 mb-1">
                  {s.status === 'done'
                    ? <CheckCircle2 size={12} className={tone.dot} />
                    : s.status === 'current'
                      ? <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-50 animate-ping" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
                        </span>
                      : <Circle size={12} className={tone.dot} />}
                  <span className="text-[9px] font-mono text-slate-500">{idx + 1}</span>
                  <p className={`text-[10px] font-bold uppercase tracking-widest leading-snug ${tone.label}`}>
                    {s.label}
                  </p>
                </div>
                <p className={`text-[10.5px] leading-snug ${tone.caption}`}>
                  {s.status === 'pending' && !s.caption.startsWith('—') ? '—' : s.caption}
                </p>
                {s.status === 'current' && (
                  <p className="mt-1 text-[9px] uppercase tracking-widest text-amber-400 font-bold">
                    <Clock className="inline w-2.5 h-2.5 mr-0.5" />
                    current
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] text-slate-500 italic leading-relaxed">
        Status stages are client-visible; internal staff log entries below are not.
        {' '}TODO Phase B: persistence for stage 5 (presentation timestamps) and the
        supervisor-configured follow-up cadence rules for stage 7.
      </p>
    </div>
  );
}
