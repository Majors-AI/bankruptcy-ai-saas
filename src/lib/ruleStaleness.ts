// Re-review (stale-ruleset) predicate — shared between:
//   • LegalAdminPortal.tsx ReReviewChip (per-lead inline chip)
//   • LegalDashboard L-10 RED tier (queue-wide "Re-review required" tasks)
//
// Slice L-10 (Prompt 68) — extracted from LegalAdminPortal.tsx:3000-3050.
// Behavior is identical to the chip's original inline logic; both call
// sites read the same shape so the dashboard cannot drift from the
// per-case surface.
//
// Inputs are intentionally narrow (just the four review fields we read).
// `current` is taken as a parameter so the helper stays pure / trivially
// testable; production callers pass `getCurrentRulesetVersion()`.

import {
  diffRulesetVersions,
  type RulesetVersion,
} from "./irsMeansStandards";

export interface ReviewStalenessInput {
  /** `attorney_intake_reviews.case_status` — when 'filed' / 'closed' the
   *  case is locked and re-review is suppressed regardless of ruleset
   *  delta. Field is TODO Phase B at the DB; treat null/undefined as
   *  unlocked (matches the chip's `String(... ?? "").toLowerCase()` path). */
  case_status: string | null | undefined;
  /** Decided-at timestamp. If null/undefined the review isn't decided yet,
   *  so re-review is N/A. */
  decided_at: string | null | undefined;
  /** Stamped ruleset version at decision time. Null/undefined means the
   *  case predates ruleset-version tracking — surfaces as the "tracking
   *  not enabled" reason from diffRulesetVersions(). */
  reviewed_ruleset_version: string | null | undefined;
}

/** Outcome shape from the predicate.
 *   - 'locked'       → case_status is 'filed'/'closed'; suppress re-review
 *   - 'not_decided'  → no decided_at; re-review N/A
 *   - 'fresh'        → ruleset is current; nothing to do
 *   - 'stale'        → ruleset has drifted; re-review needed (reason is human-readable)
 *
 * The chip renders different chrome for 'locked' (small 🔒 banner) vs
 * 'stale' (amber callout); the dashboard suppresses tasks for 'locked'
 * and emits a RED tier task for 'stale'. */
export type ReviewStalenessKind =
  | "locked"
  | "not_decided"
  | "fresh"
  | "stale";

export interface ReviewStalenessResult {
  kind: ReviewStalenessKind;
  /** Non-null only when kind === 'stale'. */
  reason: string | null;
}

export function evaluateReviewStaleness(
  input: ReviewStalenessInput,
  current: RulesetVersion,
): ReviewStalenessResult {
  const status = String(input.case_status ?? "").toLowerCase();
  if (status === "filed" || status === "closed") {
    return { kind: "locked", reason: null };
  }
  if (!input.decided_at) {
    return { kind: "not_decided", reason: null };
  }
  const reason = diffRulesetVersions(
    input.reviewed_ruleset_version ?? null,
    current,
  );
  if (!reason) return { kind: "fresh", reason: null };
  return { kind: "stale", reason };
}
