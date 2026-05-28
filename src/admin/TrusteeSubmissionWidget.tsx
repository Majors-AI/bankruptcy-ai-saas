// BAN-29 — Per-case trustee submission UI.
//
// Lists the documents in phase 07-trustee for a given client, lets the
// firm staffer pick which trustee they're submitting to (from firm_trustees),
// then records the submission to trustee_submission_log. Optional confirmation
// receipt URL field.
//
// Documents are referenced by id — the submission_log row carries a
// documents_included uuid[] so we know what went out together.

import { useCallback, useEffect, useState } from 'react';
import { Scale, CheckCircle2, AlertTriangle, RefreshCw, Send, FileText, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CaseFilePhase } from '../lib/casePhases';
import type { FirmTrustee, TrusteeSubmissionMethod } from './FirmTrusteesPanel';

const MLG_FIRM_ID = '00000000-0000-0000-0000-000000000001';

interface DocRow {
  id: string;
  document_type: string;
  original_filename: string;
  uploaded_at: string;
  phase: CaseFilePhase | null;
}

interface SubmissionRow {
  id: string;
  firm_trustee_id: string | null;
  submission_method: string;
  submitted_at: string;
  status: string;
  confirmation_receipt_url: string | null;
  documents_included: string[];
  notes: string | null;
}

interface Props {
  clientId: string;
  caseAcceptanceId?: string | null;
  firmId?: string;
}

