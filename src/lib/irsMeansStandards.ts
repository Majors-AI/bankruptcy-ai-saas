// IRS / UST Means-Testing Standards — data source for the staff
// determination questionnaire's Schedule J pre-fill (Form 122A-2 methodology).
//
// ─── ⚠ VERIFICATION REQUIRED BEFORE LAUNCH ⚠ ────────────────────────────────
// Every dollar figure in this file MUST be verified against the current
// official UST/IRS publication before any case decision relies on it. The
// firm's admin should:
//   1. Open https://www.justice.gov/ust/means-testing
//   2. Confirm the "effective for cases filed on or after" date matches
//      EFFECTIVE_DATE below.
//   3. Spot-check each row in NATIONAL_STANDARDS and the figures in
//      LOCAL_STANDARDS / TRANSPORTATION_OPERATING for the firm's
//      jurisdictions.
//   4. Set `pendingVerification: false` on each verified row.
//   5. Update EFFECTIVE_DATE when the UST republishes (typically twice a
//      year — spring and fall).
//
// The questionnaire UI displays a prominent "Verify against current UST
// tables" banner whenever the pre-fill is shown; the banner does NOT
// disappear until pendingVerification flips to false.
//
// ─── DATA PROVENANCE ────────────────────────────────────────────────────────
// NATIONAL_STANDARDS values below reflect my best recollection of the UST
// publication titled "Means Testing Information — Schedule of Allowable
// Expenses" effective May 15, 2024. I have reasonable confidence in the
// totals; the sub-category breakdowns (food / apparel / personal care /
// housekeeping / misc) may be off by a few dollars on individual lines
// — VERIFY before clinical use.
//
// LOCAL_STANDARDS (housing & utilities by county) and
// TRANSPORTATION_OPERATING (by MSA region): county- / region-level figures
// vary too widely for me to load with confidence. Structure-only is
// provided for AZ/WA/CA (plus the national fallback for Transportation
// Ownership/Lease). Every dollar figure is a TODO slot (null) awaiting
// UST data entry.

export const EFFECTIVE_DATE = '2024-05-15';
export const UST_SOURCE_URL = 'https://www.justice.gov/ust/means-testing';
export const NEXT_REFRESH_HINT =
  'UST republishes the Means Testing Standards approximately every 6 months. Re-verify after each publication.';

// ─── National Standards — Food, Apparel & Services, Personal Care,
//     Housekeeping Supplies, Miscellaneous ────────────────────────────────
//
// Source (per recollection): UST publication effective 2024-05-15.
// Each total is split into the five sub-category lines the questionnaire
// pre-fills. The MEANS TEST (Form 122A-2) deducts the household total;
// the sub-category lines mirror the Schedule J expense form layout so
// staff can see each line and override individually.
//
// Per-household-size + per-additional-person row pattern matches the UST
// table layout exactly.

export interface NationalStandardsRow {
  /** Household size this row applies to. -1 = "each additional person beyond 4". */
  householdSize: 1 | 2 | 3 | 4 | -1;
  food: number;
  apparelServices: number;
  personalCare: number;
  housekeepingSupplies: number;
  miscellaneous: number;
  total: number;
  /** Whether the firm's admin has spot-checked this row against the
   *  current UST publication. Default true until verified. */
  pendingVerification: boolean;
}

export const NATIONAL_STANDARDS: ReadonlyArray<NationalStandardsRow> = [
  { householdSize: 1,  food: 470,  apparelServices: 103, personalCare: 51,  housekeepingSupplies: 50,  miscellaneous: 217, total: 891,  pendingVerification: true },
  { householdSize: 2,  food: 844,  apparelServices: 176, personalCare: 82,  housekeepingSupplies: 87,  miscellaneous: 367, total: 1556, pendingVerification: true },
  { householdSize: 3,  food: 946,  apparelServices: 221, personalCare: 89,  housekeepingSupplies: 94,  miscellaneous: 442, total: 1792, pendingVerification: true },
  { householdSize: 4,  food: 1142, apparelServices: 269, personalCare: 102, housekeepingSupplies: 115, miscellaneous: 492, total: 2120, pendingVerification: true },
  { householdSize: -1, food: 191,  apparelServices: 51,  personalCare: 19,  housekeepingSupplies: 19,  miscellaneous: 129, total: 409,  pendingVerification: true },
];

/** Look up the National Standards row for a given household size. For sizes
 *  > 4, the caller adds (size - 4) × the -1 row to the 4-person row to get
 *  the full deduction (this helper returns the closest single-row match —
 *  use scaleNationalStandards() for the additive math). */
export function nationalStandardsForHouseholdSize(size: number): NationalStandardsRow {
  if (size <= 1) return NATIONAL_STANDARDS[0];
  if (size === 2) return NATIONAL_STANDARDS[1];
  if (size === 3) return NATIONAL_STANDARDS[2];
  return NATIONAL_STANDARDS[3]; // size 4
}

/** Compute the full National Standards deduction for any household size,
 *  applying the "each additional person beyond 4" row when size > 4. */
export function scaleNationalStandards(size: number): NationalStandardsRow {
  const base = nationalStandardsForHouseholdSize(Math.min(size, 4));
  if (size <= 4) return base;
  const addl = NATIONAL_STANDARDS[4]; // the -1 row
  const extra = size - 4;
  return {
    householdSize: -1,
    food:                  base.food                  + extra * addl.food,
    apparelServices:       base.apparelServices       + extra * addl.apparelServices,
    personalCare:          base.personalCare          + extra * addl.personalCare,
    housekeepingSupplies:  base.housekeepingSupplies  + extra * addl.housekeepingSupplies,
    miscellaneous:         base.miscellaneous         + extra * addl.miscellaneous,
    total:                 base.total                 + extra * addl.total,
    pendingVerification:   base.pendingVerification || addl.pendingVerification,
  };
}

// ─── Out-of-Pocket Health Care Costs (per person, monthly) ─────────────────
// Source (per recollection): UST publication effective 2024-05-15. Two
// brackets by age. Applied per individual in the household — the means
// test multiplies by member count in each bracket.

export interface HealthCareRow {
  ageBracket: 'under65' | 'over65';
  perPersonMonthly: number;
  pendingVerification: boolean;
}

export const OUT_OF_POCKET_HEALTH_CARE: ReadonlyArray<HealthCareRow> = [
  { ageBracket: 'under65', perPersonMonthly: 83,  pendingVerification: true },
  { ageBracket: 'over65',  perPersonMonthly: 159, pendingVerification: true },
];

// ─── Local Standards — Housing & Utilities (NON-MORTGAGE portion) ──────────
//
// Varies by county, by household size. The Means Test (Form 122A-2) allows
// a deduction equal to the LESSER of (a) the published Local Standard or
// (b) the debtor's actual housing & utility expenses. The housing portion
// of the standard is BROKEN INTO TWO LINES on Form 122A-2:
//   Line 8a — Insurance and operating expenses (the "non-mortgage" piece)
//   Line 8b — Mortgage / rent expense
// The questionnaire pre-fills line 8a from this table; line 8b stays
// ACTUAL (pulled from properties[0].monthlyPayment).
//
// ⚠ All figures here are TODO slots awaiting authoritative UST data entry.
// Structure covers AZ, WA, CA per spec; other states get a `null` row that
// the lookup helper treats as "not yet loaded — staff enters actual."
//
// TODO Phase B — UST DATA ENTRY (firm admin):
//   For each county listed below, populate housingUtilities[1..5] with the
//   "Insurance and Operating Expenses" column from UST Local Standards.
//   When a county isn't in the UST table, the UST publishes an MSA-wide or
//   state-wide default — capture that under the "_default" key per state.
//
// TODO Phase B — NATIONAL COVERAGE:
//   The current scope is AZ, WA, CA per the build decision. To extend
//   national coverage, add the remaining states' COUNTY_LOCAL_STANDARDS
//   entries and bump the `loadedStates` export below.

export interface LocalHousingRow {
  county: string;
  state: 'AZ' | 'WA' | 'CA' | string;
  /** Monthly insurance+operating expense allowance by household size.
   *  Index 0 = 1-person, index 4 = 5+-person. null = not yet loaded. */
  housingUtilities: ReadonlyArray<number | null>;
  pendingVerification: boolean;
}

