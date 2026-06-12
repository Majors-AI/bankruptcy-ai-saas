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
  /** Junior liens on the SAME collateral, in lien-priority order.
   *  Used by the In re Zimmer / In re Tanner / In re Lane strip-
   *  eligibility detection on the principal residence: a junior is
   *  wholly unsecured (and only then strip-eligible, jurisdiction-
   *  dependent) when collateral value is fully consumed by senior
   *  balances before this position. Primary authority in the 9th Cir.
   *  (AZ + WA) is In re Zimmer, 313 F.3d 1220 (9th Cir. 2002); accord
   *  In re Tanner (11th Cir.) and In re Lane (6th Cir.). Intake
   *  doesn't capture junior liens — attorney-entered on the anti-mod
   *  claim card. */
  juniorLiens?: ReadonlyArray<JuniorLien>;
}

export interface JuniorLien {
  id: string;
  label: string;
  balance: number;
  /** Lien position ≥ 2 (1 = the senior itself). */
  position: number;
}

/** Pure helper. Given a senior balance, collateral value, and the
 *  juniors stacked above it, returns each junior tagged with whether
 *  it's wholly unsecured (strip-eligible on the principal residence
 *  under In re Zimmer, 313 F.3d 1220 (9th Cir. 2002) — primary for
 *  AZ/WA; accord In re Tanner (11th Cir.) and In re Lane (6th Cir.))
 *  and the equity cushion remaining at that lien's position. */
export function classifyJuniorLiens(input: {
  collateralValue: number;
  seniorBalance: number;
  juniors: ReadonlyArray<JuniorLien>;
}): Array<{
  lien: JuniorLien;
  whollyUnsecured: boolean;
  cushionAtThisPosition: number;
}> {
  const sorted = [...input.juniors].sort((a, b) => a.position - b.position);
  let cumulativeSeniors = Math.max(0, input.seniorBalance);
  const out: Array<{
    lien: JuniorLien;
    whollyUnsecured: boolean;
    cushionAtThisPosition: number;
  }> = [];
  for (const lien of sorted) {
    const cushion = input.collateralValue - cumulativeSeniors;
    out.push({
      lien,
      whollyUnsecured: cushion <= 0,
      cushionAtThisPosition: cushion,
    });
    cumulativeSeniors += Math.max(0, lien.balance);
  }
  return out;
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
 *  arrearsCure: parseFloat(formData.mortgageArrears).
 *  ongoingMortgageOverTerm: monthly payment × planMonths.
 *  priorityClaims: sum of the § 507 categories intake captures. Today:
 *    - taxDebt        — formData.taxDebt
 *    - DSO arrears    — formData.dsoArrears (domestic-support arrears)
 *    - wage priority  — formData.wagePriority (last 180 days wages owed
 *                       by debtor-employer; § 507(a)(4))
 *  Attorney can override the total with formData._attorneyPriorityOverride
 *  when present (set on the Ch13Eligibility surface). */
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
  const mortgageArrearsInPlan = arrears > 0 || (mortgageCurrent === "no");

  // Attorney override wins when set; otherwise sum the captured categories.
  const overrideRaw = parseFloat(String(formData._attorneyPriorityOverride ?? ""));
  const priorityClaims = Number.isFinite(overrideRaw) && overrideRaw >= 0
    ? overrideRaw
    : (num(formData.taxDebt) + num(formData.dsoArrears) + num(formData.wagePriority));

  return {
    mortgageArrearsInPlan,
    arrearsCure: arrears,
    ongoingMortgageOverTerm: monthly * planMonths,
    priorityClaims,
  };
}

/** Canonical WA county → bankruptcy-district map.
 *  W.D. Wash. covers the western/coastal counties; E.D. Wash. covers
 *  the counties east of the Cascade crest. Source: 28 U.S.C. § 128.
 *  Lowercase keys for case-insensitive lookup.
 *
 *  TODO: if Dom wants ID/MT/AK/OR districts in the engine later,
 *  extend the CH13Venue enum + CH13_ADMIN_MULTIPLIERS in
 *  ch13PlanCost.ts alongside expanding this map. */
const WA_COUNTY_TO_DISTRICT: Readonly<Record<string, "WA-W" | "WA-E">> = {
  // W.D. Wash. — 19 counties.
  clallam: "WA-W", clark: "WA-W", cowlitz: "WA-W", grays_harbor: "WA-W",
  island: "WA-W", jefferson: "WA-W", king: "WA-W", kitsap: "WA-W",
  lewis: "WA-W", mason: "WA-W", pacific: "WA-W", pierce: "WA-W",
  san_juan: "WA-W", skagit: "WA-W", skamania: "WA-W", snohomish: "WA-W",
  thurston: "WA-W", wahkiakum: "WA-W", whatcom: "WA-W",
  // E.D. Wash. — 20 counties.
  adams: "WA-E", asotin: "WA-E", benton: "WA-E", chelan: "WA-E",
  columbia: "WA-E", douglas: "WA-E", ferry: "WA-E", franklin: "WA-E",
  garfield: "WA-E", grant: "WA-E", kittitas: "WA-E", klickitat: "WA-E",
  lincoln: "WA-E", okanogan: "WA-E", pend_oreille: "WA-E", spokane: "WA-E",
  stevens: "WA-E", walla_walla: "WA-E", whitman: "WA-E", yakima: "WA-E",
};

function normalizeCountyKey(county: string): string {
  return county.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Look up the WA district for a county. Returns null when the county
 *  isn't in the map. Exported so tests can pin per-county resolution. */
export function resolveWaDistrict(county: string | null | undefined): "WA-W" | "WA-E" | null {
  if (!county) return null;
  return WA_COUNTY_TO_DISTRICT[normalizeCountyKey(county)] ?? null;
}

/** Derive a CH13Venue.
 *
 *  The case state wins over the firm's primary state when supplied —
 *  a WA case under an AZ-primary firm files in WA, not AZ. When no
 *  case state is passed, falls back to firmPrimaryState (preserves the
 *  prior call sites). Returns "AZ" for uncovered states — flagged
 *  inline so the enum extension is obvious when a new filing state
 *  lands.
 *
 *  WA W.D. vs E.D. resolves via the canonical county→district table
 *  when a county is supplied. Without a county the WA fallback is
 *  "WA-W" (higher filing volume); attorneys can confirm/override at
 *  the case level. */
export function deriveVenue(
  firmPrimaryState: string,
  caseState?: string | null,
  caseCounty?: string | null,
): CH13Venue {
  const effective = (caseState && caseState.trim() ? caseState : firmPrimaryState).trim().toLowerCase();
  if (effective === "arizona" || effective === "az") return "AZ";
  if (effective === "washington" || effective === "wa") {
    const byCounty = resolveWaDistrict(caseCounty);
    return byCounty ?? "WA-W";
  }
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
