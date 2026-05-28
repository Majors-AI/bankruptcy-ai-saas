import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
      leadId,
      leadName,
      email,
      phone,
      consultDate,   // YYYY-MM-DD
      consultTime,   // HH:mm (24h)
      duration,      // minutes
      staffName,
      chapterInterest,
      intakeFormUrl, // base URL for client intake form, e.g. https://app.bankruptcy.ai/intake?lead=xxx
    } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "No email provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstName = leadName?.split(" ")[0] ?? "Client";
    const chapterLabel = chapterInterest === 13 ? "Chapter 13" : "Chapter 7";

    // Format date/time nicely
    const apptDate = consultDate
      ? new Date(consultDate + "T12:00:00").toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        })
      : "To be confirmed";

    let apptTime = "To be confirmed";
    if (consultTime) {
      const [h, m] = consultTime.split(":").map(Number);
      const d = new Date(); d.setHours(h, m, 0);
      apptTime = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    }
    const durationLabel = duration ? `${duration} minutes` : "45 minutes";

    const formLink = intakeFormUrl || "https://app.bankruptcy.ai/intake";

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin: 0; padding: 0; background: #0a0f1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .wrapper { max-width: 580px; margin: 0 auto; padding: 32px 16px; }
  .card { background: #0d1221; border: 1px solid #1e2840; border-radius: 16px; overflow: hidden; }
  .header { background: linear-gradient(135deg, #92400e 0%, #b45309 100%); padding: 32px 32px 28px; }
  .header h1 { margin: 0; color: #fff; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
  .header p { margin: 6px 0 0; color: rgba(255,255,255,0.75); font-size: 13px; }
  .body { padding: 28px 32px; }
  .greeting { color: #e2e8f0; font-size: 15px; line-height: 1.6; margin: 0 0 20px; }
  .appt-card { background: #111827; border: 1px solid #1e2840; border-radius: 12px; padding: 20px; margin: 0 0 24px; }
  .appt-row { display: flex; align-items: flex-start; gap: 12px; margin: 0 0 12px; }
  .appt-row:last-child { margin: 0; }
  .appt-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 14px; }
  .icon-cal { background: rgba(245, 158, 11, 0.15); }
  .icon-clock { background: rgba(59, 130, 246, 0.15); }
  .icon-user { background: rgba(16, 185, 129, 0.15); }
  .appt-label { color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 2px; }
  .appt-value { color: #f1f5f9; font-size: 14px; font-weight: 600; margin: 0; }
  .divider { height: 1px; background: #1e2840; margin: 20px 0; }
  .section-title { color: #f59e0b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 12px; }
  .steps { list-style: none; margin: 0 0 24px; padding: 0; }
  .steps li { display: flex; gap: 12px; margin: 0 0 12px; align-items: flex-start; }
  .step-num { width: 22px; height: 22px; border-radius: 50%; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); color: #f59e0b; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
  .step-text { color: #94a3b8; font-size: 13px; line-height: 1.5; }
  .step-text strong { color: #e2e8f0; }
  .cta-section { background: linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.04)); border: 1px solid rgba(245,158,11,0.2); border-radius: 12px; padding: 20px; margin: 0 0 24px; text-align: center; }
  .cta-title { color: #f59e0b; font-size: 13px; font-weight: 700; margin: 0 0 6px; }
  .cta-desc { color: #94a3b8; font-size: 12px; margin: 0 0 16px; line-height: 1.5; }
  .cta-btn { display: inline-block; background: #f59e0b; color: #0a0f1a; font-size: 13px; font-weight: 800; padding: 12px 28px; border-radius: 10px; text-decoration: none; letter-spacing: 0.02em; }
  .notice { background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); border-radius: 10px; padding: 14px 16px; margin: 0 0 20px; }
  .notice p { color: #93c5fd; font-size: 12px; line-height: 1.6; margin: 0; }
  .footer { padding: 0 32px 28px; }
  .footer p { color: #4b5563; font-size: 11px; line-height: 1.6; margin: 0; text-align: center; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <h1>Consultation Scheduled</h1>
      <p>bankruptcy.ai · ${chapterLabel} Bankruptcy</p>
    </div>
    <div class="body">
      <p class="greeting">Dear ${firstName},</p>
      <p class="greeting" style="margin-top:-8px;">Your free bankruptcy consultation has been scheduled. Please review your appointment details below and complete the pre-consultation intake form before your appointment — this helps us make the most of your time.</p>

      <div class="appt-card">
        <div class="appt-row">
          <div class="appt-icon icon-cal">📅</div>
          <div>
            <p class="appt-label">Date</p>
            <p class="appt-value">${apptDate}</p>
          </div>
        </div>
        <div class="appt-row">
          <div class="appt-icon icon-clock">🕐</div>
          <div>
            <p class="appt-label">Time &amp; Duration</p>
            <p class="appt-value">${apptTime} · ${durationLabel}</p>
          </div>
        </div>
        <div class="appt-row">
          <div class="appt-icon icon-user">👤</div>
          <div>
            <p class="appt-label">Your Intake Specialist</p>
            <p class="appt-value">${staffName || "bankruptcy.ai Intake Team"}</p>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <p class="section-title">Before Your Appointment</p>
      <ul class="steps">
        <li><div class="step-num">1</div><div class="step-text"><strong>Complete your intake form</strong> — Use the button below to fill out your pre-consultation questionnaire. It typically takes 10–15 minutes.</div></li>
        <li><div class="step-num">2</div><div class="step-text"><strong>Gather your documents</strong> — Recent pay stubs, bank statements, a list of debts, and any court notices or garnishment letters.</div></li>
        <li><div class="step-num">3</div><div class="step-text"><strong>Be available</strong> — Our intake specialist will call you at the scheduled time. Have your information handy.</div></li>
      </ul>

      <div class="notice">
        <p><strong style="color:#bfdbfe;">Important:</strong> This consultation is with a legal intake specialist, not an attorney. Information gathered will be reviewed by a licensed attorney who will follow up with you regarding your case eligibility and options.</p>
      </div>

      <div class="cta-section">
        <p class="cta-title">Complete Your Intake Form</p>
        <p class="cta-desc">Fill this out before your appointment so we can review your situation in advance and make the most of your consultation time.</p>
        <a href="${formLink}" class="cta-btn">Start Intake Form →</a>
      </div>
    </div>
    <div class="footer">
      <p>bankruptcy.ai · Bankruptcy Legal Services<br>
      This is a confidential communication intended only for ${leadName}.<br>
      Please do not reply to this automated email — contact us directly with any questions.</p>
    </div>
  </div>
</div>
</body>
</html>
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
          subject: `Your Consultation is Scheduled — ${apptDate} at ${apptTime}`,
          html: htmlBody,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("Resend error:", err);
      }
    } else {
      console.log(`[send-intake-invite] No RESEND_API_KEY. Would send to: ${email}`);
      console.log(`[send-intake-invite] Appt: ${apptDate} ${apptTime} (${durationLabel})`);
    }

    // Audit log to intake_leads if leadId provided
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (SUPABASE_URL && SERVICE_KEY && leadId) {
      await fetch(`${SUPABASE_URL}/rest/v1/intake_leads?id=eq.${leadId}`, {
        method: "PATCH",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          last_contact_at: new Date().toISOString(),
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-intake-invite error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
