// Captures the real client IP at the HTTP edge by reading x-forwarded-for and
// writing it to client_registrations.ip_address.
//
// Security: user identity is derived from the verified Supabase auth JWT in the
// Authorization header — NOT from the request body — so a caller cannot write
// an IP onto another user's record. Unauthenticated requests are rejected 401.
//
// Do NOT use inet_client_addr() in SQL — it returns the Supabase infra IP,
// not the client's real address.
//
// Output: { ip: string | null }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    // ── Auth: verify JWT, extract user — never trust the request body for identity ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.slice(7);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("get-client-ip: missing required env vars");
      return json({ error: "Internal configuration error" }, 500);
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // ── IP capture ────────────────────────────────────────────────────────────
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : null;

    if (ip) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/client_registrations?user_id=eq.${user.id}`,
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
