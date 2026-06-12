// Tests for the pure intake-derivation helpers (Batch 1/2/3 + § 1322(b)(2)
// anti-modification). Locks in the wiring contract so future intake-shape
// changes can't quietly regress the Ch.13 review.

import { describe, expect, it } from "vitest";
import {
  deriveSecuredClaims,
  deriveBatch3FromIntake,
  deriveHouseholdSize,
  deriveCmiMonthly,
  deriveVenue,
  isMedianAvailable,
  type Ch13SecuredClaimInput,
} from "./ch13Derive";

// Mirror of the cramdown loop in Ch13Eligibility — anti-mod claims are
// EXCLUDED from the cramdown-amortization set and ride through as
// cure-and-maintain via the conduit/arrears path.
function cramdownSet(claims: ReadonlyArray<Ch13SecuredClaimInput>) {
  return claims.filter(c => c.antiModification !== true);
}

describe("deriveSecuredClaims — § 1322(b)(2) anti-modification", () => {
  it("primary mortgage is flagged antiModification=true and EXCLUDED from cramdown set", () => {
    const claims = deriveSecuredClaims({
      mortgageBalance: "287400",
      realPropValue: "348000",
      realPropAddress: "123 Test St, Anytown, AZ 85001",
      mortgageArrears: "0",
      mortgageMonthlyPayment: "1850",
    });
    const primary = claims.find(c => c.id === "mortgage-primary");
    expect(primary).toBeTruthy();
    expect(primary?.antiModification).toBe(true);
    expect(primary?.claimAmount).toBe(287400);
    expect(primary?.kbbPrivateParty).toBe(348000);
    expect(primary?.ongoingMonthlyPayment).toBe(1850);
    expect(primary?.cureArrears).toBe(0);
    expect(primary?.collateralAddress).toBe("123 Test St, Anytown, AZ 85001");
    // Anti-mod claim doesn't enter the cramdown set
    expect(cramdownSet(claims).some(c => c.id === "mortgage-primary")).toBe(false);
  });

  it("UNDERWATER primary mortgage is STILL anti-mod (Nobelman — not crammed)", () => {
    // Claim 400000 vs value 250000 — heavily underwater. § 506(a) would
    // bifurcate to 250000 secured / 150000 unsecured, but § 1322(b)(2)
    // forbids the modification on the principal residence.
    const claims = deriveSecuredClaims({
      mortgageBalance: "400000",
      realPropValue: "250000",
    });
    const primary = claims.find(c => c.id === "mortgage-primary");
    expect(primary?.antiModification).toBe(true);
    expect(primary?.claimAmount).toBe(400000);
    expect(primary?.kbbPrivateParty).toBe(250000);
    expect(cramdownSet(claims).some(c => c.id === "mortgage-primary")).toBe(false);
  });

  it("vehicles with hasLoan='yes' DO bifurcate (no anti-mod flag, in cramdown set)", () => {
    const claims = deriveSecuredClaims({
      vehicles: [
        { year: "2019", make: "Toyota", model: "Camry", value: "18500", hasLoan: "yes", loanBalance: "11200" },
        { year: "2014", make: "Honda",  model: "Civic", value: "7200",  hasLoan: "no",  loanBalance: "" },
      ],
    });
    expect(claims).toHaveLength(1);
    expect(claims[0].id).toBe("vehicle-0");
    expect(claims[0].isMotorVehicle).toBe(true);
    expect(claims[0].isPersonalUseVehicle).toBe(true);
    expect(claims[0].claimAmount).toBe(11200);
    expect(claims[0].kbbPrivateParty).toBe(18500);
    expect(claims[0].antiModification).toBeUndefined();
    expect(cramdownSet(claims).some(c => c.id === "vehicle-0")).toBe(true);
  });

  it("second-property mortgage IS bifurcatable (not anti-mod — separate property, not principal residence)", () => {
    const claims = deriveSecuredClaims({
      secondMortgage: "120000",
      secondPropValue: "95000",
      secondPropAddress: "Cabin Rd",
    });
    const second = claims.find(c => c.id === "mortgage-second");
    expect(second).toBeTruthy();
    expect(second?.claimAmount).toBe(120000);
    expect(second?.kbbPrivateParty).toBe(95000);
    expect(second?.antiModification).toBeUndefined();
    expect(cramdownSet(claims).some(c => c.id === "mortgage-second")).toBe(true);
  });

  it("empty form_data → []", () => {
    expect(deriveSecuredClaims(null)).toEqual([]);
    expect(deriveSecuredClaims({})).toEqual([]);
  });

  it("mixed case: primary + second + two vehicles (one with loan)", () => {
    const claims = deriveSecuredClaims({
      mortgageBalance: "287400",
      realPropValue: "348000",
      secondMortgage: "85000",
      secondPropValue: "120000",
      vehicles: [
        { year: "2019", make: "Toyota", model: "Camry", value: "18500", hasLoan: "yes", loanBalance: "11200" },
        { year: "2014", make: "Honda",  model: "Civic", value: "7200",  hasLoan: "no",  loanBalance: "" },
      ],
    });
    expect(claims.map(c => c.id).sort()).toEqual([
      "mortgage-primary", "mortgage-second", "vehicle-0",
    ].sort());
    const set = cramdownSet(claims);
    expect(set.map(c => c.id).sort()).toEqual(["mortgage-second", "vehicle-0"].sort());
  });
});

