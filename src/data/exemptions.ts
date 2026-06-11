// Typed exemption dataset — ADAPTER over the centralized legal-reference
// store. The canonical data lives in src/lib/irsMeansStandards.ts → the
// EXEMPTIONS_BY_JURISDICTION object the Bankruptcy Exemptions page, the
// Signing-Review liquidation panel, and the intake/eligibility engine all
// read live. This file does NOT duplicate that data — it re-shapes it into
// the contract used by callers that need:
//
//   - integer-cent amounts (not float dollars)
//   - a `perDebtor` flag (drives joint-case doubling in the
//     liquidation panel under § 522(m))
//   - per-jurisdiction regime flags (AZ opt-out, WA election, FED)
//
// One change in EXEMPTIONS_BY_JURISDICTION → every consumer sees the new
// value on next render. The audit log + re-review trigger (already wired
// through rulesAuditStore → diffRulesetVersions) fire on store edits.

import {
  EXEMPTIONS_BY_JURISDICTION,
  type ExemptionItem,
  type ExemptionsJurisdiction,
} from "../lib/irsMeansStandards";

// ─── Contract ──────────────────────────────────────────────────────────────

export type JurisdictionCode = "AZ" | "WA" | "FED" | "CA";

/** CA election system. Required when jurisdiction === 'CA'; null otherwise. */
export type CaSystem = '703' | '704';

export interface ExemptionRow {
  /** Stable id for React keys + audit references. */
  id: string;
  jurisdiction: JurisdictionCode;
  /** Human-readable bucket (mirrors the store's `label`). */
  category: string;
  /** Statute citation EXACTLY as published. Source of truth for re-review
   *  diff messages. */
  statute: string;
  /** Free-text description — falls back to the category when the store
   *  doesn't carry a separate note. */
  description: string;
  /** Cap in INTEGER CENTS. null = no fixed dollar cap (unlimited /
   *  formula / 100%). NEVER render null as $0. */
  amountCents: number | null;
  /** Doubles for joint debtors (each filing spouse claims the amount
   *  separately). Defaults to true for most exemptions — § 522(m) makes
   *  the per-debtor doubling the federal default; state regimes are
   *  generally per-debtor too, with named exceptions in
   *  PER_DEBTOR_OVERRIDES below. */
  perDebtor: boolean;
  /** Same as amountCents converted to dollars — convenience for code that
   *  prefers dollars (mirrors the store's `limit`). */
  cap?: number | null;
  notes?: string;
  /** Hardcoded to false until attorney verification ships. Mirrors the
   *  store's `jur.verified` flag (jurisdiction-wide). */
  verified: false;
  /** CA-only: which election system this row belongs to (§703 vs §704).
   *  Undefined for AZ/WA/FED. */
  system?: CaSystem;
  /** When set, the row's cap rolls in UNUSED equity from another row
   *  (referenced by statute). Today: CA §703.140(b)(5) wildcard pulls
   *  unused §703.140(b)(1) homestead. */
  unusedFromStatute?: string;
}

export interface JurisdictionRegime {
  code: JurisdictionCode;
  label: string;
  /** Source-of-truth key in EXEMPTIONS_BY_JURISDICTION. */
  storeKey: string;
  /** State has opted out of § 522(d): debtor uses state set only.
   *  Federal-NONBANKRUPTCY exemptions (e.g. § 522(b)(3)(C) retirement)
   *  remain available — the panel handles them as exemption rows in
   *  their own right. */
  optOut?: boolean;
  /** Debtor may elect state set OR Federal § 522(d) — all-or-nothing per
   *  § 522(b)(1). */
  choiceAllowed?: boolean;
  /** This IS the federal set. Only available where the debtor's state
   *  permits (i.e. state is not opt-out). */
  isFederal?: boolean;
  /** True when the jurisdiction requires the debtor to elect one of two
   *  mutually-exclusive sets (CA §703 vs §704). The panel surfaces a
   *  system picker; until elected, no rows are selectable. */
  requiresSystemElection?: boolean;
}

export const REGIMES: Record<JurisdictionCode, JurisdictionRegime> = {
  AZ:  { code: "AZ",  label: "Arizona",         storeKey: "AZ",      optOut: true },
  WA:  { code: "WA",  label: "Washington",      storeKey: "WA",      choiceAllowed: true },
  FED: { code: "FED", label: "Federal § 522(d)", storeKey: "Federal", isFederal: true },
  CA:  { code: "CA",  label: "California",      storeKey: "CA",      optOut: true, requiresSystemElection: true },
};

// ─── Per-debtor overrides ──────────────────────────────────────────────────
//
// Most exemptions double for joint debtors. The few that don't (single
// homestead cap regardless of joint, statutorily indivisible items) live
// here keyed by statute. Attorneys should re-verify before relying on this
// list — courts have split on several state homesteads.
//
// TODO: paste the firm's verified per-debtor matrix here. Defaults to true
// (doubles) for anything not listed — safer to over-double on the first
// pass and have the attorney trim than under-double and miss exemption
// equity.
const PER_DEBTOR_OVERRIDES: Record<string, boolean> = {
  // Example shape — confirm with the firm's attorney before treating as
  // authoritative:
  // "A.R.S. § 33-1101(A)": false, // AZ homestead — single owner-occupied
  //                                  residence; one cap regardless of joint
  // "Wash. Rev. Code §§ 6.13.010, 6.13.020, 6.13.030": false,
  //                                  // WA homestead — likewise county-cap
};

