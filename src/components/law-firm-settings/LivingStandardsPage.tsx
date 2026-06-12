// Living Standards page (left-nav).
//
// Sub-sections (rendered together with their own audit + adjust + update):
//   1. National Standards — household-size × category table
//   2. Local Housing & Utilities — by state → county → household-size array
//   3. Transportation — Ownership (national), Public transit (national),
//      Operating by region/metro
//
// Edit gated to attorney + super_admin + owner. Audit log + re-review
// trigger fire on every direct edit (path captured for each cell).

import { useEffect, useMemo, useState } from "react";
import {
  Home, Car, Edit3, Upload, Lock, History, AlertTriangle, Save,
  ChevronDown, ChevronRight, Bus,
} from "lucide-react";
import {
  NATIONAL_STANDARDS_2025, NATIONAL_STANDARDS_2025_META,
  IRS_HOUSING_UTILITIES_2025, IRS_TRANSPORTATION_2025,
} from "../../lib/irsMeansStandards";
import { useRulesAudit } from "./rulesAuditStore";
import RulesSectionAudit from "./RulesSectionAudit";
import ReReviewQueue from "./ReReviewQueue";
import CanonicalMaintenanceBanner from "./CanonicalMaintenanceBanner";
import RuleSectionMeta from "./RuleSectionMeta";
import {
  LivingStandardsOverlayProvider, useLivingStandardsOverlay,
  canAdjustLivingStandards,
} from "./livingStandardsOverlay";
import type { ViewerRole } from "../department-management/types";
import type { LegalReferenceViewerRole } from "../legal-reference/LegalReferenceStore";
import { useFirmAdmittedStateCodes } from "../../lib/firmPolicy";

// Metro → state code map for the Transportation operating allowance. The
// IRS_TRANSPORTATION_2025 store keys metros by display label (not state),
// so the filter needs an inline lookup to drop metros whose state isn't
// admitted. The list mirrors the metros currently loaded into the store;
// future metros need an entry here too.
const METRO_TO_STATE_CODE: Readonly<Record<string, string>> = {
  Boston: "MA", "New York": "NY", Philadelphia: "PA",
  Chicago: "IL", Cleveland: "OH", Detroit: "MI",
  "Minneapolis-St. Paul": "MN", "St. Louis": "MO",
  Atlanta: "GA", Baltimore: "MD", "Dallas-Ft. Worth": "TX",
  Houston: "TX", Miami: "FL", Tampa: "FL", "Washington, D.C.": "DC",
  Anchorage: "AK", Denver: "CO", Honolulu: "HI",
  "Los Angeles": "CA", Phoenix: "AZ", "San Diego": "CA",
  "San Francisco": "CA", Seattle: "WA",
};

export type LivingStandardsSub = "all" | "national" | "housing" | "transportation";

interface Props {
  viewerRole: ViewerRole;
  /** Existing LegalReferenceViewerRole carrying the attorney supervisor /
   *  owner signal. 'attorney_super_admin' OR 'law_firm_owner' may adjust
   *  the firm overlay; everyone else is read-only. */
  legalReferenceRole?: LegalReferenceViewerRole;
  /** When set to a specific sub-group, only that block renders (open by
   *  default). 'all' (default) keeps the original collapsible layout. The
   *  left-nav drives sub-selection — Living Standards is an expandable
   *  group, mirroring the Departments pattern. */
  activeSub?: LivingStandardsSub;
}

export default function LivingStandardsPage({
  viewerRole, legalReferenceRole = "none", activeSub = "all",
}: Props) {
  // CANONICAL living standards are READ-ONLY at the firm level — edits
  // live in the Bankruptcy.AI admin portal's Reference Rules tower.
  //
  // The FIRM OVERLAY (firm-scoped delta on top of canonical) stays here:
  // it's a firm customization layered on canonical, not a canonical edit.
  // Gate: attorney supervisor / owner (canAdjustLivingStandards reading
  // the existing LegalReferenceViewerRole enum — attorney_super_admin OR
  // law_firm_owner). Plain super_admin (non-lawyer) cannot adjust;
  // legal_admin / department_supervisor (non-bar) cannot adjust.
  void viewerRole;
  return (
    <LivingStandardsOverlayProvider viewerStaffRole={legalReferenceRole}>
      <LivingStandardsPageInner legalReferenceRole={legalReferenceRole} activeSub={activeSub} />
    </LivingStandardsOverlayProvider>
  );
}

