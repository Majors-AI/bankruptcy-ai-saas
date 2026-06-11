// Chapter 13 commitment period + 100% payoff classification.
//
// § 1325(b)(4) — applicable commitment period:
//   - annualized CMI AT OR ABOVE the state median (by household size) →
//     applicable commitment period is FIVE (5) YEARS / 60 months.
//   - annualized CMI BELOW the state median → THREE (3) YEARS / 36 months
//     minimum; the debtor may always ELECT a 5-year (60-month) plan if it
//     improves feasibility.
//
// § 1325(b)(1)(A) — projected disposable income devotion. A plan that pays
// 100% of allowed unsecured claims satisfies the DMI-devotion requirement
// even if the debtor retains surplus monthly income; the trustee cannot
// object on the DMI-devotion ground. NOTE — this does NOT eliminate the
// applicable commitment period under § 1325(b)(4): courts split on
// whether a 100% plan may run shorter than 60 months for above-median
// debtors. Many districts permit "100% plans" to complete earlier; we
// REPORT that possibility but do not enforce statutory math here.

export type ChapterCommitmentPeriod =
  | { months: 60; basis: "above_median"; description: string }
  | { months: 36; basis: "below_median_minimum"; description: string; alsoElectable60: true }
  | { months: number; basis: "unknown"; description: string };

export interface CommitmentClassification {
  /** Applicable commitment period per § 1325(b)(4). */
  period: ChapterCommitmentPeriod;
  /** Annualized CMI used for the comparison ($/yr). */
  cmiAnnual: number;
  /** State median ($/yr) for the debtor's household size. */
  medianAnnual: number;
  /** True when at/above median — drives the 60-month branch. */
  aboveMedian: boolean;
}

export interface HundredPercentPayoffClassification {
  /** True when the plan pays 100% of allowed unsecured claims, satisfying
   *  § 1325(b)(1)(A) DMI-devotion regardless of surplus income. */
  isHundredPercent: boolean;
  /** Plain-language summary the attorney UI surfaces alongside the
   *  commitment-period label. */
  summary: string;
  /** True when the firm can REPORT that the plan may run shorter than the
   *  applicable commitment period (district-dependent; not enforced). */
  canRunShorterThanCommitment: boolean;
}

/** Classify the applicable commitment period for a case. */
export function classifyCommitmentPeriod(input: {
  cmiMonthly: number;
  medianAnnual: number;
}): CommitmentClassification {
  const cmiAnnual = input.cmiMonthly * 12;
  const medianAnnual = input.medianAnnual;
  const aboveMedian = cmiAnnual >= medianAnnual;

  if (aboveMedian) {
    return {
      cmiAnnual, medianAnnual, aboveMedian,
      period: {
        months: 60,
        basis: "above_median",
        description:
          "At or above state median for household size — § 1325(b)(4) applicable commitment period is 60 months.",
      },
    };
  }
  return {
    cmiAnnual, medianAnnual, aboveMedian,
    period: {
      months: 36,
      basis: "below_median_minimum",
      description:
        "Below state median — § 1325(b)(4) applicable commitment period minimum is 36 months. The debtor may ELECT a 60-month plan if it improves feasibility.",
      alsoElectable60: true,
    },
  };
}

/** Classify whether the plan pays 100% of allowed unsecured claims. The
 *  caller passes the plan's projected payment to unsecured creditors and
 *  the total allowed unsecured claim amount; the helper returns the
 *  classification + the plain-language summary. */
export function classifyHundredPercentPayoff(input: {
  unsecuredPlanPayment: number;
  totalAllowedUnsecured: number;
  applicableCommitmentMonths: number;
}): HundredPercentPayoffClassification {
  const denom = input.totalAllowedUnsecured;
  if (denom <= 0) {
    return {
      isHundredPercent: false,
      summary: "No unsecured claims to evaluate — § 1325(b)(1)(A) DMI devotion test does not apply.",
      canRunShorterThanCommitment: false,
    };
  }
  const ratio = input.unsecuredPlanPayment / denom;
  const isHundred = ratio >= 1.0;
  if (isHundred) {
    return {
      isHundredPercent: true,
      summary:
        `Plan pays 100% of allowed unsecured claims (${Math.round(ratio * 100)}%). ` +
        `§ 1325(b)(1)(A) all-DMI-devotion requirement is satisfied; surplus monthly income is permitted ` +
        `and the trustee cannot object on DMI-devotion grounds. ` +
        `Some districts permit a 100% plan to complete in fewer than ${input.applicableCommitmentMonths} months — ` +
        `confirm the local-rules + trustee position before assuming a shorter term.`,
      canRunShorterThanCommitment: true,
    };
  }
  return {
    isHundredPercent: false,
    summary:
      `Plan pays ${Math.round(ratio * 100)}% of allowed unsecured claims — § 1325(b)(1)(A) requires all ` +
      `projected disposable income to be devoted to the plan for the ${input.applicableCommitmentMonths}-month applicable commitment period.`,
    canRunShorterThanCommitment: false,
  };
}
