// Lead-creation helper — the single seam used by the "Get Help" entry
// (Change 1) and any future public-facing intake surfaces that need to
// drop a row into `intake_leads`.
//
// Why a dedicated helper:
//   - Sets `channel` (the structured entry-mode column from
//     docs/schema-changes-for-canelo.md §1).
//   - Sets `lifecycle_status` consistently with `src/lib/leadLifecycle.ts`.
//   - Sets `follow_up_queue` based on the channel ("call_now" → priority,
//     everything else → normal).
//   - Treats the new columns (`channel`, `lifecycle_status`, etc.) as
//     optional in the insert payload so a pre-migration deploy still
//     writes the legacy fields and Supabase accepts the row. Once
//     Canelo's migration lands, the new columns start sticking.
//   - Centralizes the "what does the legacy `status` column hold for a
//     new lead of channel X?" mapping (kept aligned with the runtime
//     fallback in leadLifecycle.ts for staff dashboards reading legacy
//     rows).
//
// Firm scoping (PHASE-2 INTERIM POSTURE):
//
//   For the MLG pilot, this helper writes firm_id = VITE_FIRM_ID — matching
//   the existing V1_FIRM_ID pattern in ClientDashboard.tsx /
//   ClientRegistration.tsx. That's fine for a single-firm deployment.
//
//   IT IS NOT SUITABLE FOR SERVING MULTIPLE FIRMS FROM ONE BUILD.
//   docs/schema-changes-for-canelo.md §9 specs the lockdown: replace
//   today's open anon-INSERT on `intake_leads` with the
//   `create_public_lead(p_firm_slug, p_channel, ...)` SECURITY DEFINER
//   RPC. That RPC resolves firm_id server-side from a firm slug (never
//   from caller-supplied input) and adds captcha + rate-limit + INSERT-
//   only-via-RPC enforcement. When §9 lands, this helper FLIPS from
//   `supabase.from("intake_leads").insert(...)` to
//   `supabase.rpc("create_public_lead", { p_firm_slug, p_channel, ... })`
//   and the `firmId` parameter below becomes a `firmSlug`.
//
//   Tracking: do NOT expose the Get Help page on a production URL until
//   §9 lands. The view is currently reachable via setView('get_help')
//   for internal preview only.

import { supabase } from "./supabase";
import type { LeadChannel, LifecycleStatus } from "./leadLifecycle";

export interface CreateLeadArgs {
  /** Channel that brought the lead in. Required — drives the structured
   *  channel column AND the legacy-status fallback AND the priority queue. */
  channel: LeadChannel;

  /** Client identifying info (every field optional — only what we have at
   *  the moment of lead creation; the rest is filled in by the
   *  questionnaire / intake interview). */
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;

  /** Optional channel-specific context — e.g., the chosen slot for
   *  channel="scheduled", a free-text intent for channel="self_serve". */
  notes?: string | null;

  /** firm_id override. Defaults to VITE_FIRM_ID (MLG pilot). When public
   *  multi-firm onboarding lands, the caller passes the resolved firm_id
   *  from the URL / subdomain. */
  firmId?: string;
}

export interface CreateLeadResult {
  ok: boolean;
  leadId: string | null;
  /** Server-supplied failure reason on `ok: false`; null on success. */
  reason: string | null;
}

/** Map a channel to the lifecycle the lead starts in. `call_now` skips
 *  past `new` because the lead is actively on the phone with the firm
 *  the moment the row hits the DB; everything else starts at `new`. */
function initialLifecycleForChannel(channel: LeadChannel): LifecycleStatus {
  return channel === "call_now" ? "contacted" : "new";
}

/** Map a channel to the legacy free-text `status` value. Mirrors the
 *  runtime fallback in leadLifecycle.ts so legacy staff dashboards see
 *  a sensible label until they switch to `lifecycle_status`. */
function legacyStatusForChannel(channel: LeadChannel): string {
  if (channel === "call_now") return "contacted";
  return "new";
}

/** Map a channel to the existing `follow_up_queue` enum. `call_now`
 *  goes into the priority queue (high-priority "answer / return call"
 *  task per Change 1 spec); everything else goes into normal. */
function followUpQueueForChannel(channel: LeadChannel): "priority" | "normal" {
  return channel === "call_now" ? "priority" : "normal";
}

