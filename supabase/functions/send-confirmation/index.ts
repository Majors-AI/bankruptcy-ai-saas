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
  const gateSubmissionId = (payload._gate_submission_id as string | null) ?? null;
  const gateClientId = (payload._gate_client_id as string | null) ?? null;
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

const CH7_BENEFITS = [
  "Fast discharge — most cases complete in 90–120 days from filing",
  "Eliminates credit card debt, medical bills, personal loans, and most unsecured debt entirely",
  "The automatic stay immediately stops wage garnishments, lawsuits, and all creditor harassment upon filing",
  "Your exempt assets — including home equity, vehicle equity, retirement accounts, and household goods — are fully protected",
  "A fresh financial start with no ongoing plan payment obligations after discharge",
  "Most Chapter 7 cases are no-asset cases — the trustee does not liquidate any of your property",
  "Once discharged, creditors are permanently enjoined from future collection attempts on those debts",
];

const CH13_BENEFITS = [
  "You keep ALL of your assets — no liquidation by the trustee, even property that may not be fully exempt",
  "Filing immediately stops foreclosure, and mortgage arrears can be cured in full over your 60-month plan",
  "Vehicle loans can be restructured — in many cases the balance can be reduced to the car's current market value",
  "At the end of your plan, remaining general unsecured debt (credit cards, medical bills, etc.) is discharged",
  "Priority debts like taxes and domestic support can be paid over time through the plan — often without additional penalties",
  "The automatic stay stops all collection actions, wage garnishments, lawsuits, and creditor calls the moment you file",
  "Co-signers on your debts are also protected from collection through the co-debtor stay (unique to Chapter 13)",
  "A structured 3–5 year plan often results in a lower monthly obligation than paying creditors individually",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const {
      to,
      clientName,
      referenceNumber,
      chapter,
      courtDistrict,
      quotedFee,
      attorneyNotes,
      calendarUrl,
      isBifurcated,
      payFrequency,
      isDenial,
      denialMessage,
      isLimitedScope,
      limitedScopeDescription,
      limitedScopeFlatFee,
      isPersonalInjury,
      piContingencyPreLit,
      piContingencyLitigation,
    } = payload;

    // ─── Gate ──────────────────────────────────────────────────────────────
    const gate = await checkConsentGate(payload, "email", "send-confirmation");
    if (!gate.allowed) {
      return new Response(JSON.stringify({ skipped: true, reason: gate.reason }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ───────────────────────────────────────────────────────────────────────

    const feeFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(quotedFee || 0);
    const firstName = (clientName || "").split(" ")[0] || clientName;
    const bookingLink = calendarUrl || "https://calendly.com/your-firm/consultation";

    const benefits = chapter === "7" ? CH7_BENEFITS : CH13_BENEFITS;

    const benefitsHtml = benefits.map(b => `
      <tr>
        <td style="padding:8px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#374151;">
          <span style="color:#f59e0b;margin-right:8px;">&#10003;</span>${b}
        </td>
      </tr>`).join("");

    const ch13ExtraHtml = chapter === "13" ? `
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:18px 20px;margin:20px 0;">
        <p style="color:#92400e;font-weight:700;margin:0 0 8px;font-size:14px;">How Chapter 13 Works — What This Means for You</p>
        <p style="color:#78350f;margin:0 0 10px;font-size:13px;line-height:1.7;">
          Chapter 13 is a <strong>reorganization plan</strong> — not a liquidation. You keep everything you own. Over the next 3–5 years, you make a single monthly payment to a trustee, who distributes funds to your creditors according to the plan our office prepares for you. At the end of your plan, any remaining general unsecured debt (credit cards, medical bills, personal loans) that has not been paid is <strong>permanently discharged</strong> by the court. You emerge financially free with your assets intact.
        </p>
        <p style="color:#78350f;margin:0;font-size:13px;line-height:1.7;">
          Chapter 13 is the right choice when you have assets worth protecting, mortgage arrears to catch up on, debts that cannot be discharged in Chapter 7 (like recent tax debt or domestic support), or when your income is too high to qualify for Chapter 7. It is a powerful tool that gives you <strong>court protection</strong> and a structured, manageable path out of debt — while keeping everything you've worked for.
        </p>
      </div>` : "";

    const ch7ExtraHtml = chapter === "7" ? `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:18px 20px;margin:20px 0;">
        <p style="color:#1e3a8a;font-weight:700;margin:0 0 8px;font-size:14px;">How Chapter 7 Works — What This Means for You</p>
        <p style="color:#1e40af;margin:0 0 10px;font-size:13px;line-height:1.7;">
          Chapter 7 is the most common and fastest form of bankruptcy relief. Once your case is filed, an <strong>automatic stay</strong> immediately goes into effect — stopping all collection actions, wage garnishments, lawsuits, and creditor calls on day one. In most cases, within 90–120 days the court issues your <strong>discharge order</strong>, permanently eliminating your qualifying debts. You start fresh with no balances owed on discharged accounts, no ongoing payment obligations, and full protection for your exempt property throughout the process.
        </p>
        <p style="color:#1e40af;margin:0;font-size:13px;line-height:1.7;">
          Chapter 7 is the right choice when your income qualifies under the means test, your assets are protected by exemptions, and your goal is the fastest possible path to a clean financial slate. Most Chapter 7 cases are "no-asset" cases — meaning the trustee does not take or sell any of your property. You walk away free of the discharged debts and ready to rebuild.
        </p>
      </div>` : "";

    const limitedScopeFeeFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(limitedScopeFlatFee || 0);

    const limitedScopeEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 0; }
    .wrapper { max-width: 620px; margin: 32px auto; }
    .container { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
    .header { background: #0f172a; padding: 36px 40px 28px; border-bottom: 3px solid #3b82f6; }
    .header h1 { color: #93c5fd; margin: 0 0 4px; font-size: 22px; letter-spacing: -0.3px; }
    .header p { color: #94a3b8; margin: 0; font-size: 13px; }
    .badge { display: inline-block; background: #3b82f6; color: #ffffff; font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 20px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 20px; }
    .body { padding: 32px 40px; }
    .body p { color: #374151; line-height: 1.7; margin: 0 0 16px; }
    .scope-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 18px 20px; margin: 20px 0; }
    .scope-box p { color: #0c4a6e; margin: 0; font-size: 13px; line-height: 1.8; }
    .detail-table { width: 100%; border-collapse: collapse; margin: 24px 0; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; }
    .detail-table th { background: #f8fafc; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 10px 16px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .detail-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .detail-table tr:last-child td { border-bottom: none; }
    .detail-label { color: #6b7280; font-weight: 500; width: 45%; }
    .detail-value { color: #111827; font-weight: 600; }
    .cta-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px; margin: 24px 0; text-align: center; }
    .cta-block h3 { color: #0f172a; margin: 0 0 8px; font-size: 15px; }
    .cta-block p { color: #64748b; font-size: 13px; margin: 0 0 16px; }
    .cta { background: #3b82f6; color: #ffffff; padding: 13px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block; font-size: 14px; }
    .steps-list { margin: 0; padding: 0 0 0 20px; }
    .steps-list li { color: #374151; font-size: 14px; margin-bottom: 8px; line-height: 1.6; }
    .footer { background: #f8fafc; padding: 20px 40px; border-top: 1px solid #e5e7eb; }
    .footer p { color: #9ca3af; font-size: 11px; margin: 0 0 4px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Your Legal Engagement Has Been Confirmed</h1>
        <p>Legal Services — Confidential Client Communication</p>
      </div>
      <div class="body">
        <div class="badge">Limited Scope Representation — Confirmed</div>
        <p>Dear ${firstName},</p>
        <p>We are pleased to confirm that our office has agreed to provide you with <strong>Limited Scope Legal Representation</strong>. This means we will assist you with a specific, defined set of legal services as described below, rather than a full bankruptcy filing.</p>
        <p>This type of engagement is ideal when you have the ability to resolve your financial situation through negotiation or settlement, and you want experienced legal guidance and advocacy throughout that process.</p>

        <table class="detail-table">
          <thead><tr><th colspan="2">Engagement Details</th></tr></thead>
          <tbody>
            <tr><td class="detail-label">Reference Number</td><td class="detail-value">${referenceNumber}</td></tr>
            <tr><td class="detail-label">Engagement Type</td><td class="detail-value">Limited Scope Representation</td></tr>
            <tr><td class="detail-label">Flat Fee</td><td class="detail-value">${limitedScopeFeeFormatted}</td></tr>
          </tbody>
        </table>

        <p><strong>Scope of Legal Services</strong></p>
        <div class="scope-box">
          <p>${(limitedScopeDescription || "").replace(/\n/g, "<br>")}</p>
        </div>

        <p><strong>What Happens Next</strong></p>
        <ul class="steps-list">
          <li>A member of our team will be in touch shortly to schedule your <strong>onboarding call</strong> and walk you through the next steps.</li>
          <li>We will review the details of your engagement, confirm the scope of work, and begin the representation immediately upon receipt of your fee.</li>
          <li>You are always welcome to reach out with questions — we are here to support you throughout this process.</li>
        </ul>

        <div class="cta-block">
          <h3>Schedule Your Call</h3>
          <p>Book a time to speak with our team and get started.</p>
          <a href="${bookingLink}" class="cta">Book Your Call</a>
        </div>

        <p>If you have any questions before your call, please do not hesitate to contact our office. We look forward to working with you.</p>
        <p>Sincerely,<br><strong>Your Legal Team</strong></p>
      </div>
      <div class="footer">
        <p>This email is confidential and intended solely for <strong>${clientName}</strong>.</p>
        <p>Reference: ${referenceNumber}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const denialEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 0; }
    .wrapper { max-width: 620px; margin: 32px auto; }
    .container { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
    .header { background: #0f172a; padding: 36px 40px 28px; border-bottom: 3px solid #94a3b8; }
    .header h1 { color: #e2e8f0; margin: 0 0 4px; font-size: 22px; }
    .header p { color: #94a3b8; margin: 0; font-size: 13px; }
    .body { padding: 32px 40px; }
    .body p { color: #374151; line-height: 1.7; margin: 0 0 16px; }
    .note-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 20px 0; }
    .note-box p { color: #374151; margin: 0; font-size: 13px; line-height: 1.8; }
    .footer { background: #f8fafc; padding: 20px 40px; border-top: 1px solid #e5e7eb; }
    .footer p { color: #9ca3af; font-size: 11px; margin: 0 0 4px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Case Review — Important Notice</h1>
        <p>Bankruptcy Legal Services — Confidential Client Communication</p>
      </div>
      <div class="body">
        <p>Dear ${firstName},</p>
        <p>Thank you for submitting your bankruptcy intake. After a thorough review of your information, we have the following update regarding your case:</p>
        <div class="note-box">
          <p>${(denialMessage || "").replace(/\n/g, "<br>")}</p>
        </div>
        <p>If you have questions or would like to discuss your options further, please do not hesitate to contact our office. We are committed to helping you find the best path forward, regardless of the outcome of this review.</p>
        <p>Sincerely,<br><strong>Your Bankruptcy Legal Team</strong></p>
      </div>
      <div class="footer">
        <p>This email is confidential and intended solely for <strong>${clientName}</strong>.</p>
        <p>Reference: ${referenceNumber}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const acceptanceEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 0; }
    .wrapper { max-width: 620px; margin: 32px auto; }
    .container { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
    .header { background: #0f172a; padding: 36px 40px 28px; border-bottom: 3px solid ${chapter === "13" ? "#f59e0b" : "#3b82f6"}; }
    .header h1 { color: ${chapter === "13" ? "#f59e0b" : "#93c5fd"}; margin: 0 0 4px; font-size: 22px; letter-spacing: -0.3px; }
    .header p { color: #94a3b8; margin: 0; font-size: 13px; }
    .badge { display: inline-block; background: ${chapter === "13" ? "#f59e0b" : "#3b82f6"}; color: ${chapter === "13" ? "#0f172a" : "#ffffff"}; font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 20px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 20px; }
    .body { padding: 32px 40px; }
    .body p { color: #374151; line-height: 1.7; margin: 0 0 16px; }
    .detail-table { width: 100%; border-collapse: collapse; margin: 24px 0; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; }
    .detail-table th { background: #f8fafc; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 10px 16px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .detail-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .detail-table tr:last-child td { border-bottom: none; }
    .detail-label { color: #6b7280; font-weight: 500; width: 45%; }
    .detail-value { color: #111827; font-weight: 600; }
    .benefits-table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0; }
    .benefits-table thead th { background: #0f172a; color: ${chapter === "13" ? "#f59e0b" : "#93c5fd"}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 10px 16px; text-align: left; }
    .cta-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px; margin: 24px 0; text-align: center; }
    .cta-block h3 { color: #0f172a; margin: 0 0 8px; font-size: 15px; }
    .cta-block p { color: #64748b; font-size: 13px; margin: 0 0 16px; }
    .cta { background: ${chapter === "13" ? "#f59e0b" : "#3b82f6"}; color: ${chapter === "13" ? "#0f172a" : "#ffffff"}; padding: 13px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block; font-size: 14px; }
    .note-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px 20px; margin: 24px 0; }
    .note-box p { color: #92400e; margin: 0; font-size: 13px; line-height: 1.6; }
    .important-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
    .important-box p { color: #991b1b; margin: 0; font-size: 13px; line-height: 1.6; }
    .steps-list { margin: 0; padding: 0 0 0 20px; }
    .steps-list li { color: #374151; font-size: 14px; margin-bottom: 8px; line-height: 1.6; }
    .footer { background: #f8fafc; padding: 20px 40px; border-top: 1px solid #e5e7eb; }
    .footer p { color: #9ca3af; font-size: 11px; margin: 0 0 4px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Your Case Has Been Accepted</h1>
        <p>Bankruptcy Legal Services — Confidential Client Communication</p>
      </div>
      <div class="body">
        <div class="badge">Chapter ${chapter} — Case Accepted</div>
        <p>Dear ${firstName},</p>
        <p>We are pleased to inform you that we have completed the review of your bankruptcy intake and your case has been <strong>formally accepted</strong> by our office for a <strong>Chapter ${chapter} bankruptcy filing</strong>. We look forward to guiding you through this process and helping you achieve a fresh financial start.</p>

        <table class="detail-table">
          <thead><tr><th colspan="2">Case Details</th></tr></thead>
          <tbody>
            <tr><td class="detail-label">Reference Number</td><td class="detail-value">${referenceNumber}</td></tr>
            <tr><td class="detail-label">Bankruptcy Chapter</td><td class="detail-value">Chapter ${chapter}</td></tr>
            ${courtDistrict ? `<tr><td class="detail-label">Filing Court</td><td class="detail-value">${courtDistrict}</td></tr>` : ""}
            <tr><td class="detail-label">Total Fee Quoted</td><td class="detail-value">${feeFormatted}</td></tr>
            ${payFrequency ? `<tr><td class="detail-label">Payment Frequency</td><td class="detail-value">${payFrequency}</td></tr>` : ""}
            ${isBifurcated ? `<tr><td class="detail-label">Fee Arrangement</td><td class="detail-value">Bifurcated — court fees due upfront, attorney fee on payment plan after filing</td></tr>` : ""}
          </tbody>
        </table>

        <p><strong>Why Chapter ${chapter} Is Right for Your Situation</strong></p>
        ${chapter === "7" ? ch7ExtraHtml : ch13ExtraHtml}

        <p style="font-weight:600;margin-bottom:8px;">Key Benefits You Will Receive with Chapter ${chapter}</p>
        <table class="benefits-table">
          <thead><tr><th>Chapter ${chapter} Benefits</th></tr></thead>
          <tbody>${benefitsHtml}</tbody>
        </table>

        ${attorneyNotes ? `
        <div class="note-box">
          <p><strong>Note from Your Attorney:</strong><br>${attorneyNotes}</p>
        </div>` : ""}

        <p><strong>What Happens Next</strong></p>
        <ul class="steps-list">
          <li>A member of our legal team will be reaching out to you shortly to schedule your <strong>welcome call</strong> and walk you through the next steps.</li>
          <li>On that call, we will review your case details, explain the process and timeline, go over your fee arrangement, and answer any questions you have.</li>
          <li>We will also discuss the documents we need from you to prepare your petition.</li>
          ${chapter === "13" ? "<li>For Chapter 13, your attorney will also walk you through your proposed plan payment and what to expect at your 341 Meeting of Creditors.</li>" : ""}
        </ul>

        <div class="cta-block">
          <h3>Ready to Get Started? Book Your Call Now</h3>
          <p>Use our online calendar to pick a time that works best for you — no need to wait for us to call.</p>
          <a href="${bookingLink}" class="cta">Book Your Welcome Call</a>
        </div>

        <div class="important-box">
          <p><strong>Important — Please Read:</strong> While your case is being prepared, please do not transfer any property, make large purchases on credit, or pay back personal loans to family or friends without first speaking with us. These actions can affect your case. Our team will walk you through everything on your welcome call.</p>
        </div>

        <p>If you have questions before your call, please do not hesitate to reach out. We are here to help.</p>
        <p>Sincerely,<br><strong>Your Bankruptcy Legal Team</strong></p>
      </div>
      <div class="footer">
        <p>This email is confidential and intended solely for <strong>${clientName}</strong>. The information contained herein is protected by attorney-client privilege. If you received this in error, please notify us immediately and delete this message.</p>
        <p>Reference: ${referenceNumber}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const piPreLitPct = piContingencyPreLit ?? 33.33;
    const piLitigationPct = piContingencyLitigation ?? 40.00;
    const bookingLinkPi = calendarUrl || "https://calendly.com/your-firm/consultation";

    const piAcceptanceEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 0; }
    .wrapper { max-width: 620px; margin: 32px auto; }
    .container { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
    .header { background: #0f172a; padding: 36px 40px 28px; border-bottom: 3px solid #f43f5e; }
    .header h1 { color: #fda4af; margin: 0 0 4px; font-size: 22px; letter-spacing: -0.3px; }
    .header p { color: #94a3b8; margin: 0; font-size: 13px; }
    .badge { display: inline-block; background: #f43f5e; color: #ffffff; font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 20px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 20px; }
    .body { padding: 32px 40px; }
    .body p { color: #374151; line-height: 1.7; margin: 0 0 16px; }
    .detail-table { width: 100%; border-collapse: collapse; margin: 24px 0; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; }
    .detail-table th { background: #f8fafc; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 10px 16px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .detail-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .detail-table tr:last-child td { border-bottom: none; }
    .detail-label { color: #6b7280; font-weight: 500; width: 45%; }
    .detail-value { color: #111827; font-weight: 600; }
    .info-box { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 18px 20px; margin: 20px 0; }
    .info-box p { color: #9f1239; margin: 0; font-size: 13px; line-height: 1.8; }
    .note-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px 20px; margin: 24px 0; }
    .note-box p { color: #92400e; margin: 0; font-size: 13px; line-height: 1.6; }
    .cta-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px; margin: 24px 0; text-align: center; }
    .cta-block h3 { color: #0f172a; margin: 0 0 8px; font-size: 15px; }
    .cta-block p { color: #64748b; font-size: 13px; margin: 0 0 16px; }
    .cta { background: #f43f5e; color: #ffffff; padding: 13px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block; font-size: 14px; }
    .steps-list { margin: 0; padding: 0 0 0 20px; }
    .steps-list li { color: #374151; font-size: 14px; margin-bottom: 8px; line-height: 1.6; }
    .footer { background: #f8fafc; padding: 20px 40px; border-top: 1px solid #e5e7eb; }
    .footer p { color: #9ca3af; font-size: 11px; margin: 0 0 4px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>We Are Taking Your Personal Injury Case</h1>
        <p>Personal Injury Legal Services — Confidential Client Communication</p>
      </div>
      <div class="body">
        <div class="badge">Personal Injury — Case Accepted</div>
        <p>Dear ${firstName},</p>
        <p>We are pleased to inform you that our office has reviewed your personal injury claim and we are <strong>accepting your case for representation</strong>. We look forward to fighting for the compensation you deserve.</p>

        <div class="info-box">
          <p><strong>How our fee works:</strong> We represent you on a <strong>contingency fee basis</strong> — you pay nothing upfront and nothing out of pocket. Our fee is only collected if we recover money for you. If we do not win, you owe us nothing.</p>
        </div>

        <table class="detail-table">
          <thead><tr><th colspan="2">Case &amp; Fee Details</th></tr></thead>
          <tbody>
            <tr><td class="detail-label">Reference Number</td><td class="detail-value">${referenceNumber}</td></tr>
            <tr><td class="detail-label">Case Type</td><td class="detail-value">Personal Injury — Contingency Fee</td></tr>
            <tr><td class="detail-label">Pre-Litigation Fee</td><td class="detail-value">${piPreLitPct}% of gross recovery</td></tr>
            <tr><td class="detail-label">Litigation Fee (if filed)</td><td class="detail-value">${piLitigationPct}% of gross recovery</td></tr>
            <tr><td class="detail-label">Upfront Cost to You</td><td class="detail-value" style="color:#16a34a;font-weight:700;">$0 — No Fee Unless We Win</td></tr>
          </tbody>
        </table>

        ${attorneyNotes ? `
        <div class="note-box">
          <p><strong>Note from Your Attorney:</strong><br>${attorneyNotes}</p>
        </div>` : ""}

        <p><strong>What Happens Next</strong></p>
        <ul class="steps-list">
          <li>A member of our legal team will contact you shortly to schedule your <strong>welcome call</strong> and walk you through the next steps for your case.</li>
          <li>We will send you a <strong>retainer agreement</strong> to review and sign electronically. This agreement formalizes our representation at no upfront cost to you.</li>
          <li>Once the retainer is signed, we will begin gathering evidence, contacting the at-fault party's insurance, and building your claim.</li>
          <li>Please preserve all records: medical bills, treatment notes, police reports, photos, and any communications from the other party's insurer. Do not speak to their insurance company without us.</li>
        </ul>

        <div class="cta-block">
          <h3>Schedule Your Welcome Call</h3>
          <p>Book a time to speak with your legal team and get your case moving.</p>
          <a href="${bookingLinkPi}" class="cta">Book Your Call</a>
        </div>

        <p>If you have questions before your call, please do not hesitate to reach out. We are in your corner.</p>
        <p>Sincerely,<br><strong>Your Personal Injury Legal Team</strong></p>
      </div>
      <div class="footer">
        <p>This email is confidential and intended solely for <strong>${clientName}</strong>. The information contained herein is protected by attorney-client privilege.</p>
        <p>Reference: ${referenceNumber}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    let emailHtml: string;
    let subject: string;

    if (isPersonalInjury) {
      emailHtml = piAcceptanceEmailHtml;
      subject = `We Are Taking Your Case — Personal Injury Representation Confirmed — Ref: ${referenceNumber}`;
    } else if (isLimitedScope) {
      emailHtml = limitedScopeEmailHtml;
      subject = `Your Legal Engagement Has Been Confirmed — Ref: ${referenceNumber}`;
    } else if (isDenial) {
      emailHtml = denialEmailHtml;
      subject = `Important Update Regarding Your Bankruptcy Case Review — Ref: ${referenceNumber}`;
    } else {
      emailHtml = acceptanceEmailHtml;
      subject = `Your Chapter ${chapter} Bankruptcy Case Has Been Accepted — Ref: ${referenceNumber}`;
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      console.log("No RESEND_API_KEY configured, logging email instead:");
      console.log({ to, subject, isDenial, isLimitedScope });
      return new Response(JSON.stringify({ success: true, note: "Email logged (no email provider configured)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Bankruptcy Legal Services <noreply@yourdomain.com>",
        to: [to],
        subject,
        html: emailHtml,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to send email");

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
