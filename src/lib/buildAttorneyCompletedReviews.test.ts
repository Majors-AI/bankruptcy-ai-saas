// Unit tests for buildAttorneyCompletedReviews.

import { describe, test, expect } from "vitest";
import { buildAttorneyCompletedReviews } from "./buildAttorneyCompletedReviews";
import type {
  AttorneyIntakeReviewRow,
  IntakeLeadRow,
  AcceptanceRow,
} from "../components/legal/legalTasks";

function lead(id: string, overrides: Partial<IntakeLeadRow> = {}): IntakeLeadRow {
  return { id, full_name: `Lead ${id}`, ...overrides };
}

function review(id: string, leadId: string, overrides: Partial<AttorneyIntakeReviewRow> = {}): AttorneyIntakeReviewRow {
  return {
    id,
    lead_id: leadId,
    submission_id: null,
    attorney_name: "Atty A",
    decision: "accepted",
    review_status: "completed",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    decided_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function acceptance(leadId: string, overrides: Partial<AcceptanceRow> = {}): AcceptanceRow {
  return {
    id: `acc-${leadId}`,
    lead_id: leadId,
    decision: "accepted",
    chapter: 7,
    case_type: "ch7_regular",
    decided_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildAttorneyCompletedReviews", () => {
  test("returns empty when no decided reviews exist", () => {
    const out = buildAttorneyCompletedReviews({
      attorneyIntakeReviews: [],
      intakeLeads: [lead("L1")],
      acceptances: [],
    });
    expect(out).toEqual([]);
  });

  test("excludes pending-decision rows; includes accepted + declined", () => {
    const out = buildAttorneyCompletedReviews({
      attorneyIntakeReviews: [
        review("r1", "L1", { decision: "pending" }),
        review("r2", "L2", { decision: "accepted" }),
        review("r3", "L3", { decision: "declined" }),
      ],
      intakeLeads: [lead("L1"), lead("L2"), lead("L3")],
      acceptances: [],
    });
    const ids = out.map(r => r.leadId);
    expect(ids).not.toContain("L1");
    expect(ids).toEqual(expect.arrayContaining(["L2", "L3"]));
  });

  test("collapses multiple review rounds per lead to the latest; reports reviewCount", () => {
    const out = buildAttorneyCompletedReviews({
      attorneyIntakeReviews: [
        review("r1", "L1", { decided_at: "2026-01-01T00:00:00Z", decision_notes: "first round" }),
        review("r2", "L1", { decided_at: "2026-02-01T00:00:00Z", decision_notes: "second round" }),
        review("r3", "L1", { decided_at: "2026-03-01T00:00:00Z", decision_notes: "latest" }),
      ],
      intakeLeads: [lead("L1")],
      acceptances: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0].decisionNotes).toBe("latest");
    expect(out[0].reviewCount).toBe(3);
  });

  test("chapter resolution prefers acceptance.chapter, falls back to lead.chapter_interest", () => {
    const out = buildAttorneyCompletedReviews({
      attorneyIntakeReviews: [
        review("r1", "Lacc", { decision: "accepted" }),
        review("r2", "Lfall", { decision: "accepted" }),
        review("r3", "Lnull", { decision: "accepted" }),
      ],
      intakeLeads: [
        lead("Lacc",  { chapter_interest: 13 }),  // acceptance overrides this
        lead("Lfall", { chapter_interest: 7 }),
        lead("Lnull"),
      ],
      acceptances: [
        acceptance("Lacc", { chapter: 7 }),
      ],
    });
    const byId = Object.fromEntries(out.map(r => [r.leadId, r]));
    expect(byId.Lacc.chapter).toBe(7);   // from acceptance
    expect(byId.Lfall.chapter).toBe(7);  // from chapter_interest
    expect(byId.Lnull.chapter).toBeNull();
  });

  test("outcome reflects lead.status for accepted decisions", () => {
    const out = buildAttorneyCompletedReviews({
      attorneyIntakeReviews: [
        review("r1", "Lret",   { decision: "accepted" }),
        review("r2", "Lno",    { decision: "accepted" }),
        review("r3", "Lns",    { decision: "accepted" }),
        review("r4", "Lfee",   { decision: "accepted" }),
        review("r5", "Lwtf",   { decision: "accepted" }),
      ],
      intakeLeads: [
        lead("Lret",  { status: "retained" }),
        lead("Lno",   { status: "no_case" }),
        lead("Lns",   { status: "no_show" }),
        lead("Lfee",  { status: "fee_quoted" }),
        lead("Lwtf",  { status: "some_unknown_status" }),
      ],
      acceptances: [],
    });
    const byId = Object.fromEntries(out.map(r => [r.leadId, r]));
    expect(byId.Lret.outcome).toBe("retained");
    expect(byId.Lno.outcome).toBe("no_case");
    expect(byId.Lns.outcome).toBe("no_show");
    expect(byId.Lfee.outcome).toBe("fee_quoted_pending");
    expect(byId.Lwtf.outcome).toBe("unknown");
  });

  test("declined decision propagates as the outcome unless the lead later retained", () => {
    const out = buildAttorneyCompletedReviews({
      attorneyIntakeReviews: [
        review("r1", "Ldec1", { decision: "declined" }),
        review("r2", "Ldec2", { decision: "declined" }),
      ],
      intakeLeads: [
        lead("Ldec1", { status: "declined" }),
        lead("Ldec2", { status: "retained" }),  // override path
      ],
      acceptances: [],
    });
    const byId = Object.fromEntries(out.map(r => [r.leadId, r]));
    expect(byId.Ldec1.outcome).toBe("declined");
    expect(byId.Ldec2.outcome).toBe("retained");
  });

  test("missing lead row yields '(unnamed)' but still produces a row", () => {
    const out = buildAttorneyCompletedReviews({
      attorneyIntakeReviews: [review("r1", "Lorphan", { decision: "accepted" })],
      intakeLeads: [],  // no matching lead
      acceptances: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0].clientName).toBe("(unnamed)");
    expect(out[0].outcome).toBe("unknown");
  });

  test("sorts newest decided_at first; rows with null decided_at sink to bottom", () => {
    const out = buildAttorneyCompletedReviews({
      attorneyIntakeReviews: [
        review("r1", "L1", { decided_at: "2026-01-01T00:00:00Z" }),
        review("r2", "L2", { decided_at: "2026-03-01T00:00:00Z" }),
        review("r3", "L3", { decided_at: null, created_at: "2026-02-15T00:00:00Z" }),
        review("r4", "L4", { decided_at: "2026-02-01T00:00:00Z" }),
      ],
      intakeLeads: [lead("L1"), lead("L2"), lead("L3"), lead("L4")],
      acceptances: [],
    });
    expect(out.map(r => r.leadId)).toEqual(["L2", "L4", "L1", "L3"]);
  });

  test("rows without a lead_id are dropped (defensive)", () => {
    const out = buildAttorneyCompletedReviews({
      attorneyIntakeReviews: [
        review("r1", "L1", { decision: "accepted" }),
        // Defensive — review row with null lead_id should not crash.
        { ...review("r2", "L2"), lead_id: null },
      ],
      intakeLeads: [lead("L1")],
      acceptances: [],
    });
    expect(out.map(r => r.leadId)).toEqual(["L1"]);
  });
});
