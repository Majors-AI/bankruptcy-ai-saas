// Slice 3 (Prompt 56) — Accounting task pool derivation.
// Slice 5 (Prompt 58) — IOLTA balance-discrepancy tier wired in.
//
// Pure function that converts the accounting_* tables AccountingPortal
// already loads at mount into the shell's color-coded TaskEntry[]. No
// fetches here — sources come in as parameters.
//
// Color tiers mirror the Intake-side rules + the Prompt-53 inventory:
//
//   RED    — accounting_payment_retries (status='retrying')
//          + client_lifecycle_alerts (status='open')
//          + IOLTA balance discrepancy (latest iolta_balance_log
//            balance_after !== trust_accounts.current_balance per
//            iolta account; tolerance $0.005)
//   ORANGE — accounting_cancel_requests (pending, age > 14 days)
//          + fee_adjustment_requests (DEFERRED — see TODO below)
//   YELLOW — accounting_filed_case_registry
//              (transfer_status='pending_signoff'
//               AND case_number_verified
//               AND NOT iolta_balance_verified)
//          + accounting_batch_transfer_requests (status='pending_approval')
//   BLUE   — accounting_payment_schedule (due within 3 days, status='pending')
//          + cancel_request_tasks (status='pending')
//
// Within a color tier, OVERDUE rows sort ahead of non-overdue (matches
// the Intake-side sharedTasks rule at AllTasksWidget).
//
// TODOs:
//   - ORANGE fee_adjustment_requests: written by AdjustPaymentModal but
//     never loaded into state. Add `accounting_fee_adjustment_requests`
//     to AccountingPortal's load() Promise.all + thread through here.

import type { TaskColor, TaskEntry } from "../department-dashboard";

// ─── Narrow row shapes ────────────────────────────────────────────────────
//
// Defined locally with just the fields buildAccountingTasks consumes.
// The wider AccountingPortal interfaces (PaymentRetry, CancelRequest, etc.)
// satisfy these structurally, so no circular import is needed and the
// helper stays testable in isolation.

export interface PaymentRetryRow {
  id: string;
  client_id: string;
  amount: number;
  status: "retrying" | "collected" | "expired" | "cancelled";
  decline_reason: string | null;
  next_retry_at: string | null;
  attempt_count: number;
  last_attempt_at: string;
}

export interface LifecycleAlertRow {
  id: string;
  client_name: string;
  alert_type: string;
  triggered_at: string;
  status: "open" | "acknowledged" | "resolved" | "dismissed";
}

export interface CancelRequestRow {
  id: string;
  client_id: string;
  status: "pending" | "saved" | "cancelled";
  reason_category: string | null;
  created_at: string;
}

export interface FiledCaseRegistryRow {
  id: string;
  client_id: string;
  case_number: string;
  case_number_verified: boolean;
  iolta_balance_verified: boolean;
  transfer_status: "not_ready" | "pending_signoff" | "signed_off" | "transferred";
  filed_date: string;
}

export interface BatchTransferRequestRow {
  id: string;
  state: string;
  status: "pending_approval" | "approved" | "rejected" | "executed";
  total_amount: number;
  client_count: number;
  submitted_at: string;
}

export interface ScheduleEntryRow {
  id: string;
  client_id: string;
  due_date: string;
  amount_due: number;
  status: "pending" | "paid" | "late" | "waived" | "partial";
  installment_number: number;
}

export interface CancelRequestTaskRow {
  id: string;
  client_id: string;
  title: string;
  task_type: string;
  status: "pending" | "in_progress" | "completed" | "dismissed";
  created_at: string;
}

export interface ClientRow {
  id: string;
  full_name: string;
}

// ─── Trust-snapshot inputs (Slice 5 — Prompt 58) ──────────────────────────

export interface TrustAccountRow {
  id: string;
  state: string;
  account_type: string;          // "operating" | "iolta" (broader for safety)
  account_name: string;
  current_balance: number;
  is_active: boolean;
}

