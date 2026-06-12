// Ch.13 Plan Portal — three-step touchpoint scaffold for a confirmed Ch.13 case.
//
// Steps (sequential, per the spec):
//   1. Paralegal Signing Review (internal)
//   2. Attorney Pre-Signing       (attorney-only)
//   3. Client Signing             (client-facing)
//
// Today: scaffold only. Each step renders a "Coming in V2" body with a
// local-state status chip (Not started / In progress / Complete). No
// persistence, no RLS, no audit yet.
//
// IMPORTANT non-lawyer rule (per spec): non-lawyers must NEVER see
// "Attorney Review" labeling. They get the existing case-advancement
// STATUS BAR only — a compact read-only progression with neutral labels
// that doesn't expose the attorney-side touchpoint. The component
// branches on `isLawyer` to choose between the full three-tab editor
// and the slim status bar.

import { useState } from "react";
import {
  CheckCircle2, Clock, ChevronRight, Users, Gavel, UserCheck,
} from "lucide-react";

export type Ch13PlanStep = "paralegal" | "attorney_pre_signing" | "client_signing";
export type Ch13PlanStatus = "not_started" | "in_progress" | "complete";

export interface Ch13PlanPortalProps {
  /** True when the viewer is a lawyer. Non-lawyers see the slim
   *  case-advancement status bar only — no "Attorney Review" labels. */
  isLawyer: boolean;
}

const STEP_LABELS_LAWYER: Record<Ch13PlanStep, string> = {
  paralegal:            "Paralegal Signing Review",
  attorney_pre_signing: "Attorney Pre-Signing",
  client_signing:       "Client Signing",
};

// Non-lawyer-facing labels — sanitized of "Attorney Review" wording.
const STEP_LABELS_NEUTRAL: Record<Ch13PlanStep, string> = {
  paralegal:            "Plan preparation",
  attorney_pre_signing: "Firm review",
  client_signing:       "Client signing",
};

const STEP_ICONS: Record<Ch13PlanStep, React.FC<{ className?: string }>> = {
  paralegal:            Users,
  attorney_pre_signing: Gavel,
  client_signing:       UserCheck,
};

const STATUS_LABEL: Record<Ch13PlanStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete:    "Complete",
};

const STATUS_TONE: Record<Ch13PlanStatus, string> = {
  not_started: "bg-slate-800 text-slate-400 border-slate-700",
  in_progress: "bg-sky-900/40 text-sky-300 border-sky-600/40",
  complete:    "bg-emerald-900/40 text-emerald-300 border-emerald-600/40",
};

export default function Ch13PlanPortal({ isLawyer }: Ch13PlanPortalProps) {
  const [statuses, setStatuses] = useState<Record<Ch13PlanStep, Ch13PlanStatus>>({
    paralegal:            "not_started",
    attorney_pre_signing: "not_started",
    client_signing:       "not_started",
  });
  const [active, setActive] = useState<Ch13PlanStep>("paralegal");

  // Non-lawyer view — slim status bar only. No tabs, no attorney labels.
  if (!isLawyer) {
    return <StatusBar statuses={statuses} />;
  }

  const ActiveIcon = STEP_ICONS[active];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <p className="text-sm font-bold text-white mb-1">Ch. 13 Plan Portal</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Three sequential touchpoints. Each step exposes the work that paralegal, attorney,
          and client need to complete before plan confirmation. Status persistence ships in V2.
        </p>
      </div>

      {/* Step tabs */}
      <nav className="flex items-center gap-1 overflow-x-auto pb-1">
        {(Object.keys(STEP_LABELS_LAWYER) as Ch13PlanStep[]).map((step, idx) => {
          const Icon = STEP_ICONS[step];
          const isActive = step === active;
          const status = statuses[step];
          return (
            <button
              key={step}
              type="button"
              onClick={() => setActive(step)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-slate-800 border-sky-500/40 text-white"
                  : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
              }`}
            >
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold">
                {idx + 1}
              </span>
              <Icon className="w-3.5 h-3.5" />
              {STEP_LABELS_LAWYER[step]}
              <span className={`ml-1 inline-flex items-center text-[9px] uppercase tracking-widest border rounded-full px-1.5 py-0.5 ${STATUS_TONE[status]}`}>
                {STATUS_LABEL[status]}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Active step body */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <ActiveIcon className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white">{STEP_LABELS_LAWYER[active]}</h3>
          </div>
          <StatusEditor
            current={statuses[active]}
            onChange={next => setStatuses(prev => ({ ...prev, [active]: next }))}
          />
        </div>
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-6 text-center">
          <p className="text-xs text-slate-500 leading-relaxed">
            <strong className="text-slate-400">Coming in V2.</strong> The {STEP_LABELS_LAWYER[active].toLowerCase()}
            {" "}body lands with the Ch.13 plan-portal V2 build — checklist + sign-off rows persisted to the
            case record + audit-logged through the existing review pipeline.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusBar({ statuses }: { statuses: Record<Ch13PlanStep, Ch13PlanStatus> }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Case progress</p>
      <ol className="flex items-center gap-2 flex-wrap">
        {(Object.keys(STEP_LABELS_NEUTRAL) as Ch13PlanStep[]).map((step, idx) => {
          const status = statuses[step];
          const Icon = STEP_ICONS[step];
          return (
            <li key={step} className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-semibold ${STATUS_TONE[status]}`}
              >
                {status === "complete"
                  ? <CheckCircle2 className="w-3 h-3" />
                  : status === "in_progress"
                  ? <Clock className="w-3 h-3" />
                  : <Icon className="w-3 h-3" />}
                {STEP_LABELS_NEUTRAL[step]}
              </span>
              {idx < 2 && <ChevronRight className="w-3 h-3 text-slate-600" />}
            </li>
          );
        })}
      </ol>
      <p className="text-[10px] text-slate-500 italic mt-3">
        You'll be notified when the firm completes each step. No further action required from you
        until client signing.
      </p>
    </div>
  );
}

function StatusEditor({ current, onChange }: { current: Ch13PlanStatus; onChange: (s: Ch13PlanStatus) => void }) {
  return (
    <div className="inline-flex gap-1">
      {(["not_started", "in_progress", "complete"] as Ch13PlanStatus[]).map(s => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
            s === current
              ? STATUS_TONE[s]
              : "bg-slate-900/40 border-slate-800 text-slate-500 hover:text-white"
          }`}
        >
          {STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}
