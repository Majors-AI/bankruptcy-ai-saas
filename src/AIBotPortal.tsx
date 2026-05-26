import { useState, useEffect, useCallback } from "react";
import {
  Bot, Plus, RefreshCw, X, Phone, Mail, MessageSquare,
  Users, Clock, CheckCircle2, AlertTriangle, Search,
  ChevronDown, ChevronRight, User, Zap, History,
  ToggleLeft, ToggleRight, FileText, Send, Eye,
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

interface BotDeployment {
  id: string;
  bot_name: string;
  display_name: string;
  channel: string;
  purpose: string;
  system_prompt: string | null;
  greeting_message: string | null;
  is_active: boolean;
  assigned_by: string;
  created_at: string;
  updated_at: string;
}

interface BotAssignment {
  id: string;
  bot_id: string;
  client_id: string;
  client_name: string;
  case_number: string | null;
  assigned_by: string;
  assignment_reason: string | null;
  active_since: string;
  deactivated_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface BotConversation {
  id: string;
  bot_id: string | null;
  client_id: string | null;
  client_name: string;
  channel: string;
  direction: string;
  message_body: string;
  response_body: string | null;
  staff_name: string | null;
  conversation_thread_id: string | null;
  logged_to_time_log: boolean;
  created_at: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CHANNEL_CFG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  phone: { label: "Phone", icon: <Phone className="w-3.5 h-3.5" />, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  email: { label: "Email", icon: <Mail className="w-3.5 h-3.5" />, color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/25" },
  sms:   { label: "SMS", icon: <MessageSquare className="w-3.5 h-3.5" />, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25" },
  dm:    { label: "Direct Message", icon: <MessageSquare className="w-3.5 h-3.5" />, color: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/25" },
  all:   { label: "All Channels", icon: <Zap className="w-3.5 h-3.5" />, color: "text-slate-300", bg: "bg-slate-700/30", border: "border-slate-700" },
  chat:  { label: "Chat", icon: <MessageSquare className="w-3.5 h-3.5" />, color: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/25" },
};

const PURPOSE_LABELS: Record<string, string> = {
  intake_screening: "Intake Screening",
  post_filing_followup: "Post-Filing Follow-Up",
  creditor_response: "Creditor Response",
  general_support: "General Support",
  collections: "Collections",
  document_reminder: "Document Reminder",
  hearing_reminder: "Hearing Reminder",
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(s: string) {
  return new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ─── New Bot Modal ────────────────────────────────────────────────────────────

function NewBotModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    display_name: "",
    bot_name: "",
    channel: "sms",
    purpose: "general_support",
    greeting_message: "",
    system_prompt: "",
    assigned_by: "Admin",
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.display_name) return;
    setSaving(true);
    await sbFetch("bot_deployments", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        bot_name: form.bot_name || form.display_name.toLowerCase().replace(/\s+/g, "_"),
        is_active: true,
      }),
    });
    setSaving(false);
    onCreated();
    onClose();
  }

  const inputCls = "w-full bg-[#0d1626] border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-500 focus:outline-none focus:border-sky-500";
  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label className="text-xs text-slate-400 mb-1.5 block">{label}</label>{children}</div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#070e1c] border border-slate-700/60 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-[#070e1c]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Bot className="w-4 h-4 text-sky-400" /> Deploy New Bot
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <F label="Bot Display Name *">
            <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder="e.g. Post-Filing Assistant" className={inputCls} />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Channel">
              <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} className={inputCls}>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="dm">Direct Message</option>
                <option value="all">All Channels</option>
              </select>
            </F>
            <F label="Purpose">
              <select value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} className={inputCls}>
                {Object.entries(PURPOSE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </F>
          </div>
          <F label="Greeting Message">
            <textarea rows={2} value={form.greeting_message} onChange={e => setForm(f => ({ ...f, greeting_message: e.target.value }))}
              placeholder="First message the bot sends or says…"
              className="w-full bg-[#0d1626] border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none" />
          </F>
          <F label="System Prompt / Instructions">
            <textarea rows={4} value={form.system_prompt} onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
              placeholder="Define the bot's behavior, what it can and cannot say, how to handle edge cases…"
              className="w-full bg-[#0d1626] border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none" />
          </F>
          <F label="Deployed By">
            <input value={form.assigned_by} onChange={e => setForm(f => ({ ...f, assigned_by: e.target.value }))} className={inputCls} />
          </F>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-xs text-slate-400 border border-slate-700 rounded-xl hover:text-white">Cancel</button>
          <button onClick={submit} disabled={saving || !form.display_name}
            className="flex-1 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
            Deploy Bot
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Assign Bot Modal ─────────────────────────────────────────────────────────

function AssignBotModal({
  bots,
  onClose,
  onAssigned,
}: {
  bots: BotDeployment[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [form, setForm] = useState({
    bot_id: bots[0]?.id ?? "",
    client_name: "",
    client_id: "",
    case_number: "",
    assigned_by: "Staff",
    assignment_reason: "",
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.bot_id || !form.client_name) return;
    setSaving(true);
    await sbFetch("bot_assignments", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        client_id: form.client_id || `MANUAL-${Date.now()}`,
        is_active: true,
      }),
    });
    setSaving(false);
    onAssigned();
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
            <Users className="w-4 h-4 text-teal-400" /> Assign Bot to Client
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <F label="Bot *">
            <select value={form.bot_id} onChange={e => setForm(f => ({ ...f, bot_id: e.target.value }))} className={inputCls}>
              {bots.filter(b => b.is_active).map(b => (
                <option key={b.id} value={b.id}>{b.display_name} — {b.channel.toUpperCase()}</option>
              ))}
            </select>
          </F>
          <F label="Client Name *">
            <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
              placeholder="Client full name" className={inputCls} />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Client ID">
              <input value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                placeholder="CLT-XXXX" className={inputCls} />
            </F>
            <F label="Case Number">
              <input value={form.case_number} onChange={e => setForm(f => ({ ...f, case_number: e.target.value }))}
                placeholder="24-12345-BK" className={inputCls} />
            </F>
          </div>
          <F label="Assignment Reason">
            <input value={form.assignment_reason} onChange={e => setForm(f => ({ ...f, assignment_reason: e.target.value }))}
              placeholder="e.g. Post-filing document follow-up" className={inputCls} />
          </F>
          <F label="Assigned By">
            <input value={form.assigned_by} onChange={e => setForm(f => ({ ...f, assigned_by: e.target.value }))} className={inputCls} />
          </F>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-xs text-slate-400 border border-slate-700 rounded-xl hover:text-white">Cancel</button>
          <button onClick={submit} disabled={saving || !form.client_name || !form.bot_id}
            className="flex-1 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Log Conversation Modal ───────────────────────────────────────────────────

function LogConversationModal({
  bots,
  onClose,
  onLogged,
}: {
  bots: BotDeployment[];
  onClose: () => void;
  onLogged: () => void;
}) {
  const [form, setForm] = useState({
    bot_id: "",
    client_name: "",
    client_id: "",
    channel: "sms",
    direction: "inbound",
    message_body: "",
    response_body: "",
    staff_name: "",
    conversation_thread_id: "",
  });
  const [logToTimeLog, setLogToTimeLog] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.client_name || !form.message_body) return;
    setSaving(true);

    const convResult = await sbFetch("bot_conversations", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        bot_id: form.bot_id || null,
        client_id: form.client_id || null,
        conversation_thread_id: form.conversation_thread_id || `thread-${Date.now()}`,
        logged_to_time_log: logToTimeLog,
      }),
    });

    // Auto-log to case_time_log
    if (logToTimeLog && form.client_id) {
      const channelToActivity: Record<string, string> = {
        phone: "client_call", email: "email", sms: "sms_thread", dm: "message", chat: "message",
      };
      const summary = `[${form.channel.toUpperCase()}] ${form.staff_name ? `Staff: ${form.staff_name}` : "Bot"} — ${form.message_body.substring(0, 120)}${form.message_body.length > 120 ? "…" : ""}${form.response_body ? ` | Response: ${form.response_body.substring(0, 120)}` : ""}`;
      await sbFetch("case_time_log", {
        method: "POST",
        body: JSON.stringify({
          client_id: form.client_id,
          staff_name: form.staff_name || "Bot",
          activity_type: channelToActivity[form.channel] ?? "message",
          duration_minutes: 1,
          billable: false,
          notes: summary,
          source_type: form.staff_name ? form.channel : "auto",
          is_auto_logged: !form.staff_name,
          reference_id: convResult?.[0]?.id ?? null,
          reference_table: "bot_conversations",
          started_at: new Date().toISOString(),
        }),
      }).catch(() => null);
    }

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
      <div className="bg-[#070e1c] border border-slate-700/60 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-[#070e1c]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" /> Log Conversation
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <F label="Client Name *">
              <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                placeholder="Client full name" className={inputCls} />
            </F>
            <F label="Client ID (for time log)">
              <input value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                placeholder="CLT-XXXX" className={inputCls} />
            </F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Channel">
              <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} className={inputCls}>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="dm">Direct Message</option>
                <option value="chat">Chat</option>
              </select>
            </F>
            <F label="Direction">
              <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))} className={inputCls}>
                <option value="inbound">Inbound (client contacted us)</option>
                <option value="outbound">Outbound (we contacted client)</option>
              </select>
            </F>
          </div>
          <F label="Bot (leave blank if staff)">
            <select value={form.bot_id} onChange={e => setForm(f => ({ ...f, bot_id: e.target.value }))} className={inputCls}>
              <option value="">— Staff / Human —</option>
              {bots.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
            </select>
          </F>
          {!form.bot_id && (
            <F label="Staff Name">
              <input value={form.staff_name} onChange={e => setForm(f => ({ ...f, staff_name: e.target.value }))}
                placeholder="Who handled this?" className={inputCls} />
            </F>
          )}
          <F label="Message / Content Received *">
            <textarea rows={3} value={form.message_body} onChange={e => setForm(f => ({ ...f, message_body: e.target.value }))}
              placeholder="What the client said or the inbound message content…"
              className="w-full bg-[#0d1626] border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none" />
          </F>
          <F label="Response Given">
            <textarea rows={3} value={form.response_body} onChange={e => setForm(f => ({ ...f, response_body: e.target.value }))}
              placeholder="What was said or sent in response…"
              className="w-full bg-[#0d1626] border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none" />
          </F>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input type="checkbox" checked={logToTimeLog} onChange={e => setLogToTimeLog(e.target.checked)} className="accent-emerald-500" />
            <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
              Auto-log to client time log (requires Client ID)
            </span>
          </label>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-xs text-slate-400 border border-slate-700 rounded-xl hover:text-white">Cancel</button>
          <button onClick={submit} disabled={saving || !form.client_name || !form.message_body}
            className="flex-1 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Log Conversation
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Conversation History Modal ───────────────────────────────────────────────

function ConversationHistoryModal({
  conversations,
  bots,
  clientName,
  onClose,
}: {
  conversations: BotConversation[];
  bots: BotDeployment[];
  clientName: string;
  onClose: () => void;
}) {
  const botMap = Object.fromEntries(bots.map(b => [b.id, b]));
  const clientConvs = conversations.filter(c =>
    c.client_name.toLowerCase().includes(clientName.toLowerCase())
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#070e1c] border border-slate-700/60 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-sky-400" /> History — {clientName}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {clientConvs.length === 0 ? (
            <div className="text-center py-10">
              <History className="w-7 h-7 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No conversation history</p>
            </div>
          ) : clientConvs.map(conv => {
            const ch = CHANNEL_CFG[conv.channel] ?? CHANNEL_CFG.sms;
            const bot = conv.bot_id ? botMap[conv.bot_id] : null;
            return (
              <div key={conv.id} className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${ch.color} ${ch.bg} ${ch.border}`}>
                      {ch.icon} {ch.label}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      conv.direction === "inbound"
                        ? "text-sky-400 bg-sky-500/10 border-sky-500/20"
                        : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    }`}>{conv.direction}</span>
                    {bot && <span className="text-[10px] text-slate-400 bg-slate-800 rounded-full px-1.5 py-0.5 flex items-center gap-1"><Bot className="w-2.5 h-2.5" />{bot.display_name}</span>}
                    {conv.staff_name && <span className="text-[10px] text-slate-400 bg-slate-800 rounded-full px-1.5 py-0.5 flex items-center gap-1"><User className="w-2.5 h-2.5" />{conv.staff_name}</span>}
                    {conv.logged_to_time_log && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5">Logged to file</span>}
                  </div>
                  <span className="text-[10px] text-slate-600">{fmtDateTime(conv.created_at)}</span>
                </div>
                <div className="space-y-2">
                  <div className="bg-slate-800/40 rounded-xl px-3 py-2">
                    <p className="text-[9px] text-slate-500 mb-1 uppercase tracking-widest">Message</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{conv.message_body}</p>
                  </div>
                  {conv.response_body && (
                    <div className="bg-sky-500/8 border border-sky-500/15 rounded-xl px-3 py-2">
                      <p className="text-[9px] text-sky-500 mb-1 uppercase tracking-widest">Response</p>
                      <p className="text-xs text-slate-300 leading-relaxed">{conv.response_body}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIBotPortal() {
  const [bots, setBots] = useState<BotDeployment[]>([]);
  const [assignments, setAssignments] = useState<BotAssignment[]>([]);
  const [conversations, setConversations] = useState<BotConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"bots" | "assignments" | "history">("bots");
  const [showNewBot, setShowNewBot] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showLogConv, setShowLogConv] = useState(false);
  const [historyClient, setHistoryClient] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedBotId, setExpandedBotId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [b, a, c] = await Promise.all([
      sbFetch("bot_deployments?order=created_at.desc").catch(() => []),
      sbFetch("bot_assignments?order=created_at.desc&limit=200").catch(() => []),
      sbFetch("bot_conversations?order=created_at.desc&limit=300").catch(() => []),
    ]);
    setBots(b ?? []);
    setAssignments(a ?? []);
    setConversations(c ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleBot(bot: BotDeployment) {
    await sbFetch(`bot_deployments?id=eq.${bot.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: !bot.is_active, updated_at: new Date().toISOString() }),
    });
    load();
  }

  async function deactivateAssignment(a: BotAssignment) {
    await sbFetch(`bot_assignments?id=eq.${a.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: false, deactivated_at: new Date().toISOString() }),
    });
    load();
  }

  const botMap = Object.fromEntries(bots.map(b => [b.id, b]));
  const activeBots = bots.filter(b => b.is_active);
  const activeAssignments = assignments.filter(a => a.is_active);
  const todayConversations = conversations.filter(c => new Date(c.created_at).toDateString() === new Date().toDateString());

  const filteredConversations = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.client_name.toLowerCase().includes(q) || (c.staff_name ?? "").toLowerCase().includes(q) || c.message_body.toLowerCase().includes(q);
  });

  // Group conversations by client for history view
  const clientGroups = Array.from(new Set(conversations.map(c => c.client_name))).map(name => ({
    name,
    count: conversations.filter(c => c.client_name === name).length,
    latest: conversations.filter(c => c.client_name === name)[0],
  })).sort((a, b) => new Date(b.latest?.created_at ?? 0).getTime() - new Date(a.latest?.created_at ?? 0).getTime());

  const TABS = [
    { id: "bots" as const, label: "Bot Deployments", icon: <Bot className="w-3.5 h-3.5" />, count: activeBots.length },
    { id: "assignments" as const, label: "Client Assignments", icon: <Users className="w-3.5 h-3.5" />, count: activeAssignments.length },
    { id: "history" as const, label: "Conversation History", icon: <History className="w-3.5 h-3.5" />, count: todayConversations.length },
  ];

  return (
    <div className="min-h-screen bg-[#050a14] text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#050a14]/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-5 py-3.5 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center">
              <Bot className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">AI Communication Bots</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Deploy · assign · log all client interactions</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setShowLogConv(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-colors">
              <FileText className="w-3.5 h-3.5" /> Log Conversation
            </button>
            <button onClick={() => setShowAssign(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-xl transition-colors">
              <Users className="w-3.5 h-3.5" /> Assign Bot
            </button>
            <button onClick={() => setShowNewBot(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition-colors">
              <Plus className="w-3.5 h-3.5" /> New Bot
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
            { label: "Active Bots", val: activeBots.length, icon: <Bot className="w-4 h-4 text-teal-400" />, bg: "bg-teal-500/8 border-teal-500/20", vc: "text-teal-300" },
            { label: "Active Assignments", val: activeAssignments.length, icon: <Users className="w-4 h-4 text-sky-400" />, bg: "bg-sky-500/8 border-sky-500/20", vc: "text-sky-300" },
            { label: "Conversations Today", val: todayConversations.length, icon: <MessageSquare className="w-4 h-4 text-amber-400" />, bg: "bg-amber-500/8 border-amber-500/20", vc: "text-amber-300" },
            { label: "Logged to Files", val: conversations.filter(c => c.logged_to_time_log).length, icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, bg: "bg-emerald-500/8 border-emerald-500/20", vc: "text-emerald-300" },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <div className="flex items-center gap-2 mb-2">{s.icon}<p className="text-[11px] text-slate-500">{s.label}</p></div>
              <p className={`text-2xl font-black ${s.vc}`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-800">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all border-b-2 -mb-px ${
                tab === t.id ? "text-white border-teal-400" : "text-slate-500 border-transparent hover:text-slate-300"
              }`}>
              {t.icon}{t.label}
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${tab === t.id ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-500"}`}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* ── BOT DEPLOYMENTS ── */}
        {tab === "bots" && (
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-800/30 rounded-2xl animate-pulse" />)}</div>
            ) : bots.length === 0 ? (
              <div className="text-center py-16 bg-[#0b1220] border border-slate-800 rounded-2xl">
                <Bot className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No bots deployed yet</p>
              </div>
            ) : bots.map(bot => {
              const ch = CHANNEL_CFG[bot.channel] ?? CHANNEL_CFG.all;
              const botConvCount = conversations.filter(c => c.bot_id === bot.id).length;
              const botAssignCount = assignments.filter(a => a.bot_id === bot.id && a.is_active).length;
              const expanded = expandedBotId === bot.id;

              return (
                <div key={bot.id} className={`rounded-2xl border overflow-hidden ${bot.is_active ? "bg-[#0b1220] border-slate-800" : "bg-slate-800/10 border-slate-800/50 opacity-60"}`}>
                  <div className="flex items-center gap-4 px-5 py-4 cursor-pointer" onClick={() => setExpandedBotId(expanded ? null : bot.id)}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${ch.bg} ${ch.border}`}>
                      <Bot className={`w-4 h-4 ${ch.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white">{bot.display_name}</p>
                        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${ch.color} ${ch.bg} ${ch.border}`}>
                          {ch.icon} {ch.label}
                        </span>
                        <span className="text-[10px] text-slate-500 bg-slate-800 rounded-full px-1.5 py-0.5">
                          {PURPOSE_LABELS[bot.purpose] ?? bot.purpose}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${bot.is_active ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-slate-400 bg-slate-700/20 border-slate-700"}`}>
                          {bot.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                        <span>{botAssignCount} active assignment{botAssignCount !== 1 ? "s" : ""}</span>
                        <span>·</span>
                        <span>{botConvCount} conversation{botConvCount !== 1 ? "s" : ""}</span>
                        <span>·</span>
                        <span>by {bot.assigned_by}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={e => { e.stopPropagation(); toggleBot(bot); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-xl border transition-colors ${
                          bot.is_active
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15"
                            : "text-slate-400 bg-slate-800 border-slate-700 hover:text-white"
                        }`}>
                        {bot.is_active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                        {bot.is_active ? "Active" : "Off"}
                      </button>
                      <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </div>
                  </div>

                  {expanded && (
                    <div className="px-5 pb-4 pt-0 border-t border-slate-800/60 space-y-3">
                      {bot.greeting_message && (
                        <div className="mt-3">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Greeting</p>
                          <p className="text-xs text-slate-300 italic bg-slate-800/40 rounded-xl px-3 py-2 leading-relaxed">{bot.greeting_message}</p>
                        </div>
                      )}
                      {bot.system_prompt && (
                        <div>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">System Prompt</p>
                          <p className="text-xs text-slate-400 bg-slate-800/40 rounded-xl px-3 py-2 leading-relaxed">{bot.system_prompt}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── CLIENT ASSIGNMENTS ── */}
        {tab === "assignments" && (
          <div className="space-y-3">
            {assignments.length === 0 ? (
              <div className="text-center py-16 bg-[#0b1220] border border-slate-800 rounded-2xl">
                <Users className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No client assignments yet</p>
              </div>
            ) : assignments.map(a => {
              const bot = botMap[a.bot_id];
              const ch = bot ? CHANNEL_CFG[bot.channel] ?? CHANNEL_CFG.all : CHANNEL_CFG.all;
              return (
                <div key={a.id} className={`flex items-center gap-4 px-5 py-4 rounded-2xl border ${a.is_active ? "bg-[#0b1220] border-slate-800" : "bg-slate-800/10 border-slate-800/40 opacity-50"}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${ch.bg} ${ch.border}`}>
                    <Bot className={`w-4 h-4 ${ch.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white">{a.client_name}</p>
                      {a.case_number && <span className="text-[10px] text-slate-400 bg-slate-800 rounded-full px-1.5 py-0.5">{a.case_number}</span>}
                      {bot && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${ch.color} ${ch.bg} ${ch.border}`}>{bot.display_name}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 flex-wrap">
                      {a.assignment_reason && <span>{a.assignment_reason}</span>}
                      <span>· by {a.assigned_by}</span>
                      <span>· since {fmtDate(a.active_since)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setHistoryClient(a.client_name)}
                      className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 transition-colors">
                      <Eye className="w-3 h-3" /> History
                    </button>
                    {a.is_active && (
                      <button onClick={() => deactivateAssignment(a)}
                        className="text-[10px] text-slate-400 hover:text-red-400 transition-colors">
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── CONVERSATION HISTORY ── */}
        {tab === "history" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by client, staff, or message…"
                className="w-full bg-[#0b1220] border border-slate-800 text-white text-sm rounded-xl pl-9 pr-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-teal-500/50" />
            </div>

            {search ? (
              /* Flat filtered results */
              <div className="space-y-2">
                {filteredConversations.slice(0, 50).map(conv => {
                  const ch = CHANNEL_CFG[conv.channel] ?? CHANNEL_CFG.sms;
                  const bot = conv.bot_id ? botMap[conv.bot_id] : null;
                  return (
                    <div key={conv.id} className="flex items-start gap-3 px-5 py-4 bg-[#0b1220] border border-slate-800 rounded-2xl">
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border flex-shrink-0 ${ch.color} ${ch.bg} ${ch.border}`}>
                        {ch.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-xs font-bold text-white">{conv.client_name}</p>
                          {bot && <span className="text-[10px] text-slate-400 flex items-center gap-1"><Bot className="w-2.5 h-2.5" />{bot.display_name}</span>}
                          {conv.staff_name && <span className="text-[10px] text-slate-400 flex items-center gap-1"><User className="w-2.5 h-2.5" />{conv.staff_name}</span>}
                          {conv.logged_to_time_log && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5">in file</span>}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{conv.message_body}</p>
                      </div>
                      <p className="text-[10px] text-slate-600 flex-shrink-0">{fmtDateTime(conv.created_at)}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Grouped by client */
              <div className="space-y-2">
                <p className="text-[10px] text-slate-600 px-1">{clientGroups.length} client{clientGroups.length !== 1 ? "s" : ""} with conversation history</p>
                {clientGroups.map(group => {
                  const latest = group.latest;
                  const ch = latest ? CHANNEL_CFG[latest.channel] ?? CHANNEL_CFG.sms : CHANNEL_CFG.sms;
                  return (
                    <div key={group.name}
                      onClick={() => setHistoryClient(group.name)}
                      className="flex items-center gap-4 px-5 py-4 bg-[#0b1220] border border-slate-800 rounded-2xl hover:border-slate-700 hover:bg-slate-800/20 transition-all cursor-pointer group">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border font-black text-sm ${ch.bg} ${ch.border} ${ch.color}`}>
                        {group.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors">{group.name}</p>
                        {latest && <p className="text-xs text-slate-500 truncate mt-0.5">{latest.message_body}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-slate-400">{group.count} msg{group.count !== 1 ? "s" : ""}</p>
                        {latest && <p className="text-[10px] text-slate-600">{fmtDateTime(latest.created_at)}</p>}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-teal-400 transition-colors" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showNewBot && <NewBotModal onClose={() => setShowNewBot(false)} onCreated={load} />}
      {showAssign && <AssignBotModal bots={bots} onClose={() => setShowAssign(false)} onAssigned={load} />}
      {showLogConv && <LogConversationModal bots={bots} onClose={() => setShowLogConv(false)} onLogged={load} />}
      {historyClient && (
        <ConversationHistoryModal
          conversations={conversations}
          bots={bots}
          clientName={historyClient}
          onClose={() => setHistoryClient(null)}
        />
      )}
    </div>
  );
}
