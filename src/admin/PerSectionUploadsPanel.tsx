// Per-section uploads panel — lists every canonical rule section in the
// Reference Rules tower with a CSV/PDF upload control + Last-updated
// chip + Request-Change button.
//
// Mounted as the third sub-panel inside ReferenceRulesTab (alongside the
// existing inline-editor panel and the Local Rules upload panel).
// Each row reuses the shared SectionUploadControl, which writes to
// rulesAuditStore.recordChange — the existing per-section Publish
// pipeline picks up staged uploads unchanged.

import { Building2, Car, DollarSign, Home, MapPin, Scale, Calculator, FileText, Briefcase } from "lucide-react";
import SectionUploadControl, { type SectionUploadConfig } from "./SectionUploadControl";
import RuleSectionMeta from "../components/law-firm-settings/RuleSectionMeta";
import {
  MEDIAN_INCOME_META, NATIONAL_STANDARDS_2025_META, EXEMPTIONS_BY_JURISDICTION,
} from "../lib/irsMeansStandards";
import type { RuleChangeSection } from "../lib/ruleChangeRequests";
import type { RulesSection } from "../components/law-firm-settings/rulesAuditStore";

// ─── Section definitions ──────────────────────────────────────────────────
//
// Each entry binds a UI label to the rulesAuditStore section bucket +
// an upload-control config. Some entries share an auditSection but differ
// in pathSlug (e.g. living_standards.housing vs living_standards.transportation)
// so a publish on "living_standards" flushes all the related stages.

interface SectionRow {
  groupLabel?: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  changeSection: RuleChangeSection;
  auditSection: RulesSection;
  pathSlug: string;
  datasetDate: string;
  expectedCsvColumns?: string[];
  helper?: string;
  acceptPdf?: boolean;
  acceptCsv?: boolean;
}

const EXEMPTIONS_BY_KEY = EXEMPTIONS_BY_JURISDICTION as Record<string, { effectiveDate: string } | undefined>;
const AZ_DATE = EXEMPTIONS_BY_KEY.AZ?.effectiveDate ?? "—";
const WA_DATE = EXEMPTIONS_BY_KEY.WA?.effectiveDate ?? "—";
const CA_DATE = EXEMPTIONS_BY_KEY.CA?.effectiveDate ?? "—";
const FED_DATE = EXEMPTIONS_BY_KEY.Federal?.effectiveDate ?? "—";

