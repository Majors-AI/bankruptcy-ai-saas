import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle2, XCircle, Clock, Shield, RefreshCw, CheckCheck,
  AlertTriangle, ChevronDown, ChevronRight, Pause, Send,
  FileText, User, Tags,
} from 'lucide-react';
import { getCurrentAttorneyName } from '../lib/currentAttorney';
import ExemptionsLiquidationPanel from './signing-review/ExemptionsLiquidationPanel';
import MaritalAdjustmentPanel from './signing-review/MaritalAdjustmentPanel';
import LongFormDeductionPanel from './signing-review/LongFormDeductionPanel';
import Ch13SigningReview from './signing-review/Ch13SigningReview';
import PreFilingGateBadge from './firm-rule-updates/PreFilingGateBadge';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Demo client — replaced by real client context once BAN-40 auth ships.
const CLIENT_ID = 'client-demo';
const FIRM_ID = (import.meta.env.VITE_FIRM_ID as string | undefined) ?? '00000000-0000-0000-0000-000000000001';
// Reviewer name resolves at call time so post-login sessionStorage updates
// flow through. Was a module-load const "Jennifer Smith, Esq." that would
// cache the env-var default before any login could populate the session.
function reviewerName(): string { return getCurrentAttorneyName(); }

const ALLOWED_ROLES = ['attorney', 'legal_admin', 'firm_super_admin', 'super_admin_bankruptcy_ai'];

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemStatus = 'not_yet_reviewed' | 'verified' | 'needs_correction';

interface ReviewItem {
  item_key: string;
  status: ItemStatus;
  notes: string;
  reviewed_by: string;
  reviewed_at: string;
}

interface SigningReviewRow {
  id: string;
  client_id: string;
  firm_id: string;
  reviewer_id: string | null;
  reviewer_role: string;
  status: 'in_progress' | 'completed' | 'paused';
  items: ReviewItem[];
  created_at: string;
  updated_at: string;
}

// ── Checklist definition ──────────────────────────────────────────────────────

