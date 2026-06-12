// Pure derivation helpers — turn raw intake form_data into the structured
// inputs the Ch.13 cramdown engine consumes.
//
// React-free. Lives under src/lib so it sits in the vitest scope
// (src/lib/**/*.test.ts) — see ch13Derive.test.ts for the per-case
// fixtures locking these in.
//
// Consumers:
//   - Ch13SigningReview.tsx (component) calls these from useMemo
//     blocks at mount time.
//   - Ch13Eligibility.tsx re-exports the Ch13SecuredClaimInput type so
//     existing imports through that path keep working.

import { sumOtherIncomeIncludedInCMI } from "./cmi";
import type { CH13Venue } from "./ch13PlanCost";

// ─── Types ─────────────────────────────────────────────────────────────────

/** Per-secured-claim input shape consumed by the Ch.13 engine pipeline
 *  (bifurcate → till → amortize → planCost). Pure data; the UI layer
 *  (Ch13Eligibility) adds the FMV-override + D→unsecured controls
 *  on top. */
export interface Ch13SecuredClaimInput {
  id: string;
  label: string;
  claimAmount: number;
  kbbPrivateParty: number;
  fmvOverride?: number | null;
  /** Hanging-paragraph facts (the engine guard). */
  isMotorVehicle: boolean;
  isPersonalUseVehicle?: boolean;
  daysSincePurchase?: number;
  isOtherPurchaseMoney?: boolean;
  isRetained: boolean;
  /** § 1322(b)(2) anti-modification (Nobelman v. American Sav. Bank,
   *  508 U.S. 324 (1993)). When true the claim renders as cure-and-
   *  maintain — NOT §506 bifurcation — and is excluded from the
   *  cramdown amortization sum. */
  antiModification?: boolean;
  /** Cure / maintain figures surfaced on the anti-mod card. The cash
   *  flow itself enters the plan cost via ongoingMortgageOverTerm +
   *  arrearsCure on the parent input. */
  cureArrears?: number;
  ongoingMonthlyPayment?: number;
  collateralAddress?: string;
}

