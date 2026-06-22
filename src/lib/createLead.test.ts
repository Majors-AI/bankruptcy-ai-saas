// createLeadAndSubmission tests — canonical intake-submission path.
//
// Covers the scoped contract per the slice plan:
//   - lead OK + submission OK → both ids returned
//   - lead OK + submission fails → honest partial (ok=true, submissionId=null,
//     reason populated)
//   - lead fails → ok=false, no submission attempt
//   - lead-only mode (no submission payload) → ok=true, submissionId=null
//   - channel routing (self_serve vs agent_assisted) reaches the lead creator
//   - lead_id is present on every submission insert (the whole point of the
//     slice — no more orphans)
//
// Uses the dependency-injection seam (`deps.createLead` + `deps.insertSubmission`)
// so the tests stay pure and don't touch the real Supabase client.

import { describe, test, expect, vi } from "vitest";
import {
  createLeadAndSubmission,
  type CreateLeadArgs,
  type CreateLeadResult,
} from "./createLead";

const LEAD_ID = "00000000-0000-0000-0000-00000000aaaa";
const SUBMISSION_ID = "00000000-0000-0000-0000-0000000000a1";

// ── lead creator stubs ──────────────────────────────────────────────────

function leadOk(leadId: string = LEAD_ID): (a: CreateLeadArgs) => Promise<CreateLeadResult> {
  return async () => ({ ok: true, leadId, reason: null });
}

function leadFail(reason: string = "lead_insert_failed"): (a: CreateLeadArgs) => Promise<CreateLeadResult> {
  return async () => ({ ok: false, leadId: null, reason });
}

// ── submission inserter stubs ───────────────────────────────────────────

function submissionOk(id: string = SUBMISSION_ID) {
  return vi.fn(async (_payload: Record<string, unknown>) => ({
    submissionId: id,
    error: null,
  }));
}

function submissionFail(error: string = "rls_violation") {
  return vi.fn(async (_payload: Record<string, unknown>) => ({
    submissionId: null,
    error,
  }));
}

// ── tests ───────────────────────────────────────────────────────────────

describe("createLeadAndSubmission — both succeed", () => {
  test("returns both ids and ok=true", async () => {
    const insert = submissionOk();
    const result = await createLeadAndSubmission(
      {
        channel: "self_serve",
        fullName: "Jane Doe",
        submission: { reference_number: "BAI-X" },
      },
      { createLead: leadOk(), insertSubmission: insert },
    );
    expect(result.ok).toBe(true);
    expect(result.leadId).toBe(LEAD_ID);
    expect(result.submissionId).toBe(SUBMISSION_ID);
    expect(result.reason).toBeNull();
  });

  test("submission insert receives lead_id set to the created lead's id", async () => {
    const insert = submissionOk();
    await createLeadAndSubmission(
      {
        channel: "self_serve",
        submission: { reference_number: "BAI-Y", status: "pending_review" },
      },
      { createLead: leadOk(), insertSubmission: insert },
    );
    expect(insert).toHaveBeenCalledTimes(1);
    const payload = insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.lead_id).toBe(LEAD_ID);
    // Caller-supplied fields are preserved.
    expect(payload.reference_number).toBe("BAI-Y");
    expect(payload.status).toBe("pending_review");
    // submitted_at is forced by the helper.
    expect(typeof payload.submitted_at).toBe("string");
  });
});

