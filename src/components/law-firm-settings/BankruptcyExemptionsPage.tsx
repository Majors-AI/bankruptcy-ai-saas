// Bankruptcy Exemptions page (left-nav).
//
// All states + DC + territories enumerated. States with loaded data render
// their election (opt-in / opt-out / federal-allowed) + exemption rows from
// the store. Unloaded states show "Coming soon — not yet loaded."
//
// Federal is its own first-class entry.
//
// Edit: attorney + super_admin + law_firm_owner. Others propose-only.
// Audit log + re-review trigger fire on every direct edit or approved
// proposal — both wired through RulesAuditStore.

import { useEffect, useMemo, useState } from "react";
import {
  Scale, MapPin, Lock, Upload, Edit3, AlertTriangle, ChevronRight,
  History, Send, Save, Database,
} from "lucide-react";
import { EXEMPTIONS_BY_JURISDICTION } from "../../lib/irsMeansStandards";
import { useRulesAudit } from "./rulesAuditStore";
import RulesSectionAudit from "./RulesSectionAudit";
import ReReviewQueue from "./ReReviewQueue";
import CanonicalMaintenanceBanner from "./CanonicalMaintenanceBanner";
import type { ViewerRole } from "../department-management/types";
import { useFirmAdmittedStates } from "../../lib/firmPolicy";

// Map full state name → EXEMPTIONS_BY_JURISDICTION store key for the
// states whose rows are loaded. The store uses ISO-style 2-letter codes
// ("AZ", "WA", "CA"); the sidebar displays full names. Without this map,
// clicking "Arizona" would set activeKey="Arizona" and the subsequent
// EXEMPTIONS_BY_JURISDICTION["Arizona"] lookup would return undefined →
// the loaded jurisdiction would fall through to the ComingSoon
// placeholder. This was the root cause of AZ (and CA, WA) not rendering.
//
// States not in this map keep their full-name key — those resolve to
// undefined in the store on purpose, surfacing the ComingSoon UI for
// unloaded jurisdictions.
const STORE_KEY_BY_STATE: Record<string, string> = {
  Arizona: "AZ",
  California: "CA",
  Washington: "WA",
};

const ALL_STATES: Array<{ key: string; label: string }> = [
  { key: "Federal", label: "Federal § 522(d)" },
  ...[
    "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware",
    "District of Columbia","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas",
    "Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi",
    "Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York",
    "North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island",
    "South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington",
    "West Virginia","Wisconsin","Wyoming",
    "Puerto Rico","Guam","U.S. Virgin Islands","American Samoa","Northern Mariana Islands",
  ].map(s => ({ key: STORE_KEY_BY_STATE[s] ?? s, label: s })),
];

interface Props {
  viewerRole: ViewerRole;
}

