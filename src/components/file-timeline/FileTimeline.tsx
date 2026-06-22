// FileTimeline — Change 7 / Phase 1: presentational SHELL only.
//
// Goal (Change 7): on an individual file/record view, render one
// continuous timeline/stepper spanning the LEAD lifecycle (Change 1) and
// the MATTER progression (Change 6) — first contact → ready-to-file —
// reading from the two underlying status fields without merging them.
// Presentation only; no third status field, no logic change.
//
// PHASE 1 STATUS: SHELL. The lead-lifecycle half is wired up against the
// `LifecycleStatus` enum in src/lib/leadLifecycle.ts. The matter-
// progression half is a placeholder — Change 6 hasn't landed yet, so the
// matter-progression enum + the schema column it reads from
// (`intake_leads.matter_progression`, see docs/schema-changes-for-canelo.md
// §1) are stubbed here. When Change 6 lands:
//   • Replace MATTER_PROGRESSION_STUB with the canonical
//     MatterProgression enum + label/description tables (likely a sibling
//     src/lib/matterProgression.ts following the leadLifecycle.ts pattern).
//   • Wire `matterProgression` prop into the real column read.
// The shell renders correctly today regardless of Phase 6's status — the
// matter half collapses to "Not yet handed off" until handoff_to_legal.
//
// The component is intentionally minimal: a stepper with current/done/upcoming
// states and a labeled "Handed off to Legal" milestone at the boundary.
// Styling matches the existing tailwind dark-mode pattern across the app
// (slate-900 backgrounds, amber for active, emerald for done, slate-600
// for upcoming, rose for terminal lost/disqualified).
//
// Consumers (Phase 2+): the per-record file view (lead detail / matter
// detail) renders <FileTimeline … />. Until then, this component is
// importable but not yet placed.

import React from "react";
import {
  ACTIVE_LIFECYCLE_ORDER,
  LIFECYCLE_LABELS,
  LIFECYCLE_DESCRIPTIONS,
  isTerminalLifecycle,
  resolveLifecycle,
  type LifecycleStatus,
} from "../../lib/leadLifecycle";

// ─── Matter-progression stub ────────────────────────────────────────────────
// PHASE-1 PLACEHOLDER. Replace with the real enum from
// src/lib/matterProgression.ts when Change 6 lands.

export const MATTER_PROGRESSION_STUB = [
  "submitted_to_paralegal",
  "in_draft_review",
  "submitted_to_attorney",
  "attorney_approved",
  "options_consult",
  "scheduling",
  "ready_to_proceed",
] as const;

export type MatterProgressionStub = (typeof MATTER_PROGRESSION_STUB)[number];

const MATTER_LABELS_STUB: Readonly<Record<MatterProgressionStub, string>> = {
  submitted_to_paralegal: "Paralegal review",
  in_draft_review:        "In draft review",
  submitted_to_attorney:  "Attorney review",
  attorney_approved:      "Attorney approved",
  options_consult:        "Options consult",
  scheduling:             "Scheduling",
  ready_to_proceed:       "Ready to proceed",
};

const MATTER_DESCRIPTIONS_STUB: Readonly<Record<MatterProgressionStub, string>> = {
  submitted_to_paralegal: "File submitted; CCC in parallel.",
  in_draft_review:        "AI-assisted paralegal drafting in progress.",
  submitted_to_attorney:  "Submitted to attorney for case review.",
  attorney_approved:      "Attorney approved; ready for options consult.",
  options_consult:        "Reviewing options with the client.",
  scheduling:             "Scheduling signing / filing.",
  ready_to_proceed:       "Ready to proceed to filing.",
};

// ─── Props ──────────────────────────────────────────────────────────────────

export interface FileTimelineProps {
  /** The lead row OR a row that carries the same two status fields. */
  lead: {
    lifecycle_status?: string | null;
    status?: string | null;
    /** Matter progression (Change 6 column). Optional until Phase 6 lands. */
    matter_progression?: string | null;
  };
  /** Optional title rendered above the timeline (e.g. the client name). */
  title?: string;
  /** When set, suppress the help text below the stepper (compact mode). */
  compact?: boolean;
}

// ─── Step state ─────────────────────────────────────────────────────────────

type StepState = "done" | "current" | "upcoming" | "terminal";

interface Step {
  key: string;
  label: string;
  description: string;
  state: StepState;
  /** True for the synthetic "Handed off to Legal" milestone — rendered
   *  with a distinct visual treatment (boundary marker, not a step). */
  isHandoffMilestone?: boolean;
}

// ─── Stepper assembly ───────────────────────────────────────────────────────

