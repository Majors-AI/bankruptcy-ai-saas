// Centralized Legal Reference / Rules & Standards Store — shared component.
//
// MOUNT POINTS (identical content + data — DO NOT duplicate):
//   1. Department Settings (Legal + Intake departments)
//   2. Super Admin Setting Portal
//   3. Law Firm Owner Portal
//
// AUTHORIZATION:
//   - viewerStaffRole === 'attorney_super_admin' OR 'law_firm_owner'
//     → EDIT + SAVE (changes go live system-wide)
//   - Everyone else (super_admin who isn't a lawyer, department supervisor,
//     legal admin, attorney without super-admin):
//     → VIEW + "Propose Change" (proposal routes to a super attorney
//       admin for approval; on approval, applies system-wide).
//
// AUDIT TRAIL:
//   - Every change (direct edit OR approved proposal) writes an entry into
//     legal_reference_audit_log with: who, when, old→new, effective date,
//     source, proposal id (if any).
//
// SCAFFOLD ONLY today — persistence backend is TODO. The component reads
// from the constants in src/lib/irsMeansStandards.ts and surfaces edits
// in component state. Save handlers + proposal submit are wired to a
// stub that logs to the console; the follow-up build replaces the stub
// with Supabase writes against legal_reference_current /
// legal_reference_proposals / legal_reference_audit_log.
//
// THE STORE IS ONE SOURCE OF TRUTH:
//   - intake form pre-fills (Schedule J auto-fill, exemption preview)
//   - eligibility engine (means-test thresholds, 910-day rule, etc.)
//   - attorney auto-issue seeder (citations + dollar thresholds)
//   ...all read from the same constants. Edit propagates everywhere.

import { Fragment, useMemo, useState } from "react";
import {
  Shield, Lock, AlertTriangle, Edit3, Send, FileText, Scale, MapPin,
  DollarSign, ChevronDown, ChevronRight, History,
} from "lucide-react";
import {
  PART_B_META,
  IRS_HOUSING_UTILITIES_2025,
  IRS_TRANSPORTATION_2025,
  NATIONAL_STANDARDS_2025,
  NATIONAL_STANDARDS_2025_META,
  MEDIAN_INCOME_BY_STATE,
  EXEMPTIONS_BY_JURISDICTION,
  LEGAL_RULES,
  type LegalRule,
  type RuleParameter,
} from "../../lib/irsMeansStandards";

export type LegalReferenceViewerRole =
  | "attorney_super_admin"
  | "law_firm_owner"
  | "super_admin"
  | "department_supervisor"
  | "legal_admin"
  | "attorney"
  | "none";

interface Props {
  viewerStaffRole: LegalReferenceViewerRole;
  /** Surface name (used in audit trail + proposal labels). */
  surfaceName: "department_settings" | "super_admin" | "law_firm_owner";
}

type TabKey = "rules" | "housing" | "transportation" | "national" | "median" | "exemptions" | "audit";

