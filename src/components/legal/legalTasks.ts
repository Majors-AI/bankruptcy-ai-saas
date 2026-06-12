// Slice L-3 (Prompt 63) — Legal task pool derivation.
//
// Pure function that converts the four legal-source tables LegalDepartmentPortal
// loads at mount into the shell's color-coded TaskEntry[]. No fetches here
// — sources come in as parameters.
//
// Color tiers (per Prompt 63 + the Part-0 schema confirmation):
//
//   RED    — attorney_intake_reviews (decision='pending', stale: created_at
//            older than 3 days)
//          + signing_reviews (status='in_progress', stale-in-progress:
//            updated_at older than 7 days)
//                 [NOTE: signing_reviews has no scheduled_at column today,
//                  so this is a proxy for the prompt's "past deadline"
//                  predicate; real deadline tracking is a schema follow-up]
//   ORANGE — ecf_tasks (status IN open/in_progress, due_date < today)
//   YELLOW — attorney_intake_reviews (decision='pending', fresh: ≤ 3 days)
//          + signing_reviews (status IN in_progress/paused, recent)
//          + paralegal_reviews (status IN in_progress/needs_info)
//   BLUE   — ecf_tasks (status IN open/in_progress, due_date today..+7d)
//
// Within a color tier, OVERDUE rows sort ahead of non-overdue, mirroring
// AccountingTasks + the shell's AllTasksWidget rule.
//
// TODOs:
//   - signing_reviews "past deadline" RED predicate: needs a scheduled_at
//     or deadline column on signing_reviews. Until then the proxy is
//     "in_progress + stale updated_at".
//   - Slices L-5 / L-10:
//       trustee_341_checklist_state (RED if 341 within 7 days incomplete,
//                                    BLUE if 14-30 days on track)
//       ReReviewChip ruleset-staleness flag (RED) — predicate lives in
//                                    LegalAdminPortal.tsx:3000-3050
//       pending_doc_requests / amendment_flags (ORANGE if > 14 days open)
//       pleading_drafts (YELLOW if stale)
//       ecf_inbox (BLUE if new entries lack ecf_tasks rows)
//   - Client-name lookup for signing_reviews + paralegal_reviews: their
//     `client_id text` is NOT necessarily an intake_leads.id; a clients
//     table read is a future-slice addition. Until then those rows show
//     a truncated client_id with a TODO comment.

import type { TaskColor, TaskEntry } from "../department-dashboard";

// ─── Narrow row shapes ────────────────────────────────────────────────────
//
// Each only carries the fields buildLegalTasks consumes. The DB rows have
// more columns (see the source migrations); these narrow shapes keep the
// helper testable + uncoupled from any host's wider types.

export interface AttorneyIntakeReviewRow {
  id: string;
  lead_id: string | null;
  submission_id: string | null;
  attorney_name: string;
  /** Default 'pending'. App-observed values: 'pending' | 'accepted' | 'declined'. */
  decision: string;
  /** Default 'in_progress'. App-observed values: 'in_progress' | (others). */
  review_status: string;
  created_at: string;
  updated_at: string;
  decided_at: string | null;
}

export interface SigningReviewRow {
  id: string;
  client_id: string;
  firm_id: string;
  /** CHECK enum: 'in_progress' | 'completed' | 'paused'. */
  status: "in_progress" | "completed" | "paused";
  reviewer_role: string;
  created_at: string;
  updated_at: string;
}

export interface ParalegalReviewRow {
  id: string;
  client_id: string;
  paralegal_name: string;
  /** CHECK enum: 'in_progress' | 'complete' | 'needs_info'. */
  status: "in_progress" | "complete" | "needs_info";
  created_at: string;
  updated_at: string;
}

export interface EcfTaskRow {
  id: string;
  ecf_inbox_id: string | null;
  client_id: string | null;
  title: string;
  due_date: string | null;     // date (YYYY-MM-DD) — NOT a timestamp
  priority: string;
  assigned_to: string;
  /** Default 'open'. No CHECK; observed: 'open' | 'in_progress' | 'completed'. */
  status: string;
  created_at: string;
}

export interface IntakeLeadRow {
  id: string;
  full_name: string;
}

// ─── Source bundle + entry builder ────────────────────────────────────────

export type LegalTaskKind =
  | "attorney_intake_review"
  | "signing_review"
  | "paralegal_review"
  | "ecf_task";