function buildSteps(
  lifecycle: LifecycleStatus,
  matterProgression: MatterProgressionStub | null,
): Step[] {
  const steps: Step[] = [];

  // Terminal early-exit: lost / disqualified close the timeline.
  if (isTerminalLifecycle(lifecycle)) {
    // Show the active history up to where it died, then a single terminal cap.
    for (const ls of ACTIVE_LIFECYCLE_ORDER) {
      steps.push({
        key: `lead:${ls}`,
        label: LIFECYCLE_LABELS[ls],
        description: LIFECYCLE_DESCRIPTIONS[ls],
        state: "upcoming",
      });
    }
    steps.push({
      key: `lead:${lifecycle}`,
      label: LIFECYCLE_LABELS[lifecycle],
      description: LIFECYCLE_DESCRIPTIONS[lifecycle],
      state: "terminal",
    });
    return steps;
  }

  // Active lead half — every step before the current is `done`, the
  // current step is `current`, everything after is `upcoming`.
  const lifecycleIdx = ACTIVE_LIFECYCLE_ORDER.indexOf(lifecycle);
  ACTIVE_LIFECYCLE_ORDER.forEach((ls, i) => {
    let state: StepState;
    if (lifecycleIdx === -1) state = "upcoming";
    else if (i < lifecycleIdx) state = "done";
    else if (i === lifecycleIdx) state = "current";
    else state = "upcoming";
    steps.push({
      key: `lead:${ls}`,
      label: LIFECYCLE_LABELS[ls],
      description: LIFECYCLE_DESCRIPTIONS[ls],
      state,
    });
  });

  // Boundary milestone — only meaningful once the matter half is reachable.
  // The handoff_to_legal step itself is the last lifecycle step; we
  // annotate it in the matter half as well so the boundary is visually
  // clear. Rendered as a labeled milestone, not a step.
  const handoffDone = lifecycleIdx >= ACTIVE_LIFECYCLE_ORDER.indexOf("handoff_to_legal");
  steps.push({
    key: "milestone:handoff_to_legal",
    label: "Handed off to Legal",
    description: "Matter intake opened; legal team takes over.",
    state: handoffDone ? "done" : "upcoming",
    isHandoffMilestone: true,
  });

  // Matter-progression half — stubbed until Change 6 lands. The progression
  // column is null until handoff; if it's set, mark up to that point as done
  // and the rest upcoming. (No "current" indicator on the stub side — the
  // real component supplied by Change 6 will draw the current step itself.)
  const matterIdx = matterProgression
    ? MATTER_PROGRESSION_STUB.indexOf(matterProgression)
    : -1;
  MATTER_PROGRESSION_STUB.forEach((mp, i) => {
    let state: StepState;
    if (matterIdx === -1) state = "upcoming";
    else if (i < matterIdx) state = "done";
    else if (i === matterIdx) state = "current";
    else state = "upcoming";
    steps.push({
      key: `matter:${mp}`,
      label: MATTER_LABELS_STUB[mp],
      description: MATTER_DESCRIPTIONS_STUB[mp],
      state,
    });
  });

  return steps;
}

// ─── Render ─────────────────────────────────────────────────────────────────

export default function FileTimeline({ lead, title, compact }: FileTimelineProps) {
  const lifecycle = resolveLifecycle(lead);
  const matterRaw = lead.matter_progression;
  const matterProgression =
    matterRaw != null && (MATTER_PROGRESSION_STUB as ReadonlyArray<string>).includes(matterRaw)
      ? (matterRaw as MatterProgressionStub)
      : null;

  const steps = buildSteps(lifecycle, matterProgression);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      {title && (
        <h3 className="text-sm font-bold text-slate-200 mb-3 tracking-tight">{title}</h3>
      )}

      <ol className="flex flex-wrap items-stretch gap-x-1 gap-y-3" aria-label="File timeline">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          return (
            <React.Fragment key={step.key}>
              <li className="flex flex-col items-start min-w-[110px] flex-1">
                <StepDot state={step.state} isMilestone={step.isHandoffMilestone} />
                <div className="mt-1.5">
                  <p
                    className={`text-[10px] font-bold uppercase tracking-widest ${
                      step.state === "current"
                        ? "text-amber-300"
                        : step.state === "done"
                          ? "text-emerald-300"
                          : step.state === "terminal"
                            ? "text-rose-300"
                            : "text-slate-500"
                    }`}
                  >
                    {step.label}
                  </p>
                  {!compact && (
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug max-w-[170px]">
                      {step.description}
                    </p>
                  )}
                </div>
              </li>
              {!isLast && <StepConnector previousState={step.state} />}
            </React.Fragment>
          );
        })}
      </ol>

      {/* Phase-1 disclosure: matter-progression half is a stub. */}
      <p className="text-[10px] text-slate-600 italic mt-4 leading-snug">
        Lead lifecycle is wired live. Matter progression renders against a
        placeholder until Change 6 lands — at which point this shell reads
        the canonical matter-progression module without any changes here.
      </p>
    </div>
  );
}

// ─── Bits ───────────────────────────────────────────────────────────────────

function StepDot({ state, isMilestone }: { state: StepState; isMilestone?: boolean }) {
  if (isMilestone) {
    return (
      <span
        aria-hidden
        className={`inline-flex items-center justify-center w-5 h-5 rounded-sm border ${
          state === "done"
            ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
            : "bg-slate-800/60 border-slate-600 text-slate-500"
        }`}
      >
        <span className="text-[10px] font-bold">⇲</span>
      </span>
    );
  }
  const cls =
    state === "done"
      ? "bg-emerald-500 border-emerald-400"
      : state === "current"
        ? "bg-amber-400 border-amber-300 ring-2 ring-amber-400/30"
        : state === "terminal"
          ? "bg-rose-500 border-rose-400"
          : "bg-slate-800 border-slate-700";
  return <span aria-hidden className={`inline-block w-3 h-3 rounded-full border ${cls}`} />;
}

function StepConnector({ previousState }: { previousState: StepState }) {
  const cls =
    previousState === "done"
      ? "bg-emerald-600/70"
      : previousState === "terminal"
        ? "bg-rose-700/40"
        : "bg-slate-700";
  return (
    <li aria-hidden className="flex-1 self-center h-0.5 min-w-[20px] mt-[-22px]">
      <div className={`h-0.5 ${cls}`} />
    </li>
  );
}
