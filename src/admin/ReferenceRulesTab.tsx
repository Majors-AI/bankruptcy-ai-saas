// Reference Rules — the SINGLE editable home for every canonical legal-
// reference dataset:
//   - National Standards
//   - Local Standards (Housing & Utilities + Transportation)
//   - Median Income
//   - Exemptions (CA §704 / §703.140 + WA/CA county homestead bands)
//   - Means-test inputs (legal rules + cited parameters)
//   - Local Rules (per-state district-aware uploads)
//
// Mounted INSIDE the Bankruptcy.AI admin portal (src/admin/SuperAdminPage)
// — distinct from the firm-side Law Firm Settings rule pages, which are
// READ-ONLY for everyone now. This is the canonical edit surface; firms
// view what gets published here.
//
// Reuses the existing LegalReferenceStore component (already supports
// canEdit via viewerStaffRole='attorney_super_admin' / 'law_firm_owner').
// We mount it with edit enabled, plus add a Publish bar (per-section +
// "Publish all pending") that reuses rulesAuditStore.publish + the
// notifyRuleUpdate dispatch.
//
// SCAFFOLD: persistence + tenant fan-out are still TODO; this surface
// records publish events to the in-memory rulesAuditStore so the existing
// per-case re-review derivation fires (Reviewed-but-not-filed cases get
// flagged the moment a publish lands).

import { useMemo, useState } from "react";
import {
  BookOpen, Send, History, AlertTriangle, RefreshCw, Layers, MapPin, Upload,
} from "lucide-react";
import LegalReferenceStore from "../components/legal-reference/LegalReferenceStore";
import LocalRulesAdminPanel from "./LocalRulesAdminPanel";
import PerSectionUploadsPanel from "./PerSectionUploadsPanel";
import {
  RulesAuditProvider, useRulesAudit, type RulesSection, type PublishEvent,
} from "../components/law-firm-settings/rulesAuditStore";

const SECTIONS: Array<{ key: RulesSection; label: string }> = [
  { key: "exemptions",        label: "Exemptions" },
  { key: "median_income",     label: "Median Income" },
  { key: "living_standards",  label: "Living Standards (National + Local + Transportation)" },
  { key: "local_rules",       label: "Local Rules" },
];

// ─── Outer wrapper — mounts the RulesAuditProvider for the admin scope.
// The firm-side LawFirmSettings has its own provider; this is a separate
// in-memory store for the admin surface. When persistence lands the
// providers will resolve to the same backing table; today they're parallel
// scaffolds.

export default function ReferenceRulesTab() {
  return (
    <RulesAuditProvider>
      <ReferenceRulesTabInner />
    </RulesAuditProvider>
  );
}

