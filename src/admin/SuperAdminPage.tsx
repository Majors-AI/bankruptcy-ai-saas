// MAJ-94 (V1.1) — bankruptcy.ai platform-level Super Admin page.
//
// Adds full write capability to all four editable tabs (Firms, Pricing,
// Features, Discounts) on top of the existing read-only shell.
// Tier Templates remains read-only (edit UI deferred).
//
// Note: Linear MAJ-94 specifies audit-log tables (firm_pricing_history,
// firm_features_history) that are not yet migrated. Write capability ships
// here; audit log is a follow-up migration in V1.1 phase 2.
//
// Distinct from src/SuperAdminPortal.tsx (firm-level staff productivity).
// Gated to platform_role = 'super_admin_bankruptcy_ai'.

import { useEffect, useCallback, useState } from 'react';
import FirmBrandingPanel from './FirmBrandingPanel';
import {
  Shield,
  AlertTriangle,
  Building2,
  DollarSign,
  ToggleRight,
  Tag,
  Layers,
  CheckCircle2,
  XCircle,
  Pencil,
  Save,
  X,
  Plus,
  Activity,
  TrendingUp,
  RefreshCw,
  Palette,
} from 'lucide-react';
import type { PlatformRole } from '../lib/auth';
import { supabase } from '../lib/supabase';

const MLG_FIRM_ID = '00000000-0000-0000-0000-000000000001';

// ─── Shared input styles ──────────────────────────────────────────────────────

const inp = 'w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-colors';
const inpSm = 'bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-colors';
const lbl = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  currentUserRole?: PlatformRole | null;
}

type AdminTab = 'firms' | 'pricing' | 'features' | 'discounts' | 'tier_templates' | 'usage' | 'branding';

interface Firm {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
}

interface FirmPricing {
  firm_id: string;
  subscription_amount_cents: number | null;
  per_case_fee_cents: number | null;
  included_cases_per_month: number | null;
  vendor_pass_through_enabled: boolean;
  vendor_markup_pct: number;
  autopay_enabled: boolean;
  billing_email: string | null;
  stripe_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  notes: string | null;
  updated_at: string;
}

interface PricingForm {
  subscription_amount_dollars: string;
  per_case_fee_dollars: string;
  included_cases_per_month: string;
  vendor_pass_through_enabled: boolean;
  vendor_markup_pct: string;
  autopay_enabled: boolean;
  billing_email: string;
  notes: string;
}

interface FeatureDefinition {
  feature_key: string;
  name: string;
  description: string | null;
  category: string;
  is_active: boolean;
}

interface FirmFeature {
  feature_key: string;
  enabled: boolean;
}

interface FirmDiscount {
  id: string;
  discount_type: string;
  discount_value: number;
  applied_at: string;
  expires_at: string | null;
  reason: string | null;
  is_active: boolean;
}

interface DiscountForm {
  discount_type: string;
  discount_value: string;
  expires_at: string;
  reason: string;
}

