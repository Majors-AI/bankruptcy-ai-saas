// Local Rules — canonical, operator-maintained.
//
// One section per state (+ DC + territories), district-aware. Reuses the
// existing district structure from src/data/courts.ts (the same data the
// local court forms feature consumes — AZ single district, WA W.D./E.D.,
// CA four districts, etc.) so districts stay in one source of truth.
//
// READ-ONLY at the firm level: firms view + download local rules but
// cannot upload or edit. The Bankruptcy.AI operator (super_admin_
// bankruptcy_ai) is the only role that may upload + version-stamp a new
// local-rules document; the upload triggers the existing per-case
// re-review fan-out via rulesAuditStore.recordChange.
//
// SCAFFOLD persistence — local_rules table TODO (SQL provided
// separately). Today the page renders the state/district shell with an
// upload affordance gated to the operator + an empty-state for each
// district. The metadata fields (title, citation, effective date,
// version) are illustrated in the upload form scaffold.

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen, MapPin, ChevronRight, ChevronDown, Download,
  History, AlertTriangle, FileText, Shield, Crosshair,
} from "lucide-react";
import { COURTS_BY_STATE, type CourtDistrict } from "../../data/courts";
import CanonicalMaintenanceBanner from "./CanonicalMaintenanceBanner";
import RulesSectionAudit from "./RulesSectionAudit";
import ReReviewQueue from "./ReReviewQueue";
import { useRulesAudit } from "./rulesAuditStore";
import { useFirmPrimaryState, useFirmAdmittedStates } from "../../lib/firmPolicy";

