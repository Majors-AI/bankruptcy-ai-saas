// V1 — "+ New Client" manual onboarding modal.
//
// Flow:
//   1. Attorney/legal-admin fills the 10-field form (case basics, fee paid,
//      client + spouse contact, attorney assignment).
//   2. On submit: INSERT clients row (status=registered, onboarding_source=manual)
//      + INSERT case_acceptances row (chapter, attorney_fee_cents, is_bifurcated)
//      + generateAccessToken(client.id) → 90-day magic-link token
//      + invoke send-client-message edge function once per channel (email + SMS)
//        with the v1_manual_onboarding_welcome / _sms scripts substituted.
//   3. Show toast with copyable portal URL.
//
// Gated to attorneys (canAcceptCase). Hosted in LegalAdminPortal's Manual
// Clients tab and reachable via the "+ New Client" button.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Mail,
  MessageCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateAccessToken, buildPortalUrl } from '../lib/clientAccess';
import { getScript } from '../lib/scriptLibrary';
import { sendVia } from '../lib/sendGate';

const MLG_FIRM_ID = '00000000-0000-0000-0000-000000000001';

type FilingType = 'individual' | 'joint' | 'individual_nfs';

interface StaffAttorney {
  id: string;
  name: string;
  email: string | null;
}

interface NewClientResult {
  clientId: string;
  token: string;
  portalUrl: string;
  emailQueued: boolean;
  smsQueued: boolean;
}

interface Props {
  firmId?: string;
  firmName?: string;
  onClose: () => void;
  onCreated?: (result: NewClientResult) => void;
}

