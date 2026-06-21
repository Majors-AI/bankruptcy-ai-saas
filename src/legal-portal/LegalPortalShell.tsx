// LegalPortalShell — outer chrome for the unified department portal.
//
// Companion to functional-readme §1 (Shared Department Shell):
//   "One parameterized shell for Intake / Legal / Accounting (do NOT
//    restyle Accounting). Persistent left nav + top menu across all
//    pages in the department."
//
// D1 directive #1: every department unified on a 220px labeled sidebar
// (replaces the 56px icon-only UtilityRail from sub-phase 1). Accounting
// is OUT — keeps its bespoke layout per spec.
//
// Composition: R1 header (logo + breadcrumb + role-tab pill +
// right-action slot + session info) · R2 Pipeline bar (when a case is
// active) · left Sidebar (220px labeled) · body slot.
//
// Receives ALL state from the caller (LegalDepartmentPortal /
// LegalAdminPortal); the shell itself is presentational.

import type { ReactNode } from "react";
import { LogOut, ScrollText, ChevronLeft } from "lucide-react";
import { c, type LegalRole, type StageKey } from "./legalPortalTokens";

// Chrome theme — D1 fix. Legal Department's body uses the light
// legalPortalTokens palette and matches `theme="light"`. The Intake
// portal (LegalAdminPortal) body is hardcoded dark (#090e1a / #0d1221)
// pending a full restyle, so its shell renders with `theme="dark"` to
// avoid a white-chrome-over-dark-content mismatch. Inner panels still
// own their own surfaces; this only recolors header + sidebar + outer
// wrap.
export type ShellTheme = "light" | "dark";

export interface ShellPalette {
  paper: string; bg: string; ink: string;
  line: string; slate: string; slateLight: string;
  /** Brand-logo square background — kept dark in both themes for icon
   *  contrast against the white scroll glyph. */
  brandSquare: string;
}

export const PALETTES: Record<ShellTheme, ShellPalette> = {
  light: {
    paper:       c.paper,
    bg:          c.bg,
    ink:         c.ink,
    line:        c.line,
    slate:       c.slate,
    slateLight:  c.slateLight,
    brandSquare: c.ink,
  },
  dark: {
    paper:       "#0d1221",
    bg:          "#090e1a",
    ink:         "#FAFAF7",
    line:        "#1e293b",
    slate:       "#94a3b8",
    slateLight:  "#64748b",
    brandSquare: "#1e293b",
  },
};
import RoleTabs from "./RoleTabs";
// UtilityRail (56px icon rail) replaced by Sidebar (220px labeled) per
// D1 unified-layout directive. Old file kept in tree for backward refs
// but no longer mounted by the shell.
import Sidebar from "./Sidebar";
import {
  DEFAULT_RAIL_ENTRIES,
  type RailEntry,
  type RailGateContext,
} from "./railEntries";
import PipelineBar from "./PipelineBar";

export interface SessionBadge {
  /** Display name of the signed-in staff member. */
  name: string;
  /** PIN-gate classifier label (e.g., "Paralegal", "Attorney"). */
  userType: string;
  /** Sign-out callback. */
  onSignOut: () => void;
}

export interface CaseBreadcrumb {
  /** Client name shown in the header breadcrumb. */
  clientName: string;
  /** Sub-text under the client name (e.g., "Chapter 7 · District of Arizona"). */
  subline?: string;
  /** Click handler for "Queue" back-link. */
  onBackToQueue: () => void;
}

export interface LegalPortalShellProps {
  /** Current role tab. Required when `showRoleTabs` is true (default). */
  role?: LegalRole;
  onRoleChange?: (next: LegalRole) => void;
  /** Whether the Paralegal/Attorney/Client role-tab pill renders. Legal
   *  Department uses it (true, default). Intake doesn't have that
   *  concept (false). */
  showRoleTabs?: boolean;

  /** Current Pipeline stage. `null` = no case selected → Pipeline hidden. */
  activeStage: StageKey | null;
  /** Post-petition exception lane visibility. */
  postPetition?: boolean;

  /** Sidebar entries + gate context + active key + click handler.
   *  Per D1 directive #1, the unified 220px labeled sidebar replaces
   *  the prior 56px icon-only rail. Entry shape unchanged. */
  railEntries?: ReadonlyArray<RailEntry>;
  railCtx: RailGateContext;
  railActiveKey?: string | null;
  onRailSelect: (entry: RailEntry) => void;

  /** Header session badge + sign-out. */
  session: SessionBadge;

  /** Optional case breadcrumb (sub-phase 2+: shown when in a case). */
  breadcrumb?: CaseBreadcrumb;

  /** Department label rendered at the top of the sidebar (e.g.,
   *  "Intake Portal", "Legal Department"). Falls through to the
   *  "Case review" subtitle in the top-left brand block when omitted. */
  departmentLabel?: string;
  /** Brand subtitle in the top-left next to "Bankruptcy.AI". Defaults
   *  to "Case review"; Intake passes "Intake portal", etc. */
  brandSubtitle?: string;
  /** Optional right-action slot in the header. Used by Intake's
   *  "New Client Lead" / "Refresh" / "Admin tools" buttons. Renders
   *  between the role tabs and the session badge. */
  headerActions?: ReactNode;

  /** Chrome theme — default "light" (Legal Department). Intake passes
   *  "dark" so the shell matches the dark portal body. */
  theme?: ShellTheme;

