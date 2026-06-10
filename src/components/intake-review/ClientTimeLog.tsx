// Client Time Log (scaffold).
//
// Per-lead chronological log of EVERY action that happens on the lead detail
// screen — status changes, intake updates, review opens, contact logs, message
// sends, etc. Each entry carries:
//   - type      (machine string: 'status_change', 'intake_update',
//                'review_opened', 'contact_logged', 'message_sent', etc.)
//   - actor     (display name of the staffer or 'system' for automated)
//   - timestamp (ISO string)
//   - message   (human-readable summary)
//   - client_visible (boolean — default FALSE = internal-only)
//
// CLIENT-VISIBLE vs INTERNAL:
//   - The CaseAdvancementStatusBar is the firm's chosen client-facing
//     surface for case state. It is client_visible by design.
//   - Time-log entries default to internal (client_visible=false).
//   - Staff can toggle individual entries to client_visible=true. No
//     client-portal wiring exists yet; the flag exists in code + UI today
//     so the data shape is ready when the client-portal side lands.
//
// TODO Phase B — backend persistence:
//   - New table `client_time_logs (id, lead_id, type, actor_staff_id,
//     message, payload_jsonb, client_visible boolean DEFAULT false,
//     created_at)`. Keep lead_id (not client_id) so entries created before
//     retention have a stable parent.
//   - RPC `append_client_time_log(p_lead_id, p_type, p_message, p_payload,
//     p_client_visible)` so callers don't worry about actor_staff_id
//     (server reads from the auth context).
//   - Index on (lead_id, created_at desc) for the lead-detail surface.
//   - Future client-portal client_visible feed reads from the same table
//     filtered to client_visible=true.
//
// RULE — RETENTION HANDOFF:
//   On retention, the lead's info + time logs transfer into the client
//   folder under "time logs", unchanged. The transfer is a copy/link by
//   reference — lead-stage history must survive the transition so the
//   client folder shows the complete case history starting from the
//   original lead row, not from the moment of retention. Implemented
//   server-side in the retention RPC (TODO: extend the existing
//   `mark_lead_retained` function to also stitch client_time_logs.lead_id →
//   clients.id, OR create `client_id` on client_time_logs and backfill at
//   retention).

import { useCallback, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Clock, Eye, EyeOff, MessageSquare, Activity } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TimeLogEntryType =
  | 'status_change'
  | 'intake_update'
  | 'review_opened'
  | 'contact_logged'
  | 'message_sent'
  | 'other';

export interface TimeLogEntry {
  id: string;
  type: TimeLogEntryType;
  actor: string;
  timestamp: string;     // ISO
  message: string;
  client_visible: boolean;
}

// ─── Hook — local state (TODO: swap to Supabase-backed `client_time_logs`) ───
// Initial state is empty by design. No fabrication of pre-existing entries —
// if data persistence isn't wired, the log starts empty and grows as the
// staffer takes actions in this session.

export function useClientTimeLog() {
  const [entries, setEntries] = useState<TimeLogEntry[]>([]);

  const appendEntry = useCallback((
    type: TimeLogEntryType,
    actor: string,
    message: string,
    opts?: { clientVisible?: boolean },
  ) => {
    // TODO Phase B — replace this local mutation with an RPC call:
    //   await supabase.rpc('append_client_time_log', {
    //     p_lead_id, p_type: type, p_message: message,
    //     p_payload: payload, p_client_visible: opts?.clientVisible ?? false,
    //   });
    // and refetch on success. Today we just push to local state so the UI
    // demonstrates the flow.
    const entry: TimeLogEntry = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? (crypto as { randomUUID(): string }).randomUUID()
        : `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      actor,
      timestamp: new Date().toISOString(),
      message,
      client_visible: opts?.clientVisible ?? false,
    };
    setEntries(prev => [entry, ...prev]);
  }, []);

  const toggleVisibility = useCallback((id: string) => {
    // TODO Phase B — UPDATE client_time_logs SET client_visible = NOT client_visible
    //               WHERE id = p_id; (gated by staff role server-side).
    setEntries(prev => prev.map(e =>
      e.id === id ? { ...e, client_visible: !e.client_visible } : e,
    ));
  }, []);

  return { entries, appendEntry, toggleVisibility };
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ClientTimeLogProps {
  entries: TimeLogEntry[];
  onToggleVisibility: (id: string) => void;
  /** Disables the per-entry visibility toggle when the viewer doesn't have
   *  permission to flip the flag. TODO Phase B: derive from PlatformRole. */
  canToggleVisibility?: boolean;
}

const TYPE_ICONS: Record<TimeLogEntryType, LucideIcon> = {
  status_change:   Activity,
  intake_update:   Activity,
  review_opened:   Eye,
  contact_logged:  MessageSquare,
  message_sent:    MessageSquare,
  other:           Clock,
};

const TYPE_LABEL: Record<TimeLogEntryType, string> = {
  status_change:   'Status change',
  intake_update:   'Intake update',
  review_opened:   'Review opened',
  contact_logged:  'Contact logged',
  message_sent:    'Message sent',
  other:           'Other',
};

function fmt(iso: string): string {
  const d = new Date(iso);
  if (!isFinite(d.valueOf())) return iso;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function ClientTimeLog({
  entries, onToggleVisibility, canToggleVisibility = true,
}: ClientTimeLogProps) {
  return (
    <div className="bg-[#0d1221] border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" /> Client time log
        </p>
        <span className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">
          internal · {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-6">
          <Clock className="w-6 h-6 text-slate-700 mx-auto mb-1.5" />
          <p className="text-[11px] text-slate-500 italic">
            No log entries yet. Actions on this lead — status changes, intake updates,
            reviews opened, contacts logged, messages — will be recorded here.
          </p>
          <p className="text-[10px] text-slate-600 mt-1.5">
            On retention, this log transfers into the client folder under "time logs", unchanged.
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {entries.map(e => {
            const Icon = TYPE_ICONS[e.type] ?? Clock;
            return (
              <li
                key={e.id}
                className={`rounded-lg border px-3 py-2 transition-colors ${
                  e.client_visible
                    ? 'border-sky-500/30 bg-sky-500/5'
                    : 'border-slate-800 bg-slate-900/40'
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Icon size={11} className={e.client_visible ? 'text-sky-400' : 'text-slate-500'} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                    {TYPE_LABEL[e.type]}
                  </span>
                  <span className="text-[10px] text-slate-500">·</span>
                  <span className="text-[10px] text-slate-400">{e.actor}</span>
                  <span className="text-[10px] text-slate-600 ml-auto">{fmt(e.timestamp)}</span>
                </div>
                <p className="text-[11.5px] text-slate-200 mt-1 leading-snug whitespace-pre-line">
                  {e.message}
                </p>
                <div className="flex items-center justify-end mt-1.5">
                  <button
                    type="button"
                    disabled={!canToggleVisibility}
                    onClick={() => onToggleVisibility(e.id)}
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded border transition-colors ${
                      e.client_visible
                        ? 'border-sky-500/40 text-sky-300 hover:bg-sky-500/10'
                        : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                    title={
                      canToggleVisibility
                        ? (e.client_visible ? 'Mark as internal-only' : 'Mark visible to client')
                        : 'Visibility toggle not available to this role'
                    }
                  >
                    {e.client_visible ? (
                      <>
                        <Eye size={10} /> client-visible
                      </>
                    ) : (
                      <>
                        <EyeOff size={10} /> internal
                      </>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
