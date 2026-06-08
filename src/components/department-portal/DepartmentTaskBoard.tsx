// Shared department task board.
//
// Mirrors the Intake Portal dashboard's "Up Next & Outreach Queue" structure
// (UpNextCard + tier-tagged queue rows) so Legal and Accounting present the
// same task-management shape. The only thing that differs across portals is
// which tasks belong to which user_type — that mapping is a SCAFFOLD passed
// in via `tasksByUserType`.
//
// SCAFFOLD scope:
//   - Task lists are stub placeholders, not pulled from any table.
//   - "Mark done" / "Skip" / "Choose another" exist as UI affordances only;
//     they update local state in this component, do not call any backend.
//   - The real per-user-type task config will be defined alongside the planned
//     staff-setup model. Until that lands, callers pass static stubs scoped
//     per user_type so each role still sees a representative queue.
//
// NO DB writes from this component.

import { useMemo, useState } from "react";
import {
  CheckCircle2, ChevronRight, ListChecks, Sparkles, AlertCircle, X,
} from "lucide-react";
import type { DepartmentPortalSession } from "./DepartmentPortalLogin";

// ─── Public types ────────────────────────────────────────────────────────────

export type TaskTier = "urgent" | "today" | "queue";

export interface TaskStub {
  id: string;
  title: string;
  context: string;
  tier: TaskTier;
}

export interface TaskStubGroup {
  /** Optional override for the "Up Next" card (else the top queue row is used). */
  upNext?: TaskStub | null;
  queue: TaskStub[];
}

