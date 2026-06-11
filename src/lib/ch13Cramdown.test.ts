// Tests for the § 506(a) bifurcation engine + § 1325(a) hanging-paragraph
// guard. Pure-function harness — no React, no Supabase.

import { describe, expect, it } from "vitest";
import { bifurcate, daysBetween, resolveDaysSincePurchase } from "./ch13Cramdown";

describe("bifurcate — plain § 506(a)", () => {
  it("underwater claim with no hanging-paragraph protection bifurcates", () => {
    const r = bifurcate({
      claimAmount: 20000,
      kbbPrivateParty: 12000,
      hangingParagraph: {
        isMotorVehicle: true,
        isPersonalUseVehicle: true,
        daysSincePurchase: 1500,
        isRetained: true,
      },
    });
    expect(r.securedValue).toBe(12000);
    expect(r.unsecuredDeficiency).toBe(8000);
    expect(r.hangingParagraphProtected).toBe(false);
    expect(r.reclassifiedUnsecured).toBe(false);
    expect(r.valuationSource).toBe("kbb_private_party");
    expect(r.collateralValueUsed).toBe(12000);
  });

  it("fully secured claim has no unsecured deficiency", () => {
    const r = bifurcate({ claimAmount: 10000, kbbPrivateParty: 15000 });
    expect(r.securedValue).toBe(10000);
    expect(r.unsecuredDeficiency).toBe(0);
  });

  it("FMV override supersedes KBB", () => {
    const r = bifurcate({
      claimAmount: 20000,
      kbbPrivateParty: 12000,
      fmvOverride: 8000,
    });
    expect(r.securedValue).toBe(8000);
    expect(r.unsecuredDeficiency).toBe(12000);
    expect(r.valuationSource).toBe("attorney_fmv_override");
    expect(r.collateralValueUsed).toBe(8000);
  });
});

describe("bifurcate — § 1325(a) hanging-paragraph guard", () => {
  it("910 PMSI vehicle retained and within window is fully secured", () => {
    const r = bifurcate({
      claimAmount: 20000,
      kbbPrivateParty: 12000,
      hangingParagraph: {
        isMotorVehicle: true,
        isPersonalUseVehicle: true,
        daysSincePurchase: 800,
        isRetained: true,
      },
    });
    expect(r.securedValue).toBe(20000);
    expect(r.unsecuredDeficiency).toBe(0);
    expect(r.hangingParagraphProtected).toBe(true);
  });

  it("boundary: days === 910 is PROTECTED", () => {
    const r = bifurcate({
      claimAmount: 20000,
      kbbPrivateParty: 12000,
      hangingParagraph: {
        isMotorVehicle: true,
        isPersonalUseVehicle: true,
        daysSincePurchase: 910,
        isRetained: true,
      },
    });
    expect(r.hangingParagraphProtected).toBe(true);
    expect(r.securedValue).toBe(20000);
  });

  it("boundary: days === 911 BIFURCATES (just outside window)", () => {
    const r = bifurcate({
      claimAmount: 20000,
      kbbPrivateParty: 12000,
      hangingParagraph: {
        isMotorVehicle: true,
        isPersonalUseVehicle: true,
        daysSincePurchase: 911,
        isRetained: true,
      },
    });
    expect(r.hangingParagraphProtected).toBe(false);
    expect(r.securedValue).toBe(12000);
    expect(r.unsecuredDeficiency).toBe(8000);
  });

  it("vehicle NOT for personal use does not get the 910 shield", () => {
    const r = bifurcate({
      claimAmount: 20000,
      kbbPrivateParty: 12000,
      hangingParagraph: {
        isMotorVehicle: true,
        isPersonalUseVehicle: false,   // commercial use → no shield
        daysSincePurchase: 100,
        isRetained: true,
      },
    });
    expect(r.hangingParagraphProtected).toBe(false);
    expect(r.securedValue).toBe(12000);
  });

  it("surrendered vehicle is not protected (collateral not retained)", () => {
    const r = bifurcate({
      claimAmount: 20000,
      kbbPrivateParty: 12000,
      hangingParagraph: {
        isMotorVehicle: true,
        isPersonalUseVehicle: true,
        daysSincePurchase: 100,
        isRetained: false,
      },
    });
    expect(r.hangingParagraphProtected).toBe(false);
    expect(r.securedValue).toBe(12000);
  });

  it("other purchase-money within 365 days is fully secured (Best Buy fixture)", () => {
    const r = bifurcate({
      claimAmount: 3000,
      kbbPrivateParty: 1000,
      hangingParagraph: {
        isMotorVehicle: false,
        isOtherPurchaseMoney: true,
        daysSincePurchase: 200,
        isRetained: true,
      },
    });
    expect(r.securedValue).toBe(3000);
    expect(r.unsecuredDeficiency).toBe(0);
    expect(r.hangingParagraphProtected).toBe(true);
  });

  it("boundary: other purchase-money days === 365 is PROTECTED", () => {
    const r = bifurcate({
      claimAmount: 3000,
      kbbPrivateParty: 1000,
      hangingParagraph: {
        isMotorVehicle: false,
        isOtherPurchaseMoney: true,
        daysSincePurchase: 365,
        isRetained: true,
      },
    });
    expect(r.hangingParagraphProtected).toBe(true);
  });

  it("boundary: other purchase-money days === 366 BIFURCATES", () => {
    const r = bifurcate({
      claimAmount: 3000,
      kbbPrivateParty: 1000,
      hangingParagraph: {
        isMotorVehicle: false,
        isOtherPurchaseMoney: true,
        daysSincePurchase: 366,
        isRetained: true,
      },
    });
    expect(r.hangingParagraphProtected).toBe(false);
    expect(r.securedValue).toBe(1000);
    expect(r.unsecuredDeficiency).toBe(2000);
  });
});

