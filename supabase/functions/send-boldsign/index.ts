import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
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
    } = await req.json();

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
