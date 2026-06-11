// Chapter 13 plan-cost engine — conduit logic, disbursement base, trustee
// fee, and monthly plan payment.
//
// Pure-logic library. No React, no persistence, no audit. Consumed by the
// Ch.13 review portal once it lands.
//
// Conduit (arrears-triggered ONLY):
//   - mortgageArrearsInPlan = true  → conduit required. The trustee
//     disburses the ongoing mortgage along with the arrears cure; the
//     ongoing mortgage amount over the plan term goes INTO the
//     disbursementBase AND inflates the trustee fee. This is the whole
//     point of conduit — the trustee fee climbs because the trustee is
//     handling the additional dollar volume.
//   - mortgageArrearsInPlan = false → ongoing mortgage paid DIRECT by
//     debtor outside the plan; EXCLUDED from disbursementBase; no
//     trustee fee on it.
//
// Trustee-fee multiplier (per-district):
//   - AZ:   8.20%
//   - WA-W: 10%   (Western District of Washington)
//   - WA-E: 10%   (Eastern District of Washington)
// These mirror the spec's ch13_admin_multipliers seed. The portal will
// move this map to a canonical Reference-Rules dataset once persisted;
// for now the seed lives inline so the lib stays framework-free.
//
// Plan term (planMonths) is supplied by the caller — derived from
// ch13Commitment.classifyCommitmentPeriod (≥median → 60, <median → 36
// minimum). cmiMonthly + medianAnnual live in cmi.ts upstream.

export type CH13Venue = "AZ" | "WA-W" | "WA-E";

/** Per-venue Chapter 13 trustee administrative-fee multiplier, expressed
 *  as a PERCENTAGE of the disbursement base. */
export const CH13_ADMIN_MULTIPLIERS: Readonly<Record<CH13Venue, number>> = {
  "AZ":   8.20,
  "WA-W": 10,
  "WA-E": 10,
};

export interface PlanCostInput {
  /** Total unsecured distribution over the life of the plan. */
  unsecuredDistribution: number;
  /** Sum of crammed-down secured payments over the life of the plan
   *  (i.e. amortizeMonthly result × planMonths, across all secured claims). */
  securedCramdownPayments: number;
  /** Mortgage arrears cure (one-time total — § 1322(b)(5)). */
  arrearsCure: number;
  /** Priority unsecured claims paid through the plan (§ 507). */
  priorityClaims: number;
  /** True when the plan cures mortgage arrears (or otherwise places the
   *  mortgage in conduit). Drives conduitRequired. */
  mortgageArrearsInPlan: boolean;
  /** Ongoing post-petition mortgage payments over the plan term (i.e.
   *  monthly mortgage × planMonths). Only enters disbursementBase when
   *  conduit is required. */
  ongoingMortgageOverTerm: number;
  /** Plan term in months. Pull from ch13Commitment.classifyCommitmentPeriod. */
  planMonths: number;
  /** Filing venue — drives the per-district trustee-fee multiplier. */
  venue: CH13Venue;
  /** Attorney override on the trustee multiplier (per-trustee custom %).
   *  When present, supersedes the per-venue default. */
  multiplierOverride?: number | null;
}

export interface PlanCostResult {
  /** True when ongoing mortgage flows through the trustee (conduit). */
  conduitRequired: boolean;
  /** Total dollars the trustee disburses over the plan term. */
  disbursementBase: number;
  /** Trustee administrative fee — disbursementBase × multiplier. */
  trusteeFee: number;
  /** Monthly plan payment debtor pays to the trustee = (base + fee) / months. */
  monthlyPlanPayment: number;
  /** Effective multiplier (% as a number, e.g. 8.2 or 10). */
  multiplierUsed: number;
  /** Per-bucket breakdown — surfaces what's IN the disbursement base. */
  breakdown: {
    unsecuredDistribution: number;
    securedCramdownPayments: number;
    arrearsCure: number;
    priorityClaims: number;
    /** 0 when conduit not required (ongoing mortgage paid direct). */
    ongoingMortgageInBase: number;
  };
}

/** Compute the Ch.13 plan cost. Pure function. */
export function computeCh13PlanCost(input: PlanCostInput): PlanCostResult {
  const conduitRequired = input.mortgageArrearsInPlan === true;
  const ongoingMortgageInBase = conduitRequired ? nonNeg(input.ongoingMortgageOverTerm) : 0;

  const breakdown = {
    unsecuredDistribution:   nonNeg(input.unsecuredDistribution),
    securedCramdownPayments: nonNeg(input.securedCramdownPayments),
    arrearsCure:             nonNeg(input.arrearsCure),
    priorityClaims:          nonNeg(input.priorityClaims),
    ongoingMortgageInBase,
  };

  const disbursementBase =
    breakdown.unsecuredDistribution +
    breakdown.securedCramdownPayments +
    breakdown.arrearsCure +
    breakdown.priorityClaims +
    breakdown.ongoingMortgageInBase;

  const multiplierUsed =
    input.multiplierOverride != null && Number.isFinite(input.multiplierOverride)
      ? nonNeg(input.multiplierOverride)
      : CH13_ADMIN_MULTIPLIERS[input.venue];

  // disbursementBase × (multiplier %) — conduit having inflated the base
  // therefore also inflates this fee. That's intended, not a bug.
  const trusteeFee = disbursementBase * (multiplierUsed / 100);

  const planMonths = Math.max(1, Math.floor(input.planMonths));
  const monthlyPlanPayment = (disbursementBase + trusteeFee) / planMonths;

  return {
    conduitRequired,
    disbursementBase,
    trusteeFee,
    monthlyPlanPayment,
    multiplierUsed,
    breakdown,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function nonNeg(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}
