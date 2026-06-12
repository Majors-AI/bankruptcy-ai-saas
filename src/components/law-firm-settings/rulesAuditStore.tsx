// Rules / Standards / Exemptions audit store.
//
// Shared by Bankruptcy Exemptions, Median Income, and Living Standards
// sections. Tracks:
//   - per-section audit log (who / what / when)
//   - the re-review queue — derived from REAL attorney-reviewed cases by
//     comparing each in-window case's stamped ruleset version against the
//     current store version. No demo cohort.
//
// IN-WINDOW = attorney-reviewed (decidedAt present) AND filedAt IS NULL AND
// closedAt IS NULL. Filed / closed = LOCKED, excluded from the queue.
//
// SCAFFOLD persistence:
//   - the `reviews` list lives in memory; the host can replace it with a
//     real query against intake_reviews / case_records when persistence
//     lands. The default fixture below contains a small spread so the queue
//     visibly flips when a rule changes (one in-window, one filed, one
//     closed) — clearly tagged "[Scaffold]".
//   - "edit count" tracks local edits this session; each recordChange()
//     bumps it. The effective version id = base ruleset id + `::edits:N`.
//     A review stamped before edit N has stamp != current → diff fires.
//     When real persistence wires up, the date-string suffix changes
//     naturally and the same diff path works without changes.
//   - "Mark reviewed" restamps the case at the current version (drops it
//     from the queue until the next edit). "Dismiss" suppresses it.

import {
  createContext, useCallback, useContext, useMemo, useState,
  type ReactNode,
} from "react";
import {
  diffRulesetVersions, getCurrentRulesetVersion,
} from "../../lib/irsMeansStandards";
import {
  notifyRuleUpdate, buildChangeSummary,
  type RuleUpdatePublishEvent, type NotifyResult,
} from "../../lib/notifyRuleUpdate";

export type RulesSection =
  | "exemptions"
  | "median_income"
  | "living_standards"
  // Firm-level Ch.13 trustee-fee multiplier schedule (per-district admin
  // multiplier rules — sourced from the UST trustee-fee report).
  | "ch13_admin_multipliers"
  // Per-case Ch.13 review overrides — the attorney-entered controls in
  // Ch13Eligibility (FMV, Till rate, conduit, D→unsecured, purchase /
  // filing dates, Statement of Intention, priority pool, junior liens).
  // Distinct bucket from ch13_admin_multipliers so per-case overrides
  // don't pollute the firm-level trustee-fee audit trail.
  | "ch13_case_override"
  // Per-district Local Rules uploads (PDF + version stamp).
  | "local_rules"
  | "means_test_figures";

export interface RulesAuditEntry {
  id: string;
  ts: string;
  section: RulesSection;
  actor: string;
  path: string;            // dot-path identifier (e.g. "exemptions.AZ.homestead.limit")
  oldValue: string | number | null;
  newValue: string | number | null;
  source?: string;         // attribution (e.g. "UST 2026-04-01" or "PDF upload")
  affectedCases?: number;  // count of in-window cases flagged by this change
}

// A completed attorney review. Persisted upstream (intake_reviews) — here a
// scaffold fixture. The version stamp is the value the case was reviewed
// against; the diff against current drives the re-review queue.
export interface AttorneyReviewRecord {
  caseId: string;
  clientName: string;
  state: string;
  decidedAt: string;                       // ISO; required (only decided reviews qualify)
  stampedVersionId: string | null;         // null = pre-versioning era → always flagged
  filedAt: string | null;                  // not null → locked, excluded
  closedAt: string | null;                 // not null → locked, excluded
  /** Tag for the UI when the record is a scaffold fixture rather than real data. */
  scaffold?: boolean;
}