const REVIEW_GROUPS: Array<{
  id: string;
  label: string;
  items: Array<{ key: string; label: string; description: string }>;
}> = [
  {
    id: 'identity',
    label: 'Identity & Certificates',
    items: [
      { key: 'photo_id', label: 'Government-Issued Photo ID', description: 'Valid, not expired — driver\'s license, state ID, or passport. Name matches petition exactly.' },
      { key: 'ssn_card', label: 'Social Security Card', description: 'Original card or SSA-issued document on file.' },
      { key: 'credit_counseling', label: 'Credit Counseling Certificate', description: 'USCOURTS-approved agency, completed within 180 days of filing. Certificate of completion uploaded.' },
    ],
  },
  {
    id: 'documents',
    label: 'Supporting Documents',
    items: [
      { key: 'bank_stmts', label: 'Bank Statements — All Accounts', description: 'Most recent full statement cycle. If month has rolled, new statements must be provided before signing.' },
      { key: 'pay_stubs', label: 'Pay Stubs — Two Most Recent', description: 'Both stubs from current or most recent pay period. Employer and amounts match Schedule I.' },
      { key: 'tax_returns', label: 'Tax Returns — 2023 & 2024', description: 'Federal returns for both years, signed copy. Uploaded and accessible.' },
      { key: 'mortgage_stmt', label: 'Mortgage Statement (if applicable)', description: 'Current lender statement — balance not more than 60 days old. Mark N/A if no mortgage.' },
      { key: 'auto_loan_stmt', label: 'Auto Loan Statement (if applicable)', description: 'Current statement for each financed vehicle. Mark N/A if no auto loan.' },
      { key: 'credit_reports', label: 'Credit Reports (Equifax, TransUnion, Experian)', description: 'All three pulled. All creditors on reports are accounted for in Schedule E/F.' },
    ],
  },
  {
    id: 'petition',
    label: 'Petition Schedules',
    items: [
      { key: 'vol_petition', label: 'Voluntary Petition (Form 101)', description: 'Client name, address, SSN, chapter, and filing type correct. Social security number verified against card.' },
      { key: 'sched_ab', label: 'Schedule A/B — Property', description: 'All real and personal property listed. FMV values current. No undisclosed assets.' },
      { key: 'sched_c', label: 'Schedule C — Exemptions', description: 'Exemptions match applicable state law. Homestead applied if client qualifies. Dollar amounts within caps.' },
      { key: 'sched_d', label: 'Schedule D — Secured Creditors', description: 'All secured debts listed. Balances match current statements. No secured debts omitted.' },
      { key: 'sched_ef', label: 'Schedule E/F — Unsecured Creditors', description: 'All unsecured debts from credit reports and questionnaire. Collection accounts included. No duplicates.' },
      { key: 'sched_g', label: 'Schedule G — Executory Contracts & Leases', description: 'All active leases and unexpired contracts disclosed. Month-to-month tenancies noted.' },
      { key: 'sched_h', label: 'Schedule H — Co-Debtors', description: 'All co-signers and joint obligors identified. Non-filing spouse co-debts noted.' },
      { key: 'sched_i', label: 'Schedule I — Income', description: 'Current monthly income accurate. Supported by pay stubs. Spouse income included if required for means test.' },
      { key: 'sched_j', label: 'Schedule J — Expenses', description: 'Monthly expenses verified. Amounts reasonable and supported by bank statements. No double-counting.' },
      { key: 'means_test', label: 'Means Test (Form 122A-1)', description: 'Below-median income confirmed OR means test calculation completes with disposable income below threshold.' },
      { key: 'sofa', label: 'SOFA (Form 107)', description: 'Financial history for past 2–4 years complete. Transfers, payments to insiders, lawsuits disclosed.' },
      { key: 'stmt_intention', label: 'Statement of Intention (Form 108)', description: 'Reaffirm or surrender decision confirmed for each secured debt and unexpired lease.' },
    ],
  },
  {
    id: 'prefiling',
    label: 'Pre-Filing Checklist',
    items: [
      { key: 'filing_fee', label: 'Filing Fee Confirmed', description: 'Court filing fee paid or fee waiver application (Form 103B) prepared and signed.' },
      { key: 'attorney_signature', label: 'Attorney Signature Block', description: 'Bar number, firm address, phone, and email correct on signature block.' },
      { key: 'court_district', label: 'Court District & Division', description: 'Correct federal bankruptcy district and division for client\'s county of residence.' },
      { key: 'case_type', label: 'Case Type Verified', description: 'Chapter 7 individual. No Chapter 13 or business case indicators. Consumer/non-consumer determination noted.' },
    ],
  },
  {
    id: 'signing_session',
    label: 'Client Signing Session',
    items: [
      { key: 'identity_confirmed', label: 'Client Identity Confirmed In-Person', description: 'Photo ID verified against face and petition. Name and date of birth match.' },
      { key: 'oath_administered', label: 'Oath Administered', description: 'Client swore or affirmed all information is true and correct under penalty of perjury.' },
      { key: 'petition_reviewed', label: 'Full Petition Reviewed with Client', description: 'Attorney/paralegal walked through all schedules with client. Client verbally confirmed accuracy of each section.' },
      { key: 'signatures_obtained', label: 'All Client Signatures Obtained', description: 'All required signature pages executed by debtor (and non-filing spouse on joint-debtor pages, if applicable).' },
      { key: 'copies_distributed', label: 'Petition Copies Distributed', description: 'Client received a complete signed copy of the petition and disclosure documents.' },
    ],
  },
];

const ALL_ITEM_KEYS = REVIEW_GROUPS.flatMap(g => g.items.map(i => i.key));
const TOTAL_ITEMS = ALL_ITEM_KEYS.length;

function buildDefaultItems(): Record<string, ReviewItem> {
  const out: Record<string, ReviewItem> = {};
  for (const key of ALL_ITEM_KEYS) {
    out[key] = { item_key: key, status: 'not_yet_reviewed', notes: '', reviewed_by: '', reviewed_at: '' };
  }
  return out;
}

function mergeLoadedItems(loaded: ReviewItem[]): Record<string, ReviewItem> {
  const base = buildDefaultItems();
  for (const item of loaded) {
    if (base[item.item_key]) {
      base[item.item_key] = item;
    }
  }
  return base;
}

