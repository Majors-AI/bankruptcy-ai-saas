// V1 — BCI export verification + .bci download widget.
//
// Mounts in FileCabinet's per-client docs tab. Click "Generate BCI Test File"
// to:
//   1. Load the client's questionnaire data (from intake_submissions or the
//      questionnaire-side store — read paths abstracted into loadQuestionnaireData).
//   2. Call validateBci(data) → result with populated count + missing required +
//      missing optional.
//   3. Show a modal: populated stat, blocking-required gaps (red), optional gaps
//      (yellow), and a "Download .bci File" button (disabled while blocking, with
//      an explicit override "Download Anyway").
//   4. On download: build XML via generateBciXml (re-implemented here to avoid
//      pulling the entire questionnaire .jsx into this module), upload to Supabase
//      Storage at bci-exports/{firm_id}/{client_id}/{timestamp}.bci, INSERT a
//      bci_verification_logs row, and trigger the browser download.
//
// The XML is intentionally minimal — Best Case 25.1 reads any well-formed BCI
// envelope. As MLG/Neeley import test results come in we expand the field
// list and document gaps in docs/BCI_FIELD_GAPS.md.

import { useCallback, useEffect, useState } from 'react';
import { Download, AlertTriangle, CheckCircle2, RefreshCw, FileText, Scale, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validateBci, type BciValidationResult } from '../lib/bciValidator';

const MLG_FIRM_ID = '00000000-0000-0000-0000-000000000001';

interface Props {
  clientId: string;
  clientName?: string;
  firmId?: string;
}

interface Snapshot {
  data: Record<string, unknown>;
  validation: BciValidationResult;
}

