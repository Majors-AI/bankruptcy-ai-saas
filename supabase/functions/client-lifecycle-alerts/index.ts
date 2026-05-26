import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY");

const FROM = "MAJORSLAW.ai <noreply@majorslaw.ai>";

async function dbGet(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  return r.ok ? r.json() : [];
}

async function dbPost(table: string, body: object) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json", Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  return r.ok ? r.json() : null;
}

async function dbPatch(table: string, id: string, body: object) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function sendEmail(to: string, subject: string, text: string) {
  if (!RESEND_KEY) {
    console.log(`[lifecycle-alerts] No RESEND_API_KEY. Would send to ${to}: ${subject}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, text }),
  });
  if (!res.ok) console.error("Resend error:", await res.text());
}

// ── PAID-IN-FULL 60-DAY WARNING ──────────────────────────────────────────────
// Logic:
//   1. Find clients where balance === 0 (all schedule entries paid) and they
//      have been paid in full for >= 6 months.
//   2. Check if they are NOT yet in paralegal review (no in_progress paralegal_reviews record).
//   3. Check if billable hours amount exceeds the flat fee — if so, 60-day window begins.
//   4. If no alert has been sent yet, create one and email the client.
//   5. If 60 days have passed since warning and client is still not in paralegal review,
//      create a task for accounting super admin to send drop/withdrawal letter.
async function runPaidInFullWarnings() {
  const today = new Date();
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Get all active accounting clients
  const clients: Array<{
    id: string; full_name: string; email: string | null;
    status: string; extended_status: string;
  }> = await dbGet("accounting_clients?status=eq.active&order=created_at.asc");

  // Get fee structures, schedule entries, and time logs in batch
  const [feeStructures, scheduleEntries, timeLogs, existingAlerts, paralegalReviews] =
    await Promise.all([
      dbGet("accounting_fee_structures?select=client_id,total_fee,attorney_fee"),
      dbGet("accounting_payment_schedule?select=client_id,due_date,amount_due,amount_paid,status"),
      dbGet("case_time_log?select=client_id,billable,billable_amount,duration_minutes,billing_rate,started_at"),
      dbGet("client_lifecycle_alerts?select=client_id,alert_type,triggered_at,status,email_sent_at"),
      dbGet("paralegal_reviews?select=client_id,status"),
    ]);

  const fsByClient = new Map<string, { total_fee: number; attorney_fee: number }>();
  for (const f of feeStructures) fsByClient.set(f.client_id, f);

  const schedByClient = new Map<string, Array<{ due_date: string; amount_due: number; amount_paid: number; status: string }>>();
  for (const s of scheduleEntries) {
    if (!schedByClient.has(s.client_id)) schedByClient.set(s.client_id, []);
    schedByClient.get(s.client_id)!.push(s);
  }

  const timeByClient = new Map<string, Array<{ billable: boolean; billable_amount: number; duration_minutes: number; billing_rate: number; started_at: string }>>();
  for (const t of timeLogs) {
    if (!timeByClient.has(t.client_id)) timeByClient.set(t.client_id, []);
    timeByClient.get(t.client_id)!.push(t);
  }

  const alertedClients = new Set<string>();
  for (const a of existingAlerts) {
    if (a.alert_type === "paid_in_full_60day_warning" && a.status !== "dismissed") {
      alertedClients.add(a.client_id);
    }
  }

  const paralegalInProgress = new Set<string>();
  for (const p of paralegalReviews) {
    if (p.status === "in_progress") paralegalInProgress.add(p.client_id);
  }

  for (const client of clients) {
    if (paralegalInProgress.has(client.id)) continue; // already in review, skip

    const fs = fsByClient.get(client.id);
    if (!fs || fs.total_fee <= 0) continue;

    const sched = schedByClient.get(client.id) ?? [];
    if (sched.length === 0) continue;

    // Determine if fully paid: all schedule entries are paid
    const allPaid = sched.every(s => s.status === "paid" || s.status === "waived");
    if (!allPaid) continue;

    // Find the date the last payment was made (latest paid_date or due_date)
    const paidDates = sched
      .filter(s => s.status === "paid")
      .map(s => new Date(s.due_date));
    if (paidDates.length === 0) continue;
    const lastPaidDate = new Date(Math.max(...paidDates.map(d => d.getTime())));

    // Must be paid in full for at least 6 months
    if (lastPaidDate > sixMonthsAgo) continue;

    // Calculate billable hours total
    const logs = timeByClient.get(client.id) ?? [];
    const billableAmount = logs
      .filter(l => l.billable)
      .reduce((s, l) => {
        if (l.billable_amount) return s + l.billable_amount;
        if (l.billing_rate && l.duration_minutes) return s + (l.billing_rate * l.duration_minutes / 60);
        return s;
      }, 0);

    const exceedsFee = billableAmount > fs.attorney_fee;

    // Only warn if billable hours exceed the fee (60-day clock starts)
    if (!exceedsFee) continue;

    // Check if already warned
    if (alertedClients.has(client.id)) {
      // Check if 60 days have passed since warning and still not in review
      const alert = existingAlerts.find(
        (a: { client_id: string; alert_type: string; triggered_at: string }) =>
          a.client_id === client.id && a.alert_type === "paid_in_full_60day_warning"
      );
      if (alert) {
        const warnedAt = new Date(alert.triggered_at);
        const daysSinceWarning = Math.floor((today.getTime() - warnedAt.getTime()) / 86400000);
        if (daysSinceWarning >= 60) {
          // Create drop notice task for accounting super admin
          const dropAlertExists = existingAlerts.some(
            (a: { client_id: string; alert_type: string }) =>
              a.client_id === client.id && a.alert_type === "drop_notice_task"
          );
          if (!dropAlertExists) {
            await dbPost("client_lifecycle_alerts", {
              client_id: client.id,
              client_name: client.full_name,
              alert_type: "drop_notice_task",
              paid_full_date: lastPaidDate.toISOString().slice(0, 10),
              total_billable_hours: logs.filter(l => l.billable).reduce((s, l) => s + l.duration_minutes / 60, 0),
              billable_amount: billableAmount,
              total_fee: fs.total_fee,
              task_created_for: "accounting_super_admin",
              status: "open",
            });
          }
        }
      }
      continue;
    }

    // Send 60-day warning to client
    if (client.email) {
      const subject = `Important Notice: Your Case Documents Must Be Submitted Within 60 Days — ${client.full_name}`;
      const body = `Dear ${client.full_name.split(" ")[0]},

IMPORTANT NOTICE — ACTION REQUIRED WITHIN 60 DAYS

We are writing to inform you that your account is paid in full, and the time spent on your case has exceeded your original flat fee. As a result, your 60-day document submission window is now active.

To move your case forward to final review and filing, all required documents and information must be submitted to our office within 60 days of this notice.

WHAT YOU NEED TO DO
-------------------
1. Log in to your client portal and complete any outstanding document uploads.
2. Ensure all personal, financial, and asset information is accurate and up to date.
3. Contact our office if you have any questions or need assistance.

IMPORTANT: If all documents and information are not submitted and your case is not in active paralegal review within 60 days of this notice, our firm may be required to withdraw from your representation. A formal withdrawal notice would follow.

Account Summary
---------------
Client: ${client.full_name}
Status: Paid in Full (6+ months)
Deadline: ${new Date(today.getTime() + 60 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}

If you have any questions, please contact our office immediately.

Sincerely,
MAJORSLAW.ai — Client Services Team
This is an automated notice. Please do not reply to this email.`.trim();

      await sendEmail(client.email, subject, body);
    }

    await dbPost("client_lifecycle_alerts", {
      client_id: client.id,
      client_name: client.full_name,
      alert_type: "paid_in_full_60day_warning",
      paid_full_date: lastPaidDate.toISOString().slice(0, 10),
      total_billable_hours: logs.filter(l => l.billable).reduce((s, l) => s + l.duration_minutes / 60, 0),
      billable_amount: billableAmount,
      total_fee: fs.total_fee,
      email_sent_to: client.email ?? null,
      email_sent_at: client.email ? new Date().toISOString() : null,
      status: "open",
    });
  }
}

// ── CANCEL REQUEST WORKFLOW ──────────────────────────────────────────────────
// When a new cancel request is created, this handler:
//   1. Creates a task for accounting: pause payments
//   2. Creates a task for attorney super admin: reach out to client
//   3. Sends an outreach email to the client offering to discuss what changed
async function handleCancelRequest(payload: {
  cancel_request_id: string;
  client_id: string;
  client_name: string;
  client_email: string | null;
  reason_category: string;
  reason_detail: string | null;
}) {
  const { cancel_request_id, client_id, client_name, client_email, reason_category, reason_detail } = payload;

  // 1. Create task: Accounting — Pause Payments
  const pauseTask = await dbPost("cancel_request_tasks", {
    cancel_request_id,
    client_id,
    task_type: "pause_payments",
    assigned_role: "accounting_super_admin",
    title: `CANCEL REQUEST: Pause Payments — ${client_name}`,
    description: `Client has submitted a cancellation request. Immediately pause all scheduled autopay and outstanding payment charges for this client. Reason: ${reason_category.replace(/_/g, " ")}${reason_detail ? ` — "${reason_detail}"` : ""}.`,
    status: "pending",
  });
  const pauseTaskId = Array.isArray(pauseTask) ? pauseTask[0]?.id : pauseTask?.id;

  // 2. Create task: Attorney Super Admin — Reach Out to Client
  const outreachTask = await dbPost("cancel_request_tasks", {
    cancel_request_id,
    client_id,
    task_type: "attorney_outreach",
    assigned_role: "attorney_super_admin",
    title: `CANCEL REQUEST: Client Outreach Required — ${client_name}`,
    description: `Client has requested cancellation. Call or email the client to understand what has changed and attempt to save the case. Offer solutions (reduced payments, payment push, fee reduction). Reason stated: ${reason_category.replace(/_/g, " ")}${reason_detail ? ` — "${reason_detail}"` : ""}. Review the cancellation request and mark outcome.`,
    status: "pending",
  });
  const outreachTaskId = Array.isArray(outreachTask) ? outreachTask[0]?.id : outreachTask?.id;

  // 3. Update cancel request with task IDs
  await dbPatch("accounting_cancel_requests", cancel_request_id, {
    accounting_pause_task_id: pauseTaskId ?? null,
    attorney_outreach_task_id: outreachTaskId ?? null,
    updated_at: new Date().toISOString(),
  });

  // 4. Send outreach email to client
  if (client_email) {
    const subject = `We Want to Help — Let's Talk About Your Case, ${client_name.split(" ")[0]}`;
    const body = `Dear ${client_name.split(" ")[0]},

We received your request, and we want to make sure we fully understand your situation before taking any further steps.

Our team genuinely cares about helping you get through this process, and we would like the opportunity to speak with you personally about what has changed and see if there is anything we can do to make this easier.

WHAT HAPPENS NEXT
-----------------
1. A member of our team will reach out to you within 1–2 business days.
2. Your payments will be paused while your case is under review.
3. If there is a payment, schedule, or fee arrangement we can adjust to help you continue, we will present those options to you.

If after speaking with our team you still wish to cancel, we will process your request promptly, and you will receive a formal disengagement notice along with any applicable refund of unearned fees.

You deserve to have someone in your corner during this process — please give us the chance to help.

To discuss your case or ask any questions before our call, you can reply to this email or call our office directly.

Sincerely,
MAJORSLAW.ai — Client Services Team`.trim();

    await sendEmail(client_email, subject, body);

    await dbPatch("accounting_cancel_requests", cancel_request_id, {
      cancel_email_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return { pause_task_id: pauseTaskId, outreach_task_id: outreachTaskId };
}

// ── DISENGAGEMENT NOTICE ──────────────────────────────────────────────────────
// When a cancel request is confirmed (not saved), this sends the disengagement
// email to the client and creates a refund task for accounting super admin.
async function handleDisengagement(payload: {
  cancel_request_id: string;
  client_id: string;
  client_name: string;
  client_email: string | null;
  total_paid: number;
  earned_fees: number;
  authorized_by: string;
}) {
  const { cancel_request_id, client_id, client_name, client_email, total_paid, earned_fees, authorized_by } = payload;
  const unearned = Math.max(0, total_paid - earned_fees);
  const refundAmount = unearned;
  const refundApplicable = refundAmount > 0;

  const emailSubject = `Notice of Disengagement — ${client_name}`;
  const emailBody = `Dear ${client_name.split(" ")[0]},

NOTICE OF DISENGAGEMENT

This letter serves as formal notice that MAJORSLAW.ai has withdrawn from your legal representation effective as of the date of this notice.

We have processed your cancellation request and wish you the best going forward.

${refundApplicable ? `REFUND OF UNEARNED FEES
-----------------------
Upon review of your account, you are entitled to a refund of unearned fees in the amount of $${refundAmount.toFixed(2)}.

  Total Paid:    $${total_paid.toFixed(2)}
  Earned Fees:   $${earned_fees.toFixed(2)}
  Refund Due:    $${refundAmount.toFixed(2)}

Our accounting team will process this refund within 10 business days and contact you regarding the refund method.` : `ACCOUNT BALANCE
---------------
After reviewing your account, all fees paid have been earned based on services rendered. No refund is due.

  Total Paid:  $${total_paid.toFixed(2)}
  Earned Fees: $${earned_fees.toFixed(2)}`}

IMPORTANT NOTICE
----------------
As of the effective date of this disengagement, MAJORSLAW.ai no longer represents you in any legal matter. You should seek independent legal counsel if you wish to continue with your bankruptcy case or any other legal matter.

Any deadlines, court dates, or filing requirements remain your responsibility after the date of this notice.

Please retain this notice for your records.

Sincerely,
MAJORSLAW.ai — Legal Services Team
This is an official correspondence. Please do not disregard this notice.`.trim();

  // Send the disengagement email
  if (client_email) {
    await sendEmail(client_email, emailSubject, emailBody);
  }

  // Create disengagement notice record
  const notice = await dbPost("disengagement_notices", {
    client_id,
    client_name,
    client_email: client_email ?? null,
    cancel_request_id,
    email_sent_at: client_email ? new Date().toISOString() : null,
    email_sent_by: authorized_by,
    email_subject: emailSubject,
    email_body: emailBody,
    total_paid,
    earned_fees,
    unearned_fees: unearned,
    refund_amount: refundAmount,
    refund_status: refundApplicable ? "calculated" : "not_applicable",
    status: refundApplicable ? "refund_pending" : "sent",
  });
  const noticeId = Array.isArray(notice) ? notice[0]?.id : notice?.id;

  // If refund applicable, create accounting super admin task
  if (refundApplicable && noticeId) {
    const refundTask = await dbPost("cancel_request_tasks", {
      cancel_request_id,
      client_id,
      task_type: "refund_unearned",
      assigned_role: "accounting_super_admin",
      title: `REFUND REQUIRED: ${client_name} — $${refundAmount.toFixed(2)} Unearned Fees`,
      description: `Client has been disengaged. Calculate and issue refund of unearned fees. Total paid: $${total_paid.toFixed(2)}. Earned fees: $${earned_fees.toFixed(2)}. Refund due: $${refundAmount.toFixed(2)}. Disengagement notice ID: ${noticeId}. Process refund within 10 business days.`,
      status: "pending",
    });
    const refundTaskId = Array.isArray(refundTask) ? refundTask[0]?.id : refundTask?.id;

    if (noticeId && refundTaskId) {
      await dbPatch("disengagement_notices", noticeId, {
        accounting_task_id: refundTaskId,
        updated_at: new Date().toISOString(),
      });
    }
  }

  return { notice_id: noticeId, refund_amount: refundAmount };
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action ?? "run_paid_in_full_warnings";

    if (action === "run_paid_in_full_warnings") {
      await runPaidInFullWarnings();
      return new Response(JSON.stringify({ success: true, action }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "handle_cancel_request") {
      const result = await handleCancelRequest(body);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "handle_disengagement") {
      const result = await handleDisengagement(body);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("client-lifecycle-alerts error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