interface TierTemplate {
  template_key: string;
  name: string;
  default_monthly_amount_cents: number | null;
  default_per_case_fee_cents: number | null;
  default_included_cases: number | null;
  default_vendor_markup_pct: number | null;
  description: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCents(c: number | null | undefined): string {
  if (c == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(c / 100);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function dollarsToCents(s: string): number | null {
  const n = parseFloat(s.replace(/[$,]/g, ''));
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

function statusColor(status: string): string {
  switch (status) {
    case 'active':    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
    case 'trial':     return 'text-sky-400 bg-sky-500/10 border-sky-500/25';
    case 'lead':      return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
    case 'suspended': return 'text-orange-400 bg-orange-500/10 border-orange-500/25';
    case 'churned':   return 'text-red-400 bg-red-500/10 border-red-500/25';
    default:          return 'text-slate-400 bg-slate-700/40 border-slate-600/40';
  }
}

function discountValueLabel(type: string, value: number): string {
  switch (type) {
    case 'subscription_pct':
    case 'per_case_pct':       return `${value}%`;
    case 'flat_amount_cents':  return fmtCents(value);
    case 'free_months':        return `${value} month${value === 1 ? '' : 's'} free`;
    default:                   return String(value);
  }
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function LoadingRow() {
  return <div className="text-center py-12 text-xs text-slate-600">Loading…</div>;
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="bg-red-500/8 border border-red-500/25 rounded-xl px-4 py-3 flex items-start gap-2.5">
      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-bold text-red-300">Could not load data</p>
        <p className="text-xs text-slate-400 mt-1 break-all">{message}</p>
        <p className="text-xs text-slate-600 mt-2">
          RLS requires <code className="text-slate-400">super_admin_bankruptcy_ai</code> role.
        </p>
      </div>
    </div>
  );
}

function SaveErr({ message }: { message: string }) {
  return (
    <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
      {message}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-5 py-3 flex items-start justify-between gap-4">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex-shrink-0">{label}</span>
      <span className={`text-sm text-white text-right ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function SuperAdminPage({ currentUserRole }: Props) {
  // All hooks before any early return (rules-of-hooks).
  const [activeTab, setActiveTab] = useState<AdminTab>('firms');
  const [selectedFirmId, setSelectedFirmId] = useState<string>(MLG_FIRM_ID);
  const [allFirms, setAllFirms] = useState<Pick<Firm, 'id' | 'name'>[]>([]);

  useEffect(() => {
    supabase
      .from('firms')
      .select('id, name')
      .order('name')
      .then(({ data }) => { if (data) setAllFirms(data as Pick<Firm, 'id' | 'name'>[]); });
  }, []);

  const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'firms',          label: 'Firms',          icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'pricing',        label: 'Pricing',        icon: <DollarSign className="w-3.5 h-3.5" /> },
    { id: 'features',       label: 'Features',       icon: <ToggleRight className="w-3.5 h-3.5" /> },
    { id: 'discounts',      label: 'Discounts',      icon: <Tag className="w-3.5 h-3.5" /> },
    { id: 'tier_templates', label: 'Tier Templates', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'usage',          label: 'Usage & Billing', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'branding',       label: 'Branding',        icon: <Palette className="w-3.5 h-3.5" /> },
  ];

  const selectedFirmName = allFirms.find((f) => f.id === selectedFirmId)?.name ?? selectedFirmId.slice(0, 8);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Georgia', serif" }}>
              bankruptcy<span className="text-amber-400">.ai</span> Super Admin
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Platform-level controls — multi-firm tenant management
            </p>
          </div>
          {/* Firm picker — applies to Pricing / Features / Discounts tabs */}
          {activeTab !== 'firms' && activeTab !== 'tier_templates' && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-slate-500">Firm:</span>
              <select
                value={selectedFirmId}
                onChange={(e) => setSelectedFirmId(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500/60 transition-colors"
              >
                {allFirms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}
          {(activeTab === 'firms' || activeTab === 'tier_templates') && (
            <div className="ml-auto text-xs text-slate-600">
              All firms
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-6">
        {/* Tab nav */}
        <div className="flex items-center gap-1 mb-6 border-b border-slate-800">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === t.id
                  ? 'text-amber-400 border-amber-400'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'firms'          && <FirmsTab />}
        {activeTab === 'pricing'        && <PricingTab firmId={selectedFirmId} firmName={selectedFirmName} />}
        {activeTab === 'features'       && <FeaturesTab firmId={selectedFirmId} firmName={selectedFirmName} />}
        {activeTab === 'discounts'      && <DiscountsTab firmId={selectedFirmId} firmName={selectedFirmName} />}
        {activeTab === 'tier_templates' && <TierTemplatesTab />}
        {activeTab === 'usage'          && <UsageTab />}
        {activeTab === 'branding'       && (
          <FirmBrandingPanel firmId={selectedFirmId} firmName={selectedFirmName} />
        )}
      </div>
    </div>
  );
}

// ─── Firms tab — inline edit per row ─────────────────────────────────────────

const FIRM_STATUSES = ['lead', 'trial', 'active', 'suspended', 'churned'] as const;

function FirmsTab() {
  const [rows, setRows] = useState<Firm[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; slug: string; status: string }>({ name: '', slug: '', status: '' });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('firms')
      .select('id, name, slug, status, created_at')
      .order('created_at', { ascending: true });
    if (error) setErr(error.message);
    else setRows(data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(f: Firm) {
    setEditingId(f.id);
    setEditForm({ name: f.name, slug: f.slug, status: f.status });
    setSaveErr(null);
  }

  function cancelEdit() { setEditingId(null); setSaveErr(null); }

  async function saveEdit(firmId: string) {
    if (!editForm.name.trim() || !editForm.slug.trim()) {
      setSaveErr('Name and slug are required.');
      return;
    }
    setSavingId(firmId);
    setSaveErr(null);
    const { error } = await supabase
      .from('firms')
      .update({ name: editForm.name.trim(), slug: editForm.slug.trim(), status: editForm.status })
      .eq('id', firmId);
    setSavingId(null);
    if (error) { setSaveErr(error.message); return; }
    // Optimistic commit
    setRows((prev) => prev?.map((f) =>
      f.id === firmId ? { ...f, name: editForm.name.trim(), slug: editForm.slug.trim(), status: editForm.status } : f
    ) ?? prev);
    setEditingId(null);
  }

  return (
    <section>
      {err && <ErrorRow message={err} />}
      {rows == null && !err && <LoadingRow />}
      {rows != null && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-4 py-3">Slug</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {rows.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-xs text-slate-600">No firms found.</td></tr>
              )}
              {rows.map((f) => {
                const isEditing = editingId === f.id;
                const isSaving  = savingId  === f.id;
                return (
                  <tr key={f.id} className={`transition-colors ${isEditing ? 'bg-slate-800/50' : 'hover:bg-slate-800/30'}`}>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input
                          className={inp}
                          value={editForm.name}
                          onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm font-semibold text-white">{f.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          className={inp}
                          value={editForm.slug}
                          onChange={(e) => setEditForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                          placeholder="url-slug"
                        />
                      ) : (
                        <span className="text-xs font-mono text-slate-400">{f.slug}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          className={inpSm}
                          value={editForm.status}
                          onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                        >
                          {FIRM_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusColor(f.status)}`}>
                          {f.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(f.created_at)}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => saveEdit(f.id)}
                            disabled={isSaving}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
                          >
                            {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(f)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                          title="Edit firm"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {saveErr && (
            <div className="px-5 py-3 border-t border-slate-800">
              <SaveErr message={saveErr} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Pricing tab — full-section edit mode ─────────────────────────────────────

function pricingToForm(row: FirmPricing): PricingForm {
  return {
    subscription_amount_dollars:  row.subscription_amount_cents != null ? String(row.subscription_amount_cents / 100) : '',
    per_case_fee_dollars:         row.per_case_fee_cents         != null ? String(row.per_case_fee_cents / 100)         : '',
    included_cases_per_month:     row.included_cases_per_month   != null ? String(row.included_cases_per_month)         : '',
    vendor_pass_through_enabled:  row.vendor_pass_through_enabled,
    vendor_markup_pct:            String(row.vendor_markup_pct ?? 0),
    autopay_enabled:              row.autopay_enabled,
    billing_email:                row.billing_email ?? '',
    notes:                        row.notes ?? '',
  };
}

function PricingTab({ firmId, firmName }: { firmId: string; firmName: string }) {
  const [row, setRow]     = useState<FirmPricing | null>(null);
  const [err, setErr]     = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm]   = useState<PricingForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoaded(false);
    const { data, error } = await supabase
      .from('firm_pricing')
      .select('*')
      .eq('firm_id', firmId)
      .maybeSingle();
    if (error) setErr(error.message);
    else { setRow(data as FirmPricing | null); setErr(null); }
    setLoaded(true);
    setEditing(false);
  }, [firmId]);

  useEffect(() => { load(); }, [load]);

  function startEdit() {
    if (!row) return;
    setForm(pricingToForm(row));
    setSaveErr(null);
    setEditing(true);
  }

  function cancelEdit() { setEditing(false); setSaveErr(null); }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setSaveErr(null);

    const payload: Partial<FirmPricing> & { firm_id: string } = {
      firm_id: firmId,
      subscription_amount_cents: dollarsToCents(form.subscription_amount_dollars),
      per_case_fee_cents:        dollarsToCents(form.per_case_fee_dollars),
      included_cases_per_month:  form.included_cases_per_month ? parseInt(form.included_cases_per_month) : null,
      vendor_pass_through_enabled: form.vendor_pass_through_enabled,
      vendor_markup_pct:           parseFloat(form.vendor_markup_pct) || 0,
      autopay_enabled:             form.autopay_enabled,
      billing_email:               form.billing_email || null,
      notes:                       form.notes || null,
    };

    const { data, error } = await supabase
      .from('firm_pricing')
      .upsert(payload, { onConflict: 'firm_id' })
      .select('*')
      .maybeSingle();

    setSaving(false);
    if (error) { setSaveErr(error.message); return; }
    setRow(data as FirmPricing);
    setEditing(false);
  }

  const f = form;

  return (
    <section>
      {err && <ErrorRow message={err} />}
      {!loaded && !err && <LoadingRow />}
      {loaded && !row && !err && (
        <p className="text-xs text-slate-600 py-8 text-center">No pricing row for {firmName}.</p>
      )}
      {loaded && row && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/40 flex items-center justify-between">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">{firmName}</p>
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
                  onClick={cancelEdit}
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

          {/* Fields */}
          <div className="divide-y divide-slate-800/60">
            {!editing ? (
              <>
                <Row label="Subscription"           value={fmtCents(row.subscription_amount_cents)} />
                <Row label="Per-case fee"            value={fmtCents(row.per_case_fee_cents)} />
                <Row label="Included cases / month"  value={row.included_cases_per_month == null ? 'Unlimited' : String(row.included_cases_per_month)} />
                <Row label="Vendor pass-through"     value={row.vendor_pass_through_enabled ? `Enabled — markup ${row.vendor_markup_pct}%` : 'Disabled'} />
                <Row label="Autopay"                 value={row.autopay_enabled ? 'On' : 'Off'} />
                <Row label="Billing email"           value={row.billing_email ?? '—'} />
                <Row label="Stripe customer"         value={row.stripe_customer_id ?? '—'} mono />
                <Row label="Current period"          value={row.current_period_start || row.current_period_end ? `${fmtDate(row.current_period_start)} → ${fmtDate(row.current_period_end)}` : '—'} />
                <Row label="Notes"                   value={row.notes ?? '—'} />
                <Row label="Updated"                 value={fmtDate(row.updated_at)} />
              </>
            ) : f && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Subscription ($/month)</label>
                    <input className={inp} type="number" min={0} step={0.01} value={f.subscription_amount_dollars}
                      onChange={(e) => setForm((p) => p && ({ ...p, subscription_amount_dollars: e.target.value }))}
                      placeholder="0.00" />
                  </div>
                  <div>
                    <label className={lbl}>Per-case fee ($)</label>
                    <input className={inp} type="number" min={0} step={0.01} value={f.per_case_fee_dollars}
                      onChange={(e) => setForm((p) => p && ({ ...p, per_case_fee_dollars: e.target.value }))}
                      placeholder="0.00" />
                  </div>
                  <div>
                    <label className={lbl}>Included cases / month (blank = unlimited)</label>
                    <input className={inp} type="number" min={0} value={f.included_cases_per_month}
                      onChange={(e) => setForm((p) => p && ({ ...p, included_cases_per_month: e.target.value }))}
                      placeholder="Unlimited" />
                  </div>
                  <div>
                    <label className={lbl}>Vendor markup %</label>
                    <input className={inp} type="number" min={0} step={0.1} value={f.vendor_markup_pct}
                      onChange={(e) => setForm((p) => p && ({ ...p, vendor_markup_pct: e.target.value }))}
                      placeholder="0" />
                  </div>
                  <div>
                    <label className={lbl}>Billing email</label>
                    <input className={inp} type="email" value={f.billing_email}
                      onChange={(e) => setForm((p) => p && ({ ...p, billing_email: e.target.value }))}
                      placeholder="billing@firm.com" />
                  </div>
                </div>
                {/* Toggles */}
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setForm((p) => p && ({ ...p, vendor_pass_through_enabled: !p.vendor_pass_through_enabled }))}
                      className={`w-9 h-5 rounded-full transition-colors relative ${f.vendor_pass_through_enabled ? 'bg-amber-500' : 'bg-slate-700'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${f.vendor_pass_through_enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-xs text-slate-300">Vendor pass-through</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setForm((p) => p && ({ ...p, autopay_enabled: !p.autopay_enabled }))}
                      className={`w-9 h-5 rounded-full transition-colors relative ${f.autopay_enabled ? 'bg-amber-500' : 'bg-slate-700'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${f.autopay_enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-xs text-slate-300">Autopay</span>
                  </label>
                </div>
                {/* Notes */}
                <div>
                  <label className={lbl}>Notes</label>
                  <textarea
                    className={`${inp} resize-none`}
                    rows={3}
                    value={f.notes}
                    onChange={(e) => setForm((p) => p && ({ ...p, notes: e.target.value }))}
                    placeholder="Internal notes about this firm's pricing…"
                  />
                </div>
                {saveErr && <SaveErr message={saveErr} />}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Features tab — interactive toggles ──────────────────────────────────────

function FeaturesTab({ firmId, firmName }: { firmId: string; firmName: string }) {
  const [defs, setDefs]       = useState<FeatureDefinition[] | null>(null);
  const [firmFlags, setFirmFlags] = useState<Record<string, boolean>>({});
  const [err, setErr]         = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toggleErr, setToggleErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [defsRes, flagsRes] = await Promise.all([
      supabase
        .from('feature_flag_definitions')
        .select('feature_key, name, description, category, is_active')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('feature_key', { ascending: true }),
      supabase
        .from('firm_features')
        .select('feature_key, enabled')
        .eq('firm_id', firmId),
    ]);
    if (defsRes.error)  { setErr(defsRes.error.message);  return; }
    if (flagsRes.error) { setErr(flagsRes.error.message); return; }
    setDefs(defsRes.data ?? []);
    const map: Record<string, boolean> = {};
    for (const r of (flagsRes.data ?? []) as FirmFeature[]) map[r.feature_key] = r.enabled === true;
    setFirmFlags(map);
    setErr(null);
  }, [firmId]);

  useEffect(() => { load(); }, [load]);

  async function toggleFlag(key: string) {
    const current = firmFlags[key] === true;
    const next = !current;
    // Optimistic update
    setFirmFlags((prev) => ({ ...prev, [key]: next }));
    setToggling(key);
    setToggleErr(null);

    const { error } = await supabase
      .from('firm_features')
      .upsert({ firm_id: firmId, feature_key: key, enabled: next }, { onConflict: 'firm_id,feature_key' });

    setToggling(null);
    if (error) {
      // Revert optimistic update
      setFirmFlags((prev) => ({ ...prev, [key]: current }));
      setToggleErr(`Failed to toggle ${key}: ${error.message}`);
    }
  }

  const grouped = (defs ?? []).reduce<Record<string, FeatureDefinition[]>>((acc, d) => {
    (acc[d.category] ||= []).push(d);
    return acc;
  }, {});
  const categories = Object.keys(grouped).sort();

  const enabledCount = Object.values(firmFlags).filter(Boolean).length;
  const totalCount   = defs?.length ?? 0;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-500">
          {firmName} — {enabledCount}/{totalCount} features enabled
        </p>
      </div>
      {err && <ErrorRow message={err} />}
      {toggleErr && <div className="mb-3"><SaveErr message={toggleErr} /></div>}
      {defs == null && !err && <LoadingRow />}
      {defs != null && (
        <div className="space-y-4">
          {categories.map((cat) => (
            <div key={cat} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/40 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-400">{cat}</p>
                <span className="text-[10px] text-slate-600">
                  {grouped[cat].filter((d) => firmFlags[d.feature_key]).length}/{grouped[cat].length} on
                </span>
              </div>
              <div className="divide-y divide-slate-800/60">
                {grouped[cat].map((d) => {
                  const on = firmFlags[d.feature_key] === true;
                  const isToggling = toggling === d.feature_key;
                  return (
                    <div key={d.feature_key} className="px-5 py-3 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{d.name}</p>
                        {d.description && (
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{d.description}</p>
                        )}
                        <code className="text-[10px] text-slate-700 font-mono mt-1 inline-block">{d.feature_key}</code>
                      </div>
                      {/* Toggle button */}
                      <button
                        onClick={() => !isToggling && toggleFlag(d.feature_key)}
                        disabled={isToggling}
                        title={on ? 'Disable feature' : 'Enable feature'}
                        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                      >
                        {isToggling ? (
                          <RefreshCw className="w-3 h-3 text-white absolute top-1.5 left-4 animate-spin" />
                        ) : (
                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
                        )}
                      </button>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0 ${
                        on
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                          : 'text-slate-500 bg-slate-800 border-slate-700'
                      }`}>
                        {on ? 'On' : 'Off'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Discounts tab — add + deactivate ─────────────────────────────────────────

const DISCOUNT_TYPES = [
  { value: 'subscription_pct', label: 'Subscription % off' },
  { value: 'per_case_pct',     label: 'Per-case fee % off' },
  { value: 'flat_amount_cents', label: 'Flat amount off ($)' },
  { value: 'free_months',      label: 'Free months' },
] as const;

const BLANK_DISCOUNT: DiscountForm = { discount_type: 'subscription_pct', discount_value: '', expires_at: '', reason: '' };

function DiscountsTab({ firmId, firmName }: { firmId: string; firmName: string }) {
  const [rows, setRows]       = useState<FirmDiscount[] | null>(null);
  const [err, setErr]         = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<DiscountForm>(BLANK_DISCOUNT);
  const [addSaving, setAddSaving] = useState(false);
  const [addErr, setAddErr]   = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('firm_discounts')
      .select('id, discount_type, discount_value, applied_at, expires_at, reason, is_active')
      .eq('firm_id', firmId)
      .order('applied_at', { ascending: false });
    if (error) setErr(error.message);
    else { setRows(data ?? []); setErr(null); }
  }, [firmId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!addForm.discount_value) { setAddErr('Value is required.'); return; }
    setAddSaving(true);
    setAddErr(null);

    let value = parseFloat(addForm.discount_value);
    if (addForm.discount_type === 'flat_amount_cents') value = Math.round(value * 100);

    const { error } = await supabase.from('firm_discounts').insert({
      firm_id:        firmId,
      discount_type:  addForm.discount_type,
      discount_value: value,
      expires_at:     addForm.expires_at || null,
      reason:         addForm.reason || null,
      is_active:      true,
    });

    setAddSaving(false);
    if (error) { setAddErr(error.message); return; }
    setShowAdd(false);
    setAddForm(BLANK_DISCOUNT);
    load();
  }

  async function deactivate(id: string) {
    setDeactivatingId(id);
    const { error } = await supabase.from('firm_discounts').update({ is_active: false }).eq('id', id);
    setDeactivatingId(null);
    if (error) { setErr(error.message); return; }
    setRows((prev) => prev?.map((d) => d.id === id ? { ...d, is_active: false } : d) ?? prev);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-500">{firmName}</p>
        <button
          onClick={() => { setShowAdd((v) => !v); setAddErr(null); setAddForm(BLANK_DISCOUNT); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/20 transition-colors"
        >
          <Plus className="w-3 h-3" /> Add Discount
        </button>
      </div>

      {/* Add discount form */}
      {showAdd && (
        <div className="mb-4 p-4 bg-slate-900 border border-slate-700/60 rounded-2xl space-y-3">
          <p className="text-xs font-bold text-white">New Discount</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Type</label>
              <select className={inp} value={addForm.discount_type}
                onChange={(e) => setAddForm((p) => ({ ...p, discount_type: e.target.value }))}>
                {DISCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>
                Value ({addForm.discount_type === 'flat_amount_cents' ? '$' : addForm.discount_type === 'free_months' ? 'months' : '%'})
              </label>
              <input className={inp} type="number" min={0} step={addForm.discount_type === 'flat_amount_cents' ? 0.01 : 1}
                value={addForm.discount_value}
                onChange={(e) => setAddForm((p) => ({ ...p, discount_value: e.target.value }))}
                placeholder="0" />
            </div>
            <div>
              <label className={lbl}>Expires (optional)</label>
              <input className={`${inp} [color-scheme:dark]`} type="date" value={addForm.expires_at}
                onChange={(e) => setAddForm((p) => ({ ...p, expires_at: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>Reason</label>
              <input className={inp} value={addForm.reason}
                onChange={(e) => setAddForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="e.g. V1 pilot comp" />
            </div>
          </div>
          {addErr && <SaveErr message={addErr} />}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-700 hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button onClick={handleAdd} disabled={addSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50">
              {addSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Add
            </button>
          </div>
        </div>
      )}

      {err && <ErrorRow message={err} />}
      {rows == null && !err && <LoadingRow />}
      {rows != null && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <th className="text-left px-5 py-3">Type</th>
                <th className="text-left px-4 py-3">Value</th>
                <th className="text-left px-4 py-3">Active</th>
                <th className="text-left px-4 py-3">Applied</th>
                <th className="text-left px-4 py-3">Expires</th>
                <th className="text-left px-4 py-3">Reason</th>
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {rows.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-xs text-slate-600">No discounts for {firmName}.</td></tr>
              )}
              {rows.map((d) => (
                <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3 text-xs font-mono text-slate-300">{d.discount_type}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-white">{discountValueLabel(d.discount_type, d.discount_value)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold ${d.is_active ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {d.is_active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(d.applied_at)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(d.expires_at)}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{d.reason ?? '—'}</td>
                  <td className="px-4 py-3">
                    {d.is_active && (
                      <button
                        onClick={() => deactivate(d.id)}
                        disabled={deactivatingId === d.id}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-red-400 border border-red-700/40 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      >
                        {deactivatingId === d.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── Usage & Billing tab ─────────────────────────────────────────────────────

interface UsageEvent {
  firm_id: string;
  event_type: string;
  vendor_cost_cents: number;
  recorded_at: string;
}

interface FirmUsageSummary {
  firmId: string;
  firmName: string;
  allTime: Record<string, number>;
  currentMonth: Record<string, number>;
  vendorCostCentsAllTime: number;
  vendorCostCentsCurrentMonth: number;
}

const USAGE_EVENT_LABELS: Record<string, string> = {
  client_created:                   'Clients Created',
  plaid_bank_connected:             'Plaid Bank Connections',
  plaid_income_connected:           'Plaid Income Connections',
  plaid_bank_statement_generated:   'Bank Statements Generated',
  plaid_income_doc_generated:       'Income Docs Generated',
  document_uploaded:                'Documents Uploaded',
  bci_export_generated:             'BCI Exports',
  zip_export_generated:             'ZIP Exports',
  sms_sent:                         'SMS Sent',
  email_sent:                       'Emails Sent',
};

const PLAID_EVENT_TYPES = new Set([
  'plaid_bank_connected',
  'plaid_income_connected',
  'plaid_bank_statement_generated',
  'plaid_income_doc_generated',
]);

function startOfCurrentMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function UsageTab() {
  const [firms, setFirms] = useState<Firm[] | null>(null);
  const [events, setEvents] = useState<UsageEvent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [window, setWindow] = useState<'month' | 'all'>('month');

  const load = async () => {
    setLoading(true);
    setErr(null);
    const [firmsRes, eventsRes] = await Promise.all([
      supabase.from('firms').select('id, name, slug, status').order('name'),
      supabase
        .from('firm_usage_events')
        .select('firm_id, event_type, vendor_cost_cents, recorded_at')
        .order('recorded_at', { ascending: false }),
    ]);
    if (firmsRes.error) { setErr(firmsRes.error.message); setLoading(false); return; }
    if (eventsRes.error) { setErr(eventsRes.error.message); setLoading(false); return; }
    setFirms(firmsRes.data ?? []);
    setEvents(eventsRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { let cancelled = false; load().then(() => { if (cancelled) return; }); return () => { cancelled = true; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const summaries: FirmUsageSummary[] = (firms ?? []).map((firm) => {
    const monthStart = startOfCurrentMonth();
    const firmEvents = (events ?? []).filter((e) => e.firm_id === firm.id);
    const allTime: Record<string, number> = {};
    const currentMonth: Record<string, number> = {};
    let vendorCostAllTime = 0;
    let vendorCostMonth = 0;
    for (const ev of firmEvents) {
      allTime[ev.event_type] = (allTime[ev.event_type] ?? 0) + 1;
      vendorCostAllTime += ev.vendor_cost_cents ?? 0;
      if (ev.recorded_at >= monthStart) {
        currentMonth[ev.event_type] = (currentMonth[ev.event_type] ?? 0) + 1;
        vendorCostMonth += ev.vendor_cost_cents ?? 0;
      }
    }
    return { firmId: firm.id, firmName: firm.name, allTime, currentMonth, vendorCostCentsAllTime: vendorCostAllTime, vendorCostCentsCurrentMonth: vendorCostMonth };
  });

  const activeSummaries = summaries.filter((s) =>
    (firms ?? []).find((f) => f.id === s.firmId)?.status === 'active'
  );
  const totalEvents = (events ?? []).length;
  const monthStart = startOfCurrentMonth();
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <section className="space-y-5">
      <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <DollarSign className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-amber-300">V1 Pilot — Both firms are comped</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
            MLG and Neeley run at no charge during the pilot. This dashboard captures usage data
            so pricing can be set from real numbers after the pilot ends.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white">Usage by Firm</h2>
          <p className="text-xs text-slate-500 mt-0.5">{totalEvents.toLocaleString()} total events recorded</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors" title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex items-center bg-slate-800/70 border border-slate-700/50 rounded-lg p-0.5 gap-0.5">
            {(['month', 'all'] as const).map((w) => (
              <button key={w} onClick={() => setWindow(w)} className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${window === w ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>
                {w === 'month' ? monthLabel : 'All Time'}
              </button>
            ))}
          </div>
        </div>
      </div>
      {err ? <ErrorRow message={err} /> : loading ? <LoadingRow /> : events!.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
          <Activity className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-400">No usage events recorded yet</p>
          <p className="text-xs text-slate-600 mt-1.5 max-w-sm mx-auto leading-relaxed">
            Events are logged as clients are created, documents uploaded, Plaid connected, and exports generated.
          </p>
        </div>
      ) : (
        <>
          <div className={`grid gap-4 ${activeSummaries.length >= 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-lg'}`}>
            {activeSummaries.map((s) => {
              const counts = window === 'month' ? s.currentMonth : s.allTime;
              const vendorCost = window === 'month' ? s.vendorCostCentsCurrentMonth : s.vendorCostCentsAllTime;
              const caseCount = counts['client_created'] ?? 0;
              const plaidCost = (events ?? [])
                .filter((e) => e.firm_id === s.firmId && PLAID_EVENT_TYPES.has(e.event_type))
                .filter((e) => window === 'all' || e.recorded_at >= monthStart)
                .reduce((sum, e) => sum + (e.vendor_cost_cents ?? 0), 0);
              return (
                <div key={s.firmId} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/40 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">{s.firmName}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-mono">{s.firmId.slice(0, 8)}…</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-amber-400">{caseCount.toLocaleString()}</p>
                      <p className="text-[11px] text-slate-500">cases</p>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-800/50">
                    {Object.entries(USAGE_EVENT_LABELS).map(([key, label]) => {
                      const count = counts[key] ?? 0;
                      const isPlaid = PLAID_EVENT_TYPES.has(key);
                      return (
                        <div key={key} className="px-5 py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-slate-400 truncate">{label}</span>
                            {isPlaid && <span className="text-[9px] font-bold text-sky-400 bg-sky-900/30 border border-sky-700/30 px-1 py-0.5 rounded flex-shrink-0">PLAID</span>}
                          </div>
                          <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ml-4 ${count > 0 ? 'text-white' : 'text-slate-700'}`}>
                            {count.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                    <div className="px-5 py-2.5 flex items-center justify-between bg-slate-800/20">
                      <span className="text-xs font-semibold text-slate-400">Plaid Vendor Cost</span>
                      <span className={`text-sm font-semibold ${plaidCost > 0 ? 'text-amber-300' : 'text-slate-700'}`}>{plaidCost > 0 ? fmtCents(plaidCost) : '—'}</span>
                    </div>
                    <div className="px-5 py-2.5 flex items-center justify-between bg-slate-800/20">
                      <span className="text-xs font-semibold text-slate-400">Total Vendor Cost</span>
                      <span className={`text-sm font-semibold ${vendorCost > 0 ? 'text-amber-300' : 'text-slate-700'}`}>{vendorCost > 0 ? fmtCents(vendorCost) : '—'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {activeSummaries.length >= 2 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/40 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-xs font-bold text-white">Per-Case Averages — {window === 'month' ? monthLabel : 'All Time'}</p>
                <p className="text-xs text-slate-500 ml-1">(feeds V1 pricing model)</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <th className="text-left px-5 py-3">Metric</th>
                    {activeSummaries.map((s) => <th key={s.firmId} className="text-right px-4 py-3">{s.firmName}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {Object.entries(USAGE_EVENT_LABELS).map(([key, label]) => (
                    <tr key={key} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-5 py-2.5 text-xs text-slate-400">{label}</td>
                      {activeSummaries.map((s) => {
                        const counts = window === 'month' ? s.currentMonth : s.allTime;
                        const cases = counts['client_created'] ?? 0;
                        const count = counts[key] ?? 0;
                        const avg = cases > 0 ? (count / cases).toFixed(1) : '—';
                        return (
                          <td key={s.firmId} className="px-4 py-2.5 text-sm text-right tabular-nums">
                            <span className={count > 0 ? 'text-white' : 'text-slate-700'}>{count.toLocaleString()}</span>
                            {cases > 0 && count > 0 && <span className="text-[11px] text-slate-600 ml-1.5">({avg}/case)</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="bg-slate-800/20">
                    <td className="px-5 py-2.5 text-xs font-semibold text-slate-400">Total Vendor Cost</td>
                    {activeSummaries.map((s) => {
                      const cost = window === 'month' ? s.vendorCostCentsCurrentMonth : s.vendorCostCentsAllTime;
                      const cases = (window === 'month' ? s.currentMonth : s.allTime)['client_created'] ?? 0;
                      const perCase = cases > 0 && cost > 0 ? fmtCents(Math.round(cost / cases)) : null;
                      return (
                        <td key={s.firmId} className="px-4 py-2.5 text-sm text-right">
                          <span className={cost > 0 ? 'text-amber-300 font-semibold' : 'text-slate-700'}>{cost > 0 ? fmtCents(cost) : '—'}</span>
                          {perCase && <span className="text-[11px] text-slate-600 ml-1.5">({perCase}/case)</span>}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ─── Tier templates tab — read-only (edit in V1.1 phase 2) ───────────────────

function TierTemplatesTab() {
  const [rows, setRows] = useState<TierTemplate[] | null>(null);
  const [err, setErr]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('tier_templates')
        .select('template_key, name, default_monthly_amount_cents, default_per_case_fee_cents, default_included_cases, default_vendor_markup_pct, description')
        .order('template_key', { ascending: true });
      if (cancelled) return;
      if (error) setErr(error.message);
      else setRows(data ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <section>
      <div className="bg-sky-500/8 border border-sky-500/20 rounded-xl px-3.5 py-2 mb-4 text-xs text-sky-300/90">
        Tier template editing ships in V1.1 phase 2.
      </div>
      {err ? <ErrorRow message={err} /> : rows == null ? <LoadingRow /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.length === 0 && (
            <p className="text-xs text-slate-600 py-8 text-center md:col-span-2">No tier templates found.</p>
          )}
          {rows.map((t) => (
            <div key={t.template_key} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-bold text-white">{t.name}</p>
                  <code className="text-[10px] text-slate-600 font-mono">{t.template_key}</code>
                </div>
                <Layers className="w-4 h-4 text-amber-400/70 flex-shrink-0" />
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Default monthly</span>
                  <span className="text-slate-300">{fmtCents(t.default_monthly_amount_cents)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Default per-case</span>
                  <span className="text-slate-300">{fmtCents(t.default_per_case_fee_cents)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Default included cases</span>
                  <span className="text-slate-300">{t.default_included_cases == null ? '—' : t.default_included_cases}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Default vendor markup</span>
                  <span className="text-slate-300">{t.default_vendor_markup_pct == null ? '—' : `${t.default_vendor_markup_pct}%`}</span>
                </div>
              </div>
              {t.description && (
                <p className="text-xs text-slate-500 mt-3 leading-relaxed border-t border-slate-800 pt-3">
                  {t.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
