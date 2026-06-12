// AttentionBubble — red overdue + consolidated affordances.
//
// Extracted from IntakeDashboard.tsx (Prompt 54). Behavior preserved
// exactly. The bubble takes ClockBubble + UnreadStat inline because both
// are coupled to the heading layout. ClockPopup is rendered conditionally
// from inside ClockBubble.

import { useEffect, useState, type ReactNode } from "react";
import {
  AlertCircle, AtSign, Calendar, Clock, Coffee, MessageSquare,
  Pause, Play, Send, Users, X,
} from "lucide-react";
import type {
  ClientMessageThread, StaffMessage, TaskEntry, TimeClockActions, TimeClockState,
} from "./types";
import { CompactStat, PlaceholderValue } from "./primitives";
import { formatHm } from "./time";

export interface AttentionBubbleProps {
  overdueCount: number;
  overdueTasks: TaskEntry[];
  staffMsgs: StaffMessage[];
  clientThreads: (ClientMessageThread & { client_name?: string; preview?: string })[];
  timeClock: TimeClockState;
  timeClockActions: TimeClockActions;
  onOpenMessagingPanel: (view: "messages" | "staff_comms") => void;
  onAskForHelp: () => void;
  onRequestTimeOff: (kind: "pto" | "sto") => void;
}