/** Result of deriveBatch3FromIntake. */
export interface Batch3Derived {
  mortgageArrearsInPlan: boolean;
  arrearsCure: number;
  ongoingMortgageOverTerm: number;
  priorityClaims: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Parse a positive number from an unknown intake field. Returns 0 for
 *  invalid / non-positive / non-numeric input. */
function num(v: unknown): number {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Derive Ch13SecuredClaimInput[] from raw intake form_data.
 *
 *  Mappings:
 *    - intake.mortgageBalance + realPropValue → primary-residence mortgage.
 *      Marked antiModification: true per § 1322(b)(2) — the principal
 *      residence is not § 506 bifurcatable even when undersecured
 *      (Nobelman v. American Sav. Bank, 508 U.S. 324 (1993)). The
 *      claim renders as cure-and-maintain and is excluded from the
 *      cramdown amortization sum.
 *    - intake.secondMortgage + secondPropValue → second property
 *      (a separate property, not a junior lien on the principal
 *      residence). Bifurcatable under §506.
 *    - intake.vehicles[].hasLoan === "yes" → per-vehicle secured claim.
 *
 *  TODO leafs preserved for fields intake doesn't capture:
 *    - daysSincePurchase: would need filing-date − (mortgageOriginationDate
 *      | vehicle.loanOriginationDate). Origination-date fields exist in
 *      the schema but aren't reliably populated; left undefined →
 *      engine's resolveDaysSincePurchase returns +Infinity → no
 *      hanging-paragraph protection (safer default than fabricating).
 *    - isPersonalUseVehicle: consumer Ch.13 default true.
 *    - isRetained: Statement of Intention not in raw intake. Default true.
 *    - isOtherPurchaseMoney: no field for non-vehicle, non-mortgage
 *      purchase-money (e.g. furniture financing). */
export function deriveSecuredClaims(
  formData: Record<string, unknown> | null,
): ReadonlyArray<Ch13SecuredClaimInput> {
  if (!formData) return [];
  const out: Ch13SecuredClaimInput[] = [];

  // Primary residence mortgage — § 1322(b)(2) anti-modification.
  const mortBal = num(formData.mortgageBalance);
  if (mortBal > 0) {
    const addr = String(formData.realPropAddress ?? "").trim();
    out.push({
      id: "mortgage-primary",
      label: `Mortgage — primary residence${addr ? ` (${addr})` : ""}`,
      claimAmount: mortBal,
      kbbPrivateParty: num(formData.realPropValue),
      isMotorVehicle: false,
      isOtherPurchaseMoney: false,
      isRetained: true,
      antiModification: true,
      cureArrears: num(formData.mortgageArrears),
      ongoingMonthlyPayment: num(formData.mortgageMonthlyPayment),
      collateralAddress: addr || undefined,
    });
  }

  // Second property mortgage (not a junior lien on the principal
  // residence — see Ch13Eligibility's strip-eligibility footnote).
  const secondBal = num(formData.secondMortgage);
  if (secondBal > 0) {
    const secondAddr = String(formData.secondPropAddress ?? "").trim();
    out.push({
      id: "mortgage-second",
      label: `Mortgage — second property${secondAddr ? ` (${secondAddr})` : ""}`,
      claimAmount: secondBal,
      kbbPrivateParty: num(formData.secondPropValue),
      isMotorVehicle: false,
      isOtherPurchaseMoney: false,
      isRetained: true,
    });
  }

  // Vehicles with loans.
  const vehicles = Array.isArray(formData.vehicles) ? formData.vehicles : [];
  vehicles.forEach((vRaw, i) => {
    const v = vRaw as Record<string, unknown>;
    if (v?.hasLoan !== "yes") return;
    const bal = num(v.loanBalance);
    if (bal <= 0) return;
    const year = String(v.year ?? "").trim();
    const make = String(v.make ?? "").trim();
    const model = String(v.model ?? "").trim();
    const desc = [year, make, model].filter(Boolean).join(" ") || "vehicle";
    out.push({
      id: `vehicle-${i}`,
      label: `Auto loan — ${desc}`,
      claimAmount: bal,
      kbbPrivateParty: num(v.value),
      isMotorVehicle: true,
      isPersonalUseVehicle: true,
      isRetained: true,
    });
  });

  return out;
}

/** Batch 3 — derive plan-cost inputs from intake form_data.
 *
 *  mortgageArrearsInPlan: arrears > 0 OR mortgageCurrent === "no".
 *    Either signal indicates the mortgage is being cured in the plan,
 *    which triggers the conduit (trustee disburses ongoing mortgage).
 *  arrearsCure: parseFloat(formData.mortgageArrears).
 *  ongoingMortgageOverTerm: monthly payment × planMonths.
 *  priorityClaims: today reads formData.taxDebt (the priority-class field
 *    intake captures today). TODO leaf — extend to domestic-support
 *    arrears, employee wages, etc. when intake captures those. */
export function deriveBatch3FromIntake(
  formData: Record<string, unknown> | null,
  planMonths: number,
): Batch3Derived {
  if (!formData) {
    return { mortgageArrearsInPlan: false, arrearsCure: 0, ongoingMortgageOverTerm: 0, priorityClaims: 0 };
  }
  const arrears = num(formData.mortgageArrears);
  const monthly = num(formData.mortgageMonthlyPayment);
  const mortgageCurrent = String(formData.mortgageCurrent ?? "").toLowerCase();
  // Conduit-trigger: arrears > 0 OR mortgageCurrent === "no". Either way
  // the plan needs to cure the arrears, and the conduit-on path applies.
  const mortgageArrearsInPlan = arrears > 0 || (mortgageCurrent === "no");
  return {
    mortgageArrearsInPlan,
    arrearsCure: arrears,
    ongoingMortgageOverTerm: monthly * planMonths,
    priorityClaims: num(formData.taxDebt),
  };
}

/** Derive a CH13Venue from the firm's primary filing state. Today AZ
 *  maps cleanly; WA defaults to W.D. (the higher-volume district).
 *  Returns "AZ" for uncovered states — flagged inline in code so the
 *  enum extension is obvious when a new filing state lands. */
export function deriveVenue(firmPrimaryState: string): CH13Venue {
  const s = firmPrimaryState.trim().toLowerCase();
  if (s === "arizona") return "AZ";
  if (s === "washington") return "WA-W";
  return "AZ";
}

/** Compute household size from intake form_data. filingType=joint adds
 *  the spouse; numDependents is added on top. Always at least 1. */
export function deriveHouseholdSize(formData: Record<string, unknown> | null): number {
  if (!formData) return 1;
  const isJoint = formData.filingType === "joint";
  const numDeps = parseInt(String(formData.numDependents ?? "0")) || 0;
  return Math.max(1, (isJoint ? 2 : 1) + numDeps);
}

/** Monthly CMI — prefer a pre-computed cmiMonthly the questionnaire
 *  writes when available; otherwise sum the broad "other income"
 *  included-in-CMI fields via the cmi.ts helper. */
export function deriveCmiMonthly(formData: Record<string, unknown> | null): number {
  if (!formData) return 0;
  const pre = parseFloat(String(formData.cmiMonthly ?? ""));
  if (Number.isFinite(pre) && pre > 0) return pre;
  return sumOtherIncomeIncludedInCMI(formData);
}

/** Pure gate for "should the UI display confident plan-cost figures?"
 *  Returns false when the median is null (commitment period not
 *  classified) — the displayed trustee fee + monthly plan payment must
 *  not read as authoritative because they could be wrong for a below-
 *  median debtor entitled to the 36-month plan. */
export function isMedianAvailable(medianAnnual: number | null): boolean {
  return medianAnnual != null;
}
