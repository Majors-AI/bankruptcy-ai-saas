// Firm-pending rules updates + per-firm applied version (Slice 5).
//
// Today: when the operator publishes (rulesAuditStore.publish), the new
// PublishEvent emits globally and the rule changes are visible firm-wide
// immediately. Slice 5 inserts a per-firm ACCEPT GATE between the
// operator publish and the firm "applied" version:
//
//   operator publish → PublishEvent emitted
//                    ↓
//       firmRuleUpdates.enqueue(event, firmIds)
//                    ↓
//         each firm sees "Rule update available"
//                    ↓
//       firm owner / supervising attorney clicks Accept & apply
//                    ↓
//      firmRuleUpdates.acceptForFirm(firmId, eventId)
//                    ↓
//         firm.appliedRulesVersion = event.versionId
//                    ↓
//   existing rulesAuditStore re-review derivation flags stale cases
//   (diffStampedVsCurrent picks up the version mismatch automatically —
//    no new fan-out wiring needed).
//
// Pre-filing gate compares case.lastReviewedRulesVersion to the firm's
// appliedRulesVersion; mismatch = blocked.
//
// SCAFFOLD: in-memory + localStorage. TODO Phase B —
// firm_rule_pending_updates(firm_id, publish_event_id, status,
// accepted_by, accepted_at) + firm_applied_rules_version(firm_id,
// version_id, applied_at).

import { useEffect, useState } from "react";
import type { PublishEvent } from "../components/law-firm-settings/rulesAuditStore";

// ─── Types ────────────────────────────────────────────────────────────────

export interface FirmPendingUpdate {
  /** Foreign key to the operator PublishEvent. */
  publishEventId: string;
  /** Snapshot of the event for surface rendering (don't trust the
   *  upstream store to retain stale events). */
  versionId: string;
  scope: PublishEvent["scope"];
  changeSummary: string;
  effectiveDate: string;
  /** When the event was enqueued for this firm (UTC ISO). */
  enqueuedAt: string;
}

export interface FirmRuleState {
  /** Pending publish events the firm hasn't accepted yet. Newest first. */
  pending: FirmPendingUpdate[];
  /** Versions the firm has accepted, newest first. The HEAD of this list
   *  is the firm's currently-applied ruleset version. */
  accepted: AcceptedRecord[];
}

export interface AcceptedRecord {
  publishEventId: string;
  versionId: string;
  acceptedBy: string;
  acceptedAt: string;
  /** Snapshot of the event metadata for audit display. */
  effectiveDate: string;
  scope: PublishEvent["scope"];
  changeSummary: string;
}

// ─── Storage ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "firmRuleUpdates";

let _byFirm: Map<string, FirmRuleState> = (() => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, FirmRuleState>;
      const m = new Map<string, FirmRuleState>();
      for (const [k, v] of Object.entries(parsed)) {
        if (v && Array.isArray(v.pending) && Array.isArray(v.accepted)) m.set(k, v);
      }
      return m;
    }
  } catch { /* ignore */ }
  return new Map();
})();

const _subscribers = new Set<() => void>();
function _notify() { _subscribers.forEach(fn => fn()); }
function _persist() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(_byFirm)));
  } catch { /* ignore */ }
}

function _emptyState(): FirmRuleState {
  return { pending: [], accepted: [] };
}
function _ensure(firmId: string): FirmRuleState {
  let s = _byFirm.get(firmId);
  if (!s) { s = _emptyState(); _byFirm.set(firmId, s); }
  return s;
}

// ─── API ──────────────────────────────────────────────────────────────────

/** Enqueue a fresh operator PublishEvent for the given firms. Idempotent —
 *  re-enqueueing the same event id is a no-op. Doesn't bump the firm's
 *  applied version (that happens on acceptForFirm). */
export function enqueueForFirms(
  event: PublishEvent,
  firmIds: ReadonlyArray<string>,
): void {
  const pendingRec: FirmPendingUpdate = {
    publishEventId: event.id,
    versionId:      event.versionId,
    scope:          event.scope,
    changeSummary:  event.changeSummary,
    effectiveDate:  event.effectiveDate,
    enqueuedAt:     new Date().toISOString(),
  };
  let touched = false;
  for (const firmId of firmIds) {
    const s = _ensure(firmId);
    // Skip if already pending or already accepted.
    if (s.pending.some(p => p.publishEventId === event.id)) continue;
    if (s.accepted.some(a => a.publishEventId === event.id)) continue;
    s.pending = [pendingRec, ...s.pending];
    touched = true;
  }
  if (touched) { _persist(); _notify(); }
}

/** Firm owner / supervising attorney accepts a pending update. Moves the
 *  event from pending → accepted (HEAD); the existing rulesAuditStore
 *  re-review derivation picks up the version mismatch for in-window
 *  cases automatically. Returns true on success. */
