// Chapter 13 cramdown — § 506(a) bifurcation with hanging-paragraph guard.
//
// Pure-logic library. No React, no persistence, no audit, no portal wiring.
// The Ch.13 review portal consumes this once it's confirmed; today this is
// the locked-in math layer.
//
// § 506(a) — an allowed claim secured by a lien on property is a secured
// claim only "to the extent of the value of such creditor's interest in the
// estate's interest in such property"; any deficiency is a § 506(a)(1)
// unsecured claim. The classic cramdown.
//
// § 1325(a) flush language ("hanging paragraph") — bifurcation is BLOCKED
// when, AND ONLY when, the collateral is RETAINED by the debtor AND either:
//   (a) the claim is a purchase-money security interest (PMSI) in a
//       motor vehicle ACQUIRED FOR THE PERSONAL USE OF THE DEBTOR within
//       the 910-day window before filing, OR
//   (b) the claim is a purchase-money security interest in any other
//       thing of value acquired within the 1-year window before filing.
// When the hanging paragraph applies, the entire claim is treated as
// secured (§ 506(a) bifurcation is unavailable), so the secured portion
// equals the full claim and there is no § 506(a) unsecured deficiency.
//
// Attorney-side reclassification — the spec lets the attorney flag a
// claim as "fully unsecured" in case review (e.g. collateral surrendered,
// no longer held by the debtor). When this flag is set the math collapses:
// secured = 0, unsecured = full claim, and the hanging-paragraph guard is
// moot because there's no retained collateral to protect.

/** Source of the collateral valuation used in the bifurcation math.
 *  Default is KBB private-party value (the firm's house default for
 *  vehicles); the attorney-entered FMV override supersedes the default
 *  when present (per spec — FMV from market comps, mechanic's quote, etc.). */
export type CollateralValuationSource = "kbb_private_party" | "attorney_fmv_override";

/** Inputs to the hanging-paragraph check. The flush language is fact-
 *  specific — the caller marshals the per-claim facts from the schedules
 *  and bankruptcy intake.
 *
 *  Day-count semantics — the caller can supply EITHER form:
 *    - `daysSincePurchase` (numeric) — for use when the caller has already
 *      computed the delta.
 *    - `purchaseDate` + `filingDate` — the library computes
 *      `daysBetween(filingDate, purchaseDate)` internally (whole days,
 *      UTC-anchored to avoid DST drift).
 *  When both forms are present the date pair wins. */
export interface HangingParagraphInput {
  /** True when the collateral is a motor vehicle (the 910-day PMSI rule). */
  isMotorVehicle: boolean;
  /** True when the PMSI vehicle was acquired for the personal use of the
   *  debtor (commercial-use vehicles fall outside the 910-day shield). */
  isPersonalUseVehicle?: boolean;
  /** Days between the date the collateral was acquired / the security
   *  interest attached and the bankruptcy filing date. The 910/365-day
   *  cutoffs read this. Optional when `purchaseDate` + `filingDate` are
   *  supplied. */
  daysSincePurchase?: number;
  /** Date the collateral was acquired (purchase date / SI attachment).
   *  ISO string ("YYYY-MM-DD") or Date. When supplied with `filingDate`,
   *  the library derives `daysSincePurchase` internally. */
  purchaseDate?: string | Date;
  /** Bankruptcy filing date. ISO string or Date. Used with `purchaseDate`
   *  to derive `daysSincePurchase` internally. */
  filingDate?: string | Date;
  /** True when the collateral is non-vehicle purchase-money collateral
   *  (the 1-year / "any other thing of value" branch). */
  isOtherPurchaseMoney?: boolean;
  /** True when the debtor is RETAINING the collateral. The hanging
   *  paragraph only protects retained collateral — surrendered
   *  collateral can still be bifurcated. */
  isRetained: boolean;
}

export interface BifurcationInput {
  /** Total scheduled / allowed claim amount (full balance owed). */
  claimAmount: number;
  /** KBB private-party value — the firm's default valuation source. */
  kbbPrivateParty: number;
  /** Attorney-entered FMV override. When non-null, supersedes KBB. */
  fmvOverride?: number | null;
  /** Hanging-paragraph facts. Omit (or leave isRetained false) to skip
   *  the guard — the math falls through to plain § 506(a) bifurcation. */
  hangingParagraph?: HangingParagraphInput;
  /** Attorney-set reclassification flag. When true, the claim is treated
   *  as fully unsecured: securedValue = 0, unsecuredDeficiency = claim.
   *  The hanging paragraph is moot because the collateral is not retained
   *  (typical trigger: collateral surrendered or no longer in possession). */
  reclassifiedUnsecured?: boolean;
}

export interface BifurcationResult {
  /** Secured portion under § 506(a) (or full claim when the hanging
   *  paragraph protects the claim from bifurcation). */
  securedValue: number;
  /** Unsecured deficiency under § 506(a)(1) — falls into the § 1325(a)(4)
   *  best-interests / unsecured-distribution pool. */
  unsecuredDeficiency: number;
  /** True when § 1325(a) flush language blocks bifurcation. */
  hangingParagraphProtected: boolean;
  /** True when the attorney reclassified the claim as fully unsecured. */
  reclassifiedUnsecured: boolean;
  /** Which collateral valuation source was used (KBB default or FMV
   *  override). Surfaced so the review surface can explain the math. */
  valuationSource: CollateralValuationSource;
  /** Resolved collateral value used in the math (0 when reclassified). */
  collateralValueUsed: number;
  /** Plain-language explanation the attorney UI can render verbatim. */
  note: string;
}