export interface IoltaBalanceLogRow {
  id: string;
  trust_account_id: string;
  state: string;
  account_type: string;
  balance_after: number;
  recorded_at: string;
}

// ─── Source bundle + entry builder ────────────────────────────────────────

export interface AccountingTaskSources {
  paymentRetries:  ReadonlyArray<PaymentRetryRow>;
  lifecycleAlerts: ReadonlyArray<LifecycleAlertRow>;
  cancelRequests:  ReadonlyArray<CancelRequestRow>;
  filedRegistry:   ReadonlyArray<FiledCaseRegistryRow>;
  batchRequests:   ReadonlyArray<BatchTransferRequestRow>;
  scheduleEntries: ReadonlyArray<ScheduleEntryRow>;
  cancelTasks:     ReadonlyArray<CancelRequestTaskRow>;
  clients:         ReadonlyArray<ClientRow>;
  // Slice 5 (Prompt 58) — IOLTA discrepancy detection. Optional so
  // pre-Slice-5 callers / tests don't have to thread these immediately.
  trustAccounts?:  ReadonlyArray<TrustAccountRow>;
  ioltaBalanceLog?: ReadonlyArray<IoltaBalanceLogRow>;
  /** Optional callback invoked when the user clicks a task. The handler
   *  receives the underlying row kind + id; AccountingPortal can route
   *  to the right tab (cancellations, trust_hub, clients, etc.). When
   *  omitted, clicking is a no-op (Slice-3 scaffolding). */
  onSelectTask?: (kind: AccountingTaskKind, id: string) => void;
}

export type AccountingTaskKind =
  | "payment_retry"
  | "lifecycle_alert"
  | "iolta_discrepancy"
  | "cancel_request"
  | "iolta_signoff"
  | "batch_transfer"
  | "payment_schedule"
  | "cancel_request_task";

// ─── Trust-balance discrepancy detector (Slice 5) ─────────────────────────
//
// Per IOLTA trust account, compare trust_accounts.current_balance against
// the most recent iolta_balance_log.balance_after. If they differ by more
// than $0.005 (half a cent) the account is flagged as discrepant — the
// log is the auditable record and current_balance must catch up.
//
// Exported separately so the Trust Snapshot bubble (Slice 5 / Part 1) can
// reuse the same predicate it surfaces in the RED-tier task list.

export interface TrustDiscrepancy {
  trustAccount: TrustAccountRow;
  latestLogBalance: number;
  delta: number;       // current_balance - latestLogBalance
  latestRecordedAt: string;
}

export function detectTrustDiscrepancies(
  trustAccounts: ReadonlyArray<TrustAccountRow>,
  ioltaBalanceLog: ReadonlyArray<IoltaBalanceLogRow>,
): TrustDiscrepancy[] {
  // Bucket the log by trust_account_id and find the latest recorded_at
  // per account. The mount-level query orders by recorded_at desc so
  // the first hit per id IS the latest, but we don't assume that here.
  const latestByAccount = new Map<string, IoltaBalanceLogRow>();
  for (const row of ioltaBalanceLog) {
    const cur = latestByAccount.get(row.trust_account_id);
    if (!cur || new Date(row.recorded_at).getTime() > new Date(cur.recorded_at).getTime()) {
      latestByAccount.set(row.trust_account_id, row);
    }
  }

  const out: TrustDiscrepancy[] = [];
  for (const ta of trustAccounts) {
    // Only check IOLTA accounts. The "operating" rows in
    // trust_accounts are operating accounts (no IOLTA audit log to
    // compare against).
    if (ta.account_type !== "iolta") continue;
    if (!ta.is_active) continue;
    const latest = latestByAccount.get(ta.id);
    if (!latest) continue; // no log entries → nothing to compare
    const delta = ta.current_balance - latest.balance_after;
    if (Math.abs(delta) <= 0.005) continue; // within half-cent rounding
    out.push({
      trustAccount: ta,
      latestLogBalance: latest.balance_after,
      delta,
      latestRecordedAt: latest.recorded_at,
    });
  }
  return out;
}