describe("bifurcate — attorney reclassification flag", () => {
  it("reclassifiedUnsecured collapses claim to fully unsecured (Best Buy, no longer held)", () => {
    const r = bifurcate({
      claimAmount: 3000,
      kbbPrivateParty: 1000,
      reclassifiedUnsecured: true,
      hangingParagraph: {
        // Even if the hanging-paragraph facts would normally protect, the
        // attorney flag wins because the collateral is not in the debtor's
        // possession anymore.
        isMotorVehicle: false,
        isOtherPurchaseMoney: true,
        daysSincePurchase: 200,
        isRetained: true,
      },
    });
    expect(r.securedValue).toBe(0);
    expect(r.unsecuredDeficiency).toBe(3000);
    expect(r.reclassifiedUnsecured).toBe(true);
    expect(r.hangingParagraphProtected).toBe(false); // moot, not asserted
  });
});

describe("bifurcate — date-based hanging-paragraph variant", () => {
  it("purchaseDate + filingDate with delta > 910 days BIFURCATES", () => {
    // 2022-01-01 → 2026-06-01 = 1612 days, well outside the 910-day window.
    // (The original spec fixture of 2024-01-01 → 2026-06-01 resolves to
    // 882 days, which is INSIDE the window — that case is asserted as
    // PROTECTED separately below.)
    const r = bifurcate({
      claimAmount: 20000,
      kbbPrivateParty: 12000,
      hangingParagraph: {
        isMotorVehicle: true,
        isPersonalUseVehicle: true,
        purchaseDate: "2022-01-01",
        filingDate: "2026-06-01",
        isRetained: true,
      },
    });
    expect(r.hangingParagraphProtected).toBe(false);
    expect(r.securedValue).toBe(12000);
    expect(r.unsecuredDeficiency).toBe(8000);
  });

  it("spec fixture 2024-01-01 → 2026-06-01 resolves to 882 days (INSIDE 910 window → PROTECTED)", () => {
    // Documents the actual day-count for the original spec dates so the
    // 882-day case is covered explicitly.
    const r = bifurcate({
      claimAmount: 20000,
      kbbPrivateParty: 12000,
      hangingParagraph: {
        isMotorVehicle: true,
        isPersonalUseVehicle: true,
        purchaseDate: "2024-01-01",
        filingDate: "2026-06-01",
        isRetained: true,
      },
    });
    expect(daysBetween("2026-06-01", "2024-01-01")).toBe(882);
    expect(r.hangingParagraphProtected).toBe(true);
    expect(r.securedValue).toBe(20000);
  });

  it("purchaseDate + filingDate with delta ≤ 910 days is PROTECTED", () => {
    const r = bifurcate({
      claimAmount: 20000,
      kbbPrivateParty: 12000,
      hangingParagraph: {
        isMotorVehicle: true,
        isPersonalUseVehicle: true,
        purchaseDate: "2024-06-01",
        filingDate: "2026-06-01",      // 730 days — inside 910
        isRetained: true,
      },
    });
    expect(r.hangingParagraphProtected).toBe(true);
    expect(r.securedValue).toBe(20000);
  });
});

describe("daysBetween + resolveDaysSincePurchase", () => {
  it("daysBetween computes whole-day deltas (UTC-anchored)", () => {
    expect(daysBetween("2026-06-01", "2024-06-01")).toBe(730);     // 365 + 365
    expect(daysBetween("2025-01-01", "2024-01-01")).toBe(366);     // 2024 leap
    expect(daysBetween("2024-06-01", "2024-06-01")).toBe(0);
  });

  it("date pair wins over numeric daysSincePurchase when both supplied", () => {
    const days = resolveDaysSincePurchase({
      isMotorVehicle: true,
      isRetained: true,
      daysSincePurchase: 9999,            // would be ignored
      purchaseDate: "2024-06-01",
      filingDate: "2026-06-01",
    });
    expect(days).toBe(730);
  });

  it("falls back to numeric daysSincePurchase when no date pair", () => {
    const days = resolveDaysSincePurchase({
      isMotorVehicle: true,
      isRetained: true,
      daysSincePurchase: 800,
    });
    expect(days).toBe(800);
  });

  it("resolves to Infinity when no day info supplied (safer than 0)", () => {
    const days = resolveDaysSincePurchase({
      isMotorVehicle: true,
      isRetained: true,
    });
    expect(days).toBe(Infinity);
  });
});
