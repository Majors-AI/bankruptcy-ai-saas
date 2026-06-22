// buildAttorneyCompletedReviews — pure derivation of the "Completed
// Reviews" history list shown on the simplified attorney portal.
//
// Sources:
//   attorney_intake_reviews   (decided rows — decision IN accepted/declined)
//   intake_leads              (client name lookup + retention outcome)
//   attorney_case_acceptances (chapter / case_type / fee, source of truth post-decision)
//
// Output: one row per LEAD (collapsing multiple review rounds to the
// latest), with a re-review count chip when N>1.
//
// PURE FUNCTION — no I/O, no React. Caller pre-loads the rows; tests
// pass fixtures directly.

import type {
  AttorneyIntakeReviewRow,
  IntakeLeadRow,
  AcceptanceRow,
} from "../components/legal/legalTasks";

export type CompletedReviewDecision = "accepted" | "declined";

/** Outcome derived from intake_leads.status after the attorney decision
 *  landed. `retained` is the happy path; everything else is a different
 *  shade of "didn't sign". Unknown is the catch-all for legacy lead
 *  statuses we don't recognize. */
export type CompletedReviewOutcome =
  | "retained"
  | "declined"
  | "no_case"
  | "no_show"
  | "fee_quoted_pending"
  | "unknown";

export interface CompletedReviewRow {
  /** Stable id — the lead_id is the matter spine per §3 / §12. */
  leadId: string;
  clientName: string;
  /** Chapter from acceptance (source of truth post-decision); falls back
   *  to lead.chapter_interest if acceptance is missing. Null when neither
   *  source has it. */
  chapter: 7 | 13 | null;
  /** Attorney who decided. */
  attorneyName: string;
  /** Whether the attorney accepted or declined the case. */
  decision: CompletedReviewDecision;
  /** ISO timestamp of the LATEST review decision. */
  decidedAt: string | null;
  /** Notes from the attorney_intake_reviews row (the LATEST review). */
  decisionNotes: string | null;
  /** Outcome on the lead — did the client retain or not? */
  outcome: CompletedReviewOutcome;
  /** Count of review rounds for this lead (>=1). When >1, UI shows a
   *  "re-reviewed N×" chip. */
  reviewCount: number;
  /** Acceptance fee summary (compact one-liner) when an accepted-decision
   *  acceptance row exists. Null otherwise. */
  feeSummary: string | null;
}

export interface BuildCompletedReviewsInput {
  attorneyIntakeReviews: ReadonlyArray<AttorneyIntakeReviewRow>;
  intakeLeads:           ReadonlyArray<IntakeLeadRow>;
  acceptances:           ReadonlyArray<AcceptanceRow>;
}

/** Build the Completed Reviews history. Filters to decided rows
 *  (accepted / declined), groups by lead_id, picks the LATEST per
 *  lead, and joins to intake_leads + acceptances. */
