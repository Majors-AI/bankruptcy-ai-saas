// Sidebar — 220px labeled left nav for the unified department shell.
//
// Companion to functional-readme §1 (Shared Department Shell):
//   "One parameterized shell for Intake / Legal / Accounting (do NOT
//    restyle Accounting). Persistent left nav + top menu across all
//    pages in the department."
//
// Replaces the 56px icon-only `UtilityRail` from sub-phase 1. Same
// entries (railEntries.ts), labeled rendering. Used by both Legal and
// Intake portals — they're now visually consistent per D1 directive #1
// ("Unify EVERY department on ONE layout — the labeled 220px sidebar").
//
// Component-ONLY file — Fast Refresh safe. Types + default entries
// continue to live in railEntries.ts (which never imported a component).

import { c } from "./legalPortalTokens";
import { type RailEntry, type RailGateContext } from "./railEntries";

// Sidebar mirrors LegalPortalShell's theme so the Intake portal (dark
// body) doesn't render a white sidebar against dark content. Light is
// the default and matches the Legal Department palette exactly.
export type SidebarTheme = "light" | "dark";

const SIDEBAR_PALETTES: Record<SidebarTheme, {
  paper: string; bg: string; ink: string; line: string;
  slate: string; slateLight: string;
}> = {
  light: {
    paper:      c.paper,
    bg:         c.bg,
    ink:        c.ink,
    line:       c.line,
    slate:      c.slate,
    slateLight: c.slateLight,
  },
  dark: {
    paper:      "#0d1221",
    bg:         "#16213a",
    ink:        "#FAFAF7",
    line:       "#1e293b",
    slate:      "#94a3b8",
    slateLight: "#64748b",
  },
};

export interface SidebarProps {
  entries: ReadonlyArray<RailEntry>;
  ctx: RailGateContext;
  /** Currently-selected entry key (visual highlight). */
  activeKey?: string | null;
  onSelect: (entry: RailEntry) => void;
  /** Optional staff identity block above the entries (department-portal
   *  pattern — name + role label). When omitted no block renders. */
  identity?: {
    name: string;
    roleLabel: string;
  } | null;
  /** Department label rendered at the very top (e.g., "Intake Portal",
   *  "Legal Department"). Optional. */
  departmentLabel?: string | null;
  /** Chrome theme — must match the LegalPortalShell's theme prop. */
  theme?: SidebarTheme;
}

export default function Sidebar({
  entries,
  ctx,
  activeKey = null,
  onSelect,
  identity = null,
  departmentLabel = null,
  theme = "light",
}: SidebarProps) {
  const sp = SIDEBAR_PALETTES[theme];
  // Filter entries by role-gate. Visibility-side only; per-action role
  // checks still apply inside destination panels.
  const visible = entries.filter((e) => !e.gate || e.gate(ctx));

  return (
    <aside
      className="hidden lg:flex flex-col shrink-0"
      style={{
        width: 220,
        borderRight: `1px solid ${sp.line}`,
        background: sp.paper,
      }}
      aria-label="Department portal sidebar"
    >
      {departmentLabel && (
        <div
          className="px-5 pt-4 pb-2"
          style={{ borderBottom: `1px solid ${sp.line}` }}
        >
          <p
            className="text-[10px] font-bold uppercase"
            style={{ color: sp.slateLight, letterSpacing: "0.14em" }}
          >
            {departmentLabel}
          </p>
        </div>
      )}

      {identity && (
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${sp.line}` }}>
          <div className="flex items-center gap-2.5">
            <div
              className="rounded-md flex items-center justify-center shrink-0"
              style={{ width: 28, height: 28, background: sp.bg }}
            >
              <span
                className="text-xs font-semibold"
                style={{ color: sp.ink }}
              >
                {identity.name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("")}
              </span>
            </div>
            <div className="min-w-0">
              <p
                className="text-xs font-semibold leading-tight truncate"
                style={{ color: sp.ink }}
              >
                {identity.name}
              </p>
              <p
                className="text-[10px] mt-0.5 leading-tight"
                style={{ color: sp.slateLight }}
              >
                {identity.roleLabel}
              </p>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-2">
        {visible.map((e) => {
          const Icon = e.icon;
          const active = e.key === activeKey;
          return (
            <button
              key={e.key}
              type="button"
              onClick={() => onSelect(e)}
              title={e.label}
              className="w-full flex items-center gap-2.5 px-5 py-2 text-left transition-colors"
              style={{
                background: active
                  ? (theme === "dark" ? "rgba(14,156,122,0.12)" : c.bgWarm)
                  : "transparent",
                borderLeft: active ? `2px solid ${c.teal}` : "2px solid transparent",
              }}
            >
              <Icon
                size={15}
                style={{ color: active ? c.teal : sp.slateLight }}
              />
              <span
                className="text-sm truncate flex-1"
                style={{
                  color: active ? sp.ink : sp.slate,
                  fontWeight: active ? 600 : 500,
                }}
              >
                {e.label}
              </span>
              {e.badge != null && e.badge !== 0 && (
                <span
                  className="text-[10px] font-bold shrink-0"
                  style={{ color: active ? c.teal : sp.slateLight }}
                >
                  {e.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