export default function BciExportWidget({
  clientId,
  clientName = 'Client',
  firmId = MLG_FIRM_ID,
}: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [override, setOverride] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; generated_at: string; populated_fields_count: number | null; missing_required_fields: unknown; file_size_bytes: number | null }>>([]);

  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from('bci_verification_logs')
      .select('id, generated_at, populated_fields_count, missing_required_fields, file_size_bytes')
      .eq('client_id', clientId)
      .order('generated_at', { ascending: false })
      .limit(5);
    if (!error) setHistory((data ?? []) as typeof history);
  }, [clientId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // V1: pull whatever the questionnaire layer has saved for this client.
  // Sources tried in order:
  //   1. bankruptcy_questionnaire_submissions (newer FullBankruptcyQuestionnaire)
  //   2. intake_submissions (joined via clients.intake_id)
  // Returns the most-complete object available — both shapes have already
  // been normalized by normalizeIntake() at insert/read time.
  async function loadQuestionnaireData(): Promise<Record<string, unknown>> {
    // Try the post-acceptance questionnaire store first.
    const qRes = await supabase
      .from('bankruptcy_questionnaire_submissions')
      .select('data')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (qRes.data && (qRes.data as { data?: unknown }).data) {
      return ((qRes.data as { data: Record<string, unknown> }).data) ?? {};
    }
    // Fall back to intake_submissions via clients.intake_id.
    const cRes = await supabase
      .from('clients')
      .select('intake_id')
      .eq('id', clientId)
      .maybeSingle();
    const intakeId = (cRes.data as { intake_id?: string } | null)?.intake_id;
    if (intakeId) {
      const iRes = await supabase
        .from('intake_submissions')
        .select('*')
        .eq('id', intakeId)
        .maybeSingle();
      if (iRes.data) return iRes.data as Record<string, unknown>;
    }
    return {};
  }

  async function generate() {
    setErr(null);
    setGenerating(true);
    setOverride(false);
    try {
      const data = await loadQuestionnaireData();
      const validation = validateBci(data);
      setSnapshot({ data, validation });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setErr(message);
    } finally {
      setGenerating(false);
    }
  }

  async function download() {
    if (!snapshot) return;
    setErr(null);
    setDownloading(true);
    try {
      const xml = generateBciXml(snapshot.data, clientName);
      const blob = new Blob([xml], { type: 'application/xml' });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const storagePath = `${firmId}/${clientId}/${ts}.bci`;

      // Upload to Supabase Storage (bci-exports bucket — created out-of-band).
      const upRes = await supabase.storage
        .from('bci-exports')
        .upload(storagePath, blob, { contentType: 'application/xml', upsert: false });
      const storedPath = upRes.error ? null : storagePath;
      if (upRes.error) {
        console.warn('[BciExportWidget] storage upload failed, continuing with browser download', upRes.error);
      }

      // Log verification regardless of upload success.
      await supabase.from('bci_verification_logs').insert({
        client_id: clientId,
        firm_id: firmId,
        populated_fields_count: snapshot.validation.populated_count,
        missing_required_fields: snapshot.validation.missing_required,
        missing_optional_fields: snapshot.validation.missing_optional,
        bci_storage_path: storedPath,
        file_size_bytes: blob.size,
      });

      // Trigger browser download.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitizeFilename(clientName)}_${ts}.bci`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      loadHistory();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setErr(message);
    } finally {
      setDownloading(false);
    }
  }

  const blocking = snapshot?.validation.blocking ?? false;
  const canDownload = snapshot != null && (!blocking || override);

  return (
    <>
      <div className="bg-[#0d1221] border border-purple-500/20 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 bg-purple-500/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
            <Scale className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white">BCI Export Test</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Generate a <code className="text-slate-400">.bci</code> file for Best Case 25.1 import. Validates required fields first.
            </p>
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-lg"
          >
            {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {generating ? 'Validating…' : 'Generate BCI Test File'}
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {err && (
            <div className="bg-red-500/8 border border-red-500/25 rounded-xl px-3 py-2 text-xs text-red-300 break-all">
              {err}
            </div>
          )}

          {history.length === 0 ? (
            <p className="text-[11px] text-slate-600">No BCI test files generated yet for this client.</p>
          ) : (
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2">Recent verifications</p>
              <div className="space-y-1.5">
                {history.map(h => {
                  const missing = Array.isArray(h.missing_required_fields) ? (h.missing_required_fields as unknown[]).length : 0;
                  return (
                    <div key={h.id} className="flex items-center justify-between gap-3 bg-slate-800/30 border border-slate-700/60 rounded-xl px-3.5 py-2 text-[11px]">
                      <div className="flex items-center gap-2">
                        {missing === 0 ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span className="text-slate-300">
                          {h.populated_fields_count ?? '?'} populated
                          {missing > 0 && <span className="text-amber-400 ml-1">· {missing} blocking</span>}
                        </span>
                      </div>
                      <span className="text-slate-600">
                        {new Date(h.generated_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {snapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm" onClick={() => setSnapshot(null)}>
          <div
            className="w-full max-w-2xl bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white">BCI Verification — {clientName}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {snapshot.validation.populated_count} field{snapshot.validation.populated_count === 1 ? '' : 's'} populated
                  {' · '}
                  {snapshot.validation.missing_required.length} blocking gap{snapshot.validation.missing_required.length === 1 ? '' : 's'}
                  {' · '}
                  {snapshot.validation.missing_optional.length} optional gap{snapshot.validation.missing_optional.length === 1 ? '' : 's'}
                </p>
              </div>
              <button onClick={() => setSnapshot(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {blocking ? (
                <div className="bg-red-500/8 border border-red-500/25 rounded-xl px-3.5 py-3 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-red-300">Blocking gaps — Best Case import will fail or be incomplete</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Resolve the items below before final download, or use "Download Anyway" to capture the partial file for diagnostics.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-500/8 border border-emerald-500/25 rounded-xl px-3.5 py-3 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-emerald-300">No blocking gaps</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Required fields are populated. Best Case 25.1 import should succeed.</p>
                  </div>
                </div>
              )}

              {snapshot.validation.missing_required.length > 0 && (
                <section>
                  <p className="text-xs font-bold text-red-300 mb-2">Required (blocking)</p>
                  <ul className="space-y-1.5">
                    {snapshot.validation.missing_required.map((m, i) => (
                      <li key={i} className="bg-red-500/5 border border-red-500/15 rounded-xl px-3 py-2 text-[11px]">
                        <p className="font-mono text-red-300">{m.field}</p>
                        <p className="text-slate-500 mt-0.5">{m.schedule} · {m.reason}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {snapshot.validation.missing_optional.length > 0 && (
                <section>
                  <p className="text-xs font-bold text-amber-300 mb-2">Optional (warnings)</p>
                  <ul className="space-y-1.5">
                    {snapshot.validation.missing_optional.map((m, i) => (
                      <li key={i} className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-2 text-[11px]">
                        <p className="font-mono text-amber-300">{m.field}</p>
                        <p className="text-slate-600 mt-0.5">{m.schedule}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {blocking && (
                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} />
                  Download Anyway (diagnostic — file will be incomplete)
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-800 flex-shrink-0">
              <button onClick={() => setSnapshot(null)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white">
                Cancel
              </button>
              <button
                onClick={download}
                disabled={!canDownload || downloading}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-lg"
              >
                {downloading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {downloading ? 'Building…' : 'Download .bci File'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60) || 'client';
}

// Minimal BCI 25.1 envelope. The questionnaire .jsx has a much richer
// generator (`generateBCI(d)` ~L2075) that this V1 widget cannot import
// directly (the file is 18k lines of JSX and pulls in pdfjs-dist). For V1
// we generate a compact valid envelope from the validated fields. As
// docs/BCI_FIELD_GAPS.md grows, expand this template.
function generateBciXml(d: Record<string, unknown>, clientName: string): string {
  const ts = new Date().toISOString();
  const caseInfo = (d.CaseInfo as Record<string, unknown> | undefined) ?? {};
  const addr = (caseInfo.ResidentialAddress as Record<string, unknown> | undefined) ?? {};
  const meansTest = (d.MeansTest as Record<string, unknown> | undefined) ?? {};

  const esc = (v: unknown): string => {
    if (v == null) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Best Case BCI Import File | Generated by bankruptcy.ai | ${ts} -->
<BestCase Version="25.1">
  <Case>
    <CaseInfo>
      <DebtorFirstName>${esc(caseInfo.DebtorFirstName)}</DebtorFirstName>
      <DebtorMiddleName>${esc(caseInfo.DebtorMiddleName)}</DebtorMiddleName>
      <DebtorLastName>${esc(caseInfo.DebtorLastName)}</DebtorLastName>
      <DebtorSuffix>${esc(caseInfo.DebtorSuffix)}</DebtorSuffix>
      <DebtorSSN>${esc(caseInfo.DebtorSSN)}</DebtorSSN>
      <DebtorDOB>${esc(caseInfo.DebtorDOB)}</DebtorDOB>
      <Chapter>${esc(caseInfo.Chapter)}</Chapter>
      <District>${esc(caseInfo.District)}</District>
      <County>${esc(caseInfo.County)}</County>
      <ResidentialAddress>
        <Street>${esc(addr.Street)}</Street>
        <City>${esc(addr.City)}</City>
        <State>${esc(addr.State)}</State>
        <Zip>${esc(addr.Zip)}</Zip>
      </ResidentialAddress>
    </CaseInfo>
    <MeansTest>
      <HouseholdSize>${esc(meansTest.HouseholdSize)}</HouseholdSize>
      <CMI>${esc(meansTest.CMI)}</CMI>
      <StateMedianIncome>${esc(meansTest.StateMedianIncome)}</StateMedianIncome>
    </MeansTest>
    <!--
      Schedules A/B, D, E/F, G, H, I, J are referenced from the validator
      but their full XML serialization is V1.1 work. The validator already
      flags presence/absence so the test cycle can run with this envelope.
      Client name for display: ${esc(clientName)}
    -->
  </Case>
</BestCase>`;
}
