import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Consent gate (TCPA / CAN-SPAM) ──────────────────────────────────────────
// Server-side defense in depth. Mirrors src/lib/sendGate.ts on the client.
// Direct callers that bypass the client wrapper still get gated here.
// _gate_* fields are injected by sendVia() in the client wrapper.

type GateChannel = "sms" | "voice" | "email" | "unknown";
interface GateResult { allowed: boolean; reason?: string; }

async function checkConsentGate(
  payload: Record<string, unknown>,
  channel: GateChannel,
  functionName: string,
): Promise<GateResult> {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return { allowed: false, reason: "gate_env_missing" };

  const gateLeadId = (payload._gate_lead_id as string | null) ?? null;
  const gateSubmissionId = (payload._gate_submission_id as string | null) ?? null;
  const gateClientId =
    (payload._gate_client_id as string | null) ??
    // Back-compat: this function's caller (frozen questionnaire) already passes clientId.
    (payload.clientId as string | null) ?? null;
  const recipientType = (payload._gate_recipient_type as string | null) ?? null;
  const actor = (payload._gate_actor as string | null) ?? functionName;

  if (recipientType === "staff") return { allowed: true };
  if (recipientType === "transactional_self_initiated" && channel === "email") {
    return { allowed: true };
  }

  if (!gateLeadId && !gateSubmissionId && !gateClientId) {
    return { allowed: false, reason: "no_recipient_row" };
  }

  const sb = createClient(url, key);
  let consent: boolean | null = null;
  let resolvedLeadId: string | null = gateLeadId;
  let resolvedSubmissionId: string | null = gateSubmissionId;

  if (gateSubmissionId) {
    const { data } = await sb.from("intake_submissions")
      .select("id, sms_email_consent, lead_id")
      .eq("id", gateSubmissionId).maybeSingle();
    if (data) {
      consent = data.sms_email_consent === true;
      resolvedLeadId = resolvedLeadId ?? ((data.lead_id as string | null) ?? null);
    }
  }
  if (consent === null && gateLeadId) {
    const { data } = await sb.from("intake_submissions")
      .select("id, sms_email_consent")
      .eq("lead_id", gateLeadId)
      .order("submitted_at", { ascending: false }).limit(1).maybeSingle();
    if (data) {
      consent = data.sms_email_consent === true;
      resolvedSubmissionId = resolvedSubmissionId ?? ((data.id as string | null) ?? null);
    }
  }
  if (consent === null && gateClientId) {
    const { data: client } = await sb.from("clients")
      .select("intake_id, lead_id").eq("id", gateClientId).maybeSingle();
    if (client?.intake_id) {
      const { data: sub } = await sb.from("intake_submissions")
        .select("sms_email_consent, lead_id").eq("id", client.intake_id).maybeSingle();
      if (sub) {
        consent = sub.sms_email_consent === true;
        resolvedLeadId = resolvedLeadId ?? ((sub.lead_id as string | null) ?? (client.lead_id as string | null) ?? null);
        resolvedSubmissionId = resolvedSubmissionId ?? (client.intake_id as string);
      }
    }
    if (consent === null && client?.lead_id) {
      const { data: sub } = await sb.from("intake_submissions")
        .select("id, sms_email_consent")
        .eq("lead_id", client.lead_id)
        .order("submitted_at", { ascending: false }).limit(1).maybeSingle();
      if (sub) {
        consent = sub.sms_email_consent === true;
        resolvedSubmissionId = resolvedSubmissionId ?? ((sub.id as string | null) ?? null);
        resolvedLeadId = resolvedLeadId ?? ((client.lead_id as string | null) ?? null);
      }
    }
  }

  const logSkip = async (outcome: string, notes: string) => {
    try {
      await sb.from("intake_contact_log").insert({
        lead_id: resolvedLeadId, submission_id: resolvedSubmissionId,
        channel, direction: "outbound", outcome, notes,
        contacted_by: actor, is_bot: true,
      });
    } catch { /* best-effort */ }
  };

  if (consent === null) {
    await logSkip("skipped_no_recipient_row", `${functionName}: no consent row resolved`);
    return { allowed: false, reason: "no_recipient_row" };
  }
  if (consent !== true) {
    await logSkip("skipped_no_consent", `${functionName}: sms_email_consent !== true`);
    return { allowed: false, reason: "no_consent" };
  }
  if (resolvedLeadId) {
    const { data: fus } = await sb.from("follow_up_sequences")
      .select("opted_out").eq("lead_id", resolvedLeadId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (fus?.opted_out === true) {
      await logSkip("skipped_opt_out", `${functionName}: follow_up_sequences.opted_out`);
      return { allowed: false, reason: "opted_out" };
    }
  }
  return { allowed: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { clientId, clientName, email, firstName, chapter, submittedAt } = payload;

    // ─── Gate ──────────────────────────────────────────────────────────────
    // Frozen questionnaire calls this function — questionnaire code is not
    // modified. Server-side gate enforces consent before send.
    const gate = await checkConsentGate(payload, "email", "send-confirmation-email");
    if (!gate.allowed) {
      // Skip silently (no UI surface — frozen client cannot be changed).
      return new Response(JSON.stringify({ skipped: true, reason: gate.reason }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ───────────────────────────────────────────────────────────────────────

    if (!email) {
      return new Response(JSON.stringify({ error: "No email address provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chapterLabel = chapter === "13" ? "Chapter 13" : "Chapter 7";
    const submittedDate = new Date(submittedAt || Date.now()).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const name = firstName || clientName?.split(" ")[0] || "Client";

    const emailBody = `
Dear ${name},

Thank you for completing your bankruptcy questionnaire. We have received your submission and your case is now in active review.

SUBMISSION CONFIRMATION
-----------------------
Client:         ${clientName || name}
Case Type:      ${chapterLabel} Bankruptcy
Submitted:      ${submittedDate}
Status:         Under Attorney Review

WHAT HAPPENS NEXT
-----------------
1. Attorney Review: Your attorney will review all information you provided, including your listed assets, debts, income, and expenses.

2. Asset Protection Analysis: Using the asset values and equity figures you confirmed, your attorney will apply the appropriate legal protections (exemptions) under applicable bankruptcy law to protect as much of your property as possible.

3. Schedule Preparation: Your official bankruptcy schedules will be prepared based on the information you provided. Your attorney may contact you if any clarification or additional documents are needed.

4. Signing Appointment: Once your case documents are ready, the office will reach out to schedule your signing appointment before your case is filed with the court.

IMPORTANT REMINDERS
-------------------
- If your financial situation changes (new income, new assets, new debts) before your case is filed, please notify our office immediately.
- Ensure all requested documents have been uploaded to your client portal. Incomplete document submissions may delay your filing.
- Do not make any significant financial transactions (large purchases, payments to family members, property transfers) without first speaking with your attorney.

If you have any questions, please do not hesitate to contact our office.

Sincerely,

bankruptcy.ai — Client Services Team
This is an automated confirmation. Please do not reply to this email.
`.trim();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "bankruptcy.ai <noreply@bankruptcy.ai>",
          to: [email],
          subject: `Questionnaire Received — ${chapterLabel} Bankruptcy — ${clientName || name}`,
          text: emailBody,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("Resend API error:", err);
      }
    } else {
      // Log when no email provider is configured
      console.log(`[send-confirmation-email] No RESEND_API_KEY configured. Would send to: ${email}`);
      console.log(`[send-confirmation-email] Subject: Questionnaire Received — ${chapterLabel} — ${clientName}`);
    }

    // Always record the submission event in Supabase for audit trail
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && clientId) {
      await fetch(`${SUPABASE_URL}/rest/v1/case_time_entries`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_name: clientName,
          entry_type: "questionnaire_submitted",
          section_id: "review",
          section_label: "Final Declaration & Submission",
          notes: `Client submitted final declaration on ${submittedDate}. Confirmation email sent to ${email}. Case type: ${chapterLabel}.`,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-confirmation-email error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
