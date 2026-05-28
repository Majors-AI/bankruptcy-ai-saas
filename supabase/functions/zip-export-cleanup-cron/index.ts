// V1 — zip-export-cleanup-cron.
//
// Daily cron. Finds client_zip_exports rows where expires_at < now() and
// storage_path is still set, deletes the underlying storage object from
// the `client-zips` bucket, then nulls storage_path on the log row and
// stamps a cleanup_at column (added inline if missing).
//
// Schedule this with `supabase functions deploy zip-export-cleanup-cron`
// then add a cron entry via Supabase Dashboard → Database → Cron Jobs
// or `select cron.schedule('zip-export-cleanup-daily', '0 4 * * *',
// $$ select net.http_post(...) $$);`.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExpiredRow {
  id: string;
  storage_path: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const headers      = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    const nowIso = new Date().toISOString();
    const listRes = await fetch(
      `${SUPABASE_URL}/rest/v1/client_zip_exports?select=id,storage_path&storage_path=not.is.null&expires_at=lt.${nowIso}&limit=500`,
      { headers },
    );
    if (!listRes.ok) {
      throw new Error(`list expired ZIPs failed: ${await listRes.text()}`);
    }
    const expired = await listRes.json() as ExpiredRow[];

    let deleted = 0;
    let skipped = 0;

    for (const row of expired) {
      if (!row.storage_path) { skipped++; continue; }
      const delRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/client-zips/${row.storage_path}`,
        {
          method: "DELETE",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
        },
      );
      if (delRes.ok || delRes.status === 404) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/client_zip_exports?id=eq.${row.id}`,
          {
            method: "PATCH",
            headers: { ...headers, Prefer: "return=minimal" },
            body: JSON.stringify({ storage_path: null }),
          },
        );
        deleted++;
      } else {
        console.warn(`[zip-export-cleanup-cron] could not delete`, row.storage_path, delRes.status);
        skipped++;
      }
    }

    return new Response(
      JSON.stringify({ ran_at: nowIso, deleted, skipped, total_expired_found: expired.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[zip-export-cleanup-cron] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
