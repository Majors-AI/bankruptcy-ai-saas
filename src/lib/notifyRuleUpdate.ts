// Transactional notification stub — emits a per-firm email when the
// Bankruptcy.AI operator publishes a canonical ruleset update.
//
// PATH: TRANSACTIONAL / OPERATIONAL — distinct from the Client PR mass-
// mail surface. Rule-update emails are an operational notice about
// changes affecting active cases; they MUST NOT route through the
// mass-mail / CAN-SPAM compliance path (opt-in suppression, advertising
// disclosure, etc.). They use the firm's per-firm "rule-update
// notifications" preference (default ON) instead.
//
// SCAFFOLD: this file LOGS the dispatch and returns the resolved
// recipient set + payload. NO actual API call is made. Wiring to
// SendGrid (or the equivalent transactional provider) lands when
// persistence + the publish pipeline ship.

import {
  diffRulesetVersions, type RulesetVersion,
} from "./irsMeansStandards";

// ─── Contract ──────────────────────────────────────────────────────────────

export interface RuleUpdatePublishEvent {
  /** Stable id for the publish — typically the publish-event id from the
   *  rulesAuditStore. */
  publishId: string;
  /** ISO timestamp of the publish. */
  publishedAt: string;
  /** Operator who published. */
  actor: string;
  /** Effective dataset version (concatenated effective dates + edit counter
   *  per the existing getCurrentRulesetVersion()). */
  versionId: string;
  /** Per-dataset effective-date breakouts. */
  parts: RulesetVersion["parts"];
  /** Stamp-vs-current diff string built via diffRulesetVersions — drives
   *  the plain-language change summary in the email body. */
  changeSummary: string;
  /** Effective date the operator declared for this publish (typically the
   *  most recent effectiveDate among the datasets). */
  effectiveDate: string;
}

export interface FirmRecipient {
  firmId: string;
  firmName: string;
  /** Recipient emails resolved server-side from the firm's staff_members /
   *  user_profiles table. Today: stub array — when persistence wires up,
   *  the resolver below issues the real query against (firms, staff_members
   *  WHERE intake_portal_role IN ('attorney_super_admin', 'attorney') OR
   *  firm role = 'law_firm_owner') filtered by the per-firm rule-update
   *  preference. */
  recipients: Array<{ email: string; role: string; name?: string }>;
  /** Count of in-window cases re-flagged for re-review at this firm as a
   *  result of the publish — appears in the email body so the firm knows
   *  what to expect in the re-review queue. */
  affectedCases: number;
  /** Deep link into the firm's re-review queue. Today: relative path the
   *  email template renders against the firm's base URL. */
  deepLink: string;
  /** Per-firm preference (default ON). When false the dispatch skips the
   *  firm; the audit log still records the publish + the per-firm "skipped
   *  by preference" entry. */
  notificationsEnabled: boolean;
}

export interface NotifyResult {
  publishId: string;
  attempted: number;
  delivered: number;
  skipped: Array<{ firmId: string; reason: "preference_off" | "no_recipients" | "stub" }>;
  errors: Array<{ firmId: string; error: string }>;
}

// ─── Per-firm preferences (scaffold) ───────────────────────────────────────
//
// In-memory default. When persistence wires up, replace with a real query
// against firm_settings.rule_update_notifications_enabled (default true).
// The Bankruptcy.AI operator can override per-firm; the firm owner can
// toggle from inside Law Firm Settings (TODO surface).

const FIRM_PREF_DEFAULTS = new Map<string, boolean>();

export function getFirmRuleUpdatePreference(firmId: string): boolean {
  // Default ON for every firm. Cached overrides land here when persistence
  // wires up.
  return FIRM_PREF_DEFAULTS.get(firmId) ?? true;
}

export function setFirmRuleUpdatePreference(firmId: string, enabled: boolean): void {
  FIRM_PREF_DEFAULTS.set(firmId, enabled);
  // TODO Phase B — upsert into firm_settings.rule_update_notifications_enabled
  // server-side and write an audit entry.
}

