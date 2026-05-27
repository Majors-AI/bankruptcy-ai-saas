import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Scale, ChevronRight, ChevronLeft, CheckCircle, Circle,
  Info, Plus, Trash2, FileText, Home, Car, DollarSign,
  Briefcase, TrendingUp, User, ShieldCheck, RefreshCw,
  AlertTriangle, Building, CreditCard, BookOpen, Users,
  MessageCircle, LayoutDashboard
} from 'lucide-react';
import IntakeAnswersSummary from '../IntakeAnswersSummary';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
  clientName: string;
  onComplete: () => void;
  onBack: () => void;
  onChatHelp?: () => void;
}

type StepData = Record<string, any>;

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'disclosure',        label: 'Before You Begin',          icon: ShieldCheck,  short: 'Start'    },
  { key: 'personal',          label: 'Personal Information',      icon: User,         short: 'Step 1'   },
  { key: 'real_estate',       label: 'Real Estate',               icon: Home,         short: 'Step 2'   },
  { key: 'vehicles',          label: 'Vehicles',                  icon: Car,          short: 'Step 3'   },
  { key: 'bank_accts',        label: 'Bank & Financial Accts',    icon: Building,     short: 'Step 4'   },
  { key: 'retirement',        label: 'Retirement & Benefits',     icon: BookOpen,     short: 'Step 5'   },
  { key: 'personal_property', label: 'Personal Property',         icon: Scale,        short: 'Step 6'   },
  { key: 'secured',           label: 'Secured Creditors',         icon: CreditCard,   short: 'Step 7'   },
  { key: 'unsecured',         label: 'Unsecured Debts',           icon: DollarSign,   short: 'Step 8'   },
  { key: 'support',           label: 'Support & Claims',          icon: Users,        short: 'Step 9'   },
  { key: 'income',            label: 'Income',                    icon: Briefcase,    short: 'Step 10'  },
  { key: 'expenses',          label: 'Monthly Expenses',          icon: TrendingUp,   short: 'Step 11'  },
  { key: 'history',           label: 'Financial History',         icon: FileText,     short: 'Step 12'  },
  { key: 'documents',         label: 'Document Checklist',        icon: FileText,     short: 'Step 13'  },
  { key: 'review',            label: 'Review & Submit',           icon: CheckCircle,  short: 'Review'   },
];

// ── UI primitives ─────────────────────────────────────────────────────────────

function Field({ label, required, children, hint, prefilled, sub }: {
  label: string; required?: boolean; children: React.ReactNode;
  hint?: string; prefilled?: boolean; sub?: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <label className={`block font-semibold text-slate-300 ${sub ? 'text-xs' : 'text-sm'}`}>
          {label}{required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {prefilled && (
          <span className="flex items-center gap-1 text-xs text-amber-400/80 bg-amber-400/10 px-2 py-0.5 rounded-full">
            <Info className="w-3 h-3" /> From intake
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-slate-500 mb-1.5 leading-relaxed">{hint}</p>}
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', prefilled, disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; prefilled?: boolean; disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full bg-slate-800 border rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400/60 placeholder-slate-500 transition-colors disabled:opacity-50 ${
        prefilled ? 'border-amber-400/40 bg-amber-400/5' : 'border-slate-600'
      }`}
    />
  );
}

function SelectInput({ value, onChange, options, placeholder, prefilled }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string; prefilled?: boolean;
}) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      className={`w-full bg-slate-800 border rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400/60 transition-colors ${
        prefilled ? 'border-amber-400/40 bg-amber-400/5' : 'border-slate-600'
      }`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function YesNo({ value, onChange, noLabel = 'No' }: { value: string; onChange: (v: string) => void; noLabel?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {[{ v: 'yes', l: 'Yes' }, { v: 'no', l: noLabel }].map(opt => (
          <button key={opt.v} type="button" onClick={() => onChange(opt.v)}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-all ${
              value === opt.v
                ? opt.v === 'no'
                  ? 'bg-slate-700 border-slate-500 text-slate-200'
                  : 'bg-amber-400/15 border-amber-400/50 text-amber-400'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white'
            }`}
          >{opt.l}</button>
        ))}
      </div>
      {value === 'no' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border border-slate-600 rounded-lg">
          <CheckCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-400">Confirmed: <strong className="text-slate-300">{noLabel}</strong> — your answer has been recorded.</span>
        </div>
      )}
    </div>
  );
}

function YesNoUnknown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }, { v: 'unknown', l: 'Unknown' }].map(opt => (
          <button key={opt.v} type="button" onClick={() => onChange(opt.v)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
              value === opt.v
                ? opt.v === 'yes'
                  ? 'bg-amber-400/15 border-amber-400/50 text-amber-400'
                  : 'bg-slate-700 border-slate-500 text-slate-200'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white'
            }`}
          >{opt.l}</button>
        ))}
      </div>
      {(value === 'no' || value === 'unknown') && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border border-slate-600 rounded-lg">
          <CheckCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-400">Confirmed: <strong className="text-slate-300">{value === 'unknown' ? 'Unknown / Unsure' : 'No'}</strong> — your answer has been recorded.</span>
        </div>
      )}
    </div>
  );
}

function AmountInput({ value, onChange, prefilled, placeholder = '0.00' }: {
  value: string; onChange: (v: string) => void; prefilled?: boolean; placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
      <input type="number" min="0" step="0.01" value={value || ''}
        onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full bg-slate-800 border rounded-xl pl-8 pr-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400/60 placeholder-slate-500 transition-colors ${
          prefilled ? 'border-amber-400/40 bg-amber-400/5' : 'border-slate-600'
        }`}
      />
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mt-7 mb-4 pb-2 border-b border-slate-700">
      <h3 className="text-amber-400 font-bold text-sm uppercase tracking-wider">{title}</h3>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">{children}</div>;
}

function IntakeBadge() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 mb-5">
      <Info className="w-3.5 h-3.5 flex-shrink-0" />
      <span>Fields highlighted in amber were pre-filled from your intake. Please review and update anything that has changed.</span>
    </div>
  );
}

