// Accounting Department Dashboard — Slice 2 SKELETON (Prompt 55).
//
// Thin wrapper around the shared department-dashboard shell extracted
// in Slice 1 (Prompt 54). Every panel is a placeholder; real data
// wiring lands in subsequent slices per the Prompt 53 build order:
//
//   Slice 3 — LEFT widget: real accounting task pool
//     (autopay retries / pending signoffs / cancellations /
//      payment-schedule reminders / lifecycle alerts).
//   Slice 4 — MIDDLE Up Next: priority cascade over the same pool.
//   Slice 5 — TOP bubbles: real Trust Snapshot + Today Money In/Out.
//   Slice 6 — RIGHT comms: accounting transfer notices / refund notices.
//   Slice 7 — FOOTER: today's hour-by-hour payment schedule.
//
// The shell is deliberately data-source-agnostic — every component
// takes props. This file passes empty arrays + stub callbacks until
// the slice wiring lands. No accounting_* table is queried here.

import { useMemo, useState } from "react";
import {
  Banknote, CheckCircle2, Clock, MousePointerClick, SkipForward, Sparkles, Vault,
} from "lucide-react";
import type { DepartmentPortalSession } from "../department-portal/DepartmentPortalLogin";
import {
  DashboardGrid,
  AllTasksWidget,
  ConsolidatedMessagingWidget,
  BubbleCard,
  Card, CardHeader, CountBadge, EmptyHint,
  ColorDot, COLOR_CFG,
  ACCOUNTING_METRICS,
  formatDueLabel,
  todayInFirmTz,
} from "../department-dashboard";
import type { TaskEntry, StaffMessage } from "../department-dashboard";
import {
  buildAccountingTasks,
  detectTrustDiscrepancies,
  type AccountingTaskKind,
  type PaymentRetryRow,
  type LifecycleAlertRow,
  type CancelRequestRow,
  type FiledCaseRegistryRow,
  type BatchTransferRequestRow,
  type ScheduleEntryRow,
  type CancelRequestTaskRow,
  type ClientRow,
  type TrustAccountRow,
  type IoltaBalanceLogRow,
} from "./accountingTasks";

// Slice 5 (Prompt 58) — Today Money In/Out inputs not yet typed in
// accountingTasks (the bubble derives transient counts only, doesn't
// emit TaskEntry rows). Defined inline here as narrow row shapes.

interface PaymentRow {
  id: string;
  amount: number;
  payment_date: string;       // ISO; date or timestamp; we compare YYYY-MM-DD
  payment_method: string;
  voided: boolean;
}

interface AutopayEnrollmentRow {
  id: string;
  client_id: string;
  is_active: boolean;
  paused_until: string | null;
}

// Slice 6 (Prompt 59) — RIGHT-column money-comms inputs. Both sources
// are firm-internal accounting notices that we map onto the shell's
// StaffMessage shape so ConsolidatedMessagingWidget can render them
// without modification.

interface TransferNotificationRow {
  id: string;
  case_number: string;
  state: string;
  amount: number;
  status: "pending" | "actioned" | "dismissed";
  notify_after: string;
  created_at: string;
}

interface DisengagementNoticeRow {
  id: string;
  client_name: string;
  refund_amount: number;
  refund_status: "pending" | "calculated" | "approved" | "issued" | "not_applicable";
  status: "pending" | "sent" | "refund_pending" | "refund_issued" | "closed";
  created_at: string;
  email_sent_at: string | null;
}

// Slice 5 (Prompt 58) — money formatter for the bubble bodies. Local to
// the file to avoid yet another shared-primitives export.
const fmtMoney = (n: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2,
  }).format(n);

