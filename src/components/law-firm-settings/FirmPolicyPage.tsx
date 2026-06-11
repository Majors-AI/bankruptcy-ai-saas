// Firm Policy — knobs the firm sets for ITSELF (not canonical, not
// statutory). Distinct from the canonical Reference Rules (Living
// Standards / Median Income / Exemptions / Local Rules) maintained by
// Bankruptcy.AI and pushed via the admin portal.
//
// Today's only knob:
//   - DMI triage threshold — the firm's positive-DMI cutoff that routes
//     intake between Ch.7 and Ch.13 attorney-review. Default $500/mo.
//     This is INTAKE TRIAGE, NOT the statutory § 707(b)(2) presumption
//     (which is a separate IRS-long-form / two-bracket evaluation).
//
// Edit gate: attorney supervisor / owner only — same canAdjustLivingStandards
// gate (lawyer AND (supervisor OR owner)). Plain super_admin cannot edit.
//
// SCAFFOLD persistence: in-memory + localStorage; TODO firm_policy table.

import { useMemo, useState } from "react";
import { ScaleIcon, Lock, RefreshCcw, Save, Info, Users, AlertOctagon, MapPin } from "lucide-react";
import {
  getFirmDmiTriageThresholdDefault, setFirmDmiTriageThreshold,
  useFirmDmiTriageThreshold,
  getFirmHouseholdContributionByState, setFirmStandardHouseholdContribution,
  getFirmHouseholdContributionTreatmentDefault,
  setFirmHouseholdContributionTreatment, useFirmHouseholdContributionTreatment,
  getFirmMinimumDebtThresholdDefault, setFirmMinimumDebtThreshold,
  useFirmMinimumDebtThreshold,
  useFirmAdmittedStates, toggleFirmAdmittedState,
  useFirmPrimaryState,
  type HouseholdContributionTreatment,
} from "../../lib/firmPolicy";
import { canAdjustLivingStandards } from "./livingStandardsOverlay";
import type { LegalReferenceViewerRole } from "../legal-reference/LegalReferenceStore";

interface Props {
  /** Reuse the existing role enum — same gate as the Living-Standards
   *  overlay: attorney supervisor (attorney_super_admin) OR attorney
   *  owner (law_firm_owner). Everyone else is read-only. */
  legalReferenceRole?: LegalReferenceViewerRole;
}

