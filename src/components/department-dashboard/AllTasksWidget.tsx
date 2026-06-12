// AllTasksWidget — color-coded shared task list (LEFT column).
//
// Extracted from IntakeDashboard.tsx (Prompt 54). Behavior preserved
// exactly. The widget renders the same task pool the host derives; it
// does NOT know how that pool was assembled (today: appointments +
// unread messages + RED/ORANGE/YELLOW/BLUE leads from the Intake host
// — but the type is generic, so an Accounting / Legal host can pass
// a differently-sourced TaskEntry[] without touching this file).

import { useMemo } from "react";
import { ListChecks, CalendarDays } from "lucide-react";
import type { TaskColor, TaskEntry } from "./types";
import { Card, CountBadge, EmptyHint, ColorTag, ColorDot, DueLine } from "./primitives";

export interface AllTasksWidgetProps {
  tasks: TaskEntry[];
  /** Total count of tasks in the firm-wide shared pool — used by the
   *  scope toggle to surface "Shared (N)" so the staffer knows what
   *  they're hiding when in "Mine" mode. */
  sharedCount: number;
  mode: "tasks" | "schedule";
  onChangeMode: (m: "tasks" | "schedule") => void;
  /** "mine" → tasks owned by the signed-in staffer (or unassigned);
   *  "shared" → firm-wide pool. Defaults to "mine" at the host. */
  scope: "mine" | "shared";
  onChangeScope: (s: "mine" | "shared") => void;
  /** Routes to the per-staffer "My Tasks" page. */
  onOpenMyTasks?: () => void;
}

export function AllTasksWidget({
  tasks, sharedCount, mode, onChangeMode, scope, onChangeScope, onOpenMyTasks,
}: AllTasksWidgetProps) {
  // Bucket counts per color for the header chip cluster.
  const counts = useMemo(() => {
    const c: Record<TaskColor, number> = { red: 0, orange: 0, yellow: 0, blue: 0 };
    for (const t of tasks) c[t.color]++;
    return c;
  }, [tasks]);

  return (
    <Card className="flex flex-col">
      <div className="px-4 py-3 border-b border-[#2A2A28]">
        <div className="flex items-center gap-2">
          <span className="text-[#B8945F]"><ListChecks className="w-4 h-4" /></span>
          <h3 className="text-sm font-semibold text-[#FAFAF7]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            Upcoming Tasks
          </h3>
          <CountBadge value={tasks.length} />
          {onOpenMyTasks && (
            <button
              onClick={onOpenMyTasks}
              title="Open your full task page — resolved + outstanding + work metrics"
              className="ml-auto text-[10px] font-semibold text-[#B8945F] hover:text-[#FAFAF7] transition-colors"
            >
              My Tasks →
            </button>
          )}
        </div>
        <LeftModeToggle mode={mode} onChangeMode={onChangeMode} />
        <TaskScopeToggle scope={scope} onChangeScope={onChangeScope} sharedCount={sharedCount} mineCount={tasks.length} />
        <div className="flex items-center gap-2 mt-2">
          <ColorTag color="red"    count={counts.red} />
          <ColorTag color="orange" count={counts.orange} />
          <ColorTag color="yellow" count={counts.yellow} />
          <ColorTag color="blue"   count={counts.blue} />
        </div>
        <p className="text-[10px] text-[#6B6B66] italic mt-2 leading-snug">
          {scope === "mine"
            ? "My queue · leads assigned to you + unassigned (visible to anyone)."
            : "Shared queue · firm-wide pool."}
        </p>
      </div>
      <div className="p-3 overflow-y-auto" style={{ maxHeight: 720 }}>
        {tasks.length === 0 ? (
          <EmptyHint>All clear — no open tasks in the shared queue.</EmptyHint>
        ) : (
          <ul className="space-y-1">
            {tasks.map(t => (
              <li key={t.id}>
                <button
                  onClick={t.onSelect}
                  className="w-full text-left flex items-start gap-2 px-2 py-1.5 rounded hover:bg-[#2A2A28] border border-transparent hover:border-[#2A2A28] transition-colors"
                  title={t.actionLabel}
                >
                  <ColorDot color={t.color} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#FAFAF7] truncate">{t.title}</p>
                    <p className="text-[10px] text-[#6B6B66] truncate mt-0.5">{t.subtitle}</p>
                    <DueLine due={t.due} />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#B8945F] flex-shrink-0 mt-0.5">
                    {t.actionLabel}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export function LeftModeToggle({ mode, onChangeMode }: { mode: "tasks" | "schedule"; onChangeMode: (m: "tasks" | "schedule") => void }) {
  return (
    <div className="flex items-center gap-1 mt-2 rounded border border-[#2A2A28] p-0.5 bg-[#0F0F0E]">
      <button
        onClick={() => onChangeMode("tasks")}
        className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded transition-colors ${
          mode === "tasks" ? "bg-[#2A2A28] text-[#FAFAF7]" : "text-[#6B6B66] hover:text-[#FAFAF7]"
        }`}
      >
        <ListChecks className="w-3 h-3" /> Upcoming Tasks
      </button>
      <button
        onClick={() => onChangeMode("schedule")}
        className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded transition-colors ${
          mode === "schedule" ? "bg-[#2A2A28] text-[#FAFAF7]" : "text-[#6B6B66] hover:text-[#FAFAF7]"
        }`}
      >
        <CalendarDays className="w-3 h-3" /> See my schedule
      </button>
    </div>
  );
}

export function TaskScopeToggle({
  scope, onChangeScope, sharedCount, mineCount,
}: {
  scope: "mine" | "shared";
  onChangeScope: (s: "mine" | "shared") => void;
  sharedCount: number;
  mineCount: number;
}) {
  return (
    <div className="flex items-center gap-1 mt-2 rounded border border-[#2A2A28] p-0.5 bg-[#0F0F0E]">
      <button
        onClick={() => onChangeScope("mine")}
        title="Only tasks assigned to you (plus unassigned)"
        className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded transition-colors ${
          scope === "mine" ? "bg-[#2A2A28] text-[#FAFAF7]" : "text-[#6B6B66] hover:text-[#FAFAF7]"
        }`}
      >
        My tasks · {mineCount}
      </button>
      <button
        onClick={() => onChangeScope("shared")}
        title="Firm-wide pool — every active staffer's tasks"
        className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded transition-colors ${
          scope === "shared" ? "bg-[#2A2A28] text-[#FAFAF7]" : "text-[#6B6B66] hover:text-[#FAFAF7]"
        }`}
      >
        Shared pool · {sharedCount}
      </button>
    </div>
  );
}
