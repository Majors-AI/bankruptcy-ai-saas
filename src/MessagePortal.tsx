import { useState, useEffect, useRef, useCallback } from "react";
import { sendVia } from "./lib/sendGate";
import {
  Send, MessageSquare, Phone, Mail, Video, ChevronDown, ChevronRight,
  CheckCheck, Clock, AlertTriangle, X, Plus, User, FileText, RefreshCw,
  Paperclip, Mic, MessageCircle, Search, Filter, BadgeCheck, Loader,
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  chapter?: string | null;
  status?: string | null;
  state?: string | null;
}

interface MessageThread {
  id: string;
  client_id: string;
  unread_count: number;
  last_message_at: string | null;
  created_at: string;
}

interface Message {
  id: string;
  thread_id: string;
  client_id: string;
  sender_role: string;
  sender_name: string;
  subject: string | null;
  body: string;
  channel: "in_app" | "sms" | "email" | "voice" | "google_meet";
  delivery_status: "pending" | "sent" | "delivered" | "failed";
  delivery_error: string | null;
  external_id: string | null;
  meet_link: string | null;
  related_document: string | null;
  is_internal: boolean;
  sent_at: string | null;
  created_at: string;
}

type Channel = "in_app" | "sms" | "email" | "voice" | "google_meet";

interface Props {
  /** If provided, opens directly to this client's thread */
  preselectedClientId?: string;
  /** Pre-fill a message subject/body (e.g. from missing doc alert) */
  prefilledMessage?: { subject?: string; body?: string; relatedDocument?: string };
  /** Sender identity */
  senderName?: string;
  senderRole?: string;
  onClose?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const CHANNEL_META: Record<Channel, { label: string; icon: JSX.Element; color: string; bg: string }> = {
  in_app:      { label: "In-App",      icon: <MessageCircle className="w-3.5 h-3.5" />, color: "text-slate-400",   bg: "bg-slate-700/40" },
  sms:         { label: "SMS",         icon: <Phone className="w-3.5 h-3.5" />,         color: "text-emerald-400", bg: "bg-emerald-500/10" },
  email:       { label: "Email",       icon: <Mail className="w-3.5 h-3.5" />,          color: "text-sky-400",     bg: "bg-sky-500/10" },
  voice:       { label: "Voice Call",  icon: <Mic className="w-3.5 h-3.5" />,           color: "text-amber-400",   bg: "bg-amber-500/10" },
  google_meet: { label: "Google Meet", icon: <Video className="w-3.5 h-3.5" />,         color: "text-teal-400",    bg: "bg-teal-500/10" },
};

const DELIVERY_META: Record<Message["delivery_status"], { icon: JSX.Element; color: string }> = {
  pending:   { icon: <Clock className="w-3 h-3" />,        color: "text-slate-500" },
  sent:      { icon: <CheckCheck className="w-3 h-3" />,   color: "text-slate-400" },
  delivered: { icon: <BadgeCheck className="w-3 h-3" />,   color: "text-emerald-400" },
  failed:    { icon: <AlertTriangle className="w-3 h-3" />, color: "text-red-400" },
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function sbGet<T>(path: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  return r.ok ? r.json() : [];
}

async function sbPost(table: string, body: object): Promise<{ id: string } | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  return Array.isArray(data) ? data[0] : data;
}

async function sbPatch(table: string, id: string, body: object) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
}

