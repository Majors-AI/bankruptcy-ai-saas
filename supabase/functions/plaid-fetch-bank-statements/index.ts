// V1 — Pull 90 days of Plaid transactions, materialize as a simple PDF
// statement, save to Supabase Storage, then INSERT one client_documents
// row per institution with phase='03-credit-bank'.
//
// V1 deliberately emits a minimal plain-text PDF (one PDF per institution)
// so the file is openable and routes into the file cabinet correctly. V1.1
// upgrades this to a formatted statement with running balance + transaction
// table.
//
// Input:  { plaid_item_row_id: uuid }
// Output: { documents_inserted: number, file_count: number }

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

interface PlaidItemRow {
  id: string;
  client_id: string;
  firm_id: string;
  plaid_access_token: string;
  institution_name: string | null;
}

interface PlaidTxn {
  date: string;
  name: string;
  amount: number;
  account_id: string;
}

interface PlaidAccount {
  account_id: string;
  name: string;
  mask: string | null;
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

    const { plaid_item_row_id } = await req.json() as { plaid_item_row_id: string };
    if (!plaid_item_row_id) return json({ error: "plaid_item_row_id is required" }, 400);

    // Load the plaid_items row.
    const itemRes = await fetch(
      `${SUPABASE_URL}/rest/v1/plaid_items?id=eq.${plaid_item_row_id}&select=id,client_id,firm_id,plaid_access_token,institution_name&limit=1`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      },
    );
    if (!itemRes.ok) return json({ error: `plaid_items lookup failed: ${await itemRes.text()}` }, 500);
    const items = await itemRes.json() as PlaidItemRow[];
    if (items.length === 0) return json({ error: "plaid_item not found" }, 404);
    const item = items[0];

    // Pull last 90 days of transactions.
    const end = new Date();
    const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const txnRes = await fetch(`${host}/transactions/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id:    PLAID_CLIENT_ID,
        secret:       PLAID_SECRET,
        access_token: item.plaid_access_token,
        start_date:   start.toISOString().slice(0, 10),
        end_date:     end.toISOString().slice(0, 10),
        options:      { count: 500 },
      }),
    });
    if (!txnRes.ok) return json({ error: `Plaid transactions/get failed: ${await txnRes.text()}` }, 502);
    const txnData = await txnRes.json() as { accounts: PlaidAccount[]; transactions: PlaidTxn[] };

    let documentsInserted = 0;
    for (const account of txnData.accounts) {
      const accountTxns = txnData.transactions.filter(t => t.account_id === account.account_id);
      const pdfBytes = buildSimplePdf(buildStatementText({
        institutionName: item.institution_name ?? 'Bank',
        account, txns: accountTxns, start, end,
      }));

      const fileName = `${(item.institution_name ?? 'bank').replace(/[^a-zA-Z0-9._-]/g, '_')}_${account.mask ?? account.account_id.slice(0, 4)}_${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}.pdf`;
      const storagePath = `${item.client_id}/plaid/${item.id}/${fileName}`;

      // Upload to client-documents bucket (matches existing manual-upload writes).
      const upRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/client-documents/${storagePath}`,
        {
          method: "POST",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/pdf",
            "x-upsert": "true",
          },
          body: pdfBytes,
        },
      );
      if (!upRes.ok) {
        console.warn(`[plaid-fetch-bank-statements] upload failed for ${storagePath}`, await upRes.text());
        continue;
      }

      const insRes = await fetch(`${SUPABASE_URL}/rest/v1/client_documents`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          client_id:        item.client_id,
          document_type:    "bank_stmt_plaid",
          document_category:"bank_statements",
          storage_path:     storagePath,
          original_filename: fileName,
          mime_type:        "application/pdf",
          ai_verified:      false,
          ai_note:          `Auto-generated from Plaid (90 days). Account: ${account.name} ····${account.mask ?? '?'}`,
          phase:            "03-credit-bank",
        }),
      });
      if (insRes.ok) documentsInserted++;
    }

    // Stamp last_sync_at.
    await fetch(`${SUPABASE_URL}/rest/v1/plaid_items?id=eq.${item.id}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ last_sync_at: new Date().toISOString(), last_sync_error: null }),
    });

    return json({ documents_inserted: documentsInserted, file_count: txnData.accounts.length }, 200);
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

function buildStatementText(opts: {
  institutionName: string;
  account: PlaidAccount;
  txns: PlaidTxn[];
  start: Date;
  end: Date;
}): string {
  const lines: string[] = [];
  lines.push(`${opts.institutionName} — Statement`);
  lines.push(`Account: ${opts.account.name} ····${opts.account.mask ?? '?'}`);
  lines.push(`Period: ${opts.start.toISOString().slice(0,10)} to ${opts.end.toISOString().slice(0,10)}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('Date       Description                                                   Amount');
  lines.push('---------- ------------------------------------------------------------- -----------');
  for (const t of opts.txns) {
    const desc = (t.name ?? '').slice(0, 60).padEnd(60, ' ');
    const amt = (t.amount >= 0 ? '-' : '+') + Math.abs(t.amount).toFixed(2).padStart(8, ' ');
    lines.push(`${t.date}  ${desc}  ${amt}`);
  }
  lines.push('');
  lines.push(`Total transactions: ${opts.txns.length}`);
  lines.push('');
  lines.push('Generated by bankruptcy.ai via Plaid. This statement is an aggregated view of');
  lines.push('the source data Plaid returned for the connected account. Reconcile against');
  lines.push('the original institution statement before filing.');
  return lines.join('\n');
}

// Tiny self-contained PDF writer — produces a single-page PDF containing the
// given plain text. V1 prioritizes "file exists and opens" over typography;
// V1.1 swaps this for a real table layout.
function buildSimplePdf(text: string): Uint8Array {
  const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const lines = escaped.split('\n');
  const contentStream =
    'BT /F1 9 Tf 36 756 Td 11 TL\n' +
    lines.map((l, i) => (i === 0 ? `(${l}) Tj` : `T* (${l}) Tj`)).join('\n') +
    '\nET';

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${new TextEncoder().encode(contentStream).length} >>\nstream\n${contentStream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
  ];

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = body.length;
  body += 'xref\n';
  body += `0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (const off of offsets) {
    body += `${off.toString().padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(body);
}
