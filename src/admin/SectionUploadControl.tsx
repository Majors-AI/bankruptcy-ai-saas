// Shared per-section upload control for the Bankruptcy.AI Admin portal's
// Reference Rules tower. Accepts:
//   - CSV → parse header + rows, show preview, stage on confirm.
//   - PDF → attach as source-of-record document (no auto-parse today;
//           USTP housing PDF parser hooks in here when it lands).
//
// Stages through rulesAuditStore.recordChange with verified:false; the
// existing per-section publish button (already on ReferenceRulesTab)
// flushes the staged update → version bump → per-firm push →
// per-case re-review cascade → notifyRuleUpdate.
//
// SCAFFOLD ONLY: data load is in-memory (staged on rulesAuditStore log
// entry). Persistence + canonical-store mutation TODO.

import { useRef, useState } from "react";
import {
  Upload, FileText, FileSpreadsheet, X, Check, AlertTriangle, Eye,
} from "lucide-react";
import { useRulesAudit, type RulesSection } from "../components/law-firm-settings/rulesAuditStore";

export interface SectionUploadConfig {
  /** rulesAuditStore section bucket — drives the audit + publish path. */
  auditSection: RulesSection;
  /** Human label for the section (e.g. "Median Income"). */
  label: string;
  /** Free-form path component on the recordChange entry. Lets two
   *  upload targets share an auditSection while differing in path
   *  (e.g. living_standards.housing vs living_standards.transportation). */
  pathSlug: string;
  /** Optional CSV preview hint — the column names the parser will expect
   *  for this section. Surfaced in the modal helper text. */
  expectedCsvColumns?: string[];
  /** Optional notes shown inside the upload modal (e.g. "USTP Local
   *  Standards Excel → save as CSV first"). */
  helper?: string;
  /** When true, accept .pdf files in addition to .csv. Default true. */
  acceptPdf?: boolean;
  /** When true, accept .csv files. Default true. */
  acceptCsv?: boolean;
}

interface ParsedCsv {
  header: string[];
  rows: string[][];
}

/** Minimal CSV parser — handles quoted fields with embedded commas /
 *  doubled-quote escapes. Pure helper, exported for tests if needed. */
function parseCsv(text: string): ParsedCsv {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); out.push(row); row = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else { field += ch; }
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); out.push(row); }
  // Drop trailing entirely-blank rows.
  while (out.length > 0 && out[out.length - 1].every(c => c === "")) out.pop();
  if (out.length === 0) return { header: [], rows: [] };
  const [header, ...rows] = out;
  return { header, rows };
}

interface Props {
  config: SectionUploadConfig;
}

export default function SectionUploadControl({ config }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
      >
        <Upload className="w-3 h-3" />
        Update — CSV / PDF
      </button>
      {isOpen && <UploadModal config={config} onClose={() => setIsOpen(false)} />}
    </>
  );
}