describe("createLeadAndSubmission — lead OK, submission fails (honest partial)", () => {
  test("ok=true (lead recorded) but submissionId=null and reason populated", async () => {
    const result = await createLeadAndSubmission(
      {
        channel: "self_serve",
        submission: { reference_number: "BAI-Z" },
      },
      {
        createLead: leadOk(),
        insertSubmission: submissionFail("submission_failed_for_test"),
        tagFailedLead: vi.fn(async () => undefined),
      },
    );
    expect(result.ok).toBe(true);                    // lead exists → ok=true
    expect(result.leadId).toBe(LEAD_ID);
    expect(result.submissionId).toBeNull();          // honest: submission didn't land
    expect(result.reason).toBe("submission_failed_for_test");
  });

  test("tags the just-created lead so it's distinguishable in the Intake queue", async () => {
    // The whole point of the tag: a lead with no paired submission must
    // NOT look identical to a fresh inquiry in the staff queue. We patch
    // the lead row's legacy `source` to a marker value + append a notes
    // line with the failure reason.
    const tag = vi.fn(async () => undefined);
    await createLeadAndSubmission(
      {
        channel: "self_serve",
        submission: { reference_number: "BAI-tag" },
      },
      {
        createLead: leadOk(),
        insertSubmission: submissionFail("rls_block"),
        tagFailedLead: tag,
      },
    );
    expect(tag).toHaveBeenCalledTimes(1);
    expect(tag).toHaveBeenCalledWith(LEAD_ID, "rls_block");
  });

  test("tag is NOT called when submission succeeds (no false flags)", async () => {
    const tag = vi.fn(async () => undefined);
    await createLeadAndSubmission(
      { channel: "self_serve", submission: {} },
      { createLead: leadOk(), insertSubmission: submissionOk(), tagFailedLead: tag },
    );
    expect(tag).not.toHaveBeenCalled();
  });

  test("tag is NOT called when lead creation itself fails (nothing to tag)", async () => {
    const tag = vi.fn(async () => undefined);
    await createLeadAndSubmission(
      { channel: "self_serve", submission: {} },
      { createLead: leadFail(), insertSubmission: submissionOk(), tagFailedLead: tag },
    );
    expect(tag).not.toHaveBeenCalled();
  });
});

describe("createLeadAndSubmission — lead fails", () => {
  test("returns ok=false with no submission attempt", async () => {
    const insert = submissionOk();
    const result = await createLeadAndSubmission(
      {
        channel: "self_serve",
        submission: { reference_number: "BAI-Q" },
      },
      { createLead: leadFail("rls_block"), insertSubmission: insert },
    );
    expect(result.ok).toBe(false);
    expect(result.leadId).toBeNull();
    expect(result.submissionId).toBeNull();
    expect(result.reason).toBe("rls_block");
    // Critical: when the lead fails, the submission inserter must NOT be
    // called — otherwise we'd write an orphan, the exact bug this slice fixes.
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("createLeadAndSubmission — lead-only mode (no submission payload)", () => {
  test("returns ok=true with leadId and submissionId=null; inserter never called", async () => {
    const insert = submissionOk();
    const result = await createLeadAndSubmission(
      { channel: "call_now", fullName: "Lead Only" },
      { createLead: leadOk(), insertSubmission: insert },
    );
    expect(result.ok).toBe(true);
    expect(result.leadId).toBe(LEAD_ID);
    expect(result.submissionId).toBeNull();
    expect(result.reason).toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("createLeadAndSubmission — channel routing", () => {
  test("channel='self_serve' is passed through to the lead creator", async () => {
    const create = vi.fn(leadOk());
    await createLeadAndSubmission(
      { channel: "self_serve", submission: {} },
      { createLead: create, insertSubmission: submissionOk() },
    );
    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0]?.[0] as CreateLeadArgs;
    expect(args.channel).toBe("self_serve");
  });

  test("channel='agent_assisted' is passed through to the lead creator", async () => {
    const create = vi.fn(leadOk());
    await createLeadAndSubmission(
      { channel: "agent_assisted", submission: {} },
      { createLead: create, insertSubmission: submissionOk() },
    );
    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0]?.[0] as CreateLeadArgs;
    expect(args.channel).toBe("agent_assisted");
  });

  test("contact fields (fullName / email / phone) reach the lead creator", async () => {
    const create = vi.fn(leadOk());
    await createLeadAndSubmission(
      {
        channel: "self_serve",
        fullName: "Sam Sample",
        email: "sam@example.test",
        phone: "555-0100",
        submission: {},
      },
      { createLead: create, insertSubmission: submissionOk() },
    );
    const args = create.mock.calls[0]?.[0] as CreateLeadArgs;
    expect(args.fullName).toBe("Sam Sample");
    expect(args.email).toBe("sam@example.test");
    expect(args.phone).toBe("555-0100");
  });
});