export const LOCAL_HOUSING_STANDARDS: ReadonlyArray<LocalHousingRow> = [
  // ── Arizona ──────────────────────────────────────────────────────────────
  { state: 'AZ', county: 'Apache',     housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'AZ', county: 'Cochise',    housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'AZ', county: 'Coconino',   housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'AZ', county: 'Gila',       housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'AZ', county: 'Graham',     housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'AZ', county: 'Greenlee',   housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'AZ', county: 'La Paz',     housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'AZ', county: 'Maricopa',   housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'AZ', county: 'Mohave',     housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'AZ', county: 'Navajo',     housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'AZ', county: 'Pima',       housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'AZ', county: 'Pinal',      housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'AZ', county: 'Santa Cruz', housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'AZ', county: 'Yavapai',    housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'AZ', county: 'Yuma',       housingUtilities: [null, null, null, null, null], pendingVerification: true },

  // ── Washington ───────────────────────────────────────────────────────────
  { state: 'WA', county: 'Adams',        housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Asotin',       housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Benton',       housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Chelan',       housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Clallam',      housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Clark',        housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Columbia',     housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Cowlitz',      housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Douglas',      housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Ferry',        housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Franklin',     housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Garfield',     housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Grant',        housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Grays Harbor', housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Island',       housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Jefferson',    housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'King',         housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Kitsap',       housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Kittitas',     housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Klickitat',    housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Lewis',        housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Lincoln',      housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Mason',        housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Okanogan',     housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Pacific',      housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Pend Oreille', housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Pierce',       housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'San Juan',     housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Skagit',       housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Skamania',     housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Snohomish',    housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Spokane',      housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Stevens',      housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Thurston',     housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Wahkiakum',    housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Walla Walla',  housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Whatcom',      housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Whitman',      housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'WA', county: 'Yakima',       housingUtilities: [null, null, null, null, null], pendingVerification: true },

  // ── California ───────────────────────────────────────────────────────────
  // (CA has 58 counties; spec lists CA in v1 so all 58 are stubbed.)
  { state: 'CA', county: 'Alameda',         housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Alpine',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Amador',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Butte',           housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Calaveras',       housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Colusa',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Contra Costa',    housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Del Norte',       housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'El Dorado',       housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Fresno',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Glenn',           housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Humboldt',        housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Imperial',        housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Inyo',            housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Kern',            housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Kings',           housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Lake',            housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Lassen',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Los Angeles',     housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Madera',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Marin',           housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Mariposa',        housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Mendocino',       housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Merced',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Modoc',           housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Mono',            housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Monterey',        housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Napa',            housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Nevada',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Orange',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Placer',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Plumas',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Riverside',       housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Sacramento',      housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'San Benito',      housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'San Bernardino',  housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'San Diego',       housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'San Francisco',   housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'San Joaquin',     housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'San Luis Obispo', housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'San Mateo',       housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Santa Barbara',   housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Santa Clara',     housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Santa Cruz',      housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Shasta',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Sierra',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Siskiyou',        housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Solano',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Sonoma',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Stanislaus',      housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Sutter',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Tehama',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Trinity',         housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Tulare',          housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Tuolumne',        housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Ventura',         housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Yolo',            housingUtilities: [null, null, null, null, null], pendingVerification: true },
  { state: 'CA', county: 'Yuba',            housingUtilities: [null, null, null, null, null], pendingVerification: true },
];

/** Look up the housing+utilities (non-mortgage portion) for a given county +
 *  household size. Returns null if not loaded. */
export function localHousingForCountyHouseholdSize(
  state: string, county: string, size: number,
): { value: number | null; row: LocalHousingRow | null } {
  const row = LOCAL_HOUSING_STANDARDS.find(r =>
    r.state.toUpperCase() === state.toUpperCase() &&
    r.county.toLowerCase() === county.toLowerCase()
  ) ?? null;
  if (!row) return { value: null, row: null };
  const idx = Math.max(0, Math.min(size - 1, 4));
  return { value: row.housingUtilities[idx], row };
}

// ─── Transportation Operating Costs (by MSA region) ─────────────────────────
//
// IRS Local Standards split transportation into TWO components:
//   1. Ownership / Lease — NATIONAL by # of cars (capped). Not by region.
//   2. Operating Cost   — by MSA region (different per metro).
// The Means Test allows the LESSER of the standard or actual; the
// determination questionnaire pre-fills the standard and lets staff
// override with actual.
//
// TRANSPORTATION_OWNERSHIP is national (loaded — single row pair).
// TRANSPORTATION_OPERATING is MSA-keyed (TODO slots, structure for the
// MSAs covering AZ/WA/CA counties; the lookup helper maps a county to its
// MSA before reading the row).

export interface TransportationOwnershipRow {
  carCount: 1 | 2;
  monthly: number;
  pendingVerification: boolean;
}

// Source (per recollection): UST 2024-05-15 publication.
// National figures — same for every region.
export const TRANSPORTATION_OWNERSHIP: ReadonlyArray<TransportationOwnershipRow> = [
  { carCount: 1, monthly: 588,  pendingVerification: true },
  { carCount: 2, monthly: 1176, pendingVerification: true },
];

export interface TransportationOperatingRow {
  /** UST MSA identifier. We use the city-name shorthand UST uses on their site. */
  msa: string;
  oneCar: number | null;
  twoCar: number | null;
  /** Counties this MSA covers — when a county isn't here, fall back to the
   *  state's "_default" MSA row. */
  counties: ReadonlyArray<{ state: string; county: string }>;
  pendingVerification: boolean;
}

export const TRANSPORTATION_OPERATING: ReadonlyArray<TransportationOperatingRow> = [
  // ── Arizona MSAs ────────────────────────────────────────────────────────
  {
    msa: 'Phoenix-Mesa-Scottsdale, AZ',
    oneCar: null, twoCar: null, pendingVerification: true,
    counties: [
      { state: 'AZ', county: 'Maricopa' },
      { state: 'AZ', county: 'Pinal'    },
    ],
  },
  {
    msa: 'Tucson, AZ',
    oneCar: null, twoCar: null, pendingVerification: true,
    counties: [{ state: 'AZ', county: 'Pima' }],
  },
  {
    msa: 'Rest of AZ (non-MSA)',
    oneCar: null, twoCar: null, pendingVerification: true,
    counties: [
      { state: 'AZ', county: 'Apache'     }, { state: 'AZ', county: 'Cochise'    },
      { state: 'AZ', county: 'Coconino'   }, { state: 'AZ', county: 'Gila'       },
      { state: 'AZ', county: 'Graham'     }, { state: 'AZ', county: 'Greenlee'   },
      { state: 'AZ', county: 'La Paz'     }, { state: 'AZ', county: 'Mohave'     },
      { state: 'AZ', county: 'Navajo'     }, { state: 'AZ', county: 'Santa Cruz' },
      { state: 'AZ', county: 'Yavapai'    }, { state: 'AZ', county: 'Yuma'       },
    ],
  },

  // ── Washington MSAs ─────────────────────────────────────────────────────
  {
    msa: 'Seattle-Tacoma-Bellevue, WA',
    oneCar: null, twoCar: null, pendingVerification: true,
    counties: [
      { state: 'WA', county: 'King'      },
      { state: 'WA', county: 'Pierce'    },
      { state: 'WA', county: 'Snohomish' },
    ],
  },
  {
    msa: 'Spokane-Spokane Valley, WA',
    oneCar: null, twoCar: null, pendingVerification: true,
    counties: [
      { state: 'WA', county: 'Spokane'      },
      { state: 'WA', county: 'Stevens'      },
      { state: 'WA', county: 'Pend Oreille' },
    ],
  },
  {
    msa: 'Rest of WA (non-MSA)',
    oneCar: null, twoCar: null, pendingVerification: true,
    counties: [
      // All other WA counties not in Seattle or Spokane MSAs above.
      { state: 'WA', county: 'Adams'    }, { state: 'WA', county: 'Asotin'   },
      { state: 'WA', county: 'Benton'   }, { state: 'WA', county: 'Chelan'   },
      { state: 'WA', county: 'Clallam'  }, { state: 'WA', county: 'Clark'    },
      { state: 'WA', county: 'Columbia' }, { state: 'WA', county: 'Cowlitz'  },
      { state: 'WA', county: 'Douglas'  }, { state: 'WA', county: 'Ferry'    },
      { state: 'WA', county: 'Franklin' }, { state: 'WA', county: 'Garfield' },
      { state: 'WA', county: 'Grant'    }, { state: 'WA', county: 'Grays Harbor' },
      { state: 'WA', county: 'Island'   }, { state: 'WA', county: 'Jefferson'    },
      { state: 'WA', county: 'Kitsap'   }, { state: 'WA', county: 'Kittitas'     },
      { state: 'WA', county: 'Klickitat'}, { state: 'WA', county: 'Lewis'        },
      { state: 'WA', county: 'Lincoln'  }, { state: 'WA', county: 'Mason'        },
      { state: 'WA', county: 'Okanogan' }, { state: 'WA', county: 'Pacific'      },
      { state: 'WA', county: 'San Juan' }, { state: 'WA', county: 'Skagit'       },
      { state: 'WA', county: 'Skamania' }, { state: 'WA', county: 'Thurston'     },
      { state: 'WA', county: 'Wahkiakum'}, { state: 'WA', county: 'Walla Walla'  },
      { state: 'WA', county: 'Whatcom'  }, { state: 'WA', county: 'Whitman'      },
      { state: 'WA', county: 'Yakima'   },
    ],
  },

  // ── California MSAs (UST groups CA into ~9 metro regions plus a "Rest
  //     of state" bucket — structured by the top metros here) ─────────────
  {
    msa: 'Los Angeles-Long Beach-Anaheim, CA',
    oneCar: null, twoCar: null, pendingVerification: true,
    counties: [
      { state: 'CA', county: 'Los Angeles' },
      { state: 'CA', county: 'Orange'      },
    ],
  },
  {
    msa: 'San Francisco-Oakland-Hayward, CA',
    oneCar: null, twoCar: null, pendingVerification: true,
    counties: [
      { state: 'CA', county: 'Alameda'       },
      { state: 'CA', county: 'Contra Costa'  },
      { state: 'CA', county: 'Marin'         },
      { state: 'CA', county: 'San Francisco' },
      { state: 'CA', county: 'San Mateo'     },
    ],
  },
  {
    msa: 'San Jose-Sunnyvale-Santa Clara, CA',
    oneCar: null, twoCar: null, pendingVerification: true,
    counties: [
      { state: 'CA', county: 'Santa Clara' },
      { state: 'CA', county: 'San Benito'  },
    ],
  },
  {
    msa: 'San Diego-Carlsbad, CA',
    oneCar: null, twoCar: null, pendingVerification: true,
    counties: [{ state: 'CA', county: 'San Diego' }],
  },
  {
    msa: 'Sacramento-Roseville-Arden-Arcade, CA',
    oneCar: null, twoCar: null, pendingVerification: true,
    counties: [
      { state: 'CA', county: 'Sacramento' }, { state: 'CA', county: 'Placer' },
      { state: 'CA', county: 'El Dorado'  }, { state: 'CA', county: 'Yolo'   },
    ],
  },
  {
    msa: 'Riverside-San Bernardino-Ontario, CA',
    oneCar: null, twoCar: null, pendingVerification: true,
    counties: [
      { state: 'CA', county: 'Riverside'      },
      { state: 'CA', county: 'San Bernardino' },
    ],
  },
  {
    msa: 'Rest of CA (non-MSA)',
    oneCar: null, twoCar: null, pendingVerification: true,
    counties: [],   // Catch-all — used when a county doesn't match any above.
  },
];

/** Look up transportation operating cost by county. Returns the matched MSA
 *  row + the per-car-count value; returns null when no figure is loaded. */
export function transportationOperatingForCounty(
  state: string, county: string, carCount: 1 | 2,
): { value: number | null; row: TransportationOperatingRow | null } {
  const row = TRANSPORTATION_OPERATING.find(r =>
    r.counties.some(c =>
      c.state.toUpperCase() === state.toUpperCase() &&
      c.county.toLowerCase() === county.toLowerCase()
    )
  )
  // Fall back to "Rest of <state>" when the county isn't listed.
  ?? TRANSPORTATION_OPERATING.find(r =>
    r.msa.startsWith(`Rest of ${state.toUpperCase()}`)
  )
  ?? null;
  if (!row) return { value: null, row: null };
  return { value: carCount === 1 ? row.oneCar : row.twoCar, row };
}

// ─── Verification banner state ──────────────────────────────────────────────
// Returns true when ANY loaded row is still pending verification, which is
// the case at load-time. The questionnaire UI uses this to show the
// "Verify against current UST tables" banner.

export function anyStandardsPendingVerification(): boolean {
  return (
    NATIONAL_STANDARDS.some(r => r.pendingVerification) ||
    OUT_OF_POCKET_HEALTH_CARE.some(r => r.pendingVerification) ||
    LOCAL_HOUSING_STANDARDS.some(r => r.pendingVerification) ||
    TRANSPORTATION_OWNERSHIP.some(r => r.pendingVerification) ||
    TRANSPORTATION_OPERATING.some(r => r.pendingVerification)
  );
}

// ─── States with Local Standards structure loaded ───────────────────────────
// Used by the questionnaire UI to communicate scope to the user.
export const LOADED_STATES: ReadonlyArray<'AZ' | 'WA' | 'CA'> = ['AZ', 'WA', 'CA'];

// ═══════════════════════════════════════════════════════════════════════════
// CENTRALIZED LEGAL REFERENCE / RULES & STANDARDS STORE — PART B SEED (2025)
// ═══════════════════════════════════════════════════════════════════════════
//
// One source of truth. Every field is editable + effective-dated. The
// LegalReferenceStore component reads from these constants and presents a
// unified UI in three portals (Department Settings, Super Admin, Law Firm
// Owner). Attorneys (super attorney admin or law firm owner) can MODIFY;
// non-lawyers VIEW + submit a proposed change routed for attorney approval.
//
// TODO Phase B — persistence backend:
//   - new tables: legal_reference_current (the active values),
//                 legal_reference_proposals (pending change requests),
//                 legal_reference_audit_log (immutable change history).
//   - server enforces: only attorneys with super-admin or firm-owner role
//     may write to legal_reference_current; everyone else writes to
//     legal_reference_proposals; approve action copies proposal → current
//     and writes the audit log row.
//   - frontend reads `useLegalReferenceStore()` (a context provider that
//     fetches current values + listens for changes); today this file's
//     constants are the in-memory source and edits are scaffold-only.
//
// All seed values below are effective-dated 2025-04-21, marked "in effect
// until June 2026," sourced from "IRS Collection Financial Standards
// (UST-adopted)," and verified:false until the firm's attorney admin
// confirms each row.

export interface LegalReferenceMeta {
  /** When this value first becomes effective (ISO 8601 date). */
  effectiveDate: string;
  /** When this value stops being effective, or expected to refresh
   *  (YYYY-MM or full date). Null = open-ended. */
  inEffectUntil: string | null;
  /** Where this value came from (publication name, URL, statute, etc.). */
  source: string;
  /** Whether a firm attorney has verified the value against the source
   *  publication. Defaults to false until verified — UI surfaces a
   *  prominent banner when this is false. */
  verified: boolean;
  /** Free-text note shown alongside the value (e.g., "verify against
   *  current UST tables — not yet attorney-verified"). */
  verifyAgainst?: string;
}

export const PART_B_META: LegalReferenceMeta = {
  effectiveDate: '2025-04-21',
  inEffectUntil: '2026-06',
  source: 'IRS Collection Financial Standards (UST-adopted for bankruptcy)',
  verified: false,
  verifyAgainst: 'current UST means-test tables at justice.gov/ust',
};

// ─── 2025 Housing & Utilities — seeded for AZ + WA ──────────────────────────
//
// Per-county array: [family-of-1, 2, 3, 4, 5+]. California remains TODO
// (county slots seeded as null elsewhere in this file — not yet sourced).

export type HousingUtilitiesByCounty = Readonly<Record<string, ReadonlyArray<number>>>;
export type HousingUtilitiesByState = Readonly<Record<string, HousingUtilitiesByCounty>>;

export const IRS_HOUSING_UTILITIES_2025: HousingUtilitiesByState = {
  AZ: {
    Apache:       [1374,1614,1701,1897,1927],
    Cochise:      [1465,1721,1813,2021,2054],
    Coconino:     [1930,2267,2389,2664,2707],
    Gila:         [1595,1873,1974,2201,2237],
    Graham:       [1528,1795,1891,2108,2143],
    Greenlee:     [1227,1442,1519,1694,1721],
    'La Paz':     [1344,1578,1663,1854,1884],
    Maricopa:     [1948,2288,2411,2688,2732],
    Mohave:       [1468,1724,1817,2026,2059],
    Navajo:       [1444,1696,1787,1993,2025],
    Pima:         [1679,1972,2078,2317,2354],
    Pinal:        [1727,2028,2137,2383,2421],
    'Santa Cruz': [1375,1615,1702,1898,1928],
    Yavapai:      [1728,2029,2138,2384,2422],
    Yuma:         [1430,1680,1770,1974,2005],
  },
  WA: {
    Adams:         [1669,1960,2065,2302,2340],
    Asotin:        [1658,1947,2052,2288,2325],
    Benton:        [1942,2280,2403,2679,2723],
    Chelan:        [1970,2314,2438,2718,2762],
    Clallam:       [1862,2187,2305,2570,2612],
    Clark:         [2181,2561,2699,3009,3058],
    Columbia:      [1530,1796,1893,2111,2145],
    Cowlitz:       [1924,2260,2381,2655,2698],
    Douglas:       [1910,2243,2364,2636,2678],
    Ferry:         [1356,1592,1678,1871,1901],
    Franklin:      [1790,2102,2215,2470,2510],
    Garfield:      [1500,1762,1857,2071,2104],
    Grant:         [1636,1922,2025,2258,2294],
    'Grays Harbor':[1692,1987,2094,2335,2373],
    Island:        [2215,2601,2741,3056,3106],
    Jefferson:     [1959,2300,2424,2703,2746],
    King:          [2976,3495,3683,4107,4173],
    Kitsap:        [2229,2618,2759,3076,3126],
    Kittitas:      [2140,2513,2648,2953,3000],
    Klickitat:     [1812,2128,2242,2500,2540],
    Lewis:         [1810,2126,2240,2498,2538],
    Lincoln:       [1636,1922,2025,2258,2294],
    Mason:         [1926,2262,2384,2658,2701],
    Okanogan:      [1733,2036,2145,2392,2430],
    Pacific:       [1618,1900,2002,2232,2268],
    'Pend Oreille':[1656,1945,2050,2286,2323],
    Pierce:        [2287,2687,2831,3157,3208],
    'San Juan':    [2367,2780,2929,3266,3319],
    Skagit:        [2188,2570,2708,3019,3068],
    Skamania:      [2042,2398,2527,2818,2863],
    Snohomish:     [2559,3005,3167,3531,3588],
    Spokane:       [1830,2149,2265,2525,2566],
    Stevens:       [1725,2026,2135,2381,2419],
    Thurston:      [2194,2577,2715,3027,3076],
    Wahkiakum:     [1850,2173,2290,2553,2595],
    'Walla Walla': [1858,2182,2299,2563,2605],
    Whatcom:       [2220,2607,2747,3063,3112],
    Whitman:       [1862,2186,2304,2569,2610],
    Yakima:        [1728,2029,2138,2384,2422],
  },
  CA: {
    // TODO — not yet sourced. CA county scaffolds exist in LOCAL_HOUSING_STANDARDS
    // above with null household-size values; populate here once UST data is in
    // hand. Until then `getHousing2025(state, county, hhSize)` returns null
    // for CA and the existing localHousingForCountyHouseholdSize() fallback
    // also returns null (banner displays in UI).
  },
};

/** Look up the 2025 housing+utilities allowance by state + county + household
 *  size (1..5+). Returns null when not seeded. */
export function getHousing2025(state: string, county: string, householdSize: number): number | null {
  const byState = IRS_HOUSING_UTILITIES_2025[state.toUpperCase()];
  if (!byState) return null;
  const counties = byState as HousingUtilitiesByCounty;
  const arr = counties[county];
  if (!arr) return null;
  const idx = Math.max(0, Math.min(householdSize - 1, 4));
  return arr[idx] ?? null;
}

// ─── 2025 Transportation — seeded fully ─────────────────────────────────────
//
// Structure follows the actual IRS publication:
//   - publicTransitNational: national public-transit allowance (when client
//     has NO car)
//   - ownershipNational: national ownership/lease cap by 1 or 2 cars
//   - operating: by region (NE/Midwest/South/West) WITH metro overrides
//     within each region
//
// To resolve operating cost for a debtor: pick their metro (if listed),
// otherwise fall back to the region row. UI exposes this lookup via
// getTransportationOperating2025(metroOrRegion).

export interface TransportOperatingPair { one: number; two: number }
export interface TransportRegion2025 {
  region: 'Northeast' | 'Midwest' | 'South' | 'West';
  regional: TransportOperatingPair;
  metros: Readonly<Record<string, TransportOperatingPair>>;
}

export const IRS_TRANSPORTATION_2025 = {
  publicTransitNational: 244,
  ownershipNational: { one: 662, two: 1324 } as TransportOperatingPair,
  operating: [
    {
      region: 'Northeast',
      regional: { one: 302, two: 604 },
      metros: {
        Boston:       { one: 338, two: 676 },
        'New York':   { one: 401, two: 802 },
        Philadelphia: { one: 300, two: 600 },
      },
    },
    {
      region: 'Midwest',
      regional: { one: 259, two: 518 },
      metros: {
        Chicago:               { one: 296, two: 592 },
        Cleveland:             { one: 259, two: 518 },
        Detroit:               { one: 365, two: 730 },
        'Minneapolis-St. Paul':{ one: 284, two: 568 },
        'St. Louis':           { one: 232, two: 464 },
      },
    },
    {
      region: 'South',
      regional: { one: 281, two: 562 },
      metros: {
        Atlanta:           { one: 320, two: 640 },
        Baltimore:         { one: 306, two: 612 },
        'Dallas-Ft. Worth':{ one: 320, two: 640 },
        Houston:           { one: 359, two: 718 },
        Miami:             { one: 400, two: 800 },
        Tampa:             { one: 335, two: 670 },
        'Washington, D.C.':{ one: 295, two: 590 },
      },
    },
    {
      region: 'West',
      regional: { one: 297, two: 594 },
      metros: {
        Anchorage:       { one: 219, two: 438 },
        Denver:          { one: 337, two: 674 },
        Honolulu:        { one: 252, two: 504 },
        'Los Angeles':   { one: 353, two: 706 },
        Phoenix:         { one: 358, two: 716 },
        'San Diego':     { one: 335, two: 670 },
        'San Francisco': { one: 362, two: 724 },
        Seattle:         { one: 270, two: 540 },
      },
    },
  ] as ReadonlyArray<TransportRegion2025>,
} as const;

/** Look up 2025 transportation operating allowance for a metro (preferred)
 *  or fall back to the region. Returns the {one, two} pair or null. */
export function getTransportationOperating2025(metroOrRegion: string): TransportOperatingPair | null {
  for (const r of IRS_TRANSPORTATION_2025.operating) {
    if (r.metros[metroOrRegion]) return r.metros[metroOrRegion];
    if (r.region === metroOrRegion) return r.regional;
  }
  return null;
}

// ─── National Standards (2025) — seeded from PART B publication ─────────────
//
// Source: IRS National Standards — Allowable Living Expenses (UST-adopted
// for bankruptcy), effective 2025-04-21, in effect until June 2026.
// Per-additional-person over 4: $394 added to the 4-person TOTAL (the IRS
// publishes the add-on against total only; the breakdown helper
// scaleNationalStandards2025() distributes that $394 across categories
// using the 4-person row's category ratios so per-line displays stay
// sensible).
//
// outOfPocketHealthCare is a SEPARATE IRS standard (per-person, by age
// bracket) — not provided in this PART B export. The column is preserved
// as `null` so the UI surfaces a "TODO / Coming soon" hint until sourced.

export interface NationalStandards2025Row {
  householdSize: 1 | 2 | 3 | 4 | -1;
  food: number | null;
  apparelServices: number | null;
  personalCare: number | null;
  housekeepingSupplies: number | null;
  miscellaneous: number | null;
  outOfPocketHealth: number | null;
  total: number | null;
}

export interface NationalStandards2025Meta {
  source: string;
  effectiveDate: string;
  inEffectUntil: string | null;
  additionalPerPersonOver4: number;
  columns: ReadonlyArray<string>;
  verified: boolean;
}

export const NATIONAL_STANDARDS_2025_META: NationalStandards2025Meta = {
  source: 'IRS National Standards — Allowable Living Expenses (UST-adopted)',
  effectiveDate: '2025-04-21',
  inEffectUntil: '2026-06',
  additionalPerPersonOver4: 394,
  columns: ['1 person', '2 persons', '3 persons', '4 persons'],
  verified: false,
};

export const NATIONAL_STANDARDS_2025: ReadonlyArray<NationalStandards2025Row> = [
  // 1-person
  { householdSize: 1,  food: 497,  housekeepingSupplies: 45, apparelServices: 93,  personalCare: 50,  miscellaneous: 154, outOfPocketHealth: null, total: 839  },
  // 2-person
  { householdSize: 2,  food: 863,  housekeepingSupplies: 75, apparelServices: 181, personalCare: 91,  miscellaneous: 271, outOfPocketHealth: null, total: 1481 },
  // 3-person
  { householdSize: 3,  food: 1068, housekeepingSupplies: 82, apparelServices: 188, personalCare: 94,  miscellaneous: 321, outOfPocketHealth: null, total: 1753 },
  // 4-person
  { householdSize: 4,  food: 1255, housekeepingSupplies: 91, apparelServices: 276, personalCare: 117, miscellaneous: 390, outOfPocketHealth: null, total: 2129 },
  // -1 = "each additional person beyond 4." The IRS publishes only the
  //      TOTAL add-on ($394); per-category values below are proportional
  //      shares of the 4-person row (so per-line displays stay sensible
  //      for >4-person households). UI may also show 394 explicitly.
  { householdSize: -1, food: 232,  housekeepingSupplies: 17, apparelServices: 51,  personalCare: 22,  miscellaneous: 72,  outOfPocketHealth: null, total: 394 },
];

/** Compute the full 2025 National Standards deduction for any household
 *  size, applying the $394 per-person add-on for sizes > 4. */
export function scaleNationalStandards2025(size: number): NationalStandards2025Row {
  const base = NATIONAL_STANDARDS_2025[Math.min(Math.max(size, 1), 4) - 1];
  if (size <= 4) return base;
  const addl = NATIONAL_STANDARDS_2025[4]; // the -1 row
  const extra = size - 4;
  const add = (b: number | null, a: number | null) =>
    b == null && a == null ? null : (b ?? 0) + extra * (a ?? 0);
  return {
    householdSize: -1,
    food:                  add(base.food, addl.food),
    apparelServices:       add(base.apparelServices, addl.apparelServices),
    personalCare:          add(base.personalCare, addl.personalCare),
    housekeepingSupplies:  add(base.housekeepingSupplies, addl.housekeepingSupplies),
    miscellaneous:         add(base.miscellaneous, addl.miscellaneous),
    outOfPocketHealth:     add(base.outOfPocketHealth, addl.outOfPocketHealth),
    total:                 add(base.total, addl.total),
  };
}

/** Look up a per-category 2025 National Standard for a household size. */
export type NationalStandardCategory =
  | 'food' | 'housekeeping' | 'apparel' | 'personalCare' | 'miscellaneous'
  | 'outOfPocketHealth' | 'total';
export function getNationalStandard2025(
  category: NationalStandardCategory,
  householdSize: number,
): number | null {
  const row = scaleNationalStandards2025(householdSize);
  switch (category) {
    case 'food':              return row.food;
    case 'housekeeping':      return row.housekeepingSupplies;
    case 'apparel':           return row.apparelServices;
    case 'personalCare':      return row.personalCare;
    case 'miscellaneous':     return row.miscellaneous;
    case 'outOfPocketHealth': return row.outOfPocketHealth;
    case 'total':             return row.total;
  }
}

// ─── Median Income — UST tables effective 2026-04-01 ───────────────────────
//
// Source: UST — Census Bureau Median Family Income By Family Size,
// effective for cases filed on or after 2026-04-01.
// Shape: state → [1 earner, 2 people, 3 people, 4 people]; for households
// > 4, add MEDIAN_INCOME_META.additionalPerPersonOver4 per extra person.
// State names match the UST publication exactly (incl. territories).

export interface MedianIncomeMeta {
  source: string;
  url: string;
  effectiveDate: string;
  appliesTo: string;
  additionalPerPersonOver4: number;
  columns: ReadonlyArray<string>;
  verified: boolean;
}

export const MEDIAN_INCOME_META: MedianIncomeMeta = {
  source: 'UST — Census Bureau Median Family Income By Family Size',
  url: 'https://www.justice.gov/ust/eo/bapcpa/20260401/bci_data/median_income_table.htm',
  effectiveDate: '2026-04-01',
  appliesTo: 'cases filed on or after 2026-04-01',
  additionalPerPersonOver4: 11100,
  columns: ['1 earner', '2 people', '3 people', '4 people'],
  verified: false,
};

/** State → annual median by household size [1, 2, 3, 4]. */
export const MEDIAN_INCOME_BY_STATE: Readonly<Record<string, ReadonlyArray<number>>> = {
  Alabama: [64321,77451,92698,106740], Alaska: [85817,112548,112548,142136], Arizona: [73935,89027,104965,121174],
  Arkansas: [58421,73630,82329,97054], California: [79253,102797,116541,139071], Colorado: [87940,109497,130850,153501],
  Connecticut: [84302,106224,134470,159934], Delaware: [69515,94877,111273,132244], 'District of Columbia': [85391,161397,161397,166598],
  Florida: [69876,86523,97540,114761], Georgia: [68478,84965,101479,123481], Hawaii: [85254,106202,123454,142181],
  Idaho: [73413,86160,98381,119662], Illinois: [73180,93934,113625,137902], Indiana: [64461,81986,95627,115656],
  Iowa: [67617,88800,104133,126058], Kansas: [69197,87441,103852,125971], Kentucky: [61652,73892,85212,109443],
  Louisiana: [59447,72348,84602,103628], Maine: [75892,90445,106822,131577], Maryland: [86928,114611,135949,166173],
  Massachusetts: [88202,112708,139411,178524], Michigan: [67352,83432,103449,123010], Minnesota: [77696,98328,126487,149882],
  Mississippi: [53978,70328,82846,97464], Missouri: [64972,82075,100228,118530], Montana: [71310,91452,103285,121698],
  Nebraska: [66922,90728,103405,125074], Nevada: [72222,87914,101638,114110], 'New Hampshire': [87287,109324,141531,155203],
  'New Jersey': [87173,106876,137136,168127], 'New Mexico': [66235,79574,88041,98602], 'New York': [73272,92902,115579,139040],
  'North Carolina': [67117,84384,101535,116737], 'North Dakota': [73549,96352,106686,137817], Ohio: [66239,83725,102504,123702],
  Oklahoma: [61180,77208,86845,101798], Oregon: [79089,93670,116729,140024], Pennsylvania: [72230,87534,110151,135862],
  'Rhode Island': [77653,98736,119419,137479], 'South Carolina': [64808,83761,95672,116314], 'South Dakota': [69190,89809,100883,130738],
  Tennessee: [63979,82846,97511,109585], Texas: [66837,86714,99273,117962], Utah: [87898,95757,112751,131741],
  Vermont: [72461,96963,114075,137583], Virginia: [78491,101171,123159,144826], Washington: [88585,107100,131737,156567],
  'West Virginia': [63908,68592,92050,93672], Wisconsin: [71168,90252,108516,133384], Wyoming: [71745,91502,98476,110297],
  Guam: [53859,64399,73385,88805], 'Northern Mariana Islands': [36168,36168,42080,61891],
  'Puerto Rico': [30665,30665,40976,50543], 'Virgin Islands': [42734,51360,54760,59995],
};

/** Look up annual median income for a state + household size. Applies
 *  the per-person add-on for households > 4. Returns null when the state
 *  isn't in the table. */
export function getMedianAnnualIncome(state: string, householdSize: number): number | null {
  if (!state) return null;
  const row = MEDIAN_INCOME_BY_STATE[state];
  if (!row) return null;
  const size = Math.max(1, Math.floor(householdSize));
  if (size <= 4) return row[Math.min(size, 4) - 1] ?? null;
  const four = row[3] ?? null;
  if (four == null) return null;
  return four + (size - 4) * MEDIAN_INCOME_META.additionalPerPersonOver4;
}

// ─── Exemptions — Federal § 522(d) + AZ + WA seeded (2026-02-23) ────────────
//
// limit === null means: NO FIXED DOLLAR CAP. Either the exemption is
// unlimited / 100% / formula-based — render as "No fixed limit" + the
// `note` text. NEVER render null as $0.
//
// Federal § 522(d): adjusted every 3 years (next 2028-04-01). AZ and WA
// figures are as-of 2026-02-23 per the source export. WA homestead is
// COUNTY-SPECIFIC: 39 counties, one statute, attorney logic picks the
// debtor's county from homesteadByCounty.
//
// Jurisdiction-level election rules:
//   - AZ → opt-out: debtors use AZ state exemptions only.
//   - WA → debtor may elect state OR federal § 522(d).
//   - Federal § 522(d) → only available where elected by the debtor's
//     state of domicile. CA opted out; AZ opted out; WA allows election.
//
// All entries verified:false until the firm attorney spot-checks against
// the current statute publication — UI surfaces a "verify against current
// statute" banner identical to the IRS-standards verification.

export interface ExemptionItem {
  /** Human-readable label (e.g., "Homestead (residence)"). */
  label: string;
  /** Statute citation EXACTLY as published; do not modify. */
  statute: string;
  /** Dollar cap. null = no fixed cap (unlimited / 100% / formula). */
  limit: number | null;
  /** Optional note when the limit is null or has special rules. */
  note?: string;
  /** Election system dimension — used only by jurisdictions that require
   *  the debtor to elect between two mutually-exclusive sets. Today this
   *  is California (§703.140(b) vs §704.xxx). Undefined elsewhere. */
  system?: '703' | '704';
  /** When set, the row links its cap to UNUSED equity from another row's
   *  cap (referenced by statute). Used by CA §703.140(b)(5) wildcard which
   *  rolls in unused §703.140(b)(1) homestead. The panel reads this to
   *  compute the rolled-up cap at render time. */
  unusedFromStatute?: string;
}

export type ExemptionElectionRule = 'opt-out' | 'state-or-federal' | 'federal-only';

/** Index-band config for jurisdictions whose homestead is county-banded +
 *  indexed annually (CA §704.730: clamp(county prior-year median, floor,
 *  ceiling); floor + ceiling index annually from a base year). When set,
 *  the panel computes `effective = clamp(county_median, floor, ceiling)`
 *  per debtor county, where the floor/ceiling come from this band config
 *  inflated to the current effective date. */
export interface HomesteadIndexBand {
  /** Base floor $ at baseYear. */
  floorBase: number;
  /** Base ceiling $ at baseYear. */
  ceilingBase: number;
  /** Reference year for the indexing math. */
  baseYear: number;
  /** Annual indexation rate (decimal, e.g. 0.03 for 3%). null = TODO
   *  inflation lookup (the panel falls back to base values). */
  indexationRate?: number | null;
  /** Source citation for the band rule. */
  source?: string;
}

export interface ExemptionsJurisdiction {
  /** Display name (e.g., "Federal", "Arizona", "Washington"). */
  jurisdiction: string;
  /** Effective date of these values, ISO 8601. */
  effectiveDate: string;
  /** When the next statutory / Congressional adjustment is expected. */
  nextAdjustment?: string | null;
  /** Source publication / authority. */
  source: string;
  /** Whether the firm's attorney has spot-checked against the source. */
  verified: boolean;
  /** Jurisdiction election rule (see comment above). */
  election: ExemptionElectionRule;
  /** True when the jurisdiction requires the debtor to elect one of two
   *  mutually-exclusive sets (CA §703 vs §704). The panel surfaces a
   *  system picker; until elected, no rows are selectable. */
  requiresSystemElection?: boolean;
  /** Items. */
  items: ReadonlyArray<ExemptionItem>;
  /** Homestead by county (used by WA and CA §704). Key = county name,
   *  value = $ cap. When present, the homestead item's `limit` is null
   *  and the per-county cap is read from here for the debtor's county.
   *  For CA §704 the cap is the clamp of the county prior-year median
   *  against `homesteadBand.floor/ceiling`; this map already encodes
   *  that clamp result so reads stay O(1). */
  homesteadByCounty?: Readonly<Record<string, number>>;
  /** Homestead statute citation (when homesteadByCounty is present). */
  homesteadStatute?: string;
  /** Indexed floor/ceiling band — drives the clamp + annual reindex on
   *  homesteadByCounty for CA §704. WA does not currently index (the
   *  per-county figures are republished annually). */
  homesteadBand?: HomesteadIndexBand;
}

export const EXEMPTIONS_BY_JURISDICTION: Readonly<Record<string, ExemptionsJurisdiction>> = {
  // ── Federal § 522(d) ─────────────────────────────────────────────────────
  Federal: {
    jurisdiction: 'Federal',
    effectiveDate: '2025-04-01',
    nextAdjustment: '2028-04-01',
    source: '11 U.S.C. § 522(d)',
    verified: false,
    election: 'federal-only',
    items: [
      { label: 'Homestead (residence)',                              statute: '11 U.S.C. § 522(d)(1)',     limit: 31575 },
      { label: 'Personal injury compensation',                       statute: '11 U.S.C. § 522(d)(11)(D)', limit: 31575 },
      { label: 'Wildcard',                                           statute: '11 U.S.C. § 522(d)(5)',     limit: 17475, note: '$1,675 + up to $15,800 unused homestead' },
      { label: 'Household goods/furnishings/apparel/etc.',           statute: '11 U.S.C. § 522(d)(3)',     limit: 16850, note: 'aggregate; $800 per-item cap' },
      { label: 'Life insurance w/ loan value',                       statute: '11 U.S.C. § 522(d)(8)',     limit: 16850 },
      { label: 'Motor vehicle',                                      statute: '11 U.S.C. § 522(d)(2)',     limit: 5025 },
      { label: 'Tools of trade / professional books',                statute: '11 U.S.C. § 522(d)(6)',     limit: 3175 },
      { label: 'Jewelry',                                            statute: '11 U.S.C. § 522(d)(4)',     limit: 2125 },
      { label: 'Alimony/child support',                              statute: '11 U.S.C. § 522(d)(10)(D)', limit: null, note: 'needed for support' },
      { label: "Crime victims' compensation",                        statute: '11 U.S.C. § 522(d)(11)(A)', limit: null },
      { label: 'Disability/sickness/unemployment benefits',          statute: '11 U.S.C. § 522(d)(10)(C)', limit: null },
      { label: 'Health aids',                                        statute: '11 U.S.C. § 522(d)(9)',     limit: null },
      { label: 'Life insurance payments needed for support',         statute: '11 U.S.C. § 522(d)(11)(C)', limit: null },
      { label: 'Lost earnings compensation',                         statute: '11 U.S.C. § 522(d)(11)(E)', limit: null },
      { label: 'Retirement accounts exempt under IRC',               statute: '11 U.S.C. § 522(d)(12)',    limit: null, note: 'IRA/Roth ~$1,512,350 aggregate cap under § 522(n)' },
      { label: 'SS/unemployment/local welfare',                      statute: '11 U.S.C. § 522(d)(10)(A)', limit: null },
      { label: 'Stock bonus/pension/profit-sharing/annuity',         statute: '11 U.S.C. § 522(d)(10)(E)', limit: null },
      { label: 'Tenancy by the entirety',                            statute: '11 U.S.C. § 522(b)(3)(B)',  limit: null, note: 'may not be allowed in some jurisdictions' },
      { label: 'Unmatured life insurance (non-credit)',              statute: '11 U.S.C. § 522(d)(7)',     limit: null },
      { label: "Veterans' benefits",                                 statute: '11 U.S.C. § 522(d)(10)(B)', limit: null },
      { label: 'Wrongful death payments',                            statute: '11 U.S.C. § 522(d)(11)(B)', limit: null },
    ],
  },
  // ── Arizona (opt-out — state exemptions only) ────────────────────────────
  // Loaded from the firm's canonical AZ list (asOf 2026-02-23). Citations
  // are exact; null = no fixed dollar cap (unlimited / 100% / formula).
  AZ: {
    jurisdiction: 'Arizona',
    effectiveDate: '2026-02-23',
    nextAdjustment: null,
    source: 'Ariz. Rev. Stat.',
    verified: false,
    election: 'opt-out',
    items: [
      { label: 'Homestead (owner-occupied residence)',                              statute: 'A.R.S. § 33-1101(A)',         limit: 437600 },
      { label: 'Motor vehicle (one)',                                               statute: 'A.R.S. § 33-1125(8)',         limit: 16500 },
      { label: 'Motor vehicle (one) — physically disabled debtor',                  statute: 'A.R.S. § 33-1125(8)',         limit: 27500 },
      { label: 'Household furniture/furnishings/goods incl. electronics',           statute: 'A.R.S. § 33-1123',            limit: 16500 },
      { label: 'Money in one bank account',                                         statute: 'A.R.S. § 33-1126(A)(9)',      limit: 5600 },
      { label: 'Tools of trade',                                                    statute: 'A.R.S. § 33-1130(1)',         limit: 5000 },
      { label: 'Prearranged funeral',                                               statute: 'A.R.S. § 32-1391.05(C)(4)',   limit: 5000 },
      { label: 'Farm machinery/feed/grain/seed/animals',                            statute: 'A.R.S. § 33-1130(2)',         limit: 2500 },
      { label: 'Engagement and wedding rings',                                      statute: 'A.R.S. § 33-1125(4)',         limit: 2000 },
      { label: 'Firearms',                                                          statute: 'A.R.S. § 33-1125(10)',        limit: 2000 },
      { label: 'Prepaid rent / security deposits (if no homestead)',                statute: 'A.R.S. § 33-1126(C)',         limit: 2000 },
      { label: 'Typewriter/computer/bike/sewing machine/Bible or burial grounds',   statute: 'A.R.S. § 33-1125(7)',         limit: 2000 },
      { label: 'Death benefits (deceased spouse/parent/guardian)',                  statute: 'A.R.S. § 33-1126(A)(1)',      limit: 20000 },
      { label: 'Horses, milk cows, and poultry',                                    statute: 'A.R.S. § 33-1125(3)',         limit: 1000 },
      { label: 'Wearing apparel',                                                   statute: 'A.R.S. § 33-1125(1)',         limit: 500 },
      { label: 'Musical instruments',                                               statute: 'A.R.S. § 33-1125(2)',         limit: 400 },
      { label: 'Library/books/manuals/personal documents',                          statute: 'A.R.S. § 33-1125(5)',         limit: 250 },
      { label: 'Watch (one)',                                                       statute: 'A.R.S. § 33-1125(6)',         limit: 250 },
      { label: 'Annuity',                                                           statute: 'A.R.S. § 33-1126(A)(7)',      limit: null },
      { label: 'Cash surrender value of life insurance',                            statute: 'A.R.S. § 33-1126(A)(6)',      limit: null },
      { label: 'Life insurance proceeds (exempt from creditors of insured)',        statute: 'A.R.S. § 20-1131(A)',         limit: null },
      { label: 'Child support/spousal maintenance 100%',                            statute: 'A.R.S. § 33-1126(A)(3)',      limit: null },
      { label: '529 college savings (excl. contributions within 2 yrs)',            statute: 'A.R.S. § 33-1126(A)(10)',     limit: null },
      { label: 'Earnings — greater of 90% or 60× min hourly wage',                  statute: 'A.R.S. § 33-1131(B)',         limit: null, note: 'formula' },
      { label: 'Qualified retirement plans',                                        statute: 'A.R.S. § 33-1126(B)',         limit: null },
      { label: 'Retirement — ASRS',                                                 statute: 'A.R.S. § 38-792',             limit: null },
      { label: 'Unemployment comp 100% (except necessaries)',                       statute: 'A.R.S. § 23-783(A)',          limit: null },
      { label: 'Wages — $50/week + $15/wk per dependent',                           statute: 'A.R.S. § 23-755(D)',          limit: null, note: 'formula' },
      { label: "Worker's compensation",                                             statute: 'A.R.S. § 23-1068(B)',         limit: null },
      { label: 'Wrongful death benefits',                                           statute: 'A.R.S. § 12-592',             limit: null },
    ],
  },
  // ── Washington (state OR federal election) ───────────────────────────────
  WA: {
    jurisdiction: 'Washington',
    effectiveDate: '2026-02-23',
    nextAdjustment: null,
    source: 'Wash. Rev. Code',
    verified: false,
    election: 'state-or-federal',
    homesteadStatute: 'Wash. Rev. Code §§ 6.13.010, 6.13.020, 6.13.030',
    homesteadByCounty: {
      Adams: 317000, Asotin: 323700, Benton: 434200, Chelan: 605400, Clallam: 503500,
      Clark: 568600, Columbia: 279500, Cowlitz: 406500, Douglas: 502800, Ferry: 195000,
      Franklin: 434200, Garfield: 225000, Grant: 349700, 'Grays Harbor': 358100, Island: 621200,
      Jefferson: 647500, King: 968300, Kitsap: 553200, Kittitas: 524300, Klickitat: 444400,
      Lewis: 420800, Lincoln: 252500, Mason: 424800, Okanogan: 368400, Pacific: 338200,
      'Pend Oreille': 340300, Pierce: 567800, 'San Juan': 900000, Skagit: 580600, Skamania: 503900,
      Snohomish: 781700, Spokane: 437900, Stevens: 340300, Thurston: 518400, Wahkiakum: 455000,
      'Walla Walla': 429900, Whatcom: 639900, Whitman: 426500, Yakima: 364400,
    },
    // WA homestead is COUNTY-SPECIFIC under one statute (RCW §§ 6.13.010 /
    // .020 / .030) — keyed by county above; the ExemptionsLiquidationPanel
    // synthesizes a homestead suggestion from `homesteadStatute` +
    // `homesteadByCounty` for the debtor's county. The items list below
    // contains only the personal-property exemptions per the firm's
    // canonical WA list (asOf 2026-02-23).
    items: [
      { label: 'Tools/supplies used in trade',                                              statute: 'RCW § 6.15.010(1)(e)',          limit: 15000 },
      { label: 'Motor vehicle',                                                             statute: 'RCW § 6.15.010(1)(d)(iv)',      limit: 15000 },
      { label: 'Other personal property (except earnings)',                                 statute: 'RCW § 6.15.010(1)(d)(ii)',      limit: 10000 },
      { label: 'Household goods/furnishings incl. provisions',                              statute: 'RCW § 6.15.010(1)(d)(i)',       limit: 6500 },
      { label: 'Annuity contract benefits',                                                 statute: 'RCW § 48.18.430',               limit: null,  note: '$3,000/month' },
      { label: 'Personal bodily injury payments',                                           statute: 'RCW § 6.15.010(1)(d)(vii)',     limit: 20000, note: 'up to $20,000' },
      { label: 'Private library incl. electronic media',                                    statute: 'RCW § 6.15.010(1)(b)',          limit: 3500,  note: '$3,500 per individual' },
      { label: 'Wearing apparel',                                                           statute: 'RCW § 6.15.010(1)(a)',          limit: 3500,  note: '$3,500 cap on furs/jewelry/ornaments' },
      { label: 'Federal/state pensions, IRAs, Keogh, retirement plans',                     statute: 'RCW § 6.15.020',                limit: null },
      { label: 'Child support',                                                             statute: 'RCW § 6.15.010(1)(d)(v)',       limit: null },
      { label: 'Wages/salary/compensation for personal services',                           statute: 'RCW § 6.27.150',                limit: null },
      { label: 'Unemployment compensation',                                                 statute: 'RCW § 50.40.020',               limit: null },
      { label: "Worker's comp (industrial insurance law)",                                  statute: 'RCW § 51.32.040',               limit: null },
      { label: 'Public assistance',                                                         statute: 'RCW §§ 74.04.280, 74.08.210',   limit: null },
      { label: 'Cell phone/personal computer/printer',                                      statute: 'RCW § 6.15.010(1)(c)',          limit: null },
    ],
  },
  // ── California (opt-out — debtor elects §703 OR §704 system) ─────────────
  // CA opted out of federal § 522(d). The debtor must elect one of two
  // mutually-exclusive state sets per § 522(b)(1) all-or-nothing:
  //   - §703.140(b) — bankruptcy-only set with a large wildcard ((b)(5))
  //     that ROLLS IN any UNUSED §703.140(b)(1) homestead. Best for
  //     non-homeowners or low-equity homeowners.
  //   - §704.xxx — general-creditors set with the homestead-heavy
  //     §704.730 county-banded + indexed cap (clamp(county_median, floor,
  //     ceiling)). Best for homeowners with significant equity.
  //
  // Items below carry a `system` field so the panel filters to the elected
  // set. The wildcard's `unusedFromStatute` links it to the §703 homestead
  // for the roll-up. Amounts are VERIFY:FALSE — CONFIRM the figures
  // against the operative table (CA Judicial Council triennial adjustment
  // + AB-1885 indexing) before relying on them.
  CA: {
    jurisdiction: 'California',
    effectiveDate: '2026-02-23',
    nextAdjustment: null,
    source: 'Cal. Code Civ. Proc. — CONFIRM all figures against current Judicial Council table',
    verified: false,
    election: 'opt-out',
    requiresSystemElection: true,
    homesteadStatute: 'Cal. Code Civ. Proc. § 704.730',
    homesteadBand: {
      // Per AB-1885 (effective 2021) the homestead floor is $300,000 and
      // ceiling is $600,000, BOTH indexed annually for CPI from 2022. The
      // panel clamps the county prior-year median single-family home sale
      // price to this band. indexationRate is null = TODO; the panel falls
      // back to the band values stored in homesteadByCounty below (which
      // are the operator-published clamped results).
      floorBase: 300000,
      ceilingBase: 600000,
      baseYear: 2021,
      indexationRate: null,
      source: 'Cal. Code Civ. Proc. § 704.730 + AB-1885 (2021) — CONFIRM',
    },
    homesteadByCounty: {
      // Values mirror the prior CA_704 county table; CONFIRM against the
      // current operator table before relying on them. Counties not
      // listed default to the indexed floor.
      Alameda:746375, Alpine:746375, 'Contra Costa':746375, 'Los Angeles':746375, Marin:746375,
      Mono:746375, Monterey:746375, Napa:746375, Orange:746375, 'San Diego':746375,
      'San Francisco':746375, 'San Luis Obispo':746375, 'San Mateo':746375, 'Santa Barbara':746375,
      'Santa Clara':746375, 'Santa Cruz':746375, Ventura:746375,
      'El Dorado':635000, Placer:660000, 'San Benito':715000, Sonoma:735000, Yolo:590000,
      Nevada:575000, Solano:555000, Sacramento:535000, Mendocino:535000, Riverside:545000,
      'San Joaquin':515000, Stanislaus:460000, 'San Bernardino':470000, Amador:455000,
      Calaveras:435000, Tuolumne:395000, Sutter:395000, Humboldt:390000, Inyo:390000,
      Butte:385000, Fresno:385000, Kern:378000, Madera:383000, Merced:383000,
      Shasta:380000, Yuba:385000,
      Colusa:373188, 'Del Norte':373188, Glenn:373188, Imperial:373188, Kings:373188,
      Lake:373188, Lassen:373188, Mariposa:373188, Modoc:373188, Plumas:373188,
      Sierra:373188, Siskiyou:373188, Tehama:373188, Trinity:373188, Tulare:373188,
    },
    items: [
      // ── §703.140(b) — bankruptcy-only set (large wildcard) ──────────────
      { label: 'Homestead (residence) — §703',                          statute: 'Cal. Code Civ. Proc. § 703.140(b)(1)', limit: 36750,  system: '703', note: 'CONFIRM' },
      { label: 'Motor vehicle — §703',                                  statute: 'Cal. Code Civ. Proc. § 703.140(b)(2)', limit: 8625,   system: '703', note: 'CONFIRM' },
      { label: 'Household goods (per item $925 cap) — §703',            statute: 'Cal. Code Civ. Proc. § 703.140(b)(3)', limit: null,   system: '703', note: 'No aggregate; $925 per-item — CONFIRM' },
      { label: 'Jewelry — §703',                                        statute: 'Cal. Code Civ. Proc. § 703.140(b)(4)', limit: 2175,   system: '703', note: 'CONFIRM' },
      { label: 'Wildcard (+ unused homestead) — §703',                  statute: 'Cal. Code Civ. Proc. § 703.140(b)(5)', limit: 1950,   system: '703', unusedFromStatute: 'Cal. Code Civ. Proc. § 703.140(b)(1)', note: '$1,950 base + UNUSED §703.140(b)(1) homestead (up to $36,750) — CONFIRM' },
      { label: 'Tools of trade — §703',                                 statute: 'Cal. Code Civ. Proc. § 703.140(b)(6)', limit: 10950,  system: '703', note: 'CONFIRM' },
      { label: 'Unmatured life insurance (non-credit) — §703',          statute: 'Cal. Code Civ. Proc. § 703.140(b)(7)', limit: null,   system: '703', note: 'CONFIRM' },
      { label: 'Life insurance loan/accrued dividend value — §703',     statute: 'Cal. Code Civ. Proc. § 703.140(b)(8)', limit: 19625,  system: '703', note: 'CONFIRM' },
      { label: 'Health aids — §703',                                    statute: 'Cal. Code Civ. Proc. § 703.140(b)(9)', limit: null,   system: '703' },
      { label: 'Public assistance / SS / unemployment — §703',          statute: 'Cal. Code Civ. Proc. § 703.140(b)(10)(A)', limit: null, system: '703' },
      { label: 'Veterans’ benefits — §703',                             statute: 'Cal. Code Civ. Proc. § 703.140(b)(10)(B)', limit: null, system: '703' },
      { label: 'Disability / illness / unemployment benefits — §703',   statute: 'Cal. Code Civ. Proc. § 703.140(b)(10)(C)', limit: null, system: '703' },
      { label: 'Alimony / child support (needed for support) — §703',   statute: 'Cal. Code Civ. Proc. § 703.140(b)(10)(D)', limit: null, system: '703' },
      { label: 'Pension / retirement (needed for support) — §703',      statute: 'Cal. Code Civ. Proc. § 703.140(b)(10)(E)', limit: null, system: '703' },
      { label: 'Personal-injury compensation — §703',                   statute: 'Cal. Code Civ. Proc. § 703.140(b)(11)(D)', limit: 36750, system: '703', note: 'CONFIRM' },
      // ── §704.xxx — general-creditors set (homestead-heavy) ──────────────
      { label: 'Homestead — §704 (county-banded; see homesteadByCounty)', statute: 'Cal. Code Civ. Proc. § 704.730',     limit: null,   system: '704', note: 'Clamp(county prior-year median, $300k floor, $600k ceiling), both indexed — CONFIRM' },
      { label: 'Motor vehicle — §704',                                  statute: 'Cal. Code Civ. Proc. § 704.010',        limit: 8625,   system: '704', note: 'CONFIRM' },
      { label: 'Household furnishings (reasonable) — §704',             statute: 'Cal. Code Civ. Proc. § 704.020',        limit: null,   system: '704', note: 'No stated cap — reasonable amount, CONFIRM' },
      { label: 'Jewelry / heirlooms / art — §704',                      statute: 'Cal. Code Civ. Proc. § 704.040',        limit: 10950,  system: '704', note: 'CONFIRM' },
      { label: 'Tools of trade — §704',                                 statute: 'Cal. Code Civ. Proc. § 704.060',        limit: 10950,  system: '704', note: 'CONFIRM' },
      { label: 'Bank account from public benefit / SS deposits — §704', statute: 'Cal. Code Civ. Proc. § 704.080',        limit: null,   system: '704', note: 'CONFIRM' },
      { label: 'Life insurance loan/cash value — §704',                 statute: 'Cal. Code Civ. Proc. § 704.100',        limit: 17525,  system: '704', note: '$17,525 ind / $35,050 joint — CONFIRM' },
      { label: 'Public retirement benefits — §704',                     statute: 'Cal. Code Civ. Proc. § 704.110',        limit: null,   system: '704' },
      { label: 'Private retirement / IRA (necessary for support) — §704', statute: 'Cal. Code Civ. Proc. § 704.115',      limit: null,   system: '704' },
      { label: 'Unemployment benefits — §704',                          statute: 'Cal. Code Civ. Proc. § 704.120',        limit: null,   system: '704' },
      { label: 'Public assistance — §704',                              statute: 'Cal. Code Civ. Proc. § 704.170',        limit: null,   system: '704' },
      { label: 'Wages — paid earnings (last 30 days, 75%) — §704',      statute: 'Cal. Code Civ. Proc. § 704.070',        limit: null,   system: '704', note: 'Formula — CONFIRM' },
    ],
  },
};

/** Look up the exemptions for a jurisdiction key
 *  ("Federal" | "AZ" | "WA" | "CA"). */
export function getExemptionsFor(jurisdictionKey: string): ExemptionsJurisdiction | undefined {
  return EXEMPTIONS_BY_JURISDICTION[jurisdictionKey];
}

/** WA-specific: read homestead cap for the debtor's county. Applies the
 *  RCW 6.13.030 statutory floor — the homestead is the GREATER of the
 *  county median figure and $125,000. Every county currently loaded
 *  exceeds the floor, so this is defensive against future data loads or
 *  sub-floor county figures. Returns null when the county is not in the
 *  map (caller surfaces the unknown-county warning). */
const WA_HOMESTEAD_FLOOR = 125_000;
export function getWaHomesteadCap(county: string): number | null {
  const wa = EXEMPTIONS_BY_JURISDICTION.WA;
  if (!wa?.homesteadByCounty) return null;
  const county_value = wa.homesteadByCounty[county];
  if (county_value == null) return null;
  return Math.max(WA_HOMESTEAD_FLOOR, county_value);
}

/** CA §704.730 homestead — clamp(county prior-year median, indexed floor,
 *  indexed ceiling). Reads from homesteadByCounty when populated; falls
 *  back to the indexed floor when the county isn't loaded. Returns null
 *  when the band isn't configured. */
export function getCa704HomesteadCap(county: string | null | undefined): number | null {
  const ca = EXEMPTIONS_BY_JURISDICTION.CA;
  if (!ca?.homesteadByCounty || !ca?.homesteadBand) return null;
  if (county && ca.homesteadByCounty[county] != null) return ca.homesteadByCounty[county];
  // Unknown county → use the floor (most conservative). TODO: apply
  // indexationRate to floorBase when persistence advances the year.
  return ca.homesteadBand.floorBase;
}

/** Filter CA items to a single elected system. Returns the items
 *  unchanged for non-CA jurisdictions (which have no system dimension). */
export function filterBySystem(
  items: ReadonlyArray<ExemptionItem>,
  system: '703' | '704' | null,
): ReadonlyArray<ExemptionItem> {
  if (!items.some(i => i.system)) return items;        // no system dim → pass-through
  if (!system) return [];                              // not yet elected → empty
  return items.filter(i => !i.system || i.system === system);
}

// ─── Legal Rules (citations + editable parameters) ──────────────────────────
//
// Each entry holds a fixed citation + description plus the editable
// $-thresholds / day-counts / dates that the app's eligibility engine and
// auto-issue seeder read. Editing a parameter here propagates everywhere.
//
// Citation text is FIXED REFERENCE; only the parameters are editable.

export interface RuleParameter {
  key: string;
  label: string;
  value: number | string | null;
  unit: 'usd' | 'days' | 'years' | 'percent' | 'text';
  description?: string;
}

export interface LegalRule {
  id: string;
  citation: string;
  shortName: string;
  description: string;
  parameters: ReadonlyArray<RuleParameter>;
  effectiveDate: string;
  source: string;
}

export const LEGAL_RULES: ReadonlyArray<LegalRule> = [
  {
    id: 'means_test_707b',
    citation: '11 U.S.C. § 707(b)',
    shortName: 'Means Test (Chapter 7 abuse presumption)',
    description:
      'Presumption of abuse if disposable income exceeds threshold. Drives the Chapter 7 eligibility analysis.',
    parameters: [
      { key: 'monthlyDmiSafeHarbor', label: 'Monthly DMI safe harbor', value: 228, unit: 'usd', description: 'Below this, no presumption of abuse.' },
      { key: 'monthlyDmiUpperBound', label: 'Monthly DMI upper bound', value: 1245, unit: 'usd', description: 'Above this, presumption of abuse triggers automatically.' },
      { key: 'fiveYearPayoutThresholdPct', label: '5-year payout threshold', value: 25, unit: 'percent', description: '25% of non-priority unsecured debt over 60 months triggers presumption.' },
      { key: 'lookbackMonths', label: 'CMI lookback', value: 6, unit: 'years', description: '6-month average income preceding filing.' },
    ],
    effectiveDate: PART_B_META.effectiveDate,
    source: PART_B_META.source,
  },
  {
    id: 'exemptions_522',
    citation: '11 U.S.C. § 522',
    shortName: 'Exemptions',
    description:
      'Federal exemption scheme + state-opt-out rules. Caps applicable to homestead, motor vehicle, household goods, wildcard, retirement, etc.',
    parameters: [
      { key: 'homesteadCapDays', label: '§ 522(p) homestead cap lookback', value: 1215, unit: 'days', description: 'Acquired within 1,215 days before filing → federal cap applies.' },
      { key: 'domicile730Days', label: '§ 522(b)(3) domicile rule', value: 730, unit: 'days', description: 'State of domicile for the majority of the 730 days preceding filing.' },
      { key: 'domicileLookback180Days', label: 'Lookback window', value: 180, unit: 'days', description: '180-day window within the 730-day domicile lookback.' },
    ],
    effectiveDate: PART_B_META.effectiveDate,
    source: PART_B_META.source,
  },
  {
    id: 'preferences_547',
    citation: '11 U.S.C. § 547 + § 101(31)',
    shortName: 'Preferential transfers (incl. insider 1-yr lookback)',
    description:
      'Trustee may avoid preferential transfers. Non-insider lookback 90 days; insider lookback 1 year. "Insider" defined at § 101(31).',
    parameters: [
      { key: 'nonInsiderLookbackDays', label: 'Non-insider lookback', value: 90, unit: 'days' },
      { key: 'insiderLookbackDays', label: 'Insider lookback', value: 365, unit: 'days' },
      { key: 'nonInsiderThreshold', label: 'Non-insider $ threshold', value: 600, unit: 'usd', description: '§ 547(c)(8) consumer-debt $600 floor.' },
    ],
    effectiveDate: PART_B_META.effectiveDate,
    source: PART_B_META.source,
  },
  {
    id: 'discharge_bar_727_1328',
    citation: '11 U.S.C. § 727(a)(8) / § 1328(f)',
    shortName: 'Chapter 7 discharge bar (prior filing)',
    description:
      '8-year bar on successive Ch.7 discharges (§ 727(a)(8)); 4-year bar Ch.7→Ch.13 and 2-year bar Ch.13→Ch.13.',
    parameters: [
      { key: 'ch7ToCh7Years', label: 'Ch.7 → Ch.7 bar', value: 8, unit: 'years' },
      { key: 'ch7ToCh13Years', label: 'Ch.7 → Ch.13 bar', value: 4, unit: 'years' },
      { key: 'ch13ToCh7Years', label: 'Ch.13 → Ch.7 bar', value: 6, unit: 'years' },
      { key: 'ch13ToCh13Years', label: 'Ch.13 → Ch.13 bar', value: 2, unit: 'years' },
    ],
    effectiveDate: PART_B_META.effectiveDate,
    source: PART_B_META.source,
  },
  {
    id: 'luxury_523_a_2_C',
    citation: '11 U.S.C. § 523(a)(2)(C)',
    shortName: 'Luxury goods / cash advance presumption',
    description:
      'Presumption of nondischargeability for (i) luxury goods/services on a single creditor over the $ threshold within 90 days, and (ii) cash advances over the $ threshold within 70 days.',
    parameters: [
      { key: 'luxuryGoodsThresholdUsd', label: 'Luxury goods $ threshold', value: 800, unit: 'usd' },
      { key: 'luxuryGoodsLookbackDays', label: 'Luxury goods lookback', value: 90, unit: 'days' },
      { key: 'cashAdvanceThresholdUsd', label: 'Cash advance $ threshold', value: 1100, unit: 'usd', description: 'Adjusted periodically by the Judicial Conference.' },
      { key: 'cashAdvanceLookbackDays', label: 'Cash advance lookback', value: 70, unit: 'days' },
    ],
    effectiveDate: PART_B_META.effectiveDate,
    source: PART_B_META.source,
  },
  {
    id: 'vehicle_910_day',
    citation: '11 U.S.C. § 1325(a) hanging paragraph',
    shortName: '910-day vehicle rule (Ch.13 cramdown bar)',
    description:
      'Purchase-money security interest in a motor vehicle acquired within 910 days of filing for personal use cannot be crammed down to value in Ch.13.',
    parameters: [
      { key: 'vehicle910Days', label: 'Vehicle lookback', value: 910, unit: 'days' },
      { key: 'otherCollateral365Days', label: 'Other collateral lookback', value: 365, unit: 'days', description: 'PMSI in other collateral acquired within 1 year.' },
    ],
    effectiveDate: PART_B_META.effectiveDate,
    source: PART_B_META.source,
  },
  {
    id: 'inheritance_541_a_5',
    citation: '11 U.S.C. § 541(a)(5)',
    shortName: '180-day post-petition inheritance sweep',
    description:
      'Property the debtor acquires by bequest, devise, inheritance, life insurance, or property settlement within 180 days after filing belongs to the estate.',
    parameters: [
      { key: 'postPetitionWindowDays', label: 'Post-petition sweep window', value: 180, unit: 'days' },
    ],
    effectiveDate: PART_B_META.effectiveDate,
    source: PART_B_META.source,
  },
];

/** Look up a rule by ID. */
export function getLegalRule(id: string): LegalRule | undefined {
  return LEGAL_RULES.find(r => r.id === id);
}

/** Look up a single editable parameter on a rule. */
export function getRuleParameter(ruleId: string, paramKey: string): RuleParameter | undefined {
  return getLegalRule(ruleId)?.parameters.find(p => p.key === paramKey);
}

/** Read a numeric parameter from the store with a typed default. Consumers
 *  use this everywhere a hardcoded $-threshold / day-count / year-count
 *  appears — editing the value in the LegalReferenceStore propagates here. */
export function getRuleNumber(ruleId: string, paramKey: string, fallback: number): number {
  const p = getRuleParameter(ruleId, paramKey);
  if (p && typeof p.value === "number") return p.value;
  if (p && typeof p.value === "string") {
    const n = parseFloat(p.value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

// ─── Proposal + Audit trail shapes (front-end scaffold) ─────────────────────
//
// Non-lawyers cannot directly modify rules/standards/exemptions. They
// submit a proposal which routes to a super attorney admin for approval.
// On approval, the new value replaces the current value and an immutable
// audit entry is written.

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'superseded';

export interface LegalReferenceProposal {
  id: string;
  /** Dot-path identifying what's being changed (e.g.,
   *  "rules.luxury_523_a_2_C.parameters.luxuryGoodsThresholdUsd", or
   *  "housing.AZ.Maricopa[3]"). */
  path: string;
  oldValue: number | string | null;
  proposedValue: number | string | null;
  proposedEffectiveDate: string;
  source: string;
  rationale?: string;
  requestedBy: { userId: string; displayName: string; role: string };
  requestedAt: string;
  status: ProposalStatus;
  decidedBy?: { userId: string; displayName: string; role: string };
  decidedAt?: string;
  decisionNote?: string;
}

// ─── Ruleset version snapshot ──────────────────────────────────────────────
//
// A short, stable string identifying which "edition" of the rules an
// attorney was working against. Stamped onto every completed attorney
// review. When the current version differs from the stamped version AND
// the case has reached signing review but is NOT yet filed or closed,
// the case is auto-flagged for re-review.
//
// Cases marked filed or closed are LOCKED — never re-flagged. The
// re-review check compares only at render time; no DB writes here.
//
// TODO Phase B — persistence:
//   - attorney_intake_reviews.reviewed_ruleset_version (text column)
//   - on review submit: write the current ruleset version
//   - signing_reviews / lead status flags: `case_status` enum incl.
//     'reviewed_pending_signing' | 'filed' | 'closed' so the comparison
//     knows which cases are in-window vs locked
//   - server-side: same comparison logic runs on every fetch so the
//     attorney portal Cases-Needing-Review queue is authoritative

export interface RulesetVersion {
  /** Stable concatenation — same content yields same string. */
  id: string;
  /** Breakout for the re-review reason text. */
  parts: {
    medianIncome: string;
    irsStandards: string;
    federalExemptions: string;
    azExemptions: string;
    waExemptions: string;
  };
}

export function getCurrentRulesetVersion(): RulesetVersion {
  const fed = EXEMPTIONS_BY_JURISDICTION.Federal?.effectiveDate ?? "—";
  const az = EXEMPTIONS_BY_JURISDICTION.AZ?.effectiveDate ?? "—";
  const wa = EXEMPTIONS_BY_JURISDICTION.WA?.effectiveDate ?? "—";
  const parts = {
    medianIncome: MEDIAN_INCOME_META.effectiveDate,
    irsStandards: PART_B_META.effectiveDate,
    federalExemptions: fed,
    azExemptions: az,
    waExemptions: wa,
  };
  const id =
    `med:${parts.medianIncome};irs:${parts.irsStandards};` +
    `exF:${parts.federalExemptions};exAZ:${parts.azExemptions};exWA:${parts.waExemptions}`;
  return { id, parts };
}

/** Diff two ruleset versions. Returns a human-readable reason string when
 *  they differ (used by the Cases-Needing-Review queue), or null when
 *  identical. */
export function diffRulesetVersions(
  stampedId: string | null | undefined,
  current: RulesetVersion,
): string | null {
  if (!stampedId) {
    return "This case was reviewed before ruleset version tracking was enabled; please re-confirm against the current rules.";
  }
  if (stampedId === current.id) return null;

  // Parse old version into the same parts shape for comparison.
  const oldParts = Object.fromEntries(
    stampedId.split(";").map(s => {
      const [k, v] = s.split(":");
      return [k, v ?? ""];
    }),
  ) as Record<string, string>;

  const reasons: string[] = [];
  if (oldParts.med && oldParts.med !== current.parts.medianIncome) {
    reasons.push(`Median income table updated (${oldParts.med} → ${current.parts.medianIncome})`);
  }
  if (oldParts.irs && oldParts.irs !== current.parts.irsStandards) {
    reasons.push(`IRS standards updated (${oldParts.irs} → ${current.parts.irsStandards})`);
  }
  if (oldParts.exF && oldParts.exF !== current.parts.federalExemptions) {
    reasons.push(`Federal § 522(d) exemptions updated (${oldParts.exF} → ${current.parts.federalExemptions})`);
  }
  if (oldParts.exAZ && oldParts.exAZ !== current.parts.azExemptions) {
    reasons.push(`Arizona exemptions updated (${oldParts.exAZ} → ${current.parts.azExemptions})`);
  }
  if (oldParts.exWA && oldParts.exWA !== current.parts.waExemptions) {
    reasons.push(`Washington exemptions updated (${oldParts.exWA} → ${current.parts.waExemptions})`);
  }
  if (reasons.length === 0) {
    // Fell-through difference — versions differ in some way the parsing
    // didn't enumerate (e.g., older format). Generic message.
    return "Ruleset version changed since this case was reviewed; please re-confirm against the current rules.";
  }
  return reasons.join(" · ");
}

export interface LegalReferenceAuditEntry {
  id: string;
  path: string;
  oldValue: number | string | null;
  newValue: number | string | null;
  effectiveDate: string;
  source: string;
  changedBy: { userId: string; displayName: string; role: string };
  changedAt: string;
  /** When the change came from an approved proposal, the proposal id. */
  proposalId?: string;
}