/** Best-effort firm id resolution. For the MLG pilot we use VITE_FIRM_ID
 *  (matches the existing V1_FIRM_ID pattern). When the column is unset on
 *  the resolved firm, the server-side default on the table catches the
 *  insert. */
function resolveFirmId(explicit?: string): string | null {
  if (explicit) return explicit;
  const envFirmId = (import.meta.env.VITE_FIRM_ID as string | undefined) ?? null;
  return envFirmId;
}

/** Insert a lead row. Returns `{ ok, leadId, reason }`. */
export async function createLead(args: CreateLeadArgs): Promise<CreateLeadResult> {
  const firmId = resolveFirmId(args.firmId);

  // Insert payload. New columns (channel, lifecycle_status,
  // questionnaire_completion_pct) are included even when the migration
  // hasn't landed yet — Supabase/Postgres ignores keys that don't map
  // to a column ONLY when PostgREST is configured to do so; otherwise it
  // 400s. The current intake_leads write paths in NewLeadInline /
  // LegalAdminPortal already use the "legacy column set" so we mirror
  // that and let PostgREST drop the new keys until the migration lands.
  //
  // Approach: write the legacy columns unconditionally, and write the
  // new columns in a SECOND patch via `update()` after the insert
  // succeeds. If the patch errors (column missing), we swallow the error
  // — the lead row is still created, just without the new structured
  // columns. Once the migration lands, the patch sticks.
  const legacyPayload: Record<string, unknown> = {
    full_name: args.fullName ?? null,
    email:     args.email    ?? null,
    phone:     args.phone    ?? null,
    source:    args.channel,                          // legacy free-text channel
    status:    legacyStatusForChannel(args.channel),
    follow_up_queue: followUpQueueForChannel(args.channel),
    notes:     args.notes ?? null,
    first_contact_at: new Date().toISOString(),
  };
  if (firmId) legacyPayload.firm_id = firmId;

  const { data: inserted, error: insertErr } = await supabase
    .from("intake_leads")
    .insert(legacyPayload)
    .select("id")
    .single();

  if (insertErr || !inserted?.id) {
    return { ok: false, leadId: null, reason: insertErr?.message ?? "lead_insert_failed" };
  }
  const leadId = inserted.id as string;

  // Write the new structured columns post-insert. If any column doesn't
  // exist yet (pre-migration), the patch will error and we swallow it —
  // the lead row is still created. Once Canelo's migration lands, the
  // patch sticks atomically.
  const newColumnsPayload: Record<string, unknown> = {
    channel:                       args.channel,
    lifecycle_status:              initialLifecycleForChannel(args.channel),
    questionnaire_completion_pct:  0,
  };
  await supabase
    .from("intake_leads")
    .update(newColumnsPayload)
    .eq("id", leadId)
    // Result intentionally not inspected — partial-migration tolerance.
    .then(() => null, () => null);

  return { ok: true, leadId, reason: null };
}

// ─── createLeadAndSubmission ────────────────────────────────────────────
//
// Canonical intake-submission path. Always creates the `intake_leads` row
// (the matter spine) FIRST, then inserts an `intake_submissions` row with
// `lead_id` set — fixing the orphan-submission problem documented in the
// §10 client-flow verification.
//
// Two callers today: src/ClientIntakeForm.tsx (channel='self_serve') and
// src/BankruptcyIntake.jsx (channel='agent_assisted'). The locked
// `bankruptcy-information-and-document-questionnaire(1).jsx` is NOT a
// caller — it's a client-portal questionnaire, not an intake-creation
// surface.
//
// Future: when docs/schema-changes-for-canelo.md §16 ships, this helper
// flips to a single RPC (`create_public_lead_and_submission`) that does
// both inserts atomically server-side. Callers don't change.

/** Default submission inserter — production path, uses the real
 *  supabase client. Tests inject a mock via `deps.insertSubmission`. */
async function defaultInsertSubmission(
  payload: Record<string, unknown>,
): Promise<{ submissionId: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("intake_submissions")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data?.id) {
    return {
      submissionId: null,
      error: error?.message ?? "submission_insert_failed",
    };
  }
  return { submissionId: data.id as string, error: null };
}