export interface DepartmentTaskBoardProps {
  session: DepartmentPortalSession;
  /** Stub task config keyed by user_type. Missing keys render an empty state. */
  tasksByUserType: Record<string, TaskStubGroup>;
  /** Accent color for the Up Next card border + chip (defaults to gold). */
  accent?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DepartmentTaskBoard({
  session, tasksByUserType, accent = "#B8945F",
}: DepartmentTaskBoardProps) {
  const group = tasksByUserType[session.user_type];
  const queue = group?.queue ?? [];

  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(() => new Set());
  const [manualUpNextId, setManualUpNextId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const visibleQueue = useMemo(
    () => queue.filter(t => !completedIds.has(t.id)),
    [queue, completedIds]
  );

  const upNext = useMemo<TaskStub | null>(() => {
    if (manualUpNextId) {
      const t = visibleQueue.find(x => x.id === manualUpNextId);
      if (t) return t;
    }
    // Urgent always wins, even when skipped.
    const urgent = visibleQueue.find(t => t.tier === "urgent");
    if (urgent) return urgent;
    // Otherwise, the first non-skipped queue row.
    const next = visibleQueue.find(t => !skippedIds.has(t.id));
    return next ?? group?.upNext ?? null;
  }, [visibleQueue, manualUpNextId, skippedIds, group?.upNext]);

  function markDone(id: string) {
    const next = new Set(completedIds);
    next.add(id);
    setCompletedIds(next);
    if (manualUpNextId === id) setManualUpNextId(null);
  }
  function skip(id: string) {
    const next = new Set(skippedIds);
    next.add(id);
    setSkippedIds(next);
    if (manualUpNextId === id) setManualUpNextId(null);
  }

  return (
    <div className="rounded-xl border border-[#2A2A28] bg-[#1A1A18]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2A2A28]">
        <span style={{ color: accent }}><ListChecks className="w-4 h-4" /></span>
        <h3 className="text-sm font-semibold text-[#FAFAF7]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
          Up Next & Task Queue
        </h3>
        {visibleQueue.length > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-[#2A2A28] text-[#FAFAF7] border-[#3A3A36]">
            {visibleQueue.length}
          </span>
        )}
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-2 py-0.5 rounded">
          Scaffold
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Banner — make the scaffold-ness obvious. */}
        <div className="rounded-lg border border-dashed border-[#3A3A36] bg-[#0F0F0E] px-3 py-2">
          <p className="text-[11px] text-[#6B6B66] leading-relaxed">
            <span className="font-semibold text-[#FAFAF7]">{session.user_type}</span> · placeholder queue.
            The real per-user-type task config lands with the planned staff-setup model — these rows are illustrative only.
          </p>
        </div>

        {/* Up Next card */}
        {upNext ? (
          <UpNextCard
            task={upNext}
            accent={accent}
            onDone={() => markDone(upNext.id)}
            onSkip={upNext.tier === "urgent" ? null : () => skip(upNext.id)}
            onChoose={() => setPickerOpen(o => !o)}
            pickerOpen={pickerOpen}
            queue={visibleQueue}
            onPick={(id) => { setManualUpNextId(id); setPickerOpen(false); }}
            onClosePicker={() => setPickerOpen(false)}
          />
        ) : (
          <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <p className="text-xs text-[#FAFAF7]">
              {queue.length === 0
                ? "No tasks configured for this user type yet."
                : "All caught up — nothing up next right now."}
            </p>
          </div>
        )}

        {/* Queue */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] px-1 mb-1.5">
            To do
          </p>
          {visibleQueue.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-[#6B6B66] italic">No outstanding tasks.</p>
          ) : (
            <ul className="space-y-1.5">
              {visibleQueue.map(t => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onDone={() => markDone(t.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Up Next + queue row ─────────────────────────────────────────────────────

function UpNextCard({
  task, accent, onDone, onSkip, onChoose, pickerOpen, queue, onPick, onClosePicker,
}: {
  task: TaskStub;
  accent: string;
  onDone: () => void;
  onSkip: (() => void) | null;
  onChoose: () => void;
  pickerOpen: boolean;
  queue: TaskStub[];
  onPick: (id: string) => void;
  onClosePicker: () => void;
}) {
  const isUrgent = task.tier === "urgent";
  const border = isUrgent ? "border-red-700/60" : "border-[#B8945F]/30";
  const bg = isUrgent ? "bg-red-950/30" : "bg-[#0F0F0E]";

  return (
    <div className={`rounded-lg border ${border} ${bg} px-4 py-3`}>
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: accent }}>
          {isUrgent ? "Up Next — urgent" : "Up Next"}
        </p>
        <span className="ml-auto"><TierChip tier={task.tier} /></span>
      </div>

      <div className="flex items-start gap-3 mt-2">
        {isUrgent
          ? <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          : <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: accent }} />}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[#FAFAF7] truncate">{task.title}</p>
          <p className="text-[10px] text-[#6B6B66] truncate mt-0.5">{task.context}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={onDone}
          className="flex items-center gap-1.5 text-[#0F0F0E] font-bold text-xs px-3 py-1.5 rounded transition-colors"
          style={{ background: accent }}
        >
          <CheckCircle2 className="w-3 h-3" /> Mark done
        </button>
        <div className="flex items-center gap-3 ml-auto">
          {onSkip && (
            <button onClick={onSkip} className="text-[11px] text-[#6B6B66] hover:text-[#FAFAF7] transition-colors">
              Skip
            </button>
          )}
          <button
            onClick={onChoose}
            className={`text-[11px] transition-colors ${pickerOpen ? "text-[#FAFAF7]" : "text-[#6B6B66] hover:text-[#FAFAF7]"}`}
          >
            {pickerOpen ? "Close" : "Choose another"}
          </button>
        </div>
      </div>

      {pickerOpen && (
        queue.length === 0 ? (
          <div className="mt-2 rounded border border-[#2A2A28] bg-[#1A1A18] px-3 py-2 text-[11px] text-[#6B6B66] italic">
            No alternatives in the queue.
          </div>
        ) : (
          <div className="mt-2 rounded border border-[#2A2A28] bg-[#1A1A18] max-h-48 overflow-y-auto">
            <div className="flex items-center px-3 py-1.5 border-b border-[#2A2A28]">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66]">Pick a task</span>
              <button onClick={onClosePicker} className="ml-auto text-[#6B6B66] hover:text-[#FAFAF7]">
                <X className="w-3 h-3" />
              </button>
            </div>
            <ul>
              {queue.map(t => (
                <li key={t.id}>
                  <button
                    onClick={() => onPick(t.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2A2A28] transition-colors"
                  >
                    <TierDot tier={t.tier} />
                    <span className="text-xs text-[#FAFAF7] truncate flex-1">{t.title}</span>
                    <TierChip tier={t.tier} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  );
}

function TaskRow({ task, onDone }: { task: TaskStub; onDone: () => void }) {
  return (
    <li className="rounded-lg border border-transparent hover:border-[#2A2A28] transition-colors">
      <div className="flex items-center gap-3 px-3 py-2">
        <TierDot tier={task.tier} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#FAFAF7] truncate">{task.title}</p>
          <p className="text-[10px] text-[#6B6B66] truncate">{task.context}</p>
        </div>
        <TierChip tier={task.tier} />
        <button
          onClick={onDone}
          className="flex items-center gap-1 text-[11px] font-semibold text-[#B8945F] hover:text-[#FAFAF7] border border-[#B8945F]/40 hover:border-[#B8945F] px-2 py-1 rounded transition-colors"
        >
          <CheckCircle2 className="w-3 h-3" /> Done
        </button>
        <ChevronRight className="w-3 h-3 text-[#3A3A36]" />
      </div>
    </li>
  );
}

function TierDot({ tier }: { tier: TaskTier }) {
  const color =
    tier === "urgent" ? "bg-red-500" :
    tier === "today"  ? "bg-amber-500" :
                        "bg-[#3A3A36]";
  return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color}`} />;
}

function TierChip({ tier }: { tier: TaskTier }) {
  const cfg = {
    urgent: { label: "Urgent",   cls: "bg-red-900/40 text-red-300 border-red-700/60" },
    today:  { label: "Today",    cls: "bg-amber-900/30 text-amber-300 border-amber-700/60" },
    queue:  { label: "Queue",    cls: "bg-[#2A2A28] text-[#6B6B66] border-[#3A3A36]" },
  }[tier];
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Stub catalog — placeholder tasks per user type ──────────────────────────
//
// These are intentionally generic (no client names, no IDs) so it is clear at
// a glance that the queue is a scaffold. Swap to a real source once the
// staff-setup model defines per-user-type tasks.

/**
 * Legal department stub tasks, keyed by user_type returned by
 * classifyLegalStaff in DepartmentPortalLogin.tsx.
 */
export const LEGAL_TASK_STUBS: Record<string, TaskStubGroup> = {
  "Paralegal": {
    queue: [
      { id: "stub-pl-1", title: "Review document checklist for upcoming filing", context: "Schedules A–J completeness", tier: "today" },
      { id: "stub-pl-2", title: "Reconcile creditor matrix",                      context: "After client uploads creditor letter",  tier: "queue" },
      { id: "stub-pl-3", title: "Prep means-test inputs",                          context: "Quarterly CMI refresh",                 tier: "queue" },
    ],
  },
  "Attorney": {
    queue: [
      { id: "stub-att-1", title: "Sign engagement letter",            context: "Pending paralegal handoff",       tier: "today" },
      { id: "stub-att-2", title: "Review case file before consult",   context: "Confirms eligibility narrative",  tier: "queue" },
      { id: "stub-att-3", title: "Approve fee proposal",                context: "Returns to intake when signed",  tier: "queue" },
    ],
  },
  "Supervising Attorney": {
    queue: [
      { id: "stub-sup-1", title: "Resolve escalation from intake",     context: "Routing surface not yet wired",   tier: "urgent" },
      { id: "stub-sup-2", title: "Approve attorney fee deviation",     context: "Discount > policy threshold",     tier: "today" },
      { id: "stub-sup-3", title: "Sign off on weekly review report",    context: "End-of-week paralegal queue",     tier: "queue" },
    ],
  },
};

/**
 * Accounting department stub tasks, keyed by user_type returned by
 * classifyAccountingStaff. The Manager bucket isn't wired in classifyStaff
 * yet (no DB column to distinguish) but its stub list lives here so it's
 * trivial to enable once the staff-setup model adds the sub-role.
 */
export const ACCOUNTING_TASK_STUBS: Record<string, TaskStubGroup> = {
  "Accounting Admin": {
    queue: [
      { id: "stub-aa-1", title: "Reconcile weekly payments",          context: "PayCompass + LawPay imports",           tier: "today" },
      { id: "stub-aa-2", title: "Process autopay retry queue",        context: "After failed-payment notifications",    tier: "queue" },
      { id: "stub-aa-3", title: "Send next-installment reminders",     context: "Clients due in the next 3 days",        tier: "queue" },
    ],
  },
  "Accounting Manager": {
    queue: [
      { id: "stub-am-1", title: "Approve batch trust transfer",       context: "Pending IOLTA signoff",                 tier: "urgent" },
      { id: "stub-am-2", title: "Sign off on filed-case registry",    context: "Verified case numbers + balances",      tier: "today" },
      { id: "stub-am-3", title: "Review collections escalations",     context: "Cancel requests > 14 days outstanding", tier: "queue" },
    ],
  },
};