function ReferenceRulesTabInner() {
  const audit = useRulesAudit();
  const [activePanel, setActivePanel] = useState<"core" | "uploads" | "local_rules">("core");
  const [publishing, setPublishing] = useState<RulesSection[] | "all" | null>(null);
  const [lastPublish, setLastPublish] = useState<PublishEvent | null>(null);
  // TODO Phase B — replace with a real firm-id list from the Firms tab /
  // server query. Today the dispatch is a stub anyway (notifyRuleUpdate
  // logs only); a single demo firm exercises the per-firm path.
  const demoFirmIds = useMemo(() => ["00000000-0000-0000-0000-000000000001"], []);

  const pendingCount = audit.pendingChangeCount();

  async function handlePublish(scope: RulesSection[] | "all") {
    setPublishing(scope);
    try {
      const event = await audit.publish({
        actor: "bankruptcy_ai_operator",
        scope,
        firmIds: demoFirmIds,
      });
      setLastPublish(event);
    } finally {
      setPublishing(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header + Publish bar */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-5 h-5 text-amber-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Reference Rules — canonical control tower</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
            Single editable home for every canonical dataset that the firm pages render
            read-only. Edit a value → it lands as a PENDING change. Hit Publish → the
            ruleset version bumps, every firm's in-window cases re-flag for re-review,
            and the transactional rule-update email enqueues per firm.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-200 border border-amber-500/40 rounded-full px-2 py-1">
              <AlertTriangle className="w-3 h-3" /> {pendingCount} pending
            </span>
          )}
          <button
            type="button"
            disabled={publishing !== null || pendingCount === 0}
            onClick={() => handlePublish("all")}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-600 bg-emerald-600/30 text-emerald-100 hover:bg-emerald-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing === "all"
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Publishing…</>
              : <><Send className="w-3.5 h-3.5" /> Publish all pending</>}
          </button>
        </div>
      </div>

      {/* Last-publish receipt */}
      {lastPublish && (
        <PublishReceipt event={lastPublish} />
      )}

      {/* Section picker — Core (LegalReferenceStore inline editor) vs
          Per-section uploads (CSV/PDF for every section) vs Local Rules. */}
      <div className="flex items-center gap-1 border-b border-slate-800">
        <SectionBtn
          active={activePanel === "core"}
          onClick={() => setActivePanel("core")}
          icon={<Layers className="w-3.5 h-3.5" />}
          label="Standards / Median / Exemptions / Means-Test"
        />
        <SectionBtn
          active={activePanel === "uploads"}
          onClick={() => setActivePanel("uploads")}
          icon={<Upload className="w-3.5 h-3.5" />}
          label="Per-section Uploads (CSV / PDF)"
        />
        <SectionBtn
          active={activePanel === "local_rules"}
          onClick={() => setActivePanel("local_rules")}
          icon={<MapPin className="w-3.5 h-3.5" />}
          label="Local Rules"
        />
      </div>

      {/* Body */}
      {activePanel === "core" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-1">
          {/* Existing LegalReferenceStore — mounted with attorney_super_admin
              role so canEdit is true. surfaceName disambiguates the audit
              entries for this canonical surface. */}
          <LegalReferenceStore
            viewerStaffRole="attorney_super_admin"
            surfaceName="super_admin"
          />
          {/* Per-section publish buttons — each scope-specific publish bumps
              the version with a scope tag so the email subject + audit log
              identify which dataset changed. */}
          <div className="border-t border-slate-800 px-4 py-3 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 mr-2">
              Publish individual datasets:
            </span>
            {SECTIONS.filter(s => s.key !== "local_rules").map(s => (
              <button
                key={s.key}
                disabled={publishing !== null}
                onClick={() => handlePublish([s.key])}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
              >
                <Send className="w-3 h-3" /> Publish {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {activePanel === "uploads" && <PerSectionUploadsPanel />}

      {activePanel === "local_rules" && (
        <LocalRulesAdminPanel onAfterUpload={() => { /* edits land via audit.recordChange inside the panel */ }} />
      )}

      {/* Operator audit trail (recent publish events) */}
      <PublishHistory />
    </div>
  );
}

// ─── Receipt + history ────────────────────────────────────────────────────

function PublishReceipt({ event }: { event: PublishEvent }) {
  const notif = event.notifyResult;
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <p className="text-xs font-bold text-emerald-300 mb-1">
        ✓ Published — ruleset v{event.versionId.slice(0, 60)}{event.versionId.length > 60 ? "…" : ""}
      </p>
      <p className="text-[11px] text-emerald-200 leading-relaxed">
        <strong>Scope:</strong> {Array.isArray(event.scope) ? event.scope.join(", ") : "all pending"} ·{" "}
        <strong>Effective:</strong> {event.effectiveDate} ·{" "}
        <strong>By:</strong> {event.actor}
      </p>
      <p className="text-[11px] text-emerald-200/80 mt-1">
        <strong>Change summary:</strong> {event.changeSummary}
      </p>
      {notif && (
        <p className="text-[10px] text-emerald-200/70 mt-2">
          Notify result — attempted {notif.attempted} · delivered {notif.delivered} · skipped{" "}
          {notif.skipped.length}{notif.errors.length > 0 && ` · errors ${notif.errors.length}`}. Real
          SendGrid dispatch lands when notifyRuleUpdate wires up (transactional path; OUT of mass-mail).
        </p>
      )}
    </div>
  );
}

function PublishHistory() {
  const audit = useRulesAudit();
  const events = audit.publishEvents;
  if (events.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <History className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
          Publish history ({events.length})
        </p>
      </div>
      <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
        {events.map(e => (
          <li key={e.id} className="rounded border border-slate-800 bg-slate-950/40 p-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] text-slate-500">
              <span className="font-mono text-amber-300">{e.id}</span>
              <span>{new Date(e.ts).toLocaleString()}</span>
            </div>
            <p className="text-[11px] text-slate-200 mt-0.5">
              {Array.isArray(e.scope) ? e.scope.join(", ") : "all pending"} · effective {e.effectiveDate}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              by {e.actor} · {e.changeSummary}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionBtn({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
        active
          ? "text-amber-400 border-amber-400"
          : "text-slate-500 border-transparent hover:text-slate-300"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