export default function FirmPolicyPage({ legalReferenceRole = "none" }: Props) {
  const canEdit = canAdjustLivingStandards(legalReferenceRole);
  const current = useFirmDmiTriageThreshold();
  const defaultValue = getFirmDmiTriageThresholdDefault();
  const [draft, setDraft] = useState<string>(String(current));
  const dirty = parseFloat(draft) !== current && draft !== "";

  function save() {
    const n = parseFloat(draft);
    if (!Number.isFinite(n) || n < 0) return;
    setFirmDmiTriageThreshold(n);
  }
  function resetToDefault() {
    setFirmDmiTriageThreshold(defaultValue);
    setDraft(String(defaultValue));
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#1A1A18] border border-[#2A2A28] flex items-center justify-center">
          <ScaleIcon className="w-4 h-4" style={{ color: "var(--lfs-accent)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-[#FAFAF7]">Firm Policy</h2>
          <p className="text-[11px] text-[#6B6B66] mt-0.5 leading-relaxed max-w-2xl">
            Knobs the firm sets for itself. Separate from the canonical Reference Rules
            (which are maintained by Bankruptcy.AI and pushed to every firm). Firm-policy
            values are LOCAL — they don&apos;t change when canonical updates publish.
          </p>
        </div>
        {!canEdit && (
          <span className="text-[10px] uppercase tracking-widest text-[#6B6B66] border border-[#2A2A28] rounded-full px-2 py-1 inline-flex items-center gap-1">
            <Lock className="w-3 h-3" /> Read-only
          </span>
        )}
      </div>

      {/* DMI triage threshold */}
      <section className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-5">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#FAFAF7]">
              Disposable-income triage threshold (intake routing)
            </p>
            <p className="text-[11px] text-[#6B6B66] mt-0.5 leading-relaxed max-w-2xl">
              Positive monthly DMI cutoff used to route intake between Chapter 7 and
              Chapter 13 attorney-review. <strong className="text-[#FAFAF7]">
              ≤ threshold</strong> → Ch.7 routing. <strong className="text-[#FAFAF7]">&gt; threshold</strong> →
              attorney-review Issue flagged (&ldquo;Positive disposable income more than ${current}&rdquo;) and Ch.13
              eligibility review. Non-blocking — the case is still accepted; the attorney decides.
            </p>
          </div>
          <span
            className="text-[10px] uppercase tracking-widest border rounded-full px-2 py-1"
            style={{ borderColor: "var(--lfs-accent)", color: "var(--lfs-accent)" }}
          >
            Firm-set · not statutory
          </span>
        </div>

        {/* Editor */}
        <div className="mt-4 flex items-end gap-3 flex-wrap">
          <label className="block">
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">
              Threshold ($/month)
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[#6B6B66]">$</span>
              <input
                type="number"
                min={0}
                step={25}
                disabled={!canEdit}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="bg-[#0F0F0E] border border-[#2A2A28] text-sm text-[#FAFAF7] rounded px-2 py-1.5 w-32 tabular-nums disabled:opacity-60"
              />
            </div>
          </label>
          <p className="text-[10px] text-[#6B6B66]">
            Current effective value: <strong style={{ color: "var(--lfs-accent)" }}>${current.toLocaleString()}/mo</strong>
            {current !== defaultValue && <> · default ${defaultValue}</>}
          </p>
          {canEdit && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={resetToDefault}
                disabled={current === defaultValue}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B6B66] border border-[#2A2A28] rounded px-2.5 py-1.5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCcw className="w-3 h-3" /> Reset to default (${defaultValue})
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!dirty}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded border disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: dirty ? "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" : "transparent" }}
              >
                <Save className="w-3 h-3" /> Save
              </button>
            </div>
          )}
        </div>

        {/* Scope disclaimer — make sure the firm doesn't confuse this with the
            statutory § 707(b) presumption. */}
        <div className="mt-4 rounded border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-200 leading-relaxed">
            <strong className="text-amber-300">This is firm intake triage, not the statutory § 707(b)(2) presumption.</strong>{" "}
            The formal means-test presumption (two-bracket per § 707(b)(2)(A)(i), IRS allowable
            long-form deductions on 122A-2 / 122C-2) is a separate evaluation and is NOT
            determined by this screen.
          </p>
        </div>

        <p className="text-[10px] text-[#6B6B66] italic mt-3 leading-snug">
          {/* TODO Phase B — persistence:
                - new table firm_policy(firm_id, key='dmi_triage_threshold_dollars',
                  value_jsonb, set_by_user_id, set_at)
                - audit on each change keyed to firm_id + actor
                - RLS so plain super_admin cannot write (matches the
                  canAdjustLivingStandards gate) */}
          Today the value lives in memory + per-tab localStorage. Real persistence + audit
          land with the firm_policy table.
        </p>
      </section>

      {/* ─── Household-member contributions (§ 101(10A)(B)) ─────────── */}
      <HouseholdContributionsSection canEdit={canEdit} />

      {/* ─── Minimum debt threshold for case acceptance ──────────────── */}
      <MinimumDebtSection canEdit={canEdit} />

      {/* ─── Practice jurisdictions (filters Local Rules state list) ── */}
      <PracticeJurisdictionsSection canEdit={canEdit} />
    </div>
  );
}

// ─── Practice jurisdictions ─────────────────────────────────────────────────
//
// The set of states the firm is admitted to practice in. Drives the
// LocalRulesPage state list (hides everything else). Editor uses the same
// state-name catalog the Local Rules page consumes.

const ALL_STATES_FOR_ADMISSION: string[] = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
  "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming",
  "Guam", "Northern Mariana Islands", "Puerto Rico", "Virgin Islands",
];