export default function TrusteeSubmissionWidget({
  clientId,
  caseAcceptanceId = null,
  firmId = MLG_FIRM_ID,
}: Props) {
  const [trustees, setTrustees] = useState<FirmTrustee[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [log, setLog] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [selectedTrusteeId, setSelectedTrusteeId] = useState<string>('');
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [receiptUrl, setReceiptUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const [trusteesRes, docsRes, logRes] = await Promise.all([
      supabase
        .from('firm_trustees')
        .select('*')
        .eq('firm_id', firmId)
        .eq('is_active', true)
        .order('trustee_name', { ascending: true }),
      supabase
        .from('client_documents')
        .select('id, document_type, original_filename, uploaded_at, phase')
        .eq('client_id', clientId)
        .eq('phase', '07-trustee')
        .order('uploaded_at', { ascending: false }),
      supabase
        .from('trustee_submission_log')
        .select('id, firm_trustee_id, submission_method, submitted_at, status, confirmation_receipt_url, documents_included, notes')
        .eq('client_id', clientId)
        .order('submitted_at', { ascending: false }),
    ]);
    if (trusteesRes.error) setErr(trusteesRes.error.message);
    if (docsRes.error)     setErr(docsRes.error.message);
    if (logRes.error)      setErr(logRes.error.message);
    setTrustees((trusteesRes.data ?? []) as FirmTrustee[]);
    setDocs((docsRes.data ?? []) as DocRow[]);
    setLog((logRes.data ?? []) as SubmissionRow[]);
    setLoading(false);
  }, [clientId, firmId]);

  useEffect(() => { load(); }, [load]);

  // Auto-select all 07-trustee docs when they first load — operator can deselect.
  useEffect(() => {
    if (docs.length > 0 && selectedDocIds.size === 0) {
      setSelectedDocIds(new Set(docs.map(d => d.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs.length]);

  function toggleDoc(id: string) {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!selectedTrusteeId) { setErr('Pick a trustee first.'); return; }
    const trustee = trustees.find(t => t.id === selectedTrusteeId);
    if (!trustee) { setErr('Selected trustee not found.'); return; }
    if (selectedDocIds.size === 0) { setErr('Select at least one document.'); return; }
    setSubmitting(true);
    setErr(null);
    const { error } = await supabase.from('trustee_submission_log').insert({
      firm_id: firmId,
      firm_trustee_id: trustee.id,
      client_id: clientId,
      case_acceptance_id: caseAcceptanceId,
      submission_method: trustee.submission_method as TrusteeSubmissionMethod,
      confirmation_receipt_url: receiptUrl.trim() || null,
      documents_included: Array.from(selectedDocIds),
      notes: notes.trim() || null,
      status: 'submitted',
    });
    setSubmitting(false);
    if (error) { setErr(error.message); return; }
    setReceiptUrl('');
    setNotes('');
    setSelectedDocIds(new Set(docs.map(d => d.id)));
    load();
  }

  const selectedTrustee = trustees.find(t => t.id === selectedTrusteeId) ?? null;

  return (
    <div className="bg-[#0d1221] border border-amber-500/20 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 bg-amber-500/5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
          <Scale className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white">Trustee Submission</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Submit documents from phase <code className="text-slate-400">07-trustee</code> to one of this firm's trustees.
          </p>
        </div>
        <button onClick={load} className="p-1.5 text-slate-500 hover:text-white" title="Refresh">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">
        {err && (
          <div className="bg-red-500/8 border border-red-500/25 rounded-xl px-3 py-2 text-xs text-red-300 break-all">
            {err}
          </div>
        )}

        {loading ? (
          <p className="text-center py-6 text-xs text-slate-600">Loading…</p>
        ) : trustees.length === 0 ? (
          <div className="bg-amber-500/8 border border-amber-500/25 rounded-xl px-3.5 py-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-300">No trustees configured for this firm</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Go to <span className="text-amber-400">Trustee Document Portal → Firm Trustees</span> to add one.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Trustee picker */}
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Submit to trustee</label>
              <select
                value={selectedTrusteeId}
                onChange={e => setSelectedTrusteeId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
              >
                <option value="">Select trustee…</option>
                {trustees.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.trustee_name}{t.district ? ` — ${t.district}` : ''} ({t.submission_method})
                  </option>
                ))}
              </select>
              {selectedTrustee && (
                <p className="text-[10px] text-slate-600 mt-1.5">
                  Submission via <span className="text-slate-400">{selectedTrustee.submission_method}</span>
                  {selectedTrustee.submission_email && ` → ${selectedTrustee.submission_email}`}
                  {selectedTrustee.submission_portal_url && ` → ${selectedTrustee.submission_portal_url}`}
                </p>
              )}
            </div>

            {/* Documents list */}
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2">
                Trustee-phase documents on file
                {docs.length > 0 && <span className="text-slate-600 ml-2">({selectedDocIds.size} of {docs.length} selected)</span>}
              </p>
              {docs.length === 0 ? (
                <p className="text-[11px] text-slate-600 bg-slate-800/30 border border-slate-700/60 rounded-xl px-3 py-3 text-center">
                  No documents in phase 07-trustee yet. Upload trustee-bound documents to the client file first.
                </p>
              ) : (
                <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl divide-y divide-slate-800/60">
                  {docs.map(d => {
                    const sel = selectedDocIds.has(d.id);
                    return (
                      <label key={d.id} className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-slate-800/40">
                        <input
                          type="checkbox"
                          checked={sel}
                          onChange={() => toggleDoc(d.id)}
                          className="flex-shrink-0"
                        />
                        <FileText className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{d.document_type}</p>
                          <p className="text-[10px] text-slate-600 truncate">{d.original_filename}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Confirmation receipt + notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">
                  Confirmation receipt URL <span className="text-slate-600 font-normal normal-case">(optional)</span>
                </label>
                <input
                  value={receiptUrl}
                  onChange={e => setReceiptUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Notes</label>
                <input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Internal notes for this submission"
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <button
              onClick={submit}
              disabled={submitting || !selectedTrusteeId || selectedDocIds.size === 0}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl transition-colors"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? 'Recording…' : 'Mark as Submitted'}
            </button>
          </>
        )}

        {/* Submission history */}
        {log.length > 0 && (
          <div className="pt-3 border-t border-slate-800/60">
            <p className="text-xs font-semibold text-slate-400 mb-2">Submission history</p>
            <div className="space-y-1.5">
              {log.map(s => {
                const t = trustees.find(x => x.id === s.firm_trustee_id);
                return (
                  <div key={s.id} className="flex items-start gap-3 bg-slate-800/30 border border-slate-700/60 rounded-xl px-3.5 py-2.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold text-white">{t?.trustee_name ?? 'Trustee removed'}</p>
                        <span className="text-[10px] text-slate-500">via {s.submission_method}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                          s.status === 'acknowledged' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' :
                          s.status === 'rejected'     ? 'bg-red-500/10 text-red-400 border-red-500/25' :
                                                        'bg-amber-500/10 text-amber-400 border-amber-500/25'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {new Date(s.submitted_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                        {' · '}
                        {s.documents_included.length} document{s.documents_included.length !== 1 ? 's' : ''}
                      </p>
                      {s.confirmation_receipt_url && (
                        <a href={s.confirmation_receipt_url} target="_blank" rel="noreferrer" className="text-[10px] text-sky-400 hover:text-sky-300 mt-1 inline-flex items-center gap-1">
                          Receipt ↗
                        </a>
                      )}
                      {s.notes && <p className="text-[10px] text-slate-500 mt-1">{s.notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty hint when no submissions ever */}
        {log.length === 0 && !loading && (
          <p className="text-[11px] text-slate-600 flex items-center gap-2 pt-2">
            <Plus className="w-3 h-3" /> No submissions logged for this client yet.
          </p>
        )}
      </div>
    </div>
  );
}