async function autoLogCommunication(opts: {
  clientId: string;
  staffName: string;
  channel: string;
  subject: string | null;
  messageId: string;
  isInternal: boolean;
}) {
  const channelToActivity: Record<string, string> = {
    sms: "phone_call",
    call: "phone_call",
    email: "email",
    google_meet: "email",
    portal: "message",
    message: "message",
  };
  const channelToSource: Record<string, string> = {
    sms: "phone_call",
    call: "phone_call",
    email: "email",
    google_meet: "email",
    portal: "message",
    message: "message",
  };
  const activity = channelToActivity[opts.channel] ?? "message";
  const source   = channelToSource[opts.channel] ?? "message";
  const label    = { sms: "SMS", call: "Phone Call", email: "Email", google_meet: "Video Meeting", portal: "Portal Message", message: "Message" }[opts.channel] ?? "Message";
  const note = opts.isInternal
    ? `[Internal] ${label} sent${opts.subject ? ` — ${opts.subject}` : ""}`
    : `${label} sent to client${opts.subject ? ` — ${opts.subject}` : ""}`;

  try {
    await sbPost("case_time_log", {
      client_id:        opts.clientId,
      staff_name:       opts.staffName,
      staff_role:       null,
      activity_type:    activity,
      duration_minutes: 6,
      duration_units:   0.1,
      billing_rate:     null,
      billable_amount:  null,
      billable:         false,
      notes:            note,
      source_type:      source,
      is_auto_logged:   true,
      communication_id: opts.messageId,
      started_at:       new Date().toISOString(),
    });
  } catch { /* non-blocking */ }
}

// ─── MessagePortal ────────────────────────────────────────────────────────────

