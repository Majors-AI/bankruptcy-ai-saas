// LeadsByMonthChart — Prompt 88.
//
// Honest bar graph of leads grouped by created_at. Two modes:
//   - "annual"  → 12 monthly buckets for the selected year.
//   - "monthly" → daily buckets (1–31) for the selected month.
// A date switcher (◂ ▸) shifts the selection by year or month.
//
// Recharts was named as available in the prompt brief but isn't installed
// in this project (no package.json entry, nothing in node_modules). To
// avoid adding a runtime dependency in a no-commit-no-SQL slice, the bars
// are rendered as flex divs sized by the tallest bucket. Behavior is the
// same as a recharts BarChart on a single series and the layout is easy
// to swap to recharts later (one props seam: the `buckets` array).
//
// Empty-period rule: if the selected period has zero leads, the chart
// renders an honest "No leads in this period" hint instead of a fabricated
// number. Driven entirely off the leads prop (intake_leads.created_at).

import { useMemo, useState } from "react";
import { BarChart2, ChevronLeft, ChevronRight } from "lucide-react";

// Minimal lead shape — only the field the chart reads. Stays decoupled
// from the host's full Lead interface so this file doesn't need a
// cross-module type dependency.
export interface LeadByMonthRow {
  created_at: string;
}

const MONTH_LABELS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LABELS_LONG  = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Mode = "annual" | "monthly";

export default function LeadsByMonthChart({ leads }: { leads: LeadByMonthRow[] }) {
  const now = new Date();
  const [mode, setMode] = useState<Mode>("annual");
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth()); // 0–11

  const { buckets, labels, total, periodLabel } = useMemo(() => {
    if (mode === "annual") {
      const counts = new Array<number>(12).fill(0);
      for (const l of leads) {
        if (!l.created_at) continue;
        const d = new Date(l.created_at);
        if (Number.isNaN(d.getTime())) continue;
        if (d.getFullYear() === year) counts[d.getMonth()]++;
      }
      return {
        buckets: counts,
        labels: MONTH_LABELS_SHORT,
        total: counts.reduce((a, b) => a + b, 0),
        periodLabel: String(year),
      };
    }
    // monthly — days of selected month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const counts = new Array<number>(daysInMonth).fill(0);
    for (const l of leads) {
      if (!l.created_at) continue;
      const d = new Date(l.created_at);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getFullYear() === year && d.getMonth() === month) {
        counts[d.getDate() - 1]++;
      }
    }
    return {
      buckets: counts,
      labels: counts.map((_, i) => String(i + 1)),
      total: counts.reduce((a, b) => a + b, 0),
      periodLabel: `${MONTH_LABELS_LONG[month]} ${year}`,
    };
  }, [leads, mode, year, month]);

  const maxVal = Math.max(1, ...buckets);

  function shift(delta: number) {
    if (mode === "annual") {
      setYear(y => y + delta);
      return;
    }
    // monthly — roll over month/year boundary cleanly
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  // Sparser X-axis tick labels in monthly mode so 28–31 numbers don't pile
  // up. Show 1, 5, 10, 15, 20, 25, last-day.
  function showTickLabel(i: number): boolean {
    if (mode === "annual") return true;
    const day = i + 1;
    return day === 1 || day === 5 || day === 10 || day === 15 || day === 20 || day === 25 || day === buckets.length;
  }

  return (
    <div className="bg-[#0d1221] border border-slate-800 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <h3 className="text-sm font-semibold text-white">
            Leads by {mode === "annual" ? "Month" : "Day"}
          </h3>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest tabular-nums">
            {total} total
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-[#0F0F0E] border border-slate-800 rounded p-0.5">
            <button
              onClick={() => setMode("annual")}
              className={`text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded transition-colors ${
                mode === "annual" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-white"
              }`}
            >
              Annual
            </button>
            <button
              onClick={() => setMode("monthly")}
              className={`text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded transition-colors ${
                mode === "monthly" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-white"
              }`}
            >
              Monthly
            </button>
          </div>

          {/* Date switcher */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => shift(-1)}
              aria-label={mode === "annual" ? "Previous year" : "Previous month"}
              className="p-1 rounded border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-white tabular-nums min-w-[8ch] text-center">
              {periodLabel}
            </span>
            <button
              onClick={() => shift(1)}
              aria-label={mode === "annual" ? "Next year" : "Next month"}
              className="p-1 rounded border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bars (or empty state) */}
      {total === 0 ? (
        <p className="text-[11px] text-slate-500 italic py-8 text-center">
          No leads in {periodLabel}.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-end gap-1 h-32">
            {buckets.map((count, i) => {
              const heightPct = (count / maxVal) * 100;
              const isEmpty = count === 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end min-w-0">
                  <div
                    className={`w-full rounded-t transition-colors ${
                      isEmpty
                        ? "bg-slate-800/40"
                        : "bg-sky-500/70 hover:bg-sky-400"
                    }`}
                    style={{ height: `${heightPct}%`, minHeight: isEmpty ? "2px" : "4px" }}
                    title={`${labels[i]}: ${count} lead${count === 1 ? "" : "s"}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-start gap-1">
            {buckets.map((_, i) => (
              <div key={i} className="flex-1 text-center min-w-0">
                <span className="text-[9px] text-slate-500 tabular-nums">
                  {showTickLabel(i) ? labels[i] : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-600 italic leading-snug">
        From <span className="text-slate-400">intake_leads.created_at</span>.
        {/* TODO BAN-84 — once the contacted/SMS-sent timestamps land we can
            offer a "contacted" overlay alongside the created bars. */}
      </p>
    </div>
  );
}
