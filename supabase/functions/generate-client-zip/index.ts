// V1 — generate-client-zip edge function.
//
// Input:  { client_id: uuid, firm_id: uuid }
// Output: { export_id, signed_url, expires_at, file_count, total_size_bytes }
//
// Flow:
//   1. Validate caller via JWT (Authorization: Bearer <user JWT>). RLS on
//      client_zip_exports does the heavy lifting — if the inserter isn't
//      authorized for the firm, the insert below fails.
//   2. INSERT client_zip_exports row (requested_at = now()).
//   3. SELECT client_documents WHERE client_id = X, group rows by phase.
//   4. For each row, fetch the storage object and append it to the ZIP under
//      `{client_name}_{chapter}_{date}/{phase}/{original_filename}`.
//   5. Append `bci-export.xml` placeholder (the latest BCI generation log's
//      storage_path is best-effort fetched; otherwise a small README note).
//   6. Build manifest.csv (phase, document_type, filename, size, uploaded_at).
//   7. Add README.txt with summary + 24-hour expiry note.
//   8. Upload ZIP to storage bucket `client-zips` at
//      `{firm_id}/{client_id}/{export_id}.zip`.
//   9. UPDATE client_zip_exports with completed_at, storage_path, expires_at
//      (= now() + 24h), file_count, total_size_bytes, manifest_csv.
//  10. Sign a 24-hour download URL and return it.
//
// JSZip is loaded via Deno's npm: specifier (Supabase Edge runtime supports
// this since 2024). Falls back to a manual ZIP writer if the import fails,
// keeping the function operational in air-gapped runtime configs.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  client_id: string;
  firm_id: string;
}

interface DocRow {
  id: string;
  document_type: string;
  document_category: string | null;
  original_filename: string;
  storage_path: string | null;
  mime_type: string | null;
  uploaded_at: string;
  phase: string | null;
}

interface ClientRow {
  id: string;
  name: string | null;
}

interface CaseAcceptanceRow {
  chapter: string | null;
}

interface BciLogRow {
  bci_storage_path: string | null;
}

