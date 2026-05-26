import { useState, useEffect, useCallback, useRef } from "react";
import {
  Mail,
  MessageSquare,
  Phone,
  MessagesSquare,
  Send,
  Inbox,
  Clock,
  Users,
  Filter,
  ChevronDown,
  X,
  Reply,
  Paperclip,
  CheckCheck,
  Circle,
  Search,
  RefreshCw,
  FileText,
} from "lucide-react";

// ─── Supabase ───────────────────────────────────────────────────────────────
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

// ─── Types ───────────────────────────────────────────────────────────────────
type Channel = "email" | "sms" | "phone_note" | "dm";
type RecipientType = "staff" | "client" | "broadcast";
type InboxTab = "inbox" | "sent" | "all";

interface StaffMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  recipient_type: RecipientType;
  recipient_id: string;
  recipient_name: string;
  channel: Channel;
  subject: string | null;
  body: string;
  attachments: string[];
  read: boolean;
  read_at: string | null;
  thread_id: string;
  created_at: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const STAFF_MEMBERS: StaffMember[] = [
  { id: "STAFF-001", name: "Linda Park", role: "Paralegal" },
  { id: "STAFF-002", name: "Carlos Reyes", role: "Legal Admin" },
  { id: "STAFF-003", name: "Sarah Mitchell", role: "Attorney" },
  { id: "STAFF-004", name: "David Chen", role: "Attorney" },
  { id: "STAFF-005", name: "Maria Lopez", role: "Accounting Admin" },
];

const CHANNEL_CONFIG: Record<
  Channel,
  { label: string; color: string; textColor: string; bgColor: string; borderColor: string; Icon: React.ElementType }
