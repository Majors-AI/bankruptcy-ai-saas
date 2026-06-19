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
