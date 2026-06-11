// Long-form means-test allowable-deduction engine — Form 122A-2 / 122C-2.
//
// Pure computation. Consumes:
//   - IRS standards from src/lib/irsMeansStandards.ts (canonical store)
//   - The firm living-standards overlay via getEffectiveLivingStandard()
//   - The case's form_data for actuals + secured-debt + priority data
//
// DOES NOT fabricate IRS standards or statutory caps. When a required
// figure isn't loaded (out-of-pocket health-care standard; non-AZ/WA
// jurisdictions for Local Standards; the per-child education cap;
// charitable-contribution percentage; the Ch.13 trustee % multiplier),
// the line returns a `pending: true` flag with a `gap` reason — the UI
// surfaces it as "data not loaded" rather than guessing.
//
// Standards-default + override pattern: each line carries a
// `standardValue` (what the IRS allowable would be) and `effectiveValue`
// (after the per-case attorney override is applied). The override is a
// separate keyed override-set the caller passes in; the engine doesn't
// own override storage (that lives in src/lib/meansTestOverrides.ts).
//
// Statutory math is NOT altered here. Where statutory math is ambiguous
// (e.g. the operating-line "no-vehicle → public transit only" branch,
// or the housing/ownership "average monthly payment" definition) the
// engine implements the conservative reading and flags it for the
// attorney to verify.

import {
  scaleNationalStandards2025, NATIONAL_STANDARDS_2025_META,
  getHousing2025, getTransportationOperating2025, IRS_TRANSPORTATION_2025,
} from "./irsMeansStandards";
import { getEffectiveLivingStandard } from "../components/law-firm-settings/livingStandardsOverlay";

// ─── Shapes ────────────────────────────────────────────────────────────────

/** Per-line deduction result. Every line has a path key (the same shape
 *  used by rulesAuditStore + the firm overlay) so re-review diffing
 *  fires uniformly. */
export interface DeductionLine {
  /** Stable identifier — also used as the override-store key and the
   *  re-review path. Format: `means_test.<category>.<sub>`. */
  path: string;
  /** Human-readable label shown in the UI + audit log. */
  label: string;
  /** Statutory citation (Form line, U.S.C. section) for attorney audit. */
  citation: string;
  /** What the IRS standard would be for this case, BEFORE the attorney's
   *  per-case override. null when the standard isn't loaded — see `gap`. */
  standardValue: number | null;
  /** Effective value the deduction actually contributes — overlay /
   *  attorney override applied. null when pending data. */
  effectiveValue: number | null;
  /** Optional actual-from-debtor figure for side-by-side display
   *  (informational; doesn't enter the long-form total). */
  actualValue?: number | null;
  /** When the line can't be computed because a required input isn't
   *  loaded (parked health-care standard; non-AZ/WA county; missing
   *  secured-payment data), the engine returns pending=true + a gap
   *  reason. The line is excluded from the running total. */
  pending: boolean;
  gap?: string;
  /** Human-readable note (e.g. "reduced by avg monthly secured-home
   *  payments of $X, floored at 0"). */
  note?: string;
}

export interface DeductionCategory {
  key: string;
  label: string;
  citation: string;
  lines: DeductionLine[];
}

export interface DeductionEngineInput {
  /** Case form_data — same shape AttorneyIntakeDashboard + SigningReview
   *  pass into computeTotalExpenses today. Used for actuals + secured-
   *  payment + family-size + vehicle-count reads. */
  formData: Record<string, unknown>;
  /** Household size — caller computes via the existing
   *  computeHouseholdSize() so the engine doesn't duplicate the joint /
   *  dependents math. */
  householdSize: number;
  /** Debtor county — drives the Local Housing & Utilities lookup. */
  county?: string | null;
  /** Debtor state — drives the Local Housing & Utilities + Local
   *  Transportation lookups. Accepts "AZ" / "WA" / etc. */
  state?: string | null;
  /** Region / metro for the operating line lookup. Pass the larger of
   *  metro OR region; the engine tries metro first then falls back to
   *  the region. */
  metroOrRegion?: string | null;
  /** Number of vehicles (debtor + spouse) for the ownership +
   *  operating-by-vehicle-count branch. Capped at 2 in the math. */
  vehicleCount: number;
  /** Per-case attorney overrides keyed by path. Lines fall back to the
   *  IRS standard when no override is set. */
  overrides: ReadonlyMap<string, number | null>;
  /** Ch.13 projected plan payment (monthly) — drives the trustee-admin
   *  multiplier. Pass 0 / undefined for Ch.7 cases. */
  projectedPlanPaymentMonthly?: number;
}

