import { useState, useRef, useCallback, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  Info,
  Home,
  CreditCard,
  Briefcase,
  DollarSign,
  Building2,
  HelpCircle,
  RefreshCw,
} from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type Schedule = "D" | "E/F-priority" | "E/F-unsecured" | "G" | "H" | "unknown";

interface ParsedAccount {
  reportSection: string | null;
  creditorName: string;
  originalCreditor: string | null;
  accountNumber: string | null;
  ownershipType: string | null;
  accountType: string | null;
  suggestedSchedule: Schedule;
  status: string | null;
  loanType: string | null;
  currentBalance: string | null;
  highCredit: string | null;
  dateOpened: string | null;
  lastReported: string | null;
  lastActivity: string | null;
  monthlyPayment: string | null;
  pastDue: string | null;
  payHistory: string | null;
  bkAddr1: string | null;
  bkCity: string | null;
  bkState: string | null;
  bkZip: string | null;
  bkPhone: string | null;
  bureauAddr1: string | null;
  bureauCity: string | null;
  bureauState: string | null;
  bureauZip: string | null;
  bureauPhone: string | null;
  source: string | null;
}

interface AssignedAccount extends ParsedAccount {
  _id: string;
  assignedSchedule: Schedule;
}

const SCHEDULE_OPTIONS: { value: Schedule; label: string; color: string }[] = [
  { value: "D",             label: "Schedule D — Secured",              color: "text-sky-400 bg-sky-400/10 border-sky-400/30" },
  { value: "E/F-priority",  label: "Schedule E/F — Priority Unsecured", color: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
  { value: "E/F-unsecured", label: "Schedule E/F — General Unsecured",  color: "text-slate-300 bg-slate-800 border-slate-600" },
  { value: "G",             label: "Schedule G — Lease/Contract",       color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  { value: "H",             label: "Schedule H — Co-debtor",            color: "text-rose-400 bg-rose-400/10 border-rose-400/30" },
  { value: "unknown",       label: "Unclassified",                      color: "text-slate-500 bg-slate-800/50 border-slate-700" },
];

function scheduleIcon(s: Schedule) {
  switch (s) {
    case "D":             return <Home className="w-3.5 h-3.5" />;
    case "E/F-priority":  return <DollarSign className="w-3.5 h-3.5" />;
    case "E/F-unsecured": return <CreditCard className="w-3.5 h-3.5" />;
    case "G":             return <Building2 className="w-3.5 h-3.5" />;
    case "H":             return <Briefcase className="w-3.5 h-3.5" />;
    default:              return <HelpCircle className="w-3.5 h-3.5" />;
  }
}

function sourceLabel(src: string) {
  const map: Record<string, string> = {
    stretto:    "Bankruptcy Credit Report",
    experian:   "Experian",
    transunion: "TransUnion",
    equifax:    "Equifax",
    unknown:    "Credit Report",
  };
  return map[src] ?? src;
}

function sourceBadgeColor(src: string) {
  const map: Record<string, string> = {
    stretto:    "text-amber-400 bg-amber-400/10 border-amber-400/30",
    experian:   "text-sky-400 bg-sky-400/10 border-sky-400/30",
    transunion: "text-blue-400 bg-blue-400/10 border-blue-400/30",
    equifax:    "text-red-400 bg-red-400/10 border-red-400/30",
  };
  return map[src] ?? "text-slate-400 bg-slate-800 border-slate-600";
}

function groupBySchedule(accounts: AssignedAccount[]) {
  const groups: Record<Schedule, AssignedAccount[]> = {
    "D": [], "E/F-priority": [], "E/F-unsecured": [], "G": [], "H": [], "unknown": [],
  };
  for (const a of accounts) groups[a.assignedSchedule].push(a);
  return groups;
}

// Extract text content from a PDF. Falls back to image rendering for pages
// where text extraction yields fewer than 50 characters (i.e. scanned pages).
async function extractPdfContent(
  file: File,
  onProgress: (msg: string) => void
): Promise<{ mode: "text"; text: string } | { mode: "images"; pageImages: string[] }> {
  onProgress("Loading PDF…");
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const pagesToProcess = Math.min(totalPages, 40);

  // First pass: try text extraction
  onProgress("Extracting text…");
  let fullText = "";
  let textPageCount = 0;

  for (let i = 1; i <= pagesToProcess; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: unknown) => {
        const it = item as { str?: string; hasEOL?: boolean };
        return (it.str ?? "") + (it.hasEOL ? "\n" : " ");
      })
      .join("")
      .trim();

    if (pageText.length >= 50) {
      fullText += `\n\n--- Page ${i} ---\n${pageText}`;
      textPageCount++;
    }
  }

  // If we got meaningful text from at least half the pages, use text mode
  if (textPageCount >= Math.ceil(pagesToProcess / 2) && fullText.length > 500) {
    onProgress(`Extracted text from ${textPageCount} page(s).`);
    return { mode: "text", text: fullText.slice(0, 200_000) };
  }

  // Fallback: render pages as images (scanned PDF)
  onProgress("PDF appears scanned — switching to image mode…");
  const pageImages: string[] = [];

  // Limit to 12 pages for scanned docs to stay within payload limits
  const imagePagesToRender = Math.min(pagesToProcess, 12);

  for (let i = 1; i <= imagePagesToRender; i++) {
    onProgress(`Rendering page ${i} of ${imagePagesToRender}…`);
    const page = await pdf.getPage(i);
    // Scale 1.2 for scanned docs — balances legibility vs file size
    const viewport = page.getViewport({ scale: 1.2 });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;

    // 60% JPEG quality — sufficient for text recognition
    pageImages.push(canvas.toDataURL("image/jpeg", 0.6).split(",")[1]);
  }

  return { mode: "images", pageImages };
}

