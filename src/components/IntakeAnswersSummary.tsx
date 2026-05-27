import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Scale, User, Home, Car, Building, BookOpen, DollarSign,
  CreditCard, Users, Briefcase, TrendingUp, FileText, ChevronDown,
  ChevronUp, CheckCircle, AlertTriangle, Printer, X, Shield,
  Phone, Mail, MapPin, Calendar, Hash, Percent
} from 'lucide-react';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  /** clientId OR intakeId/draftId — pass whichever is available */
  clientId?: string;
  intakeId?: string;
  clientName?: string;
  /** Called when displayed inside a modal / slide-over */
  onClose?: () => void;
  /** Hide the header bar (when embedded in another layout) */
  hideHeader?: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function n(val: any): number {
  const v = parseFloat(String(val ?? '').replace(/[^0-9.-]/g, ''));
  return isNaN(v) ? 0 : v;
}

function fmt(val: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

function yesNo(val: any) {
  if (val === 'yes' || val === true) return 'Yes';
  if (val === 'no' || val === false) return 'No';
  return val ?? '—';
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

// ─── Layout primitives ─────────────────────────────────────────────────────────

function Section({
  title, icon, children, defaultOpen = true,
}: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-700 rounded-2xl overflow-hidden print:border-slate-300 print:rounded-none print:mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-800/80 hover:bg-slate-800 transition-colors print:bg-slate-100 print:cursor-default"
      >
        <div className="flex items-center gap-2.5 text-white font-bold text-sm print:text-slate-900">
          <span className="text-amber-400 print:text-slate-700">{icon}</span>
          {title}
        </div>
        <span className="text-slate-400 print:hidden">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {open && (
        <div className="px-5 py-4 space-y-1 print:px-4 print:py-3">
          {children}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono, flag }: { label: string; value: string | number; mono?: boolean; flag?: 'warn' | 'ok' }) {
  const valClass = flag === 'warn' ? 'text-amber-400 font-semibold' : flag === 'ok' ? 'text-green-400 font-semibold' : 'text-white';
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-slate-800/60 last:border-0 print:border-slate-200 gap-3">
      <span className="text-slate-400 text-sm shrink-0 max-w-[55%] print:text-slate-600">{label}</span>
      <span className={`text-sm text-right ${mono ? 'font-mono' : ''} ${valClass} print:text-slate-900`}>{value === '' || value === undefined || value === null ? '—' : value}</span>
    </div>
  );
}

function SubHeader({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-4 mb-1.5 first:mt-0 print:text-slate-500">
      {label}
    </p>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 mb-3 last:mb-0 print:border-slate-300 print:bg-white">
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-slate-500 text-sm italic py-1">{label}</p>;
}

function FlagBadge({ text, color }: { text: string; color: 'amber' | 'red' | 'blue' }) {
  const cls = {
    amber: 'bg-amber-400/15 border-amber-400/30 text-amber-400',
    red: 'bg-red-500/15 border-red-500/30 text-red-400',
    blue: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
  }[color];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      <AlertTriangle className="w-2.5 h-2.5" /> {text}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function IntakeAnswersSummary({ clientId, intakeId, clientName, onClose, hideHeader }: Props) {
  const [stepData, setStepData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [refNum, setRefNum] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [clientId, intakeId]);

  async function load() {
    setLoading(true);

    // 1. Try bankruptcy_questionnaire_submissions (from FullBankruptcyQuestionnaire)
    if (clientId) {
      const { data: rows } = await supabase
        .from('bankruptcy_questionnaire_submissions')
        .select('step_key, data, updated_at')
        .eq('client_id', clientId);

      if (rows && rows.length > 0) {
        const merged: Record<string, any> = {};
        for (const r of rows) merged[r.step_key] = r.data;
        setStepData(merged);
        const latest = rows.reduce((a, b) => (a.updated_at > b.updated_at ? a : b));
        setSubmittedAt(latest.updated_at);
        setLoading(false);
        return;
      }

      // 2. Try intake_submissions via client's intake_id
      const { data: clientRow } = await supabase
        .from('clients')
        .select('intake_id')
        .eq('id', clientId)
        .maybeSingle();

      if (clientRow?.intake_id) {
        await loadFromIntakeId(clientRow.intake_id);
        return;
      }
    }

    // 3. Direct intake_id / draft_id lookup
    if (intakeId) {
      await loadFromIntakeId(intakeId);
      return;
    }

    setLoading(false);
  }

  async function loadFromIntakeId(id: string) {
    const { data: sub } = await supabase
      .from('intake_submissions')
      .select('form_data, submitted_at, reference_number')
      .eq('id', id)
      .maybeSingle();

    if (sub?.form_data) {
      setStepData(flatToStepData(sub.form_data));
      setSubmittedAt(sub.submitted_at);
      setRefNum(sub.reference_number);
      setLoading(false);
      return;
    }

    const { data: draft } = await supabase
      .from('intake_drafts')
      .select('form_data, updated_at, reference_number')
      .eq('id', id)
      .maybeSingle();

    if (draft?.form_data) {
      setStepData(flatToStepData(draft.form_data));
      setSubmittedAt(draft.updated_at);
      setRefNum(draft.reference_number);
    }

    setLoading(false);
  }

  // Normalise flat intake_submissions form_data into step-keyed shape
  function flatToStepData(fd: Record<string, any>): Record<string, any> {
    const p = fd.personal || {};
    return {
      personal: {
        first_name: fd.firstName || p.first_name,
        last_name: fd.lastName || p.last_name,
        email: fd.email || p.email,
        phone: fd.phone || p.phone,
        address: fd.address || p.address,
        city: fd.city || p.city,
        state: fd.state || p.state,
        zip: fd.zip || p.zip,
        county: fd.county || p.county,
        marital_status: fd.maritalStatus || p.marital_status,
        spouse_name: fd.spouseName || p.spouse_name,
        household_size: fd.householdSize || p.household_size,
        num_dependents: fd.numDependents || p.num_dependents,
        dependents: fd.dependents || p.dependents,
      },
      real_estate: fd.real_estate || {
        owns_real_estate: fd.ownsRealEstate,
        properties: fd.realPropAddress ? [{
          address: fd.realPropAddress, city: fd.realPropCity, state: fd.realPropState,
          value: fd.realPropValue, mortgage_balance: fd.mortgageBalance, lender: fd.mortgageLender,
          monthly_payment: fd.mortgageMonthlyPayment, is_current: fd.mortgageCurrent,
        }] : [],
      },
      vehicles: fd.vehicles_step || {
        has_vehicles: (fd.vehicles?.length > 0) ? 'yes' : 'no',
        vehicles: fd.vehicles || [],
      },
      bank_accts: fd.bank_accts || {
        has_bank_accounts: (fd.bankAccounts?.length > 0) ? 'yes' : 'no',
        accounts: fd.bankAccounts || [],
      },
      retirement: fd.retirement || {
        has_retirement: (fd.retirementAccounts?.length > 0) ? 'yes' : 'no',
        retirement_accounts: fd.retirementAccounts || [],
        has_ss_income: fd.debtorSsRetirement ? 'yes' : 'no',
        ss_monthly: fd.debtorSsRetirement,
        has_pension: fd.debtorPension ? 'yes' : 'no',
        pension_monthly: fd.debtorPension,
        has_veterans: fd.debtorVeterans ? 'yes' : 'no',
        veterans_monthly: fd.debtorVeterans,
      },
      personal_property: fd.personal_property || {
        has_household_goods: fd.householdGoodsValue ? 'yes' : 'no',
        household_goods_value: fd.householdGoodsValue,
        electronics_value: fd.electronicsValue,
        jewelry_value: fd.jewelryValue,
        tools_value: fd.toolsValue,
        has_life_insurance: fd.lifeCashValue ? 'yes' : 'no',
        life_cash_value: fd.lifeCashValue,
      },
      secured: fd.secured || { secured_creditors: [] },
      unsecured: fd.unsecured || {
        credit_card_total: fd.creditCardDebt,
        medical_total: fd.medicalDebt,
        personal_loan_total: fd.personalLoanDebt,
        student_loan_total: fd.studentLoanDebt,
        tax_debt_total: fd.taxDebt,
        judgment_total: fd.judgmentDebt,
        other_unsecured_total: fd.otherUnsecured,
        creditors: fd.creditors || [],
      },
      support: fd.support || {},
      income: fd.income_step || {
        employment_sources: fd.debtorSources || [],
        rental_income: fd.debtorRental,
        other_income: fd.debtorOtherIncome,
      },
      expenses: fd.expenses || {
        rent_mortgage: fd.expRentMortgage,
        electric_gas: fd.expElectricGas,
        water_sewer: fd.expWaterSewer,
        phone: fd.expPhone,
        internet: fd.expInternet,
        food: fd.expFood,
        clothing: fd.expClothing,
        personal_care: fd.expPersonalCare,
        transportation: fd.expTransportation,
        car_insurance: fd.expCarInsurance,
        health_insurance: fd.expHealthInsurance,
        medical: fd.expMedical,
        childcare: fd.expChildcare,
        other: fd.expOther,
      },
      history: fd.history || {
        filed_before: fd.priorBankruptcy,
        has_lawsuits: fd.hasLawsuits,
        has_garnishments: fd.hasGarnishments,
        foreclosure_pending: fd.foreclosurePending,
        has_recent_transfers: fd.hasRecentTransfers,
        owned_business: fd.ownedBusiness,
        expected_refund: fd.expectedRefund,
        refund_amount: fd.refundAmount,
      },
    };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  const p = stepData.personal || {};
  const re = stepData.real_estate || {};
  const veh = stepData.vehicles || {};
  const bank = stepData.bank_accts || {};
  const ret = stepData.retirement || {};
  const pp = stepData.personal_property || {};
  const sec = stepData.secured || {};
  const unsec = stepData.unsecured || {};
  const sup = stepData.support || {};
  const inc = stepData.income || {};
  const exp = stepData.expenses || {};
  const hist = stepData.history || {};

  const totalIncome = (inc.employment_sources || []).reduce((s: number, src: any) => s + n(src.gross_monthly), 0)
    + n(inc.rental_income) + n(inc.other_income)
    + (ret.has_ss_income === 'yes' ? n(ret.ss_monthly) : 0)
    + (ret.has_pension === 'yes' ? n(ret.pension_monthly) : 0)
    + (ret.has_veterans === 'yes' ? n(ret.veterans_monthly) : 0);

  const totalExpenses = [
    exp.rent_mortgage, exp.electric_gas, exp.water_sewer, exp.phone, exp.internet,
    exp.food, exp.clothing, exp.personal_care, exp.transportation,
    exp.car_insurance, exp.health_insurance, exp.medical, exp.childcare, exp.other,
  ].reduce((s, v) => s + n(v), 0);

  const totalUnsecured = n(unsec.credit_card_total) + n(unsec.medical_total) + n(unsec.personal_loan_total)
    + n(unsec.student_loan_total) + n(unsec.tax_debt_total) + n(unsec.judgment_total) + n(unsec.other_unsecured_total);

  const totalSecured = (sec.secured_creditors || []).reduce((s: number, c: any) => s + n(c.current_balance), 0);

  const maritalLabels: Record<string, string> = {
    single: 'Single', married: 'Married', separated: 'Separated',
    divorced: 'Divorced', widowed: 'Widowed',
  };

  return (
    <div className="bg-slate-950 min-h-full print:bg-white">
      {/* Header */}
      {!hideHeader && (
        <div className="sticky top-0 z-30 bg-slate-900/95 border-b border-slate-800 backdrop-blur-sm print:hidden">
          <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-400/15 rounded-xl flex items-center justify-center">
                <Scale className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">
                  Intake Summary{clientName ? ` — ${clientName}` : ''}
                </p>
                {(submittedAt || refNum) && (
                  <p className="text-slate-500 text-xs">
                    {refNum && <span className="mr-2">Ref: {refNum}</span>}
                    {submittedAt && <span>Submitted {fmtDate(submittedAt)}</span>}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-xl transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print header (only visible when printing) */}
      <div className="hidden print:block px-6 py-4 border-b border-slate-300 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-bold text-slate-900">Bradford Law LLC — Bankruptcy Intake Summary</p>
            {clientName && <p className="text-slate-600 text-sm mt-0.5">Client: {clientName}</p>}
          </div>
          <div className="text-right text-xs text-slate-500">
            {refNum && <p>Ref: {refNum}</p>}
            {submittedAt && <p>Submitted: {fmtDate(submittedAt)}</p>}
            <p>Printed: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* Alert flags */}
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-2 print:px-6 print:pt-2">
        {(() => {
          const flags: { text: string; color: 'amber' | 'red' | 'blue' }[] = [];
          if (hist.filed_before === 'yes' || hist.filed_before === true) flags.push({ text: 'Prior Bankruptcy', color: 'amber' });
          if (hist.has_lawsuits === 'yes' || hist.has_lawsuits === true) flags.push({ text: 'Active Lawsuit', color: 'amber' });
          if (hist.has_garnishments === 'yes' || hist.has_garnishments === true) flags.push({ text: 'Wage Garnishment', color: 'red' });
          if (hist.foreclosure_pending === 'yes' || hist.foreclosure_pending === true) flags.push({ text: 'Foreclosure Pending', color: 'red' });
          if (hist.has_recent_transfers === 'yes' || hist.has_recent_transfers === true) flags.push({ text: 'Recent Property Transfer', color: 'amber' });
          if (hist.owned_business === 'yes' || hist.owned_business === true) flags.push({ text: 'Business Owner', color: 'blue' });
          if (sup.pi_has_claim === 'yes' || sup.pi_has_claim === true) flags.push({ text: 'PI Claim', color: 'blue' });
          if (n(unsec.student_loan_total) > 0) flags.push({ text: 'Student Loans', color: 'blue' });
          if (n(unsec.tax_debt_total) > 0) flags.push({ text: 'Tax Debt', color: 'amber' });
          if (flags.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-2 mb-5">
              {flags.map((f, i) => <FlagBadge key={i} text={f.text} color={f.color} />)}
            </div>
          );
        })()}

        {/* Quick totals bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 print:grid-cols-4">
          {[
            { label: 'Monthly Income', value: fmt(totalIncome), color: 'text-green-400' },
            { label: 'Monthly Expenses', value: fmt(totalExpenses), color: 'text-amber-400' },
            { label: 'Total Unsecured Debt', value: fmt(totalUnsecured), color: 'text-red-400' },
            { label: 'Total Secured Debt', value: fmt(totalSecured), color: 'text-white' },
          ].map(item => (
            <div key={item.label} className="bg-slate-900 border border-slate-700 rounded-2xl p-4 print:border-slate-300 print:bg-white">
              <p className="text-slate-500 text-xs mb-1">{item.label}</p>
              <p className={`text-xl font-bold ${item.color} print:text-slate-900`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-4xl mx-auto px-4 pb-16 space-y-4 print:px-6 print:pb-0 print:space-y-3">

        {/* 1. Personal */}
        <Section title="Personal Information" icon={<User className="w-4 h-4" />}>
          <Row label="Full Name" value={[p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ') || '—'} />
          <Row label="Email" value={p.email || '—'} />
          <Row label="Phone" value={p.phone || '—'} />
          <Row label="Address" value={[p.address, p.city, p.state, p.zip].filter(Boolean).join(', ') || '—'} />
          {p.county && <Row label="County" value={p.county} />}
          {(p.mailing_same === false || p.mailing_same === 'no') && p.mailing_address && (
            <Row label="Mailing Address" value={[p.mailing_address, p.mailing_city, p.mailing_state, p.mailing_zip].filter(Boolean).join(', ')} />
          )}
          <Row label="Marital Status" value={maritalLabels[p.marital_status] || p.marital_status || '—'} />
          {p.spouse_name && <Row label="Spouse Name" value={p.spouse_name} />}
          <Row label="Household Size" value={p.household_size || '—'} />
          <Row label="Number of Dependents" value={p.num_dependents || '0'} />
          {(p.dependents || []).length > 0 && (
            <>
              <SubHeader label="Dependents" />
              {(p.dependents || []).map((dep: any, i: number) => (
                <Card key={i}>
                  <Row label="Relationship" value={dep.relationship || '—'} />
                  <Row label="Age" value={dep.age || '—'} />
                  {dep.care_cost && n(dep.care_cost) > 0 && <Row label="Monthly Care Cost" value={fmt(n(dep.care_cost))} />}
                </Card>
              ))}
            </>
          )}
        </Section>

        {/* 2. Real Estate */}
        <Section title="Real Estate" icon={<Home className="w-4 h-4" />}>
          <Row label="Owns Real Estate" value={yesNo(re.owns_real_estate)} />
          {(re.properties || []).length > 0 && (re.properties || []).map((prop: any, i: number) => (
            <Card key={i}>
              <SubHeader label={`Property ${i + 1}`} />
              <Row label="Address" value={[prop.address, prop.city, prop.state, prop.zip].filter(Boolean).join(', ') || '—'} />
              {prop.description && <Row label="Description" value={prop.description} />}
              <Row label="Estimated Value" value={prop.value ? fmt(n(prop.value)) : '—'} />
              <Row label="Mortgage Balance" value={prop.mortgage_balance ? fmt(n(prop.mortgage_balance)) : '—'} />
              {prop.lender && <Row label="Lender" value={prop.lender} />}
              <Row label="Monthly Payment" value={prop.monthly_payment ? fmt(n(prop.monthly_payment)) : '—'} />
              <Row label="Account Current" value={yesNo(prop.is_current)} flag={prop.is_current === 'no' ? 'warn' : undefined} />
              {prop.is_current === 'no' && prop.arrears && <Row label="Arrears" value={fmt(n(prop.arrears))} flag="warn" />}
              <Row label="Intent" value={prop.intent === 'keep' ? 'Keep' : prop.intent === 'sell' ? 'Sell / Surrender' : prop.intent || '—'} />
            </Card>
          ))}
          {re.owns_real_estate === 'no' && <Empty label="No real estate reported." />}
        </Section>

        {/* 3. Vehicles */}
        <Section title="Vehicles" icon={<Car className="w-4 h-4" />}>
          <Row label="Has Vehicles" value={yesNo(veh.has_vehicles)} />
          {(veh.vehicles || []).length > 0 && (veh.vehicles || []).map((v: any, i: number) => (
            <Card key={i}>
              <SubHeader label={`Vehicle ${i + 1}`} />
              <Row label="Vehicle" value={[v.year, v.make, v.model].filter(Boolean).join(' ') || '—'} />
              <Row label="Mileage" value={v.mileage ? `${n(v.mileage).toLocaleString()} mi` : '—'} />
              <Row label="Estimated Value" value={v.value ? fmt(n(v.value)) : '—'} />
              <Row label="Has Auto Loan" value={yesNo(v.has_loan)} />
              {(v.has_loan === 'yes' || v.has_loan === true) && (
                <>
                  {v.lender && <Row label="Lender" value={v.lender} />}
                  <Row label="Loan Balance" value={v.loan_balance ? fmt(n(v.loan_balance)) : '—'} />
                  <Row label="Monthly Payment" value={v.monthly_payment ? fmt(n(v.monthly_payment)) : '—'} />
                  <Row label="Account Current" value={yesNo(v.is_current)} flag={v.is_current === 'no' ? 'warn' : undefined} />
                  {v.is_current === 'no' && v.arrears && <Row label="Arrears" value={fmt(n(v.arrears))} flag="warn" />}
                </>
              )}
            </Card>
          ))}
          {veh.has_vehicles === 'no' && <Empty label="No vehicles reported." />}
        </Section>

        {/* 4. Bank Accounts */}
        <Section title="Bank & Financial Accounts" icon={<Building className="w-4 h-4" />}>
          <Row label="Has Bank Accounts" value={yesNo(bank.has_bank_accounts)} />
          {(bank.accounts || []).map((a: any, i: number) => (
            <Card key={i}>
              <Row label="Institution" value={a.institution || '—'} />
              <Row label="Account Type" value={a.account_type ? a.account_type.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : '—'} />
              <Row label="Balance" value={a.balance ? fmt(n(a.balance)) : '—'} />
              {a.last4 && <Row label="Last 4 Digits" value={`x${a.last4}`} mono />}
            </Card>
          ))}
          {bank.has_other_financial === 'yes' && (bank.other_financial || []).map((a: any, i: number) => (
            <Card key={`other-${i}`}>
              <SubHeader label={`Other Financial Account ${i + 1}`} />
              <Row label="Institution" value={a.institution || '—'} />
              <Row label="Type" value={a.account_type || '—'} />
              <Row label="Balance" value={a.balance ? fmt(n(a.balance)) : '—'} />
            </Card>
          ))}
          {bank.has_closed_accounts === 'yes' && (bank.closed_accounts || []).length > 0 && (
            <>
              <SubHeader label="Closed Accounts (Last 12 Months)" />
              {(bank.closed_accounts || []).map((a: any, i: number) => (
                <Card key={`closed-${i}`}>
                  <Row label="Institution" value={a.institution || '—'} />
                  <Row label="Type" value={a.account_type || '—'} />
                  <Row label="Closed Date" value={a.closed_date || '—'} />
                  <Row label="Balance at Closing" value={a.balance_at_closing ? fmt(n(a.balance_at_closing)) : '—'} />
                </Card>
              ))}
            </>
          )}
          {bank.has_bank_accounts === 'no' && <Empty label="No bank accounts reported." />}
        </Section>

        {/* 5. Retirement & Benefits */}
        <Section title="Retirement & Benefits" icon={<BookOpen className="w-4 h-4" />}>
          <Row label="Has Retirement Accounts" value={yesNo(ret.has_retirement)} />
          {(ret.retirement_accounts || []).map((r: any, i: number) => (
            <Card key={i}>
              <Row label="Institution" value={r.institution || '—'} />
              <Row label="Account Type" value={r.account_type ? r.account_type.replace('_', ' ').toUpperCase() : '—'} />
              <Row label="Balance" value={r.balance ? fmt(n(r.balance)) : '—'} />
              {r.owner_name && <Row label="Owner" value={r.owner_name} />}
            </Card>
          ))}
          <Row label="Social Security / Disability Income" value={ret.has_ss_income === 'yes' ? `Yes — ${fmt(n(ret.ss_monthly))}/mo` : 'No'} />
          <Row label="Pension Income" value={ret.has_pension === 'yes' ? `Yes — ${fmt(n(ret.pension_monthly))}/mo` : 'No'} />
          <Row label="Veterans Benefits" value={ret.has_veterans === 'yes' ? `Yes — ${fmt(n(ret.veterans_monthly))}/mo` : 'No'} />
        </Section>

        {/* 6. Personal Property */}
        <Section title="Personal Property" icon={<Scale className="w-4 h-4" />}>
          <Row label="Household Goods & Furnishings" value={pp.has_household_goods === 'yes' ? fmt(n(pp.household_goods_value)) : 'None'} />
          <Row label="Electronics" value={n(pp.electronics_value) > 0 ? fmt(n(pp.electronics_value)) : 'None'} />
          <Row label="Jewelry" value={n(pp.jewelry_value) > 0 ? fmt(n(pp.jewelry_value)) : 'None'} />
          <Row label="Tools / Equipment" value={n(pp.tools_value) > 0 ? fmt(n(pp.tools_value)) : 'None'} />
          {pp.has_life_insurance === 'yes' && (
            <>
              <SubHeader label="Life Insurance" />
              <Row label="Policy Type" value={pp.life_policy_type || '—'} />
              <Row label="Face Value" value={pp.life_face_value ? fmt(n(pp.life_face_value)) : '—'} />
              <Row label="Cash Value" value={pp.life_cash_value ? fmt(n(pp.life_cash_value)) : '—'} />
              {pp.life_insurer && <Row label="Insurer" value={pp.life_insurer} />}
            </>
          )}
          {pp.has_stocks === 'yes' && <Row label="Stocks / Investments" value={pp.stocks_value ? fmt(n(pp.stocks_value)) : '—'} flag="warn" />}
          {pp.has_crypto === 'yes' && <Row label="Cryptocurrency" value={pp.crypto_value ? fmt(n(pp.crypto_value)) : '—'} flag="warn" />}
          {pp.has_firearms === 'yes' && (pp.firearms || []).length > 0 && (
            <>
              <SubHeader label="Firearms" />
              {(pp.firearms || []).map((f: any, i: number) => (
                <Card key={i}>
                  <Row label="Description" value={f.description || '—'} />
                  <Row label="Value" value={f.value ? fmt(n(f.value)) : '—'} />
                </Card>
              ))}
            </>
          )}
          {pp.has_collectibles === 'yes' && <Row label="Collectibles / Art" value={pp.collectibles_value ? fmt(n(pp.collectibles_value)) : '—'} />}
          {pp.has_other_prop === 'yes' && <Row label="Other Property" value={pp.other_prop_value ? `${fmt(n(pp.other_prop_value))} — ${pp.other_prop_desc || ''}` : '—'} />}
        </Section>

        {/* 7. Secured Creditors */}
        <Section title="Secured Creditors" icon={<CreditCard className="w-4 h-4" />}>
          {(sec.secured_creditors || []).length > 0 ? (
            (sec.secured_creditors || []).map((c: any, i: number) => (
              <Card key={i}>
                <Row label="Creditor" value={c.creditor_name || '—'} />
                <Row label="Collateral" value={c.collateral || c.collateral_type || '—'} />
                <Row label="Balance" value={c.current_balance ? fmt(n(c.current_balance)) : '—'} />
                <Row label="Monthly Payment" value={c.monthly_payment ? fmt(n(c.monthly_payment)) : '—'} />
                <Row label="Account Current" value={yesNo(c.is_current)} flag={c.is_current === 'no' ? 'warn' : undefined} />
                {c.is_current === 'no' && c.arrears && <Row label="Arrears" value={fmt(n(c.arrears))} flag="warn" />}
              </Card>
            ))
          ) : (
            <Empty label="No secured creditors reported." />
          )}
          {totalSecured > 0 && (
            <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-700">
              <span className="text-sm text-slate-400 font-semibold">Total Secured Debt</span>
              <span className="text-white font-bold">{fmt(totalSecured)}</span>
            </div>
          )}
        </Section>

        {/* 8. Unsecured Debts */}
        <Section title="Unsecured Debts" icon={<DollarSign className="w-4 h-4" />}>
          {[
            { label: 'Credit Cards', key: 'credit_card_total' },
            { label: 'Medical Bills', key: 'medical_total' },
            { label: 'Personal Loans', key: 'personal_loan_total' },
            { label: 'Student Loans', key: 'student_loan_total' },
            { label: 'Tax Debt', key: 'tax_debt_total' },
            { label: 'Judgments', key: 'judgment_total' },
            { label: 'Other Unsecured', key: 'other_unsecured_total' },
          ].filter(item => n(unsec[item.key]) > 0).map(item => (
            <Row key={item.key} label={item.label} value={fmt(n(unsec[item.key]))}
              flag={item.key === 'student_loan_total' || item.key === 'tax_debt_total' ? 'warn' : undefined} />
          ))}
          {unsec.has_business_debt === 'yes' && <Row label="Business Debt" value="Yes" flag="warn" />}
          {(unsec.creditors || []).length > 0 && (
            <>
              <SubHeader label="Individual Creditors" />
              {(unsec.creditors || []).map((c: any, i: number) => (
                <Card key={i}>
                  <Row label="Creditor" value={c.creditor_name || '—'} />
                  <Row label="Type" value={c.debt_type ? c.debt_type.replace('_', ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase()) : '—'} />
                  <Row label="Balance" value={c.balance ? fmt(n(c.balance)) : '—'} />
                  {c.account_last4 && <Row label="Account" value={`x${c.account_last4}`} mono />}
                </Card>
              ))}
            </>
          )}
          <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-700">
            <span className="text-sm text-slate-400 font-semibold">Total Unsecured Debt</span>
            <span className="text-red-400 font-bold text-base">{fmt(totalUnsecured)}</span>
          </div>
        </Section>

        {/* 9. Support & Claims */}
        <Section title="Support & Legal Claims" icon={<Users className="w-4 h-4" />} defaultOpen={
          sup.child_support_current === 'yes' || sup.alimony_current === 'yes' || sup.pi_has_claim === 'yes'
        }>
          <Row label="Child Support (Current)" value={yesNo(sup.child_support_current)} />
          {sup.child_support_current === 'yes' && (
            <>
              <Row label="Child Support Arrears" value={yesNo(sup.child_support_arrears)} flag={sup.child_support_arrears === 'yes' ? 'warn' : undefined} />
              {sup.child_support_arrears === 'yes' && <Row label="Arrears Amount" value={sup.child_support_arrears_amount ? fmt(n(sup.child_support_arrears_amount)) : '—'} flag="warn" />}
            </>
          )}
          <Row label="Alimony / Spousal Support" value={yesNo(sup.alimony_current)} />
          {sup.alimony_current === 'yes' && (
            <>
              <Row label="Alimony Arrears" value={yesNo(sup.alimony_arrears)} flag={sup.alimony_arrears === 'yes' ? 'warn' : undefined} />
              {sup.alimony_arrears === 'yes' && <Row label="Arrears Amount" value={sup.alimony_arrears_amount ? fmt(n(sup.alimony_arrears_amount)) : '—'} flag="warn" />}
            </>
          )}
          <Row label="Personal Injury Claim" value={yesNo(sup.pi_has_claim)} />
          {(sup.pi_has_claim === 'yes' || sup.pi_has_claim === true) && (
            <Card>
              <Row label="Date of Loss" value={sup.pi_date_of_loss || '—'} />
              {sup.pi_description && <Row label="Description" value={sup.pi_description} />}
              <Row label="Injured" value={yesNo(sup.pi_injured)} />
              {sup.pi_injured && sup.pi_injury_desc && <Row label="Injury Description" value={sup.pi_injury_desc} />}
              <Row label="Has PI Attorney" value={yesNo(sup.pi_has_attorney)} />
              {sup.pi_attorney_name && <Row label="PI Attorney Name" value={sup.pi_attorney_name} />}
            </Card>
          )}
        </Section>

        {/* 10. Income */}
        <Section title="Income" icon={<Briefcase className="w-4 h-4" />}>
          {(inc.employment_sources || []).length > 0 ? (
            (inc.employment_sources || []).map((src: any, i: number) => (
              <Card key={i}>
                <SubHeader label={`Income Source ${i + 1}`} />
                <Row label="Employer / Business" value={src.employer || src.businessName || '—'} />
                <Row label="Type" value={src.type === 'selfEmployment' ? 'Self-Employment' : src.type === 'employment' ? 'W-2 Employment' : src.type || '—'} />
                <Row label="Gross Monthly" value={src.gross_monthly ? fmt(n(src.gross_monthly)) : src.grossPerPeriod ? fmt(n(src.grossPerPeriod)) : '—'} />
                <Row label="Net Monthly (Take-Home)" value={src.net_monthly ? fmt(n(src.net_monthly)) : src.netPerPeriod ? fmt(n(src.netPerPeriod)) : '—'} />
              </Card>
            ))
          ) : (
            <Empty label="No employment sources entered." />
          )}
          {n(inc.rental_income) > 0 && <Row label="Rental Income" value={fmt(n(inc.rental_income))} />}
          {n(inc.other_income) > 0 && <Row label="Other Income" value={fmt(n(inc.other_income))} />}
          {ret.has_ss_income === 'yes' && <Row label="Social Security / Disability" value={fmt(n(ret.ss_monthly))} />}
          {ret.has_pension === 'yes' && <Row label="Pension" value={fmt(n(ret.pension_monthly))} />}
          {ret.has_veterans === 'yes' && <Row label="Veterans Benefits" value={fmt(n(ret.veterans_monthly))} />}
          <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-700">
            <span className="text-sm text-slate-400 font-semibold">Total Monthly Income</span>
            <span className="text-green-400 font-bold text-base">{fmt(totalIncome)}</span>
          </div>
        </Section>

        {/* 11. Monthly Expenses */}
        <Section title="Monthly Expenses" icon={<TrendingUp className="w-4 h-4" />}>
          {[
            { label: 'Rent / Mortgage', key: 'rent_mortgage' },
            { label: 'Electric / Gas', key: 'electric_gas' },
            { label: 'Water / Sewer', key: 'water_sewer' },
            { label: 'Phone', key: 'phone' },
            { label: 'Internet', key: 'internet' },
            { label: 'Food / Groceries', key: 'food' },
            { label: 'Clothing', key: 'clothing' },
            { label: 'Personal Care', key: 'personal_care' },
            { label: 'Transportation / Gas', key: 'transportation' },
            { label: 'Car Insurance', key: 'car_insurance' },
            { label: 'Health Insurance', key: 'health_insurance' },
            { label: 'Medical / Dental', key: 'medical' },
            { label: 'Childcare', key: 'childcare' },
            { label: 'Other', key: 'other' },
          ].filter(item => n(exp[item.key]) > 0).map(item => (
            <Row key={item.key} label={item.label} value={fmt(n(exp[item.key]))} />
          ))}
          <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-700">
            <span className="text-sm text-slate-400 font-semibold">Total Monthly Expenses</span>
            <span className="text-amber-400 font-bold text-base">{fmt(totalExpenses)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-slate-400 font-semibold">Monthly Surplus / Deficit</span>
            <span className={`font-bold text-base ${totalIncome - totalExpenses >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmt(totalIncome - totalExpenses)}
            </span>
          </div>
        </Section>

        {/* 12. Financial History */}
        <Section title="Financial History" icon={<FileText className="w-4 h-4" />}>
          <Row label="Filed Bankruptcy Before" value={yesNo(hist.filed_before)} flag={hist.filed_before === 'yes' ? 'warn' : undefined} />
          {hist.filed_before === 'yes' && hist.prior_bankruptcy_details && (
            <Row label="Prior Filing Details" value={hist.prior_bankruptcy_details} />
          )}
          <Row label="Active / Pending Lawsuits" value={yesNo(hist.has_lawsuits)} flag={hist.has_lawsuits === 'yes' ? 'warn' : undefined} />
          {hist.has_lawsuits === 'yes' && hist.lawsuit_details && <Row label="Lawsuit Details" value={hist.lawsuit_details} />}
          <Row label="Wage Garnishment" value={yesNo(hist.has_garnishments)} flag={hist.has_garnishments === 'yes' ? 'warn' : undefined} />
          {hist.has_garnishments === 'yes' && hist.garnishment_details && <Row label="Garnishment Details" value={hist.garnishment_details} />}
          <Row label="Foreclosure Pending" value={yesNo(hist.foreclosure_pending)} flag={hist.foreclosure_pending === 'yes' ? 'warn' : undefined} />
          {hist.foreclosure_pending === 'yes' && hist.foreclosure_date && <Row label="Foreclosure Date" value={hist.foreclosure_date} flag="warn" />}
          <Row label="Recent Property Transfers" value={yesNo(hist.has_recent_transfers)} flag={hist.has_recent_transfers === 'yes' ? 'warn' : undefined} />
          {hist.has_recent_transfers === 'yes' && hist.transfer_details && <Row label="Transfer Details" value={hist.transfer_details} />}
          <Row label="Owned / Operated a Business" value={yesNo(hist.owned_business)} flag={hist.owned_business === 'yes' ? 'warn' : undefined} />
          {hist.owned_business === 'yes' && hist.business_details && <Row label="Business Details" value={hist.business_details} />}
          <Row label="Expecting Tax Refund" value={yesNo(hist.expected_refund)} />
          {(hist.expected_refund === 'yes' || hist.expected_refund === true) && hist.refund_amount && (
            <Row label="Estimated Refund Amount" value={fmt(n(hist.refund_amount))} />
          )}
          {hist.preferential_payments === 'yes' && (
            <>
              <Row label="Preferential Payments (90 days)" value="Yes" flag="warn" />
              {hist.preferential_payments_details && <Row label="Details" value={hist.preferential_payments_details} />}
            </>
          )}
          {hist.recent_luxury === 'yes' && (
            <>
              <Row label="Recent Luxury Purchases / Cash Advances" value="Yes" flag="warn" />
              {hist.luxury_details && <Row label="Details" value={hist.luxury_details} />}
            </>
          )}
        </Section>

        {/* Signature block (print only) */}
        <div className="hidden print:block mt-8 pt-6 border-t border-slate-300">
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            I declare under penalty of perjury that the information provided in this intake questionnaire is true and correct to the best of my knowledge.
          </p>
          <div className="grid grid-cols-2 gap-12">
            <div>
              <div className="border-b border-slate-400 mb-1 h-10" />
              <p className="text-xs text-slate-500">Client Signature</p>
            </div>
            <div>
              <div className="border-b border-slate-400 mb-1 h-10" />
              <p className="text-xs text-slate-500">Date</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-6 text-center">Bradford Law LLC — Confidential Client Document</p>
        </div>

      </div>
    </div>
  );
}
