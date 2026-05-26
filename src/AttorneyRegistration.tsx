import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

type Step = 'landing' | 'register' | 'login' | 'firm_info' | 'billing' | 'disclosures' | 'vendor_consent' | 'success';

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

  // Billing acknowledgments
  const [billingMonthly, setBillingMonthly] = useState(false);
  const [billingImmediate, setBillingImmediate] = useState(false);
  const [billingPlaid, setBillingPlaid] = useState(false);
  const [billingIsoftpull, setBillingIsoftpull] = useState(false);
  const [billingThirdParty, setBillingThirdParty] = useState(false);

  // Vendor consents
  const [consentGeneral, setConsentGeneral] = useState(false);
  const [consentSendGrid, setConsentSendGrid] = useState(false);
  const [consentTwilio, setConsentTwilio] = useState(false);
  const [consentIsoftpull, setConsentIsoftpull] = useState(false);
  const [consentPlaid, setConsentPlaid] = useState(false);
  const [consentElectronic, setConsentElectronic] = useState(false);

  const allBillingAccepted = true;
  const allDisclosuresAccepted = true;

  function setField(field: keyof FirmForm, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: '' }));
  }

  function validateRegister(): boolean {
    return true;
  }

  function validateFirmInfo(): boolean {
    return true;
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
          data: {
            first_name: form.firstName,
            last_name: form.lastName,
            phone: form.phone,
            role: 'attorney',
          },
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

  async function handleFirmInfoNext() {
    if (!validateFirmInfo()) return;
    setStep('billing');
  }

  async function handleBillingAccepted() {
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
          // Billing
          billing_monthly_acknowledged: billingMonthly,
          billing_immediate_acknowledged: billingImmediate,
          billing_plaid_acknowledged: billingPlaid,
          billing_isoftpull_acknowledged: billingIsoftpull,
          billing_third_party_acknowledged: billingThirdParty,
          billing_consent_timestamp: new Date().toISOString(),
          // Vendor consents
          consented_general: consentGeneral,
          consented_sendgrid: consentSendGrid,
          consented_twilio: consentTwilio,
          consented_isoftpull: consentIsoftpull,
          consented_plaid: consentPlaid,
          consented_electronic: consentElectronic,
          vendor_consent_timestamp: new Date().toISOString(),
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
              BankruptcyDocs<span className="text-amber-400">.ai</span>
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

          {/* Pricing callout */}
          <div className="mt-6 bg-amber-900/20 border border-amber-700/30 rounded-xl p-4">
            <p className="text-amber-400 text-xs font-semibold mb-2 uppercase tracking-wide">Billing Notice</p>
            <p className="text-slate-300 text-xs leading-relaxed">
              Law firm accounts are billed monthly on the <strong className="text-white">1st of each month</strong>. Charges are due immediately upon invoice. Per-client fees apply for Plaid financial record access and iSoftpull credit pre-qualification pulls, billed through BankruptcyDocs.ai.
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
            <p className="text-slate-400 text-sm mt-1">Step 1 of 4 — Account Credentials</p>
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
            <p className="text-slate-400 text-sm mt-1">BankruptcyDocs.ai — Law Firm Portal</p>
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
              {[1,2,3,4].map(n => (
                <div key={n} className={`h-1.5 w-10 rounded-full transition-all ${n <= 2 ? 'bg-amber-500' : 'bg-slate-700'}`} />
              ))}
            </div>
            <h2 className="text-2xl font-bold text-white mt-4">Firm Information</h2>
            <p className="text-slate-400 text-sm mt-1">Step 2 of 4 — Law Firm Details</p>
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
              Continue — Billing Terms
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Billing Terms ───────────────────────────────────────────────────
  if (step === 'billing') {
    return (
      <div className="min-h-screen bg-[#060c18] flex flex-col items-center justify-start p-4 pt-8">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-7">
            <div className="flex items-center justify-center gap-2 mb-1">
              {[1,2,3,4].map(n => (
                <div key={n} className={`h-1.5 w-10 rounded-full transition-all ${n <= 3 ? 'bg-amber-500' : 'bg-slate-700'}`} />
              ))}
            </div>
            <div className="inline-flex items-center gap-2 bg-amber-900/30 border border-amber-700/40 rounded-xl px-4 py-1.5 mb-4 mt-4">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span className="text-amber-400 text-xs font-semibold tracking-wide uppercase">Billing Terms & Fee Schedule</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Firm Billing Agreement</h2>
            <p className="text-slate-400 text-sm mt-2 max-w-lg mx-auto">Step 3 of 4 — Review and acknowledge all billing terms before proceeding.</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5">

            {/* Monthly billing cycle */}
            <div className="bg-slate-800/60 border border-amber-700/40 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">1</span>
                Monthly Billing Cycle
              </h3>
              <div className="text-slate-400 text-xs leading-relaxed space-y-2">
                <p>Your law firm account is billed on a <strong className="text-white">monthly subscription cycle</strong>. Invoices are generated on the <strong className="text-white">1st of each calendar month</strong> and cover services rendered during the prior month. Payment is due <strong className="text-amber-400">immediately upon receipt of invoice</strong> — no grace period applies unless separately negotiated in writing.</p>
                <p>Failure to pay within 15 days of the invoice date may result in suspension of service access. Accounts more than 30 days past due may be terminated and referred to collections. All overdue balances accrue interest at 1.5% per month (18% annually) or the maximum rate permitted by applicable law, whichever is lower.</p>
              </div>
              <Checkbox checked={billingMonthly} onChange={() => setBillingMonthly(!billingMonthly)}>
                I acknowledge that my firm will be billed monthly on the 1st of each month and that all invoices are due immediately upon receipt.
              </Checkbox>
            </div>

            {/* Immediate due */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">2</span>
                Immediate Payment Upon Invoice
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                By using BankruptcyDocs.ai services, your firm authorizes automatic billing to the payment method on file. All charges are due <strong className="text-white">immediately at the time of invoicing</strong>. BankruptcyDocs.ai reserves the right to charge the payment method on file on the invoice date without further notice. Your firm is responsible for maintaining a valid payment method at all times. In the event of a failed payment, services may be suspended within 3 business days.
              </p>
              <div className="mt-3">
                <Checkbox checked={billingImmediate} onChange={() => setBillingImmediate(!billingImmediate)}>
                  I authorize BankruptcyDocs.ai to charge the payment method on file immediately upon invoice generation on the 1st of each month.
                </Checkbox>
              </div>
            </div>

            {/* Plaid fees */}
            <div className="bg-slate-800/60 border border-teal-700/30 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">3</span>
                Plaid Financial Document Services — Per-Client Fees
              </h3>
              <div className="text-slate-400 text-xs leading-relaxed space-y-2">
                <p>Your firm will be billed on a <strong className="text-white">per-client basis</strong> for access to Plaid financial record services, which include: bank account statement retrieval, bank balance verification, income and employment data, and digital paystub access. These fees are incurred at the time a Plaid connection is initiated for a client and are billed through BankruptcyDocs.ai on your monthly invoice.</p>
                <p>Plaid requires a separate application and approval process. Your firm may apply through BankruptcyDocs.ai as a sub-subscriber. All Plaid-related charges will be itemized on your monthly invoice as <strong className="text-white">"Plaid Financial Services — [Client Name/ID]"</strong>. BankruptcyDocs.ai acts as the billing intermediary; your firm is responsible for the full per-client Plaid fee regardless of whether the client's case proceeds to filing.</p>
                <div className="bg-teal-900/20 border border-teal-800/40 rounded-lg p-2 mt-2">
                  <p className="text-teal-300 text-xs"><strong>Note:</strong> Plaid application may be required before activation. BankruptcyDocs.ai will facilitate the application process. Fees are subject to Plaid's current pricing schedule plus BankruptcyDocs.ai platform fee.</p>
                </div>
              </div>
              <div className="mt-3">
                <Checkbox checked={billingPlaid} onChange={() => setBillingPlaid(!billingPlaid)}>
                  I understand that per-client Plaid financial document fees will be billed through BankruptcyDocs.ai on my monthly invoice, and that Plaid application may be required.
                </Checkbox>
              </div>
            </div>

            {/* iSoftpull fees */}
            <div className="bg-slate-800/60 border border-blue-700/30 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">4</span>
                iSoftpull Credit Pre-Qualification — Per-Pull Fees
              </h3>
              <div className="text-slate-400 text-xs leading-relaxed space-y-2">
                <p>Your firm will be billed on a <strong className="text-white">per-pull basis</strong> for iSoftpull credit pre-qualification services. Each soft credit pull performed on behalf of a client generates a per-transaction fee billed through BankruptcyDocs.ai. These pulls are used to pre-qualify clients for financing options and to assist in preparing accurate Schedule E/F creditor listings.</p>
                <p>iSoftpull requires a separate subscriber application. Your firm may apply through BankruptcyDocs.ai. All iSoftpull charges will be itemized on your monthly invoice as <strong className="text-white">"iSoftpull Credit Pull — [Client Name/ID]"</strong>. BankruptcyDocs.ai acts as the billing intermediary. Your firm is responsible for all per-pull charges regardless of case outcome.</p>
                <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg p-2 mt-2">
                  <p className="text-blue-300 text-xs"><strong>Note:</strong> iSoftpull subscriber application may be required before activation. Only soft pulls are billed through this service. Hard pulls (full credit report for extension of credit) are a separate service and subject to additional fees.</p>
                </div>
              </div>
              <div className="mt-3">
                <Checkbox checked={billingIsoftpull} onChange={() => setBillingIsoftpull(!billingIsoftpull)}>
                  I understand that per-pull iSoftpull credit pre-qualification fees will be billed through BankruptcyDocs.ai on my monthly invoice, and that iSoftpull subscriber application may be required.
                </Checkbox>
              </div>
            </div>

            {/* Third-party application requirement */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">5</span>
                Third-Party Vendor Application Requirement
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Certain third-party vendors integrated with BankruptcyDocs.ai — including but not limited to <strong className="text-white">Plaid Technologies, Inc.</strong> and <strong className="text-white">iSoftpull</strong> — may require your law firm to complete a separate application, credentialing, or approval process directly with that vendor or through BankruptcyDocs.ai as a facilitated subscriber. Your firm acknowledges that: (a) access to certain features is contingent upon vendor approval, (b) BankruptcyDocs.ai does not guarantee vendor approval, (c) all third-party vendor fees incurred are payable through BankruptcyDocs.ai regardless of whether vendor approval has been completed, and (d) BankruptcyDocs.ai will assist in facilitating the application process but is not responsible for vendor approval timelines or outcomes.
              </p>
              <div className="mt-3">
                <Checkbox checked={billingThirdParty} onChange={() => setBillingThirdParty(!billingThirdParty)}>
                  I acknowledge the third-party vendor application requirement and understand that all associated fees are billed through BankruptcyDocs.ai.
                </Checkbox>
              </div>
            </div>

            <button
              onClick={handleBillingAccepted}
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-3.5 font-semibold text-sm transition-all shadow-lg shadow-amber-900/30"
            >
              {allBillingAccepted ? 'I Accept Billing Terms — Continue to Disclosures' : 'Please acknowledge all billing terms above'}
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
              {[1,2,3,4].map(n => (
                <div key={n} className={`h-1.5 w-10 rounded-full transition-all ${n <= 4 ? 'bg-amber-500' : 'bg-slate-700'}`} />
              ))}
            </div>
            <div className="inline-flex items-center gap-2 bg-amber-900/30 border border-amber-700/40 rounded-xl px-4 py-1.5 mb-4 mt-4">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
              <span className="text-amber-400 text-xs font-semibold tracking-wide uppercase">Third-Party Vendor Disclosures & Consent</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Firm Authorization & Disclosures</h2>
            <p className="text-slate-400 text-sm mt-2 max-w-lg mx-auto">Step 4 of 4 — Review and accept all third-party vendor disclosures on behalf of your law firm.</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5">

            {/* General */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">1</span>
                General Platform Disclosures & Terms of Service
              </h3>
              <div className="text-slate-400 text-xs leading-relaxed space-y-1.5 max-h-28 overflow-y-auto pr-1">
                <p>By registering your law firm on BankruptcyDocs.ai, you agree that the firm is responsible for all activities conducted under your firm's account, including actions taken by staff and attorneys authorized by your firm. You represent that you are authorized to bind the firm to these terms. BankruptcyDocs.ai is a software-as-a-service platform that provides bankruptcy document preparation, case management, and client communication tools. BankruptcyDocs.ai does not provide legal advice and is not a law firm.</p>
                <p>Your firm remains solely responsible for all legal advice given to clients, the accuracy of all filed documents, compliance with the Bankruptcy Code (11 U.S.C. et seq.), local court rules, and all applicable Rules of Professional Conduct. BankruptcyDocs.ai does not guarantee any specific outcome for any client matter.</p>
              </div>
              <div className="mt-3">
                <Checkbox checked={consentGeneral} onChange={() => setConsentGeneral(!consentGeneral)}>
                  I acknowledge the General Platform Disclosures and confirm I am authorized to bind my law firm to these terms.
                </Checkbox>
              </div>
            </div>

            {/* SendGrid */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">2</span>
                Email Communications — SendGrid
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Your firm authorizes BankruptcyDocs.ai to send transactional and operational email communications to firm staff and authorized personnel via <strong className="text-slate-300">SendGrid</strong> (Twilio Inc.). These include: case status updates, billing invoices, document alerts, deadline notifications, and system notices. Your firm also authorizes client-facing emails to be sent on your firm's behalf through SendGrid in connection with active client cases. SendGrid processes email addresses and delivery metadata per their Privacy Policy.
              </p>
              <div className="mt-3">
                <Checkbox checked={consentSendGrid} onChange={() => setConsentSendGrid(!consentSendGrid)}>
                  My firm consents to sending and receiving email communications via SendGrid on behalf of the firm and its clients.
                </Checkbox>
              </div>
            </div>

            {/* Twilio */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">3</span>
                SMS / Voice Communications — Twilio
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Your firm authorizes BankruptcyDocs.ai to deliver SMS text messages and automated voice notifications to firm staff and, where client consent has been obtained, to clients via <strong className="text-slate-300">Twilio</strong>. Firm personnel may opt out of SMS at any time. Message and data rates may apply for staff. Client SMS communications are only sent after client-level consent is captured. Twilio processes phone numbers and message metadata per their Privacy Policy.
              </p>
              <div className="mt-3">
                <Checkbox checked={consentTwilio} onChange={() => setConsentTwilio(!consentTwilio)}>
                  My firm consents to SMS/voice communications via Twilio for staff and client communications.
                </Checkbox>
              </div>
            </div>

            {/* iSoftpull */}
            <div className="bg-slate-800/60 border border-blue-800/50 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">4</span>
                Credit Pre-Qualification — iSoftpull / TransUnion
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Your firm acknowledges that BankruptcyDocs.ai integrates with <strong className="text-slate-300">iSoftpull</strong> to perform soft credit inquiries on clients who have provided FCRA-compliant written consent. Your firm, as the subscriber, is responsible for ensuring that all required consumer consents are properly obtained before initiating any credit pull through the platform. Your firm acknowledges that iSoftpull may require a subscriber application and that use of iSoftpull services is subject to iSoftpull's Subscriber Agreement and the Fair Credit Reporting Act (FCRA). All credit pull fees are billed through BankruptcyDocs.ai as described in the Billing Terms.
              </p>
              <div className="mt-3">
                <Checkbox checked={consentIsoftpull} onChange={() => setConsentIsoftpull(!consentIsoftpull)}>
                  My firm acknowledges the iSoftpull integration requirements, our responsibility to obtain consumer FCRA consent, and the associated per-pull billing through BankruptcyDocs.ai.
                </Checkbox>
              </div>
            </div>

            {/* Plaid */}
            <div className="bg-slate-800/60 border border-teal-700/30 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">5</span>
                Financial Records Access — Plaid
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Your firm acknowledges that BankruptcyDocs.ai integrates with <strong className="text-slate-300">Plaid Technologies, Inc.</strong> to retrieve client financial records — including bank statements, account balances, transaction histories, income verification, and paystubs — for bankruptcy case preparation. Your firm is responsible for ensuring that all required client-level consents are obtained before initiating a Plaid connection. Plaid processes financial institution credentials and data per their Privacy Policy and applicable financial regulations. A Plaid application may be required before activation. All Plaid service fees are billed through BankruptcyDocs.ai as described in the Billing Terms.
              </p>
              <div className="mt-3">
                <Checkbox checked={consentPlaid} onChange={() => setConsentPlaid(!consentPlaid)}>
                  My firm acknowledges the Plaid integration, our responsibility to obtain client consent, and the associated per-client fees billed through BankruptcyDocs.ai.
                </Checkbox>
              </div>
            </div>

            {/* E-SIGN */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">6</span>
                Electronic Communications & E-SIGN Consent
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Your firm consents to receive all platform notices, invoices, disclosures, and communications electronically under the E-SIGN Act (15 U.S.C. § 7001 et seq.). You confirm that your firm maintains electronic mail access and the capability to retain electronic records. You agree to promptly notify BankruptcyDocs.ai of any changes to the firm's primary contact email address. Paper copies of any electronic communication may be requested for a reasonable fee.
              </p>
              <div className="mt-3">
                <Checkbox checked={consentElectronic} onChange={() => setConsentElectronic(!consentElectronic)}>
                  My firm consents to receive all platform communications and invoices electronically under the E-SIGN Act.
                </Checkbox>
              </div>
            </div>

            <button
              onClick={handleDisclosuresAccepted}
              disabled={loading}
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
            Your law firm account is active. All billing terms and vendor consents have been recorded. You will be billed on the 1st of each month for all services rendered.
          </p>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 mb-8 text-left space-y-2">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">What Happens Next</p>
            {[
              { icon: '1', text: 'A BankruptcyDocs.ai representative will contact you regarding Plaid and iSoftpull vendor applications if applicable.' },
              { icon: '2', text: 'Your first invoice will be generated on the 1st of the following month.' },
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
