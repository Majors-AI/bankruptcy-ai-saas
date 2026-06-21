// portalAccess — single-department wall tests.
//
// Pure-function coverage for the wall matrix the user explicitly called out
// as the one place that won't ship on static analysis alone.
//
// Covers:
//   - canAccessPortal(portal, ctx) for every (role × portal) combination
//   - homePortalFor(role) for every role
//   - canSeeNavItem hides firm Settings + portal-agnostic admin items for
//     the three regular roles (paralegal / legal_admin / accounting),
//     allows them for super-admin tier (firm_super_admin /
//     super_admin_bankruptcy_ai / isLawFirmOwner)
//   - viewForPortal + viewToPortal round-trip

import { describe, test, expect } from "vitest";
import {
  canAccessPortal,
  canSeeNavItem,
  homePortalFor,
  viewForPortal,
  viewToPortal,
  type PortalAccessContext,
  type PortalKey,
} from "./portalAccess";
import type { PlatformRole } from "./auth";

const ROLES = [
  "super_admin_bankruptcy_ai",
  "firm_super_admin",
  "attorney",
  "legal_admin",
  "paralegal",
  "intake",
  "accounting",
  "client",
] as const satisfies ReadonlyArray<PlatformRole>;

const ALL_PORTALS = [
  "intake",
  "legal_dept",
  "accounting",
  "case_review",
] as const satisfies ReadonlyArray<PortalKey>;

function ctx(
  role: PlatformRole | null,
  isLawFirmOwner = false,
  authedEmail: string | null = null,
): PortalAccessContext {
  return { role, isLawFirmOwner, authedEmail };
}

// ── canAccessPortal — full wall matrix ─────────────────────────────────

describe("canAccessPortal — wall matrix", () => {
  // Per the wall matrix in src/lib/portalAccess.ts:
  //   super-admin tier      → every portal
  //   attorney              → case_review (home) + intake + legal_dept
  //   paralegal             → legal_dept only
  //   legal_admin           → intake only
  //   intake                → intake only
  //   accounting            → accounting only
  //   client                → nothing (handled by separate client app)
  const EXPECTED: Record<PlatformRole, ReadonlyArray<PortalKey>> = {
    super_admin_bankruptcy_ai: ["intake", "legal_dept", "accounting", "case_review"],
    firm_super_admin:          ["intake", "legal_dept", "accounting", "case_review"],
    attorney:                  ["intake", "legal_dept", "case_review"],
    legal_admin:               ["intake"],
    paralegal:                 ["legal_dept"],
    intake:                    ["intake"],
    accounting:                ["accounting"],
    client:                    [],
  };

  for (const role of ROLES) {
    for (const portal of ALL_PORTALS) {
      const shouldAllow = EXPECTED[role].includes(portal);
      test(`role=${role} portal=${portal} → ${shouldAllow ? "allow" : "deny"}`, () => {
        expect(canAccessPortal(portal, ctx(role))).toBe(shouldAllow);
      });
    }
  }

  test("isLawFirmOwner=true grants every portal even on a regular role", () => {
    for (const portal of ALL_PORTALS) {
      expect(canAccessPortal(portal, ctx("paralegal", true))).toBe(true);
    }
  });

  test("null role → blocked from every portal", () => {
    for (const portal of ALL_PORTALS) {
      expect(canAccessPortal(portal, ctx(null))).toBe(false);
    }
  });
});

// ── homePortalFor — landing routing ────────────────────────────────────

describe("homePortalFor — landing portal per role", () => {
  const EXPECTED: Record<PlatformRole, PortalKey> = {
    super_admin_bankruptcy_ai: "intake",
    firm_super_admin:          "intake",
    attorney:                  "case_review",
    legal_admin:               "intake",
    paralegal:                 "legal_dept",
    intake:                    "intake",
    accounting:                "accounting",
    // Clients aren't routed through staff portals — magic-link client app
    // owns them. Fallback for completeness.
    client:                    "intake",
  };

  for (const role of ROLES) {
    test(`${role} → ${EXPECTED[role]}`, () => {
      expect(homePortalFor(role)).toBe(EXPECTED[role]);
    });
  }

  test("null role → intake (fallback)", () => {
    expect(homePortalFor(null)).toBe("intake");
  });
});

