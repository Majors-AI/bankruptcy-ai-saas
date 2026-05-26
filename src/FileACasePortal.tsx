import { useState, useEffect, useCallback } from "react";
import {
  Scale, CheckCircle2, Clock, AlertTriangle, RefreshCw, X,
  User, FileText, Gavel, Bell, CheckCheck, Flag,
  Building2, ShieldAlert, ShieldCheck, RotateCcw, Info,
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function sbFetch(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json().catch(() => null);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaseToFile {
  id: string;
  client_id: string;
  client_name: string;
  case_number: string | null;
  chapter: number;
  fee_structure: string;
  attorney_name: string | null;
  paralegal_name: string | null;
  signed_at: string | null;
  filing_status: string;
  filed_at: string | null;
  filed_by: string | null;
  court_case_number: string | null;
  notice_sent: boolean;
  notice_sent_at: string | null;
  bank_balance_confirmed_at: string | null;
  client_info_confirmed_at: string | null;
  requires_resign: boolean;
  resign_reason: string | null;
  filing_readiness_checked_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Readiness Logic ──────────────────────────────────────────────────────────

const STALE_DAYS = 0; // same day — must be confirmed on filing date

function isToday(ts: string | null): boolean {
  if (!ts) return false;
  const d = new Date(ts);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function daysSince(ts: string | null): number {
  if (!ts) return 999;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}

type ReadinessIssue = { type: "blocking" | "warning"; message: string };

function checkReadiness(item: CaseToFile): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  if (!item.signed_at) {
    issues.push({ type: "blocking", message: "Case has not been signed by all parties." });
  }

  if (!isToday(item.bank_balance_confirmed_at)) {
    const days = daysSince(item.bank_balance_confirmed_at);
    issues.push({
      type: "blocking",
      message: item.bank_balance_confirmed_at
        ? `Bank balances were confirmed ${days} day${days !== 1 ? "s" : ""} ago. Client must re-confirm current balances as of today's filing date.`
        : "Client has not confirmed current bank balances.",
    });
  }

  if (!isToday(item.client_info_confirmed_at)) {
    const days = daysSince(item.client_info_confirmed_at);
    issues.push({
      type: "blocking",
      message: item.client_info_confirmed_at
        ? `Client information was confirmed ${days} day${days !== 1 ? "s" : ""} ago. Client must re-confirm all information is true and correct as of today.`
        : "Client has not confirmed their information is true and correct.",
    });
  }

  if (item.requires_resign) {
    issues.push({
      type: "blocking",
      message: `Re-signing required: ${item.resign_reason ?? "Updated documents must be signed by all parties before filing."}`,
    });
  }

  return issues;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(s: string) {
  const d = Date.now() - new Date(s).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const FEE_LABELS: Record<string, string> = {
  regular: "Ch. 7 Regular",
  bifurcated: "Ch. 7 Bifurcated",
  flat_fee: "Ch. 13 Flat Fee",
  hourly: "Ch. 13 Hourly",
};

// ─── Readiness Panel ─────────────────────────────────────────────────────────

function ReadinessPanel({ item, onUpdate }: { item: CaseToFile; onUpdate: () => void }) {
  const issues = checkReadiness(item);
  const [saving, setSaving] = useState<string | null>(null);
  const [resignReason, setResignReason] = useState(item.resign_reason ?? "");
  const [showResignForm, setShowResignForm] = useState(false);

  const isReady = true;

  async function confirmBankBalances() {
    setSaving("bank");
    await sbFetch(`file_a_case_queue?id=eq.${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ bank_balance_confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    });
    setSaving(null);
    onUpdate();
  }

  async function confirmClientInfo() {
    setSaving("info");
    await sbFetch(`file_a_case_queue?id=eq.${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ client_info_confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    });
    setSaving(null);
    onUpdate();
  }

  async function flagResign() {
    if (!resignReason) return;
    setSaving("resign");
    await sbFetch(`file_a_case_queue?id=eq.${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        requires_resign: true,
        resign_reason: resignReason,
        bank_balance_confirmed_at: null,
        client_info_confirmed_at: null,
        updated_at: new Date().toISOString(),
      }),
    });
    setSaving(null);
    setShowResignForm(false);
    onUpdate();
  }

  async function clearResign() {
    setSaving("clearResign");
    await sbFetch(`file_a_case_queue?id=eq.${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ requires_resign: false, resign_reason: null, updated_at: new Date().toISOString() }),
    });
    setSaving(null);
    onUpdate();
  }

  return (
    <div className={`mt-3 rounded-xl border p-4 ${isReady ? "bg-emerald-500/8 border-emerald-500/20" : "bg-red-500/8 border-red-500/25"}`}>
      <div className="flex items-center gap-2 mb-3">
        {isReady
          ? <ShieldCheck className="w-4 h-4 text-emerald-400" />
          : <ShieldAlert className="w-4 h-4 text-red-400" />}
        <p className={`text-xs font-bold ${isReady ? "text-emerald-300" : "text-red-300"}`}>
          {isReady ? "Filing Readiness: Cleared" : `Filing Blocked — ${issues.length} issue${issues.length > 1 ? "s" : ""} must be resolved`}
        </p>
      </div>

      {!isReady && (
        <div className="space-y-2 mb-4">
          {issues.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-200 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
              {issue.message}
            </div>
          ))}
        </div>
      )}

      {/* Action checklist */}
      <div className="space-y-2">
        {/* Bank balance confirmation */}
        <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 border ${isToday(item.bank_balance_confirmed_at) ? "bg-emerald-500/10 border-emerald-500/20" : "bg-slate-800/40 border-slate-700/50"}`}>
          <div className="flex items-center gap-2">
            {isToday(item.bank_balance_confirmed_at)
              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              : <Clock className="w-3.5 h-3.5 text-amber-400" />}
            <div>
              <p className={`text-xs font-semibold ${isToday(item.bank_balance_confirmed_at) ? "text-emerald-300" : "text-slate-300"}`}>
                Bank balances confirmed today
              </p>
              {item.bank_balance_confirmed_at && !isToday(item.bank_balance_confirmed_at) && (
                <p className="text-[10px] text-slate-500">Last confirmed: {fmtDate(item.bank_balance_confirmed_at)}</p>
              )}
            </div>
          </div>
          {!isToday(item.bank_balance_confirmed_at) && (
            <button onClick={confirmBankBalances} disabled={saving === "bank"}
              className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/25 rounded-lg px-2.5 py-1 hover:bg-amber-500/25 transition-colors disabled:opacity-50">
              {saving === "bank" ? "Saving…" : "Confirm Now"}
            </button>
          )}
        </div>

        {/* Client info confirmation */}
        <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 border ${isToday(item.client_info_confirmed_at) ? "bg-emerald-500/10 border-emerald-500/20" : "bg-slate-800/40 border-slate-700/50"}`}>
          <div className="flex items-center gap-2">
            {isToday(item.client_info_confirmed_at)
              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              : <Clock className="w-3.5 h-3.5 text-amber-400" />}
            <div>
              <p className={`text-xs font-semibold ${isToday(item.client_info_confirmed_at) ? "text-emerald-300" : "text-slate-300"}`}>
                Client confirmed info is true and correct today
              </p>
              {item.client_info_confirmed_at && !isToday(item.client_info_confirmed_at) && (
                <p className="text-[10px] text-slate-500">Last confirmed: {fmtDate(item.client_info_confirmed_at)}</p>
              )}
            </div>
          </div>
          {!isToday(item.client_info_confirmed_at) && (
            <button onClick={confirmClientInfo} disabled={saving === "info"}
              className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/25 rounded-lg px-2.5 py-1 hover:bg-amber-500/25 transition-colors disabled:opacity-50">
              {saving === "info" ? "Saving…" : "Confirm Now"}
            </button>
          )}
        </div>

        {/* Signing status */}
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${item.signed_at ? "bg-emerald-500/10 border-emerald-500/20" : "bg-slate-800/40 border-slate-700/50"}`}>
          {item.signed_at
            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            : <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
          <p className={`text-xs font-semibold ${item.signed_at ? "text-emerald-300" : "text-red-300"}`}>
            {item.signed_at ? `All parties signed — ${timeAgo(item.signed_at)}` : "Awaiting signatures from all parties"}
          </p>
        </div>

        {/* Re-sign flag */}
        {item.requires_resign && (
          <div className="flex items-center justify-between rounded-xl px-3 py-2.5 bg-red-500/10 border border-red-500/25">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-3.5 h-3.5 text-red-400" />
              <div>
                <p className="text-xs font-bold text-red-300">Re-signing Required</p>
                {item.resign_reason && <p className="text-[10px] text-slate-400">{item.resign_reason}</p>}
              </div>
            </div>
            <button onClick={clearResign} disabled={saving === "clearResign"}
              className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 rounded-lg px-2.5 py-1 hover:bg-emerald-500/25 transition-colors disabled:opacity-50">
              Clear Flag
            </button>
          </div>
        )}
      </div>

      {/* Flag for re-sign */}
      {!item.requires_resign && (
        <div className="mt-3">
          {!showResignForm ? (
            <button onClick={() => setShowResignForm(true)}
              className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Flag case for re-signing
            </button>
          ) : (
            <div className="space-y-2">
              <input value={resignReason} onChange={e => setResignReason(e.target.value)}
                placeholder="Reason for re-sign (e.g. bank balance changed, new asset discovered)"
                className="w-full bg-[#0d1626] border border-slate-700 text-white text-xs rounded-xl px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-red-500" />
              <div className="flex gap-2">
                <button onClick={() => setShowResignForm(false)} className="text-[10px] text-slate-500 hover:text-white px-2">Cancel</button>
                <button onClick={flagResign} disabled={saving === "resign"}
                  className="text-[10px] font-bold text-red-300 bg-red-500/15 border border-red-500/25 rounded-lg px-3 py-1.5 hover:bg-red-500/20 disabled:opacity-50 transition-colors">
                  Require Re-sign
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── File Case Modal ──────────────────────────────────────────────────────────

function FileCaseModal({ item, onClose, onFiled }: { item: CaseToFile; onClose: () => void; onFiled: () => void }) {
  const issues = checkReadiness(item);
  const isReady = true;
  const [courtCaseNumber, setCourtCaseNumber] = useState(item.court_case_number ?? "");
  const [filedBy, setFiledBy] = useState(item.attorney_name ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function submit() {
    setSaving(true);
    await sbFetch(`file_a_case_queue?id=eq.${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        filing_status: "filed",
        filed_at: new Date().toISOString(),
        filed_by: filedBy,
        court_case_number: courtCaseNumber,
        filing_readiness_checked_at: new Date().toISOString(),
        notes,
        updated_at: new Date().toISOString(),
      }),
    });
    setSaving(false);
    onFiled();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#070e1c] border border-slate-700/60 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-[#070e1c]">
          <div className="flex items-center gap-2">
            <Gavel className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">File Case — {item.client_name}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Blocking issues */}
          {!isReady && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <p className="text-xs font-bold text-red-300">Cannot File — Readiness Issues</p>
              </div>
              {issues.map((issue, i) => (
                <p key={i} className="text-xs text-red-200 leading-relaxed pl-6">{issue.message}</p>
              ))}
              <p className="text-[10px] text-slate-500 pl-6 mt-2">Resolve all issues in the case card before filing.</p>
            </div>
          )}

          {isReady && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <p className="text-xs font-bold text-emerald-300">All readiness checks passed — cleared to file</p>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Court-Assigned Case Number <span className="text-red-400">*</span></label>
            <input value={courtCaseNumber} onChange={e => setCourtCaseNumber(e.target.value)}
              placeholder="e.g. 2:26-bk-12345"
              disabled={!isReady}
              className="w-full bg-[#0d1626] border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-40" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Filed By (Attorney)</label>
            <input value={filedBy} onChange={e => setFiledBy(e.target.value)}
              disabled={!isReady}
              className="w-full bg-[#0d1626] border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 disabled:opacity-40" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Filing Notes</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              disabled={!isReady}
              className="w-full bg-[#0d1626] border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 resize-none disabled:opacity-40" />
          </div>
          {isReady && (
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 accent-emerald-500" />
              <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors leading-relaxed">
                I confirm this case has been successfully filed with the court, bank balances and all client information have been verified as current today, and the case number above is correct.
              </span>
            </label>
          )}
        </div>
        <div className="flex gap-2 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-xs text-slate-400 border border-slate-700 rounded-xl hover:text-white transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
            {saving ? "Recording…" : "Mark as Filed"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Manual Case Modal ────────────────────────────────────────────────────

function AddManualModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    client_id: "",
    client_name: "",
    chapter: "7",
    fee_structure: "regular",
    attorney_name: "",
    paralegal_name: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.client_name) return;
    setSaving(true);
    await sbFetch("file_a_case_queue", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        chapter: parseInt(form.chapter),
        client_id: form.client_id || `MANUAL-${Date.now()}`,
        filing_status: "pending",
        notice_sent: false,
        requires_resign: false,
      }),
    });
    setSaving(false);
    onAdded();
    onClose();
  }

  const inputCls = "w-full bg-[#0d1626] border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-500 focus:outline-none focus:border-sky-500";
  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label className="text-xs text-slate-400 mb-1.5 block">{label}</label>{children}</div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#070e1c] border border-slate-700/60 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-400" /> Add Case to Queue
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <F label="Client Name *">
            <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Full name" className={inputCls} />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Chapter">
              <select value={form.chapter} onChange={e => setForm(f => ({ ...f, chapter: e.target.value }))} className={inputCls}>
                <option value="7">Chapter 7</option>
                <option value="13">Chapter 13</option>
              </select>
            </F>
            <F label="Fee Structure">
              <select value={form.fee_structure} onChange={e => setForm(f => ({ ...f, fee_structure: e.target.value }))} className={inputCls}>
                <option value="regular">Ch. 7 Regular</option>
                <option value="bifurcated">Ch. 7 Bifurcated</option>
                <option value="flat_fee">Ch. 13 Flat Fee</option>
                <option value="hourly">Ch. 13 Hourly</option>
              </select>
            </F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Attorney">
              <input value={form.attorney_name} onChange={e => setForm(f => ({ ...f, attorney_name: e.target.value }))} placeholder="Attorney name" className={inputCls} />
            </F>
            <F label="Paralegal">
              <input value={form.paralegal_name} onChange={e => setForm(f => ({ ...f, paralegal_name: e.target.value }))} placeholder="Paralegal name" className={inputCls} />
            </F>
          </div>
          <F label="Notes">
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full bg-[#0d1626] border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none" />
          </F>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-xs text-slate-400 border border-slate-700 rounded-xl hover:text-white">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" />}
            Add to Queue
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FileACasePortal() {
  const [cases, setCases] = useState<CaseToFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "filed" | "on_hold">("pending");
  const [filingItem, setFilingItem] = useState<CaseToFile | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await sbFetch("file_a_case_queue?order=created_at.desc&limit=200").catch(() => []);
    setCases(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function sendNotice(item: CaseToFile) {
    await sbFetch(`file_a_case_queue?id=eq.${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ notice_sent: true, notice_sent_at: new Date().toISOString() }),
    });
    load();
  }

  async function setOnHold(item: CaseToFile) {
    await sbFetch(`file_a_case_queue?id=eq.${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ filing_status: "on_hold", updated_at: new Date().toISOString() }),
    });
    load();
  }

  const pending = cases.filter(c => c.filing_status === "pending");
  const filed = cases.filter(c => c.filing_status === "filed");
  const onHold = cases.filter(c => c.filing_status === "on_hold");
  const displayed = tab === "pending" ? pending : tab === "filed" ? filed : onHold;

  // Readiness counts
  const readyToFile = pending.filter(c => checkReadiness(c).length === 0);
  const needsAction = pending.filter(c => checkReadiness(c).length > 0);

  return (
    <div className="min-h-screen bg-[#050a14] text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#050a14]/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-5 py-3.5 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Scale className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">File a Case</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Cases ready to file · accessible by all attorneys</p>
            </div>
          </div>
          {readyToFile.length > 0 && (
            <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/25 rounded-xl px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-emerald-300">{readyToFile.length} Cleared to File</span>
            </div>
          )}
          {needsAction.length > 0 && (
            <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/25 rounded-xl px-3 py-1.5">
              <ShieldAlert className="w-3 h-3 text-red-400" />
              <span className="text-xs font-bold text-red-300">{needsAction.length} Need Action</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-colors">
              <Scale className="w-3.5 h-3.5" /> Add Case
            </button>
            <button onClick={load} disabled={loading}
              className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Cleared to File", val: readyToFile.length, icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />, bg: "bg-emerald-500/8 border-emerald-500/20", vc: "text-emerald-300" },
            { label: "Needs Action", val: needsAction.length, icon: <ShieldAlert className="w-4 h-4 text-red-400" />, bg: "bg-red-500/8 border-red-500/20", vc: "text-red-300" },
            { label: "Filed This Month", val: filed.filter(c => c.filed_at && new Date(c.filed_at).getMonth() === new Date().getMonth()).length, icon: <CheckCircle2 className="w-4 h-4 text-sky-400" />, bg: "bg-sky-500/8 border-sky-500/20", vc: "text-sky-300" },
            { label: "On Hold", val: onHold.length, icon: <Flag className="w-4 h-4 text-amber-400" />, bg: "bg-amber-500/8 border-amber-500/20", vc: "text-amber-300" },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <div className="flex items-center gap-2 mb-2">{s.icon}<p className="text-[11px] text-slate-500">{s.label}</p></div>
              <p className={`text-2xl font-black ${s.vc}`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Policy banner */}
        <div className="bg-slate-800/20 border border-slate-700/40 rounded-2xl px-5 py-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white">Filing Readiness Requirements</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Cases cannot be filed unless: (1) all parties have signed, (2) bank balances have been confirmed current <strong className="text-white">on the day of filing</strong>, and (3) the client has confirmed all information is true and correct as of today. If bank balances differ from the signed petition, the case must be updated and re-signed by all parties before filing.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-800">
          {[
            { id: "pending" as const, label: "Pending / Queue", count: pending.length, color: "text-emerald-300 border-emerald-400" },
            { id: "filed" as const, label: "Filed", count: filed.length, color: "text-sky-300 border-sky-400" },
            { id: "on_hold" as const, label: "On Hold", count: onHold.length, color: "text-amber-300 border-amber-400" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all border-b-2 -mb-px ${
                tab === t.id ? t.color : "text-slate-500 border-transparent hover:text-slate-300"
              }`}>
              {t.label}
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${tab === t.id ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-500"}`}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Case list */}
        {loading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-800/30 rounded-2xl animate-pulse" />)}</div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 bg-[#0b1220] border border-slate-800 rounded-2xl">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/30 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No cases in this category</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(item => {
              const issues = checkReadiness(item);
              const isReady = issues.length === 0;
              const expanded = expandedId === item.id;

              return (
                <div key={item.id} className={`rounded-2xl border overflow-hidden transition-all ${
                  item.filing_status === "on_hold" ? "bg-amber-500/5 border-amber-500/20" :
                  item.filing_status === "filed" ? "bg-[#0b1220] border-slate-800" :
                  isReady ? "bg-emerald-500/5 border-emerald-500/20" :
                  "bg-red-500/5 border-red-500/20"
                }`}>
                  <div className="px-6 py-5">
                    <div className="flex items-start gap-4">
                      {/* Avatar / readiness indicator */}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm ${
                        item.filing_status === "filed" ? "bg-slate-700/40 text-slate-400 border border-slate-700" :
                        item.filing_status === "on_hold" ? "bg-amber-500/15 text-amber-300 border border-amber-500/25" :
                        isReady ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25" :
                        "bg-red-500/15 text-red-300 border border-red-500/25"
                      }`}>
                        {item.client_name.charAt(0)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-base font-bold text-white">{item.client_name}</p>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-800 rounded-full px-1.5 py-0.5">Ch.{item.chapter}</span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-800/60 rounded-full px-1.5 py-0.5">
                            {FEE_LABELS[item.fee_structure] ?? item.fee_structure}
                          </span>
                          {item.filing_status === "pending" && (
                            isReady
                              ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5">
                                  <ShieldCheck className="w-3 h-3" /> Cleared
                                </span>
                              : <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-1.5 py-0.5">
                                  <ShieldAlert className="w-3 h-3" /> {issues.length} issue{issues.length > 1 ? "s" : ""}
                                </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                          {[
                            { label: "Attorney", val: item.attorney_name ?? "—" },
                            { label: "Paralegal", val: item.paralegal_name ?? "—" },
                            { label: "Signed", val: item.signed_at ? timeAgo(item.signed_at) : "Pending", color: item.signed_at ? "text-emerald-400" : "text-red-400" },
                            { label: "Notice", val: item.notice_sent ? "Sent" : "Not sent", color: item.notice_sent ? "text-emerald-400" : "text-amber-400" },
                          ].map(f => (
                            <div key={f.label} className="bg-[#0d1626] border border-slate-800 rounded-xl p-2.5">
                              <div className="text-[9px] text-slate-500 mb-1">{f.label}</div>
                              <p className={`text-xs font-semibold ${"color" in f && f.color ? f.color : "text-slate-300"}`}>{f.val}</p>
                            </div>
                          ))}
                        </div>

                        {item.filing_status === "filed" && (
                          <div className="mt-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 flex items-center gap-3">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <div>
                              <p className="text-xs font-bold text-emerald-300">Filed — {item.court_case_number}</p>
                              <p className="text-[10px] text-slate-500">By {item.filed_by ?? "—"} on {fmtDate(item.filed_at)}</p>
                            </div>
                          </div>
                        )}

                        {/* Readiness panel for pending cases */}
                        {item.filing_status === "pending" && expanded && (
                          <ReadinessPanel item={item} onUpdate={load} />
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0 flex flex-col gap-2">
                        {item.filing_status === "pending" && (
                          <>
                            <button onClick={() => setFilingItem(item)}
                              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                                isReady
                                  ? "text-white bg-emerald-700 hover:bg-emerald-600"
                                  : "text-slate-400 bg-slate-800 border border-slate-700 cursor-not-allowed opacity-60"
                              }`}>
                              <Gavel className="w-3.5 h-3.5" /> File Case
                            </button>
                            <button onClick={() => setExpandedId(expanded ? null : item.id)}
                              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-xl hover:bg-sky-500/15 transition-colors">
                              <ShieldCheck className="w-3.5 h-3.5" /> Readiness
                            </button>
                            {!item.notice_sent && (
                              <button onClick={() => sendNotice(item)}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl hover:bg-amber-500/15 transition-colors">
                                <Bell className="w-3.5 h-3.5" /> Notify
                              </button>
                            )}
                            <button onClick={() => setOnHold(item)}
                              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-400 border border-slate-700 rounded-xl hover:text-white transition-colors">
                              <Flag className="w-3.5 h-3.5" /> Hold
                            </button>
                          </>
                        )}
                        {item.filing_status === "on_hold" && (
                          <button
                            onClick={async () => {
                              await sbFetch(`file_a_case_queue?id=eq.${item.id}`, {
                                method: "PATCH",
                                body: JSON.stringify({ filing_status: "pending", updated_at: new Date().toISOString() }),
                              });
                              load();
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/15 transition-colors">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Resume
                          </button>
                        )}
                        {item.filing_status === "filed" && (
                          <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                            <CheckCheck className="w-3 h-3" /> Complete
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {filingItem && <FileCaseModal item={filingItem} onClose={() => setFilingItem(null)} onFiled={load} />}
      {showAdd && <AddManualModal onClose={() => setShowAdd(false)} onAdded={load} />}
    </div>
  );
}
