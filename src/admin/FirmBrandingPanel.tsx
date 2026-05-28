/**
 * MAJ-95 (V1.1) — FirmBrandingPanel
 *
 * Inline edit panel for per-firm visual branding.
 * Used in the Super Admin "Branding" tab and (future) LegalAdminPortal.
 *
 * V1 logo handling: URL input only (no file upload).
 * V2: replace logo_url input with an S3 upload widget.
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, X, Pencil, RefreshCw, Image, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FirmBranding {
  firm_id: string;
  logo_url: string | null;
  logo_small_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  display_name: string | null;
  short_name: string | null;
  client_portal_welcome_message: string | null;
  client_portal_footer_message: string | null;
  updated_at: string | null;
}

interface BrandingForm {
  logo_url: string;
  logo_small_url: string;
  primary_color: string;
  accent_color: string;
  display_name: string;
  short_name: string;
  client_portal_welcome_message: string;
  client_portal_footer_message: string;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inp = 'w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-colors';
const lbl = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brandingToForm(b: FirmBranding): BrandingForm {
  return {
    logo_url:                      b.logo_url ?? '',
    logo_small_url:                b.logo_small_url ?? '',
    primary_color:                 b.primary_color ?? '#f59e0b',
    accent_color:                  b.accent_color ?? '#1e40af',
    display_name:                  b.display_name ?? '',
    short_name:                    b.short_name ?? '',
    client_portal_welcome_message: b.client_portal_welcome_message ?? '',
    client_portal_footer_message:  b.client_portal_footer_message ?? '',
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  firmId: string;
  firmName: string;
}

export default function FirmBrandingPanel({ firmId, firmName }: Props) {
  const [branding, setBranding] = useState<FirmBranding | null>(null);
  const [loaded, setLoaded]     = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState<BrandingForm | null>(null);
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoaded(false);
    setErr(null);
    const { data, error } = await supabase
      .from('firm_branding')
      .select('*')
      .eq('firm_id', firmId)
      .maybeSingle();
    if (error) { setErr(error.message); setLoaded(true); return; }
    setBranding(data as FirmBranding | null);
    setLoaded(true);
    setEditing(false);
  }, [firmId]);

  useEffect(() => { load(); }, [load]);

  function startEdit() {
    const b = branding ?? {
      firm_id: firmId, logo_url: null, logo_small_url: null,
      primary_color: null, accent_color: null, display_name: null,
      short_name: null, client_portal_welcome_message: null,
      client_portal_footer_message: null, updated_at: null,
    };
    setForm(brandingToForm(b));
    setSaveErr(null);
    setEditing(true);
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setSaveErr(null);

    const payload = {
      firm_id:                       firmId,
      logo_url:                      form.logo_url || null,
      logo_small_url:                form.logo_small_url || null,
      primary_color:                 form.primary_color || null,
      accent_color:                  form.accent_color || null,
      display_name:                  form.display_name || null,
      short_name:                    form.short_name || null,
      client_portal_welcome_message: form.client_portal_welcome_message || null,
      client_portal_footer_message:  form.client_portal_footer_message || null,
      updated_at:                    new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('firm_branding')
      .upsert(payload, { onConflict: 'firm_id' })
      .select('*')
      .maybeSingle();

    setSaving(false);
    if (error) { setSaveErr(error.message); return; }
    setBranding(data as FirmBranding);
    setEditing(false);
  }

  function setF<K extends keyof BrandingForm>(key: K, val: BrandingForm[K]) {
    setForm((p) => p && ({ ...p, [key]: val }));
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!loaded && !err) {
    return <div className="text-center py-10 text-xs text-slate-600">Loading branding…</div>;
  }

  if (err) {
    return (
      <div className="bg-red-500/8 border border-red-500/25 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-red-300">Could not load branding</p>
          <p className="text-xs text-slate-400 mt-1 break-all">{err}</p>
        </div>
      </div>
    );
  }

  const b = branding;
  const f = form;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Panel header */}
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/40 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">{firmName}</p>
          {b?.updated_at && (
            <p className="text-[10px] text-slate-600 mt-0.5">
              Last updated {new Date(b.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
        {!editing ? (
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/20 transition-colors"
          >
            <Pencil className="w-3 h-3" /> Edit Branding
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

      {/* Content */}
      {!editing ? (
        /* ── Read-only view ── */
        <div className="divide-y divide-slate-800/60">
          {/* Logo preview */}
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex-shrink-0">Logo</span>
            <div className="flex items-center gap-3">
              {b?.logo_url ? (
                <img
                  src={b.logo_url}
                  alt="Firm logo"
                  className="h-8 w-auto object-contain rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Image className="w-3.5 h-3.5" /> No logo set
                </div>
              )}
              {b?.logo_url && (
                <span className="text-[10px] text-slate-600 font-mono truncate max-w-[200px]">{b.logo_url}</span>
              )}
            </div>
          </div>

          {/* Colors */}
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex-shrink-0">Colors</span>
            <div className="flex items-center gap-3">
              {b?.primary_color && (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded border border-slate-600" style={{ backgroundColor: b.primary_color }} />
                  <span className="text-xs text-slate-400 font-mono">{b.primary_color}</span>
                  <span className="text-[10px] text-slate-600">primary</span>
                </div>
              )}
              {b?.accent_color && (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded border border-slate-600" style={{ backgroundColor: b.accent_color }} />
                  <span className="text-xs text-slate-400 font-mono">{b.accent_color}</span>
                  <span className="text-[10px] text-slate-600">accent</span>
                </div>
              )}
              {!b?.primary_color && !b?.accent_color && (
                <span className="text-xs text-slate-600">Using platform defaults</span>
              )}
            </div>
          </div>

          {/* Identity */}
          <div className="px-5 py-3 flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex-shrink-0">Display Name</span>
            <span className="text-sm text-white">{b?.display_name ?? '—'}</span>
          </div>
          <div className="px-5 py-3 flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex-shrink-0">Short Name</span>
            <span className="text-sm text-white">{b?.short_name ?? '—'}</span>
          </div>

          {/* Messages */}
          <div className="px-5 py-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Welcome Message</span>
            <p className="text-sm text-slate-300 leading-relaxed">
              {b?.client_portal_welcome_message ?? <span className="text-slate-600">No welcome message set</span>}
            </p>
          </div>
          <div className="px-5 py-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Footer Message</span>
            <p className="text-sm text-slate-300 leading-relaxed">
              {b?.client_portal_footer_message ?? <span className="text-slate-600">No footer message set</span>}
            </p>
          </div>
        </div>
      ) : f && (
        /* ── Edit form ── */
        <div className="p-5 space-y-5">
          {/* Logo */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">Logo</p>
            <div>
              <label className={lbl}>Logo URL (full size)</label>
              <input
                className={inp}
                value={f.logo_url}
                onChange={(e) => setF('logo_url', e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-[10px] text-slate-600 mt-1">V1: paste a direct image URL. V2: file upload to S3.</p>
            </div>
            <div>
              <label className={lbl}>Logo URL (small / email-safe, ≈200×60)</label>
              <input
                className={inp}
                value={f.logo_small_url}
                onChange={(e) => setF('logo_small_url', e.target.value)}
                placeholder="https://example.com/logo-small.png"
              />
            </div>
            {f.logo_url && (
              <div className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
                <span className="text-[10px] text-slate-500 uppercase tracking-wide">Preview:</span>
                <img
                  src={f.logo_url}
                  alt="Logo preview"
                  className="h-8 w-auto object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}
          </div>

          {/* Colors */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">Colors</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={f.primary_color}
                    onChange={(e) => setF('primary_color', e.target.value)}
                    className="w-10 h-9 rounded-lg border border-slate-700 bg-slate-800 cursor-pointer [color-scheme:dark]"
                  />
                  <input
                    className={`${inp} font-mono`}
                    value={f.primary_color}
                    onChange={(e) => setF('primary_color', e.target.value)}
                    placeholder="#f59e0b"
                    maxLength={7}
                  />
                </div>
              </div>
              <div>
                <label className={lbl}>Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={f.accent_color}
                    onChange={(e) => setF('accent_color', e.target.value)}
                    className="w-10 h-9 rounded-lg border border-slate-700 bg-slate-800 cursor-pointer [color-scheme:dark]"
                  />
                  <input
                    className={`${inp} font-mono`}
                    value={f.accent_color}
                    onChange={(e) => setF('accent_color', e.target.value)}
                    placeholder="#1e40af"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>
            {/* Color preview swatch */}
            <div className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
              <div className="h-6 flex-1 rounded-lg" style={{ backgroundColor: f.primary_color }} />
              <div className="h-6 flex-1 rounded-lg" style={{ backgroundColor: f.accent_color }} />
            </div>
          </div>

          {/* Identity */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">Firm Identity</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Display Name</label>
                <input
                  className={inp}
                  value={f.display_name}
                  onChange={(e) => setF('display_name', e.target.value)}
                  placeholder="Majors Law Group"
                />
              </div>
              <div>
                <label className={lbl}>Short Name</label>
                <input
                  className={inp}
                  value={f.short_name}
                  onChange={(e) => setF('short_name', e.target.value)}
                  placeholder="MLG"
                  maxLength={20}
                />
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">Client-Facing Messages</p>
            <div>
              <label className={lbl}>Portal Welcome Message</label>
              <textarea
                className={`${inp} resize-none`}
                rows={3}
                value={f.client_portal_welcome_message}
                onChange={(e) => setF('client_portal_welcome_message', e.target.value)}
                placeholder="Welcome to your client portal. Our team is here to guide you…"
              />
              <p className="text-[10px] text-slate-600 mt-1">Shown as a banner in the client portal after login.</p>
            </div>
            <div>
              <label className={lbl}>Portal Footer Message</label>
              <textarea
                className={`${inp} resize-none`}
                rows={2}
                value={f.client_portal_footer_message}
                onChange={(e) => setF('client_portal_footer_message', e.target.value)}
                placeholder="Questions? Contact us at…"
              />
            </div>
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
