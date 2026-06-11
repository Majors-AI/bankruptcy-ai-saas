// Till rate + level-payment amortization for Chapter 13 cramdown.
//
// Pure-logic library. No React, no persistence. Consumed by the Ch.13
// cramdown engine to compute the present-value-adequate interest rate on
// the bifurcated secured portion (§ 1325(a)(5)(B)(ii)).
//
// Till v. SCS Credit Corp., 541 U.S. 465 (2004) — the formula approach:
// start with a low-risk national rate (the prime rate) and add a risk
// premium calibrated to the case. The plurality endorsed a 1–3% premium,
// with 2% as the typical default (some districts use 1% / 3% depending on
// debtor risk profile + secured-collateral category).
//
// Per the spec: both wsjPrime and riskPremium are per-case adjustable; an
// attorney `rateOverride` hard-sets the rate when present (e.g. local
// trustee uses a published district rate or the claimant's contract rate).

export interface TillRateInput {
  /** Current Wall Street Journal Prime Rate (annual %). Updated per
   *  Federal Reserve actions. */
  wsjPrime: number;
  /** Till risk premium (annual %). Default 2.0; attorneys may set
   *  1–3 depending on the debtor's risk profile and collateral class. */
  riskPremium?: number;
  /** Attorney hard-set override. When present (a number), supersedes
   *  the WSJ-prime + risk-premium computation. */
  rateOverride?: number | null;
}

export interface TillRateResult {
  /** Effective annual rate (%). */
  annualRatePct: number;
  /** True when the attorney override was applied. */
  overridden: boolean;
  /** Source used to derive the final rate. */
  source: "wsj_prime_plus_premium" | "attorney_override";
  /** Inputs echoed back for the review surface (so the attorney can see
   *  the components even when the override applies). */
  wsjPrime: number;
  riskPremium: number;
}

/** Compute the effective Till rate. attorney rateOverride wins; otherwise
 *  WSJ Prime + risk premium (default 2.0). */
export function computeTillRate(input: TillRateInput): TillRateResult {
  const wsjPrime = numOr(input.wsjPrime, 0);
  const riskPremium = numOr(input.riskPremium, 2.0);

  if (input.rateOverride != null && Number.isFinite(input.rateOverride)) {
    return {
      annualRatePct: nonNeg(input.rateOverride),
      overridden: true,
      source: "attorney_override",
      wsjPrime,
      riskPremium,
    };
  }
  return {
    annualRatePct: nonNeg(wsjPrime + riskPremium),
    overridden: false,
    source: "wsj_prime_plus_premium",
    wsjPrime,
    riskPremium,
  };
}

/** Level monthly payment to amortize `securedAmount` at `annualRatePct`
 *  over `planMonths` months.
 *
 *   - securedAmount ≤ 0  → 0
 *   - planMonths   ≤ 0   → 0
 *   - annualRatePct = 0  → flat principal / planMonths (no interest)
 *   - otherwise          → PMT formula: P · r / (1 − (1 + r)^−n)
 *                          where r = monthly rate, n = planMonths.
 */
export function amortizeMonthly(
  securedAmount: number,
  annualRatePct: number,
  planMonths: number,
): number {
  const P = nonNeg(securedAmount);
  const n = Math.max(0, Math.floor(planMonths));
  if (P === 0 || n === 0) return 0;

  const rAnnual = Math.max(0, annualRatePct) / 100;
  const r = rAnnual / 12;
  if (r === 0) return P / n;

  return (P * r) / (1 - Math.pow(1 + r, -n));
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function nonNeg(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function numOr(n: number | undefined, fallback: number): number {
  return n != null && Number.isFinite(n) ? n : fallback;
}
