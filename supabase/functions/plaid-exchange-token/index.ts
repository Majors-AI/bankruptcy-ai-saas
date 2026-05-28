// V1 — Plaid public-token → access-token exchange.
//
// Input:  { client_id, firm_id, public_token, product, institution? }
// Output: { plaid_item_id, item_row_id }
//
// Stores plaid_item_id + plaid_access_token in plaid_items. The access token
// is long-lived for V1 (per Plaid's normal Item lifecycle); rotation to
// KMS-encrypted storage is V1.1.

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

interface ExchangeBody {
  client_id: string;
  firm_id: string;
  public_token: string;
  product: 'auth' | 'transactions' | 'income';
  institution?: { id: string; name: string };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID");
    const PLAID_SECRET    = Deno.env.get("PLAID_SECRET");
    const PLAID_ENV       = (Deno.env.get("PLAID_ENV") ?? 'sandbox').toLowerCase();
    const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const host            = PLAID_HOSTS[PLAID_ENV];
    if (!PLAID_CLIENT_ID || !PLAID_SECRET || !host) {
      return json({ error: "Plaid env vars missing or invalid" }, 500);
    }

    const body = await req.json() as ExchangeBody;
    if (!body.client_id || !body.firm_id || !body.public_token) {
      return json({ error: "client_id, firm_id, and public_token are required" }, 400);
    }

    const exchRes = await fetch(`${host}/item/public_token/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id:    PLAID_CLIENT_ID,
        secret:       PLAID_SECRET,
        public_token: body.public_token,
      }),
    });
    if (!exchRes.ok) {
      const txt = await exchRes.text();
      return json({ error: `Plaid exchange failed: ${txt}` }, 502);
    }
    const data = await exchRes.json();

    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/plaid_items`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        client_id:          body.client_id,
        firm_id:            body.firm_id,
        plaid_item_id:      data.item_id,
        plaid_access_token: data.access_token,
        institution_id:     body.institution?.id ?? null,
        institution_name:   body.institution?.name ?? null,
        product:            body.product,
      }),
    });
    if (!insRes.ok) {
      const txt = await insRes.text();
      return json({ error: `plaid_items insert failed: ${txt}` }, 500);
    }
    const inserted = await insRes.json();
    const row = Array.isArray(inserted) ? inserted[0] : inserted;
    return json({ plaid_item_id: data.item_id, item_row_id: row.id }, 200);
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
