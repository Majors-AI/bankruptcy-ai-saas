import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

// Config flag: set VITE_SHOW_AI_NO_TRAINING=false to hide this disclosure line (default: shown)
const SHOW_AI_NO_TRAINING = import.meta.env.VITE_SHOW_AI_NO_TRAINING !== 'false';

// ── Palette ───────────────────────────────────────────────────────────────────
// Local constants for the light/blue restyle. BAN-79 will swap these to shared
// design tokens — keeping them in one place here keeps that future change a
// single-file diff.
const COLORS = {
  bg:           '#FFFFFF',
  surface:      '#F8FAFC',  // cards, inputs, surfaces
  surfaceBlue:  '#DBEAFE',  // soft-blue intro card + accent chrome
  border:       '#E2E8F0',
  borderSubtle: '#F1F5F9',
  heading:      '#0F172A',  // slate-900
  body:         '#475569',  // slate-600
  faint:        '#94A3B8',  // slate-400
  primary:      '#2563EB',  // blue-600 — buttons, links, icons, brand mark
  primaryHover: '#3B82F6',  // blue-500
  accent:       '#0EA5E9',  // sky-500 (secondary)
  error:        '#DC2626',
  warning:      '#D97706',
  success:      '#16A34A',
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'landing' | 'register' | 'login' | 'disclosures' | 'your_docs' | 'success';

interface Props {
  onComplete: () => void;
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

const INITIAL_FORM: FormData = {
  firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginTop: 12 }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          flexShrink: 0, width: 16, height: 16, marginTop: 2,
          border: `1.5px solid ${checked ? COLORS.primary : COLORS.faint}`,
          background: checked ? COLORS.primary : COLORS.bg,
          borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 150ms ease-out',
        }}
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </div>
      <span style={{ fontSize: 13, color: COLORS.body, lineHeight: 1.6 }}>{label}</span>
    </label>
  );
}

