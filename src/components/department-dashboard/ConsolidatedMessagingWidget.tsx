// Consolidated messaging widget (RIGHT column).
//
// Extracted from IntakeDashboard.tsx (Prompt 54). Behavior preserved
// exactly. Six tabs: All / SMS / Email / Team / Direct / Voicemails.
// Two of the six (Team, Voicemails) are scaffold tabs with no source —
// they render the same "coming soon" body the original had.
//
// To stay free of intake-specific assumptions, the host now passes
// `enabledTabs` — the subset of tabs to render. Today the Intake host
// passes all six (matching the previous behavior); Accounting / Legal
// hosts can pass a narrower set (e.g. ["all","email"]) when they mount
// the same widget against their own message sources.

import { useMemo, useState } from "react";
import {
  AtSign, BellRing, ListChecks, Mail, MessageCircle, MessageSquare, Phone, Send,
  Users, Voicemail,
} from "lucide-react";
import type { ClientMessageThread, StaffMessage } from "./types";
import { Card, CardHeader, CountBadge, EmptyHint } from "./primitives";
import { relativeTime } from "./time";

export type MsgTab = "all" | "sms" | "email" | "team" | "direct" | "voicemails";

interface UnifiedMsgRow {
  id: string;
  sender: string;
  preview: string;
  timestamp: string;
  channel: "sms" | "email" | "dm" | "phone_note" | "other";
  source: "client" | "staff";
  unreadCount: number;
  onOpen: () => void;
}

export interface ConsolidatedMessagingWidgetProps {
  threads: (ClientMessageThread & { client_name?: string; preview?: string; last_channel?: string | null })[];
  staffMsgs: StaffMessage[];
  loading: boolean;
  onOpenView: (view: "messages" | "staff_comms") => void;
  /** Which tabs to render. Defaults to all six (preserves Intake host
   *  behavior). Pass a narrower set for hosts that don't yet have data
   *  for every channel. */
  enabledTabs?: ReadonlyArray<MsgTab>;
}

const DEFAULT_TABS: ReadonlyArray<MsgTab> = ["all", "sms", "email", "team", "direct", "voicemails"];

