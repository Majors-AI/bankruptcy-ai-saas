// Reporting tab access tiers — typed interface.
//
// Companion to functional-readme §13 (Metrics, Activity & Reporting):
//   - Every staff member sees their OWN productivity report.
//   - Department supervisors see their own department's staff only.
//   - Super admins (firm_super_admin / super_admin_bankruptcy_ai /
//     law_firm_owner) see ALL departments.
//   - Billable-time export = super-admin tier ONLY (sensitive).
//
// Reporting UI is deferred to Phase D7. The interface ships in D1 so
// the access-tier decision lives in one module from the start; UI
// consumers in D7 just call these helpers.
//
// NO REPORTING DATA HOOK SHIPS IN D1. This file is access logic only —
// it doesn't fetch or compute metrics.

import type { PlatformRole } from "./auth";

export type ReportingScope =
  /** Self only — own task throughput, time clock, calls handled. */
  | "self"
  /** Own department's staff — supervisor view. */
  | "department"
  /** All departments — super-admin view. */
  | "all";

/** Highest reporting scope the caller is allowed to view. */
export function reportingScopeFor(role: PlatformRole | null | undefined): ReportingScope {
  if (
    role === "super_admin_bankruptcy_ai" ||
    role === "firm_super_admin"
  ) return "all";
  // Department supervisors aren't represented as a distinct PlatformRole
  // today — they're identified via staff_members.is_department_supervisor
  // or similar. Until that bit is plumbed through useCurrentRole, the
  // "department" tier requires explicit caller-supplied context.
  // Default fallback for everyone else: self.
  return "self";
}

/** True when this caller can export billable-time data.
 *  Per §13: super-admin tier only. */
export function canExportBillableTime(role: PlatformRole | null | undefined): boolean {
  return (
    role === "super_admin_bankruptcy_ai" ||
    role === "firm_super_admin"
  );
}

/** True when this caller can view ANOTHER staff member's report.
 *  Per §13:
 *    - 'all' scope → yes
 *    - 'department' scope → only when target is in their department
 *    - 'self' scope → never (only their own data) */
export function canViewOtherStaffReport(
  viewerScope: ReportingScope,
  viewerDeptId: string | null,
  targetStaffDeptId: string | null,
): boolean {
  if (viewerScope === "all") return true;
  if (viewerScope === "self") return false;
  // department scope — must share dept_id.
  if (!viewerDeptId || !targetStaffDeptId) return false;
  return viewerDeptId === targetStaffDeptId;
}
