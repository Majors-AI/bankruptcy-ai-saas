// Signing Review shell — header + four-tab layout shared between the
// Ch.7 and Ch.13 Signing Review surfaces.
//
// Tabs (per PROMPT 17 spec): Eligibility/Summary, Issues, All Answers,
// Decision. Children supply the content for each tab as ReactNode; the
// shell handles the chrome (title, tab strip, active-tab routing).
//
// Today the Ch.13 surface is the first consumer. The existing Ch.7
// surface keeps its current layout for risk reduction; it can adopt
// this shell in a follow-up without changing the public route.

import { useState, type ReactNode } from "react";
import {
  CheckCircle2, AlertTriangle, ClipboardList, Gavel, FileText,
} from "lucide-react";

export type ReviewTabKey =
  | "eligibility_summary"
  | "issues"
  | "all_answers"
  | "decision";

export interface ReviewShellTab {
  key: ReviewTabKey;
  label: string;
  /** Optional count badge (e.g. number of issues). */
  count?: number;
  /** When true, the tab renders but disables interaction (used for the
   *  attorney-only Decision tab when the viewer isn't a lawyer). */
  locked?: boolean;
  /** Tab body. */
  body: ReactNode;
}

export interface ReviewShellProps {
  /** Page title — e.g. "Ch. 13 Signing Review Portal". */
  title: string;
  /** Optional subtitle line below the title. */
  subtitle?: string;
  /** Status chip rendered on the right side of the header. */
  statusChip?: ReactNode;
  /** Four tabs — supply at least the Eligibility/Summary entry. */
  tabs: ReadonlyArray<ReviewShellTab>;
  /** Optional default-active tab key. Defaults to the first tab. */
  defaultTab?: ReviewTabKey;
}

const TAB_ICONS: Record<ReviewTabKey, React.FC<{ className?: string }>> = {
  eligibility_summary: ClipboardList,
  issues:              AlertTriangle,
  all_answers:         FileText,
  decision:            Gavel,
};

export default function ReviewShell({
  title, subtitle, statusChip, tabs, defaultTab,
}: ReviewShellProps) {
  const initial = defaultTab ?? tabs[0]?.key ?? "eligibility_summary";
  const [active, setActive] = useState<ReviewTabKey>(initial);

  const activeTab = tabs.find(t => t.key === active) ?? tabs[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-screen-xl mx-auto px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-sky-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight truncate">{title}</p>
              {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
            </div>
          </div>
          {statusChip && <div className="flex items-center gap-2">{statusChip}</div>}
        </div>

        {/* Tab strip */}
        <nav className="max-w-screen-xl mx-auto px-3 flex items-center gap-1 overflow-x-auto">
          {tabs.map(t => {
            const Icon = TAB_ICONS[t.key];
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => !t.locked && setActive(t.key)}
                disabled={t.locked}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  isActive
                    ? "border-sky-400 text-white"
                    : "border-transparent text-slate-400 hover:text-white hover:border-slate-600"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                {typeof t.count === "number" && t.count > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Body */}
      <main className="max-w-screen-xl mx-auto px-5 py-6">
        {activeTab?.body ?? null}
      </main>
    </div>
  );
}