function UploadModal({
  config, onClose,
}: { config: SectionUploadConfig; onClose: () => void }) {
  const audit = useRulesAudit();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staged, setStaged] = useState(false);

  const acceptCsv = config.acceptCsv !== false;
  const acceptPdf = config.acceptPdf !== false;
  const accept = [acceptCsv && ".csv", acceptPdf && ".pdf"].filter(Boolean).join(",");

  async function onFileChosen(f: File) {
    setError(null);
    setCsv(null);
    setFile(f);
    const name = f.name.toLowerCase();
    if (name.endsWith(".csv")) {
      if (!acceptCsv) { setError("CSV not accepted for this section."); return; }
      try {
        const text = await f.text();
        const parsed = parseCsv(text);
        if (parsed.header.length === 0) {
          setError("CSV is empty or unparseable.");
          return;
        }
        setCsv(parsed);
      } catch (e) {
        setError(`Failed to read CSV: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else if (name.endsWith(".pdf")) {
      if (!acceptPdf) { setError("PDF not accepted for this section."); return; }
      // PDF — no auto-parse today; attach as source-of-record. The USTP
      // housing PDF parser hooks in here when implemented.
    } else {
      setError("Unsupported file type. Use CSV or PDF.");
    }
  }

  function stage() {
    if (!file) return;
    const kind = file.name.toLowerCase().endsWith(".csv") ? "csv" : "pdf";
    const detail = kind === "csv" && csv
      ? `CSV ${file.name} (${csv.rows.length} row${csv.rows.length === 1 ? "" : "s"})`
      : `${kind.toUpperCase()} ${file.name}`;
    // recordChange stages the upload as an audit entry. Path encodes the
    // section sub-bucket. The existing per-section Publish button on
    // ReferenceRulesTab flushes the staged update (version bump + per-
    // firm push + per-case re-review cascade + notifyRuleUpdate) without
    // any new code path.
    // recordChange.newValue is typed `string | number | null` — serialize
    // the upload metadata into the source string and keep newValue scalar
    // (use file size as a fingerprint so identical re-uploads stay distinct).
    audit.recordChange({
      section: config.auditSection,
      actor: "admin_upload",
      path: `${config.auditSection}.${config.pathSlug}.upload`,
      oldValue: null,
      newValue: file.size,
      source:
        `${kind.toUpperCase()} upload (verified:false) — ${detail}. `
        + `ts=${new Date().toISOString()}. `
        + `TODO: persist + canonical-store load.`,
    });
    setStaged(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-sm font-bold text-white">Upload — {config.label}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              CSV {acceptCsv ? "✓" : "✗"} · PDF {acceptPdf ? "✓" : "✗"} · stages with
              <strong className="text-amber-300"> verified:false</strong> until published.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {staged ? (
          <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/10 p-4 flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-300 flex-shrink-0 mt-0.5" />
            <div className="text-[12px] text-emerald-100 leading-relaxed">
              <p className="font-semibold">Staged for review.</p>
              <p className="text-emerald-200/80 mt-1">
                The upload is recorded on the rules audit log with <code className="text-emerald-300">verified:false</code>.
                Use the section's <strong>Publish</strong> button on the Reference Rules tab
                to flush — that's where the version bump + firm fan-out + per-case re-review
                cascade fires through the existing pipeline.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold border border-emerald-500/40 text-emerald-100 rounded px-2.5 py-1 hover:bg-emerald-900/30"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              className="rounded-lg border-2 border-dashed border-slate-700 bg-slate-900/40 p-6 flex flex-col items-center justify-center text-center"
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) onFileChosen(f);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onFileChosen(f); }}
              />
              {file == null ? (
                <>
                  <Upload className="w-6 h-6 text-slate-500 mb-2" />
                  <p className="text-xs text-slate-300">
                    Drop a file here or
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-amber-300 underline mx-1"
                    >
                      browse
                    </button>
                    to upload.
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">{accept}</p>
                </>
              ) : (
                <>
                  {file.name.toLowerCase().endsWith(".csv")
                    ? <FileSpreadsheet className="w-6 h-6 text-emerald-300 mb-2" />
                    : <FileText className="w-6 h-6 text-sky-300 mb-2" />}
                  <p className="text-xs text-white font-semibold">{file.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB
                    {csv && ` · ${csv.rows.length} row${csv.rows.length === 1 ? "" : "s"}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setCsv(null); setError(null); }}
                    className="mt-2 text-[10px] text-slate-500 hover:text-amber-300 underline"
                  >
                    Choose a different file
                  </button>
                </>
              )}
            </div>

            {error && (
              <div className="mt-3 rounded border border-rose-500/30 bg-rose-500/5 p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-300 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-rose-200">{error}</p>
              </div>
            )}

            {csv && (
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    Preview — first {Math.min(10, csv.rows.length)} of {csv.rows.length} rows
                  </p>
                </div>
                <div className="overflow-x-auto rounded border border-slate-800 bg-slate-900/40">
                  <table className="min-w-full text-[10px]">
                    <thead className="bg-slate-900">
                      <tr>
                        {csv.header.map((h, i) => (
                          <th key={i} className="text-left px-2 py-1 text-slate-400 font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csv.rows.slice(0, 10).map((r, i) => (
                        <tr key={i} className="border-t border-slate-800/40 text-slate-300">
                          {r.map((c, j) => (
                            <td key={j} className="px-2 py-1 tabular-nums whitespace-nowrap">{c}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {config.expectedCsvColumns && (
              <p className="text-[10px] text-slate-500 mt-2 italic">
                Expected CSV columns: <code className="text-slate-400">{config.expectedCsvColumns.join(", ")}</code>
              </p>
            )}
            {config.helper && (
              <p className="text-[10px] text-slate-500 mt-1 italic">{config.helper}</p>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-[11px] font-semibold text-slate-400 border border-slate-700 rounded px-3 py-1.5 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={stage}
                disabled={!file || !!error}
                className="inline-flex items-center gap-1 text-[11px] font-semibold border border-amber-500/50 bg-amber-500/15 text-amber-100 rounded px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Stage upload (verified:false)
              </button>
            </div>
          </>
        )}

        <p className="text-[9px] text-slate-600 italic mt-3 leading-snug">
          {/* TODO: persist + load into the canonical store. Today the upload
              records as an audit entry; the section's Publish button still
              flushes the version bump + firm fan-out via the existing
              rulesAuditStore.publish path. */}
          Today: in-memory only. Persistence + canonical-store load land with the
          firm_canonical_uploads + per-section storage migration.
        </p>
      </div>
    </div>
  );
}