  /** Body content — the active section's panel. */
  children: ReactNode;
}

export default function LegalPortalShell({
  role,
  onRoleChange,
  showRoleTabs = true,
  activeStage,
  postPetition = false,
  railEntries = DEFAULT_RAIL_ENTRIES,
  railCtx,
  railActiveKey = null,
  onRailSelect,
  session,
  breadcrumb,
  departmentLabel,
  brandSubtitle = "Case review",
  headerActions,
  theme = "light",
  children,
}: LegalPortalShellProps) {
  const p = PALETTES[theme];
  // Defensive: when role-tabs are requested but the caller didn't pass a
  // role + onRoleChange, fall back to a stable no-op. Prevents undefined-
  // function crashes in the rare case of misconfigured caller.
  const effectiveRole: LegalRole = role ?? "paralegal";
  const effectiveRoleChange = onRoleChange ?? (() => undefined);
  return (
    <div
      className="w-full min-h-screen flex flex-col"
      style={{
        background: p.bg,
        color: p.ink,
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      {/* ── R1 Header ─────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ background: p.paper, borderBottom: `1px solid ${p.line}` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="rounded-lg flex items-center justify-center shrink-0"
            style={{ width: 34, height: 34, background: p.brandSquare }}
          >
            <ScrollText size={18} color="#fff" />
          </div>
          <div className="shrink-0">
            <div className="text-sm font-bold leading-tight" style={{ color: p.ink }}>
              Bankruptcy.AI
            </div>
            <div className="text-xs leading-tight" style={{ color: p.slateLight }}>
              {brandSubtitle}
            </div>
          </div>

          {breadcrumb ? (
            <>
              <div className="h-8 w-px mx-2 shrink-0" style={{ background: p.line }} />
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={breadcrumb.onBackToQueue}
                  className="flex items-center gap-1 text-sm font-semibold shrink-0"
                  style={{ color: p.slate }}
                >
                  <ChevronLeft size={16} /> Queue
                </button>
                <div className="h-8 w-px shrink-0" style={{ background: p.line }} />
                <div className="min-w-0">
                  <div
                    className="text-sm font-semibold leading-tight truncate"
                    style={{ color: p.ink }}
                  >
                    {breadcrumb.clientName}
                  </div>
                  {breadcrumb.subline && (
                    <div className="text-xs leading-tight" style={{ color: p.slate }}>
                      {breadcrumb.subline}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : showRoleTabs ? (
            <>
              <div className="h-8 w-px mx-2 shrink-0" style={{ background: p.line }} />
              <div className="text-sm font-semibold" style={{ color: p.slate }}>
                {effectiveRole === "client" ? "Client portal preview" : "Case queue"}
              </div>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {showRoleTabs && (
            <RoleTabs role={effectiveRole} onChange={effectiveRoleChange} />
          )}
          {headerActions && (
            <>
              {showRoleTabs && <div className="h-8 w-px shrink-0" style={{ background: p.line }} />}
              <div className="flex items-center gap-2">{headerActions}</div>
            </>
          )}
          <div className="h-8 w-px shrink-0" style={{ background: p.line }} />
          <div className="text-right">
            <p className="text-xs font-semibold leading-none" style={{ color: p.ink }}>
              {session.name}
            </p>
            <p className="text-[10px] mt-1" style={{ color: p.slateLight }}>
              {session.userType}
            </p>
          </div>
          <button
            type="button"
            onClick={session.onSignOut}
            title="Sign out"
            className="flex items-center gap-1.5 text-xs font-semibold rounded px-2.5 py-1.5 transition-colors"
            style={{ color: p.slate, border: `1px solid ${p.line}` }}
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </header>

      {/* ── R2 Pipeline bar (hidden when no case selected) ────────── */}
      <PipelineBar activeKey={activeStage} postPetition={postPetition} />

      {/* ── Body: 220px labeled sidebar + active section ────────────── */}
      <div className="flex-1 min-h-0 flex">
        <Sidebar
          entries={railEntries}
          ctx={railCtx}
          activeKey={railActiveKey}
          onSelect={onRailSelect}
          departmentLabel={departmentLabel}
          identity={{ name: session.name, roleLabel: session.userType }}
          theme={theme}
        />
        <main className="flex-1 min-w-0 overflow-y-auto">
          {showRoleTabs && effectiveRole === "client" ? (
            <ClientPreviewPlaceholder />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

// Sub-phase 1 placeholder for the Client portal preview tab. The real
// client portal lives in App.tsx's `dashboard` view (ClientDashboard);
// surfacing it inside the staff-facing legal portal is sub-phase 5
// scope. Until then, a placeholder makes the tab non-broken.
function ClientPreviewPlaceholder() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div
        className="rounded-xl p-8"
        style={{ background: c.paper, border: `1px solid ${c.line}` }}
      >
        <p
          className="text-[10px] font-bold uppercase mb-2"
          style={{ color: c.slateLight, letterSpacing: "0.14em" }}
        >
          Client portal preview
        </p>
        <h2 className="text-xl font-bold mb-2" style={{ color: c.ink }}>
          Lands in sub-phase 5
        </h2>
        <p className="text-sm" style={{ color: c.slate }}>
          The client-portal preview tab will surface the real client
          dashboard (to-do list / timeline / safety advisory) reshaped to
          match the reference layout. Today, switch to the client app at
          its own route to see it in production form.
        </p>
      </div>
    </div>
  );
}