export default function NewClientModal({
  firmId = MLG_FIRM_ID,
  firmName = 'Majors Law Group',
  onClose,
  onCreated,
}: Props) {
  // Case basics
  const [chapter, setChapter]               = useState<'7' | '13'>('7');
  const [state, setState]                   = useState('AZ');
  const [county, setCounty]                 = useState('');
  const [filingType, setFilingType]         = useState<FilingType>('individual');
  // Fee paid
  const [totalFeeDollars, setTotalFeeDollars] = useState('');
  const [isBifurcated, setIsBifurcated]     = useState(false);
  // Client contact
  const [firstName, setFirstName]           = useState('');
  const [lastName, setLastName]             = useState('');
  const [clientEmail, setClientEmail]       = useState('');
  const [clientPhone, setClientPhone]       = useState('');
  // Spouse contact (joint / NFS only)
  const [spouseFirstName, setSpouseFirstName] = useState('');
  const [spouseLastName, setSpouseLastName]   = useState('');
  const [spouseEmail, setSpouseEmail]         = useState('');
  // Attorney assignment
  const [attorneys, setAttorneys]           = useState<StaffAttorney[]>([]);
  const [attorneyId, setAttorneyId]         = useState('');

  const [saving, setSaving]                 = useState(false);
  const [err, setErr]                       = useState<string | null>(null);
  const [result, setResult]                 = useState<NewClientResult | null>(null);

  const hasSpouse = filingType === 'joint' || filingType === 'individual_nfs';

  // Load attorneys for the dropdown. TODO V1.1: scope by firm_id once
  // staff_members has firm_id (currently it doesn't, so we filter by role
  // only — both pilot firms read the same staff_members table for now).
  const loadAttorneys = useCallback(async () => {
    const { data, error } = await supabase
      .from('staff_members')
      .select('id, name, email, intake_portal_role')
      .in('intake_portal_role', ['attorney', 'attorney_super_admin'])
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) {
      console.error('[NewClientModal] loadAttorneys failed', error);
      return;
    }
    setAttorneys((data ?? []) as StaffAttorney[]);
  }, []);

  useEffect(() => { loadAttorneys(); }, [loadAttorneys]);

  const fullName = useMemo(
    () => `${firstName.trim()} ${lastName.trim()}`.trim(),
    [firstName, lastName],
  );

  const canSubmit =
    !!firstName.trim() &&
    !!lastName.trim() &&
    !!clientEmail.trim() &&
    !!clientPhone.trim() &&
    !!attorneyId &&
    !saving &&
    !result;

  async function submit() {
    setSaving(true);
    setErr(null);
    try {
      const feeCents = Math.round((parseFloat(totalFeeDollars) || 0) * 100);
      const attorney = attorneys.find(a => a.id === attorneyId);

      // 1. Insert client row (firm-scoped, manual source).
      const { data: clientRow, error: clientErr } = await supabase
        .from('clients')
        .insert({
          firm_id: firmId,
          name: fullName,
          email: clientEmail.trim() || null,
          phone: clientPhone.trim() || null,
          status: 'registered',
          case_status: 'accepted_fee_quoted',
          onboarding_source: 'manual',
        })
        .select('id')
        .single();
      if (clientErr || !clientRow) {
        throw new Error(clientErr?.message ?? 'Could not create client row.');
      }
      const clientId = clientRow.id as string;

      // 2. Insert case_acceptances row.
      const { error: caErr } = await supabase
        .from('case_acceptances')
        .insert({
          client_id: clientId,
          chapter: String(chapter),
          attorney_fee: feeCents > 0 ? feeCents / 100 : null,
          is_bifurcated: isBifurcated && chapter === '7',
          accepted_by: attorney?.name ?? null,
          acceptance_notes: `Manual onboarding via NewClientModal — filing_type=${filingType}, state=${state}, county=${county || 'n/a'}.`,
          decided_at: new Date().toISOString(),
        });
      if (caErr) {
        // Roll back the client row so we don't leave an orphan.
        await supabase.from('clients').delete().eq('id', clientId);
        throw new Error(caErr.message);
      }

      // 3. Generate 90-day magic-link token.
      const token = await generateAccessToken(clientId);
      const portalUrl = buildPortalUrl(token);

      // 4. Resolve scripts and dispatch outbound messages.
      const variables = {
        firm_name: firmName,
        client_name: fullName,
        attorney_name: attorney?.name ?? 'your attorney',
        portal_url: portalUrl,
      };
      const emailBody = await getScript('v1_manual_onboarding_welcome', variables);
      const smsBody   = await getScript('v1_manual_onboarding_welcome_sms', variables);

      const senderName       = attorney?.name ?? firmName;

      let emailQueued = false;
      let smsQueued   = false;
      const skipNotes: string[] = [];

      if (clientEmail.trim() && emailBody) {
        const result = await sendVia(
          'send-client-message',
          {
            messageId: crypto.randomUUID(),
            clientId,
            clientName: fullName,
            clientEmail: clientEmail.trim(),
            senderName,
            senderRole: 'attorney',
            subject: `Welcome to ${firmName} — start your bankruptcy file`,
            body: emailBody,
            channel: 'email',
          },
          {
            recipientType: 'client',
            clientId,
            actor: senderName,
            summary: 'Manual onboarding welcome email',
          },
        );
        if (result.sent) {
          emailQueued = true;
        } else {
          skipNotes.push(`Email skipped: ${result.reason ?? 'unknown'}`);
        }
      }
      if (clientPhone.trim() && smsBody) {
        // SMS goes through the gate as 'client' — STRICT consent required (TCPA).
        const result = await sendVia(
          'send-client-message',
          {
            messageId: crypto.randomUUID(),
            clientId,
            clientName: fullName,
            clientPhone: clientPhone.trim(),
            senderName,
            senderRole: 'attorney',
            body: smsBody,
            channel: 'sms',
          },
          {
            recipientType: 'client',
            clientId,
            actor: senderName,
            summary: 'Manual onboarding welcome SMS',
          },
        );
        if (result.sent) {
          smsQueued = true;
        } else {
          skipNotes.push(`SMS skipped: ${result.reason ?? 'unknown'}`);
        }
      }
      if (skipNotes.length > 0) {
        // Non-blocking notice on the result UI — the modal renders {emailQueued, smsQueued}
        // booleans already; this surfaces the WHY when one is false.
        console.warn('[NewClientModal] gate decisions:', skipNotes.join(' / '));
      }

      const res: NewClientResult = { clientId, token, portalUrl, emailQueued, smsQueued };
      setResult(res);
      onCreated?.(res);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setErr(message);
    } finally {
      setSaving(false);
    }
  }

  function copyPortalUrl() {
    if (!result) return;
    navigator.clipboard.writeText(result.portalUrl).catch(err => {
      console.error('[NewClientModal] clipboard write failed', err);
    });
  }

  const inp = 'w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors';
  const lbl = 'text-xs font-semibold text-slate-400 mb-1.5 block';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-white">+ New Client (manual onboarding)</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Already-accepted client. Fee already signed/collected outside the platform. We send a portal magic-link.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {err && (
            <div className="bg-red-500/8 border border-red-500/25 rounded-xl px-3.5 py-2.5 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 break-all">{err}</p>
            </div>
          )}

          {result ? (
            <div className="space-y-4">
              <div className="bg-emerald-500/8 border border-emerald-500/25 rounded-xl px-4 py-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-300">Client onboarded</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Magic-link token issued (90-day expiry).{' '}
                    {result.emailQueued && <span className="text-emerald-400">Welcome email queued.</span>}{' '}
                    {result.smsQueued && <span className="text-emerald-400">SMS queued.</span>}
                  </p>
                </div>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl px-4 py-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Portal URL</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-sky-400 font-mono break-all">{result.portalUrl}</code>
                  <button
                    onClick={copyPortalUrl}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Section A: Case Basics */}
              <section>
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-2">A · Case basics</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className={lbl}>Chapter</label>
                    <select value={chapter} onChange={e => setChapter(e.target.value as '7' | '13')} className={inp}>
                      <option value="7">Chapter 7</option>
                      <option value="13">Chapter 13</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>State</label>
                    <input value={state} onChange={e => setState(e.target.value)} className={inp} placeholder="AZ" />
                  </div>
                  <div>
                    <label className={lbl}>County</label>
                    <input value={county} onChange={e => setCounty(e.target.value)} className={inp} placeholder="Maricopa" />
                  </div>
                  <div>
                    <label className={lbl}>Filing type</label>
                    <select value={filingType} onChange={e => setFilingType(e.target.value as FilingType)} className={inp}>
                      <option value="individual">Individual</option>
                      <option value="joint">Joint</option>
                      <option value="individual_nfs">Individual — NFS</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Section B: Fee Paid */}
              <section>
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-2">B · Fee paid</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Total fee paid ($)</label>
                    <input
                      value={totalFeeDollars}
                      onChange={e => setTotalFeeDollars(e.target.value)}
                      className={inp}
                      placeholder="e.g. 1500"
                      inputMode="decimal"
                    />
                  </div>
                  {chapter === '7' && (
                    <label className="flex items-end gap-2 cursor-pointer text-xs text-slate-300 pb-2.5">
                      <input
                        type="checkbox"
                        checked={isBifurcated}
                        onChange={e => setIsBifurcated(e.target.checked)}
                      />
                      Bifurcated (Ch.7)
                    </label>
                  )}
                </div>
              </section>

              {/* Section C: Client Contact */}
              <section>
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-2">C · Client contact</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>First name <span className="text-red-400">*</span></label>
                    <input value={firstName} onChange={e => setFirstName(e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Last name <span className="text-red-400">*</span></label>
                    <input value={lastName} onChange={e => setLastName(e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Email <span className="text-red-400">*</span></label>
                    <input
                      type="email"
                      value={clientEmail}
                      onChange={e => setClientEmail(e.target.value)}
                      className={inp}
                      placeholder="client@example.com"
                    />
                  </div>
                  <div>
                    <label className={lbl}>Phone <span className="text-red-400">*</span></label>
                    <input
                      value={clientPhone}
                      onChange={e => setClientPhone(e.target.value)}
                      className={inp}
                      placeholder="+1 555 555 5555"
                    />
                  </div>
                </div>
              </section>

              {/* Section D: Spouse Contact (conditional) */}
              {hasSpouse && (
                <section>
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-2">D · Spouse contact</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Spouse first name</label>
                      <input value={spouseFirstName} onChange={e => setSpouseFirstName(e.target.value)} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Spouse last name</label>
                      <input value={spouseLastName} onChange={e => setSpouseLastName(e.target.value)} className={inp} />
                    </div>
                    <div className="col-span-2">
                      <label className={lbl}>Spouse email</label>
                      <input value={spouseEmail} onChange={e => setSpouseEmail(e.target.value)} className={inp} />
                    </div>
                  </div>
                  {/* TODO V1.1: when filing_type=joint, create a second clients row + magic link for the spouse. */}
                </section>
              )}

              {/* Section E: Attorney Assignment */}
              <section>
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-2">E · Attorney assignment</p>
                <label className={lbl}>Primary attorney</label>
                <select value={attorneyId} onChange={e => setAttorneyId(e.target.value)} className={inp}>
                  <option value="">Select attorney…</option>
                  {attorneys.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.email ? ` — ${a.email}` : ''}
                    </option>
                  ))}
                </select>
                {attorneys.length === 0 && (
                  <p className="text-[10px] text-amber-300 mt-1">
                    No attorneys found in staff_members (intake_portal_role in attorney / attorney_super_admin).
                  </p>
                )}
              </section>

              {/* Outbound preview */}
              <div className="bg-sky-500/8 border border-sky-500/25 rounded-xl px-3.5 py-2.5 text-[11px] text-sky-300/90 flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <div>
                  On submit we'll send a portal magic-link via{' '}
                  <Mail className="w-3 h-3 inline-block align-text-bottom" /> email{' '}
                  and{' '}
                  <MessageCircle className="w-3 h-3 inline-block align-text-bottom" /> SMS{' '}
                  using the <code className="text-sky-400">v1_manual_onboarding_welcome</code> /{' '}
                  <code className="text-sky-400">v1_manual_onboarding_welcome_sms</code> scripts.
                </div>
              </div>
            </>
          )}
        </div>

        {!result && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-800 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-lg transition-colors"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Onboarding…' : 'Onboard Client + Send Link'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
