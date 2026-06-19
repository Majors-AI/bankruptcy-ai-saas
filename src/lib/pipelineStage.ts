// derivePipelineStage — pure mapping from real DB signals to a 14-stage
// pipeline key. Driven by the §3 signal table in
// docs/design/legal-portal-function-mapping.md.
//
// PURE FUNCTION — no side effects, no I/O. Caller passes already-loaded
// rows for the case; this returns one StageKey | null. `null` means "no
// signal mapped yet" — the caller renders an empty Pipeline (or hides it).
//
// 8 of 14 stages have current signals; the other 6 are stubbed in the
// Pipeline bar (see STUBBED_STAGES in legalPortalTokens.ts). When the
// post-petition schema lands (schema-changes-for-canelo.md §1 / §10), the
// stubbed stages flip from inactive to live via signal additions here.
//
// CRITICAL: This function does NOT use the reference's mock arrays
// (CASE / CASES / DOCS / FORMS / FIELD_MAP / SCHED_VALUES / AZ_EXEMPTIONS /
// ALL_SLOTS / LOCAL_FORMS). All signals are real DB column values.

import type { StageKey } from "../legal-portal/legalPortalTokens";

// Signals consumed by the mapping. Caller is responsible for shaping
// these from the loaded rows for a given case.
//
// Every field is optional — `null` / `undefined` means "no signal" and
// the function falls through to the next stage. The function never
// invents a stage; if nothing matches, returns `null`.
export interface CaseSignals {
  // Lead-level signals
  intakeLeadStatus?:   string | null;   // intake_leads.status
  sentForReview?:      boolean | null;  // intake_leads.sent_for_review
  intakeCompleted?:    boolean | null;  // intake_leads.intake_completed

  // Paralegal review
  paralegalReviewStatus?: string | null; // paralegal_reviews.status
  hasRejectedDocs?:       boolean | null; // any doc_confirmations.status === 'rejected'
  hasNeedsInfoSection?:   boolean | null; // any section_confirmations.status === 'needs_info'

  // Attorney review + acceptance
  attorneyReviewDecision?: "pending" | "accepted" | "declined" | null;
  signingReviewStatus?:    string | null; // signing_reviews.status
  acceptanceDecidedAt?:    string | null; // attorney_case_acceptances.decided_at
  acceptanceOverrideRequired?: boolean | null; // post-acceptance exception lane (§3)

  // Signing → filing
  signingCompleted?:  boolean | null; // calendar_events (signing) status === 'completed'
  isFiledRegistered?: boolean | null; // accounting_filed_case_registry row exists

  // Post-petition (stubbed — currently always undefined/null until the
  // schema lands. Kept on the type so consumers compile cleanly.)
  trustee341DocsRequested?: boolean | null;
  trustee341DocsSubmitted?: boolean | null;
  meeting341Concluded?:     boolean | null;
  ccCourseCompletedAt?:     string | null; // client_documents.cc_course_completed_at (§7)
  form423FiledAt?:          string | null; // post-petition Form 423 firm-file timestamp
  dischargeEnteredAt?:      string | null;
  caseClosedAt?:            string | null;
}

export interface DerivedPipelineResult {
  stage: StageKey | null;
  postPetition: boolean;
}

// Mapping order matches §3 table. Returns the FIRST stage whose signals
// hold (forward-walking, latest takes precedence via later-checked-first
// ordering: we check `closed` → `discharge` → … → `submitted`).
export function derivePipelineStage(s: CaseSignals): DerivedPipelineResult {
  const postPetition = !!s.acceptanceOverrideRequired;

  // Discharge phase
  if (s.caseClosedAt)        return { stage: "closed",         postPetition };
  if (s.dischargeEnteredAt)  return { stage: "discharge",      postPetition };

  // Administration phase
  if (s.form423FiledAt)      return { stage: "finmgmt",        postPetition };
  if (s.meeting341Concluded) return { stage: "m341_concluded", postPetition };
  if (s.trustee341DocsSubmitted) return { stage: "m341_submitted", postPetition };
  if (s.trustee341DocsRequested) return { stage: "m341_docs",     postPetition };

  // Sign & file phase
  if (s.isFiledRegistered)   return { stage: "filed",     postPetition };
  if (s.signingCompleted)    return { stage: "sign_done", postPetition };

  // Approval landed but signing not scheduled yet
  if (s.acceptanceDecidedAt && !s.signingCompleted)
    return { stage: "schedule", postPetition };

  // Prepare phase — attorney review
  if (s.signingReviewStatus === "in_progress" || s.signingReviewStatus === "paused")
    return { stage: "attorney", postPetition };
  if (s.attorneyReviewDecision === "pending")
    return { stage: "attorney", postPetition };
  if (s.attorneyReviewDecision === "accepted")
    return { stage: "approved", postPetition };

  // Paralegal review (incl. fixes-waiting-on-client)
  if (s.paralegalReviewStatus === "needs_info" || s.hasRejectedDocs || s.hasNeedsInfoSection)
    return { stage: "fixes", postPetition };
  if (s.paralegalReviewStatus === "in_progress")
    return { stage: "paralegal", postPetition };

  // Initial submission
  if (
    s.intakeLeadStatus === "intake_complete"        ||
    s.intakeLeadStatus === "sent_for_attorney_review" ||
    s.sentForReview === true                        ||
    s.intakeCompleted === true
  ) {
    return { stage: "submitted", postPetition };
  }

  // No signal yet — pre-submission lead (caller renders no Pipeline)
  return { stage: null, postPetition };
}