export default function CreditReportUploader() {
  const [dragOver, setDragOver]           = useState(false);
  const [parsing, setParsing]             = useState(false);
  const [parseError, setParseError]       = useState<string | null>(null);
  const [fileName, setFileName]           = useState<string | null>(null);
  const [parseStatus, setParseStatus]     = useState<string>("");
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  const [result, setResult] = useState<{
    reportSource: string;
    reportDate: string | null;
    subjectName: string | null;
    accounts: AssignedAccount[];
  } | null>(null);

  const [expandedId, setExpandedId]         = useState<string | null>(null);
  const [filterSchedule, setFilterSchedule] = useState<Schedule | "all">("all");
  const [saving, setSaving]                 = useState(false);
  const [saved, setSaved]                   = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function checkApiKey() {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/parse-credit-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ _ping: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 500 && typeof data.error === "string" && data.error.includes("ANTHROPIC_API_KEY")) {
          setApiKeyMissing(true);
        }
      } catch { /* ignore */ }
    }
    checkApiKey();
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
      setParseError("Only PDF and image files are supported.");
      return;
    }

    setParseError(null);
    setParsing(true);
    setResult(null);
    setSaved(false);
    setFileName(file.name);

    try {
      let requestBody: Record<string, unknown>;

      if (file.type === "application/pdf") {
        const extracted = await extractPdfContent(file, setParseStatus);

        if (extracted.mode === "text") {
          setParseStatus("Analyzing credit report with AI… (30–60 seconds)");
          requestBody = { reportText: extracted.text };
        } else {
          if (extracted.pageImages.length === 0) {
            setParseError("Could not read this PDF. Please make sure it is a valid credit report and try again.");
            return;
          }
          setParseStatus(`Analyzing ${extracted.pageImages.length} page(s) with AI… (30–90 seconds)`);
          requestBody = { pageImages: extracted.pageImages, mediaType: "image/jpeg" };
        }
      } else {
        // Direct image upload
        setParseStatus("Reading image…");
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        setParseStatus("Analyzing with AI… (30–60 seconds)");
        requestBody = { pageImages: [base64], mediaType: file.type };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 150_000);

      let res: Response;
      try {
        res = await fetch(`${SUPABASE_URL}/functions/v1/parse-credit-report`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      setParseStatus("Processing AI response…");

      const rawText = await res.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(rawText);
      } catch {
        setParseError(`Unexpected server response:\n\n${rawText.slice(0, 600)}`);
        return;
      }

      if (!res.ok || data.error) {
        const errMsg = String(data.error ?? `HTTP ${res.status}`);
        if (errMsg.includes("ANTHROPIC_API_KEY")) setApiKeyMissing(true);
        setParseError(errMsg);
        return;
      }

      const rawAccounts = Array.isArray(data.accounts) ? (data.accounts as ParsedAccount[]) : [];
      if (rawAccounts.length === 0) {
        setParseError("No accounts were found in this report. Make sure you uploaded a complete credit report.");
        return;
      }

      setResult({
        reportSource: String(data.reportSource ?? "unknown"),
        reportDate:   data.reportDate ? String(data.reportDate) : null,
        subjectName:  data.subjectName ? String(data.subjectName) : null,
        accounts: rawAccounts.map((a, i) => ({
          ...a,
          _id: `acct-${i}`,
          assignedSchedule: (a.suggestedSchedule ?? "unknown") as Schedule,
        })),
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setParseError("Request timed out. The report may be too large — try uploading fewer pages or a smaller file.");
      } else {
        setParseError(String(err));
      }
    } finally {
      setParsing(false);
      setParseStatus("");
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  function reset() {
    setResult(null);
    setSaved(false);
    setParseError(null);
    setFileName(null);
    setFilterSchedule("all");
  }

  function updateSchedule(id: string, schedule: Schedule) {
    setResult(prev => {
      if (!prev) return prev;
      return { ...prev, accounts: prev.accounts.map(a => a._id === id ? { ...a, assignedSchedule: schedule } : a) };
    });
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setParseError(null);
    try {
      const payload = result.accounts.map(a => ({
        creditor_name:     a.creditorName,
        original_creditor: a.originalCreditor,
        account_number:    a.accountNumber,
        account_type:      a.accountType,
        assigned_schedule: a.assignedSchedule,
        current_balance:   a.currentBalance,
        status:            a.status,
        address_line1:     a.bkAddr1 ?? a.bureauAddr1,
        city:              a.bkCity ?? a.bureauCity,
        state:             a.bkState ?? a.bureauState,
        zip:               a.bkZip ?? a.bureauZip,
        phone:             a.bkPhone ?? a.bureauPhone,
        report_source:     result.reportSource,
        report_date:       result.reportDate,
        source_bureaus:    a.source,
        client_id:         "client-demo",
      }));

      const res = await fetch(`${SUPABASE_URL}/rest/v1/credit_report_accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey:        SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer:        "return=minimal",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setParseError(`Save failed: ${await res.text()}`);
        return;
      }
      setSaved(true);
    } catch (err) {
      setParseError(String(err));
    } finally {
      setSaving(false);
    }
  }

  const displayAccounts = result
    ? filterSchedule === "all" ? result.accounts : result.accounts.filter(a => a.assignedSchedule === filterSchedule)
    : [];
  const groups = result ? groupBySchedule(result.accounts) : null;
  const uploadDisabled = apiKeyMissing || parsing;

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileInput} />

      {/* API key warning */}
      {apiKeyMissing && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-4">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-300 mb-1">API Key Not Configured</p>
            <p className="text-xs text-red-400/80 leading-relaxed mb-2">
              The <code className="bg-red-900/40 px-1 py-0.5 rounded text-red-300">ANTHROPIC_API_KEY</code> secret
              is not set in your Supabase project. The credit report parser requires it.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Supabase dashboard → Project Settings → Edge Functions → Secrets → Add{" "}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-300">ANTHROPIC_API_KEY</code>
            </p>
          </div>
        </div>
      )}

      {/* Upload zone */}
      {!result && !parsing && (
        <div
          onDragOver={e => { if (!uploadDisabled) { e.preventDefault(); setDragOver(true); } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { if (!uploadDisabled) handleDrop(e); }}
          onClick={() => { if (!uploadDisabled) fileRef.current?.click(); }}
          className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl px-6 py-10 transition-all select-none ${
            uploadDisabled
              ? "border-slate-800 opacity-40 cursor-not-allowed"
              : dragOver
                ? "border-amber-400/70 bg-amber-400/5 cursor-pointer"
                : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/40 cursor-pointer"
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
            <Upload className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-center">
            <p className="text-sm text-white font-semibold">Drop your credit report here</p>
            <p className="text-xs text-slate-500 mt-1">PDF or image · Experian, TransUnion, or Equifax</p>
          </div>
          <span className="text-xs text-amber-400 font-semibold bg-amber-400/10 border border-amber-400/25 px-3 py-1.5 rounded-full">
            Click to browse
          </span>
        </div>
      )}

      {/* Progress */}
      {parsing && (
        <div className="flex flex-col items-center justify-center gap-4 border border-slate-700 rounded-xl px-6 py-10 bg-slate-800/30">
          <Loader2 className="w-9 h-9 text-amber-400 animate-spin" />
          <div className="text-center">
            {fileName && <p className="text-xs text-slate-500 mb-1 truncate max-w-xs">{fileName}</p>}
            <p className="text-sm text-slate-300 font-medium">{parseStatus || "Processing…"}</p>
            <p className="text-xs text-slate-600 mt-1">Do not close this window.</p>
          </div>
        </div>
      )}

      {/* Error */}
      {parseError && (
        <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/25 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-300 mb-0.5">Could not read credit report</p>
            <p className="text-xs text-red-400/80 leading-relaxed whitespace-pre-wrap break-words">{parseError}</p>
            <button onClick={() => { reset(); fileRef.current?.click(); }} className="mt-2 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2">
              Try uploading again
            </button>
          </div>
          <button onClick={() => setParseError(null)} className="text-slate-600 hover:text-slate-400 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${sourceBadgeColor(result.reportSource)}`}>
                {sourceLabel(result.reportSource)}
              </span>
              {result.subjectName && <span className="text-xs text-slate-400 font-medium">{result.subjectName}</span>}
              {result.reportDate && <span className="text-xs text-slate-600">· {result.reportDate}</span>}
              <span className="text-xs text-slate-500">{result.accounts.length} accounts</span>
            </div>
            <button onClick={() => { reset(); fileRef.current?.click(); }} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              <RefreshCw className="w-3 h-3" />
              Upload different report
            </button>
          </div>

          {groups && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterSchedule("all")}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  filterSchedule === "all" ? "bg-white text-slate-900 border-white" : "text-slate-400 border-slate-700 hover:border-slate-500"
                }`}
              >
                All ({result.accounts.length})
              </button>
              {SCHEDULE_OPTIONS.filter(o => groups[o.value].length > 0).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilterSchedule(opt.value)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                    filterSchedule === opt.value ? opt.color : "text-slate-500 border-slate-700 hover:border-slate-500"
                  }`}
                >
                  {opt.label.split("—")[0].trim()} ({groups[opt.value].length})
                </button>
              ))}
            </div>
          )}

          <div className="flex items-start gap-2.5 bg-sky-500/8 border border-sky-500/20 rounded-xl px-4 py-3">
            <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-300 leading-relaxed">
              AI-suggested schedule assignments are shown. Use the dropdown on each row to correct any before saving.
            </p>
          </div>

          <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-0.5">
            {displayAccounts.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-6">No accounts in this category.</p>
            )}
            {displayAccounts.map(acct => {
              const isExpanded = expandedId === acct._id;
              const schedOpt = SCHEDULE_OPTIONS.find(o => o.value === acct.assignedSchedule) ?? SCHEDULE_OPTIONS[5];
              return (
                <div key={acct._id} className={`border rounded-xl overflow-hidden transition-colors ${isExpanded ? "border-slate-600 bg-slate-800/60" : "border-slate-800 bg-slate-900 hover:border-slate-700"}`}>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 ${schedOpt.color}`}>
                      {scheduleIcon(acct.assignedSchedule)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white leading-snug truncate">{acct.creditorName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {acct.originalCreditor && <span className="text-xs text-slate-500">via {acct.originalCreditor}</span>}
                        {acct.accountNumber && <span className="text-xs text-slate-600">{acct.accountNumber}</span>}
                        {acct.currentBalance && <span className="text-xs font-semibold text-white">{acct.currentBalance}</span>}
                        {acct.status && (
                          <span className={`text-xs font-medium ${/collection|charged|derogatory/i.test(acct.status ?? "") ? "text-red-400" : /open|current/i.test(acct.status ?? "") ? "text-green-400" : "text-slate-500"}`}>
                            {acct.status}
                          </span>
                        )}
                      </div>
                    </div>
                    <select
                      value={acct.assignedSchedule}
                      onChange={e => updateSchedule(acct._id, e.target.value as Schedule)}
                      onClick={e => e.stopPropagation()}
                      className="text-xs font-semibold bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300 focus:outline-none focus:border-amber-400/60 cursor-pointer flex-shrink-0"
                    >
                      {SCHEDULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button onClick={() => setExpandedId(prev => prev === acct._id ? null : acct._id)} className="text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-700/50">
                      <div className="pt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                        {([
                          ["Type",          acct.loanType ?? acct.accountType],
                          ["Section",       acct.reportSection],
                          ["Ownership",     acct.ownershipType],
                          ["High Credit",   acct.highCredit],
                          ["Monthly Pmt",   acct.monthlyPayment],
                          ["Past Due",      acct.pastDue],
                          ["Date Opened",   acct.dateOpened],
                          ["Last Reported", acct.lastReported],
                          ["Last Activity", acct.lastActivity],
                          ["Bureau(s)",     acct.source],
                        ] as [string, string | null][]).filter(([, v]) => v).map(([label, val]) => (
                          <div key={label}>
                            <p className="text-slate-600 uppercase tracking-wide font-semibold text-[10px]">{label}</p>
                            <p className="text-slate-300 mt-0.5">{val}</p>
                          </div>
                        ))}
                      </div>
                      {(acct.bkAddr1 || acct.bureauAddr1) && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
                          {acct.bkAddr1 && (
                            <div>
                              <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide mb-0.5">BK Noticing Address</p>
                              <p className="text-xs text-slate-300">
                                {acct.bkAddr1}{acct.bkCity ? `, ${acct.bkCity}` : ""}{acct.bkState ? `, ${acct.bkState}` : ""}{acct.bkZip ? ` ${acct.bkZip}` : ""}
                                {acct.bkPhone && <span className="text-slate-500 ml-2">{acct.bkPhone}</span>}
                              </p>
                            </div>
                          )}
                          {acct.bureauAddr1 && (
                            <div>
                              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Bureau Address</p>
                              <p className="text-xs text-slate-400">
                                {acct.bureauAddr1}{acct.bureauCity ? `, ${acct.bureauCity}` : ""}{acct.bureauState ? `, ${acct.bureauState}` : ""}{acct.bureauZip ? ` ${acct.bureauZip}` : ""}
                                {acct.bureauPhone && <span className="text-slate-500 ml-2">{acct.bureauPhone}</span>}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-slate-500">
              {result.accounts.filter(a => a.assignedSchedule === "unknown").length > 0 && (
                <span className="text-amber-400 font-semibold">
                  {result.accounts.filter(a => a.assignedSchedule === "unknown").length} unclassified ·{" "}
                </span>
              )}
              {result.accounts.length} total accounts
            </p>
            {saved ? (
              <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Saved to your case file
              </div>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {saving ? "Saving…" : "Save Creditor List"}
              </button>
            )}
          </div>
        </>
      )}

      {!result && !parsing && !parseError && !apiKeyMissing && (
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Supports credit reports from Experian, TransUnion, and Equifax.</span>
        </div>
      )}
    </div>
  );
}
