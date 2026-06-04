import { useState, useEffect, useRef, Component, ReactNode } from 'react';
import BankruptcyIntake from './BankruptcyIntake';
import ClientDashboard from './ClientDashboard';
import BankruptcyDocumentQuestionnaire from './bankruptcy-information-and-document-questionnaire(1).jsx';
import ChatWidget, { ClientQuestion } from './ChatWidget';
import AttorneyReviewPortal from './AttorneyReviewPortal';
import FirmCalendar from './FirmCalendar';
import ParalegalReview from './ParalegalReview';
import AccountingPortal from './AccountingPortal';
import ClientIntakeForm from './ClientIntakeForm';
import MessagePortal from './MessagePortal';
import FileCabinet from './FileCabinet';
import StaffDashboard from './StaffDashboard';
import SuperAdminPortal from './SuperAdminPortal';
import StaffCommHub from './StaffCommHub';
import TrusteeDocumentPortal from './TrusteeDocumentPortal';
import LegalAdminPortal from './LegalAdminPortal';
import AttorneyIntakeDashboard from './AttorneyIntakeDashboard';
import ECFNoticesPortal from './ECFNoticesPortal';
import FileACasePortal from './FileACasePortal';
import CreditorVerificationPortal from './CreditorVerificationPortal';
import AIBotPortal from './AIBotPortal';
import ClientRegistration from './ClientRegistration';
import AttorneyRegistration from './AttorneyRegistration';
import LegacyClientImport from './LegacyClientImport';
import SuperAdminPage from './admin/SuperAdminPage';
import { validateToken } from './lib/clientAccess';
import { useFirmFlags } from './lib/useFirmFlags';
import type { NavFlags } from './lib/useFirmFlags';
import SigningReview from './components/SigningReview';

class ErrorBoundary extends Component<{children: ReactNode}, {error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="p-8 font-mono bg-[#0f172a] text-red-400 min-h-screen">
          <h2 className="mb-4 text-lg font-bold">Runtime Error</h2>
          <pre className="whitespace-pre-wrap text-sm text-red-300">{this.state.error.message}</pre>
          <pre className="whitespace-pre-wrap text-xs text-slate-400 mt-4">{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

type View = 'dashboard' | 'questionnaire' | 'attorney' | 'attorney_sign' | 'signing_review' | 'ecf_notices' | 'file_a_case' | 'creditor_verification' | 'ai_bots' | 'calendar' | 'paralegal' | 'accounting' | 'intake' | 'intake_questionnaire' | 'messages' | 'file_cabinet' | 'staff_dashboard' | 'superadmin' | 'staff_comms' | 'client_view' | 'trustee' | 'legal_admin' | 'client_register' | 'attorney_register' | 'legacy_import' | 'bankruptcy_ai_admin';

// Maps each view to its firm_features boolean column.
// Views absent from this map are ungated (accessible to all).
const VIEW_FLAGS: Partial<Record<View, keyof NavFlags>> = {
  legal_admin:           'feature_intake_portal',
  intake_questionnaire:  'feature_intake_portal',
  intake:                'feature_intake_form',
  attorney:              'feature_attorney_intake_review',
  client_register:       'feature_client_registration',
  attorney_register:     'feature_attorney_registration',
  legacy_import:         'feature_legacy_import',
  dashboard:             'feature_client_portal',
  questionnaire:         'feature_client_portal',
  paralegal:             'feature_paralegal_review',
  attorney_sign:         'feature_attorney_review',
  signing_review:        'feature_signing_review',
  file_a_case:           'feature_file_a_case',
  ecf_notices:           'feature_ecf_notices',
  creditor_verification: 'feature_creditor_verification',
  ai_bots:               'feature_ai_bots',
  calendar:              'feature_calendar',
  file_cabinet:          'feature_file_cabinet',
  accounting:            'feature_accounting',
  trustee:               'feature_trustee_portal',
  messages:              'feature_messages',
  staff_dashboard:       'feature_tasks',
  superadmin:            'feature_productivity',
  staff_comms:           'feature_comms',
  // client_view: ungated — accessed via magic link or file_cabinet impersonation
  // bankruptcy_ai_admin: ungated here; SuperAdminPage enforces its own role check
};

// Redirect target when a gated view is blocked. feature_file_cabinet defaults
// true for all firms so this is always a safe landing spot.
const FALLBACK_VIEW: View = 'file_cabinet';

// ── Theme hook ────────────────────────────────────────────────────────────────
function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);
  return { dark, toggle: () => setDark(d => !d) };
}

// ── Sun / Moon icons ──────────────────────────────────────────────────────────
function SunIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" strokeWidth={2}/>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>
  );
}