export interface ReReviewCase {
  id: string;                              // stable derived id (caseId)
  caseId: string;
  clientName: string;
  reason: string;
  status: "pending" | "reviewed" | "dismissed";
  enqueuedAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

/** Operator publish event — emitted when the Bankruptcy.AI admin clicks
 *  "Publish update" / "Publish all pending" on the Reference Rules tower.
 *  Snapshots the effective ruleset version at publish time, captures the
 *  change summary derived from the previous publish's version, and stores
 *  the notifyRuleUpdate dispatch result for the operator audit. */
export interface PublishEvent {
  id: string;
  ts: string;
  actor: string;
  /** Effective version id at publish time (base + ::edits:N). */
  versionId: string;
  /** Per-dataset effective-date parts at publish time. */
  parts: ReturnType<typeof getCurrentRulesetVersion>["parts"];
  /** Sections included in this publish — used by the email subject + audit
   *  filter. 'all' = Publish all pending; otherwise the specific section. */
  scope: RulesSection[] | "all";
  /** Human-readable change summary from diffRulesetVersions vs. the
   *  immediately-prior publish (or "first publish — no prior baseline"). */
  changeSummary: string;
  /** Operator-supplied effective date — typically the most recent dataset
   *  effective date among the changed datasets. */
  effectiveDate: string;
  /** Stub dispatch result from notifyRuleUpdate — preserved on the
   *  publish event so the operator can audit per-firm delivery state. */
  notifyResult?: NotifyResult;
}

interface RulesAuditState {
  log: RulesAuditEntry[];
  reviews: AttorneyReviewRecord[];
  /** caseId → versionId at the moment of "Mark reviewed". Restamping drops
   *  the case from the queue until the next change. */
  restampedAt: Record<string, string>;
  /** caseId → resolution metadata. */
  resolutions: Record<string, { status: "reviewed" | "dismissed"; resolvedBy: string; resolvedAt: string }>;
  /** Local edits applied this session. Bumped by recordChange(). */
  editCount: number;
  /** Operator publish events — newest first. */
  publishEvents: PublishEvent[];
}

interface RulesAuditApi {
  log: RulesAuditEntry[];
  reviews: AttorneyReviewRecord[];
  editCount: number;
  publishEvents: PublishEvent[];
  /** Derived: in-window cases whose stamped version differs from current. */
  reReview: ReReviewCase[];
  recordChange(input: {
    section: RulesSection;
    actor: string;
    path: string;
    oldValue: RulesAuditEntry["oldValue"];
    newValue: RulesAuditEntry["newValue"];
    source?: string;
  }): void;
  resolveReReview(caseId: string, action: "reviewed" | "dismissed", actor: string): void;
  /** Used by surfaces that want to render the log for a single section. */
  logFor(section: RulesSection): RulesAuditEntry[];
  /** Effective version id including the in-session edit count. Exported so
   *  external review surfaces can stamp reviews consistently. */
  effectiveVersionId(): string;
  /** Operator publish — bumps the canonical published version, fans out
   *  the existing per-case re-review (already derived from
   *  effectiveVersionIdFor; nothing new), and enqueues the rule-update
   *  transactional emails per firm via notifyRuleUpdate. Returns the
   *  publish event so the caller can surface it in the publish banner. */
  publish(input: {
    actor: string;
    scope: RulesSection[] | "all";
    effectiveDate?: string;
    /** Firms to notify. Caller passes the platform's firm-id list; the
     *  per-firm preference + recipient resolution is inside notifyRuleUpdate. */
    firmIds: ReadonlyArray<string>;
  }): Promise<PublishEvent>;
  /** Pending change summary — counts unpublished edits since the most
   *  recent PublishEvent. Drives the admin portal's "Publish all pending"
   *  badge. */
  pendingChangeCount(): number;
}

const Ctx = createContext<RulesAuditApi | null>(null);

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

// ─── Effective version helper ──────────────────────────────────────────────
//
// The base ruleset id concatenates effective dates (median + IRS + exemptions
// per jurisdiction). When the constants in irsMeansStandards.ts don't change
// at runtime, the base id alone doesn't move — but the rule pages let an
// attorney record local edits in memory. We compose the effective id as
// `<base>::edits:N` so the diff catches in-session edits. The base
// effective-date suffix takes over the moment real persistence advances a
// publication date.

function effectiveVersionIdFor(editCount: number): string {
  const base = getCurrentRulesetVersion().id;
  return editCount > 0 ? `${base}::edits:${editCount}` : base;
}

function diffStampedVsCurrent(
  stamped: string | null,
  editCount: number,
): string | null {
  if (!stamped) {
    return "This case was reviewed before ruleset version tracking was enabled; please re-confirm against the current rules.";
  }
  const current = effectiveVersionIdFor(editCount);
  if (stamped === current) return null;

  // Compare base portions (strip the `::edits:N` suffix) using the existing
  // diff helper so the message names which publication advanced.
  const baseStamped = stamped.split("::edits:")[0];
  const baseDiff = diffRulesetVersions(baseStamped, getCurrentRulesetVersion());
  if (baseDiff) return baseDiff;

  // Same publication base → only the in-session edit counter differs.
  return `Local rule edits applied since this case was reviewed (${editCount} change${editCount > 1 ? "s" : ""} this session); please re-confirm before filing.`;
}

// ─── Scaffold fixture ──────────────────────────────────────────────────────
//
// Three reviews exercising the queue's behavior:
//   1. case-scaffold-001 — IN-WINDOW (decided, not filed, not closed),
//      stamped at the base version. On the first store edit it gets flagged.
//   2. case-scaffold-002 — FILED. Even after edits, stays out of the queue.
//   3. case-scaffold-003 — CLOSED. Same — locked, excluded.
//
// Replace with the real `intake_reviews JOIN case_records WHERE
// decided_at IS NOT NULL AND filed_at IS NULL AND closed_at IS NULL` once
// persistence lands.

function buildDefaultReviews(): AttorneyReviewRecord[] {
  const base = getCurrentRulesetVersion().id;
  const now = new Date().toISOString();
  return [
    {
      caseId: "case-scaffold-001",
      clientName: "[Scaffold] In-window attorney-reviewed (AZ)",
      state: "AZ",
      decidedAt: now,
      stampedVersionId: base,
      filedAt: null,
      closedAt: null,
      scaffold: true,
    },
    {
      caseId: "case-scaffold-002",
      clientName: "[Scaffold] Filed — locked",
      state: "AZ",
      decidedAt: now,
      stampedVersionId: base,
      filedAt: now,
      closedAt: null,
      scaffold: true,
    },
    {
      caseId: "case-scaffold-003",
      clientName: "[Scaffold] Closed — locked",
      state: "WA",
      decidedAt: now,
      stampedVersionId: base,
      filedAt: null,
      closedAt: now,
      scaffold: true,
    },
  ];
}

// ─── Provider ──────────────────────────────────────────────────────────────

export function RulesAuditProvider({
  children,
  initialReviews,
}: {
  children: ReactNode;
  /** Host can inject a real review list. When omitted the scaffold fixture
   *  above is used so the queue is exercisable end-to-end. */
  initialReviews?: AttorneyReviewRecord[];
}) {
  const [state, setState] = useState<RulesAuditState>(() => ({
    log: [],
    reviews: initialReviews ?? buildDefaultReviews(),
    restampedAt: {},
    resolutions: {},
    editCount: 0,
    publishEvents: [],
  }));

  const recordChange = useCallback<RulesAuditApi["recordChange"]>((input) => {
    setState(prev => {
      const nextEditCount = prev.editCount + 1;
      // affectedCases = in-window reviews that will diff after this bump.
      const affected = prev.reviews.filter(r => {
        if (r.filedAt || r.closedAt) return false;
        if (!r.decidedAt) return false;
        const stamp = prev.restampedAt[r.caseId] ?? r.stampedVersionId;
        return !!diffStampedVsCurrent(stamp, nextEditCount);
      }).length;

      const entry: RulesAuditEntry = {
        id: uid("aud"),
        ts: new Date().toISOString(),
        section: input.section,
        actor: input.actor,
        path: input.path,
        oldValue: input.oldValue,
        newValue: input.newValue,
        source: input.source,
        affectedCases: affected,
      };
      // Bumping editCount changes the effective version id, so derived
      // reReview recomputes — any in-window unresolved case whose stamp is
      // now stale shows up next render.
      return {
        ...prev,
        log: [entry, ...prev.log],
        editCount: nextEditCount,
      };
    });
  }, []);

  const resolveReReview = useCallback<RulesAuditApi["resolveReReview"]>((caseId, action, actor) => {
    setState(prev => {
      const next: RulesAuditState = {
        ...prev,
        resolutions: {
          ...prev.resolutions,
          [caseId]: { status: action, resolvedBy: actor, resolvedAt: new Date().toISOString() },
        },
      };
      // "Mark reviewed" → restamp the case at the current effective version,
      // so the diff goes away until the next edit. "Dismissed" doesn't
      // restamp (so the case remains stale-against-current but is suppressed
      // by the resolution map).
      if (action === "reviewed") {
        next.restampedAt = {
          ...prev.restampedAt,
          [caseId]: effectiveVersionIdFor(prev.editCount),
        };
      }
      return next;
    });
  }, []);

  const logFor = useCallback((section: RulesSection) =>
    state.log.filter(l => l.section === section), [state.log]);

  const effectiveVersionId = useCallback(() => effectiveVersionIdFor(state.editCount), [state.editCount]);

  // Derived: real comparison against current effective version. Filed /
  // closed → excluded; resolved → status reflects last action; everything
  // else → "pending" with a reason line.
  const reReview = useMemo<ReReviewCase[]>(() => {
    const out: ReReviewCase[] = [];
    for (const r of state.reviews) {
      if (r.filedAt || r.closedAt) continue;        // locked
      if (!r.decidedAt) continue;                   // not attorney-reviewed
      const stamp = state.restampedAt[r.caseId] ?? r.stampedVersionId;
      const reason = diffStampedVsCurrent(stamp, state.editCount);
      if (!reason) continue;                        // current — nothing to do
      const resolution = state.resolutions[r.caseId];
      out.push({
        id: r.caseId,
        caseId: r.caseId,
        clientName: r.clientName,
        reason,
        status: resolution?.status ?? "pending",
        enqueuedAt: r.decidedAt,
        resolvedBy: resolution?.resolvedBy,
        resolvedAt: resolution?.resolvedAt,
      });
    }
    return out;
  }, [state.reviews, state.restampedAt, state.resolutions, state.editCount]);

  // Pending change count — edits applied since the most recent publish.
  // Drives the admin portal's "Publish all pending (N)" badge.
  const pendingChangeCount = useCallback((): number => {
    const lastPublish = state.publishEvents[0];
    if (!lastPublish) return state.editCount;
    // The publish event stores the version id at publish time; everything
    // after that publish is pending. Use the log's chronological order
    // (newest first) and count entries newer than the publish timestamp.
    return state.log.filter(l => l.ts > lastPublish.ts).length;
  }, [state.publishEvents, state.editCount, state.log]);

  const publish = useCallback<RulesAuditApi["publish"]>(async ({ actor, scope, effectiveDate, firmIds }) => {
    const current = getCurrentRulesetVersion();
    const versionId = effectiveVersionIdFor(state.editCount);
    const prev = state.publishEvents[0];
    const summary = buildChangeSummary(prev?.versionId ?? null, current);
    const effDate = effectiveDate ?? new Date().toISOString().slice(0, 10);

    // Build the notification payload and dispatch (stubbed — logs only).
    const event: RuleUpdatePublishEvent = {
      publishId: uid("pub"),
      publishedAt: new Date().toISOString(),
      actor,
      versionId,
      parts: current.parts,
      changeSummary: summary,
      effectiveDate: effDate,
    };
    const notifyResult = await notifyRuleUpdate(event, firmIds);

    const publishEvent: PublishEvent = {
      id: event.publishId,
      ts: event.publishedAt,
      actor: event.actor,
      versionId: event.versionId,
      parts: event.parts,
      scope,
      changeSummary: event.changeSummary,
      effectiveDate: event.effectiveDate,
      notifyResult,
    };

    setState(prev2 => ({
      ...prev2,
      publishEvents: [publishEvent, ...prev2.publishEvents],
      log: [{
        id: uid("aud"),
        ts: publishEvent.ts,
        section: "living_standards",        // canonical bucket — the audit-log
                                            // section enum doesn't carry a
                                            // dedicated 'publish' value; the
                                            // function_key in the description
                                            // disambiguates. TODO Phase B —
                                            // expand the section enum.
        actor,
        path: `publish.${Array.isArray(scope) ? scope.join("+") : scope}`,
        oldValue: prev?.versionId ?? null,
        newValue: versionId,
        source: `publish event ${event.publishId}`,
        affectedCases: reReview.length,
      }, ...prev2.log],
    }));

    return publishEvent;
  }, [state.editCount, state.publishEvents, reReview.length]);

  const api: RulesAuditApi = useMemo(() => ({
    log: state.log,
    reviews: state.reviews,
    editCount: state.editCount,
    publishEvents: state.publishEvents,
    reReview,
    recordChange,
    resolveReReview,
    logFor,
    effectiveVersionId,
    publish,
    pendingChangeCount,
  }), [state.log, state.reviews, state.editCount, state.publishEvents, reReview, recordChange, resolveReReview, logFor, effectiveVersionId, publish, pendingChangeCount]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useRulesAudit(): RulesAuditApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRulesAudit must be used inside RulesAuditProvider");
  return v;
}

// Stable helpers — re-exported for external surfaces (e.g. LegalAdminPortal
// could mirror effectiveVersionIdFor when stamping its own reviews so the
// diff message is identical across portals).
export { effectiveVersionIdFor, diffStampedVsCurrent };