> = {
  email: {
    label: "Email",
    color: "sky",
    textColor: "text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/30",
    Icon: Mail,
  },
  sms: {
    label: "SMS",
    color: "amber",
    textColor: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    Icon: MessageSquare,
  },
  phone_note: {
    label: "Phone Note",
    color: "emerald",
    textColor: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    Icon: Phone,
  },
  dm: {
    label: "Direct Message",
    color: "teal",
    textColor: "text-teal-400",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/30",
    Icon: MessagesSquare,
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateId(): string {
  return crypto.randomUUID();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function avatarColor(name: string): string {
  const colors = [
    "bg-sky-600",
    "bg-violet-600",
    "bg-emerald-600",
    "bg-amber-600",
    "bg-rose-600",
    "bg-teal-600",
    "bg-indigo-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-10 h-10 text-base" : "w-8 h-8 text-sm";
  return (
    <div
      className={`${sizeClass} ${avatarColor(name)} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}
    >
      {getInitials(name)}
    </div>
  );
}

function ChannelBadge({ channel }: { channel: Channel }) {
  const cfg = CHANNEL_CONFIG[channel];
  const { Icon } = cfg;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bgColor} ${cfg.textColor} border ${cfg.borderColor}`}
    >
      <Icon size={9} />
      {cfg.label}
    </span>
  );
}

// ─── Compose Form ─────────────────────────────────────────────────────────────
interface ComposeFormProps {
  currentUser: StaffMember;
  prefillRecipient?: { id: string; name: string; type: RecipientType };
  prefillThreadId?: string;
  prefillSubject?: string;
  onSent: () => void;
  onCancel?: () => void;
}

function ComposeForm({
  currentUser,
  prefillRecipient,
  prefillThreadId,
  prefillSubject,
  onSent,
  onCancel,
}: ComposeFormProps) {
  const [recipientType, setRecipientType] = useState<RecipientType>(prefillRecipient?.type ?? "staff");
  const [recipientId, setRecipientId] = useState(prefillRecipient?.id ?? "");
  const [recipientName, setRecipientName] = useState(prefillRecipient?.name ?? "");
  const [clientName, setClientName] = useState(prefillRecipient?.type === "client" ? (prefillRecipient.name ?? "") : "");
  const [channel, setChannel] = useState<Channel>("dm");
  const [subject, setSubject] = useState(prefillSubject ? `Re: ${prefillSubject}` : "");
  const [body, setBody] = useState("");
  const [logToFile, setLogToFile] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStaff = STAFF_MEMBERS.find((s) => s.id === recipientId);

  async function handleSend() {
    if (!body.trim()) return;
    const finalRecipientName =
      recipientType === "staff" ? (selectedStaff?.name ?? "") : clientName;
    const finalRecipientId =
      recipientType === "staff" ? recipientId : `CLIENT-${clientName.replace(/\s+/g, "-").toUpperCase()}`;

    if (!finalRecipientName && recipientType !== "broadcast") {
      setError("Please select or enter a recipient.");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const threadId = prefillThreadId ?? generateId();
      const payload: Omit<StaffMessage, "id" | "created_at"> = {
        sender_id: currentUser.id,
        sender_name: currentUser.name,
        sender_role: currentUser.role,
        recipient_type: recipientType,
        recipient_id: finalRecipientId,
        recipient_name: finalRecipientName,
        channel,
        subject: channel === "email" ? subject : null,
        body: body.trim(),
        attachments: [],
        read: false,
        read_at: null,
        thread_id: threadId,
      };

      await sbFetch("staff_messages", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Log to case_time_log if checkbox is checked
      if (logToFile && recipientType === "client") {
        const activityMap: Record<Channel, string> = {
          email: "Email",
          sms: "SMS",
          phone_note: "Phone Call",
          dm: "Internal Note",
        };
        try {
          await sbFetch("case_time_log", {
            method: "POST",
            body: JSON.stringify({
              staff_id: currentUser.id,
              staff_name: currentUser.name,
              client_id: finalRecipientId,
              client_name: finalRecipientName,
              activity_type: activityMap[channel],
              description: body.trim(),
              logged_at: new Date().toISOString(),
            }),
          });
        } catch {
          // non-fatal
        }
      }

      setBody("");
      setSubject("");
      onSent();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
        <h3 className="text-sm font-semibold text-slate-200">New Message</h3>
        {onCancel && (
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* From */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 w-16 shrink-0">From</span>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 flex-1">
            <Avatar name={currentUser.name} size="sm" />
            <div>
              <p className="text-xs font-medium text-slate-200">{currentUser.name}</p>
              <p className="text-[10px] text-slate-500">{currentUser.role}</p>
            </div>
          </div>
        </div>

        {/* To: recipient type */}
        <div className="flex items-start gap-3">
          <span className="text-xs text-slate-500 w-16 shrink-0 pt-2">To</span>
          <div className="flex-1 space-y-2">
            <div className="flex gap-1">
              {(["staff", "client"] as RecipientType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setRecipientType(t);
                    setRecipientId("");
                    setRecipientName("");
                    setClientName("");
                  }}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    recipientType === t
                      ? "bg-sky-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {t === "staff" ? "Staff Member" : "Client"}
                </button>
              ))}
            </div>
            {recipientType === "staff" ? (
              <select
                value={recipientId}
                onChange={(e) => {
                  setRecipientId(e.target.value);
                  setRecipientName(STAFF_MEMBERS.find((s) => s.id === e.target.value)?.name ?? "");
                }}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30"
              >
                <option value="">Select staff member...</option>
                {STAFF_MEMBERS.filter((s) => s.id !== currentUser.id).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.role}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Client name..."
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30"
              />
            )}
          </div>
        </div>

        {/* Channel */}
        <div className="flex items-start gap-3">
          <span className="text-xs text-slate-500 w-16 shrink-0 pt-2">Channel</span>
          <div className="flex-1 grid grid-cols-2 gap-1.5">
            {(Object.entries(CHANNEL_CONFIG) as [Channel, typeof CHANNEL_CONFIG[Channel]][]).map(([key, cfg]) => {
              const { Icon } = cfg;
              return (
                <button
                  key={key}
                  onClick={() => setChannel(key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                    channel === key
                      ? `${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor}`
                      : "bg-slate-800/40 text-slate-500 border-slate-700/40 hover:text-slate-300 hover:border-slate-600/60"
                  }`}
                >
                  <Icon size={13} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Subject (email only) */}
        {channel === "email" && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-16 shrink-0">Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Message subject..."
              className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30"
            />
          </div>
        )}

        {/* Body */}
        <div className="flex items-start gap-3">
          <span className="text-xs text-slate-500 w-16 shrink-0 pt-2">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              channel === "phone_note"
                ? "Enter phone call notes..."
                : channel === "sms"
                ? "Type SMS message..."
                : channel === "email"
                ? "Compose your email..."
                : "Type your message..."
            }
            rows={6}
            className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 resize-none"
          />
        </div>

        {/* Log to client file */}
        {recipientType === "client" && (
          <div className="flex items-center gap-3 ml-[76px]">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={logToFile}
                onChange={(e) => setLogToFile(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-sky-500"
              />
              <FileText size={13} className="text-slate-500" />
              <span className="text-xs text-slate-400">Log to Client File (case_time_log)</span>
            </label>
          </div>
        )}

        {error && (
          <div className="ml-[76px] px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400">
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-700/60 flex items-center justify-between">
        <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          <Paperclip size={13} />
          Attach file
        </button>
        <button
          onClick={handleSend}
          disabled={sending || !body.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {sending ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send size={14} />
              Send
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Thread View ──────────────────────────────────────────────────────────────
interface ThreadViewProps {
  messages: StaffMessage[];
  currentUser: StaffMember;
  onReply: (msg: StaffMessage) => void;
  onMarkRead: (id: string) => void;
}

function ThreadView({ messages, currentUser, onReply, onMarkRead }: ThreadViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    messages.forEach((m) => {
      if (!m.read && m.recipient_id === currentUser.id) {
        onMarkRead(m.id);
      }
    });
  }, [messages, currentUser.id, onMarkRead]);

  if (messages.length === 0) return null;

  const first = messages[0];
  const threadTitle = first.subject || `${CHANNEL_CONFIG[first.channel].label} from ${first.sender_name}`;

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="px-5 py-4 border-b border-slate-700/60">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 leading-tight">{threadTitle}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {messages.length} message{messages.length !== 1 ? "s" : ""} · Thread
            </p>
          </div>
          <button
            onClick={() => onReply(messages[messages.length - 1])}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-xs text-slate-300 transition-colors shrink-0"
          >
            <Reply size={12} />
            Reply
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUser.id;
          const cfg = CHANNEL_CONFIG[msg.channel];

          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
              <Avatar name={msg.sender_name} size="md" />
              <div className={`flex flex-col max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                {/* Meta */}
                <div className={`flex items-center gap-2 mb-1 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  <span className="text-xs font-medium text-slate-300">{isMe ? "You" : msg.sender_name}</span>
                  <span className="text-[10px] text-slate-600">{msg.sender_role}</span>
                  <ChannelBadge channel={msg.channel} />
                  <span className="text-[10px] text-slate-600">{formatTime(msg.created_at)}</span>
                </div>
                {/* Bubble */}
                <div
                  className={`px-4 py-3 rounded-2xl border text-sm leading-relaxed ${
                    isMe
                      ? "bg-sky-600/20 border-sky-500/25 text-slate-200 rounded-tr-sm"
                      : "bg-slate-800/40 border-slate-700/50 text-slate-300 rounded-tl-sm"
                  }`}
                >
                  {msg.subject && (
                    <p className="text-xs font-semibold text-slate-400 mb-1">Re: {msg.subject}</p>
                  )}
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                </div>
                {/* Read receipt */}
                {isMe && (
                  <div className="flex items-center gap-1 mt-1">
                    {msg.read ? (
                      <CheckCheck size={11} className={cfg.textColor} />
                    ) : (
                      <Circle size={8} className="text-slate-600 fill-slate-600" />
                    )}
                    <span className="text-[9px] text-slate-600">{msg.read ? "Read" : "Sent"}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─── Inbox Item ───────────────────────────────────────────────────────────────
interface InboxItemProps {
  message: StaffMessage;
  isSelected: boolean;
  currentUserId: string;
  onClick: () => void;
}

function InboxItem({ message, isSelected, currentUserId, onClick }: InboxItemProps) {
  const isUnread = !message.read && message.recipient_id === currentUserId;
  const cfg = CHANNEL_CONFIG[message.channel];
  const { Icon } = cfg;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-lg transition-all border group ${
        isSelected
          ? "bg-sky-600/15 border-sky-500/30"
          : isUnread
          ? "bg-slate-800/50 border-slate-700/40 hover:bg-slate-800/70"
          : "bg-transparent border-transparent hover:bg-slate-800/30 hover:border-slate-700/30"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="relative shrink-0 mt-0.5">
          <Avatar name={message.sender_name} size="sm" />
          {isUnread && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-sky-400 border border-[#050a14]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span
              className={`text-xs font-medium truncate ${
                isUnread ? "text-slate-200" : "text-slate-400"
              }`}
            >
              {message.sender_id === currentUserId ? `To: ${message.recipient_name}` : message.sender_name}
            </span>
            <span className="text-[10px] text-slate-600 shrink-0">{formatTime(message.created_at)}</span>
          </div>
          <p className={`text-xs truncate mt-0.5 ${isUnread ? "text-slate-300 font-medium" : "text-slate-500"}`}>
            {message.subject || message.body}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Icon size={10} className={cfg.textColor} />
            <span className={`text-[10px] ${cfg.textColor}`}>{cfg.label}</span>
            {message.recipient_type === "client" && (
              <span className="text-[10px] text-violet-400 ml-auto">Client</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StaffCommHub() {
  const [currentUser, setCurrentUser] = useState<StaffMember>(STAFF_MEMBERS[0]);
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<InboxTab>("inbox");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState<StaffMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [userSelectorOpen, setUserSelectorOpen] = useState(false);

  // ── Fetch messages ────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const data: StaffMessage[] = await sbFetch(
        "staff_messages?order=created_at.asc&limit=200"
      );
      setMessages(data ?? []);
    } catch {
      // silently fail — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // ── Mark read ─────────────────────────────────────────────────────────────
  const markRead = useCallback(async (id: string) => {
    try {
      await sbFetch(`staff_messages?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ read: true, read_at: new Date().toISOString() }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, read: true, read_at: new Date().toISOString() } : m))
      );
    } catch {
      // non-fatal
    }
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const unreadCount = messages.filter(
    (m) => !m.read && m.recipient_id === currentUser.id
  ).length;

  const filteredMessages = messages.filter((m) => {
    // Tab filter
    if (tab === "inbox" && m.recipient_id !== currentUser.id) return false;
    if (tab === "sent" && m.sender_id !== currentUser.id) return false;
    // Unread only
    if (unreadOnly && (m.read || m.recipient_id !== currentUser.id)) return false;
    // Channel filter
    if (channelFilter !== "all" && m.channel !== channelFilter) return false;
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !m.sender_name.toLowerCase().includes(q) &&
        !m.recipient_name.toLowerCase().includes(q) &&
        !m.body.toLowerCase().includes(q) &&
        !(m.subject ?? "").toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  // De-duplicate to latest message per thread for inbox list
  const threadMap = new Map<string, StaffMessage>();
  filteredMessages.forEach((m) => {
    const existing = threadMap.get(m.thread_id);
    if (!existing || new Date(m.created_at) > new Date(existing.created_at)) {
      threadMap.set(m.thread_id, m);
    }
  });
  const inboxThreads = Array.from(threadMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const selectedMessages = selectedThreadId
    ? messages.filter((m) => m.thread_id === selectedThreadId)
    : [];

  function handleSelectThread(threadId: string) {
    setSelectedThreadId(threadId);
    setShowCompose(false);
    setReplyTo(null);
  }

  function handleCompose() {
    setSelectedThreadId(null);
    setShowCompose(true);
    setReplyTo(null);
  }

  function handleReply(msg: StaffMessage) {
    setReplyTo(msg);
    setShowCompose(true);
    setSelectedThreadId(null);
  }

  function handleSent() {
    fetchMessages();
    setShowCompose(false);
    setReplyTo(null);
  }

  return (
    <div
      className="flex flex-col h-screen bg-[#050a14] text-slate-200 overflow-hidden"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* ── Top Header ──────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-slate-700/50 bg-[#050a14]/90 backdrop-blur-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-600/20 border border-sky-500/30 flex items-center justify-center">
            <MessagesSquare size={16} className="text-sky-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-100">Staff Communications</h1>
            <p className="text-[10px] text-slate-500">Internal hub — all messages logged</p>
          </div>
          {unreadCount > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-sky-600 text-white text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* I am: selector */}
          <div className="relative">
            <button
              onClick={() => setUserSelectorOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:border-slate-600/60 transition-colors text-xs"
            >
              <Avatar name={currentUser.name} size="sm" />
              <div className="text-left hidden sm:block">
                <p className="font-medium text-slate-200 leading-tight">{currentUser.name}</p>
                <p className="text-slate-500 text-[10px]">{currentUser.role}</p>
              </div>
              <ChevronDown size={12} className="text-slate-500" />
            </button>
            {userSelectorOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 rounded-xl bg-slate-900 border border-slate-700/60 shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-700/60">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">I am:</p>
                </div>
                {STAFF_MEMBERS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setCurrentUser(s);
                      setUserSelectorOpen(false);
                      setSelectedThreadId(null);
                      setShowCompose(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-800 transition-colors ${
                      currentUser.id === s.id ? "bg-slate-800/60" : ""
                    }`}
                  >
                    <Avatar name={s.name} size="sm" />
                    <div>
                      <p className="text-xs font-medium text-slate-200">{s.name}</p>
                      <p className="text-[10px] text-slate-500">{s.role}</p>
                    </div>
                    {currentUser.id === s.id && (
                      <CheckCheck size={13} className="text-sky-400 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleCompose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors"
          >
            <Send size={13} />
            Compose
          </button>

          <button
            onClick={fetchMessages}
            className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/40 hover:border-slate-600/60 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Sidebar ─────────────────────────────────────────────── */}
        <aside className="w-[280px] shrink-0 flex flex-col border-r border-slate-700/50 bg-[#060c17]">
          {/* Tabs */}
          <div className="flex border-b border-slate-700/50 px-2 pt-2">
            {([["inbox", "Inbox", Inbox], ["sent", "Sent", Clock], ["all", "All", Users]] as const).map(
              ([value, label, Icon]) => (
                <button
                  key={value}
                  onClick={() => setTab(value)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                    tab === value
                      ? "text-sky-400 border-b-2 border-sky-500 -mb-px"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <Icon size={12} />
                  {label}
                  {value === "inbox" && unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-sky-600 text-white text-[9px] font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>
              )
            )}
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-slate-700/40">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full bg-slate-800/50 border border-slate-700/40 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
              />
            </div>
          </div>

          {/* Quick filters */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/40">
            <button
              onClick={() => setUnreadOnly((v) => !v)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                unreadOnly
                  ? "bg-sky-600/20 text-sky-400 border border-sky-500/30"
                  : "text-slate-500 hover:text-slate-300 border border-transparent"
              }`}
            >
              <Circle size={8} className={unreadOnly ? "fill-sky-400" : ""} />
              Unread
            </button>
            <div className="relative ml-auto">
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value as Channel | "all")}
                className="appearance-none bg-slate-800/50 border border-slate-700/40 rounded px-2 py-1 text-[10px] text-slate-400 pr-5 focus:outline-none focus:border-sky-500/50"
              >
                <option value="all">All channels</option>
                {(Object.entries(CHANNEL_CONFIG) as [Channel, typeof CHANNEL_CONFIG[Channel]][]).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
              <Filter size={9} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {loading && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <RefreshCw size={20} className="animate-spin text-slate-600" />
                <p className="text-xs text-slate-600">Loading messages...</p>
              </div>
            ) : inboxThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Inbox size={28} className="text-slate-700" />
                <p className="text-xs text-slate-600">
                  {searchQuery || unreadOnly || channelFilter !== "all"
                    ? "No messages match filters"
                    : tab === "inbox"
                    ? "Your inbox is empty"
                    : "No messages sent yet"}
                </p>
              </div>
            ) : (
              inboxThreads.map((msg) => (
                <InboxItem
                  key={msg.thread_id}
                  message={msg}
                  isSelected={selectedThreadId === msg.thread_id}
                  currentUserId={currentUser.id}
                  onClick={() => handleSelectThread(msg.thread_id)}
                />
              ))
            )}
          </div>
        </aside>

        {/* ── Right Panel ──────────────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {showCompose ? (
            <ComposeForm
              currentUser={currentUser}
              prefillRecipient={
                replyTo
                  ? {
                      id: replyTo.sender_id === currentUser.id ? replyTo.recipient_id : replyTo.sender_id,
                      name: replyTo.sender_id === currentUser.id ? replyTo.recipient_name : replyTo.sender_name,
                      type: replyTo.recipient_type,
                    }
                  : undefined
              }
              prefillThreadId={replyTo?.thread_id}
              prefillSubject={replyTo?.subject ?? undefined}
              onSent={handleSent}
              onCancel={() => {
                setShowCompose(false);
                setReplyTo(null);
              }}
            />
          ) : selectedThreadId && selectedMessages.length > 0 ? (
            <ThreadView
              messages={selectedMessages}
              currentUser={currentUser}
              onReply={handleReply}
              onMarkRead={markRead}
            />
          ) : (
            /* Empty / welcome state */
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-sky-600/10 border border-sky-500/20 flex items-center justify-center">
                <MessagesSquare size={32} className="text-sky-500/60" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-400">Staff Communications Hub</h2>
                <p className="text-sm text-slate-600 mt-1 max-w-xs">
                  Select a conversation from the sidebar or compose a new message to get started.
                </p>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleCompose}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium transition-colors"
                >
                  <Send size={14} />
                  Compose Message
                </button>
              </div>
              {/* Channel legend */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                {(Object.entries(CHANNEL_CONFIG) as [Channel, typeof CHANNEL_CONFIG[Channel]][]).map(([key, cfg]) => {
                  const { Icon } = cfg;
                  return (
                    <span
                      key={key}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${cfg.bgColor} ${cfg.textColor} border ${cfg.borderColor}`}
                    >
                      <Icon size={11} />
                      {cfg.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Click-away to close user selector */}
      {userSelectorOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setUserSelectorOpen(false)} />
      )}
    </div>
  );
}
