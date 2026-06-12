// Shared types used by the department-dashboard module.
//
// Hoisted from IntakeDashboard.tsx during Slice-1 (Prompt 54). The Intake
// host re-exports these so existing import paths keep working without
// churning unrelated call-sites.

// ─── Task colors + entries (LEFT-column widget + Overview bubble) ──────────

export type TaskColor = "red" | "orange" | "yellow" | "blue";

export interface TaskEntry {
  id: string;
  color: TaskColor;
  title: string;
  subtitle: string;
  actionLabel: string;
  /** Lower comes first within the same color. */
  sortKey: number;
  /**
   * Due-date for the task as an ISO timestamp. Present for:
   *   - appointment tasks   → calendar_event.start_time
   *   - lead-derived tasks  → leads.next_follow_up_at (when set)
   * Absent (undefined) for tasks where the underlying record has no due
   * field today (e.g. unread client messages). Renderer shows a placeholder
   * with a TODO note rather than fabricating a date.
   */
  due?: string | null;
  /**
   * Set on lead-derived entries. The only field the shared filter reads
   * is `assigned_name` (Prompt 52's "Mine" predicate). Hosts pass their
   * own Lead-shaped object; the structural type guarantees the optional
   * field is at least present.
   */
  leadRef?: { assigned_name?: string | null };
  onSelect: () => void;
}

// ─── Time-clock state (Clock bubble inside AttentionBubble) ────────────────

export interface TimeClockState {
  clockedInAt: number | null;
  onLunchSince: number | null;
  onBreakSince: number | null;
  lunchMinutes: number;
  breakMinutes: number;
}

export interface TimeClockActions {
  clockIn: () => void;
  clockOut: () => void;
  startLunch: () => void;
  endLunch: () => void;
  startBreak: () => void;
  endBreak: () => void;
}

// ─── Message shapes (ConsolidatedMessagingWidget) ──────────────────────────

export interface ClientMessageThread {
  id: string;
  client_id: string;
  unread_count: number;
  last_message_at: string | null;
  updated_at: string;
}

export interface ClientMessage {
  id: string;
  thread_id: string;
  body: string;
  channel: string;
  sender_role: string;
  sender_name: string;
  created_at: string;
}

export interface StaffMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string | null;
  channel: "email" | "sms" | "phone_note" | "dm";
  subject: string | null;
  body: string;
  read: boolean;
  created_at: string;
}

// ─── Department metric registry (Performance / Goals bubble) ───────────────

export type DeptKey = "intake" | "legal" | "accounting";

export interface DeptMetricDef {
  /** Stable key used to look up the metric in the planned firm_perf_metrics table. */
  key: string;
  /** Display label inside the column. */
  label: string;
  /** True for "show rate" / "no-show rate" style metrics; renders "%" placeholder unit. */
  isPercentage?: boolean;
}

export interface DeptMetricSet {
  key: DeptKey;
  label: string;
  /** Headline goal description rendered in the column header. */
  monthlyGoalLabel: string;
  metrics: DeptMetricDef[];
}

export const INTAKE_METRICS: DeptMetricSet = {
  key: "intake",
  label: "Intake",
  monthlyGoalLabel: "Monthly retained + targeted rates",
  metrics: [
    { key: "retained",         label: "Retained" },
    { key: "show_answer_rate", label: "Show / answer rate", isPercentage: true },
    { key: "appts_set",        label: "Appointments set" },
    { key: "presented",        label: "Presented" },
  ],
};

export const LEGAL_METRICS: DeptMetricSet = {
  key: "legal",
  label: "Legal",
  monthlyGoalLabel: "Monthly case throughput + signing pace",
  metrics: [
    { key: "filings_completed", label: "Filings completed" },
    { key: "doc_review_turn",   label: "Doc-review turn rate", isPercentage: true },
    { key: "signing_pace",      label: "Signing pace" },
  ],
};

export const ACCOUNTING_METRICS: DeptMetricSet = {
  key: "accounting",
  label: "Accounting",
  monthlyGoalLabel: "Monthly collections + autopay pace",
  metrics: [
    { key: "collected",         label: "Collected this month" },
    { key: "autopay_attach",    label: "Autopay attach rate", isPercentage: true },
    { key: "retries_resolved",  label: "Retries resolved" },
  ],
};