/** Bifurcate a secured claim under § 506(a), respecting the § 1325(a) flush
 *  language ("hanging paragraph") and any attorney reclassification.
 *
 *  Branches:
 *    1. reclassifiedUnsecured = true   → fully unsecured (0 / claim).
 *    2. hanging paragraph applies      → fully secured (claim / 0).
 *    3. plain § 506(a) bifurcation     → min(claim, collat), max(0, claim − collat).
 */
export function bifurcate(input: BifurcationInput): BifurcationResult {
  const claim = nonNeg(input.claimAmount);

  // (1) Attorney reclassification — collateral no longer with debtor.
  if (input.reclassifiedUnsecured) {
    return {
      securedValue: 0,
      unsecuredDeficiency: claim,
      hangingParagraphProtected: false,
      reclassifiedUnsecured: true,
      valuationSource: input.fmvOverride != null ? "attorney_fmv_override" : "kbb_private_party",
      collateralValueUsed: 0,
      note:
        "Claim reclassified as fully unsecured by attorney review (e.g. collateral surrendered " +
        "or no longer held). § 506(a) secured portion = 0; entire claim falls into the unsecured pool.",
    };
  }

  // Resolve the collateral value: attorney FMV override wins over KBB.
  const collateral = nonNeg(
    input.fmvOverride != null && Number.isFinite(input.fmvOverride)
      ? input.fmvOverride
      : input.kbbPrivateParty,
  );
  const valuationSource: CollateralValuationSource =
    input.fmvOverride != null ? "attorney_fmv_override" : "kbb_private_party";

  // (2) Hanging-paragraph guard — § 1325(a) flush language.
  //
  // Day-count resolution: the date pair (purchaseDate + filingDate) wins
  // when both are supplied; otherwise fall back to the numeric
  // daysSincePurchase. Missing on both sides resolves to +Infinity, which
  // pushes the claim outside both windows (no protection) — safer default
  // than 0 days (which would incorrectly trigger protection).
  //
  // Boundary convention (asserted in ch13Cramdown.test.ts):
  //   - vehicle protected when daysSincePurchase ≤ 910 (910 itself is in;
  //     911 is out → bifurcate)
  //   - other purchase-money protected when daysSincePurchase ≤ 365
  //     (365 in; 366 out → bifurcate)
  const hp = input.hangingParagraph;
  const days = hp ? resolveDaysSincePurchase(hp) : Infinity;
  const hangingParagraphProtected = !!hp && hp.isRetained && (
    // Branch A — 910-day PMSI vehicle for personal use.
    (hp.isMotorVehicle && hp.isPersonalUseVehicle === true && days <= 910)
    ||
    // Branch B — 1-year PMSI in any other thing of value.
    (hp.isOtherPurchaseMoney === true && days <= 365)
  );

  if (hangingParagraphProtected) {
    return {
      securedValue: claim,
      unsecuredDeficiency: 0,
      hangingParagraphProtected: true,
      reclassifiedUnsecured: false,
      valuationSource,
      collateralValueUsed: collateral,
      note:
        "§ 1325(a) flush language (hanging paragraph) protects the claim from § 506(a) " +
        "bifurcation: collateral is retained and the PMSI was acquired within the statutory " +
        "window (910 days for personal-use vehicles / 1 year for other purchase-money). " +
        "Entire claim treated as secured; no § 506(a) unsecured deficiency.",
    };
  }

  // (3) Plain § 506(a) bifurcation.
  const securedValue = Math.min(claim, collateral);
  const unsecuredDeficiency = Math.max(0, claim - collateral);
  return {
    securedValue,
    unsecuredDeficiency,
    hangingParagraphProtected: false,
    reclassifiedUnsecured: false,
    valuationSource,
    collateralValueUsed: collateral,
    note:
      `§ 506(a) bifurcation: secured = min(claim, collateral) = $${securedValue.toLocaleString()}; ` +
      `unsecured deficiency = max(0, claim − collateral) = $${unsecuredDeficiency.toLocaleString()}. ` +
      `Collateral value sourced from ${valuationSource === "attorney_fmv_override" ? "attorney FMV override" : "KBB private-party"}.`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function nonNeg(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Whole days between two dates: `later − earlier`. UTC-anchored (uses
 *  `Date.UTC` on the calendar Y/M/D so DST shifts don't bias the count by
 *  ±1). Accepts ISO strings or Date instances. Returns NaN when either
 *  input fails to parse — callers should guard. */
export function daysBetween(later: string | Date, earlier: string | Date): number {
  const a = toUtcDay(later);
  const b = toUtcDay(earlier);
  if (a == null || b == null) return NaN;
  return Math.floor((a - b) / 86_400_000); // ms in a day
}

function toUtcDay(d: string | Date): number | null {
  const parsed = typeof d === "string" ? new Date(d) : d;
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return null;
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

/** Resolve `daysSincePurchase` from either form on the HangingParagraphInput.
 *  Date pair wins when both `purchaseDate` and `filingDate` are present;
 *  falls back to the numeric `daysSincePurchase`; returns +Infinity when
 *  neither is supplied (so the hanging-paragraph windows can't be entered
 *  by accident). Exported so test fixtures can verify the resolution. */
export function resolveDaysSincePurchase(hp: HangingParagraphInput): number {
  if (hp.purchaseDate != null && hp.filingDate != null) {
    const d = daysBetween(hp.filingDate, hp.purchaseDate);
    if (Number.isFinite(d)) return d;
  }
  if (typeof hp.daysSincePurchase === "number" && Number.isFinite(hp.daysSincePurchase)) {
    return hp.daysSincePurchase;
  }
  return Infinity;
}