// ─── Recipient resolver (scaffold) ─────────────────────────────────────────
//
// Real implementation: a Supabase RPC that joins staff_members + firms +
// user_profiles to return the firm owner + every staffer whose
// intake_portal_role ∈ {'attorney_super_admin', 'attorney'} (or
// equivalent supervising-attorney role) for each affected firm. Today the
// stub returns an empty recipient list so the build stays clean without
// reaching to the database.

export async function resolveFirmRecipients(
  firmIds: ReadonlyArray<string>,
): Promise<Array<Omit<FirmRecipient, "affectedCases" | "deepLink" | "notificationsEnabled">>> {
  // TODO Phase B — real query:
  //   SELECT f.id, f.name, s.email, s.intake_portal_role, s.full_name
  //   FROM firms f
  //   JOIN staff_members s ON s.firm_id = f.id
  //   WHERE f.id = ANY($1) AND s.deactivated_at IS NULL
  //     AND (s.intake_portal_role IN ('attorney_super_admin', 'attorney')
  //          OR f.owner_user_id = s.user_id);
  return firmIds.map(firmId => ({
    firmId,
    firmName: firmId,                        // stub label
    recipients: [],                          // empty until resolver wires up
  }));
}

// ─── Per-firm in-window re-review count helper ─────────────────────────────
//
// Cardinality of cases newly flagged by this publish. Stub returns 0; the
// real implementation reads from the firm's attorney_intake_reviews table
// where stamped_ruleset_version != current AND filed_at IS NULL AND
// closed_at IS NULL.

export function countAffectedCases(firmId: string, _publishedVersion: string): number {
  void firmId;
  // TODO Phase B — server-side query against intake_reviews per firm.
  return 0;
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

/**
 * Enqueue rule-update emails for every firm. Per-firm:
 *   - skips firms whose preference is OFF
 *   - skips firms with no resolved recipients
 *   - logs the dispatch payload (until SendGrid wires up)
 *
 * Returns the dispatch summary so the caller can surface it on the publish
 * confirmation banner ("queued N emails to M firms").
 */
export async function notifyRuleUpdate(
  event: RuleUpdatePublishEvent,
  firmIds: ReadonlyArray<string>,
): Promise<NotifyResult> {
  const result: NotifyResult = {
    publishId: event.publishId,
    attempted: 0,
    delivered: 0,
    skipped: [],
    errors: [],
  };

  const resolved = await resolveFirmRecipients(firmIds);

  for (const r of resolved) {
    const notificationsEnabled = getFirmRuleUpdatePreference(r.firmId);
    if (!notificationsEnabled) {
      result.skipped.push({ firmId: r.firmId, reason: "preference_off" });
      continue;
    }
    if (r.recipients.length === 0) {
      result.skipped.push({ firmId: r.firmId, reason: "no_recipients" });
      continue;
    }
    const firm: FirmRecipient = {
      ...r,
      affectedCases: countAffectedCases(r.firmId, event.versionId),
      deepLink: `/firm/${r.firmId}/law-firm-settings/re-review`,
      notificationsEnabled,
    };

    // SCAFFOLD — log the payload that WOULD ship via SendGrid. NO real
    // network call; NO API key reads; nothing leaves the process.
    // eslint-disable-next-line no-console
    console.log("[notifyRuleUpdate] (scaffold) would dispatch transactional email", {
      firm: { id: firm.firmId, name: firm.firmName },
      recipients: firm.recipients,
      affectedCases: firm.affectedCases,
      deepLink: firm.deepLink,
      event: {
        publishId: event.publishId,
        publishedAt: event.publishedAt,
        actor: event.actor,
        versionId: event.versionId,
        effectiveDate: event.effectiveDate,
        changeSummary: event.changeSummary,
        parts: event.parts,
      },
      template: "rule_update_notification",
      channel: "transactional",
      compliancePath: "NOT mass-mail / NOT CAN-SPAM advertising — operational notice",
    });
    result.attempted += 1;
    result.skipped.push({ firmId: r.firmId, reason: "stub" });
  }

  return result;
}

/** Convenience: build a plain-language change summary from a stamped → current
 *  diff. Wraps diffRulesetVersions so callers don't have to import it. */
export function buildChangeSummary(stampedId: string | null, current: RulesetVersion): string {
  return diffRulesetVersions(stampedId, current)
    ?? "Ruleset updated — no individual dataset deltas detected. Verify before filing.";
}