export function AttentionBubble({
  overdueCount, overdueTasks, staffMsgs, clientThreads,
  timeClock, timeClockActions,
  onOpenMessagingPanel, onAskForHelp, onRequestTimeOff,
}: AttentionBubbleProps) {
  const isHot = overdueCount > 0;
  // Up to 3 representative overdue items so the bubble shows what's
  // actually overdue, not just a number.
  const sample = overdueTasks.slice(0, 3);

  // Unread-by-type counts (moved from OverviewBubble).
  const sms    = staffMsgs.filter(m => m.channel === "sms").length;
  const email  = staffMsgs.filter(m => m.channel === "email").length;
  const team   = staffMsgs.filter(m => m.channel === "phone_note").length;
  const direct = staffMsgs.filter(m => m.channel === "dm").length;
  const clientUnread = clientThreads.reduce((s, t) => s + (t.unread_count ?? 0), 0);

  // Container tone — red border + tint when overdue, neutral border when not.
  const containerCls = isHot
    ? "rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4"
    : "rounded-2xl border border-[#2A2A28] bg-[#1A1A18] px-5 py-4";

  return (
    <div className={containerCls}>
      {/* Heading */}
      <div className="flex items-start gap-3">
        <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isHot ? "text-red-400" : "text-[#B8945F]"}`} />
        <div className="flex-1 min-w-0">
          {isHot ? (
            <p className="text-sm font-bold text-red-200">
              You have {overdueCount} overdue task{overdueCount === 1 ? "" : "s"} — time to reorganize.
            </p>
          ) : (
            <p className="text-sm font-bold text-[#FAFAF7]">
              All caught up — quick actions handy below.
            </p>
          )}
          {isHot && (
            <ul className="mt-1.5 space-y-0.5">
              {sample.map(t => (
                <li key={t.id} className="text-[11px] text-red-200/80 leading-snug">
                  <span className="font-semibold">{t.title}</span>
                  <span className="text-red-300/70"> · {t.subtitle}</span>
                </li>
              ))}
              {overdueTasks.length > sample.length && (
                <li className="text-[10px] text-red-200/60 italic">
                  + {overdueTasks.length - sample.length} more …
                </li>
              )}
            </ul>
          )}
        </div>
        {/* Ask-for-help button — sits in the heading row so it's reachable
            whether or not the overdue list is present. */}
        <button
          onClick={onAskForHelp}
          title="Ask a teammate for help — flag a task or lead for reassignment"
          className={`flex-shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded transition-colors ${
            isHot
              ? "text-red-100 bg-red-700/60 hover:bg-red-700"
              : "text-[#FAFAF7] bg-[#2A2A28] hover:bg-[#3A3A36] border border-[#3A3A36]"
          }`}
        >
          <Users className="w-3 h-3" /> Ask for help
        </button>
      </div>

      {/* Quick-actions row — Clock + Messaging summary. Two-column on lg+. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#2A2A28]/60">
        {/* Clock — reuses the existing ClockBubble compact pill + popup. */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1.5">
            Clock
          </p>
          <ClockBubble
            state={timeClock}
            actions={timeClockActions}
            onRequestTimeOff={onRequestTimeOff}
          />
        </div>

        {/* Compact messaging summary — moved from OverviewBubble. */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1.5">
            Unread to you
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <UnreadStat icon={<MessageSquare className="w-3 h-3" />} label="SMS"    value={sms}    onOpen={() => onOpenMessagingPanel("messages")} />
            <UnreadStat icon={<AtSign className="w-3 h-3" />}        label="Email"  value={email}  onOpen={() => onOpenMessagingPanel("messages")} />
            <UnreadStat icon={<Users className="w-3 h-3" />}         label="Team"   value={team}   onOpen={() => onOpenMessagingPanel("staff_comms")} />
            <UnreadStat icon={<Send className="w-3 h-3" />}          label="Direct" value={direct} onOpen={() => onOpenMessagingPanel("staff_comms")} />
          </div>
          {clientUnread > 0 && (
            <button
              onClick={() => onOpenMessagingPanel("messages")}
              className="text-[10px] text-[#6B6B66] hover:text-[#FAFAF7] mt-2 leading-snug transition-colors text-left"
            >
              Also <span className="font-bold text-[#FAFAF7]">{clientUnread}</span> unread message{clientUnread === 1 ? "" : "s"} across client threads.
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function UnreadStat({
  icon, label, value, onOpen,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  onOpen?: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-1.5 text-left hover:text-[#FAFAF7] transition-colors"
      title={onOpen ? "Open in Messaging" : undefined}
    >
      <span className="text-[#6B6B66]">{icon}</span>
      <span className="text-[10px] text-[#6B6B66] flex-1">{label}</span>
      <span className={`text-xs font-bold ${value > 0 ? "text-[#FAFAF7]" : "text-[#6B6B66]"}`}>{value}</span>
    </button>
  );
}

// ─── ClockBubble — compact pill on the dashboard ─────────────────────────

function ClockBubble({
  state, actions, onRequestTimeOff,
}: {
  state: TimeClockState;
  actions: TimeClockActions;
  /** Routes to the existing TimeOffTab inside MyScheduleTab. */
  onRequestTimeOff: (kind: "pto" | "sto") => void;
}) {
  // 30s tick so the live status counter refreshes.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const clockedInAt = state.clockedInAt;
  const minutesElapsed = clockedInAt ? Math.max(0, Math.floor((Date.now() - clockedInAt) / 60_000)) : 0;
  const onLunch = state.onLunchSince != null;
  const onBreak = state.onBreakSince != null;
  const liveLunchMinutes = onLunch ? Math.floor((Date.now() - (state.onLunchSince ?? 0)) / 60_000) : 0;
  const liveBreakMinutes = onBreak ? Math.floor((Date.now() - (state.onBreakSince ?? 0)) / 60_000) : 0;
  const workedTodayMin = Math.max(0,
    minutesElapsed - state.lunchMinutes - state.breakMinutes - liveLunchMinutes - liveBreakMinutes
  );

  const [popupOpen, setPopupOpen] = useState(false);

  // Compact status pill on the dashboard. NO hour metrics shown inline —
  // those live in the popup.
  const statusCls =
    onLunch ? "bg-amber-900/30 text-amber-300 border-amber-700/60" :
    onBreak ? "bg-sky-900/30 text-sky-300 border-sky-700/60" :
              "bg-emerald-900/20 text-emerald-300 border-emerald-700/40";
  const StatusIcon = onLunch ? Coffee : onBreak ? Pause : Play;
  const statusLabel = onLunch ? "On lunch" : onBreak ? "On break" : "Working";

  return (
    <>
      <button
        type="button"
        onClick={() => setPopupOpen(true)}
        title="Open Employee Time Clock"
        className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-[#2A2A28] bg-[#1A1A18] hover:border-[#B8945F]/40 transition-colors text-left w-full"
      >
        <Clock className="w-3.5 h-3.5 text-[#B8945F] flex-shrink-0" />
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${statusCls}`}>
          <StatusIcon className="w-3 h-3" />
          {statusLabel}
        </span>
        <span className="ml-auto text-[10px] text-[#6B6B66] flex-shrink-0">Open →</span>
      </button>

      {popupOpen && (
        <ClockPopup
          state={state}
          actions={actions}
          onClose={() => setPopupOpen(false)}
          onRequestTimeOff={onRequestTimeOff}
          workedTodayMin={workedTodayMin}
          liveLunchMinutes={liveLunchMinutes}
          liveBreakMinutes={liveBreakMinutes}
        />
      )}
    </>
  );
}

// ─── ClockPopup — full metrics + every clock action ──────────────────────

