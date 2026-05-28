// V1 — "Download Full File" button widget.
//
// One click → invokes the generate-client-zip edge function, waits 30-60s
// for assembly, then either auto-triggers the browser download (when the
// signed URL comes back) or surfaces an error. Shows a small history of
// recent exports for the client.

import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, AlertTriangle, CheckCircle2, Archive } from 'lucide-react';
import { supabase } from '../lib/supabase';

const MLG_FIRM_ID = '00000000-0000-0000-0000-000000000001';

interface Props {
  clientId: string;
  firmId?: string;
}

interface ExportHistoryRow {
  id: string;
  requested_at: string;
  completed_at: string | null;
  file_count: number | null;
  total_size_bytes: number | null;
  expires_at: string | null;
  storage_path: string | null;
  error: string | null;
}

export default function ClientZipDownloadButton({ clientId, firmId = MLG_FIRM_ID }: Props) {
  const [building, setBuilding] = useState(false);
  const [toast, setToast]       = useState<string | null>(null);
  const [err, setErr]           = useState<string | null>(null);
  const [history, setHistory]   = useState<ExportHistoryRow[]>([]);

  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from('client_zip_exports')
      .select('id, requested_at, completed_at, file_count, total_size_bytes, expires_at, storage_path, error')
      .eq('client_id', clientId)
      .order('requested_at', { ascending: false })
      .limit(5);
    if (!error) setHistory((data ?? []) as ExportHistoryRow[]);
  }, [clientId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function build() {
    setBuilding(true);
    setErr(null);
    setToast(null);
    try {
      const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL as string;
      const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const r = await fetch(`${SUPABASE_URL}/functions/v1/generate-client-zip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({ client_id: clientId, firm_id: firmId }),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`generate-client-zip failed: ${txt}`);
      }
      const result = await r.json() as { signed_url?: string; file_count?: number };
      if (result.signed_url) {
        window.location.assign(result.signed_url);
        setToast(`ZIP exported (${result.file_count ?? '?'} files). Available for 24 hours.`);
      } else {
        setToast('ZIP exported. Open the row below to download.');
      }
      loadHistory();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setErr(message);
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="bg-[#0d1221] border border-sky-500/20 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 bg-sky-500/5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
          <Archive className="w-4 h-4 text-sky-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white">Download Full File</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            One ZIP containing every document grouped by phase, plus BCI export + manifest.csv. Link expires in 24 hours.
          </p>
        </div>
        <button
          onClick={build}
          disabled={building}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-lg"
        >
          {building ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {building ? 'Building ZIP…' : 'Download Full File'}
        </button>
      </div>

      <div className="px-5 py-4 space-y-3">
        {building && (
          <p className="text-[11px] text-slate-400">Building ZIP… this may take 30–60 seconds for a full file.</p>
        )}
        {toast && (
          <div className="bg-emerald-500/8 border border-emerald-500/25 rounded-xl px-3 py-2 text-xs text-emerald-300 flex items-start gap-2.5">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {toast}
          </div>
        )}
        {err && (
          <div className="bg-red-500/8 border border-red-500/25 rounded-xl px-3 py-2 text-xs text-red-300 break-all flex items-start gap-2.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {err}
          </div>
        )}

        {history.length === 0 ? (
          <p className="text-[11px] text-slate-600">No exports for this client yet.</p>
        ) : (
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2">Recent exports</p>
            <div className="space-y-1.5">
              {history.map(h => (
                <div key={h.id} className="flex items-center justify-between gap-3 bg-slate-800/30 border border-slate-700/60 rounded-xl px-3.5 py-2 text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    {h.error ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    ) : h.completed_at ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 animate-spin" />
                    )}
                    <span className="text-slate-300 truncate">
                      {h.completed_at ? (
                        <>
                          {h.file_count ?? '?'} files · {formatBytes(h.total_size_bytes ?? 0)}
                          {h.expires_at && (
                            <span className="text-slate-600 ml-1">
                              · expires {new Date(h.expires_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                          )}
                        </>
                      ) : h.error ? (
                        <span className="text-red-400">{h.error}</span>
                      ) : (
                        <span className="text-amber-400">Building…</span>
                      )}
                    </span>
                  </div>
                  <span className="text-slate-600 flex-shrink-0">
                    {new Date(h.requested_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024)        return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3)   return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
