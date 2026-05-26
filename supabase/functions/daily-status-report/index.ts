import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL             = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY           = Deno.env.get("RESEND_API_KEY");

const db = {
  async get(path: string) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    return r.ok ? r.json() : [];
  },
  async post(table: string, body: object) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(body),
    });
    return r.ok;
  },
  async patch(table: string, id: string, body: object) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(body),
    });
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportSubscription {
  id: string;
  admin_email: string;
  admin_name: string;
  is_active: boolean;
  frequency: string;
  send_hour: number;
  include_new_clients: boolean;
  include_status_changes: boolean;
  include_cancellations: boolean;
  include_holds: boolean;
  include_closures: boolean;
  filter_chapter: number | null;
  filter_states: string[];
  filter_from_date: string | null;
  last_sent_at: string | null;
}

interface StatusHistory {
  id: string;
  record_type: string;
  record_id: string;
  client_name: string;
  chapter: number | null;
  state: string | null;
  from_status: string | null;
  to_status: string;
  changed_by: string;
  changed_at: string;
  notes: string | null;
}

// ── Status label helpers ──────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  new:                      "New Lead",
  contacted:                "Contacted",
  consultation_scheduled:   "Consultation Scheduled",
  consultation_complete:    "Consultation Complete",
  intake_in_progress:       "Intake In Progress",
  intake_complete:          "Intake Complete",
  sent_for_attorney_review: "Sent for Attorney Review",
  attorney_accepted:        "Attorney Accepted",
  retained:                 "Retained",
  declined:                 "Declined",
  no_show:                  "No Show",
  cancelled:                "Cancelled",
  on_hold:                  "On Hold",
  closed:                   "Closed",
  filed:                    "Filed",
};

function label(s: string | null) { return s ? (STATUS_LABELS[s] ?? s) : "—"; }

const CANCEL_STATUSES = new Set(["declined", "no_show", "cancelled"]);
const HOLD_STATUSES   = new Set(["on_hold"]);
const CLOSE_STATUSES  = new Set(["closed", "filed"]);
const NEW_STATUSES    = new Set(["new", "contacted"]);

// ── Classify each event ───────────────────────────────────────────────────────

function classify(e: StatusHistory) {
  if (NEW_STATUSES.has(e.to_status) && !e.from_status) return "new_client";
  if (CANCEL_STATUSES.has(e.to_status)) return "cancellation";
  if (HOLD_STATUSES.has(e.to_status))   return "hold";
  if (CLOSE_STATUSES.has(e.to_status))  return "closure";
  return "status_change";
}

// ── Email builder ─────────────────────────────────────────────────────────────

