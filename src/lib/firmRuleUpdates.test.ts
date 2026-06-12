// Tests for the firm-side rule-update gate (Slice 5).
//
// Covers:
//   1. evaluatePreFilingGate — the pure pre-filing gate condition.
//   2. enqueue → accept round-trip — applied version bumps correctly,
//      pending is drained, idempotent re-enqueue is a no-op.

import { describe, expect, it, beforeEach } from "vitest";
import {
  evaluatePreFilingGate, enqueueForFirms, acceptForFirm,
  getFirmAppliedRulesVersion, hasPendingForFirm,
} from "./firmRuleUpdates";
import type { PublishEvent } from "../components/law-firm-settings/rulesAuditStore";

function makeEvent(overrides: Partial<PublishEvent> = {}): PublishEvent {
  return {
    id: "evt-1",
    ts: "2026-06-11T12:00:00Z",
    actor: "operator@bankruptcy.ai",
    versionId: "v2026-06-11::edits:0",
    parts: {
      medianIncome:      "2025-04-01",
      irsStandards:      "2025-04-01",
      federalExemptions: "2025-04-01",
      azExemptions:      "2026-02-23",
      waExemptions:      "2026-02-23",
    },
    scope: ["median_income"],
    changeSummary: "Median income table updated for 2026Q2.",
    effectiveDate: "2026-06-11",
    notifyResult: undefined,
    ...overrides,
  };
}

describe("evaluatePreFilingGate", () => {
  it("no applied version → gate not applied (greenfield firm)", () => {
    const g = evaluatePreFilingGate({
      firmAppliedVersionId: null,
      caseStampedVersionId: "v2026-06-11::edits:0",
    });
    expect(g.ok).toBe(true);
    expect(g.staleReview).toBe(false);
  });

  it("case has no stamp + firm has applied version → BLOCKED (pre-versioning case)", () => {
    const g = evaluatePreFilingGate({
      firmAppliedVersionId: "v2026-06-11",
      caseStampedVersionId: null,
    });
    expect(g.ok).toBe(false);
    expect(g.staleReview).toBe(true);
    expect(g.reason).toMatch(/re-review required/i);
  });

  it("matching stamps → gate passes", () => {
    const g = evaluatePreFilingGate({
      firmAppliedVersionId: "v2026-06-11",
      caseStampedVersionId: "v2026-06-11",
    });
    expect(g.ok).toBe(true);
    expect(g.staleReview).toBe(false);
  });

  it("mismatched stamps → BLOCKED with the spec'd warning text", () => {
    const g = evaluatePreFilingGate({
      firmAppliedVersionId: "v2026-06-11",
      caseStampedVersionId: "v2026-04-01",
    });
    expect(g.ok).toBe(false);
    expect(g.staleReview).toBe(true);
    expect(g.reason).toMatch(/Updated rules apply — re-review required before filing/);
  });
});

describe("enqueue → accept round-trip", () => {
  const firmId = "test-firm-1";

  beforeEach(() => {
    // Reset state by accepting any existing pending so subsequent tests
    // start clean. (We can't directly clear the module-level singleton.)
    while (hasPendingForFirm(firmId)) {
      // Find the pending event ids by importing the snapshot — emulate via
      // re-enqueue + accept cycle. Simpler: just call accept with each
      // possible id we've used in tests.
      acceptForFirm(firmId, "evt-1", "test");
      acceptForFirm(firmId, "evt-2", "test");
      acceptForFirm(firmId, "evt-pending", "test");
    }
  });

  it("enqueueForFirms makes the event visible in pending; not yet applied", () => {
    enqueueForFirms(makeEvent({ id: "evt-pending", versionId: "v-pending" }), [firmId]);
    expect(hasPendingForFirm(firmId)).toBe(true);
    expect(getFirmAppliedRulesVersion(firmId)).not.toBe("v-pending");
  });

  it("acceptForFirm drains pending + bumps applied version", () => {
    enqueueForFirms(makeEvent({ id: "evt-1", versionId: "v-applied-1" }), [firmId]);
    const ok = acceptForFirm(firmId, "evt-1", "law_firm_owner");
    expect(ok).toBe(true);
    expect(hasPendingForFirm(firmId)).toBe(false);
    expect(getFirmAppliedRulesVersion(firmId)).toBe("v-applied-1");
  });

  it("re-enqueue of an already-pending event is a no-op (idempotent)", () => {
    enqueueForFirms(makeEvent({ id: "evt-2", versionId: "v-applied-2" }), [firmId]);
    enqueueForFirms(makeEvent({ id: "evt-2", versionId: "v-applied-2" }), [firmId]);
    enqueueForFirms(makeEvent({ id: "evt-2", versionId: "v-applied-2" }), [firmId]);
    // Drain one — should be empty.
    acceptForFirm(firmId, "evt-2", "law_firm_owner");
    expect(hasPendingForFirm(firmId)).toBe(false);
  });

  it("acceptForFirm with unknown id is a no-op + returns false", () => {
    const ok = acceptForFirm(firmId, "nonexistent-event-id", "law_firm_owner");
    expect(ok).toBe(false);
  });
});