function ClockPopup({
  state, actions, onClose, onRequestTimeOff,
  workedTodayMin, liveLunchMinutes, liveBreakMinutes,
}: {
  state: TimeClockState;
  actions: TimeClockActions;
  onClose: () => void;
  onRequestTimeOff: (kind: "pto" | "sto") => void;
  workedTodayMin: number;
  liveLunchMinutes: number;
  liveBreakMinutes: number;
}) {
  const onLunch = state.onLunchSince != null;
  const onBreak = state.onBreakSince != null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Employee Time Clock"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[#2A2A28] bg-[#1A1A18] shadow-2xl flex flex-col" style={{ maxHeight: "92vh" }}>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#2A2A28] flex-shrink-0">
          <Clock className="w-4 h-4 text-[#B8945F]" />
          <h3 className="text-sm font-semibold text-[#FAFAF7]">Employee Time Clock</h3>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-1.5 py-0.5 rounded">
            Scaffold
          </span>
          <button onClick={onClose} aria-label="Close" className="ml-auto text-[#6B6B66] hover:text-[#FAFAF7]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Status */}
          {onLunch ? (
            <div className="flex items-center justify-center gap-2 px-3 py-2 rounded bg-amber-900/30 text-amber-300 border border-amber-700/60">
              <Coffee className="w-4 h-4" /> On lunch · {formatHm(liveLunchMinutes)}
            </div>
          ) : onBreak ? (
            <div className="flex items-center justify-center gap-2 px-3 py-2 rounded bg-sky-900/30 text-sky-300 border border-sky-700/60">
              <Pause className="w-4 h-4" /> On break · {formatHm(liveBreakMinutes)}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 px-3 py-2 rounded bg-emerald-900/20 text-emerald-300 border border-emerald-700/40">
              <Play className="w-4 h-4" /> Working · {formatHm(workedTodayMin)}
            </div>
          )}

          {/* Lunch / Break / Clock Out */}
          <div className="grid grid-cols-2 gap-2">
            {onLunch ? (
              <button
                onClick={() => { actions.endLunch(); }}
                className="col-span-2 flex items-center justify-center gap-1.5 bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs py-2 rounded transition-colors"
              >
                <Play className="w-3 h-3" /> End lunch
              </button>
            ) : onBreak ? (
              <button
                onClick={() => { actions.endBreak(); }}
                className="col-span-2 flex items-center justify-center gap-1.5 bg-sky-700 hover:bg-sky-600 text-white font-bold text-xs py-2 rounded transition-colors"
              >
                <Play className="w-3 h-3" /> End break
              </button>
            ) : (
              <>
                <button
                  onClick={() => { actions.startLunch(); }}
                  title="Use when you'll be away 15+ minutes for lunch"
                  className="flex items-center justify-center gap-1.5 bg-[#2A2A28] hover:bg-[#3A3A36] text-[#FAFAF7] text-xs font-semibold py-2 rounded border border-[#3A3A36] transition-colors"
                >
                  <Coffee className="w-3 h-3" /> Lunch
                </button>
                <button
                  onClick={() => { actions.startBreak(); }}
                  title="Use when you'll be away 15+ minutes for a break"
                  className="flex items-center justify-center gap-1.5 bg-[#2A2A28] hover:bg-[#3A3A36] text-[#FAFAF7] text-xs font-semibold py-2 rounded border border-[#3A3A36] transition-colors"
                >
                  <Pause className="w-3 h-3" /> Break
                </button>
              </>
            )}
            <button
              onClick={() => { actions.clockOut(); }}
              title="End your shift and sign out"
              className="col-span-2 flex items-center justify-center gap-1.5 bg-[#3A1E1E] hover:bg-[#4A2424] text-[#FAFAF7] text-xs font-bold py-2 rounded transition-colors"
            >
              <X className="w-3 h-3" /> Clock Out (end shift)
            </button>
          </div>

          {/* PTO / STO requests — route to MyScheduleTab's TimeOffTab form */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#2A2A28]">
            <button
              onClick={() => { onClose(); onRequestTimeOff("pto"); }}
              className="flex items-center justify-center gap-1.5 bg-sky-900/30 hover:bg-sky-900/50 text-sky-200 text-xs font-semibold py-2 rounded border border-sky-700/40 transition-colors"
              title="Open the time-off request form (My Schedule)"
            >
              <Calendar className="w-3 h-3" /> Request PTO
            </button>
            <button
              onClick={() => { onClose(); onRequestTimeOff("sto"); }}
              className="flex items-center justify-center gap-1.5 bg-amber-900/30 hover:bg-amber-900/50 text-amber-200 text-xs font-semibold py-2 rounded border border-amber-700/40 transition-colors"
              title="Open the time-off request form pre-filled to Sick (My Schedule)"
            >
              <AlertCircle className="w-3 h-3" /> Request STO
            </button>
          </div>

          {/* Metrics — Today real, rest scaffold (—). No fabricated hours. */}
          <dl className="space-y-1.5 pt-2 border-t border-[#2A2A28]">
            <CompactStat label="Today"      value={formatHm(workedTodayMin)} />
            <CompactStat label="This week"  value={<PlaceholderValue title="Needs time-tracking backend (week aggregator)">—</PlaceholderValue>} />
            <CompactStat label="Pay period" value={<PlaceholderValue title="Needs pay-period config + aggregator">—</PlaceholderValue>} />
            <CompactStat label="Overtime"   value={<PlaceholderValue title="Needs OT threshold config + week total">—</PlaceholderValue>} />
            <CompactStat label="On phone"   value={<PlaceholderValue title="Needs the planned calls table + duration roll-up">—</PlaceholderValue>} />
            <CompactStat label="Idle"       value={<PlaceholderValue title="Idle watcher is armed; metrics surface here once the backend persists them">—</PlaceholderValue>} />
          </dl>

          <p className="text-[10px] text-[#6B6B66] italic leading-snug">
            Clock state persists for this browser session only. Real overtime,
            phone, and idle metrics arrive with the time-tracking backend.
            PTO / STO requests open the existing time-off form in My Schedule.
          </p>
        </div>
      </div>
    </div>
  );
}

// Also export the inner widgets so other dashboards can mount them
// directly if they want a different parent layout.
export { ClockBubble };