function ConfirmBanner({ text }: { text: string }) {
  return (
    <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 mb-5 flex items-start gap-2">
      <RefreshCw className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
      <p className="text-blue-300/90 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function DocNote({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="bg-amber-400/8 border border-amber-400/20 rounded-xl p-4 mt-4">
      <p className="text-amber-400 font-bold text-xs uppercase tracking-wider mb-2">Documents You Will Need to Provide</p>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
            <FileText className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section Confirm Modal ─────────────────────────────────────────────────────

function SectionConfirmModal({ question, summary, onConfirm, onAddMore, onEdit, addMoreLabel = 'Add Another', confirmLabel }: {
  question: string;
  summary: React.ReactNode;
  onConfirm: () => void;
  onAddMore?: () => void;
  onEdit: () => void;
  addMoreLabel?: string;
  confirmLabel?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-700">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-amber-400/15 border border-amber-400/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-white font-bold text-base">Please Confirm</h3>
          </div>
          <p className="text-amber-300/90 text-sm font-semibold mt-3">{question}</p>
        </div>
        <div className="px-6 py-4 max-h-64 overflow-y-auto">
          {summary}
        </div>
        <div className="px-6 py-4 border-t border-slate-700 flex flex-col gap-2">
          <button onClick={onConfirm}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {confirmLabel || 'Yes — this is complete and correct'}
          </button>
          {onAddMore && (
            <button onClick={onAddMore}
              className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              {addMoreLabel}
            </button>
          )}
          <button onClick={onEdit}
            className="w-full py-2.5 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white rounded-xl font-semibold text-sm transition-all">
            Go Back & Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pre-fill builder ──────────────────────────────────────────────────────────

function buildPreFill(fd: Record<string, any>): Record<string, StepData> {
  // Derive residential address: prefer direct address fields; fall back to the primary real property address
  const residentialAddress = fd.address || fd.streetAddress || fd.realPropAddress || '';
  const residentialCity    = fd.city    || fd.realPropCity  || '';
  const residentialState   = fd.state   || fd.realPropState || '';
  const residentialZip     = fd.zip     || fd.zipCode       || fd.realPropZip || '';

  // Derive household size and dependents from intake
  const intakeDepCount = parseInt(fd.numDependents || '0') || 0;
  const intakeDeps: any[] = Array.isArray(fd.dependents) ? fd.dependents : [];
  // Build dependents array — map intake shape {age, relationship, ...} to questionnaire shape {age, relationship, special_needs, care_cost}
  // Relationships are identical between intake and questionnaire so pass through directly
  const mappedDependents = intakeDeps.slice(0, intakeDepCount).map((d: any) => {
    const ageStr = String(d.age || '').replace(/under\s*1/i, '0').replace(/[^\d].*/, '').trim();
    return {
      age: ageStr,
      relationship: d.relationship || '',
      special_needs: d.special_needs || '',
      care_cost: d.care_cost || '',
    };
  });
  // If intake had a count but no detailed array entries, create blank stubs
  const prefilledDependents = mappedDependents.length > 0
    ? mappedDependents
    : intakeDepCount > 0
      ? Array.from({ length: intakeDepCount }, () => ({ age: '', relationship: '', special_needs: '', care_cost: '' }))
      : [];
  // Compute household_size: numDependents + filer (+ spouse if joint/non-filing)
  const hasSpouseInHousehold = fd.filingType === 'joint' || fd.filingType === 'individual-nonfiling-spouse';
  const derivedHhSizeNum = intakeDepCount + (hasSpouseInHousehold ? 2 : 1);
  const derivedHhSize = derivedHhSizeNum >= 8 ? '8+' : String(derivedHhSizeNum);
  const hhSize = fd.householdSize ? String(fd.householdSize) : (derivedHhSizeNum > 1 ? derivedHhSize : '');

  // Personal
  const personal: StepData = {
    first_name: fd.firstName || '',
    last_name: fd.lastName || '',
    middle_name: fd.middleName || '',
    email: fd.email || '',
    phone: fd.phone || '',
    address: residentialAddress,
    city: residentialCity,
    state: residentialState,
    zip: residentialZip,
    county: fd.county || '',
    marital_status: fd.maritalStatus || '',
    filing_type: fd.filingType || '',
    household_size: hhSize,
    num_dependents: intakeDepCount >= 8 ? '8+' : String(intakeDepCount),
    has_dependents: prefilledDependents.length > 0 ? 'yes' : 'no',
    dependents: prefilledDependents,
  };

  // Real estate
  const real_estate: StepData = {
    owns_real_estate: fd.ownsRealEstate || (fd.realPropAddress ? 'yes' : 'no'),
    properties: fd.ownsRealEstate === 'yes' || fd.realPropAddress ? [{
      address: fd.realPropAddress || '',
      city: fd.realPropCity || '',
      state: fd.realPropState || fd.state || '',
      zip: fd.realPropZip || '',
      description: 'Primary Residence',
      value: String(fd.realPropValue || ''),
      mortgage_balance: String(fd.mortgageBalance || ''),
      lender: fd.mortgageLender || '',
      monthly_payment: String(fd.mortgageMonthlyPayment || fd.realPropMonthlyPayment || ''),
      is_current: fd.mortgageCurrent || '',
      arrears: String(fd.mortgageArrears || ''),
      intent: fd.realPropIntent || 'keep',
    }] : [],
  };

  // Vehicles
  const rawVehicles = Array.isArray(fd.vehicles) ? fd.vehicles : [];
  const vehicles: StepData = {
    has_vehicles: rawVehicles.length > 0 ? 'yes' : (fd.hasVehicles || 'no'),
    vehicles: rawVehicles.map((v: any) => ({
      year: v.year || '',
      make: v.make || '',
      model: v.model || '',
      mileage: v.mileage || '',
      value: String(v.value || ''),
      has_loan: v.lender || v.loanBalance ? 'yes' : (v.hasLoan || 'no'),
      lender: v.lender || '',
      loan_balance: String(v.loanBalance || v.loanBalance || ''),
      monthly_payment: String(v.monthlyPayment || ''),
      is_current: v.isCurrent || '',
      arrears: String(v.arrears || ''),
    })),
  };

  // Bank accounts
  const rawBanks = Array.isArray(fd.bankAccounts) ? fd.bankAccounts : [];
  const bank_accts: StepData = {
    has_bank_accounts: rawBanks.length > 0 ? 'yes' : (fd.hasBankAccounts || 'no'),
    accounts: rawBanks.map((b: any) => ({
      institution: b.bankName || b.institution || b.bank || '',
      account_type: b.accountType || b.type || '',
      balance: String(b.balance || b.amount || ''),
      last4: b.last4 || '',
    })),
    has_other_financial: 'no',
    other_financial: [],
    has_closed_accounts: 'no',
    closed_accounts: [],
  };

  // Retirement & benefits — handles both client self-service and admin flat fields
  const rawRetirement = Array.isArray(fd.retirementAccounts) ? fd.retirementAccounts : [];
  const hasSS = !!(fd.debtorSsRetirement || fd.dSsRetirement || fd.debtorSsDisability || fd.dSsDisability);
  const ssMonthly = String(fd.debtorSsRetirement || fd.dSsRetirement || fd.debtorSsDisability || fd.dSsDisability || '');
  const ssType = (fd.debtorSsRetirement || fd.dSsRetirement) ? 'retirement' : ((fd.debtorSsDisability || fd.dSsDisability) ? 'disability' : '');
  const hasPension = !!(fd.debtorPension || fd.dPension);
  const pensionMonthly = String(fd.debtorPension || fd.dPension || '');
  const pensionSource = fd.pensionSource || fd.debtorPensionSource || '';
  const hasVets = !!(fd.debtorVeterans || fd.dVeterans || fd.debtorVeteransRetirement || fd.dVeteransRetirement);
  const vetsMonthly = String(fd.debtorVeterans || fd.dVeterans || fd.debtorVeteransRetirement || fd.dVeteransRetirement || '');
  const retirement: StepData = {
    has_retirement: rawRetirement.length > 0 ? 'yes' : (fd.hasRetirement || 'no'),
    retirement_accounts: rawRetirement.map((r: any) => ({
      institution: r.institution || '',
      account_type: r.accountType || r.type || '',
      balance: String(r.balance || ''),
      owner_name: r.ownerName || '',
    })),
    has_ss_income: hasSS ? 'yes' : 'no',
    ss_type: ssType,
    ss_monthly: ssMonthly,
    has_pension: hasPension ? 'yes' : 'no',
    pension_source: pensionSource,
    pension_monthly: pensionMonthly,
    has_veterans: hasVets ? 'yes' : 'no',
    veterans_monthly: vetsMonthly,
  };

  // Secured creditors — built from real estate + vehicles
  const securedList: any[] = [];
  if (real_estate.properties?.length > 0) {
    real_estate.properties.forEach((p: any) => {
      if (p.lender || p.mortgage_balance) {
        securedList.push({
          creditor_name: p.lender || '',
          collateral: p.address || 'Real Property',
          collateral_type: 'real_estate',
          current_balance: p.mortgage_balance || '',
          monthly_payment: p.monthly_payment || '',
          is_current: p.is_current || '',
          arrears: p.arrears || '',
          account_last4: '',
        });
      }
    });
  }
  if (vehicles.vehicles?.length > 0) {
    vehicles.vehicles.forEach((v: any) => {
      if (v.has_loan === 'yes' || v.lender || v.loan_balance) {
        securedList.push({
          creditor_name: v.lender || '',
          collateral: `${v.year} ${v.make} ${v.model}`.trim(),
          collateral_type: 'vehicle',
          current_balance: v.loan_balance || '',
          monthly_payment: v.monthly_payment || '',
          is_current: v.is_current || '',
          arrears: v.arrears || '',
          account_last4: '',
        });
      }
    });
  }

  const secured: StepData = {
    secured_creditors: securedList,
  };

  // Unsecured
  const unsecured: StepData = {
    credit_card_total: String(fd.creditCardDebt || ''),
    medical_total: String(fd.medicalDebt || ''),
    personal_loan_total: String(fd.personalLoanDebt || ''),
    student_loan_total: String(fd.studentLoanDebt || ''),
    tax_debt_total: String(fd.taxDebt || ''),
    judgment_total: String(fd.judgmentDebt || ''),
    other_unsecured_total: String(fd.otherUnsecured || ''),
    has_business_debt: fd.hasBusinessDebt || 'no',
    business_debt_desc: fd.businessDebtDesc || '',
    business_line_debt: String(fd.businessLineDebt || ''),
    business_cc_debt: String(fd.businessCreditCardDebt || ''),
    business_other_debt: String(fd.otherBusinessDebt || ''),
    creditors: [],
  };

  // Income — handles both client self-service (debtorSources[]) and admin flat fields
  const rawSources = Array.isArray(fd.debtorSources) ? fd.debtorSources : [];
  const adminEmploymentSources = (fd.debtorWorkStatus === 'employed' || fd.debtorWorkStatus === 'self_employed') && fd.debtorMonthlyGross
    ? [{ employer: fd.debtorEmployer || '', type: fd.debtorWorkStatus === 'self_employed' ? 'self_employment' : 'employment', gross_monthly: String(fd.debtorMonthlyGross || ''), net_monthly: '' }]
    : [];
  const income: StepData = {
    employment_sources: rawSources.length > 0
      ? rawSources.map((s: any) => ({
          employer: s.employerName || s.businessName || '',
          type: s.sourceType || 'employment',
          gross_monthly: String(s.grossPerPeriod || ''),
          net_monthly: String(s.netPerPeriod || ''),
        }))
      : adminEmploymentSources,
    rental_income: String(fd.debtorRental || ''),
    other_income: String(fd.debtorOtherIncome || ''),
    other_income_desc: fd.debtorOtherIncomeDesc || '',
    has_unemployment: fd.debtorUnemployment ? 'yes' : 'no',
    unemployment_monthly: String(fd.debtorUnemployment || ''),
    has_workers_comp: fd.debtorWorkersComp ? 'yes' : 'no',
    workers_comp_monthly: String(fd.debtorWorkersComp || ''),
  };

  // Expenses
  const expenses: StepData = {
    rent_mortgage: String(fd.expRentMortgage || ''),
    electric_gas: String(fd.expElectricGas || ''),
    water_sewer: String(fd.expWaterSewer || ''),
    phone: String(fd.expPhone || ''),
    internet: String(fd.expInternet || ''),
    food: String(fd.expFood || ''),
    clothing: String(fd.expClothing || ''),
    personal_care: String(fd.expPersonalCare || ''),
    transportation: String(fd.expGasFuel || ''),
    car_insurance: String(fd.expInsVehicle || ''),
    health_insurance: String(fd.expInsHealth || ''),
    medical: String(fd.expMedical || ''),
    childcare: String(fd.expChildcare || ''),
    other: String(fd.expOther || ''),
  };

  // Financial history — handles both client and admin field naming
  const priorBankruptcyFlag = fd.priorBankruptcy === 'yes' || fd.filedBefore === 'yes' ? 'yes' : (fd.priorBankruptcy || fd.filedBefore || 'no');
  const prefPayments = Array.isArray(fd.prefPaymentEntries) && fd.prefPaymentEntries.length > 0 ? 'yes' : (fd.preferentialPayments || 'no');
  const prefInsider = Array.isArray(fd.prefPaymentEntries) && fd.prefPaymentEntries.some((p: any) => p.isInsider) ? 'yes' : (fd.preferentialPaymentsInsider || 'no');
  const prefPaymentsSummary = Array.isArray(fd.prefPaymentEntries) && fd.prefPaymentEntries.length > 0
    ? fd.prefPaymentEntries.map((p: any) => `${p.creditor || p.payee || ''}${p.amount ? ` ($${p.amount})` : ''}${p.isInsider ? ' [insider]' : ''}`).join('; ')
    : '';
  // Admin uses taxRefundExpected/taxRefundAmount; client uses expectedRefund/refundAmount
  const expectedRefund = fd.taxRefundExpected || fd.expectedRefund || 'no';
  const refundAmt = String(fd.taxRefundAmount || fd.refundAmount || '');
  const history: StepData = {
    filed_before: priorBankruptcyFlag,
    has_lawsuits: fd.hasLawsuits || fd.pendingLawsuits || 'no',
    has_recent_transfers: fd.hasRecentTransfers || fd.transferredProperty || 'no',
    has_garnishments: fd.hasGarnishments || fd.garnishment || 'no',
    foreclosure_pending: fd.foreclosurePending || 'no',
    prior_bankruptcy_details: fd.priorBankruptcies?.map((b: any) => `Ch.${b.chapter} — ${b.yearFiled}, ${b.district}`).join('; ') || '',
    lawsuit_details: fd.lawsuitDetails || '',
    transfer_details: '',
    garnishment_details: fd.garnishmentCreditor ? `${fd.garnishmentCreditor}${fd.garnishmentMonthlyAmount ? ` — $${fd.garnishmentMonthlyAmount}/mo` : ''}${fd.garnishmentDetails ? ` (${fd.garnishmentDetails})` : ''}` : (fd.garnishmentDetails || ''),
    foreclosure_date: fd.foreclosureDate || fd.foreclosureSaleDate || '',
    created_trust: fd.createdTrust || 'no',
    trust_details: fd.trustDetails || '',
    owned_business: fd.ownedBusiness || 'no',
    business_details: fd.businessDetails || '',
    expected_refund: expectedRefund,
    refund_amount: refundAmt,
    dso_obligation: fd.dsoObligation || 'no',
    dso_amount: String(fd.dsoAmount || ''),
    recent_luxury: fd.recentLuxury || 'no',
    luxury_details: fd.luxuryDetails || '',
    preferential_payments: prefPayments,
    preferential_insider: prefInsider,
    preferential_payments_details: prefPaymentsSummary,
    has_closed_accounts: 'no',
    closed_accounts: [],
  };

  // Personal property — handles both client and admin field naming
  const lifeIns = fd.hasLifeInsurance || (fd.lifeCashValue ? 'yes' : 'no');
  const personal_property: StepData = {
    has_household_goods: fd.hasHouseholdGoods || (fd.householdGoodsValue ? 'yes' : 'no'),
    household_goods_value: String(fd.householdGoodsValue || ''),
    electronics_value: String(fd.electronicsValue || ''),
    jewelry_value: String(fd.jewelryValue || ''),
    tools_value: String(fd.toolsValue || ''),
    has_life_insurance: lifeIns,
    life_policy_type: fd.lifePolicies?.[0]?.policyType || fd.lifePolicyType || '',
    life_face_value: String(fd.lifePolicies?.[0]?.faceValue || fd.lifeFaceValue || ''),
    life_cash_value: String(fd.lifePolicies?.[0]?.cashValue || fd.lifeCashValue || ''),
    life_insurer: fd.lifePolicies?.[0]?.insurer || fd.lifeInsurer || '',
    life_policy_number: fd.lifePolicies?.[0]?.policyNumber || fd.lifePolicyNumber || '',
    has_stocks: fd.hasStocks || 'no',
    stocks_value: String(fd.stocksValue || ''),
    stocks_desc: fd.stocksDesc || '',
    has_crypto: fd.hasCrypto || 'no',
    crypto_value: String(fd.cryptoValue || ''),
    crypto_desc: fd.cryptoDesc || '',
    has_firearms: fd.hasFirearms || 'no',
    firearms: (fd.firearms || []).map((f: any) => ({
      description: f.description || '',
      serial_number: f.serialNumber || '',
      value: String(f.value || ''),
    })),
    has_collectibles: fd.hasCollectibles || 'no',
    collectibles_value: String(fd.collectiblesValue || ''),
    collectibles_desc: fd.collectiblesDesc || '',
    has_other_prop: fd.hasOtherPersonalProp || 'no',
    other_prop_value: String(fd.otherPersonalPropValue || ''),
    other_prop_desc: fd.otherPersonalPropDesc || '',
  };

  // Support obligations — handles both client and admin field naming
  // Admin uses childSupportArrears as a dollar amount; client uses it as yes/no
  const csArrearsAmt = String(fd.childSupportArrears || '');
  const csArrears = csArrearsAmt && Number(csArrearsAmt) > 0 ? 'yes' : (fd.noChildSupportArrears ? 'no' : (fd.childSupportArrears ? 'yes' : 'no'));
  const alimonyArrearsAmt = String(fd.alimonyArrears || '');
  const alimArrears = alimonyArrearsAmt && Number(alimonyArrearsAmt) > 0 ? 'yes' : (fd.noAlimonyArrears ? 'no' : (fd.alimonyArrears ? 'yes' : 'no'));
  const support: StepData = {
    child_support_current: fd.childSupportCurrent || '',
    child_support_arrears: csArrears,
    child_support_arrears_amount: csArrearsAmt,
    alimony_current: fd.alimonyCurrent || '',
    alimony_arrears: alimArrears,
    alimony_arrears_amount: alimonyArrearsAmt,
    has_dso: fd.dsoObligation || 'no',
    dso_amount: String(fd.dsoAmount || ''),
    pi_has_claim: fd.piHasClaim || 'no',
    pi_date_of_loss: fd.piDateOfLoss || '',
    pi_description: fd.piIncidentDescription || '',
    pi_location: fd.piIncidentLocation || '',
    pi_injured: fd.piWasInjured || '',
    pi_injury_desc: fd.piInjuryDescription || '',
    pi_treatment: fd.piMedicalTreatment || '',
    pi_provider: fd.piMedicalProvider || '',
    pi_has_attorney: fd.piHasAttorney || '',
    pi_attorney_name: fd.piAttorneyName || '',
    pi_property_damage: fd.piPropertyDamage || '',
    pi_property_damage_desc: fd.piPropertyDamageDesc || '',
  };

  return { personal, real_estate, vehicles, bank_accts, retirement, secured, unsecured, income, expenses, history, personal_property, support };
}

// ── Step: Disclosure ──────────────────────────────────────────────────────────

function StepDisclosure({ hasIntake }: { hasIntake: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-amber-400/10 border border-amber-400/30 rounded-2xl flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h2 className="text-white font-bold text-xl">Full Bankruptcy Information & Document Questionnaire</h2>
          <p className="text-slate-400 text-sm mt-0.5">Please read before proceeding</p>
        </div>
      </div>

      {hasIntake && (
        <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-5 mb-5">
          <div className="flex items-start gap-3">
            <RefreshCw className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-bold text-sm mb-1">Your Intake Information Has Been Pre-Filled</p>
              <p className="text-amber-200/80 text-sm leading-relaxed">
                You previously provided information during our intake process. That information has been pre-filled into this questionnaire. <strong className="text-amber-300">You must review and confirm every section</strong> — update anything that has changed since your intake.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-5 space-y-4">
        {[
          'This questionnaire collects the complete financial information required to prepare your official bankruptcy petition. Your answers are used directly in court filing documents.',
          'For all financed assets (mortgage, car loans, etc.) you will confirm the current balance, whether payments are current, your monthly payment, and the lender name.',
          'For all financial accounts (checking, savings, retirement, etc.) you will confirm the institution name, current balance, and last 4 digits of the account number.',
          'At the end of this questionnaire you will receive a personalized document checklist — including the most recent statement from each creditor, 6 months of bank statements, and any award letters.',
          'All information must be accurate as of today. Providing false or incomplete information in a bankruptcy proceeding is a federal crime.',
        ].map((text, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-2 h-2 bg-amber-400 rounded-full mt-1.5 flex-shrink-0" />
            <p className="text-slate-300 text-sm leading-relaxed">{text}</p>
          </div>
        ))}
      </div>

      <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-blue-300/90 text-sm leading-relaxed">
          Your progress is saved automatically after each step. You may return to continue at any time from your dashboard.
        </p>
      </div>
    </div>
  );
}

// ── Step: Personal ────────────────────────────────────────────────────────────

const MARITAL_STATUS_OPTIONS = [
  { value: 'single',   label: 'Single' },
  { value: 'married',  label: 'Married' },
  { value: 'separated', label: 'Separated' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed',  label: 'Widowed' },
];

function StepPersonal({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const f = (k: string) => (v: string) => setData({ ...data, [k]: v });
  const mailingSame = data.mailing_same !== 'no';

  return (
    <div>
      {hasIntake && <IntakeBadge />}
      <ConfirmBanner text="Confirm your personal information is accurate and up to date. If anything has changed since your intake, please update it here." />

      <SectionHeader title="Name & Contact" />
      <Grid2>
        <Field label="First Name" required prefilled={hasIntake && !!data.first_name}>
          <TextInput value={data.first_name} onChange={f('first_name')} placeholder="First name" prefilled={hasIntake && !!data.first_name} />
        </Field>
        <Field label="Last Name" required prefilled={hasIntake && !!data.last_name}>
          <TextInput value={data.last_name} onChange={f('last_name')} placeholder="Last name" prefilled={hasIntake && !!data.last_name} />
        </Field>
        <Field label="Email" required prefilled={hasIntake && !!data.email}>
          <TextInput value={data.email} onChange={f('email')} type="email" placeholder="email@example.com" prefilled={hasIntake && !!data.email} />
        </Field>
        <Field label="Phone" required prefilled={hasIntake && !!data.phone}>
          <TextInput value={data.phone} onChange={f('phone')} placeholder="(555) 555-5555" prefilled={hasIntake && !!data.phone} />
        </Field>
      </Grid2>

      <SectionHeader title="Marital Status" sub="Required for Schedule H and means test calculations." />
      <Field label="What is your current marital status?" required prefilled={hasIntake && !!data.marital_status}>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {MARITAL_STATUS_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => f('marital_status')(opt.value)}
              className={`py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                data.marital_status === opt.value
                  ? 'bg-amber-400/15 border-amber-400/50 text-amber-400'
                  : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white'
              }`}
            >{opt.label}</button>
          ))}
        </div>
        {data.marital_status && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border border-slate-600 rounded-lg mt-2">
            <CheckCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-xs text-slate-400">Confirmed: <strong className="text-amber-300">{MARITAL_STATUS_OPTIONS.find(o => o.value === data.marital_status)?.label}</strong></span>
          </div>
        )}
      </Field>
      {data.marital_status === 'married' && (
        <Field label="Spouse's Full Name" prefilled={hasIntake && !!data.spouse_name}>
          <TextInput value={data.spouse_name || ''} onChange={f('spouse_name')} placeholder="Spouse's full legal name" prefilled={hasIntake && !!data.spouse_name} />
        </Field>
      )}

      <SectionHeader title="Current Residential Address" sub="The address where you currently reside." />
      <Grid2>
        <Field label="Street Address" required prefilled={hasIntake && !!data.address}>
          <TextInput value={data.address} onChange={f('address')} placeholder="123 Main St" prefilled={hasIntake && !!data.address} />
        </Field>
        <Field label="City" required prefilled={hasIntake && !!data.city}>
          <TextInput value={data.city} onChange={f('city')} placeholder="City" prefilled={hasIntake && !!data.city} />
        </Field>
        <Field label="State" required prefilled={hasIntake && !!data.state}>
          <TextInput value={data.state} onChange={f('state')} placeholder="AZ" prefilled={hasIntake && !!data.state} />
        </Field>
        <Field label="ZIP Code" required prefilled={hasIntake && !!data.zip}>
          <TextInput value={data.zip} onChange={f('zip')} placeholder="85001" prefilled={hasIntake && !!data.zip} />
        </Field>
        <Field label="County" prefilled={hasIntake && !!data.county}>
          <TextInput value={data.county} onChange={f('county')} placeholder="Maricopa" prefilled={hasIntake && !!data.county} />
        </Field>
      </Grid2>

      <SectionHeader title="Mailing Address" sub="Where you receive mail — may differ from your residential address." />
      <Field label="Is your mailing address the same as your residential address above?" required>
        <YesNo value={data.mailing_same || ''} onChange={v => {
          if (v === 'yes') {
            setData({ ...data, mailing_same: 'yes', mailing_address: '', mailing_city: '', mailing_state: '', mailing_zip: '' });
          } else {
            setData({ ...data, mailing_same: 'no' });
          }
        }} noLabel="No — different address" />
      </Field>
      {data.mailing_same === 'no' && (
        <Grid2>
          <Field label="Mailing Street Address" required>
            <TextInput value={data.mailing_address || ''} onChange={f('mailing_address')} placeholder="P.O. Box or street address" />
          </Field>
          <Field label="City" required>
            <TextInput value={data.mailing_city || ''} onChange={f('mailing_city')} placeholder="City" />
          </Field>
          <Field label="State" required>
            <TextInput value={data.mailing_state || ''} onChange={f('mailing_state')} placeholder="AZ" />
          </Field>
          <Field label="ZIP Code" required>
            <TextInput value={data.mailing_zip || ''} onChange={f('mailing_zip')} placeholder="85001" />
          </Field>
        </Grid2>
      )}

      <SectionHeader title="Household & Dependents" sub="Required for Schedule J (expenses) and the means test." />

      <Field label="Number of Dependents" hint="Children or others financially dependent on you" required>
        <SelectInput
          value={data.num_dependents || '0'}
          onChange={v => {
            const n = v === '8+' ? 8 : (parseInt(v) || 0);
            const spouseInHH = data.filing_type === 'individual-nonfiling-spouse' || data.filing_type === 'joint';
            const existing: any[] = data.dependents || [];
            const newDeps = Array.from({ length: n }, (_, i) => existing[i] || { age: '', relationship: '', special_needs: '', care_cost: '' });
            const derived = n + (spouseInHH ? 2 : 1);
            setData({
              ...data,
              num_dependents: v,
              has_dependents: n > 0 ? 'yes' : 'no',
              dependents: newDeps,
              household_size: derived >= 8 ? '8+' : String(derived),
            });
          }}
          options={['0','1','2','3','4','5','6','7','8+'].map(v => ({ value: v, label: v }))}
          placeholder="Select"
        />
      </Field>

      {(data.num_dependents && data.num_dependents !== '0' ? parseInt(data.num_dependents) > 0 : (data.dependents || []).length > 0) && (
        <div className="space-y-3 mt-2">
          {(data.dependents || []).map((dep: any, i: number) => (
            <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-300 text-sm font-semibold">
                  {dep.relationship ? `${dep.relationship}${dep.age ? `, Age ${dep.age}` : ''}` : `Dependent ${i + 1}`}
                </p>
              </div>
              <Grid2>
                <Field label="Age" required>
                  <SelectInput value={dep.age || ''} onChange={v => { const d=[...(data.dependents||[])]; d[i]={...d[i],age:v}; setData({...data,dependents:d}); }} placeholder="Select age..."
                    options={['Under 1','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48','49','50','51','52','53','54','55','56','57','58','59','60','61','62','63','64','65','66','67','68','69','70','71','72','73','74','75','76','77','78','79','80','81','82','83','84','85','86','87','88','89','90','95+'].map(v => ({ value: v, label: v }))}
                  />
                </Field>
                <Field label="Relationship to You" required>
                  <SelectInput value={dep.relationship || ''} onChange={v => { const d=[...(data.dependents||[])]; d[i]={...d[i],relationship:v}; setData({...data,dependents:d}); }} placeholder="Select relationship"
                    options={[
                      'Son','Daughter','Stepson','Stepdaughter','Grandson','Granddaughter',
                      'Mother','Father','Stepmother','Stepfather','Grandmother','Grandfather',
                      'Sister','Brother','Aunt','Uncle','Niece','Nephew','Significant Other','Friend','Other',
                    ].map(v => ({ value: v, label: v }))}
                  />
                </Field>
                <Field label="Does this person have a disability, illness, or special needs?" hint="Affects Schedule J expense allowances">
                  <SelectInput value={dep.special_needs || ''} onChange={v => { const d=[...(data.dependents||[])]; d[i]={...d[i],special_needs:v}; setData({...data,dependents:d}); }} placeholder="Select"
                    options={[
                      { value: 'no', label: 'No' },
                      { value: 'disability', label: 'Yes — physical or developmental disability' },
                      { value: 'illness', label: 'Yes — chronic illness or medical condition' },
                      { value: 'elderly_care', label: 'Yes — elderly / requires ongoing care' },
                      { value: 'other', label: 'Yes — other special circumstances' },
                    ]}
                  />
                </Field>
                {(dep.special_needs && dep.special_needs !== 'no') && (
                  <Field label="Monthly care or medical cost for this dependent" hint="Used for Schedule J expense allowance">
                    <AmountInput value={dep.care_cost || ''} onChange={v => { const d=[...(data.dependents||[])]; d[i]={...d[i],care_cost:v}; setData({...data,dependents:d}); }} />
                  </Field>
                )}
              </Grid2>
            </div>
          ))}
        </div>
      )}

      {/* Household size summary — shown once dependents question is answered */}
      {(data.num_dependents !== undefined && data.num_dependents !== '') && (() => {
        const spouseInHH = data.filing_type === 'individual-nonfiling-spouse' || data.filing_type === 'joint';
        const depCount = data.num_dependents === '8+' ? 8 : (parseInt(data.num_dependents) || 0);
        const derived = depCount + (spouseInHH ? 2 : 1);
        const derivedStr = derived >= 8 ? '8+' : String(derived);
        // Auto-sync household_size to derived if not manually overridden
        return (
          <div className="mt-4 bg-slate-800/60 border border-amber-400/20 rounded-xl p-4">
            <p className="text-slate-300 text-sm font-semibold mb-1">Confirm Total Household Size</p>
            <p className="text-slate-500 text-xs mb-3">
              Based on your answers: <strong className="text-slate-300">You</strong>
              {spouseInHH && <> + <strong className="text-slate-300">Non-filing spouse</strong></>}
              {depCount > 0 && <> + <strong className="text-slate-300">{depCount} dependent{depCount !== 1 ? 's' : ''}</strong></>}
              {' '}= <strong className="text-amber-400">{derivedStr} {derived === 1 ? 'person' : 'people'}</strong>
            </p>
            <div className="grid grid-cols-8 gap-2">
              {['1','2','3','4','5','6','7','8+'].map(n => (
                <button key={n} type="button" onClick={() => setData({ ...data, household_size: n })}
                  className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
                    (data.household_size || derivedStr) === n
                      ? 'bg-amber-400/15 border-amber-400/50 text-amber-400'
                      : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white'
                  }`}
                >{n}</button>
              ))}
            </div>
            {data.household_size && data.household_size !== derivedStr && (
              <p className="text-amber-400/70 text-xs mt-2 flex items-center gap-1">
                <Info className="w-3 h-3 flex-shrink-0" />
                You selected {data.household_size} — this differs from the calculated {derivedStr}. Please verify this is correct.
              </p>
            )}
          </div>
        );
      })()}

      <div className="mt-8 bg-slate-800/60 border border-slate-600 rounded-xl p-4">
        <p className="text-slate-300 text-sm font-semibold mb-1">Is all of the personal information above correct and complete?</p>
        <p className="text-slate-500 text-xs mb-3">Please review every field above before confirming. This information will appear directly on your bankruptcy petition.</p>
        <YesNo value={data.info_confirmed || ''} onChange={f('info_confirmed')} noLabel="No — I need to make a change" />
      </div>
    </div>
  );
}

// ── Step: Real Estate ─────────────────────────────────────────────────────────

function StepRealEstate({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const properties: any[] = data.properties || [];

  function updateProp(i: number, key: string, val: string) {
    const next = [...properties];
    next[i] = { ...next[i], [key]: val };
    setData({ ...data, properties: next });
  }

  function addProp() {
    setData({ ...data, owns_real_estate: 'yes', properties: [...properties, {
      address: '', city: '', state: '', zip: '', description: '',
      value: '', mortgage_balance: '', lender: '', monthly_payment: '',
      is_current: '', arrears: '', intent: 'keep',
    }]});
  }

  function removeProp(i: number) {
    const next = properties.filter((_, j) => j !== i);
    setData({ ...data, properties: next, owns_real_estate: next.length > 0 ? 'yes' : 'no' });
  }

  return (
    <div>
      {hasIntake && <IntakeBadge />}
      <ConfirmBanner text="Confirm your real estate information. For any property with a mortgage, confirm the current balance, whether payments are current, your monthly payment amount, and the lender's name." />

      <Field label="Do you own any real estate (house, condo, land, investment property, etc.)?">
        <YesNo value={data.owns_real_estate} onChange={v => {
          if (v === 'yes' && properties.length === 0) addProp();
          else setData({ ...data, owns_real_estate: v });
        }} />
      </Field>

      {data.owns_real_estate === 'yes' && (
        <div className="space-y-5 mt-4">
          {properties.map((prop, i) => (
            <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white font-bold text-sm">
                    {prop.description && prop.address
                      ? `${prop.description} — ${prop.address}`
                      : prop.description
                        ? prop.description
                        : prop.address
                          ? prop.address
                          : `Property ${i + 1}`}
                  </p>
                  {(prop.city || prop.state) && (
                    <p className="text-slate-400 text-xs mt-0.5">{[prop.city, prop.state, prop.zip].filter(Boolean).join(', ')}</p>
                  )}
                </div>
                {properties.length > 1 && (
                  <button onClick={() => removeProp(i)} className="text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Grid2>
                <Field label="Street Address" required prefilled={hasIntake && !!prop.address}>
                  <TextInput value={prop.address} onChange={v => updateProp(i, 'address', v)} placeholder="123 Main St" prefilled={hasIntake && !!prop.address} />
                </Field>
                <Field label="City" prefilled={hasIntake && !!prop.city}>
                  <TextInput value={prop.city} onChange={v => updateProp(i, 'city', v)} placeholder="Phoenix" prefilled={hasIntake && !!prop.city} />
                </Field>
                <Field label="State" prefilled={hasIntake && !!prop.state}>
                  <TextInput value={prop.state} onChange={v => updateProp(i, 'state', v)} placeholder="AZ" prefilled={hasIntake && !!prop.state} />
                </Field>
                <Field label="ZIP Code">
                  <TextInput value={prop.zip} onChange={v => updateProp(i, 'zip', v)} placeholder="85001" />
                </Field>
                <Field label="Property Description">
                  <SelectInput value={prop.description} onChange={v => updateProp(i, 'description', v)} placeholder="Select type"
                    options={[
                      { value: 'Primary Residence', label: 'Primary Residence' },
                      { value: 'Investment Property', label: 'Investment Property / Rental' },
                      { value: 'Vacation Home', label: 'Vacation Home / Second Home' },
                      { value: 'Land', label: 'Vacant Land' },
                      { value: 'Commercial', label: 'Commercial Property' },
                      { value: 'Other', label: 'Other' },
                    ]}
                    prefilled={hasIntake && !!prop.description}
                  />
                </Field>
                <Field label="Current Market Value" required prefilled={hasIntake && !!prop.value}>
                  <AmountInput value={prop.value} onChange={v => updateProp(i, 'value', v)} prefilled={hasIntake && !!prop.value} />
                </Field>
                <Field label="Intent" hint="What do you plan to do with this property?">
                  <SelectInput value={prop.intent} onChange={v => updateProp(i, 'intent', v)} placeholder="Select"
                    options={[
                      { value: 'keep', label: 'Keep — continue making payments' },
                      { value: 'surrender', label: 'Surrender — return to lender' },
                      { value: 'unsure', label: 'Unsure' },
                    ]}
                    prefilled={hasIntake && !!prop.intent}
                  />
                </Field>
              </Grid2>

              <SectionHeader title="Mortgage / Lien Information" sub="Required for Schedule D — Secured Creditors" />
              <Field label="Does this property have a mortgage or lien?">
                <YesNo value={prop.has_mortgage || (prop.lender || prop.mortgage_balance ? 'yes' : '')}
                  onChange={v => updateProp(i, 'has_mortgage', v)} />
              </Field>
              {(prop.has_mortgage === 'yes' || prop.lender || prop.mortgage_balance) && (
                <Grid2>
                  <Field label="Lender Name" required prefilled={hasIntake && !!prop.lender}>
                    <TextInput value={prop.lender} onChange={v => updateProp(i, 'lender', v)} placeholder="Wells Fargo, Chase, etc." prefilled={hasIntake && !!prop.lender} />
                  </Field>
                  <Field label="Current Balance Owed" required prefilled={hasIntake && !!prop.mortgage_balance}>
                    <AmountInput value={prop.mortgage_balance} onChange={v => updateProp(i, 'mortgage_balance', v)} prefilled={hasIntake && !!prop.mortgage_balance} />
                  </Field>
                  <Field label="Monthly Payment" required prefilled={hasIntake && !!prop.monthly_payment}>
                    <AmountInput value={prop.monthly_payment} onChange={v => updateProp(i, 'monthly_payment', v)} prefilled={hasIntake && !!prop.monthly_payment} />
                  </Field>
                  <Field label="Are payments current?" required>
                    <SelectInput value={prop.is_current} onChange={v => updateProp(i, 'is_current', v)} placeholder="Select"
                      options={[{ value: 'yes', label: 'Yes — current' }, { value: 'no', label: 'No — behind' }]}
                      prefilled={hasIntake && !!prop.is_current}
                    />
                  </Field>
                  {prop.is_current === 'no' && (
                    <Field label="Amount Past Due / Arrears">
                      <AmountInput value={prop.arrears} onChange={v => updateProp(i, 'arrears', v)} prefilled={hasIntake && !!prop.arrears} />
                    </Field>
                  )}
                  <Field label="Account Last 4 Digits" hint="Last 4 of mortgage loan number">
                    <TextInput value={prop.account_last4 || ''} onChange={v => updateProp(i, 'account_last4', v.replace(/\D/g,'').slice(0,4))} placeholder="XXXX" />
                  </Field>
                </Grid2>
              )}
            </div>
          ))}
          <button onClick={addProp}
            className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Add Another Property
          </button>
        </div>
      )}

      {data.owns_real_estate === 'yes' && (
        <DocNote items={properties.filter(p => p.lender || p.mortgage_balance).map(p =>
          `Most recent mortgage statement — ${p.lender || 'mortgage lender'} (${p.address || 'property'})`
        )} />
      )}
    </div>
  );
}

// ── Step: Vehicles ────────────────────────────────────────────────────────────

function StepVehicles({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const vehicles: any[] = data.vehicles || [];

  function updateVeh(i: number, key: string, val: string) {
    const next = [...vehicles];
    next[i] = { ...next[i], [key]: val };
    setData({ ...data, vehicles: next });
  }

  function addVeh() {
    setData({ ...data, has_vehicles: 'yes', vehicles: [...vehicles, {
      year: '', make: '', model: '', mileage: '', value: '',
      has_loan: 'no', lender: '', loan_balance: '', monthly_payment: '', is_current: '', arrears: '', account_last4: '',
    }]});
  }

  return (
    <div>
      {hasIntake && <IntakeBadge />}
      <ConfirmBanner text="Confirm your vehicles. For any vehicle with a loan, confirm the current payoff balance, whether payments are current, your monthly payment, and the lender's name." />

      <Field label="Do you own or have any vehicles? (cars, trucks, motorcycles, boats, RVs, etc.)">
        <YesNo value={data.has_vehicles} onChange={v => {
          if (v === 'yes' && vehicles.length === 0) addVeh();
          else setData({ ...data, has_vehicles: v });
        }} />
      </Field>

      {data.has_vehicles === 'yes' && (
        <div className="space-y-5 mt-4">
          {vehicles.map((veh, i) => (
            <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white font-bold text-sm">Vehicle {i + 1}{veh.year && veh.make ? ` — ${veh.year} ${veh.make} ${veh.model}` : ''}</p>
                {vehicles.length > 1 && (
                  <button onClick={() => setData({ ...data, vehicles: vehicles.filter((_, j) => j !== i) })}
                    className="text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Grid2>
                <Field label="Year" required prefilled={hasIntake && !!veh.year}>
                  <TextInput value={veh.year} onChange={v => updateVeh(i, 'year', v)} placeholder="2020" prefilled={hasIntake && !!veh.year} />
                </Field>
                <Field label="Make" required prefilled={hasIntake && !!veh.make}>
                  <TextInput value={veh.make} onChange={v => updateVeh(i, 'make', v)} placeholder="Toyota" prefilled={hasIntake && !!veh.make} />
                </Field>
                <Field label="Model" required prefilled={hasIntake && !!veh.model}>
                  <TextInput value={veh.model} onChange={v => updateVeh(i, 'model', v)} placeholder="Camry" prefilled={hasIntake && !!veh.model} />
                </Field>
                <Field label="Mileage" prefilled={hasIntake && !!veh.mileage}>
                  <TextInput value={veh.mileage} onChange={v => updateVeh(i, 'mileage', v)} placeholder="45,000" prefilled={hasIntake && !!veh.mileage} />
                </Field>
                <Field label="Current Market Value" required prefilled={hasIntake && !!veh.value}>
                  <AmountInput value={veh.value} onChange={v => updateVeh(i, 'value', v)} prefilled={hasIntake && !!veh.value} />
                </Field>
              </Grid2>

              <SectionHeader title="Loan Information" sub="Required for Schedule D" />
              <Field label="Does this vehicle have a loan or lien?">
                <YesNo value={veh.has_loan} onChange={v => updateVeh(i, 'has_loan', v)} />
              </Field>
              {veh.has_loan === 'yes' && (
                <Grid2>
                  <Field label="Lender Name" required prefilled={hasIntake && !!veh.lender}>
                    <TextInput value={veh.lender} onChange={v => updateVeh(i, 'lender', v)} placeholder="Toyota Financial, Chase, etc." prefilled={hasIntake && !!veh.lender} />
                  </Field>
                  <Field label="Current Payoff Balance" required prefilled={hasIntake && !!veh.loan_balance}>
                    <AmountInput value={veh.loan_balance} onChange={v => updateVeh(i, 'loan_balance', v)} prefilled={hasIntake && !!veh.loan_balance} />
                  </Field>
                  <Field label="Monthly Payment" required prefilled={hasIntake && !!veh.monthly_payment}>
                    <AmountInput value={veh.monthly_payment} onChange={v => updateVeh(i, 'monthly_payment', v)} prefilled={hasIntake && !!veh.monthly_payment} />
                  </Field>
                  <Field label="Are payments current?" required>
                    <SelectInput value={veh.is_current} onChange={v => updateVeh(i, 'is_current', v)} placeholder="Select"
                      options={[{ value: 'yes', label: 'Yes — current' }, { value: 'no', label: 'No — behind' }]}
                      prefilled={hasIntake && !!veh.is_current}
                    />
                  </Field>
                  {veh.is_current === 'no' && (
                    <Field label="Amount Past Due / Arrears">
                      <AmountInput value={veh.arrears} onChange={v => updateVeh(i, 'arrears', v)} />
                    </Field>
                  )}
                  <Field label="Account Last 4 Digits" hint="Last 4 of your loan account number">
                    <TextInput value={veh.account_last4 || ''} onChange={v => updateVeh(i, 'account_last4', v.replace(/\D/,'').slice(0,4))} placeholder="XXXX" />
                  </Field>
                </Grid2>
              )}
            </div>
          ))}
          <button onClick={addVeh}
            className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Add Another Vehicle
          </button>
        </div>
      )}

      {data.has_vehicles === 'yes' && (
        <DocNote items={vehicles.filter(v => v.has_loan === 'yes').map(v =>
          `Most recent loan statement — ${v.lender || 'auto lender'} (${v.year || ''} ${v.make || ''} ${v.model || ''})`.trim()
        )} />
      )}
    </div>
  );
}

// ── Step: Bank & Financial Accounts ──────────────────────────────────────────

function StepBankAccounts({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const accounts: any[] = data.accounts || [];

  function updateAcct(i: number, key: string, val: string) {
    const next = [...accounts];
    next[i] = { ...next[i], [key]: val };
    setData({ ...data, accounts: next });
  }

  const ACCT_TYPES = [
    { value: 'checking', label: 'Checking' },
    { value: 'savings', label: 'Savings' },
    { value: 'money_market', label: 'Money Market' },
    { value: 'cd', label: 'Certificate of Deposit (CD)' },
    { value: 'credit_union_share', label: 'Credit Union Share Account' },
    { value: 'brokerage', label: 'Brokerage / Investment Account' },
    { value: 'other', label: 'Other' },
  ];

  const closedAccounts: any[] = data.closed_accounts || [];

  function updateClosed(i: number, key: string, val: string) {
    const next = [...closedAccounts];
    next[i] = { ...next[i], [key]: val };
    setData({ ...data, closed_accounts: next });
  }

  return (
    <div>
      {hasIntake && <IntakeBadge />}
      <ConfirmBanner text="Confirm all bank and financial accounts. Provide the institution name, account type, current balance, and last 4 digits of each account number. This includes all checking, savings, money market, brokerage, and credit union accounts." />

      <Field label="Do you have any bank or financial accounts?" required>
        <YesNo value={data.has_bank_accounts} onChange={v => {
          if (v === 'yes' && accounts.length === 0) {
            setData({ ...data, has_bank_accounts: 'yes', accounts: [{ institution: '', account_type: 'checking', balance: '', last4: '' }] });
          } else {
            setData({ ...data, has_bank_accounts: v });
          }
        }} />
      </Field>

      {data.has_bank_accounts === 'yes' && (
        <>
          <div className="space-y-3 mb-3">
            {accounts.map((acct, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-slate-300 text-sm font-semibold">
                    {acct.institution && acct.account_type
                      ? `${acct.institution} ${ACCT_TYPES.find(t => t.value === acct.account_type)?.label || acct.account_type}${acct.last4 ? ` x${acct.last4}` : ''}`
                      : acct.institution
                        ? acct.institution
                        : `Account ${i + 1}`}
                  </p>
                  {accounts.length > 1 && (
                    <button onClick={() => setData({ ...data, accounts: accounts.filter((_, j) => j !== i) })}
                      className="text-slate-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <Grid2>
                  <Field label="Bank / Financial Institution" required prefilled={hasIntake && !!acct.institution}>
                    <TextInput value={acct.institution} onChange={v => updateAcct(i, 'institution', v)} placeholder="Chase Bank, Wells Fargo, etc." prefilled={hasIntake && !!acct.institution} />
                  </Field>
                  <Field label="Account Type" required>
                    <SelectInput value={acct.account_type} onChange={v => updateAcct(i, 'account_type', v)} placeholder="Select type" options={ACCT_TYPES} prefilled={hasIntake && !!acct.account_type} />
                  </Field>
                  <Field label="Current Balance" required prefilled={hasIntake && !!acct.balance}>
                    <AmountInput value={acct.balance} onChange={v => updateAcct(i, 'balance', v)} prefilled={hasIntake && !!acct.balance} />
                  </Field>
                  <Field label="Account Last 4 Digits" required hint="Last 4 digits of your account number">
                    <TextInput value={acct.last4} onChange={v => updateAcct(i, 'last4', v.replace(/\D/g,'').slice(0,4))} placeholder="XXXX" prefilled={hasIntake && !!acct.last4} />
                  </Field>
                </Grid2>
              </div>
            ))}
          </div>
          <button onClick={() => setData({ ...data, accounts: [...accounts, { institution: '', account_type: 'checking', balance: '', last4: '' }] })}
            className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mb-4">
            <Plus className="w-4 h-4" /> Add Another Account
          </button>
        </>
      )}

      <SectionHeader title="Closed Accounts" sub="Required for Statement of Financial Affairs (SOFA Part 4)" />
      <Field label="In the last year, have you closed any bank accounts, savings accounts, or other financial accounts?"
        hint="Do not include credit cards here — only deposit accounts where you held funds.">
        <YesNo value={data.has_closed_accounts} onChange={v => {
          if (v === 'yes' && closedAccounts.length === 0) {
            setData({ ...data, has_closed_accounts: 'yes', closed_accounts: [{ institution: '', account_type: '', last4: '', closed_date: '', balance_at_closing: '' }] });
          } else {
            setData({ ...data, has_closed_accounts: v });
          }
        }} />
      </Field>

      {data.has_closed_accounts === 'yes' && (
        <>
          <div className="space-y-3 mb-3">
            {closedAccounts.map((acct, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-slate-300 text-sm font-semibold">Closed Account {i + 1}</p>
                  {closedAccounts.length > 1 && (
                    <button onClick={() => setData({ ...data, closed_accounts: closedAccounts.filter((_, j) => j !== i) })}
                      className="text-slate-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <Grid2>
                  <Field label="Bank / Financial Institution" required>
                    <TextInput value={acct.institution} onChange={v => updateClosed(i, 'institution', v)} placeholder="Chase Bank" />
                  </Field>
                  <Field label="Account Type" required>
                    <SelectInput value={acct.account_type} onChange={v => updateClosed(i, 'account_type', v)} placeholder="Select type" options={ACCT_TYPES} />
                  </Field>
                  <Field label="Account Last 4 Digits" required>
                    <TextInput value={acct.last4} onChange={v => updateClosed(i, 'last4', v.replace(/\D/g,'').slice(0,4))} placeholder="XXXX" />
                  </Field>
                  <Field label="Date Account Was Closed" required>
                    <TextInput type="date" value={acct.closed_date} onChange={v => updateClosed(i, 'closed_date', v)} />
                  </Field>
                  <Field label="Balance at Time of Closing">
                    <AmountInput value={acct.balance_at_closing} onChange={v => updateClosed(i, 'balance_at_closing', v)} />
                  </Field>
                </Grid2>
              </div>
            ))}
          </div>
          <button onClick={() => setData({ ...data, closed_accounts: [...closedAccounts, { institution: '', account_type: '', last4: '', closed_date: '', balance_at_closing: '' }] })}
            className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mb-4">
            <Plus className="w-4 h-4" /> Add Another Closed Account
          </button>
        </>
      )}

      <DocNote items={[
        ...accounts.filter(a => a.institution).map(a => {
          const typeLabel = ACCT_TYPES.find(t => t.value === a.account_type)?.label || a.account_type || 'Account';
          return `Last 6 months of bank statements — ${a.institution} ${typeLabel}${a.last4 ? ` x${a.last4}` : ''}`;
        }),
        ...(data.has_closed_accounts === 'yes' ? closedAccounts.filter(a => a.institution).map(a => {
          const typeLabel = ACCT_TYPES.find(t => t.value === a.account_type)?.label || 'Account';
          return `Closing statement — ${a.institution} ${typeLabel}${a.last4 ? ` x${a.last4}` : ''}${a.closed_date ? ` (closed ${a.closed_date})` : ''}`;
        }) : []),
      ]} />
    </div>
  );
}

// ── Step: Retirement & Benefits ───────────────────────────────────────────────

function StepRetirement({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const accounts: any[] = data.retirement_accounts || [];
  const f = (k: string) => (v: string) => setData({ ...data, [k]: v });

  function updateAcct(i: number, key: string, val: string) {
    const next = [...accounts];
    next[i] = { ...next[i], [key]: val };
    setData({ ...data, retirement_accounts: next });
  }

  const RETIREMENT_TYPES = [
    { value: '401k', label: '401(k)' },
    { value: '403b', label: '403(b)' },
    { value: 'ira', label: 'Traditional IRA' },
    { value: 'roth_ira', label: 'Roth IRA' },
    { value: 'pension', label: 'Pension' },
    { value: 'sep_ira', label: 'SEP IRA' },
    { value: 'simple_ira', label: 'SIMPLE IRA' },
    { value: 'inherited_ira', label: 'Inherited IRA' },
    { value: 'annuity', label: 'Annuity' },
    { value: 'other', label: 'Other' },
  ];

  const docItems: string[] = [];
  accounts.filter(a => a.institution).forEach(a => {
    const typeLabel = RETIREMENT_TYPES.find(t => t.value === a.account_type)?.label || a.account_type || 'Retirement Account';
    docItems.push(`Most recent statement — ${a.institution} ${typeLabel}${a.balance ? ` (~$${Number(a.balance).toLocaleString()})` : ''}`);
  });
  if (data.has_ss_income === 'yes') docItems.push('Social Security Award Letter (most recent)');
  if (data.has_pension === 'yes') docItems.push(`Pension statement — ${data.pension_source || 'pension provider'} (most recent)`);
  if (data.has_veterans === 'yes') docItems.push('VA Award Letter (most recent)');

  return (
    <div>
      {hasIntake && <IntakeBadge />}
      <ConfirmBanner text="Confirm all retirement, pension, and benefit accounts. Provide the institution, account type, and current balance. For Social Security, VA, and pension income, confirm your current monthly benefit amount." />

      <SectionHeader title="Retirement & Investment Accounts" />
      <Field label="Do you have any retirement or investment accounts? (401k, IRA, pension, annuity, etc.)">
        <YesNo value={data.has_retirement} onChange={v => {
          if (v === 'yes' && accounts.length === 0) {
            setData({ ...data, has_retirement: 'yes', retirement_accounts: [{ institution: '', account_type: '401k', balance: '', owner_name: '' }] });
          } else {
            setData({ ...data, has_retirement: v });
          }
        }} />
      </Field>
      {data.has_retirement === 'yes' && (
        <>
          <div className="space-y-3 mb-3">
            {accounts.map((acct, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-slate-300 text-sm font-semibold">
                    {acct.institution && acct.account_type
                      ? `${acct.institution} ${RETIREMENT_TYPES.find(t => t.value === acct.account_type)?.label || acct.account_type}`
                      : acct.institution
                        ? acct.institution
                        : `Account ${i + 1}`}
                  </p>
                  {accounts.length > 1 && (
                    <button onClick={() => setData({ ...data, retirement_accounts: accounts.filter((_, j) => j !== i) })}
                      className="text-slate-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <Grid2>
                  <Field label="Financial Institution" required prefilled={hasIntake && !!acct.institution}>
                    <TextInput value={acct.institution} onChange={v => updateAcct(i, 'institution', v)} placeholder="Fidelity, Vanguard, etc." prefilled={hasIntake && !!acct.institution} />
                  </Field>
                  <Field label="Account Type" required>
                    <SelectInput value={acct.account_type} onChange={v => updateAcct(i, 'account_type', v)} placeholder="Select type" options={RETIREMENT_TYPES} prefilled={hasIntake && !!acct.account_type} />
                  </Field>
                  <Field label="Current Balance" required prefilled={hasIntake && !!acct.balance}>
                    <AmountInput value={acct.balance} onChange={v => updateAcct(i, 'balance', v)} prefilled={hasIntake && !!acct.balance} />
                  </Field>
                  <Field label="Account Owner Name" hint="If different from filer">
                    <TextInput value={acct.owner_name || ''} onChange={v => updateAcct(i, 'owner_name', v)} placeholder="Owner name" prefilled={hasIntake && !!acct.owner_name} />
                  </Field>
                </Grid2>
              </div>
            ))}
          </div>
          <button onClick={() => setData({ ...data, retirement_accounts: [...accounts, { institution: '', account_type: '401k', balance: '', owner_name: '' }] })}
            className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mb-4">
            <Plus className="w-4 h-4" /> Add Another Account
          </button>
        </>
      )}

      <SectionHeader title="Social Security" />
      <Field label="Do you receive Social Security income? (retirement, disability, SSI, SSDI)">
        <YesNo value={data.has_ss_income} onChange={f('has_ss_income')} />
      </Field>
      {data.has_ss_income === 'yes' && (
        <Grid2>
          <Field label="Type" prefilled={hasIntake && !!data.ss_type}>
            <SelectInput value={data.ss_type} onChange={f('ss_type')} placeholder="Select"
              options={[
                { value: 'retirement', label: 'SS Retirement' },
                { value: 'disability', label: 'SSDI — Social Security Disability' },
                { value: 'ssi', label: 'SSI — Supplemental Security Income' },
                { value: 'survivors', label: 'Survivors Benefits' },
              ]}
              prefilled={hasIntake && !!data.ss_type}
            />
          </Field>
          <Field label="Monthly Benefit Amount" required prefilled={hasIntake && !!data.ss_monthly}>
            <AmountInput value={data.ss_monthly} onChange={f('ss_monthly')} prefilled={hasIntake && !!data.ss_monthly} />
          </Field>
        </Grid2>
      )}

      <SectionHeader title="Pension" />
      <Field label="Do you receive pension income?">
        <YesNo value={data.has_pension} onChange={f('has_pension')} />
      </Field>
      {data.has_pension === 'yes' && (
        <Grid2>
          <Field label="Pension Source / Employer" prefilled={hasIntake && !!data.pension_source}>
            <TextInput value={data.pension_source || ''} onChange={f('pension_source')} placeholder="e.g. City of Phoenix, PERS" prefilled={hasIntake && !!data.pension_source} />
          </Field>
          <Field label="Monthly Pension Amount" required prefilled={hasIntake && !!data.pension_monthly}>
            <AmountInput value={data.pension_monthly || ''} onChange={f('pension_monthly')} prefilled={hasIntake && !!data.pension_monthly} />
          </Field>
        </Grid2>
      )}

      <SectionHeader title="Veterans Benefits" />
      <Field label="Do you receive VA / Veterans benefits?">
        <YesNo value={data.has_veterans} onChange={f('has_veterans')} />
      </Field>
      {data.has_veterans === 'yes' && (
        <Field label="Monthly VA Benefit Amount" required prefilled={hasIntake && !!data.veterans_monthly}>
          <AmountInput value={data.veterans_monthly || ''} onChange={f('veterans_monthly')} prefilled={hasIntake && !!data.veterans_monthly} />
        </Field>
      )}

      <DocNote items={docItems} />
    </div>
  );
}

// ── Step: Personal Property ───────────────────────────────────────────────────

function StepPersonalProperty({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const f = (k: string) => (v: string) => setData({ ...data, [k]: v });
  const firearms: any[] = data.firearms || [];

  function updateFirearm(i: number, key: string, val: string) {
    const next = [...firearms];
    next[i] = { ...next[i], [key]: val };
    setData({ ...data, firearms: next });
  }

  return (
    <div>
      {hasIntake && <IntakeBadge />}
      <ConfirmBanner text="Confirm all personal property. Every asset must be listed in Schedule A/B. If an item was answered 'No' previously, confirm that answer still applies." />

      <SectionHeader title="Household Goods & Electronics" sub="Schedule A/B — Item 6" />
      <Field label="Do you have household furniture, appliances, electronics, or other household goods?" required prefilled={hasIntake && !!data.has_household_goods}>
        <YesNo value={data.has_household_goods} onChange={f('has_household_goods')} />
      </Field>
      {data.has_household_goods === 'yes' && (
        <Grid2>
          <Field label="Household Goods & Furniture (estimated total value)" prefilled={hasIntake && !!data.household_goods_value}>
            <AmountInput value={data.household_goods_value} onChange={f('household_goods_value')} prefilled={hasIntake && !!data.household_goods_value} />
          </Field>
          <Field label="Electronics (computers, TVs, phones, etc.)" prefilled={hasIntake && !!data.electronics_value}>
            <AmountInput value={data.electronics_value} onChange={f('electronics_value')} prefilled={hasIntake && !!data.electronics_value} />
          </Field>
          <Field label="Jewelry (estimated total value)" prefilled={hasIntake && !!data.jewelry_value}>
            <AmountInput value={data.jewelry_value} onChange={f('jewelry_value')} prefilled={hasIntake && !!data.jewelry_value} />
          </Field>
          <Field label="Tools / Equipment" prefilled={hasIntake && !!data.tools_value}>
            <AmountInput value={data.tools_value} onChange={f('tools_value')} prefilled={hasIntake && !!data.tools_value} />
          </Field>
        </Grid2>
      )}

      <SectionHeader title="Life Insurance" sub="Schedule A/B — Item 31" />
      <Field label="Do you have any life insurance policies?" required prefilled={hasIntake && !!data.has_life_insurance}>
        <YesNo value={data.has_life_insurance} onChange={f('has_life_insurance')} />
      </Field>
      {data.has_life_insurance === 'yes' && (
        <Grid2>
          <Field label="Policy Type" prefilled={hasIntake && !!data.life_policy_type}>
            <SelectInput value={data.life_policy_type || ''} onChange={f('life_policy_type')} placeholder="Select type"
              options={[
                { value: 'Term Life', label: 'Term Life (no cash value)' },
                { value: 'Whole Life', label: 'Whole Life' },
                { value: 'Universal Life', label: 'Universal Life' },
                { value: 'Other', label: 'Other' },
              ]}
              prefilled={hasIntake && !!data.life_policy_type}
            />
          </Field>
          <Field label="Face Value (death benefit)" prefilled={hasIntake && !!data.life_face_value}>
            <AmountInput value={data.life_face_value || ''} onChange={f('life_face_value')} prefilled={hasIntake && !!data.life_face_value} />
          </Field>
          <Field label="Cash Surrender Value" hint="Enter 0 if term policy" prefilled={hasIntake && !!data.life_cash_value}>
            <AmountInput value={data.life_cash_value || ''} onChange={f('life_cash_value')} prefilled={hasIntake && !!data.life_cash_value} />
          </Field>
          <Field label="Insurance Company" prefilled={hasIntake && !!data.life_insurer}>
            <TextInput value={data.life_insurer || ''} onChange={f('life_insurer')} placeholder="e.g. MetLife, Prudential" prefilled={hasIntake && !!data.life_insurer} />
          </Field>
          <Field label="Policy Number" prefilled={hasIntake && !!data.life_policy_number}>
            <TextInput value={data.life_policy_number || ''} onChange={f('life_policy_number')} placeholder="Policy #" prefilled={hasIntake && !!data.life_policy_number} />
          </Field>
        </Grid2>
      )}

      <SectionHeader title="Stocks, Bonds & Cryptocurrency" sub="Schedule A/B — Items 32–33" />
      <Field label="Do you own any stocks, bonds, mutual funds, or investment accounts?" required prefilled={hasIntake && !!data.has_stocks}>
        <YesNo value={data.has_stocks} onChange={f('has_stocks')} />
      </Field>
      {data.has_stocks === 'yes' && (
        <Grid2>
          <Field label="Total Value" prefilled={hasIntake && !!data.stocks_value}>
            <AmountInput value={data.stocks_value || ''} onChange={f('stocks_value')} prefilled={hasIntake && !!data.stocks_value} />
          </Field>
          <Field label="Description" prefilled={hasIntake && !!data.stocks_desc}>
            <TextInput value={data.stocks_desc || ''} onChange={f('stocks_desc')} placeholder="e.g. Fidelity brokerage account, Apple shares" prefilled={hasIntake && !!data.stocks_desc} />
          </Field>
        </Grid2>
      )}
      <Field label="Do you own any cryptocurrency? (Bitcoin, Ethereum, etc.)" required prefilled={hasIntake && !!data.has_crypto}>
        <YesNo value={data.has_crypto} onChange={f('has_crypto')} />
      </Field>
      {data.has_crypto === 'yes' && (
        <Grid2>
          <Field label="Total Value (USD)" prefilled={hasIntake && !!data.crypto_value}>
            <AmountInput value={data.crypto_value || ''} onChange={f('crypto_value')} prefilled={hasIntake && !!data.crypto_value} />
          </Field>
          <Field label="Description (wallets / exchanges)" prefilled={hasIntake && !!data.crypto_desc}>
            <TextInput value={data.crypto_desc || ''} onChange={f('crypto_desc')} placeholder="e.g. Coinbase — 0.25 BTC" prefilled={hasIntake && !!data.crypto_desc} />
          </Field>
        </Grid2>
      )}

      <SectionHeader title="Firearms" sub="Schedule A/B — Item 24" />
      <Field label="Do you own any firearms?" required prefilled={hasIntake && !!data.has_firearms}>
        <YesNo value={data.has_firearms} onChange={f('has_firearms')} />
      </Field>
      {data.has_firearms === 'yes' && (
        <>
          <div className="space-y-3 mb-3">
            {firearms.map((gun, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-slate-300 text-sm font-semibold">Firearm {i + 1}</p>
                  {firearms.length > 1 && (
                    <button onClick={() => setData({ ...data, firearms: firearms.filter((_, j) => j !== i) })}
                      className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
                <Grid2>
                  <Field label="Description (make, model, caliber)" prefilled={hasIntake && !!gun.description}>
                    <TextInput value={gun.description || ''} onChange={v => updateFirearm(i, 'description', v)} placeholder="e.g. Glock 19 9mm" prefilled={hasIntake && !!gun.description} />
                  </Field>
                  <Field label="Estimated Value">
                    <AmountInput value={gun.value || ''} onChange={v => updateFirearm(i, 'value', v)} />
                  </Field>
                  <Field label="Serial Number (if known)" prefilled={hasIntake && !!gun.serial_number}>
                    <TextInput value={gun.serial_number || ''} onChange={v => updateFirearm(i, 'serial_number', v)} placeholder="Serial #" prefilled={hasIntake && !!gun.serial_number} />
                  </Field>
                </Grid2>
              </div>
            ))}
          </div>
          <button onClick={() => setData({ ...data, firearms: [...firearms, { description: '', serial_number: '', value: '' }] })}
            className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mb-4">
            <Plus className="w-4 h-4" /> Add Firearm
          </button>
        </>
      )}

      <SectionHeader title="Collectibles & Other Property" sub="Schedule A/B — Items 25–39" />
      <Field label="Do you own any collectibles, antiques, art, or similar items?" required prefilled={hasIntake && !!data.has_collectibles}>
        <YesNo value={data.has_collectibles} onChange={f('has_collectibles')} />
      </Field>
      {data.has_collectibles === 'yes' && (
        <Grid2>
          <Field label="Estimated Total Value" prefilled={hasIntake && !!data.collectibles_value}>
            <AmountInput value={data.collectibles_value || ''} onChange={f('collectibles_value')} prefilled={hasIntake && !!data.collectibles_value} />
          </Field>
          <Field label="Description" prefilled={hasIntake && !!data.collectibles_desc}>
            <TextInput value={data.collectibles_desc || ''} onChange={f('collectibles_desc')} placeholder="Describe items" prefilled={hasIntake && !!data.collectibles_desc} />
          </Field>
        </Grid2>
      )}
      <Field label="Do you have any other personal property not listed above?" required prefilled={hasIntake && !!data.has_other_prop}>
        <YesNo value={data.has_other_prop} onChange={f('has_other_prop')} />
      </Field>
      {data.has_other_prop === 'yes' && (
        <Grid2>
          <Field label="Estimated Total Value" prefilled={hasIntake && !!data.other_prop_value}>
            <AmountInput value={data.other_prop_value || ''} onChange={f('other_prop_value')} prefilled={hasIntake && !!data.other_prop_value} />
          </Field>
          <Field label="Description" prefilled={hasIntake && !!data.other_prop_desc}>
            <TextInput value={data.other_prop_desc || ''} onChange={f('other_prop_desc')} placeholder="Describe" prefilled={hasIntake && !!data.other_prop_desc} />
          </Field>
        </Grid2>
      )}
    </div>
  );
}

// ── Step: Support & Claims ────────────────────────────────────────────────────

function StepSupport({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const f = (k: string) => (v: string) => setData({ ...data, [k]: v });

  return (
    <div>
      {hasIntake && <IntakeBadge />}
      <ConfirmBanner text="Confirm support obligations and any personal injury claims. Every 'No' answer must be confirmed. These affect your bankruptcy schedules and exemption analysis." />

      <SectionHeader title="Child Support" sub="Schedule E/F — Priority Debts" />
      <Field label="Are you required to pay child support?" required prefilled={hasIntake && !!data.child_support_current}>
        <YesNo value={data.child_support_current ? 'yes' : (data.child_support_current === '' ? '' : 'no')}
          onChange={v => f('child_support_current')(v === 'yes' ? 'current' : 'no')} />
      </Field>
      {(data.child_support_current && data.child_support_current !== 'no') && (
        <>
          <Field label="Are your child support payments current?" required>
            <SelectInput value={data.child_support_current} onChange={f('child_support_current')} placeholder="Select"
              options={[
                { value: 'current', label: 'Yes — current on all payments' },
                { value: 'behind', label: 'No — I am behind on payments' },
              ]}
              prefilled={hasIntake && !!data.child_support_current}
            />
          </Field>
          {data.child_support_current === 'behind' && (
            <Field label="Total Past-Due Amount (arrears)" prefilled={hasIntake && !!data.child_support_arrears_amount}>
              <AmountInput value={data.child_support_arrears_amount || ''} onChange={f('child_support_arrears_amount')} prefilled={hasIntake && !!data.child_support_arrears_amount} />
            </Field>
          )}
          {data.child_support_current === 'current' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border border-slate-600 rounded-lg mb-4">
              <CheckCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-400">Confirmed: current on all child support payments — no arrears.</span>
            </div>
          )}
        </>
      )}

      <SectionHeader title="Alimony / Spousal Support" sub="Schedule E/F — Priority Debts" />
      <Field label="Are you required to pay alimony or spousal support?" required prefilled={hasIntake && !!data.alimony_current}>
        <YesNo value={data.alimony_current ? 'yes' : (data.alimony_current === '' ? '' : 'no')}
          onChange={v => f('alimony_current')(v === 'yes' ? 'current' : 'no')} />
      </Field>
      {(data.alimony_current && data.alimony_current !== 'no') && (
        <>
          <Field label="Are your alimony payments current?" required>
            <SelectInput value={data.alimony_current} onChange={f('alimony_current')} placeholder="Select"
              options={[
                { value: 'current', label: 'Yes — current on all payments' },
                { value: 'behind', label: 'No — I am behind on payments' },
              ]}
              prefilled={hasIntake && !!data.alimony_current}
            />
          </Field>
          {data.alimony_current === 'behind' && (
            <Field label="Total Past-Due Amount (arrears)" prefilled={hasIntake && !!data.alimony_arrears_amount}>
              <AmountInput value={data.alimony_arrears_amount || ''} onChange={f('alimony_arrears_amount')} prefilled={hasIntake && !!data.alimony_arrears_amount} />
            </Field>
          )}
          {data.alimony_current === 'current' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border border-slate-600 rounded-lg mb-4">
              <CheckCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-400">Confirmed: current on all alimony payments — no arrears.</span>
            </div>
          )}
        </>
      )}

      <SectionHeader title="Personal Injury or Legal Claim" sub="Schedule A/B — Contingent Claims" />
      <Field label="Do you have any personal injury claims, accident claims, or other legal claims where you may receive money?"
        required prefilled={hasIntake && !!data.pi_has_claim}>
        <YesNo value={data.pi_has_claim} onChange={f('pi_has_claim')} />
      </Field>
      {data.pi_has_claim === 'yes' && (
        <>
          <Grid2>
            <Field label="Date of Incident" prefilled={hasIntake && !!data.pi_date_of_loss}>
              <TextInput type="date" value={data.pi_date_of_loss || ''} onChange={f('pi_date_of_loss')} prefilled={hasIntake && !!data.pi_date_of_loss} />
            </Field>
            <Field label="Incident Location" prefilled={hasIntake && !!data.pi_location}>
              <TextInput value={data.pi_location || ''} onChange={f('pi_location')} placeholder="City, State" prefilled={hasIntake && !!data.pi_location} />
            </Field>
          </Grid2>
          <Field label="Describe the incident" prefilled={hasIntake && !!data.pi_description}>
            <TextInput value={data.pi_description || ''} onChange={f('pi_description')} placeholder="Brief description of what happened" prefilled={hasIntake && !!data.pi_description} />
          </Field>
          <Field label="Were you physically injured?" required>
            <YesNo value={data.pi_injured} onChange={f('pi_injured')} />
          </Field>
          {data.pi_injured === 'yes' && (
            <Field label="Describe your injuries" prefilled={hasIntake && !!data.pi_injury_desc}>
              <TextInput value={data.pi_injury_desc || ''} onChange={f('pi_injury_desc')} placeholder="Nature and extent of injuries" prefilled={hasIntake && !!data.pi_injury_desc} />
            </Field>
          )}
          <Field label="Did you receive medical treatment?" required>
            <YesNo value={data.pi_treatment} onChange={f('pi_treatment')} />
          </Field>
          {data.pi_treatment === 'yes' && (
            <Field label="Medical Provider(s)" prefilled={hasIntake && !!data.pi_provider}>
              <TextInput value={data.pi_provider || ''} onChange={f('pi_provider')} placeholder="Hospital, doctor, or clinic name" prefilled={hasIntake && !!data.pi_provider} />
            </Field>
          )}
          <Field label="Was there property damage?" required>
            <YesNo value={data.pi_property_damage} onChange={f('pi_property_damage')} />
          </Field>
          {data.pi_property_damage === 'yes' && (
            <Field label="Describe property damage" prefilled={hasIntake && !!data.pi_property_damage_desc}>
              <TextInput value={data.pi_property_damage_desc || ''} onChange={f('pi_property_damage_desc')} placeholder="What was damaged and estimated value" prefilled={hasIntake && !!data.pi_property_damage_desc} />
            </Field>
          )}
          <Field label="Do you currently have an attorney for this claim?" required>
            <YesNo value={data.pi_has_attorney} onChange={f('pi_has_attorney')} />
          </Field>
          {data.pi_has_attorney === 'yes' && (
            <Field label="Attorney Name & Firm" prefilled={hasIntake && !!data.pi_attorney_name}>
              <TextInput value={data.pi_attorney_name || ''} onChange={f('pi_attorney_name')} placeholder="Attorney name and firm" prefilled={hasIntake && !!data.pi_attorney_name} />
            </Field>
          )}
        </>
      )}

      <SectionHeader title="Expected Tax Refund" sub="Schedule A/B — Non-exempt asset" />
      <Field label="Do you expect to receive a tax refund this year?" required prefilled={hasIntake && !!data.expected_refund}>
        <YesNoUnknown value={data.expected_refund} onChange={f('expected_refund')} />
      </Field>
      {data.expected_refund === 'yes' && (
        <Field label="Estimated Refund Amount" prefilled={hasIntake && !!data.refund_amount}>
          <AmountInput value={data.refund_amount || ''} onChange={f('refund_amount')} prefilled={hasIntake && !!data.refund_amount} />
        </Field>
      )}
    </div>
  );
}

// ── Step: Secured Creditors ───────────────────────────────────────────────────

function StepSecured({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const creditors: any[] = data.secured_creditors || [];

  function update(i: number, key: string, val: string) {
    const next = [...creditors];
    next[i] = { ...next[i], [key]: val };
    setData({ ...data, secured_creditors: next });
  }

  return (
    <div>
      {hasIntake && <IntakeBadge />}
      <ConfirmBanner text="Review all secured creditors pre-filled from your intake (mortgages and auto loans). Confirm the current balance, whether payments are current, your monthly payment, and the lender name. Add any additional secured debts (e.g. tax liens, HOA, other liens)." />

      {creditors.length === 0 && (
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 text-center mb-4">
          <p className="text-slate-400 text-sm">No secured creditors were identified from your intake. If you have any secured debts, add them below.</p>
        </div>
      )}

      <div className="space-y-4 mb-3">
        {creditors.map((cred, i) => (
          <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-white font-bold text-sm">Secured Creditor {i + 1}</p>
                {(cred.collateral_type === 'real_estate' || cred.collateral_type === 'vehicle') && (
                  <span className="text-xs bg-amber-400/15 text-amber-400 px-2 py-0.5 rounded-full border border-amber-400/25">
                    {cred.collateral_type === 'real_estate' ? 'Mortgage' : 'Auto Loan'} — from intake
                  </span>
                )}
              </div>
              <button onClick={() => setData({ ...data, secured_creditors: creditors.filter((_, j) => j !== i) })}
                className="text-slate-500 hover:text-red-400 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <Grid2>
              <Field label="Creditor / Lender Name" required prefilled={hasIntake && !!cred.creditor_name}>
                <TextInput value={cred.creditor_name} onChange={v => update(i, 'creditor_name', v)} placeholder="Lender name" prefilled={hasIntake && !!cred.creditor_name} />
              </Field>
              <Field label="Collateral / What Secures the Debt" required prefilled={hasIntake && !!cred.collateral}>
                <TextInput value={cred.collateral} onChange={v => update(i, 'collateral', v)} placeholder="e.g. Primary Residence, 2020 Toyota Camry" prefilled={hasIntake && !!cred.collateral} />
              </Field>
              <Field label="Current Balance Owed" required prefilled={hasIntake && !!cred.current_balance}>
                <AmountInput value={cred.current_balance} onChange={v => update(i, 'current_balance', v)} prefilled={hasIntake && !!cred.current_balance} />
              </Field>
              <Field label="Monthly Payment" required prefilled={hasIntake && !!cred.monthly_payment}>
                <AmountInput value={cred.monthly_payment} onChange={v => update(i, 'monthly_payment', v)} prefilled={hasIntake && !!cred.monthly_payment} />
              </Field>
              <Field label="Are payments current?" required>
                <SelectInput value={cred.is_current} onChange={v => update(i, 'is_current', v)} placeholder="Select"
                  options={[{ value: 'yes', label: 'Yes — current' }, { value: 'no', label: 'No — behind' }]}
                  prefilled={hasIntake && !!cred.is_current}
                />
              </Field>
              {cred.is_current === 'no' && (
                <Field label="Amount Past Due / Arrears">
                  <AmountInput value={cred.arrears} onChange={v => update(i, 'arrears', v)} />
                </Field>
              )}
              <Field label="Account Last 4 Digits" hint="Last 4 of your loan/account number">
                <TextInput value={cred.account_last4 || ''} onChange={v => update(i, 'account_last4', v.replace(/\D/g,'').slice(0,4))} placeholder="XXXX" prefilled={hasIntake && !!cred.account_last4} />
              </Field>
            </Grid2>
          </div>
        ))}
      </div>

      <button onClick={() => setData({ ...data, secured_creditors: [...creditors, {
        creditor_name: '', collateral: '', collateral_type: 'other',
        current_balance: '', monthly_payment: '', is_current: '', arrears: '', account_last4: '',
      }]})}
        className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mb-4">
        <Plus className="w-4 h-4" /> Add Secured Creditor
      </button>

      <DocNote items={creditors.filter(c => c.creditor_name).map(c =>
        `Most recent statement — ${c.creditor_name} (${c.collateral || 'secured debt'})`
      )} />
    </div>
  );
}

// ── Step: Unsecured Debts ─────────────────────────────────────────────────────

function StepUnsecured({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const f = (k: string) => (v: string) => setData({ ...data, [k]: v });
  const creditors: any[] = data.creditors || [];

  function updateCred(i: number, key: string, val: string) {
    const next = [...creditors];
    next[i] = { ...next[i], [key]: val };
    setData({ ...data, creditors: next });
  }

  return (
    <div>
      {hasIntake && <IntakeBadge />}
      <ConfirmBanner text="Confirm your unsecured debts. The totals from your intake are pre-filled. Add individual creditor details below — each creditor name, account number last 4, and balance is needed for your petition." />

      <SectionHeader title="Unsecured Debt Totals" sub="Confirm or update balances from your intake" />
      <Grid2>
        <Field label="Credit Card Debt (total)" prefilled={hasIntake && !!data.credit_card_total}>
          <AmountInput value={data.credit_card_total} onChange={f('credit_card_total')} prefilled={hasIntake && !!data.credit_card_total} />
        </Field>
        <Field label="Medical Debt (total)" prefilled={hasIntake && !!data.medical_total}>
          <AmountInput value={data.medical_total} onChange={f('medical_total')} prefilled={hasIntake && !!data.medical_total} />
        </Field>
        <Field label="Personal Loans (total)" prefilled={hasIntake && !!data.personal_loan_total}>
          <AmountInput value={data.personal_loan_total} onChange={f('personal_loan_total')} prefilled={hasIntake && !!data.personal_loan_total} />
        </Field>
        <Field label="Student Loans (total)" prefilled={hasIntake && !!data.student_loan_total}>
          <AmountInput value={data.student_loan_total} onChange={f('student_loan_total')} prefilled={hasIntake && !!data.student_loan_total} />
        </Field>
        <Field label="Tax Debt (total)" prefilled={hasIntake && !!data.tax_debt_total}>
          <AmountInput value={data.tax_debt_total} onChange={f('tax_debt_total')} prefilled={hasIntake && !!data.tax_debt_total} />
        </Field>
        <Field label="Judgments (total)" prefilled={hasIntake && !!data.judgment_total}>
          <AmountInput value={data.judgment_total} onChange={f('judgment_total')} prefilled={hasIntake && !!data.judgment_total} />
        </Field>
        <Field label="Other Unsecured Debt (total)" prefilled={hasIntake && !!data.other_unsecured_total}>
          <AmountInput value={data.other_unsecured_total} onChange={f('other_unsecured_total')} prefilled={hasIntake && !!data.other_unsecured_total} />
        </Field>
      </Grid2>

      <SectionHeader title="Business Debts" />
      <Field label="Do you have any business debts?" prefilled={hasIntake && !!data.has_business_debt}>
        <YesNo value={data.has_business_debt} onChange={f('has_business_debt')} />
      </Field>
      {data.has_business_debt === 'yes' && (
        <Grid2>
          <Field label="Business Line of Credit" prefilled={hasIntake && !!data.business_line_debt}>
            <AmountInput value={data.business_line_debt} onChange={f('business_line_debt')} prefilled={hasIntake && !!data.business_line_debt} />
          </Field>
          <Field label="Business Credit Cards" prefilled={hasIntake && !!data.business_cc_debt}>
            <AmountInput value={data.business_cc_debt} onChange={f('business_cc_debt')} prefilled={hasIntake && !!data.business_cc_debt} />
          </Field>
          <Field label="Other Business Debt" prefilled={hasIntake && !!data.business_other_debt}>
            <AmountInput value={data.business_other_debt} onChange={f('business_other_debt')} prefilled={hasIntake && !!data.business_other_debt} />
          </Field>
          <Field label="Description of Business Debts" prefilled={hasIntake && !!data.business_debt_desc}>
            <TextInput value={data.business_debt_desc} onChange={f('business_debt_desc')} placeholder="Brief description of business debts" prefilled={hasIntake && !!data.business_debt_desc} />
          </Field>
        </Grid2>
      )}

      <SectionHeader title="Individual Creditors" sub="List each creditor individually — required for Schedule E/F" />
      <p className="text-slate-400 text-xs mb-4 leading-relaxed">
        List each creditor separately. You can leave creditor name blank if unknown — but provide as much detail as possible.
      </p>

      <div className="space-y-3 mb-3">
        {creditors.map((cred, i) => (
          <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-300 text-sm font-semibold">Creditor {i + 1}</p>
              <button onClick={() => setData({ ...data, creditors: creditors.filter((_, j) => j !== i) })}
                className="text-slate-500 hover:text-red-400 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <Grid2>
              <Field label="Creditor Name">
                <TextInput value={cred.creditor_name} onChange={v => updateCred(i, 'creditor_name', v)} placeholder="e.g. Chase, Mayo Clinic" />
              </Field>
              <Field label="Debt Type">
                <SelectInput value={cred.debt_type} onChange={v => updateCred(i, 'debt_type', v)} placeholder="Select type"
                  options={[
                    { value: 'credit_card', label: 'Credit Card' },
                    { value: 'medical', label: 'Medical' },
                    { value: 'personal_loan', label: 'Personal Loan' },
                    { value: 'student_loan', label: 'Student Loan' },
                    { value: 'tax', label: 'Tax Debt' },
                    { value: 'judgment', label: 'Judgment' },
                    { value: 'utility', label: 'Utility / Service' },
                    { value: 'business', label: 'Business Debt' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
              </Field>
              <Field label="Balance Owed">
                <AmountInput value={cred.balance} onChange={v => updateCred(i, 'balance', v)} />
              </Field>
              <Field label="Account Last 4 Digits" hint="If known">
                <TextInput value={cred.account_last4 || ''} onChange={v => updateCred(i, 'account_last4', v.replace(/\D/g,'').slice(0,4))} placeholder="XXXX" />
              </Field>
            </Grid2>
          </div>
        ))}
      </div>
      <button onClick={() => setData({ ...data, creditors: [...creditors, { creditor_name: '', debt_type: '', balance: '', account_last4: '' }] })}
        className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" /> Add Creditor
      </button>
    </div>
  );
}

// ── Step: Income ──────────────────────────────────────────────────────────────

function StepIncome({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const sources: any[] = data.employment_sources || [];
  const f = (k: string) => (v: string) => setData({ ...data, [k]: v });

  function updateSource(i: number, key: string, val: string) {
    const next = [...sources];
    next[i] = { ...next[i], [key]: val };
    setData({ ...data, employment_sources: next });
  }

  return (
    <div>
      {hasIntake && <IntakeBadge />}
      <ConfirmBanner text="Confirm all income sources. Include all employment, self-employment, and other income. If amounts have changed since your intake, update them here." />

      <SectionHeader title="Employment & Business Income" />
      {sources.length > 0 ? (
        <div className="space-y-4 mb-3">
          {sources.map((src, i) => (
            <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-300 text-sm font-semibold mb-3">
                {src.type === 'selfEmployment' ? 'Self-Employment' : 'Employment'} {i + 1}{src.employer ? ` — ${src.employer}` : ''}
              </p>
              <Grid2>
                <Field label="Employer / Business Name" prefilled={hasIntake && !!src.employer}>
                  <TextInput value={src.employer} onChange={v => updateSource(i, 'employer', v)} placeholder="Employer name" prefilled={hasIntake && !!src.employer} />
                </Field>
                <Field label="Income Type">
                  <SelectInput value={src.type} onChange={v => updateSource(i, 'type', v)} placeholder="Select"
                    options={[
                      { value: 'employment', label: 'W-2 Employment' },
                      { value: 'selfEmployment', label: 'Self-Employment / Business' },
                    ]}
                    prefilled={hasIntake && !!src.type}
                  />
                </Field>
                <Field label="Gross Monthly Income" prefilled={hasIntake && !!src.gross_monthly}>
                  <AmountInput value={src.gross_monthly} onChange={v => updateSource(i, 'gross_monthly', v)} prefilled={hasIntake && !!src.gross_monthly} />
                </Field>
                <Field label="Net Monthly Income (take-home)" prefilled={hasIntake && !!src.net_monthly}>
                  <AmountInput value={src.net_monthly} onChange={v => updateSource(i, 'net_monthly', v)} prefilled={hasIntake && !!src.net_monthly} />
                </Field>
              </Grid2>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500 text-sm mb-4">No employment sources from intake. Add below if applicable.</p>
      )}
      <button onClick={() => setData({ ...data, employment_sources: [...sources, { employer: '', type: 'employment', gross_monthly: '', net_monthly: '' }] })}
        className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mb-5">
        <Plus className="w-4 h-4" /> Add Income Source
      </button>

      <SectionHeader title="Other Income" />
      <Grid2>
        <Field label="Rental Income (monthly)" prefilled={hasIntake && !!data.rental_income}>
          <AmountInput value={data.rental_income} onChange={f('rental_income')} prefilled={hasIntake && !!data.rental_income} />
        </Field>
        <Field label="Other Income (monthly)" prefilled={hasIntake && !!data.other_income}>
          <AmountInput value={data.other_income} onChange={f('other_income')} prefilled={hasIntake && !!data.other_income} />
        </Field>
        <Field label="Other Income Description" prefilled={hasIntake && !!data.other_income_desc}>
          <TextInput value={data.other_income_desc} onChange={f('other_income_desc')} placeholder="Describe other income" prefilled={hasIntake && !!data.other_income_desc} />
        </Field>
      </Grid2>
    </div>
  );
}

// ── Step: Expenses ────────────────────────────────────────────────────────────

function StepExpenses({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const f = (k: string) => (v: string) => setData({ ...data, [k]: v });
  return (
    <div>
      {hasIntake && <IntakeBadge />}
      <ConfirmBanner text="Confirm your monthly expenses. Update any amounts that have changed since your intake." />
      <Grid2>
        {[
          ['rent_mortgage', 'Rent / Mortgage'],
          ['electric_gas', 'Electric / Gas'],
          ['water_sewer', 'Water / Sewer'],
          ['phone', 'Phone'],
          ['internet', 'Internet'],
          ['food', 'Food / Groceries'],
          ['clothing', 'Clothing'],
          ['personal_care', 'Personal Care'],
          ['transportation', 'Gas / Transportation'],
          ['car_insurance', 'Vehicle Insurance'],
          ['health_insurance', 'Health Insurance'],
          ['medical', 'Medical / Dental'],
          ['childcare', 'Childcare / Education'],
          ['other', 'Other Monthly Expenses'],
        ].map(([key, label]) => (
          <Field key={key} label={`${label} (monthly)`} prefilled={hasIntake && !!data[key]}>
            <AmountInput value={data[key]} onChange={f(key)} prefilled={hasIntake && !!data[key]} />
          </Field>
        ))}
      </Grid2>
    </div>
  );
}

// ── Step: Financial History ───────────────────────────────────────────────────

function StepHistory({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const f = (k: string) => (v: string) => setData({ ...data, [k]: v });
  return (
    <div>
      {hasIntake && <IntakeBadge />}
      <ConfirmBanner text="This section covers your financial history. Every question must be answered — if you previously answered No, please confirm your answer still stands." />

      <SectionHeader title="Prior Bankruptcy" />
      <Field label="Have you filed for bankruptcy before?" prefilled={hasIntake && !!data.filed_before}>
        <YesNo value={data.filed_before} onChange={f('filed_before')} />
      </Field>
      {data.filed_before === 'yes' && (
        <Field label="Prior Bankruptcy Details" hint="Include chapter, year filed, and district for each prior case.">
          <TextInput value={data.prior_bankruptcy_details} onChange={f('prior_bankruptcy_details')} placeholder="e.g. Chapter 7, 2018, District of Arizona" prefilled={hasIntake && !!data.prior_bankruptcy_details} />
        </Field>
      )}

      <SectionHeader title="Lawsuits & Legal Actions" />
      <Field label="Are you currently a party to any lawsuits or legal proceedings?" prefilled={hasIntake && !!data.has_lawsuits}>
        <YesNo value={data.has_lawsuits} onChange={f('has_lawsuits')} />
      </Field>
      {data.has_lawsuits === 'yes' && (
        <Field label="Describe the lawsuit(s)" hint="Include parties, court, and nature of the claim.">
          <TextInput value={data.lawsuit_details} onChange={f('lawsuit_details')} placeholder="Parties involved, nature of claim, court" prefilled={hasIntake && !!data.lawsuit_details} />
        </Field>
      )}

      <SectionHeader title="Property Transfers" />
      <Field label="In the last 2 years, have you transferred or given away any property?" hint="Includes gifts, sales below market value, or transfers to family members."
        prefilled={hasIntake && !!data.has_recent_transfers}>
        <YesNo value={data.has_recent_transfers} onChange={f('has_recent_transfers')} />
      </Field>
      {data.has_recent_transfers === 'yes' && (
        <Field label="Describe the transfer(s)" hint="What was transferred, to whom, when, and for how much.">
          <TextInput value={data.transfer_details} onChange={f('transfer_details')} placeholder="Property description, recipient, date, amount received" prefilled={hasIntake && !!data.transfer_details} />
        </Field>
      )}

      <SectionHeader title="Preferential Payments to Creditors (Last 90 Days)" sub="Payments to regular creditors within 90 days before filing may be considered preferential." />
      <Field label="In the last 90 days, have you made any payments totaling more than $600 to any single creditor?" prefilled={hasIntake && !!data.preferential_payments}>
        <YesNo value={data.preferential_payments} onChange={f('preferential_payments')} noLabel="No — I have not" />
      </Field>
      {data.preferential_payments === 'yes' && (
        <Field label="Describe the payment(s)" hint="Include creditor name, amount paid, and date.">
          <TextInput value={data.preferential_payment_details} onChange={f('preferential_payment_details')} placeholder="Creditor, amount, date of payment" prefilled={hasIntake && !!data.preferential_payment_details} />
        </Field>
      )}

      <SectionHeader title="Preferential Payments to Insiders (Last 1 Year)" sub="Payments to family members, business partners, or other insiders within 1 year before filing." />
      <Field label="In the last year, have you made any payments to a family member, relative, or business associate?" prefilled={hasIntake && !!data.preferential_insider}>
        <YesNo value={data.preferential_insider} onChange={f('preferential_insider')} noLabel="No — I have not" />
      </Field>
      {data.preferential_insider === 'yes' && (
        <Field label="Describe the payment(s)" hint="Include recipient name, relationship, amount, and date.">
          <TextInput value={data.preferential_insider_details} onChange={f('preferential_insider_details')} placeholder="Recipient, relationship, amount, date" prefilled={hasIntake && !!data.preferential_insider_details} />
        </Field>
      )}

      <SectionHeader title="Recent Luxury Purchases or Cash Advances" sub="Luxury purchases over $725 or cash advances over $1,000 within 90 days may be non-dischargeable." />
      <Field label="In the last 90 days, did you make any luxury purchases over $725 or take any cash advances over $1,000?" prefilled={hasIntake && !!data.recent_luxury}>
        <YesNo value={data.recent_luxury} onChange={f('recent_luxury')} noLabel="No — I have not" />
      </Field>
      {data.recent_luxury === 'yes' && (
        <Field label="Describe the purchase(s) or advance(s)">
          <TextInput value={data.luxury_details} onChange={f('luxury_details')} placeholder="Item purchased or advance taken, amount, date" prefilled={hasIntake && !!data.luxury_details} />
        </Field>
      )}

      <SectionHeader title="Garnishments & Foreclosure" />
      <Field label="Have you had any wages garnished in the last year?" prefilled={hasIntake && !!data.has_garnishments}>
        <YesNo value={data.has_garnishments} onChange={f('has_garnishments')} />
      </Field>
      {data.has_garnishments === 'yes' && (
        <Field label="Describe the garnishment(s)" hint="Include creditor name and monthly amount.">
          <TextInput value={data.garnishment_details} onChange={f('garnishment_details')} placeholder="Creditor name and amount" prefilled={hasIntake && !!data.garnishment_details} />
        </Field>
      )}
      <Field label="Is there a pending foreclosure on your home?" prefilled={hasIntake && !!data.foreclosure_pending}>
        <YesNoUnknown value={data.foreclosure_pending} onChange={f('foreclosure_pending')} />
      </Field>
      {data.foreclosure_pending === 'yes' && (
        <Field label="Expected Foreclosure Sale Date (if known)">
          <TextInput value={data.foreclosure_date} onChange={f('foreclosure_date')} placeholder="MM/DD/YYYY or 'unknown'" prefilled={hasIntake && !!data.foreclosure_date} />
        </Field>
      )}

      <SectionHeader title="Trusts" />
      <Field label="In the last 10 years, have you created or transferred assets into a trust?" prefilled={hasIntake && !!data.created_trust}>
        <YesNo value={data.created_trust} onChange={f('created_trust')} noLabel="No — I have not" />
      </Field>
      {data.created_trust === 'yes' && (
        <Field label="Describe the trust" hint="Include trust name, date created, and assets transferred.">
          <TextInput value={data.trust_details} onChange={f('trust_details')} placeholder="Trust name, date, assets involved" prefilled={hasIntake && !!data.trust_details} />
        </Field>
      )}

      <SectionHeader title="Business Ownership" />
      <Field label="In the last 4 years, have you owned, operated, or been an officer of any business?" prefilled={hasIntake && !!data.owned_business}>
        <YesNo value={data.owned_business} onChange={f('owned_business')} noLabel="No — I have not" />
      </Field>
      {data.owned_business === 'yes' && (
        <Field label="Describe the business" hint="Include business name, type, your role, and dates of operation.">
          <TextInput value={data.business_details} onChange={f('business_details')} placeholder="Business name, type (LLC, sole prop, etc.), your role, dates" prefilled={hasIntake && !!data.business_details} />
        </Field>
      )}

      <SectionHeader title="Domestic Support Obligations" sub="Child support, alimony, or other court-ordered support payments." />
      <Field label="Do you currently owe any domestic support obligation (child support, alimony, etc.)?" prefilled={hasIntake && !!data.dso_obligation}>
        <YesNo value={data.dso_obligation} onChange={f('dso_obligation')} noLabel="No — I do not" />
      </Field>
      {data.dso_obligation === 'yes' && (
        <Grid2>
          <Field label="Monthly DSO Amount">
            <AmountInput value={data.dso_amount} onChange={f('dso_amount')} prefilled={hasIntake && !!data.dso_amount} />
          </Field>
          <Field label="Recipient / Payee">
            <TextInput value={data.dso_recipient} onChange={f('dso_recipient')} placeholder="Name of recipient" />
          </Field>
        </Grid2>
      )}
    </div>
  );
}

// ── Step: Document Checklist ──────────────────────────────────────────────────

function StepDocuments({ allData }: { allData: Record<string, StepData> }) {
  const real_estate = allData.real_estate || {};
  const vehicles = allData.vehicles || {};
  const bank_accts = allData.bank_accts || {};
  const retirement = allData.retirement || {};
  const secured = allData.secured || {};

  const ACCT_TYPE_LABELS: Record<string, string> = {
    checking: 'Checking', savings: 'Savings', money_market: 'Money Market',
    cd: 'CD', credit_union_share: 'Credit Union Share', brokerage: 'Brokerage', other: 'Account',
  };

  const RET_TYPE_LABELS: Record<string, string> = {
    '401k': '401(k)', '403b': '403(b)', ira: 'Traditional IRA', roth_ira: 'Roth IRA',
    pension: 'Pension', sep_ira: 'SEP IRA', simple_ira: 'SIMPLE IRA',
    inherited_ira: 'Inherited IRA', annuity: 'Annuity', other: 'Retirement Account',
  };

  const sections: { title: string; items: string[] }[] = [];

  // Mortgage statements
  const mortgageItems = (real_estate.properties || []).filter((p: any) => p.lender || p.mortgage_balance)
    .map((p: any) => `Most recent mortgage statement — ${p.lender || 'mortgage lender'} (${p.address || 'property'})`);
  if (mortgageItems.length) sections.push({ title: 'Mortgage Statements', items: mortgageItems });

  // Auto loan statements
  const autoItems = (vehicles.vehicles || []).filter((v: any) => v.has_loan === 'yes' && v.lender)
    .map((v: any) => `Most recent loan statement — ${v.lender} (${v.year || ''} ${v.make || ''} ${v.model || ''})`.trim());
  if (autoItems.length) sections.push({ title: 'Auto Loan Statements', items: autoItems });

  // Other secured creditor statements
  const otherSecured = (secured.secured_creditors || [])
    .filter((c: any) => c.creditor_name && c.collateral_type !== 'real_estate' && c.collateral_type !== 'vehicle')
    .map((c: any) => `Most recent statement — ${c.creditor_name} (${c.collateral || 'secured debt'})`);
  if (otherSecured.length) sections.push({ title: 'Other Secured Creditor Statements', items: otherSecured });

  // Bank statements — 6 months each
  const bankItems = (bank_accts.accounts || []).filter((a: any) => a.institution)
    .map((a: any) => {
      const typeLabel = ACCT_TYPE_LABELS[a.account_type] || a.account_type || 'Account';
      return `Last 6 months of bank statements — ${a.institution} ${typeLabel}${a.last4 ? ` x${a.last4}` : ''}`;
    });
  if (bankItems.length) sections.push({ title: 'Bank Statements (6 Months Each)', items: bankItems });

  // Closed account closing statements
  if (bank_accts.has_closed_accounts === 'yes') {
    const closedItems = (bank_accts.closed_accounts || []).filter((a: any) => a.institution).map((a: any) => {
      const typeLabel = ACCT_TYPE_LABELS[a.account_type] || 'Account';
      return `Account closing statement — ${a.institution} ${typeLabel}${a.last4 ? ` x${a.last4}` : ''}${a.closed_date ? ` (closed ${a.closed_date})` : ''}`;
    });
    if (closedItems.length) sections.push({ title: 'Closed Account Closing Statements', items: closedItems });
  }

  // Retirement statements
  const retItems = (retirement.retirement_accounts || []).filter((r: any) => r.institution).map((r: any) => {
    const typeLabel = RET_TYPE_LABELS[r.account_type] || r.account_type || 'Retirement Account';
    return `Most recent statement — ${r.institution} ${typeLabel}`;
  });
  if (retItems.length) sections.push({ title: 'Retirement & Investment Statements', items: retItems });

  // Benefit award letters
  const benefitItems: string[] = [];
  if (retirement.has_ss_income === 'yes') benefitItems.push('Social Security Award Letter (most recent)');
  if (retirement.has_pension === 'yes') benefitItems.push(`Pension statement — ${retirement.pension_source || 'pension provider'} (most recent)`);
  if (retirement.has_veterans === 'yes') benefitItems.push('VA Award Letter (most recent)');
  if (benefitItems.length) sections.push({ title: 'Benefit Award Letters', items: benefitItems });

  // Always required
  sections.push({
    title: 'Always Required',
    items: [
      'Last 2 years of federal tax returns (personal)',
      'Last 2 most recent pay stubs (for each employer)',
      'Completed credit counseling certificate (required before filing)',
      'Government-issued photo ID',
      'Social Security card or proof of SSN',
    ],
  });

  return (
    <div>
      <ConfirmBanner text="Based on your answers, here is your personalized document checklist. Please gather these documents and upload them through your portal. Your attorney cannot file your petition until all required documents are received." />

      {sections.map((section, si) => (
        <div key={si} className="mb-6">
          <SectionHeader title={section.title} />
          <div className="space-y-2">
            {section.items.map((item, ii) => (
              <div key={ii} className="flex items-start gap-3 bg-slate-800/40 border border-slate-700 rounded-xl px-4 py-3">
                <FileText className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-slate-300 text-sm leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 mt-4 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-blue-300/90 text-sm leading-relaxed">
          Upload all documents through the Documents section of your dashboard. Do not email or mail physical documents. Contact our office if you have trouble obtaining any item on this list.
        </p>
      </div>
    </div>
  );
}

// ── Step: Review ──────────────────────────────────────────────────────────────

function StepReview({ allData }: { allData: Record<string, StepData> }) {
  const personal = allData.personal || {};
  const real_estate = allData.real_estate || {};
  const vehicles = allData.vehicles || {};
  const bank_accts = allData.bank_accts || {};
  const retirement = allData.retirement || {};
  const personal_property = allData.personal_property || {};
  const secured = allData.secured || {};
  const unsecured = allData.unsecured || {};
  const support = allData.support || {};
  const income = allData.income || {};
  const history = allData.history || {};

  function Card({ title, rows }: { title: string; rows: [string, string][] }) {
    const visible = rows.filter(([, v]) => v);
    if (!visible.length) return null;
    return (
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 mb-4">
        <h4 className="text-amber-400 font-bold text-xs uppercase tracking-wider mb-3">{title}</h4>
        <div className="space-y-1.5">
          {visible.map(([label, value], i) => (
            <div key={i} className="flex items-start justify-between gap-4 text-sm">
              <span className="text-slate-500">{label}</span>
              <span className="text-slate-300 text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalUnsecured = [
    unsecured.credit_card_total, unsecured.medical_total, unsecured.personal_loan_total,
    unsecured.student_loan_total, unsecured.tax_debt_total, unsecured.judgment_total, unsecured.other_unsecured_total,
  ].reduce((sum, v) => sum + (parseFloat(v || '0') || 0), 0);

  return (
    <div>
      <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-4 mb-6 flex items-start gap-2">
        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        <p className="text-emerald-300/90 text-sm leading-relaxed">
          You are almost done! Review the summary below and then submit. Our team will be notified and will contact you with next steps.
        </p>
      </div>

      <Card title="Personal Information" rows={[
        ['Name', `${personal.first_name || ''} ${personal.last_name || ''}`.trim()],
        ['Address', `${personal.city || ''}, ${personal.state || ''}`.trim().replace(/^,\s*/, '')],
        ['Phone', personal.phone || ''],
        ['Email', personal.email || ''],
      ]} />

      <Card title="Real Estate" rows={[
        ['Owns Real Estate', real_estate.owns_real_estate === 'yes' ? `${(real_estate.properties || []).length} propert${(real_estate.properties || []).length === 1 ? 'y' : 'ies'}` : 'No'],
        ...(real_estate.properties || []).flatMap((p: any, i: number) => [
          [`Property ${i + 1}`, p.address || ''],
          [`Value`, p.value ? `$${Number(p.value).toLocaleString()}` : ''],
          [`Mortgage Balance`, p.mortgage_balance ? `$${Number(p.mortgage_balance).toLocaleString()}` : ''],
          [`Lender`, p.lender || ''],
        ]) as [string, string][],
      ]} />

      <Card title="Vehicles" rows={[
        ['Has Vehicles', vehicles.has_vehicles === 'yes' ? `${(vehicles.vehicles || []).length} vehicle(s)` : 'No'],
        ...(vehicles.vehicles || []).flatMap((v: any, i: number) => [
          [`Vehicle ${i + 1}`, `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim()],
          ['Loan Balance', v.loan_balance ? `$${Number(v.loan_balance).toLocaleString()}` : ''],
          ['Lender', v.lender || ''],
        ]) as [string, string][],
      ]} />

      <Card title="Bank & Financial Accounts" rows={[
        ['Has Accounts', bank_accts.has_bank_accounts === 'yes' ? `${(bank_accts.accounts || []).length} account(s)` : 'No'],
        ...(bank_accts.accounts || []).map((a: any) => [
          a.institution || 'Account', `${a.account_type || ''} — $${Number(a.balance || 0).toLocaleString()}${a.last4 ? ` x${a.last4}` : ''}`,
        ] as [string, string]),
        ['Closed Accounts', bank_accts.has_closed_accounts === 'yes' ? `${(bank_accts.closed_accounts || []).length} reported` : 'None'],
      ]} />

      <Card title="Retirement & Benefits" rows={[
        ['Retirement Accounts', retirement.has_retirement === 'yes' ? `${(retirement.retirement_accounts || []).length} account(s)` : 'None'],
        ['Social Security', retirement.has_ss_income === 'yes' ? `$${Number(retirement.ss_monthly || 0).toLocaleString()}/mo` : 'No'],
        ['Pension', retirement.has_pension === 'yes' ? `$${Number(retirement.pension_monthly || 0).toLocaleString()}/mo` : 'No'],
        ['VA Benefits', retirement.has_veterans === 'yes' ? `$${Number(retirement.veterans_monthly || 0).toLocaleString()}/mo` : 'No'],
      ]} />

      <Card title="Secured Creditors" rows={[
        ['Total Secured Creditors', `${(secured.secured_creditors || []).length}`],
        ...(secured.secured_creditors || []).map((c: any) => [
          c.creditor_name || 'Creditor', `$${Number(c.current_balance || 0).toLocaleString()} — ${c.is_current === 'yes' ? 'Current' : c.is_current === 'no' ? 'Behind' : ''}`,
        ] as [string, string]),
      ]} />

      <Card title="Unsecured Debt Summary" rows={[
        ['Credit Cards', unsecured.credit_card_total ? `$${Number(unsecured.credit_card_total).toLocaleString()}` : ''],
        ['Medical', unsecured.medical_total ? `$${Number(unsecured.medical_total).toLocaleString()}` : ''],
        ['Personal Loans', unsecured.personal_loan_total ? `$${Number(unsecured.personal_loan_total).toLocaleString()}` : ''],
        ['Student Loans', unsecured.student_loan_total ? `$${Number(unsecured.student_loan_total).toLocaleString()}` : ''],
        ['Tax Debt', unsecured.tax_debt_total ? `$${Number(unsecured.tax_debt_total).toLocaleString()}` : ''],
        ['Business Debt', unsecured.has_business_debt === 'yes' ? `Yes — see details` : ''],
        ['Total Unsecured', totalUnsecured > 0 ? `$${totalUnsecured.toLocaleString()}` : ''],
      ]} />

      <Card title="Personal Property" rows={[
        ['Household Goods', personal_property.has_household_goods === 'yes' ? `Est. $${Number(personal_property.household_goods_value || 0).toLocaleString()}` : 'None'],
        ['Jewelry', personal_property.jewelry_value ? `Est. $${Number(personal_property.jewelry_value).toLocaleString()}` : ''],
        ['Life Insurance', personal_property.has_life_insurance === 'yes' ? `${personal_property.life_policy_type || 'Policy'} — Cash Value: $${Number(personal_property.life_cash_value || 0).toLocaleString()}` : 'None'],
        ['Stocks / Investments', personal_property.has_stocks === 'yes' ? `$${Number(personal_property.stocks_value || 0).toLocaleString()}` : 'None'],
        ['Cryptocurrency', personal_property.has_crypto === 'yes' ? `$${Number(personal_property.crypto_value || 0).toLocaleString()}` : 'None'],
        ['Firearms', personal_property.has_firearms === 'yes' ? `${(personal_property.firearms || []).length} firearm(s)` : 'None'],
        ['Collectibles', personal_property.has_collectibles === 'yes' ? `$${Number(personal_property.collectibles_value || 0).toLocaleString()}` : 'None'],
        ['Other Property', personal_property.has_other_prop === 'yes' ? `$${Number(personal_property.other_prop_value || 0).toLocaleString()}` : 'None'],
      ]} />

      <Card title="Support & Claims" rows={[
        ['Child Support (Current)', support.child_support_current === 'yes' ? 'Yes — currently paying' : support.child_support_current === 'no' ? 'No obligation' : ''],
        ['Child Support Arrears', support.child_support_arrears === 'yes' ? `$${Number(support.child_support_arrears_amount || 0).toLocaleString()} owed` : 'None'],
        ['Alimony (Current)', support.alimony_current === 'yes' ? 'Yes — currently paying' : support.alimony_current === 'no' ? 'No obligation' : ''],
        ['Alimony Arrears', support.alimony_arrears === 'yes' ? `$${Number(support.alimony_arrears_amount || 0).toLocaleString()} owed` : 'None'],
        ['Personal Injury Claim', support.pi_has_claim === 'yes' ? `Yes — ${support.pi_description || 'pending claim'}` : 'None'],
        ['Expected Tax Refund', support.expected_refund === 'yes' ? `$${Number(support.refund_amount || 0).toLocaleString()} expected` : support.expected_refund === 'unknown' ? 'Unknown' : 'None'],
      ]} />

      <Card title="Employment Income" rows={
        (income.employment_sources || []).map((s: any) => [
          s.employer || 'Employer', `$${Number(s.gross_monthly || 0).toLocaleString()}/mo gross`,
        ] as [string, string])
      } />

      <Card title="Financial History" rows={[
        ['Prior Bankruptcy', history.filed_before === 'yes' ? history.prior_bankruptcy_details || 'Yes' : 'No'],
        ['Pending Lawsuits', history.has_lawsuits === 'yes' ? history.lawsuit_details || 'Yes' : 'No'],
        ['Property Transfers (2yr)', history.has_recent_transfers === 'yes' ? 'Yes' : 'No'],
        ['Preferential Payments (90d)', history.preferential_payments === 'yes' ? 'Yes' : 'No'],
        ['Insider Payments (1yr)', history.preferential_insider === 'yes' ? 'Yes' : 'No'],
        ['Recent Luxury / Cash Advance', history.recent_luxury === 'yes' ? 'Yes' : 'No'],
        ['Wage Garnishment', history.has_garnishments === 'yes' ? history.garnishment_details || 'Yes' : 'No'],
        ['Pending Foreclosure', history.foreclosure_pending === 'yes' ? 'Yes' : history.foreclosure_pending === 'unknown' ? 'Unknown' : 'No'],
        ['Trust Created (10yr)', history.created_trust === 'yes' ? history.trust_details || 'Yes' : 'No'],
        ['Business Ownership (4yr)', history.owned_business === 'yes' ? history.business_details || 'Yes' : 'No'],
        ['DSO Obligation', history.dso_obligation === 'yes' ? `$${Number(history.dso_amount || 0).toLocaleString()}/mo` : 'No'],
      ]} />

      <div className="bg-amber-400/8 border border-amber-400/20 rounded-xl p-4 mt-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-300/90 text-sm leading-relaxed">
            By submitting this questionnaire, you confirm that all information provided is true, accurate, and complete to the best of your knowledge. Providing false information in a bankruptcy proceeding is a federal crime punishable by fine and imprisonment.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

// Steps that show a confirmation modal before advancing
const CONFIRM_STEPS = new Set(['real_estate', 'vehicles', 'bank_accts', 'retirement', 'personal_property', 'unsecured', 'income']);

function buildModalContent(stepKey: string, data: StepData): { question: string; summary: React.ReactNode; addMoreLabel?: string } | null {
  if (stepKey === 'real_estate') {
    const props = data.properties || [];
    return {
      question: 'Is this all of your real estate? Have you listed every property you own or have an interest in?',
      addMoreLabel: 'Add Another Property',
      summary: data.owns_real_estate !== 'yes' ? (
        <p className="text-slate-400 text-sm">You indicated you do not own any real estate.</p>
      ) : (
        <div className="space-y-2">
          {props.map((p: any, i: number) => (
            <div key={i} className="bg-slate-700/60 rounded-lg p-3">
              <p className="text-white text-sm font-semibold">{p.description || `Property ${i + 1}`}</p>
              <p className="text-slate-400 text-xs">{[p.address, p.city, p.state, p.zip].filter(Boolean).join(', ')}</p>
              {p.value && <p className="text-slate-400 text-xs">Value: ${Number(p.value).toLocaleString()}</p>}
              {p.lender && <p className="text-slate-400 text-xs">Mortgage: {p.lender} — ${Number(p.mortgage_balance || 0).toLocaleString()}</p>}
            </div>
          ))}
        </div>
      ),
    };
  }
  if (stepKey === 'vehicles') {
    const vehs = data.vehicles || [];
    return {
      question: 'Have you listed all vehicles you own, co-own, or have an interest in? (cars, trucks, motorcycles, RVs, boats, trailers)',
      addMoreLabel: 'Add Another Vehicle',
      summary: data.has_vehicles !== 'yes' ? (
        <p className="text-slate-400 text-sm">You indicated you do not own any vehicles.</p>
      ) : (
        <div className="space-y-2">
          {vehs.map((v: any, i: number) => (
            <div key={i} className="bg-slate-700/60 rounded-lg p-3">
              <p className="text-white text-sm font-semibold">{[v.year, v.make, v.model].filter(Boolean).join(' ') || `Vehicle ${i + 1}`}</p>
              <p className="text-slate-400 text-xs">Value: ${Number(v.value || 0).toLocaleString()}{v.mileage ? ` — ${v.mileage} mi` : ''}</p>
              {v.has_loan === 'yes' && v.lender && <p className="text-slate-400 text-xs">Loan: {v.lender} — ${Number(v.loan_balance || 0).toLocaleString()}</p>}
            </div>
          ))}
        </div>
      ),
    };
  }
  if (stepKey === 'bank_accts') {
    const accts = data.accounts || [];
    const ACCT_LABELS: Record<string, string> = { checking: 'Checking', savings: 'Savings', money_market: 'Money Market', cd: 'CD', credit_union_share: 'Credit Union Share', brokerage: 'Brokerage', other: 'Account' };
    return {
      question: 'Have you listed all bank accounts, savings accounts, brokerage accounts, and financial accounts you currently hold? Include joint accounts.',
      addMoreLabel: 'Add Another Account',
      summary: data.has_bank_accounts !== 'yes' ? (
        <p className="text-slate-400 text-sm">You indicated you do not have any bank accounts.</p>
      ) : (
        <div className="space-y-2">
          {accts.map((a: any, i: number) => (
            <div key={i} className="bg-slate-700/60 rounded-lg p-3">
              <p className="text-white text-sm font-semibold">{a.institution ? `${a.institution} ${ACCT_LABELS[a.account_type] || a.account_type || ''}${a.last4 ? ` x${a.last4}` : ''}` : `Account ${i + 1}`}</p>
              <p className="text-slate-400 text-xs">Balance: ${Number(a.balance || 0).toLocaleString()}</p>
            </div>
          ))}
        </div>
      ),
    };
  }
  if (stepKey === 'retirement') {
    const accts = data.retirement_accounts || [];
    const RET_LABELS: Record<string, string> = { '401k': '401(k)', '403b': '403(b)', ira: 'Traditional IRA', roth_ira: 'Roth IRA', pension: 'Pension', sep_ira: 'SEP IRA', simple_ira: 'SIMPLE IRA', inherited_ira: 'Inherited IRA', annuity: 'Annuity', other: 'Retirement Account' };
    return {
      question: 'Have you listed all retirement accounts, pension plans, and all benefit income you receive? (Social Security, VA, pension)',
      addMoreLabel: 'Add Another Account',
      summary: (
        <div className="space-y-2">
          {data.has_retirement !== 'yes'
            ? <p className="text-slate-400 text-sm">No retirement accounts listed.</p>
            : accts.map((a: any, i: number) => (
              <div key={i} className="bg-slate-700/60 rounded-lg p-3">
                <p className="text-white text-sm font-semibold">{a.institution ? `${a.institution} ${RET_LABELS[a.account_type] || a.account_type || ''}` : `Account ${i + 1}`}</p>
                <p className="text-slate-400 text-xs">Balance: ${Number(a.balance || 0).toLocaleString()}</p>
              </div>
            ))
          }
          {data.has_ss_income === 'yes' && <div className="bg-slate-700/60 rounded-lg p-3"><p className="text-white text-sm font-semibold">Social Security</p><p className="text-slate-400 text-xs">${Number(data.ss_monthly || 0).toLocaleString()}/mo</p></div>}
          {data.has_pension === 'yes' && <div className="bg-slate-700/60 rounded-lg p-3"><p className="text-white text-sm font-semibold">Pension — {data.pension_source || 'provider'}</p><p className="text-slate-400 text-xs">${Number(data.pension_monthly || 0).toLocaleString()}/mo</p></div>}
          {data.has_veterans === 'yes' && <div className="bg-slate-700/60 rounded-lg p-3"><p className="text-white text-sm font-semibold">VA Benefits</p><p className="text-slate-400 text-xs">${Number(data.veterans_monthly || 0).toLocaleString()}/mo</p></div>}
          {data.has_retirement !== 'yes' && data.has_ss_income !== 'yes' && data.has_pension !== 'yes' && data.has_veterans !== 'yes' &&
            <p className="text-slate-400 text-sm">No retirement accounts or benefits indicated.</p>}
        </div>
      ),
    };
  }
  if (stepKey === 'personal_property') {
    return {
      question: 'Have you listed all personal property you own, including household goods, jewelry, insurance, stocks, firearms, and collectibles?',
      summary: (
        <div className="space-y-1.5 text-sm">
          {[
            ['Household Goods', data.has_household_goods === 'yes' ? `$${Number(data.household_goods_value || 0).toLocaleString()}` : 'None'],
            ['Life Insurance', data.has_life_insurance === 'yes' ? `${data.life_policy_type || 'Policy'} (${data.life_insurer || 'insurer'})` : 'None'],
            ['Stocks / Investments', data.has_stocks === 'yes' ? `$${Number(data.stocks_value || 0).toLocaleString()}` : 'None'],
            ['Cryptocurrency', data.has_crypto === 'yes' ? `$${Number(data.crypto_value || 0).toLocaleString()}` : 'None'],
            ['Firearms', data.has_firearms === 'yes' ? `${(data.firearms || []).length} listed` : 'None'],
            ['Collectibles', data.has_collectibles === 'yes' ? `$${Number(data.collectibles_value || 0).toLocaleString()}` : 'None'],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between bg-slate-700/60 rounded-lg px-3 py-2">
              <span className="text-slate-400">{label}</span>
              <span className="text-slate-300">{val}</span>
            </div>
          ))}
        </div>
      ),
    };
  }
  if (stepKey === 'income') {
    const sources = data.employment_sources || [];
    return {
      question: 'Have you listed all sources of income? Include all employment, self-employment, rental income, and other regular income.',
      addMoreLabel: 'Add Another Income Source',
      summary: (
        <div className="space-y-2">
          {sources.length === 0
            ? <p className="text-slate-400 text-sm">No income sources listed.</p>
            : sources.map((s: any, i: number) => (
              <div key={i} className="bg-slate-700/60 rounded-lg p-3">
                <p className="text-white text-sm font-semibold">{s.employer || `Source ${i + 1}`}</p>
                <p className="text-slate-400 text-xs">Gross: ${Number(s.gross_monthly || 0).toLocaleString()}/mo</p>
              </div>
            ))
          }
          {data.rental_income && Number(data.rental_income) > 0 && (
            <div className="bg-slate-700/60 rounded-lg p-3">
              <p className="text-white text-sm font-semibold">Rental Income</p>
              <p className="text-slate-400 text-xs">${Number(data.rental_income).toLocaleString()}/mo</p>
            </div>
          )}
        </div>
      ),
    };
  }
  if (stepKey === 'unsecured') {
    const total = [data.credit_card_total, data.medical_total, data.personal_loan_total, data.student_loan_total, data.tax_debt_total, data.judgment_total, data.other_unsecured_total]
      .reduce((s, v) => s + (parseFloat(v || '0') || 0), 0);
    return {
      question: 'Have you accounted for all unsecured debts? Include credit cards, medical bills, personal loans, student loans, and any other debts not secured by collateral.',
      summary: (
        <div className="space-y-1.5 text-sm">
          {[
            ['Credit Cards', data.credit_card_total],
            ['Medical Bills', data.medical_total],
            ['Personal Loans', data.personal_loan_total],
            ['Student Loans', data.student_loan_total],
            ['Tax Debt', data.tax_debt_total],
            ['Judgments', data.judgment_total],
            ['Other', data.other_unsecured_total],
          ].filter(([, v]) => v && Number(v) > 0).map(([label, val]) => (
            <div key={label} className="flex justify-between bg-slate-700/60 rounded-lg px-3 py-2">
              <span className="text-slate-400">{label}</span>
              <span className="text-slate-300">${Number(val).toLocaleString()}</span>
            </div>
          ))}
          <div className="flex justify-between bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 mt-1">
            <span className="text-amber-400 font-bold">Total Unsecured</span>
            <span className="text-amber-300 font-bold">${total.toLocaleString()}</span>
          </div>
        </div>
      ),
    };
  }
  return null;
}

function FullBankruptcyQuestionnaire({ clientId, clientName, onComplete, onBack, onChatHelp }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepData, setStepData] = useState<Record<string, StepData>>({});
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasIntake, setHasIntake] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ stepKey: string } | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    async function init() {
      setLoading(true);
      let prefill: Record<string, StepData> = {};

      try {
        const { data: clientRow } = await supabase.from('clients').select('intake_id').eq('id', clientId).maybeSingle();
        if (clientRow?.intake_id) {
          const { data: intakeRow } = await supabase.from('intake_submissions').select('form_data').eq('id', clientRow.intake_id).maybeSingle();
          if (intakeRow?.form_data) {
            prefill = buildPreFill(intakeRow.form_data);
            setHasIntake(true);
          }
        }
      } catch (_) {}

      const { data: saved } = await supabase
        .from('bankruptcy_questionnaire_submissions')
        .select('step_key, data, completed')
        .eq('client_id', clientId);

      const merged: Record<string, StepData> = {};
      const done = new Set<string>();
      let firstIncomplete = 0;
      let foundFirst = false;

      STEPS.forEach((step, idx) => {
        if (step.key === 'disclosure' || step.key === 'documents' || step.key === 'review') return;
        const savedStep = saved?.find(s => s.step_key === step.key);
        if (savedStep) {
          // Merge prefill values into saved data for any fields that are blank/missing
          // so intake data (county, marital status, etc.) always shows even if saved before those fields existed
          const pf = prefill[step.key] || {};
          const merged_step: StepData = { ...savedStep.data };
          for (const key of Object.keys(pf)) {
            if (merged_step[key] === undefined || merged_step[key] === null || merged_step[key] === '') {
              merged_step[key] = pf[key];
            }
          }
          merged[step.key] = merged_step;
          if (savedStep.completed) done.add(step.key);
          else if (!foundFirst) { firstIncomplete = idx; foundFirst = true; }
        } else {
          merged[step.key] = prefill[step.key] || {};
          if (!foundFirst) { firstIncomplete = idx; foundFirst = true; }
        }
      });

      setStepData(merged);
      setCompletedSteps(done);
      setCurrentStep(firstIncomplete);
      setLoading(false);
    }
    init();
  }, [clientId]);

  async function saveStep(stepKey: string, data: StepData, completed = false) {
    if (stepKey === 'disclosure' || stepKey === 'documents' || stepKey === 'review') return;
    setSaving(true);
    setSaveMsg('');
    try {
      await supabase.from('bankruptcy_questionnaire_submissions').upsert(
        { client_id: clientId, step_key: stepKey, data, completed, updated_at: new Date().toISOString() },
        { onConflict: 'client_id,step_key' }
      );
      // Sync marital status back to intake submission so intake form stays in sync
      if (stepKey === 'personal' && data.marital_status) {
        try {
          const { data: clientRow } = await supabase.from('clients').select('intake_id').eq('id', clientId).maybeSingle();
          if (clientRow?.intake_id) {
            await (supabase.rpc as any)('update_intake_marital_status', {
              p_intake_id: clientRow.intake_id,
              p_marital_status: data.marital_status,
            });
          }
        } catch (_) {}
      }
      if (completed) setCompletedSteps(prev => new Set([...prev, stepKey]));
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (_) {
      setSaveMsg('');
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    const step = STEPS[currentStep];
    if (step.key !== 'disclosure' && step.key !== 'documents' && step.key !== 'review') {
      await saveStep(step.key, stepData[step.key] || {}, true);
    }
    if (CONFIRM_STEPS.has(step.key)) {
      setConfirmModal({ stepKey: step.key });
      return;
    }
    advanceStep();
  }

  function advanceStep() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleModalConfirm() {
    setConfirmModal(null);
    advanceStep();
  }

  function handleModalAddMore(stepKey: string) {
    setConfirmModal(null);
    // Trigger "add" action on the relevant step by injecting a blank entry
    const d = stepData[stepKey] || {};
    if (stepKey === 'real_estate') {
      updateStepData(stepKey, {
        ...d,
        owns_real_estate: 'yes',
        properties: [...(d.properties || []), { address: '', city: '', state: '', zip: '', description: '', value: '', mortgage_balance: '', lender: '', monthly_payment: '', is_current: '', arrears: '', intent: 'keep' }],
      });
    } else if (stepKey === 'vehicles') {
      updateStepData(stepKey, {
        ...d,
        has_vehicles: 'yes',
        vehicles: [...(d.vehicles || []), { year: '', make: '', model: '', mileage: '', value: '', has_loan: 'no', lender: '', loan_balance: '', monthly_payment: '', is_current: '', arrears: '', account_last4: '' }],
      });
    } else if (stepKey === 'bank_accts') {
      updateStepData(stepKey, {
        ...d,
        has_bank_accounts: 'yes',
        accounts: [...(d.accounts || []), { institution: '', account_type: 'checking', balance: '', last4: '' }],
      });
    } else if (stepKey === 'retirement') {
      updateStepData(stepKey, {
        ...d,
        has_retirement: 'yes',
        retirement_accounts: [...(d.retirement_accounts || []), { institution: '', account_type: '401k', balance: '', owner_name: '' }],
      });
    } else if (stepKey === 'income') {
      updateStepData(stepKey, {
        ...d,
        employment_sources: [...(d.employment_sources || []), { employer: '', type: 'employment', gross_monthly: '', net_monthly: '' }],
      });
    }
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  async function handleBack() {
    if (currentStep === 0) { onBack(); return; }
    setCurrentStep(currentStep - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit() {
    setSubmitting(true);
    for (const step of STEPS.filter(s => s.key !== 'disclosure' && s.key !== 'documents' && s.key !== 'review')) {
      if (stepData[step.key]) await saveStep(step.key, stepData[step.key], true);
    }

    // Generate document request records in client_documents
    const { data: clientRow } = await supabase.from('clients').select('intake_id').eq('id', clientId).maybeSingle();
    const intakeId = clientRow?.intake_id || null;

    const docRequests: { document_type: string; file_name: string; notes: string }[] = [];
    const real_estate = stepData.real_estate || {};
    const vehicles = stepData.vehicles || {};
    const bank_accts = stepData.bank_accts || {};
    const retirement = stepData.retirement || {};
    const secured = stepData.secured || {};

    const ACCT_TYPE_LABELS: Record<string, string> = {
      checking: 'Checking', savings: 'Savings', money_market: 'Money Market',
      cd: 'CD', credit_union_share: 'Credit Union Share', brokerage: 'Brokerage', other: 'Account',
    };
    const RET_TYPE_LABELS: Record<string, string> = {
      '401k': '401(k)', '403b': '403(b)', ira: 'Traditional IRA', roth_ira: 'Roth IRA',
      pension: 'Pension', sep_ira: 'SEP IRA', simple_ira: 'SIMPLE IRA',
      inherited_ira: 'Inherited IRA', annuity: 'Annuity', other: 'Retirement Account',
    };

    (real_estate.properties || []).filter((p: any) => p.lender || p.mortgage_balance).forEach((p: any) => {
      docRequests.push({ document_type: 'mortgage_statement', file_name: `Mortgage Statement — ${p.lender || 'Mortgage Lender'}`, notes: `Most recent mortgage statement for ${p.address || 'property'}. Required for Schedule D.` });
    });

    (vehicles.vehicles || []).filter((v: any) => v.has_loan === 'yes' && v.lender).forEach((v: any) => {
      docRequests.push({ document_type: 'auto_loan_statement', file_name: `Auto Loan Statement — ${v.lender} (${v.year || ''} ${v.make || ''} ${v.model || ''})`.trim(), notes: `Most recent auto loan statement. Required for Schedule D.` });
    });

    (secured.secured_creditors || []).filter((c: any) => c.creditor_name && c.collateral_type !== 'real_estate' && c.collateral_type !== 'vehicle').forEach((c: any) => {
      docRequests.push({ document_type: 'secured_creditor_statement', file_name: `Creditor Statement — ${c.creditor_name}`, notes: `Most recent statement for secured debt (${c.collateral || 'collateral'}). Required for Schedule D.` });
    });

    (bank_accts.accounts || []).filter((a: any) => a.institution).forEach((a: any) => {
      const typeLabel = ACCT_TYPE_LABELS[a.account_type] || 'Account';
      docRequests.push({ document_type: 'bank_statements', file_name: `Bank Statements — ${a.institution} ${typeLabel}${a.last4 ? ` x${a.last4}` : ''}`, notes: `Last 6 months of statements required for Schedule A/B and means test.` });
    });

    if (bank_accts.has_closed_accounts === 'yes') {
      (bank_accts.closed_accounts || []).filter((a: any) => a.institution).forEach((a: any) => {
        const typeLabel = ACCT_TYPE_LABELS[a.account_type] || 'Account';
        docRequests.push({ document_type: 'closing_statement', file_name: `Closing Statement — ${a.institution} ${typeLabel}${a.last4 ? ` x${a.last4}` : ''}`, notes: `Account closing statement required for Statement of Financial Affairs (SOFA Part 4).${a.closed_date ? ` Closed: ${a.closed_date}.` : ''}` });
      });
    }

    (retirement.retirement_accounts || []).filter((r: any) => r.institution).forEach((r: any) => {
      const typeLabel = RET_TYPE_LABELS[r.account_type] || r.account_type || 'Account';
      docRequests.push({ document_type: 'retirement_statement', file_name: `Retirement Statement — ${r.institution} ${typeLabel}`, notes: `Most recent statement required for Schedule A/B.` });
    });

    if (retirement.has_ss_income === 'yes') {
      docRequests.push({ document_type: 'award_letter', file_name: 'Social Security Award Letter', notes: 'Most recent Social Security award letter. Required for means test and income verification.' });
    }
    if (retirement.has_pension === 'yes') {
      docRequests.push({ document_type: 'pension_statement', file_name: `Pension Statement — ${retirement.pension_source || 'Pension Provider'}`, notes: 'Most recent pension statement. Required for income verification.' });
    }
    if (retirement.has_veterans === 'yes') {
      docRequests.push({ document_type: 'award_letter', file_name: 'VA Award Letter', notes: 'Most recent VA award letter. Required for income verification.' });
    }

    for (const req of docRequests) {
      await supabase.from('client_documents').insert({
        submission_id: intakeId,
        uploaded_by: 'system',
        document_type: req.document_type,
        file_name: req.file_name,
        notes: req.notes,
        requested: true,
      });
    }

    await supabase.from('clients').update({ case_status: 'questionnaire_submitted', status: 'retained' } as any).eq('id', clientId);
    setSubmitting(false);
    setShowSummary(true);
  }

  function updateStepData(stepKey: string, data: StepData) {
    setStepData(prev => ({ ...prev, [stepKey]: data }));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading your questionnaire...</p>
        </div>
      </div>
    );
  }

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  function renderStep() {
    const d = stepData[step.key] || {};
    const setD = (data: StepData) => updateStepData(step.key, data);
    switch (step.key) {
      case 'disclosure':  return <StepDisclosure hasIntake={hasIntake} />;
      case 'personal':    return <StepPersonal data={d} setData={setD} hasIntake={hasIntake} />;
      case 'real_estate': return <StepRealEstate data={d} setData={setD} hasIntake={hasIntake} />;
      case 'vehicles':    return <StepVehicles data={d} setData={setD} hasIntake={hasIntake} />;
      case 'bank_accts':  return <StepBankAccounts data={d} setData={setD} hasIntake={hasIntake} />;
      case 'retirement':        return <StepRetirement data={d} setData={setD} hasIntake={hasIntake} />;
      case 'personal_property': return <StepPersonalProperty data={d} setData={setD} hasIntake={hasIntake} />;
      case 'secured':           return <StepSecured data={d} setData={setD} hasIntake={hasIntake} />;
      case 'unsecured':         return <StepUnsecured data={d} setData={setD} hasIntake={hasIntake} />;
      case 'support':           return <StepSupport data={d} setData={setD} hasIntake={hasIntake} />;
      case 'income':            return <StepIncome data={d} setData={setD} hasIntake={hasIntake} />;
      case 'expenses':          return <StepExpenses data={d} setData={setD} hasIntake={hasIntake} />;
      case 'history':           return <StepHistory data={d} setData={setD} hasIntake={hasIntake} />;
      case 'documents':         return <StepDocuments allData={stepData} />;
      case 'review':            return <StepReview allData={stepData} />;
      default: return null;
    }
  }

  const Icon = step.icon;
  const saveable = !['disclosure', 'documents', 'review'].includes(step.key);

  const modalConfig = confirmModal ? buildModalContent(confirmModal.stepKey, stepData[confirmModal.stepKey] || {}) : null;
  const hasAddMore = confirmModal && ['real_estate', 'vehicles', 'bank_accts', 'retirement', 'income'].includes(confirmModal.stepKey);

  // ── Post-submit summary page ───────────────────────────────────────────────
  if (showSummary) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <div className="bg-slate-900/95 border-b border-slate-800 backdrop-blur-sm sticky top-0 z-30">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-500/20 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Questionnaire Submitted</p>
                <p className="text-slate-400 text-xs">Review your answers below. Your team has been notified.</p>
              </div>
            </div>
            <button
              onClick={onComplete}
              className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm px-4 py-2.5 rounded-xl transition-all"
            >
              <LayoutDashboard className="w-4 h-4" /> Back to Dashboard
            </button>
          </div>
        </div>
        <div className="flex-1">
          <IntakeAnswersSummary
            clientId={clientId}
            clientName={clientName}
            hideHeader
          />
        </div>
        <div className="sticky bottom-0 bg-slate-900/95 border-t border-slate-800 backdrop-blur-sm px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <p className="text-slate-400 text-xs">Your information has been submitted. Our team will review it and reach out shortly.</p>
            <button
              onClick={onComplete}
              className="flex-shrink-0 flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm px-5 py-2.5 rounded-xl transition-all"
            >
              <LayoutDashboard className="w-4 h-4" /> Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Section confirmation modal */}
      {confirmModal && modalConfig && (
        <SectionConfirmModal
          question={modalConfig.question}
          summary={modalConfig.summary}
          addMoreLabel={modalConfig.addMoreLabel}
          onConfirm={handleModalConfirm}
          onAddMore={hasAddMore ? () => handleModalAddMore(confirmModal.stepKey) : undefined}
          onEdit={() => setConfirmModal(null)}
        />
      )}
      {/* Header */}
      <div className="bg-slate-800/80 border-b border-slate-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 backdrop-blur-sm flex-shrink-0">
        <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <Scale className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-white font-bold text-sm leading-tight hidden sm:block">Full Bankruptcy Information & Document Questionnaire</h1>
          <p className="text-slate-400 text-xs truncate">{clientName} — {step.label}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saveMsg && <span className="text-emerald-400 text-xs font-medium hidden sm:block">{saveMsg}</span>}
          {saving && <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/80 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white rounded-lg transition-all text-xs font-semibold"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          <button
            onClick={onChatHelp || onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 hover:border-amber-400/60 text-amber-400 hover:text-amber-300 rounded-lg transition-all text-xs font-semibold"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chat with Us</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="hidden lg:flex w-64 flex-shrink-0 flex-col bg-slate-800/50 border-r border-slate-700 py-6 overflow-y-auto">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider px-5 mb-4">Progress</p>
          <div className="space-y-1 px-3">
            {STEPS.map((s, idx) => {
              const SIcon = s.icon;
              const isActive = idx === currentStep;
              const isDone = completedSteps.has(s.key);
              return (
                <button key={s.key} onClick={() => setCurrentStep(idx)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all text-sm ${
                    isActive ? 'bg-amber-400/15 text-amber-400' :
                    isDone ? 'text-emerald-400 hover:bg-slate-700/50' :
                    'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <div className={`flex-shrink-0 ${isActive ? 'text-amber-400' : isDone ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {isDone && !isActive ? <CheckCircle className="w-4 h-4" /> : <SIcon className="w-4 h-4" />}
                  </div>
                  <span className="font-medium truncate text-xs">{s.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto px-5 pt-5">
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>Progress</span>
              <span>{completedSteps.size}/{STEPS.filter(s => !['disclosure','documents','review'].includes(s.key)).length}</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${(completedSteps.size / STEPS.filter(s => !['disclosure','documents','review'].includes(s.key)).length) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile progress dots */}
          <div className="lg:hidden flex items-center gap-1.5 px-4 py-3 border-b border-slate-700 overflow-x-auto">
            {STEPS.map((s, idx) => (
              <div key={s.key} className={`flex-shrink-0 rounded-full transition-all ${
                idx === currentStep ? 'w-6 h-2.5 bg-amber-400' :
                completedSteps.has(s.key) ? 'w-2.5 h-2.5 bg-emerald-400' : 'w-2.5 h-2.5 bg-slate-600'
              }`} />
            ))}
            <span className="ml-2 text-slate-400 text-xs flex-shrink-0">{step.short}</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-8">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-5 h-5 text-amber-400" />
                  <h2 className="text-white font-bold text-xl">{step.label}</h2>
                </div>
                {step.short !== 'Start' && <p className="text-slate-400 text-sm">{step.short}</p>}
              </div>

              {renderStep()}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-700">
                <button onClick={handleBack}
                  className="flex items-center gap-2 px-5 py-2.5 text-slate-300 hover:text-white border border-slate-600 hover:border-slate-500 rounded-xl transition-all text-sm font-semibold">
                  <ChevronLeft className="w-4 h-4" />
                  {currentStep === 0 ? 'Back to Dashboard' : 'Previous'}
                </button>

                {saveable && (
                  <button onClick={() => saveStep(step.key, stepData[step.key] || {})} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-xl transition-all text-sm disabled:opacity-30">
                    Save Draft
                  </button>
                )}

                {isLast ? (
                  <button onClick={handleSubmit} disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-xl transition-all text-sm font-bold">
                    {submitting ? 'Submitting...' : 'Submit Questionnaire'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={handleNext} disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-xl transition-all text-sm font-bold">
                    {saving ? 'Saving...' : step.key === 'disclosure' ? 'Begin Questionnaire' : 'Save & Continue'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FullBankruptcyQuestionnaire