// ── canSeeNavItem — Settings + portal-agnostic admin items ─────────────

describe("canSeeNavItem — Settings + portal-agnostic admin items", () => {
  // Sample portal-agnostic views — none of these map to a department
  // portal, so the default-deny rule must hide them from regular staff.
  // Firm Settings is the one the user called out explicitly; the others
  // matter for the same reason (don't accidentally surface firm-tier or
  // platform-tier surfaces to walled regular roles).
  const ADMIN_VIEWS = [
    "law_firm_settings",
    "bankruptcy_ai_admin",
    "firm_super_admin_console",
    "law_firm_owner_portal",
    "superadmin",       // Productivity
    "staff_comms",      // Comms
    "staff_dashboard",  // My Tasks (admin-tier today)
    "training",
    "trustee",
    "messages",
    "get_help",
  ];

  const REGULAR_ROLES = [
    "paralegal",
    "legal_admin",
    "accounting",
    "intake",
    "attorney",
    "client",
  ] as const satisfies ReadonlyArray<PlatformRole>;

  const SUPER_ADMIN_ROLES = [
    "firm_super_admin",
    "super_admin_bankruptcy_ai",
  ] as const satisfies ReadonlyArray<PlatformRole>;

  describe("regular roles → ADMIN_VIEWS hidden", () => {
    for (const role of REGULAR_ROLES) {
      for (const view of ADMIN_VIEWS) {
        test(`role=${role} view=${view} → hidden`, () => {
          expect(canSeeNavItem(view, ctx(role))).toBe(false);
        });
      }
    }
  });

  describe("super-admin tier → ADMIN_VIEWS visible", () => {
    for (const role of SUPER_ADMIN_ROLES) {
      for (const view of ADMIN_VIEWS) {
        test(`role=${role} view=${view} → visible`, () => {
          expect(canSeeNavItem(view, ctx(role))).toBe(true);
        });
      }
    }
  });

  test("isLawFirmOwner=true unlocks ADMIN_VIEWS even when role is paralegal", () => {
    for (const view of ADMIN_VIEWS) {
      expect(canSeeNavItem(view, ctx("paralegal", true))).toBe(true);
    }
  });

  // Sanity check: portal-mapped views still obey canAccessPortal — Cardi
  // (paralegal) sees her legal_dept_portal entry, nothing else cross-portal.
  test("portal-mapped views — paralegal sees legal_dept only", () => {
    const c = ctx("paralegal");
    expect(canSeeNavItem("legal_dept_portal", c)).toBe(true);
    expect(canSeeNavItem("legal_admin",       c)).toBe(false);
    expect(canSeeNavItem("accounting",        c)).toBe(false);
    expect(canSeeNavItem("attorney",          c)).toBe(false);
  });

  test("portal-mapped views — legal_admin (Carmelo) sees intake only", () => {
    const c = ctx("legal_admin");
    expect(canSeeNavItem("legal_admin",       c)).toBe(true);
    expect(canSeeNavItem("legal_dept_portal", c)).toBe(false);
    expect(canSeeNavItem("accounting",        c)).toBe(false);
    expect(canSeeNavItem("attorney",          c)).toBe(false);
  });

  test("portal-mapped views — accounting (Justin) sees accounting only", () => {
    const c = ctx("accounting");
    expect(canSeeNavItem("accounting",        c)).toBe(true);
    expect(canSeeNavItem("legal_admin",       c)).toBe(false);
    expect(canSeeNavItem("legal_dept_portal", c)).toBe(false);
    expect(canSeeNavItem("attorney",          c)).toBe(false);
  });
});

// ── viewForPortal + viewToPortal round-trip ────────────────────────────

describe("viewForPortal + viewToPortal round-trip", () => {
  for (const portal of ALL_PORTALS) {
    test(`${portal} → canonical view round-trips`, () => {
      const view = viewForPortal(portal);
      expect(viewToPortal(view)).toBe(portal);
    });
  }

  test("unknown / portal-agnostic views → null", () => {
    expect(viewToPortal("law_firm_settings")).toBe(null);
    expect(viewToPortal("superadmin")).toBe(null);
    expect(viewToPortal("staff_comms")).toBe(null);
    expect(viewToPortal("does_not_exist")).toBe(null);
  });
});
