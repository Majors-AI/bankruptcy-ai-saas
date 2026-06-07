import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Consent gate (TCPA / CAN-SPAM) — mirrors src/lib/sendGate.ts ───────────
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
  const gateSubmissionId =
    (payload._gate_submission_id as string | null) ??
    // Back-compat: existing send-boldsign callers already pass intake_id (a submission id).
    (payload.intake_id as string | null) ?? null;
  const gateClientId =
    (payload._gate_client_id as string | null) ??
    (payload.client_id as string | null) ?? null;
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
    const {
      client_id,
      intake_id,
      pi_submission_id,
      client_name,
      client_email,
      quoted_fee,
      is_personal_injury,
      pi_contingency_pre_lit,
      pi_contingency_litigation,
    } = payload;

    // ─── Gate ──────────────────────────────────────────────────────────────
    const gate = await checkConsentGate(payload, "email", "send-boldsign");
    if (!gate.allowed) {
      return new Response(JSON.stringify({ skipped: true, reason: gate.reason }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ───────────────────────────────────────────────────────────────────────

    const BOLDSIGN_API_KEY = Deno.env.get("BOLDSIGN_API_KEY") ?? "";
    const BOLDSIGN_TEMPLATE_ID = Deno.env.get("BOLDSIGN_TEMPLATE_ID") ?? "";
    const BOLDSIGN_PI_TEMPLATE_ID = Deno.env.get("BOLDSIGN_PI_TEMPLATE_ID") ?? BOLDSIGN_TEMPLATE_ID;

    if (!BOLDSIGN_API_KEY) {
      // No BoldSign configured — log and return gracefully so the rest of the flow continues
      const supabaseNoKey = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      await supabaseNoKey.from("document_requests").insert({
        client_id: client_id ?? null,
        intake_id: intake_id ?? null,
        pi_submission_id: pi_submission_id ?? null,
        boldsign_document_id: `mock_${Date.now()}`,
        boldsign_sign_url: "",
        document_title: is_personal_injury ? "PI Retainer Agreement" : "Fee Agreement",
        status: "pending",
      });
      return new Response(JSON.stringify({ note: "BoldSign not configured — document request logged" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const templateId = is_personal_injury ? BOLDSIGN_PI_TEMPLATE_ID : BOLDSIGN_TEMPLATE_ID;
    const documentTitle = is_personal_injury ? "PI Retainer Agreement" : "Fee Agreement";
    const messageBody = is_personal_injury
      ? `Dear ${client_name}, please review and sign your personal injury retainer agreement. There is no upfront cost — our fee is only collected if we recover for you.`
      : `Dear ${client_name}, please review and sign your fee agreement for bankruptcy representation.`;

    const feeFieldValue = is_personal_injury
      ? `${pi_contingency_pre_lit ?? "33.33"}% pre-litigation / ${pi_contingency_litigation ?? "40.00"}% if litigated`
      : `$${quoted_fee ?? "0"}`;

    let documentId = "";
    let signUrl = "";

    if (templateId) {
      const body = {
        templateId,
        title: documentTitle,
        message: messageBody,
        roles: [{
          roleIndex: 1,
          signerName: client_name,
          signerEmail: client_email,
          signerType: "Signer",
        }],
        formFields: [
          { id: "client_name", value: client_name },
          { id: "quoted_fee", value: feeFieldValue },
        ],
      };

      const resp = await fetch("https://api.boldsign.com/v1/template/send", {
        method: "POST",
        headers: { "X-API-KEY": BOLDSIGN_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (resp.ok) {
        const data = await resp.json();
        documentId = data.documentId ?? "";

        const signerResp = await fetch(
          `https://api.boldsign.com/v1/document/getEmbeddedSignLink?documentId=${documentId}&signerEmail=${encodeURIComponent(client_email)}&redirectUrl=${encodeURIComponent("https://bankruptcy.ai/signed")}`,
          { headers: { "X-API-KEY": BOLDSIGN_API_KEY } }
        );

        if (signerResp.ok) {
          const signerData = await signerResp.json();
          signUrl = signerData.signLink ?? "";
        }
      }
    } else {
      documentId = `mock_${Date.now()}`;
      signUrl = `https://app.boldsign.com/sign/${documentId}`;
    }

    const { data: docReq } = await supabase.from("document_requests").insert({
      client_id: client_id ?? null,
      intake_id: intake_id ?? null,
      pi_submission_id: pi_submission_id ?? null,
      boldsign_document_id: documentId,
      boldsign_sign_url: signUrl,
      document_title: documentTitle,
      status: "sent",
    }).select("id").single();

    if (client_id) {
      await supabase.from("clients").update({ status: "retained" }).eq("id", client_id);
    }

    return new Response(JSON.stringify({
      document_id: documentId,
      sign_url: signUrl,
      request_id: docReq?.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