function PracticeJurisdictionsSection({ canEdit }: { canEdit: boolean }) {
  const admitted = useFirmAdmittedStates();
  const firmPrimaryState = useFirmPrimaryState();
  const admittedSet = useMemo(() => new Set(admitted), [admitted]);
  const [search, setSearch] = useState("");
  const filteredStates = useMemo(
    () => ALL_STATES_FOR_ADMISSION.filter(s => !search.trim() || s.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  return (
    <section className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-5">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4" style={{ color: "var(--lfs-accent)" }} />
          <p className="text-sm font-semibold text-[#FAFAF7]">Practice jurisdictions</p>
        </div>
        <span
          className="text-[10px] uppercase tracking-widest border rounded-full px-2 py-1"
          style={{ borderColor: "var(--lfs-accent)", color: "var(--lfs-accent)" }}
        >
          {admitted.length} state{admitted.length === 1 ? "" : "s"} admitted
        </span>
      </div>
      <p className="text-[11px] text-[#6B6B66] mt-1.5 leading-relaxed max-w-2xl">
        The states the firm is admitted to practice in. Drives the
        <strong className="text-[#FAFAF7]"> Local Rules</strong> state list — only admitted
        states appear there; everything else is hidden. The firm's primary filing state is
        <strong className="text-[#FAFAF7]"> {firmPrimaryState}</strong>.
      </p>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search state"
        className="mt-3 bg-[#0F0F0E] border border-[#2A2A28] text-[12px] text-[#FAFAF7] rounded px-2 py-1.5 w-full sm:w-64"
      />

      <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
        {filteredStates.map(state => {
          const isAdmitted = admittedSet.has(state);
          const isPrimary = state === firmPrimaryState;
          return (
            <li key={state}>
              <label
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] cursor-pointer border ${
                  isAdmitted ? "border-[var(--lfs-accent)]/40" : "border-[#2A2A28]"
                } ${canEdit ? "hover:bg-[#0F0F0E]" : "cursor-not-allowed opacity-80"}`}
                style={isAdmitted ? { background: "color-mix(in srgb, var(--lfs-accent) 14%, transparent)" } : undefined}
              >
                <input
                  type="checkbox"
                  checked={isAdmitted}
                  disabled={!canEdit}
                  onChange={e => toggleFirmAdmittedState(state, e.target.checked)}
                  className="accent-amber-500"
                />
                <span className={isAdmitted ? "text-[#FAFAF7]" : "text-[#6B6B66]"}>
                  {state}
                  {isPrimary && <span className="ml-1 text-[9px] uppercase tracking-widest text-amber-300">primary</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {admitted.length === 0 && (
        <p className="mt-3 text-[11px] text-amber-300 bg-amber-500/5 border border-amber-500/20 rounded px-3 py-2">
          No states selected — Local Rules will render an empty state. Add at least the firm's
          primary jurisdiction.
        </p>
      )}

      <p className="text-[10px] text-[#6B6B66] italic mt-3 leading-snug">
        {/* TODO Phase B — derive admitted states from firms.admitted_states (jsonb)
              once the firm-profile schema lands. For now this is firm-policy localStorage. */}
        Today the admitted-states list lives in memory + per-tab localStorage. Real persistence
        + audit land with the firm profile schema.
      </p>
    </section>
  );
}

// ─── Household-member contributions ───────────────────────────────────────

function HouseholdContributionsSection({ canEdit }: { canEdit: boolean }) {
  // Per-jurisdiction default amount the firm fills in when the
  // contributor's actual contribution isn't broken out. AZ + WA seeded
  // at $500 (Part B baseline); other states fall back to $500 until the
  // firm sets a different value.
  const byState = getFirmHouseholdContributionByState();
  const knownStates = Object.keys(byState).sort();
  const [editingState, setEditingState] = useState<string>(knownStates[0] ?? "AZ");
  const [draft, setDraft] = useState<string>(String(byState[editingState] ?? 500));
  const treatment = useFirmHouseholdContributionTreatment();
  const treatmentDefault = getFirmHouseholdContributionTreatmentDefault();

  function saveAmount() {
    const n = parseFloat(draft);
    if (!Number.isFinite(n) || n < 0) return;
    setFirmStandardHouseholdContribution(editingState, n);
  }

  return (
    <section className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-5">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: "var(--lfs-accent)" }} />
          <p className="text-sm font-semibold text-[#FAFAF7]">
            Household-member contributions
          </p>
        </div>
        <span
          className="text-[10px] uppercase tracking-widest border rounded-full px-2 py-1"
          style={{ borderColor: "var(--lfs-accent)", color: "var(--lfs-accent)" }}
        >
          Firm interpretation · § 101(10A)(B)
        </span>
      </div>
      <p className="text-[11px] text-[#6B6B66] mt-1.5 leading-relaxed max-w-2xl">
        Two knobs that drive how regular household-member contributions enter CMI: the
        <strong className="text-[#FAFAF7]"> standard amount</strong> the firm fills in when
        a contributor doesn&apos;t break out their actual contribution (per-jurisdiction),
        and the <strong className="text-[#FAFAF7]">interpretation rule</strong> for which
        contributions count. SS-sourced contributions are always excluded (mirrors the CMI
        SS exclusion).
      </p>

      {/* Standard amount, per-jurisdiction */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1.5">
            Standard contribution amount (per jurisdiction)
          </p>
          <div className="flex items-end gap-2 flex-wrap">
            <label className="block">
              <span className="block text-[9px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">State</span>
              <select
                value={editingState}
                onChange={e => { setEditingState(e.target.value); setDraft(String(byState[e.target.value] ?? 500)); }}
                className="bg-[#0F0F0E] border border-[#2A2A28] text-sm text-[#FAFAF7] rounded px-2 py-1.5"
              >
                {knownStates.map(s => <option key={s} value={s}>{s}</option>)}
                {/* Allow firm to add additional states */}
                {!knownStates.includes("CA") && <option value="CA">CA</option>}
                {!knownStates.includes("NV") && <option value="NV">NV</option>}
              </select>
            </label>
            <label className="block">
              <span className="block text-[9px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">$/month</span>
              <div className="flex items-center gap-1">
                <span className="text-[#6B6B66]">$</span>
                <input
                  type="number"
                  min={0}
                  step={25}
                  disabled={!canEdit}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  className="bg-[#0F0F0E] border border-[#2A2A28] text-sm text-[#FAFAF7] rounded px-2 py-1.5 w-28 tabular-nums disabled:opacity-60"
                />
              </div>
            </label>
            {canEdit && (
              <button
                onClick={saveAmount}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded border self-end"
                style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" }}
              >
                <Save className="w-3 h-3" /> Save {editingState}
              </button>
            )}
          </div>
          <ul className="mt-3 text-[11px] text-[#6B6B66] space-y-1">
            {knownStates.map(s => (
              <li key={s} className="flex items-center justify-between border-b border-[#2A2A28] pb-1">
                <span>{s}</span>
                <span className="tabular-nums" style={{ color: "var(--lfs-accent)" }}>${byState[s].toLocaleString()}/mo</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Interpretation rule */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1.5">
            Interpretation rule
          </p>
          <div className="space-y-2">
            {([
              ["include_all_recurring",    "Include all recurring contributions (broadest read)"],
              ["include_recurring_non_ss", "Include recurring; exclude SS-sourced (default / recommended)"],
              ["attorney_per_case",        "Attorney adds per case (no automatic inclusion)"],
            ] as Array<[HouseholdContributionTreatment, string]>).map(([k, label]) => (
              <label key={k} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="hc_treatment"
                  disabled={!canEdit}
                  checked={treatment === k}
                  onChange={() => setFirmHouseholdContributionTreatment(k)}
                  className="mt-0.5 accent-amber-500"
                />
                <span className="text-[11px] text-[#FAFAF7] leading-snug">
                  {label}
                  {treatment === k && k === treatmentDefault && <span className="text-[#6B6B66] ml-1">(default)</span>}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-200 leading-relaxed">
          The CONTRIBUTION amount counts toward CMI — not the contributor&apos;s gross
          income. SS-sourced contributions (elderly parent&apos;s SS, a child&apos;s SS
          benefits) are excluded automatically via the shared SS-exclusion logic.
        </p>
      </div>
    </section>
  );
}

// ─── Minimum debt threshold ───────────────────────────────────────────────

function MinimumDebtSection({ canEdit }: { canEdit: boolean }) {
  const current = useFirmMinimumDebtThreshold();
  const defaultValue = getFirmMinimumDebtThresholdDefault();
  const [draft, setDraft] = useState<string>(String(current));
  const dirty = parseFloat(draft) !== current && draft !== "";

  function save() {
    const n = parseFloat(draft);
    if (!Number.isFinite(n) || n < 0) return;
    setFirmMinimumDebtThreshold(n);
  }
  function resetToDefault() {
    setFirmMinimumDebtThreshold(defaultValue);
    setDraft(String(defaultValue));
  }

  return (
    <section className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-5">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-4 h-4" style={{ color: "var(--lfs-accent)" }} />
          <p className="text-sm font-semibold text-[#FAFAF7]">
            Minimum debt for case acceptance
          </p>
        </div>
        <span
          className="text-[10px] uppercase tracking-widest border rounded-full px-2 py-1"
          style={{ borderColor: "var(--lfs-accent)", color: "var(--lfs-accent)" }}
        >
          Firm-set · not statutory
        </span>
      </div>
      <p className="text-[11px] text-[#6B6B66] mt-1.5 leading-relaxed max-w-2xl">
        When a case&apos;s total debt falls below this threshold, the intake screen raises
        an attorney-review Issue and the firm reviews whether to accept. Non-blocking —
        the firm can still accept; the warning + Issue persist for the attorney to address.
      </p>

      <div className="mt-4 flex items-end gap-3 flex-wrap">
        <label className="block">
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">
            Minimum debt ($)
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[#6B6B66]">$</span>
            <input
              type="number"
              min={0}
              step={500}
              disabled={!canEdit}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="bg-[#0F0F0E] border border-[#2A2A28] text-sm text-[#FAFAF7] rounded px-2 py-1.5 w-32 tabular-nums disabled:opacity-60"
            />
          </div>
        </label>
        <p className="text-[10px] text-[#6B6B66]">
          Current effective: <strong style={{ color: "var(--lfs-accent)" }}>${current.toLocaleString()}</strong>
          {current !== defaultValue && <> · default ${defaultValue.toLocaleString()}</>}
        </p>
        {canEdit && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={resetToDefault}
              disabled={current === defaultValue}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B6B66] border border-[#2A2A28] rounded px-2.5 py-1.5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCcw className="w-3 h-3" /> Reset (${defaultValue.toLocaleString()})
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded border disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: dirty ? "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" : "transparent" }}
            >
              <Save className="w-3 h-3" /> Save
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
