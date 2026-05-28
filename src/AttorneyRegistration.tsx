import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

type Step = 'landing' | 'register' | 'login' | 'firm_info' | 'disclosures' | 'success';

interface Props {
  onComplete: () => void;
  onBack?: () => void;
}

interface FirmForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  firmName: string;
  barNumber: string;
  stateBar: string;
  firmAddress: string;
  firmCity: string;
  firmState: string;
  firmZip: string;
  firmWebsite: string;
}

const INITIAL_FIRM: FirmForm = {
  firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '',
  firmName: '', barNumber: '', stateBar: '', firmAddress: '', firmCity: '',
  firmState: '', firmZip: '', firmWebsite: '',
};

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

export default function AttorneyRegistration({ onComplete, onBack }: Props) {
  const [step, setStep] = useState<Step>('landing');
  const [form, setForm] = useState<FirmForm>(INITIAL_FIRM);
  const [errors, setErrors] = useState<Partial<FirmForm>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [platformFirmName, setPlatformFirmName] = useState('bankruptcy.ai');

  // Load platform firm name from VITE_FIRM_ID for context display
  useEffect(() => {
    const firmId = import.meta.env.VITE_FIRM_ID as string | undefined;
    if (!firmId) return;
    supabase
      .from('firms')
      .select('name')
      .eq('id', firmId)
      .single()
      .then(({ data }) => { if (data?.name) setPlatformFirmName(data.name); });
  }, []);

  // Vendor consents (V1 pilot — iSoftpull and BoldSign removed)
  const [consentGeneral, setConsentGeneral]     = useState(false);
  const [consentSendGrid, setConsentSendGrid]   = useState(false);
  const [consentTwilio, setConsentTwilio]       = useState(false);
  const [consentPlaid, setConsentPlaid]         = useState(false);
  const [consentElectronic, setConsentElectronic] = useState(false);

  const allDisclosuresAccepted = consentGeneral && consentSendGrid && consentTwilio && consentPlaid && consentElectronic;

  function setField(field: keyof FirmForm, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: '' }));
  }

  function validateRegister(): boolean {
    const e: Partial<FirmForm> = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required';
    if (!form.phone.trim()) e.phone = 'Required';
    if (!form.password || form.password.length < 8) e.password = 'Min 8 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateFirmInfo(): boolean {
    const e: Partial<FirmForm> = {};
    if (!form.firmName.trim()) e.firmName = 'Required';
    if (!form.barNumber.trim()) e.barNumber = 'Required';
    if (!form.stateBar.trim()) e.stateBar = 'Required';
    if (!form.firmAddress.trim()) e.firmAddress = 'Required';
    if (!form.firmCity.trim()) e.firmCity = 'Required';
    if (!form.firmState.trim()) e.firmState = 'Required';
    if (!form.firmZip.trim()) e.firmZip = 'Required';
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
        options: {
          data: { first_name: form.firstName, last_name: form.lastName, phone: form.phone, role: 'attorney' },
        },
      });
      if (error) throw error;
      setStep('firm_info');
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
      setStep('firm_info');
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function handleFirmInfoNext() {
    if (!validateFirmInfo()) return;
    setStep('disclosures');
  }

  async function handleDisclosuresAccepted() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('attorney_registrations').upsert({
          user_id: user.id,
          email: form.email || user.email,
          first_name: form.firstName,
          last_name: form.lastName,
          phone: form.phone,
          firm_name: form.firmName,
          bar_number: form.barNumber,
          state_bar: form.stateBar,
          firm_address: form.firmAddress,
          firm_city: form.firmCity,
          firm_state: form.firmState,
          firm_zip: form.firmZip,
          firm_website: form.firmWebsite || null,
          // Vendor consents (V1 pilot)
          consented_general: consentGeneral,
          consented_sendgrid: consentSendGrid,
          consented_twilio: consentTwilio,
          consented_plaid: consentPlaid,
          consented_electronic: consentElectronic,
          vendor_consent_timestamp: new Date().toISOString(),
          v1_pilot_terms_acknowledged: true,
        });
      }
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
    setStep('success');
  }

  // ── Shared styles ─────────────────────────────────────────────────────────

  const inputCls = (err?: string) =>
    `w-full bg-slate-800 border ${err ? 'border-red-500' : 'border-slate-700'} rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all`;

  const labelCls = 'block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide';

  function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
    return (
      <label className="flex items-start gap-3 cursor-pointer" onClick={onChange}>
        <div className={`flex-shrink-0 w-5 h-5 rounded border-2 mt-0.5 transition-all flex items-center justify-center ${checked ? 'bg-amber-600 border-amber-600' : 'border-slate-600 bg-transparent'}`}>
          {checked && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
        </div>
        <span className="text-slate-300 text-xs leading-relaxed">{children}</span>
      </label>
    );
  }

  function NeedsReview() {
    return (
      <div className="text-[10px] text-amber-600 border border-dashed border-amber-700/50 rounded px-2 py-0.5 inline-block mb-2 uppercase tracking-wider font-semibold">
        [NEEDS ATTORNEY REVIEW] — Placeholder language — not final
      </div>
    );
  }

  // ── Step: Landing ─────────────────────────────────────────────────────────

  if (step === 'landing') {
    return (
      <div className="min-h-screen bg-[#060c18] flex flex-col items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-900/10 rounded-full blur-3xl" />
        </div>
        <div className="relative w-full max-w-md">
          {onBack && (
            <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-medium mb-6 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
              Back
            </button>
          )}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-600/20 border border-amber-500/30 mb-4 shadow-lg shadow-amber-900/20">
              <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              bankruptcy<span className="text-amber-400">.ai</span>
            </h1>
            <p className="text-slate-400 text-sm mt-2">Attorney & Law Firm Portal</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setStep('register')}
              className="w-full group bg-amber-600 hover:bg-amber-500 text-white rounded-xl py-4 px-6 font-semibold text-base transition-all shadow-lg shadow-amber-900/40 hover:-translate-y-0.5 flex items-center justify-between"
            >
              <span>Register Your Firm</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
              </svg>
            </button>
            <button
              onClick={() => setStep('login')}
              className="w-full group bg-slate-800 hover:bg-slate-700 text-white rounded-xl py-4 px-6 font-semibold text-base transition-all border border-slate-700 hover:border-slate-600 flex items-center justify-between"
            >
              <span>Sign In to Existing Firm Account</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>

          {/* V1 pilot terms notice — replaces old monthly-billing callout */}
          <div className="mt-6 bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wide">V1 Pilot Program — Service Terms</p>
            <p className="text-slate-300 text-xs leading-relaxed">
              During the V1 pilot program, third-party vendor services (Plaid, SendGrid, Twilio) are included at <strong className="text-white">vendor pass-through at cost</strong>. No monthly subscription billing is in effect during the pilot. See your <strong className="text-white">Master Services Agreement</strong> for current terms. Billing model to be finalized post-pilot per MAJ-86.
            </p>
          </div>

          <p className="text-center text-slate-600 text-xs mt-6">Protected by 256-bit TLS encryption.</p>
        </div>
      </div>
    );
  }

  // ── Step: Register ────────────────────────────────────────────────────────

  if (step === 'register') {
    return (
      <div className="min-h-screen bg-[#060c18] flex flex-col items-center justify-start p-4 pt-8">
        <div className="w-full max-w-lg">
          <button onClick={() => setStep('landing')} className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-medium mb-6 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            Back
          </button>
          <div className="text-center mb-7">
            <h2 className="text-2xl font-bold text-white">Attorney Account Setup</h2>
            <p className="text-slate-400 text-sm mt-1">Step 1 of 3 — Account Credentials</p>
          </div>

          {serverError && <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-3 mb-5 text-red-400 text-sm">{serverError}</div>}

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>First Name</label>
                <input className={inputCls(errors.firstName)} value={form.firstName} onChange={e => setField('firstName', e.target.value)} placeholder="First" />
                {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label className={labelCls}>Last Name</label>
                <input className={inputCls(errors.lastName)} value={form.lastName} onChange={e => setField('lastName', e.target.value)} placeholder="Last" />
                {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName}</p>}
              </div>
            </div>
            <div>
              <label className={labelCls}>Email Address</label>
              <input type="email" className={inputCls(errors.email)} value={form.email} onChange={e => setField('email', e.target.value)} placeholder="attorney@lawfirm.com" />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className={labelCls}>Phone Number</label>
              <input type="tel" className={inputCls(errors.phone)} value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="(555) 000-0000" />
              {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className={labelCls}>Password</label>
              <input type="password" className={inputCls(errors.password)} value={form.password} onChange={e => setField('password', e.target.value)} placeholder="Minimum 8 characters" />
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
            </div>
            <div>
              <label className={labelCls}>Confirm Password</label>
              <input type="password" className={inputCls(errors.confirmPassword)} value={form.confirmPassword} onChange={e => setField('confirmPassword', e.target.value)} placeholder="Re-enter password" />
              {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
            </div>
            <button onClick={handleRegister} disabled={loading} className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl py-3 font-semibold text-sm transition-all mt-2 shadow-lg shadow-amber-900/30">
              {loading ? 'Creating Account...' : 'Continue — Firm Information'}
            </button>
          </div>
          <p className="text-center text-slate-500 text-xs mt-4">
            Already registered?{' '}
            <button onClick={() => setStep('login')} className="text-amber-400 hover:text-amber-300 font-medium transition-colors">Sign in</button>
          </p>
        </div>
      </div>
    );
  }

  // ── Step: Login ───────────────────────────────────────────────────────────

  if (step === 'login') {
    return (
      <div className="min-h-screen bg-[#060c18] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <button onClick={() => setStep('landing')} className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-medium mb-6 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            Back
          </button>
          <div className="text-center mb-7">
            <h2 className="text-2xl font-bold text-white">Attorney Sign In</h2>
            <p className="text-slate-400 text-sm mt-1">bankruptcy.ai — Law Firm Portal</p>
          </div>
          {serverError && <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-3 mb-5 text-red-400 text-sm">{serverError}</div>}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div>
              <label className={labelCls}>Email Address</label>
              <input type="email" className={inputCls(errors.email)} value={form.email} onChange={e => setField('email', e.target.value)} placeholder="attorney@lawfirm.com" />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className={labelCls}>Password</label>
              <input type="password" className={inputCls(errors.password)} value={form.password} onChange={e => setField('password', e.target.value)} placeholder="Your password" />
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
            </div>
            <button onClick={handleLogin} disabled={loading} className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl py-3 font-semibold text-sm transition-all shadow-lg shadow-amber-900/30">
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Firm Information ────────────────────────────────────────────────

  if (step === 'firm_info') {
    return (
      <div className="min-h-screen bg-[#060c18] flex flex-col items-center justify-start p-4 pt-8">
        <div className="w-full max-w-lg">
          <div className="text-center mb-7">
            <div className="flex items-center justify-center gap-2 mb-1">
              {[1,2,3].map(n => (
                <div key={n} className={`h-1.5 w-10 rounded-full transition-all ${n <= 2 ? 'bg-amber-500' : 'bg-slate-700'}`} />
              ))}
            </div>
            <h2 className="text-2xl font-bold text-white mt-4">Firm Information</h2>
            <p className="text-slate-400 text-sm mt-1">Step 2 of 3 — Law Firm Details</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div>
              <label className={labelCls}>Law Firm Name</label>
              <input className={inputCls(errors.firmName)} value={form.firmName} onChange={e => setField('firmName', e.target.value)} placeholder="Smith & Associates, P.C." />
              {errors.firmName && <p className="text-red-400 text-xs mt-1">{errors.firmName}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Bar Number</label>
                <input className={inputCls(errors.barNumber)} value={form.barNumber} onChange={e => setField('barNumber', e.target.value)} placeholder="Bar #" />
                {errors.barNumber && <p className="text-red-400 text-xs mt-1">{errors.barNumber}</p>}
              </div>
              <div>
                <label className={labelCls}>State Bar</label>
                <select className={inputCls(errors.stateBar)} value={form.stateBar} onChange={e => setField('stateBar', e.target.value)}>
                  <option value="">Select State</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.stateBar && <p className="text-red-400 text-xs mt-1">{errors.stateBar}</p>}
              </div>
            </div>
            <div>
              <label className={labelCls}>Firm Address</label>
              <input className={inputCls(errors.firmAddress)} value={form.firmAddress} onChange={e => setField('firmAddress', e.target.value)} placeholder="123 Main St, Suite 100" />
              {errors.firmAddress && <p className="text-red-400 text-xs mt-1">{errors.firmAddress}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>City</label>
                <input className={inputCls(errors.firmCity)} value={form.firmCity} onChange={e => setField('firmCity', e.target.value)} placeholder="City" />
                {errors.firmCity && <p className="text-red-400 text-xs mt-1">{errors.firmCity}</p>}
              </div>
              <div>
                <label className={labelCls}>State</label>
                <select className={inputCls(errors.firmState)} value={form.firmState} onChange={e => setField('firmState', e.target.value)}>
                  <option value="">State</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.firmState && <p className="text-red-400 text-xs mt-1">{errors.firmState}</p>}
              </div>
              <div>
                <label className={labelCls}>ZIP</label>
                <input className={inputCls(errors.firmZip)} value={form.firmZip} onChange={e => setField('firmZip', e.target.value)} placeholder="00000" />
                {errors.firmZip && <p className="text-red-400 text-xs mt-1">{errors.firmZip}</p>}
              </div>
            </div>
            <div>
              <label className={labelCls}>Firm Website <span className="text-slate-600 normal-case font-normal">(optional)</span></label>
              <input className={inputCls()} value={form.firmWebsite} onChange={e => setField('firmWebsite', e.target.value)} placeholder="https://www.lawfirm.com" />
            </div>
            <button onClick={handleFirmInfoNext} className="w-full bg-amber-600 hover:bg-amber-500 text-white rounded-xl py-3 font-semibold text-sm transition-all mt-2 shadow-lg shadow-amber-900/30">
              Continue — Service Disclosures
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Disclosures & Vendor Consent ────────────────────────────────────

  if (step === 'disclosures') {
    return (
      <div className="min-h-screen bg-[#060c18] flex flex-col items-center justify-start p-4 pt-8">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-7">
            <div className="flex items-center justify-center gap-2 mb-1">
              {[1,2,3].map(n => (
                <div key={n} className={`h-1.5 w-10 rounded-full transition-all ${n <= 3 ? 'bg-amber-500' : 'bg-slate-700'}`} />
              ))}
            </div>
            <div className="inline-flex items-center gap-2 bg-amber-900/30 border border-amber-700/40 rounded-xl px-4 py-1.5 mb-4 mt-4">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
              <span className="text-amber-400 text-xs font-semibold tracking-wide uppercase">Third-Party Vendor Disclosures & Consent</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Firm Authorization & Disclosures</h2>
            <p className="text-slate-400 text-sm mt-2 max-w-lg mx-auto">Step 3 of 3 — Review and accept all third-party vendor disclosures on behalf of your law firm.</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5">

            {/* 1 — General */}
            <div className="bg-slate-800/60 border border-amber-700/40 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">1</span>
                General Platform Disclosures & Terms of Service
              </h3>
              <NeedsReview />
              <div className="text-slate-400 text-xs leading-relaxed space-y-1.5 max-h-28 overflow-y-auto pr-1">
                <p>By registering your law firm on <strong className="text-slate-300">bankruptcy.ai</strong>, you agree that the firm is responsible for all activities conducted under your firm's account, including actions taken by staff and attorneys authorized by your firm. You represent that you are authorized to bind the firm to these terms. bankruptcy.ai is a software-as-a-service platform that provides bankruptcy document preparation, case management, and client communication tools. bankruptcy.ai does not provide legal advice and is not a law firm.</p>
                <p>Your firm remains solely responsible for all legal advice given to clients, the accuracy of all filed documents, compliance with the Bankruptcy Code (11 U.S.C. et seq.), local court rules, and all applicable Rules of Professional Conduct. bankruptcy.ai does not guarantee any specific outcome for any client matter.</p>
                <p>During the V1 pilot program, third-party vendor services are provided at <strong className="text-slate-300">vendor pass-through at cost</strong> per the Master Services Agreement between bankruptcy.ai and your firm. See your MSA for current terms. Pricing model to be finalized post-pilot.</p>
              </div>
              <div className="mt-3">
                <Checkbox checked={consentGeneral} onChange={() => setConsentGeneral(!consentGeneral)}>
                  I acknowledge the General Platform Disclosures and confirm I am authorized to bind my law firm to these terms, including the V1 pilot vendor pass-through pricing terms in the Master Services Agreement.
                </Checkbox>
              </div>
            </div>

            {/* 2 — SendGrid */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">2</span>
                Email Communications — SendGrid
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Your firm authorizes bankruptcy.ai to send transactional and operational email communications to firm staff and authorized personnel via <strong className="text-slate-300">SendGrid</strong> (Twilio Inc.). These include: case status updates, document alerts, deadline notifications, and system notices. Your firm also authorizes client-facing emails to be sent on your firm's behalf through SendGrid in connection with active client cases. For V1, emails are sent from bankruptcy.ai's master SendGrid account. A dedicated firm domain may be available in V1.1 (see MSA). SendGrid processes email addresses and delivery metadata per their Privacy Policy.
              </p>
              <div className="mt-3">
                <Checkbox checked={consentSendGrid} onChange={() => setConsentSendGrid(!consentSendGrid)}>
                  My firm consents to sending and receiving email communications via SendGrid on behalf of the firm and its clients.
                </Checkbox>
              </div>
            </div>

            {/* 3 — Twilio */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">3</span>
                SMS / Voice Communications — Twilio
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Your firm authorizes bankruptcy.ai to deliver SMS text messages and automated voice notifications to firm staff and, where client consent has been obtained, to clients via <strong className="text-slate-300">Twilio</strong>. For V1, SMS is sent from bankruptcy.ai's master Twilio account. A dedicated {form.firmName || 'firm'} number may be available in V1.1 (see MSA). Firm personnel may opt out of SMS at any time. Message and data rates may apply for staff. Client SMS communications are only sent after client-level consent is captured.
              </p>
              <div className="mt-3">
                <Checkbox checked={consentTwilio} onChange={() => setConsentTwilio(!consentTwilio)}>
                  My firm consents to SMS/voice communications via Twilio for staff and client communications.
                </Checkbox>
              </div>
            </div>

            {/* 4 — Plaid */}
            <div className="bg-slate-800/60 border border-teal-700/30 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">4</span>
                Financial Records Access — Plaid (Bank + Payroll)
              </h3>
              <NeedsReview />
              <p className="text-slate-400 text-xs leading-relaxed">
                Your firm acknowledges that bankruptcy.ai integrates with <strong className="text-slate-300">Plaid Technologies, Inc.</strong> to retrieve client financial records for bankruptcy case preparation. This includes: (a) <strong className="text-slate-300">Plaid bank access</strong> for 90-day bank statements and account balances; and (b) <strong className="text-slate-300">Plaid Income</strong> for payroll records, paystubs, and W-2s. Your firm is responsible for ensuring that all required client-level consents are obtained before initiating any Plaid connection. During the V1 pilot, Plaid costs are passed through at cost per the Master Services Agreement — no per-client markup applies. All Plaid-related charges will be itemized on usage reports. Plaid application via bankruptcy.ai is required before activation.
              </p>
              <div className="mt-3">
                <Checkbox checked={consentPlaid} onChange={() => setConsentPlaid(!consentPlaid)}>
                  My firm acknowledges the Plaid bank and payroll integration, our responsibility to obtain client consent before each connection, and that Plaid costs are passed through at cost per the Master Services Agreement during the V1 pilot.
                </Checkbox>
              </div>
            </div>

            {/* 5 — E-SIGN */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">5</span>
                Electronic Communications & E-SIGN Consent
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Your firm consents to receive all platform notices, disclosures, and communications electronically under the E-SIGN Act (15 U.S.C. § 7001 et seq.). You confirm that your firm maintains electronic mail access and the capability to retain electronic records. You agree to promptly notify bankruptcy.ai of any changes to the firm's primary contact email address.
              </p>
              <div className="mt-3">
                <Checkbox checked={consentElectronic} onChange={() => setConsentElectronic(!consentElectronic)}>
                  My firm consents to receive all platform communications electronically under the E-SIGN Act.
                </Checkbox>
              </div>
            </div>

            <button
              onClick={handleDisclosuresAccepted}
              disabled={!allDisclosuresAccepted || loading}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-3.5 font-semibold text-sm transition-all shadow-lg shadow-amber-900/30"
            >
              {loading ? 'Saving...' : allDisclosuresAccepted ? 'I Accept All Disclosures — Complete Registration' : 'Please accept all disclosures above to continue'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Success ─────────────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-[#060c18] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-amber-600/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-900/30">
            <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Firm Registration Complete</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed max-w-sm mx-auto">
            Your law firm account is active. All vendor disclosures have been recorded. V1 pilot terms apply per your Master Services Agreement with bankruptcy.ai.
          </p>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 mb-8 text-left space-y-2">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">What Happens Next</p>
            {[
              { icon: '1', text: 'A bankruptcy.ai team member will contact you to complete Plaid onboarding and confirm your pilot configuration.' },
              { icon: '2', text: 'During the V1 pilot, vendor costs (Plaid, communications) are passed through at cost per your MSA. No monthly subscription invoices are generated during pilot.' },
              { icon: '3', text: 'You may now access all attorney portal features and begin onboarding clients.' },
            ].map(item => (
              <div key={item.icon} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">{item.icon}</div>
                <p className="text-slate-300 text-xs leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>

          <button
            onClick={onComplete}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white rounded-xl py-4 font-semibold text-base transition-all shadow-lg shadow-amber-900/40"
          >
            Enter Attorney Portal
          </button>
        </div>
      </div>
    );
  }

  return null;
}
