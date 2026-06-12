// Local Rules — operator-side editable panel inside the Bankruptcy.AI
// admin portal's Reference Rules tower.
//
// Mirrors the firm-side LocalRulesPage layout (state list + district
// cards) but adds the upload form per district. Uses the same
// COURTS_BY_STATE district structure (single source); writes feed the
// rulesAuditStore so a subsequent Publish event picks them up.

import { useMemo, useState } from "react";
import {
  BookOpen, MapPin, ChevronRight, ChevronDown, Upload, Download, FileText,
} from "lucide-react";
import { COURTS_BY_STATE, type CourtDistrict } from "../data/courts";
import { useRulesAudit } from "../components/law-firm-settings/rulesAuditStore";

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

interface Props {
  onAfterUpload?: () => void;
}

export default function LocalRulesAdminPanel({ onAfterUpload }: Props) {
  const [search, setSearch] = useState("");
  const [activeState, setActiveState] = useState<string>("Arizona");
  const filtered = useMemo(
    () => ALL_STATES.filter(s => !search.trim() || s.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <BookOpen className="w-4 h-4 mt-0.5 text-amber-300" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Local Rules — operator upload</p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
            Per-state district-aware upload + version-stamp. Each upload records a pending
            audit entry; click Publish in the header to bump the ruleset version and fan out
            re-review.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <aside className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 lg:max-h-[60vh] lg:overflow-y-auto">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search state"
            className="w-full bg-slate-900 border border-slate-700 text-[11px] text-white rounded px-2 py-1.5 mb-2"
          />
          <ul className="space-y-0.5">
            {filtered.map(s => {
              const districts = COURTS_BY_STATE[s] ?? [];
              const isActive = activeState === s;
              return (
                <li key={s}>
                  <button
                    onClick={() => setActiveState(s)}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-[11px] ${
                      isActive
                        ? "text-white bg-amber-500/20 border-l-2 border-amber-400"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <span className="truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {s}
                    </span>
                    {districts.length > 1 && (
                      <span className="text-[9px] text-slate-500">{districts.length} dists</span>
                    )}
                    <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-60" />
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
          <StateLocalRules
            state={activeState}
            districts={COURTS_BY_STATE[activeState] ?? []}
            onAfterUpload={onAfterUpload}
          />
        </div>
      </div>
    </div>
  );
}

function StateLocalRules({
  state, districts, onAfterUpload,
}: { state: string; districts: ReadonlyArray<CourtDistrict>; onAfterUpload?: () => void }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-bold text-white">{state} — Local Rules</h3>
        <p className="text-[11px] text-slate-400">
          {districts.length === 0
            ? "No districts loaded for this state."
            : districts.length === 1
              ? "Single bankruptcy district — one set of local rules."
              : `${districts.length} bankruptcy districts — one set of local rules per district.`}
        </p>
      </div>

      {districts.length === 0 ? (
        <div className="rounded border border-dashed border-slate-700 p-4 text-[11px] text-slate-500">
          District list pending in src/data/courts.ts.
        </div>
      ) : (
        <ul className="space-y-2">
          {districts.map(d => <DistrictCard key={d.value} district={d} onAfterUpload={onAfterUpload} />)}
        </ul>
      )}
    </div>
  );
}

function DistrictCard({
  district, onAfterUpload,
}: { district: CourtDistrict; onAfterUpload?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded border border-slate-800 bg-slate-900/40">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-white truncate">{district.label}</p>
          <p className="text-[10px] text-slate-500 font-mono">{district.value}</p>
        </div>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <div className="rounded border border-dashed border-slate-700 p-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <FileText className="w-3.5 h-3.5" />
              <span>No local-rules document published yet.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled
                title="Download — published rules show here after publish"
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 border border-slate-700 px-2 py-0.5 rounded opacity-60 cursor-not-allowed"
              >
                <Download className="w-3 h-3" /> Download
              </button>
              <UploadForm districtValue={district.value} onAfterUpload={onAfterUpload} />
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function UploadForm({
  districtValue, onAfterUpload,
}: { districtValue: string; onAfterUpload?: () => void }) {
  const audit = useRulesAudit();
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  const [citation, setCitation] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [version, setVersion] = useState("");

  function submit() {
    if (!title.trim() || !effectiveDate) return;
    // Feed the existing rulesAuditStore under the dedicated local_rules
    // bucket (added to RulesSection in Prompt 49). Matches the
    // PerSectionUploadsPanel Local Rules row.
    audit.recordChange({
      section: "local_rules",
      actor: "bankruptcy_ai_operator",
      path: `local_rules.${districtValue}`,
      oldValue: null,
      newValue: `${title.trim()} v${version || "1"} (${effectiveDate})`,
      source: `PDF upload — citation: ${citation || "n/a"}`,
    });
    setTitle(""); setCitation(""); setEffectiveDate(""); setVersion(""); setShow(false);
    onAfterUpload?.();
    alert(
      `Local rules staged (pending) for ${districtValue}.\n\n` +
      `Title: ${title}\nCitation: ${citation || "—"}\nEffective: ${effectiveDate}\nVersion: ${version || "1"}\n\n` +
      `Click Publish in the header to bump the ruleset version + enqueue rule-update emails per firm.`,
    );
  }

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
      >
        <Upload className="w-3 h-3" /> Upload PDF
      </button>
    );
  }

  return (
    <div className="w-full rounded border border-slate-700 bg-slate-900 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
      <label className="block">
        <span className="block text-[9px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Title *</span>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Local Rules of Bankruptcy Procedure" className="w-full bg-slate-950 border border-slate-700 text-[11px] text-white rounded px-2 py-1" />
      </label>
      <label className="block">
        <span className="block text-[9px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Citation</span>
        <input value={citation} onChange={e => setCitation(e.target.value)} placeholder="e.g. D. Ariz. LR" className="w-full bg-slate-950 border border-slate-700 text-[11px] text-white rounded px-2 py-1" />
      </label>
      <label className="block">
        <span className="block text-[9px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Effective date *</span>
        <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-[11px] text-white rounded px-2 py-1" />
      </label>
      <label className="block">
        <span className="block text-[9px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Version</span>
        <input value={version} onChange={e => setVersion(e.target.value)} placeholder="1" className="w-full bg-slate-950 border border-slate-700 text-[11px] text-white rounded px-2 py-1" />
      </label>
      <div className="sm:col-span-2 flex items-center justify-end gap-2">
        <button onClick={() => setShow(false)} className="text-[10px] text-slate-500 hover:text-white px-2 py-1">Cancel</button>
        <button onClick={submit} className="text-[11px] font-semibold text-amber-100 border border-amber-500/40 bg-amber-500/20 rounded px-2 py-1">
          Stage upload
        </button>
      </div>
    </div>
  );
}
