// Tests for Till v. SCS Credit Corp. rate computation + level-payment
// amortization. Pure functions; no React.

import { describe, expect, it } from "vitest";
import { computeTillRate, amortizeMonthly } from "./tillRate";

describe("computeTillRate", () => {
  it("prime 8.5 + default 2.0 premium → 10.5", () => {
    const r = computeTillRate({ wsjPrime: 8.5 });
    expect(r.annualRatePct).toBeCloseTo(10.5, 10);
    expect(r.overridden).toBe(false);
    expect(r.source).toBe("wsj_prime_plus_premium");
  });

  it("rateOverride supersedes the WSJ + premium calculation", () => {
    const r = computeTillRate({ wsjPrime: 8.5, rateOverride: 9.0 });
    expect(r.annualRatePct).toBe(9.0);
    expect(r.overridden).toBe(true);
    expect(r.source).toBe("attorney_override");
  });

  it("custom riskPremium adjusts the result", () => {
    const r = computeTillRate({ wsjPrime: 8.5, riskPremium: 3.0 });
    expect(r.annualRatePct).toBeCloseTo(11.5, 10);
  });
});

describe("amortizeMonthly", () => {
  it("amortizeMonthly(12000, 10.5, 60) ≈ 257.93 (within ±0.50)", () => {
    // Standard PMT formula: P · r / (1 − (1 + r)^−n) with r = 10.5/12/100.
    const pmt = amortizeMonthly(12000, 10.5, 60);
    expect(pmt).toBeCloseTo(257.93, 0.5);
    expect(Math.abs(pmt - 257.93)).toBeLessThanOrEqual(0.5);
  });

  it("amortizeMonthly(12000, 0, 60) === 200 exactly (no interest → flat)", () => {
    expect(amortizeMonthly(12000, 0, 60)).toBe(200);
  });

  it("amortizeMonthly(0, 10.5, 60) === 0", () => {
    expect(amortizeMonthly(0, 10.5, 60)).toBe(0);
  });

  it("amortizeMonthly with planMonths = 0 returns 0 (no divide-by-zero)", () => {
    expect(amortizeMonthly(12000, 10.5, 0)).toBe(0);
  });
});
