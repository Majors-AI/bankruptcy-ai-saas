import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

type Step = 'landing' | 'register' | 'login' | 'firm_info' | 'disclosures' | 'success' | 'demo' | 'demo_sent';

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
  // Free-demo request — captured pre-registration so firms that want a
  // walk-through can opt in without signing up. Persistence + outbound
  // notification to the sales/operator inbox are TODO; today we capture
  // the fields and surface a confirmation screen.
  const [demoForm, setDemoForm] = useState({
    firstName: '', lastName: '', firmName: '', email: '', phone: '',
    barNumber: '', stateBar: '', preferredTime: '', notes: '',
  });
  const [demoErrors, setDemoErrors] = useState<Partial<typeof demoForm>>({});

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

  // Vendor consents captured at firm registration
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
      <div className="min-h-screen bg-[#060c18] text-slate-200">
        {/* Ambient glow — matches the rest of the registration flow's
            amber palette. Pointer-events disabled so the hero CTAs stay
            clickable through the gradient. */}
        <div className="absolute inset-x-0 top-0 h-[640px] overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[520px] bg-amber-900/15 rounded-full blur-3xl" />
          <div className="absolute top-40 right-0 w-[600px] h-[400px] bg-sky-900/10 rounded-full blur-3xl" />
        </div>

        {/* Top nav — Back + Sign-in entry */}
        <header className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 pt-6 flex items-center justify-between">
          {onBack ? (
            <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-medium transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
              Back
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-600/20 border border-amber-500/30">
              <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
              </svg>
            </div>
            <span className="text-sm font-bold text-white tracking-tight">
              bankruptcy<span className="text-amber-400">.ai</span>
            </span>
          </div>
          <button
            onClick={() => setStep('login')}
            className="text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Sign in &rarr;
          </button>
        </header>

        {/* ─── Hero ──────────────────────────────────────────────────── */}
        <section className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 pt-16 pb-12 text-center">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            For consumer-bankruptcy law firms
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.05]">
            The end-to-end platform for<br className="hidden sm:block" />{" "}
            <span className="text-amber-400">consumer-bankruptcy practice.</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto mt-6 leading-relaxed">
            Intake to discharge, in one place. Document gathering, trustee submissions,
            credit-report pulls that drop straight into your schedules, and AI that keeps
            every client moving — without you chasing them.
          </p>

          {/* Eligibility statement — surfaced UP FRONT so non-firms self-select out */}
          <div className="mt-6 inline-flex items-center gap-2 text-xs text-amber-200/90 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-2">
            <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            <span><strong className="text-amber-300">Eligibility:</strong> you must be a law firm in good standing with at least one attorney licensed to practice. Bar status is verified during registration.</span>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setStep('register')}
              className="group bg-amber-600 hover:bg-amber-500 text-white rounded-xl py-4 px-7 font-semibold text-base transition-all shadow-lg shadow-amber-900/40 hover:-translate-y-0.5 flex items-center gap-2"
            >
              <span>Register your firm</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
              </svg>
            </button>
            <button
              onClick={() => setStep('demo')}
              className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-3 transition-colors"
            >
              Request a free demo &rarr;
            </button>
            <a href="#how-it-works" className="text-sm font-semibold text-slate-500 hover:text-slate-300 px-4 py-3">
              See how it works &darr;
            </a>
          </div>
        </section>

        {/* ─── How it works ──────────────────────────────────────────── */}
        <section id="how-it-works" className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 py-16 border-t border-slate-800/60">
          <div className="text-center mb-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300 mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Onboard your firm in four steps.</h2>
            <p className="text-sm text-slate-400 mt-3 max-w-xl mx-auto">
              From bar verification to your first filed petition — a clear path with no surprise integrations.
            </p>
          </div>

          <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                n: '01', title: 'Verify your firm',
                body: 'Bar number, state of admission, and firm contact details. We confirm good-standing before the firm portal unlocks.',
              },
              {
                n: '02', title: 'Configure your firm',
                body: 'White-label branding, fee templates, departments (intake / accounting / legal), and the IRS Living-Standards overlay if your district allows higher expenses.',
              },
              {
                n: '03', title: 'Invite clients',
                body: 'Send a secure intake link. Plaid pulls bank statements, credit-report import drops creditors into Schedule E/F, and the AI assistant keeps the client moving.',
              },
              {
                n: '04', title: 'File & submit',
                body: 'Export to Best Case (or your existing filing software), submit trustee documents from the same record, and ride the case through 341 and discharge.',
              },
            ].map(s => (
              <li key={s.n} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 relative overflow-hidden hover:border-amber-500/30 transition-colors">
                <span className="absolute top-4 right-5 text-5xl font-bold text-slate-800/80 leading-none select-none">{s.n}</span>
                <h3 className="text-base font-semibold text-white mb-2 relative">{s.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed relative" dangerouslySetInnerHTML={{ __html: s.body }} />
              </li>
            ))}
          </ol>
        </section>

        {/* ─── Features ──────────────────────────────────────────────── */}
        <section className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 py-16 border-t border-slate-800/60">
          <div className="text-center mb-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300 mb-3">Platform features</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Built for the way bankruptcy practice actually works.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Document gathering */}
            <FeatureCard
              icon={
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              }
              title="Client document gathering"
              body="A guided client portal collects every document the trustee will ask for — pay stubs, tax returns, bank statements, IDs, vehicle titles, retirement statements. Automated reminders + due-date tracking. Upload by phone or web."
              bullets={[
                'Plaid-backed bank-statement retrieval — no PDF chasing',
                'Per-case checklist auto-built from the filing chapter + district',
                'Refresh on filing-date cadence (docs current as of signing)',
              ]}
            />

            {/* Trustee submissions */}
            <FeatureCard
              icon={
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
                </svg>
              }
              title="Trustee document submissions"
              body="Package and submit Chapter 7 / 13 trustee documents straight from the case file. Per-trustee checklists, encrypted delivery, and read receipts so you know exactly when the trustee opens each packet."
              bullets={[
                'District + trustee-specific checklists (AZ, WA, NTX seeded)',
                'Encrypted bundle delivery + audit log on every send',
                '341 meeting checklist tied to the same record',
              ]}
            />

            {/* Credit pull */}
            <FeatureCard
              icon={
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                </svg>
              }
              title="Credit pull → Schedule E/F"
              body="Pull a tri-bureau credit report inside the case file and import the creditors directly into Schedules D / E / F. Account numbers, balances, addresses — no re-keying."
              bullets={[
                'Soft + hard pull options; consent captured + audit-logged',
                'Auto-classify secured vs unsecured priority vs general unsecured',
                'Match against the client’s self-reported list, flag discrepancies for attorney review',
              ]}
            />

            {/* AI + automation */}
            <FeatureCard
              icon={
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
              }
              title="AI + automation that runs the case"
              body="A drafted-message assistant keeps clients informed at every step — appointment reminders, missing-document nudges, post-filing 341 prep, discharge follow-ups. Drafts go to your team for approval; nothing sends without a human."
              bullets={[
                'Per-firm voice + authorized knowledge base — the AI never invents legal advice',
                'Automatic stage-by-stage status notifications to the client',
                'Attorney-supervisor approval queue on every outbound draft',
              ]}
            />
          </div>
        </section>

        {/* ─── Integrations ──────────────────────────────────────────── */}
        <section className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 py-16 border-t border-slate-800/60">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300 mb-3">Integrations</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Works with your existing software — including Best Case.
              </h2>
              <p className="text-sm text-slate-400 mt-4 leading-relaxed">
                You shouldn&apos;t have to rip out the filing software your team already knows.
                Export a complete case package to <strong className="text-white">Best Case Bankruptcy</strong> when
                you&apos;re ready to file — schedules, statement of financial affairs, means-test
                figures, and supporting documents — all formatted for direct import. Other
                filing systems on the integration roadmap.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-slate-300">
                {[
                  'Best Case Bankruptcy export (schedules + SOFA + 122 forms)',
                  'Plaid for bank-statement retrieval (consent-tracked)',
                  'Tri-bureau credit-report pull → schedules import',
                  'SendGrid + Twilio for transactional client comms',
                  'PACER reconciliation — filing-date confirmation flows back into the case file',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7"/></svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Sample case export</p>
              <div className="space-y-2 text-xs font-mono">
                {[
                  ['client', 'Doe, Jane M.'],
                  ['chapter', '7'],
                  ['district', 'D. Ariz. (Phoenix)'],
                  ['cmi', '$4,237.18 / mo'],
                  ['median', '$73,935 / yr (AZ × 1)'],
                  ['means_test', 'pass (below median)'],
                  ['schedule_a_b', '12 assets imported'],
                  ['schedule_d', '2 secured creditors'],
                  ['schedule_e_f', '14 unsecured (credit-pull match: 13 / report: 13)'],
                  ['exemption_set', 'AZ (opt-out)'],
                  ['export_target', 'Best Case Bankruptcy → ready'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 border-b border-slate-800/60 pb-1.5">
                    <span className="text-slate-500">{k}</span>
                    <span className="text-amber-300 text-right">{v}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 italic mt-3">Illustrative — not a real client.</p>
            </div>
          </div>
        </section>

        {/* ─── CTA ─────────────────────────────────────────────────── */}
        <section className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 py-16 border-t border-slate-800/60">
          <div className="bg-gradient-to-br from-amber-600/20 via-amber-500/5 to-transparent border border-amber-500/30 rounded-3xl p-8 sm:p-10 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Register — or see it first.
            </h2>
            <p className="text-sm text-slate-300 mt-3 max-w-xl mx-auto">
              Registration takes about 5 minutes (firm address, bar number, state of admission,
              and a working email for the firm owner). Prefer a walk-through before you sign up?
              Request a free demo and we&apos;ll show you the platform end-to-end.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setStep('register')}
                className="group bg-amber-600 hover:bg-amber-500 text-white rounded-xl py-3.5 px-6 font-semibold text-sm transition-all shadow-lg shadow-amber-900/40 hover:-translate-y-0.5 flex items-center gap-2"
              >
                <span>Start registration</span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
              </button>
              <button
                onClick={() => setStep('demo')}
                className="group bg-slate-800 hover:bg-slate-700 text-white rounded-xl py-3.5 px-6 font-semibold text-sm transition-all border border-slate-700 hover:border-slate-600 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                <span>Request a free demo</span>
              </button>
              <button
                onClick={() => setStep('login')}
                className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-3 transition-colors"
              >
                Already registered? Sign in &rarr;
              </button>
            </div>

            <p className="text-[11px] text-amber-200/80 mt-6">
              <strong className="text-amber-300">Reminder:</strong> registration requires a firm in good standing
              with at least one attorney licensed in the state of admission. Bar status is verified
              against the state bar directory.
            </p>
          </div>

          <p className="text-center text-slate-600 text-[11px] mt-6">Protected by 256-bit TLS encryption.</p>
        </section>
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

            {/* 1 — Firm acknowledgments — finalized copy */}
            <div className="bg-slate-800/60 border border-amber-700/40 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">1</span>
                Firm Acknowledgments
              </h3>
              <NeedsReview />
              <div className="text-slate-400 text-xs leading-relaxed space-y-2 max-h-72 overflow-y-auto pr-1">
                <p><strong className="text-slate-300">Roles.</strong> The Firm provides the legal services. <strong className="text-slate-300">Bankruptcy.AI, LLC</strong> ("Bankruptcy.AI") provides technology only — Bankruptcy.AI does not practice law and does not give legal advice.</p>
                <p><strong className="text-slate-300">FCRA end user.</strong> For any consumer report obtained through the platform (TransUnion, via <strong className="text-slate-300">iSoftpull</strong>), the Firm is the FCRA "end user," holds the permissible purpose, and is provisioned as its own end-user account. Bankruptcy.AI operates the platform; via the iSoftpull Raw Credit JSON API it receives the report and relays it to the Firm, stores it on the Firm's behalf as processor, and does not use it for its own purposes.</p>
                <p><strong className="text-slate-300">Data ownership / control.</strong> The Firm owns and controls client information (the Firm is the data controller). Bankruptcy.AI does not own client information.</p>
                <p><strong className="text-slate-300">Bankruptcy.AI's role and use of data.</strong> Bankruptcy.AI does not use client information for its own purposes; does not sell, rent, or share it; and does not use it for advertising. Access is limited to operating the platform and supporting the Firm (role-restricted, logged). Bankruptcy.AI may use client information only in <strong className="text-slate-300">de-identified</strong> form to develop, train, and improve its AI models and services where the Firm authorizes and the client has opted in. All client information is encrypted in transit and at rest under SOC 2 controls; each firm's information is segregated from every other firm's.</p>
                <p><strong className="text-slate-300">Firm eligibility, good standing & licensure.</strong> The Firm represents and warrants, at registration and continuously, that it is a law firm or practice in good standing and that each attorney responsible for matters prepared through the platform is licensed and in good standing in the jurisdiction(s) in which the Firm intends to file. The Firm will promptly notify Bankruptcy.AI of any change in this status. Bankruptcy.AI may require evidence as a condition of onboarding and continued access.</p>
                <p><strong className="text-slate-300">Owner identity.</strong> The owner or principal who executes the agreement on the Firm's behalf will submit a copy of a current government-issued photo ID and any other reasonably required proof of identity.</p>
                <p><strong className="text-slate-300">Onboarding sequence.</strong> The Firm's invitation to register and provision accounts is enabled only after the agreement is executed and the owner's identity is verified.</p>
                <p><strong className="text-slate-300">Client consents & firm compliance.</strong> The Firm is responsible for ensuring each client provides the required authorizations before any data is obtained; the platform supplies the capture mechanism. The Firm remains responsible for FCRA, GLBA, Bankruptcy Code §528, applicable state-bar rules and unauthorized-practice-of-law restrictions, and FTC compliance.</p>
                <p><strong className="text-slate-300">Records of agreements.</strong> Bankruptcy.AI retains a copy of the executed agreement, disclosures, acknowledgments, and identity verification in its admin portal as the Firm's service-agreement record. The Firm may request a copy at any time.</p>
                <p><strong className="text-slate-300">Governing agreement.</strong> These acknowledgments are part of and governed by the Firm's MSA + DPA with Bankruptcy.AI, LLC.</p>
              </div>
              <div className="mt-3">
                <Checkbox checked={consentGeneral} onChange={() => setConsentGeneral(!consentGeneral)}>
                  I acknowledge the Firm Acknowledgments above and confirm I am authorized to bind the Firm to these terms and to the Firm's MSA + DPA with Bankruptcy.AI, LLC.
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
                The platform connects to client financial accounts through <strong className="text-slate-300">Plaid</strong> to retrieve the bank account, transaction, payroll, and income information the Firm needs to prepare schedules and the means test. The Firm is responsible for ensuring each client provides the required authorization before any Plaid connection is initiated; the platform supplies the consent-capture mechanism. Bankruptcy.AI operates the integration as the Firm's technology service provider, relays the information to the Firm, and does not use it for its own purposes. Commercial terms (including any pass-through of Plaid costs) are governed by the Firm's MSA + DPA with Bankruptcy.AI, LLC.
              </p>
              <div className="mt-3">
                <Checkbox checked={consentPlaid} onChange={() => setConsentPlaid(!consentPlaid)}>
                  My firm acknowledges the Plaid integration, our responsibility to obtain client consent before each connection, and that Bankruptcy.AI relays the information to the Firm as its technology service provider per the MSA + DPA.
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

  // ── Step: Demo request ────────────────────────────────────────────────────
  //
  // Lightweight pre-registration capture for firms that want a walk-through
  // before signing up. Validates the same firm-eligibility fields (bar
  // number + state) so the demo conversation starts with verifiable context.
  // SCAFFOLD: the submit handler logs the payload + advances to demo_sent.
  // Persistence (e.g. `demo_requests` table) + outbound notification to the
  // operator inbox land when the sales pipeline wires up.

  if (step === 'demo') {
    function setDemo<K extends keyof typeof demoForm>(field: K, value: string) {
      setDemoForm(f => ({ ...f, [field]: value }));
      setDemoErrors(e => ({ ...e, [field]: '' }));
    }
    function validateDemo(): boolean {
      const e: Partial<typeof demoForm> = {};
      if (!demoForm.firstName.trim()) e.firstName = 'Required';
      if (!demoForm.lastName.trim()) e.lastName = 'Required';
      if (!demoForm.firmName.trim()) e.firmName = 'Required';
      if (!demoForm.email.trim() || !/\S+@\S+\.\S+/.test(demoForm.email)) e.email = 'Valid email required';
      if (!demoForm.phone.trim()) e.phone = 'Required';
      if (!demoForm.barNumber.trim()) e.barNumber = 'Required';
      if (!demoForm.stateBar.trim()) e.stateBar = 'Required';
      setDemoErrors(e);
      return Object.keys(e).length === 0;
    }
    function submitDemo() {
      if (!validateDemo()) return;
      // TODO Phase B — persist into demo_requests + dispatch operator-side
      // notification (SendGrid template id: demo_request). Today we just
      // log + advance.
      // eslint-disable-next-line no-console
      console.log('[demo request] (scaffold) would submit', demoForm);
      setStep('demo_sent');
    }
    const fieldErr = (k: keyof typeof demoForm) => demoErrors[k];

    return (
      <div className="min-h-screen bg-[#060c18] flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-900/10 rounded-full blur-3xl" />
        </div>
        <div className="relative w-full max-w-xl">
          <button onClick={() => setStep('landing')} className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-medium mb-6 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            Back
          </button>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-600/20 border border-amber-500/30 mb-4 shadow-lg shadow-amber-900/20">
              <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Request a free demo</h1>
            <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
              Tell us where to reach you. We&apos;ll book a 30-minute walk-through with a member
              of the bankruptcy.ai team — no obligation to register afterward.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DemoField label="First name *" value={demoForm.firstName} err={fieldErr('firstName')} onChange={v => setDemo('firstName', v)} />
              <DemoField label="Last name *"  value={demoForm.lastName}  err={fieldErr('lastName')}  onChange={v => setDemo('lastName', v)} />
            </div>
            <DemoField label="Firm name *" value={demoForm.firmName} err={fieldErr('firmName')} onChange={v => setDemo('firmName', v)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DemoField label="Email *" type="email" value={demoForm.email} err={fieldErr('email')} onChange={v => setDemo('email', v)} />
              <DemoField label="Phone *" type="tel"   value={demoForm.phone} err={fieldErr('phone')} onChange={v => setDemo('phone', v)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DemoField label="Bar number *" value={demoForm.barNumber} err={fieldErr('barNumber')} onChange={v => setDemo('barNumber', v)} />
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">State of admission *</label>
                <select
                  value={demoForm.stateBar}
                  onChange={e => setDemo('stateBar', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-500/60"
                >
                  <option value="">— Select state —</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {fieldErr('stateBar') && <p className="text-xs text-red-400 mt-1">{fieldErr('stateBar')}</p>}
              </div>
            </div>
            <DemoField label="Preferred time (optional)" value={demoForm.preferredTime} onChange={v => setDemo('preferredTime', v)} placeholder="e.g. weekday mornings PT" />
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Anything we should know? (optional)</label>
              <textarea
                value={demoForm.notes}
                onChange={e => setDemo('notes', e.target.value)}
                rows={3}
                placeholder="Filing volume, current case-management software, integration questions…"
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 resize-y"
              />
            </div>

            <p className="text-[11px] text-amber-200/80 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 leading-relaxed">
              <strong className="text-amber-300">Eligibility:</strong> demos are scheduled with law
              firms in good standing. Bar status is verified before the call.
            </p>

            <button
              onClick={submitDemo}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white rounded-xl py-3.5 font-semibold text-sm transition-all shadow-lg shadow-amber-900/40 flex items-center justify-center gap-2"
            >
              <span>Request demo</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
            </button>
            <p className="text-center text-xs text-slate-500">
              Ready to sign up instead?{" "}
              <button onClick={() => setStep('register')} className="text-amber-400 hover:text-amber-300 font-semibold">
                Start registration
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Demo confirmation ───────────────────────────────────────────────

  if (step === 'demo_sent') {
    return (
      <div className="min-h-screen bg-[#060c18] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Demo request received</h1>
          <p className="text-slate-400 text-sm mt-3 leading-relaxed">
            Thanks{demoForm.firstName ? `, ${demoForm.firstName}` : ''}. We&apos;ll reach out at{" "}
            <strong className="text-white">{demoForm.email || 'the email you provided'}</strong>{" "}
            within one business day to confirm a time.
          </p>
          <div className="mt-8 flex flex-col gap-2">
            <button
              onClick={() => setStep('register')}
              className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl py-3 px-6 font-semibold text-sm transition-colors"
            >
              Or start registration now
            </button>
            <button
              onClick={() => setStep('landing')}
              className="text-sm text-slate-400 hover:text-white py-2"
            >
              Back to overview
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
            Your law firm account is active. All disclosures and acknowledgments have been recorded. Commercial terms are governed by your MSA + DPA with Bankruptcy.AI, LLC.
          </p>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 mb-8 text-left space-y-2">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">What Happens Next</p>
            {[
              { icon: '1', text: 'A Bankruptcy.AI team member will contact you to complete owner-identity verification and finalize the Firm\'s account provisioning.' },
              { icon: '2', text: 'Once the agreement is executed and identity is verified, the Firm portal unlocks and you can invite staff and clients.' },
              { icon: '3', text: 'Commercial terms (including any vendor pass-through) are governed by your MSA + DPA with Bankruptcy.AI, LLC.' },
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

// ─── Landing helpers ────────────────────────────────────────────────────────
//
// Reusable card + form-field components for the landing and demo-request
// surfaces. Kept local to this file — only consumers are the landing flow.

function DemoField({
  label, value, onChange, err, type = "text", placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  err?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-amber-500/60"
      />
      {err && <p className="text-xs text-red-400 mt-1">{err}</p>}
    </div>
  );
}

function FeatureCard({
  icon, title, body, bullets,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  bullets: string[];
}) {
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 hover:border-amber-500/30 transition-colors">
      <div className="w-11 h-11 rounded-xl bg-amber-600/15 border border-amber-500/30 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
      <ul className="mt-4 space-y-1.5">
        {bullets.map(b => (
          <li key={b} className="flex items-start gap-2 text-xs text-slate-300">
            <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7"/>
            </svg>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