// State display order — alphabetical, matches the Median Income / Bankruptcy
// Exemptions pages. Includes DC + the five major territories listed in the
// existing Median Income table.
const ALL_STATES: string[] = [
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

// READ-ONLY at the firm level for everyone. Local Rules upload + version-
// stamp controls live in the Bankruptcy.AI admin portal's Reference Rules
// control tower; the firm page is view + download + audit / re-review.

export default function LocalRulesPage() {
  const audit = useRulesAudit();
  const firmPrimaryState = useFirmPrimaryState();
  // Firm profile drives which jurisdictions appear here. Anything the firm
  // is NOT admitted in is hidden from the state list — managed on the
  // Firm Policy page. Empty admitted set renders the unconfigured empty
  // state instead of the full list.
  const admittedStates = useFirmAdmittedStates();
  const admittedSet = useMemo(() => new Set(admittedStates), [admittedStates]);
  const [search, setSearch] = useState("");
  const [activeState, setActiveState] = useState<string>(
    admittedSet.has(firmPrimaryState) ? firmPrimaryState : (admittedStates[0] ?? firmPrimaryState),
  );
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  // If the admitted list changes and the active state is no longer
  // admitted, snap to the firm's primary state (when admitted) or the
  // first admitted state.
  useEffect(() => {
    if (admittedStates.length === 0) return;
    if (!admittedSet.has(activeState)) {
      setActiveState(admittedSet.has(firmPrimaryState) ? firmPrimaryState : admittedStates[0]);
    }
  }, [admittedStates, admittedSet, activeState, firmPrimaryState]);

  const filtered = useMemo(
    () => ALL_STATES
      .filter(s => admittedSet.has(s))
      .filter(s => !search.trim() || s.toLowerCase().includes(search.toLowerCase())),
    [search, admittedSet],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        right={
          <div className="flex items-center gap-1 flex-wrap">
            {/* Firm-state jump — snaps the active state to the firm's
                primary filing state (firmPolicy.firmPrimaryState). Hidden
                when the firm's state isn't loaded into COURTS_BY_STATE,
                or when the firm isn't admitted there (Firm Policy →
                Practice Jurisdictions controls admission). */}
            {COURTS_BY_STATE[firmPrimaryState] && admittedSet.has(firmPrimaryState) && (
              <button
                onClick={() => setActiveState(firmPrimaryState)}
                disabled={activeState === firmPrimaryState}
                className="text-[11px] font-semibold border rounded px-2 py-1 transition-colors disabled:opacity-50 disabled:cursor-default"
                style={activeState === firmPrimaryState
                  ? { borderColor: "var(--lfs-accent)", color: "var(--lfs-accent)" }
                  : { borderColor: "#2A2A28", color: "#FAFAF7", background: "color-mix(in srgb, var(--lfs-accent) 18%, transparent)" }}
                title={activeState === firmPrimaryState
                  ? `Already on ${firmPrimaryState} (firm's filing state)`
                  : `Jump to ${firmPrimaryState} (firm's filing state)`}
              >
                <Crosshair className="w-3 h-3 inline mr-1" />
                {activeState === firmPrimaryState ? `On ${firmPrimaryState}` : `Go to ${firmPrimaryState}`}
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

      {/* Local Rules is a canonical dataset — maintained by Bankruptcy.AI.
          Read-only at the firm level for everyone; upload + version-stamp
          live in the admin portal. */}
      <CanonicalMaintenanceBanner
        datasetLabel="Local Bankruptcy Rules"
        version="0.1-scaffold"
        updatedOn="—"
      />

      {/* Local Rules diff feeds the SAME rulesAuditStore re-review queue —
          living-standards section keys it with the same in-window logic. */}
      {showQueue && <ReReviewQueue section="living_standards" />}
      {showAuditLog && <RulesSectionAudit section="living_standards" />}

      {/* Empty-state when no admitted states are configured. The state
          picker would otherwise show zero entries and confuse the user;
          surface guidance to Firm Policy instead. */}
      {admittedStates.length === 0 && (
        <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-semibold text-[#FAFAF7]">No practice jurisdictions configured</p>
            <p className="text-[11px] text-[#6B6B66] mt-1 leading-relaxed">
              Local Rules only shows the states the firm is admitted to practice in. Add states in
              <strong className="text-[#FAFAF7]"> Firm Policy → Practice Jurisdictions</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* State picker */}
        <aside className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-3 lg:max-h-[70vh] lg:overflow-y-auto">
          <p className="text-[9px] uppercase tracking-widest text-[#6B6B66] mb-1.5">
            {admittedStates.length} admitted jurisdiction{admittedStates.length === 1 ? "" : "s"}
          </p>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search state"
            className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5 mb-2"
          />
          <ul className="space-y-0.5">
            {filtered.map(s => {
              const districts = COURTS_BY_STATE[s] ?? [];
              const active = activeState === s;
              return (
                <li key={s}>
                  <button
                    onClick={() => setActiveState(s)}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-[11px] ${
                      active ? "text-[#FAFAF7]" : "text-[#FAFAF7] hover:bg-[#1A1A18]"
                    }`}
                    style={active ? {
                      background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)",
                      borderLeft: "2px solid var(--lfs-accent)",
                    } : undefined}
                  >
                    <span className="truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {s}
                    </span>
                    {districts.length > 1 && (
                      <span className="text-[9px] text-[#6B6B66]">{districts.length} dists</span>
                    )}
                    <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-60" />
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Detail */}
        <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4">
          <StateLocalRules
            state={activeState}
            districts={COURTS_BY_STATE[activeState] ?? []}
          />
        </div>
      </div>

      <p className="text-[10px] text-[#6B6B66] italic leading-snug">
        {/* TODO Phase B — persistence:
              - new table local_rules(id, state, district, title, citation,
                effective_date, version, file_storage_path, uploaded_by,
                uploaded_at) — SQL provided separately
              - Supabase Storage bucket `local_rules` for the PDF blobs
              - on upload, the operator action fans out to every firm:
                bumps the ruleset version + triggers rulesAuditStore
                re-review for in-window cases keyed by jurisdiction */}
        Local Rules is operator-canonical. The view/download surface is shared
        firm-wide; the upload + version-stamp + publish pipeline lands with
        persistence.
      </p>
    </div>
  );
}

// ─── One state's panel (district-aware) ────────────────────────────────────

function StateLocalRules({
  state, districts,
}: { state: string; districts: ReadonlyArray<CourtDistrict> }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <BookOpen className="w-4 h-4 mt-0.5" style={{ color: "var(--lfs-accent)" }} />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-[#FAFAF7]">{state} — Local Rules</h3>
          <p className="text-[11px] text-[#6B6B66] leading-relaxed">
            {districts.length === 0
              ? "No districts loaded for this state."
              : districts.length === 1
                ? "Single bankruptcy district — one set of local rules."
                : `${districts.length} bankruptcy districts — one set of local rules per district.`}
          </p>
        </div>
      </div>

      {districts.length === 0 ? (
        <div className="rounded border border-dashed border-[#2A2A28] p-4 text-[11px] text-[#6B6B66]">
          District list pending in src/data/courts.ts.
        </div>
      ) : (
        <ul className="space-y-2">
          {districts.map(d => (
            <DistrictCard key={d.value} district={d} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DistrictCard({ district }: { district: CourtDistrict }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded border border-[#2A2A28] bg-[#1A1A18]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[#FAFAF7] truncate">{district.label}</p>
          <p className="text-[10px] text-[#6B6B66] font-mono">{district.value}</p>
        </div>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-[#6B6B66]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#6B6B66]" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {/* Empty-state — no document uploaded yet. Operator sees upload
              affordance; firm sees a read-only "Not yet published" notice. */}
          <div className="rounded border border-dashed border-[#2A2A28] p-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-[11px] text-[#6B6B66]">
              <FileText className="w-3.5 h-3.5" />
              <span>No local-rules document published yet.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled
                title="Download — published rules show here when the operator publishes from the admin portal"
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6B6B66] border border-[#2A2A28] px-2 py-0.5 rounded opacity-60 cursor-not-allowed"
              >
                <Download className="w-3 h-3" /> Download
              </button>
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#6B6B66] border border-[#2A2A28] rounded px-2 py-0.5">
                <Shield className="w-3 h-3" /> Operator-only (admin portal)
              </span>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

// Local-rules upload + version-stamp form lives in the Bankruptcy.AI admin
// portal's Reference Rules control tower (src/admin/ReferenceRulesTab.tsx).
// Firm-side surface here is view + download + audit / re-review only.

function PageHeader({ right }: { right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#1A1A18] border border-[#2A2A28] flex items-center justify-center">
          <BookOpen className="w-4 h-4" style={{ color: "var(--lfs-accent)" }} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-[#FAFAF7]">Local Rules</h2>
          <p className="text-[11px] text-[#6B6B66] mt-0.5 leading-relaxed max-w-2xl">
            District-aware local bankruptcy rules per state. Operator-maintained;
            firms view and download. Updates trigger pre-filing re-review for
            in-window attorney-reviewed cases in the affected district.
          </p>
        </div>
      </div>
      {right}
    </div>
  );
}