export interface LegalTaskSources {
  attorneyIntakeReviews: ReadonlyArray<AttorneyIntakeReviewRow>;
  signingReviews:        ReadonlyArray<SigningReviewRow>;
  paralegalReviews:      ReadonlyArray<ParalegalReviewRow>;
  ecfTasks:              ReadonlyArray<EcfTaskRow>;
  intakeLeads:           ReadonlyArray<IntakeLeadRow>;
  /** Optional click-router. Today LegalDepartmentPortal doesn't pass one
   *  (clicks no-op until L-9). */
  onSelectTask?: (kind: LegalTaskKind, id: string) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_REVIEW_MS  = 3 * DAY_MS;
const STALE_SIGNING_MS = 7 * DAY_MS;

export function buildLegalTasks(src: LegalTaskSources): TaskEntry[] {
  const now = Date.now();
  const leadName = new Map(src.intakeLeads.map(l => [l.id, l.full_name]));
  const clientFallback = (id: string | null | undefined) =>
    id ? `Client ${id.slice(0, 8)}…` : "Client (unknown)";
  const onSelect = (kind: LegalTaskKind, id: string) =>
    () => src.onSelectTask?.(kind, id);

  const out: TaskEntry[] = [];

  // ─── RED — attorney_intake_reviews stale > 3 days (decision pending) ───
  for (const r of src.attorneyIntakeReviews) {
    if (r.decision !== "pending") continue;
    const age = now - new Date(r.created_at).getTime();
    const isStale = age >= STALE_REVIEW_MS;
    const title = r.lead_id
      ? (leadName.get(r.lead_id) ?? clientFallback(r.lead_id))
      : "Lead (unknown)";
    const ageDays = Math.max(1, Math.floor(age / DAY_MS));
    out.push({
      id: `att-review-${r.id}`,
      color: isStale ? "red" : "yellow",
      title,
      subtitle: `Attorney intake review · pending ${ageDays} day${ageDays === 1 ? "" : "s"}`,
      actionLabel: "Review",
      // Stale items sortKey leads at 1.0M (matches accounting RED autopay
      // tier ordering); fresh items at 3.5M (between YELLOW signing and
      // YELLOW paralegal review).
      sortKey: (isStale ? 1_000_000 : 3_500_000) - new Date(r.created_at).getTime() / 60_000,
      due: r.created_at,
      onSelect: onSelect("attorney_intake_review", r.id),
    });
  }

  // ─── RED proxy — signing_reviews in_progress stale > 7 days ────────────
  // ─── YELLOW — signing_reviews in_progress / paused (recent) ────────────
  // (Real "past deadline" awaits a scheduled_at column — see TODO above.)
  for (const s of src.signingReviews) {
    if (s.status !== "in_progress" && s.status !== "paused") continue;
    const age = now - new Date(s.updated_at).getTime();
    const isStale = s.status === "in_progress" && age >= STALE_SIGNING_MS;
    const title = leadName.get(s.client_id) ?? clientFallback(s.client_id);
    const ageDays = Math.max(1, Math.floor(age / DAY_MS));
    const statusLabel = s.status === "paused" ? "paused" : `pending ${ageDays} day${ageDays === 1 ? "" : "s"}`;
    out.push({
      id: `signing-${s.id}`,
      color: isStale ? "red" : "yellow",
      title,
      subtitle: `Signing review · ${statusLabel}`,
      actionLabel: isStale ? "Resume" : "Continue",
      sortKey: (isStale ? 1_200_000 : 3_700_000) - new Date(s.updated_at).getTime() / 60_000,
      due: s.updated_at,
      onSelect: onSelect("signing_review", s.id),
    });
  }

  // ─── ORANGE — ecf_tasks overdue ───────────────────────────────────────
  // ─── BLUE — ecf_tasks upcoming (today..+7d) ───────────────────────────
  // Past-due tasks land ORANGE; upcoming-but-not-overdue land BLUE. Tasks
  // without a due_date are skipped here (the LEFT widget doesn't fabricate
  // dates; they'll appear in a later "no-due" surface if needed).
  for (const t of src.ecfTasks) {
    if (t.status !== "open" && t.status !== "in_progress") continue;
    if (!t.due_date) continue;
    const dueMs = new Date(t.due_date).getTime();
    const isOverdue = dueMs < now;
    const isUpcoming = dueMs >= now && dueMs <= now + 7 * DAY_MS;
    if (!isOverdue && !isUpcoming) continue;
    out.push({
      id: `ecf-${t.id}`,
      color: isOverdue ? "orange" : "blue",
      title: t.title || `ECF task ${t.id.slice(0, 8)}`,
      subtitle:
        (t.assigned_to ? `Assigned: ${t.assigned_to}` : "Unassigned") +
        (t.priority && t.priority !== "medium" ? ` · ${t.priority}` : ""),
      actionLabel: "Open",
      // ORANGE band 2.0M (matches Accounting ORANGE), BLUE band 4.5M.
      sortKey: isOverdue
        ? 2_000_000 - (now - dueMs) / 60_000
        : 4_500_000 + dueMs / 60_000,
      due: t.due_date,
      onSelect: onSelect("ecf_task", t.id),
    });
  }

  // ─── YELLOW — paralegal_reviews in_progress / needs_info ──────────────
  for (const p of src.paralegalReviews) {
    if (p.status !== "in_progress" && p.status !== "needs_info") continue;
    const title = leadName.get(p.client_id) ?? clientFallback(p.client_id);
    const statusLabel = p.status === "needs_info" ? "awaiting info" : "in progress";
    out.push({
      id: `paralegal-${p.id}`,
      color: "yellow",
      title,
      subtitle: `Paralegal review · ${statusLabel}` + (p.paralegal_name ? ` · ${p.paralegal_name}` : ""),
      actionLabel: "Open",
      sortKey: 3_900_000 - new Date(p.updated_at).getTime() / 60_000,
      due: p.updated_at,
      onSelect: onSelect("paralegal_review", p.id),
    });
  }

  // ─── Stable sort ──────────────────────────────────────────────────────
  // Color tier → overdue-first within tier → sortKey. Identical rule to
  // the Intake + Accounting pools so the visual ordering matches across
  // department dashboards.
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