export interface DeductionEngineResult {
  categories: DeductionCategory[];
  totalAllowableMonthly: number;
  pendingLines: DeductionLine[];
  /** Effective version key (per-line path + value + overrides) so the
   *  attorney surface can diff against a stamped review version. */
  versionSnapshot: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function num(v: unknown): number {
  const n = parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

function nationalSizeKey(size: number): 1 | 2 | 3 | 4 | -1 {
  if (size <= 1) return 1;
  if (size === 2) return 2;
  if (size === 3) return 3;
  if (size === 4) return 4;
  return -1;
}

function resolveOverride(overrides: ReadonlyMap<string, number | null>, path: string, fallback: number | null): number | null {
  if (!overrides.has(path)) return fallback;
  return overrides.get(path) ?? null;
}

function applyOverlay(path: string, canonical: number | null): number | null {
  return getEffectiveLivingStandard(path, canonical);
}

// ─── Category builders ─────────────────────────────────────────────────────

function buildNationalStandards(input: DeductionEngineInput): DeductionCategory {
  const size = nationalSizeKey(input.householdSize);
  const row = scaleNationalStandards2025(input.householdSize);
  const meta = NATIONAL_STANDARDS_2025_META;

  // The five National-Standards lines that ARE loaded. Each individual
  // line consumes the overlay so a firm raising "food" for AZ flows in.
  const lineFor = (
    field: "food" | "housekeepingSupplies" | "apparelServices" | "personalCare" | "miscellaneous",
    label: string,
  ): DeductionLine => {
    const canonical = (row as unknown as Record<string, number | null>)[field];
    const path = `means_test.national.${field}.size${size}`;
    const standardWithOverlay = applyOverlay(`living_standards.national.${field}.size${size}`, canonical);
    const overridden = resolveOverride(input.overrides, path, standardWithOverlay);
    const pending = overridden == null;
    return {
      path,
      label,
      citation: `Form 122A-2 line 6 / 122C-2 line 6 (IRS National Standards, ${meta.effectiveDate})`,
      standardValue: standardWithOverlay,
      effectiveValue: overridden ?? null,
      pending,
      gap: pending ? "Loaded value is null in the National Standards table." : undefined,
    };
  };

  const lines: DeductionLine[] = [
    lineFor("food",                 "Food"),
    lineFor("housekeepingSupplies", "Housekeeping supplies"),
    lineFor("apparelServices",      "Apparel & services"),
    lineFor("personalCare",         "Personal care products & services"),
    lineFor("miscellaneous",        "Miscellaneous"),
  ];

  // Out-of-pocket health-care standard — PARKED in the store (per-person by
  // age bracket; not loaded). Emit a pending line so the attorney sees it
  // in the deduction breakdown and the UI can flag the dependency.
  lines.push({
    path: `means_test.national.outOfPocketHealth.size${size}`,
    label: "Out-of-pocket health care (per-person by age band)",
    citation: "Form 122A-2 line 7 / 122C-2 line 7",
    standardValue: null,
    effectiveValue: null,
    pending: true,
    gap: "IRS out-of-pocket health-care standard not loaded — per-person by age band table is parked in the store (see NATIONAL_STANDARDS_2025_META).",
  });

  return {
    key: "national",
    label: "IRS National Standards",
    citation: "Form 122A-2 lines 6–7 / 122C-2 lines 6–7",
    lines,
  };
}

function buildLocalHousing(input: DeductionEngineInput): DeductionCategory {
  const lines: DeductionLine[] = [];
  const stateUp = (input.state ?? "").toUpperCase();
  const county = input.county ?? "";

  // Insurance + operating line: full standard amount, no reduction.
  const insOpStandard = getHousing2025(stateUp, county, input.householdSize);
  const insOpPath = `means_test.housing.insurance_operating.${stateUp}.${county}.size${input.householdSize}`;
  if (insOpStandard == null) {
    lines.push({
      path: insOpPath,
      label: "Insurance / operating (housing & utilities)",
      citation: "Form 122A-2 line 8 / 122C-2 line 8 (IRS Local Standards — Housing & Utilities)",
      standardValue: null,
      effectiveValue: null,
      pending: true,
      gap: !county
        ? "Debtor county not set on the case."
        : `Local Standards Housing/Utilities not loaded for ${stateUp || "(state)"} / ${county}. Today AZ + WA are loaded.`,
    });
  } else {
    const overlayPath = `living_standards.housing.${stateUp}.${county}.size${input.householdSize}`;
    const overlayed = applyOverlay(overlayPath, insOpStandard);
    const overridden = resolveOverride(input.overrides, insOpPath, overlayed);
    lines.push({
      path: insOpPath,
      label: "Insurance / operating (housing & utilities)",
      citation: "Form 122A-2 line 8 / 122C-2 line 8",
      standardValue: overlayed,
      effectiveValue: overridden,
      pending: overridden == null,
    });
  }

  // Mortgage/rent line: standard housing minus avg monthly payment on
  // debts secured by the home, floored at 0. The store currently exposes
  // a SINGLE housing-utility number per (state, county, size); the
  // insurance/operating split is a TODO in the data. Conservative reading
  // — until the split lands, we treat the loaded number as the combined
  // standard and ALSO emit a mortgage/rent line tagged "split-pending".
  const homePmt = (
    num(input.formData.realPropMonthlyPayment)
    + num(input.formData.secondMortgagePayment)
  );
  const mortgagePath = `means_test.housing.mortgage_rent.${stateUp}.${county}.size${input.householdSize}`;
  if (insOpStandard == null) {
    lines.push({
      path: mortgagePath,
      label: "Mortgage / rent (standard − avg secured-home payments, floor 0)",
      citation: "Form 122A-2 line 9 / 122C-2 line 9",
      standardValue: null,
      effectiveValue: null,
      pending: true,
      gap: "Same dependency as the insurance/operating line above.",
      actualValue: homePmt,
    });
  } else {
    // CONSERVATIVE: until the operating-vs-mortgage SPLIT is loaded, we
    // surface the mortgage-line using the SAME standard total and flag
    // the split-pending gap. The attorney can override per-case. The
    // floor-at-0 math still applies so the line never adds negative.
    const reduced = Math.max(0, insOpStandard - homePmt);
    const reducedPath = `means_test.housing.mortgage_rent.${stateUp}.${county}.size${input.householdSize}`;
    const overlayed = applyOverlay(`living_standards.housing.${stateUp}.${county}.size${input.householdSize}`, reduced);
    const overridden = resolveOverride(input.overrides, reducedPath, overlayed);
    lines.push({
      path: mortgagePath,
      label: "Mortgage / rent (standard − avg secured-home payments, floor 0)",
      citation: "Form 122A-2 line 9 / 122C-2 line 9",
      standardValue: overlayed,
      effectiveValue: overridden,
      pending: false,
      actualValue: homePmt,
      note:
        `Standard = $${insOpStandard.toLocaleString()} (combined housing-utility) reduced by avg monthly ` +
        `secured-home payments $${homePmt.toLocaleString()}, floored at 0. ` +
        `Split between insurance/operating and mortgage/rent is not yet broken out in the store — ` +
        `attorney should confirm against the published UST split for this district.`,
    });
  }

  return {
    key: "housing",
    label: "Local Standards — Housing & Utilities",
    citation: "Form 122A-2 lines 8–9 / 122C-2 lines 8–9",
    lines,
  };
}

function buildLocalTransportation(input: DeductionEngineInput): DeductionCategory {
  const lines: DeductionLine[] = [];
  const region = input.metroOrRegion ?? "";
  const vehicleCount = Math.max(0, Math.min(2, Math.floor(input.vehicleCount)));

  // Operating line: ownership-paired allowance by region/metro × number
  // of vehicles. If no vehicle, the debtor takes the PUBLIC TRANSIT
  // allowance instead (NOT reduced).
  const operatingPath = `means_test.transportation.operating.${region}.veh${vehicleCount}`;
  if (vehicleCount === 0) {
    const transitStandard = IRS_TRANSPORTATION_2025.publicTransitNational;
    const overlayed = applyOverlay(`living_standards.transportation.publicTransit`, transitStandard);
    const overridden = resolveOverride(input.overrides, operatingPath, overlayed);
    lines.push({
      path: operatingPath,
      label: "Public transit (no vehicle)",
      citation: "Form 122A-2 line 12 / 122C-2 line 12 (IRS Public Transportation allowance)",
      standardValue: overlayed,
      effectiveValue: overridden,
      pending: overridden == null,
    });
  } else {
    const pair = region ? getTransportationOperating2025(region) : null;
    if (!pair) {
      lines.push({
        path: operatingPath,
        label: "Operating (by region/metro × vehicle count)",
        citation: "Form 122A-2 line 12 / 122C-2 line 12",
        standardValue: null,
        effectiveValue: null,
        pending: true,
        gap: region
          ? `Operating allowance not loaded for region/metro "${region}". Today: full regional + metro table loaded for Northeast / Midwest / South / West.`
          : "No region/metro set on the case — required for the operating allowance lookup.",
      });
    } else {
      const opStandard = vehicleCount === 1 ? pair.one : pair.two;
      const overlayed = applyOverlay(`living_standards.transportation.operating.${region}.veh${vehicleCount}`, opStandard);
      const overridden = resolveOverride(input.overrides, operatingPath, overlayed);
      lines.push({
        path: operatingPath,
        label: `Operating (${region}, ${vehicleCount === 1 ? "one vehicle" : "two vehicles"})`,
        citation: "Form 122A-2 line 12 / 122C-2 line 12",
        standardValue: overlayed,
        effectiveValue: overridden,
        pending: overridden == null,
        note: "Not reduced by vehicle payments — operating allowance is independent of ownership.",
      });
    }
  }

  // Ownership line: per-vehicle national ownership allowance × vehicle
  // count (up to 2) MINUS the average monthly payment on debts secured
  // by that vehicle, floored at 0. Vehicle payments come from
  // formData.vehicles[].monthlyPayment.
  const vehicles = Array.isArray(input.formData.vehicles)
    ? (input.formData.vehicles as Array<Record<string, unknown>>)
    : [];
  // First two vehicles per § 707(b) / Form 122 convention.
  const owned = vehicles.slice(0, 2);
  const ownershipNat = IRS_TRANSPORTATION_2025.ownershipNational;

  owned.forEach((v, i) => {
    const vehStandard = ownershipNat.one; // per-vehicle: each vehicle gets the "one-car" national ownership.
    const vehPmt = num(v.monthlyPayment);
    const reduced = Math.max(0, vehStandard - vehPmt);
    const path = `means_test.transportation.ownership.veh${i + 1}`;
    const overlayed = applyOverlay(`living_standards.transportation.ownership.${i + 1}`, reduced);
    const overridden = resolveOverride(input.overrides, path, overlayed);
    lines.push({
      path,
      label: `Ownership — vehicle ${i + 1} (national allowance − avg secured payment, floor 0)`,
      citation: "Form 122A-2 line 13 / 122C-2 line 13",
      standardValue: overlayed,
      effectiveValue: overridden,
      pending: overridden == null,
      actualValue: vehPmt,
      note: `Per-vehicle ownership $${vehStandard} − avg secured payment $${vehPmt.toLocaleString()} = $${reduced.toLocaleString()}, floored at 0.`,
    });
  });

  return {
    key: "transportation",
    label: "Local Standards — Transportation",
    citation: "Form 122A-2 lines 12–13 / 122C-2 lines 12–13",
    lines,
  };
}

// ─── Other Necessary Expenses (actuals — § 707(b)(2)(A)(ii)(I)) ────────────

function buildOtherNecessary(input: DeductionEngineInput): DeductionCategory {
  const fd = input.formData;
  const item = (path: string, label: string, citation: string, actual: number, note?: string): DeductionLine => {
    const overridden = resolveOverride(input.overrides, path, actual);
    return {
      path, label, citation,
      standardValue: actual,
      effectiveValue: overridden,
      actualValue: actual,
      pending: false,
      note,
    };
  };

  const lines: DeductionLine[] = [
    item("means_test.other.taxes",       "Taxes (federal, state, local — actuals)",
      "Form 122A-2 line 16 / 122C-2 line 16", num(fd.expFederalTaxes) + num(fd.expStateTaxes) + num(fd.expAddlTaxes)),
    item("means_test.other.payroll_mandatory", "Mandatory / involuntary payroll deductions",
      "Form 122A-2 line 17 / 122C-2 line 17", num(fd.expMandatoryPayroll)),
    item("means_test.other.term_life",   "Term life insurance (debtor's own life)",
      "Form 122A-2 line 18 / 122C-2 line 18", num(fd.expInsLife)),
    item("means_test.other.court_ordered", "Court-ordered payments (child support / alimony paid)",
      "Form 122A-2 line 19 / 122C-2 line 19", num(fd.expAlimonyPaid) + num(fd.expSupportOthers)),
    item("means_test.other.education_employment", "Education for employment / a disabled child",
      "Form 122A-2 line 20 / 122C-2 line 20", num(fd.expEducationForEmployment)),
    item("means_test.other.childcare",   "Childcare",
      "Form 122A-2 line 21 / 122C-2 line 21", num(fd.expChildcare)),
    item("means_test.other.telecom_beyond_basic", "Telecom beyond basic (cell, internet, etc.)",
      "Form 122A-2 line 22 / 122C-2 line 22", num(fd.expPhone) + num(fd.expInternet)),
  ];
  return {
    key: "other_necessary",
    label: "Other Necessary Expenses (actuals)",
    citation: "Form 122A-2 lines 16–22 / 122C-2 lines 16–22 — § 707(b)(2)(A)(ii)(I)",
    lines,
  };
}

// ─── Additional deductions (statutory; § 707(b)(2)(A)(ii)(II)–(V)) ─────────

function buildAdditional(input: DeductionEngineInput): DeductionCategory {
  const fd = input.formData;
  const item = (path: string, label: string, citation: string, value: number, pending: boolean, gap?: string, note?: string): DeductionLine => {
    const overridden = resolveOverride(input.overrides, path, pending ? null : value);
    return {
      path, label, citation,
      standardValue: pending ? null : value,
      effectiveValue: overridden,
      actualValue: value,
      pending: pending && overridden == null,
      gap, note,
    };
  };

  const lines: DeductionLine[] = [
    item("means_test.additional.health_disability_hsa",
      "Health insurance + disability insurance + HSA",
      "Form 122A-2 line 25 / 122C-2 line 25 — § 707(b)(2)(A)(ii)(III)",
      num(fd.expInsHealth) + num(fd.expInsDisability) + num(fd.expHSA), false),
    item("means_test.additional.elderly_ill_disabled_care",
      "Care of elderly, chronically ill, or disabled household/family member",
      "Form 122A-2 line 26 / 122C-2 line 26 — § 707(b)(2)(A)(ii)(II)",
      num(fd.expElderlyOrDisabledCare), false),
    item("means_test.additional.family_violence",
      "Family-violence protection costs",
      "Form 122A-2 line 27 / 122C-2 line 27 — § 707(b)(2)(A)(ii)(I)",
      num(fd.expFamilyViolence), false),
    item("means_test.additional.home_energy_excess",
      "Additional home energy (excess over standard, documented)",
      "Form 122A-2 line 28 / 122C-2 line 28 — § 707(b)(2)(A)(ii)(V)",
      num(fd.expHomeEnergyExcess), false,
      undefined, "Documented excess only. Standard utility allowance is already in the housing line."),
    item("means_test.additional.education_minor_children",
      "Education for minor children (statutory per-child cap)",
      "Form 122A-2 line 29 / 122C-2 line 29 — § 707(b)(2)(A)(ii)(IV)",
      num(fd.expChildEducation), true,
      "Per-child statutory cap not loaded. UST publishes the cap annually; pending operator load."),
    item("means_test.additional.charitable",
      "Charitable contributions",
      "Form 122A-2 line 30 / 122C-2 line 30 — § 707(b)(1) charitable carve-out",
      num(fd.expCharitable), true,
      "Charitable-contribution allowance percentage (typically 15% of gross income; statutory cap) not loaded. Pending operator load."),
  ];
  return {
    key: "additional",
    label: "Additional Deductions",
    citation: "Form 122A-2 lines 25–30 / 122C-2 lines 25–30 — § 707(b)(2)(A)(ii)(II)–(V) + § 707(b)(1)",
    lines,
  };
}

// ─── Debt payment (Form 122A-2 lines 33–35 / 122C-2 lines 33–35) ──────────

function buildDebtPayment(input: DeductionEngineInput): DeductionCategory {
  const fd = input.formData;
  const lines: DeductionLine[] = [];

  // Secured-debt 60-month average. Build from the kept secured debts the
  // case carries: each (current_balance + 60-month catch-up of arrears) /
  // 60. The case record today has monthly payments on vehicles/liens but
  // doesn't break out "60-month projected average" — the conservative
  // implementation sums current monthly secured payments as the proxy
  // and flags the line for attorney confirmation.
  const vehicles = Array.isArray(fd.vehicles) ? (fd.vehicles as Array<Record<string, unknown>>) : [];
  const liens = Array.isArray(fd.liens) ? (fd.liens as Array<Record<string, unknown>>) : [];
  const vehiclePmts = vehicles.reduce((a, v) => a + num(v.monthlyPayment), 0);
  const lienPmts = liens.reduce((a, l) => a + num(l.monthlyPayment), 0);
  const mortgagePmt = num(fd.realPropMonthlyPayment) + num(fd.secondMortgagePayment);
  const securedMonthly = vehiclePmts + lienPmts + mortgagePmt;

  const securedPath = "means_test.debt.secured_60mo_avg";
  const securedOverride = resolveOverride(input.overrides, securedPath, securedMonthly);
  lines.push({
    path: securedPath,
    label: "Secured-debt average monthly payment (over 60 months)",
    citation: "Form 122A-2 line 33a / 122C-2 line 33a — § 707(b)(2)(A)(iii)",
    standardValue: securedMonthly,
    effectiveValue: securedOverride,
    actualValue: securedMonthly,
    pending: false,
    note:
      "Conservative: sum of current monthly payments on debts secured by primary residence, " +
      "second property, vehicles, and other liens. Attorney to confirm the true 60-month average " +
      "including amortization changes + balloon payments.",
  });

  // Secured arrears to cure — ÷ 60. The case record DOES NOT carry a
  // dedicated arrears field today. Flag as pending; attorney enters when
  // arrears exist (typical for cure-and-maintain plans).
  const arrearsPath = "means_test.debt.secured_arrears_div60";
  const arrearsOverride = resolveOverride(input.overrides, arrearsPath, null);
  lines.push({
    path: arrearsPath,
    label: "Secured arrears to cure ÷ 60",
    citation: "Form 122A-2 line 33b / 122C-2 line 33b — § 707(b)(2)(A)(iii)",
    standardValue: null,
    effectiveValue: arrearsOverride,
    pending: arrearsOverride == null,
    gap: "Secured-arrears field not in the case record. Attorney enters per case at signing review.",
  });

  // Priority claims ÷ 60. Today the case record has `taxDebt` (lump);
  // attorney enters the priority total per case.
  const priorityPath = "means_test.debt.priority_div60";
  const taxLump = num(fd.taxDebt);
  const priorityFallback = taxLump > 0 ? taxLump / 60 : null;
  const priorityOverride = resolveOverride(input.overrides, priorityPath, priorityFallback);
  lines.push({
    path: priorityPath,
    label: "Priority claims (e.g. priority tax) ÷ 60",
    citation: "Form 122A-2 line 34 / 122C-2 line 34 — § 707(b)(2)(A)(iv)",
    standardValue: priorityFallback,
    effectiveValue: priorityOverride,
    actualValue: taxLump,
    pending: priorityOverride == null,
    gap: priorityFallback == null
      ? "No priority-claims field in the case record beyond taxDebt. Attorney enters per case."
      : undefined,
    note: priorityFallback != null
      ? `Tax debt lump $${taxLump.toLocaleString()} ÷ 60 = $${priorityFallback.toFixed(2)}/mo (interim — attorney confirms the full priority basket).`
      : undefined,
  });

  // Ch.13 trustee administrative expense (Ch.13 cases only). UST
  // publishes the trustee % cap per district. Not loaded; emit a
  // pending line with the calc skeleton.
  const trusteePath = "means_test.debt.ch13_trustee_pct";
  const planPmt = input.projectedPlanPaymentMonthly ?? 0;
  if (planPmt > 0) {
    const trusteeOverride = resolveOverride(input.overrides, trusteePath, null);
    lines.push({
      path: trusteePath,
      label: "Ch.13 trustee administrative expense (trustee % × projected plan payment)",
      citation: "Form 122C-2 line 35 — UST trustee fee schedule",
      standardValue: null,
      effectiveValue: trusteeOverride,
      pending: trusteeOverride == null,
      gap: "Ch.13 trustee-fee percentage not loaded in the store. Source: UST trustee fee schedule per district / per chapter trustee. Attorney enters per case until the table is loaded.",
      note: `Projected plan payment ${planPmt.toLocaleString()}/mo — pending trustee % to compute.`,
    });
  }

  return {
    key: "debt_payment",
    label: "Debt Payment",
    citation: "Form 122A-2 lines 33–35 / 122C-2 lines 33–35 — § 707(b)(2)(A)(iii)–(iv)",
    lines,
  };
}

// ─── Engine entry point ───────────────────────────────────────────────────

export function computeLongFormDeductions(input: DeductionEngineInput): DeductionEngineResult {
  const categories: DeductionCategory[] = [
    buildNationalStandards(input),
    buildLocalHousing(input),
    buildLocalTransportation(input),
    buildOtherNecessary(input),
    buildAdditional(input),
    buildDebtPayment(input),
  ];

  let total = 0;
  const pendingLines: DeductionLine[] = [];
  for (const cat of categories) {
    for (const line of cat.lines) {
      if (line.pending) {
        pendingLines.push(line);
        continue;
      }
      total += line.effectiveValue ?? 0;
    }
  }

  // Version snapshot — used by the attorney surface to diff against the
  // stamped review version. Hashes effective values + override keys; no
  // collision-resistance needed (cheap string compare in rulesAuditStore).
  const versionSnapshot = categories
    .flatMap(c => c.lines.map(l => `${l.path}=${l.effectiveValue ?? "null"}`))
    .join(";");

  return {
    categories,
    totalAllowableMonthly: Math.round(total * 100) / 100,
    pendingLines,
    versionSnapshot,
  };
}
