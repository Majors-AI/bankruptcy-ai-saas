import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MessagePayload {
  messageId: string;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  senderName: string;
  senderRole: string;
  subject?: string;
  body: string;
  channel: "sms" | "email" | "voice" | "google_meet" | "in_app";
  meetLink?: string;
  relatedDocument?: string;
  firm_id?: string;
  template_key?: string;
  variables?: Record<string, string>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: MessagePayload = await req.json();
    const {
      messageId,
      clientId,
      clientName,
      clientPhone,
      clientEmail,
      senderName,
      senderRole,
      subject,
      body,
      channel,
      meetLink,
      firm_id,
      template_key,
      variables,
    } = payload;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const sbHeaders = {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const SENDGRID_FROM = Deno.env.get("SENDGRID_FROM_EMAIL") ?? "noreply@bankruptcy.ai";

    // ── MAJ-96 + MAJ-97: firm template + sender resolution ────────────────────
    const BAI_DEFAULT_FROM_NAME = "Bankruptcy.AI";
    const BAI_DEFAULT_FROM_ADDR = "notifications@bankruptcy.ai";
    const BAI_DEFAULT_REPLY_TO  = "noreply@bankruptcy.ai";

    let resolvedSubject: string | undefined;
    let resolvedBodyHtml: string | undefined;
    let resolvedBodyText: string | undefined;
    let resolvedFromName = `${senderName} — bankruptcy.ai`;
    let resolvedFromAddr = SENDGRID_FROM;
    let resolvedReplyTo: string | undefined;
    let resolvedSmsFrom: string | undefined;
    let templateSource: string | undefined;
    let senderIdentity: string | undefined;

    if (firm_id && template_key) {
      // ---- 1. WHICH WORDING? (MAJ-97) ----
      templateSource = "firm_custom";
      const { data: tpl } = await supabase
        .from("firm_email_templates")
        .select("subject, body_html, body_text")
        .eq("firm_id", firm_id)
        .eq("template_key", template_key)
        .eq("is_active", true)
        .maybeSingle();

      if (tpl) {
        const fill = (s: string | null) =>
          (s ?? "").replace(/\{\{(\w+)\}\}/g, (_, k) => variables?.[k] ?? "");
        resolvedSubject  = fill(tpl.subject);
        resolvedBodyHtml = fill(tpl.body_html);
        resolvedBodyText = fill(tpl.body_text ?? tpl.body_html);
      } else {
        // Every firm's templates are seeded directly; no script_library fallback.
        // Leave resolved body/subject undefined so the existing default rendering runs.
        templateSource = "system_default";
      }

      // ---- 2. WHICH SENDER? (MAJ-96) — runs regardless of template outcome ----
      const { data: cfg } = await supabase
        .from("firm_communications_config")
        .select("*")
        .eq("firm_id", firm_id)
        .maybeSingle();

      senderIdentity   = "bai_default";
      resolvedFromName = BAI_DEFAULT_FROM_NAME;
      resolvedFromAddr = BAI_DEFAULT_FROM_ADDR;
      resolvedReplyTo  = BAI_DEFAULT_REPLY_TO;

      if (cfg) {
        if (cfg.email_domain && cfg.email_domain_verified_at) {
          resolvedFromName = cfg.email_from_name ?? resolvedFromName;
          resolvedFromAddr = cfg.email_from_address ?? `notifications@${cfg.email_domain}`;
          resolvedReplyTo  = cfg.email_reply_to ?? resolvedFromAddr;
          senderIdentity   = "firm_domain";
        } else if (cfg.email_reply_to) {
          resolvedFromName = cfg.email_from_name ?? resolvedFromName;
          resolvedReplyTo  = cfg.email_reply_to;
          senderIdentity   = "firm_reply_to";
        }
        resolvedSmsFrom = cfg.sms_from_number ?? undefined;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    let deliveryStatus = "sent";
    let externalId: string | null = null;
    let deliveryError: string | null = null;
    let resolvedMeetLink: string | null = meetLink ?? null;

    // ── SMS via Twilio ────────────────────────────────────────────────────────
    if (channel === "sms" && clientPhone) {
      const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
      const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

      if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
        const smsBody = resolvedBodyText ?? `[bankruptcy.ai] ${senderName}: ${body}`;
        const params = new URLSearchParams({
          From: resolvedSmsFrom ?? TWILIO_PHONE_NUMBER,
          To: clientPhone,
          Body: smsBody,
        });
        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
          }
        );
        const twilioData = await twilioRes.json();
        if (!twilioRes.ok) {
          deliveryStatus = "failed";
          deliveryError = twilioData.message ?? "Twilio error";
        } else {
          externalId = twilioData.sid;
        }
      } else {
        console.log(`[send-client-message] No Twilio credentials. Would SMS ${clientPhone}: ${body}`);
        externalId = `sim_sms_${Date.now()}`;
      }
    }

    // ── Email via SendGrid ────────────────────────────────────────────────────
    if (channel === "email" && clientEmail) {
      const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
      // SENDGRID_FROM hoisted above; resolvedFromAddr already incorporates it.

      if (SENDGRID_API_KEY) {
        const emailPayload = {
          personalizations: [{ to: [{ email: clientEmail, name: clientName }] }],
          from: { email: resolvedFromAddr, name: resolvedFromName },
          ...(resolvedReplyTo ? { reply_to: { email: resolvedReplyTo } } : {}),
          subject: resolvedSubject ?? subject ?? `Message from your attorney — ${senderName}`,
          content: [
            {
              type: "text/html",
              value: resolvedBodyHtml ?? `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
                  <div style="background: #1e293b; border-radius: 8px; padding: 20px 24px; margin-bottom: 20px;">
                    <h2 style="color: #f8fafc; margin: 0; font-size: 18px;">Message from bankruptcy.ai</h2>
                    <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">${senderName} · ${senderRole}</p>
                  </div>
                  <div style="background: #ffffff; border-radius: 8px; padding: 20px 24px; border: 1px solid #e2e8f0;">
                    <p style="color: #1e293b; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${body}</p>
                    ${meetLink ? `<div style="margin-top: 20px; padding: 16px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;"><p style="margin: 0; color: #166534; font-weight: bold; font-size: 13px;">Google Meet Link</p><a href="${meetLink}" style="color: #15803d; font-size: 13px;">${meetLink}</a></div>` : ""}
                  </div>
                  <p style="color: #94a3b8; font-size: 11px; margin-top: 16px; text-align: center;">This message is from your bankruptcy.ai legal team. Do not reply to this email — contact your office directly.</p>
                </div>
              `,
            },
          ],
        };

        const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailPayload),
        });

        if (!sgRes.ok) {
          const err = await sgRes.text();
          deliveryStatus = "failed";
          deliveryError = err;
        } else {
          externalId = sgRes.headers.get("X-Message-Id") ?? `sg_${Date.now()}`;
        }
      } else {
        console.log(`[send-client-message] No SendGrid key. Would email ${clientEmail}: ${subject}`);
        externalId = `sim_email_${Date.now()}`;
      }
    }

    // ── Voice call via Twilio ─────────────────────────────────────────────────
    if (channel === "voice" && clientPhone) {
      const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
      const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

      if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
        const twiml = `<Response><Say voice="alice">Hello ${clientName.split(" ")[0]}, this is a call from bankruptcy.ai regarding your bankruptcy case. ${body}</Say></Response>`;
        const params = new URLSearchParams({
          From: TWILIO_PHONE_NUMBER,
          To: clientPhone,
          Twiml: twiml,
        });
        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
          }
        );
        const twilioData = await twilioRes.json();
        if (!twilioRes.ok) {
          deliveryStatus = "failed";
          deliveryError = twilioData.message ?? "Twilio voice error";
        } else {
          externalId = twilioData.sid;
        }
      } else {
        console.log(`[send-client-message] No Twilio credentials. Would call ${clientPhone}`);
        externalId = `sim_voice_${Date.now()}`;
      }
    }

    // ── Google Meet ───────────────────────────────────────────────────────────
    if (channel === "google_meet") {
      // Generate a deterministic-looking Meet link if not provided
      if (!resolvedMeetLink) {
        const slug = Math.random().toString(36).slice(2, 5) + "-" +
          Math.random().toString(36).slice(2, 5) + "-" +
          Math.random().toString(36).slice(2, 5);
        resolvedMeetLink = `https://meet.google.com/${slug}`;
      }
      // Notify via email if available
      if (clientEmail) {
        const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
        const SENDGRID_FROM = Deno.env.get("SENDGRID_FROM_EMAIL") ?? "noreply@bankruptcy.ai";
        if (SENDGRID_API_KEY) {
          await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SENDGRID_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: clientEmail }] }],
              from: { email: SENDGRID_FROM, name: `${senderName} — bankruptcy.ai` },
              subject: subject ?? `Video Meeting Invitation — ${senderName}`,
              content: [{
                type: "text/html",
                value: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;"><h2 style="color:#1e293b;">You have a video meeting invitation</h2><p style="color:#475569;">${body}</p><div style="margin:20px 0;padding:16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;"><strong>Join Google Meet:</strong><br/><a href="${resolvedMeetLink}" style="color:#15803d;">${resolvedMeetLink}</a></div><p style="color:#94a3b8;font-size:12px;">From your bankruptcy.ai legal team.</p></div>`,
              }],
            }),
          });
        }
      }
      externalId = `meet_${Date.now()}`;
    }

    // ── Update message record in Supabase ─────────────────────────────────────
    if (messageId) {
      await fetch(`${SUPABASE_URL}/rest/v1/client_messages?id=eq.${messageId}`, {
        method: "PATCH",
        headers: sbHeaders,
        body: JSON.stringify({
          delivery_status: deliveryStatus,
          delivery_error: deliveryError,
          external_id: externalId,
          meet_link: resolvedMeetLink,
          sent_at: new Date().toISOString(),
        }),
      });
    }

    // ── MAJ-96/97 audit log ───────────────────────────────────────────────────
    if (firm_id && template_key && templateSource) {
      try {
        await supabase.from("communication_audit_log").insert({
          firm_id,
          recipient: clientEmail ?? clientPhone,
          template_key,
          channel,
          template_source: templateSource,
          sender_identity: senderIdentity,
          sent_at: new Date().toISOString(),
        });
      } catch (auditErr) {
        console.warn("[send-client-message] audit log insert failed:", auditErr);
      }
    }

    // ── Log to case_time_log ──────────────────────────────────────────────────
    if (clientId) {
      const channelLabel: Record<string, string> = {
        sms: "SMS",
        email: "Email",
        voice: "Voice Call",
        google_meet: "Google Meet",
        in_app: "In-App Message",
      };
      const activityType: Record<string, string> = {
        sms: "sms_thread",
        email: "email",
        voice: "client_call",
        google_meet: "video_call",
        in_app: "message",
      };
      const docNote = payload.relatedDocument
        ? ` | Re: ${payload.relatedDocument}`
        : "";
      await fetch(`${SUPABASE_URL}/rest/v1/case_time_log`, {
        method: "POST",
        headers: sbHeaders,
        body: JSON.stringify({
          client_id: clientId,
          staff_name: senderName,
          activity_type: activityType[channel] ?? "message",
          duration_minutes: 0,
          billable: false,
          notes: `${channelLabel[channel] ?? channel} from ${senderName} (${senderRole})${docNote}: "${body.slice(0, 200)}"`,
          reference_id: messageId,
          reference_table: "client_messages",
          started_at: new Date().toISOString(),
        }),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        deliveryStatus,
        externalId,
        meetLink: resolvedMeetLink,
        deliveryError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-client-message error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
