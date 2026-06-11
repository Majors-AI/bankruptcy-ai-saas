// Centralized Current Monthly Income (CMI) helpers — Form 122A-1 / 122C-1.
//
// One source of truth for:
//   - the excluded-source-types set (Social Security + VA, statutorily)
//   - the included-on-Schedule-I-not-CMI test
//   - a household-contribution included-in-CMI test (§ 101(10A)(B))
//
// SS exclusion is ENFORCED — it is statutory under § 101(10A)(B), not a
// firm setting. SS appears on Schedule I (the at-filing income snapshot)
// but is excluded from the 6-month CMI average. Callers that want to
// display "all income" for Schedule I or for staff-facing dashboards
// should NOT use these helpers — they target CMI / means-test / over-
// median screening only.
//
// Schedule-J net (current monthly income at filing − Schedule J expenses)
// is a SEPARATE concept (gap reported in Part E). This file is CMI only.

export const CMI_EXCLUDED_SOURCE_TYPES: ReadonlySet<string> = new Set([
  // ClientIntakeForm.tsx full-string labels
  "Social Security – Retirement",
  "Social Security – Disability (SSDI)",
  "Supplemental Security Income (SSI)",
  "VA Benefits",
  // Dependent income short codes (ClientIntakeForm.tsx)
  "social_security",
  "ssdi",
  "ssi",
  "va_benefits",
]);

/** Returns true if a given source type is a CMI-excluded source (SS / VA).
 *  Centralizes the check so callers don't reimplement the set membership. */
export function isExcludedFromCMI(sourceType: string | null | undefined): boolean {
  if (!sourceType) return false;
  return CMI_EXCLUDED_SOURCE_TYPES.has(sourceType);
}

// ─── Form-data field keys that DO appear in CMI vs DO NOT ──────────────────
//
// The legacy intake (AttorneyIntakeDashboard) reads many of these as
// individual `d*` fields on form_data. To keep the SS-exclusion behavior
// uniform across CMI-consuming surfaces, the dashboard's CMI total now
// reads only the FIELDS_INCLUDED_IN_CMI set, NOT the broader
// FIELDS_DISPLAYED_AS_GROSS set (which still drives "All Income" displays
// such as Schedule I).

/** Other-income fields that COUNT toward CMI. Wages + business income are
 *  always included via debtor/spouse source arrays — this list is the
 *  smaller "other monthly income" lines that the legacy intake captures
 *  as discrete fields. */
export const FIELDS_INCLUDED_IN_CMI: ReadonlyArray<string> = [
  "dUnemployment",
  "dWorkersComp",
  "dPension",
  "dRental",
  "dAlimony",
  "dChildSupport",
  "dFamilySupport",
  "dRoyalties",
  "dInvestment",
  "dOtherIncome",
];

/** Other-income fields that are EXCLUDED from CMI (SS + VA). They still
 *  appear on Schedule I; the legacy intake just shouldn't add them to a
 *  CMI total. Kept here so the cross-surface alignment is auditable in
 *  one place. */
export const FIELDS_EXCLUDED_FROM_CMI_SS_VA: ReadonlyArray<string> = [
  "dSsRetirement",
  "dSsDisability",
  "dVeterans",
  "dVeteransRetirement",
];

/** Sum the FIELDS_INCLUDED_IN_CMI from a form-data record. Helper for the
 *  legacy intake; the modern income_sources_json path uses
 *  isExcludedFromCMI() directly per-source instead. */
export function sumOtherIncomeIncludedInCMI(fd: Record<string, unknown>): number {
  return FIELDS_INCLUDED_IN_CMI.reduce(
    (acc, k) => acc + (parseFloat(String(fd[k] ?? "")) || 0),
    0,
  );
}

// ─── Household-member contributions (§ 101(10A)(B)) ─────────────────────────
//
// Regular contributions from a non-debtor household member toward the
// debtor's household expenses are INCLUDED in CMI as the contribution
// amount (NOT the contributor's gross income). Two exclusions apply:
//   1. SS-sourced contributions — if the contributor's income source is
//      Social Security (elderly parent's SS, a child's SS benefits),
//      reusing CMI_EXCLUDED_SOURCE_TYPES, the contribution is excluded.
//   2. Non-recurring / one-off support is excluded (firm-interpretation
//      knob exposed via firmPolicy.householdContributionTreatment).
//
// The ClientIntakeForm captures per-dependent { monthlyContribution,
// contributesToHousehold, incomeSources } (see ClientIntakeForm:222).
// The shape below mirrors that capture, with the contributor's primary
// source type added so the SS-sourced exclusion applies.

export interface HouseholdContributor {
  /** Monthly contribution amount toward debtor's household expenses. */
  monthlyContribution?: number | string;
  /** Yes/no whether the household member contributes. */
  contributesToHousehold?: string;
  /** Optional list of the contributor's income sources — used to detect
   *  SS-sourced contributions for the § 101(10A)(B) exclusion. When the
   *  contributor's PRIMARY (or majority) income type is SS, the whole
   *  contribution is excluded from CMI. */
  incomeSources?: Array<{ sourceType?: string; grossMonthly?: number | string }>;
}

/** Sum monthly household-member contributions that COUNT toward CMI. The
 *  SS-sourced exclusion fires when the contributor's only / primary
 *  income source is on the CMI-excluded list. */
export function sumHouseholdContributionsForCMI(
  dependents: ReadonlyArray<HouseholdContributor>,
): number {
  return dependents.reduce((acc, d) => {
    const amt = parseFloat(String(d.monthlyContribution ?? "0")) || 0;
    if (amt <= 0) return acc;
    const contributes = String(d.contributesToHousehold ?? "").toLowerCase();
    if (contributes === "no") return acc;
    // SS-sourced exclusion: if EVERY income source the contributor lists is
    // CMI-excluded (SS / VA), drop the whole contribution. Mixed-source
    // contributors stay in (the more permissive read; the attorney can
    // override on review).
    const sources = d.incomeSources ?? [];
    if (sources.length > 0 && sources.every(s => isExcludedFromCMI(s.sourceType))) {
      return acc;
    }
    return acc + amt;
  }, 0);
}
