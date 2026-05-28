import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CollectionCase {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  outstanding_balance: number;
  days_past_due: number;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  first_missed_payment_date: string | null;
  status: string;
  ai_contact_count: number;
}

interface FollowupPayload {
  case_id: string;
  channel?: "sms" | "email" | "in_app";
  preview_only?: boolean;
}

function buildFollowupMessage(c: CollectionCase, contactNumber: number): string {
  const firstName = c.client_name.split(" ")[0];
  const balance = `$${c.outstanding_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const daysLate = c.days_past_due;

  // Escalating urgency tone based on contact count and days past due
  if (contactNumber <= 1 || daysLate <= 35) {
    return `Hi ${firstName}, this is a friendly reminder from bankruptcy.ai about your bankruptcy case. You have an outstanding balance of ${balance}. We understand things can be tough right now — even a small payment helps keep your case moving forward. If you can make any payment at all, please log in to your client portal or call our office. We're here to work with you.`;
  }

  if (contactNumber <= 3 || daysLate <= 60) {
    return `Hi ${firstName}, we wanted to reach out again regarding your balance of ${balance} which is now ${daysLate} days past due. Your bankruptcy case is important to us and we want to see it through to completion for you. We can work with almost any amount — please reach out so we can set up a plan that works for your situation. Your case cannot move forward without payment, but we're ready to help you find a way.`;
  }

  if (contactNumber <= 5 || daysLate <= 80) {
    return `${firstName}, this is an important message regarding your bankruptcy.ai account. Your outstanding balance of ${balance} is now ${daysLate} days overdue. We've made several attempts to reach you. Please contact us as soon as possible — we want to help you complete your bankruptcy filing and protect you from creditors. Even a partial payment restarts your case progress. Please call or log in to your portal today.`;
  }

  // High urgency — escalate to staff review
  return `${firstName}, URGENT: Your outstanding balance of ${balance} is ${daysLate} days past due and your case is at risk of being placed on hold. We have made multiple attempts to contact you. Please call our office immediately or log in to your portal. We want to help you — but we need to hear from you. If you're facing financial hardship beyond what we've discussed, please let us know so we can explore options together.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const sbHeaders = {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    // Handle GET: return list of cases due for follow-up
    if (req.method === "GET") {
      const now = new Date().toISOString();
      const casesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/collection_cases?status=eq.active&ai_followup_enabled=eq.true&days_past_due=gte.30&or=(next_ai_contact_at.is.null,next_ai_contact_at.lte.${now})&order=days_past_due.desc`,
        { headers: sbHeaders }
      );
      const cases = await casesRes.json();
      return new Response(JSON.stringify({ cases }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle POST: send follow-up for a specific case
    const payload: FollowupPayload = await req.json();
    const { case_id, channel = "in_app", preview_only = false } = payload;

    // Load the case
    const caseRes = await fetch(
      `${SUPABASE_URL}/rest/v1/collection_cases?id=eq.${case_id}`,
      { headers: sbHeaders }
    );
    const cases: CollectionCase[] = await caseRes.json();
    if (!cases || cases.length === 0) {
      return new Response(JSON.stringify({ error: "Case not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ccase = cases[0];
    const nextContactNum = ccase.ai_contact_count + 1;
    const message = buildFollowupMessage(ccase, nextContactNum);
    const shouldEscalate = nextContactNum > 5 || ccase.days_past_due > 90;

    if (preview_only) {
      return new Response(JSON.stringify({ message, shouldEscalate, contactNumber: nextContactNum }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine next follow-up window (escalate frequency as days increase)
    const daysUntilNext = ccase.days_past_due > 60 ? 3 : ccase.days_past_due > 45 ? 5 : 7;
    const nextContact = new Date();
    nextContact.setDate(nextContact.getDate() + daysUntilNext);

    // Log the contact attempt
    const contactPayload = {
      case_id: case_id,
      client_id: ccase.client_id,
      contact_type: shouldEscalate ? "escalated" : "ai_followup",
      channel: channel,
      message_sent: message,
      sent_by: "AI Agent",
      ai_model: "bankruptcy-ai-collections-agent",
      notes: shouldEscalate ? `Escalated after ${nextContactNum} attempts, ${ccase.days_past_due} days past due` : null,
    };

    await fetch(`${SUPABASE_URL}/rest/v1/collection_contacts`, {
      method: "POST",
      headers: sbHeaders,
      body: JSON.stringify(contactPayload),
    });

    // Update the case
    await fetch(`${SUPABASE_URL}/rest/v1/collection_cases?id=eq.${case_id}`, {
      method: "PATCH",
      headers: sbHeaders,
      body: JSON.stringify({
        ai_contact_count: nextContactNum,
        last_ai_contact_at: new Date().toISOString(),
        next_ai_contact_at: nextContact.toISOString(),
        status: shouldEscalate ? "active" : ccase.status,
        updated_at: new Date().toISOString(),
      }),
    });

    // If client has a message thread in client_messages, also log as in_app message
    if (channel === "in_app") {
      // Check for existing thread
      const threadRes = await fetch(
        `${SUPABASE_URL}/rest/v1/client_message_threads?client_id=eq.${ccase.client_id}`,
        { headers: sbHeaders }
      );
      const threads = await threadRes.json();
      let threadId: string;

      if (threads && threads.length > 0) {
        threadId = threads[0].id;
        await fetch(`${SUPABASE_URL}/rest/v1/client_message_threads?id=eq.${threadId}`, {
          method: "PATCH",
          headers: sbHeaders,
          body: JSON.stringify({
            unread_count: (threads[0].unread_count || 0) + 1,
            last_message_at: new Date().toISOString(),
          }),
        });
      } else {
        const newThread = await fetch(`${SUPABASE_URL}/rest/v1/client_message_threads`, {
          method: "POST",
          headers: sbHeaders,
          body: JSON.stringify({ client_id: ccase.client_id, unread_count: 1, last_message_at: new Date().toISOString() }),
        });
        const threadData = await newThread.json();
        threadId = threadData?.[0]?.id;
      }

      if (threadId) {
        await fetch(`${SUPABASE_URL}/rest/v1/client_messages`, {
          method: "POST",
          headers: sbHeaders,
          body: JSON.stringify({
            thread_id: threadId,
            client_id: ccase.client_id,
            sender_role: "staff",
            sender_name: "bankruptcy.ai Collections",
            subject: "Payment Reminder — Action Required",
            body: message,
            channel: "in_app",
            delivery_status: "sent",
            is_internal: false,
            sent_at: new Date().toISOString(),
          }),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message,
        contactNumber: nextContactNum,
        shouldEscalate,
        nextFollowup: nextContact.toISOString(),
        channel,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("collections-ai-followup error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
