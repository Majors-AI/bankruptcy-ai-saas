/**
 * Outbound communication gate.
 *
 * Single entry point for ALL client- and lead-facing outbound communication.
 * Routes to one of six edge functions:
 *   send-sms-email, send-confirmation, send-boldsign, send-client-message,
 *   send-intake-invite, send-confirmation-email
 *
 * Gating rules:
 *   1. recipientType: 'staff' — bypass (registration confirmations to staffer themselves).
 *   2. recipientType: 'transactional_self_initiated' — public self-initiated flow
 *      (no consent column yet because the person hasn't submitted intake). Always
 *      allowed for EMAIL channel only. SMS/voice are upgraded to strict 'lead'
 *      regardless — TCPA requires recorded consent for SMS/voice.
 *   3. recipientType: 'lead' | 'client' — look up intake_submissions.sms_email_consent
 *      and follow_up_sequences.opted_out for the recipient. Skip if either fails.
 *
 * clientId → submission resolution (used by recipientType: 'client'):
 *   Path A (primary): clients.id → clients.intake_id → intake_submissions.id
 *   Path B (fallback if intake_id is null): clients.id → clients.lead_id →
 *     most recent intake_submissions.lead_id match
 *
 * Server-side defense in depth: every send-* edge function ALSO runs the same
 * gate against the database before dispatching. The client wrapper passes
 * `_gate_*` fields in the payload so the server can read the same context.
 * A direct call to an edge function that bypasses the client wrapper still
 * gets gated server-side.
 *
 * STOP-keyword inbound handler — Twilio webhook setting
 * follow_up_sequences.opted_out = true on inbound STOP. Not in this batch.
 */
import { supabase } from "./supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type SendRecipientType =
  | "lead"
  | "client"
  | "staff"
  | "transactional_self_initiated";

export type SendEndpoint =
  | "send-sms-email"
  | "send-confirmation"
  | "send-boldsign"
  | "send-client-message"
  | "send-intake-invite"
  | "send-confirmation-email";

export interface SendGateContext {
  recipientType: SendRecipientType;
  leadId?: string | null;
  submissionId?: string | null;
  clientId?: string | null;
  actor?: string;
  summary?: string;
}

export interface SendSmsEmailArgs {
  recipientType: SendRecipientType;
  leadId?: string | null;
  submissionId?: string | null;
  payload: Record<string, unknown>;
  actor?: string;
  summary?: string;
}

export interface SendResult {
  sent: boolean;
  reason?:
    | "no_consent"
    | "opted_out"
    | "provider_error"
    | "no_recipient_row"
    | "sent_transactional";
  detail?: string;
}

type InferredChannel = "sms" | "voice" | "email" | "unknown";

function inferChannel(
  endpoint: SendEndpoint,
  payload: Record<string, unknown>,
): InferredChannel {
  switch (endpoint) {
    case "send-sms-email": {
      const t = String(payload.type ?? payload.channel ?? "").toLowerCase();
      if (t === "sms") return "sms";
      if (t === "email") return "email";
      return "unknown";
    }
    case "send-client-message": {
      const ch = String(payload.channel ?? "").toLowerCase();
      if (ch === "sms") return "sms";
      if (ch === "voice") return "voice";
      if (ch === "email") return "email";
      if (ch === "google_meet") return "email"; // notification email only
      return "unknown";
    }
    case "send-confirmation":
    case "send-intake-invite":
    case "send-confirmation-email":
    case "send-boldsign":
      return "email";
  }
}

async function logToContactLog(
  leadId: string | null | undefined,
  submissionId: string | null | undefined,
  channel: string,
  outcome: string,
  actor: string,
  notes: string | null,
): Promise<void> {
  try {
    await supabase.from("intake_contact_log").insert({
      lead_id: leadId ?? null,
      submission_id: submissionId ?? null,
      channel,
      direction: "outbound",
      outcome,
      notes,
      contacted_by: actor || "system",
      is_bot: false,
    });
  } catch {
    // Audit-log failure must not block the send-decision path.
  }
}