export default function LegalReferenceStore({ viewerStaffRole, surfaceName }: Props) {
  const canEdit =
    viewerStaffRole === "attorney_super_admin" ||
    viewerStaffRole === "law_firm_owner";

  const [activeTab, setActiveTab] = useState<TabKey>("rules");

  // Verification banner — true while any seeded row's verified=false.
  const anyUnverified = !PART_B_META.verified;

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: "rules",          label: "Rules & Citations",      icon: <Scale className="w-3.5 h-3.5" /> },
    { key: "housing",        label: "Housing & Utilities",    icon: <MapPin className="w-3.5 h-3.5" /> },
    { key: "transportation", label: "Transportation",         icon: <DollarSign className="w-3.5 h-3.5" /> },
    { key: "national",       label: "National Standards",     icon: <FileText className="w-3.5 h-3.5" /> },
    { key: "median",         label: "Median Income",          icon: <DollarSign className="w-3.5 h-3.5" /> },
    { key: "exemptions",     label: "Exemptions",             icon: <Shield className="w-3.5 h-3.5" /> },
    { key: "audit",          label: "Audit Trail",            icon: <History className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1">
          <h2 className="font-serif text-xl font-bold text-white">Legal Reference / Rules & Standards</h2>
          <p className="text-sm text-slate-400 leading-relaxed mt-1">
            One source of truth for <strong className="text-amber-400">IRS standards</strong>, <strong className="text-amber-400">state exemptions</strong>, <strong className="text-amber-400">means-test thresholds</strong>, and <strong className="text-amber-400">cited statutory parameters</strong>. Edits propagate to the intake form, eligibility engine, and attorney issue flags.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <span className="text-[10px] uppercase tracking-widest text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-1 inline-flex items-center gap-1">
              <Edit3 className="w-3 h-3" /> Edit mode (attorney + super admin)
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-widest text-slate-400 bg-slate-800 border border-slate-700 rounded-full px-2 py-1 inline-flex items-center gap-1">
              <Lock className="w-3 h-3" /> View + propose only
            </span>
          )}
        </div>
      </div>

      {/* Verification banner */}
      {anyUnverified && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-amber-200 leading-relaxed">
            <strong className="text-amber-300">Verify against current UST tables — not yet attorney-verified.</strong>{" "}
            Seeded {PART_B_META.effectiveDate}, in effect until {PART_B_META.inEffectUntil}. Source: {PART_B_META.source}. Verify at <a href="https://www.justice.gov/ust/means-testing" className="underline text-amber-300 hover:text-amber-200" target="_blank" rel="noreferrer">justice.gov/ust/means-testing</a>.
          </div>
        </div>
      )}

      {/* Non-lawyer notice */}
      {!canEdit && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-blue-300 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-200 leading-relaxed">
            <strong className="text-blue-300">Read-only view.</strong> Only an attorney with super-admin (or the law firm owner) may modify rules, standards, or exemptions. You can submit a <strong className="text-white">proposed change</strong> from any row — it routes to a super attorney admin for approval.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-slate-700">
        {tabs.map(t => (
          <button key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all border-b-2 ${
              activeTab === t.key
                ? "text-amber-400 border-amber-400"
                : "text-slate-400 border-transparent hover:text-slate-200"
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pt-2">
        {activeTab === "rules"          && <RulesTab          canEdit={canEdit} surfaceName={surfaceName} />}
        {activeTab === "housing"        && <HousingTab        canEdit={canEdit} />}
        {activeTab === "transportation" && <TransportationTab canEdit={canEdit} />}
        {activeTab === "national"       && <NationalStandardsTab canEdit={canEdit} />}
        {activeTab === "median"         && <MedianIncomeTab   canEdit={canEdit} />}
        {activeTab === "exemptions"     && <ExemptionsTab     canEdit={canEdit} />}
        {activeTab === "audit"          && <AuditTab />}
      </div>
    </div>
  );
}

// ─── Rules tab ──────────────────────────────────────────────────────────────

function RulesTab({ canEdit, surfaceName }: { canEdit: boolean; surfaceName: string }) {
  // Local edit state — scaffold only. Real persistence wires to a context
  // provider that fetches + saves to legal_reference_current.
  const [edits, setEdits] = useState<Record<string, number | string>>({});
  const [openId, setOpenId] = useState<string | null>(LEGAL_RULES[0]?.id ?? null);

  const saveStub = (rule: LegalRule, param: RuleParameter, newValue: number | string) => {
    // TODO Phase B — actual save:
    //   supabase.from('legal_reference_current').upsert({ path: `rules.${rule.id}.parameters.${param.key}`, value: newValue, effective_date: ..., source: ... });
    //   supabase.from('legal_reference_audit_log').insert({ path, old, new, changed_by, changed_at, source });
    //   notify the firm owner.
    // eslint-disable-next-line no-console
    console.log(`[legal-reference store / ${surfaceName}] (stub) save`, { ruleId: rule.id, paramKey: param.key, oldValue: param.value, newValue });
    setEdits(prev => ({ ...prev, [`${rule.id}.${param.key}`]: newValue }));
  };

  const proposeStub = (rule: LegalRule, param: RuleParameter, proposedValue: number | string, effectiveDate: string, source: string, rationale: string) => {
    // TODO Phase B — actual proposal submit:
    //   supabase.from('legal_reference_proposals').insert({ path, old_value, proposed_value, proposed_effective_date, source, rationale, requested_by, status: 'pending' });
    // eslint-disable-next-line no-console
    console.log(`[legal-reference store / ${surfaceName}] (stub) propose`, { ruleId: rule.id, paramKey: param.key, proposedValue, effectiveDate, source, rationale });
    alert(`Proposal submitted (scaffold).\n\nRule: ${rule.shortName}\nParameter: ${param.label}\nFrom: ${param.value}\nTo: ${proposedValue}\nEffective: ${effectiveDate}\nSource: ${source}\n\nA super attorney admin will review.`);
  };

  return (
    <div className="space-y-2">
      {LEGAL_RULES.map(rule => {
        const isOpen = openId === rule.id;
        return (
          <div key={rule.id} className="rounded-xl border border-slate-700 bg-[#0d1221]">
            <button
              onClick={() => setOpenId(isOpen ? null : rule.id)}
              className="w-full flex items-start justify-between gap-3 p-4 text-left hover:bg-slate-900/40 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs font-mono text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded">{rule.citation}</code>
                  <p className="text-sm font-semibold text-white">{rule.shortName}</p>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{rule.description}</p>
              </div>
              {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1" /> : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1" />}
            </button>
            {isOpen && (
              <div className="border-t border-slate-700 p-4 space-y-3">
                {rule.parameters.map(param => {
                  const editKey = `${rule.id}.${param.key}`;
                  const currentValue = edits[editKey] ?? param.value;
                  return (
                    <ParameterRow key={param.key}
                      param={param}
                      currentValue={currentValue}
                      canEdit={canEdit}
                      onSave={v => saveStub(rule, param, v)}
                      onPropose={(v, date, source, rationale) => proposeStub(rule, param, v, date, source, rationale)}
                    />
                  );
                })}
                <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-800">
                  Source: {rule.source} · Effective: {rule.effectiveDate}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Parameter editor row (used inside Rules tab) ───────────────────────────

function ParameterRow({
  param,
  currentValue,
  canEdit,
  onSave,
  onPropose,
}: {
  param: RuleParameter;
  currentValue: number | string | null;
  canEdit: boolean;
  onSave: (v: number | string) => void;
  onPropose: (v: number | string, effectiveDate: string, source: string, rationale: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(currentValue ?? ""));
  const [proposing, setProposing] = useState(false);
  const [proposed, setProposed] = useState<string>(String(currentValue ?? ""));
  const [propDate, setPropDate] = useState<string>("");
  const [propSource, setPropSource] = useState<string>("");
  const [propRationale, setPropRationale] = useState<string>("");

  const fmt = (v: number | string | null) => {
    if (v === null || v === undefined) return "—";
    if (param.unit === "usd") return `$${Number(v).toLocaleString()}`;
    if (param.unit === "percent") return `${v}%`;
    if (param.unit === "days") return `${v} days`;
    if (param.unit === "years") return `${v} year${v === 1 ? "" : "s"}`;
    return String(v);
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white">{param.label}</p>
          {param.description && <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{param.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {!editing && !proposing && (
            <>
              <span className="text-sm font-bold text-amber-400 tabular-nums">{fmt(currentValue)}</span>
              {canEdit ? (
                <button type="button" onClick={() => { setDraft(String(currentValue ?? "")); setEditing(true); }}
                  className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline">Edit</button>
              ) : (
                <button type="button" onClick={() => { setProposed(String(currentValue ?? "")); setProposing(true); }}
                  className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 underline">Propose</button>
              )}
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            type={param.unit === "text" ? "text" : "number"}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white w-40 focus:outline-none focus:border-amber-400"
          />
          <button type="button"
            onClick={() => { const v = param.unit === "text" ? draft : Number(draft); onSave(v); setEditing(false); }}
            className="text-[11px] font-semibold bg-amber-400 hover:bg-amber-300 text-slate-900 px-3 py-1.5 rounded">
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)}
            className="text-[11px] text-slate-400 hover:text-slate-200">Cancel</button>
        </div>
      )}

      {proposing && (
        <div className="mt-3 space-y-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-2.5">
          <p className="text-[11px] font-semibold text-blue-300 flex items-center gap-1.5"><Send className="w-3 h-3" /> Submit a proposed change</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-slate-400">
              Proposed value
              <input value={proposed} onChange={e => setProposed(e.target.value)} type={param.unit === "text" ? "text" : "number"}
                className="mt-0.5 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400"/>
            </label>
            <label className="text-[10px] text-slate-400">
              Effective date
              <input value={propDate} onChange={e => setPropDate(e.target.value)} type="date"
                className="mt-0.5 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400"/>
            </label>
          </div>
          <label className="text-[10px] text-slate-400 block">
            Source
            <input value={propSource} onChange={e => setPropSource(e.target.value)} placeholder="e.g. UST publication YYYY-MM-DD"
              className="mt-0.5 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400"/>
          </label>
          <label className="text-[10px] text-slate-400 block">
            Rationale (optional)
            <textarea value={propRationale} onChange={e => setPropRationale(e.target.value)} rows={2}
              className="mt-0.5 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400 resize-none"/>
          </label>
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={() => {
                const v = param.unit === "text" ? proposed : Number(proposed);
                onPropose(v, propDate, propSource, propRationale);
                setProposing(false);
              }}
              disabled={!proposed || !propDate || !propSource}
              className="text-[11px] font-semibold bg-blue-500 hover:bg-blue-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded">
              Submit proposal
            </button>
            <button type="button" onClick={() => setProposing(false)}
              className="text-[11px] text-slate-400 hover:text-slate-200">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Housing tab ────────────────────────────────────────────────────────────

function HousingTab({ canEdit }: { canEdit: boolean }) {
  const states = Object.keys(IRS_HOUSING_UTILITIES_2025);
  const [stateKey, setStateKey] = useState<string>(states[0] ?? "AZ");
  const stateData = IRS_HOUSING_UTILITIES_2025[stateKey] ?? {};
  const counties = Object.keys(stateData);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400">State:</label>
        <select value={stateKey} onChange={e => setStateKey(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white">
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {counties.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-xs text-slate-400">
          No counties seeded for {stateKey} yet. Per spec, populate via attorney edit or import.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700 bg-[#0d1221] overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-800/60">
              <tr className="text-slate-400 uppercase tracking-widest text-[10px]">
                <th className="text-left px-3 py-2">County</th>
                <th className="text-right px-3 py-2">1 person</th>
                <th className="text-right px-3 py-2">2</th>
                <th className="text-right px-3 py-2">3</th>
                <th className="text-right px-3 py-2">4</th>
                <th className="text-right px-3 py-2">5+</th>
              </tr>
            </thead>
            <tbody>
              {counties.map(c => (
                <tr key={c} className="border-t border-slate-700/60 text-slate-200">
                  <td className="px-3 py-2 font-semibold">{c}</td>
                  {(stateData[c] || []).map((v, i) => (
                    <td key={i} className="px-3 py-2 text-right tabular-nums">{v != null ? `$${v.toLocaleString()}` : <span className="text-slate-600">—</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-slate-500 italic">
        Source: {PART_B_META.source} · Effective: {PART_B_META.effectiveDate} → {PART_B_META.inEffectUntil}.{" "}
        {canEdit ? "Inline edit + bulk import lands in the follow-up build." : "Submit a proposal from any row when edit lands."}
      </p>
    </div>
  );
}

// ─── Transportation tab ─────────────────────────────────────────────────────

function TransportationTab({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-[#0d1221] p-4">
        <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-3">National</p>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Public transit (no car)" value={`$${IRS_TRANSPORTATION_2025.publicTransitNational}/mo`} />
          <Stat label="Ownership / lease — 1 car" value={`$${IRS_TRANSPORTATION_2025.ownershipNational.one}/mo`} />
          <Stat label="Ownership / lease — 2 cars" value={`$${IRS_TRANSPORTATION_2025.ownershipNational.two}/mo`} />
        </div>
      </div>
      <div className="rounded-xl border border-slate-700 bg-[#0d1221] overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-800/60">
            <tr className="text-slate-400 uppercase tracking-widest text-[10px]">
              <th className="text-left px-3 py-2">Region / Metro</th>
              <th className="text-right px-3 py-2">1 car</th>
              <th className="text-right px-3 py-2">2 cars</th>
            </tr>
          </thead>
          <tbody>
            {IRS_TRANSPORTATION_2025.operating.map(r => (
              <Fragment key={r.region}>
                <tr className="border-t border-slate-700/60 bg-slate-800/40">
                  <td className="px-3 py-2 font-bold text-amber-400">{r.region} Region</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-400">${r.regional.one}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-400">${r.regional.two}</td>
                </tr>
                {Object.entries(r.metros).map(([metro, op]) => (
                  <tr key={`${r.region}-${metro}`} className="border-t border-slate-700/30 text-slate-200">
                    <td className="px-3 py-2 pl-6">{metro}</td>
                    <td className="px-3 py-2 text-right tabular-nums">${op.one}</td>
                    <td className="px-3 py-2 text-right tabular-nums">${op.two}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-500 italic">
        Source: {PART_B_META.source} · Effective: {PART_B_META.effectiveDate} → {PART_B_META.inEffectUntil}.{" "}
        {canEdit ? "Inline edit lands in the follow-up build." : "Submit a proposal from any row when edit lands."}
      </p>
    </div>
  );
}

// ─── National Standards tab (TODO seed) ─────────────────────────────────────

function NationalStandardsTab({ canEdit }: { canEdit: boolean }) {
  // Inline edit overlay — scaffold only (mirrors the Rules tab pattern).
  // Real persistence wires to legal_reference_current.
  // Key format: `ns:${householdSize}:${field}`
  const [edits, setEdits] = useState<Record<string, number | null>>({});
  const meta = NATIONAL_STANDARDS_2025_META;

  const fmt = (v: number | null | undefined) =>
    v == null ? "—" : `$${v.toLocaleString()}`;

  const getCell = (size: number, field: keyof typeof NATIONAL_STANDARDS_2025[number]) => {
    const editKey = `ns:${size}:${field}`;
    if (edits[editKey] !== undefined) return edits[editKey];
    const row = NATIONAL_STANDARDS_2025.find(r => r.householdSize === size);
    if (!row) return null;
    return row[field] as number | null;
  };

  const setCell = (size: number, field: string, val: number | null) => {
    const editKey = `ns:${size}:${field}`;
    setEdits(prev => ({ ...prev, [editKey]: val }));
    // TODO Phase B — supabase upsert into legal_reference_current + audit.
    // eslint-disable-next-line no-console
    console.log("[legal-reference store] (stub) national standards edit", { editKey, val });
  };

  const rows: Array<{ size: number; label: string }> = [
    { size: 1,  label: "1 person" },
    { size: 2,  label: "2 persons" },
    { size: 3,  label: "3 persons" },
    { size: 4,  label: "4 persons" },
    { size: -1, label: "Each additional person (over 4)" },
  ];

  const categoryFields: Array<{ key: keyof typeof NATIONAL_STANDARDS_2025[number]; label: string }> = [
    { key: "food",                 label: "Food" },
    { key: "housekeepingSupplies", label: "Housekeeping supplies" },
    { key: "apparelServices",      label: "Apparel & services" },
    { key: "personalCare",         label: "Personal care products & services" },
    { key: "miscellaneous",        label: "Miscellaneous" },
  ];

  return (
    <div className="space-y-3">
      {/* Meta header */}
      <div className="rounded-xl border border-slate-700 bg-[#0d1221] p-4 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest">IRS National Standards (2025)</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{meta.source}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Effective <strong className="text-white">{meta.effectiveDate}</strong> → {meta.inEffectUntil}. Per additional person over 4: <strong className="text-amber-400">${meta.additionalPerPersonOver4}</strong> added to the 4-person total.
          </p>
        </div>
        {!meta.verified && (
          <span className="text-[10px] uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-1 inline-flex items-center gap-1 flex-shrink-0">
            <AlertTriangle className="w-3 h-3" /> Not attorney-verified
          </span>
        )}
      </div>

      {/* Editable table */}
      <div className="rounded-xl border border-slate-700 bg-[#0d1221] overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-800/60">
            <tr className="text-slate-400 uppercase tracking-widest text-[10px]">
              <th className="text-left px-3 py-2">Household Size</th>
              {categoryFields.map(c => (
                <th key={c.key as string} className="text-right px-3 py-2 whitespace-nowrap">{c.label}</th>
              ))}
              <th className="text-right px-3 py-2">OOP Health</th>
              <th className="text-right px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const totalRow = NATIONAL_STANDARDS_2025.find(x => x.householdSize === r.size);
              return (
                <tr key={r.size} className="border-t border-slate-700/60 text-slate-200">
                  <td className="px-3 py-2 font-semibold">{r.label}</td>
                  {categoryFields.map(c => {
                    const val = getCell(r.size, c.key);
                    return (
                      <td key={c.key as string} className="px-3 py-2 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            value={val ?? ""}
                            onChange={e => {
                              const v = e.target.value === "" ? null : Number(e.target.value);
                              setCell(r.size, c.key as string, v);
                            }}
                            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white w-20 text-right tabular-nums"
                          />
                        ) : (
                          <span className="tabular-nums">{fmt(val)}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right text-slate-500 italic">
                    {/* Out-of-pocket health care — separate IRS standard (by age),
                        not provided in this seed. Coming soon. */}
                    coming soon
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-amber-400">
                    {fmt(totalRow?.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Non-lawyer propose hint + edit-save bar */}
      {canEdit ? (
        <div className="flex items-center justify-end gap-2 pt-1">
          <p className="text-[10px] text-slate-500 italic flex-1">
            Inline edits are local-only today. <strong className="text-slate-300">Save → legal_reference_current</strong> + audit log lands in the follow-up build.
          </p>
          <button
            type="button"
            onClick={() => setEdits({})}
            className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 underline">
            Reset
          </button>
          <button
            type="button"
            onClick={() => {
              // eslint-disable-next-line no-console
              console.log("[legal-reference store] (stub) national standards save", edits);
              alert(`Save (scaffold). ${Object.keys(edits).length} pending changes — would write to legal_reference_current + legal_reference_audit_log.`);
            }}
            className="text-[11px] font-semibold bg-amber-400 hover:bg-amber-300 text-slate-900 px-3 py-1.5 rounded">
            Save changes
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 flex items-start gap-2.5">
          <Lock className="w-3.5 h-3.5 text-blue-300 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-200 leading-relaxed">
            <strong className="text-blue-300">Read-only.</strong> Only an attorney with super-admin (or the law firm owner) may modify National Standards. Submit a <strong>proposed change</strong> from any cell in the next build — proposals route to a super attorney admin for approval.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Median Income tab (TODO) ───────────────────────────────────────────────

function MedianIncomeTab({ canEdit }: { canEdit: boolean }) {
  const states = Object.keys(MEDIAN_INCOME_BY_STATE);
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4">
        <p className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-2">Median Income — TODO</p>
        <p className="text-xs text-slate-400 leading-relaxed">
          State-by-household-size annual median income table not yet loaded. Used by the means test to flag over/under median. Falls back to existing in-code constants until populated here.
        </p>
      </div>
      <div className="rounded-xl border border-slate-700 bg-[#0d1221] overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-800/60">
            <tr className="text-slate-400 uppercase tracking-widest text-[10px]">
              <th className="text-left px-3 py-2">State</th>
              <th className="text-right px-3 py-2">1</th>
              <th className="text-right px-3 py-2">2</th>
              <th className="text-right px-3 py-2">3</th>
              <th className="text-right px-3 py-2">4</th>
              <th className="text-right px-3 py-2">5+</th>
            </tr>
          </thead>
          <tbody>
            {states.map(s => {
              const row = MEDIAN_INCOME_BY_STATE[s];
              return (
                <tr key={s} className="border-t border-slate-700/60 text-slate-200">
                  <td className="px-3 py-2 font-semibold">{s}</td>
                  {[1, 2, 3, 4, 5].map(n => (
                    <td key={n} className="px-3 py-2 text-right tabular-nums">{row[n as 1|2|3|4|5] != null ? `$${row[n as 1|2|3|4|5]?.toLocaleString()}` : <span className="text-slate-600">—</span>}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-500 italic">{canEdit ? "Bulk import + inline edit pending." : "Awaiting attorney data entry."}</p>
    </div>
  );
}

// ─── Exemptions tab (TODO) ──────────────────────────────────────────────────

function ExemptionsTab({ canEdit }: { canEdit: boolean }) {
  const jurisdictions = Object.keys(EXEMPTIONS_BY_JURISDICTION);
  const [jurKey, setJurKey] = useState<string>(jurisdictions[0] ?? "Federal");
  const jur = EXEMPTIONS_BY_JURISDICTION[jurKey];
  const [showCounty, setShowCounty] = useState(false);

  if (!jur) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-slate-400">Jurisdiction:</label>
        <select value={jurKey} onChange={e => setJurKey(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white">
          {jurisdictions.map(j => <option key={j} value={j}>{j}</option>)}
        </select>
        <span className="text-[10px] uppercase tracking-widest text-slate-400 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">
          Election: {jur.election}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-slate-400 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">
          Effective {jur.effectiveDate}{jur.nextAdjustment ? ` → next ${jur.nextAdjustment}` : ""}
        </span>
        {!jur.verified && (
          <span className="text-[10px] uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Not attorney-verified
          </span>
        )}
      </div>

      {jur.homesteadByCounty && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-amber-200">
              <strong className="text-amber-300">Homestead is county-specific.</strong> 39 counties keyed under <code className="text-amber-400">{jur.homesteadStatute}</code>. The attorney workspace picks the debtor's county.
            </p>
            <button type="button" onClick={() => setShowCounty(s => !s)}
              className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 underline">
              {showCounty ? "Hide counties" : "Show all counties"}
            </button>
          </div>
          {showCounty && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 text-[11px] text-slate-200">
              {Object.entries(jur.homesteadByCounty).map(([county, cap]) => (
                <div key={county} className="flex items-center justify-between bg-slate-800/40 border border-slate-700 rounded px-2 py-1">
                  <span className="font-semibold">{county}</span>
                  <span className="tabular-nums text-amber-400">${cap.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-700 bg-[#0d1221] overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-800/60">
            <tr className="text-slate-400 uppercase tracking-widest text-[10px]">
              <th className="text-left px-3 py-2">Exemption</th>
              <th className="text-left px-3 py-2">Statute</th>
              <th className="text-right px-3 py-2">Cap</th>
              <th className="text-left px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {jur.items.map((it, i) => (
              <tr key={`${it.statute}-${i}`} className="border-t border-slate-700/60 text-slate-200">
                <td className="px-3 py-2 font-semibold">{it.label}</td>
                <td className="px-3 py-2 text-slate-400 font-mono text-[11px]">{it.statute}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {it.limit == null ? (
                    <span className="text-slate-400 italic">No fixed limit</span>
                  ) : (
                    <span className="text-amber-400">${it.limit.toLocaleString()}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-400">{it.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-500 italic">
        Source: {jur.source} · {canEdit ? "Inline edit + bulk import lands in the follow-up build." : "Submit a proposed change to update any row."}
      </p>
    </div>
  );
}

// ─── Audit tab ──────────────────────────────────────────────────────────────

function AuditTab() {
  // Scaffold — once persistence is wired, this reads from
  // legal_reference_audit_log ordered by changed_at DESC.
  const auditEntries = useMemo(() => [], []);
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-700 bg-[#0d1221] p-4">
        <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-2">Audit Trail</p>
        <p className="text-xs text-slate-400 leading-relaxed">
          Every change to a rule, standard, or exemption — direct edit or via approved proposal — writes an immutable entry here: who, when, old → new, effective date, source, proposal id (if any).
        </p>
      </div>
      {auditEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-xs text-slate-400">
          No audit entries yet. (Persistence backend is scaffolded — once live, every save and approved proposal appears here.)
        </div>
      ) : null}
    </div>
  );
}

// ─── Small helper ───────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}
