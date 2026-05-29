/**
 * MAJ-96 (V1.1) — CommunicationsTab
 *
 * Per-firm email + SMS sender configuration.
 * Reads from / writes to firm_communications_config (PK firm_id).
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, X, Pencil, RefreshCw, AlertTriangle, Mail, Phone, Bell, Globe, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FirmCommsConfig {
  firm_id: string;
  email_from_name: string | null;
  email_from_address: string | null;
  email_reply_to: string | null;
  email_domain: string | null;
  email_domain_verified_at: string | null;
  email_domain_dkim_records: unknown | null;
  email_domain_spf_records: unknown | null;
  sms_sender_name: string | null;
  sms_from_number: string | null;
  reminder_cadence_days: number[] | null;
  reminders_enabled: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

interface CommsForm {
  email_from_name: string;
  email_from_address: string;
  email_reply_to: string;
  sms_sender_name: string;
  sms_from_number: string;
  reminders_enabled: boolean;
  reminder_cadence_days: string;
  email_domain: string;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inp = 'w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-colors';
const lbl = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function configToForm(c: FirmCommsConfig): CommsForm {
  return {
    email_from_name:       c.email_from_name ?? '',
    email_from_address:    c.email_from_address ?? '',
    email_reply_to:        c.email_reply_to ?? '',
    sms_sender_name:       c.sms_sender_name ?? '',
    sms_from_number:       c.sms_from_number ?? '',
    reminders_enabled:     c.reminders_enabled ?? true,
    reminder_cadence_days: (c.reminder_cadence_days ?? [7, 3, 1]).join(', '),
    email_domain:          c.email_domain ?? '',
  };
}

function parseCadence(s: string): number[] {
  return s.split(',').map(x => parseInt(x.trim(), 10)).filter(n => !isNaN(n) && n > 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  firmId: string;
  firmName: string;
}

export default function CommunicationsTab({ firmId, firmName }: Props) {
  const [config, setConfig]   = useState<FirmCommsConfig | null>(null);
  const [loaded, setLoaded]   = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState<CommsForm | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoaded(false);
    setErr(null);
    const { data, error } = await supabase
      .from('firm_communications_config')
      .select('*')
      .eq('firm_id', firmId)
      .maybeSingle();
    if (error) { setErr(error.message); setLoaded(true); return; }
    setConfig(data as FirmCommsConfig | null);
    setLoaded(true);
    setEditing(false);
  }, [firmId]);

  useEffect(() => { load(); }, [load]);

  function startEdit() {
    const c = config ?? {
      firm_id: firmId, email_from_name: null, email_from_address: null,
      email_reply_to: null, email_domain: null, email_domain_verified_at: null,
      email_domain_dkim_records: null, email_domain_spf_records: null,
      sms_sender_name: null, sms_from_number: null,
      reminder_cadence_days: null, reminders_enabled: true,
      updated_at: null, updated_by: null,
    };
    setForm(configToForm(c));
    setSaveErr(null);
    setEditing(true);
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setSaveErr(null);

    const payload = {
      firm_id:               firmId,
      email_from_name:       form.email_from_name || null,
      email_from_address:    form.email_from_address || null,
      email_reply_to:        form.email_reply_to || null,
      email_domain:          form.email_domain || null,
      sms_sender_name:       form.sms_sender_name || null,
      sms_from_number:       form.sms_from_number || null,
      reminders_enabled:     form.reminders_enabled,
      reminder_cadence_days: parseCadence(form.reminder_cadence_days),
      updated_at:            new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('firm_communications_config')
      .upsert(payload, { onConflict: 'firm_id' })
      .select('*')
      .maybeSingle();

    setSaving(false);
    if (error) { setSaveErr(error.message); return; }
    setConfig(data as FirmCommsConfig);
    setEditing(false);
  }

  function setF<K extends keyof CommsForm>(key: K, val: CommsForm[K]) {
    setForm((p) => p && ({ ...p, [key]: val }));
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!loaded && !err) {
    return <div className="text-center py-10 text-xs text-slate-600">Loading communications config…</div>;
  }

  if (err) {
    return (
      <div className="bg-red-500/8 border border-red-500/25 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-red-300">Could not load communications config</p>
          <p className="text-xs text-slate-400 mt-1 break-all">{err}</p>
        </div>
      </div>
    );
  }

  const c = config;
  const f = form;
  const isVerified = !!c?.email_domain_verified_at;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Panel header */}
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/40 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">{firmName}</p>
          {c?.updated_at && (
            <p className="text-[10px] text-slate-600 mt-0.5">
              Last updated {new Date(c.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
        {!editing ? (
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/20 transition-colors"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditing(false); setSaveErr(null); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-700 hover:bg-slate-800 transition-colors"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save
            </button>
          </div>
        )}
      </div>

      {!editing ? (
        /* ── Read-only view ── */
        <div className="divide-y divide-slate-800/60">

          {/* 1. Email Sender */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-3.5 h-3.5 text-amber-400/70" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Sender</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">From name</span>
                <span className="text-sm text-white">{c?.email_from_name ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">From address</span>
                <span className="text-xs font-mono text-slate-300">{c?.email_from_address ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Reply-to</span>
                <span className="text-xs font-mono text-slate-300">{c?.email_reply_to ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* 2. SMS Sender */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="w-3.5 h-3.5 text-amber-400/70" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">SMS Sender</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Sender name</span>
                <span className="text-sm text-white">{c?.sms_sender_name ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">From number</span>
                <span className="text-xs font-mono text-slate-300">{c?.sms_from_number ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* 3. Reminders */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-3.5 h-3.5 text-amber-400/70" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reminders</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Enabled</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  c?.reminders_enabled !== false
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                    : 'text-slate-500 bg-slate-800 border-slate-700'
                }`}>
                  {c?.reminders_enabled !== false ? 'On' : 'Off'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Cadence (days before deadline)</span>
                <div className="flex items-center gap-1">
                  {(c?.reminder_cadence_days ?? [7, 3, 1]).map((d) => (
                    <span key={d} className="text-[10px] font-mono font-bold text-slate-300 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5">
                      {d}d
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Custom Domain */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-3.5 h-3.5 text-amber-400/70" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Custom Domain</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Email domain</span>
                <span className="text-xs font-mono text-slate-300">{c?.email_domain ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Verification status</span>
                {c?.email_domain ? (
                  <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    isVerified
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                      : 'text-slate-500 bg-slate-800 border-slate-700'
                  }`}>
                    {isVerified
                      ? <><CheckCircle2 className="w-3 h-3" /> Verified</>
                      : <><Clock className="w-3 h-3" /> Not verified</>
                    }
                  </span>
                ) : (
                  <span className="text-xs text-slate-600">No domain set</span>
                )}
              </div>
              {c?.email_domain_dkim_records && (
                <div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">DKIM Records</p>
                  <pre className="text-[10px] font-mono text-slate-400 bg-slate-800/60 border border-slate-700/40 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(c.email_domain_dkim_records, null, 2)}
                  </pre>
                </div>
              )}
              {c?.email_domain_spf_records && (
                <div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">SPF Records</p>
                  <pre className="text-[10px] font-mono text-slate-400 bg-slate-800/60 border border-slate-700/40 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(c.email_domain_spf_records, null, 2)}
                  </pre>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button disabled className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 bg-slate-800 border border-slate-700 cursor-not-allowed opacity-50">
                  Generate DNS Records
                </button>
                <button disabled className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 bg-slate-800 border border-slate-700 cursor-not-allowed opacity-50">
                  Verify Domain
                </button>
              </div>
              <p className="text-[10px] text-slate-600">SendGrid domain authentication wiring pending (MAJ-96).</p>
            </div>
          </div>

        </div>
      ) : f && (
        /* ── Edit form ── */
        <div className="p-5 space-y-5">

          {/* 1. Email Sender */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">Email Sender</p>
            <div>
              <label className={lbl}>From name</label>
              <input className={inp} value={f.email_from_name}
                onChange={(e) => setF('email_from_name', e.target.value)}
                placeholder="Majors Law Group" />
            </div>
            <div>
              <label className={lbl}>From address</label>
              <input className={inp} type="email" value={f.email_from_address}
                onChange={(e) => setF('email_from_address', e.target.value)}
                placeholder="notifications@majorslaw.com" />
            </div>
            <div>
              <label className={lbl}>Reply-to address</label>
              <input className={inp} type="email" value={f.email_reply_to}
                onChange={(e) => setF('email_reply_to', e.target.value)}
                placeholder="info@majorslaw.com" />
            </div>
          </div>

          {/* 2. SMS Sender */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">SMS Sender</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Sender name</label>
                <input className={inp} value={f.sms_sender_name}
                  onChange={(e) => setF('sms_sender_name', e.target.value)}
                  placeholder="MLG Law" maxLength={11} />
                <p className="text-[10px] text-slate-600 mt-1">Max 11 chars for alphanumeric sender ID.</p>
              </div>
              <div>
                <label className={lbl}>From number</label>
                <input className={inp} value={f.sms_from_number}
                  onChange={(e) => setF('sms_from_number', e.target.value)}
                  placeholder="+12065551234" />
              </div>
            </div>
          </div>

          {/* 3. Reminders */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">Reminders</p>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <button
                type="button"
                onClick={() => setF('reminders_enabled', !f.reminders_enabled)}
                className={`w-9 h-5 rounded-full transition-colors relative ${f.reminders_enabled ? 'bg-amber-500' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${f.reminders_enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-xs text-slate-300">Reminders enabled</span>
            </label>
            <div>
              <label className={lbl}>Cadence (days before deadline)</label>
              <input className={inp} value={f.reminder_cadence_days}
                onChange={(e) => setF('reminder_cadence_days', e.target.value)}
                placeholder="7, 3, 1" />
              <p className="text-[10px] text-slate-600 mt-1">Comma-separated integers, e.g. "7, 3, 1".</p>
            </div>
          </div>

          {/* 4. Custom Domain */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">Custom Domain</p>
            <div>
              <label className={lbl}>Email domain</label>
              <input className={inp} value={f.email_domain}
                onChange={(e) => setF('email_domain', e.target.value)}
                placeholder="majorslaw.com" />
              <p className="text-[10px] text-slate-600 mt-1">Domain must be verified via SendGrid before it is used for sending.</p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button disabled className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 bg-slate-800 border border-slate-700 cursor-not-allowed opacity-50">
                Generate DNS Records
              </button>
              <button disabled className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 bg-slate-800 border border-slate-700 cursor-not-allowed opacity-50">
                Verify Domain
              </button>
            </div>
            <p className="text-[10px] text-slate-600">SendGrid domain authentication wiring pending (MAJ-96).</p>
          </div>

          {saveErr && (
            <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
              {saveErr}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
