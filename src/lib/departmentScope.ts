// Department client-scope filter — typed interface.
//
// Companion to functional-readme §2 (Access Control & Client Scope):
//   - Intake = potential clients only (status NOT IN retained/declined/no_case/no_show)
//   - Legal  = retained clients only (status='retained' OR has acceptance)
//   - Accounting = its own scope (separate table, not from intake_leads)
//
// Real wall is RLS on intake_leads per role — flagged for Canelo.
// Frontend filter is UX honesty + immediate scoping for portal loads.
// Without this, both Intake and Legal portals query the same broad set
// and the user sees the wrong rows.

export type DepartmentScope = "intake" | "legal" | "accounting";

/** A PostgREST-compatible status filter for `intake_leads?status=...`.
 *
 *  Returned as a fragment ("status=in.(new,contacted,...)" or
 *  "status=eq.retained") that the caller appends to its query string.
 *  Returns `null` when no client-side filter applies — e.g., accounting
 *  doesn't read intake_leads at all. */
export function scopeFilterForDepartment(dept: DepartmentScope): string | null {
  switch (dept) {
    case "intake": {
      // Potential clients only. Excludes retained (Legal's scope) and the
      // terminal closed states (declined / no_case / no_show) which sit
      // in the inactive bucket. Active intake-pipeline statuses pass.
      const intakeStatuses = [
        "new",
        "contacted",
        "consultation_scheduled",
        "consultation_complete",
        "intake_complete",
        "sent_for_attorney_review",
        "attorney_accepted",
        "fee_quoted",
      ];
      return `status=in.(${intakeStatuses.join(",")})`;
    }
    case "legal": {
      // Retained-only. Today's signal is `status='retained'` on
      // intake_leads. A future refinement could OR in
      // `attorney_case_acceptances.decision='accepted'` once that join
      // is exposed on the lead-load query path.
      return `status=eq.retained`;
    }
    case "accounting": {
      // Accounting reads accounting_clients (separate table). No filter
      // on intake_leads applies. Caller should not be querying intake_leads
      // for an accounting scope.
      return null;
    }
  }
}

// ── Inactive / closed bucket for staff that need a "show all including
//    closed" view (e.g., supervisor reports). Not part of the default
//    department scope. ────────────────────────────────────────────────

export const CLOSED_LEAD_STATUSES = ["declined", "no_case", "no_show"] as const;
