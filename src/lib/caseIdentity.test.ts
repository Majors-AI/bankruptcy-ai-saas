// caseIdentity tests — pure resolver behavior + URL helper.
//
// Async resolveLeadIdAsync() is NOT tested here (would need a supabase
// mock + jsdom). The pure resolveLeadId() captures the same join logic
// — when the §12 S7 RPC ships, the RPC's behavior is asserted against
// the same fixture shape these tests use.

import { describe, test, expect } from "vitest";
import {
  resolveLeadId,
  readLeadIdFromUrl,
  type LeadIdSnapshot,
  type SubmissionLookupRow,
  type ClientLookupRow,
} from "../legal-portal/caseIdentity";

const LEAD_A      = "00000000-0000-0000-0000-00000000aaaa";
const LEAD_B      = "00000000-0000-0000-0000-00000000bbbb";
const SUB_A       = "00000000-0000-0000-0000-00000000aa01"; // submission for LEAD_A
const SUB_B       = "00000000-0000-0000-0000-00000000bb01"; // submission for LEAD_B
const CLIENT_A    = "00000000-0000-0000-0000-0000aa000001"; // client for SUB_A
const ORPHAN      = "00000000-0000-0000-0000-00000000ffff"; // no path

function snapshot(opts: {
  leads?: string[];
  subs?: Array<[string, string | null]>;            // [id, lead_id]
  clients?: Array<[string, string | null]>;         // [id, intake_id]
}): LeadIdSnapshot {
  const submissionsById = new Map<string, SubmissionLookupRow>(
    (opts.subs ?? []).map(([id, lead_id]) => [id, { id, lead_id }]),
  );
  const clientsById = new Map<string, ClientLookupRow>(
    (opts.clients ?? []).map(([id, intake_id]) => [id, { id, intake_id }]),
  );
  return {
    intakeLeadIds: opts.leads ? new Set(opts.leads) : undefined,
    submissionsById,
    clientsById,
  };
}

describe("resolveLeadId — pure resolver", () => {
  test("Stream A passthrough — input is a known leadId", () => {
    const snap = snapshot({ leads: [LEAD_A, LEAD_B] });
    expect(resolveLeadId(LEAD_A, snap)).toBe(LEAD_A);
    expect(resolveLeadId(LEAD_B, snap)).toBe(LEAD_B);
  });

  test("Stream B → A — input is a submission id, returns its lead_id", () => {
    const snap = snapshot({
      leads: [LEAD_A, LEAD_B],
      subs: [[SUB_A, LEAD_A], [SUB_B, LEAD_B]],
    });
    expect(resolveLeadId(SUB_A, snap)).toBe(LEAD_A);
    expect(resolveLeadId(SUB_B, snap)).toBe(LEAD_B);
  });

  test("Stream C → B → A — input is a client id, follows intake_id then lead_id", () => {
    const snap = snapshot({
      leads: [LEAD_A],
      subs: [[SUB_A, LEAD_A]],
      clients: [[CLIENT_A, SUB_A]],
    });
    expect(resolveLeadId(CLIENT_A, snap)).toBe(LEAD_A);
  });

  test("strict mode — intakeLeadIds is provided but input is unknown → null", () => {
    const snap = snapshot({ leads: [LEAD_A], subs: [], clients: [] });
    expect(resolveLeadId(ORPHAN, snap)).toBeNull();
  });

  test("strict mode — submission exists but has null lead_id → null (no fallback)", () => {
    const snap = snapshot({
      leads: [LEAD_A],
      subs: [[SUB_A, null]],            // orphan submission — no parent lead
    });
    expect(resolveLeadId(SUB_A, snap)).toBeNull();
  });

  test("strict mode — client exists but intake_id is null → null", () => {
    const snap = snapshot({
      leads: [LEAD_A],
      subs: [[SUB_A, LEAD_A]],
      clients: [[CLIENT_A, null]],      // client never linked to a submission
    });
    expect(resolveLeadId(CLIENT_A, snap)).toBeNull();
  });

  test("strict mode — client.intake_id points to a missing submission → null", () => {
    const snap = snapshot({
      leads: [LEAD_A],
      subs: [],                          // submission gone (deleted / wrong firm)
      clients: [[CLIENT_A, SUB_A]],
    });
    expect(resolveLeadId(CLIENT_A, snap)).toBeNull();
  });

  test("trust-the-caller — intakeLeadIds absent, input has no join → returns input verbatim", () => {
    // Common case for Queue → workspace: caller knows the input came
    // from a leadId-bearing source and doesn't pre-load a lead-id set.
    const snap: LeadIdSnapshot = {
      intakeLeadIds: undefined,         // not provided
      submissionsById: new Map(),
      clientsById: new Map(),
    };
    expect(resolveLeadId(LEAD_A, snap)).toBe(LEAD_A);
  });

  test("trust-the-caller — join hits still beat passthrough", () => {
    // Even without intakeLeadIds, if the input matches a submission row
    // we use the join (the caller might be passing a submissionId by
    // mistake — we resolve correctly).
    const snap: LeadIdSnapshot = {
      intakeLeadIds: undefined,
      submissionsById: new Map([[SUB_A, { id: SUB_A, lead_id: LEAD_A }]]),
      clientsById: new Map(),
    };
    expect(resolveLeadId(SUB_A, snap)).toBe(LEAD_A);
  });

  test("null / undefined / empty input → null", () => {
    const snap = snapshot({ leads: [LEAD_A] });
    expect(resolveLeadId(null, snap)).toBeNull();
    expect(resolveLeadId(undefined, snap)).toBeNull();
    expect(resolveLeadId("", snap)).toBeNull();
  });

  test("non-string input is rejected (defensive)", () => {
    const snap = snapshot({ leads: [LEAD_A] });
    // Cast through unknown to test runtime behavior with garbage input
    expect(resolveLeadId(123 as unknown as string, snap)).toBeNull();
    expect(resolveLeadId({} as unknown as string, snap)).toBeNull();
  });

  test("Stream B passthrough wins over Stream C — same id present in both maps", () => {
    // Defensive: if an id collides across maps (shouldn't happen with
    // uuid v4, but if a test fixture accidentally double-registers it),
    // Stream B's join hits first per the documented resolution order.
    const snap = snapshot({
      leads: [LEAD_A, LEAD_B],
      subs: [[SUB_A, LEAD_A]],
      clients: [[SUB_A, SUB_B]],   // pathological — client id == submission id
    });
    expect(resolveLeadId(SUB_A, snap)).toBe(LEAD_A);
  });
});

describe("readLeadIdFromUrl — URL query-string helper", () => {
  test("returns null when window is undefined (non-browser env)", () => {
    // Vitest's default env is node; window is undefined here.
    expect(readLeadIdFromUrl()).toBeNull();
  });
});