function LivingStandardsPageInner({
  legalReferenceRole, activeSub,
}: { legalReferenceRole: LegalReferenceViewerRole; activeSub: LivingStandardsSub }) {
  const canAdjust = canAdjustLivingStandards(legalReferenceRole);
  // `canEdit` retained as the variable name the sub-blocks consume — now
  // means "firm may apply an overlay" (attorney supervisor / owner) rather
  // than the old free-for-all gate. The canonical layer remains
  // operator-only (gated separately via isPlatformOperator below).
  const canEdit = canAdjust;
  const audit = useRulesAudit();
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Living Standards"
        subtitle="IRS-adopted allowable living expenses. National Standards + Local Housing & Utilities + Transportation (ownership / operating / transit)."
        right={
          <div className="flex items-center gap-1 flex-wrap">
            {canEdit ? (
              <span className="text-[10px] uppercase tracking-widest border rounded-full px-2 py-0.5"
                    style={{ borderColor: "var(--lfs-accent)", color: "var(--lfs-accent)" }}>
                <Edit3 className="w-3 h-3 inline mr-1" /> Edit mode
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-widest text-[#6B6B66] border border-[#2A2A28] rounded-full px-2 py-0.5">
                <Lock className="w-3 h-3 inline mr-1" /> View + propose
              </span>
            )}
            <button onClick={() => setShowQueue(s => !s)} className="text-[11px] font-semibold text-[#6B6B66] border border-[#2A2A28] rounded px-2 py-1 hover:text-white">
              <AlertTriangle className="w-3 h-3 inline" /> Re-review ({audit.reReview.filter(r => r.status === "pending").length})
            </button>
            <button onClick={() => setShowAuditLog(s => !s)} className="text-[11px] font-semibold text-[#6B6B66] border border-[#2A2A28] rounded px-2 py-1 hover:text-white">
              <History className="w-3 h-3 inline" /> Audit
            </button>
          </div>
        }
      />

      {/* Canonical-maintenance banner — Living Standards is operator-
          maintained at the canonical layer; the firm overlay is the single
          allowed firm-side adjustment. */}
      <CanonicalMaintenanceBanner
        datasetLabel="IRS Living Standards (canonical)"
        version={NATIONAL_STANDARDS_2025_META.effectiveDate}
        updatedOn={NATIONAL_STANDARDS_2025_META.effectiveDate}
        unverified={!NATIONAL_STANDARDS_2025_META.verified}
      />

      {/* Firm overlay scope notice — visible whenever the viewer has the
          adjust permission so they know edits go to the firm overlay, not
          to canonical. */}
      {canAdjust && (
        <p className="text-[11px] text-amber-200 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
          You may apply a <strong>firm-scoped overlay</strong> on top of canonical living-standards
          values. Canonical values stay unchanged; the overlay raises or lowers a specific line
          for this firm and triggers pre-filing re-review on every in-window case.
        </p>
      )}

      {showQueue && <ReReviewQueue section="living_standards" />}
      {showAuditLog && <RulesSectionAudit section="living_standards" />}

      {(activeSub === "all" || activeSub === "national")        && <NationalSub        canEdit={canEdit} initialOpen={activeSub !== "all"} />}
      {(activeSub === "all" || activeSub === "housing")         && <HousingSub         canEdit={canEdit} initialOpen={activeSub !== "all"} />}
      {(activeSub === "all" || activeSub === "transportation") && <TransportationSub canEdit={canEdit} initialOpen={activeSub !== "all"} />}
    </div>
  );
}

// ─── 1. National Standards ─────────────────────────────────────────────────