function App() {
  const [view, setView] = useState<View>('legal_admin');
  const [updateMode, setUpdateMode] = useState(false);
  const [questions, setQuestions] = useState<ClientQuestion[]>([]);
  const [impersonateClient, setImpersonateClient] = useState<{ clientName: string; clientId: string } | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [gateToast, setGateToast] = useState<string | null>(null);
  const { dark, toggle } = useTheme();

  // BAN-40 phase 2 will replace these with values from the Supabase auth context.
  // Until auth is wired, read from env vars so each deployment is configured per firm.
  const firmId = (import.meta.env.VITE_FIRM_ID as string | undefined) ?? '00000000-0000-0000-0000-000000000001';
  const isSuperAdmin = (import.meta.env.VITE_PLATFORM_ROLE as string | undefined) === 'super_admin_bankruptcy_ai';

  const flags = useFirmFlags(firmId, isSuperAdmin);

  // Tracks whether flags have been loaded at least once. Used to suppress the
  // gate toast on the initial silent redirect (app start → gated view → fallback).
  const flagsLoadedRef = useRef(false);

  // Gate enforcement: when flags arrive or view changes, redirect away from any
  // view whose flag is OFF. First redirect (on flags load) is silent; subsequent
  // explicit navigation attempts surface the toast.
  useEffect(() => {
    if (!flags) return;
    const flagKey = VIEW_FLAGS[view];
    if (!isSuperAdmin && flagKey && !flags[flagKey]) {
      setView(FALLBACK_VIEW);
      if (flagsLoadedRef.current) {
        setGateToast('This feature is not yet available for your firm.');
      }
    }
    flagsLoadedRef.current = true;
  }, [view, flags, isSuperAdmin]);

  // Auto-dismiss gate toast after 4 s.
  useEffect(() => {
    if (!gateToast) return;
    const t = setTimeout(() => setGateToast(null), 4000);
    return () => clearTimeout(t);
  }, [gateToast]);

  // V1: magic-link client portal entry. If the URL has ?token=X and the
  // token is valid + unexpired, route to client_view scoped to that client.
  // Invalid or expired tokens land on a small error page and the URL param
  // is cleared so the user can navigate away cleanly.
  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    if (!token) return;
    let cancelled = false;
    (async () => {
      const client = await validateToken(token);
      if (cancelled) return;
      if (client) {
        setImpersonateClient({ clientName: client.full_name ?? 'Client', clientId: client.id });
        setView('client_view');
      } else {
        setTokenError('This portal link is invalid or has expired. Contact your attorney for a new link.');
      }
      // Strip token from the URL once consumed so a refresh doesn't re-trigger.
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
    })();
    return () => { cancelled = true; };
  }, []);

  const pendingCount = questions.filter(q => q.status === 'needs_attorney' || q.status === 'pending_review').length;

  // Navigate to a view, blocking gated destinations and surfacing the toast.
  function navigateTo(nextView: View) {
    if (flags && !isSuperAdmin) {
      const flagKey = VIEW_FLAGS[nextView];
      if (flagKey && !flags[flagKey]) {
        setGateToast('This feature is not yet available for your firm.');
        return;
      }
    }
    setView(nextView);
  }

  // Shared gate toast overlay — pointer-events: none so it doesn't block the nav bar.
  function GateToastOverlay() {
    if (!gateToast) return null;
    return (
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl
          bg-slate-900 border border-slate-700 shadow-2xl text-sm text-slate-200"
        style={{ maxWidth: '90vw', pointerEvents: 'none' }}
      >
        <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
        {gateToast}
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Georgia', serif" }}>
            Portal link unavailable
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">{tokenError}</p>
          <button
            onClick={() => setTokenError(null)}
            className="mt-6 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg"
          >
            Continue to bankruptcy.ai
          </button>
        </div>
      </div>
    );
  }

  const NAV_ITEMS: { id: View; label: string; icon: ReactNode; activeClass: string; flagKey?: keyof NavFlags }[] = [
    {
      id: 'legal_admin', label: '1. Intake Portal (Staff)', flagKey: 'feature_intake_portal',
      activeClass: 'bg-emerald-700 text-white shadow-emerald-700/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
    },
    {
      id: 'intake_questionnaire', label: '2. New Client Intake Form', flagKey: 'feature_intake_portal',
      activeClass: 'bg-amber-400 text-slate-900 shadow-amber-400/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>,
    },
    {
      id: 'attorney', label: '3. Attorney Intake Review', flagKey: 'feature_attorney_intake_review',
      activeClass: 'bg-amber-600 text-white shadow-amber-600/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>,
    },
    {
      id: 'client_register', label: '4. Client Registration', flagKey: 'feature_client_registration',
      activeClass: 'bg-sky-700 text-white shadow-sky-700/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>,
    },
    {
      id: 'attorney_register', label: 'Attorney Registration', flagKey: 'feature_attorney_registration',
      activeClass: 'bg-amber-700 text-white shadow-amber-700/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg>,
    },
    {
      id: 'legacy_import', label: 'Legacy Import', flagKey: 'feature_legacy_import',
      activeClass: 'bg-stone-700 text-white shadow-stone-700/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>,
    },
    {
      id: 'dashboard', label: '5. Client Portal', flagKey: 'feature_client_portal',
      activeClass: 'bg-slate-600 text-white shadow-slate-600/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
    },
    {
      id: 'paralegal', label: '6. Paralegal Review', flagKey: 'feature_paralegal_review',
      activeClass: 'bg-emerald-700 text-white shadow-emerald-700/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>,
    },
    {
      id: 'attorney_sign', label: '7. Attorney / Client Review and Sign', flagKey: 'feature_attorney_review',
      activeClass: 'bg-amber-600 text-white shadow-amber-600/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>,
    },
    {
      id: 'signing_review', label: '7.5. Signing Review', flagKey: 'feature_signing_review',
      activeClass: 'bg-sky-600 text-white shadow-sky-600/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>,
    },
    {
      id: 'file_a_case', label: '8. File a Case', flagKey: 'feature_file_a_case',
      activeClass: 'bg-emerald-700 text-white shadow-emerald-700/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg>,
    },
    {
      id: 'ecf_notices', label: '9. ECF Notices', flagKey: 'feature_ecf_notices',
      activeClass: 'bg-sky-700 text-white shadow-sky-700/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
    },
    {
      id: 'creditor_verification', label: '10. Creditor Verification', flagKey: 'feature_creditor_verification',
      activeClass: 'bg-sky-600 text-white shadow-sky-600/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>,
    },
    {
      id: 'ai_bots', label: '11. AI Bots', flagKey: 'feature_ai_bots',
      activeClass: 'bg-teal-700 text-white shadow-teal-700/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2M12 3v4"/></svg>,
    },
    {
      id: 'calendar', label: '12. Law Firm Calendar', flagKey: 'feature_calendar',
      activeClass: 'bg-sky-600 text-white shadow-sky-600/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
    },
    {
      id: 'file_cabinet', label: '13. File Cabinet', flagKey: 'feature_file_cabinet',
      activeClass: 'bg-slate-500 text-white shadow-slate-500/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>,
    },
    {
      id: 'accounting', label: '14. Accounting', flagKey: 'feature_accounting',
      activeClass: 'bg-teal-600 text-white shadow-teal-600/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
    },
    {
      id: 'trustee', label: '15. 341 / Trustee Documents', flagKey: 'feature_trustee_portal',
      activeClass: 'bg-sky-700 text-white shadow-sky-700/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg>,
    },
    {
      id: 'messages', label: 'Messages', flagKey: 'feature_messages',
      activeClass: 'bg-sky-600 text-white shadow-sky-600/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>,
    },
    {
      id: 'staff_dashboard', label: 'My Tasks', flagKey: 'feature_tasks',
      activeClass: 'bg-cyan-700 text-white shadow-cyan-700/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>,
    },
    {
      id: 'superadmin', label: 'Productivity', flagKey: 'feature_productivity',
      activeClass: 'bg-rose-700 text-white shadow-rose-700/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
    },
    {
      id: 'staff_comms', label: 'Comms', flagKey: 'feature_comms',
      activeClass: 'bg-violet-700 text-white shadow-violet-700/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>,
    },
    {
      id: 'bankruptcy_ai_admin', label: 'bankruptcy.ai Admin',
      activeClass: 'bg-amber-500 text-slate-950 shadow-amber-500/20',
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>,
    },
  ];

  // ── Portal toggle bar ─────────────────────────────────────────────────────
  function PortalToggle() {
    // While flags are loading show all items; once loaded, hide gated ones.
    // Super admin always sees everything.
    const visibleItems = flags && !isSuperAdmin
      ? NAV_ITEMS.filter(item => !item.flagKey || flags[item.flagKey])
      : NAV_ITEMS;

    return (
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-0.5 p-1 rounded-2xl shadow-2xl pointer-events-none
        bg-white/90 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-700/60">
        {visibleItems.map(item => (
          <button
            key={item.id}
            onClick={() => navigateTo(item.id)}
            className={`pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${
              view === item.id
                ? `${item.activeClass} shadow`
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            {item.icon}
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        ))}

        {/* Divider */}
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="pointer-events-auto flex items-center justify-center w-8 h-8 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all"
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    );
  }

  if (view === 'intake_questionnaire') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="relative">
          <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2.5
            bg-slate-900/95 backdrop-blur border-b border-slate-800 shadow-sm">
            <button
              onClick={() => setView('legal_admin')}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
              Back to Portal
            </button>
            <span className="text-xs text-slate-500 font-medium" style={{ fontFamily: "'Georgia', serif" }}>
              bankruptcy<span className="text-amber-400">.AI</span> — New Client Intake
            </span>
          </div>
          <div className="pt-12">
            <BankruptcyIntake />
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  if (view === 'intake') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <ClientIntakeForm onBack={() => setView('dashboard')} />
      </ErrorBoundary>
    );
  }

  if (view === 'questionnaire') {
    return (
      <div className="relative min-h-screen bg-slate-950">
        <GateToastOverlay />
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2.5
          bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <button
            onClick={() => { setView('dashboard'); setUpdateMode(false); }}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            Dashboard
          </button>
          <div className="flex items-center gap-3">
            {questions.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>{questions.length} question{questions.length !== 1 ? 's' : ''} saved</span>
                {pendingCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-500 font-semibold">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    </svg>
                    · {pendingCount} pending
                  </span>
                )}
              </div>
            )}
            <span className="text-xs text-slate-400 dark:text-slate-600">|</span>
            <span className="text-xs text-slate-500 font-medium" style={{ fontFamily: "'Georgia', serif" }}>
              bankruptcy<span className="text-amber-500">.ai</span>
            </span>
          </div>
        </div>
        <div className="pt-12">
          <ErrorBoundary>
            <BankruptcyDocumentQuestionnaire updateMode={updateMode} />
          </ErrorBoundary>
        </div>
        <ChatWidget onQuestionsChange={setQuestions} />
      </div>
    );
  }

  if (view === 'attorney') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24"><AttorneyIntakeDashboard /></div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'attorney_sign') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24"><AttorneyReviewPortal /></div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'signing_review') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24"><SigningReview /></div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'ecf_notices') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24"><ECFNoticesPortal /></div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'file_a_case') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24"><FileACasePortal /></div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'creditor_verification') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24"><CreditorVerificationPortal /></div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'ai_bots') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24"><AIBotPortal /></div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'paralegal') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24"><ParalegalReview /></div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'calendar') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24"><FirmCalendar /></div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'accounting') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24"><AccountingPortal /></div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'messages') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="min-h-screen bg-[#090e1a] p-4 pb-28">
          <div className="max-w-6xl mx-auto">
            <div className="mb-4">
              <h1 className="text-lg font-bold text-white">Message Portal</h1>
              <p className="text-xs text-slate-500 mt-0.5">Staff-to-client communications — SMS, email, voice, and Google Meet</p>
            </div>
            <div className="h-[75vh]">
              <MessagePortal senderName="Staff" senderRole="staff" />
            </div>
          </div>
        </div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'file_cabinet') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24">
          <FileCabinet
            onClientView={(clientName, clientId) => {
              setImpersonateClient({ clientName, clientId });
              setView('client_view');
            }}
          />
        </div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'client_view' && impersonateClient) {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24">
          <ClientDashboard
            onOpenQuestionnaire={() => { setUpdateMode(false); setView('questionnaire'); }}
            onUpdateInformation={() => { setUpdateMode(true); setView('questionnaire'); }}
            clientId={impersonateClient.clientId}
            staffImpersonation={{
              staffName: 'Staff',
              clientName: impersonateClient.clientName,
              onExit: () => { setImpersonateClient(null); setView('file_cabinet'); },
            }}
          />
        </div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'staff_dashboard') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24"><StaffDashboard /></div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'superadmin') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24"><SuperAdminPortal /></div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'bankruptcy_ai_admin') {
    // BAN-40 stub: full Supabase-auth gate pending. For now we pass undefined
    // so the page renders its "Access Denied" view. Once auth context is wired
    // up, pass the current user's platform_role here.
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24"><SuperAdminPage currentUserRole={undefined} /></div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'staff_comms') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24"><StaffCommHub /></div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'trustee') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24"><TrusteeDocumentPortal /></div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'legal_admin') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24"><LegalAdminPortal /></div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'client_register') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24">
          <ClientRegistration onComplete={() => setView('dashboard')} />
        </div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'attorney_register') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24">
          <AttorneyRegistration onComplete={() => setView('legal_admin')} onBack={() => setView('legal_admin')} />
        </div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  if (view === 'legacy_import') {
    return (
      <ErrorBoundary>
        <GateToastOverlay />
        <div className="pb-24"><LegacyClientImport /></div>
        <PortalToggle />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <GateToastOverlay />
      <div className="pb-24">
        <ClientDashboard
          onOpenQuestionnaire={() => { setUpdateMode(false); setView('questionnaire'); }}
          onUpdateInformation={() => { setUpdateMode(true); setView('questionnaire'); }}
        />
      </div>
      <ChatWidget onQuestionsChange={setQuestions} />
      <PortalToggle />
    </ErrorBoundary>
  );
}

export default App;
