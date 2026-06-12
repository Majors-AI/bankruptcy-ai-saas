// Legal Department Dashboard — Slice L-2 SKELETON (Prompt 62).
//
// Thin wrapper around the shared department-dashboard shell extracted
// in Slice 1 (Prompt 54). Every panel is a placeholder; real data
// wiring lands in subsequent slices per the Prompt 61 build order
// (L-2 → L-3 → L-4 → L-7 → L-5 → L-6 → L-10 → L-9 → L-8):
//
//   L-3 — LEFT widget: real legal task pool from
//         attorney_intake_reviews / signing_reviews / paralegal_reviews
//         / ecf_tasks (RED / ORANGE / YELLOW / BLUE tiered).
//   L-4 — MIDDLE Up Next: priority cascade over the same pool.
//   L-7 — FOOTER: today's hearings / signings / filing deadlines from
//         calendar_events (real timestamps, so this CAN be a literal
//         hour-by-hour grid — mirror the Intake TodayByHourWidget).
//   L-5 — TOP bubbles: Active Caseload + Today's Filings & Hearings.
//         Pending-discharge tracking partial until a discharge_at
//         column lands on attorney_case_acceptances or case_lifecycle.
//   L-6 — RIGHT comms: ECF inbox + attorney review status notices
//         mapped to StaffMessage; enabledTabs=["all","email"].
//
// The shell is deliberately data-source-agnostic — every component
// takes props. This file passes empty arrays + stub callbacks until
// the slice wiring lands. No table is queried here.
//
// CRITICAL: the dashboard reads intake_submissions.form_data (the
// questionnaire's emitted shape) via Supabase in future slices. The
// locked JSX at src/bankruptcy-information-and-document-questionnaire(1).jsx
// is NEVER imported or edited from this surface.

import { useMemo, useState } from "react";
import {
  Briefcase, CheckCircle2, Clock, MousePointerClick, Scale, SkipForward, Sparkles,
} from "lucide-react";
import type { DepartmentPortalSession } from "../department-portal/DepartmentPortalLogin";
import {
  DashboardGrid,
  AllTasksWidget,
  ConsolidatedMessagingWidget,
  BubbleCard,
  Card, CardHeader, CountBadge, EmptyHint,
  ColorDot, COLOR_CFG,
  LEGAL_METRICS,
  FIRM_TZ, todayInFirmTz, formatDueLabel,
} from "../department-dashboard";
import type { TaskEntry, StaffMessage } from "../department-dashboard";
import {
  buildLegalTasks,
  type AttorneyIntakeReviewRow,
  type SigningReviewRow,
  type ParalegalReviewRow,
  type EcfTaskRow,
  type IntakeLeadRow,
  type CalendarEventRow,
  type AcceptanceRow,
  type EcfInboxRow,
  type LegalTaskKind,
} from "./legalTasks";

export interface LegalDashboardProps {
  session: DepartmentPortalSession;
  // Slice L-3 (Prompt 63) — task pool sources, threaded from
  // LegalDepartmentPortal's mount-level Promise.all. The dashboard does
  // not re-query.
  attorneyIntakeReviews: ReadonlyArray<AttorneyIntakeReviewRow>;
  signingReviews:        ReadonlyArray<SigningReviewRow>;
  paralegalReviews:      ReadonlyArray<ParalegalReviewRow>;
  ecfTasks:              ReadonlyArray<EcfTaskRow>;
  intakeLeads:           ReadonlyArray<IntakeLeadRow>;
  // Slice L-7 (Prompt 65) — today's hearings/filings footer source.
  calendarEvents:        ReadonlyArray<CalendarEventRow>;
  // Slice L-5 (Prompt 66) — Active Caseload bubble source.
  acceptances:           ReadonlyArray<AcceptanceRow>;
  // Slice L-6 (Prompt 67) — RIGHT-column legal comms source.
  ecfInbox:              ReadonlyArray<EcfInboxRow>;
  /** Optional click-router; today LegalDepartmentPortal doesn't wire
   *  one (clicks no-op until L-9). */
  onSelectTask?: (kind: LegalTaskKind, id: string) => void;
}