export interface AccountingDashboardProps {
  session: DepartmentPortalSession;
  // Slice 3 (Prompt 56) — task pool sources, threaded from AccountingPortal
  // which already loads them at mount. The dashboard does not re-query.
  paymentRetries:  ReadonlyArray<PaymentRetryRow>;
  lifecycleAlerts: ReadonlyArray<LifecycleAlertRow>;
  cancelRequests:  ReadonlyArray<CancelRequestRow>;
  filedRegistry:   ReadonlyArray<FiledCaseRegistryRow>;
  batchRequests:   ReadonlyArray<BatchTransferRequestRow>;
  scheduleEntries: ReadonlyArray<ScheduleEntryRow>;
  cancelTasks:     ReadonlyArray<CancelRequestTaskRow>;
  clients:         ReadonlyArray<ClientRow>;
  // Slice 5 (Prompt 58) — TOP bubbles inputs.
  trustAccounts:    ReadonlyArray<TrustAccountRow>;
  ioltaBalanceLog:  ReadonlyArray<IoltaBalanceLogRow>;
  payments:         ReadonlyArray<PaymentRow>;
  autopayEnrollments: ReadonlyArray<AutopayEnrollmentRow>;
  // Slice 6 (Prompt 59) — RIGHT-column money-comms inputs. Both already
  // loaded at AccountingPortal mount; pass through unchanged.
  transferNotifications: ReadonlyArray<TransferNotificationRow>;
  disengagementNotices:  ReadonlyArray<DisengagementNoticeRow>;
  /** Optional click-router. Today AccountingPortal can wire this to
   *  setTab + setSelectedClient when ready; the LEFT widget tolerates
   *  it being undefined (clicks are no-ops then). */
  onSelectTask?: (kind: AccountingTaskKind, id: string) => void;
}