describe("deriveBatch3FromIntake — mortgage / priority / conduit", () => {
  it("arrears > 0 → arrearsInPlan true + arrearsCure = arrears + conduit", () => {
    const out = deriveBatch3FromIntake({
      mortgageArrears: "6000",
      mortgageMonthlyPayment: "1850",
      mortgageCurrent: "yes",
    }, 60);
    expect(out.mortgageArrearsInPlan).toBe(true);
    expect(out.arrearsCure).toBe(6000);
    expect(out.ongoingMortgageOverTerm).toBe(1850 * 60);
  });

  it("mortgageCurrent='no' with $0 arrears → arrearsInPlan true, cure $0 (flagged edge)", () => {
    const out = deriveBatch3FromIntake({
      mortgageArrears: "0",
      mortgageMonthlyPayment: "1850",
      mortgageCurrent: "no",
    }, 60);
    expect(out.mortgageArrearsInPlan).toBe(true);
    expect(out.arrearsCure).toBe(0);
  });

  it("mortgageCurrent='yes' with $0 arrears → arrearsInPlan false, no conduit", () => {
    const out = deriveBatch3FromIntake({
      mortgageArrears: "0",
      mortgageMonthlyPayment: "1850",
      mortgageCurrent: "yes",
    }, 60);
    expect(out.mortgageArrearsInPlan).toBe(false);
    expect(out.arrearsCure).toBe(0);
  });

  it("ongoingMortgageOverTerm = monthly × planMonths (varies with term)", () => {
    const at60 = deriveBatch3FromIntake({ mortgageMonthlyPayment: "1850" }, 60);
    const at36 = deriveBatch3FromIntake({ mortgageMonthlyPayment: "1850" }, 36);
    expect(at60.ongoingMortgageOverTerm).toBe(1850 * 60);
    expect(at36.ongoingMortgageOverTerm).toBe(1850 * 36);
  });

  it("priorityClaims = taxDebt", () => {
    expect(deriveBatch3FromIntake({ taxDebt: "12500" }, 60).priorityClaims).toBe(12500);
    expect(deriveBatch3FromIntake({ taxDebt: "" }, 60).priorityClaims).toBe(0);
    expect(deriveBatch3FromIntake({}, 60).priorityClaims).toBe(0);
  });

  it("null form_data → all-zero", () => {
    expect(deriveBatch3FromIntake(null, 60)).toEqual({
      mortgageArrearsInPlan: false,
      arrearsCure: 0,
      ongoingMortgageOverTerm: 0,
      priorityClaims: 0,
    });
  });
});

describe("deriveHouseholdSize", () => {
  it("filingType='joint' adds 2 (debtor + spouse); else 1", () => {
    expect(deriveHouseholdSize({ filingType: "joint" })).toBe(2);
    expect(deriveHouseholdSize({ filingType: "individual" })).toBe(1);
    expect(deriveHouseholdSize({})).toBe(1);
  });

  it("numDependents adds on top", () => {
    expect(deriveHouseholdSize({ filingType: "joint", numDependents: "2" })).toBe(4);
    expect(deriveHouseholdSize({ filingType: "individual", numDependents: "3" })).toBe(4);
  });

  it("null form_data → 1", () => {
    expect(deriveHouseholdSize(null)).toBe(1);
  });

  it("invalid numDependents falls back to 0", () => {
    expect(deriveHouseholdSize({ numDependents: "abc" })).toBe(1);
  });
});

describe("deriveCmiMonthly", () => {
  it("uses form_data.cmiMonthly when present and positive", () => {
    expect(deriveCmiMonthly({ cmiMonthly: "5800" })).toBe(5800);
  });

  it("null form_data → 0", () => {
    expect(deriveCmiMonthly(null)).toBe(0);
  });

  it("falls back to sumOtherIncomeIncludedInCMI when cmiMonthly missing", () => {
    // sumOtherIncomeIncludedInCMI returns 0 on an empty record — the
    // helper just exercises the fall-through branch.
    expect(deriveCmiMonthly({})).toBe(0);
  });
});

describe("deriveVenue", () => {
  it("Arizona → AZ, Washington → WA-W", () => {
    expect(deriveVenue("Arizona")).toBe("AZ");
    expect(deriveVenue("Washington")).toBe("WA-W");
  });
  it("case-insensitive + whitespace tolerant", () => {
    expect(deriveVenue("  arizona  ")).toBe("AZ");
    expect(deriveVenue("WASHINGTON")).toBe("WA-W");
  });
  it("uncovered state defaults to AZ", () => {
    expect(deriveVenue("California")).toBe("AZ");
    expect(deriveVenue("")).toBe("AZ");
  });
});

describe("isMedianAvailable (suppress-when-null gate)", () => {
  it("null → false (commitment not classified, plan-cost suppressed)", () => {
    expect(isMedianAvailable(null)).toBe(false);
  });
  it("any number (including 0) → true (we have a figure to compare against)", () => {
    expect(isMedianAvailable(0)).toBe(true);
    expect(isMedianAvailable(73935)).toBe(true);
  });
});
