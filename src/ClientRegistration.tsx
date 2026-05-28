import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

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

function OptToggle({ optedIn, onToggle, label }: { optedIn: boolean; onToggle: () => void; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid #1a1a18' }}>
      <span style={{ fontSize: 13, color: '#FAFAF7' }}>{label}</span>
      <button
        onClick={onToggle}
        style={{
          flexShrink: 0, width: 44, height: 24,
          background: optedIn ? '#1E3A2F' : '#2A2A28',
          border: `1px solid ${optedIn ? '#1E3A2F' : '#3A3A36'}`,
          borderRadius: 12, position: 'relative', cursor: 'pointer',
          transition: 'all 150ms ease-out', padding: 0,
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

function DisclosureSection({ num, title, children, needsReview }: {
  num: number; title: string; children: React.ReactNode; needsReview?: boolean;
}) {
  return (
    <div style={{ border: '1px solid #2A2A28', borderRadius: 4, padding: 20, background: '#0a0a0a' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: '#FAFAF7', marginBottom: 8 }}>
        <span style={{ width: 20, height: 20, background: '#2A2A28', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#FAFAF7', flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>{num}</span>
        {title}
      </h3>
      {needsReview && (
        <div style={{ fontSize: 10, color: '#B45309', border: '1px dashed #B45309', borderRadius: 2, padding: '2px 8px', display: 'inline-block', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
          [NEEDS ATTORNEY REVIEW] — Placeholder language — not final
        </div>
      )}
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
  const [step, setStep] = useState<Step>('landing');
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [skippedRegistration, setSkippedRegistration] = useState(false);
  const [firmName, setFirmName] = useState('Your Law Firm');

  // Load firm name from firms table via VITE_FIRM_ID
  useEffect(() => {
    const firmId = import.meta.env.VITE_FIRM_ID as string | undefined;
    if (!firmId) return;
    supabase
      .from('firms')
      .select('name')
      .eq('id', firmId)
      .single()
      .then(({ data }) => { if (data?.name) setFirmName(data.name); });
  }, []);

  // ── Required consents ────────────────────────────────────────────────────
  const [consentGeneral, setConsentGeneral]         = useState(false);
  const [consentSendGrid, setConsentSendGrid]       = useState(false);
  const [consentTwilio, setConsentTwilio]           = useState(false);
  const [consentElectronic, setConsentElectronic]   = useState(false);
  const [consentDataRetention, setConsentDataRetention] = useState(false);
  const [consentAiDisclosure, setConsentAiDisclosure]   = useState(false);

  // ── Plaid — two separate opt-in consents ─────────────────────────────────
  const [optInPlaidBank, setOptInPlaidBank]       = useState(true);
  const [optInPlaidPayroll, setOptInPlaidPayroll] = useState(true);
  const [ackPlaidBank, setAckPlaidBank]           = useState(false);
  const [ackPlaidPayroll, setAckPlaidPayroll]     = useState(false);

  const [consentTimestamp, setConsentTimestamp] = useState('');
  const [registeredEmail, setRegisteredEmail]   = useState('');

  const allDisclosuresAccepted =
    consentGeneral && consentSendGrid && consentTwilio && consentElectronic &&
    ackPlaidBank && ackPlaidPayroll &&
    consentDataRetention && consentAiDisclosure;

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
          opt_in_plaid_bank: optInPlaidBank,
          opt_in_plaid_payroll: optInPlaidPayroll,
          consented_plaid_bank: ackPlaidBank,
          consented_plaid_payroll: ackPlaidPayroll,
          consented_data_retention: consentDataRetention,
          consented_ai_disclosure: consentAiDisclosure,
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
    setConsentTimestamp(ts);
    setStep('your_docs');
  }

  // ── Shared styles ─────────────────────────────────────────────────────────

  const bg = '#0F0F0E';
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
          <div style={{ marginBottom: 40 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FAFAF7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 32, letterSpacing: '-0.02em', color: '#FAFAF7', marginTop: 12, lineHeight: 1.1 }}>
              bankruptcy.ai
            </h1>
            <p style={{ fontSize: 13, color: '#6B6B66', marginTop: 4 }}>Secure Client Portal — {firmName}</p>
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

            <div style={{ borderTop: '1px solid #2A2A28', paddingTop: 16, marginTop: 8 }}>
              <p style={{ fontSize: 12, color: '#6B6B66', marginBottom: 10 }}>
                You can also skip account creation and review disclosures directly. You will need to provide your information manually if you opt out of automated services.
              </p>
              <button onClick={handleSkipToDisclosures} style={{ ...secondaryBtn, padding: '10px 18px', fontSize: 13 }}>
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
          <p style={{ fontSize: 13, color: '#6B6B66', marginBottom: 28 }}>bankruptcy.ai — Secure Client Portal for {firmName}</p>

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
          <p style={{ fontSize: 13, color: '#6B6B66', marginBottom: 28 }}>Sign in to your bankruptcy.ai account — {firmName}</p>

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
            Review each section below. For Plaid bank and payroll access you may opt in or opt out.
            Opting out means you will provide that information manually.
            All other disclosures are required to access the portal.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* 1 — General */}
            <DisclosureSection num={1} title="General Legal Disclosures" needsReview>
              <DisclosureBody>
                <p>By registering for and using this client portal, you authorize <strong style={{ color: '#FAFAF7' }}>bankruptcy.ai</strong> and <strong style={{ color: '#FAFAF7' }}>{firmName}</strong> to obtain and share your information for the purpose of preparing your bankruptcy case. bankruptcy.ai is the software platform; {firmName} is your legal representative and is responsible for all legal advice and decisions in your case.</p>
                <p style={{ marginTop: 8 }}>This portal does not constitute legal advice. All information submitted is subject to attorney-client privilege where applicable. Your case information, documents, and communications may be accessed by authorized firm staff, paralegals, and attorneys assigned to your case at {firmName}. All data is stored securely under applicable privacy laws.</p>
                <p style={{ marginTop: 8 }}>Bankruptcy filings are public record. Certain financial information will be disclosed to the U.S. Bankruptcy Court, trustees, and creditors as required by 11 U.S.C. § 521 and applicable Federal Rules of Bankruptcy Procedure.</p>
              </DisclosureBody>
              <Checkbox checked={consentGeneral} onChange={setConsentGeneral} label="I have read, understand, and agree to the General Legal Disclosures above." />
            </DisclosureSection>

            {/* 2 — SendGrid */}
            <DisclosureSection num={2} title="Email Communications — SendGrid">
              <DisclosureBody>
                <p>You authorize bankruptcy.ai and {firmName} to send case-related email communications through <strong style={{ color: '#FAFAF7' }}>SendGrid</strong> (Twilio Inc.). These may include: case status updates, document requests, appointment confirmations, and deadline notifications. For V1, emails are sent from bankruptcy.ai's master SendGrid account. Future versions may use a dedicated {firmName} domain (V1.1). Transactional case emails cannot be disabled while your case is active.</p>
              </DisclosureBody>
              <Checkbox checked={consentSendGrid} onChange={setConsentSendGrid} label="I consent to receiving email communications via SendGrid as described above." />
            </DisclosureSection>

            {/* 3 — Twilio */}
            <DisclosureSection num={3} title="SMS / Voice Communications — Twilio">
              <DisclosureBody>
                <p>You authorize bankruptcy.ai and {firmName} to contact you via SMS and/or automated voice calls through <strong style={{ color: '#FAFAF7' }}>Twilio</strong>. These may include: appointment reminders, document upload notifications, urgent case alerts, and two-factor authentication codes. For V1, SMS is sent from bankruptcy.ai's master Twilio account. A dedicated {firmName} number may be used in future versions. Message and data rates may apply. Reply STOP to opt out of non-essential SMS. Reply HELP for help.</p>
              </DisclosureBody>
              <Checkbox checked={consentTwilio} onChange={setConsentTwilio} label="I consent to receiving SMS and/or voice communications via Twilio as described above." />
            </DisclosureSection>

            {/* 4 — Plaid Bank */}
            <DisclosureSection num={4} title="Bank Account Access — Plaid (90-Day Bank Statements)" needsReview>
              <DisclosureBody>
                <p>By opting in, you authorize bankruptcy.ai and {firmName} to access your bank account information through <strong style={{ color: '#FAFAF7' }}>Plaid Technologies, Inc.</strong> for the purpose of generating <strong style={{ color: '#FAFAF7' }}>90-day bank statements</strong>. This access includes: account balances and transaction history for up to 90 days. This information is used solely to prepare your bankruptcy petition and schedules as required by 11 U.S.C. § 521 and the Federal Rules of Bankruptcy Procedure. Plaid uses 256-bit encryption and does not store your banking credentials.</p>
              </DisclosureBody>
              <OptOutNote>You will need to upload bank statements manually for each account covering the 90-day period. All statements must be uploaded to your document portal before your signing appointment.</OptOutNote>
              <OptToggle optedIn={optInPlaidBank} onToggle={() => setOptInPlaidBank(v => !v)} label="Plaid bank account access (90-day statements)" />
              <Checkbox
                checked={ackPlaidBank}
                onChange={setAckPlaidBank}
                label={<>I have read and understand the Plaid bank account disclosure above and acknowledge my choice to <strong style={{ color: '#FAFAF7' }}>{optInPlaidBank ? 'opt in to' : 'opt out of'}</strong> 90-day bank statement retrieval via Plaid. {!optInPlaidBank && 'I will upload all bank statements manually.'}</>}
              />
            </DisclosureSection>

            {/* 5 — Plaid Payroll */}
            <DisclosureSection num={5} title="Payroll & Income Records — Plaid Income" needsReview>
              <DisclosureBody>
                <p>By opting in, you authorize bankruptcy.ai and {firmName} to access your payroll and income records through <strong style={{ color: '#FAFAF7' }}>Plaid Income</strong>. This access includes: digital paystubs and W-2 records retrieved directly from your payroll provider. This information is used solely to verify income for your bankruptcy means test (Official Form 122A-1) and Schedules I and J, as required by applicable bankruptcy rules. Plaid does not store your payroll provider credentials.</p>
              </DisclosureBody>
              <OptOutNote>You will need to provide physical copies of your two most recent pay stubs and most recent W-2(s) by uploading them to your document portal.</OptOutNote>
              <OptToggle optedIn={optInPlaidPayroll} onToggle={() => setOptInPlaidPayroll(v => !v)} label="Plaid payroll access (paystubs + W-2s)" />
              <Checkbox
                checked={ackPlaidPayroll}
                onChange={setAckPlaidPayroll}
                label={<>I have read and understand the Plaid payroll disclosure above and acknowledge my choice to <strong style={{ color: '#FAFAF7' }}>{optInPlaidPayroll ? 'opt in to' : 'opt out of'}</strong> payroll and income record retrieval via Plaid Income. {!optInPlaidPayroll && 'I will provide pay stubs and W-2s manually.'}</>}
              />
            </DisclosureSection>

            {/* 6 — Data Retention */}
            <DisclosureSection num={6} title="Data Retention & Copy-and-Purge Policy" needsReview>
              <DisclosureBody>
                <p>bankruptcy.ai operates a <strong style={{ color: '#FAFAF7' }}>30-day post-closing copy-and-purge</strong> data retention model. Upon final closure of your bankruptcy case: (a) {firmName} retains a complete copy of your case file per applicable rules of professional conduct and applicable state law; (b) bankruptcy.ai's active platform storage is purged of your case data within 30 days of the closure date. Backup and audit log retention may apply for a longer period under applicable law. This policy aligns with the Master Services Agreement between bankruptcy.ai and {firmName}.</p>
                <p style={{ marginTop: 8 }}>You may request a copy of your case file from {firmName} at any time during or after your case. Records required by law to be retained will be maintained for the period required by applicable statute.</p>
              </DisclosureBody>
              <Checkbox checked={consentDataRetention} onChange={setConsentDataRetention} label={`I understand and consent to the 30-day post-closing data retention and copy-and-purge policy described above.`} />
            </DisclosureSection>

            {/* 7 — AI/Automation Disclosure */}
            <DisclosureSection num={7} title="AI & Automation Disclosure" needsReview>
              <DisclosureBody>
                <p>bankruptcy.ai uses <strong style={{ color: '#FAFAF7' }}>automated processing</strong> to assist with document organization, case data extraction, and workflow management. Automated tools do not replace the legal judgment of your attorney at {firmName}. Specifically:</p>
                <ul style={{ marginTop: 8, paddingLeft: 16 }}>
                  <li>AI tools may assist in organizing documents and flagging potential issues for attorney review.</li>
                  <li>All legal decisions — including which exemptions to claim, what to disclose, and how to characterize assets — are made by your attorney, not by automated software.</li>
                  <li>No AI-generated content constitutes legal advice.</li>
                  <li>{firmName} is solely responsible for the accuracy and legal sufficiency of all filed documents.</li>
                </ul>
              </DisclosureBody>
              <Checkbox checked={consentAiDisclosure} onChange={setConsentAiDisclosure} label="I understand that bankruptcy.ai uses automated processing tools and that my attorney at the law firm remains solely responsible for all legal decisions in my case." />
            </DisclosureSection>

            {/* 8 — E-SIGN */}
            <DisclosureSection num={8} title="E-SIGN Act — Electronic Communications Consent">
              <DisclosureBody>
                <p>You consent to receive all disclosures, notices, documents, and communications related to your account and case in electronic form, consistent with the Electronic Signatures in Global and National Commerce Act (E-SIGN Act, 15 U.S.C. § 7001 et seq.) and applicable state laws. You confirm you have the ability to access and retain electronic records and have a valid email address.</p>
              </DisclosureBody>
              <Checkbox checked={consentElectronic} onChange={setConsentElectronic} label="I consent to receive all disclosures and communications electronically under the E-SIGN Act." />
            </DisclosureSection>

            {/* Opt-out summary */}
            {(!optInPlaidBank || !optInPlaidPayroll) && (
              <div style={{ border: '1px solid #B45309', borderRadius: 4, padding: '12px 16px', background: 'transparent' }}>
                <p style={{ fontSize: 12, color: '#B45309', fontWeight: 500, marginBottom: 6 }}>Manual documents required for opted-out services:</p>
                <ul style={{ fontSize: 12, color: '#B45309', paddingLeft: 16, lineHeight: 1.8 }}>
                  {!optInPlaidBank && <li>Bank statements (90 days, all accounts) — must be uploaded manually</li>}
                  {!optInPlaidPayroll && <li>Pay stubs (two most recent) and W-2(s) — must be uploaded manually</li>}
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
                {loading ? 'Saving...' : !allDisclosuresAccepted ? 'Acknowledge all disclosures above to continue' : 'Accept disclosures & continue'}
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
          : ['Name, email address, and phone number', `Authentication via bankruptcy.ai secure portal — ${firmName}`, `Registration date: ${fmtTs}`],
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
          `Plaid bank account access (90-day statements) — ${optInPlaidBank ? 'opted in' : 'opted out'}`,
          `Plaid payroll access (paystubs + W-2s) — ${optInPlaidPayroll ? 'opted in' : 'opted out'}`,
          'Data retention & copy-and-purge policy — acknowledged',
          'AI/automation disclosure — acknowledged',
          'E-SIGN Act electronic communications — consent given',
          `Consent timestamp: ${fmtTs}`,
        ],
        accent: '#B45309',
      },
      {
        id: 'intake',
        label: 'Intake Agreement',
        desc: `Your retainer agreement and engagement letter will be added here after your intake review is completed by your assigned attorney at ${firmName}.`,
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
                All signed documents are available in your client portal under <strong style={{ color: '#FAFAF7' }}>My Documents</strong>. Under bankruptcy.ai's data retention policy, records are retained for the duration of your case and purged from the platform within 30 days of case closure; {firmName} retains your complete file per applicable rules of professional conduct.
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
            Your account is set up and all consents have been recorded. Welcome to bankruptcy.ai — {firmName}.
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
