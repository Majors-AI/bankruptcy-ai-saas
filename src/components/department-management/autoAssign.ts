// Auto-assign engine — route a task to the available member with the highest
// strength score for it. Tie-breaker: lighter current workload (confirmed).
// Existing rule preserved: follow-ups (prior contact with this client) route
// to whoever made initial contact, overriding the score. Supervisors and
// super-admins can override any assignment from the UI; this engine returns
// a suggestion + reason so the override layer always knows the basis.

import type { DeptTask, StaffMember, StrengthScore } from "./types";

export interface AssignmentInput {
  task: DeptTask;
  /** Candidates from the same department as the task. The caller filters. */
  candidates: StaffMember[];
  scores: StrengthScore[];
  /** Current in-progress task count per staff member (workload). */
  workload: Record<string /* staffId */, number>;
  /** Optional: who made initial contact with this client. If set, follow-ups
   *  route here regardless of score. Pass null when the task has no client
   *  link or initial contact is unknown. */
  initialContactStaffId?: string | null;
  /** When true, the task is a follow-up. Drives the initialContactStaffId
   *  override. */
  isFollowUp?: boolean;
}

export type AssignmentReason =
  | "follow_up_initial_contact"
  | "highest_score"
  | "score_tie_lighter_workload"
  | "no_score_lighter_workload"
  | "no_candidates";

export interface AssignmentResult {
  staffId: string | null;
  reason: AssignmentReason;
  /** All considered candidates after the rules ran — useful for the override
   *  UI to surface "next best" choices. */
  ranked: Array<{ staffId: string; score: number; workload: number }>;
}

export function assign({
  task, candidates, scores, workload, initialContactStaffId, isFollowUp,
}: AssignmentInput): AssignmentResult {
  if (candidates.length === 0) {
    return { staffId: null, reason: "no_candidates", ranked: [] };
  }

  // Follow-up override (existing rule).
  if (isFollowUp && initialContactStaffId) {
    if (candidates.some(c => c.id === initialContactStaffId)) {
      return {
        staffId: initialContactStaffId,
        reason: "follow_up_initial_contact",
        ranked: [],
      };
    }
    // The initial-contact staffer is no longer in the candidate pool —
    // fall through to score-based selection; the audit log will record both.
  }

  const ranked = candidates.map(c => {
    const score = scores.find(s =>
      s.staffId === c.id
      && s.departmentId === task.departmentId
      && s.taskId === task.id
    )?.value ?? 0;
    const load = workload[c.id] ?? 0;
    return { staffId: c.id, score, workload: load };
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score; // highest first
    return a.workload - b.workload;                    // then lightest workload
  });

  const top = ranked[0];
  const second = ranked[1];

  // No scores at all on any candidate — purely workload-based.
  if (top.score === 0 && (!second || second.score === 0)) {
    return { staffId: top.staffId, reason: "no_score_lighter_workload", ranked };
  }

  // Score tie at the top.
  if (second && second.score === top.score) {
    return { staffId: top.staffId, reason: "score_tie_lighter_workload", ranked };
  }

  return { staffId: top.staffId, reason: "highest_score", ranked };
}

/** Human-readable reason for the override / audit surface. */
export function reasonLabel(reason: AssignmentReason): string {
  switch (reason) {
    case "follow_up_initial_contact": return "Follow-up → initial-contact staffer";
    case "highest_score":               return "Highest strength score";
    case "score_tie_lighter_workload":  return "Score tie — lighter workload";
    case "no_score_lighter_workload":   return "No scores recorded — lighter workload";
    case "no_candidates":               return "No available candidates";
  }
}
