// Shared primitives used by the department-dashboard module.
//
// Hoisted from IntakeDashboard.tsx during Slice-1 (Prompt 54). Each
// component is a verbatim copy of the version that lived in the Intake
// host — same className strings, same DOM, same conditional rendering.
// Behavior must not drift.

import type { ReactNode } from "react";
import type { TaskColor } from "./types";
import { formatDueLabel } from "./time";

// ─── Card chrome ───────────────────────────────────────────────────────────

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[#2A2A28] bg-[#1A1A18] ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  icon, title, badge, chip,
}: { icon: ReactNode; title: string; badge?: ReactNode; chip?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2A2A28]">
      <span className="text-[#B8945F]">{icon}</span>
      <h3 className="text-sm font-semibold text-[#FAFAF7]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        {title}
      </h3>
      {badge}
      {chip && <div className="ml-auto">{chip}</div>}
    </div>
  );
}

export function CountBadge({ value, tone = "neutral" }: { value: number; tone?: "neutral" | "warn" | "danger" }) {
  if (value <= 0) return null;
  const cls =
    tone === "danger" ? "bg-red-900/40 text-red-300 border-red-700/60" :
    tone === "warn"   ? "bg-amber-900/30 text-amber-300 border-amber-700/60" :
                         "bg-[#2A2A28] text-[#FAFAF7] border-[#3A3A36]";
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>{value}</span>
  );
}

export function SampleChip() {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#B8945F] border border-[#B8945F]/40 px-2 py-0.5 rounded">
      Sample — not yet connected
    </span>
  );
}

export function ComingSoonChip() {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-2 py-0.5 rounded">
      Coming soon
    </span>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="px-3 py-2 text-[11px] text-[#6B6B66] italic">{children}</p>;
}

// ─── Task color metadata (used by ColorTag, ColorDot, OverviewBubble) ──────

export const COLOR_CFG: Record<TaskColor, { label: string; dot: string; chip: string }> = {
  red:    { label: "Hot",    dot: "bg-red-500",    chip: "bg-red-900/40 text-red-300 border-red-700/60" },
  orange: { label: "Mid",    dot: "bg-orange-400", chip: "bg-orange-900/30 text-orange-300 border-orange-700/60" },
  yellow: { label: "Present", dot: "bg-yellow-400", chip: "bg-yellow-900/30 text-yellow-300 border-yellow-700/60" },
  blue:   { label: "Sched",  dot: "bg-sky-400",    chip: "bg-sky-900/30 text-sky-300 border-sky-700/60" },
};

export function ColorTag({ color, count }: { color: TaskColor; count: number }) {
  const cfg = COLOR_CFG[color];
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cfg.chip}`}>
      {cfg.label} · {count}
    </span>
  );
}

export function ColorDot({ color }: { color: TaskColor }) {
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${COLOR_CFG[color].dot}`} />;
}

export function DueLine({ due }: { due: string | null | undefined }) {
  if (due) {
    const overdue = new Date(due).getTime() < Date.now();
    return (
      <p className={`text-[10px] mt-0.5 font-mono ${overdue ? "text-red-300" : "text-[#B8945F]"}`}>
        Due {formatDueLabel(due)}
      </p>
    );
  }
  // No due value on the underlying record. Render a faint placeholder so the
  // user sees a column-aligned "—" rather than nothing — and we DO NOT make
  // up a date.
  // TODO Phase B: every task surface should carry its own due (next_follow_up_at
  // for leads is wired; client_message_threads needs a reply-SLA column before
  // those rows can show a real due here).
  return (
    <p className="text-[10px] mt-0.5 text-[#3A3A36] italic" title="No due date on this record yet">
      No due set
    </p>
  );
}

// ─── Performance / Goals bubble primitives ─────────────────────────────────

export function PlaceholderValue({ title, children }: { title: string; children: ReactNode }) {
  return (
    <span className="text-sm font-mono text-[#6B6B66] italic" title={title}>
      {children}
    </span>
  );
}

export function CompactStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-[9px] text-[#6B6B66] uppercase tracking-widest flex-1 truncate">{label}</dt>
      <dd className="text-[11px] font-mono text-[#FAFAF7]">{value}</dd>
    </div>
  );
}

export function BubbleCard({
  title, icon, scaffold, children,
}: {
  title: string;
  icon: ReactNode;
  scaffold?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#2A2A28] bg-[#1A1A18] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[#B8945F]">{icon}</span>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[#FAFAF7]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
          {title}
        </h3>
        {scaffold && (
          <span className="ml-auto text-[9px] font-semibold uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-1.5 py-0.5 rounded">
            Scaffold
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

