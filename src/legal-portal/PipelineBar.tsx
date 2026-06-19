// PipelineBar — 14-stage / 4-phase + Exception + Client-prep parallel
// track. Visual port of <Pipeline> in docs/design/legal-portal-reference.jsx
// (lines 289–346).
//
// SUB-PHASE 1 SCOPE: visual component + props surface. Renders only when
// the caller passes a non-null `activeKey`. 6 STUBBED post-petition
// stages (legalPortalTokens.STUBBED_STAGES) render inactive — grayed
// icon, hover tooltip "not yet wired" — with NO fake data behind them.
//
// Wired by sub-phase 2 (Queue) — sub-phase 1 mounts this component but
// does not yet derive a real `activeKey` from the queue selection.
// Test rendering manually by passing `activeKey="paralegal"` etc.

import { useMemo } from "react";
import { CheckCircle2, Clock, ChevronRight, AlertCircle } from "lucide-react";
import {
  c, PHASES, STAGES, STAGE_BY_KEY, SCHEDULE_IDX, STUBBED_STAGES,
  type StageKey,
} from "./legalPortalTokens";

export interface PipelineBarProps {
  /** Current stage. `null` = no active case → component returns null. */
  activeKey: StageKey | null;
  /** Show the Exception lane (post-petition issue). Default false. */
  postPetition?: boolean;
  /** Show the Client-prep parallel track (CC + filing fee). Default true.
   *  Pre-Schedule it shows as pending; from Schedule onward, complete. */
  showClientPrep?: boolean;
}

export default function PipelineBar({
  activeKey,
  postPetition = false,
  showClientPrep = true,
}: PipelineBarProps) {
  // No active case → render nothing. Sub-phase 1 default state.
  if (!activeKey) return null;

  const activeIdx = useMemo(
    () => STAGES.findIndex((s) => s.key === activeKey),
    [activeKey],
  );

  // Unknown stage key: treat as no Pipeline (defensive — derive function
  // should never return an unknown key, but this keeps render safe).
  if (activeIdx === -1) return null;

  const prepDone = activeIdx >= SCHEDULE_IDX;

  return (
    <div className="w-full overflow-x-auto" style={{ background: c.ink }}>
      <div className="flex items-end px-5 pt-2 gap-3 min-w-max">
        {PHASES.map((phase, pi) => {
          const stages = STAGES.filter((s) => s.phase === phase);
          const phaseActive = stages.some((s) => s.key === activeKey);
          return (
            <div key={phase} className="flex items-end">
              <div>
                <div
                  className="text-[10px] font-bold uppercase px-1 pb-1"
                  style={{
                    color: phaseActive ? c.tealLine : "rgba(255,255,255,0.4)",
                    letterSpacing: "0.14em",
                  }}
                >
                  {phase}
                </div>
                <div className="flex items-center gap-1">
                  {stages.map((s) => {
                    const idx = STAGES.findIndex((x) => x.key === s.key);
                    const done = idx < activeIdx;
                    const active = idx === activeIdx;
                    const stubbed = STUBBED_STAGES.has(s.key);
                    const Icon = s.icon;

                    // Stubbed-stage visual: grayed icon + label, with
                    // "not yet wired" tooltip. NEVER show fake data — if
                    // the stub is rendered active, it still renders with
                    // the inactive-stub treatment (defense-in-depth).
                    const showAsActive  = active && !stubbed;
                    const showAsDone    = done   && !stubbed;
                    const showAsStubbed = stubbed && !showAsActive && !showAsDone;

                    return (
                      <div
                        key={s.key}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5"
                        style={{
                          background: showAsActive
                            ? c.teal
                            : showAsDone
                              ? "rgba(255,255,255,0.10)"
                              : "transparent",
                          opacity: showAsStubbed ? 0.55 : 1,
                          outline: showAsStubbed
                            ? "1px dashed rgba(255,255,255,0.18)"
                            : "none",
                        }}
                        title={stubbed ? "Not yet wired — post-petition schema pending" : undefined}
                      >
                        <Icon
                          size={14}
                          style={{
                            color: showAsActive
                              ? "#fff"
                              : showAsDone
                                ? c.tealLine
                                : "rgba(255,255,255,0.4)",
                          }}
                        />
                        <span
                          className="text-xs font-semibold whitespace-nowrap"
                          style={{
                            color: showAsActive
                              ? "#fff"
                              : showAsDone
                                ? "rgba(255,255,255,0.8)"
                                : "rgba(255,255,255,0.4)",
                          }}
                        >
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {pi < PHASES.length - 1 && (
                <div
                  className="w-px self-stretch mx-1 mt-4"
                  style={{ background: "rgba(255,255,255,0.18)" }}
                />
              )}
            </div>
          );
        })}

        {/* Exception lane — post-petition issue. */}
        {postPetition && (
          <div className="flex items-end">
            <div className="w-px self-stretch mx-1 mt-4" style={{ background: "rgba(255,255,255,0.18)" }} />
            <div>
              <div
                className="text-[10px] font-bold uppercase px-1 pb-1"
                style={{ color: c.amberLine, letterSpacing: "0.14em" }}
              >
                Exception
              </div>
              <div
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5"
                style={{ background: c.amber }}
                title="Post-petition issue — pending closure"
              >
                <AlertCircle size={14} color="#fff" />
                <span className="text-xs font-semibold whitespace-nowrap text-white">
                  Post-petition issue · pending closure
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Client-prep parallel track (Credit counseling + Filing fee).
          Prompted at submission; gates scheduling. */}
      {showClientPrep && (
        <div className="flex items-center gap-2 px-5 py-2 min-w-max">
          <span
            className="text-[10px] font-bold uppercase"
            style={{ color: "rgba(255,255,255,0.45)", letterSpacing: "0.14em" }}
          >
            Client prep (since submission)
          </span>
          {["Credit counseling", "Filing fee"].map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{
                background: prepDone ? "rgba(14,156,122,0.25)" : "rgba(194,104,15,0.22)",
                color: prepDone ? c.tealLine : c.amberLine,
              }}
            >
              {prepDone ? <CheckCircle2 size={12} /> : <Clock size={12} />} {t}
            </span>
          ))}
          <ChevronRight size={13} style={{ color: "rgba(255,255,255,0.35)" }} />
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
            required before scheduling
          </span>
        </div>
      )}
    </div>
  );
}

// Re-export so callers can use the stage helpers without two imports.
export { STAGE_BY_KEY };