interface ResolvedRefs {
  submissionId: string | null;
  leadId: string | null;
  consent: boolean | null;
}

/** Resolve consent + linked IDs for a given identifier set. */
async function resolveGateState(args: {
  leadId?: string | null;
  submissionId?: string | null;
  clientId?: string | null;
}): Promise<ResolvedRefs> {
  let submissionId: string | null = args.submissionId ?? null;
  let leadId: string | null = args.leadId ?? null;
  let consent: boolean | null = null;

  // Direct submission lookup
  if (submissionId) {
    const { data } = await supabase
      .from("intake_submissions")
      .select("id, sms_email_consent, lead_id")
      .eq("id", submissionId)
      .maybeSingle();
    if (data) {
      consent = data.sms_email_consent === true;
      leadId = leadId ?? (data.lead_id as string | null) ?? null;
    }
  }

  // Lead → most-recent submission
  if (consent === null && leadId) {
    const { data } = await supabase
      .from("intake_submissions")
      .select("id, sms_email_consent")
      .eq("lead_id", leadId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      consent = data.sms_email_consent === true;
      submissionId = submissionId ?? (data.id as string | null) ?? null;
    }
  }

  // Client → intake (Path A) → fallback to lead (Path B)
  if (consent === null && args.clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("intake_id, lead_id")
      .eq("id", args.clientId)
      .maybeSingle();
    if (client) {
      if (client.intake_id) {
        const { data: sub } = await supabase
          .from("intake_submissions")
          .select("sms_email_consent, lead_id")
          .eq("id", client.intake_id)
          .maybeSingle();
        if (sub) {
          consent = sub.sms_email_consent === true;
          submissionId = submissionId ?? (client.intake_id as string);
          leadId = leadId ?? (sub.lead_id as string | null) ?? (client.lead_id as string | null) ?? null;
        }
      }
      if (consent === null && client.lead_id) {
        const { data: sub } = await supabase
          .from("intake_submissions")
          .select("id, sms_email_consent")
          .eq("lead_id", client.lead_id)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (sub) {
          consent = sub.sms_email_consent === true;
          submissionId = submissionId ?? (sub.id as string | null) ?? null;
          leadId = leadId ?? (client.lead_id as string | null) ?? null;
        }
      }
    }
  }

  return { submissionId, leadId, consent };
}

async function isOptedOut(leadId: string | null): Promise<boolean> {
  if (!leadId) return false;
  const { data } = await supabase
    .from("follow_up_sequences")
    .select("opted_out")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.opted_out === true;
}

/**
 * Generic gated send. All client-facing outbound communication should go
 * through this function — never call /functions/v1/send-* directly.
 *
 * Adds `_gate_*` fields to the payload for server-side defense in depth.
 */
export async function sendVia(
  endpoint: SendEndpoint,
  payload: Record<string, unknown>,
  ctx: SendGateContext,
): Promise<SendResult> {
  const channel = inferChannel(endpoint, payload);
  const actor = ctx.actor || "system";
  const summary = ctx.summary || "Outbound send via gated wrapper";

  // Staff bypass
  if (ctx.recipientType === "staff") {
    return rawSend(endpoint, payload, ctx, channel, actor, summary, "staff");
  }

  // Transactional self-initiated — EMAIL ONLY. SMS/voice get strict mode.
  if (ctx.recipientType === "transactional_self_initiated") {
    if (channel === "sms" || channel === "voice" || channel === "unknown") {
      // Upgrade to strict 'lead' — TCPA requires recorded consent for SMS/voice.
      return strictGatedSend(endpoint, payload, { ...ctx, recipientType: "lead" }, channel, actor, summary);
    }
    // Email transactional path: allow + audit log proving rationale.
    await logToContactLog(
      ctx.leadId ?? null,
      ctx.submissionId ?? null,
      channel,
      "sent_transactional_no_consent_required",
      actor,
      summary,
    );
    return rawSend(endpoint, payload, ctx, channel, actor, summary, "transactional_self_initiated");
  }

  // Strict path — recipientType is 'lead' or 'client'
  return strictGatedSend(endpoint, payload, ctx, channel, actor, summary);
}

