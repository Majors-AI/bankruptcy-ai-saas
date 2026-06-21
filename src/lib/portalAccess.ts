// Portal access walls — single-department staff routing.
//
// Companion to functional-readme §2 (Access Control & Client Scope):
//   Regular (non-admin, non-supervisor) staff are walled to ONE department.
//   A paralegal sees only the Legal Department portal; a `legal_admin`
//   (Intake staffer) sees only the Intake portal; an `accounting` user
//   sees only the Accounting portal. No admin-bypass for these roles.
//
// Super-admin tiers (super_admin_bankruptcy_ai, firm_super_admin,
// law_firm_owner) and the per-user accounting operator allowlist retain
// cross-portal access. Attorneys keep their current freedom across
// case_review / intake / legal_dept surfaces (out of scope for the
// regular-role wall; tightened separately if/when needed).
//
// This module is the single source for:
//   - which portal a role lands on at sign-in (`homePortalFor`)
//   - whether a role is allowed into a given portal (`canAccessPortal`)
//   - which portal a given App.tsx `view` belongs to (`viewToPortal`)
//   - whether a NAV_ITEM should appear in the PortalToggle for this
//     caller (`canSeeNavItem`)
//
// CLIENT-SIDE VISIBILITY + ROUTING. Real enforcement is RLS on the
// underlying tables — which Canelo owns.

import type { PlatformRole } from "./auth";
import { canAccessAccountingPortal } from "./accountingWall";

export type PortalKey = "intake" | "legal_dept" | "accounting" | "case_review";

export interface PortalAccessContext {
  role: PlatformRole | null | undefined;
  /** True when env/session indicates law_firm_owner. Matches the flag
   *  App.tsx already derives. */
  isLawFirmOwner?: boolean;
  /** Signed-in user's email — used by the accounting operator allowlist
   *  (per-user override delegated to accountingWall). */
  authedEmail?: string | null;
}

// ─── Home portal per role ───────────────────────────────────────────────
//
// Where a freshly-signed-in user lands. The landing routing in App.tsx
// reads this and calls `setView(viewForPortal(homePortal))`.

export function homePortalFor(
  role: PlatformRole | null | undefined,
): PortalKey {
  switch (role) {
    case "attorney":
      return "case_review";
    case "paralegal":
      return "legal_dept";
    case "accounting":
      return "accounting";
    case "legal_admin":
    case "intake":
      return "intake";
    case "firm_super_admin":
    case "super_admin_bankruptcy_ai":
      // Super-admin tier — pick Intake as the default landing surface
      // (matches today's behaviour). They can navigate anywhere via the
      // PortalToggle.
      return "intake";
    case "client":
      // Clients aren't routed through staff portals — the client app at
      // view='client_view' handles them via a magic-link entry. Fallback
      // here for completeness; should never actually fire.
      return "intake";
    default:
      return "intake";
  }
}

/** Canonical App.tsx `view` for each portal. Used by both the landing
 *  routing and the route-gate redirect. */
export function viewForPortal(portal: PortalKey): string {
  switch (portal) {
    case "intake":      return "legal_admin";
    case "legal_dept":  return "legal_dept_portal";
    case "accounting":  return "accounting";
    case "case_review": return "attorney";
  }
}

// ─── Wall predicate ─────────────────────────────────────────────────────

/** True when the caller is allowed into the given portal.
 *
 *  Super-admin tier + law-firm-owner + accounting operator allowlist
 *  retain cross-portal access. Regular staff roles are walled to ONE
 *  portal each (the one `homePortalFor` returns for them). */
export function canAccessPortal(
  portal: PortalKey,
  ctx: PortalAccessContext,
): boolean {
  // Super-admin tier sees everything.
  if (isSuperAdminTier(ctx)) return true;

  // Per-portal walls.
  switch (portal) {
    case "accounting":
      // Compose with the existing accounting wall — it owns the
      // accounting-role + operator-allowlist logic.
      return canAccessAccountingPortal({
        role: ctx.role,
        isLawFirmOwner: ctx.isLawFirmOwner,
        authedEmail: ctx.authedEmail,
      });

    case "intake":
      // Intake-tier roles + Intake admin (legal_admin) + intake role.
      // Attorneys retain access for cross-pipeline visibility.
      return ctx.role === "legal_admin"
          || ctx.role === "intake"
          || ctx.role === "attorney";

    case "legal_dept":
      // Legal Department surfaces — paralegals + attorneys + Legal Dept
      // admin. Intake's `legal_admin` (despite the legacy name) is
      // BLOCKED here per the single-department wall.
      return ctx.role === "paralegal"
          || ctx.role === "attorney";

    case "case_review":
      // Bankruptcy.AI Case Review surface — attorneys only.
      return ctx.role === "attorney";
  }
}

// ─── PortalToggle visibility ────────────────────────────────────────────

/** Maps an App.tsx `view` to the portal it belongs to, or null when the
 *  view is portal-agnostic (firm Settings, platform admin, training,
 *  trustee, etc.). Portal-agnostic items are NOT auto-granted — see
 *  canSeeNavItem below. */
export function viewToPortal(view: string): PortalKey | null {
  switch (view) {
    // Intake portal surfaces.
    case "legal_admin":
    case "intake_questionnaire":
    case "intake":
      return "intake";

    // Legal Department surfaces (staff-facing lawyer/paralegal flows).
    case "legal_dept_portal":
    case "paralegal":
    case "attorney_sign":
    case "signing_review":
    case "signing_review_ch13":
    case "signing_appt_portal":
    case "signing_appt_portal_ch13":
    case "efiling_portal":
    case "ecf_notices":
    case "file_a_case":
    case "creditor_verification":
    case "ai_bots":
    case "calendar":
    case "file_cabinet":
      return "legal_dept";

    // Accounting.
    case "accounting":
      return "accounting";

    // Bankruptcy.AI Case Review.
    case "attorney":
      return "case_review";

    // Portal-agnostic surfaces: firm Settings, platform admin, comms,
    // training, productivity, trustee, client-side, registration. These
    // are NOT auto-granted to regular staff — see canSeeNavItem.
    default:
      return null;
  }
}

/** Conservative default for PortalToggle visibility. Returns true when:
 *    - the item maps to a portal the caller can access, OR
 *    - the caller is super-admin tier (sees portal-agnostic items too)
 *
 *  Critically, portal-agnostic items (Settings, platform admin, comms)
 *  are NOT auto-granted to regular staff. Paralegal / legal_admin /
 *  accounting must NOT see or open firm Settings — that gate stays
 *  super-admin-tier-only, independent of the portal wall. */
export function canSeeNavItem(
  view: string,
  ctx: PortalAccessContext,
): boolean {
  const portal = viewToPortal(view);
  if (portal !== null) return canAccessPortal(portal, ctx);
  // Portal-agnostic — super-admin tier only.
  return isSuperAdminTier(ctx);
}

// ─── Helpers ────────────────────────────────────────────────────────────

function isSuperAdminTier(ctx: PortalAccessContext): boolean {
  return ctx.role === "super_admin_bankruptcy_ai"
      || ctx.role === "firm_super_admin"
      || ctx.isLawFirmOwner === true;
}
