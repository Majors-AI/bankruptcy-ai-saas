// @deprecated — replaced by Sidebar (220px labeled) per D1 unified-layout
// directive (functional-readme §1). LegalPortalShell no longer imports
// this. File kept temporarily for any straggler import; remove in the
// next sweep once direct references are confirmed zero.
//
// UtilityRail — left-edge icon-only navigation column.
//
// Component-ONLY file (no named non-component exports) so that
// @vitejs/plugin-react Fast Refresh works without invalidating the
// module on every edit. Types + DEFAULT_RAIL_ENTRIES live in
// `./railEntries.ts`.
//
// SCOPE (§8 A5 of legal-portal-function-mapping.md): the back-office
// surfaces (Leads / Calendar / Messages / Tasks / My Schedule / Settings /
// Out-of-Office / Manual Clients / Home / Documents / Time & Fees) all
// live OUTSIDE the reference's 11-slot case-review surface. The rail is
// where they stay reachable.
//
// SUB-PHASE 1 INTERIM ROUTING: clicks navigate to the EXISTING tabs so no
// back-office function is unreachable. See railEntries.ts for the
// per-entry `RailDest` discriminated union.
//
// PERMISSION POSTURE: each entry has an optional `gate(ctx)` predicate.
// The rail HIDES entries the current viewer cannot use. Per-action
// role checks inside the destination panels still apply
// (defense-in-depth — visibility is not authorization).

import { c } from "./legalPortalTokens";
import { DEFAULT_RAIL_ENTRIES, type RailEntry, type RailGateContext } from "./railEntries";

export interface UtilityRailProps {
  entries?: ReadonlyArray<RailEntry>;
  ctx: RailGateContext;
  /** Currently-selected entry key (visual highlight). */
  activeKey?: string | null;
  onSelect: (entry: RailEntry) => void;
}

export default function UtilityRail({
  entries = DEFAULT_RAIL_ENTRIES,
  ctx,
  activeKey = null,
  onSelect,
}: UtilityRailProps) {
  // Filter by role-gate. Hidden entries are NOT rendered at all — this is
  // visibility-side; per-action role checks still apply inside the
  // destination panels.
  const visible = entries.filter((e) => !e.gate || e.gate(ctx));

  return (
    <aside
      className="flex flex-col items-center gap-1 py-3 shrink-0"
      style={{
        width: 56,
        background: c.paper,
        borderRight: `1px solid ${c.line}`,
      }}
      aria-label="Legal portal utility rail"
    >
      {visible.map((e) => {
        const Icon = e.icon;
        const active = e.key === activeKey;
        return (
          <button
            key={e.key}
            type="button"
            onClick={() => onSelect(e)}
            title={e.label}
            aria-label={e.label}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{
              width: 40,
              height: 40,
              background: active ? c.tealSoft : "transparent",
              border: active ? `1px solid ${c.tealLine}` : "1px solid transparent",
            }}
          >
            <Icon size={18} style={{ color: active ? c.teal : c.slate }} />
          </button>
        );
      })}
    </aside>
  );
}