function NationalSub({ canEdit, initialOpen = true }: { canEdit: boolean; initialOpen?: boolean }) {
  // Edits write to the firm-scoped overlay on top of canonical, NOT to the
  // underlying NATIONAL_STANDARDS_2025 array. The overlay internally
  // records to the rulesAuditStore (audit + edit-counter + re-review).
  const overlay = useLivingStandardsOverlay();
  const [open, setOpen] = useState(initialOpen);
  const [edits, setEdits] = useState<Record<string, number | null>>({});

  const CATEGORIES: Array<{ key: keyof (typeof NATIONAL_STANDARDS_2025)[number]; label: string }> = [
    { key: "food",                 label: "Food" },
    { key: "housekeepingSupplies", label: "Housekeeping supplies" },
    { key: "apparelServices",      label: "Apparel & services" },
    { key: "personalCare",         label: "Personal care" },
    { key: "miscellaneous",        label: "Miscellaneous" },
  ];

  function pathFor(size: number, field: string) {
    return `living_standards.national.${field}.size${size}`;
  }

  function canonicalFor(size: number, field: string): number | null {
    const row = NATIONAL_STANDARDS_2025.find(r => r.householdSize === size);
    return (row as unknown as Record<string, number | null>)?.[field] ?? null;
  }

  function effectiveFor(size: number, field: string): number | null {
    const k = `ns.${size}.${field}`;
    if (k in edits) return edits[k];
    return overlay.getEffective(pathFor(size, field), canonicalFor(size, field));
  }

  function setVal(size: number, field: string, v: number | null) {
    setEdits(e => ({ ...e, [`ns.${size}.${field}`]: v }));
  }

  function save() {
    const count = Object.keys(edits).length;
    if (count === 0) return;
    Object.entries(edits).forEach(([k, v]) => {
      const parts = k.split(".");
      const size = parseInt(parts[1]);
      const field = parts[2];
      overlay.setOverride({
        path: pathFor(size, field),
        value: v,
        canonical: canonicalFor(size, field),
      });
    });
    setEdits({});
    alert(`Saved ${count} firm overlay(s). Canonical unchanged; audit + re-review queued.`);
  }

  const sizes: Array<{ size: number; label: string }> = [
    { size: 1, label: "1" }, { size: 2, label: "2" }, { size: 3, label: "3" }, { size: 4, label: "4" },
    { size: -1, label: "Each addl (over 4)" },
  ];

  return (
    <SubBlock
      icon={<Home className="w-3.5 h-3.5" style={{ color: "var(--lfs-accent)" }} />}
      title="National Standards"
      subtitle={`Source: ${NATIONAL_STANDARDS_2025_META.source} · Effective ${NATIONAL_STANDARDS_2025_META.effectiveDate}`}
      open={open}
      onToggle={() => setOpen(o => !o)}
      right={canEdit && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => alert("Upload — UST PDF / Excel parser TODO.")}
            className="text-[11px] font-semibold px-2 py-1 rounded border"
            style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" }}
          >
            <Upload className="w-3 h-3 inline" /> Update
          </button>
          {Object.keys(edits).length > 0 && (
            <button onClick={save} className="text-[11px] font-semibold px-2 py-1 rounded border border-emerald-700/60 bg-emerald-900/30 text-emerald-100">
              <Save className="w-3 h-3 inline" /> Save {Object.keys(edits).length}
            </button>
          )}
        </div>
      )}
    >
      <div className="mb-3">
        <RuleSectionMeta
          changeSection="living_standards.national"
          auditSection="living_standards"
          datasetDate={NATIONAL_STANDARDS_2025_META.effectiveDate}
          headingOverride="Living Standards — National Standards"
        />
      </div>
      <div className="overflow-x-auto rounded border border-[#2A2A28] bg-[#1A1A18]">
        <table className="min-w-full text-[11px]">
          <thead className="bg-[#0F0F0E]">
            <tr className="text-[#6B6B66]">
              <th className="text-left px-3 py-2">Household</th>
              {CATEGORIES.map(c => <th key={c.key as string} className="text-right px-3 py-2 whitespace-nowrap">{c.label}</th>)}
              <th className="text-right px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {sizes.map(r => {
              const row = NATIONAL_STANDARDS_2025.find(x => x.householdSize === r.size);
              return (
                <tr key={r.size} className="border-t border-[#2A2A28] text-[#FAFAF7]">
                  <td className="px-3 py-2 font-semibold">{r.label}</td>
                  {CATEGORIES.map(c => {
                    const v = effectiveFor(r.size, c.key as string);
                    const canonical = canonicalFor(r.size, c.key as string);
                    const overridden = overlay.getOverride(pathFor(r.size, c.key as string)) != null;
                    return (
                      <td key={c.key as string} className="px-3 py-2 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            value={v ?? ""}
                            onChange={e => setVal(r.size, c.key as string, e.target.value === "" ? null : parseInt(e.target.value))}
                            title={overridden ? `Canonical: $${canonical ?? "—"} — firm overlay active` : `Canonical: $${canonical ?? "—"}`}
                            className={`bg-[#0F0F0E] border text-[11px] text-[#FAFAF7] rounded px-2 py-1 w-20 text-right ${overridden ? "border-amber-500/60" : "border-[#2A2A28]"}`}
                          />
                        ) : (
                          <span
                            className="tabular-nums"
                            style={v != null ? { color: overridden ? "#fbbf24" : "var(--lfs-accent)" } : { color: "#6B6B66" }}
                            title={overridden ? `Firm overlay (canonical: $${canonical ?? "—"})` : undefined}
                          >
                            {v != null ? `$${v}` : "—"}
                            {overridden && <span className="text-[8px] ml-1 text-amber-300">∆</span>}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: "var(--lfs-accent)" }}>
                    {row?.total != null ? `$${row.total}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SubBlock>
  );
}

// ─── 2. Local Housing & Utilities ──────────────────────────────────────────

function HousingSub({ canEdit, initialOpen = false }: { canEdit: boolean; initialOpen?: boolean }) {
  // Edits → firm overlay, same path-keyed shape as NationalSub.
  const overlay = useLivingStandardsOverlay();
  const [open, setOpen] = useState(initialOpen);
  // Firm profile drives which loaded states are visible. The store uses
  // 2-letter codes (AZ, WA, CA); admitted codes derive from the
  // firm-policy admitted-states list.
  const admittedCodes = useFirmAdmittedStateCodes();
  const admittedCodeSet = useMemo(() => new Set(admittedCodes), [admittedCodes]);
  const allLoadedStates = useMemo(() => Object.keys(IRS_HOUSING_UTILITIES_2025), []);
  const states = useMemo(
    () => allLoadedStates.filter(c => admittedCodeSet.has(c)),
    [allLoadedStates, admittedCodeSet],
  );
  const [activeState, setActiveState] = useState<string>(states[0] ?? allLoadedStates[0] ?? "AZ");
  const [edits, setEdits] = useState<Record<string, number | null>>({});

  // Auto-snap when admitted set changes and activeState drops out.
  useEffect(() => {
    if (states.length === 0) return;
    if (!states.includes(activeState)) setActiveState(states[0]);
  }, [states, activeState]);

  const counties = IRS_HOUSING_UTILITIES_2025[activeState] ?? {};
  const countyList = Object.keys(counties);

  function pathFor(state: string, county: string, size: number) {
    return `living_standards.housing.${state}.${county}.size${size}`;
  }
  function canonicalFor(state: string, county: string, size: number): number | null {
    return IRS_HOUSING_UTILITIES_2025[state]?.[county]?.[size - 1] ?? null;
  }

  function setCell(county: string, size: number, v: number | null) {
    setEdits(prev => ({ ...prev, [`hu.${activeState}.${county}.${size}`]: v }));
  }
  function effectiveFor(county: string, size: number): number | null {
    const k = `hu.${activeState}.${county}.${size}`;
    if (k in edits) return edits[k];
    return overlay.getEffective(pathFor(activeState, county, size), canonicalFor(activeState, county, size));
  }
  function save() {
    const count = Object.keys(edits).length;
    if (count === 0) return;
    Object.entries(edits).forEach(([k, v]) => {
      const [, st, county, sizeStr] = k.split(".");
      const size = parseInt(sizeStr);
      overlay.setOverride({
        path: pathFor(st, county, size),
        value: v,
        canonical: canonicalFor(st, county, size),
      });
    });
    setEdits({});
    alert(`Saved ${count} firm overlay(s). Canonical unchanged; audit + re-review queued.`);
  }

  return (
    <SubBlock
      icon={<Home className="w-3.5 h-3.5" style={{ color: "var(--lfs-accent)" }} />}
      title="Local Housing & Utilities"
      subtitle="By state → county → household size (1–5+)."
      open={open}
      onToggle={() => setOpen(o => !o)}
      right={canEdit && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => alert("Upload — UST PDF / Excel parser TODO.")}
            className="text-[11px] font-semibold px-2 py-1 rounded border"
            style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" }}
          >
            <Upload className="w-3 h-3 inline" /> Update
          </button>
          {Object.keys(edits).length > 0 && (
            <button onClick={save} className="text-[11px] font-semibold px-2 py-1 rounded border border-emerald-700/60 bg-emerald-900/30 text-emerald-100">
              <Save className="w-3 h-3 inline" /> Save {Object.keys(edits).length}
            </button>
          )}
        </div>
      )}
    >
      <div className="mb-3">
        <RuleSectionMeta
          changeSection="living_standards.housing"
          auditSection="living_standards"
          datasetDate={NATIONAL_STANDARDS_2025_META.effectiveDate}
          headingOverride="Living Standards — Local Housing & Utilities"
        />
      </div>
      {/* Empty-state when no admitted states overlap with the loaded
          Housing & Utilities datasets. Surfaces the same Firm Policy
          guidance as the other reference pages. */}
      {states.length === 0 ? (
        <div className="rounded border border-dashed border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-[#FAFAF7]">No admitted states with loaded Housing & Utilities data</p>
            <p className="text-[10px] text-[#6B6B66] mt-0.5 leading-relaxed">
              Add the firm's filing jurisdictions in
              <strong className="text-[#FAFAF7]"> Firm Policy → Practice Jurisdictions</strong>.
              Loaded today: {allLoadedStates.join(", ")}.
            </p>
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66]">State</label>
        <select
          value={activeState}
          onChange={e => setActiveState(e.target.value)}
          disabled={states.length === 0}
          className="bg-[#0F0F0E] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5 disabled:opacity-50"
        >
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-[10px] text-[#6B6B66]">
          {countyList.length} counties · {states.length} admitted state{states.length === 1 ? "" : "s"} loaded
        </span>
      </div>
      {states.length === 0 ? null : countyList.length === 0 ? (
        <p className="text-[11px] text-[#6B6B66] italic">No counties loaded for {activeState}.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-[#2A2A28] bg-[#1A1A18] max-h-[55vh]">
          <table className="min-w-full text-[11px]">
            <thead className="bg-[#0F0F0E] sticky top-0">
              <tr className="text-[#6B6B66]">
                <th className="text-left px-3 py-2">County</th>
                {[1, 2, 3, 4, 5].map(n => <th key={n} className="text-right px-3 py-2">{n}{n === 5 ? "+" : ""}</th>)}
              </tr>
            </thead>
            <tbody>
              {countyList.map(county => (
                <tr key={county} className="border-t border-[#2A2A28] text-[#FAFAF7]">
                  <td className="px-3 py-2 font-semibold">{county}</td>
                  {[1, 2, 3, 4, 5].map(size => {
                    const v = effectiveFor(county, size);
                    const canonical = canonicalFor(activeState, county, size);
                    const overridden = overlay.getOverride(pathFor(activeState, county, size)) != null;
                    return (
                      <td key={size} className="px-3 py-2 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            value={v ?? ""}
                            onChange={e => setCell(county, size, e.target.value === "" ? null : parseInt(e.target.value))}
                            title={overridden ? `Canonical: $${canonical?.toLocaleString() ?? "—"} — firm overlay active` : `Canonical: $${canonical?.toLocaleString() ?? "—"}`}
                            className={`bg-[#0F0F0E] border text-[11px] text-[#FAFAF7] rounded px-2 py-1 w-24 text-right ${overridden ? "border-amber-500/60" : "border-[#2A2A28]"}`}
                          />
                        ) : (
                          <span
                            className="tabular-nums"
                            style={v != null ? { color: overridden ? "#fbbf24" : "var(--lfs-accent)" } : { color: "#6B6B66" }}
                            title={overridden ? `Firm overlay (canonical: $${canonical?.toLocaleString() ?? "—"})` : undefined}
                          >
                            {v != null ? `$${v.toLocaleString()}` : "—"}
                            {overridden && <span className="text-[8px] ml-1 text-amber-300">∆</span>}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SubBlock>
  );
}

// ─── 3. Transportation ─────────────────────────────────────────────────────

function TransportationSub({ canEdit, initialOpen = false }: { canEdit: boolean; initialOpen?: boolean }) {
  void canEdit; // Editing of nested operating regions wires in the follow-up build.
  const [open, setOpen] = useState(initialOpen);
  // Firm profile drives which METRO rows render under each region. The
  // four regions themselves stay visible because the regional + national
  // ownership / transit values are national reference data, not
  // jurisdiction-of-admission gated.
  const admittedCodes = useFirmAdmittedStateCodes();
  const admittedCodeSet = useMemo(() => new Set(admittedCodes), [admittedCodes]);

  return (
    <SubBlock
      icon={<Car className="w-3.5 h-3.5" style={{ color: "var(--lfs-accent)" }} />}
      title="Transportation"
      subtitle="Ownership (national, 1 vs 2 cars) · Public transit (national) · Operating allowance (region / metro)."
      open={open}
      onToggle={() => setOpen(o => !o)}
    >
      <div className="mb-3">
        <RuleSectionMeta
          changeSection="living_standards.transportation"
          auditSection="living_standards"
          datasetDate={NATIONAL_STANDARDS_2025_META.effectiveDate}
          headingOverride="Living Standards — Transportation"
        />
      </div>
      <>
      {/* Top-line constants */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <Stat label="Ownership — one car" value={`$${IRS_TRANSPORTATION_2025.ownershipNational.one}`} />
        <Stat label="Ownership — two cars" value={`$${IRS_TRANSPORTATION_2025.ownershipNational.two}`} />
        <Stat icon={<Bus className="w-3.5 h-3.5" />} label="Public transit (national)" value={`$${IRS_TRANSPORTATION_2025.publicTransitNational}`} />
      </div>

      {/* Operating by region / metro */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1.5">Operating — by region / metro</p>
      <div className="space-y-2">
        {IRS_TRANSPORTATION_2025.operating.map(r => {
          // Filter metros within the region to those whose state is in
          // the firm's admitted set. The region card stays rendered (the
          // regional one/two figure is national reference data); the
          // metros table only lists admitted-state metros.
          const visibleMetros = Object.entries(r.metros).filter(
            ([metro]) => admittedCodeSet.has(METRO_TO_STATE_CODE[metro] ?? ""),
          );
          return (
            <details key={r.region} className="rounded border border-[#2A2A28] bg-[#1A1A18] p-3">
              <summary className="cursor-pointer text-[12px] font-semibold text-[#FAFAF7] flex items-center justify-between flex-wrap gap-2">
                <span>{r.region}</span>
                <span className="text-[10px] text-[#6B6B66]">
                  Regional one ${r.regional.one} · two ${r.regional.two}
                  {visibleMetros.length > 0 && <> · {visibleMetros.length} admitted metro{visibleMetros.length === 1 ? "" : "s"}</>}
                </span>
              </summary>
              {visibleMetros.length === 0 ? (
                <p className="mt-2 text-[10px] text-[#6B6B66] italic">
                  No metros in this region for the firm's admitted jurisdictions. Regional figure
                  ${r.regional.one} / ${r.regional.two} still applies.
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded border border-[#2A2A28] bg-[#0F0F0E]">
                  <table className="min-w-full text-[11px]">
                    <thead className="bg-[#1A1A18]">
                      <tr className="text-[#6B6B66]">
                        <th className="text-left px-3 py-2">Metro</th>
                        <th className="text-right px-3 py-2">One</th>
                        <th className="text-right px-3 py-2">Two</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleMetros.map(([metro, pair]) => (
                        <tr key={metro} className="border-t border-[#2A2A28] text-[#FAFAF7]">
                          <td className="px-3 py-2">{metro}</td>
                          <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--lfs-accent)" }}>${pair.one}</td>
                          <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--lfs-accent)" }}>${pair.two}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
          );
        })}
      </div>
      <p className="text-[10px] text-[#6B6B66] italic mt-2 leading-snug">
        Regional + national figures (ownership, public transit) stay visible because they're
        national reference data; the per-metro list filters to the firm's admitted jurisdictions.
        Transportation inline edits land in the follow-up build.
      </p>
      </>
    </SubBlock>
  );
}

// ─── Layout primitives ─────────────────────────────────────────────────────

function SubBlock({
  icon, title, subtitle, open, onToggle, right, children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#2A2A28] bg-[#1A1A18]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <div className="flex items-start gap-3 min-w-0">
          {open ? <ChevronDown className="w-3.5 h-3.5 text-[#6B6B66] mt-1" /> : <ChevronRight className="w-3.5 h-3.5 text-[#6B6B66] mt-1" />}
          {icon}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#FAFAF7]">{title}</p>
            <p className="text-[11px] text-[#6B6B66]">{subtitle}</p>
          </div>
        </div>
        {right && <div className="flex items-center gap-1">{right}</div>}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded border border-[#2A2A28] bg-[#1A1A18] p-3">
      <p className="text-[10px] uppercase tracking-widest text-[#6B6B66] mb-1 flex items-center gap-1">{icon}{label}</p>
      <p className="text-base font-bold tabular-nums" style={{ color: "var(--lfs-accent)" }}>{value}</p>
    </div>
  );
}

function PageHeader({ title, subtitle, right }: { title: string; subtitle: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#1A1A18] border border-[#2A2A28] flex items-center justify-center">
          <Home className="w-4 h-4" style={{ color: "var(--lfs-accent)" }} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-[#FAFAF7]">{title}</h2>
          <p className="text-[11px] text-[#6B6B66] mt-0.5 leading-relaxed max-w-2xl">{subtitle}</p>
        </div>
      </div>
      {right}
    </div>
  );
}
