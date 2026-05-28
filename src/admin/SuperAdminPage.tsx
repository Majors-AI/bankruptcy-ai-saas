// BAN-40 / BAN-41 — bankruptcy.ai platform-level Super Admin page.
//
// Phase 2 (BAN-41): tabbed shell that READS the new pricing + feature tables
// (firm_pricing, firm_features, firm_discounts, tier_templates,
// feature_flag_definitions) but renders everything read-only. Full edit UIs
// are tracked in a separate BAN-41 implementation PR.
//
// Distinct from src/SuperAdminPortal.tsx (firm-level staff productivity).
// This page is gated to platform_role = 'super_admin_bankruptcy_ai' — cross-
// firm tenant management, billing oversight, system-wide controls.
//
// Selected firm is currently hardcoded to MLG (pilot). TODO BAN-41 phase 3:
// add a firm-picker dropdown driven by the firms table.

import { useEffect, useState } from 'react';
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
  Activity,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import type { PlatformRole } from '../lib/auth';
import { isBankruptcyAISuperAdmin } from '../lib/auth';
import { supabase } from '../lib/supabase';

// MLG firm id, seeded in 20260527020000_firms_and_user_profiles.sql.
const MLG_FIRM_ID = '00000000-0000-0000-0000-000000000001';

interface Props {
  // Current user's platform role. Passed in by the host router/app shell.
  // When null/undefined we treat as unauthenticated and refuse to render.
  currentUserRole?: PlatformRole | null;
}

type AdminTab = 'firms' | 'pricing' | 'features' | 'discounts' | 'tier_templates' | 'usage';

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

interface TierTemplate {
  template_key: string;
  name: string;
  default_monthly_amount_cents: number | null;
  default_per_case_fee_cents: number | null;
  default_included_cases: number | null;
  default_vendor_markup_pct: number | null;
  description: string | null;
}

function fmtCents(c: number | null | undefined): string {
  if (c == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(c / 100);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SuperAdminPage({ currentUserRole }: Props) {
  // Hooks declared up-front to comply with react-hooks/rules-of-hooks — the
  // access-denied early return below would otherwise call hooks conditionally.
  const [activeTab, setActiveTab] = useState<AdminTab>('firms');
  // TODO BAN-41 phase 3: replace hardcoded MLG with a firm-picker driven by firms table.
  const [selectedFirmId] = useState<string>(MLG_FIRM_ID);

  // TODO BAN-40 phase 2: replace this client-side gate with a server-side
  // check via user_profiles + RLS. The current client gate is informational —
  // RLS on the BAN-41 tables already denies non-super-admins at the DB layer.
  if (!isBankruptcyAISuperAdmin(currentUserRole)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Georgia', serif" }}>
            Access Denied
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            This area is reserved for bankruptcy.ai platform administrators.
            If you believe you should have access, contact your platform owner.
          </p>
          <p className="text-xs text-slate-600 mt-4">
            Required role: <code className="text-slate-400">super_admin_bankruptcy_ai</code>
            <br />
            Current role: <code className="text-slate-400">{currentUserRole ?? 'unauthenticated'}</code>
          </p>
        </div>
      </div>
    );
  }

  const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'firms',          label: 'Firms',          icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'pricing',        label: 'Pricing',        icon: <DollarSign className="w-3.5 h-3.5" /> },
    { id: 'features',       label: 'Features',       icon: <ToggleRight className="w-3.5 h-3.5" /> },
    { id: 'discounts',      label: 'Discounts',      icon: <Tag className="w-3.5 h-3.5" /> },
    { id: 'tier_templates', label: 'Tier Templates', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'usage',          label: 'Usage & Billing', icon: <Activity className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-8 py-5 flex items-center gap-3">
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
          <div className="ml-auto text-xs text-slate-600">
            Viewing firm: <code className="text-slate-400">{selectedFirmId}</code>
          </div>
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

        {activeTab === 'firms' && <FirmsTab />}
        {activeTab === 'pricing' && <PricingTab firmId={selectedFirmId} />}
        {activeTab === 'features' && <FeaturesTab firmId={selectedFirmId} />}
        {activeTab === 'discounts' && <DiscountsTab firmId={selectedFirmId} />}
        {activeTab === 'tier_templates' && <TierTemplatesTab />}
        {activeTab === 'usage' && <UsageTab />}
      </div>
    </div>
  );
}

