// RoleTabs — Paralegal / Attorney / Client portal pill.
// Visual port of the role-tab pill in docs/design/legal-portal-reference.jsx
// (lines 1171–1175).
//
// PERMISSION POSTURE (§8 A1 of legal-portal-function-mapping.md):
// The Paralegal tab is the visual landing for both `legal_admin` and
// `paralegal` session roles, but **admin actions stay gated to the
// utility rail and per-action role checks inside each panel**. This
// component is a visual selector ONLY — it does NOT grant any
// permissions. Role-gate enforcement happens upstream (auth context)
// and downstream (action handlers).

import { Video, Scale, User as UserIcon } from "lucide-react";
import { c, type LegalRole } from "./legalPortalTokens";

export interface RoleTabsProps {
  role: LegalRole;
  onChange: (next: LegalRole) => void;
  /** Allow the Client tab to be hidden when client-portal preview is
   *  disabled by firm policy. Default true. */
  showClient?: boolean;
}

const ROLE_DEFS: ReadonlyArray<{ key: LegalRole; label: string; icon: typeof Video }> = [
  { key: "paralegal", label: "Paralegal",     icon: Video    },
  { key: "attorney",  label: "Attorney",      icon: Scale    },
  { key: "client",    label: "Client portal", icon: UserIcon },
];

export default function RoleTabs({ role, onChange, showClient = true }: RoleTabsProps) {
  const defs = showClient ? ROLE_DEFS : ROLE_DEFS.filter((r) => r.key !== "client");
  return (
    <div
      className="flex items-center gap-1 rounded-xl p-1 shrink-0"
      style={{ background: c.bg }}
      role="tablist"
      aria-label="Legal portal role"
    >
      {defs.map((r) => {
        const Icon = r.icon;
        const active = role === r.key;
        return (
          <button
            key={r.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(r.key)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
            style={{
              background: active ? c.paper : "transparent",
              color: active ? c.ink : c.slate,
              boxShadow: active ? "0 1px 3px rgba(22,35,58,0.12)" : "none",
            }}
          >
            <Icon size={15} style={{ color: active ? c.teal : c.slateLight }} />
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