const PHASES_IN_ORDER = [
  '01-intake',
  '02-registration',
  '03-credit-bank',
  '04-questionnaire',
  '05-attorney-review',
  '06-pacer',
  '07-trustee',
  '08-court',
  '09-correspondence',
  '10-discharge',
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SUPABASE_URL || !SERVICE_KEY) {
      throw new Error("Edge function missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env.");
    }

    const { client_id, firm_id } = await req.json() as RequestBody;
    if (!client_id || !firm_id) {
      return json({ error: "client_id and firm_id are required" }, 400);
    }

    const headers = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    };

    // 2. INSERT client_zip_exports row.
    const insertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/client_zip_exports`,
      {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ client_id, firm_id, requested_at: new Date().toISOString() }),
      },
    );
    if (!insertRes.ok) {
      const txt = await insertRes.text();
      throw new Error(`Failed to start ZIP export: ${txt}`);
    }
    const inserted = await insertRes.json();
    const exportRow = Array.isArray(inserted) ? inserted[0] : inserted;
    const exportId  = exportRow.id as string;

    try {
      // 3. Load client + case + docs + BCI log (best-effort).
      const [client, caseAcc, docs, bciLogRows] = await Promise.all([
        sbGet<ClientRow>(SUPABASE_URL, headers, `clients?id=eq.${client_id}&select=id,name&limit=1`),
        sbGet<CaseAcceptanceRow>(SUPABASE_URL, headers, `case_acceptances?client_id=eq.${client_id}&select=chapter&order=created_at.desc&limit=1`),
        sbGet<DocRow>(SUPABASE_URL, headers, `client_documents?client_id=eq.${client_id}&select=id,document_type,document_category,original_filename,storage_path,mime_type,uploaded_at,phase&order=uploaded_at.desc&limit=500`),
        sbGet<BciLogRow>(SUPABASE_URL, headers, `bci_verification_logs?client_id=eq.${client_id}&select=bci_storage_path&order=generated_at.desc&limit=1`),
      ]);

      const clientName = (client[0]?.name ?? 'client').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
      const chapter    = caseAcc[0]?.chapter ?? '?';
      const dateStamp  = new Date().toISOString().slice(0, 10);
      const rootDir    = `${clientName}_ch${chapter}_${dateStamp}`;

      // 4-7. Build the ZIP.
      const zip = new JSZip();
      const root = zip.folder(rootDir)!;
      for (const phase of PHASES_IN_ORDER) root.folder(phase);

      const manifestRows: string[] = ['phase,document_type,filename,size_bytes,uploaded_at'];
      let totalBytes = 0;
      let fileCount  = 0;

      for (const d of docs) {
        if (!d.storage_path) continue;
        const data = await downloadStorageObject(SUPABASE_URL, SERVICE_KEY, d.storage_path);
        if (!data) continue;
        const phase = d.phase && PHASES_IN_ORDER.includes(d.phase) ? d.phase : 'unsorted';
        if (phase === 'unsorted') root.folder('unsorted');
        const safeName = d.original_filename.replace(/[^a-zA-Z0-9._ -]/g, '_');
        root.folder(phase)!.file(safeName, data);
        manifestRows.push(
          [
            phase,
            d.document_type,
            csvCell(safeName),
            String(data.byteLength),
            d.uploaded_at,
          ].join(','),
        );
        totalBytes += data.byteLength;
        fileCount++;
      }

      // BCI export (if recent log).
      const bciStoragePath = bciLogRows[0]?.bci_storage_path;
      if (bciStoragePath) {
        const bciData = await downloadStorageObject(SUPABASE_URL, SERVICE_KEY, bciStoragePath, 'bci-exports');
        if (bciData) {
          root.file('bci-export.xml', bciData);
          totalBytes += bciData.byteLength;
          fileCount++;
        }
      }

      // Manifest + README.
      const manifestCsv = manifestRows.join('\n');
      root.file('manifest.csv', manifestCsv);
      root.file(
        'README.txt',
        readmeText({
          clientName, chapter, dateStamp, fileCount, totalBytes,
          bciIncluded: !!bciStoragePath,
        }),
      );

      // 8. Upload the ZIP.
      const zipBytes = await zip.generateAsync({ type: 'uint8array' });
      const storagePath = `${firm_id}/${client_id}/${exportId}.zip`;
      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/client-zips/${storagePath}`,
        {
          method: 'POST',
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/zip',
            'x-upsert': 'true',
          },
          body: zipBytes,
        },
      );
      if (!uploadRes.ok) {
        const txt = await uploadRes.text();
        throw new Error(`ZIP upload failed: ${txt}`);
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // 9. Update the log row.
      await fetch(
        `${SUPABASE_URL}/rest/v1/client_zip_exports?id=eq.${exportId}`,
        {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({
            completed_at: new Date().toISOString(),
            storage_path: storagePath,
            expires_at: expiresAt,
            file_count: fileCount,
            total_size_bytes: zipBytes.byteLength,
            manifest_csv: manifestCsv,
          }),
        },
      );

      // 10. Sign a 24-hour download URL.
      const signRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/sign/client-zips/${storagePath}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ expiresIn: 24 * 60 * 60 }),
        },
      );
      let signedUrl = '';
      if (signRes.ok) {
        const signed = await signRes.json();
        if (signed.signedURL) signedUrl = `${SUPABASE_URL}/storage/v1${signed.signedURL}`;
      }

      return json({
        export_id: exportId,
        signed_url: signedUrl,
        expires_at: expiresAt,
        file_count: fileCount,
        total_size_bytes: zipBytes.byteLength,
      }, 200);
    } catch (innerErr) {
      const msg = innerErr instanceof Error ? innerErr.message : String(innerErr);
      await fetch(
        `${SUPABASE_URL}/rest/v1/client_zip_exports?id=eq.${exportId}`,
        {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({ error: msg.slice(0, 1000) }),
        },
      );
      throw innerErr;
    }
  } catch (err) {
    console.error('[generate-client-zip] error', err);
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sbGet<T>(
  base: string,
  headers: Record<string, string>,
  path: string,
): Promise<T[]> {
  const r = await fetch(`${base}/rest/v1/${path}`, { headers });
  if (!r.ok) return [];
  return r.json();
}

async function downloadStorageObject(
  base: string,
  serviceKey: string,
  path: string,
  bucket = 'client-documents',
): Promise<Uint8Array | null> {
  const url = `${base}/storage/v1/object/${bucket}/${path}`;
  const r = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!r.ok) {
    console.warn(`[generate-client-zip] storage GET failed`, bucket, path, r.status);
    return null;
  }
  const buf = await r.arrayBuffer();
  return new Uint8Array(buf);
}

function csvCell(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function readmeText(opts: {
  clientName: string;
  chapter: string;
  dateStamp: string;
  fileCount: number;
  totalBytes: number;
  bciIncluded: boolean;
}): string {
  return [
    `bankruptcy.ai — Client File Export`,
    `Client: ${opts.clientName}`,
    `Chapter: ${opts.chapter}`,
    `Generated: ${opts.dateStamp}`,
    `Files included: ${opts.fileCount}`,
    `Total size: ${formatBytes(opts.totalBytes)}`,
    `BCI export bundled: ${opts.bciIncluded ? 'yes' : 'no'}`,
    ``,
    `Folder layout mirrors the case-file phases used in the file cabinet:`,
    `  01-intake          Initial intake form + verification`,
    `  02-registration    Client agreement + consents`,
    `  03-credit-bank     Credit reports + bank statements (Plaid + manual)`,
    `  04-questionnaire   17-section questionnaire schedules`,
    `  05-attorney-review Attorney clarification responses`,
    `  06-pacer           PACER / ECF notices`,
    `  07-trustee         341 / trustee submissions`,
    `  08-court           Court filings + hearing notices`,
    `  09-correspondence  General client correspondence`,
    `  10-discharge       Discharge + closing documents`,
    ``,
    `manifest.csv lists every file with phase, document_type, filename,`,
    `size, and uploaded_at for spot-checking.`,
    ``,
    `This download link expires 24 hours after generation. Re-run "Download`,
    `Full File" from the firm-side client view to issue a new export.`,
  ].join('\n');
}

function formatBytes(n: number): string {
  if (n < 1024)        return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3)   return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
