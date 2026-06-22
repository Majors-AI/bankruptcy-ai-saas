// buildQueueRows — derive the R3 Queue's case-row list from the
// LegalDepartmentPortal mount-level Promise.all data bundle.
//
// PURE FUNCTION — no I/O, no React. One row per intake_lead that has
// reached at least the 'submitted' pipeline stage (pre-submission leads
// are excluded; they live in the Leads utility-rail panel, not the
// Queue).
//
// Stage derivation reuses `derivePipelineStage()` from
// `src/lib/pipelineStage.ts` so the Queue's badges stay in sync with
// the Pipeline bar's stage display when a case opens.

import {
  derivePipelineStage,
  type CaseSignals,
} from "../lib/pipelineStage";
import {
  needsAction,
  type LegalRole,
  type StageKey,
} from "./legalPortalTokens";
import type {
  AttorneyIntakeReviewRow,
  SigningReviewRow,
  ParalegalReviewRow,
  IntakeLeadRow,
  AcceptanceRow,
  FiledCaseRegistryRow,
} from "../components/legal/legalTasks";

export interface QueueRow {
  leadId: string;
  clientName: string;
  chapter: "7" | "13" | null;
  stage: StageKey;
  nextStepKey: StageKey;       // same as stage; kept distinct in case we ever override
  /** Who's the active assignee on this case (best-effort: paralegal_name from
   *  paralegal_reviews, then attorney_name from attorney_intake_reviews,
   *  then "Unassigned"). */
  assignee: string;
  /** Human-readable last-update timestamp source — newest of the relevant
   *  review rows for the case. Returned as ISO string for the consumer
   *  to format. */
  updatedAt: string | null;
  /** True when the current role should see this case in the "Needs you"
   *  filter (per `needsAction(role, stage)`). */
  needsAction: boolean;
  /** True when the case has a post-petition exception lane signal. Drives
   *  the row's red "Post-petition issue" pill. */
  postPetition: boolean;
}

export interface BuildQueueRowsInput {
  role: LegalRole;
  intakeLeads: ReadonlyArray<IntakeLeadRow>;
  attorneyIntakeReviews: ReadonlyArray<AttorneyIntakeReviewRow>;
  signingReviews: ReadonlyArray<SigningReviewRow>;
  paralegalReviews: ReadonlyArray<ParalegalReviewRow>;
  acceptances: ReadonlyArray<AcceptanceRow>;
  filedRegistry?: ReadonlyArray<FiledCaseRegistryRow>;
}

/** Build the queue's row list. Filters to leads whose `derivePipelineStage`
 *  returns a non-null stage (i.e. they've reached at least 'submitted'). */
