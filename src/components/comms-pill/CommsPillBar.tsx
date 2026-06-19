// Comms pill bar + quick-reply popover.
//
// Single oval/pill UI in the dashboard header that surfaces unread counts
// across every comms channel the tabbed Messaging panel already knows about,
// plus a tasks-due indicator. Clicking an icon with new messages opens a
// SMALL popover that:
//   - shows the latest 1-3 unread items for that channel,
//   - pre-fills an AI-generated draft (scaffold; see TODO below),
//   - exposes a Send button that's currently a no-op,
//   - links out to the full Messaging panel ("Open in Messaging") which
//     remains the single canonical surface — this pill bar does NOT rebuild
//     it, it just routes faster paths through the same data.
//
// DATA SOURCES (no fabricated rows):
//   - SMS / Email / Team / Direct  → staffMsgs filtered by channel
//                                    PLUS client threads where the latest
//                                    message channel matches (sms/email)
//   - Phone                        → voicemail callbacks today are SCAFFOLD;
//                                    the dialer popover handles outbound
//   - Dept email                   → SCAFFOLD — no department-mailbox source
//                                    yet (shared Microsoft 365 inbox via
//                                    Graph is the planned wiring)
//   - Tasks due                    → sharedTasksCount passed in by the
//                                    dashboard (same shared-pool count
//                                    Bubble 2 / AllTasksWidget use)
//
// TODO Phase B — what's needed to flip the scaffold pieces real:
//   1. Anthropic API integration for AI drafts (rate-limited; per-firm key;
//      the draft endpoint passes the message body + channel + lead context
//      and asks for a 2–3 sentence reply in the firm's voice).
//   2. Twilio SMS dispatch + delivery callback for the Send button on SMS.
//   3. SendGrid email dispatch + open/click tracking for Send on Email.
//   4. A fax service (Documo/Phaxio/eFax) for "fax" — out of scope today;
//      icon NOT included in this v0 pill because no inbound source exists
//      to drive a badge. Add when fax inbound lands.
//   5. Microsoft Graph for the firm's shared mailbox → drives dept-email
//      badge + the "Open" popover content for that icon.
//   6. Voicemails (Twilio voice inbound + voicemails table) → drives the
//      Phone icon's badge.
//
// NO REAL SENDS. NO DB WRITES. No fake message rows.