// ─── Shared loader UI ─────────────────────────────────────────────────────────

function LoadingRow() {
  return (
    <div className="text-center py-12 text-xs text-slate-600">Loading…</div>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="bg-red-500/8 border border-red-500/25 rounded-xl px-4 py-3 flex items-start gap-2.5">
      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-bold text-red-300">Could not load data</p>
        <p className="text-xs text-slate-400 mt-1 break-all">{message}</p>
        <p className="text-xs text-slate-600 mt-2">
          This is expected until Supabase auth is wired in — the BAN-41 RLS policies
          deny anon requests. Sign in as a <code className="text-slate-400">super_admin_bankruptcy_ai</code>
          {' '}user to view rows.
        </p>
      </div>
    </div>
  );
}

function EditDisabledNotice() {
  return (
    <div className="bg-sky-500/8 border border-sky-500/20 rounded-xl px-3.5 py-2 mb-4 text-xs text-sky-300/90">
      Read-only view. Full edit UI ships in a separate BAN-41 implementation PR.
    </div>
  );
}

// ─── Firms tab ────────────────────────────────────────────────────────────────

function FirmsTab() {
  const [rows, setRows] = useState<Firm[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('firms')
        .select('id, name, slug, status, created_at')
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) setErr(error.message);
      else setRows(data ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <section>
      <EditDisabledNotice />
      {err ? <ErrorRow message={err} /> : rows == null ? <LoadingRow /> : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-4 py-3">Slug</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {rows.length === 0 && (
                <tr><td colSpan={4} className="text-center py-10 text-xs text-slate-600">No firms found.</td></tr>
              )}
              {rows.map((f) => (
                <tr key={f.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3 text-sm font-semibold text-white">{f.name}</td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-400">{f.slug}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusColor(f.status)}`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(f.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
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

// ─── Pricing tab ──────────────────────────────────────────────────────────────

function PricingTab({ firmId }: { firmId: string }) {
  const [row, setRow] = useState<FirmPricing | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('firm_pricing')
        .select('*')
        .eq('firm_id', firmId)
        .maybeSingle();
      if (cancelled) return;
      if (error) setErr(error.message);
      else setRow(data as FirmPricing | null);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [firmId]);

  return (
    <section>
      <EditDisabledNotice />
      {err ? <ErrorRow message={err} /> : !loaded ? <LoadingRow /> : !row ? (
        <p className="text-xs text-slate-600 py-8 text-center">No pricing row for this firm.</p>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800/60">
          <Row label="Subscription"        value={fmtCents(row.subscription_amount_cents)} />
          <Row label="Per-case fee"        value={fmtCents(row.per_case_fee_cents)} />
          <Row label="Included cases / month" value={row.included_cases_per_month == null ? 'Unlimited' : String(row.included_cases_per_month)} />
          <Row label="Vendor pass-through" value={row.vendor_pass_through_enabled ? `Enabled — markup ${row.vendor_markup_pct}%` : 'Disabled'} />
          <Row label="Autopay"             value={row.autopay_enabled ? 'On' : 'Off'} />
          <Row label="Billing email"       value={row.billing_email ?? '—'} />
          <Row label="Stripe customer"     value={row.stripe_customer_id ?? '—'} mono />
          <Row label="Current period"      value={row.current_period_start || row.current_period_end ? `${fmtDate(row.current_period_start)} → ${fmtDate(row.current_period_end)}` : '—'} />
          <Row label="Notes"               value={row.notes ?? '—'} />
          <Row label="Updated"             value={fmtDate(row.updated_at)} />
        </div>
      )}
    </section>
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

// ─── Features tab ─────────────────────────────────────────────────────────────

function FeaturesTab({ firmId }: { firmId: string }) {
  const [defs, setDefs] = useState<FeatureDefinition[] | null>(null);
  const [firmFlags, setFirmFlags] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
      if (cancelled) return;
      if (defsRes.error)  { setErr(defsRes.error.message);  return; }
      if (flagsRes.error) { setErr(flagsRes.error.message); return; }
      setDefs(defsRes.data ?? []);
      const map: Record<string, boolean> = {};
      for (const r of (flagsRes.data ?? []) as FirmFeature[]) map[r.feature_key] = r.enabled === true;
      setFirmFlags(map);
    })();
    return () => { cancelled = true; };
  }, [firmId]);

  const grouped = (defs ?? []).reduce<Record<string, FeatureDefinition[]>>((acc, d) => {
    (acc[d.category] ||= []).push(d);
    return acc;
  }, {});
  const categories = Object.keys(grouped).sort();

  return (
    <section>
      <EditDisabledNotice />
      {err ? <ErrorRow message={err} /> : defs == null ? <LoadingRow /> : (
        <div className="space-y-4">
          {categories.map((cat) => (
            <div key={cat} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/40">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-400">{cat}</p>
              </div>
              <div className="divide-y divide-slate-800/60">
                {grouped[cat].map((d) => {
                  const on = firmFlags[d.feature_key] === true;
                  return (
                    <div key={d.feature_key} className="px-5 py-3 flex items-start gap-4">
                      <div className="flex-shrink-0 mt-0.5">
                        {on ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-700" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{d.name}</p>
                        {d.description && (
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{d.description}</p>
                        )}
                        <code className="text-[10px] text-slate-700 font-mono mt-1 inline-block">{d.feature_key}</code>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap ${
                        on
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                          : 'text-slate-500 bg-slate-800 border-slate-700'
                      }`}>
                        {on ? 'Enabled' : 'Disabled'}
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

// ─── Discounts tab ────────────────────────────────────────────────────────────

function DiscountsTab({ firmId }: { firmId: string }) {
  const [rows, setRows] = useState<FirmDiscount[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('firm_discounts')
        .select('id, discount_type, discount_value, applied_at, expires_at, reason, is_active')
        .eq('firm_id', firmId)
        .order('applied_at', { ascending: false });
      if (cancelled) return;
      if (error) setErr(error.message);
      else setRows(data ?? []);
    })();
    return () => { cancelled = true; };
  }, [firmId]);

  return (
    <section>
      <EditDisabledNotice />
      {err ? <ErrorRow message={err} /> : rows == null ? <LoadingRow /> : (
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-xs text-slate-600">No discounts for this firm.</td></tr>
              )}
              {rows.map((d) => (
                <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3 text-xs font-mono text-slate-300">{d.discount_type}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-white">
                    {discountValueLabel(d.discount_type, d.discount_value)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold ${d.is_active ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {d.is_active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(d.applied_at)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(d.expires_at)}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{d.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
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

// ─── Usage & Billing tab ─────────────────────────────────────────────────────

// Raw row returned from firm_usage_events
interface UsageEvent {
  firm_id: string;
  event_type: string;
  vendor_cost_cents: number;
  recorded_at: string;
}

// Aggregated per-firm per-event_type counts
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

  // Aggregate events into per-firm summaries
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

    return {
      firmId: firm.id,
      firmName: firm.name,
      allTime,
      currentMonth,
      vendorCostCentsAllTime: vendorCostAllTime,
      vendorCostCentsCurrentMonth: vendorCostMonth,
    };
  });

  const activeSummaries = summaries.filter((s) =>
    (firms ?? []).find((f) => f.id === s.firmId)?.status === 'active'
  );

  const totalEvents = (events ?? []).length;
  const monthStart = startOfCurrentMonth();
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <section className="space-y-5">
      {/* Comped notice */}
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

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white">Usage by Firm</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {totalEvents.toLocaleString()} total events recorded across all firms
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex items-center bg-slate-800/70 border border-slate-700/50 rounded-lg p-0.5 gap-0.5">
            {(['month', 'all'] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  window === w
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {w === 'month' ? monthLabel : 'All Time'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {err ? <ErrorRow message={err} /> : loading ? <LoadingRow /> : events!.length === 0 ? (
        /* ── Empty state ── */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
          <Activity className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-400">No usage events recorded yet</p>
          <p className="text-xs text-slate-600 mt-1.5 max-w-sm mx-auto leading-relaxed">
            Events are logged as clients are created, documents uploaded, Plaid connected, and
            exports generated. Data will appear here as the pilot runs.
          </p>
        </div>
      ) : (
        <>
          {/* ── Per-firm summary cards ── */}
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
                  {/* Card header */}
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

                  {/* Metrics grid */}
                  <div className="divide-y divide-slate-800/50">
                    {Object.entries(USAGE_EVENT_LABELS).map(([key, label]) => {
                      const count = counts[key] ?? 0;
                      const isPlaid = PLAID_EVENT_TYPES.has(key);
                      return (
                        <div key={key} className="px-5 py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-slate-400 truncate">{label}</span>
                            {isPlaid && (
                              <span className="text-[9px] font-bold text-sky-400 bg-sky-900/30 border border-sky-700/30 px-1 py-0.5 rounded flex-shrink-0">PLAID</span>
                            )}
                          </div>
                          <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ml-4 ${
                            count > 0 ? 'text-white' : 'text-slate-700'
                          }`}>
                            {count.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}

                    {/* Vendor cost row */}
                    <div className="px-5 py-2.5 flex items-center justify-between bg-slate-800/20">
                      <span className="text-xs font-semibold text-slate-400">Plaid Vendor Cost</span>
                      <span className={`text-sm font-semibold ${plaidCost > 0 ? 'text-amber-300' : 'text-slate-700'}`}>
                        {plaidCost > 0 ? fmtCents(plaidCost) : '—'}
                      </span>
                    </div>
                    <div className="px-5 py-2.5 flex items-center justify-between bg-slate-800/20">
                      <span className="text-xs font-semibold text-slate-400">Total Vendor Cost</span>
                      <span className={`text-sm font-semibold ${vendorCost > 0 ? 'text-amber-300' : 'text-slate-700'}`}>
                        {vendorCost > 0 ? fmtCents(vendorCost) : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Side-by-side comparison + per-case averages ── */}
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
                    {activeSummaries.map((s) => (
                      <th key={s.firmId} className="text-right px-4 py-3">{s.firmName}</th>
                    ))}
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
                            <span className={count > 0 ? 'text-white' : 'text-slate-700'}>
                              {count.toLocaleString()}
                            </span>
                            {cases > 0 && count > 0 && (
                              <span className="text-[11px] text-slate-600 ml-1.5">({avg}/case)</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Vendor cost per case */}
                  <tr className="bg-slate-800/20">
                    <td className="px-5 py-2.5 text-xs font-semibold text-slate-400">Total Vendor Cost</td>
                    {activeSummaries.map((s) => {
                      const cost = window === 'month' ? s.vendorCostCentsCurrentMonth : s.vendorCostCentsAllTime;
                      const cases = (window === 'month' ? s.currentMonth : s.allTime)['client_created'] ?? 0;
                      const perCase = cases > 0 && cost > 0 ? fmtCents(Math.round(cost / cases)) : null;
                      return (
                        <td key={s.firmId} className="px-4 py-2.5 text-sm text-right">
                          <span className={cost > 0 ? 'text-amber-300 font-semibold' : 'text-slate-700'}>
                            {cost > 0 ? fmtCents(cost) : '—'}
                          </span>
                          {perCase && (
                            <span className="text-[11px] text-slate-600 ml-1.5">({perCase}/case)</span>
                          )}
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

// ─── Tier templates tab ───────────────────────────────────────────────────────

function TierTemplatesTab() {
  const [rows, setRows] = useState<TierTemplate[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
      <EditDisabledNotice />
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