function buildEmailHtml(
  sub: ReportSubscription,
  events: StatusHistory[],
  reportDate: string,
): string {
  const groups: Record<string, StatusHistory[]> = {
    new_client:    [],
    cancellation:  [],
    hold:          [],
    closure:       [],
    status_change: [],
  };

  for (const e of events) {
    const cat = classify(e);
    if (cat === "new_client"   && !sub.include_new_clients)     continue;
    if (cat === "cancellation" && !sub.include_cancellations)   continue;
    if (cat === "hold"         && !sub.include_holds)           continue;
    if (cat === "closure"      && !sub.include_closures)        continue;
    if (cat === "status_change" && !sub.include_status_changes) continue;
    groups[cat].push(e);
  }

  const total = Object.values(groups).reduce((s, g) => s + g.length, 0);

  function row(e: StatusHistory) {
    const time = new Date(e.changed_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    const ch   = e.chapter ? `Ch. ${e.chapter}` : "";
    const st   = e.state ?? "";
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #1e293b;font-weight:600;color:#f1f5f9">${e.client_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#94a3b8">${ch}${ch && st ? " · " : ""}${st}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#64748b">${label(e.from_status)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#38bdf8;font-weight:600">${label(e.to_status)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#64748b">${e.changed_by}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#475569">${time}</td>
    </tr>`;
  }

  function section(title: string, color: string, icon: string, items: StatusHistory[]) {
    if (items.length === 0) return "";
    return `
    <div style="margin-bottom:28px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:18px">${icon}</span>
        <h3 style="margin:0;font-size:13px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.08em">${title} (${items.length})</h3>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#0f172a;border:1px solid #1e293b;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#1e293b">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Client</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Chapter / State</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">From</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">To</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">By</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Time</th>
          </tr>
        </thead>
        <tbody>${items.map(row).join("")}</tbody>
      </table>
    </div>`;
  }

  const filterNote = [
    sub.filter_chapter ? `Chapter ${sub.filter_chapter} only` : null,
    sub.filter_states?.length ? `States: ${sub.filter_states.join(", ")}` : null,
    sub.filter_from_date ? `From ${sub.filter_from_date}` : null,
  ].filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#020817;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:700px;margin:0 auto;padding:32px 16px">

    <!-- Header -->
    <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:24px 28px;margin-bottom:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:18px;font-weight:800;color:#f59e0b;letter-spacing:-0.02em">MAJORSLAW<span style="color:#94a3b8">.ai</span></div>
          <div style="font-size:22px;font-weight:700;color:#f1f5f9;margin-top:4px">Daily Client Status Report</div>
          <div style="font-size:13px;color:#64748b;margin-top:2px">${reportDate} · For ${sub.admin_name}</div>
          ${filterNote ? `<div style="font-size:11px;color:#475569;margin-top:4px">Filters: ${filterNote}</div>` : ""}
        </div>
        <div style="text-align:right">
          <div style="font-size:36px;font-weight:800;color:#f1f5f9">${total}</div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em">Total Events</div>
        </div>
      </div>
    </div>

    <!-- Summary badges -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:28px">
      ${groups.new_client.length > 0    ? `<div style="background:#022c22;border:1px solid #064e3b;border-radius:8px;padding:10px 16px"><div style="font-size:20px;font-weight:800;color:#34d399">${groups.new_client.length}</div><div style="font-size:10px;color:#6ee7b7;text-transform:uppercase;font-weight:600">New Clients</div></div>` : ""}
      ${groups.status_change.length > 0 ? `<div style="background:#0c1a2e;border:1px solid #1e3a5f;border-radius:8px;padding:10px 16px"><div style="font-size:20px;font-weight:800;color:#38bdf8">${groups.status_change.length}</div><div style="font-size:10px;color:#7dd3fc;text-transform:uppercase;font-weight:600">Status Changes</div></div>` : ""}
      ${groups.cancellation.length > 0  ? `<div style="background:#1c0505;border:1px solid #450a0a;border-radius:8px;padding:10px 16px"><div style="font-size:20px;font-weight:800;color:#f87171">${groups.cancellation.length}</div><div style="font-size:10px;color:#fca5a5;text-transform:uppercase;font-weight:600">Cancellations</div></div>` : ""}
      ${groups.hold.length > 0          ? `<div style="background:#1c1505;border:1px solid #451a03;border-radius:8px;padding:10px 16px"><div style="font-size:20px;font-weight:800;color:#fbbf24">${groups.hold.length}</div><div style="font-size:10px;color:#fde68a;text-transform:uppercase;font-weight:600">On Hold</div></div>` : ""}
      ${groups.closure.length > 0       ? `<div style="background:#0a0a1a;border:1px solid #1e1b4b;border-radius:8px;padding:10px 16px"><div style="font-size:20px;font-weight:800;color:#a78bfa">${groups.closure.length}</div><div style="font-size:10px;color:#c4b5fd;text-transform:uppercase;font-weight:600">Closures / Filed</div></div>` : ""}
      ${total === 0 ? `<div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:10px 16px;color:#475569;font-size:13px">No qualifying events in this period.</div>` : ""}
    </div>

    <!-- Sections -->
    ${section("New Clients",       "#34d399", "🟢", groups.new_client)}
    ${section("Status Changes",    "#38bdf8", "🔄", groups.status_change)}
    ${section("Cancellations",     "#f87171", "🔴", groups.cancellation)}
    ${section("On Hold",           "#fbbf24", "⏸️",  groups.hold)}
    ${section("Closures / Filed",  "#a78bfa", "✅", groups.closure)}

    <!-- Footer -->
    <div style="border-top:1px solid #1e293b;padding-top:20px;margin-top:8px">
      <p style="font-size:11px;color:#334155;margin:0">
        This report was generated automatically by MAJORSLAW.ai.
        To adjust your report preferences, visit the Staff Hub → Reports tab.
        To unsubscribe, contact your system administrator.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ── Send via Resend ───────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[daily-status-report] No RESEND_API_KEY — would send to ${to}: ${subject}`);
    return true; // treat as success in demo mode
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "MAJORSLAW.ai Reports <reports@majorslaw.ai>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!r.ok) {
    console.error("[daily-status-report] Resend error:", await r.text());
    return false;
  }
  return true;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Accepts POST with optional { subscription_id, force } to run a single sub immediately
    // Or GET with no body to run all due subscriptions (called by cron)
    let forceSubId: string | null = null;
    let forceAll = false;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      forceSubId = body.subscription_id ?? null;
      forceAll   = body.force_all === true;
    } else {
      forceAll = true;
    }

    const today     = new Date();
    const todayStr  = today.toISOString().slice(0, 10);
    const nowHour   = today.getUTCHours();
    const reportDate = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    // Load subscriptions
    const allSubs: ReportSubscription[] = await db.get("report_subscriptions?is_active=eq.true&order=created_at.asc");

    const subsToRun = forceSubId
      ? allSubs.filter(s => s.id === forceSubId)
      : forceAll
        ? allSubs
        : allSubs.filter(s => {
            if (s.frequency === "daily" && s.send_hour === nowHour) return true;
            if (s.frequency === "weekly") {
              // Send on Monday (day 1) at configured hour
              return today.getUTCDay() === 1 && s.send_hour === nowHour;
            }
            return false;
          });

    if (subsToRun.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No subscriptions due", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let failed = 0;

    for (const sub of subsToRun) {
      // Build query for status history
      const sinceDate = sub.filter_from_date ?? todayStr;
      let path = `client_status_history?changed_at=gte.${sinceDate}T00:00:00Z&order=changed_at.asc&limit=500`;
      if (sub.filter_chapter) path += `&chapter=eq.${sub.filter_chapter}`;
      // State filter applied client-side (jsonb filter is cumbersome via REST)

      const events: StatusHistory[] = await db.get(path);

      // Apply state filter if set
      const filtered = sub.filter_states?.length
        ? events.filter(e => sub.filter_states.includes(e.state ?? ""))
        : events;

      const html    = buildEmailHtml(sub, filtered, reportDate);
      const subject = `Client Status Report — ${reportDate} — ${filtered.length} event${filtered.length !== 1 ? "s" : ""}`;

      const ok = await sendEmail(sub.admin_email, subject, html);

      // Log send
      await db.post("report_send_log", {
        subscription_id: sub.id,
        sent_at:         new Date().toISOString(),
        status:          ok ? "sent" : "failed",
        event_count:     filtered.length,
        error_message:   ok ? null : "Resend delivery failed",
      });

      // Update last_sent_at
      await db.patch("report_subscriptions", sub.id, {
        last_sent_at: new Date().toISOString(),
      });

      if (ok) sent++; else failed++;
    }

    return new Response(JSON.stringify({ ok: true, sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[daily-status-report] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
