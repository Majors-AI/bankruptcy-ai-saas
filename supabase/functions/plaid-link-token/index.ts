// V1 — Plaid Link token creator.
//
// Input:  { client_id: uuid, products?: string[] }
//   products defaults to ['transactions'] for the Bank flow; pass ['income']
//   for the Payroll flow.
//
// Output: { link_token, expiration }
//
// Required env vars (set via supabase secrets set):
//   PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV (sandbox|development|production)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PLAID_HOSTS: Record<string, string> = {
  sandbox:     'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production:  'https://production.plaid.com',
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID");
    const PLAID_SECRET    = Deno.env.get("PLAID_SECRET");
    const PLAID_ENV       = (Deno.env.get("PLAID_ENV") ?? 'sandbox').toLowerCase();
    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      return json({ error: "PLAID_CLIENT_ID and PLAID_SECRET env vars are required" }, 500);
    }
    const host = PLAID_HOSTS[PLAID_ENV];
    if (!host) {
      return json({ error: `Invalid PLAID_ENV=${PLAID_ENV}` }, 500);
    }

    const { client_id, products } = await req.json() as { client_id: string; products?: string[] };
    if (!client_id) return json({ error: "client_id is required" }, 400);
    const requestedProducts = (products && products.length > 0) ? products : ['transactions'];

    const linkRes = await fetch(`${host}/link/token/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id:    PLAID_CLIENT_ID,
        secret:       PLAID_SECRET,
        client_name:  "bankruptcy.ai",
        language:     "en",
        country_codes:["US"],
        user:         { client_user_id: client_id },
        products:     requestedProducts,
      }),
    });
    if (!linkRes.ok) {
      const txt = await linkRes.text();
      return json({ error: `Plaid link token failed: ${txt}` }, 502);
    }
    const data = await linkRes.json();
    return json({ link_token: data.link_token, expiration: data.expiration }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
