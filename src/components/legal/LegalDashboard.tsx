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
import { Briefcase, Clock, ListChecks, Scale } from "lucide-react";
import type { DepartmentPortalSession } from "../department-portal/DepartmentPortalLogin";
import {
  DashboardGrid,
  AllTasksWidget,
  ConsolidatedMessagingWidget,
  BubbleCard,
  Card, CardHeader, CountBadge, EmptyHint,
  LEGAL_METRICS,
} from "../department-dashboard";
import {
  buildLegalTasks,
  type AttorneyIntakeReviewRow,
  type SigningReviewRow,
  type ParalegalReviewRow,
  type EcfTaskRow,
  type IntakeLeadRow,
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
  /** Optional click-router; today LegalDepartmentPortal doesn't wire
   *  one (clicks no-op until L-9). */
  onSelectTask?: (kind: LegalTaskKind, id: string) => void;
}

export default function LegalDashboard({
  session,
  attorneyIntakeReviews, signingReviews, paralegalReviews, ecfTasks, intakeLeads,
  onSelectTask,
}: LegalDashboardProps) {
  // L-9 (per-staffer "Mine" vs "Shared pool") will use the existing
  // DepartmentPortalSession identity. Today the values are stubbed so
  // the toggles in AllTasksWidget render visually without doing
  // anything substantive.
  void session;

  const [leftMode, setLeftMode] = useState<"tasks" | "schedule">("tasks");
  // L-3 default scope is "shared" until L-9 wires the per-staffer filter
  // on top of session identity.
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

  return (
    <div className="p-4 space-y-4 bg-[#0F0F0E] min-h-full">
      {/* Top bubbles row — legal-specific (Active Caseload + Today's
          Filings & Hearings). Uses the shared BubbleCard primitive so
          the chrome matches the Accounting + Intake dashboards. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BubbleCard
          title="Active Caseload"
          icon={<Briefcase className="w-4 h-4" />}
          scaffold
        >
          <div className="space-y-2">
            <p className="text-[11px] text-[#6B6B66] leading-relaxed">
              Per-chapter case counts (Ch.7 vs Ch.13) — filed vs retained-not-filed.
            </p>
            <p className="text-[10px] text-[#3A3A36] italic leading-snug">
              Sources (L-5): attorney_case_acceptances + accounting_filed_case_registry
              (cross-portal read). Pending-discharge slice deferred until a
              discharge_at / case_closed_at column lands on
              attorney_case_acceptances. Until then the bubble reports
              filed + retained counts only.
            </p>
          </div>
        </BubbleCard>

        <BubbleCard
          title="Today's Filings & Hearings"
          icon={<Scale className="w-4 h-4" />}
          scaffold
        >
          <div className="space-y-2">
            <p className="text-[11px] text-[#6B6B66] leading-relaxed">
              341 meetings, court hearings, and filing deadlines for today.
            </p>
            <p className="text-[10px] text-[#3A3A36] italic leading-snug">
              Sources (L-5): calendar_events?department=eq.legal (start_time
              today) + trustee_341_checklist_state (meeting_date today) +
              ecf_tasks (due_date today). Goal pace from
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
            tasks={tasks}
            sharedCount={tasks.length}
            mode={leftMode}
            onChangeMode={setLeftMode}
            scope={taskScope}
            onChangeScope={setTaskScope}
          />
        }
        middle={
          <Card className="flex flex-col">
            <CardHeader
              icon={<ListChecks className="w-4 h-4" />}
              title="Up Next"
              badge={<CountBadge value={0} />}
              chip={
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-2 py-0.5 rounded">
                  Scaffold
                </span>
              }
            />
            <div className="p-3 space-y-2">
              <EmptyHint>
                Up Next surfaces the highest-priority legal task. L-4 will
                build the priority cascade (stale attorney review → past-deadline
                signing → 341 within 7 days → ECF task overdue → pending paralegal
                review → upcoming filings).
              </EmptyHint>
            </div>
          </Card>
        }
        right={
          <ConsolidatedMessagingWidget
            threads={[]}
            staffMsgs={[]}
            loading={false}
            onOpenView={() => {
              /* L-6 will route to the legal comms surface (ECF inbox +
                 attorney intake review status notices). No-op until
                 that surface is wired. */
            }}
            // Legal-relevant subset. Drops sms / direct / team / voicemails
            // — ECF notices are firm-internal email-shaped (L-6); SMS /
            // voicemails aren't part of the legal-department comms path.
            enabledTabs={["all", "email"]}
          />
        }
      />

      {/* Today's hearings / signings / filing deadlines footer placeholder.
          Unlike accounting_payment_schedule, calendar_events.start_time IS
          a timestamp — L-7 will render this as a literal hour-by-hour
          grid mirroring Intake's TodayByHourWidget (small extraction
          follow-up: hoist that widget into the shared shell). */}
      <Card>
        <CardHeader
          icon={<Clock className="w-4 h-4" />}
          title="Today's hearings & filings"
          chip={
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-2 py-0.5 rounded">
              Scaffold
            </span>
          }
        />
        <div className="p-3">
          <EmptyHint>
            Hour-by-hour court hearings + 341 meetings + signing
            appointments + filing deadlines. L-7 wires from
            calendar_events?department=eq.legal (today) +
            trustee_341_checklist_state.
          </EmptyHint>
        </div>
      </Card>
    </div>
  );
}
