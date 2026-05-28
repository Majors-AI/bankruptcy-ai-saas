import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Types ─────────────────────────────────────────────────────────────────────

type Step =
  | 'landing'
  | 'register'
  | 'login'
  | 'disclosures'
  | 'isoftpull_consent'
  | 'isoftpull_flow'
  | 'your_docs'
  | 'success';

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

// ── iSoftpull Flow Diagram (Appendix I — Dominic / TransUnion required) ───────

function ISoftpullFlowDiagram() {
  const columns = [
    {
      actor: 'You (Consumer)',
      accent: '#0369a1',
      items: [
        { num: 1, text: 'You are invited by BankruptcyDocs.ai to see available options for your case and confirm consent.' },
        { num: 2, text: 'You provide your name, address, date of birth, and agree to Terms & Conditions.' },
        { num: 6, text: 'Loan / financial options are output to you for consideration.' },
        { num: 7, text: 'You review options and decide whether to proceed. If proceeding, you click the link that takes you to the specific offer.' },
      ],
    },
    {
      actor: 'iSoftpull (Technology)',
      accent: '#1d4ed8',
      items: [
        { num: 3, text: "Your credit is pulled from the Credit Bureau based on permissible purpose of consumer's written instructions. A soft inquiry posts in subscriber's name." },
        { num: 4, text: "Credit report & score are returned to iSoftpull's pre-qualification system." },
        { num: 5, text: "iSoftpull's system determines loan options based on subscriber-supplied criteria and credit information compared to subscriber criteria." },
      ],
    },
    {
      actor: 'Law Firm / Lender',
      accent: '#334155',
      items: [
        { num: 8, text: 'If you proceed with application, the law firm / lender pulls your full credit report for extension of credit.' },
        { num: 9, text: 'A hard inquiry posts in lender\'s name. Lender pulls credit report for extension of credit.' },
      ],
    },
  ];

  return (
    <div>
      {/* Header badge */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', border: '1px solid #1d4ed8', color: '#93c5fd', background: 'transparent', borderRadius: 2, padding: '3px 10px' }}>
          Appendix I — iSoftpull Sample Flow
        </span>
        <p style={{ fontSize: 12, color: '#6B6B66', marginTop: 8 }}>
          Visual representation of the consent and data flow between you, iSoftpull, and TransUnion/credit bureaus.
        </p>
      </div>

      {/* Three-column flow */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {columns.map((col) => (
          <div key={col.actor} style={{ border: '1px solid #2A2A28', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ background: col.accent, padding: '8px 12px', textAlign: 'center' }}>
              <span style={{ color: '#FAFAF7', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{col.actor}</span>
            </div>
            <div style={{ padding: 12, background: '#111', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {col.items.map((item) => (
                <div key={item.num} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ flexShrink: 0, width: 20, height: 20, background: '#1d4ed8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>
                    {item.num}
                  </div>
                  <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Data flow summary */}
      <div style={{ marginTop: 12, border: '1px solid #2A2A28', borderRadius: 4, padding: 12, background: '#0a0a0a' }}>
        <p style={{ fontSize: 11, color: '#6B6B66', textAlign: 'center', marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Data Flow Summary</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11 }}>
          {['You submit consent', 'iSoftpull pulls soft credit', 'Credit bureau responds', 'iSoftpull returns options', 'You review & decide'].map((label, i, arr) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ border: '1px solid #2A2A28', borderRadius: 2, padding: '2px 8px', color: '#94a3b8' }}>{label}</span>
              {i < arr.length - 1 && <span style={{ color: '#3A3A36' }}>→</span>}
            </span>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#6B6B66', textAlign: 'center', marginTop: 8, fontStyle: 'italic' }}>
          Soft inquiry does NOT affect your credit score. Hard inquiry only occurs if you proceed with a full application.
        </p>
      </div>
    </div>
  );
}

// ── Checkbox component ────────────────────────────────────────────────────────

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginTop: 12 }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          flexShrink: 0, width: 16, height: 16, marginTop: 2,
          border: `1.5px solid ${checked ? '#1E3A2F' : '#3A3A36'}`,
          background: checked ? '#1E3A2F' : 'transparent',
          borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 150ms ease-out',
        }}
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FAFAF7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </div>
      <span style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>{label}</span>
    </label>
  );
}

// ── Toggle (opt-in / opt-out) ─────────────────────────────────────────────────

function OptToggle({ optedIn, onToggle, label }: { optedIn: boolean; onToggle: () => void; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid #1a1a18' }}>
      <span style={{ fontSize: 13, color: '#FAFAF7' }}>{label}</span>
      <button
        onClick={onToggle}
        style={{
          flexShrink: 0,
          width: 44, height: 24,
          background: optedIn ? '#1E3A2F' : '#2A2A28',
          border: `1px solid ${optedIn ? '#1E3A2F' : '#3A3A36'}`,
          borderRadius: 12,
          position: 'relative',
          cursor: 'pointer',
          transition: 'all 150ms ease-out',
          padding: 0,
        }}
        aria-label={`Toggle ${label}`}
      >
        <span style={{
          position: 'absolute', top: 3, left: optedIn ? 22 : 3,
          width: 16, height: 16, borderRadius: '50%',
          background: optedIn ? '#FAFAF7' : '#6B6B66',
          transition: 'left 150ms ease-out, background 150ms ease-out',
        }} />
      </button>
      <span style={{ fontSize: 11, color: optedIn ? '#15803D' : '#B45309', minWidth: 40, textAlign: 'right' }}>
        {optedIn ? 'Opt In' : 'Opt Out'}
      </span>
    </div>
  );
}

// ── Disclosure section wrapper ────────────────────────────────────────────────

function DisclosureSection({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #2A2A28', borderRadius: 4, padding: 20, background: '#0a0a0a' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: '#FAFAF7', marginBottom: 10 }}>
        <span style={{ width: 20, height: 20, background: '#2A2A28', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#FAFAF7', flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>{num}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function DisclosureBody({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: '#6B6B66', lineHeight: 1.7, maxHeight: 120, overflowY: 'auto', paddingRight: 4 }}>
      {children}
    </div>
  );
}

function OptOutNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10, border: '1px solid #B45309', borderRadius: 2, padding: '8px 12px', background: 'transparent' }}>
      <p style={{ fontSize: 11, color: '#B45309', lineHeight: 1.6 }}><strong>If you opt out:</strong> {children}</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ClientRegistration({ onComplete }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', textAlign: 'center', padding: '2rem' }}>
      <p>Registration temporarily unavailable — please contact your firm administrator.</p>
    </div>
  );
  const [step, setStep] = useState<Step>('landing');
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [skippedRegistration, setSkippedRegistration] = useState(false);

  // ── Disclosure acknowledgements ──────────────────────────────────────────
  const [consentGeneral, setConsentGeneral]     = useState(false);
  const [consentSendGrid, setConsentSendGrid]   = useState(false);
  const [consentTwilio, setConsentTwilio]       = useState(false);
  const [consentElectronic, setConsentElectronic] = useState(false);

  // Opt-in/out toggles (true = opted in = automated service used)
  const [optInIsoftpull, setOptInIsoftpull] = useState(true);
  const [optInPlaid, setOptInPlaid]         = useState(true);
  const [optInBoldsign, setOptInBoldsign]   = useState(true);

  // Acknowledgement that opt-in disclosure was READ (required regardless of opt-in/out choice)
  const [ackIsoftpull, setAckIsoftpull]     = useState(false);
  const [ackPlaid, setAckPlaid]             = useState(false);
  const [ackBoldsign, setAckBoldsign]       = useState(false);

  // iSoftpull formal FCRA consent (only if opted in)
  const [isoConsentFCRA, setIsoConsentFCRA]           = useState(false);
  const [isoConsentElectronic, setIsoConsentElectronic] = useState(false);

  const [consentTimestamp, setConsentTimestamp] = useState('');
  const [registeredEmail, setRegisteredEmail]   = useState('');

  const allDisclosuresAccepted =
    consentGeneral && consentSendGrid && consentTwilio && consentElectronic &&
    ackIsoftpull && ackPlaid && ackBoldsign;

  const allIsoConsentAccepted = isoConsentFCRA && isoConsentElectronic;

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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const emailAddr = form.email || user?.email || '';
      if (user) {
        await supabase.from('client_registrations').upsert({
          user_id: user.id,
          email: emailAddr,
          consented_general: true,
          consented_sendgrid: true,
          consented_twilio: true,
          consented_electronic: true,
          consented_isoftpull: ackIsoftpull,
          consented_plaid: ackPlaid,
          consented_boldsign: ackBoldsign,
          opt_in_isoftpull: optInIsoftpull,
          opt_in_plaid: optInPlaid,
          opt_in_boldsign: optInBoldsign,
          skipped_registration: skippedRegistration,
          consent_timestamp: ts,
        });
        setRegisteredEmail(emailAddr);
      }
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
    // If opted in to iSoftpull, go to formal FCRA consent; otherwise skip to flow diagram
    if (optInIsoftpull) {
      setStep('isoftpull_consent');
    } else {
      setConsentTimestamp(ts);
      setStep('isoftpull_flow');
    }
  }

  async function handleIsoConsentAccepted() {
    setLoading(true);
    const ts = new Date().toISOString();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const emailAddr = form.email || user?.email || registeredEmail;
      if (user) {
        await supabase.from('client_registrations').upsert({
          user_id: user.id,
          email: emailAddr,
          consented_isoftpull_fcra: true,
          consented_isoftpull_electronic: true,
          isoftpull_consent_timestamp: ts,
        });
        await supabase.from('client_acknowledgement_docs').upsert({
          user_id: user.id,
          email: emailAddr,
          doc_type: 'registration_disclosure_package',
          label: 'Registration & Disclosure Acknowledgement',
          consented_general: true,
          consented_sendgrid: true,
          consented_twilio: true,
          consented_isoftpull: ackIsoftpull,
          consented_plaid: ackPlaid,
          consented_electronic: true,
          consented_isoftpull_fcra: true,
          consented_isoftpull_electronic: true,
          signed_at: ts,
        }).catch(() => {});
        setConsentTimestamp(ts);
        setRegisteredEmail(emailAddr);
      }
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
    setStep('isoftpull_flow');
  }

  // ── Shared styles ─────────────────────────────────────────────────────────

  const bg   = '#0F0F0E';
  const surf = '#111111';

  const inputStyle = (hasError?: boolean): React.CSSProperties => ({
    width: '100%', height: 36, background: '#0a0a0a',
    border: `1px solid ${hasError ? '#991B1B' : '#2A2A28'}`,
    borderRadius: 4, padding: '0 12px', fontSize: 14,
    color: '#FAFAF7', outline: 'none', boxSizing: 'border-box',
    fontFamily: "'Inter', system-ui, sans-serif",
  });

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 500,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    color: '#6B6B66', marginBottom: 6,
  };

  const primaryBtn: React.CSSProperties = {
    width: '100%', background: '#111111', color: '#FAFAF7',
    border: 'none', borderRadius: 4, padding: '10px 18px',
    fontSize: 14, fontWeight: 500, cursor: 'pointer',
    transition: 'background 150ms ease-out',
    fontFamily: "'Inter', system-ui, sans-serif",
  };

  const secondaryBtn: React.CSSProperties = {
    width: '100%', background: 'transparent', color: '#6B6B66',
    border: '1px solid #2A2A28', borderRadius: 4, padding: '10px 18px',
    fontSize: 14, fontWeight: 500, cursor: 'pointer',
    fontFamily: "'Inter', system-ui, sans-serif",
  };

  const disabledBtn: React.CSSProperties = { ...primaryBtn, opacity: 0.35, cursor: 'not-allowed' };

  const backBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 13, color: '#6B6B66', background: 'transparent',
    border: 'none', cursor: 'pointer', marginBottom: 24, padding: 0,
  };

  function PrimaryBtn({ label, loadLabel, onClick, disabled }: { label: string; loadLabel?: string; onClick?: () => void; disabled?: boolean }) {
    const [hover, setHover] = useState(false);
    return (
      <button
        onClick={onClick}
        disabled={disabled || loading}
        style={disabled || loading ? disabledBtn : { ...primaryBtn, background: hover ? '#1E3A2F' : '#111111' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {loading && loadLabel ? loadLabel : label}
      </button>
    );
  }

  // ── LANDING ───────────────────────────────────────────────────────────────

  if (step === 'landing') {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Logo */}
          <div style={{ marginBottom: 40 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FAFAF7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 32, letterSpacing: '-0.02em', color: '#FAFAF7', marginTop: 12, lineHeight: 1.1 }}>
              BankruptcyDocs.ai
            </h1>
            <p style={{ fontSize: 13, color: '#6B6B66', marginTop: 6 }}>Secure Client Portal</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => setStep('register')}
              style={{ ...primaryBtn, textAlign: 'left', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1E3A2F'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#111111'; }}
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

            {/* Skip to disclosures — the no-info-required path */}
            <div style={{ borderTop: '1px solid #2A2A28', paddingTop: 16, marginTop: 8 }}>
              <p style={{ fontSize: 12, color: '#6B6B66', marginBottom: 10 }}>
                You can also skip account creation and review disclosures directly. You will need to provide your information manually if you opt out of automated services.
              </p>
              <button
                onClick={handleSkipToDisclosures}
                style={{ ...secondaryBtn, padding: '10px 18px', fontSize: 13 }}
              >
                Skip to disclosures →
              </button>
            </div>
          </div>

          <p style={{ fontSize: 11, color: '#3A3A36', marginTop: 32 }}>Protected by 256-bit TLS encryption.</p>
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

          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em', color: '#FAFAF7', marginBottom: 6 }}>Create account</h2>
          <p style={{ fontSize: 13, color: '#6B6B66', marginBottom: 28 }}>BankruptcyDocs.ai — Secure Client Portal</p>

          {serverError && (
            <div style={{ border: '1px solid #991B1B', borderRadius: 4, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#991B1B' }}>{serverError}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>First name</label>
                <input style={inputStyle(!!errors.firstName)} value={form.firstName} onChange={e => setField('firstName', e.target.value)} placeholder="First" />
                {errors.firstName && <p style={{ fontSize: 11, color: '#991B1B', marginTop: 4 }}>{errors.firstName}</p>}
              </div>
              <div>
                <label style={labelStyle}>Last name</label>
                <input style={inputStyle(!!errors.lastName)} value={form.lastName} onChange={e => setField('lastName', e.target.value)} placeholder="Last" />
                {errors.lastName && <p style={{ fontSize: 11, color: '#991B1B', marginTop: 4 }}>{errors.lastName}</p>}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Email address</label>
              <input type="email" style={inputStyle(!!errors.email)} value={form.email} onChange={e => setField('email', e.target.value)} placeholder="you@example.com" />
              {errors.email && <p style={{ fontSize: 11, color: '#991B1B', marginTop: 4 }}>{errors.email}</p>}
            </div>

            <div>
              <label style={labelStyle}>Phone</label>
              <input type="tel" style={inputStyle(!!errors.phone)} value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="(555) 000-0000" />
              {errors.phone && <p style={{ fontSize: 11, color: '#991B1B', marginTop: 4 }}>{errors.phone}</p>}
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" style={inputStyle(!!errors.password)} value={form.password} onChange={e => setField('password', e.target.value)} placeholder="Minimum 8 characters" />
              {errors.password && <p style={{ fontSize: 11, color: '#991B1B', marginTop: 4 }}>{errors.password}</p>}
            </div>

            <div>
              <label style={labelStyle}>Confirm password</label>
              <input type="password" style={inputStyle(!!errors.confirmPassword)} value={form.confirmPassword} onChange={e => setField('confirmPassword', e.target.value)} placeholder="Re-enter password" />
              {errors.confirmPassword && <p style={{ fontSize: 11, color: '#991B1B', marginTop: 4 }}>{errors.confirmPassword}</p>}
            </div>

            <div style={{ marginTop: 4 }}>
              <PrimaryBtn label="Continue to disclosures" loadLabel="Creating account..." onClick={handleRegister} />
            </div>
          </div>

          <p style={{ fontSize: 12, color: '#6B6B66', marginTop: 16, textAlign: 'center' }}>
            Already have an account?{' '}
            <button onClick={() => setStep('login')} style={{ background: 'none', border: 'none', color: '#FAFAF7', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Sign in</button>
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

          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em', color: '#FAFAF7', marginBottom: 6 }}>Welcome back</h2>
          <p style={{ fontSize: 13, color: '#6B6B66', marginBottom: 28 }}>Sign in to your BankruptcyDocs.ai account</p>

          {serverError && (
            <div style={{ border: '1px solid #991B1B', borderRadius: 4, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#991B1B' }}>{serverError}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Email address</label>
              <input type="email" style={inputStyle(!!errors.email)} value={form.email} onChange={e => setField('email', e.target.value)} placeholder="you@example.com" />
              {errors.email && <p style={{ fontSize: 11, color: '#991B1B', marginTop: 4 }}>{errors.email}</p>}
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" style={inputStyle(!!errors.password)} value={form.password} onChange={e => setField('password', e.target.value)} placeholder="Your password" />
              {errors.password && <p style={{ fontSize: 11, color: '#991B1B', marginTop: 4 }}>{errors.password}</p>}
            </div>
            <div style={{ marginTop: 4 }}>
              <PrimaryBtn label="Sign in" loadLabel="Signing in..." onClick={handleLogin} />
            </div>
          </div>

          <p style={{ fontSize: 12, color: '#6B6B66', marginTop: 16, textAlign: 'center' }}>
            New client?{' '}
            <button onClick={() => setStep('register')} style={{ background: 'none', border: 'none', color: '#FAFAF7', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Create an account</button>
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

          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em', color: '#FAFAF7', marginBottom: 6 }}>
            Disclosures & Authorizations
          </h2>
          <p style={{ fontSize: 13, color: '#6B6B66', marginBottom: 32, maxWidth: 520 }}>
            Review each disclosure below. For iSoftpull, Plaid, and BoldSign you may opt in or opt out.
            Opting out means you will provide that information manually.
            All other disclosures are required to access the portal.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* 1 — General */}
            <DisclosureSection num={1} title="General Legal Disclosures">
              <DisclosureBody>
                <p>By registering for and using this client portal, you acknowledge that BankruptcyDocs.ai provides legal document preparation and case management services. This portal does not constitute legal advice. All information submitted is subject to attorney-client privilege where applicable.</p>
                <p style={{ marginTop: 8 }}>Your case information, documents, and communications may be accessed by authorized firm staff, paralegals, and attorneys assigned to your case. All data is stored securely under applicable privacy laws including the Gramm-Leach-Bliley Act and applicable state privacy regulations.</p>
                <p style={{ marginTop: 8 }}>Bankruptcy filings are public record. Certain financial information will be disclosed to the U.S. Bankruptcy Court, trustees, and creditors as required by law.</p>
              </DisclosureBody>
              <Checkbox checked={consentGeneral} onChange={setConsentGeneral} label="I have read, understand, and agree to the General Legal Disclosures above." />
            </DisclosureSection>

            {/* 2 — SendGrid */}
            <DisclosureSection num={2} title="Email Communications — SendGrid">
              <DisclosureBody>
                <p>You authorize BankruptcyDocs.ai to send case-related email communications through <strong style={{ color: '#FAFAF7' }}>SendGrid</strong> (Twilio Inc.). These may include: case status updates, document requests, appointment confirmations, deadline notifications. SendGrid may process your email address and delivery metadata per their Privacy Policy. Transactional case emails cannot be disabled while your case is active.</p>
              </DisclosureBody>
              <Checkbox checked={consentSendGrid} onChange={setConsentSendGrid} label="I consent to receiving email communications via SendGrid as described above." />
            </DisclosureSection>

            {/* 3 — Twilio */}
            <DisclosureSection num={3} title="SMS / Voice Communications — Twilio">
              <DisclosureBody>
                <p>You authorize BankruptcyDocs.ai to contact you via SMS and/or automated voice calls through <strong style={{ color: '#FAFAF7' }}>Twilio</strong>. These may include: appointment reminders, document upload notifications, urgent case alerts, and two-factor authentication codes. Message and data rates may apply. Reply STOP to opt out of non-essential SMS. Reply HELP for help.</p>
              </DisclosureBody>
              <Checkbox checked={consentTwilio} onChange={setConsentTwilio} label="I consent to receiving SMS and/or voice communications via Twilio as described above." />
            </DisclosureSection>

            {/* 4 — iSoftpull (opt-in/out) */}
            <DisclosureSection num={4} title="Credit Pre-Qualification — iSoftpull / TransUnion">
              {/* Dominic compliance: document consumer consent capture */}
              <div style={{ background: '#0a0a0a', border: '1px solid #1d4ed8', borderRadius: 4, padding: '10px 14px', marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: '#93c5fd', lineHeight: 1.6 }}>
                  <strong>Consumer Consent Capture (iSoftpull / TransUnion):</strong> BankruptcyDocs.ai uses iSoftpull to perform a <strong>soft credit inquiry only</strong> — this will NOT affect your credit score. A soft inquiry posts in iSoftpull's subscriber name. This is a FCRA permissible-purpose pull based on your written instructions below.
                </p>
              </div>
              <DisclosureBody>
                <p>By opting in, you authorize BankruptcyDocs.ai and its partner <strong style={{ color: '#FAFAF7' }}>iSoftpull</strong> to obtain your personal credit report and/or other information from <strong style={{ color: '#FAFAF7' }}>iSoftpull, Experian, TransUnion, and/or Equifax</strong> solely for credit pre-qualification under the Fair Credit Reporting Act (FCRA). This is a <strong style={{ color: '#FAFAF7' }}>soft inquiry only</strong> — it will NOT affect your credit score. You also give permission for your contact information to be provided to a third-party lender, if applicable.</p>
                <p style={{ marginTop: 8 }}><strong style={{ color: '#FAFAF7' }}>What you will see after submission:</strong> If pre-qualified, you will see a congratulations message with available loan options and an "Apply" button. If not pre-qualified, you will receive a message that we will contact you shortly to discuss options.</p>
                <p style={{ marginTop: 8 }}>A full credit report (hard inquiry) will only be pulled with your separate explicit consent if you proceed with a credit application.</p>
              </DisclosureBody>
              <OptOutNote>You will need to provide all income, asset, and financial information manually through the document questionnaire. Automated credit pre-qualification will not be performed.</OptOutNote>
              <OptToggle optedIn={optInIsoftpull} onToggle={() => setOptInIsoftpull(v => !v)} label="iSoftpull soft credit pull" />
              <Checkbox
                checked={ackIsoftpull}
                onChange={setAckIsoftpull}
                label={<>I have read and understand the iSoftpull / TransUnion disclosure above and acknowledge my choice to <strong style={{ color: '#FAFAF7' }}>{optInIsoftpull ? 'opt in' : 'opt out'}</strong>. {optInIsoftpull ? 'I will complete formal FCRA consent on the next screen.' : 'I understand I must provide all financial information manually.'}</>}
              />
            </DisclosureSection>

            {/* 5 — Plaid (opt-in/out) */}
            <DisclosureSection num={5} title="Financial Records — Plaid">
              <DisclosureBody>
                <p>By opting in, you authorize BankruptcyDocs.ai to access your financial records through <strong style={{ color: '#FAFAF7' }}>Plaid Technologies, Inc.</strong> This may include: bank account balances, transaction history (up to 24 months), income verification, employment data, and digital paystubs. This information is used solely to prepare your bankruptcy petition and schedules as required by 11 U.S.C. §§ 521, 1325 and the Federal Rules of Bankruptcy Procedure. Plaid uses 256-bit encryption and does not store your banking credentials.</p>
              </DisclosureBody>
              <OptOutNote>You will need to provide bank statements, pay stubs, and financial records manually by uploading them to your document portal.</OptOutNote>
              <OptToggle optedIn={optInPlaid} onToggle={() => setOptInPlaid(v => !v)} label="Plaid bank account linking" />
              <Checkbox
                checked={ackPlaid}
                onChange={setAckPlaid}
                label={<>I have read and understand the Plaid disclosure above and acknowledge my choice to <strong style={{ color: '#FAFAF7' }}>{optInPlaid ? 'opt in' : 'opt out'}</strong>. {!optInPlaid && 'I will provide all bank and financial records manually.'}</>}
              />
            </DisclosureSection>

            {/* 6 — BoldSign (opt-in/out) */}
            <DisclosureSection num={6} title="Electronic Document Signing — BoldSign">
              <DisclosureBody>
                <p>By opting in, you authorize BankruptcyDocs.ai to deliver and obtain your signature on legal documents electronically through <strong style={{ color: '#FAFAF7' }}>BoldSign</strong>, an electronic signature platform. This includes: retainer agreements, engagement letters, schedules of assets and liabilities, statements of financial affairs, and other required bankruptcy documents. Electronic signatures executed through BoldSign carry the same legal weight as handwritten signatures under the E-SIGN Act (15 U.S.C. § 7001) and UETA.</p>
                <p style={{ marginTop: 8 }}>You confirm you can access electronic records, have a valid email address, and will notify us of any email changes. You may request paper copies for a reasonable fee.</p>
              </DisclosureBody>
              <OptOutNote>Documents will need to be printed, signed by hand, and returned to the firm by mail or in-person. This may delay your case preparation.</OptOutNote>
              <OptToggle optedIn={optInBoldsign} onToggle={() => setOptInBoldsign(v => !v)} label="BoldSign electronic document signing" />
              <Checkbox
                checked={ackBoldsign}
                onChange={setAckBoldsign}
                label={<>I have read and understand the BoldSign electronic signing disclosure and acknowledge my choice to <strong style={{ color: '#FAFAF7' }}>{optInBoldsign ? 'opt in' : 'opt out'}</strong>. {!optInBoldsign && 'I understand I must sign all documents manually.'}</>}
              />
            </DisclosureSection>

            {/* 7 — E-SIGN */}
            <DisclosureSection num={7} title="E-SIGN Act — Electronic Communications Consent">
              <DisclosureBody>
                <p>You consent to receive all disclosures, notices, documents, and communications related to your account and case in electronic form, consistent with the Electronic Signatures in Global and National Commerce Act (E-SIGN Act, 15 U.S.C. § 7001 et seq.) and applicable state laws. You confirm you have the ability to access and retain electronic records and have a valid email address.</p>
              </DisclosureBody>
              <Checkbox checked={consentElectronic} onChange={setConsentElectronic} label="I consent to receive all disclosures and communications electronically under the E-SIGN Act." />
            </DisclosureSection>

            {/* Opt-out summary notice */}
            {(!optInIsoftpull || !optInPlaid || !optInBoldsign) && (
              <div style={{ border: '1px solid #B45309', borderRadius: 4, padding: '12px 16px', background: 'transparent' }}>
                <p style={{ fontSize: 12, color: '#B45309', fontWeight: 500, marginBottom: 6 }}>Manual information required for opted-out services:</p>
                <ul style={{ fontSize: 12, color: '#B45309', paddingLeft: 16, lineHeight: 1.8 }}>
                  {!optInIsoftpull && <li>Credit & financial data — must be provided manually via document questionnaire</li>}
                  {!optInPlaid && <li>Bank statements & pay stubs — must be uploaded manually</li>}
                  {!optInBoldsign && <li>All documents must be printed, signed by hand, and returned to the firm</li>}
                </ul>
              </div>
            )}

            <div style={{ paddingTop: 8 }}>
              <button
                onClick={handleDisclosuresAccepted}
                disabled={!allDisclosuresAccepted || loading}
                style={!allDisclosuresAccepted || loading ? disabledBtn : primaryBtn}
                onMouseEnter={e => { if (allDisclosuresAccepted && !loading) (e.currentTarget as HTMLButtonElement).style.background = '#1E3A2F'; }}
                onMouseLeave={e => { if (allDisclosuresAccepted && !loading) (e.currentTarget as HTMLButtonElement).style.background = '#111111'; }}
              >
                {loading
                  ? 'Saving...'
                  : !allDisclosuresAccepted
                  ? 'Acknowledge all disclosures above to continue'
                  : optInIsoftpull
                  ? 'Accept disclosures — continue to iSoftpull consent'
                  : 'Accept disclosures — continue'}
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ── iSOFTPULL CONSENT (only if opted in) ──────────────────────────────────

  if (step === 'isoftpull_consent') {
    return (
      <div style={{ minHeight: '100vh', background: bg, padding: 24, paddingTop: 40 }}>
        <div style={{ width: '100%', maxWidth: 640, margin: '0 auto' }}>
          <button onClick={() => setStep('disclosures')} style={backBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            Back to disclosures
          </button>

          {/* Dominic: Step 1 — consumer consent capture */}
          <div style={{ border: '1px solid #1d4ed8', borderRadius: 4, padding: '12px 16px', marginBottom: 24, background: 'transparent' }}>
            <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#93c5fd', marginBottom: 4 }}>Step 1 of 2 — Consumer Consent Capture</p>
            <p style={{ fontSize: 12, color: '#6B6B66' }}>This is your formal FCRA written instruction authorizing the iSoftpull soft credit pull.</p>
          </div>

          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em', color: '#FAFAF7', marginBottom: 6 }}>
            Credit Pre-Qualification Consent
          </h2>
          <p style={{ fontSize: 13, color: '#6B6B66', marginBottom: 28 }}>
            Appendix II — iSoftpull Sample Consumer Consent. Please review and provide formal authorization below.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Dominic: Step 2 — what does the end user see after submission */}
            <div style={{ border: '1px solid #2A2A28', borderRadius: 4, padding: 20, background: '#0a0a0a' }}>
              <h3 style={{ fontSize: 13, fontWeight: 500, color: '#FAFAF7', marginBottom: 12 }}>What you will see after submission (Appendix III &amp; IV)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ border: '1px solid #15803D', borderRadius: 4, padding: '10px 14px' }}>
                  <p style={{ fontSize: 12, color: '#15803D', fontWeight: 500, marginBottom: 4 }}>If pre-qualified:</p>
                  <p style={{ fontSize: 12, color: '#6B6B66', lineHeight: 1.6 }}>
                    You will see: <em style={{ color: '#94a3b8' }}>"Congratulations, you're prequalified! We feel with your credit report and score, you will be most suitable with our Preferred Loan which has great interest rates. To learn more and apply, please click the button below."</em> You will be given an "Apply" button linking to the specific offer.
                  </p>
                </div>
                <div style={{ border: '1px solid #B45309', borderRadius: 4, padding: '10px 14px' }}>
                  <p style={{ fontSize: 12, color: '#B45309', fontWeight: 500, marginBottom: 4 }}>If not pre-qualified:</p>
                  <p style={{ fontSize: 12, color: '#6B6B66', lineHeight: 1.6 }}>
                    You will see: <em style={{ color: '#94a3b8' }}>"Thank you for your submission! Unfortunately we were not able to match you with any loan types right out of the gate, but we will contact you shortly to discuss!"</em>
                  </p>
                </div>
                <p style={{ fontSize: 11, color: '#6B6B66', fontStyle: 'italic' }}>In either case, your credit score is NOT affected by this soft pull pre-qualification process.</p>
              </div>
            </div>

            {/* FCRA written instruction */}
            <div style={{ border: '1px solid #2A2A28', borderRadius: 4, padding: 20, background: '#0a0a0a' }}>
              <h3 style={{ fontSize: 13, fontWeight: 500, color: '#FAFAF7', marginBottom: 10 }}>FCRA Written Instruction &amp; Authorization</h3>
              <div style={{ border: '1px solid #2A2A28', borderRadius: 4, padding: '12px 16px', background: '#111', fontSize: 12, color: '#6B6B66', lineHeight: 1.7 }}>
                <p>I understand that by clicking "Submit" I am providing <strong style={{ color: '#FAFAF7' }}>"written instruction"</strong> under the Fair Credit Reporting Act (FCRA) authorizing <strong style={{ color: '#FAFAF7' }}>BankruptcyDocs.ai (iSoftpull Client)</strong> to obtain my personal credit report and other information from <strong style={{ color: '#FAFAF7' }}>iSoftpull, Experian, TransUnion, and/or Equifax</strong> solely for credit pre-qualification.</p>
                <p style={{ marginTop: 8 }}><strong style={{ color: '#FAFAF7' }}>This process will not affect my credit score.</strong> I also give permission for my contact information to be given to a third-party lender, if applicable.</p>
              </div>
              <Checkbox
                checked={isoConsentFCRA}
                onChange={setIsoConsentFCRA}
                label={<>I understand that by clicking "Submit" I am providing <strong style={{ color: '#FAFAF7' }}>"written instruction"</strong> under the FCRA authorizing <strong style={{ color: '#FAFAF7' }}>BankruptcyDocs.ai (iSoftpull Client)</strong> to obtain my personal credit &amp; other information from iSoftpull, Experian, TransUnion, and/or Equifax solely for credit pre-qualification. <strong style={{ color: '#FAFAF7' }}>This process will not affect my credit score.</strong> I also give permission for my contact information to be given to a third-party lender, if applicable.</>}
              />
            </div>

            {/* Electronic disclosures */}
            <div style={{ border: '1px solid #2A2A28', borderRadius: 4, padding: 20, background: '#0a0a0a' }}>
              <Checkbox
                checked={isoConsentElectronic}
                onChange={setIsoConsentElectronic}
                label={<>I certify I have read and agree to the <strong style={{ color: '#FAFAF7' }}>Electronic Disclosures communications</strong> (iSoftpull electronic disclosures pop-up / widget).</>}
              />
            </div>

            <button
              onClick={handleIsoConsentAccepted}
              disabled={!allIsoConsentAccepted || loading}
              style={!allIsoConsentAccepted || loading ? disabledBtn : primaryBtn}
              onMouseEnter={e => { if (allIsoConsentAccepted && !loading) (e.currentTarget as HTMLButtonElement).style.background = '#1E3A2F'; }}
              onMouseLeave={e => { if (allIsoConsentAccepted && !loading) (e.currentTarget as HTMLButtonElement).style.background = '#111111'; }}
            >
              {loading ? 'Saving...' : allIsoConsentAccepted ? 'Submit iSoftpull consent — view data flow' : 'Check both boxes above to continue'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── iSOFTPULL FLOW DIAGRAM (Dominic: visual flow required) ────────────────

  if (step === 'isoftpull_flow') {
    return (
      <div style={{ minHeight: '100vh', background: bg, padding: 24, paddingTop: 40 }}>
        <div style={{ width: '100%', maxWidth: 760, margin: '0 auto' }}>

          {/* Dominic: Step 2 — consumer experience / data flow visualization */}
          <div style={{ border: '1px solid #1d4ed8', borderRadius: 4, padding: '12px 16px', marginBottom: 24, background: 'transparent' }}>
            <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#93c5fd', marginBottom: 4 }}>Step 2 of 2 — Consent &amp; Data Flow</p>
            <p style={{ fontSize: 12, color: '#6B6B66' }}>Your consent has been recorded. Below is the complete visual representation required by iSoftpull (Appendix I).</p>
          </div>

          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em', color: '#FAFAF7', marginBottom: 6 }}>
            How your data flows
          </h2>
          <p style={{ fontSize: 13, color: '#6B6B66', marginBottom: 28 }}>
            Visual representation of consent and data flow between you, BankruptcyDocs.ai, iSoftpull, and TransUnion.
          </p>

          <div style={{ border: '1px solid #2A2A28', borderRadius: 4, padding: 24, background: surf }}>
            <ISoftpullFlowDiagram />

            <div style={{ marginTop: 20, border: '1px solid #15803D', borderRadius: 4, padding: '12px 16px' }}>
              <p style={{ fontSize: 13, color: '#15803D', fontWeight: 500, marginBottom: 4 }}>Consent recorded</p>
              <p style={{ fontSize: 12, color: '#6B6B66', lineHeight: 1.6 }}>
                Your authorization has been captured and timestamped. All disclosures have been saved to your account record and are available for review at any time in your client portal under <strong style={{ color: '#FAFAF7' }}>My Documents</strong>.
              </p>
            </div>

            <div style={{ marginTop: 16 }}>
              <button
                onClick={() => setStep('your_docs')}
                style={primaryBtn}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1E3A2F'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#111111'; }}
              >
                I understand — review my documents
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
          : ['Name, email address, and phone number', 'Account created and authenticated via BankruptcyDocs.ai', `Registration date: ${fmtTs}`],
        accent: '#0369a1',
      },
      {
        id: 'disclosures',
        label: 'Client Disclosure Acknowledgement',
        desc: 'Your signed acknowledgement of all required disclosures and authorization choices.',
        status: 'Signed & on file',
        items: [
          'General legal disclosures — acknowledged',
          'SendGrid email communications — consent given',
          'Twilio SMS/voice communications — consent given',
          `iSoftpull credit pre-qualification — ${optInIsoftpull ? 'opted in' : 'opted out'}`,
          `Plaid financial records — ${optInPlaid ? 'opted in' : 'opted out'}`,
          `BoldSign electronic signing — ${optInBoldsign ? 'opted in' : 'opted out'}`,
          'E-SIGN Act electronic communications — consent given',
          `Consent timestamp: ${fmtTs}`,
        ],
        accent: '#B45309',
      },
      ...(optInIsoftpull ? [{
        id: 'isoftpull',
        label: 'iSoftpull FCRA Written Consent',
        desc: 'Your formal written instruction under the FCRA authorizing iSoftpull to obtain your credit information from TransUnion, Experian, and/or Equifax for pre-qualification purposes only.',
        status: 'Signed & on file',
        items: [
          'FCRA Written Instruction & Authorization — signed',
          'iSoftpull Electronic Disclosures — acknowledged',
          'Soft pull only — no credit score impact',
          `iSoftpull consent timestamp: ${fmtTs}`,
        ],
        accent: '#1d4ed8',
      }] : [{
        id: 'isoftpull_optout',
        label: 'iSoftpull — Opted Out',
        desc: 'You opted out of automated credit pre-qualification. You will provide all financial information manually through the document questionnaire.',
        status: 'Opt-out recorded',
        items: [
          'Credit pre-qualification via iSoftpull — declined',
          'Manual financial information required',
          `Opt-out timestamp: ${fmtTs}`,
        ],
        accent: '#6B6B66',
      }]),
      ...(!optInPlaid ? [{
        id: 'plaid_optout',
        label: 'Plaid — Opted Out',
        desc: 'You opted out of Plaid bank linking. Bank statements, pay stubs, and financial records must be uploaded manually.',
        status: 'Opt-out recorded',
        items: ['Plaid bank account linking — declined', 'Manual document uploads required'],
        accent: '#6B6B66',
      }] : []),
      ...(!optInBoldsign ? [{
        id: 'boldsign_optout',
        label: 'BoldSign — Opted Out',
        desc: 'You opted out of electronic signing. All documents must be printed, signed by hand, and returned to the firm.',
        status: 'Opt-out recorded',
        items: ['Electronic document signing — declined', 'Physical signatures required — contact firm for instructions'],
        accent: '#6B6B66',
      }] : []),
      {
        id: 'intake',
        label: 'Intake Agreement',
        desc: 'Your retainer agreement and engagement letter will be added here after your intake review is completed by your assigned attorney.',
        status: 'Pending attorney review',
        items: ['Retainer agreement — pending attorney signature', 'Engagement letter — pending', 'Fee agreement — pending'],
        accent: '#334155',
      },
    ];

    return (
      <div style={{ minHeight: '100vh', background: bg, padding: 24, paddingTop: 40 }}>
        <div style={{ width: '100%', maxWidth: 640, margin: '0 auto' }}>
          <div style={{ border: '1px solid #15803D', borderRadius: 4, padding: '10px 16px', marginBottom: 28, display: 'inline-block' }}>
            <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#15803D' }}>Registration complete</span>
          </div>

          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em', color: '#FAFAF7', marginBottom: 6 }}>
            Your signed documents
          </h2>
          <p style={{ fontSize: 13, color: '#6B6B66', marginBottom: 28 }}>
            The documents below have been recorded and are permanently on file. They will also appear in your client portal under <strong style={{ color: '#FAFAF7' }}>My Documents</strong> at any time.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {docs.map(doc => (
              <div key={doc.id} style={{ border: `1px solid ${doc.accent}40`, borderLeft: `3px solid ${doc.accent}`, borderRadius: 4, padding: 20, background: '#0a0a0a' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: '#FAFAF7', marginBottom: 4 }}>{doc.label}</p>
                    <p style={{ fontSize: 12, color: '#6B6B66', lineHeight: 1.5 }}>{doc.desc}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', border: `1px solid ${doc.accent}`, color: doc.accent, background: 'transparent', borderRadius: 2, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {doc.status}
                  </span>
                </div>
                <ul style={{ marginTop: 12, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {doc.items.map(item => (
                    <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#6B6B66' }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: doc.accent, flexShrink: 0, marginTop: 5 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div style={{ border: '1px solid #2A2A28', borderRadius: 4, padding: '12px 16px', background: '#0a0a0a' }}>
              <p style={{ fontSize: 12, color: '#6B6B66', lineHeight: 1.6 }}>
                All signed documents are available in your client portal under <strong style={{ color: '#FAFAF7' }}>Stage 1 — Intake &amp; Retention</strong> and <strong style={{ color: '#FAFAF7' }}>My Documents</strong>. Records are retained for the duration of your case and a minimum of 7 years following case closure.
              </p>
            </div>

            <button
              onClick={() => setStep('success')}
              style={primaryBtn}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1E3A2F'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#111111'; }}
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
          <div style={{ width: 48, height: 48, border: '1px solid #15803D', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em', color: '#FAFAF7', marginBottom: 12 }}>
            Registration complete
          </h2>
          <p style={{ fontSize: 14, color: '#6B6B66', marginBottom: 32, lineHeight: 1.6 }}>
            Your account is set up and all consents have been recorded. Welcome to BankruptcyDocs.ai.
          </p>
          <button
            onClick={onComplete}
            style={primaryBtn}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1E3A2F'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#111111'; }}
          >
            Enter client portal
          </button>
        </div>
      </div>
    );
  }

  return null;
}