async function strictGatedSend(
  endpoint: SendEndpoint,
  payload: Record<string, unknown>,
  ctx: SendGateContext,
  channel: InferredChannel,
  actor: string,
  summary: string,
): Promise<SendResult> {
  if (!ctx.leadId && !ctx.submissionId && !ctx.clientId) {
    return { sent: false, reason: "no_recipient_row", detail: "no leadId/submissionId/clientId provided" };
  }

  const refs = await resolveGateState({
    leadId: ctx.leadId,
    submissionId: ctx.submissionId,
    clientId: ctx.clientId,
  });

  if (refs.consent === null) {
    return { sent: false, reason: "no_recipient_row", detail: "could not resolve consent row" };
  }

  if (await isOptedOut(refs.leadId)) {
    await logToContactLog(refs.leadId, refs.submissionId, channel, "skipped_opt_out", actor, summary);
    return { sent: false, reason: "opted_out" };
  }

  if (refs.consent !== true) {
    await logToContactLog(refs.leadId, refs.submissionId, channel, "skipped_no_consent", actor, summary);
    return { sent: false, reason: "no_consent" };
  }

  return rawSend(
    endpoint,
    payload,
    { ...ctx, leadId: refs.leadId, submissionId: refs.submissionId },
    channel,
    actor,
    summary,
    ctx.recipientType,
  );
}

async function rawSend(
  endpoint: SendEndpoint,
  payload: Record<string, unknown>,
  ctx: SendGateContext,
  channel: InferredChannel,
  actor: string,
  summary: string,
  effectiveRecipientType: SendRecipientType,
): Promise<SendResult> {
  // Inject _gate_* fields so the server-side gate has the same context.
  const gatedPayload = {
    ...payload,
    _gate_lead_id: ctx.leadId ?? null,
    _gate_submission_id: ctx.submissionId ?? null,
    _gate_client_id: ctx.clientId ?? null,
    _gate_recipient_type: effectiveRecipientType,
    _gate_actor: actor,
    _gate_summary: summary,
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(gatedPayload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      await logToContactLog(ctx.leadId ?? null, ctx.submissionId ?? null, channel, "send_failed", actor, text.slice(0, 500));
      return { sent: false, reason: "provider_error", detail: text };
    }
    // Server-side gate may have skipped — check the response body for { skipped: true }.
    const body = await res.json().catch(() => ({}));
    if (body?.skipped === true) {
      const reason = String(body.reason ?? "no_consent") as SendResult["reason"];
      await logToContactLog(ctx.leadId ?? null, ctx.submissionId ?? null, channel, `skipped_server_${reason}`, actor, "server-side gate suppressed");
      return { sent: false, reason };
    }
    await logToContactLog(ctx.leadId ?? null, ctx.submissionId ?? null, channel, "sent", actor, summary);
    return { sent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logToContactLog(ctx.leadId ?? null, ctx.submissionId ?? null, channel, "send_failed", actor, msg);
    return { sent: false, reason: "provider_error", detail: msg };
  }
}

/**
 * Back-compat wrapper. The 4 existing sendSmsEmail call sites continue to
 * work without modification. New call sites should use sendVia() directly.
 */
export async function sendSmsEmail(args: SendSmsEmailArgs): Promise<SendResult> {
  return sendVia("send-sms-email", args.payload, {
    recipientType: args.recipientType,
    leadId: args.leadId,
    submissionId: args.submissionId,
    actor: args.actor,
    summary: args.summary,
  });
}