export default function MessagePortal({
  preselectedClientId,
  prefilledMessage,
  senderName = "Staff",
  senderRole = "staff",
  onClose,
}: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(preselectedClientId ?? null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);

  // Compose state
  const [channel, setChannel] = useState<Channel>("in_app");
  const [subject, setSubject] = useState(prefilledMessage?.subject ?? "");
  const [body, setBody] = useState(prefilledMessage?.body ?? "");
  const [relatedDoc, setRelatedDoc] = useState(prefilledMessage?.relatedDocument ?? "");
  const [isInternal, setIsInternal] = useState(false);
  const [meetLink, setMeetLink] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedClient = clients.find(c => c.id === selectedClientId) ?? null;
  const activeThread = threads.find(t => t.client_id === selectedClientId) ?? null;
  const threadMessages = messages
    .filter(m => m.client_id === selectedClientId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const filteredClients = clients.filter(c =>
    !search || c.full_name.toLowerCase().includes(search.toLowerCase())
  );

  // Sort clients by last message time (most recent first), then alphabetically
  const sortedClients = [...filteredClients].sort((a, b) => {
    const ta = threads.find(t => t.client_id === a.id)?.last_message_at;
    const tb = threads.find(t => t.client_id === b.id)?.last_message_at;
    if (ta && tb) return new Date(tb).getTime() - new Date(ta).getTime();
    if (ta) return -1;
    if (tb) return 1;
    return a.full_name.localeCompare(b.full_name);
  });

  // ── Load clients ────────────────────────────────────────────────────────────
  const loadClients = useCallback(async () => {
    const [cl, th] = await Promise.all([
      sbGet<Client>("accounting_clients?select=id,full_name,phone,email,chapter,status,state&order=full_name.asc"),
      sbGet<MessageThread>("client_message_threads?order=last_message_at.desc.nullslast"),
    ]);
    setClients(cl);
    setThreads(th);
    setLoading(false);
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  // ── Load messages for selected client ───────────────────────────────────────
  const loadMessages = useCallback(async (clientId: string) => {
    setMsgLoading(true);
    const msgs = await sbGet<Message>(
      `client_messages?client_id=eq.${clientId}&order=created_at.asc`
    );
    setMessages(prev => {
      const otherMsgs = prev.filter(m => m.client_id !== clientId);
      return [...otherMsgs, ...msgs];
    });
    setMsgLoading(false);
  }, []);

  useEffect(() => {
    if (selectedClientId) loadMessages(selectedClientId);
  }, [selectedClientId, loadMessages]);

  // ── Scroll to bottom ─────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadMessages.length]);

  // ── Pre-fill when opened from external context ───────────────────────────────
  useEffect(() => {
    if (prefilledMessage) {
      setSubject(prefilledMessage.subject ?? "");
      setBody(prefilledMessage.body ?? "");
      setRelatedDoc(prefilledMessage.relatedDocument ?? "");
    }
  }, [prefilledMessage]);

  // ── Ensure a thread exists, return its id ───────────────────────────────────
  async function ensureThread(clientId: string): Promise<string> {
    const existing = threads.find(t => t.client_id === clientId);
    if (existing) return existing.id;
    const created = await sbPost("client_message_threads", {
      client_id: clientId,
      unread_count: 0,
      last_message_at: new Date().toISOString(),
    });
    const newThread = created as MessageThread;
    setThreads(prev => [...prev, newThread]);
    return newThread.id;
  }

  // ── Send message ─────────────────────────────────────────────────────────────
  async function handleSend() {
    if (!selectedClientId || !body.trim()) return;
    setSending(true);
    setSendError(null);
    setSendSuccess(false);

    try {
      const threadId = await ensureThread(selectedClientId);

      // Insert pending message record
      const msgRecord = await sbPost("client_messages", {
        thread_id: threadId,
        client_id: selectedClientId,
        sender_role: senderRole,
        sender_name: senderName,
        subject: subject.trim() || null,
        body: body.trim(),
        channel,
        delivery_status: "pending",
        meet_link: channel === "google_meet" ? (meetLink.trim() || null) : null,
        related_document: relatedDoc.trim() || null,
        is_internal: isInternal,
        created_at: new Date().toISOString(),
      }) as Message;

      // Update thread last_message_at
      await sbPatch("client_message_threads", threadId, {
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Route through the consent gate. SMS/voice channels require recorded
      // consent (sms_email_consent === true); the gate will skip + audit-log
      // if no consent or if the lead/client opted out.
      const gateResult = await sendVia(
        "send-client-message",
        {
          messageId: msgRecord.id,
          clientId: selectedClientId,
          clientName: selectedClient?.full_name ?? "",
          clientPhone: selectedClient?.phone,
          clientEmail: selectedClient?.email,
          senderName,
          senderRole,
          subject: subject.trim() || undefined,
          body: body.trim(),
          channel,
          meetLink: channel === "google_meet" ? (meetLink.trim() || undefined) : undefined,
          relatedDocument: relatedDoc.trim() || undefined,
        },
        {
          recipientType: "client",
          clientId: selectedClientId,
          actor: senderName,
          summary: `Staff-to-client ${channel} via MessagePortal`,
        },
      );

      // Reflect the gate result on the local message record so the UI shows
      // whether the send actually went out, was skipped, or failed.
      const skipReasonLabel =
        gateResult.reason === "no_consent" ? "skipped_no_consent" :
        gateResult.reason === "opted_out"  ? "skipped_opt_out" :
        gateResult.reason === "no_recipient_row" ? "skipped_no_recipient" :
        gateResult.reason === "provider_error" ? "failed" :
        null;

      const updatedMsg: Message = {
        ...msgRecord,
        delivery_status: gateResult.sent ? "sent" : (skipReasonLabel ?? "failed"),
        sent_at: new Date().toISOString(),
      };

      if (!gateResult.sent) {
        // Fail-loud, non-blocking toast/alert.
        const msg =
          gateResult.reason === "no_consent" ? "Message not sent — client did not consent to messaging at intake." :
          gateResult.reason === "opted_out"  ? "Message not sent — client opted out of messaging." :
          gateResult.reason === "no_recipient_row" ? "Message not sent — no consent record found for this client." :
          `Message not sent — ${gateResult.reason ?? "provider error"}.`;
        // Non-blocking notification via window.alert (until a proper toast lands).
        if (typeof window !== "undefined") setTimeout(() => window.alert(msg), 0);
      }

      setMessages(prev => {
        const without = prev.filter(m => m.id !== msgRecord.id);
        return [...without, updatedMsg];
      });

      // Update thread list order
      setThreads(prev =>
        prev.map(t => t.id === threadId ? { ...t, last_message_at: new Date().toISOString() } : t)
      );

      // Auto-log communication event to case time log
      autoLogCommunication({
        clientId:   selectedClientId,
        staffName:  senderName,
        channel,
        subject:    subject.trim() || null,
        messageId:  msgRecord.id,
        isInternal,
      });

      // Reset compose
      setBody("");
      setSubject("");
      setRelatedDoc("");
      setMeetLink("");
      setIsInternal(false);
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (err) {
      setSendError("Failed to send message. Please try again.");
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const inp = "w-full bg-slate-800/60 border border-slate-700/60 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors";

  return (
    <div className="flex h-full bg-[#090e1a] text-white overflow-hidden rounded-2xl border border-slate-800">

      {/* ── Left: Client List ──────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-slate-800 flex flex-col">
        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-sky-400" />
              Messages
            </h2>
            {onClose && (
              <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="w-full bg-slate-800/60 border border-slate-700/60 text-white text-xs rounded-xl pl-8 pr-3 py-2 placeholder-slate-600 focus:outline-none focus:border-slate-500"
            />
          </div>
        </div>

        {/* Client list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-5 h-5 text-slate-600 animate-spin" />
            </div>
          ) : sortedClients.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-600">No clients found</div>
          ) : (
            sortedClients.map(client => {
              const thread = threads.find(t => t.client_id === client.id);
              const isActive = selectedClientId === client.id;
              const lastMsg = messages.filter(m => m.client_id === client.id).at(-1);
              return (
                <button
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors ${
                    isActive ? "bg-slate-800/60 border-l-2 border-l-sky-500" : ""
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-700/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white truncate">{client.full_name}</span>
                        {thread?.last_message_at && (
                          <span className="text-[10px] text-slate-600 flex-shrink-0 ml-1">
                            {fmtTime(thread.last_message_at)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {client.chapter && (
                          <span className="text-[10px] text-slate-500">Ch. {client.chapter}</span>
                        )}
                        {client.state && (
                          <span className="text-[10px] text-slate-600">· {client.state}</span>
                        )}
                      </div>
                      {lastMsg && (
                        <p className="text-[10px] text-slate-600 truncate mt-0.5">{lastMsg.body}</p>
                      )}
                    </div>
                    {thread && thread.unread_count > 0 && (
                      <span className="w-4 h-4 rounded-full bg-sky-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                        {thread.unread_count}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: Thread + Compose ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedClient ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/60 flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-slate-600" />
            </div>
            <p className="text-sm font-semibold text-slate-400">Select a client to message</p>
            <p className="text-xs text-slate-600 max-w-xs">Choose a client from the list to view their message history and send new messages via SMS, email, voice call, or Google Meet.</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-slate-700/60 flex items-center justify-center">
                <User className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{selectedClient.full_name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {selectedClient.email && (
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Mail className="w-2.5 h-2.5" />{selectedClient.email}
                    </span>
                  )}
                  {selectedClient.phone && (
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5" />{selectedClient.phone}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => selectedClientId && loadMessages(selectedClientId)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                title="Refresh messages"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {msgLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="w-5 h-5 text-slate-600 animate-spin" />
                </div>
              ) : threadMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-slate-600" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">No messages yet</p>
                  <p className="text-xs text-slate-600">Send a message below to start the conversation.</p>
                </div>
              ) : (
                threadMessages.map(msg => {
                  const ch = CHANNEL_META[msg.channel] ?? CHANNEL_META.in_app;
                  const dl = DELIVERY_META[msg.delivery_status];
                  return (
                    <div key={msg.id} className="group">
                      <div className={`rounded-2xl px-4 py-3 max-w-xl ${
                        msg.is_internal
                          ? "bg-amber-500/8 border border-amber-500/20 border-dashed"
                          : "bg-slate-800/50 border border-slate-700/40"
                      }`}>
                        {/* Message header */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[11px] font-semibold text-slate-300">{msg.sender_name}</span>
                          <span className="text-[10px] text-slate-600 capitalize">{msg.sender_role}</span>
                          <span className="ml-auto flex items-center gap-1.5">
                            <span className={`flex items-center gap-1 text-[10px] font-medium ${ch.color} ${ch.bg} rounded-md px-1.5 py-0.5`}>
                              {ch.icon}{ch.label}
                            </span>
                            {msg.is_internal && (
                              <span className="text-[10px] text-amber-400 bg-amber-500/10 rounded-md px-1.5 py-0.5 font-medium">
                                Internal
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Subject */}
                        {msg.subject && (
                          <p className="text-xs font-semibold text-white mb-1">{msg.subject}</p>
                        )}

                        {/* Body */}
                        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{msg.body}</p>

                        {/* Google Meet link */}
                        {msg.meet_link && (
                          <a
                            href={msg.meet_link}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 flex items-center gap-2 text-xs font-semibold text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-xl px-3 py-2 hover:bg-teal-500/20 transition-colors w-fit"
                          >
                            <Video className="w-3.5 h-3.5" />
                            Join Google Meet
                          </a>
                        )}

                        {/* Related document */}
                        {msg.related_document && (
                          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
                            <FileText className="w-3 h-3" />
                            Re: {msg.related_document}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/30">
                          <span className="text-[10px] text-slate-600">{fmtTime(msg.created_at)}</span>
                          <span className={`flex items-center gap-1 text-[10px] ${dl.color}`}>
                            {dl.icon}
                            <span className="capitalize">{msg.delivery_status}</span>
                            {msg.delivery_error && (
                              <span className="text-red-400 ml-1" title={msg.delivery_error}>(!)</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose area */}
            <div className="border-t border-slate-800 px-5 py-4 flex-shrink-0 space-y-3">
              {/* Channel selector */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(Object.keys(CHANNEL_META) as Channel[]).map(ch => {
                  const meta = CHANNEL_META[ch];
                  const disabled =
                    (ch === "sms" || ch === "voice") && !selectedClient?.phone ||
                    ch === "email" && !selectedClient?.email;
                  return (
                    <button
                      key={ch}
                      onClick={() => !disabled && setChannel(ch)}
                      disabled={!!disabled}
                      title={
                        ch === "sms" || ch === "voice"
                          ? selectedClient?.phone ? "" : "No phone number on file"
                          : ch === "email"
                          ? selectedClient?.email ? "" : "No email on file"
                          : ""
                      }
                      className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border transition-all ${
                        channel === ch
                          ? `${meta.bg} ${meta.color} border-current`
                          : disabled
                          ? "bg-transparent border-slate-800 text-slate-700 cursor-not-allowed"
                          : "bg-transparent border-slate-700/60 text-slate-500 hover:border-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {meta.icon}
                      {meta.label}
                    </button>
                  );
                })}
                <label className="ml-auto flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={e => setIsInternal(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-amber-500"
                  />
                  <span className="text-[11px] text-slate-500 font-medium">Internal note</span>
                </label>
              </div>

              {/* Subject (optional) */}
              {(channel === "email" || channel === "google_meet") && (
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Subject (optional)"
                  className={inp}
                />
              )}

              {/* Google Meet link */}
              {channel === "google_meet" && (
                <input
                  value={meetLink}
                  onChange={e => setMeetLink(e.target.value)}
                  placeholder="Google Meet URL (auto-generated if blank)"
                  className={inp}
                />
              )}

              {/* Related document */}
              <input
                value={relatedDoc}
                onChange={e => setRelatedDoc(e.target.value)}
                placeholder="Related document (optional — e.g. Bank Statement)"
                className={inp}
              />

              {/* Body */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
                  }}
                  placeholder={
                    channel === "voice"
                      ? "Message to read aloud in the call..."
                      : channel === "google_meet"
                      ? "Meeting invitation message..."
                      : "Type your message..."
                  }
                  rows={3}
                  className={`${inp} resize-none pr-12`}
                />
                <button
                  onClick={handleSend}
                  disabled={!body.trim() || sending}
                  className="absolute right-3 bottom-3 w-8 h-8 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
                >
                  {sending ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-600">Cmd+Enter to send</span>
                {sendError && <p className="text-[11px] text-red-400">{sendError}</p>}
                {sendSuccess && (
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <CheckCheck className="w-3 h-3" /> Sent
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Standalone modal wrapper ─────────────────────────────────────────────────

export function MessagePortalModal({
  open,
  onClose,
  preselectedClientId,
  prefilledMessage,
  senderName,
  senderRole,
}: {
  open: boolean;
  onClose: () => void;
  preselectedClientId?: string;
  prefilledMessage?: { subject?: string; body?: string; relatedDocument?: string };
  senderName?: string;
  senderRole?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[80vh] rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <MessagePortal
          preselectedClientId={preselectedClientId}
          prefilledMessage={prefilledMessage}
          senderName={senderName}
          senderRole={senderRole}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
