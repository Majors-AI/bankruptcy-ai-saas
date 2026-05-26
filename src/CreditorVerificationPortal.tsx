import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, Phone, Search, Plus, RefreshCw, X,
  CheckCircle2, AlertTriangle, User, Clock, FileText,
  Scale, AlertCircle, Building2, Hash,
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

interface VerificationLog {
  id: string;
  logged_by: string;
  contact_type: string;
  creditor_name: string | null;
  creditor_company: string | null;
  creditor_phone: string | null;
  account_number_provided: string | null;
  client_name_provided: string;
  client_found: boolean;
  client_id: string | null;
  filing_status_at_time: string | null;
  response_given: string;
  notes: string | null;
  created_at: string;
}

interface AccountingClient {
  id: string;
  client_id: string;
  full_name: string;
  status: string;
  case_number: string | null;
  chapter: number;
  filed_date: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RESPONSE_CFG: Record<string, { label: string; text: string; bg: string; border: string; icon: React.ReactNode }> = {
  confirmed_representation: {
    label: "Representation Confirmed",
    text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  not_in_system: {
    label: "Not in System",
    text: "text-slate-400", bg: "bg-slate-700/20", border: "border-slate-700/40",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  general_notice_provided: {
    label: "General Notice Provided",
    text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/25",
    icon: <Scale className="w-3.5 h-3.5" />,
  },
  automatic_stay_notice: {
    label: "Automatic Stay Notice Given",
    text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
};

const CONTACT_TYPES = ["phone", "email", "fax", "other"];

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ─── Log Contact Modal ────────────────────────────────────────────────────────

function LogContactModal({
  clients,
  onClose,
  onLogged,
}: {
  clients: AccountingClient[];
  onClose: () => void;
  onLogged: () => void;
}) {
  const [step, setStep] = useState<"lookup" | "confirm">("lookup");
  const [clientSearch, setClientSearch] = useState("");
  const [matchedClient, setMatchedClient] = useState<AccountingClient | null>(null);
  const [form, setForm] = useState({
    contact_type: "phone",
    creditor_name: "",
    creditor_company: "",
    creditor_phone: "",
    account_number_provided: "",
    client_name_provided: "",
    logged_by: "Staff",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [searchResult, setSearchResult] = useState<"idle" | "found" | "not_found">("idle");

  function lookupClient() {
    const q = form.client_name_provided.trim().toLowerCase();
    if (!q) return;
    const found = clients.find(c =>
      c.full_name.toLowerCase().includes(q) ||
      (c.client_id && c.client_id.toLowerCase() === q)
    );
    setMatchedClient(found ?? null);
    setSearchResult(found ? "found" : "not_found");
    setStep("confirm");
  }

  function determineResponse(client: AccountingClient | null): string {
    if (!client) return "not_in_system";
    const isFiled = client.filed_date || ["filed", "active", "closed"].includes(client.status);
    if (isFiled) return "automatic_stay_notice";
    return "general_notice_provided";
  }

  async function submit() {
    setSaving(true);
    const response = determineResponse(matchedClient);
    const filingStatus = matchedClient
      ? (matchedClient.filed_date ? "filed" : "not_filed")
      : "unknown";

    await sbFetch("creditor_verification_log", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        client_found: !!matchedClient,
        client_id: matchedClient?.client_id ?? null,
        filing_status_at_time: filingStatus,
        response_given: response,
      }),
    });
    setSaving(false);
    onLogged();
    onClose();
  }

  const inputCls = "w-full bg-[#0d1626] border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-500 focus:outline-none focus:border-sky-500";
  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label className="text-xs text-slate-400 mb-1.5 block">{label}</label>{children}</div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#070e1c] border border-slate-700/60 rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Phone className="w-4 h-4 text-sky-400" /> Log Creditor Contact
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {step === "lookup" && (
          <div className="p-5 space-y-4">
            {/* Compliance notice */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-300">Representation Confirmation Only</p>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  The system can only confirm we represent this client. No case details, balances, or personal information may be disclosed. If filed, advise the automatic stay is in effect.
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Creditor Information</p>
              <div className="grid grid-cols-2 gap-3">
                <F label="Contact Type">
                  <select value={form.contact_type} onChange={e => setForm(f => ({ ...f, contact_type: e.target.value }))}
                    className={inputCls}>
                    {CONTACT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </F>
                <F label="Creditor Phone">
                  <input value={form.creditor_phone} onChange={e => setForm(f => ({ ...f, creditor_phone: e.target.value }))}
                    placeholder="Caller ID / number" className={inputCls} />
                </F>
                <F label="Creditor Name">
                  <input value={form.creditor_name} onChange={e => setForm(f => ({ ...f, creditor_name: e.target.value }))}
                    placeholder="Contact name" className={inputCls} />
                </F>
                <F label="Creditor Company">
                  <input value={form.creditor_company} onChange={e => setForm(f => ({ ...f, creditor_company: e.target.value }))}
                    placeholder="Company / Bank name" className={inputCls} />
                </F>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Client Lookup</p>
              <F label="Client Name Provided by Creditor *">
                <input value={form.client_name_provided} onChange={e => setForm(f => ({ ...f, client_name_provided: e.target.value }))}
                  placeholder="Name the creditor stated" className={inputCls} />
              </F>
              <F label="Account Number (if provided)">
                <input value={form.account_number_provided} onChange={e => setForm(f => ({ ...f, account_number_provided: e.target.value }))}
                  placeholder="Account # they referenced" className={`${inputCls} mt-3`} />
              </F>
            </div>

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 text-xs text-slate-400 border border-slate-700 rounded-xl hover:text-white">Cancel</button>
              <button onClick={lookupClient} disabled={!form.client_name_provided}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5">
                <Search className="w-3.5 h-3.5" /> Look Up Client
              </button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="p-5 space-y-4">
            <button onClick={() => setStep("lookup")} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
              ← Back
            </button>

            {/* Lookup result */}
            {searchResult === "found" && matchedClient ? (
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <p className="text-sm font-bold text-emerald-300">Client Found in System</p>
                </div>
                <p className="text-sm text-white font-semibold">{matchedClient.full_name}</p>
                <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                  <span>ID: {matchedClient.client_id}</span>
                  <span>Ch.{matchedClient.chapter}</span>
                  <span className="capitalize">{matchedClient.status}</span>
                  {matchedClient.case_number && <span>{matchedClient.case_number}</span>}
                </div>
                {matchedClient.filed_date ? (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                    <p className="text-xs font-bold text-amber-300">Case Filed — Automatic Stay in Effect</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Advise creditor: automatic stay is in effect pursuant to 11 U.S.C. § 362. All collection activity must cease.</p>
                  </div>
                ) : (
                  <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl px-3 py-2">
                    <p className="text-xs font-bold text-sky-300">Not Yet Filed</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Confirm representation only. Advise that we will provide notice upon filing.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-700/20 border border-slate-700/40 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-slate-300">Client Not Found</p>
                  <p className="text-xs text-slate-500 mt-0.5">"{form.client_name_provided}" is not in the system. Do not confirm or deny representation.</p>
                </div>
              </div>
            )}

            {/* Script guidance */}
            <div className="bg-[#0d1626] border border-slate-700/50 rounded-xl p-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Suggested Script</p>
              {!matchedClient && (
                <p className="text-xs text-slate-300 leading-relaxed italic">
                  "I'm unable to confirm or deny representation. If you believe we represent this individual, please submit your request in writing."
                </p>
              )}
              {matchedClient && !matchedClient.filed_date && (
                <p className="text-xs text-slate-300 leading-relaxed italic">
                  "Yes, we represent [client name]. We are not able to provide any further details at this time. You will be notified when a case is filed."
                </p>
              )}
              {matchedClient && matchedClient.filed_date && (
                <p className="text-xs text-slate-300 leading-relaxed italic">
                  "Yes, we represent [client name]. A bankruptcy case has been filed. The automatic stay under 11 U.S.C. § 362 is in effect. All collection activity must immediately cease. Further contact should be directed to our office in writing."
                </p>
              )}
            </div>

            <F label="Logged By">
              <input value={form.logged_by} onChange={e => setForm(f => ({ ...f, logged_by: e.target.value }))}
                className={inputCls} />
            </F>
            <F label="Notes">
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional notes about this contact…"
                className="w-full bg-[#0d1626] border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none" />
            </F>

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 text-xs text-slate-400 border border-slate-700 rounded-xl hover:text-white">Cancel</button>
              <button onClick={submit} disabled={saving}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5">
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                {saving ? "Saving…" : "Log Contact"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreditorVerificationPortal() {
  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const [clients, setClients] = useState<AccountingClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [search, setSearch] = useState("");
  const [responseFilter, setResponseFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const [l, c] = await Promise.all([
      sbFetch("creditor_verification_log?order=created_at.desc&limit=200").catch(() => []),
      sbFetch("accounting_clients?select=id,client_id,full_name,status,case_number,chapter,filed_date&order=full_name.asc&limit=500").catch(() => []),
    ]);
    setLogs(l ?? []);
    setClients(c ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter(l => {
    if (responseFilter !== "all" && l.response_given !== responseFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !l.client_name_provided.toLowerCase().includes(q) &&
        !(l.creditor_company ?? "").toLowerCase().includes(q) &&
        !(l.creditor_name ?? "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const confirmedCount = logs.filter(l => l.response_given === "confirmed_representation" || l.response_given === "automatic_stay_notice" || l.response_given === "general_notice_provided").length;
  const notFoundCount = logs.filter(l => l.response_given === "not_in_system").length;
  const todayCount = logs.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length;

  return (
    <div className="min-h-screen bg-[#050a14] text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#050a14]/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-5 py-3.5 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">Creditor Verification</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Log creditor contacts · representation only</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setShowLog(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition-colors">
              <Phone className="w-3.5 h-3.5" /> Log Contact
            </button>
            <button onClick={load} disabled={loading}
              className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-5 space-y-5">
        {/* Policy banner */}
        <div className="bg-slate-800/30 border border-slate-700/40 rounded-2xl px-5 py-4 flex items-start gap-4">
          <ShieldCheck className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-white">Representation Confirmation Policy</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-3xl">
              When a creditor contacts this office, staff may <strong className="text-white">only confirm that we represent the client</strong> — nothing more. If the case is filed, advise that the automatic stay under 11 U.S.C. § 362 is in effect. No account details, balances, filing dates, or case information may be disclosed. All contacts must be logged below.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: "Contacts Today", val: todayCount, icon: <Clock className="w-4 h-4 text-sky-400" />, bg: "bg-sky-500/8 border-sky-500/20", vc: "text-sky-300" },
            { label: "Representation Confirmed", val: confirmedCount, icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, bg: "bg-emerald-500/8 border-emerald-500/20", vc: "text-emerald-300" },
            { label: "Not in System", val: notFoundCount, icon: <AlertTriangle className="w-4 h-4 text-slate-400" />, bg: "bg-slate-700/20 border-slate-700/40", vc: "text-slate-300" },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <div className="flex items-center gap-2 mb-2">{s.icon}<p className="text-[11px] text-slate-500">{s.label}</p></div>
              <p className={`text-2xl font-black ${s.vc}`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client name or creditor…"
              className="w-full bg-[#0b1220] border border-slate-800 text-white text-sm rounded-xl pl-9 pr-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-sky-500/50" />
          </div>
          <select value={responseFilter} onChange={e => setResponseFilter(e.target.value)}
            className="bg-[#0b1220] border border-slate-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none appearance-none">
            <option value="all">All Responses</option>
            <option value="confirmed_representation">Representation Confirmed</option>
            <option value="automatic_stay_notice">Automatic Stay Noticed</option>
            <option value="general_notice_provided">General Notice</option>
            <option value="not_in_system">Not in System</option>
          </select>
        </div>

        {/* Log table */}
        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-800/30 rounded-2xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-[#0b1220] border border-slate-800 rounded-2xl">
            <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No contacts logged yet</p>
            <p className="text-slate-600 text-xs mt-1">Use "Log Contact" to record a creditor call</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(log => {
              const rCfg = RESPONSE_CFG[log.response_given] ?? RESPONSE_CFG.not_in_system;
              return (
                <div key={log.id} className={`flex items-start gap-4 px-5 py-4 rounded-2xl border ${rCfg.bg} ${rCfg.border}`}>
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${rCfg.bg} border ${rCfg.border}`}>
                    <span className={rCfg.text}>{rCfg.icon}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-bold text-white">{log.client_name_provided}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${rCfg.text} ${rCfg.bg} ${rCfg.border}`}>
                        {rCfg.icon} {rCfg.label}
                      </span>
                      <span className="text-[10px] text-slate-500 bg-slate-800 rounded-full px-1.5 py-0.5 capitalize">{log.contact_type}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      {log.creditor_company && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />{log.creditor_company}
                        </span>
                      )}
                      {log.creditor_name && <span><User className="w-3 h-3 inline mr-0.5" />{log.creditor_name}</span>}
                      {log.creditor_phone && <span><Phone className="w-3 h-3 inline mr-0.5" />{log.creditor_phone}</span>}
                      {log.account_number_provided && (
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />{log.account_number_provided}
                        </span>
                      )}
                    </div>
                    {log.notes && <p className="text-xs text-slate-500 mt-1 italic">{log.notes}</p>}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">{fmtDate(log.created_at)}</p>
                    <p className="text-[10px] text-slate-600">{fmtTime(log.created_at)}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">by {log.logged_by}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showLog && <LogContactModal clients={clients} onClose={() => setShowLog(false)} onLogged={load} />}
    </div>
  );
}
