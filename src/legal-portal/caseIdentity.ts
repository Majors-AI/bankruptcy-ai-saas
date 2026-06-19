// Case-identity resolver — Option A matter-spine normalizer.
//
// Translates any of three id streams into the canonical
// `intake_leads.id` (the matter spine, per
// docs/schema-changes-for-canelo.md §3 and §12):
//
//   Stream A: intake_leads.id              (the spine itself — passthrough)
//   Stream B: intake_submissions.id        → resolves via intake_submissions.lead_id
//   Stream C: clients.id                   → resolves via clients.intake_id
//                                            → intake_submissions.id
//                                            → intake_submissions.lead_id
//
// Why a client-side module: docs/schema-changes-for-canelo.md §12 specs an
// RPC `resolve_lead_id(uuid) → uuid` that does the same walk server-side
// (S7). Until that RPC lands, frontend surfaces (SigningReview /
// ParalegalReview / FileCabinet / Queue) need to thread the matter spine
// through their reads anyway. This module IS the interim normalizer; when
// the RPC ships, callers swap to `supabase.rpc('resolve_lead_id', …)`
// and the pure function stays as the test fixture for that RPC's
// behavior.
//
// THE RESOLVER IS NOT A SECURITY BOUNDARY. RLS still enforces firm
// scoping on every table read. The resolver only computes which leadId a
// given input corresponds to within the rows the caller can already see.
//
// Two surfaces:
//   1. resolveLeadId(id, snapshot)        — PURE, sync, testable
//   2. resolveLeadIdAsync(id, sb)          — async wrapper that loads the
//                                            minimal lookups and calls (1)

import type { SupabaseClient } from "@supabase/supabase-js";

/** A subset-row from `intake_submissions` carrying the join columns the
 *  resolver needs. Pre-loaded by the async wrapper; passed verbatim to
 *  the pure function. */
export interface SubmissionLookupRow {
  id: string;
  lead_id: string | null;
}

/** A subset-row from `clients` carrying the join to a submission. */
export interface ClientLookupRow {
  id: string;
  intake_id: string | null;
}

/** Snapshot of just-enough data to resolve any of the three streams.
 *  Keys are id strings; values are the join rows. Either-or — the
 *  resolver doesn't care which set the caller pre-loaded, only that the
 *  join chain can be followed. */
export interface LeadIdSnapshot {
  /** Set of known `intake_leads.id` values. Used to recognize a stream-A
   *  passthrough without a DB read. Optional — when absent the resolver
   *  cannot recognize a leadId from a submissionId without further
   *  context, so it falls back to assuming Stream A if no other join
   *  hits (documented behavior, suitable when the caller knows the
   *  input came from a leadId-bearing source like the queue). */
  intakeLeadIds?: ReadonlySet<string>;
  /** intake_submissions rows keyed by id. Used to walk Stream B → A. */
  submissionsById?: ReadonlyMap<string, SubmissionLookupRow>;
  /** clients rows keyed by id. Used to walk Stream C → B → A. */
  clientsById?: ReadonlyMap<string, ClientLookupRow>;
}

/** PURE resolver. Walks the chain client-side from any id back to
 *  `intake_leads.id`. Returns null if no path can be followed.
 *
 *  Resolution order (returns first match):
 *    1. id is a known leadId in snapshot.intakeLeadIds → return id
 *    2. id matches a submission in snapshot.submissionsById
 *       AND that submission has a non-null lead_id → return lead_id
 *    3. id matches a client in snapshot.clientsById,
 *       AND that client.intake_id matches a submission,
 *       AND that submission has a non-null lead_id → return lead_id
 *    4. snapshot.intakeLeadIds is absent (caller has no list) AND
 *       neither (2) nor (3) hit → return id verbatim (treat as Stream A
 *       passthrough — this is the "trust the caller" path used when the
 *       input is known to come from a lead-bearing surface)
 *    5. otherwise → null
 *
 *  Case (4) exists because the most common caller (Queue → SigningReview)
 *  ALREADY knows its inputs are leadIds. Forcing a DB-loaded lookup in
 *  that case would burn a round-trip. Callers who want strict resolution
 *  pass `intakeLeadIds` (even if empty) — then case (5) fires and they
 *  get null instead of a passthrough.
 */
export function resolveLeadId(
  id: string | null | undefined,
  snapshot: LeadIdSnapshot,
): string | null {
  if (!id || typeof id !== "string") return null;

  // (1) Stream A passthrough — id is a known leadId.
  if (snapshot.intakeLeadIds?.has(id)) return id;

  // (2) Stream B → A — id is a submission id.
  const sub = snapshot.submissionsById?.get(id);
  if (sub && sub.lead_id) return sub.lead_id;

  // (3) Stream C → B → A — id is a client id, hop through intake_id.
  const client = snapshot.clientsById?.get(id);
  if (client && client.intake_id) {
    const subFromClient = snapshot.submissionsById?.get(client.intake_id);
    if (subFromClient && subFromClient.lead_id) return subFromClient.lead_id;
  }

  // (4) "Trust the caller" passthrough — only when the caller hasn't
  //     constrained intakeLeadIds. See doc above.
  if (snapshot.intakeLeadIds === undefined) return id;

  // (5) Strict mode — no path found.
  return null;
}

// ── Async wrapper ───────────────────────────────────────────────────────

/** Async resolver. Loads minimal lookups via the supplied supabase
 *  client and calls `resolveLeadId`. Single-shot — caller is expected to
 *  cache the result; this does NOT memoize.
 *
 *  Reads at most 3 single-row queries:
 *    1. intake_leads WHERE id = id LIMIT 1   (cheap; checks Stream A)
 *    2. intake_submissions WHERE id = id LIMIT 1
 *    3. clients WHERE id = id LIMIT 1 (+ follow-up intake_submissions)
 *
 *  Falls through on each miss. RLS enforces firm scoping — caller can
 *  only resolve ids inside their own firm.
 *
 *  When schema-changes-for-canelo.md §12 S7 ships (resolve_lead_id RPC),
 *  swap this body for a single `sb.rpc('resolve_lead_id', { p_any_id: id })`
 *  call. Pure resolveLeadId() stays as the test fixture for the RPC.
 */
export async function resolveLeadIdAsync(
  id: string | null | undefined,
  sb: SupabaseClient,
): Promise<string | null> {
  if (!id || typeof id !== "string") return null;

  // (1) Stream A — id might be a leadId directly. Cheapest probe.
  const lead = await sb
    .from("intake_leads")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (lead.data?.id) return lead.data.id;

  // (2) Stream B — id might be a submission.
  const sub = await sb
    .from("intake_submissions")
    .select("id, lead_id")
    .eq("id", id)
    .maybeSingle();
  if (sub.data?.lead_id) return sub.data.lead_id;

  // (3) Stream C → B → A — id might be a client.
  const client = await sb
    .from("clients")
    .select("id, intake_id")
    .eq("id", id)
    .maybeSingle();
  if (client.data?.intake_id) {
    const subFromClient = await sb
      .from("intake_submissions")
      .select("id, lead_id")
      .eq("id", client.data.intake_id)
      .maybeSingle();
    if (subFromClient.data?.lead_id) return subFromClient.data.lead_id;
  }

  return null;
}

// ── URL helper — read ?lead= from the current URL ──────────────────────

/** Extract `lead` query parameter from the current window URL. Returns
 *  null on non-browser environments or when the param is absent. Used by
 *  LegalDepartmentPortal's interim sub-phase 1 wiring — sub-phase 2's
 *  Queue replaces this with a setSelectedLeadId(...) call. */
export function readLeadIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("lead");
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}