import { useEffect, useRef, useState } from "react";
import {
  Phone, MessageSquare, Mail, Users, Send, AtSign, BellRing,
  X, Sparkles, ExternalLink,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CommsStaffMessage {
  id: string;
  sender_name: string;
  channel: "email" | "sms" | "phone_note" | "dm";
  subject: string | null;
  body: string;
  created_at: string;
  read: boolean;
}

export interface CommsClientThread {
  id: string;
  client_name?: string;
  preview?: string;
  unread_count: number;
  last_message_at: string | null;
  last_channel?: string | null;
}

export interface CommsPillBarProps {
  /** Pulled from the same fetch the Messaging panel uses — no second source. */
  staffMsgs: CommsStaffMessage[];
  clientThreads: CommsClientThread[];
  /** Total tasks in the shared pool — feeds the tasks-due indicator. */
  sharedTasksCount: number;
  /** Routes to the existing Messaging panel; same callback the dashboard already passes around. */
  onOpenMessagingPanel: (view: "messages" | "staff_comms") => void;
  /** Opens the existing PhoneDialerPopover; the phone icon piggybacks on it. */
  onOpenPhoneDialer: () => void;
  /** Optional: route to the tasks list (e.g. scroll/focus the AllTasksWidget). */
  onOpenTasks?: () => void;
  className?: string;
  /**
   * Prompt 89 — backward-compatible icon scale. Defaults to "sm" (the
   * original 14px glyphs on a 28px button). The Intake ClockHub passes
   * "lg" to surface the phone + message icons more prominently per the
   * Prompt-89 brief. Other consumers (AttorneyIntakeDashboard,
   * FloatingChat) keep the default "sm" unchanged.
   */
  size?: "sm" | "lg";
}

type ChannelKey = "phone" | "sms" | "email" | "team" | "direct" | "dept" | "tasks";

// ─── Component ───────────────────────────────────────────────────────────────

export default function CommsPillBar({
  staffMsgs, clientThreads, sharedTasksCount,
  onOpenMessagingPanel, onOpenPhoneDialer, onOpenTasks,
  className = "", size = "sm",
}: CommsPillBarProps) {
  // Prompt 89 — size knob. Class strings are extracted so a single source
  // of truth controls the icon glyph + the button container together.
  const iconCls = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";
  const buttonSizeCls = size === "lg" ? "w-10 h-10" : "w-7 h-7";
  const dividerCls = size === "lg" ? "w-px h-6 bg-[#2A2A28] mx-1" : "w-px h-4 bg-[#2A2A28] mx-0.5";
  const containerCls = size === "lg" ? "px-2.5 py-1.5 gap-1.5" : "px-2 py-1 gap-1";
  const [open, setOpen] = useState<ChannelKey | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (e.target instanceof Node && !wrapRef.current.contains(e.target)) setOpen(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(null); }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // ── Counts — all derived from the SAME data the Messaging panel uses ────
  const smsStaff   = staffMsgs.filter(m => !m.read && m.channel === "sms");
  const emailStaff = staffMsgs.filter(m => !m.read && m.channel === "email");
  const teamStaff  = staffMsgs.filter(m => !m.read && m.channel === "phone_note");
  const directStaff= staffMsgs.filter(m => !m.read && m.channel === "dm");

  const smsClient   = clientThreads.filter(t => (t.unread_count ?? 0) > 0 && (t.last_channel ?? "").toLowerCase() === "sms");
  const emailClient = clientThreads.filter(t => (t.unread_count ?? 0) > 0 && (t.last_channel ?? "").toLowerCase() === "email");

  const smsCount    = smsStaff.length   + smsClient.reduce((s, t) => s + (t.unread_count ?? 0), 0);
  const emailCount  = emailStaff.length + emailClient.reduce((s, t) => s + (t.unread_count ?? 0), 0);
  const teamCount   = teamStaff.length;
  const directCount = directStaff.length;

  // SCAFFOLD: no data source today.
  const phoneCount = 0;
  const deptCount  = 0;

  return (
    <div ref={wrapRef} className={`relative inline-block ${className}`}>
      <div className={`inline-flex items-center rounded-full border border-[#2A2A28] bg-[#1A1A18] ${containerCls}`}>
        <PillIconButton
          icon={<Phone className={iconCls} />}
          label="Phone / voicemails"
          count={phoneCount}
          active={open === "phone"}
          onClick={() => { setOpen(null); onOpenPhoneDialer(); }}
          sizeCls={buttonSizeCls}
        />
        <PillIconButton
          icon={<MessageSquare className={iconCls} />}
          label="SMS"
          count={smsCount}
          active={open === "sms"}
          onClick={() => setOpen(open === "sms" ? null : "sms")}
          sizeCls={buttonSizeCls}
        />
        <PillIconButton
          icon={<Mail className={iconCls} />}
          label="Email"
          count={emailCount}
          active={open === "email"}
          onClick={() => setOpen(open === "email" ? null : "email")}
          sizeCls={buttonSizeCls}
        />
        <PillIconButton
          icon={<Users className={iconCls} />}
          label="Team chat"
          count={teamCount}
          active={open === "team"}
          onClick={() => setOpen(open === "team" ? null : "team")}
          sizeCls={buttonSizeCls}
        />
        <PillIconButton
          icon={<Send className={iconCls} />}
          label="Direct"
          count={directCount}
          active={open === "direct"}
          onClick={() => setOpen(open === "direct" ? null : "direct")}
          sizeCls={buttonSizeCls}
        />
        <PillIconButton
          icon={<AtSign className={iconCls} />}
          label="Department email"
          count={deptCount}
          active={open === "dept"}
          onClick={() => setOpen(open === "dept" ? null : "dept")}
          sizeCls={buttonSizeCls}
        />
        {/* Divider — tasks indicator sits visually apart from comms. */}
        <span className={dividerCls} aria-hidden="true" />
        <PillIconButton
          icon={<BellRing className={iconCls} />}
          label="Tasks due"
          count={sharedTasksCount}
          tone="amber"
          active={open === "tasks"}
          sizeCls={buttonSizeCls}
          onClick={() => {
            if (onOpenTasks) onOpenTasks();
            setOpen(null);
          }}
        />
      </div>

      {/* Quick-reply popover */}
      {open && open !== "phone" && open !== "tasks" && (
        <QuickReplyPopover
          channel={open}
          smsStaff={smsStaff}
          emailStaff={emailStaff}
          teamStaff={teamStaff}
          directStaff={directStaff}
          smsClient={smsClient}
          emailClient={emailClient}
          onClose={() => setOpen(null)}
          onOpenInMessaging={(view) => { setOpen(null); onOpenMessagingPanel(view); }}
        />
      )}
    </div>
  );
}

// ─── Pill icon button ────────────────────────────────────────────────────────

function PillIconButton({
  icon, label, count, active, onClick, tone = "default", sizeCls = "w-7 h-7",
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: "default" | "amber";
  /** Tailwind size classes — defaults to the small button. Prompt 89's
   *  ClockHub passes "w-10 h-10" via CommsPillBar's `size="lg"`. */
  sizeCls?: string;
}) {
  const hasCount = count > 0;
  const badgeCls =
    tone === "amber"
      ? "bg-amber-900/60 text-amber-200 border border-amber-700/70"
      : "bg-[#B8945F] text-[#0F0F0E]";
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`relative flex items-center justify-center rounded-full transition-colors ${sizeCls} ${
        active
          ? "bg-[#2A2A28] text-[#FAFAF7]"
          : hasCount
            ? "text-[#FAFAF7] hover:bg-[#2A2A28]"
            : "text-[#6B6B66] hover:bg-[#2A2A28] hover:text-[#FAFAF7]"
      }`}
    >
      {icon}
      {hasCount && (
        <span
          className={`absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center text-[9px] font-bold rounded-full px-1 ${badgeCls}`}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

// ─── QuickReplyPopover ───────────────────────────────────────────────────────

function QuickReplyPopover({
  channel, smsStaff, emailStaff, teamStaff, directStaff, smsClient, emailClient,
  onClose, onOpenInMessaging,
}: {
  channel: Exclude<ChannelKey, "phone" | "tasks">;
  smsStaff: CommsStaffMessage[];
  emailStaff: CommsStaffMessage[];
  teamStaff: CommsStaffMessage[];
  directStaff: CommsStaffMessage[];
  smsClient: CommsClientThread[];
  emailClient: CommsClientThread[];
  onClose: () => void;
  onOpenInMessaging: (view: "messages" | "staff_comms") => void;
}) {
  const cfg = CHANNEL_CFG[channel];

  // Pick the items to show. For staff channels (team/direct), show staff
  // messages; for SMS/email, mix staff + client. Dept email is scaffold.
  const staffItems =
    channel === "sms"    ? smsStaff   :
    channel === "email"  ? emailStaff :
    channel === "team"   ? teamStaff  :
    channel === "direct" ? directStaff :
                           [];
  const clientItems =
    channel === "sms"   ? smsClient   :
    channel === "email" ? emailClient :
                          [];
  const isScaffoldChannel = channel === "dept";

  // Pre-filled AI draft — scaffold. Picks a template based on channel +
  // whether the latest item is from a client.
  // TODO: replace with an Anthropic API call (see file header).
  const draftSeed = aiDraftScaffold(channel, staffItems[0], clientItems[0]);
  const [draft, setDraft] = useState<string>(draftSeed);
  // If the channel changes mid-mount, refresh the seed (handled by remount).

  return (
    <div className="absolute z-40 right-0 mt-2 w-[360px] max-w-[95vw] rounded-xl border border-[#2A2A28] bg-[#1A1A18] shadow-2xl">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2A2A28]">
        <span className="text-[#B8945F]">{cfg.icon}</span>
        <p className="text-xs font-semibold text-[#FAFAF7]">{cfg.title}</p>
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-1.5 py-0.5 rounded">
          Scaffold
        </span>
        <button onClick={onClose} aria-label="Close" className="text-[#6B6B66] hover:text-[#FAFAF7]">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-3 max-h-[440px] overflow-y-auto">
        {/* Recent unread */}
        {isScaffoldChannel ? (
          <ScaffoldNote
            label="Department mailbox not wired"
            detail="Shared firm inbox (planned: Microsoft Graph) will surface here. Until then this tab carries no data."
          />
        ) : staffItems.length === 0 && clientItems.length === 0 ? (
          <p className="text-[11px] text-[#6B6B66] italic text-center py-2">
            No unread {cfg.title.toLowerCase()} right now.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {clientItems.slice(0, 2).map(t => (
              <li key={`c-${t.id}`} className="rounded border border-[#2A2A28] bg-[#0F0F0E] px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-semibold text-[#FAFAF7] truncate flex-1">{t.client_name ?? "Client"}</p>
                  <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700/60">
                    {t.unread_count}
                  </span>
                </div>
                <p className="text-[10px] text-[#6B6B66] mt-0.5 leading-snug line-clamp-2">{t.preview || "(no preview)"}</p>
              </li>
            ))}
            {staffItems.slice(0, 2).map(m => (
              <li key={`s-${m.id}`} className="rounded border border-[#2A2A28] bg-[#0F0F0E] px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-semibold text-[#FAFAF7] truncate flex-1">{m.sender_name}</p>
                  <span className="text-[9px] uppercase tracking-widest text-[#6B6B66]">{m.channel}</span>
                </div>
                <p className="text-[10px] text-[#6B6B66] mt-0.5 leading-snug line-clamp-2">
                  {m.subject || m.body.slice(0, 100)}
                </p>
              </li>
            ))}
          </ul>
        )}

        {/* AI draft + Send (scaffold) */}
        {!isScaffoldChannel && (
          <>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3 h-3 text-[#B8945F]" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66]">
                  AI draft
                </p>
                <span className="ml-auto text-[9px] text-[#6B6B66] italic">scaffold · Anthropic pending</span>
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="w-full bg-[#0F0F0E] border border-[#2A2A28] rounded px-2 py-1.5 text-[11px] text-[#FAFAF7] placeholder-[#6B6B66] outline-none focus:border-[#B8945F]/60 leading-snug"
                placeholder="Edit before sending…"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => onOpenInMessaging(cfg.openView)}
                className="text-[10px] font-semibold text-[#B8945F] hover:text-[#FAFAF7] inline-flex items-center gap-1"
              >
                Open in Messaging <ExternalLink className="w-3 h-3" />
              </button>
              <button
                disabled
                title="Send — wiring pending (Twilio / SendGrid)"
                className="flex items-center gap-1 text-[10px] font-bold text-[#0F0F0E] bg-[#B8945F]/60 px-2.5 py-1 rounded cursor-not-allowed"
              >
                <Send className="w-3 h-3" /> Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Channel labels + icons used by the popover header.
const CHANNEL_CFG: Record<
  Exclude<ChannelKey, "phone" | "tasks">,
  { title: string; icon: React.ReactNode; openView: "messages" | "staff_comms" }
> = {
  sms:    { title: "SMS",              icon: <MessageSquare className="w-3.5 h-3.5" />, openView: "messages" },
  email:  { title: "Email",            icon: <Mail className="w-3.5 h-3.5" />,          openView: "messages" },
  team:   { title: "Team chat",        icon: <Users className="w-3.5 h-3.5" />,         openView: "staff_comms" },
  direct: { title: "Direct messages",  icon: <Send className="w-3.5 h-3.5" />,          openView: "staff_comms" },
  dept:   { title: "Department email", icon: <AtSign className="w-3.5 h-3.5" />,        openView: "messages" },
};

function ScaffoldNote({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded border border-dashed border-[#3A3A36] bg-[#0F0F0E] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">{label}</p>
      <p className="text-[11px] text-[#6B6B66] leading-snug">{detail}</p>
    </div>
  );
}

// ─── AI draft scaffold ───────────────────────────────────────────────────────
//
// Returns a per-channel template. Once the Anthropic integration lands,
// replace with a call that passes the channel + latest message body + lead
// context and asks for a short reply in the firm's voice.

function aiDraftScaffold(
  channel: Exclude<ChannelKey, "phone" | "tasks">,
  staffItem?: CommsStaffMessage,
  clientItem?: CommsClientThread,
): string {
  const senderFirst =
    clientItem?.client_name?.split(" ")[0] ??
    staffItem?.sender_name?.split(" ")[0] ??
    "there";
  switch (channel) {
    case "sms":
      return `Hi ${senderFirst} — got your message. Let me check on this and get back to you shortly.`;
    case "email":
      return `Hi ${senderFirst},\n\nThanks for the email. I'm pulling up your file now and will follow up with details shortly.\n\nBest,`;
    case "team":
      return `Following up on this — taking a look now.`;
    case "direct":
      return `Got it. Looking into this and circling back.`;
    case "dept":
      return ``; // unreachable (dept tab shows scaffold note instead)
  }
}
