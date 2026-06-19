// LegalPortalShell — outer chrome for the restyled Legal Department
// Portal. Sub-phase 1 of the restyle plan in
// docs/design/legal-portal-function-mapping.md §11.
//
// Composition: R1 header (logo + breadcrumb + role-tab pill + session
// info) · R2 Pipeline bar (when a case is active) · left UtilityRail ·
// body slot for the active section's content.
//
// Receives ALL state from the caller (LegalDepartmentPortal); the shell
// itself is presentational. Behavioral changes from sub-phase 2 onward
// (Queue → case workspace) come via prop changes, not shell-internal
// state.

import type { ReactNode } from "react";
import { LogOut, ScrollText, ChevronLeft } from "lucide-react";
import { c, type LegalRole, type StageKey } from "./legalPortalTokens";
import RoleTabs from "./RoleTabs";
import UtilityRail from "./UtilityRail";
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
  /** Current role tab. */
  role: LegalRole;
  onRoleChange: (next: LegalRole) => void;

  /** Current Pipeline stage. `null` = no case selected → Pipeline hidden. */
  activeStage: StageKey | null;
  /** Post-petition exception lane visibility. */
  postPetition?: boolean;

  /** Rail entries + gate context + active key + click handler. */
  railEntries?: ReadonlyArray<RailEntry>;
  railCtx: RailGateContext;
  railActiveKey?: string | null;
  onRailSelect: (entry: RailEntry) => void;

  /** Header session badge + sign-out. */
  session: SessionBadge;

  /** Optional case breadcrumb (sub-phase 2+: shown when in a case). */
  breadcrumb?: CaseBreadcrumb;

  /** Body content — the legacy section's panel (LegalDashboard /
   *  ParalegalReview / SigningReview / FileCabinet / Placeholder). */
  children: ReactNode;
}

export default function LegalPortalShell({
  role,
  onRoleChange,
  activeStage,
  postPetition = false,
  railEntries = DEFAULT_RAIL_ENTRIES,
  railCtx,
  railActiveKey = null,
  onRailSelect,
  session,
  breadcrumb,
  children,
}: LegalPortalShellProps) {
  return (
    <div
      className="w-full min-h-screen flex flex-col"
      style={{
        background: c.bg,
        color: c.ink,
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      {/* ── R1 Header ─────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ background: c.paper, borderBottom: `1px solid ${c.line}` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="rounded-lg flex items-center justify-center shrink-0"
            style={{ width: 34, height: 34, background: c.ink }}
          >
            <ScrollText size={18} color="#fff" />
          </div>
          <div className="shrink-0">
            <div className="text-sm font-bold leading-tight" style={{ color: c.ink }}>
              Bankruptcy.AI
            </div>
            <div className="text-xs leading-tight" style={{ color: c.slateLight }}>
              Case review
            </div>
          </div>

          {breadcrumb ? (
            <>
              <div className="h-8 w-px mx-2 shrink-0" style={{ background: c.line }} />
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={breadcrumb.onBackToQueue}
                  className="flex items-center gap-1 text-sm font-semibold shrink-0"
                  style={{ color: c.slate }}
                >
                  <ChevronLeft size={16} /> Queue
                </button>
                <div className="h-8 w-px shrink-0" style={{ background: c.line }} />
                <div className="min-w-0">
                  <div
                    className="text-sm font-semibold leading-tight truncate"
                    style={{ color: c.ink }}
                  >
                    {breadcrumb.clientName}
                  </div>
                  {breadcrumb.subline && (
                    <div className="text-xs leading-tight" style={{ color: c.slate }}>
                      {breadcrumb.subline}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="h-8 w-px mx-2 shrink-0" style={{ background: c.line }} />
              <div className="text-sm font-semibold" style={{ color: c.slate }}>
                {role === "client" ? "Client portal preview" : "Case queue"}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <RoleTabs role={role} onChange={onRoleChange} />
          <div className="h-8 w-px shrink-0" style={{ background: c.line }} />
          <div className="text-right">
            <p className="text-xs font-semibold leading-none" style={{ color: c.ink }}>
              {session.name}
            </p>
            <p className="text-[10px] mt-1" style={{ color: c.slateLight }}>
              {session.userType}
            </p>
          </div>
          <button
            type="button"
            onClick={session.onSignOut}
            title="Sign out"
            className="flex items-center gap-1.5 text-xs font-semibold rounded px-2.5 py-1.5 transition-colors"
            style={{ color: c.slate, border: `1px solid ${c.line}` }}
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </header>

      {/* ── R2 Pipeline bar (hidden when no case selected) ────────── */}
      <PipelineBar activeKey={activeStage} postPetition={postPetition} />

      {/* ── Body: utility rail + active section ────────────────────── */}
      <div className="flex-1 min-h-0 flex">
        <UtilityRail
          entries={railEntries}
          ctx={railCtx}
          activeKey={railActiveKey}
          onSelect={onRailSelect}
        />
        <main className="flex-1 min-w-0 overflow-y-auto">
          {role === "client" ? (
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
