// Accounting portal access gate — typed predicate.
//
// Companion to functional-readme §2 (Access Control & Client Scope):
//   Accounting is walled off from Legal/Intake (regular staff + attorneys)
//   EXCEPT the payment view (§15). The portal itself is reachable only by:
//     - accounting role
//     - firm_super_admin
//     - super_admin_bankruptcy_ai
//     - law_firm_owner
//     - accounting operator allowlist (per-user override for ops testing)
//
//   Legal-tier roles (legal_admin / attorney / attorney_super_admin) and
//   intake roles are BLOCKED. They get fee/payment visibility via the
//   readme §15 view on the legal client file — NOT via the accounting
//   portal.
//
// Single source for the wall — used by App.tsx route gate AND by
// PortalToggle visibility (a blocked role doesn't see the entry).

import type { PlatformRole } from "./auth";

// Per-user operator allowlist for the Accounting portal — mirrors the
// pattern used by Bankruptcy.AI Admin (OPERATOR_EMAILS in App.tsx).
// CLIENT-SIDE TAB VISIBILITY ONLY; not a security boundary. Real
// enforcement is RLS on accounting_* tables.
const ACCOUNTING_OPERATOR_EMAILS: ReadonlyArray<string> = [
  // Add ops emails here if you need bypass access during testing.
  // Example: 'ops-accounting@yourfirm.com'.
];

function isAccountingOperatorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return ACCOUNTING_OPERATOR_EMAILS.some(e => e.toLowerCase() === lower);
}

/** True when the viewer is allowed into the Accounting portal.
 *
 *  Allowed PlatformRoles:
 *    - accounting
 *    - firm_super_admin
 *    - super_admin_bankruptcy_ai
 *  Additional non-role allowances:
 *    - law_firm_owner (derived from VITE_FIRM_ROLE='law_firm_owner' or env)
 *    - operator email allowlist (above)
 *
 *  Blocked (explicit):
 *    - legal_admin, attorney, attorney_super_admin (Legal-tier)
 *    - intake (Intake-tier)
 *    - paralegal (Legal-tier — see src/lib/portalAccess.ts for the
 *      single-department wall enforcing paralegal → Legal Dept only)
 *    - client
 */
export interface AccountingWallContext {
  role: PlatformRole | null | undefined;
  /** True when the caller's env or session indicates law_firm_owner. */
  isLawFirmOwner?: boolean;
  /** Signed-in user's email (lowercased compared against the allowlist). */
  authedEmail?: string | null;
}

export function canAccessAccountingPortal(ctx: AccountingWallContext): boolean {
  // Operator-allowlist override — always wins.
  if (isAccountingOperatorEmail(ctx.authedEmail)) return true;

  // Explicit allow list (Fix B per D1 directive — firm_super_admin
  // included; super admin MAY see accounting).
  if (
    ctx.role === "accounting" ||
    ctx.role === "firm_super_admin" ||
    ctx.role === "super_admin_bankruptcy_ai"
  ) {
    return true;
  }

  // Law firm owner (env-derived flag, not a PlatformRole on its own).
  if (ctx.isLawFirmOwner === true) return true;

  // Everyone else (legal_admin / attorney / attorney_super_admin / intake
  // / client / paralegal / null) — BLOCKED. Legal/Intake's fee/payment
  // visibility lives in the §15 payment view on the client file.
  return false;
}
