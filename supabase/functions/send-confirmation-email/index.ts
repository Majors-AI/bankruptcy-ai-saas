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
    const { clientId, clientName, email, firstName, chapter, submittedAt } = await req.json();

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