export default function AccountingDashboard({
  session,
  paymentRetries, lifecycleAlerts, cancelRequests, filedRegistry,
  batchRequests, scheduleEntries, cancelTasks, clients,
  trustAccounts, ioltaBalanceLog, payments, autopayEnrollments,
  transferNotifications, disengagementNotices,
  onSelectTask,
}: AccountingDashboardProps) {
  // Slice 9 (per-staffer "Mine" vs "Shared pool") will use the existing
  // DepartmentPortalSession identity. Today the values are stubbed so the
  // toggles in AllTasksWidget render visually without doing anything.
  void session;

  const [leftMode, setLeftMode] = useState<"tasks" | "schedule">("tasks");
  // Slice 3 — task scope is "shared" by default until Slice 9 wires the
  // per-staffer filter on top of session identity.
  const [taskScope, setTaskScope] = useState<"mine" | "shared">("shared");

  // Slice 3 (Prompt 56) — real accounting task pool. Built from the
  // accounting_* tables AccountingPortal already loads at mount; no
  // additional fetches. See accountingTasks.ts for the color-tier
  // predicates + the deferred-TODOs (IOLTA balance discrepancy +
  // fee_adjustment_requests).
  const tasks = useMemo(
    () => buildAccountingTasks({
      paymentRetries, lifecycleAlerts, cancelRequests, filedRegistry,
      batchRequests, scheduleEntries, cancelTasks, clients,
      // Slice 5 — RED IOLTA-discrepancy tier
      trustAccounts, ioltaBalanceLog,
      onSelectTask,
    }),
    [paymentRetries, lifecycleAlerts, cancelRequests, filedRegistry,
     batchRequests, scheduleEntries, cancelTasks, clients,
     trustAccounts, ioltaBalanceLog, onSelectTask],
  );

  // Slice 5 (Prompt 58) — TOP bubbles derivations.

  // Trust Snapshot: per-state IOLTA balance roll-up + discrepancy list.
  const trustByState = useMemo(() => {
    const out = new Map<string, { iolta: number; operating: number }>();
    for (const ta of trustAccounts) {
      if (!ta.is_active) continue;
      const cur = out.get(ta.state) ?? { iolta: 0, operating: 0 };
      if (ta.account_type === "iolta") cur.iolta += ta.current_balance;
      else if (ta.account_type === "operating") cur.operating += ta.current_balance;
      out.set(ta.state, cur);
    }
    return [...out.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([state, b]) => ({ state, ...b }));
  }, [trustAccounts]);

  const discrepancies = useMemo(
    () => detectTrustDiscrepancies(trustAccounts, ioltaBalanceLog),
    [trustAccounts, ioltaBalanceLog],
  );

  // Today Money In/Out + Today's-payment-schedule footer: "today" is
  // computed in the firm timezone via the shell helper, matching the
  // Intake side's todaysAppts derivation. Earlier slices used a
  // browser-local fallback; Slice 7 swaps to the firm-TZ helper so the
  // bubble + the footer agree on the same calendar date.
  const today = useMemo(() => todayInFirmTz(), []);

  const collectedToday = useMemo(() => {
    let sum = 0;
    let n = 0;
    for (const p of payments) {
      if (p.voided) continue;
      // payment_date may be a date or a timestamp; compare the YYYY-MM-DD prefix.
      if (p.payment_date.slice(0, 10) !== today) continue;
      sum += p.amount;
      n++;
    }
    return { sum, n };
  }, [payments, today]);

  const autopayCounts = useMemo(() => {
    const activeEnrolled = autopayEnrollments.filter(
      a => a.is_active && (!a.paused_until || a.paused_until <= today),
    ).length;
    const retryingNow = paymentRetries.filter(r => r.status === "retrying").length;
    return { activeEnrolled, retryingNow };
  }, [autopayEnrollments, paymentRetries, today]);

  const expectedToday = useMemo(() => {
    let sum = 0;
    let n = 0;
    for (const s of scheduleEntries) {
      if (s.status !== "pending") continue;
      if (s.due_date.slice(0, 10) !== today) continue;
      sum += s.amount_due;
      n++;
    }
    return { sum, n };
  }, [scheduleEntries, today]);

  // Slice 6 (Prompt 59) — RIGHT-column money-comms.
  //
  // Maps two firm-internal accounting arrays into the shell's
  // StaffMessage shape so ConsolidatedMessagingWidget renders them
  // without modification. Both fit channel='email' (transfer
  // notifications + disengagement/refund notices are email-shaped).
  // No new fetches — both sources are already at the AccountingPortal
  // mount level. The widget's "threads" prop stays empty: client_message_threads
  // has no accounting category column yet (schema follow-up).
  const accountingStaffMsgs = useMemo<StaffMessage[]>(() => {
    const out: StaffMessage[] = [];

    for (const n of transferNotifications) {
      out.push({
        id:           `transfer-${n.id}`,
        sender_id:    "system",
        sender_name:  `${n.state} Trust Transfer`,
        sender_role:  "system_transfer_notice",
        channel:      "email",
        subject:      `Transfer ready · case ${n.case_number}`,
        body:         `${fmtMoney(n.amount)} — ${n.state}. Status: ${n.status}.`,
        // Treat pending notifications as "unread"; any actioned/dismissed
        // notice is already handled, so it's read.
        read:         n.status !== "pending",
        created_at:   n.notify_after || n.created_at,
      });
    }

    for (const d of disengagementNotices) {
      out.push({
        id:           `disengage-${d.id}`,
        sender_id:    "system",
        sender_name:  `Disengagement · ${d.client_name}`,
        sender_role:  "system_disengagement_notice",
        channel:      "email",
        subject:      `Disengagement · ${d.client_name}`,
        body:
          `Refund ${fmtMoney(d.refund_amount)} (${d.refund_status})` +
          ` · status: ${d.status.replace(/_/g, " ")}`,
        // Unread until the disengagement is closed or the refund issued.
        read:
          d.status === "closed"
          || d.refund_status === "issued"
          || d.refund_status === "not_applicable",
        created_at:   d.email_sent_at ?? d.created_at,
      });
    }

    return out;
  }, [transferNotifications, disengagementNotices]);

  // Slice 7 (Prompt 60) — today's-payment-schedule footer.
  //
  // accounting_payment_schedule.due_date is date-only (YYYY-MM-DD), so a
  // literal hour-by-hour grid like Intake's TodayByHourWidget doesn't
  // apply — there are no intraday timestamps to bucket. The mirror is
  // SHAPE (a today-scoped footer) not literal hour banding. Within
  // today we group by status: late → pending → paid → partial → waived,
  // and sort by installment_number within each group.
  const todaySchedule = useMemo(() => {
    const groups: Record<ScheduleEntryRow["status"], ScheduleEntryRow[]> = {
      late:    [],
      pending: [],
      paid:    [],
      partial: [],
      waived:  [],
    };
    let totalDue = 0;
    let totalPaid = 0;
    for (const s of scheduleEntries) {
      if (s.due_date.slice(0, 10) !== today) continue;
      groups[s.status]?.push(s);
      totalDue += s.amount_due;
      if (s.status === "paid" || s.status === "partial") totalPaid += s.amount_due;
    }
    // installment_number sort within each group.
    for (const k of Object.keys(groups) as Array<keyof typeof groups>) {
      groups[k].sort((a, b) => a.installment_number - b.installment_number);
    }
    const ordered = [...groups.late, ...groups.pending, ...groups.partial, ...groups.paid, ...groups.waived];
    return { groups, ordered, totalDue, totalPaid };
  }, [scheduleEntries, today]);

  // Slice 4 (Prompt 57) — MIDDLE Up Next.
  //
  // The pool is already sorted in buildAccountingTasks by:
  //   color tier  → overdue-first within tier  → sortKey
  // so the cascade RED → ORANGE → YELLOW → BLUE described in the prompt
  // falls out of the existing ordering — Up Next is simply the first
  // non-skipped task. No re-derivation here.
  const [skippedIds, setSkippedIds] = useState<ReadonlySet<string>>(() => new Set());
  const upNext: TaskEntry | null = useMemo(
    () => tasks.find(t => !skippedIds.has(t.id)) ?? null,
    [tasks, skippedIds],
  );
  const remainingCount = useMemo(
    () => tasks.filter(t => !skippedIds.has(t.id)).length,
    [tasks, skippedIds],
  );

  function handleSkip(id: string) {
    setSkippedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }
  // TODO Slice 8+ — Done/Pick backend wiring.
  //   Done: mark the underlying row resolved (status update on the source
  //         table, e.g. payment_retries.status='collected' or
  //         cancel_request_tasks.status='completed'). For now no-op so
  //         clicking it doesn't lie about persistence.
  //   Pick: route the staffer to the underlying row's detail surface
  //         (AccountingPortal tab + lead/client selection). Wires
  //         through the existing onSelectTask prop once that's plumbed.
  function handleDone(_id: string) { void _id; /* TODO Slice 8+ */ }
  function handlePick(_id: string) { void _id; /* TODO Slice 8+ */ }
  function handleReset() {
    setSkippedIds(new Set());
  }

  return (
    <div className="p-4 space-y-4 bg-[#0F0F0E] min-h-full">
      {/* Top bubbles row — Trust Snapshot + Today Money In/Out (Slice 5,
          Prompt 58). Real data from the accounting_* sources already
          loaded at the AccountingPortal mount. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BubbleCard
          title="Trust Snapshot"
          icon={<Vault className="w-4 h-4" />}
        >
          <div className="space-y-3">
            {trustByState.length === 0 ? (
              <p className="text-[11px] text-[#6B6B66] italic leading-relaxed">
                No active trust accounts on file.
              </p>
            ) : (
              <div className="space-y-1">
                {trustByState.map(r => (
                  <div
                    key={r.state}
                    className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 items-baseline text-[11px]"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#FAFAF7] w-6">
                      {r.state}
                    </span>
                    <span className="text-[10px] text-[#6B6B66]">
                      iolta · operating
                    </span>
                    <span className="text-[#FAFAF7] tabular-nums font-mono">
                      {fmtMoney(r.iolta)}
                    </span>
                    <span className="text-[#B8945F] tabular-nums font-mono">
                      {fmtMoney(r.operating)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Discrepancy section — only renders when at least one
                IOLTA account's current_balance disagrees with the log.
                Mirrors the RED-tier task surfaced in the LEFT widget. */}
            {discrepancies.length > 0 && (
              <div className="mt-3 pt-3 border-t border-red-500/30 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-red-300 border border-red-700/60 bg-red-900/40 px-1.5 py-0.5 rounded">
                    Discrepancy · {discrepancies.length}
                  </span>
                  <span className="text-[10px] text-[#6B6B66] italic">
                    current_balance vs iolta_balance_log
                  </span>
                </div>
                {discrepancies.slice(0, 3).map(d => (
                  <div key={d.trustAccount.id} className="text-[10px] leading-snug text-red-200/80">
                    <span className="font-semibold">{d.trustAccount.state}</span>
                    {" — "}
                    <span className="font-mono">{fmtMoney(d.trustAccount.current_balance)}</span>
                    {" vs log "}
                    <span className="font-mono">{fmtMoney(d.latestLogBalance)}</span>
                    {" ("}
                    <span className="font-mono">{d.delta > 0 ? "+" : ""}{fmtMoney(d.delta)}</span>
                    {")"}
                  </div>
                ))}
                {discrepancies.length > 3 && (
                  <p className="text-[10px] text-red-200/60 italic">
                    + {discrepancies.length - 3} more — see Up Next.
                  </p>
                )}
              </div>
            )}
          </div>
        </BubbleCard>

        <BubbleCard
          title="Today Money In/Out"
          icon={<Banknote className="w-4 h-4" />}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#6B6B66] mb-0.5">
                  Collected today
                </p>
                <p className="text-2xl font-bold text-emerald-300 leading-none tabular-nums">
                  {fmtMoney(collectedToday.sum)}
                </p>
                <p className="text-[10px] text-[#6B6B66] mt-1">
                  {collectedToday.n} payment{collectedToday.n === 1 ? "" : "s"}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#6B6B66] mb-0.5">
                  Expected today
                </p>
                <p className="text-2xl font-bold text-[#B8945F] leading-none tabular-nums">
                  {fmtMoney(expectedToday.sum)}
                </p>
                <p className="text-[10px] text-[#6B6B66] mt-1">
                  {expectedToday.n} installment{expectedToday.n === 1 ? "" : "s"} scheduled
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#2A2A28]/60">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#6B6B66] mb-0.5">
                  Active autopay
                </p>
                <p className="text-base font-bold text-[#FAFAF7] leading-none tabular-nums">
                  {autopayCounts.activeEnrolled}
                </p>
                <p className="text-[10px] text-[#6B6B66] mt-1">
                  enrolled clients
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#6B6B66] mb-0.5">
                  Retries open
                </p>
                <p className={`text-base font-bold leading-none tabular-nums ${autopayCounts.retryingNow > 0 ? "text-red-300" : "text-[#FAFAF7]"}`}>
                  {autopayCounts.retryingNow}
                </p>
                <p className="text-[10px] text-[#6B6B66] mt-1">
                  {autopayCounts.retryingNow > 0 ? "needs action — RED tier" : "all clear"}
                </p>
              </div>
            </div>

            <p className="text-[10px] text-[#3A3A36] italic leading-snug">
              Goal pace from {ACCOUNTING_METRICS.label} —{" "}
              {ACCOUNTING_METRICS.monthlyGoalLabel.toLowerCase()}.
            </p>
          </div>
        </BubbleCard>
      </div>

      {/* 3-col body via the shared DashboardGrid primitive. */}
      <DashboardGrid
        left={
          <AllTasksWidget
            tasks={tasks}
            sharedCount={tasks.length}
            mode={leftMode}
            onChangeMode={setLeftMode}
            scope={taskScope}
            onChangeScope={setTaskScope}
          />
        }
        middle={
          <UpNextCard
            task={upNext}
            remainingCount={remainingCount}
            totalCount={tasks.length}
            skippedCount={skippedIds.size}
            onSkip={handleSkip}
            onDone={handleDone}
            onPick={handlePick}
            onReset={handleReset}
          />
        }
        right={
          <ConsolidatedMessagingWidget
            // No accounting-tagged client_message_threads category exists
            // yet — schema follow-up. Until then "threads" is empty and
            // the widget's existing empty hint handles the path cleanly.
            threads={[]}
            staffMsgs={accountingStaffMsgs}
            loading={false}
            onOpenView={() => {
              /* TODO Slice 6+ — route to the accounting comms surface
                 (full transfer-notifications + disengagement-notices
                 detail). No-op until that surface is wired. */
            }}
            // Accounting-relevant subset. Drops sms / direct / team /
            // voicemails — neither accounting_transfer_notifications
            // nor disengagement_notices fit those channels and there's
            // no source to populate them today.
            enabledTabs={["all", "email"]}
          />
        }
      />

      {/* Today's payment schedule — Slice 7 (Prompt 60). Mirrors the
          shape of Intake's TodayByHourWidget but over
          accounting_payment_schedule. Schedule rows are date-only
          (no intraday timestamps), so the "hour-by-hour" framing is
          status-grouped today: late → pending → partial → paid →
          waived, installment_number-sorted within each group. */}
      <Card>
        <CardHeader
          icon={<Clock className="w-4 h-4" />}
          title="Today's payment schedule"
          badge={<CountBadge value={todaySchedule.ordered.length} />}
          chip={
            todaySchedule.ordered.length > 0 ? (
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#B8945F]">
                {fmtMoney(todaySchedule.totalPaid)} paid · {fmtMoney(todaySchedule.totalDue)} due
              </span>
            ) : null
          }
        />
        <div className="p-3">
          {todaySchedule.ordered.length === 0 ? (
            <EmptyHint>No payments scheduled today.</EmptyHint>
          ) : (
            <ul className="divide-y divide-[#2A2A28]">
              {todaySchedule.ordered.map(s => (
                <ScheduleFooterRow
                  key={s.id}
                  entry={s}
                  clientName={clients.find(c => c.id === s.client_id)?.full_name ?? "Client"}
                />
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── UpNextCard (Slice 4 — Prompt 57) ──────────────────────────────────────
//
// MIDDLE-column card. Surfaces the single highest-priority accounting task
// using the cascade RED → ORANGE → YELLOW → BLUE that's already baked into
// the Slice-3 task pool's sort. Skip advances locally (skippedIds set
// owned by the parent); Done / Pick are TODO no-ops until backend wiring
// — see the parent handlers for the schema plan.

function UpNextCard({
  task,
  remainingCount,
  totalCount,
  skippedCount,
  onSkip,
  onDone,
  onPick,
  onReset,
}: {
  task: TaskEntry | null;
  remainingCount: number;
  totalCount: number;
  skippedCount: number;
  onSkip: (id: string) => void;
  onDone: (id: string) => void;
  onPick: (id: string) => void;
  onReset: () => void;
}) {
  // Empty state — distinct from "all skipped" so the staffer knows
  // whether to reset or whether they're actually done.
  const allClear   = totalCount === 0;
  const allSkipped = totalCount > 0 && remainingCount === 0;

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={<Sparkles className="w-4 h-4" />}
        title="Up Next"
        badge={<CountBadge value={remainingCount} tone={task?.color === "red" ? "danger" : task?.color === "orange" ? "warn" : "neutral"} />}
        chip={
          skippedCount > 0 ? (
            <button
              type="button"
              onClick={onReset}
              title="Bring skipped tasks back to the queue"
              className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] hover:text-[#FAFAF7] hover:border-[#B8945F]/40 px-2 py-0.5 rounded transition-colors"
            >
              Reset · {skippedCount} skipped
            </button>
          ) : (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66]">
              Auto-prioritized
            </span>
          )
        }
      />
      <div className="p-3 space-y-3">
        {task ? (
          <UpNextActiveBody
            task={task}
            onSkip={onSkip}
            onDone={onDone}
            onPick={onPick}
          />
        ) : allSkipped ? (
          <div className="rounded-lg border border-dashed border-[#3A3A36] bg-[#0F0F0E] px-3 py-4 flex items-start gap-2.5">
            <SkipForward className="w-4 h-4 text-[#B8945F] mt-0.5 flex-shrink-0" />
            <div className="text-xs text-[#FAFAF7] leading-relaxed">
              <p className="font-semibold">All open tasks skipped this session.</p>
              <p className="text-[11px] text-[#6B6B66] mt-1">
                Click <span className="text-[#FAFAF7] font-semibold">Reset</span> above to bring them back to the queue.
              </p>
            </div>
          </div>
        ) : allClear ? (
          <div className="rounded-lg border border-emerald-700/30 bg-emerald-900/10 px-3 py-4 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-emerald-200 leading-relaxed">
              <p className="font-semibold">Inbox clear — no open accounting tasks.</p>
              <p className="text-[11px] text-emerald-300/70 mt-1">
                Up Next will surface the highest-priority item the moment one
                lands (autopay failures, IOLTA signoffs, &gt;14-day cancellations, …).
              </p>
            </div>
          </div>
        ) : (
          <EmptyHint>No task selected.</EmptyHint>
        )}
      </div>
    </Card>
  );
}

function UpNextActiveBody({
  task, onSkip, onDone, onPick,
}: {
  task: TaskEntry;
  onSkip: (id: string) => void;
  onDone: (id: string) => void;
  onPick: (id: string) => void;
}) {
  const overdue = !!task.due && new Date(task.due).getTime() < Date.now();
  const tierLabel = COLOR_CFG[task.color].label.toUpperCase();
  // Tone for the outer rounded card — color-tier-aware so RED jumps out.
  const toneCls =
    task.color === "red"    ? "border-red-500/40 bg-red-500/8" :
    task.color === "orange" ? "border-orange-500/40 bg-orange-500/8" :
    task.color === "yellow" ? "border-yellow-500/40 bg-yellow-500/8" :
                              "border-sky-500/30 bg-sky-500/5";

  return (
    <div className={`rounded-lg border ${toneCls} px-3 py-3`}>
      <div className="flex items-start gap-2">
        <ColorDot color={task.color} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#FAFAF7]">
              {tierLabel}
            </span>
            <span className="text-[9px] uppercase tracking-widest text-[#6B6B66]">
              · {task.actionLabel}
            </span>
            {overdue && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-red-300 border border-red-700/60 bg-red-900/40 px-1.5 py-0.5 rounded">
                Overdue
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-[#FAFAF7] mt-1.5 leading-tight">
            {task.title}
          </p>
          <p className="text-[11px] text-[#6B6B66] mt-1 leading-snug">
            {task.subtitle}
          </p>
          {task.due ? (
            <p className={`text-[10px] mt-1 font-mono ${overdue ? "text-red-300" : "text-[#B8945F]"}`}>
              Due {formatDueLabel(task.due)}
            </p>
          ) : (
            <p className="text-[10px] mt-1 text-[#3A3A36] italic">
              No due date on this record
            </p>
          )}
        </div>
      </div>

      {/* Action row — Skip / Done / Pick. Skip works (local advance);
          Done + Pick are TODO no-ops with explicit tooltip + dimming. */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#2A2A28]/60">
        <button
          type="button"
          onClick={() => onSkip(task.id)}
          title="Skip this task for now — advances to the next in the queue."
          className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#FAFAF7] bg-[#2A2A28] hover:bg-[#3A3A36] border border-[#3A3A36] rounded py-1.5 transition-colors"
        >
          <SkipForward className="w-3 h-3" /> Skip
        </button>
        <button
          type="button"
          onClick={() => onDone(task.id)}
          title="Mark this task done — local-only stub today; backend persistence lands in a later slice."
          className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#FAFAF7]/80 bg-emerald-900/30 hover:bg-emerald-900/40 border border-emerald-700/40 rounded py-1.5 transition-colors"
        >
          <CheckCircle2 className="w-3 h-3" /> Done
        </button>
        <button
          type="button"
          onClick={() => onPick(task.id)}
          title="Open this task — local-only stub today; navigates to the underlying row in a later slice."
          className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#FAFAF7]/80 bg-sky-900/30 hover:bg-sky-900/40 border border-sky-700/40 rounded py-1.5 transition-colors"
        >
          <MousePointerClick className="w-3 h-3" /> Pick
        </button>
      </div>
    </div>
  );
}

// ─── ScheduleFooterRow (Slice 7 — Prompt 60) ──────────────────────────────
//
// One row in the today's-payment-schedule footer. Status drives both the
// dot color and the right-side badge so the staffer can scan top-down by
// urgency. installment_number sits inline next to the client name to
// disambiguate when a client has multiple due-today entries.

function ScheduleFooterRow({
  entry, clientName,
}: {
  entry: ScheduleEntryRow;
  clientName: string;
}) {
  const cfg = SCHEDULE_STATUS_CFG[entry.status];
  return (
    <li className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 items-center py-2 px-1">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <div className="min-w-0">
        <p className="text-xs text-[#FAFAF7] truncate">
          {clientName}
          <span className="text-[10px] text-[#6B6B66] ml-1.5">
            · installment #{entry.installment_number}
          </span>
        </p>
      </div>
      <span className="text-xs font-mono tabular-nums text-[#FAFAF7]">
        {fmtMoney(entry.amount_due)}
      </span>
      <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${cfg.chip}`}>
        {cfg.label}
      </span>
    </li>
  );
}

const SCHEDULE_STATUS_CFG: Record<ScheduleEntryRow["status"], { label: string; dot: string; chip: string }> = {
  late:    { label: "Late",    dot: "bg-red-500",      chip: "bg-red-900/40 text-red-300 border-red-700/60" },
  pending: { label: "Due",     dot: "bg-amber-400",    chip: "bg-amber-900/30 text-amber-300 border-amber-700/60" },
  partial: { label: "Partial", dot: "bg-orange-400",   chip: "bg-orange-900/30 text-orange-300 border-orange-700/60" },
  paid:    { label: "Paid",    dot: "bg-emerald-500",  chip: "bg-emerald-900/30 text-emerald-300 border-emerald-700/60" },
  waived:  { label: "Waived",  dot: "bg-slate-500",    chip: "bg-slate-800/50 text-slate-300 border-slate-700/60" },
};
