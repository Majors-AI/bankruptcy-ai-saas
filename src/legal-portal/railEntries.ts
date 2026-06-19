// railEntries — types + default entry set for the legal-portal
// UtilityRail. Kept out of `UtilityRail.tsx` so the component file
// exports a React component ONLY (Fast Refresh requirement — mixed
// exports invalidate the module on every HMR edit).
//
// Why a split: see https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react#consistent-components-exports

import type { LucideIcon } from "lucide-react";
import {
  Home, Users, CalendarDays, MessageSquare, ListChecks, CalendarClock,
  Settings, UserMinus, UserPlus, FolderArchive, DollarSign,
  ClipboardCheck, PenLine,
} from "lucide-react";

// LegalDepartmentPortal section keys (mirrored — keep in sync with
// LegalDepartmentPortal.tsx `Section` type).
export type IntraSection =
  | "tasks" | "paralegal_review" | "signing_review"
  | "file_cabinet" | "calendar" | "time_fees";

// Cross-portal jump targets. Sub-phase 1 supports one — the
// `legal_admin` view in App.tsx, where Leads / Messages / Settings /
// Out-of-Office / Manual Clients live today.
export type CrossTarget = "legal_admin";

export type RailDest =
  | { kind: "intra"; section: IntraSection }
  | { kind: "cross"; target: CrossTarget };

/** Permission context passed to each entry's gate. Sub-phase 1 sources
 *  these from the LegalDepartmentPortal session + the AuthProvider's
 *  ambient role. Sub-phase 6 may refine. */
export interface RailGateContext {
  /** PIN-gate session user type: 'paralegal' | 'attorney' | 'supervising attorney' */
  sessionUserType: string;
  /** AuthProvider session role (firm-tier) — e.g. 'attorney',
   *  'firm_super_admin', 'super_admin_bankruptcy_ai'. May be null. */
  sessionRole: string | null;
  /** Convenience booleans pre-resolved by the shell. */
  canManageLeads: boolean;     // legal_admin · super_admin
  canManageStaff: boolean;     // super_admin · department_supervisor
  isSuperAdmin: boolean;       // platform super_admin OR firm super_admin
  canCreateClient: boolean;    // V1 Manual Clients gate
}

export interface RailEntry {
  key:    string;
  label:  string;     // tooltip text
  icon:   LucideIcon;
  dest:   RailDest;
  /** Optional role-gate. If omitted, entry is always shown. */
  gate?:  (ctx: RailGateContext) => boolean;
}

// Default entry set per §5 of legal-portal-function-mapping.md. Order is
// load-bearing — most-used surfaces float to the top.
//
// ⚠ INTERIM entries (clearly flagged below): `paralegal_review_interim`
// and `signing_review_interim` exist ONLY because the old horizontal
// sub-nav was removed in sub-phase 1 and the Queue (the design's
// intended entry point into both surfaces) lands in sub-phase 2. Until
// the Queue is built, these two surfaces would be unreachable without
// the interim rail entries.
//
// REMOVE BOTH when sub-phase 2 ships and Queue rows become the canonical
// way to open Paralegal/Signing review.
export const DEFAULT_RAIL_ENTRIES: ReadonlyArray<RailEntry> = [
  {
    key: "home",
    label: "Home — firm overview",
    icon: Home,
    dest: { kind: "cross", target: "legal_admin" },
    gate: (ctx) => ctx.canManageLeads || ctx.isSuperAdmin,
  },
  {
    key: "leads",
    label: "Leads — pre-submission pipeline",
    icon: UserPlus,
    dest: { kind: "cross", target: "legal_admin" },
    gate: (ctx) => ctx.canManageLeads,
  },
  {
    key: "tasks",
    label: "Tasks — your task pool",
    icon: ListChecks,
    dest: { kind: "intra", section: "tasks" },
  },
  // ⚠ INTERIM — remove when sub-phase 2 (Queue) lands. The Queue's
  // case-row click is the canonical way to open the paralegal-review
  // workspace; this rail entry only exists to keep the surface
  // reachable in sub-phase 1.
  {
    key: "paralegal_review_interim",
    label: "Paralegal Review (interim — opens last-touched case)",
    icon: ClipboardCheck,
    dest: { kind: "intra", section: "paralegal_review" },
  },
  // ⚠ INTERIM — remove when sub-phase 2 (Queue) lands. Same rationale
  // as paralegal_review_interim. Kept role-broad (no gate) for sub-phase
  // 1 since per-action role checks inside SigningReview still apply.
  {
    key: "signing_review_interim",
    label: "Signing Review (interim — opens last-touched case)",
    icon: PenLine,
    dest: { kind: "intra", section: "signing_review" },
  },
  {
    key: "calendar",
    label: "Calendar — month / week / staff availability",
    icon: CalendarDays,
    dest: { kind: "intra", section: "calendar" },
  },
  {
    key: "messages",
    label: "Messages — review threads & ECF inbox",
    icon: MessageSquare,
    dest: { kind: "cross", target: "legal_admin" },
  },
  {
    key: "my_schedule",
    label: "My Schedule — time-off & availability",
    icon: CalendarClock,
    dest: { kind: "cross", target: "legal_admin" },
  },
  {
    key: "documents",
    label: "Documents — file cabinet",
    icon: FolderArchive,
    dest: { kind: "intra", section: "file_cabinet" },
  },
  {
    key: "time_fees",
    label: "Time & Fees",
    icon: DollarSign,
    dest: { kind: "intra", section: "time_fees" },
  },
  {
    key: "settings",
    label: "Settings — staff / department",
    icon: Settings,
    dest: { kind: "cross", target: "legal_admin" },
    gate: (ctx) => ctx.canManageStaff || ctx.isSuperAdmin,
  },
  {
    key: "out_of_office",
    label: "Out-of-Office Admin",
    icon: UserMinus,
    dest: { kind: "cross", target: "legal_admin" },
    gate: (ctx) => ctx.isSuperAdmin,
  },
  {
    key: "manual_clients",
    label: "Manual Clients (V1)",
    icon: Users,
    dest: { kind: "cross", target: "legal_admin" },
    gate: (ctx) => ctx.canCreateClient,
  },
];