const SECTION_ROWS: SectionRow[] = [
  // ─── Living Standards ───────────────────────────────────────────────────
  {
    groupLabel:    "Living Standards",
    label:         "National Standards",
    icon:          Building2,
    changeSection: "living_standards.national",
    auditSection:  "living_standards",
    pathSlug:      "national",
    datasetDate:   NATIONAL_STANDARDS_2025_META.effectiveDate,
    expectedCsvColumns: ["household_size", "food", "housekeeping_supplies", "apparel_services", "personal_care", "miscellaneous"],
    helper:        "UST publishes the national standards table; export to CSV with one row per household size (1–4 + each addl).",
  },
  {
    label:         "Housing & Utilities",
    icon:          Home,
    changeSection: "living_standards.housing",
    auditSection:  "living_standards",
    pathSlug:      "housing",
    datasetDate:   NATIONAL_STANDARDS_2025_META.effectiveDate,
    expectedCsvColumns: ["state", "county", "size_1", "size_2", "size_3", "size_4", "size_5"],
    helper:        "USTP Local Standards housing/utilities — Excel → save as CSV first. PDF supported as source-of-record attach.",
  },
  {
    label:         "Transportation (incl. county→region)",
    icon:          Car,
    changeSection: "living_standards.transportation",
    auditSection:  "living_standards",
    pathSlug:      "transportation",
    datasetDate:   NATIONAL_STANDARDS_2025_META.effectiveDate,
    expectedCsvColumns: ["region", "metro", "operating_one", "operating_two", "county"],
    helper:        "Operating allowance by region/metro + the county→region mapping. PDF supported as source-of-record attach.",
  },

  // ─── Means-Test ─────────────────────────────────────────────────────────
  {
    groupLabel:    "Means-Test",
    label:         "Median Income",
    icon:          DollarSign,
    changeSection: "median_income",
    auditSection:  "median_income",
    pathSlug:      "table",
    datasetDate:   MEDIAN_INCOME_META.effectiveDate,
    expectedCsvColumns: ["state", "size_1", "size_2", "size_3", "size_4", "each_additional"],
    helper:        "Census-derived UST median income by state × household size. CSV preferred; PDF accepted as source-of-record.",
  },
  {
    label:         "Means-Test Figures (statutory caps)",
    icon:          Calculator,
    changeSection: "means_test_figures",
    auditSection:  "means_test_figures",
    pathSlug:      "means_test_figures",
    datasetDate:   NATIONAL_STANDARDS_2025_META.effectiveDate,
    expectedCsvColumns: ["form_line", "label", "amount", "citation"],
    helper:        "Statutory caps + line definitions for 122A-1 / 122A-2 / 122C-1 / 122C-2.",
  },

  // ─── Exemptions ─────────────────────────────────────────────────────────
  {
    groupLabel:    "Exemptions",
    label:         "Exemptions — Arizona",
    icon:          Scale,
    changeSection: "exemptions",
    auditSection:  "exemptions",
    pathSlug:      "AZ",
    datasetDate:   AZ_DATE,
    expectedCsvColumns: ["label", "statute", "limit", "note"],
    helper:        "Per-row CSV. limit blank = unlimited / 100%. Statute formatted as A.R.S. § XX-NNNN.",
  },
  {
    label:         "Exemptions — Washington",
    icon:          Scale,
    changeSection: "exemptions",
    auditSection:  "exemptions",
    pathSlug:      "WA",
    datasetDate:   WA_DATE,
    expectedCsvColumns: ["label", "statute", "limit", "note"],
    helper:        "Per-row CSV. Statute formatted as RCW § X.XX.XXX.",
  },
  {
    label:         "Exemptions — California",
    icon:          Scale,
    changeSection: "exemptions",
    auditSection:  "exemptions",
    pathSlug:      "CA",
    datasetDate:   CA_DATE,
    expectedCsvColumns: ["label", "statute", "limit", "system", "note"],
    helper:        "Per-row CSV with `system` = '703' | '704' for the §703.140(b) vs §704 election.",
  },
  {
    label:         "Exemptions — Federal § 522(d)",
    icon:          Scale,
    changeSection: "exemptions",
    auditSection:  "exemptions",
    pathSlug:      "Federal",
    datasetDate:   FED_DATE,
    expectedCsvColumns: ["label", "statute", "limit", "note"],
    helper:        "11 U.S.C. § 522(d). UST triennial adjustment publication.",
  },
  {
    label:         "WA homestead by county (RCW 6.13.030)",
    icon:          MapPin,
    changeSection: "exemptions",
    auditSection:  "exemptions",
    pathSlug:      "WA_homestead_by_county",
    datasetDate:   WA_DATE,
    expectedCsvColumns: ["county", "cap"],
    helper:        "WA homestead is county-banded. 39 rows. The $125k statutory floor applies after this load (getWaHomesteadCap floors automatically).",
  },
  {
    label:         "CA §704.730 county band (homestead)",
    icon:          MapPin,
    changeSection: "exemptions",
    auditSection:  "exemptions",
    pathSlug:      "CA_704_homestead_by_county",
    datasetDate:   CA_DATE,
    expectedCsvColumns: ["county", "median_clamped"],
    helper:        "CA §704.730 — clamp(county prior-year median, $300k floor, $600k ceiling) under AB-1885. May be empty until operator-published data lands.",
  },

  // ─── Ch.13 admin multipliers ────────────────────────────────────────────
  {
    groupLabel:    "Ch.13",
    label:         "Ch.13 admin multipliers (trustee fee %)",
    icon:          Briefcase,
    changeSection: "means_test_figures",
    auditSection:  "ch13_admin_multipliers",
    pathSlug:      "ch13_admin_multipliers",
    datasetDate:   "—",
    expectedCsvColumns: ["venue", "multiplier_pct"],
    helper:        "Per-district trustee admin-fee % schedule (UST trustee-fee report). Seed venues: AZ, WA-W, WA-E.",
  },

  // ─── Local Rules — pointer ─────────────────────────────────────────────
  {
    groupLabel:    "Local Rules",
    label:         "Local Rules (per-state, per-district)",
    icon:          FileText,
    changeSection: "local_rules",
    auditSection:  "local_rules",
    pathSlug:      "local_rules",
    datasetDate:   "0.1-scaffold",
    helper:        "Local Rules has its own dedicated upload panel (Local Rules tab) — per-district PDF + version stamp. Pointer-only here.",
    acceptCsv:     false,
  },
];

export default function PerSectionUploadsPanel() {
  // Render as a flat list with optional group dividers. The shared
  // SectionUploadControl handles the modal + stage flow.
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40">
      <div className="px-4 py-3 border-b border-slate-800">
        <p className="text-sm font-bold text-white">Per-section uploads</p>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
          Each canonical reference section accepts CSV (parses + previews + stages with
          <strong className="text-amber-300"> verified:false</strong>) and/or PDF (attaches
          as source-of-record). Use the existing per-section <strong>Publish</strong> button
          on the Standards / Median / Exemptions / Means-Test tab to flush the version bump
          + firm fan-out + per-case re-review cascade.
        </p>
      </div>
      <ul className="divide-y divide-slate-800/60">
        {SECTION_ROWS.map((row, idx) => (
          <li key={`${row.changeSection}.${row.pathSlug}`}>
            {row.groupLabel && (
              <p className="px-4 pt-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {row.groupLabel}
              </p>
            )}
            <UploadRow row={row} firstInGroup={idx === 0 || !!row.groupLabel} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function UploadRow({ row, firstInGroup }: { row: SectionRow; firstInGroup: boolean }) {
  void firstInGroup;
  const Icon = row.icon;
  const config: SectionUploadConfig = {
    auditSection:       row.auditSection,
    label:              row.label,
    pathSlug:           row.pathSlug,
    expectedCsvColumns: row.expectedCsvColumns,
    helper:             row.helper,
    acceptCsv:          row.acceptCsv !== false,
    acceptPdf:          row.acceptPdf !== false,
  };
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <Icon className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{row.label}</p>
          <div className="mt-1">
            <RuleSectionMeta
              changeSection={row.changeSection}
              auditSection={row.auditSection}
              datasetDate={row.datasetDate}
              headingOverride={row.label}
            />
          </div>
        </div>
      </div>
      <div className="flex-shrink-0">
        <SectionUploadControl config={config} />
      </div>
    </div>
  );
}