export function ConsolidatedMessagingWidget({
  threads, staffMsgs, loading, onOpenView, enabledTabs = DEFAULT_TABS,
}: ConsolidatedMessagingWidgetProps) {
  const [tab, setTab] = useState<MsgTab>("all");

  // Normalize client threads + staff messages into a single row shape.
  const rows: UnifiedMsgRow[] = useMemo(() => {
    const out: UnifiedMsgRow[] = [];
    for (const t of threads) {
      const ch = (t.last_channel ?? "").toLowerCase();
      const channel: UnifiedMsgRow["channel"] =
        ch === "sms" ? "sms" : ch === "email" ? "email" : "other";
      out.push({
        id: `client-${t.id}`,
        sender: t.client_name ?? "Client",
        preview: t.preview || "(no preview)",
        timestamp: t.last_message_at ?? t.updated_at,
        channel,
        source: "client",
        unreadCount: t.unread_count ?? 0,
        onOpen: () => onOpenView("messages"),
      });
    }
    for (const m of staffMsgs) {
      const channel: UnifiedMsgRow["channel"] =
        m.channel === "sms"        ? "sms"   :
        m.channel === "email"      ? "email" :
        m.channel === "dm"         ? "dm"    :
        m.channel === "phone_note" ? "phone_note" : "other";
      out.push({
        id: `staff-${m.id}`,
        sender: m.sender_name,
        preview: m.subject || m.body.slice(0, 80),
        timestamp: m.created_at,
        channel,
        source: "staff",
        unreadCount: m.read ? 0 : 1,
        onOpen: () => onOpenView("staff_comms"),
      });
    }
    // Most-recent first.
    out.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return out;
  }, [threads, staffMsgs, onOpenView]);

  // Per-tab unread counts and row predicates.
  const counts = useMemo(() => {
    const c = { all: 0, sms: 0, email: 0, team: 0, direct: 0, voicemails: 0 };
    for (const r of rows) {
      if (r.unreadCount <= 0) continue;
      c.all += r.unreadCount;
      if (r.channel === "sms")   c.sms   += r.unreadCount;
      if (r.channel === "email") c.email += r.unreadCount;
      if (r.source === "staff" && r.channel === "dm") c.direct += r.unreadCount;
    }
    return c;
  }, [rows]);

  const tabRows = useMemo<UnifiedMsgRow[]>(() => {
    switch (tab) {
      case "all":   return rows;
      case "sms":   return rows.filter(r => r.channel === "sms");
      case "email": return rows.filter(r => r.channel === "email");
      case "direct":return rows.filter(r => r.source === "staff" && r.channel === "dm");
      case "team":  return [];  // SCAFFOLD — no source
      case "voicemails": return [];  // SCAFFOLD — no source
    }
  }, [rows, tab]);

  const isScaffoldTab = tab === "team" || tab === "voicemails";
  const totalUnread = counts.all;

  const ALL_TABS: { id: MsgTab; label: string; icon: React.ReactNode; count: number; scaffold?: boolean }[] = [
    { id: "all",        label: "All",     icon: <ListChecks className="w-3 h-3" />,     count: counts.all },
    { id: "sms",        label: "SMS",     icon: <MessageSquare className="w-3 h-3" />,  count: counts.sms },
    { id: "email",      label: "Email",   icon: <AtSign className="w-3 h-3" />,         count: counts.email },
    { id: "team",       label: "Team",    icon: <Users className="w-3 h-3" />,          count: counts.team,    scaffold: true },
    { id: "direct",     label: "Direct",  icon: <Send className="w-3 h-3" />,           count: counts.direct },
    { id: "voicemails", label: "Voicemail", icon: <Voicemail className="w-3 h-3" />,    count: counts.voicemails, scaffold: true },
  ];

  const enabledSet = new Set(enabledTabs);
  const TABS = ALL_TABS.filter(t => enabledSet.has(t.id));

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={<MessageCircle className="w-4 h-4" />}
        title="Messages"
        badge={<CountBadge value={totalUnread} tone={totalUnread > 0 ? "warn" : "neutral"} />}
        chip={
          totalUnread > 0 ? (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-300">
              <BellRing className="w-3 h-3" /> {totalUnread} to address
            </span>
          ) : (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66]">
              Inbox clear
            </span>
          )
        }
      />

      {/* Tab strip */}
      <div className="px-2 py-2 border-b border-[#2A2A28] flex items-center gap-1 overflow-x-auto">
        {TABS.map(t => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded transition-colors flex-shrink-0 ${
                isActive
                  ? "bg-[#2A2A28] text-[#FAFAF7]"
                  : "text-[#6B6B66] hover:text-[#FAFAF7]"
              } ${t.scaffold ? "italic" : ""}`}
              title={t.scaffold ? "Scaffold — wiring pending" : undefined}
            >
              {t.icon}
              {t.label}
              {t.count > 0 && (
                <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700/60">
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-3 overflow-y-auto" style={{ maxHeight: 560 }}>
        {loading ? (
          <EmptyHint>Loading…</EmptyHint>
        ) : isScaffoldTab ? (
          <ScaffoldTabBody tab={tab} />
        ) : tabRows.length === 0 ? (
          <EmptyHint>{tab === "all" ? "Inbox is clear." : `No unread ${tab} messages.`}</EmptyHint>
        ) : (
          <ul className="space-y-1">
            {tabRows.map(r => (
              <li key={r.id}>
                <button
                  onClick={r.onOpen}
                  className="w-full flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-[#2A2A28] text-left transition-colors"
                >
                  <UnifiedChannelIcon channel={r.channel} source={r.source} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-xs truncate ${r.unreadCount > 0 ? "text-[#FAFAF7] font-semibold" : "text-[#FAFAF7]"}`}>
                        {r.sender}
                      </p>
                      <span className="text-[9px] uppercase tracking-widest text-[#6B6B66] flex-shrink-0">
                        {r.source === "client" ? "client" : r.channel}
                      </span>
                      {r.unreadCount > 0 && (
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700/60 flex-shrink-0">
                          {r.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#6B6B66] truncate mt-0.5">{r.preview}</p>
                  </div>
                  <span className="text-[10px] text-[#6B6B66] flex-shrink-0 ml-2">
                    {relativeTime(r.timestamp)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function UnifiedChannelIcon({
  channel, source,
}: { channel: UnifiedMsgRow["channel"]; source: UnifiedMsgRow["source"] }) {
  const cls = "w-3.5 h-3.5 text-[#6B6B66] mt-0.5 flex-shrink-0";
  if (channel === "sms")        return <MessageSquare className={cls} />;
  if (channel === "email")      return <Mail className={cls} />;
  if (channel === "dm")         return <Send className={cls} />;
  if (channel === "phone_note") return <Phone className={cls} />;
  // Fallback (client thread with unknown channel)
  if (source === "client") return <Users className={cls} />;
  return <MessageCircle className={cls} />;
}

function ScaffoldTabBody({ tab }: { tab: MsgTab }) {
  const cfg = tab === "team" ? {
    icon: <Users className="w-3.5 h-3.5 text-[#6B6B66]" />,
    label: "Team channels — coming soon",
    detail:
      "Group chats for firm sub-teams (Intake, Legal, Accounting, …) appear here once the team-channel feature lands.",
  } : {
    icon: <Voicemail className="w-3.5 h-3.5 text-[#6B6B66]" />,
    label: "Voicemails — coming soon",
    detail:
      "Twilio voice inbound + the voicemails table will populate this tab. No fake entries until then.",
  };
  return (
    <div className="rounded-lg border border-dashed border-[#3A3A36] bg-[#0F0F0E] px-3 py-3">
      <div className="flex items-center gap-2 mb-1">
        {cfg.icon}
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#6B6B66]">{cfg.label}</span>
      </div>
      <p className="text-[11px] text-[#6B6B66] leading-relaxed">{cfg.detail}</p>
    </div>
  );
}