export function buildQueueRows(input: BuildQueueRowsInput): QueueRow[] {
  const {
    role,
    intakeLeads,
    attorneyIntakeReviews,
    signingReviews,
    paralegalReviews,
    acceptances,
  } = input;

  // Group reviews by their case-key for O(1) lookup per lead.
  const attorneyReviewsByLead = new Map<string, AttorneyIntakeReviewRow[]>();
  for (const r of attorneyIntakeReviews) {
    if (!r.lead_id) continue;
    const list = attorneyReviewsByLead.get(r.lead_id) ?? [];
    list.push(r);
    attorneyReviewsByLead.set(r.lead_id, list);
  }

  // signing_reviews + paralegal_reviews key on client_id (text). Until §12
  // S1/S2 add lead_id columns, the seed convention is `client_id = lead_id`
  // (per scripts/seed_mickey_rourke_az_ch7.mjs § dual-write). Both maps
  // index by the text client_id, treated as a leadId for matching.
  const signingByLead = new Map<string, SigningReviewRow[]>();
  for (const s of signingReviews) {
    if (!s.client_id) continue;
    const list = signingByLead.get(s.client_id) ?? [];
    list.push(s);
    signingByLead.set(s.client_id, list);
  }
  const paralegalByLead = new Map<string, ParalegalReviewRow[]>();
  for (const p of paralegalReviews) {
    if (!p.client_id) continue;
    const list = paralegalByLead.get(p.client_id) ?? [];
    list.push(p);
    paralegalByLead.set(p.client_id, list);
  }

  const acceptanceByLead = new Map<string, AcceptanceRow>();
  for (const a of acceptances) {
    if (!a.lead_id) continue;
    // Keep the latest decided acceptance per lead (in case of multiple).
    const existing = acceptanceByLead.get(a.lead_id);
    if (!existing || (a.decided_at ?? "") > (existing.decided_at ?? "")) {
      acceptanceByLead.set(a.lead_id, a);
    }
  }

  const rows: QueueRow[] = [];
  for (const lead of intakeLeads) {
    const attReviews = attorneyReviewsByLead.get(lead.id) ?? [];
    const sigReviews = signingByLead.get(lead.id) ?? [];
    const paraReviews = paralegalByLead.get(lead.id) ?? [];
    const acceptance = acceptanceByLead.get(lead.id);

    const signals: CaseSignals = {
      intakeLeadStatus:        lead.status ?? null,
      // pre-submission filters: these come from the broad intake_leads
      // select; the queue cares about reached-submission rows.
      sentForReview:           null,
      intakeCompleted:         null,
      paralegalReviewStatus:   paraReviews.find(p => p.status === "in_progress")?.status ?? paraReviews[0]?.status ?? null,
      attorneyReviewDecision:  (attReviews.find(r => r.decision === "pending")?.decision
                                  ?? attReviews[0]?.decision) as CaseSignals["attorneyReviewDecision"],
      signingReviewStatus:     sigReviews[0]?.status ?? null,
      acceptanceDecidedAt:     acceptance?.decided_at ?? null,
    };

    const { stage, postPetition } = derivePipelineStage(signals);
    if (!stage) continue; // pre-submission lead — not in the queue

    // Chapter: acceptance.chapter is source-of-truth post-decision; fall
    // back to lead.chapter_interest before then.
    let chapter: "7" | "13" | null = null;
    if (acceptance?.chapter === 7) chapter = "7";
    else if (acceptance?.chapter === 13) chapter = "13";
    else if (lead.chapter_interest === 7) chapter = "7";
    else if (lead.chapter_interest === 13) chapter = "13";

    const assignee =
      paraReviews[0]?.paralegal_name
      ?? attReviews[0]?.attorney_name
      ?? "Unassigned";

    const updatedAt = mostRecentIso([
      paraReviews[0]?.updated_at,
      sigReviews[0]?.updated_at,
      attReviews[0]?.updated_at,
    ]);

    rows.push({
      leadId: lead.id,
      clientName: lead.full_name || "(unnamed)",
      chapter,
      stage,
      nextStepKey: stage,
      assignee,
      updatedAt,
      needsAction: needsAction(role, stage),
      postPetition,
    });
  }

  // Sort: needsAction first (true before false), then by stage order
  // within each group.
  rows.sort((a, b) => {
    if (a.needsAction !== b.needsAction) return a.needsAction ? -1 : 1;
    return STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
  });
  return rows;
}

const STAGE_ORDER: ReadonlyArray<StageKey> = [
  "submitted", "paralegal", "fixes", "attorney", "approved",
  "schedule", "sign_done", "filed",
  "m341_docs", "m341_submitted", "m341_concluded", "finmgmt",
  "discharge", "closed",
];

function mostRecentIso(arr: ReadonlyArray<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const v of arr) {
    if (!v) continue;
    if (!best || v > best) best = v;
  }
  return best;
}

// ── Counts for the Active Caseload bubble ──────────────────────────────

export interface CaseloadCounts {
  retainedCh7:  number;  // accepted & chapter=7
  retainedCh13: number;  // accepted & chapter=13
  filedCh7:     number;  // from filed registry
  filedCh13:    number;  // from filed registry
}

export function computeCaseloadCounts(
  acceptances: ReadonlyArray<AcceptanceRow>,
  filedRegistry: ReadonlyArray<FiledCaseRegistryRow>,
): CaseloadCounts {
  let retainedCh7 = 0;
  let retainedCh13 = 0;
  for (const a of acceptances) {
    if (a.decision !== "accepted") continue;
    if (a.chapter === 7) retainedCh7++;
    else if (a.chapter === 13) retainedCh13++;
  }

  let filedCh7 = 0;
  let filedCh13 = 0;
  for (const r of filedRegistry) {
    if (r.chapter === 7) filedCh7++;
    else if (r.chapter === 13) filedCh13++;
  }

  return { retainedCh7, retainedCh13, filedCh7, filedCh13 };
}

// ── "Today" filter for the calendar-events footer ──────────────────────

/** Filter calendar_events to ones with a start_time on the given local
 *  calendar date (default: today in the runtime's local zone). Returns a
 *  shallow copy sorted by start_time ascending. */
export function filterEventsToday<T extends { start_time: string }>(
  events: ReadonlyArray<T>,
  refDate: Date = new Date(),
): T[] {
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  const d = refDate.getDate();
  return events.filter(e => {
    const dt = new Date(e.start_time);
    return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
  }).slice().sort((a, b) => a.start_time.localeCompare(b.start_time));
}