export function acceptForFirm(
  firmId: string,
  publishEventId: string,
  acceptedBy: string,
): boolean {
  const s = _ensure(firmId);
  const idx = s.pending.findIndex(p => p.publishEventId === publishEventId);
  if (idx === -1) return false;
  const p = s.pending[idx];
  s.pending = s.pending.filter((_, i) => i !== idx);
  s.accepted = [
    {
      publishEventId: p.publishEventId,
      versionId:      p.versionId,
      acceptedBy:     acceptedBy.trim() || "unknown",
      acceptedAt:     new Date().toISOString(),
      effectiveDate:  p.effectiveDate,
      scope:          p.scope,
      changeSummary:  p.changeSummary,
    },
    ...s.accepted,
  ];
  _persist();
  _notify();
  return true;
}

/** The firm's currently-applied ruleset version — HEAD of accepted, or
 *  null when the firm has never accepted (pre-Slice-5 cases / fresh
 *  firms). Pre-filing gate compares case stamps against this. */
export function getFirmAppliedRulesVersion(firmId: string): string | null {
  const s = _byFirm.get(firmId);
  return s?.accepted[0]?.versionId ?? null;
}

/** Whether a firm has at least one pending update. */
export function hasPendingForFirm(firmId: string): boolean {
  return (_byFirm.get(firmId)?.pending.length ?? 0) > 0;
}

/** Reactive hook — the full FirmRuleState for one firm. Powers the
 *  accept-notice banner + the pre-filing gate. */
export function useFirmRuleState(firmId: string): FirmRuleState {
  const read = () => _byFirm.get(firmId) ?? _emptyState();
  const [snapshot, setSnapshot] = useState<FirmRuleState>(read);
  useEffect(() => {
    const sync = () => setSnapshot(read());
    _subscribers.add(sync);
    sync();
    return () => { _subscribers.delete(sync); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmId]);
  return snapshot;
}

/** Reactive hook — the firm's currently-applied ruleset version (or null). */
export function useFirmAppliedRulesVersion(firmId: string): string | null {
  const state = useFirmRuleState(firmId);
  return state.accepted[0]?.versionId ?? null;
}

// ─── Pre-filing gate helper ───────────────────────────────────────────────

export interface PreFilingGateResult {
  /** True when filing/advancing is permitted. */
  ok: boolean;
  /** Human reason when blocked. */
  reason: string;
  /** Whether the gate is gated by a stale review (the most common case).
   *  When false the case may simply have no firm-applied version yet
   *  (greenfield); the gate then passes by default. */
  staleReview: boolean;
  /** Firm's applied version (or null). */
  firmAppliedVersionId: string | null;
  /** Case's last-reviewed version (or null). */
  caseStampedVersionId: string | null;
}

/** Track which publish-event ids the firm has already SEEN at least once
 *  in this browser session — used by useFirmRuleAutoEnqueue to skip
 *  re-enqueueing on every render. Keyed `${firmId}|${publishEventId}`. */
const _seenByFirm = new Set<string>();

/** Hook helper — given the firm and the upstream publishEvents from
 *  useRulesAudit, enqueue any new events for this firm. Idempotent;
 *  re-renders are cheap. Components call this near the top of their
 *  render tree so the firm sees the pending update as soon as the
 *  operator publishes. */
export function autoEnqueueForFirm(
  firmId: string,
  publishEvents: ReadonlyArray<PublishEvent>,
): void {
  for (const ev of publishEvents) {
    const k = `${firmId}|${ev.id}`;
    if (_seenByFirm.has(k)) continue;
    _seenByFirm.add(k);
    enqueueForFirms(ev, [firmId]);
  }
}

/** Compare case stamp vs firm applied version. Pure function — exported
 *  so tests can pin this behavior. */
export function evaluatePreFilingGate(input: {
  firmAppliedVersionId: string | null;
  caseStampedVersionId: string | null;
}): PreFilingGateResult {
  const { firmAppliedVersionId, caseStampedVersionId } = input;
  // No applied version → no gate (fresh firm; no rules baseline yet).
  if (firmAppliedVersionId == null) {
    return {
      ok: true,
      reason: "Firm has no accepted ruleset version yet — gate not applied.",
      staleReview: false,
      firmAppliedVersionId, caseStampedVersionId,
    };
  }
  // Case never stamped → always stale (pre-versioning era cases).
  if (caseStampedVersionId == null) {
    return {
      ok: false,
      reason: "Case has no recorded review stamp. Updated rules apply — re-review required before filing.",
      staleReview: true,
      firmAppliedVersionId, caseStampedVersionId,
    };
  }
  if (caseStampedVersionId === firmAppliedVersionId) {
    return {
      ok: true,
      reason: "Case reviewed against the firm's currently-applied ruleset.",
      staleReview: false,
      firmAppliedVersionId, caseStampedVersionId,
    };
  }
  return {
    ok: false,
    reason: "Updated rules apply — re-review required before filing.",
    staleReview: true,
    firmAppliedVersionId, caseStampedVersionId,
  };
}