export interface CreateLeadAndSubmissionArgs extends CreateLeadArgs {
  /** Submission payload — the existing column shape callers previously
   *  POSTed to `intake_submissions`. When omitted, behaves exactly like
   *  `createLead()` (lead-only; no submission inserted). The helper
   *  always overrides `lead_id` and `submitted_at` in the final payload
   *  so callers don't have to remember to set them. */
  submission?: Record<string, unknown>;
}

export interface CreateLeadAndSubmissionResult {
  ok: boolean;
  leadId: string | null;
  submissionId: string | null;
  /** When `ok=true` but `submissionId=null`, the lead was recorded but
   *  the submission insert failed — caller must surface this honestly
   *  (no fabricated success). When `ok=false`, neither row exists. */
  reason: string | null;
}

/** Dependency-injection seam for tests. Production callers omit `deps`. */
export interface CreateLeadAndSubmissionDeps {
  createLead?: (args: CreateLeadArgs) => Promise<CreateLeadResult>;
  insertSubmission?: (
    payload: Record<string, unknown>,
  ) => Promise<{ submissionId: string | null; error: string | null }>;
  /** Tag a lead as "submission insert failed" after a partial failure
   *  (lead was created, submission insert errored). Defaults to a real
   *  supabase patch; tests inject a mock. */
  tagFailedLead?: (
    leadId: string,
    reason: string,
  ) => Promise<void>;
}

/** Legacy `intake_leads.source` value used to mark leads whose paired
 *  submission insert failed. Surfaces in the staff Intake queue so a
 *  half-recorded lead doesn't look identical to a fresh inquiry. See
 *  docs/schema-changes-for-canelo.md §16 (S16.5). */
export const INCOMPLETE_SUBMISSION_SOURCE = "intake_submission_failed";

/** Default lead-tagging path — production, real supabase. Failure-mode:
 *  if the patch itself fails, swallow the error (the lead row is still
 *  better than nothing, and we don't want to lose the original error by
 *  throwing a secondary one). Tests inject a mock to assert behavior. */
async function defaultTagFailedLead(leadId: string, reason: string): Promise<void> {
  const marker = `[INCOMPLETE SUBMISSION ${new Date().toISOString()}] ${reason}`;
  await supabase
    .from("intake_leads")
    .update({
      source: INCOMPLETE_SUBMISSION_SOURCE,
      notes: marker,
    })
    .eq("id", leadId)
    // Tolerate patch failure — don't mask the real submission-failure reason.
    .then(() => null, () => null);
}

export async function createLeadAndSubmission(
  args: CreateLeadAndSubmissionArgs,
  deps: CreateLeadAndSubmissionDeps = {},
): Promise<CreateLeadAndSubmissionResult> {
  const createLeadFn = deps.createLead ?? createLead;
  const insertFn = deps.insertSubmission ?? defaultInsertSubmission;
  const tagFn = deps.tagFailedLead ?? defaultTagFailedLead;

  // 1. Create the lead first — the matter spine anchor.
  const lead = await createLeadFn(args);
  if (!lead.ok || !lead.leadId) {
    return {
      ok: false,
      leadId: null,
      submissionId: null,
      reason: lead.reason ?? "lead_failed",
    };
  }

  // 2. Lead-only mode — no submission payload supplied.
  if (!args.submission) {
    return { ok: true, leadId: lead.leadId, submissionId: null, reason: null };
  }

  // 3. Submission insert with the spine link set. lead_id + submitted_at
  // are forced here so callers cannot accidentally write an orphan.
  const submissionPayload: Record<string, unknown> = {
    ...args.submission,
    lead_id: lead.leadId,
    submitted_at: new Date().toISOString(),
  };
  const result = await insertFn(submissionPayload);

  if (!result.submissionId) {
    // Honest partial-failure state — lead exists, submission didn't.
    // Caller surfaces this to the UI; we do NOT roll back the lead.
    //
    // Tag the lead so staff in the Intake queue can distinguish a
    // half-recorded intake from a normal fresh lead. Failure of the
    // tag patch itself is swallowed inside `tagFn` — don't mask the
    // real submission-failure reason.
    const reason = result.error ?? "submission_insert_failed";
    await tagFn(lead.leadId, reason);
    return {
      ok: true,
      leadId: lead.leadId,
      submissionId: null,
      reason,
    };
  }

  return {
    ok: true,
    leadId: lead.leadId,
    submissionId: result.submissionId,
    reason: null,
  };
}