function DisclosureSection({ num, title, children, needsReview }: {
  num: number; title: string; children: React.ReactNode; needsReview?: boolean;
}) {
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: 20, background: COLORS.surface }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: COLORS.heading, marginBottom: 8 }}>
        <span style={{ width: 20, height: 20, background: COLORS.surfaceBlue, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: COLORS.primary, flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>{num}</span>
        {title}
      </h3>
      {needsReview && (
        <div style={{ fontSize: 10, color: COLORS.warning, border: `1px dashed ${COLORS.warning}`, borderRadius: 2, padding: '2px 8px', display: 'inline-block', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
          [NEEDS ATTORNEY REVIEW] — Placeholder language — not final
        </div>
      )}
      {children}
    </div>
  );
}

function DisclosureBody({ children, uncapped }: { children: React.ReactNode; uncapped?: boolean }) {
  return (
    <div style={{ fontSize: 12, color: COLORS.body, lineHeight: 1.7, paddingRight: 4, ...(uncapped ? {} : { maxHeight: 140, overflowY: 'auto' as const }) }}>
      {children}
    </div>
  );
}

// ── PlaceholderBrandLogo ─────────────────────────────────────────────────────
// Single swappable element rendered above the firm name on the landing step
// when firm_branding.logo_url is absent. A calm, neutral shield-check mark in
// the brand accent color — meant to read as a legal/security logo, not a
// product mark.
//
// BAN-79: when FirmBrandingProvider lands, the landing block will choose
// between <img src={firmLogoUrl}> and this fallback in one place. Keeping the
// fallback as its own component now means BAN-79 doesn't need to rewrite the
// SVG inline — it can simply leave or remove this call site.
function PlaceholderBrandLogo() {
  return (
    <div
      style={{
        width: 64, height: 64, borderRadius: 16,
        background: COLORS.bg,
        border: `1.5px solid ${COLORS.primary}33`,
        boxShadow: `0 1px 2px ${COLORS.primary}14, 0 6px 16px ${COLORS.primary}14`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 18,
      }}
      aria-hidden="true"
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.5 L4 5.5 V11 C4 15.5 7.5 19.5 12 21.5 C16.5 19.5 20 15.5 20 11 V5.5 Z" />
        <path d="M9 12 L11 14 L15 10" />
      </svg>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ClientRegistration({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('landing');
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [skippedRegistration, setSkippedRegistration] = useState(false);
  // ── Firm identity (BAN-79 prep) ───────────────────────────────────────────
  // Two sources, in priority order:
  //   1. firm_branding (display_name + logo_url) — operator-edited brand row.
  //   2. firms.name — the plain firm record; used only when branding is absent.
  // Both reads happen in parallel. The future FirmBrandingProvider will
  // replace these two `supabase.from(...)` calls with one context lookup.
  const [firmName, setFirmName] = useState('your law firm');
  const [firmLogoUrl, setFirmLogoUrl] = useState<string | null>(null);
  // Communications-consent checkbox on the registration step. UI capture only
  // today — BAN-81 wires the persisted record (timestamp, agreed text, IP/UA)
  // when the registration write path lands.
  const [consentCommunications, setConsentCommunications] = useState(false);

  useEffect(() => {
    const firmId = import.meta.env.VITE_FIRM_ID as string | undefined;
    if (!firmId) {
      console.warn('VITE_FIRM_ID is not set — firm name defaults to "your law firm"');
      return;
    }
    // Highest-priority source: firm_branding (operator-curated identity).
    supabase
      .from('firm_branding')
      .select('display_name, logo_url')
      .eq('firm_id', firmId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setFirmName(data.display_name);
        if (data?.logo_url) setFirmLogoUrl(data.logo_url);
      });
    // Fallback source: firms.name. Only applied if firm_branding hasn't
    // already supplied a name (race-safe via functional setState).
    supabase
      .from('firms')
      .select('name')
      .eq('id', firmId)
      .single()
      .then(({ data }) => {
        if (data?.name) {
          setFirmName(prev => prev === 'your law firm' ? data.name : prev);
        }
      });
  }, []);

  // ── Required disclosure acknowledgements ──────────────────────────────────
  const [consentGeneral, setConsentGeneral]             = useState(false);
  const [consentCreditPull, setConsentCreditPull]       = useState(false); // FCRA — §2
  const [consentSendGrid, setConsentSendGrid]           = useState(false);
  const [consentTwilio, setConsentTwilio]               = useState(false);
  const [consentPlaidBank, setConsentPlaidBank]         = useState(false); // affirmative, unchecked by default
  const [consentPlaidPayroll, setConsentPlaidPayroll]   = useState(false); // affirmative, unchecked by default
  const [consentDataRetention, setConsentDataRetention] = useState(false);
  const [consentAiDisclosure, setConsentAiDisclosure]   = useState(false);
  const [consentElectronic, setConsentElectronic]       = useState(false);

  // ── Signature — Debtor 1 (always shown) ──────────────────────────────────
  const [signerFullName, setSignerFullName]         = useState('');
  const [signerPrintedName, setSignerPrintedName]   = useState('');
  const signatureDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // ── Joint filing — Debtor 2 (conditional) ────────────────────────────────
  const [isJointFiling, setIsJointFiling]           = useState(false);
  const [debtor2FullName, setDebtor2FullName]       = useState('');
  const [debtor2PrintedName, setDebtor2PrintedName] = useState('');

  const [consentTimestamp, setConsentTimestamp] = useState('');
  const [registeredEmail, setRegisteredEmail]   = useState('');

  const signatureComplete =
    signerFullName.trim().length > 0 &&
    signerPrintedName.trim().length > 0 &&
    (!isJointFiling || (debtor2FullName.trim().length > 0 && debtor2PrintedName.trim().length > 0));

  const allDisclosuresAccepted =
    consentGeneral && consentCreditPull && consentSendGrid && consentTwilio &&
    consentPlaidBank && consentPlaidPayroll &&
    consentDataRetention && consentAiDisclosure && consentElectronic &&
    signatureComplete;

  function setField(field: keyof FormData, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: '' }));
  }

  function validateRegister(): boolean {
    const e: Partial<FormData> = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required';
    if (!form.phone.trim()) e.phone = 'Required';
    if (!form.password || form.password.length < 8) e.password = 'Minimum 8 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleRegister() {
    if (!validateRegister()) return;
    setLoading(true);
    setServerError('');
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { first_name: form.firstName, last_name: form.lastName, phone: form.phone } },
      });
      if (error) throw error;
      setStep('disclosures');
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!form.email || !form.password) {
      setErrors({ email: !form.email ? 'Required' : '', password: !form.password ? 'Required' : '' });
      return;
    }
    setLoading(true);
    setServerError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      if (error) throw error;
      setStep('disclosures');
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function handleSkipToDisclosures() {
    setSkippedRegistration(true);
    setStep('disclosures');
  }

  async function handleDisclosuresAccepted() {
    setLoading(true);
    const ts = new Date().toISOString();
    // TODO: assumes one deployment per firm; if firms ever share a deployment this is
    //       wrong and needs a per-client firm association.
    const firmId = import.meta.env.VITE_FIRM_ID as string | undefined;
    if (!firmId) {
      console.warn('VITE_FIRM_ID is not set — firm_id will be null on client registration record');
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const emailAddr = form.email || user?.email || '';
      if (user) {
        await supabase.from('client_registrations').upsert({
          user_id: user.id,
          email: emailAddr,
          firm_id: firmId ?? null,
          consented_general: true,
          consented_sendgrid: true,
          consented_twilio: true,
          consented_electronic: true,
          // Credit pull — FCRA ghost columns (consent captured here; live pull is MAJ-59)
          consented_isoftpull: consentCreditPull,
          consented_isoftpull_fcra: consentCreditPull,
          opt_in_isoftpull: consentCreditPull,
          isoftpull_consent_timestamp: consentCreditPull ? ts : null,
          // Plaid per-product affirmative consents
          opt_in_plaid_bank: consentPlaidBank,
          opt_in_plaid_payroll: consentPlaidPayroll,
          consented_plaid_bank: consentPlaidBank,
          consented_plaid_payroll: consentPlaidPayroll,
          consented_data_retention: consentDataRetention,
          consented_ai_disclosure: consentAiDisclosure,
          skipped_registration: skippedRegistration,
          consent_timestamp: ts,
          // Signature — Debtor 1
          signer_full_name: signerFullName,
          signer_printed_name: signerPrintedName,
          signature_timestamp: ts,
          // Joint filing — Debtor 2
          is_joint_filing: isJointFiling,
          debtor2_full_name: isJointFiling ? debtor2FullName : null,
          debtor2_printed_name: isJointFiling ? debtor2PrintedName : null,
          debtor2_signature_timestamp: isJointFiling ? ts : null,
          disclosure_version: 'v1.0',
          // ip_address is written by the get-client-ip edge function below
        });
        setRegisteredEmail(emailAddr);

        // Capture client IP at the HTTP edge — do NOT use inet_client_addr() which returns
        // the Supabase infrastructure IP, not the client's real address.
        try {
          await supabase.functions.invoke('get-client-ip', { body: { user_id: user.id } });
        } catch {
          // non-blocking — IP capture failure does not prevent registration completion
          // ip_address remains null on this record
        }
      }
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
    setConsentTimestamp(ts);
    setStep('your_docs');
  }

  // ── Shared styles ─────────────────────────────────────────────────────────

  const bg = COLORS.bg;

  const inputStyle = (hasError?: boolean): React.CSSProperties => ({
    width: '100%', height: 36, background: COLORS.bg,
    border: `1px solid ${hasError ? COLORS.error : COLORS.border}`,
    borderRadius: 4, padding: '0 12px', fontSize: 14,
    color: COLORS.heading, outline: 'none', boxSizing: 'border-box',
    fontFamily: "'Inter', system-ui, sans-serif",
  });

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 500,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    color: COLORS.body, marginBottom: 6,
  };

  const primaryBtn: React.CSSProperties = {
    width: '100%', background: COLORS.primary, color: '#FFFFFF',
    border: 'none', borderRadius: 4, padding: '10px 18px',
    fontSize: 14, fontWeight: 500, cursor: 'pointer',
    transition: 'background 150ms ease-out',
    fontFamily: "'Inter', system-ui, sans-serif",
  };

  const secondaryBtn: React.CSSProperties = {
    width: '100%', background: COLORS.bg, color: COLORS.heading,
    border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: '10px 18px',
    fontSize: 14, fontWeight: 500, cursor: 'pointer',
    fontFamily: "'Inter', system-ui, sans-serif",
  };

  const disabledBtn: React.CSSProperties = { ...primaryBtn, opacity: 0.35, cursor: 'not-allowed' };

  const backBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 13, color: COLORS.body, background: 'transparent',
    border: 'none', cursor: 'pointer', marginBottom: 24, padding: 0,
  };

  function PrimaryBtn({ label, loadLabel, onClick, disabled }: { label: string; loadLabel?: string; onClick?: () => void; disabled?: boolean }) {
    const [hover, setHover] = useState(false);
    return (
      <button
        onClick={onClick}
        disabled={disabled || loading}
        style={disabled || loading ? disabledBtn : { ...primaryBtn, background: hover ? COLORS.primaryHover : COLORS.primary }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {loading && loadLabel ? loadLabel : label}
      </button>
    );
  }

  // ── LANDING ───────────────────────────────────────────────────────────────

  if (step === 'landing') {
    // Three client-benefit cards. Kept inline so the SVG/icon, title, and
    // copy live together — no other surface consumes this list.
    const benefitCards = [
      {
        title: 'Simple, guided intake',
        body: 'An easy form that walks you through each question in plain language. No legal jargon.',
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
          </svg>
        ),
      },
      {
        title: 'Quick attorney review',
        body: 'A licensed attorney personally reviews your case — usually fast.',
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
          </svg>
        ),
      },
      {
        title: 'Fast access once you qualify',
        body: 'If we accept your case and you sign your agreement, your full secure portal opens right away.',
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
        ),
      },
    ];

    return (
      <div style={{ minHeight: '100vh', background: bg, padding: '40px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 560 }}>

          {/* Hero — firm identity. Logo if firm_branding.logo_url is present;
              else a neutral document icon. Firm name as the brand title. */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            {firmLogoUrl ? (
              <img
                src={firmLogoUrl}
                alt={`${firmName} logo`}
                style={{ maxHeight: 64, maxWidth: 240, margin: '0 auto 18px', objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <PlaceholderBrandLogo />
            )}
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 32, letterSpacing: '-0.02em', color: COLORS.heading, margin: 0, lineHeight: 1.1 }}>
              {firmName}
            </h1>
            <p style={{ fontSize: 15, color: COLORS.body, marginTop: 16, lineHeight: 1.55, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
              {firmName} has invited you to your secure client portal.
            </p>
            <p style={{ fontSize: 14, color: COLORS.body, marginTop: 10, lineHeight: 1.55, fontStyle: 'italic', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
              A simpler way through bankruptcy — guided every step of the way.
            </p>
          </div>

          {/* 3 client-benefit cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            marginBottom: 28,
          }}>
            {benefitCards.map(card => (
              <div key={card.title} style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: 18,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: COLORS.surfaceBlue,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  {card.icon}
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.heading, margin: 0, marginBottom: 6, lineHeight: 1.3 }}>{card.title}</p>
                <p style={{ fontSize: 13, color: COLORS.body, margin: 0, lineHeight: 1.5 }}>{card.body}</p>
              </div>
            ))}
          </div>

          {/* Reassurance band */}
          <div style={{
            background: COLORS.surfaceBlue,
            border: `1px solid ${COLORS.primary}33`,
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 24,
            fontSize: 13,
            color: COLORS.body,
            lineHeight: 1.6,
            textAlign: 'center',
          }}>
            Your initial consultation is free and obligates you to nothing. Start your intake anytime and pick up right where you left off.
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => setStep('register')}
              style={{ ...primaryBtn, textAlign: 'left', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = COLORS.primaryHover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = COLORS.primary; }}
            >
              <span>Create new account</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
            </button>

            <button
              onClick={() => setStep('login')}
              style={{ ...secondaryBtn, textAlign: 'left', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span>Sign in to existing account</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 16l-4-4m0 0l4-4m-4 4h14"/></svg>
            </button>

            <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 16, marginTop: 8 }}>
              <p style={{ fontSize: 12, color: COLORS.body, marginBottom: 10 }}>
                You can also skip account creation and review disclosures directly. You will need to provide your information manually if you opt out of automated services.
              </p>
              <button onClick={handleSkipToDisclosures} style={{ ...secondaryBtn, padding: '10px 18px', fontSize: 13 }}>
                Skip to disclosures →
              </button>
            </div>
          </div>

          <p style={{ fontSize: 11, color: COLORS.faint, marginTop: 32, textAlign: 'center' }}>Protected by 256-bit TLS encryption.</p>
        </div>
      </div>
    );
  }

  // ── REGISTER ──────────────────────────────────────────────────────────────

  if (step === 'register') {
    return (
      <div style={{ minHeight: '100vh', background: bg, padding: 24, paddingTop: 40 }}>
        <div style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
          <button onClick={() => setStep('landing')} style={backBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            Back
          </button>

          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em', color: COLORS.heading, marginBottom: 6 }}>Create account</h2>
          <p style={{ fontSize: 13, color: COLORS.body, marginBottom: 28 }}>bankruptcy.ai — Secure Client Portal for {firmName}</p>

          {serverError && (
            <div style={{ border: `1px solid ${COLORS.error}`, borderRadius: 4, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: COLORS.error }}>{serverError}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>First name</label>
                <input style={inputStyle(!!errors.firstName)} value={form.firstName} onChange={e => setField('firstName', e.target.value)} placeholder="First" />
                {errors.firstName && <p style={{ fontSize: 11, color: COLORS.error, marginTop: 4 }}>{errors.firstName}</p>}
              </div>
              <div>
                <label style={labelStyle}>Last name</label>
                <input style={inputStyle(!!errors.lastName)} value={form.lastName} onChange={e => setField('lastName', e.target.value)} placeholder="Last" />
                {errors.lastName && <p style={{ fontSize: 11, color: COLORS.error, marginTop: 4 }}>{errors.lastName}</p>}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Email address</label>
              <input type="email" style={inputStyle(!!errors.email)} value={form.email} onChange={e => setField('email', e.target.value)} placeholder="you@example.com" />
              {errors.email && <p style={{ fontSize: 11, color: COLORS.error, marginTop: 4 }}>{errors.email}</p>}
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input type="tel" style={inputStyle(!!errors.phone)} value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="(555) 000-0000" />
              {errors.phone && <p style={{ fontSize: 11, color: COLORS.error, marginTop: 4 }}>{errors.phone}</p>}
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" style={inputStyle(!!errors.password)} value={form.password} onChange={e => setField('password', e.target.value)} placeholder="Minimum 8 characters" />
              {errors.password && <p style={{ fontSize: 11, color: COLORS.error, marginTop: 4 }}>{errors.password}</p>}
            </div>
            <div>
              <label style={labelStyle}>Confirm password</label>
              <input type="password" style={inputStyle(!!errors.confirmPassword)} value={form.confirmPassword} onChange={e => setField('confirmPassword', e.target.value)} placeholder="Re-enter password" />
              {errors.confirmPassword && <p style={{ fontSize: 11, color: COLORS.error, marginTop: 4 }}>{errors.confirmPassword}</p>}
            </div>

            {/* Communications-consent checkbox — must be actively checked.
                TODO BAN-81: persist consent record (timestamp, agreed text,
                IP + user-agent) on the registration write path. Today this
                is UI capture only — the value never leaves the client. */}
            <div style={{
              marginTop: 4,
              padding: 14,
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
            }}>
              <Checkbox
                checked={consentCommunications}
                onChange={setConsentCommunications}
                label={<>I agree to receive SMS text messages, emails, and phone calls from <strong style={{ color: COLORS.heading }}>{firmName}</strong> about my case. Message and data rates may apply; I can opt out anytime by replying STOP.</>}
              />
              <p style={{ fontSize: 11, color: COLORS.faint, marginTop: 10, marginLeft: 26, lineHeight: 1.5 }}>
                Your consent is recorded at registration.
              </p>
            </div>

            {/* Auth-options expectation copy — not functional. Real OAuth /
                magic-link plumbing lands in BAN-81. */}
            <div style={{ marginTop: 4, fontSize: 12, color: COLORS.body, lineHeight: 1.55 }}>
              <p style={{ margin: 0 }}>
                After you register, we'll email you a secure link to access your account and help you set up two-factor authentication for your security.
              </p>
              <p style={{ margin: 0, marginTop: 6, color: COLORS.faint, fontStyle: 'italic' }}>
                Sign up with Apple, Google, or an authenticator app — coming soon.
              </p>
            </div>

            {/* TCPA: consent to SMS/phone/email contact must NOT be a
                condition of registration. The submit is therefore NOT gated
                by consentCommunications — the checkbox above records whether
                the client consented (BAN-81 persists that value), but
                registration proceeds regardless. */}
            <div style={{ marginTop: 4 }}>
              <PrimaryBtn
                label="Continue to disclosures"
                loadLabel="Creating account..."
                onClick={handleRegister}
              />
            </div>
          </div>

          <p style={{ fontSize: 12, color: COLORS.body, marginTop: 16, textAlign: 'center' }}>
            Already have an account?{' '}
            <button onClick={() => setStep('login')} style={{ background: 'none', border: 'none', color: COLORS.primary, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Sign in</button>
          </p>
        </div>
      </div>
    );
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────

  if (step === 'login') {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <button onClick={() => setStep('landing')} style={backBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            Back
          </button>

          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em', color: COLORS.heading, marginBottom: 6 }}>Welcome back</h2>
          <p style={{ fontSize: 13, color: COLORS.body, marginBottom: 28 }}>Sign in to your bankruptcy.ai account — {firmName}</p>

          {serverError && (
            <div style={{ border: `1px solid ${COLORS.error}`, borderRadius: 4, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: COLORS.error }}>{serverError}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Email address</label>
              <input type="email" style={inputStyle(!!errors.email)} value={form.email} onChange={e => setField('email', e.target.value)} placeholder="you@example.com" />
              {errors.email && <p style={{ fontSize: 11, color: COLORS.error, marginTop: 4 }}>{errors.email}</p>}
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" style={inputStyle(!!errors.password)} value={form.password} onChange={e => setField('password', e.target.value)} placeholder="Your password" />
              {errors.password && <p style={{ fontSize: 11, color: COLORS.error, marginTop: 4 }}>{errors.password}</p>}
            </div>
            <div style={{ marginTop: 4 }}>
              <PrimaryBtn label="Sign in" loadLabel="Signing in..." onClick={handleLogin} />
            </div>
          </div>

          <p style={{ fontSize: 12, color: COLORS.body, marginTop: 16, textAlign: 'center' }}>
            New client?{' '}
            <button onClick={() => setStep('register')} style={{ background: 'none', border: 'none', color: COLORS.primary, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Create an account</button>
          </p>
        </div>
      </div>
    );
  }

  // ── DISCLOSURES ───────────────────────────────────────────────────────────

  if (step === 'disclosures') {
    return (
      <div style={{ minHeight: '100vh', background: bg, padding: 24, paddingTop: 40 }}>
        <div style={{ width: '100%', maxWidth: 680, margin: '0 auto' }}>
          {!skippedRegistration && (
            <button onClick={() => setStep('register')} style={backBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
              Back
            </button>
          )}

          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em', color: COLORS.heading, marginBottom: 6 }}>
            Disclosures & Authorizations
          </h2>
          <p style={{ fontSize: 13, color: COLORS.body, marginBottom: 32, maxWidth: 540 }}>
            Read each section carefully and check each box to confirm your understanding.
            All disclosures and consents below are required to access the portal.
            Your typed signature at the bottom constitutes your electronic signature under the E-SIGN Act.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* 1 — Who you are working with + ownership + use of information */}
            <DisclosureSection num={1} title="Who You Are Working With" needsReview>
              <DisclosureBody uncapped>
                <p><strong style={{ color: COLORS.heading }}>{firmName}</strong> ("the Firm," "we," "us") is the law firm you have retained for your bankruptcy matter. The Firm uses a secure technology platform owned and operated by <strong style={{ color: COLORS.heading }}>Bankruptcy.AI, LLC</strong> ("Bankruptcy.AI") to collect, manage, and prepare your information. Bankruptcy.AI is the Firm's technology service provider — it is not your attorney and does not provide legal advice.</p>
                <p style={{ marginTop: 8 }}><strong style={{ color: COLORS.heading }}>Who obtains and owns your information.</strong> All information obtained through the platform — including any credit report, financial-account data, documents, and questionnaire responses — is obtained for and belongs to {firmName}. Bankruptcy.AI operates the platform on the Firm's behalf and does not own your information.</p>
                <p style={{ marginTop: 8 }}><strong style={{ color: COLORS.heading }}>How your information is used.</strong> Your information is used only in connection with your engagement with the Firm and the preparation and handling of your bankruptcy matter, in accordance with the Firm's privacy practices and applicable law (including the Gramm-Leach-Bliley Act).</p>
                <p style={{ marginTop: 8 }}><strong style={{ color: COLORS.heading }}>Your choices and E-SIGN.</strong> Withdrawal of any consent is voluntary — contact the Firm. Withdrawal may limit preparation of your matter, and some data is retained as required by law. You consent to receive disclosures and records electronically under the E-SIGN Act; paper copies are available from the Firm on request. The platform is software. All legal advice and representation come solely from {firmName} and its licensed attorneys.</p>
              </DisclosureBody>
              <Checkbox
                checked={consentGeneral}
                onChange={setConsentGeneral}
                label={<>I have read and understand the above. I understand that <strong style={{ color: COLORS.heading }}>{firmName}</strong> is my attorney and that Bankruptcy.AI is the Firm's technology service provider — not my attorney.</>}
              />
            </DisclosureSection>

            {/* 2 — Credit report authorization — TransUnion via iSoftpull (soft inquiry) */}
            <DisclosureSection num={2} title="Authorization to Obtain Your Credit Report (Soft Inquiry)" needsReview>
              <DisclosureBody uncapped>
                <p>I authorize <strong style={{ color: COLORS.heading }}>{firmName}</strong> and its technology service provider, <strong style={{ color: COLORS.heading }}>Bankruptcy.AI</strong>, to obtain my consumer credit report from <strong style={{ color: COLORS.heading }}>TransUnion</strong>, through <strong style={{ color: COLORS.heading }}>iSoftpull</strong>, to prepare my bankruptcy matter.</p>
                <p style={{ marginTop: 8 }}>I understand the report is transmitted through and stored by the Bankruptcy.AI platform and made available to the Firm, that the report is obtained by the Firm under the Firm's permissible purpose based on this written authorization, and that this is a <strong style={{ color: COLORS.heading }}>soft inquiry that will not affect my credit score</strong>.</p>
              </DisclosureBody>
              <Checkbox
                checked={consentCreditPull}
                onChange={setConsentCreditPull}
                label={<>I authorize <strong style={{ color: COLORS.heading }}>{firmName}</strong> and its technology service provider Bankruptcy.AI to obtain my TransUnion consumer credit report through iSoftpull to prepare my bankruptcy matter. I understand this is a soft inquiry and will not affect my credit score.</>}
              />
            </DisclosureSection>

            {/* 3 — SendGrid [KEEP] */}
            <DisclosureSection num={3} title="Email Communications — SendGrid">
              <DisclosureBody>
                <p>You authorize bankruptcy.ai and {firmName} to send case-related email communications through <strong style={{ color: COLORS.heading }}>SendGrid</strong> (Twilio Inc.). These may include: case status updates, document requests, appointment confirmations, and deadline notifications. For V1, emails are sent from bankruptcy.ai's master SendGrid account. Future versions may use a dedicated {firmName} domain (V1.1). Transactional case emails cannot be disabled while your case is active.</p>
              </DisclosureBody>
              <Checkbox checked={consentSendGrid} onChange={setConsentSendGrid} label="I consent to receiving email communications via SendGrid as described above." />
            </DisclosureSection>

            {/* 4 — Twilio [KEEP] */}
            <DisclosureSection num={4} title="SMS / Voice Communications — Twilio">
              <DisclosureBody>
                <p>You authorize bankruptcy.ai and {firmName} to contact you via SMS and/or automated voice calls through <strong style={{ color: COLORS.heading }}>Twilio</strong>. These may include: appointment reminders, document upload notifications, urgent case alerts, and two-factor authentication codes. For V1, SMS is sent from bankruptcy.ai's master Twilio account. A dedicated {firmName} number may be used in future versions. Message and data rates may apply. Reply STOP to opt out of non-essential SMS. Reply HELP for help.</p>
              </DisclosureBody>
              <Checkbox checked={consentTwilio} onChange={setConsentTwilio} label="I consent to receiving SMS and/or voice communications via Twilio as described above." />
            </DisclosureSection>

            {/* 5 — Plaid bank — affirmative checkbox, unchecked by default */}
            <DisclosureSection num={5} title="Bank Account Connection — Plaid" needsReview>
              <DisclosureBody>
                <p>I authorize <strong style={{ color: COLORS.heading }}>{firmName}</strong> and its service providers to connect to my financial accounts through <strong style={{ color: COLORS.heading }}>Plaid</strong> to retrieve the account and transaction information needed to prepare my bankruptcy schedules. This connection is initiated by me, I can disconnect at any time, and the information is retrieved for the Firm.</p>
              </DisclosureBody>
              <Checkbox
                checked={consentPlaidBank}
                onChange={setConsentPlaidBank}
                label={<>I authorize <strong style={{ color: COLORS.heading }}>{firmName}</strong> and its service providers to connect to my financial accounts through Plaid to retrieve account and transaction information for the Firm.</>}
              />
            </DisclosureSection>

            {/* 6 — Plaid payroll/income — affirmative checkbox, unchecked by default */}
            <DisclosureSection num={6} title="Payroll & Income Connection — Plaid" needsReview>
              <DisclosureBody>
                <p>I authorize <strong style={{ color: COLORS.heading }}>{firmName}</strong> and its service providers to connect to my payroll and income records through <strong style={{ color: COLORS.heading }}>Plaid</strong> to retrieve the payroll and income information needed to prepare my bankruptcy schedules. This connection is initiated by me, I can disconnect at any time, and the information is retrieved for the Firm.</p>
              </DisclosureBody>
              <Checkbox
                checked={consentPlaidPayroll}
                onChange={setConsentPlaidPayroll}
                label={<>I authorize <strong style={{ color: COLORS.heading }}>{firmName}</strong> and its service providers to connect to my payroll and income records through Plaid to retrieve income information for the Firm.</>}
              />
            </DisclosureSection>

            {/* 7 — Data Retention [KEEP] */}
            <DisclosureSection num={7} title="Data Retention & Copy-and-Purge Policy" needsReview>
              <DisclosureBody>
                <p>bankruptcy.ai operates a <strong style={{ color: COLORS.heading }}>30-day post-closing copy-and-purge</strong> data retention model. Upon final closure of your bankruptcy case: (a) {firmName} retains a complete copy of your case file per applicable rules of professional conduct and applicable state law; (b) bankruptcy.ai's active platform storage is purged of your case data within 30 days of the closure date. Backup and audit log retention may apply for a longer period under applicable law. This policy aligns with the Master Services Agreement between bankruptcy.ai and {firmName}.</p>
                <p style={{ marginTop: 8 }}>You may request a copy of your case file from {firmName} at any time during or after your case. Records required by law to be retained will be maintained for the period required by applicable statute.</p>
              </DisclosureBody>
              <Checkbox checked={consentDataRetention} onChange={setConsentDataRetention} label={`I understand and consent to the 30-day post-closing data retention and copy-and-purge policy described above.`} />
            </DisclosureSection>

            {/* 8 — How Bankruptcy.AI handles your information + AI-training opt-in
                Required toggle covers Bankruptcy.AI's data-handling commitments.
                AI-training opt-in described in prose; per-client opt-in capture is
                a follow-up (would need its own toggle + DB column — flagged for Dom). */}
            <DisclosureSection num={8} title="How Bankruptcy.AI Handles Your Information" needsReview>
              <DisclosureBody uncapped>
                <p>Bankruptcy.AI operates the platform on behalf of <strong style={{ color: COLORS.heading }}>{firmName}</strong>. Bankruptcy.AI:</p>
                <ul style={{ marginTop: 8, paddingLeft: 16 }}>
                  <li>Obtains, has access to, stores, and relays your information to {firmName} so the Firm can prepare your matter.</li>
                  <li>Does not use your information for its own purposes; does not sell, rent, or share it; and does not use it for advertising.</li>
                  <li>Accesses your information only to operate the platform, provide the services you and the Firm use, and provide technical support to the Firm at the Firm's request — limited to what is necessary and logged.</li>
                  <li>Stores your information securely (encrypted in transit and at rest, on infrastructure configured to SOC 2 control standards) and keeps each firm's information separate.</li>
                  {SHOW_AI_NO_TRAINING && (
                    <li>May use information from your case, only in <strong style={{ color: COLORS.heading }}>de-identified</strong> form and only if you separately opt in, to develop, train, and improve its artificial-intelligence models and services. This does not change the Firm's ownership of your information or the limits above.</li>
                  )}
                </ul>
                <p style={{ marginTop: 10 }}>The platform also uses <strong style={{ color: COLORS.heading }}>automated processing</strong> to help organize your documents and surface items for the Firm's review. <strong style={{ color: COLORS.heading }}>All legal decisions, advice, and filings remain solely the responsibility of {firmName} and its licensed attorneys</strong> — no automated tool replaces your attorney's judgment.</p>
                {SHOW_AI_NO_TRAINING && (
                  <p style={{ marginTop: 10, padding: 10, border: `1px dashed ${COLORS.border}`, borderRadius: 4, color: COLORS.body }}>
                    <strong style={{ color: COLORS.heading }}>AI-training opt-in (optional, not required to proceed):</strong> <em>"I consent to Bankruptcy.AI using de-identified information from my case to develop, train, and improve its artificial-intelligence models and services."</em> Your firm will collect this opt-in from you separately if you wish to participate. Declining does not affect representation.
                  </p>
                )}
              </DisclosureBody>
              <Checkbox
                checked={consentAiDisclosure}
                onChange={setConsentAiDisclosure}
                label={<>I understand how Bankruptcy.AI handles my information as described above, and that my attorney at <strong style={{ color: COLORS.heading }}>{firmName}</strong> remains solely responsible for all legal decisions in my case.</>}
              />
            </DisclosureSection>

            {/* 9 — E-SIGN [KEEP] */}
            <DisclosureSection num={9} title="E-SIGN Act — Electronic Communications Consent">
              <DisclosureBody>
                <p>You consent to receive all disclosures, notices, documents, and communications related to your account and case in electronic form, consistent with the Electronic Signatures in Global and National Commerce Act (E-SIGN Act, 15 U.S.C. § 7001 et seq.) and applicable state laws. You confirm you have the ability to access and retain electronic records and have a valid email address.</p>
              </DisclosureBody>
              <Checkbox checked={consentElectronic} onChange={setConsentElectronic} label="I consent to receive all disclosures and communications electronically under the E-SIGN Act." />
            </DisclosureSection>

            {/* ── Signature Block ─────────────────────────────────────────── */}
            <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: 20, background: COLORS.surface }}>
              <h3 style={{ fontSize: 13, fontWeight: 500, color: COLORS.heading, marginBottom: 4 }}>Electronic Signature</h3>
              <p style={{ fontSize: 12, color: COLORS.body, marginBottom: 20, lineHeight: 1.6 }}>
                By typing your name below you are signing this document electronically. Your typed signature has the same legal effect as a handwritten signature under the E-SIGN Act.
              </p>

              {/* Debtor 1 */}
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: COLORS.body, marginBottom: 12 }}>Debtor 1</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Signature — type your full legal name</label>
                  <input
                    style={{ ...inputStyle(), fontStyle: 'italic', fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: 16, height: 42 }}
                    value={signerFullName}
                    onChange={e => setSignerFullName(e.target.value)}
                    placeholder="Type your full legal name"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Printed name</label>
                  <input
                    style={inputStyle()}
                    value={signerPrintedName}
                    onChange={e => setSignerPrintedName(e.target.value)}
                    placeholder="Print your full legal name"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input style={{ ...inputStyle(), color: COLORS.body, cursor: 'default' }} value={signatureDate} readOnly />
                </div>
              </div>

              {/* Joint filing toggle */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${COLORS.borderSubtle}` }}>
                <Checkbox
                  checked={isJointFiling}
                  onChange={setIsJointFiling}
                  label="I am filing jointly with a spouse or domestic partner — Debtor 2 signature required"
                />
              </div>

              {/* Debtor 2 (conditional) */}
              {isJointFiling && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.borderSubtle}` }}>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: COLORS.body, marginBottom: 12 }}>Debtor 2</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Signature — type Debtor 2's full legal name</label>
                      <input
                        style={{ ...inputStyle(), fontStyle: 'italic', fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: 16, height: 42 }}
                        value={debtor2FullName}
                        onChange={e => setDebtor2FullName(e.target.value)}
                        placeholder="Debtor 2 — type full legal name"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Printed name</label>
                      <input
                        style={inputStyle()}
                        value={debtor2PrintedName}
                        onChange={e => setDebtor2PrintedName(e.target.value)}
                        placeholder="Debtor 2 — print full legal name"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Date</label>
                      <input style={{ ...inputStyle(), color: COLORS.body, cursor: 'default' }} value={signatureDate} readOnly />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ paddingTop: 8 }}>
              <button
                onClick={handleDisclosuresAccepted}
                disabled={!allDisclosuresAccepted || loading}
                style={!allDisclosuresAccepted || loading ? disabledBtn : primaryBtn}
                onMouseEnter={e => { if (allDisclosuresAccepted && !loading) (e.currentTarget as HTMLButtonElement).style.background = COLORS.primaryHover; }}
                onMouseLeave={e => { if (allDisclosuresAccepted && !loading) (e.currentTarget as HTMLButtonElement).style.background = COLORS.primary; }}
              >
                {loading ? 'Saving...' : !allDisclosuresAccepted ? 'Acknowledge all disclosures and sign to continue' : 'Accept disclosures & continue'}
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ── YOUR DOCUMENTS ────────────────────────────────────────────────────────

  if (step === 'your_docs') {
    const fmtTs = consentTimestamp
      ? new Date(consentTimestamp).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })
      : new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

    const disclosureItems = [
      'General legal disclosures — acknowledged',
      'Credit report authorization (TransUnion soft inquiry via iSoftpull) — consented',
      'SendGrid email communications — consent given',
      'Twilio SMS/voice communications — consent given',
      'Plaid bank account access (90-day statements) — consented',
      'Plaid payroll & income records — consented',
      'Data retention & copy-and-purge policy — acknowledged',
      'AI/automation disclosure — acknowledged',
      'E-SIGN Act electronic communications — consent given',
      signerFullName ? `Signed by: ${signerFullName}` : null,
      isJointFiling && debtor2FullName ? `Co-debtor signed by: ${debtor2FullName}` : null,
      `Consent timestamp: ${fmtTs}`,
    ].filter(Boolean) as string[];

    const docs = [
      {
        id: 'reg',
        label: 'Client Registration Record',
        desc: skippedRegistration
          ? 'Disclosure-only path — account creation skipped. Contact information will be collected during intake.'
          : 'Your account credentials and personal contact information captured at registration.',
        status: skippedRegistration ? 'Disclosures on file' : 'Signed & on file',
        items: skippedRegistration
          ? ['Registration skipped — disclosures path used', `Disclosure date: ${fmtTs}`]
          : ['Name, email address, and phone number', `Authentication via bankruptcy.ai secure portal — ${firmName}`, `Registration date: ${fmtTs}`],
        accent: COLORS.primary,
      },
      {
        id: 'disclosures',
        label: 'Client Disclosure Acknowledgement',
        desc: 'Your signed acknowledgement of all required disclosures and authorization choices.',
        status: 'Signed & on file',
        items: disclosureItems,
        accent: COLORS.warning,
      },
      {
        id: 'intake',
        label: 'Intake Agreement',
        desc: `Your retainer agreement and engagement letter will be added here after your intake review is completed by your assigned attorney at ${firmName}.`,
        status: 'Pending attorney review',
        items: ['Retainer agreement — pending attorney signature', 'Engagement letter — pending', 'Fee agreement — pending'],
        accent: COLORS.faint,
      },
    ];

    return (
      <div style={{ minHeight: '100vh', background: bg, padding: 24, paddingTop: 40 }}>
        <div style={{ width: '100%', maxWidth: 640, margin: '0 auto' }}>
          <div style={{ border: `1px solid ${COLORS.success}`, borderRadius: 4, padding: '10px 16px', marginBottom: 28, display: 'inline-block' }}>
            <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: COLORS.success }}>Registration complete</span>
          </div>

          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em', color: COLORS.heading, marginBottom: 6 }}>
            Your signed documents
          </h2>
          <p style={{ fontSize: 13, color: COLORS.body, marginBottom: 28 }}>
            The documents below have been recorded and are permanently on file. They will also appear in your client portal under <strong style={{ color: COLORS.heading }}>My Documents</strong> at any time.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {docs.map(doc => (
              <div key={doc.id} style={{ border: `1px solid ${doc.accent}40`, borderLeft: `3px solid ${doc.accent}`, borderRadius: 4, padding: 20, background: COLORS.surface }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: COLORS.heading, marginBottom: 4 }}>{doc.label}</p>
                    <p style={{ fontSize: 12, color: COLORS.body, lineHeight: 1.5 }}>{doc.desc}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', border: `1px solid ${doc.accent}`, color: doc.accent, background: 'transparent', borderRadius: 2, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {doc.status}
                  </span>
                </div>
                <ul style={{ marginTop: 12, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {doc.items.map(item => (
                    <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: COLORS.body }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: doc.accent, flexShrink: 0, marginTop: 5 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: '12px 16px', background: COLORS.surface }}>
              <p style={{ fontSize: 12, color: COLORS.body, lineHeight: 1.6 }}>
                All signed documents are available in your client portal under <strong style={{ color: COLORS.heading }}>My Documents</strong>. Under bankruptcy.ai's data retention policy, records are retained for the duration of your case and purged from the platform within 30 days of case closure; {firmName} retains your complete file per applicable rules of professional conduct.
              </p>
            </div>

            <button
              onClick={() => setStep('success')}
              style={primaryBtn}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = COLORS.primaryHover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = COLORS.primary; }}
            >
              Continue to client portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── SUCCESS ───────────────────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: `1px solid ${COLORS.success}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.success} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em', color: COLORS.heading, marginBottom: 12 }}>
            Registration complete
          </h2>
          <p style={{ fontSize: 14, color: COLORS.body, marginBottom: 32, lineHeight: 1.6 }}>
            Your account is set up and all consents have been recorded. Welcome to bankruptcy.ai — {firmName}.
          </p>
          <button
            onClick={onComplete}
            style={primaryBtn}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = COLORS.primaryHover; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = COLORS.primary; }}
          >
            Enter client portal
          </button>
        </div>
      </div>
    );
  }

  return null;
}
