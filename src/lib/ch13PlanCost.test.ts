// Tests for the Ch.13 plan-cost engine — conduit logic, disbursement base,
// trustee fee, monthly plan payment. Pure functions; no React.

import { describe, expect, it } from "vitest";
import { computeCh13PlanCost, CH13_ADMIN_MULTIPLIERS } from "./ch13PlanCost";

describe("computeCh13PlanCost — AZ, no arrears (no conduit)", () => {
  const result = computeCh13PlanCost({
    unsecuredDistribution: 3000,
    securedCramdownPayments: 15000,
    arrearsCure: 0,
    priorityClaims: 2000,
    mortgageArrearsInPlan: false,    // conduit OFF
    ongoingMortgageOverTerm: 90000,  // ignored when conduit OFF
    planMonths: 60,
    venue: "AZ",
  });

  it("conduitRequired is false when no arrears", () => {
    expect(result.conduitRequired).toBe(false);
  });
  it("ongoing mortgage is EXCLUDED from disbursementBase when conduit OFF", () => {
    expect(result.breakdown.ongoingMortgageInBase).toBe(0);
  });
  it("disbursementBase = 3000 + 15000 + 0 + 2000 = 20000", () => {
    expect(result.disbursementBase).toBe(20000);
  });
  it("AZ multiplier 8.20 → trusteeFee 1640", () => {
    expect(result.multiplierUsed).toBe(8.20);
    expect(result.trusteeFee).toBeCloseTo(1640, 10);
  });
  it("monthlyPlanPayment (21640/60) ≈ 360.67", () => {
    expect(result.monthlyPlanPayment).toBeCloseTo(360.67, 1);
  });
});

describe("computeCh13PlanCost — AZ, with arrears (conduit ON)", () => {
  const result = computeCh13PlanCost({
    unsecuredDistribution: 3000,
    securedCramdownPayments: 15000,
    arrearsCure: 6000,
    priorityClaims: 2000,
    mortgageArrearsInPlan: true,     // conduit ON
    ongoingMortgageOverTerm: 90000,  // FLOWS INTO base + fee
    planMonths: 60,
    venue: "AZ",
  });

  it("conduitRequired is true when mortgageArrearsInPlan is true", () => {
    expect(result.conduitRequired).toBe(true);
  });
  it("ongoing mortgage INFLATES disbursementBase when conduit ON", () => {
    expect(result.breakdown.ongoingMortgageInBase).toBe(90000);
  });
  it("disbursementBase = 3000 + 15000 + 6000 + 2000 + 90000 = 116000", () => {
    expect(result.disbursementBase).toBe(116000);
  });
  it("trusteeFee climbs to 9512 (116000 × 8.20%)", () => {
    expect(result.trusteeFee).toBeCloseTo(9512, 10);
  });
  it("monthlyPlanPayment (125512/60) ≈ 2091.87", () => {
    expect(result.monthlyPlanPayment).toBeCloseTo(2091.87, 1);
  });

  it("CONDUIT INFLATES BOTH base AND fee vs. the no-arrears case", () => {
    // Conduit-OFF reference (same numbers minus arrears + conduit flag).
    const noConduit = computeCh13PlanCost({
      unsecuredDistribution: 3000,
      securedCramdownPayments: 15000,
      arrearsCure: 0,
      priorityClaims: 2000,
      mortgageArrearsInPlan: false,
      ongoingMortgageOverTerm: 90000,
      planMonths: 60,
      venue: "AZ",
    });
    expect(result.disbursementBase).toBeGreaterThan(noConduit.disbursementBase);
    expect(result.trusteeFee).toBeGreaterThan(noConduit.trusteeFee);
  });
});

describe("computeCh13PlanCost — WA-W multiplier lookup", () => {
  const result = computeCh13PlanCost({
    unsecuredDistribution: 3000,
    securedCramdownPayments: 15000,
    arrearsCure: 0,
    priorityClaims: 2000,
    mortgageArrearsInPlan: false,
    ongoingMortgageOverTerm: 0,
    planMonths: 60,
    venue: "WA-W",
  });

  it("WA-W multiplier resolves to 10", () => {
    expect(result.multiplierUsed).toBe(10);
  });
  it("disbursementBase 20000 × 10% → fee 2000", () => {
    expect(result.disbursementBase).toBe(20000);
    expect(result.trusteeFee).toBe(2000);
  });
  it("monthlyPlanPayment (22000/60) ≈ 366.67", () => {
    expect(result.monthlyPlanPayment).toBeCloseTo(366.67, 1);
  });
});

describe("CH13_ADMIN_MULTIPLIERS seed", () => {
  it("matches the spec values: AZ 8.20 / WA-W 10 / WA-E 10", () => {
    expect(CH13_ADMIN_MULTIPLIERS.AZ).toBe(8.20);
    expect(CH13_ADMIN_MULTIPLIERS["WA-W"]).toBe(10);
    expect(CH13_ADMIN_MULTIPLIERS["WA-E"]).toBe(10);
  });
});

describe("computeCh13PlanCost — multiplierOverride", () => {
  it("override supersedes the per-venue default", () => {
    const r = computeCh13PlanCost({
      unsecuredDistribution: 20000,
      securedCramdownPayments: 0,
      arrearsCure: 0,
      priorityClaims: 0,
      mortgageArrearsInPlan: false,
      ongoingMortgageOverTerm: 0,
      planMonths: 60,
      venue: "AZ",
      multiplierOverride: 5,
    });
    expect(r.multiplierUsed).toBe(5);
    expect(r.trusteeFee).toBe(1000);   // 20000 × 5%
  });
});