export default function LegalDashboard({
  session,
  attorneyIntakeReviews, signingReviews, paralegalReviews, ecfTasks, intakeLeads,
  calendarEvents, acceptances, ecfInbox,
  onSelectTask,
}: LegalDashboardProps) {
  const [leftMode, setLeftMode] = useState<"tasks" | "schedule">("tasks");
  // Slice L-9 (Prompt 69) — per-staff filter scope. Default "shared"
  // preserves the existing dashboard behavior; flipping to "mine" applies
  // the assigned_name filter below. Mirrors the Prompt-52 Intake pattern.
  const [taskScope, setTaskScope] = useState<"mine" | "shared">("shared");

  // Slice L-3 (Prompt 63) — real legal task pool. Built from the four
  // source tables LegalDepartmentPortal loads at mount + intake_leads
  // for client-name lookup. See legalTasks.ts for the per-tier
  // predicates + the deferred-TODOs (signing scheduled_at, trustee_341,
  // ReReviewChip flag, pending_doc_requests, pleading_drafts, ecf_inbox).
  const tasks = useMemo(
    () => buildLegalTasks({
      attorneyIntakeReviews, signingReviews, paralegalReviews, ecfTasks, intakeLeads,
      onSelectTask,
    }),
    [attorneyIntakeReviews, signingReviews, paralegalReviews, ecfTasks, intakeLeads, onSelectTask],
  );

  // Slice L-9 (Prompt 69) — per-staff filter.
  //
  // "shared" → pass-through (full pool, identical to pre-L-9 behavior).
  // "mine"   → keep only tasks whose leadRef.assigned_name matches the
  //            session staffer (case-insensitive trim compare). Tasks
  //            with null assigned_name (signing_reviews, plus any
  //            attorney_intake_reviews / paralegal_reviews / ecf_tasks
  //            whose source column was empty) are DROPPED from Mine —
  //            an unassigned task isn't "mine" by definition. Matches the
  //            same key shape (staff_members.name) used by the Mine/
  //            Shared toggle in IntakeDashboard's Prompt-52 implementation.
  const filteredTasks = useMemo(() => {
    if (taskScope === "shared") return tasks;
    const mineKey = session.name.trim().toLowerCase();
    if (!mineKey) return tasks;
    return tasks.filter(t => {
      const owner = t.leadRef?.assigned_name;
      if (!owner) return false;
      return owner.trim().toLowerCase() === mineKey;
    });
  }, [tasks, taskScope, session.name]);

  // Slice L-4 (Prompt 64) — MIDDLE Up Next.
  //
  // The pool is already sorted in buildLegalTasks by:
  //   color tier → overdue-first within tier → sortKey
  // so the cascade RED → ORANGE → YELLOW → BLUE described in the prompt
  // falls out of the existing ordering — Up Next is simply the first
  // non-skipped task. No re-derivation here. Direct port of
  // AccountingDashboard's Slice-4 pattern; UpNextCard / UpNextActiveBody
  // are duplicated below the host until a shared shell hoist lands.
  //
  // Slice L-9 (Prompt 69) — Up Next picks from filteredTasks so the
  // scope toggle affects "what's next for me" vs "what's next for the firm".
  const [skippedIds, setSkippedIds] = useState<ReadonlySet<string>>(() => new Set());
  const upNext: TaskEntry | null = useMemo(
    () => filteredTasks.find(t => !skippedIds.has(t.id)) ?? null,
    [filteredTasks, skippedIds],
  );
  const remainingCount = useMemo(
    () => filteredTasks.filter(t => !skippedIds.has(t.id)).length,
    [filteredTasks, skippedIds],
  );

  function handleSkip(id: string) {
    setSkippedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }
  // TODO L-8+ — Done/Pick backend wiring.
  //   Done: mark the underlying row resolved (status update on the source
  //         table, e.g. attorney_intake_reviews.decision='accepted' or
  //         ecf_tasks.status='completed'). For now no-op so clicking
  //         doesn't lie about persistence.
  //   Pick: route the staffer to the underlying row's detail surface
  //         (LegalDepartmentPortal section + lead/client selection).
  //         Wires through the existing onSelectTask prop once that's
  //         plumbed (today: undefined → click is a no-op).
  function handleDone(_id: string) { void _id; /* TODO L-8+ */ }
  function handlePick(_id: string) { void _id; /* TODO L-8+ */ }
  function handleReset() {
    setSkippedIds(new Set());
  }

  // Slice L-7 (Prompt 65) — today's hearings/filings hour grid.
  //
  // Filter the loaded calendar_events down to today (firm TZ) + live
  // statuses, then bucket by hour-of-start_time in firm TZ. Past
  // entries (start_time < now) get a "past" flag; upcoming get the
  // default amber tone. cancelled / rescheduled are dropped.
  //
  // Footer renders the hours that have at least one event (no empty
  // 8-hour grid scaffold); empty state when zero events for today.
  const today = useMemo(() => todayInFirmTz(), []);

  const todayHourGroups = useMemo(() => {
    const now = Date.now();
    type Bucket = {
      hour: number;             // 0-23 in firm TZ
      hourLabel: string;        // "9 AM" / "1 PM"
      events: Array<{
        evt: CalendarEventRow;
        startIso: string;
        endIso: string;
        isPast: boolean;
        timeLabel: string;      // "9:30 AM"
      }>;
    };
    const buckets = new Map<number, Bucket>();
    const fmtTime = (iso: string) =>
      new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", hour12: true, timeZone: FIRM_TZ,
      });
    const hourLabel = (h: number) => {
      const am = h < 12;
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12} ${am ? "AM" : "PM"}`;
    };

    for (const e of calendarEvents) {
      // Skip cancelled / rescheduled — those moved out of today's view.
      if (e.status === "cancelled" || e.status === "rescheduled") continue;
      // Firm-TZ date of start_time → only today.
      const dueDay = new Date(e.start_time).toLocaleDateString("en-CA", { timeZone: FIRM_TZ });
      if (dueDay !== today) continue;

      // Hour-of-day in firm TZ.
      const hourStr = new Date(e.start_time).toLocaleTimeString("en-US", {
        hour: "numeric", hour12: false, timeZone: FIRM_TZ,
      });
      const hour = parseInt(hourStr, 10) || 0;

      const isPast = new Date(e.start_time).getTime() < now;
      const bucket = buckets.get(hour) ?? {
        hour,
        hourLabel: hourLabel(hour),
        events: [],
      };
      bucket.events.push({
        evt: e,
        startIso: e.start_time,
        endIso: e.end_time,
        isPast,
        timeLabel: fmtTime(e.start_time),
      });
      buckets.set(hour, bucket);
    }

    // Sort hours ascending; sort events within each hour by start_time.
    const ordered = [...buckets.values()].sort((a, b) => a.hour - b.hour);
    for (const b of ordered) {
      b.events.sort((x, y) => new Date(x.startIso).getTime() - new Date(y.startIso).getTime());
    }
    const totalCount = ordered.reduce((s, b) => s + b.events.length, 0);
    const upcomingCount = ordered.reduce(
      (s, b) => s + b.events.filter(e => !e.isPast).length,
      0,
    );
    return { ordered, totalCount, upcomingCount };
  }, [calendarEvents, today]);

  // Slice L-5 (Prompt 66) — Active Caseload bubble derivation.
  //
  // Retained-by-chapter:
  //   Walk intake_leads where status='retained'. For each lead, prefer
  //   attorney_case_acceptances.chapter (source-of-truth, set at acceptance);
  //   fall back to intake_leads.chapter_interest when no acceptance row
  //   matches. Group into 7 / 13 / unknown.
  //
  // Filed-vs-Retained is PARTIAL today: filed state requires
  // accounting_filed_case_registry (cross-portal), so the bubble shows
  // "Filed" + "Pending Discharge" as TODO placeholders. The user said
  // PARTIAL is expected — we don't fake those numbers.
  const caseload = useMemo(() => {
    // Lookup map: lead_id → chapter from accepted acceptances.
    const acceptedChapter = new Map<string, number | null>();
    for (const a of acceptances) {
      if (a.decision !== "accepted") continue;
      if (!a.lead_id) continue;
      // Keep the most recent acceptance per lead (the load is ordered
      // decided_at desc, so the first one wins; ignore later overrides).
      if (!acceptedChapter.has(a.lead_id)) {
        acceptedChapter.set(a.lead_id, a.chapter);
      }
    }
    const counts = { ch7: 0, ch13: 0, unknown: 0 };
    let totalRetained = 0;
    for (const l of intakeLeads) {
      if (l.status !== "retained") continue;
      totalRetained++;
      const chapter = acceptedChapter.get(l.id) ?? l.chapter_interest ?? null;
      if (chapter === 7)        counts.ch7++;
      else if (chapter === 13)  counts.ch13++;
      else                      counts.unknown++;
    }
    const totalAccepted = acceptedChapter.size;
    return { counts, totalRetained, totalAccepted };
  }, [intakeLeads, acceptances]);

  // Slice L-5 — Today's Filings & Hearings bubble derivation.
  //
  // Pure re-aggregation of the already-loaded calendarEvents, scoped to
  // today (firm TZ). Count by calendar_type. Cancelled / rescheduled
  // events skip — same filter as the footer in L-7.
  const todaySummary = useMemo(() => {
    const counts = {
      hearings: 0,
      deadlines: 0,
      signings: 0,
      docReviews: 0,
      other: 0,
    };
    for (const e of calendarEvents) {
      if (e.status === "cancelled" || e.status === "rescheduled") continue;
      const dueDay = new Date(e.start_time).toLocaleDateString("en-CA", { timeZone: FIRM_TZ });
      if (dueDay !== today) continue;
      if (e.calendar_type === "court_hearing")      counts.hearings++;
      else if (e.calendar_type === "court_deadline") counts.deadlines++;
      else if (e.calendar_type === "signing")        counts.signings++;
      else if (e.calendar_type === "doc_review")     counts.docReviews++;
      else                                            counts.other++;
    }
    const total = counts.hearings + counts.deadlines + counts.signings + counts.docReviews + counts.other;
    return { counts, total };
  }, [calendarEvents, today]);

  // Slice L-6 (Prompt 67) — RIGHT-column legal comms.
  //
  // Maps two firm-internal legal arrays into the shell's StaffMessage
  // shape so ConsolidatedMessagingWidget renders them unchanged.
  //   • ecf_inbox       → incoming PACER/docket notices (channel='email';
  //                       docket entries are court-served notices)
  //   • attorney_intake_reviews (decision='pending', already loaded) →
  //                       "needs review" status notices to the assigned
  //                       attorney (channel='email'; firm-internal handoff)
  // Both fit channel='email'. No new fetch for the reviews; ecf_inbox is
  // the ONE new read added at the portal mount. Threads stays [] —
  // client_message_threads has no legal-category tagging today (same gap
  // as Accounting Slice 6; schema follow-up).
  const legalStaffMsgs = useMemo<StaffMessage[]>(() => {
    const out: StaffMessage[] = [];
    const leadNameById = new Map(intakeLeads.map(l => [l.id, l.full_name]));

    // ─── ecf_inbox → docket notice rows ────────────────────────────
    for (const e of ecfInbox) {
      // Human-friendly filing type: 'motion_for_relief' → 'Motion For Relief'
      const filingLabel = e.filing_type
        .split("_")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      const caseTag = e.case_number ? ` · case ${e.case_number}` : "";
      out.push({
        id:           `ecf-inbox-${e.id}`,
        sender_id:    "court",
        sender_name:  e.filed_by || "ECF (PACER)",
        sender_role:  "system_ecf_notice",
        channel:      "email",
        subject:      `${filingLabel}${caseTag}`,
        body:         e.docket_entry || "(no docket text)",
        // Unread until the firm has triaged: status='pending' means no
        // ecf_task has been created yet. task_created / responded /
        // dismissed all count as already handled.
        read:         e.status !== "pending",
        // filed_date is date-only; created_at is the timestamp the row
        // landed in the inbox — prefer that for sort precision.
        created_at:   e.created_at,
      });
    }

    // ─── attorney_intake_reviews → "needs review" status notices ───
    // The pending-review pool already loaded for the LEFT-column task
    // pool is re-purposed here as a comms stream: each pending review
    // is effectively a notice to the assigned attorney that an intake
    // is waiting on them. No new fetch.
    for (const r of attorneyIntakeReviews) {
      if (r.decision !== "pending") continue;
      const leadName = r.lead_id ? (leadNameById.get(r.lead_id) ?? null) : null;
      const subject = leadName
        ? `Attorney review needed · ${leadName}`
        : `Attorney review needed`;
      out.push({
        id:           `att-review-${r.id}`,
        sender_id:    "system",
        sender_name:  r.attorney_name || "Intake handoff",
        sender_role:  "system_attorney_review_notice",
        channel:      "email",
        subject,
        body:
          `Pending attorney decision on intake submission` +
          (r.submission_id ? ` (${r.submission_id.slice(0, 8)}…)` : "") +
          ` · review_status: ${r.review_status}`,
        // All loaded rows are decision='pending' → unread until the
        // attorney makes a decision (decided_at flips).
        read:         r.decided_at !== null,
        created_at:   r.created_at,
      });
    }

    // Newest-first across both sources.
    out.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return out;
  }, [ecfInbox, attorneyIntakeReviews, intakeLeads]);

  return (
    <div className="p-4 space-y-4 bg-[#0F0F0E] min-h-full">
      {/* Top bubbles row — legal-specific (Active Caseload + Today's
          Filings & Hearings). Uses the shared BubbleCard primitive so
          the chrome matches the Accounting + Intake dashboards. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BubbleCard
          title="Active Caseload"
          icon={<Briefcase className="w-4 h-4" />}
        >
          <div className="space-y-3">
            {/* Retained-by-chapter grid */}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#6B6B66] mb-1.5">
                Retained
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-2xl font-bold text-[#FAFAF7] leading-none tabular-nums">
                    {caseload.counts.ch7}
                  </p>
                  <p className="text-[10px] text-[#6B6B66] mt-1">Ch. 7</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#FAFAF7] leading-none tabular-nums">
                    {caseload.counts.ch13}
                  </p>
                  <p className="text-[10px] text-[#6B6B66] mt-1">Ch. 13</p>
                </div>
                <div>
                  <p className={`text-2xl font-bold leading-none tabular-nums ${caseload.counts.unknown > 0 ? "text-amber-300" : "text-[#FAFAF7]"}`}>
                    {caseload.counts.unknown}
                  </p>
                  <p className="text-[10px] text-[#6B6B66] mt-1">Chapter unset</p>
                </div>
              </div>
            </div>

            {/* Filed + Pending Discharge — both deferred. Render dimmed
                "—" so the slot is visible but never lies. */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#2A2A28]/60">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#6B6B66] mb-0.5">
                  Filed
                </p>
                <p className="text-base font-mono text-[#3A3A36] italic" title="Source is accounting_filed_case_registry (cross-portal). Adding it is a future-slice read.">
                  —
                </p>
                <p className="text-[10px] text-[#6B6B66] mt-1 italic">
                  awaits cross-portal read
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#6B6B66] mb-0.5">
                  Pending discharge
                </p>
                <p className="text-base font-mono text-[#3A3A36] italic" title="No discharge_at / case_closed_at column on attorney_case_acceptances today; deferred until that schema lands.">
                  —
                </p>
                <p className="text-[10px] text-[#6B6B66] mt-1 italic">
                  awaits schema column
                </p>
              </div>
            </div>

            <p className="text-[10px] text-[#6B6B66] leading-snug">
              {caseload.totalRetained} retained ·{" "}
              {caseload.totalAccepted} accepted (lifetime).
              Chapter from attorney_case_acceptances when set, else intake_leads.chapter_interest.
            </p>
          </div>
        </BubbleCard>

        <BubbleCard
          title="Today's Filings & Hearings"
          icon={<Scale className="w-4 h-4" />}
        >
          <div className="space-y-3">
            {todaySummary.total === 0 ? (
              <p className="text-[11px] text-[#6B6B66] italic leading-relaxed">
                Nothing on the legal calendar for today.
              </p>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#FAFAF7] leading-none tabular-nums">
                    {todaySummary.total}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-[#6B6B66]">
                    events today
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <TodaySummaryRow
                    label="Hearings"
                    count={todaySummary.counts.hearings}
                    dot="bg-red-500"
                  />
                  <TodaySummaryRow
                    label="Deadlines"
                    count={todaySummary.counts.deadlines}
                    dot="bg-orange-400"
                  />
                  <TodaySummaryRow
                    label="Signings"
                    count={todaySummary.counts.signings}
                    dot="bg-yellow-400"
                  />
                  <TodaySummaryRow
                    label="Doc reviews"
                    count={todaySummary.counts.docReviews}
                    dot="bg-sky-400"
                  />
                  {todaySummary.counts.other > 0 && (
                    <TodaySummaryRow
                      label="Other"
                      count={todaySummary.counts.other}
                      dot="bg-slate-500"
                    />
                  )}
                </div>
              </>
            )}

            <p className="text-[10px] text-[#3A3A36] italic leading-snug">
              Source: calendar_events?department=eq.legal (start_time today).
              Goal pace from
              <span className="text-[#6B6B66] font-semibold">
                {" "}{LEGAL_METRICS.label}
              </span>{" "}— {LEGAL_METRICS.monthlyGoalLabel.toLowerCase()}.
            </p>
          </div>
        </BubbleCard>
      </div>

      {/* 3-col body via the shared DashboardGrid primitive. */}
      <DashboardGrid
        left={
          <AllTasksWidget
            // Slice L-9 (Prompt 69) — feed the post-scope list as the
            // visible pool. AllTasksWidget reads tasks.length as the
            // "mine" count and sharedCount as the "shared pool · N"
            // label, so passing filteredTasks here + tasks.length to
            // sharedCount makes both badges accurate in either scope.
            tasks={filteredTasks}
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
            // Slice L-9 (Prompt 69) — UpNextCard's "X of N" footer reads
            // totalCount; reflect the active scope so the math matches
            // what the staffer sees in the LEFT pool.
            totalCount={filteredTasks.length}
            skippedCount={skippedIds.size}
            onSkip={handleSkip}
            onDone={handleDone}
            onPick={handlePick}
            onReset={handleReset}
          />
        }
        right={
          <ConsolidatedMessagingWidget
            // No legal-tagged client_message_threads category exists yet —
            // schema follow-up (same gap as Accounting Slice 6). Until then
            // "threads" is empty and the widget's existing empty hint
            // handles the path cleanly.
            threads={[]}
            staffMsgs={legalStaffMsgs}
            loading={false}
            onOpenView={() => {
              /* TODO Slice L-6+ — route to the dedicated legal comms
                 surface (ECF inbox detail + attorney intake review queue).
                 No-op until that surface is wired. */
            }}
            // Legal-relevant subset. Drops sms / direct / team / voicemails
            // — ECF notices + attorney-review handoffs are firm-internal
            // email-shaped; SMS / voicemails aren't part of the legal-
            // department comms path today.
            enabledTabs={["all", "email"]}
          />
        }
      />

      {/* Today's hearings / signings / filing deadlines — Slice L-7
          (Prompt 65). calendar_events.start_time is a real timestamp,
          so this is a literal hour-by-hour grid (unlike Accounting's
          date-only payment-schedule fallback). Mirrors the shape of
          Intake's TodayByHourWidget; a future cleanup can hoist the
          Intake widget into the shared shell and consolidate. */}
      <Card>
        <CardHeader
          icon={<Clock className="w-4 h-4" />}
          title="Today's hearings & filings"
          badge={<CountBadge value={todayHourGroups.totalCount} />}
          chip={
            todayHourGroups.totalCount > 0 ? (
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#B8945F]">
                {todayHourGroups.upcomingCount} upcoming · {todayHourGroups.totalCount - todayHourGroups.upcomingCount} past
              </span>
            ) : null
          }
        />
        <div className="p-3">
          {todayHourGroups.totalCount === 0 ? (
            <EmptyHint>No hearings or filings scheduled today.</EmptyHint>
          ) : (
            <ul className="divide-y divide-[#2A2A28]">
              {todayHourGroups.ordered.map(bucket => (
                <li key={bucket.hour} className="py-2">
                  <div className="flex items-baseline gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#B8945F] w-12 flex-shrink-0">
                      {bucket.hourLabel}
                    </span>
                    <ul className="flex-1 space-y-1.5">
                      {bucket.events.map(({ evt, isPast, timeLabel }) => (
                        <LegalScheduleRow
                          key={evt.id}
                          event={evt}
                          timeLabel={timeLabel}
                          isPast={isPast}
                        />
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── LegalScheduleRow (Slice L-7 — Prompt 65) ─────────────────────────────
//
// One row in today's hour grid. Status / calendar_type drives the badge
// color; past entries dim. Title + client + case_number layered for the
// staffer's at-a-glance read.

function LegalScheduleRow({
  event, timeLabel, isPast,
}: {
  event: CalendarEventRow;
  timeLabel: string;
  isPast: boolean;
}) {
  const cfg = CALENDAR_TYPE_CFG[event.calendar_type] ?? CALENDAR_TYPE_CFG.default;
  const statusCfg = CALENDAR_STATUS_CFG[event.status] ?? null;
  const dim = isPast ? "opacity-60" : "";
  const titleText = event.title || cfg.label;
  return (
    <li className={`grid grid-cols-[auto_1fr_auto] gap-x-3 items-baseline ${dim}`}>
      <span className="text-[10px] font-mono text-[#FAFAF7] tabular-nums w-14">
        {timeLabel}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-[#FAFAF7] truncate">
          {titleText}
          {event.client_name && (
            <span className="text-[10px] text-[#6B6B66] ml-1.5">
              · {event.client_name}
            </span>
          )}
          {event.case_number && (
            <span className="text-[10px] text-[#6B6B66] ml-1.5">
              · case {event.case_number}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${cfg.chip}`}>
          {cfg.label}
        </span>
        {statusCfg && (
          <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${statusCfg.chip}`}>
            {statusCfg.label}
          </span>
        )}
      </div>
    </li>
  );
}

// Type / status style maps — kept compact at module scope so they live
// next to the row component. calendar_type values come from the
// 20260502012101_create_firm_calendar_schema migration.
const CALENDAR_TYPE_CFG: Record<string, { label: string; chip: string }> = {
  court_hearing:   { label: "Hearing",   chip: "bg-red-900/40 text-red-300 border-red-700/60" },
  court_deadline:  { label: "Deadline",  chip: "bg-orange-900/30 text-orange-300 border-orange-700/60" },
  signing:         { label: "Signing",   chip: "bg-yellow-900/30 text-yellow-300 border-yellow-700/60" },
  doc_review:      { label: "Doc Rev",   chip: "bg-sky-900/30 text-sky-300 border-sky-700/60" },
  intake:          { label: "Intake",    chip: "bg-slate-800/50 text-slate-300 border-slate-700/60" },
  default:         { label: "Event",     chip: "bg-slate-800/50 text-slate-300 border-slate-700/60" },
};

// Status badge — only render for completed / no_show / confirmed (the
// outliers worth surfacing inline). 'scheduled' is the default and
// renders no badge to keep the row clean.
const CALENDAR_STATUS_CFG: Record<string, { label: string; chip: string } | undefined> = {
  completed:  { label: "Done",     chip: "bg-emerald-900/30 text-emerald-300 border-emerald-700/60" },
  no_show:    { label: "No show",  chip: "bg-red-900/40 text-red-300 border-red-700/60" },
  confirmed:  { label: "Confirmed", chip: "bg-emerald-900/20 text-emerald-300 border-emerald-700/40" },
  scheduled:  undefined,
};

// ─── UpNextCard (Slice L-4 — Prompt 64) ───────────────────────────────────
//
// MIDDLE-column card. Direct port of AccountingDashboard's Slice-4
// UpNextCard. Surfaces the single highest-priority legal task using the
// cascade RED → ORANGE → YELLOW → BLUE that's already baked into the
// buildLegalTasks sort. Skip advances locally (skippedIds set owned by
// the parent); Done / Pick are TODO no-ops until backend wiring — see
// the parent handlers for the schema plan.
//
// Duplicated rather than shared with AccountingDashboard's UpNextCard
// per the prompt's "porting/duplicating is fine to keep this slice tight;
// extracting a shared UpNextCard into the shell can be a later cleanup".

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
              <p className="font-semibold">Inbox clear — no open legal tasks.</p>
              <p className="text-[11px] text-emerald-300/70 mt-1">
                Up Next will surface the highest-priority item the moment one
                lands (stale attorney review, signing past 7 days, ECF deadlines, …).
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

// ─── TodaySummaryRow (Slice L-5 — Prompt 66) ──────────────────────────────
//
// One row inside the Today's Filings & Hearings bubble's count grid.
// Color dot matches the L-7 footer style map so the bubble + footer
// look like the same surface at a glance.

function TodaySummaryRow({
  label, count, dot,
}: {
  label: string;
  count: number;
  dot: string;       // tailwind class, e.g. "bg-red-500"
}) {
  return (
    <div className="flex items-start gap-1.5">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-[#6B6B66] truncate">{label}</p>
      </div>
      <span className={`text-xs font-bold flex-shrink-0 tabular-nums ${count > 0 ? "text-[#FAFAF7]" : "text-[#6B6B66]"}`}>
        {count}
      </span>
    </div>
  );
}
