// Median Income page (left-nav).
//
// All states + DC + territories loaded from MEDIAN_INCOME_BY_STATE.
// Adjustable fields per household size + a simple chart. Update button is
// scaffold (PDF/Excel upload OR manual edit). Edit gated to attorney +
// super_admin + owner. Audit + re-review wire through RulesAuditStore.

import { useMemo, useState } from "react";
import { DollarSign, Upload, Edit3, Lock, History, AlertTriangle, Save, BarChart3 } from "lucide-react";
import {
  MEDIAN_INCOME_BY_STATE, MEDIAN_INCOME_META,
} from "../../lib/irsMeansStandards";
import { useRulesAudit } from "./rulesAuditStore";
import RulesSectionAudit from "./RulesSectionAudit";
import ReReviewQueue from "./ReReviewQueue";
import CanonicalMaintenanceBanner from "./CanonicalMaintenanceBanner";
import RuleSectionMeta from "./RuleSectionMeta";
import type { ViewerRole } from "../department-management/types";
import { useFirmAdmittedStates } from "../../lib/firmPolicy";

interface Props {
  viewerRole: ViewerRole;
}

export default function MedianIncomePage({ viewerRole }: Props) {
  // Canonical dataset — READ-ONLY at the firm level for EVERY viewer (firm
  // users AND an operator viewing a firm). Edits live in the Bankruptcy.AI
  // admin portal's Reference Rules control tower; this surface renders the
  // maintenance banner + version + audit / re-review history only.
  void viewerRole;
  const canEdit = false;
  const audit = useRulesAudit();
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<Record<string, number | null>>({}); // key `${state}:${size}`

  const states = useMemo(() => Object.keys(MEDIAN_INCOME_BY_STATE).sort(), []);
  // Firm profile drives which jurisdictions appear here. MEDIAN_INCOME_BY_STATE
  // is keyed by full state names (matching the firm-policy admitted list).
  const admittedStates = useFirmAdmittedStates();
  const admittedSet = useMemo(() => new Set(admittedStates), [admittedStates]);
  const filtered = states
    .filter(s => admittedSet.has(s))
    .filter(s => !search.trim() || s.toLowerCase().includes(search.toLowerCase()));

  function setEdit(state: string, size: number, v: number | null) {
    setEdits(prev => ({ ...prev, [`${state}:${size}`]: v }));
  }
  function valueFor(state: string, size: number): number | null {
    const k = `${state}:${size}`;
    if (k in edits) return edits[k];
    const row = MEDIAN_INCOME_BY_STATE[state];
    // Stored as [1,2,3,4]; size 5 derived from additionalPerPersonOver4.
    if (size <= 4) return row?.[size - 1] ?? null;
    const four = row?.[3];
    return four == null ? null : four + MEDIAN_INCOME_META.additionalPerPersonOver4;
  }

  function saveAll() {
    const count = Object.keys(edits).length;
    if (count === 0) return;
    Object.entries(edits).forEach(([k, v]) => {
      const [state, sizeStr] = k.split(":");
      const size = parseInt(sizeStr);
      const old = MEDIAN_INCOME_BY_STATE[state]?.[size - 1] ?? null;
      audit.recordChange({
        section: "median_income",
        actor: "current_user",
        path: `median_income.${state}.size${size}`,
        oldValue: old,
        newValue: v,
        source: "manual edit",
      });
    });
    setEdits({});
    alert(`Saved ${count} change(s) (scaffold). Audit + re-review tasks queued.`);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Median Income"
        subtitle="UST Census-derived annual median family income by state × household size. Drives the means-test over/under threshold."
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
            {canEdit && (
              <button
                onClick={() => alert("Upload — PDF / Excel parser TODO. Will diff loaded rows and confirm.")}
                className="text-[11px] font-semibold px-2 py-1 rounded border"
                style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" }}
              >
                <Upload className="w-3 h-3 inline" /> Update
              </button>
            )}
            {Object.keys(edits).length > 0 && (
              <button
                onClick={saveAll}
                className="text-[11px] font-semibold px-2 py-1 rounded border border-emerald-700/60 bg-emerald-900/30 text-emerald-100"
              >
                <Save className="w-3 h-3 inline" /> Save {Object.keys(edits).length} edit(s)
              </button>
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

      {/* Canonical-maintenance banner — Median Income is operator-maintained.
          Edit affordances live in the Bankruptcy.AI admin portal; the firm
          page is read-only for everyone. */}
      <CanonicalMaintenanceBanner
        datasetLabel="Median Income"
        version={MEDIAN_INCOME_META.effectiveDate}
        updatedOn={MEDIAN_INCOME_META.effectiveDate}
        unverified={!MEDIAN_INCOME_META.verified}
      />

      <RuleSectionMeta
        changeSection="median_income"
        auditSection="median_income"
        datasetDate={MEDIAN_INCOME_META.effectiveDate}
        headingOverride="Median Income"
      />

      {/* Meta */}
      <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-3">
        <p className="text-[11px] text-[#6B6B66]">
          Source: {MEDIAN_INCOME_META.source} · Effective {MEDIAN_INCOME_META.effectiveDate} · Each additional person over 4 adds <strong style={{ color: "var(--lfs-accent)" }}>${MEDIAN_INCOME_META.additionalPerPersonOver4.toLocaleString()}</strong>.
          {!MEDIAN_INCOME_META.verified && <> · <span className="text-amber-200">not yet attorney-verified</span></>}
        </p>
      </div>

      {showQueue && <ReReviewQueue section="median_income" />}
      {showAuditLog && <RulesSectionAudit section="median_income" />}

      {/* Empty-state when no admitted states are configured. */}
      {admittedStates.length === 0 && (
        <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-semibold text-[#FAFAF7]">No practice jurisdictions configured</p>
            <p className="text-[11px] text-[#6B6B66] mt-1 leading-relaxed">
              Median Income only shows the states the firm is admitted to practice in. Add states in
              <strong className="text-[#FAFAF7]"> Firm Policy → Practice Jurisdictions</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter states"
          className="bg-[#0F0F0E] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5 w-64"
        />
        <span className="text-[10px] text-[#6B6B66]">
          {filtered.length} of {admittedStates.length} admitted state{admittedStates.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[#2A2A28] bg-[#1A1A18]">
        <table className="min-w-full text-[11px]">
          <thead className="bg-[#0F0F0E]">
            <tr className="text-[#6B6B66]">
              <th className="text-left px-3 py-2">State</th>
              {[1, 2, 3, 4, 5].map(n => (
                <th key={n} className="text-right px-3 py-2">{n}{n === 5 ? "+" : ""}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s} className="border-t border-[#2A2A28] text-[#FAFAF7]">
                <td className="px-3 py-2 font-semibold">{s}</td>
                {[1, 2, 3, 4, 5].map(size => {
                  const v = valueFor(s, size);
                  return (
                    <td key={size} className="px-3 py-2 text-right tabular-nums">
                      {canEdit ? (
                        <input
                          type="number"
                          value={v ?? ""}
                          onChange={e => setEdit(s, size, e.target.value === "" ? null : parseInt(e.target.value))}
                          className="bg-[#0F0F0E] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1 w-28 text-right"
                        />
                      ) : v == null ? <em className="text-[#6B6B66]">—</em>
                                    : <span style={{ color: "var(--lfs-accent)" }}>${v.toLocaleString()}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chart — focused on the currently-filtered subset, 4-person column */}
      <Chart subset={filtered} />
    </div>
  );
}

function Chart({ subset }: { subset: string[] }) {
  // 4-person median across the visible states. Inline SVG bar chart so we
  // don't pull in a chart library.
  const data = subset
    .map(s => ({ state: s, value: MEDIAN_INCOME_BY_STATE[s]?.[3] ?? 0 }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 20);

  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="rounded-lg border border-[#2A2A28] bg-[#1A1A18] p-4">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-4 h-4" style={{ color: "var(--lfs-accent)" }} />
        <p className="text-xs font-semibold uppercase tracking-widest text-[#FAFAF7]">Median (4-person, top 20)</p>
      </div>
      {data.length === 0 ? (
        <p className="text-[11px] text-[#6B6B66] italic">No data for filter.</p>
      ) : (
        <div className="space-y-1.5">
          {data.map(d => {
            const pct = (d.value / max) * 100;
            return (
              <div key={d.state} className="flex items-center gap-2 text-[11px]">
                <span className="w-40 truncate text-[#FAFAF7]">{d.state}</span>
                <div className="flex-1 h-3 rounded border" style={{ borderColor: "var(--lfs-border)", background: "var(--lfs-surface)" }}>
                  <div className="h-full rounded" style={{ width: `${pct}%`, background: "var(--lfs-accent)" }} />
                </div>
                <span className="w-24 text-right tabular-nums" style={{ color: "var(--lfs-accent)" }}>
                  ${d.value.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PageHeader({ title, subtitle, right }: { title: string; subtitle: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#1A1A18] border border-[#2A2A28] flex items-center justify-center">
          <DollarSign className="w-4 h-4" style={{ color: "var(--lfs-accent)" }} />
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
