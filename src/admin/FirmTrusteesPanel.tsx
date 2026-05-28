// BAN-29 — Firm-configurable trustee directory.
//
// Firm staff manage their own trustee list here (NOT platform-seeded). Each
// firm adds the trustees they actually work with and configures how they
// submit documents to each one. Until trustee APIs are wired for a given
// trustee, submission_method defaults to 'portal_manual' so the system
// organizes 07-trustee documents and a firm staffer submits.
//
// Schema: 20260528050000_firm_trustees.sql.

import { useCallback, useEffect, useState } from 'react';
import {
  Scale,
  Plus,
  X,
  Save,
  Mail,
  ExternalLink,
  RefreshCw,
  Pencil,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const MLG_FIRM_ID = '00000000-0000-0000-0000-000000000001';

export type TrusteeSubmissionMethod = 'email' | 'portal_manual' | 'portal_api' | 'mail';

export interface FirmTrustee {
  id: string;
  firm_id: string;
  trustee_name: string;
  district: string | null;
  division: string | null;
  submission_method: TrusteeSubmissionMethod;
  submission_email: string | null;
  submission_portal_url: string | null;
  api_config_id: string | null;
  standard_document_list: unknown;
  file_naming_convention: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const METHOD_LABELS: Record<TrusteeSubmissionMethod, string> = {
  email:         'Email',
  portal_manual: 'Portal (manual)',
  portal_api:    'Portal API',
  mail:          'Mail',
};

interface Props {
  // TODO BAN-40 phase 2: thread the current firm_id from auth/firm context.
  // For now defaults to MLG so the panel works in the dev shell.
  firmId?: string;
}

export default function FirmTrusteesPanel({ firmId = MLG_FIRM_ID }: Props) {
  const [rows, setRows] = useState<FirmTrustee[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<FirmTrustee | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    const { data, error } = await supabase
      .from('firm_trustees')
      .select('*')
      .eq('firm_id', firmId)
      .order('trustee_name', { ascending: true });
    if (error) setErr(error.message);
    else setRows((data ?? []) as FirmTrustee[]);
  }, [firmId]);

  useEffect(() => { load(); }, [load]);

  async function saveDeactivate(t: FirmTrustee) {
    const { error } = await supabase
      .from('firm_trustees')
      .update({ is_active: !t.is_active, updated_at: new Date().toISOString() })
      .eq('id', t.id);
    if (error) { setErr(error.message); return; }
    load();
  }

  const visible = (rows ?? []).filter(r => showInactive || r.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">Firm Trustees</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Trustees your firm works with. Each firm manages its own list — nothing is pre-seeded.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
          <button
            onClick={load}
            className="p-1.5 text-slate-500 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setEditing(null); setShowAdd(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Trustee
          </button>
        </div>
      </div>

      {err && (
        <div className="bg-red-500/8 border border-red-500/25 rounded-xl px-3.5 py-2.5 text-xs text-red-300 break-all">
          {err}
        </div>
      )}

      {rows == null ? (
        <p className="text-center py-12 text-xs text-slate-600">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="bg-[#0d1221] border border-slate-800 rounded-2xl py-12 text-center">
          <Scale className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No trustees configured yet.</p>
          <p className="text-[11px] text-slate-700 mt-1">
            Click <span className="text-amber-400 font-semibold">Add Trustee</span> to add the first one for your firm.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <th className="text-left px-5 py-3">Trustee</th>
                <th className="text-left px-4 py-3">District / Division</th>
                <th className="text-left px-4 py-3">Submission</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {visible.map(t => (
                <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-semibold text-white">{t.trustee_name}</p>
                    {t.notes && <p className="text-[10px] text-slate-600 mt-0.5">{t.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {t.district || '—'}{t.division ? ` · ${t.division}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-slate-300">{METHOD_LABELS[t.submission_method]}</p>
                    {t.submission_method === 'email' && t.submission_email && (
                      <p className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-1">
                        <Mail className="w-2.5 h-2.5" /> {t.submission_email}
                      </p>
                    )}
                    {t.submission_method === 'portal_manual' && t.submission_portal_url && (
                      <a
                        href={t.submission_portal_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-sky-400 hover:text-sky-300 mt-0.5 inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-2.5 h-2.5" /> Portal
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {t.is_active ? (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => { setEditing(t); setShowAdd(false); }}
                        className="p-1.5 text-slate-500 hover:text-amber-400 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => saveDeactivate(t)}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                        title={t.is_active ? 'Deactivate' : 'Reactivate'}
                      >
                        {t.is_active ? <Trash2 className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(showAdd || editing) && (
        <TrusteeEditModal
          firmId={firmId}
          existing={editing}
          onClose={() => { setEditing(null); setShowAdd(false); }}
          onSaved={() => { setEditing(null); setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────

function TrusteeEditModal({
  firmId, existing, onClose, onSaved,
}: {
  firmId: string;
  existing: FirmTrustee | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [trusteeName, setTrusteeName]                 = useState(existing?.trustee_name ?? '');
  const [district, setDistrict]                       = useState(existing?.district ?? '');
  const [division, setDivision]                       = useState(existing?.division ?? '');
  const [submissionMethod, setSubmissionMethod]       = useState<TrusteeSubmissionMethod>(existing?.submission_method ?? 'portal_manual');
  const [submissionEmail, setSubmissionEmail]         = useState(existing?.submission_email ?? '');
  const [submissionPortalUrl, setSubmissionPortalUrl] = useState(existing?.submission_portal_url ?? '');
  const [fileNamingConvention, setFileNamingConvention] = useState(existing?.file_naming_convention ?? '');
  const [notes, setNotes]                             = useState(existing?.notes ?? '');
  const [saving, setSaving]                           = useState(false);
  const [err, setErr]                                 = useState<string | null>(null);

  async function save() {
    if (!trusteeName.trim()) { setErr('Trustee name is required.'); return; }
    setSaving(true);
    setErr(null);
    const payload = {
      firm_id: firmId,
      trustee_name: trusteeName.trim(),
      district: district.trim() || null,
      division: division.trim() || null,
      submission_method: submissionMethod,
      submission_email: submissionMethod === 'email' ? (submissionEmail.trim() || null) : null,
      submission_portal_url: submissionMethod === 'portal_manual' || submissionMethod === 'portal_api'
        ? (submissionPortalUrl.trim() || null)
        : null,
      file_naming_convention: fileNamingConvention.trim() || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await supabase.from('firm_trustees').update(payload).eq('id', existing.id)
      : await supabase.from('firm_trustees').insert(payload);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  }

  const inp = 'w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors';
  const lbl = 'text-xs font-semibold text-slate-400 mb-1.5 block';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-white">{existing ? 'Edit Trustee' : 'Add Trustee'}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Firm-side configuration only — platform trustees stay untouched.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2 break-all">{err}</p>}
          <div>
            <label className={lbl}>Trustee name <span className="text-red-400">*</span></label>
            <input value={trusteeName} onChange={e => setTrusteeName(e.target.value)} className={inp} placeholder="e.g. Jane Doe, Trustee" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>District</label>
              <input value={district} onChange={e => setDistrict(e.target.value)} className={inp} placeholder="e.g. D. Colo." />
            </div>
            <div>
              <label className={lbl}>Division</label>
              <input value={division} onChange={e => setDivision(e.target.value)} className={inp} placeholder="optional" />
            </div>
          </div>
          <div>
            <label className={lbl}>Submission method</label>
            <select value={submissionMethod} onChange={e => setSubmissionMethod(e.target.value as TrusteeSubmissionMethod)} className={inp}>
              <option value="portal_manual">Portal (manual upload)</option>
              <option value="email">Email</option>
              <option value="portal_api">Portal API (when wired)</option>
              <option value="mail">Mail</option>
            </select>
          </div>
          {submissionMethod === 'email' && (
            <div>
              <label className={lbl}>Submission email</label>
              <input value={submissionEmail} onChange={e => setSubmissionEmail(e.target.value)} className={inp} placeholder="trustee@example.com" />
            </div>
          )}
          {(submissionMethod === 'portal_manual' || submissionMethod === 'portal_api') && (
            <div>
              <label className={lbl}>Submission portal URL</label>
              <input value={submissionPortalUrl} onChange={e => setSubmissionPortalUrl(e.target.value)} className={inp} placeholder="https://…" />
            </div>
          )}
          <div>
            <label className={lbl}>File naming convention <span className="text-slate-600 font-normal normal-case">(optional)</span></label>
            <input value={fileNamingConvention} onChange={e => setFileNamingConvention(e.target.value)} className={inp} placeholder="e.g. {LastName}_{CaseNum}_{DocType}.pdf" />
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="Submission quirks, contact preferences, etc." />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-800 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white">Cancel</button>
          <button
            onClick={save}
            disabled={saving || !trusteeName.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-lg transition-colors"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : (existing ? 'Save Changes' : 'Add Trustee')}
          </button>
        </div>
      </div>
    </div>
  );
}