const fmtMoney = (n: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

export function buildAccountingTasks(src: AccountingTaskSources): TaskEntry[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const clientById = new Map(src.clients.map(c => [c.id, c.full_name]));
  const clientName = (id: string) => clientById.get(id) ?? "Client";
  const onSelect = (kind: AccountingTaskKind, id: string) =>
    () => src.onSelectTask?.(kind, id);

  const out: TaskEntry[] = [];

  // ─── RED — autopay retries ─────────────────────────────────────────────
  for (const r of src.paymentRetries) {
    if (r.status !== "retrying") continue;
    out.push({
      id: `retry-${r.id}`,
      color: "red",
      title: clientName(r.client_id),
      subtitle:
        `Autopay retry · ${fmtMoney(r.amount)} · attempt ${r.attempt_count}` +
        (r.decline_reason ? ` · ${r.decline_reason}` : ""),
      actionLabel: "Retry",
      sortKey: 1_000_000 - new Date(r.last_attempt_at).getTime() / 60_000,
      due: r.next_retry_at,
      onSelect: onSelect("payment_retry", r.id),
    });
  }

  // ─── RED — open lifecycle alerts ───────────────────────────────────────
  // No explicit severity column today; every OPEN alert lands RED.
  // When the severity column lands the filter can split high → RED and
  // medium → ORANGE here.
  for (const a of src.lifecycleAlerts) {
    if (a.status !== "open") continue;
    out.push({
      id: `lc-${a.id}`,
      color: "red",
      title: a.client_name,
      subtitle: `Lifecycle alert · ${a.alert_type.replace(/_/g, " ")}`,
      actionLabel: "Review",
      sortKey: 1_500_000 - new Date(a.triggered_at).getTime() / 60_000,
      due: a.triggered_at,
      onSelect: onSelect("lifecycle_alert", a.id),
    });
  }

  // ─── RED — IOLTA balance discrepancy (Slice 5 — Prompt 58) ────────────
  // Surfaces when the trust account's running current_balance has drifted
  // from the latest iolta_balance_log.balance_after entry. Regulatory
  // urgency — auditable IOLTA record vs. the live balance must reconcile.
  if (src.trustAccounts && src.ioltaBalanceLog) {
    const discrepancies = detectTrustDiscrepancies(src.trustAccounts, src.ioltaBalanceLog);
    for (const d of discrepancies) {
      const sign = d.delta > 0 ? "+" : "";
      out.push({
        id: `iolta-discrepancy-${d.trustAccount.id}`,
        color: "red",
        title: `${d.trustAccount.state} IOLTA · ${d.trustAccount.account_name}`,
        subtitle:
          `Balance ${fmtMoney(d.trustAccount.current_balance)} vs log ` +
          `${fmtMoney(d.latestLogBalance)} (${sign}${fmtMoney(d.delta)})`,
        actionLabel: "Reconcile",
        // Rank ahead of lifecycle (1.5M) but behind autopay retries (1M)
        // so a regulatory-urgent IOLTA mismatch outranks billing-cycle
        // alerts but still respects in-progress retry queues.
        sortKey: 1_200_000 - new Date(d.latestRecordedAt).getTime() / 60_000,
        due: d.latestRecordedAt,
        onSelect: onSelect("iolta_discrepancy", d.trustAccount.id),
      });
    }
  }

  // ─── ORANGE — cancel requests > 14 days pending ───────────────────────
  for (const cr of src.cancelRequests) {
    if (cr.status !== "pending") continue;
    const age = now - new Date(cr.created_at).getTime();
    if (age < 14 * day) continue;
    const ageDays = Math.floor(age / day);
    out.push({
      id: `cancel-${cr.id}`,
      color: "orange",
      title: clientName(cr.client_id),
      subtitle:
        `Cancel request · pending ${ageDays} day${ageDays === 1 ? "" : "s"}` +
        (cr.reason_category ? ` · ${cr.reason_category}` : ""),
      actionLabel: "Resolve",
      sortKey: 2_000_000 - age / 60_000,
      due: cr.created_at,
      onSelect: onSelect("cancel_request", cr.id),
    });
  }

  // ─── YELLOW — pending IOLTA signoffs ──────────────────────────────────
  // Mirrors the AccountingPortal pendingSignoffCount predicate at :10804.
  for (const r of src.filedRegistry) {
    if (r.transfer_status !== "pending_signoff") continue;
    if (!r.case_number_verified) continue;
    if (r.iolta_balance_verified) continue;
    out.push({
      id: `signoff-${r.id}`,
      color: "yellow",
      title: clientName(r.client_id),
      subtitle: `IOLTA signoff · case ${r.case_number}`,
      actionLabel: "Sign off",
      sortKey: 3_000_000 - new Date(r.filed_date).getTime() / 60_000,
      due: r.filed_date,
      onSelect: onSelect("iolta_signoff", r.id),
    });
  }

  // ─── YELLOW — batch transfer approvals ────────────────────────────────
  for (const b of src.batchRequests) {
    if (b.status !== "pending_approval") continue;
    out.push({
      id: `batch-${b.id}`,
      color: "yellow",
      title: `${b.state} batch · ${b.client_count} client${b.client_count === 1 ? "" : "s"}`,
      subtitle: `Approve batch transfer · ${fmtMoney(b.total_amount)}`,
      actionLabel: "Approve",
      sortKey: 3_500_000 - new Date(b.submitted_at).getTime() / 60_000,
      due: b.submitted_at,
      onSelect: onSelect("batch_transfer", b.id),
    });
  }

  // ─── BLUE — payment-schedule installments due in 3 days ───────────────
  // Past-due installments are typically already captured by paymentRetries
  // (RED). This BLUE filter only surfaces upcoming ones that haven't tipped
  // into the retry queue yet.
  for (const s of src.scheduleEntries) {
    if (s.status !== "pending") continue;
    const due = new Date(s.due_date).getTime();
    if (due < now) continue;
    if (due > now + 3 * day) continue;
    out.push({
      id: `sched-${s.id}`,
      color: "blue",
      title: clientName(s.client_id),
      subtitle: `Installment #${s.installment_number} · ${fmtMoney(s.amount_due)}`,
      actionLabel: "Open",
      sortKey: 4_000_000 + due / 60_000,
      due: s.due_date,
      onSelect: onSelect("payment_schedule", s.id),
    });
  }

  // ─── BLUE — cancel-request tasks ──────────────────────────────────────
  for (const t of src.cancelTasks) {
    if (t.status !== "pending") continue;
    out.push({
      id: `cancel-task-${t.id}`,
      color: "blue",
      title: clientName(t.client_id),
      subtitle: `${t.task_type.replace(/_/g, " ")} · ${t.title}`,
      actionLabel: "Open",
      sortKey: 4_500_000 - new Date(t.created_at).getTime() / 60_000,
      due: t.created_at,
      onSelect: onSelect("cancel_request_task", t.id),
    });
  }

  // ─── Stable sort ─────────────────────────────────────────────────────
  // Color tier first, then overdue-first within tier, then sortKey.
  // Identical to the Intake-side rule so the visual ordering matches.
  const colorRank: Record<TaskColor, number> = { red: 0, orange: 1, yellow: 2, blue: 3 };
  const isOverdue = (t: TaskEntry) => !!t.due && new Date(t.due).getTime() < now;
  out.sort((a, b) => {
    const r = colorRank[a.color] - colorRank[b.color];
    if (r !== 0) return r;
    const oa = isOverdue(a) ? 0 : 1;
    const ob = isOverdue(b) ? 0 : 1;
    if (oa !== ob) return oa - ob;
    return a.sortKey - b.sortKey;
  });

  return out;
}