function perDebtorFor(statute: string): boolean {
  if (statute in PER_DEBTOR_OVERRIDES) return PER_DEBTOR_OVERRIDES[statute];
  return true;
}

// ─── Adapter ──────────────────────────────────────────────────────────────

function rowsFor(code: JurisdictionCode, idPrefix: string): ExemptionRow[] {
  const regime = REGIMES[code];
  const jur: ExemptionsJurisdiction | undefined = EXEMPTIONS_BY_JURISDICTION[regime.storeKey];
  if (!jur) return [];

  const rows: ExemptionRow[] = jur.items.map((it: ExemptionItem, i): ExemptionRow => ({
    id: `${idPrefix}-${i}`,
    jurisdiction: code,
    category: it.label,
    statute: it.statute,
    description: it.note ?? it.label,
    amountCents: it.limit == null ? null : Math.round(it.limit * 100),
    perDebtor: perDebtorFor(it.statute),
    cap: it.limit,
    notes: it.note,
    verified: false,
    // CA-only fields — undefined for AZ/WA/FED.
    system: it.system,
    unusedFromStatute: it.unusedFromStatute,
  }));

  // WA homestead lives at the jurisdiction level (homesteadStatute +
  // homesteadByCounty) rather than in items. Synthesize a row so callers
  // that filter by `jurisdiction === 'WA'` see homestead alongside the
  // personal-property exemptions. The cap stays null here — the Signing-
  // Review panel resolves it from homesteadByCounty[clientCounty] at
  // render time via getWaHomesteadCap().
  if (code === "WA" && jur.homesteadStatute) {
    rows.unshift({
      id: `${idPrefix}-homestead`,
      jurisdiction: "WA",
      category: "Homestead (county-specific)",
      statute: jur.homesteadStatute,
      description: "WA homestead cap varies by debtor's county; see homesteadByCounty.",
      amountCents: null,
      perDebtor: perDebtorFor(jur.homesteadStatute),
      cap: null,
      notes: "Resolved by debtor county at the Signing-Review panel.",
      verified: false,
    });
  }

  return rows;
}

// Eager (memoized via module-level constant). When the store mutates the
// underlying constants the adapter still serves stale rows — switch to
// lazy getter form (getExemptionRows()) when persistence advances the
// data at runtime.
export const EXEMPTIONS_AZ:  ExemptionRow[] = rowsFor("AZ",  "az");
export const EXEMPTIONS_WA:  ExemptionRow[] = rowsFor("WA",  "wa");
export const EXEMPTIONS_FED: ExemptionRow[] = rowsFor("FED", "fed");
export const EXEMPTIONS_CA:  ExemptionRow[] = rowsFor("CA",  "ca");

export function getExemptionRows(code: JurisdictionCode): ExemptionRow[] {
  switch (code) {
    case "AZ":  return EXEMPTIONS_AZ;
    case "WA":  return EXEMPTIONS_WA;
    case "FED": return EXEMPTIONS_FED;
    case "CA":  return EXEMPTIONS_CA;
  }
}

/** CA-only: filter rows to a single elected system. Pass-through for
 *  jurisdictions that don't carry the system dimension. */
export function getExemptionRowsForSystem(
  code: JurisdictionCode,
  system: CaSystem | null,
): ExemptionRow[] {
  const all = getExemptionRows(code);
  if (code !== "CA") return all;
  if (!system) return [];           // not yet elected — empty until attorney picks
  return all.filter(r => r.system === system);
}

// ─── Regime resolution ─────────────────────────────────────────────────────

/** Given the debtor's state, return the JurisdictionCodes the debtor may
 *  elect among. Mirrors the Signing-Review panel's jurisdiction-selector
 *  filter:
 *    AZ → ['AZ']            (opt-out — no federal §522(d))
 *    WA → ['WA', 'FED']     (debtor elects state OR federal, mutually exclusive)
 *    CA → ['CA']            (opt-out + requires §703 vs §704 sub-election)
 *    other → ['FED']        (caller knows better; defaults to federal as a
 *                            safe placeholder until the state's regime ships)
 */
export function getAllowedJurisdictionsForState(stateCode: string | null | undefined): JurisdictionCode[] {
  const up = stateCode?.toUpperCase();
  if (up === "AZ") return ["AZ"];
  if (up === "WA") return ["WA", "FED"];
  if (up === "CA") return ["CA"];
  return ["FED"];
}

/** Lookup the row for a (jurisdiction, statute) — used by the liquidation
 *  panel to read perDebtor when applying joint-case doubling. Statute is
 *  the natural foreign key since the underlying store keys items by it. */
export function findRowByStatute(
  code: JurisdictionCode,
  statute: string,
): ExemptionRow | undefined {
  return getExemptionRows(code).find(r => r.statute === statute);
}

// TODO: paste full verified AZ/WA/Federal dataset here once the firm's
// attorney signs off on each row. The shape above is stable; replace the
// adapter call sites' source (currently EXEMPTIONS_BY_JURISDICTION) with
// a static const if the firm prefers to maintain the rows directly in
// this file. Today the adapter approach keeps a SINGLE source of truth
// for the Bankruptcy Exemptions page edits + audit log + re-review hook.
