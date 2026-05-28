// V1 — Plaid Income retrieval.
//
// Input:  { plaid_item_row_id: uuid }
// Output: { documents_inserted: number }
//
// Calls /credit/payroll_income/get for the Plaid Item, materializes a
// summary PDF per employer, saves to client_documents with
// phase='03-credit-bank'. The questionnaire's income section reads these
// documents for paystub upload satisfaction.

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

interface PlaidPaystubItem {
  pay_period_details?: { start_date?: string; end_date?: string; pay_date?: string };
  earnings?: { total?: { current_amount?: number; rate?: number } };
  employer?: { name?: string };
  employee?: { name?: { full_name?: string } };
}

interface PlaidIncomeAccount {
  paystubs?: PlaidPaystubItem[];
  w2s?: Array<{ employer?: { name?: string }; tax_year?: string; box_1?: number; box_3?: number; box_5?: number }>;
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

    const itemRes = await fetch(
      `${SUPABASE_URL}/rest/v1/plaid_items?id=eq.${plaid_item_row_id}&select=id,client_id,firm_id,plaid_access_token,institution_name&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    if (!itemRes.ok) return json({ error: `plaid_items lookup failed: ${await itemRes.text()}` }, 500);
    const items = await itemRes.json() as PlaidItemRow[];
    if (items.length === 0) return json({ error: "plaid_item not found" }, 404);
    const item = items[0];

    // Plaid's credit/payroll_income/get returns paystubs + W2 data when the
    // user has connected a payroll provider. In sandbox, simulated data is
    // returned for the test institution.
    const incomeRes = await fetch(`${host}/credit/payroll_income/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id:    PLAID_CLIENT_ID,
        secret:       PLAID_SECRET,
        access_token: item.plaid_access_token,
      }),
    });
    if (!incomeRes.ok) {
      const txt = await incomeRes.text();
      // Don't fail loudly — record the sync error and return 0 docs so the
      // caller can present a helpful message.
      await fetch(`${SUPABASE_URL}/rest/v1/plaid_items?id=eq.${item.id}`, {
        method: "PATCH",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ last_sync_at: new Date().toISOString(), last_sync_error: txt.slice(0, 1000) }),
      });
      return json({ documents_inserted: 0, error: `Plaid income fetch failed: ${txt}` }, 200);
    }
    const data = await incomeRes.json() as { accounts?: PlaidIncomeAccount[] };

    let documentsInserted = 0;
    const accounts = data.accounts ?? [];
    for (let i = 0; i < accounts.length; i++) {
      const acct = accounts[i];
      const paystubs = acct.paystubs ?? [];
      const w2s      = acct.w2s ?? [];
      if (paystubs.length === 0 && w2s.length === 0) continue;

      const summary = buildIncomeSummaryText({ paystubs, w2s, accountIndex: i });
      const pdfBytes = buildSimplePdf(summary);
      const employerName = paystubs[0]?.employer?.name ?? w2s[0]?.employer?.name ?? 'Employer';
      const fileName = `plaid_income_${employerName.replace(/[^a-zA-Z0-9._-]/g, '_')}_${i}.pdf`;
      const storagePath = `${item.client_id}/plaid_income/${item.id}/${fileName}`;

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
      if (!upRes.ok) continue;

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
          document_type:    "plaid_income_summary",
          document_category:"income",
          storage_path:     storagePath,
          original_filename: fileName,
          mime_type:        "application/pdf",
          ai_verified:      false,
          ai_note:          `Plaid Income — ${paystubs.length} paystubs, ${w2s.length} W-2s for ${employerName}`,
          phase:            "03-credit-bank",
        }),
      });
      if (insRes.ok) documentsInserted++;
    }

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

    return json({ documents_inserted: documentsInserted }, 200);
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

function buildIncomeSummaryText(opts: {
  paystubs: PlaidPaystubItem[];
  w2s: Array<{ employer?: { name?: string }; tax_year?: string; box_1?: number; box_3?: number; box_5?: number }>;
  accountIndex: number;
}): string {
  const lines: string[] = [];
  lines.push(`Plaid Income Summary — Account #${opts.accountIndex + 1}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Paystubs returned: ${opts.paystubs.length}`);
  for (const p of opts.paystubs) {
    const period = p.pay_period_details;
    const earn = p.earnings?.total?.current_amount;
    lines.push(`  - ${period?.pay_date ?? '?'} (${period?.start_date ?? '?'} → ${period?.end_date ?? '?'}) — ${earn != null ? '$' + earn.toFixed(2) : '?'}`);
  }
  lines.push('');
  lines.push(`W-2s returned: ${opts.w2s.length}`);
  for (const w of opts.w2s) {
    lines.push(`  - ${w.employer?.name ?? '?'} · ${w.tax_year ?? '?'} · Box 1: ${w.box_1 ?? '?'}, Box 3: ${w.box_3 ?? '?'}, Box 5: ${w.box_5 ?? '?'}`);
  }
  lines.push('');
  lines.push('Generated by bankruptcy.ai via Plaid Income. Verify against original');
  lines.push('payroll documents before filing.');
  return lines.join('\n');
}

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