function serializeItems(items: Record<string, ReviewItem>): ReviewItem[] {
  return Object.values(items);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ── Access denied screen ──────────────────────────────────────────────────────

function AccessDenied({ layout = 'full' }: { layout?: 'full' | 'embedded' }) {
  const fullChrome = layout !== 'embedded';
  return (
    <div className={fullChrome
      ? "min-h-screen bg-slate-950 flex items-center justify-center p-8"
      : "flex items-center justify-center py-16"}>
      <div className="max-w-sm text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-900/30 border border-red-700/40 flex items-center justify-center mx-auto">
          <Shield className="w-6 h-6 text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-white">Access Restricted</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Signing Review is accessible to attorneys and paralegals only. Contact your firm administrator if you need access.
        </p>
      </div>
    </div>
  );
}

// ── Completion confirmation modal ─────────────────────────────────────────────

function CompleteModal({
  items,
  onConfirm,
  onCancel,
  saving,
}: {
  items: Record<string, ReviewItem>;
  onConfirm: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const verified = Object.values(items).filter(i => i.status === 'verified').length;
  const needsCorrection = Object.values(items).filter(i => i.status === 'needs_correction').length;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-900/40 border border-emerald-700/40 flex items-center justify-center">
              <CheckCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Complete Signing Review?</p>
              <p className="text-xs text-slate-400">This action will mark the review as completed.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{verified}</p>
              <p className="text-xs text-emerald-500 mt-0.5">Verified</p>
            </div>
            <div className={`border rounded-xl p-3 text-center ${needsCorrection > 0 ? 'bg-amber-900/20 border-amber-700/30' : 'bg-slate-800/40 border-slate-700'}`}>
              <p className={`text-2xl font-bold ${needsCorrection > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{needsCorrection}</p>
              <p className={`text-xs mt-0.5 ${needsCorrection > 0 ? 'text-amber-500' : 'text-slate-600'}`}>Needs Correction</p>
            </div>
          </div>

          {needsCorrection > 0 && (
            <div className="flex items-start gap-2.5 bg-amber-900/15 border border-amber-700/30 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                {needsCorrection} item{needsCorrection !== 1 ? 's' : ''} marked as needing correction. The review will be completed and these items will be visible in the audit log.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Complete Review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface SigningReviewProps {
  /**
   * 'full' (default): full-screen page (min-h-screen + bg-slate-950).
   * 'embedded': renders into parent flow — no chrome ownership. Used by LegalDepartmentPortal.
   * Role-gate denial respects layout too: contained panel when embedded.
   */
  layout?: 'full' | 'embedded';
  /**
   * The client whose signing review this is. Defaults to 'client-demo' so
   * existing standalone-route + demo behavior is preserved. Real callers
   * should pass an actual clients.id (UUID) sourced from App.tsx's
   * impersonateClient or a future session/selection context.
   */
  clientId?: string;
  /**
   * Which Signing Review portal the user entered through. Drives the
   * default render when case.chapter is unset and powers the
   * "wrong-portal" notice when the case's actual chapter differs from
   * the portal that opened it. Does NOT override the case's actual
   * chapter — the dispatch routes to the correct surface either way.
   */
  portalChapter?: '7' | '13';
}

export default function SigningReview(
  { layout = 'full', clientId = 'client-demo', portalChapter = '7' }: SigningReviewProps = {},
) {
  const role = (import.meta.env.VITE_PLATFORM_ROLE as string | undefined) ?? 'legal_admin';

  if (role && !ALLOWED_ROLES.includes(role)) {
    return <AccessDenied layout={layout} />;
  }
  const fullChrome = layout !== 'embedded';

  const [reviewRow, setReviewRow] = useState<SigningReviewRow | null>(null);
  const [items, setItems] = useState<Record<string, ReviewItem>>(buildDefaultItems());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  // Client's intake form_data — feeds the Exemptions & Liquidation panel.
  // Loaded best-effort; if no submission is on file the panel renders an
  // empty-state notice instead of breaking the signing review.
  const [intakeFormData, setIntakeFormData] = useState<Record<string, unknown> | null>(null);
  const [intakeState, setIntakeState] = useState<string | undefined>(undefined);
  const [intakeCounty, setIntakeCounty] = useState<string | undefined>(undefined);
  // Chapter routing — read case.chapter from intake form_data. '7' →
  // existing Ch.7 surface (below); '13' → Ch13SigningReview surface
  // (dispatched a few lines below). Unset → defaults to '7' with a small
  // "chapter not set" note rendered in the Ch.7 header.
  const [caseChapter, setCaseChapter] = useState<'7' | '13' | null>(null);
  // Attorney-controlled consumer/non-consumer determination. The client-side
  // SOFA toggle was hidden — classification is set here at signing review.
  // Seeded from intake form_data.debtNature when present; otherwise defaults
  // to "consumer" (most common Ch.7 case). Local state today; persistence to
  // signing_reviews (or a dedicated case_classification row) is TODO.
  const [attorneyDebtType, setAttorneyDebtType] = useState<'consumer' | 'non-consumer'>('consumer');
  const sessionStartRef = useRef<Date>(new Date());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewRowRef = useRef<SigningReviewRow | null>(null);
  const itemsRef = useRef<Record<string, ReviewItem>>(items);

  // Keep refs in sync so callbacks always have current values.
  reviewRowRef.current = reviewRow;
  itemsRef.current = items;

  // ── Session timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionElapsed(Math.floor((Date.now() - sessionStartRef.current.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Load or create review on mount ────────────────────────────────────────
  useEffect(() => {
    loadOrCreate();
  }, []);

  // ── Load the client's intake form_data for the Exemptions panel ───────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/intake_submissions?client_id=eq.${clientId}&order=created_at.desc&limit=1&select=form_data,state,county,exemption_state`,
          { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
        );
        const rows = await res.json();
        if (cancelled) return;
        const r = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        const fd = (r?.form_data as Record<string, unknown> | undefined) ?? null;
        setIntakeFormData(fd);
        setIntakeState(String(r?.exemption_state || r?.state || fd?.state || "") || undefined);
        setIntakeCounty(String(r?.county || fd?.county || "") || undefined);
        const seedDebt =
          (fd as Record<string, unknown> | null)?.debtNature ??
          ((fd as Record<string, unknown> | null)?.sofa as Record<string, unknown> | undefined)?.debtType ??
          ((fd as Record<string, unknown> | null)?.petition as Record<string, unknown> | undefined)?.debtNature;
        if (seedDebt === 'non-consumer' || seedDebt === 'consumer') {
          setAttorneyDebtType(seedDebt);
        }
        // Case chapter — looks at form_data.chapter or the nested
        // petition.chapter. Tolerates strings, numbers, and "Chapter 13"
        // / "Ch. 13" / "13" variants. Anything we can't classify leaves
        // caseChapter null → the Ch.7 surface renders a "chapter not
        // set" notice.
        const rawChapter =
          (fd as Record<string, unknown> | null)?.chapter ??
          ((fd as Record<string, unknown> | null)?.petition as Record<string, unknown> | undefined)?.chapter ??
          null;
        const chapterStr = String(rawChapter ?? "").toLowerCase();
        if (chapterStr.includes("13") || chapterStr === "ch13") setCaseChapter("13");
        else if (chapterStr.includes("7") || chapterStr === "ch7") setCaseChapter("7");
        else setCaseChapter(null);
      } catch {
        // No submission on file — panel renders empty-state.
      }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  async function loadOrCreate() {
    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/signing_reviews?client_id=eq.${clientId}&status=in.in_progress,paused&order=created_at.desc&limit=1`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const rows: SigningReviewRow[] = await res.json();
      if (rows.length > 0) {
        setReviewRow(rows[0]);
        setItems(mergeLoadedItems(rows[0].items));
      } else {
        await createReview();
      }
    } finally {
      setLoading(false);
    }
  }

  async function createReview() {
    const body = {
      client_id: clientId,
      firm_id: FIRM_ID,
      reviewer_role: role,
      status: 'in_progress',
      items: serializeItems(buildDefaultItems()),
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/signing_reviews`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
    });
    const rows: SigningReviewRow[] = await res.json();
    if (rows[0]) setReviewRow(rows[0]);
  }

  // ── Debounced auto-save ───────────────────────────────────────────────────
  const scheduleSave = useCallback((nextItems: Record<string, ReviewItem>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistItems(nextItems, 'in_progress');
    }, 800);
  }, []);

  async function persistItems(nextItems: Record<string, ReviewItem>, status: SigningReviewRow['status']) {
    const row = reviewRowRef.current;
    if (!row) return;
    setSaving(true);
    await fetch(`${SUPABASE_URL}/rest/v1/signing_reviews?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: serializeItems(nextItems), status }),
    });
    setSaving(false);
  }

  // ── Item status change ────────────────────────────────────────────────────
  function setItemStatus(key: string, status: ItemStatus) {
    const now = new Date().toISOString();
    setItems(prev => {
      const next = {
        ...prev,
        [key]: {
          ...prev[key],
          status,
          reviewed_by: status !== 'not_yet_reviewed' ? reviewerName() : '',
          reviewed_at: status !== 'not_yet_reviewed' ? now : '',
        },
      };
      scheduleSave(next);
      return next;
    });
  }

  function setItemNotes(key: string, notes: string) {
    setItems(prev => {
      const next = { ...prev, [key]: { ...prev[key], notes } };
      scheduleSave(next);
      return next;
    });
  }

  // ── Pause ─────────────────────────────────────────────────────────────────
  async function pauseReview() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await persistItems(itemsRef.current, 'paused');
    setReviewRow(prev => prev ? { ...prev, status: 'paused' } : prev);
  }

  // ── Complete ──────────────────────────────────────────────────────────────
  async function completeReview() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await persistItems(itemsRef.current, 'completed');
    setReviewRow(prev => prev ? { ...prev, status: 'completed' } : prev);
    setShowCompleteModal(false);
  }

  // ── Derived counts ────────────────────────────────────────────────────────
  const verifiedCount = Object.values(items).filter(i => i.status === 'verified').length;
  const needsCorrectionCount = Object.values(items).filter(i => i.status === 'needs_correction').length;
  const notYetReviewedCount = Object.values(items).filter(i => i.status === 'not_yet_reviewed').length;
  const canComplete = notYetReviewedCount === 0;
  const isCompleted = reviewRow?.status === 'completed';

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`flex items-center justify-center ${fullChrome ? "min-h-screen bg-slate-950" : "py-24"}`}>
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading signing review…</span>
        </div>
      </div>
    );
  }

  // ── Chapter dispatch ──────────────────────────────────────────────────────
  // The case's ACTUAL chapter (read from form_data) wins over the portal
  // entry. portalChapter is the default when the case has no chapter set
  // (i.e. demo/empty data) and powers the "wrong-portal" notice when the
  // case's chapter conflicts with where the user came from.
  //
  // Routing:
  //   case.chapter === '13'  → Ch13SigningReview (regardless of portal)
  //   case.chapter === '7'   → Ch.7 body (regardless of portal)
  //   case.chapter unset     → render the portal's default surface
  const wrongPortal =
    caseChapter !== null && caseChapter !== portalChapter;
  const effectiveChapter: '7' | '13' = caseChapter ?? portalChapter;
  if (effectiveChapter === '13') {
    return (
      <Ch13SigningReview
        role={role}
        intakeFormData={intakeFormData}
        intakeState={intakeState}
        intakeCounty={intakeCounty}
        wrongPortalNotice={wrongPortal ? `This case is Ch. 13 — opened from the Ch. 7 portal.` : undefined}
      />
    );
  }

  const progressPct = Math.round((verifiedCount / TOTAL_ITEMS) * 100);
  const circumference = 2 * Math.PI * 26;

  return (
    <div className={`text-slate-100 ${fullChrome ? "min-h-screen bg-slate-950" : ""}`}>
      {showCompleteModal && (
        <CompleteModal
          items={items}
          onConfirm={completeReview}
          onCancel={() => setShowCompleteModal(false)}
          saving={saving}
        />
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 shadow-lg">
        <div className="max-w-screen-xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
              <FileText className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Ch. 7 Signing Review Portal</p>
              <p className="text-xs text-slate-500">{reviewerName()}</p>
              {wrongPortal && (
                <p className="text-[10px] text-amber-300 mt-0.5">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  This case is Ch. 7 — opened from the Ch. 13 portal.
                </p>
              )}
              {!wrongPortal && caseChapter === null && (
                <p className="text-[10px] text-amber-300 mt-0.5">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  case.chapter not set — defaulting to Ch. {portalChapter}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Session timer */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono">{formatDuration(sessionElapsed)}</span>
            </div>

            {/* Save indicator */}
            {saving && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Saving…
              </span>
            )}

            {/* Status badge */}
            {isCompleted ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/50 text-emerald-300 border border-emerald-600/50">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Completed
              </span>
            ) : reviewRow?.status === 'paused' ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-900/40 text-amber-300 border border-amber-600/40">
                <Pause className="w-3.5 h-3.5" />
                Paused
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-900/40 text-sky-300 border border-sky-600/40">
                <Clock className="w-3.5 h-3.5" />
                In Progress
              </span>
            )}

            {/* Needs-correction count */}
            {needsCorrectionCount > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-900/40 text-red-300 border border-red-700/50">
                <AlertTriangle className="w-3.5 h-3.5" />
                {needsCorrectionCount} correction{needsCorrectionCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-5 py-6 space-y-6">

        {/* Slice 5 — pre-filing rules gate. Compares case.lastReviewedRulesVersion
            vs firm.appliedRulesVersion (firmRuleUpdates). caseStampedVersionId
            is `null` today — wiring it to the actual AttorneyReviewRecord
            stamp on this case is a follow-up (the engine already records
            stamps via rulesAuditStore.reviews; the SigningReview just
            needs to thread the lookup through here). */}
        <PreFilingGateBadge
          firmId={FIRM_ID}
          caseId={CLIENT_ID}
          caseStampedVersionId={null /* TODO: wire from AttorneyReviewRecord.stampedVersionId */}
          isLawyer={role === 'attorney' || role === 'super_admin_bankruptcy_ai'}
        />

        {/* ── Progress card ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Case summary */}
          <div className="md:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-white">Jane Sample</h1>
                <p className="text-sm text-slate-400">Chapter 7 — Individual</p>
              </div>
              <div className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-900/40 text-blue-300 border border-blue-700/50">
                Pre-Signing
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {[
                { label: 'Attorney', value: reviewerName() },
                { label: 'Firm', value: 'Majors Law Group' },
                { label: 'Filing Type', value: 'Individual — Non-Filing Spouse' },
                { label: 'Reviewer', value: reviewerName() },
                { label: 'Review Status', value: reviewRow?.status?.replace(/_/g, ' ') ?? 'In Progress' },
                { label: 'Last Saved', value: reviewRow?.updated_at ? new Date(reviewRow.updated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—' },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-slate-500 uppercase tracking-wider text-[10px] mb-0.5">{item.label}</p>
                  <p className="text-slate-200 font-medium capitalize">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Progress ring */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Review Progress</p>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="6" fill="none" className="text-slate-800" />
                  <circle
                    cx="32" cy="32" r="26"
                    stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round"
                    className={verifiedCount === TOTAL_ITEMS ? 'text-emerald-400' : 'text-sky-400'}
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - verifiedCount / TOTAL_ITEMS)}
                    style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-sm font-bold ${verifiedCount === TOTAL_ITEMS ? 'text-emerald-400' : 'text-sky-400'}`}>
                    {progressPct}%
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-4 text-[10px]">
                  <span className="text-emerald-400 font-semibold">✓ Verified</span>
                  <span className="text-emerald-400 font-bold">{verifiedCount}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-[10px]">
                  <span className={needsCorrectionCount > 0 ? 'text-red-400 font-semibold' : 'text-slate-600'}>✗ Correction</span>
                  <span className={needsCorrectionCount > 0 ? 'text-red-400 font-bold' : 'text-slate-600 font-bold'}>{needsCorrectionCount}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-[10px]">
                  <span className="text-slate-500">○ Pending</span>
                  <span className="text-slate-500 font-bold">{notYetReviewedCount}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">{verifiedCount} of {TOTAL_ITEMS} items reviewed</p>
          </div>
        </div>

        {/* ── Debt classification (attorney-set) ──
              Replaces the client-side SOFA "debts are primarily" toggle —
              attorney sets the consumer vs. non-consumer determination
              here at signing. Drives § 707(b) means-test scope, the SOFA
              Part 3 90-day payment threshold ($600 vs. $8,575), and the
              petition's nature-of-debts box. Local state today; persist
              alongside the signing_reviews row when the rest of the panel
              data persists. */}
        {(() => {
          const canEditDebt = role === 'attorney' || role === 'firm_super_admin' || role === 'super_admin_bankruptcy_ai';
          const threshold = attorneyDebtType === 'non-consumer' ? '$8,575' : '$600';
          return (
            <div className="border border-slate-800 rounded-xl bg-slate-900/30 p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
                    <Tags className="w-4 h-4 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Debt Classification</h3>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed max-w-xl">
                      Set whether the debtor's obligations are primarily consumer or non-consumer.
                      This drives § 707(b) means-test scope and the SOFA Part 3 90-day payment threshold ({threshold}).
                    </p>
                  </div>
                </div>
                <div className="inline-flex gap-1.5">
                  {(['consumer', 'non-consumer'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => canEditDebt && setAttorneyDebtType(t)}
                      disabled={!canEditDebt}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border capitalize transition disabled:opacity-60 ${
                        attorneyDebtType === t
                          ? 'bg-amber-500 text-amber-950 border-amber-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {!canEditDebt && (
                <p className="text-[11px] uppercase tracking-widest text-slate-500 mt-3">Read-only — attorney edit required</p>
              )}
            </div>
          );
        })()}

        {/* ── Exemptions & Liquidation Analysis (attorney-only) ──
              ATTORNEY-ONLY surface — non-lawyers (legal_admin,
              firm_super_admin without a bar number) do NOT see this panel
              at all. The gate keys specifically on the attorney/lawyer flag,
              NOT on admin role. `super_admin_bankruptcy_ai` is the platform-
              tier ops bypass for testing only.
              TODO Phase B: server-side enforcement via RLS on the
              exemptions_workspace persistence so the gate survives a
              tampered client. */}
        {(() => {
          const isLawyer = role === 'attorney' || role === 'super_admin_bankruptcy_ai';
          if (!isLawyer) return null;
          // Marital-adjustment preconditions read off the same form_data the
          // panel already consumes. The component itself enforces the gates
          // again (defense in depth).
          const filingType = String((intakeFormData?.filingType ?? '') as string);
          const isIndividualWithNFS = filingType === 'individual-nonfiling-spouse';
          // NFS income inclusion: any income source with owner === 'nfs'
          // OR the legacy `spouseSources` populated on an individual-NFS
          // filing counts. Conservative — defer to the attorney's
          // judgment on edge cases via the panel's own UI.
          const nfsSources = Array.isArray(intakeFormData?.spouseSources)
            ? (intakeFormData!.spouseSources as Array<unknown>)
            : [];
          const incomeSources = Array.isArray((intakeFormData as Record<string, unknown> | null)?.income_sources_json)
            ? ((intakeFormData as Record<string, unknown>).income_sources_json as Array<{ owner?: string }>)
            : [];
          const nfsIncomeIncludedInCMI = isIndividualWithNFS && (
            nfsSources.length > 0
            || incomeSources.some(s => s?.owner === 'nfs')
          );

          return (
            <>
              <div className="border border-slate-800 rounded-xl bg-slate-900/30 p-5">
                <ExemptionsLiquidationPanel
                  formData={intakeFormData}
                  clientState={intakeState}
                  clientCounty={intakeCounty}
                  canEdit={isLawyer}
                />
              </div>

              {/* Marital adjustment — Form 122A-1 line 17a. Attorney-only.
                  Itemized NFS non-contribution deduction. CLIENTS DO NOT
                  ENTER THIS — there is no intake/questionnaire field. The
                  panel itself enforces the precondition gates again
                  (individual-NFS filing + NFS income included in CMI) and
                  renders an N/A notice if either fails. */}
              <div className="border border-slate-800 rounded-xl bg-slate-900/30 p-5">
                <MaritalAdjustmentPanel
                  isLawyer={isLawyer}
                  isIndividualWithNonFilingSpouse={isIndividualWithNFS}
                  nfsIncomeIncludedInCMI={nfsIncomeIncludedInCMI}
                  onSave={(_items, _total) => {
                    // TODO Phase B — persist via the existing
                    // attorney_intake_reviews edit path:
                    //   saveReviewFields({
                    //     marital_adjustment_items: items,
                    //     marital_adjustment_total_cents: Math.round(total * 100),
                    //   })
                    void _items; void _total;
                  }}
                />
              </div>

              {/* Long-form means-test deductions — Form 122A-2 / 122C-2.
                  IRS-allowable deduction breakdown with per-line attorney
                  override + the existing re-review trigger. */}
              <div className="border border-slate-800 rounded-xl bg-slate-900/30 p-5">
                <LongFormDeductionPanel
                  isLawyer={isLawyer}
                  caseId={CLIENT_ID}
                  formData={(intakeFormData as Record<string, unknown> | null) ?? {}}
                  householdSize={
                    (intakeFormData?.filingType === 'joint' ? 2 : 1)
                    + (parseInt(String((intakeFormData as Record<string, unknown> | null)?.numDependents ?? '0')) || 0)
                  }
                  state={intakeState}
                  county={intakeCounty}
                  metroOrRegion={(intakeFormData as Record<string, unknown> | null)?.metroOrRegion as string | undefined}
                  vehicleCount={
                    Array.isArray((intakeFormData as Record<string, unknown> | null)?.vehicles)
                      ? ((intakeFormData as Record<string, unknown>).vehicles as Array<unknown>).length
                      : 0
                  }
                  projectedPlanPaymentMonthly={0}
                  cmi={(parseFloat(String((intakeFormData as Record<string, unknown> | null)?.cmiMonthly ?? '0')) || 0)}
                />
              </div>
            </>
          );
        })()}

        {/* ── Review groups ── */}
        {REVIEW_GROUPS.map(group => {
          const groupItems = group.items;
          const groupVerified = groupItems.filter(i => items[i.key]?.status === 'verified').length;
          const groupHasIssues = groupItems.some(i => items[i.key]?.status === 'needs_correction');
          const groupComplete = groupVerified === groupItems.length;

          return (
            <div key={group.id} className={`border rounded-xl overflow-hidden ${
              groupComplete ? 'border-emerald-700/30 bg-emerald-900/5'
              : groupHasIssues ? 'border-red-700/30 bg-red-900/5'
              : 'border-slate-800 bg-slate-900/30'
            }`}>
              {/* Group header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/60">
                <div className="flex items-center gap-3">
                  {groupComplete
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    : groupHasIssues
                    ? <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    : <Clock className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  }
                  <p className="text-sm font-semibold text-white">{group.label}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  groupComplete
                    ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {groupVerified}/{groupItems.length}
                </span>
              </div>

              {/* Items */}
              <div className="divide-y divide-slate-800/40">
                {groupItems.map(def => {
                  const item = items[def.key];
                  const isExpanded = expandedItem === def.key;
                  const statusCls =
                    item.status === 'verified'
                      ? 'border-l-emerald-500'
                      : item.status === 'needs_correction'
                      ? 'border-l-red-500'
                      : 'border-l-transparent';

                  return (
                    <div key={def.key} className={`border-l-2 ${statusCls} transition-all`}>
                      <div className="flex items-start gap-3 px-5 py-3.5">
                        {/* Status buttons */}
                        <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                          <button
                            onClick={() => setItemStatus(def.key, 'verified')}
                            disabled={isCompleted}
                            title="Verified"
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                              item.status === 'verified'
                                ? 'bg-emerald-600 border border-emerald-500 shadow-sm shadow-emerald-900/40'
                                : 'bg-slate-800 border border-slate-700 hover:border-emerald-700 hover:bg-emerald-900/20'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <CheckCircle2 className={`w-3.5 h-3.5 ${item.status === 'verified' ? 'text-white' : 'text-slate-500'}`} />
                          </button>
                          <button
                            onClick={() => setItemStatus(def.key, 'needs_correction')}
                            disabled={isCompleted}
                            title="Needs Correction"
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                              item.status === 'needs_correction'
                                ? 'bg-red-700 border border-red-600 shadow-sm shadow-red-900/40'
                                : 'bg-slate-800 border border-slate-700 hover:border-red-700 hover:bg-red-900/20'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <XCircle className={`w-3.5 h-3.5 ${item.status === 'needs_correction' ? 'text-white' : 'text-slate-500'}`} />
                          </button>
                          <button
                            onClick={() => setItemStatus(def.key, 'not_yet_reviewed')}
                            disabled={isCompleted}
                            title="Reset to not yet reviewed"
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                              item.status === 'not_yet_reviewed'
                                ? 'bg-slate-700 border border-slate-500'
                                : 'bg-slate-800 border border-slate-700 hover:border-slate-500'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <Clock className={`w-3.5 h-3.5 ${item.status === 'not_yet_reviewed' ? 'text-slate-300' : 'text-slate-600'}`} />
                          </button>
                        </div>

                        {/* Label + description + expand */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-medium leading-snug ${
                              item.status === 'verified' ? 'text-slate-200'
                              : item.status === 'needs_correction' ? 'text-red-300'
                              : 'text-slate-300'
                            }`}>
                              {def.label}
                            </p>
                            {item.status === 'verified' && item.reviewed_at && (
                              <span className="text-[10px] text-emerald-500 font-medium">
                                ✓ {new Date(item.reviewed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {item.notes && (
                              <span className="text-[10px] bg-sky-900/30 text-sky-400 border border-sky-700/30 px-1.5 py-0.5 rounded font-medium">
                                note
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{def.description}</p>
                        </div>

                        {/* Expand notes toggle */}
                        <button
                          onClick={() => setExpandedItem(isExpanded ? null : def.key)}
                          className="flex-shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-slate-800 transition-colors"
                          title={isExpanded ? 'Hide notes' : 'Add / edit notes'}
                        >
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />
                          }
                        </button>
                      </div>

                      {/* Inline notes */}
                      {isExpanded && (
                        <div className="px-5 pb-4 pt-1">
                          <textarea
                            value={item.notes}
                            onChange={e => setItemNotes(def.key, e.target.value)}
                            disabled={isCompleted}
                            placeholder="Add inline notes for this item (optional)…"
                            rows={2}
                            className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          {item.reviewed_by && (
                            <p className="text-[10px] text-slate-600 mt-1.5 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Last reviewed by {item.reviewed_by}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* ── Completion reminder banner ── */}
        {!canComplete && !isCompleted && (
          <div className="flex items-center gap-3 p-4 bg-slate-900/60 border border-slate-700 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-slate-400">
              <span className="font-semibold text-amber-300">{notYetReviewedCount} item{notYetReviewedCount !== 1 ? 's' : ''} not yet reviewed.</span>
              {' '}All items must be marked Verified or Needs Correction before the review can be completed.
            </p>
          </div>
        )}

        {/* Spacer for bottom action bar */}
        <div className="h-20" />
      </div>

      {/* ── Bottom action bar ── */}
      {!isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-5 py-3">
          <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {saving
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                : <><CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> Auto-saved</>
              }
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={pauseReview}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-all disabled:opacity-50"
              >
                <Pause className="w-3.5 h-3.5" />
                Save & Pause
              </button>
              <button
                onClick={() => setShowCompleteModal(true)}
                disabled={!canComplete || saving}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 border border-emerald-600 rounded-xl transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                Complete Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed banner */}
      {isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-emerald-900/90 backdrop-blur border-t border-emerald-700/50 px-5 py-3">
          <div className="max-w-screen-xl mx-auto flex items-center justify-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-200">
              Review completed — {verifiedCount} verified, {needsCorrectionCount} flagged for correction.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
