// Floating chat — small, fixed-position chat icon that follows the staffer
// across the portal's main views.
//
// Reuses the SAME data the tabbed Messaging panel reads (staff_messages +
// client_message_threads). Does NOT rebuild the Messaging panel — the chat
// window here is a quick read + scaffolded send + an "Open in Messaging"
// route into the canonical surface.
//
// SCAFFOLD pieces:
//   - The chat input + send button are a no-op today; same Twilio /
//     SendGrid TODO as CommsPillBar.
//   - AI draft helper is identical template scaffold (TODO Anthropic API).
//
// NO REAL SENDS. NO DB WRITES. No fake message rows.

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Sparkles, Users, ExternalLink } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  "Content-Type": "application/json",
};

interface StaffMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  channel: "email" | "sms" | "phone_note" | "dm";
  subject: string | null;
  body: string;
  read: boolean;
  created_at: string;
}

export interface FloatingChatProps {
  /** Current staffer session id — used to filter the inbox. */
  currentSessionId: string;
  /** Routes to the canonical tabbed Messaging panel. */
  onOpenMessagingPanel: (view: "messages" | "staff_comms") => void;
}

export default function FloatingChat({
  currentSessionId, onOpenMessagingPanel,
}: FloatingChatProps) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<StaffMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<string>("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Same query the dashboard's Messaging widget uses — limited to unread
  // staff inbox for this session. We re-fetch on open so reopening surfaces
  // anything that arrived since last view (real-time pushes are a TODO).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const r = await fetch(
          `${SUPABASE_URL}/rest/v1/staff_messages?recipient_id=eq.${currentSessionId}&read=eq.false&order=created_at.desc&limit=8`,
          { headers },
        );
        const rows: StaffMessage[] = r.ok ? await r.json() : [];
        if (!cancelled) setMsgs(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [currentSessionId, open]);

  // Close on outside click + Escape (only when open).
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (e.target instanceof Node && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    const t = setTimeout(() => document.addEventListener("mousedown", onClick), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open]);

  const unreadCount = msgs.length;
  const teamCount = msgs.filter(m => m.channel === "phone_note").length;
  const directCount = msgs.filter(m => m.channel === "dm").length;

  return (
    <div
      ref={wrapRef}
      style={{ position: "fixed", right: 20, bottom: 20, zIndex: 45 }}
    >
      {open && (
        <div
          className="rounded-2xl border border-[#2A2A28] bg-[#1A1A18] shadow-2xl mb-2 flex flex-col"
          style={{ width: 320, maxWidth: "92vw", maxHeight: "70vh" }}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2A2A28]">
            <MessageCircle className="w-4 h-4 text-[#B8945F]" />
            <p className="text-xs font-semibold text-[#FAFAF7]">Team chat</p>
            {unreadCount > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700/60">
                {unreadCount}
              </span>
            )}
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-1.5 py-0.5 rounded">
              Scaffold
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="text-[#6B6B66] hover:text-[#FAFAF7]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Channel summary chips */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2A2A28]">
            <button
              onClick={() => onOpenMessagingPanel("staff_comms")}
              className="flex items-center gap-1 text-[10px] font-semibold text-[#FAFAF7] bg-[#2A2A28] px-2 py-0.5 rounded border border-[#3A3A36] hover:border-[#B8945F]/60"
              title="Open Team channels in Messaging"
            >
              <Users className="w-3 h-3" /> Team
              {teamCount > 0 && (
                <span className="ml-1 text-[9px] font-bold px-1 rounded bg-amber-900/40 text-amber-300">{teamCount}</span>
              )}
            </button>
            <button
              onClick={() => onOpenMessagingPanel("staff_comms")}
              className="flex items-center gap-1 text-[10px] font-semibold text-[#FAFAF7] bg-[#2A2A28] px-2 py-0.5 rounded border border-[#3A3A36] hover:border-[#B8945F]/60"
              title="Open Direct messages in Messaging"
            >
              <Send className="w-3 h-3" /> Direct
              {directCount > 0 && (
                <span className="ml-1 text-[9px] font-bold px-1 rounded bg-amber-900/40 text-amber-300">{directCount}</span>
              )}
            </button>
          </div>

          {/* Recent unread (read-only preview). */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {loading ? (
              <p className="text-[11px] text-[#6B6B66] italic text-center py-3">Loading…</p>
            ) : msgs.length === 0 ? (
              <p className="text-[11px] text-[#6B6B66] italic text-center py-3">No unread team or direct messages.</p>
            ) : (
              <ul className="space-y-1">
                {msgs.slice(0, 6).map(m => (
                  <li key={m.id} className="rounded border border-[#2A2A28] bg-[#0F0F0E] px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-semibold text-[#FAFAF7] truncate flex-1">{m.sender_name}</p>
                      <span className="text-[9px] uppercase tracking-widest text-[#6B6B66]">{m.channel}</span>
                    </div>
                    <p className="text-[10px] text-[#6B6B66] mt-0.5 leading-snug line-clamp-2">
                      {m.subject || m.body.slice(0, 80)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick reply scaffold */}
          <div className="border-t border-[#2A2A28] p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#B8945F]" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66]">Quick reply</p>
              <span className="ml-auto text-[9px] text-[#6B6B66] italic">AI draft · Anthropic pending</span>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Type a quick message to the team…"
              className="w-full bg-[#0F0F0E] border border-[#2A2A28] rounded px-2 py-1.5 text-[11px] text-[#FAFAF7] placeholder-[#6B6B66] outline-none focus:border-[#B8945F]/60 leading-snug"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => { setOpen(false); onOpenMessagingPanel("staff_comms"); }}
                className="text-[10px] font-semibold text-[#B8945F] hover:text-[#FAFAF7] inline-flex items-center gap-1"
              >
                Open in Messaging <ExternalLink className="w-3 h-3" />
              </button>
              <button
                disabled
                title="Send — wiring pending"
                className="flex items-center gap-1 text-[10px] font-bold text-[#0F0F0E] bg-[#B8945F]/60 px-2.5 py-1 rounded cursor-not-allowed"
              >
                <Send className="w-3 h-3" /> Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating bubble trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Team chat"
        aria-label="Open team chat"
        className={`relative flex items-center justify-center rounded-full shadow-lg transition-colors ${
          open
            ? "bg-[#2A2A28] text-[#FAFAF7]"
            : "bg-[#B8945F] hover:bg-[#C8A46F] text-[#0F0F0E]"
        }`}
        style={{ width: 48, height: 48 }}
      >
        <MessageCircle className="w-5 h-5" />
        {unreadCount > 0 && !open && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full bg-red-600 text-white border-2 border-[#0F0F0E] px-1"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