export default function BankruptcyExemptionsPage({ viewerRole }: Props) {
  // Canonical dataset — READ-ONLY at the firm level for EVERY viewer.
  // Edits live in the Bankruptcy.AI admin portal's Reference Rules control
  // tower; this surface renders the maintenance banner + version + audit /
  // re-review history only.
  void viewerRole;
  const canEdit = false;
  const audit = useRulesAudit();
  const [activeKey, setActiveKey] = useState<string>("Federal");
  const [search, setSearch] = useState("");
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  const loadedKeys = useMemo(() => new Set(Object.keys(EXEMPTIONS_BY_JURISDICTION)), []);

  // Firm profile drives which jurisdictions appear here. Per the spec,
  // Federal § 522(d) is ALWAYS visible (its applicability is a per-state
  // opt-out attorney call that depends on the debtor's jurisdiction — the
  // attorney needs the federal set on the screen regardless of which
  // states the firm itself is admitted in). Everything else filters to
  // the admitted set.
  const admittedStates = useFirmAdmittedStates();
  const admittedSet = useMemo(() => new Set(admittedStates), [admittedStates]);
  const filtered = useMemo(
    () => ALL_STATES
      .filter(s => s.key === "Federal" || admittedSet.has(s.label))
      .filter(s => !search.trim() || s.label.toLowerCase().includes(search.toLowerCase())),
    [search, admittedSet],
  );

  // If the admitted list changes and activeKey drops out of the visible
  // set (and it's not Federal), snap back to Federal — always reachable.
  useEffect(() => {
    if (activeKey === "Federal") return;
    const stillVisible = filtered.some(s => s.key === activeKey);
    if (!stillVisible) setActiveKey("Federal");
  }, [filtered, activeKey]);

  const active = EXEMPTIONS_BY_JURISDICTION[activeKey];
  const loaded = loadedKeys.has(activeKey);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bankruptcy Exemptions"
        subtitle="Per-state election (opt-in / opt-out / federal allowed) + exemption rows. Edits propagate to intake pre-fill, the eligibility engine, and attorney issue flags."
        right={
          <div className="flex items-center gap-1">
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

      {/* Canonical-maintenance banner — Exemptions are operator-maintained.
          Edit affordances live in the Bankruptcy.AI admin portal; the firm
          page is read-only for everyone. */}
      <CanonicalMaintenanceBanner
        datasetLabel="Bankruptcy Exemptions"
        version={active?.effectiveDate ?? "—"}
        updatedOn={active?.effectiveDate ?? "—"}
        unverified={active != null && !active.verified}
      />

      {showQueue && <ReReviewQueue section="exemptions" />}
      {showAuditLog && <RulesSectionAudit section="exemptions" />}

      {/* Empty-state when no admitted states are configured. Federal still
          renders below — the spec keeps Federal § 522(d) always visible. */}
      {admittedStates.length === 0 && (
        <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-semibold text-[#FAFAF7]">No practice jurisdictions configured</p>
            <p className="text-[11px] text-[#6B6B66] mt-1 leading-relaxed">
              State exemptions are filtered to your admitted jurisdictions. Federal § 522(d) stays
              visible regardless. Add states in
              <strong className="text-[#FAFAF7]"> Firm Policy → Practice Jurisdictions</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* State list */}
        <aside className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-3 lg:max-h-[70vh] lg:overflow-y-auto">
          <p className="text-[9px] uppercase tracking-widest text-[#6B6B66] mb-1.5">
            Federal + {admittedStates.length} admitted state{admittedStates.length === 1 ? "" : "s"}
          </p>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search state"
            className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5 mb-2"
          />
          <ul className="space-y-0.5">
            {filtered.map(s => {
              const isLoaded = loadedKeys.has(s.key);
              const active = activeKey === s.key;
              return (
                <li key={s.key}>
                  <button
                    onClick={() => setActiveKey(s.key)}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-[11px] ${
                      active ? "text-[#FAFAF7]" : isLoaded ? "text-[#FAFAF7] hover:bg-[#1A1A18]" : "text-[#6B6B66] hover:bg-[#1A1A18]"
                    }`}
                    style={active ? { background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)", borderLeft: "2px solid var(--lfs-accent)" } : undefined}
                  >
                    <span className="truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {s.label}
                    </span>
                    {!isLoaded && <span className="text-[9px] text-[#6B6B66] italic">unloaded</span>}
                    <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-60" />
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Detail */}
        <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4">
          {!loaded || !active ? (
            <ComingSoon stateLabel={activeKey} />
          ) : (
            <StateExemptions stateKey={activeKey} canEdit={canEdit} />
          )}
        </div>
      </div>
    </div>
  );
}

function StateExemptions({ stateKey, canEdit }: { stateKey: string; canEdit: boolean }) {
  const jur = EXEMPTIONS_BY_JURISDICTION[stateKey];
  const audit = useRulesAudit();
  const [edits, setEdits] = useState<Record<number, number | null>>({}); // index → cap

  function startEdit(idx: number, val: number | null) { setEdits(e => ({ ...e, [idx]: val })); }
  function saveAll() {
    if (Object.keys(edits).length === 0) return;
    Object.entries(edits).forEach(([idxStr, newCap]) => {
      const idx = parseInt(idxStr);
      const item = jur.items[idx];
      audit.recordChange({
        section: "exemptions",
        actor: "current_user", // TODO real actor
        path: `exemptions.${stateKey}.${item.statute}.cap`,
        oldValue: item.limit ?? null,
        newValue: newCap,
        source: "manual edit",
      });
    });
    setEdits({});
    alert(`Saved ${Object.keys(edits).length} change(s) (scaffold). Audit entry + re-review tasks created for pending-signing cases.`);
  }

  return (
    <>
      {/* Election + meta */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h3 className="text-base font-semibold text-[#FAFAF7]">{jur.jurisdiction}</h3>
        <span className="text-[10px] uppercase tracking-widest border rounded-full px-2 py-0.5"
              style={{ borderColor: "var(--lfs-accent)", color: "var(--lfs-accent)" }}>
          Election: {jur.election}
        </span>
        {jur.election === "opt-out" && (
          <span className="text-[10px] uppercase tracking-widest text-rose-200 border border-rose-700/40 rounded-full px-2 py-0.5">
            federal NOT available
          </span>
        )}
        {jur.election === "state-or-federal" && (
          <span className="text-[10px] uppercase tracking-widest text-emerald-200 border border-emerald-700/40 rounded-full px-2 py-0.5">
            federal ALSO available
          </span>
        )}
        <span className="text-[10px] uppercase tracking-widest text-[#6B6B66] border border-[#2A2A28] rounded-full px-2 py-0.5">
          Effective {jur.effectiveDate}
        </span>
        {!jur.verified && (
          <span className="text-[10px] uppercase tracking-widest text-amber-200 border border-amber-700/40 rounded-full px-2 py-0.5">
            <AlertTriangle className="w-3 h-3 inline" /> not verified
          </span>
        )}
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <button
            onClick={() => alert("Upload — PDF / Excel parser TODO. Will diff loaded rows and surface a confirmation dialog.")}
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded border"
            style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" }}
          >
            <Upload className="w-3 h-3" /> Update — upload PDF / Excel
          </button>
          {Object.keys(edits).length > 0 && (
            <button
              onClick={saveAll}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-100 border border-emerald-700/60 bg-emerald-900/30 px-2.5 py-1.5 rounded"
            >
              <Save className="w-3 h-3" /> Save {Object.keys(edits).length} edit(s)
            </button>
          )}
        </div>
      )}

      {/* Rows */}
      <div className="overflow-x-auto rounded-lg border border-[#2A2A28] bg-[#1A1A18]">
        <table className="min-w-full text-[11px]">
          <thead className="bg-[#0F0F0E]">
            <tr className="text-[#6B6B66]">
              <th className="text-left px-3 py-2">Exemption</th>
              <th className="text-left px-3 py-2">Statute</th>
              <th className="text-right px-3 py-2">Cap</th>
              <th className="text-left px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {jur.items.map((it, idx) => {
              const editing = edits[idx] !== undefined;
              return (
                <tr key={`${it.statute}-${idx}`} className="border-t border-[#2A2A28] text-[#FAFAF7]">
                  <td className="px-3 py-2 font-semibold">{it.label}</td>
                  <td className="px-3 py-2 text-[#6B6B66] font-mono">{it.statute}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {canEdit ? (
                      <input
                        type="number"
                        value={editing ? (edits[idx] ?? "") : (it.limit ?? "")}
                        onChange={e => startEdit(idx, e.target.value === "" ? null : parseInt(e.target.value))}
                        className="bg-[#0F0F0E] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1 w-28 text-right"
                      />
                    ) : (
                      it.limit == null ? <em className="text-[#6B6B66]">no fixed limit</em>
                                       : <span style={{ color: "var(--lfs-accent)" }}>${it.limit.toLocaleString()}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[#6B6B66]">{it.note ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!canEdit && (
        <div className="mt-3 rounded border border-[#2A2A28] bg-[#0F0F0E] p-3 flex items-start gap-2">
          <Lock className="w-3.5 h-3.5 text-[#6B6B66] mt-0.5" />
          <p className="text-[11px] text-[#6B6B66] leading-relaxed">
            Read-only. Only an attorney with super-admin (or the law firm owner) may modify
            exemptions. Submit a <button className="underline" onClick={() => alert("Propose — routes to attorney super-admin. Scaffold.")}><Send className="w-3 h-3 inline" /> proposed change</button> per row.
          </p>
        </div>
      )}

      <p className="text-[10px] text-[#6B6B66] italic mt-2 leading-snug">
        Source: {jur.source}. Edits create an audit entry + queue every pending-signing case for attorney re-review before filing.
      </p>
    </>
  );
}

function ComingSoon({ stateLabel }: { stateLabel: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#2A2A28] bg-[#0F0F0E] p-6 text-center">
      <Database className="w-6 h-6 text-[#6B6B66] mx-auto mb-2" />
      <p className="text-[13px] font-semibold text-[#FAFAF7] mb-1">{stateLabel}</p>
      <p className="text-[11px] text-[#6B6B66]">Coming soon — not yet loaded into the legal reference store.</p>
      <p className="text-[10px] text-[#6B6B66] italic mt-2 leading-snug max-w-md mx-auto">
        Upload a state-exemption PDF / Excel from the action bar or hand-enter the rows; the
        page renders the live data once the store ingests it.
        {/* TODO Phase B — bulk ingestion pipeline (PDF/Excel parser → EXEMPTIONS_BY_JURISDICTION). */}
      </p>
    </div>
  );
}

function PageHeader({ title, subtitle, right }: { title: string; subtitle: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#1A1A18] border border-[#2A2A28] flex items-center justify-center">
          <Scale className="w-4 h-4" style={{ color: "var(--lfs-accent)" }} />
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
