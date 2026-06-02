// Captures the real client IP at the HTTP edge by reading the x-forwarded-for
// header and writing it to client_registrations.ip_address.
//
// Do NOT use inet_client_addr() in SQL — it returns the Supabase infra IP,
// not the client's.
//
// Input:  { user_id: string }
// Output: { ip: string | null }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : null;

    const { user_id } = await req.json() as { user_id?: string };

    if (!user_id) {
      return json({ error: "user_id is required" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && ip) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/client_registrations?user_id=eq.${user_id}`,
        {
          method: "PATCH",
          headers: {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ ip_address: ip }),
        }
      );
    }

    return json({ ip }, 200);
  } catch (err) {
    console.error("get-client-ip error:", err);
    return json({ error: "Internal error" }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