export function buildAttorneyCompletedReviews(
  input: BuildCompletedReviewsInput,
): CompletedReviewRow[] {
  const { attorneyIntakeReviews, intakeLeads, acceptances } = input;

  // Lead lookup by id.
  const leadById = new Map<string, IntakeLeadRow>();
  for (const l of intakeLeads) leadById.set(l.id, l);

  // Acceptance lookup by lead_id (latest decided acceptance).
  const acceptanceByLead = new Map<string, AcceptanceRow>();
  for (const a of acceptances) {
    if (!a.lead_id) continue;
    const existing = acceptanceByLead.get(a.lead_id);
    if (!existing || (a.decided_at ?? "") > (existing.decided_at ?? "")) {
      acceptanceByLead.set(a.lead_id, a);
    }
  }

  // Group reviews by lead_id, keep the LATEST decided row per lead.
  // Count rounds for the "re-reviewed N×" chip.
  interface LeadGroup {
    latest: AttorneyIntakeReviewRow;
    count: number;
  }
  const groupByLead = new Map<string, LeadGroup>();
  for (const r of attorneyIntakeReviews) {
    if (r.decision !== "accepted" && r.decision !== "declined") continue;
    if (!r.lead_id) continue;
    const g = groupByLead.get(r.lead_id);
    if (!g) {
      groupByLead.set(r.lead_id, { latest: r, count: 1 });
      continue;
    }
    g.count += 1;
    // Compare by decided_at (preferred) then created_at.
    const newKey = r.decided_at ?? r.created_at ?? "";
    const curKey = g.latest.decided_at ?? g.latest.created_at ?? "";
    if (newKey > curKey) g.latest = r;
  }

  const rows: CompletedReviewRow[] = [];
  for (const [leadId, { latest, count }] of groupByLead) {
    const lead       = leadById.get(leadId);
    const acceptance = acceptanceByLead.get(leadId);
    const decision   = latest.decision as CompletedReviewDecision;

    // Chapter — acceptance is source of truth; fall back to lead intent.
    let chapter: 7 | 13 | null = null;
    if (acceptance?.chapter === 7) chapter = 7;
    else if (acceptance?.chapter === 13) chapter = 13;
    else if (lead?.chapter_interest === 7) chapter = 7;
    else if (lead?.chapter_interest === 13) chapter = 13;

    rows.push({
      leadId,
      clientName:    lead?.full_name ?? "(unnamed)",
      chapter,
      attorneyName:  latest.attorney_name ?? "(unknown attorney)",
      decision,
      decidedAt:     latest.decided_at ?? null,
      decisionNotes: latest.decision_notes ?? null,
      outcome:       outcomeForLead(decision, lead?.status ?? null),
      reviewCount:   count,
      feeSummary:    feeSummaryFor(acceptance),
    });
  }

  // Sort newest decided_at first. Rows with no decided_at sink to the bottom.
  rows.sort((a, b) => {
    if (!a.decidedAt && !b.decidedAt) return 0;
    if (!a.decidedAt) return 1;
    if (!b.decidedAt) return -1;
    return b.decidedAt.localeCompare(a.decidedAt);
  });
  return rows;
}

// ── Helpers ──────────────────────────────────────────────────────────

function outcomeForLead(
  decision: CompletedReviewDecision,
  leadStatus: string | null,
): CompletedReviewOutcome {
  // Declined cases: the outcome is the decline itself unless the lead
  // later went somewhere else.
  if (decision === "declined") {
    if (leadStatus === "retained") return "retained"; // attorney later changed their mind
    return "declined";
  }
  // Accepted cases: outcome derives from where the lead ended up.
  switch (leadStatus) {
    case "retained":               return "retained";
    case "declined":               return "declined";
    case "no_case":                return "no_case";
    case "no_show":                return "no_show";
    case "fee_quoted":             return "fee_quoted_pending";
    case "attorney_accepted":      return "fee_quoted_pending"; // accepted, fee not yet quoted
    case "consultation_complete":  return "fee_quoted_pending";
    case "consultation_scheduled": return "fee_quoted_pending";
    default:                       return "unknown";
  }
}

function feeSummaryFor(acceptance: AcceptanceRow | undefined): string | null {
  if (!acceptance) return null;
  // AcceptanceRow's narrow shape doesn't carry fee fields; the parent
  // already loads them on attorney_case_acceptances. The Completed
  // Reviews UI can show a "fee details" link to the lead detail panel
  // for the full breakdown. For now the case_type is the most useful
  // compact summary.
  return acceptance.case_type ?? null;
}

// ── Label maps (UI-facing) ───────────────────────────────────────────

export const OUTCOME_LABELS: Readonly<Record<CompletedReviewOutcome, string>> = {
  retained:           "Retained",
  declined:           "Declined",
  no_case:            "No case",
  no_show:            "No show",
  fee_quoted_pending: "Fee quoted — pending",
  unknown:            "Outcome unknown",
};

export const DECISION_LABELS: Readonly<Record<CompletedReviewDecision, string>> = {
  accepted: "Accepted",
  declined: "Declined",
};
