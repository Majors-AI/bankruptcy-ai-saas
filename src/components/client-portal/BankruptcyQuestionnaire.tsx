import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Scale, ChevronRight, ChevronLeft, CheckCircle, Circle,
  AlertTriangle, Plus, Trash2, User, Home, Car, DollarSign,
  FileText, Briefcase, TrendingUp, Info, ShieldCheck, RefreshCw
} from 'lucide-react';

interface Props {
  clientId: string;
  clientName: string;
  onComplete: () => void;
  onBack: () => void;
}

const STEPS = [
  { key: 'b101',    label: 'Personal Information',  icon: User,        short: 'Step 1' },
  { key: 'b106ab',  label: 'Property & Assets',     icon: Home,        short: 'Step 2' },
  { key: 'b106d',   label: 'Secured Debts',          icon: Car,         short: 'Step 3' },
  { key: 'b106ef',  label: 'Unsecured Debts',        icon: DollarSign,  short: 'Step 4' },
  { key: 'b106g',   label: 'Leases & Contracts',     icon: FileText,    short: 'Step 5' },
  { key: 'b106i',   label: 'Monthly Income',         icon: Briefcase,   short: 'Step 6' },
  { key: 'b106j',   label: 'Monthly Expenses',       icon: TrendingUp,  short: 'Step 7' },
  { key: 'b107',    label: 'Financial History',      icon: FileText,    short: 'Step 8' },
  { key: 'summary', label: 'Review & Submit',        icon: CheckCircle, short: 'Review' },
];

const US_STATES = ['AK','AL','AR','AZ','CA','CO','CT','DC','DE','FL','GA','HI','IA','ID','IL','IN','KS','KY','LA','MA','MD','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NJ','NM','NV','NY','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY'];

type StepData = Record<string, any>;

// ── UI Components ─────────────────────────────────────────────────────────────

function Field({ label, required, children, hint, prefilled }: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string; prefilled?: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1.5">
        <label className="block text-sm font-semibold text-slate-300">
          {label}{required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {prefilled && (
          <span className="flex items-center gap-1 text-xs text-amber-400/80 bg-amber-400/10 px-2 py-0.5 rounded-full">
            <Info className="w-3 h-3" /> From intake
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-slate-500 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', prefilled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; prefilled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-slate-800 border rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400/60 placeholder-slate-500 transition-colors ${
        prefilled ? 'border-amber-400/40 bg-amber-400/5' : 'border-slate-600'
      }`}
    />
  );
}

function SelectInput({ value, onChange, options, placeholder, prefilled }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; prefilled?: boolean;
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

function YesNo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-3">
      {[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }].map(opt => (
        <button
          key={opt.v}
          type="button"
          onClick={() => onChange(opt.v)}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-all ${
            value === opt.v
              ? 'bg-amber-400/15 border-amber-400/50 text-amber-400'
              : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white'
          }`}
        >
          {opt.l}
        </button>
      ))}
    </div>
  );
}

function AmountInput({ value, onChange, placeholder = '0.00', prefilled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; prefilled?: boolean;
}) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-slate-800 border rounded-xl pl-8 pr-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400/60 placeholder-slate-500 transition-colors ${
          prefilled ? 'border-amber-400/40 bg-amber-400/5' : 'border-slate-600'
        }`}
      />
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mt-6 mb-4 pb-2 border-b border-slate-700">
      <h3 className="text-amber-400 font-bold text-sm uppercase tracking-wider">{title}</h3>
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">{children}</div>;
}

function PrefilledBadge() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 mb-4">
      <Info className="w-3.5 h-3.5 flex-shrink-0" />
      <span>Fields highlighted in amber were pre-filled from your intake form. Please review and confirm they are correct, or update as needed.</span>
    </div>
  );
}

function DynamicRows<T extends Record<string, any>>({
  rows, setRows, emptyRow, renderRow, addLabel
}: {
  rows: T[];
  setRows: (rows: T[]) => void;
  emptyRow: T;
  renderRow: (row: T, idx: number, update: (key: keyof T, val: any) => void) => React.ReactNode;
  addLabel: string;
}) {
  function update(idx: number, key: keyof T, val: any) {
    const next = [...rows];
    next[idx] = { ...next[idx], [key]: val };
    setRows(next);
  }
  function remove(idx: number) { setRows(rows.filter((_, i) => i !== idx)); }
  return (
    <div className="space-y-3">
      {rows.map((row, idx) => (
        <div key={idx} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 relative">
          <button onClick={() => remove(idx)} className="absolute top-3 right-3 text-slate-500 hover:text-red-400 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
          {renderRow(row, idx, (k, v) => update(idx, k, v))}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows([...rows, { ...emptyRow }])}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-amber-400/40 transition-all text-sm"
      >
        <Plus className="w-4 h-4" /> {addLabel}
      </button>
    </div>
  );
}

// ── Intake → Questionnaire mapping ────────────────────────────────────────────

function buildPreFill(fd: Record<string, any>) {
  // ── Step 1: Personal Information ──
  const b101: StepData = {
    first_name: fd.firstName || '',
    middle_name: fd.middleName || '',
    last_name: fd.lastName || '',
    suffix: fd.suffix || '',
    has_other_names: fd.hasOtherNames || 'no',
    other_names: fd.otherNames || '',
    street_name: fd.streetAddress || fd.streetName || '',
    city: fd.city || '',
    state: fd.state || '',
    zip_code: fd.zipCode || fd.zip || '',
    county: fd.county || '',
    filing_type: fd.filingType === 'married-filing-jointly' ? 'married_joint'
      : fd.filingType === 'individual-nonfiling-spouse' ? 'married_individual'
      : fd.filingType === 'individual' ? 'individual'
      : fd.filingType || '',
    has_rented: fd.hasRentedLast3Years || 'no',
    ssn_last4: fd.ssnLast4 || '',
    dob: fd.dateOfBirth || fd.dob || '',
    // Spouse
    spouse_first_name: fd.spouseFirstName || '',
    spouse_last_name: fd.spouseLastName || '',
    spouse_middle_name: fd.spouseMiddleName || '',
    spouse_ssn_last4: fd.spouseSsnLast4 || '',
    spouse_dob: fd.spouseDateOfBirth || fd.spouseDob || '',
    spouse_same_address: fd.spouseSameAddress !== undefined ? (fd.spouseSameAddress ? 'yes' : 'no') : 'yes',
    // Credit counseling
    credit_counseling_completed: fd.creditCounselingCompleted || '',
    credit_counseling_agency: fd.creditCounselingAgency || '',
    credit_counseling_date: fd.creditCounselingDate || '',
    // Dependents
    dependents: Array.isArray(fd.dependents)
      ? fd.dependents.map((d: any) => ({ name: d.name || d.depName || '', relationship: d.relationship || d.depRelationship || '', age: String(d.age || d.depAge || '') }))
      : [],
  };

  // ── Step 2: Property & Assets ──
  const realEstate = Array.isArray(fd.realEstate) ? fd.realEstate : (fd.hasRealEstate === 'yes' || fd.realEstateAddress ? [{
    address: fd.realEstateAddress || fd.streetAddress || '',
    city: fd.realEstateCity || fd.city || '',
    state: fd.realEstateState || fd.state || '',
    zip: fd.realEstateZip || fd.zipCode || '',
    description: fd.realEstateDescription || 'Primary Residence',
    value: String(fd.realEstateValue || fd.propertyValue || ''),
    how_owned: fd.realEstateOwnership || 'sole',
    nature: fd.realEstateNature || 'fee_simple',
  }] : []);

  const vehicles = Array.isArray(fd.vehicles) ? fd.vehicles.map((v: any) => ({
    year: v.year || '',
    make: v.make || '',
    model: v.model || '',
    mileage: v.mileage || '',
    value: String(v.value || ''),
    how_owned: v.howOwned || 'sole',
    is_leased: v.isLeased ? 'yes' : 'no',
    lender: v.lender || '',
    balance: String(v.loanBalance || v.balance || ''),
  })) : [];

  const bankAccounts = Array.isArray(fd.bankAccounts) ? fd.bankAccounts.map((b: any) => ({
    institution: b.institution || b.bank || '',
    account_type: b.accountType || b.type || '',
    balance: String(b.balance || b.amount || ''),
    last4: b.last4 || '',
  })) : [];

  const retirement = Array.isArray(fd.retirementAccounts) ? fd.retirementAccounts.map((r: any) => ({
    institution: r.institution || '',
    account_type: r.accountType || r.type || '401k',
    balance: String(r.balance || r.amount || ''),
  })) : (fd.has401k === 'yes' || fd.retirement401kBalance ? [{
    institution: fd.retirement401kInstitution || fd.retirementInstitution || '',
    account_type: '401k',
    balance: String(fd.retirement401kBalance || fd.retirementBalance || ''),
  }] : []);

  const lifeInsurance = Array.isArray(fd.lifeInsurancePolicies) ? fd.lifeInsurancePolicies : (fd.hasLifeInsurance === 'yes' ? [{
    company: fd.lifeInsuranceCompany || '',
    policy_type: fd.lifeInsuranceType || 'whole_life',
    face_value: String(fd.lifeInsuranceFaceValue || ''),
    cash_value: String(fd.lifeInsuranceCashValue || ''),
    beneficiary: fd.lifeInsuranceBeneficiary || '',
  }] : []);

  const firearms = Array.isArray(fd.firearms) ? fd.firearms : (fd.hasFirearms === 'yes' ? [{
    description: fd.firearmsDescription || '',
    value: String(fd.firearmsValue || ''),
  }] : []);

  const b106ab: StepData = {
    has_real_estate: realEstate.length > 0 ? 'yes' : (fd.hasRealEstate || 'no'),
    real_estate: realEstate,
    has_vehicles: vehicles.length > 0 ? 'yes' : (fd.hasVehicles || 'no'),
    vehicles,
    has_bank_accounts: bankAccounts.length > 0 ? 'yes' : (fd.hasBankAccounts || 'no'),
    bank_accounts: bankAccounts,
    has_retirement: retirement.length > 0 ? 'yes' : (fd.hasRetirement || fd.has401k || 'no'),
    retirement_accounts: retirement,
    has_life_insurance: lifeInsurance.length > 0 ? 'yes' : (fd.hasLifeInsurance || 'no'),
    life_insurance: lifeInsurance,
    has_annuity: fd.hasAnnuity || (fd.annuityValue ? 'yes' : 'no'),
    annuity_company: fd.annuityCompany || '',
    annuity_value: String(fd.annuityValue || ''),
    has_firearms: firearms.length > 0 ? 'yes' : (fd.hasFirearms || 'no'),
    firearms,
    jewelry_value: String(fd.jewelryValue || ''),
    household_goods_value: String(fd.householdGoodsValue || ''),
    electronics_value: String(fd.electronicsValue || ''),
    clothing_value: String(fd.clothingValue || ''),
    has_other_assets: fd.hasOtherAssets || 'no',
    other_assets_description: fd.otherAssetsDescription || '',
    other_assets_value: String(fd.otherAssetsValue || ''),
  };

  // ── Step 3: Secured Debts ──
  // Build mortgage creditors from real estate data
  const mortgageCreditors = [];
  if (fd.hasRealEstate === 'yes' || fd.mortgageBalance || fd.realEstateMortgageLender) {
    mortgageCreditors.push({
      creditor_name: fd.realEstateMortgageLender || fd.mortgageLender || '',
      account_last4: '',
      collateral: fd.realEstateAddress || 'Real Property — Primary Residence',
      monthly_payment: String(fd.realPropMonthlyPayment || fd.mortgageMonthlyPayment || ''),
      current_balance: String(fd.mortgageBalance || ''),
      is_current: fd.mortgageCurrent || '',
      arrears: String(fd.mortgageArrears || ''),
    });
  }

  // Build vehicle creditors
  const vehicleCreditors = vehicles.filter((v: any) => v.lender || v.balance).map((v: any) => ({
    creditor_name: v.lender || '',
    account_last4: '',
    collateral: `${v.year} ${v.make} ${v.model}`.trim(),
    monthly_payment: String(v.monthlyPayment || ''),
    current_balance: v.balance || '',
    is_current: '',
    arrears: '',
  }));

  // Fallback: individual vehicle fields
  if (vehicleCreditors.length === 0 && fd.vehicles && Array.isArray(fd.vehicles)) {
    fd.vehicles.forEach((v: any) => {
      if (v.lender || v.loanBalance) {
        vehicleCreditors.push({
          creditor_name: v.lender || '',
          account_last4: '',
          collateral: `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim(),
          monthly_payment: String(v.monthlyPayment || ''),
          current_balance: String(v.loanBalance || ''),
          is_current: '',
          arrears: '',
        });
      }
    });
  }

  const allSecured = [...mortgageCreditors, ...vehicleCreditors];
  if (allSecured.length === 0) {
    allSecured.push({ creditor_name: '', account_last4: '', collateral: '', monthly_payment: '', current_balance: '', is_current: '', arrears: '' });
  }

  const b106d: StepData = {
    has_secured_debts: allSecured.some(c => c.creditor_name) ? 'yes' : (fd.hasSecuredDebts || 'no'),
    secured_creditors: allSecured,
    has_hoa: fd.hasHoa || 'no',
    hoa_name: fd.hoaName || '',
    hoa_monthly: String(fd.hoaMonthlyAmount || fd.hoaAmount || ''),
    hoa_balance_owed: '',
    has_tax_liens: fd.hasTaxLiens || (fd.taxLienAmount ? 'yes' : 'no'),
    tax_lien_creditor: fd.taxLienCreditor || '',
    tax_lien_amount: String(fd.taxLienAmount || ''),
    tax_lien_county: fd.taxLienCounty || '',
  };

  // ── Step 4: Unsecured Debts ──
  const creditCards = Array.isArray(fd.creditCards) ? fd.creditCards.map((c: any) => ({
    creditor_name: c.creditorName || c.lender || '',
    account_last4: c.accountLast4 || c.last4 || '',
    balance: String(c.balance || ''),
    monthly_payment: String(c.monthlyPayment || ''),
  })) : (fd.creditCardDebt ? [{ creditor_name: '', account_last4: '', balance: String(fd.creditCardDebt || ''), monthly_payment: '' }] : []);

  const medicalDebts = Array.isArray(fd.medicalDebts) ? fd.medicalDebts.map((m: any) => ({
    creditor_name: m.creditorName || m.provider || '',
    balance: String(m.balance || ''),
  })) : (fd.medicalDebt ? [{ creditor_name: '', balance: String(fd.medicalDebt || '') }] : []);

  const otherUnsecured = Array.isArray(fd.otherUnsecuredDebts) ? fd.otherUnsecuredDebts.map((o: any) => ({
    creditor_name: o.creditorName || '',
    debt_type: o.debtType || o.type || '',
    balance: String(o.balance || ''),
  })) : [];

  // Add business debts if present
  if (fd.businessCreditCardDebt) {
    otherUnsecured.push({ creditor_name: 'Business Credit Card', debt_type: 'business', balance: String(fd.businessCreditCardDebt) });
  }

  const b106ef: StepData = {
    has_credit_cards: creditCards.length > 0 ? 'yes' : 'no',
    credit_cards: creditCards.length > 0 ? creditCards : [{ creditor_name: '', account_last4: '', balance: '', monthly_payment: '' }],
    has_medical: medicalDebts.length > 0 ? 'yes' : 'no',
    medical_debts: medicalDebts.length > 0 ? medicalDebts : [{ creditor_name: '', balance: '' }],
    has_student_loans: fd.hasStudentLoans || 'no',
    student_loan_servicer: fd.studentLoanServicer || '',
    student_loan_balance: String(fd.studentLoanBalance || ''),
    has_tax_debt: fd.taxDebt ? 'yes' : (fd.hasTaxDebt || 'no'),
    tax_debt_type: fd.taxDebtType || 'federal_income',
    tax_debt_amount: String(fd.taxDebt || fd.taxDebtAmount || ''),
    has_personal_loans: fd.hasPersonalLoans || 'no',
    has_other_unsecured: otherUnsecured.length > 0 ? 'yes' : 'no',
    other_unsecured: otherUnsecured,
    has_cosigners: fd.hasCosigners || 'no',
    cosigner_details: fd.cosignerDetails || '',
  };

  // ── Step 5: Leases & Contracts — not pre-filled ──
  const b106g: StepData = {
    has_real_estate_leases: 'no',
    real_estate_leases: [{ lessor: '', address: '', monthly_payment: '', remaining_months: '', description: '' }],
    has_personal_property_leases: 'no',
    personal_property_leases: [{ lessor: '', description: '', monthly_payment: '', remaining_months: '' }],
    has_vehicle_leases: 'no',
    vehicle_leases: [{ lessor: '', vehicle: '', monthly_payment: '', remaining_months: '', buyout: '' }],
    has_executory_contracts: 'no',
    executory_contracts: [{ counterparty: '', description: '', type: '' }],
    eviction_pending: 'no',
    eviction_details: '',
  };

  // ── Step 6: Monthly Income ──
  const employmentSources = Array.isArray(fd.debtorSources) ? fd.debtorSources.map((s: any) => ({
    employer_name: s.employerName || s.businessName || s.name || '',
    occupation: s.occupation || s.jobTitle || '',
    gross_monthly: String(s.grossMonthly || s.grossMonthlyIncome || s.income || ''),
    net_monthly: String(s.netMonthly || ''),
    employment_type: s.employmentType || (fd.debtorWorkStatus === 'selfEmployed' ? 'self_employed' : 'employed'),
    business_expenses: String(s.businessExpenses || s.expenses || ''),
  })) : [];

  const spouseSources = Array.isArray(fd.spouseSources) ? fd.spouseSources.map((s: any) => ({
    employer_name: s.employerName || s.businessName || s.name || '',
    occupation: s.occupation || s.jobTitle || '',
    gross_monthly: String(s.grossMonthly || s.grossMonthlyIncome || s.income || ''),
    net_monthly: String(s.netMonthly || ''),
    employment_type: s.employmentType || (fd.spouseWorkStatus === 'selfEmployed' ? 'self_employed' : 'employed'),
    business_expenses: String(s.businessExpenses || s.expenses || ''),
  })) : [];

  const b106i: StepData = {
    debtor_work_status: fd.debtorWorkStatus || '',
    employment_sources: employmentSources.length > 0 ? employmentSources : [{ employer_name: '', occupation: '', gross_monthly: '', net_monthly: '', employment_type: 'employed', business_expenses: '' }],
    has_spouse_income: spouseSources.length > 0 ? 'yes' : 'no',
    spouse_work_status: fd.spouseWorkStatus || '',
    spouse_sources: spouseSources.length > 0 ? spouseSources : [{ employer_name: '', occupation: '', gross_monthly: '', net_monthly: '', employment_type: 'employed', business_expenses: '' }],
    // Other income
    has_social_security: fd.dSocialSecurity ? 'yes' : 'no',
    social_security_amount: String(fd.dSocialSecurity || ''),
    has_pension: fd.dPension ? 'yes' : 'no',
    pension_source: fd.pensionSource || '',
    pension_amount: String(fd.dPension || ''),
    has_veterans: fd.dVeterans ? 'yes' : 'no',
    veterans_amount: String(fd.dVeterans || ''),
    has_rental_income: fd.dRentalIncome ? 'yes' : 'no',
    rental_income_amount: String(fd.dRentalIncome || ''),
    has_unemployment: fd.dUnemployment ? 'yes' : 'no',
    unemployment_amount: String(fd.dUnemployment || ''),
    has_child_support_income: fd.dChildSupport ? 'yes' : 'no',
    child_support_income_amount: String(fd.dChildSupport || ''),
    has_alimony_income: fd.dAlimony ? 'yes' : 'no',
    alimony_income_amount: String(fd.dAlimony || ''),
    has_other_income: fd.dOtherIncome ? 'yes' : 'no',
    other_income_description: fd.dOtherIncomeDescription || '',
    other_income_amount: String(fd.dOtherIncome || ''),
  };

  // ── Step 7: Monthly Expenses ──
  const b106j: StepData = {
    exp_rent_mortgage: String(fd.expRentMortgage || fd.realPropMonthlyPayment || ''),
    exp_food: String(fd.expFood || fd.expGroceries || ''),
    exp_utilities_electric: String(fd.expElectricity || fd.expElectric || ''),
    exp_utilities_water: String(fd.expWater || ''),
    exp_utilities_gas: String(fd.expGasHeat || fd.expGas || ''),
    exp_utilities_internet: String(fd.expInternet || ''),
    exp_phone: String(fd.expPhone || fd.expCellPhone || ''),
    exp_home_insurance: String(fd.expHomeInsurance || ''),
    exp_home_maintenance: String(fd.expHomeMaintenance || ''),
    exp_hoa: String(fd.expHoa || fd.hoaAmount || fd.hoaMonthlyAmount || ''),
    exp_vehicle_1_payment: String(fd.expVehicle1Payment || (vehicles[0] ? vehicles[0].monthlyPayment : '') || ''),
    exp_vehicle_2_payment: String(fd.expVehicle2Payment || (vehicles[1] ? vehicles[1].monthlyPayment : '') || ''),
    exp_vehicle_insurance: String(fd.expVehicleInsurance || fd.expAutoInsurance || ''),
    exp_vehicle_gas: String(fd.expGasoline || fd.expFuel || ''),
    exp_vehicle_maintenance: String(fd.expVehicleMaintenance || fd.expCarMaintenance || ''),
    exp_health_insurance: String(fd.expHealthInsurance || ''),
    exp_medical_dental: String(fd.expMedical || fd.expMedicalDental || ''),
    exp_childcare: String(fd.expChildcare || fd.expDaycare || ''),
    exp_child_support: String(fd.expChildSupport || ''),
    exp_alimony: String(fd.expAlimony || ''),
    exp_clothing: String(fd.expClothing || ''),
    exp_personal_care: String(fd.expPersonalCare || ''),
    exp_life_insurance: String(fd.expLifeInsurance || ''),
    exp_charitable: String(fd.expCharitable || fd.expCharity || fd.expDonations || ''),
    exp_education: String(fd.expEducation || ''),
    exp_subscriptions: String(fd.expSubscriptions || fd.expEntertainment || ''),
    exp_other_description: fd.expOtherDescription || '',
    exp_other_amount: String(fd.expOther || ''),
  };

  // ── Step 8: Financial History ──
  const b107: StepData = {
    prior_bankruptcy: fd.priorBankruptcy || 'no',
    prior_bankruptcy_chapter: fd.priorBankruptcyChapter || '',
    prior_bankruptcy_date: fd.priorBankruptcyDate || '',
    prior_bankruptcy_district: fd.priorBankruptcyDistrict || '',
    prior_bankruptcy_case_number: fd.priorBankruptcyCaseNumber || '',
    pending_lawsuits: fd.pendingLawsuits || 'no',
    pending_lawsuit_details: fd.pendingLawsuitDetails || fd.lawsuitDetails || '',
    transferred_property: fd.transferredProperty || 'no',
    transferred_property_details: fd.transferredPropertyDetails || '',
    created_trust: fd.createdTrust || 'no',
    trust_details: fd.trustDetails || '',
    preferential_payments_insider: fd.preferentialPaymentsInsider || 'no',
    preferential_payments_creditor: fd.preferentialPaymentsCreditor || 'no',
    preferential_payment_details: fd.preferentialPaymentDetails || '',
    preferential_payment_date: fd.preferentialPaymentDate || '',
    preferential_payment_amount: String(fd.preferentialPaymentAmount || ''),
    expected_refund: fd.expectedRefund || 'no',
    expected_refund_amount: String(fd.expectedRefundAmount || ''),
    expected_refund_source: fd.expectedRefundSource || 'tax_refund',
    owned_business: fd.ownedBusiness || 'no',
    business_name: fd.businessName || (Array.isArray(fd.debtorSources) && fd.debtorSources[0] ? fd.debtorSources[0].businessName || fd.debtorSources[0].employerName : '') || '',
    business_type: fd.businessType || '',
    business_closed_date: fd.businessClosedDate || '',
    received_payments_stopped: fd.receivedPaymentsStopped || 'no',
    received_payments_details: fd.receivedPaymentsDetails || '',
    safe_deposit_box: fd.safeDepositBox || 'no',
    safe_deposit_details: fd.safeDepositDetails || '',
    garnishments: fd.garnishments || 'no',
    garnishment_details: fd.garnishmentDetails || '',
    foreclosure_pending: fd.foreclosurePending || 'no',
    foreclosure_details: fd.foreclosureDetails || '',
  };

  return { b101, b106ab, b106d, b106ef, b106g, b106i, b106j, b107 };
}

// ── Step Components ───────────────────────────────────────────────────────────

function StepB101({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const f = (key: string) => (v: string) => setData({ ...data, [key]: v });
  const isMarried = data.filing_type === 'married_joint' || data.filing_type === 'married_individual';
  return (
    <div>
      {hasIntake && <PrefilledBadge />}
      <SectionHeader title="Debtor Information" />
      <Grid2>
        <Field label="First Name" required prefilled={hasIntake && !!data.first_name}>
          <TextInput value={data.first_name} onChange={f('first_name')} placeholder="John" prefilled={hasIntake && !!data.first_name} />
        </Field>
        <Field label="Middle Name" prefilled={hasIntake && !!data.middle_name}>
          <TextInput value={data.middle_name} onChange={f('middle_name')} placeholder="M." prefilled={hasIntake && !!data.middle_name} />
        </Field>
        <Field label="Last Name" required prefilled={hasIntake && !!data.last_name}>
          <TextInput value={data.last_name} onChange={f('last_name')} placeholder="Smith" prefilled={hasIntake && !!data.last_name} />
        </Field>
        <Field label="Suffix">
          <SelectInput value={data.suffix} onChange={f('suffix')} placeholder="Select" options={[{value:'Jr.',label:'Jr.'},{value:'Sr.',label:'Sr.'},{value:'II',label:'II'},{value:'III',label:'III'},{value:'IV',label:'IV'}]} />
        </Field>
      </Grid2>
      <Grid2>
        <Field label="Date of Birth" required prefilled={hasIntake && !!data.dob}>
          <TextInput value={data.dob} onChange={f('dob')} type="date" prefilled={hasIntake && !!data.dob} />
        </Field>
        <Field label="SSN — Last 4 Digits" required>
          <TextInput value={data.ssn_last4} onChange={f('ssn_last4')} placeholder="XXXX" prefilled={hasIntake && !!data.ssn_last4} />
        </Field>
      </Grid2>
      <Field label="Have you used any other names in the last 8 years?" required>
        <YesNo value={data.has_other_names} onChange={f('has_other_names')} />
      </Field>
      {data.has_other_names === 'yes' && (
        <Field label="Other Names Used (include maiden name, married name, or aliases)">
          <TextInput value={data.other_names} onChange={f('other_names')} placeholder="e.g. Jane Doe, Jane M. Smith" prefilled={hasIntake && !!data.other_names} />
        </Field>
      )}

      <SectionHeader title="Current Address" />
      <Field label="Street Address" required prefilled={hasIntake && !!data.street_name}>
        <TextInput value={data.street_name} onChange={f('street_name')} placeholder="123 Main Street" prefilled={hasIntake && !!data.street_name} />
      </Field>
      <Grid2>
        <Field label="City" required prefilled={hasIntake && !!data.city}>
          <TextInput value={data.city} onChange={f('city')} placeholder="Phoenix" prefilled={hasIntake && !!data.city} />
        </Field>
        <Field label="State" required prefilled={hasIntake && !!data.state}>
          <SelectInput value={data.state} onChange={f('state')} placeholder="Select state" options={US_STATES.map(s => ({ value: s, label: s }))} prefilled={hasIntake && !!data.state} />
        </Field>
        <Field label="ZIP Code" required prefilled={hasIntake && !!data.zip_code}>
          <TextInput value={data.zip_code} onChange={f('zip_code')} placeholder="85001" prefilled={hasIntake && !!data.zip_code} />
        </Field>
        <Field label="County" prefilled={hasIntake && !!data.county}>
          <TextInput value={data.county} onChange={f('county')} placeholder="Maricopa" prefilled={hasIntake && !!data.county} />
        </Field>
      </Grid2>
      <Field label="Have you lived at another address in the last 3 years?">
        <YesNo value={data.has_rented} onChange={f('has_rented')} />
      </Field>

      <SectionHeader title="Filing Type" />
      <Field label="Filing Type" required prefilled={hasIntake && !!data.filing_type}>
        <SelectInput value={data.filing_type} onChange={f('filing_type')} placeholder="Select"
          options={[
            {value:'individual', label:'Individual'},
            {value:'married_joint', label:'Married — Joint Filing'},
            {value:'married_individual', label:'Married — Individual Filing (Non-filing Spouse)'},
          ]}
          prefilled={hasIntake && !!data.filing_type}
        />
      </Field>

      {isMarried && (
        <>
          <SectionHeader title="Spouse Information" />
          <Grid2>
            <Field label="Spouse First Name" required prefilled={hasIntake && !!data.spouse_first_name}>
              <TextInput value={data.spouse_first_name} onChange={f('spouse_first_name')} placeholder="Jane" prefilled={hasIntake && !!data.spouse_first_name} />
            </Field>
            <Field label="Spouse Middle Name" prefilled={hasIntake && !!data.spouse_middle_name}>
              <TextInput value={data.spouse_middle_name} onChange={f('spouse_middle_name')} placeholder="A." prefilled={hasIntake && !!data.spouse_middle_name} />
            </Field>
            <Field label="Spouse Last Name" required prefilled={hasIntake && !!data.spouse_last_name}>
              <TextInput value={data.spouse_last_name} onChange={f('spouse_last_name')} placeholder="Smith" prefilled={hasIntake && !!data.spouse_last_name} />
            </Field>
            <Field label="Spouse Date of Birth" prefilled={hasIntake && !!data.spouse_dob}>
              <TextInput value={data.spouse_dob} onChange={f('spouse_dob')} type="date" prefilled={hasIntake && !!data.spouse_dob} />
            </Field>
          </Grid2>
          <Field label="Spouse SSN — Last 4 Digits">
            <TextInput value={data.spouse_ssn_last4} onChange={f('spouse_ssn_last4')} placeholder="XXXX" />
          </Field>
          <Field label="Does spouse live at the same address?">
            <YesNo value={data.spouse_same_address} onChange={f('spouse_same_address')} />
          </Field>
        </>
      )}

      <SectionHeader title="Dependents" />
      <Field label="Do you have any dependents?" hint="Children or other persons financially dependent on you.">
        <YesNo value={data.dependents?.length > 0 ? 'yes' : (data.has_dependents || 'no')} onChange={v => {
          if (v === 'yes' && (!data.dependents || data.dependents.length === 0)) {
            setData({ ...data, has_dependents: 'yes', dependents: [{ name: '', relationship: '', age: '' }] });
          } else if (v === 'no') {
            setData({ ...data, has_dependents: 'no', dependents: [] });
          } else {
            setData({ ...data, has_dependents: v });
          }
        }} />
      </Field>
      {(data.has_dependents === 'yes' || (data.dependents && data.dependents.length > 0)) && (
        <DynamicRows
          rows={data.dependents || []}
          setRows={rows => setData({ ...data, dependents: rows })}
          emptyRow={{ name: '', relationship: '', age: '' }}
          addLabel="Add Dependent"
          renderRow={(row, _idx, update) => (
            <Grid2>
              <Field label="Full Name" prefilled={hasIntake && !!row.name}>
                <TextInput value={row.name} onChange={v => update('name', v)} placeholder="Jane Smith" prefilled={hasIntake && !!row.name} />
              </Field>
              <Field label="Relationship" prefilled={hasIntake && !!row.relationship}>
                <SelectInput value={row.relationship} onChange={v => update('relationship', v)} placeholder="Select"
                  options={[{value:'Child',label:'Child'},{value:'Stepchild',label:'Stepchild'},{value:'Parent',label:'Parent'},{value:'Sibling',label:'Sibling'},{value:'Other',label:'Other'}]}
                  prefilled={hasIntake && !!row.relationship}
                />
              </Field>
              <Field label="Age" prefilled={hasIntake && !!row.age}>
                <TextInput value={row.age} onChange={v => update('age', v)} placeholder="5" type="number" prefilled={hasIntake && !!row.age} />
              </Field>
            </Grid2>
          )}
        />
      )}

      <SectionHeader title="Credit Counseling" />
      <Field label="Have you completed a credit counseling course in the last 180 days?" required>
        <YesNo value={data.credit_counseling_completed} onChange={f('credit_counseling_completed')} />
      </Field>
      {data.credit_counseling_completed === 'yes' && (
        <Grid2>
          <Field label="Agency Name">
            <TextInput value={data.credit_counseling_agency} onChange={f('credit_counseling_agency')} placeholder="NFCC Counseling Agency" />
          </Field>
          <Field label="Date Completed">
            <TextInput value={data.credit_counseling_date} onChange={f('credit_counseling_date')} type="date" />
          </Field>
        </Grid2>
      )}
    </div>
  );
}

function StepB106AB({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const f = (key: string) => (v: string) => setData({ ...data, [key]: v });
  return (
    <div>
      {hasIntake && <PrefilledBadge />}

      {/* Real Estate */}
      <SectionHeader title="Real Property" />
      <Field label="Do you own or have any interest in real property?">
        <YesNo value={data.has_real_estate} onChange={v => {
          if (v === 'yes' && (!data.real_estate || data.real_estate.length === 0)) {
            setData({ ...data, has_real_estate: 'yes', real_estate: [{ address: '', city: '', state: '', zip: '', description: 'Primary Residence', value: '', how_owned: 'sole', nature: 'fee_simple' }] });
          } else {
            setData({ ...data, has_real_estate: v });
          }
        }} />
      </Field>
      {data.has_real_estate === 'yes' && (
        <DynamicRows
          rows={data.real_estate || []}
          setRows={rows => setData({ ...data, real_estate: rows })}
          emptyRow={{ address: '', city: '', state: '', zip: '', description: '', value: '', how_owned: 'sole', nature: 'fee_simple' }}
          addLabel="Add Property"
          renderRow={(row, _idx, update) => (
            <div>
              <Field label="Street Address" prefilled={hasIntake && !!row.address}>
                <TextInput value={row.address} onChange={v => update('address', v)} placeholder="123 Main St" prefilled={hasIntake && !!row.address} />
              </Field>
              <Grid2>
                <Field label="City" prefilled={hasIntake && !!row.city}>
                  <TextInput value={row.city} onChange={v => update('city', v)} placeholder="Phoenix" prefilled={hasIntake && !!row.city} />
                </Field>
                <Field label="State" prefilled={hasIntake && !!row.state}>
                  <SelectInput value={row.state} onChange={v => update('state', v)} placeholder="State" options={US_STATES.map(s => ({ value: s, label: s }))} prefilled={hasIntake && !!row.state} />
                </Field>
                <Field label="ZIP" prefilled={hasIntake && !!row.zip}>
                  <TextInput value={row.zip} onChange={v => update('zip', v)} placeholder="85001" prefilled={hasIntake && !!row.zip} />
                </Field>
                <Field label="Current Market Value" prefilled={hasIntake && !!row.value}>
                  <AmountInput value={row.value} onChange={v => update('value', v)} prefilled={hasIntake && !!row.value} />
                </Field>
              </Grid2>
              <Grid2>
                <Field label="Property Description">
                  <SelectInput value={row.description} onChange={v => update('description', v)} placeholder="Select" options={[{value:'Primary Residence',label:'Primary Residence'},{value:'Rental Property',label:'Rental Property'},{value:'Vacation Home',label:'Vacation Home'},{value:'Land',label:'Land'},{value:'Commercial',label:'Commercial'},{value:'Other',label:'Other'}]} />
                </Field>
                <Field label="Nature of Ownership">
                  <SelectInput value={row.nature} onChange={v => update('nature', v)} placeholder="Select" options={[{value:'fee_simple',label:'Fee Simple'},{value:'joint_tenancy',label:'Joint Tenancy'},{value:'tenancy_common',label:'Tenancy in Common'},{value:'community',label:'Community Property'},{value:'life_estate',label:'Life Estate'},{value:'other',label:'Other'}]} />
                </Field>
                <Field label="How Owned">
                  <SelectInput value={row.how_owned} onChange={v => update('how_owned', v)} placeholder="Select" options={[{value:'sole',label:'Sole'},{value:'joint_spouse',label:'Joint with Spouse'},{value:'joint_other',label:'Joint with Other'},{value:'community',label:'Community Property'}]} />
                </Field>
              </Grid2>
            </div>
          )}
        />
      )}

      {/* Vehicles */}
      <SectionHeader title="Motor Vehicles" />
      <Field label="Do you own or lease any vehicles?">
        <YesNo value={data.has_vehicles} onChange={v => {
          if (v === 'yes' && (!data.vehicles || data.vehicles.length === 0)) {
            setData({ ...data, has_vehicles: 'yes', vehicles: [{ year: '', make: '', model: '', mileage: '', value: '', how_owned: 'sole', is_leased: 'no', lender: '', balance: '' }] });
          } else {
            setData({ ...data, has_vehicles: v });
          }
        }} />
      </Field>
      {data.has_vehicles === 'yes' && (
        <DynamicRows
          rows={data.vehicles || []}
          setRows={rows => setData({ ...data, vehicles: rows })}
          emptyRow={{ year: '', make: '', model: '', mileage: '', value: '', how_owned: 'sole', is_leased: 'no', lender: '', balance: '' }}
          addLabel="Add Vehicle"
          renderRow={(row, _idx, update) => (
            <div>
              <Grid2>
                <Field label="Year" prefilled={hasIntake && !!row.year}>
                  <TextInput value={row.year} onChange={v => update('year', v)} placeholder="2022" prefilled={hasIntake && !!row.year} />
                </Field>
                <Field label="Make" prefilled={hasIntake && !!row.make}>
                  <TextInput value={row.make} onChange={v => update('make', v)} placeholder="Toyota" prefilled={hasIntake && !!row.make} />
                </Field>
                <Field label="Model" prefilled={hasIntake && !!row.model}>
                  <TextInput value={row.model} onChange={v => update('model', v)} placeholder="Camry" prefilled={hasIntake && !!row.model} />
                </Field>
                <Field label="Mileage">
                  <TextInput value={row.mileage} onChange={v => update('mileage', v)} placeholder="45,000" />
                </Field>
                <Field label="Current Market Value" prefilled={hasIntake && !!row.value}>
                  <AmountInput value={row.value} onChange={v => update('value', v)} prefilled={hasIntake && !!row.value} />
                </Field>
                <Field label="How Owned">
                  <SelectInput value={row.how_owned} onChange={v => update('how_owned', v)} placeholder="Select" options={[{value:'sole',label:'Sole'},{value:'joint_spouse',label:'Joint with Spouse'},{value:'joint_other',label:'Joint with Other'},{value:'community',label:'Community Property'}]} />
                </Field>
              </Grid2>
              <Field label="Is this vehicle leased?">
                <YesNo value={row.is_leased} onChange={v => update('is_leased', v)} />
              </Field>
            </div>
          )}
        />
      )}

      {/* Bank Accounts */}
      <SectionHeader title="Bank & Financial Accounts" />
      <Field label="Do you have any bank accounts, savings accounts, or money market accounts?">
        <YesNo value={data.has_bank_accounts} onChange={v => {
          if (v === 'yes' && (!data.bank_accounts || data.bank_accounts.length === 0)) {
            setData({ ...data, has_bank_accounts: 'yes', bank_accounts: [{ institution: '', account_type: 'checking', balance: '', last4: '' }] });
          } else {
            setData({ ...data, has_bank_accounts: v });
          }
        }} />
      </Field>
      {data.has_bank_accounts === 'yes' && (
        <DynamicRows
          rows={data.bank_accounts || []}
          setRows={rows => setData({ ...data, bank_accounts: rows })}
          emptyRow={{ institution: '', account_type: 'checking', balance: '', last4: '' }}
          addLabel="Add Account"
          renderRow={(row, _idx, update) => (
            <Grid2>
              <Field label="Financial Institution" prefilled={hasIntake && !!row.institution}>
                <TextInput value={row.institution} onChange={v => update('institution', v)} placeholder="Chase Bank" prefilled={hasIntake && !!row.institution} />
              </Field>
              <Field label="Account Type">
                <SelectInput value={row.account_type} onChange={v => update('account_type', v)} placeholder="Select" options={[{value:'checking',label:'Checking'},{value:'savings',label:'Savings'},{value:'money_market',label:'Money Market'},{value:'cd',label:'CD'},{value:'other',label:'Other'}]} />
              </Field>
              <Field label="Current Balance" prefilled={hasIntake && !!row.balance}>
                <AmountInput value={row.balance} onChange={v => update('balance', v)} prefilled={hasIntake && !!row.balance} />
              </Field>
              <Field label="Account Last 4 Digits">
                <TextInput value={row.last4} onChange={v => update('last4', v)} placeholder="XXXX" />
              </Field>
            </Grid2>
          )}
        />
      )}

      {/* Retirement */}
      <SectionHeader title="Retirement & Investment Accounts" />
      <Field label="Do you have any retirement or investment accounts? (401k, IRA, pension, etc.)">
        <YesNo value={data.has_retirement} onChange={v => {
          if (v === 'yes' && (!data.retirement_accounts || data.retirement_accounts.length === 0)) {
            setData({ ...data, has_retirement: 'yes', retirement_accounts: [{ institution: '', account_type: '401k', balance: '' }] });
          } else {
            setData({ ...data, has_retirement: v });
          }
        }} />
      </Field>
      {data.has_retirement === 'yes' && (
        <DynamicRows
          rows={data.retirement_accounts || []}
          setRows={rows => setData({ ...data, retirement_accounts: rows })}
          emptyRow={{ institution: '', account_type: '401k', balance: '' }}
          addLabel="Add Retirement Account"
          renderRow={(row, _idx, update) => (
            <Grid2>
              <Field label="Institution" prefilled={hasIntake && !!row.institution}>
                <TextInput value={row.institution} onChange={v => update('institution', v)} placeholder="Fidelity Investments" prefilled={hasIntake && !!row.institution} />
              </Field>
              <Field label="Account Type">
                <SelectInput value={row.account_type} onChange={v => update('account_type', v)} placeholder="Select" options={[{value:'401k',label:'401(k)'},{value:'403b',label:'403(b)'},{value:'ira',label:'IRA'},{value:'roth_ira',label:'Roth IRA'},{value:'pension',label:'Pension'},{value:'sep_ira',label:'SEP IRA'},{value:'other',label:'Other'}]} />
              </Field>
              <Field label="Current Balance" prefilled={hasIntake && !!row.balance}>
                <AmountInput value={row.balance} onChange={v => update('balance', v)} prefilled={hasIntake && !!row.balance} />
              </Field>
            </Grid2>
          )}
        />
      )}

      {/* Life Insurance */}
      <SectionHeader title="Life Insurance" />
      <Field label="Do you have any life insurance policies with a cash value?">
        <YesNo value={data.has_life_insurance} onChange={v => {
          if (v === 'yes' && (!data.life_insurance || data.life_insurance.length === 0)) {
            setData({ ...data, has_life_insurance: 'yes', life_insurance: [{ company: '', policy_type: 'whole_life', face_value: '', cash_value: '', beneficiary: '' }] });
          } else {
            setData({ ...data, has_life_insurance: v });
          }
        }} />
      </Field>
      {data.has_life_insurance === 'yes' && (
        <DynamicRows
          rows={data.life_insurance || []}
          setRows={rows => setData({ ...data, life_insurance: rows })}
          emptyRow={{ company: '', policy_type: 'whole_life', face_value: '', cash_value: '', beneficiary: '' }}
          addLabel="Add Policy"
          renderRow={(row, _idx, update) => (
            <Grid2>
              <Field label="Insurance Company" prefilled={hasIntake && !!row.company}>
                <TextInput value={row.company} onChange={v => update('company', v)} placeholder="MetLife" prefilled={hasIntake && !!row.company} />
              </Field>
              <Field label="Policy Type">
                <SelectInput value={row.policy_type} onChange={v => update('policy_type', v)} placeholder="Select" options={[{value:'whole_life',label:'Whole Life'},{value:'term',label:'Term'},{value:'universal',label:'Universal Life'},{value:'variable',label:'Variable'}]} />
              </Field>
              <Field label="Face Value" prefilled={hasIntake && !!row.face_value}>
                <AmountInput value={row.face_value} onChange={v => update('face_value', v)} prefilled={hasIntake && !!row.face_value} />
              </Field>
              <Field label="Cash Surrender Value" prefilled={hasIntake && !!row.cash_value}>
                <AmountInput value={row.cash_value} onChange={v => update('cash_value', v)} prefilled={hasIntake && !!row.cash_value} />
              </Field>
              <Field label="Beneficiary" prefilled={hasIntake && !!row.beneficiary}>
                <TextInput value={row.beneficiary} onChange={v => update('beneficiary', v)} placeholder="Jane Smith" prefilled={hasIntake && !!row.beneficiary} />
              </Field>
            </Grid2>
          )}
        />
      )}

      {/* Annuity */}
      <SectionHeader title="Annuities" />
      <Field label="Do you have any annuities?">
        <YesNo value={data.has_annuity} onChange={f('has_annuity')} />
      </Field>
      {data.has_annuity === 'yes' && (
        <Grid2>
          <Field label="Annuity Company" prefilled={hasIntake && !!data.annuity_company}>
            <TextInput value={data.annuity_company} onChange={f('annuity_company')} placeholder="Pacific Life" prefilled={hasIntake && !!data.annuity_company} />
          </Field>
          <Field label="Current Value" prefilled={hasIntake && !!data.annuity_value}>
            <AmountInput value={data.annuity_value} onChange={f('annuity_value')} prefilled={hasIntake && !!data.annuity_value} />
          </Field>
        </Grid2>
      )}

      {/* Personal Property */}
      <SectionHeader title="Personal Property" />
      <Grid2>
        <Field label="Jewelry & Watches (estimated value)" prefilled={hasIntake && !!data.jewelry_value}>
          <AmountInput value={data.jewelry_value} onChange={f('jewelry_value')} prefilled={hasIntake && !!data.jewelry_value} />
        </Field>
        <Field label="Household Furnishings & Goods" prefilled={hasIntake && !!data.household_goods_value}>
          <AmountInput value={data.household_goods_value} onChange={f('household_goods_value')} prefilled={hasIntake && !!data.household_goods_value} />
        </Field>
        <Field label="Electronics (computers, TVs, etc.)" prefilled={hasIntake && !!data.electronics_value}>
          <AmountInput value={data.electronics_value} onChange={f('electronics_value')} prefilled={hasIntake && !!data.electronics_value} />
        </Field>
        <Field label="Clothing (estimated value)" prefilled={hasIntake && !!data.clothing_value}>
          <AmountInput value={data.clothing_value} onChange={f('clothing_value')} prefilled={hasIntake && !!data.clothing_value} />
        </Field>
      </Grid2>

      {/* Firearms */}
      <SectionHeader title="Firearms" />
      <Field label="Do you own any firearms?">
        <YesNo value={data.has_firearms} onChange={v => {
          if (v === 'yes' && (!data.firearms || data.firearms.length === 0)) {
            setData({ ...data, has_firearms: 'yes', firearms: [{ description: '', value: '' }] });
          } else {
            setData({ ...data, has_firearms: v });
          }
        }} />
      </Field>
      {data.has_firearms === 'yes' && (
        <DynamicRows
          rows={data.firearms || []}
          setRows={rows => setData({ ...data, firearms: rows })}
          emptyRow={{ description: '', value: '' }}
          addLabel="Add Firearm"
          renderRow={(row, _idx, update) => (
            <Grid2>
              <Field label="Description (make, model, caliber)" prefilled={hasIntake && !!row.description}>
                <TextInput value={row.description} onChange={v => update('description', v)} placeholder="Glock 19, 9mm" prefilled={hasIntake && !!row.description} />
              </Field>
              <Field label="Estimated Value" prefilled={hasIntake && !!row.value}>
                <AmountInput value={row.value} onChange={v => update('value', v)} prefilled={hasIntake && !!row.value} />
              </Field>
            </Grid2>
          )}
        />
      )}

      {/* Other Assets */}
      <SectionHeader title="Other Assets" />
      <Field label="Do you have any other assets not listed above?" hint="Includes business interests, stocks, bonds, intellectual property, cryptocurrency, pending lawsuits or claims, or any other property.">
        <YesNo value={data.has_other_assets} onChange={f('has_other_assets')} />
      </Field>
      {data.has_other_assets === 'yes' && (
        <Grid2>
          <Field label="Description">
            <TextInput value={data.other_assets_description} onChange={f('other_assets_description')} placeholder="Describe the asset" />
          </Field>
          <Field label="Estimated Value">
            <AmountInput value={data.other_assets_value} onChange={f('other_assets_value')} />
          </Field>
        </Grid2>
      )}
    </div>
  );
}

function StepB106D({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const f = (key: string) => (v: string) => setData({ ...data, [key]: v });
  return (
    <div>
      {hasIntake && <PrefilledBadge />}
      <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
        <p className="text-blue-300 text-sm"><span className="font-semibold">Secured creditors</span> are lenders who hold a lien on property you own (mortgage lenders, auto lenders, etc.). Please confirm the information below and provide any missing details.</p>
      </div>
      <SectionHeader title="Secured Creditors" />
      <Field label="Do you have any secured debts (mortgage, auto loans, etc.)?">
        <YesNo value={data.has_secured_debts} onChange={v => {
          if (v === 'yes' && (!data.secured_creditors || data.secured_creditors.length === 0)) {
            setData({ ...data, has_secured_debts: 'yes', secured_creditors: [{ creditor_name: '', account_last4: '', collateral: '', monthly_payment: '', current_balance: '', is_current: '', arrears: '' }] });
          } else {
            setData({ ...data, has_secured_debts: v });
          }
        }} />
      </Field>
      {data.has_secured_debts === 'yes' && (
        <DynamicRows
          rows={data.secured_creditors || []}
          setRows={rows => setData({ ...data, secured_creditors: rows })}
          emptyRow={{ creditor_name: '', account_last4: '', collateral: '', monthly_payment: '', current_balance: '', is_current: '', arrears: '' }}
          addLabel="Add Secured Creditor"
          renderRow={(row, _idx, update) => (
            <div>
              <Grid2>
                <Field label="Creditor / Lender Name" required prefilled={hasIntake && !!row.creditor_name}>
                  <TextInput value={row.creditor_name} onChange={v => update('creditor_name', v)} placeholder="e.g. Wells Fargo Home Mortgage" prefilled={hasIntake && !!row.creditor_name} />
                </Field>
                <Field label="Account Last 4 Digits" required hint="Please provide the last 4 digits of the account number.">
                  <TextInput value={row.account_last4} onChange={v => update('account_last4', v)} placeholder="XXXX" />
                </Field>
                <Field label="Collateral (what secures the debt)" prefilled={hasIntake && !!row.collateral}>
                  <TextInput value={row.collateral} onChange={v => update('collateral', v)} placeholder="e.g. 123 Main St, Phoenix AZ" prefilled={hasIntake && !!row.collateral} />
                </Field>
                <Field label="Monthly Payment" required prefilled={hasIntake && !!row.monthly_payment}>
                  <AmountInput value={row.monthly_payment} onChange={v => update('monthly_payment', v)} prefilled={hasIntake && !!row.monthly_payment} />
                </Field>
                <Field label="Current Balance Owed" required prefilled={hasIntake && !!row.current_balance}>
                  <AmountInput value={row.current_balance} onChange={v => update('current_balance', v)} prefilled={hasIntake && !!row.current_balance} />
                </Field>
                <Field label="Is this debt current?">
                  <SelectInput value={row.is_current} onChange={v => update('is_current', v)} placeholder="Select" options={[{value:'yes',label:'Yes — current'},{value:'no',label:'No — past due'},{value:'forbearance',label:'In forbearance/deferral'}]} />
                </Field>
              </Grid2>
              {row.is_current === 'no' && (
                <Field label="Amount in Arrears">
                  <AmountInput value={row.arrears} onChange={v => update('arrears', v)} />
                </Field>
              )}
            </div>
          )}
        />
      )}

      {/* HOA */}
      <SectionHeader title="Homeowners Association (HOA)" />
      <Field label="Do you pay HOA fees?">
        <YesNo value={data.has_hoa} onChange={f('has_hoa')} />
      </Field>
      {data.has_hoa === 'yes' && (
        <Grid2>
          <Field label="HOA Name" prefilled={hasIntake && !!data.hoa_name}>
            <TextInput value={data.hoa_name} onChange={f('hoa_name')} placeholder="Pinnacle Peak Estates HOA" prefilled={hasIntake && !!data.hoa_name} />
          </Field>
          <Field label="Monthly HOA Fee" prefilled={hasIntake && !!data.hoa_monthly}>
            <AmountInput value={data.hoa_monthly} onChange={f('hoa_monthly')} prefilled={hasIntake && !!data.hoa_monthly} />
          </Field>
          <Field label="Amount Past Due / Owed">
            <AmountInput value={data.hoa_balance_owed} onChange={f('hoa_balance_owed')} />
          </Field>
        </Grid2>
      )}

      {/* Tax Liens */}
      <SectionHeader title="Liens & Judgments" />
      <Field label="Are there any tax liens or judgment liens against you or your property?">
        <YesNo value={data.has_tax_liens} onChange={f('has_tax_liens')} />
      </Field>
      {data.has_tax_liens === 'yes' && (
        <Grid2>
          <Field label="Lienholder / Creditor Name" prefilled={hasIntake && !!data.tax_lien_creditor}>
            <TextInput value={data.tax_lien_creditor} onChange={f('tax_lien_creditor')} placeholder="IRS, State of Arizona, etc." prefilled={hasIntake && !!data.tax_lien_creditor} />
          </Field>
          <Field label="Amount" prefilled={hasIntake && !!data.tax_lien_amount}>
            <AmountInput value={data.tax_lien_amount} onChange={f('tax_lien_amount')} prefilled={hasIntake && !!data.tax_lien_amount} />
          </Field>
          <Field label="County / Jurisdiction" prefilled={hasIntake && !!data.tax_lien_county}>
            <TextInput value={data.tax_lien_county} onChange={f('tax_lien_county')} placeholder="Maricopa County" prefilled={hasIntake && !!data.tax_lien_county} />
          </Field>
        </Grid2>
      )}
    </div>
  );
}

function StepB106EF({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const f = (key: string) => (v: string) => setData({ ...data, [key]: v });
  return (
    <div>
      {hasIntake && <PrefilledBadge />}

      {/* Credit Cards */}
      <SectionHeader title="Credit Card Debts" />
      <Field label="Do you have any credit card debts?">
        <YesNo value={data.has_credit_cards} onChange={v => {
          if (v === 'yes' && (!data.credit_cards || !data.credit_cards.some((c: any) => c.creditor_name || c.balance))) {
            setData({ ...data, has_credit_cards: 'yes', credit_cards: [{ creditor_name: '', account_last4: '', balance: '', monthly_payment: '' }] });
          } else {
            setData({ ...data, has_credit_cards: v });
          }
        }} />
      </Field>
      {data.has_credit_cards === 'yes' && (
        <DynamicRows
          rows={data.credit_cards || []}
          setRows={rows => setData({ ...data, credit_cards: rows })}
          emptyRow={{ creditor_name: '', account_last4: '', balance: '', monthly_payment: '' }}
          addLabel="Add Credit Card"
          renderRow={(row, _idx, update) => (
            <Grid2>
              <Field label="Creditor Name" prefilled={hasIntake && !!row.creditor_name}>
                <TextInput value={row.creditor_name} onChange={v => update('creditor_name', v)} placeholder="Chase, Citi, Bank of America" prefilled={hasIntake && !!row.creditor_name} />
              </Field>
              <Field label="Account Last 4">
                <TextInput value={row.account_last4} onChange={v => update('account_last4', v)} placeholder="XXXX" prefilled={hasIntake && !!row.account_last4} />
              </Field>
              <Field label="Current Balance" prefilled={hasIntake && !!row.balance}>
                <AmountInput value={row.balance} onChange={v => update('balance', v)} prefilled={hasIntake && !!row.balance} />
              </Field>
              <Field label="Minimum Monthly Payment">
                <AmountInput value={row.monthly_payment} onChange={v => update('monthly_payment', v)} prefilled={hasIntake && !!row.monthly_payment} />
              </Field>
            </Grid2>
          )}
        />
      )}

      {/* Medical Debts */}
      <SectionHeader title="Medical & Hospital Debts" />
      <Field label="Do you have any medical, hospital, or dental debts?">
        <YesNo value={data.has_medical} onChange={v => {
          if (v === 'yes' && (!data.medical_debts || !data.medical_debts.some((m: any) => m.creditor_name || m.balance))) {
            setData({ ...data, has_medical: 'yes', medical_debts: [{ creditor_name: '', balance: '' }] });
          } else {
            setData({ ...data, has_medical: v });
          }
        }} />
      </Field>
      {data.has_medical === 'yes' && (
        <DynamicRows
          rows={data.medical_debts || []}
          setRows={rows => setData({ ...data, medical_debts: rows })}
          emptyRow={{ creditor_name: '', balance: '' }}
          addLabel="Add Medical Debt"
          renderRow={(row, _idx, update) => (
            <Grid2>
              <Field label="Provider / Hospital" prefilled={hasIntake && !!row.creditor_name}>
                <TextInput value={row.creditor_name} onChange={v => update('creditor_name', v)} placeholder="Mayo Clinic, Banner Health" prefilled={hasIntake && !!row.creditor_name} />
              </Field>
              <Field label="Balance Owed" prefilled={hasIntake && !!row.balance}>
                <AmountInput value={row.balance} onChange={v => update('balance', v)} prefilled={hasIntake && !!row.balance} />
              </Field>
            </Grid2>
          )}
        />
      )}

      {/* Student Loans */}
      <SectionHeader title="Student Loans" />
      <Field label="Do you have any student loans?">
        <YesNo value={data.has_student_loans} onChange={f('has_student_loans')} />
      </Field>
      {data.has_student_loans === 'yes' && (
        <Grid2>
          <Field label="Loan Servicer">
            <TextInput value={data.student_loan_servicer} onChange={f('student_loan_servicer')} placeholder="Navient, Nelnet, Great Lakes" />
          </Field>
          <Field label="Total Balance">
            <AmountInput value={data.student_loan_balance} onChange={f('student_loan_balance')} />
          </Field>
        </Grid2>
      )}

      {/* Tax Debt */}
      <SectionHeader title="Tax Debts" />
      <Field label="Do you owe any federal, state, or local tax debts?">
        <YesNo value={data.has_tax_debt} onChange={f('has_tax_debt')} />
      </Field>
      {data.has_tax_debt === 'yes' && (
        <Grid2>
          <Field label="Type of Tax Debt" prefilled={hasIntake && !!data.tax_debt_type}>
            <SelectInput value={data.tax_debt_type} onChange={f('tax_debt_type')} placeholder="Select" options={[{value:'federal_income',label:'Federal Income Tax'},{value:'state_income',label:'State Income Tax'},{value:'payroll',label:'Payroll/Employment Tax'},{value:'sales',label:'Sales Tax'},{value:'property',label:'Property Tax'},{value:'other',label:'Other'}]} prefilled={hasIntake && !!data.tax_debt_type} />
          </Field>
          <Field label="Amount Owed" prefilled={hasIntake && !!data.tax_debt_amount}>
            <AmountInput value={data.tax_debt_amount} onChange={f('tax_debt_amount')} prefilled={hasIntake && !!data.tax_debt_amount} />
          </Field>
        </Grid2>
      )}

      {/* Personal Loans */}
      <SectionHeader title="Personal & Other Loans" />
      <Field label="Do you have any personal loans, payday loans, or signature loans?">
        <YesNo value={data.has_personal_loans} onChange={f('has_personal_loans')} />
      </Field>
      {data.has_personal_loans === 'yes' && (
        <DynamicRows
          rows={data.personal_loans || [{ creditor_name: '', balance: '', monthly_payment: '' }]}
          setRows={rows => setData({ ...data, personal_loans: rows })}
          emptyRow={{ creditor_name: '', balance: '', monthly_payment: '' }}
          addLabel="Add Personal Loan"
          renderRow={(row, _idx, update) => (
            <Grid2>
              <Field label="Lender Name">
                <TextInput value={row.creditor_name} onChange={v => update('creditor_name', v)} placeholder="Lender name" />
              </Field>
              <Field label="Balance Owed">
                <AmountInput value={row.balance} onChange={v => update('balance', v)} />
              </Field>
              <Field label="Monthly Payment">
                <AmountInput value={row.monthly_payment} onChange={v => update('monthly_payment', v)} />
              </Field>
            </Grid2>
          )}
        />
      )}

      {/* Other Unsecured */}
      <SectionHeader title="Other Unsecured Debts" />
      <Field label="Do you have any other unsecured debts not listed above?" hint="Includes business debts, family loans, collection accounts, judgments, etc.">
        <YesNo value={data.has_other_unsecured} onChange={v => {
          if (v === 'yes' && (!data.other_unsecured || data.other_unsecured.length === 0)) {
            setData({ ...data, has_other_unsecured: 'yes', other_unsecured: [{ creditor_name: '', debt_type: '', balance: '' }] });
          } else {
            setData({ ...data, has_other_unsecured: v });
          }
        }} />
      </Field>
      {data.has_other_unsecured === 'yes' && (
        <DynamicRows
          rows={data.other_unsecured || []}
          setRows={rows => setData({ ...data, other_unsecured: rows })}
          emptyRow={{ creditor_name: '', debt_type: '', balance: '' }}
          addLabel="Add Other Debt"
          renderRow={(row, _idx, update) => (
            <Grid2>
              <Field label="Creditor Name" prefilled={hasIntake && !!row.creditor_name}>
                <TextInput value={row.creditor_name} onChange={v => update('creditor_name', v)} placeholder="Creditor or lender name" prefilled={hasIntake && !!row.creditor_name} />
              </Field>
              <Field label="Type of Debt" prefilled={hasIntake && !!row.debt_type}>
                <SelectInput value={row.debt_type} onChange={v => update('debt_type', v)} placeholder="Select"
                  options={[{value:'business',label:'Business Debt'},{value:'family_loan',label:'Family/Friend Loan'},{value:'collection',label:'Collection Account'},{value:'judgment',label:'Court Judgment'},{value:'utility',label:'Utility'},{value:'other',label:'Other'}]}
                  prefilled={hasIntake && !!row.debt_type}
                />
              </Field>
              <Field label="Balance Owed" prefilled={hasIntake && !!row.balance}>
                <AmountInput value={row.balance} onChange={v => update('balance', v)} prefilled={hasIntake && !!row.balance} />
              </Field>
            </Grid2>
          )}
        />
      )}

      {/* Co-signers */}
      <SectionHeader title="Co-signers & Co-debtors" />
      <Field label="Is anyone a co-signer or co-debtor on any of your debts?">
        <YesNo value={data.has_cosigners} onChange={f('has_cosigners')} />
      </Field>
      {data.has_cosigners === 'yes' && (
        <Field label="Details — Who co-signed and on which debts?">
          <TextInput value={data.cosigner_details} onChange={f('cosigner_details')} placeholder="e.g. John Smith co-signed Chase auto loan" />
        </Field>
      )}
    </div>
  );
}

function StepB106G({ data, setData }: { data: StepData; setData: (d: StepData) => void }) {
  const f = (key: string) => (v: string) => setData({ ...data, [key]: v });
  return (
    <div>
      <div className="mb-4 p-4 bg-amber-900/20 border border-amber-500/30 rounded-xl">
        <p className="text-amber-300 text-sm">List all leases and contracts you are currently a party to. This includes apartment leases, vehicle leases, equipment leases, subscriptions, and any other executory contracts.</p>
      </div>

      {/* Real Estate Leases */}
      <SectionHeader title="Real Property Leases (Rentals)" />
      <Field label="Are you currently renting or leasing any real property (apartment, home, office, storage, etc.)?">
        <YesNo value={data.has_real_estate_leases} onChange={v => {
          if (v === 'yes' && (!data.real_estate_leases || data.real_estate_leases.length === 0)) {
            setData({ ...data, has_real_estate_leases: 'yes', real_estate_leases: [{ lessor: '', address: '', monthly_payment: '', remaining_months: '', description: '' }] });
          } else {
            setData({ ...data, has_real_estate_leases: v });
          }
        }} />
      </Field>
      {data.has_real_estate_leases === 'yes' && (
        <DynamicRows
          rows={data.real_estate_leases || []}
          setRows={rows => setData({ ...data, real_estate_leases: rows })}
          emptyRow={{ lessor: '', address: '', monthly_payment: '', remaining_months: '', description: '' }}
          addLabel="Add Real Property Lease"
          renderRow={(row, _idx, update) => (
            <div>
              <Grid2>
                <Field label="Landlord / Lessor Name">
                  <TextInput value={row.lessor} onChange={v => update('lessor', v)} placeholder="Property owner or management company" />
                </Field>
                <Field label="Monthly Rent / Payment">
                  <AmountInput value={row.monthly_payment} onChange={v => update('monthly_payment', v)} />
                </Field>
              </Grid2>
              <Field label="Property Address">
                <TextInput value={row.address} onChange={v => update('address', v)} placeholder="123 Rental Ave, Phoenix, AZ 85001" />
              </Field>
              <Grid2>
                <Field label="Months Remaining on Lease">
                  <TextInput value={row.remaining_months} onChange={v => update('remaining_months', v)} placeholder="e.g. 6" type="number" />
                </Field>
                <Field label="Description">
                  <SelectInput value={row.description} onChange={v => update('description', v)} placeholder="Select type" options={[{value:'apartment',label:'Apartment'},{value:'house',label:'House'},{value:'condo',label:'Condo'},{value:'office',label:'Office Space'},{value:'storage',label:'Storage Unit'},{value:'other',label:'Other'}]} />
                </Field>
              </Grid2>
            </div>
          )}
        />
      )}

      {/* Vehicle Leases */}
      <SectionHeader title="Vehicle Leases" />
      <Field label="Are you currently leasing any vehicles?">
        <YesNo value={data.has_vehicle_leases} onChange={v => {
          if (v === 'yes' && (!data.vehicle_leases || data.vehicle_leases.length === 0)) {
            setData({ ...data, has_vehicle_leases: 'yes', vehicle_leases: [{ lessor: '', vehicle: '', monthly_payment: '', remaining_months: '', buyout: '' }] });
          } else {
            setData({ ...data, has_vehicle_leases: v });
          }
        }} />
      </Field>
      {data.has_vehicle_leases === 'yes' && (
        <DynamicRows
          rows={data.vehicle_leases || []}
          setRows={rows => setData({ ...data, vehicle_leases: rows })}
          emptyRow={{ lessor: '', vehicle: '', monthly_payment: '', remaining_months: '', buyout: '' }}
          addLabel="Add Vehicle Lease"
          renderRow={(row, _idx, update) => (
            <Grid2>
              <Field label="Lessor / Dealership">
                <TextInput value={row.lessor} onChange={v => update('lessor', v)} placeholder="Toyota Financial, BMW Financial" />
              </Field>
              <Field label="Vehicle (Year/Make/Model)">
                <TextInput value={row.vehicle} onChange={v => update('vehicle', v)} placeholder="2023 Toyota Camry" />
              </Field>
              <Field label="Monthly Payment">
                <AmountInput value={row.monthly_payment} onChange={v => update('monthly_payment', v)} />
              </Field>
              <Field label="Months Remaining">
                <TextInput value={row.remaining_months} onChange={v => update('remaining_months', v)} placeholder="12" type="number" />
              </Field>
              <Field label="Buyout Option Amount">
                <AmountInput value={row.buyout} onChange={v => update('buyout', v)} />
              </Field>
            </Grid2>
          )}
        />
      )}

      {/* Personal Property Leases */}
      <SectionHeader title="Other Personal Property Leases" />
      <Field label="Do you lease any other personal property? (equipment, furniture, electronics, etc.)">
        <YesNo value={data.has_personal_property_leases} onChange={v => {
          if (v === 'yes' && (!data.personal_property_leases || data.personal_property_leases.length === 0)) {
            setData({ ...data, has_personal_property_leases: 'yes', personal_property_leases: [{ lessor: '', description: '', monthly_payment: '', remaining_months: '' }] });
          } else {
            setData({ ...data, has_personal_property_leases: v });
          }
        }} />
      </Field>
      {data.has_personal_property_leases === 'yes' && (
        <DynamicRows
          rows={data.personal_property_leases || []}
          setRows={rows => setData({ ...data, personal_property_leases: rows })}
          emptyRow={{ lessor: '', description: '', monthly_payment: '', remaining_months: '' }}
          addLabel="Add Personal Property Lease"
          renderRow={(row, _idx, update) => (
            <Grid2>
              <Field label="Lessor">
                <TextInput value={row.lessor} onChange={v => update('lessor', v)} placeholder="Lessor or company name" />
              </Field>
              <Field label="Description of Property">
                <TextInput value={row.description} onChange={v => update('description', v)} placeholder="e.g. Office copier, medical equipment" />
              </Field>
              <Field label="Monthly Payment">
                <AmountInput value={row.monthly_payment} onChange={v => update('monthly_payment', v)} />
              </Field>
              <Field label="Months Remaining">
                <TextInput value={row.remaining_months} onChange={v => update('remaining_months', v)} placeholder="6" type="number" />
              </Field>
            </Grid2>
          )}
        />
      )}

      {/* Executory Contracts */}
      <SectionHeader title="Executory Contracts" />
      <Field label="Are you a party to any other ongoing contracts or agreements?" hint="Includes service contracts, franchise agreements, employment contracts, partnership agreements, licensing agreements, etc.">
        <YesNo value={data.has_executory_contracts} onChange={v => {
          if (v === 'yes' && (!data.executory_contracts || data.executory_contracts.length === 0)) {
            setData({ ...data, has_executory_contracts: 'yes', executory_contracts: [{ counterparty: '', description: '', type: '' }] });
          } else {
            setData({ ...data, has_executory_contracts: v });
          }
        }} />
      </Field>
      {data.has_executory_contracts === 'yes' && (
        <DynamicRows
          rows={data.executory_contracts || []}
          setRows={rows => setData({ ...data, executory_contracts: rows })}
          emptyRow={{ counterparty: '', description: '', type: '' }}
          addLabel="Add Contract"
          renderRow={(row, _idx, update) => (
            <Grid2>
              <Field label="Other Party to Contract">
                <TextInput value={row.counterparty} onChange={v => update('counterparty', v)} placeholder="Company or individual name" />
              </Field>
              <Field label="Contract Type">
                <SelectInput value={row.type} onChange={v => update('type', v)} placeholder="Select" options={[{value:'service',label:'Service Contract'},{value:'employment',label:'Employment Contract'},{value:'franchise',label:'Franchise Agreement'},{value:'licensing',label:'Licensing Agreement'},{value:'partnership',label:'Partnership Agreement'},{value:'subscription',label:'Subscription'},{value:'other',label:'Other'}]} />
              </Field>
              <Field label="Description" prefilled={false}>
                <TextInput value={row.description} onChange={v => update('description', v)} placeholder="Brief description of the contract" />
              </Field>
            </Grid2>
          )}
        />
      )}

      {/* Eviction */}
      <SectionHeader title="Eviction Status" />
      <Field label="Is there a pending eviction action against you?">
        <YesNo value={data.eviction_pending} onChange={f('eviction_pending')} />
      </Field>
      {data.eviction_pending === 'yes' && (
        <Field label="Eviction Details">
          <TextInput value={data.eviction_details} onChange={f('eviction_details')} placeholder="Describe the eviction action, landlord name, and current status" />
        </Field>
      )}
    </div>
  );
}

function StepB106I({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const f = (key: string) => (v: string) => setData({ ...data, [key]: v });
  return (
    <div>
      {hasIntake && <PrefilledBadge />}

      <SectionHeader title="Debtor Employment & Business Income" />
      <Field label="Current Employment Status" prefilled={hasIntake && !!data.debtor_work_status}>
        <SelectInput value={data.debtor_work_status} onChange={f('debtor_work_status')} placeholder="Select" prefilled={hasIntake && !!data.debtor_work_status}
          options={[{value:'employed',label:'Employed (W-2)'},{value:'selfEmployed',label:'Self-Employed / Business Owner'},{value:'unemployed',label:'Unemployed'},{value:'retired',label:'Retired'},{value:'disabled',label:'Disabled'}]}
        />
      </Field>
      {(data.debtor_work_status === 'employed' || data.debtor_work_status === 'selfEmployed') && (
        <DynamicRows
          rows={data.employment_sources || []}
          setRows={rows => setData({ ...data, employment_sources: rows })}
          emptyRow={{ employer_name: '', occupation: '', gross_monthly: '', net_monthly: '', employment_type: 'employed', business_expenses: '' }}
          addLabel="Add Income Source"
          renderRow={(row, _idx, update) => (
            <div>
              <Grid2>
                <Field label={data.debtor_work_status === 'selfEmployed' ? 'Business Name' : 'Employer Name'} prefilled={hasIntake && !!row.employer_name}>
                  <TextInput value={row.employer_name} onChange={v => update('employer_name', v)} placeholder={data.debtor_work_status === 'selfEmployed' ? 'Your Business LLC' : 'Employer name'} prefilled={hasIntake && !!row.employer_name} />
                </Field>
                <Field label="Occupation / Title" prefilled={hasIntake && !!row.occupation}>
                  <TextInput value={row.occupation} onChange={v => update('occupation', v)} placeholder="e.g. Sales Manager" prefilled={hasIntake && !!row.occupation} />
                </Field>
                <Field label="Gross Monthly Income" required prefilled={hasIntake && !!row.gross_monthly}>
                  <AmountInput value={row.gross_monthly} onChange={v => update('gross_monthly', v)} prefilled={hasIntake && !!row.gross_monthly} />
                </Field>
                <Field label="Net Monthly Take-Home" prefilled={hasIntake && !!row.net_monthly}>
                  <AmountInput value={row.net_monthly} onChange={v => update('net_monthly', v)} prefilled={hasIntake && !!row.net_monthly} />
                </Field>
                {data.debtor_work_status === 'selfEmployed' && (
                  <Field label="Monthly Business Expenses" prefilled={hasIntake && !!row.business_expenses}>
                    <AmountInput value={row.business_expenses} onChange={v => update('business_expenses', v)} prefilled={hasIntake && !!row.business_expenses} />
                  </Field>
                )}
              </Grid2>
            </div>
          )}
        />
      )}

      <SectionHeader title="Spouse Income" />
      <Field label="Does your spouse have any income?">
        <YesNo value={data.has_spouse_income} onChange={f('has_spouse_income')} />
      </Field>
      {data.has_spouse_income === 'yes' && (
        <>
          <Field label="Spouse Employment Status" prefilled={hasIntake && !!data.spouse_work_status}>
            <SelectInput value={data.spouse_work_status} onChange={f('spouse_work_status')} placeholder="Select" prefilled={hasIntake && !!data.spouse_work_status}
              options={[{value:'employed',label:'Employed (W-2)'},{value:'selfEmployed',label:'Self-Employed / Business Owner'},{value:'unemployed',label:'Unemployed'},{value:'retired',label:'Retired'},{value:'disabled',label:'Disabled'}]}
            />
          </Field>
          <DynamicRows
            rows={data.spouse_sources || []}
            setRows={rows => setData({ ...data, spouse_sources: rows })}
            emptyRow={{ employer_name: '', occupation: '', gross_monthly: '', net_monthly: '', employment_type: 'employed', business_expenses: '' }}
            addLabel="Add Spouse Income Source"
            renderRow={(row, _idx, update) => (
              <Grid2>
                <Field label="Employer / Business Name" prefilled={hasIntake && !!row.employer_name}>
                  <TextInput value={row.employer_name} onChange={v => update('employer_name', v)} placeholder="Employer name" prefilled={hasIntake && !!row.employer_name} />
                </Field>
                <Field label="Gross Monthly Income" required prefilled={hasIntake && !!row.gross_monthly}>
                  <AmountInput value={row.gross_monthly} onChange={v => update('gross_monthly', v)} prefilled={hasIntake && !!row.gross_monthly} />
                </Field>
                <Field label="Net Monthly Take-Home" prefilled={hasIntake && !!row.net_monthly}>
                  <AmountInput value={row.net_monthly} onChange={v => update('net_monthly', v)} prefilled={hasIntake && !!row.net_monthly} />
                </Field>
              </Grid2>
            )}
          />
        </>
      )}

      <SectionHeader title="Other Sources of Income" />
      <Grid2>
        <Field label="Social Security" prefilled={hasIntake && !!data.social_security_amount}>
          <div className="space-y-2">
            <YesNo value={data.has_social_security} onChange={f('has_social_security')} />
            {data.has_social_security === 'yes' && <AmountInput value={data.social_security_amount} onChange={f('social_security_amount')} placeholder="Monthly amount" prefilled={hasIntake && !!data.social_security_amount} />}
          </div>
        </Field>
        <Field label="Pension / Retirement Benefits" prefilled={hasIntake && !!data.pension_amount}>
          <div className="space-y-2">
            <YesNo value={data.has_pension} onChange={f('has_pension')} />
            {data.has_pension === 'yes' && (
              <>
                <TextInput value={data.pension_source} onChange={f('pension_source')} placeholder="e.g. Military Pension, PERS" prefilled={hasIntake && !!data.pension_source} />
                <AmountInput value={data.pension_amount} onChange={f('pension_amount')} placeholder="Monthly amount" prefilled={hasIntake && !!data.pension_amount} />
              </>
            )}
          </div>
        </Field>
        <Field label="Veterans Benefits" prefilled={hasIntake && !!data.veterans_amount}>
          <div className="space-y-2">
            <YesNo value={data.has_veterans} onChange={f('has_veterans')} />
            {data.has_veterans === 'yes' && <AmountInput value={data.veterans_amount} onChange={f('veterans_amount')} placeholder="Monthly amount" prefilled={hasIntake && !!data.veterans_amount} />}
          </div>
        </Field>
        <Field label="Rental Income" prefilled={hasIntake && !!data.rental_income_amount}>
          <div className="space-y-2">
            <YesNo value={data.has_rental_income} onChange={f('has_rental_income')} />
            {data.has_rental_income === 'yes' && <AmountInput value={data.rental_income_amount} onChange={f('rental_income_amount')} placeholder="Monthly amount" prefilled={hasIntake && !!data.rental_income_amount} />}
          </div>
        </Field>
        <Field label="Unemployment Compensation" prefilled={hasIntake && !!data.unemployment_amount}>
          <div className="space-y-2">
            <YesNo value={data.has_unemployment} onChange={f('has_unemployment')} />
            {data.has_unemployment === 'yes' && <AmountInput value={data.unemployment_amount} onChange={f('unemployment_amount')} placeholder="Monthly amount" prefilled={hasIntake && !!data.unemployment_amount} />}
          </div>
        </Field>
        <Field label="Child Support / Alimony Received" prefilled={hasIntake && !!data.child_support_income_amount}>
          <div className="space-y-2">
            <YesNo value={data.has_child_support_income} onChange={f('has_child_support_income')} />
            {data.has_child_support_income === 'yes' && <AmountInput value={data.child_support_income_amount} onChange={f('child_support_income_amount')} placeholder="Monthly amount" prefilled={hasIntake && !!data.child_support_income_amount} />}
          </div>
        </Field>
      </Grid2>
      <Field label="Any other sources of income?">
        <YesNo value={data.has_other_income} onChange={f('has_other_income')} />
      </Field>
      {data.has_other_income === 'yes' && (
        <Grid2>
          <Field label="Source Description" prefilled={hasIntake && !!data.other_income_description}>
            <TextInput value={data.other_income_description} onChange={f('other_income_description')} placeholder="Describe the income source" prefilled={hasIntake && !!data.other_income_description} />
          </Field>
          <Field label="Monthly Amount" prefilled={hasIntake && !!data.other_income_amount}>
            <AmountInput value={data.other_income_amount} onChange={f('other_income_amount')} prefilled={hasIntake && !!data.other_income_amount} />
          </Field>
        </Grid2>
      )}
    </div>
  );
}

function StepB106J({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const f = (key: string) => (v: string) => setData({ ...data, [key]: v });
  return (
    <div>
      {hasIntake && <PrefilledBadge />}
      <SectionHeader title="Housing Expenses" />
      <Grid2>
        <Field label="Rent or Mortgage Payment" required prefilled={hasIntake && !!data.exp_rent_mortgage}>
          <AmountInput value={data.exp_rent_mortgage} onChange={f('exp_rent_mortgage')} prefilled={hasIntake && !!data.exp_rent_mortgage} />
        </Field>
        <Field label="HOA Fees" prefilled={hasIntake && !!data.exp_hoa}>
          <AmountInput value={data.exp_hoa} onChange={f('exp_hoa')} prefilled={hasIntake && !!data.exp_hoa} />
        </Field>
        <Field label="Home Insurance" prefilled={hasIntake && !!data.exp_home_insurance}>
          <AmountInput value={data.exp_home_insurance} onChange={f('exp_home_insurance')} prefilled={hasIntake && !!data.exp_home_insurance} />
        </Field>
        <Field label="Home Maintenance & Repairs" prefilled={hasIntake && !!data.exp_home_maintenance}>
          <AmountInput value={data.exp_home_maintenance} onChange={f('exp_home_maintenance')} prefilled={hasIntake && !!data.exp_home_maintenance} />
        </Field>
      </Grid2>

      <SectionHeader title="Utilities" />
      <Grid2>
        <Field label="Electricity" prefilled={hasIntake && !!data.exp_utilities_electric}>
          <AmountInput value={data.exp_utilities_electric} onChange={f('exp_utilities_electric')} prefilled={hasIntake && !!data.exp_utilities_electric} />
        </Field>
        <Field label="Water / Sewer" prefilled={hasIntake && !!data.exp_utilities_water}>
          <AmountInput value={data.exp_utilities_water} onChange={f('exp_utilities_water')} prefilled={hasIntake && !!data.exp_utilities_water} />
        </Field>
        <Field label="Gas / Heating" prefilled={hasIntake && !!data.exp_utilities_gas}>
          <AmountInput value={data.exp_utilities_gas} onChange={f('exp_utilities_gas')} prefilled={hasIntake && !!data.exp_utilities_gas} />
        </Field>
        <Field label="Internet" prefilled={hasIntake && !!data.exp_utilities_internet}>
          <AmountInput value={data.exp_utilities_internet} onChange={f('exp_utilities_internet')} prefilled={hasIntake && !!data.exp_utilities_internet} />
        </Field>
        <Field label="Phone (cell + landline)" prefilled={hasIntake && !!data.exp_phone}>
          <AmountInput value={data.exp_phone} onChange={f('exp_phone')} prefilled={hasIntake && !!data.exp_phone} />
        </Field>
      </Grid2>

      <SectionHeader title="Transportation" />
      <Grid2>
        <Field label="Vehicle 1 Loan/Lease Payment" prefilled={hasIntake && !!data.exp_vehicle_1_payment}>
          <AmountInput value={data.exp_vehicle_1_payment} onChange={f('exp_vehicle_1_payment')} prefilled={hasIntake && !!data.exp_vehicle_1_payment} />
        </Field>
        <Field label="Vehicle 2 Loan/Lease Payment" prefilled={hasIntake && !!data.exp_vehicle_2_payment}>
          <AmountInput value={data.exp_vehicle_2_payment} onChange={f('exp_vehicle_2_payment')} prefilled={hasIntake && !!data.exp_vehicle_2_payment} />
        </Field>
        <Field label="Vehicle Insurance (all vehicles)" prefilled={hasIntake && !!data.exp_vehicle_insurance}>
          <AmountInput value={data.exp_vehicle_insurance} onChange={f('exp_vehicle_insurance')} prefilled={hasIntake && !!data.exp_vehicle_insurance} />
        </Field>
        <Field label="Gas / Fuel" prefilled={hasIntake && !!data.exp_vehicle_gas}>
          <AmountInput value={data.exp_vehicle_gas} onChange={f('exp_vehicle_gas')} prefilled={hasIntake && !!data.exp_vehicle_gas} />
        </Field>
        <Field label="Vehicle Maintenance / Repairs" prefilled={hasIntake && !!data.exp_vehicle_maintenance}>
          <AmountInput value={data.exp_vehicle_maintenance} onChange={f('exp_vehicle_maintenance')} prefilled={hasIntake && !!data.exp_vehicle_maintenance} />
        </Field>
      </Grid2>

      <SectionHeader title="Food & Personal" />
      <Grid2>
        <Field label="Groceries & Food" prefilled={hasIntake && !!data.exp_food}>
          <AmountInput value={data.exp_food} onChange={f('exp_food')} prefilled={hasIntake && !!data.exp_food} />
        </Field>
        <Field label="Clothing" prefilled={hasIntake && !!data.exp_clothing}>
          <AmountInput value={data.exp_clothing} onChange={f('exp_clothing')} prefilled={hasIntake && !!data.exp_clothing} />
        </Field>
        <Field label="Personal Care (haircut, hygiene, etc.)" prefilled={hasIntake && !!data.exp_personal_care}>
          <AmountInput value={data.exp_personal_care} onChange={f('exp_personal_care')} prefilled={hasIntake && !!data.exp_personal_care} />
        </Field>
      </Grid2>

      <SectionHeader title="Health & Insurance" />
      <Grid2>
        <Field label="Health Insurance Premiums" prefilled={hasIntake && !!data.exp_health_insurance}>
          <AmountInput value={data.exp_health_insurance} onChange={f('exp_health_insurance')} prefilled={hasIntake && !!data.exp_health_insurance} />
        </Field>
        <Field label="Medical / Dental Out-of-Pocket" prefilled={hasIntake && !!data.exp_medical_dental}>
          <AmountInput value={data.exp_medical_dental} onChange={f('exp_medical_dental')} prefilled={hasIntake && !!data.exp_medical_dental} />
        </Field>
        <Field label="Life Insurance Premiums" prefilled={hasIntake && !!data.exp_life_insurance}>
          <AmountInput value={data.exp_life_insurance} onChange={f('exp_life_insurance')} prefilled={hasIntake && !!data.exp_life_insurance} />
        </Field>
      </Grid2>

      <SectionHeader title="Family & Other" />
      <Grid2>
        <Field label="Childcare / Daycare" prefilled={hasIntake && !!data.exp_childcare}>
          <AmountInput value={data.exp_childcare} onChange={f('exp_childcare')} prefilled={hasIntake && !!data.exp_childcare} />
        </Field>
        <Field label="Child Support Paid" prefilled={hasIntake && !!data.exp_child_support}>
          <AmountInput value={data.exp_child_support} onChange={f('exp_child_support')} prefilled={hasIntake && !!data.exp_child_support} />
        </Field>
        <Field label="Alimony Paid" prefilled={hasIntake && !!data.exp_alimony}>
          <AmountInput value={data.exp_alimony} onChange={f('exp_alimony')} prefilled={hasIntake && !!data.exp_alimony} />
        </Field>
        <Field label="Education / Tuition" prefilled={hasIntake && !!data.exp_education}>
          <AmountInput value={data.exp_education} onChange={f('exp_education')} prefilled={hasIntake && !!data.exp_education} />
        </Field>
        <Field label="Charitable Contributions" prefilled={hasIntake && !!data.exp_charitable}>
          <AmountInput value={data.exp_charitable} onChange={f('exp_charitable')} prefilled={hasIntake && !!data.exp_charitable} />
        </Field>
        <Field label="Subscriptions & Entertainment" prefilled={hasIntake && !!data.exp_subscriptions}>
          <AmountInput value={data.exp_subscriptions} onChange={f('exp_subscriptions')} prefilled={hasIntake && !!data.exp_subscriptions} />
        </Field>
      </Grid2>

      <SectionHeader title="Other Expenses" />
      <Field label="Any other regular monthly expenses not listed above?">
        <YesNo value={data.exp_other_amount ? 'yes' : (data.has_other_expense || 'no')} onChange={v => setData({ ...data, has_other_expense: v })} />
      </Field>
      {(data.has_other_expense === 'yes' || data.exp_other_amount) && (
        <Grid2>
          <Field label="Description">
            <TextInput value={data.exp_other_description} onChange={f('exp_other_description')} placeholder="Describe the expense" prefilled={hasIntake && !!data.exp_other_description} />
          </Field>
          <Field label="Monthly Amount">
            <AmountInput value={data.exp_other_amount} onChange={f('exp_other_amount')} prefilled={hasIntake && !!data.exp_other_amount} />
          </Field>
        </Grid2>
      )}
    </div>
  );
}

function StepB107({ data, setData, hasIntake }: { data: StepData; setData: (d: StepData) => void; hasIntake: boolean }) {
  const f = (key: string) => (v: string) => setData({ ...data, [key]: v });
  return (
    <div>
      {hasIntake && <PrefilledBadge />}

      <SectionHeader title="Prior Bankruptcy" />
      <Field label="Have you ever filed for bankruptcy before?" prefilled={hasIntake && !!data.prior_bankruptcy}>
        <YesNo value={data.prior_bankruptcy} onChange={f('prior_bankruptcy')} />
      </Field>
      {data.prior_bankruptcy === 'yes' && (
        <Grid2>
          <Field label="Chapter Filed">
            <SelectInput value={data.prior_bankruptcy_chapter} onChange={f('prior_bankruptcy_chapter')} placeholder="Select" options={[{value:'7',label:'Chapter 7'},{value:'11',label:'Chapter 11'},{value:'12',label:'Chapter 12'},{value:'13',label:'Chapter 13'}]} prefilled={hasIntake && !!data.prior_bankruptcy_chapter} />
          </Field>
          <Field label="Date Filed">
            <TextInput value={data.prior_bankruptcy_date} onChange={f('prior_bankruptcy_date')} type="date" prefilled={hasIntake && !!data.prior_bankruptcy_date} />
          </Field>
          <Field label="District Court">
            <TextInput value={data.prior_bankruptcy_district} onChange={f('prior_bankruptcy_district')} placeholder="e.g. District of Arizona" prefilled={hasIntake && !!data.prior_bankruptcy_district} />
          </Field>
          <Field label="Case Number">
            <TextInput value={data.prior_bankruptcy_case_number} onChange={f('prior_bankruptcy_case_number')} placeholder="e.g. 2:18-bk-12345" prefilled={hasIntake && !!data.prior_bankruptcy_case_number} />
          </Field>
        </Grid2>
      )}

      <SectionHeader title="Pending Lawsuits & Legal Actions" />
      <Field label="Are you a party to any pending lawsuits or legal proceedings?" prefilled={hasIntake && !!data.pending_lawsuits}>
        <YesNo value={data.pending_lawsuits} onChange={f('pending_lawsuits')} />
      </Field>
      {data.pending_lawsuits === 'yes' && (
        <Field label="Describe the lawsuit(s) — include parties, nature of claim, and court" prefilled={hasIntake && !!data.pending_lawsuit_details}>
          <TextInput value={data.pending_lawsuit_details} onChange={f('pending_lawsuit_details')} placeholder="e.g. IRS enforcement action for tax years 2021-2023" prefilled={hasIntake && !!data.pending_lawsuit_details} />
        </Field>
      )}

      <SectionHeader title="Property Transfers" />
      <Field label="In the last 2 years, have you transferred or given away any property?" hint="Includes gifts, sales below market value, or transfers to family members." prefilled={hasIntake && !!data.transferred_property}>
        <YesNo value={data.transferred_property} onChange={f('transferred_property')} />
      </Field>
      {data.transferred_property === 'yes' && (
        <Field label="Describe the transfer(s) — include what was transferred, to whom, when, and for how much" prefilled={hasIntake && !!data.transferred_property_details}>
          <TextInput value={data.transferred_property_details} onChange={f('transferred_property_details')} placeholder="Describe property transfers" prefilled={hasIntake && !!data.transferred_property_details} />
        </Field>
      )}

      <SectionHeader title="Trusts" />
      <Field label="Have you set up or contributed to a trust in the last 10 years?" prefilled={hasIntake && !!data.created_trust}>
        <YesNo value={data.created_trust} onChange={f('created_trust')} />
      </Field>
      {data.created_trust === 'yes' && (
        <Field label="Trust Details" prefilled={hasIntake && !!data.trust_details}>
          <TextInput value={data.trust_details} onChange={f('trust_details')} placeholder="Describe the trust, trustee, and beneficiaries" prefilled={hasIntake && !!data.trust_details} />
        </Field>
      )}

      <SectionHeader title="Preferential Payments" />
      <Field label="In the last 12 months, did you make any payments to family members or insiders totaling more than $600?" prefilled={hasIntake && !!data.preferential_payments_insider}>
        <YesNo value={data.preferential_payments_insider} onChange={f('preferential_payments_insider')} />
      </Field>
      <Field label="In the last 90 days, did you pay any creditor more than $600 while other debts were past due?">
        <YesNo value={data.preferential_payments_creditor} onChange={f('preferential_payments_creditor')} />
      </Field>
      {(data.preferential_payments_insider === 'yes' || data.preferential_payments_creditor === 'yes') && (
        <Grid2>
          <Field label="Payment Details — to whom and for what" prefilled={hasIntake && !!data.preferential_payment_details}>
            <TextInput value={data.preferential_payment_details} onChange={f('preferential_payment_details')} placeholder="e.g. $15,000 to father, personal loan repayment" prefilled={hasIntake && !!data.preferential_payment_details} />
          </Field>
          <Field label="Payment Date" prefilled={hasIntake && !!data.preferential_payment_date}>
            <TextInput value={data.preferential_payment_date} onChange={f('preferential_payment_date')} type="date" prefilled={hasIntake && !!data.preferential_payment_date} />
          </Field>
          <Field label="Total Amount Paid" prefilled={hasIntake && !!data.preferential_payment_amount}>
            <AmountInput value={data.preferential_payment_amount} onChange={f('preferential_payment_amount')} prefilled={hasIntake && !!data.preferential_payment_amount} />
          </Field>
        </Grid2>
      )}

      <SectionHeader title="Expected Income / Refunds" />
      <Field label="Are you expecting any tax refunds, inheritance, lawsuit settlements, or other significant payments?" prefilled={hasIntake && !!data.expected_refund}>
        <YesNo value={data.expected_refund} onChange={f('expected_refund')} />
      </Field>
      {data.expected_refund === 'yes' && (
        <Grid2>
          <Field label="Source" prefilled={hasIntake && !!data.expected_refund_source}>
            <SelectInput value={data.expected_refund_source} onChange={f('expected_refund_source')} placeholder="Select" prefilled={hasIntake && !!data.expected_refund_source}
              options={[{value:'tax_refund',label:'Tax Refund'},{value:'lawsuit',label:'Lawsuit Settlement'},{value:'inheritance',label:'Inheritance'},{value:'insurance',label:'Insurance Payout'},{value:'other',label:'Other'}]}
            />
          </Field>
          <Field label="Approximate Amount" prefilled={hasIntake && !!data.expected_refund_amount}>
            <AmountInput value={data.expected_refund_amount} onChange={f('expected_refund_amount')} prefilled={hasIntake && !!data.expected_refund_amount} />
          </Field>
        </Grid2>
      )}

      <SectionHeader title="Business Ownership" />
      <Field label="Do you currently own or have you owned a business in the last 4 years?" prefilled={hasIntake && !!data.owned_business}>
        <YesNo value={data.owned_business} onChange={f('owned_business')} />
      </Field>
      {data.owned_business === 'yes' && (
        <Grid2>
          <Field label="Business Name" prefilled={hasIntake && !!data.business_name}>
            <TextInput value={data.business_name} onChange={f('business_name')} placeholder="Business name" prefilled={hasIntake && !!data.business_name} />
          </Field>
          <Field label="Business Type">
            <SelectInput value={data.business_type} onChange={f('business_type')} placeholder="Select" options={[{value:'sole_prop',label:'Sole Proprietorship'},{value:'llc',label:'LLC'},{value:'corp',label:'Corporation'},{value:'partnership',label:'Partnership'},{value:'other',label:'Other'}]} />
          </Field>
          <Field label="Still Operating?">
            <YesNo value={data.business_still_operating || ''} onChange={f('business_still_operating')} />
          </Field>
          {data.business_still_operating === 'no' && (
            <Field label="Date Closed">
              <TextInput value={data.business_closed_date} onChange={f('business_closed_date')} type="date" prefilled={hasIntake && !!data.business_closed_date} />
            </Field>
          )}
        </Grid2>
      )}

      <SectionHeader title="Closed Financial Accounts" />
      <Field
        label="In the last year, have you closed any bank accounts, savings accounts, credit union accounts, or other financial accounts (not creditors)?"
        hint="This is required for Schedule B and the Statement of Financial Affairs. Do not include credit cards or loans here — only deposit/savings/financial accounts you held money in."
      >
        <YesNo value={data.has_closed_accounts} onChange={v => {
          if (v === 'yes' && (!data.closed_accounts || data.closed_accounts.length === 0)) {
            setData({ ...data, has_closed_accounts: 'yes', closed_accounts: [{ institution: '', account_type: '', last4: '', closed_date: '', balance_at_closing: '' }] });
          } else {
            setData({ ...data, has_closed_accounts: v });
          }
        }} />
      </Field>
      {data.has_closed_accounts === 'yes' && (
        <div className="space-y-4 mb-4">
          <div className="bg-amber-400/8 border border-amber-400/20 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-300/80 text-xs leading-relaxed">
              You will be asked to provide the closing statement for each closed account when you submit your documents. Please gather those from your bank before your filing date.
            </p>
          </div>
          {(data.closed_accounts || []).map((acct: any, i: number) => {
            const update = (field: string, val: string) => {
              const updated = [...(data.closed_accounts || [])];
              updated[i] = { ...updated[i], [field]: val };
              setData({ ...data, closed_accounts: updated });
            };
            return (
              <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-slate-300 text-sm font-semibold">Closed Account {i + 1}</p>
                  {(data.closed_accounts || []).length > 1 && (
                    <button
                      onClick={() => {
                        const updated = (data.closed_accounts || []).filter((_: any, j: number) => j !== i);
                        setData({ ...data, closed_accounts: updated });
                      }}
                      className="text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded-lg hover:bg-red-400/10 transition-all"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <Grid2>
                  <Field label="Bank / Financial Institution" required>
                    <TextInput value={acct.institution} onChange={v => update('institution', v)} placeholder="e.g. Chase Bank, Wells Fargo" />
                  </Field>
                  <Field label="Account Type" required>
                    <SelectInput
                      value={acct.account_type}
                      onChange={v => update('account_type', v)}
                      placeholder="Select type"
                      options={[
                        { value: 'checking', label: 'Checking' },
                        { value: 'savings', label: 'Savings' },
                        { value: 'money_market', label: 'Money Market' },
                        { value: 'cd', label: 'Certificate of Deposit (CD)' },
                        { value: 'credit_union_share', label: 'Credit Union Share' },
                        { value: 'brokerage', label: 'Brokerage / Investment' },
                        { value: 'other', label: 'Other' },
                      ]}
                    />
                  </Field>
                  <Field label="Account Last 4 Digits" required hint="Last 4 digits of the account number">
                    <TextInput value={acct.last4} onChange={v => update('last4', v.replace(/\D/g, '').slice(0, 4))} placeholder="e.g. 4471" />
                  </Field>
                  <Field label="Date Account Was Closed" required>
                    <TextInput type="date" value={acct.closed_date} onChange={v => update('closed_date', v)} />
                  </Field>
                  <Field label="Balance at Time of Closing">
                    <AmountInput value={acct.balance_at_closing} onChange={v => update('balance_at_closing', v)} />
                  </Field>
                </Grid2>
              </div>
            );
          })}
          <button
            onClick={() => setData({ ...data, closed_accounts: [...(data.closed_accounts || []), { institution: '', account_type: '', last4: '', closed_date: '', balance_at_closing: '' }] })}
            className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Another Closed Account
          </button>
        </div>
      )}

      <SectionHeader title="Additional Financial Disclosures" />
      <Grid2>
        <Field label="Do you have a safe deposit box?">
          <div className="space-y-2">
            <YesNo value={data.safe_deposit_box} onChange={f('safe_deposit_box')} />
            {data.safe_deposit_box === 'yes' && <TextInput value={data.safe_deposit_details} onChange={f('safe_deposit_details')} placeholder="Bank name and contents" />}
          </div>
        </Field>
        <Field label="Have you had any wages garnished in the last year?">
          <div className="space-y-2">
            <YesNo value={data.garnishments} onChange={f('garnishments')} />
            {data.garnishments === 'yes' && <TextInput value={data.garnishment_details} onChange={f('garnishment_details')} placeholder="Describe garnishments" />}
          </div>
        </Field>
        <Field label="Is there a pending foreclosure on your home?">
          <div className="space-y-2">
            <YesNo value={data.foreclosure_pending} onChange={f('foreclosure_pending')} />
            {data.foreclosure_pending === 'yes' && <TextInput value={data.foreclosure_details} onChange={f('foreclosure_details')} placeholder="Lender name and current status" prefilled={hasIntake && !!data.foreclosure_details} />}
          </div>
        </Field>
      </Grid2>
    </div>
  );
}

function SummarySection({ stepData }: { stepData: Record<string, StepData> }) {
  const personal = stepData.b101 || {};
  const property = stepData.b106ab || {};
  const secured = stepData.b106d || {};
  const unsecured = stepData.b106ef || {};
  const income = stepData.b106i || {};
  const expenses = stepData.b106j || {};

  function SummaryCard({ title, items }: { title: string; items: { label: string; value: string }[] }) {
    return (
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 mb-4">
        <h4 className="text-amber-400 font-bold text-sm uppercase tracking-wider mb-3">{title}</h4>
        <div className="space-y-1.5">
          {items.filter(i => i.value).map((item, i) => (
            <div key={i} className="flex justify-between items-start gap-4">
              <span className="text-slate-400 text-xs">{item.label}</span>
              <span className="text-white text-xs font-medium text-right">{item.value}</span>
            </div>
          ))}
          {items.filter(i => i.value).length === 0 && <p className="text-slate-500 text-xs">No information provided</p>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-xl">
        <p className="text-emerald-300 text-sm font-semibold mb-1">Almost done!</p>
        <p className="text-emerald-400/80 text-xs">Please review your answers below. Once submitted, your information will be shared with your legal team. You can go back to any step to make changes before submitting.</p>
      </div>

      <SummaryCard title="Personal Information" items={[
        { label: 'Name', value: [personal.first_name, personal.middle_name, personal.last_name].filter(Boolean).join(' ') },
        { label: 'Filing Type', value: personal.filing_type?.replace('_', ' ') || '' },
        { label: 'Address', value: [personal.street_name, personal.city, personal.state, personal.zip_code].filter(Boolean).join(', ') },
        { label: 'Dependents', value: (personal.dependents || []).length > 0 ? `${personal.dependents.length} dependent(s)` : '' },
        { label: 'Credit Counseling', value: personal.credit_counseling_completed === 'yes' ? `Completed — ${personal.credit_counseling_agency || ''}` : 'Not yet completed' },
      ]} />

      <SummaryCard title="Assets" items={[
        { label: 'Real Property', value: property.has_real_estate === 'yes' ? `${(property.real_estate || []).length} property/ies` : 'None' },
        { label: 'Vehicles', value: property.has_vehicles === 'yes' ? `${(property.vehicles || []).length} vehicle(s)` : 'None' },
        { label: 'Bank Accounts', value: property.has_bank_accounts === 'yes' ? `${(property.bank_accounts || []).length} account(s)` : 'None' },
        { label: 'Retirement', value: property.has_retirement === 'yes' ? `${(property.retirement_accounts || []).length} account(s)` : 'None' },
      ]} />

      <SummaryCard title="Debts Summary" items={[
        { label: 'Secured Creditors', value: secured.has_secured_debts === 'yes' ? `${(secured.secured_creditors || []).length} creditor(s)` : 'None' },
        { label: 'Credit Cards', value: unsecured.has_credit_cards === 'yes' ? `${(unsecured.credit_cards || []).length} card(s)` : 'None' },
        { label: 'Medical Debts', value: unsecured.has_medical === 'yes' ? `${(unsecured.medical_debts || []).length} creditor(s)` : 'None' },
        { label: 'Tax Debt', value: unsecured.has_tax_debt === 'yes' ? `$${unsecured.tax_debt_amount || '0'}` : 'None' },
      ]} />

      <SummaryCard title="Income & Expenses" items={[
        { label: 'Employment Status', value: income.debtor_work_status || '' },
        { label: 'Rent/Mortgage', value: expenses.exp_rent_mortgage ? `$${expenses.exp_rent_mortgage}/mo` : '' },
      ]} />

      {(stepData.b107?.has_closed_accounts === 'yes' && (stepData.b107?.closed_accounts || []).length > 0) && (
        <div className="bg-amber-400/8 border border-amber-400/25 rounded-xl p-4 mb-4">
          <h4 className="text-amber-400 font-bold text-sm uppercase tracking-wider mb-2">Closed Accounts — Document Requests</h4>
          <p className="text-slate-400 text-xs mb-3">The following closing statements will be requested when you submit this questionnaire:</p>
          <div className="space-y-1.5">
            {(stepData.b107.closed_accounts || []).map((acct: any, i: number) => {
              const typeLabel = ({
                checking: 'Checking', savings: 'Savings', money_market: 'Money Market',
                cd: 'CD', credit_union_share: 'Credit Union Share', brokerage: 'Brokerage', other: 'Account',
              } as Record<string, string>)[acct.account_type] || 'Account';
              return (
                <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                  <FileText className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span>{acct.institution || 'Unknown Bank'} — {typeLabel}{acct.last4 ? ` x${acct.last4}` : ''}{acct.closed_date ? ` (closed ${acct.closed_date})` : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Intake Disclosure Screen ───────────────────────────────────────────────────

function IntakeDisclosureScreen({ clientName, hasIntake, onContinue, onBack }: {
  clientName: string;
  hasIntake: boolean;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <div className="bg-slate-800/80 border-b border-slate-700 px-6 py-4 flex items-center gap-4 sticky top-0 z-10 backdrop-blur-sm">
        <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <Scale className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-white font-bold text-base leading-tight">Bankruptcy Information Questionnaire</h1>
          <p className="text-slate-400 text-xs">{clientName} — Before You Begin</p>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="max-w-xl w-full">

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-amber-400/10 border border-amber-400/30 rounded-2xl flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-xl">Before You Begin</h2>
              <p className="text-slate-400 text-sm">Important notice — please read carefully</p>
            </div>
          </div>

          {hasIntake && (
            <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-5 mb-5">
              <div className="flex items-start gap-3">
                <RefreshCw className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-300 font-bold text-sm mb-1">Information Pre-Filled From Your Intake</p>
                  <p className="text-amber-200/80 text-sm leading-relaxed">
                    You previously provided information during our intake process. That information has been pre-filled into this questionnaire to save you time.
                  </p>
                  <p className="text-amber-200/80 text-sm leading-relaxed mt-2">
                    <strong className="text-amber-300">You will need to confirm whether any changes have occurred</strong> since your intake — including changes to your income, assets, debts, or financial accounts. Fields pre-filled from your intake are marked with an <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full align-middle"><Info className="w-3 h-3" />From intake</span> badge. Please review each section carefully and update anything that has changed.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-amber-400 rounded-full mt-1.5 flex-shrink-0" />
              <p className="text-slate-300 text-sm leading-relaxed">
                This questionnaire collects the detailed financial information required to prepare your official bankruptcy petition. Your answers are used directly in your court filing documents.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-amber-400 rounded-full mt-1.5 flex-shrink-0" />
              <p className="text-slate-300 text-sm leading-relaxed">
                All information must be accurate and complete as of today's date. Providing false or incomplete information in a bankruptcy proceeding is a federal crime.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-amber-400 rounded-full mt-1.5 flex-shrink-0" />
              <p className="text-slate-300 text-sm leading-relaxed">
                Your progress is saved automatically as you move through each step. You may return and continue at any time using your client portal.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-amber-400 rounded-full mt-1.5 flex-shrink-0" />
              <p className="text-slate-300 text-sm leading-relaxed">
                If you are unsure about any question, complete what you can and contact our office — do not guess.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-3 bg-slate-800/40 border border-slate-600 hover:border-amber-400/50 rounded-xl p-4 cursor-pointer transition-all mb-6 select-none">
            <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition-all ${confirmed ? 'bg-amber-500 border-amber-500' : 'border-slate-500'}`}
              onClick={() => setConfirmed(!confirmed)}>
              {confirmed && <CheckCircle className="w-3.5 h-3.5 text-white" />}
            </div>
            <p className="text-slate-300 text-sm leading-relaxed" onClick={() => setConfirmed(!confirmed)}>
              I understand that I previously provided intake information that has been pre-filled below, and I agree to review and confirm or update all information to ensure it is accurate and complete as of today.
            </p>
          </label>

          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-5 py-2.5 text-slate-300 hover:text-white border border-slate-600 hover:border-slate-500 rounded-xl transition-all text-sm font-semibold"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
            <button
              onClick={onContinue}
              disabled={!confirmed}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all text-sm font-bold"
            >
              Begin Questionnaire
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function BankruptcyQuestionnaire({ clientId, clientName, onComplete, onBack }: Props) {
  const [showDisclosure, setShowDisclosure] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepData, setStepData] = useState<Record<string, StepData>>({});
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasIntake, setHasIntake] = useState(false);

  // Load saved progress and intake data
  useEffect(() => {
    async function init() {
      setLoading(true);
      let prefill: Record<string, StepData> = {};

      // Try to load intake data
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

      // Load saved questionnaire steps
      const { data: saved } = await supabase
        .from('bankruptcy_questionnaire_submissions')
        .select('step_key, data, completed')
        .eq('client_id', clientId);

      const merged: Record<string, StepData> = {};
      const done = new Set<string>();
      let firstIncomplete = -1;

      STEPS.forEach((step, idx) => {
        if (step.key === 'summary') return;
        const savedStep = saved?.find(s => s.step_key === step.key);
        if (savedStep) {
          merged[step.key] = savedStep.data;
          if (savedStep.completed) done.add(step.key);
          else if (firstIncomplete === -1) firstIncomplete = idx;
        } else {
          merged[step.key] = prefill[step.key] || {};
          if (firstIncomplete === -1) firstIncomplete = idx;
        }
      });

      setStepData(merged);
      setCompletedSteps(done);
      if (firstIncomplete >= 0) setCurrentStep(firstIncomplete);
      setLoading(false);
    }
    init();
  }, [clientId]);

  async function saveStep(stepKey: string, data: StepData, completed = false) {
    setSaving(true);
    setSaveMsg('');
    await supabase.from('bankruptcy_questionnaire_submissions').upsert(
      { client_id: clientId, step_key: stepKey, data, completed, updated_at: new Date().toISOString() },
      { onConflict: 'client_id,step_key' }
    );
    if (completed) {
      setCompletedSteps(prev => new Set([...prev, stepKey]));
    }
    setSaving(false);
    setSaveMsg('Saved');
    setTimeout(() => setSaveMsg(''), 2000);
  }

  async function handleNext() {
    const step = STEPS[currentStep];
    if (step.key !== 'summary') {
      await saveStep(step.key, stepData[step.key] || {}, true);
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function handleBack() {
    if (currentStep === 0) {
      onBack();
    } else {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    // Save all remaining steps
    for (const step of STEPS.filter(s => s.key !== 'summary')) {
      if (stepData[step.key]) {
        await saveStep(step.key, stepData[step.key], true);
      }
    }

    // If client reported closed accounts, seed document requests for closing statements
    const b107 = stepData['b107'] || {};
    if (b107.has_closed_accounts === 'yes' && Array.isArray(b107.closed_accounts)) {
      const { data: clientRow } = await supabase.from('clients').select('intake_id').eq('id', clientId).maybeSingle();
      for (const acct of b107.closed_accounts) {
        if (!acct.institution) continue;
        const typeLabel = ({
          checking: 'Checking', savings: 'Savings', money_market: 'Money Market',
          cd: 'CD', credit_union_share: 'Credit Union Share', brokerage: 'Brokerage', other: 'Account',
        } as Record<string, string>)[acct.account_type] || 'Account';
        const last4Str = acct.last4 ? ` x${acct.last4}` : '';
        await supabase.from('client_documents').insert({
          submission_id: clientRow?.intake_id || null,
          uploaded_by: 'system',
          document_type: 'closing_statement',
          file_name: `Closing Statement — ${acct.institution} ${typeLabel}${last4Str}`,
          notes: `Required for Statement of Financial Affairs (SOFA Part 4). ${acct.institution} ${typeLabel}${last4Str}${acct.closed_date ? `, closed ${acct.closed_date}` : ''}. Please upload the official account closing statement from your bank.`,
          requested: true,
        });
      }
    }

    // Update case status
    await supabase.from('clients').update({ status: 'questionnaire_submitted' } as any).eq('id', clientId);
    setSubmitting(false);
    onComplete();
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

  if (showDisclosure) {
    return (
      <IntakeDisclosureScreen
        clientName={clientName}
        hasIntake={hasIntake}
        onContinue={() => setShowDisclosure(false)}
        onBack={onBack}
      />
    );
  }

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  function renderStep() {
    const d = stepData[step.key] || {};
    const setD = (data: StepData) => updateStepData(step.key, data);
    switch (step.key) {
      case 'b101':    return <StepB101 data={d} setData={setD} hasIntake={hasIntake} />;
      case 'b106ab':  return <StepB106AB data={d} setData={setD} hasIntake={hasIntake} />;
      case 'b106d':   return <StepB106D data={d} setData={setD} hasIntake={hasIntake} />;
      case 'b106ef':  return <StepB106EF data={d} setData={setD} hasIntake={hasIntake} />;
      case 'b106g':   return <StepB106G data={d} setData={setD} />;
      case 'b106i':   return <StepB106I data={d} setData={setD} hasIntake={hasIntake} />;
      case 'b106j':   return <StepB106J data={d} setData={setD} hasIntake={hasIntake} />;
      case 'b107':    return <StepB107 data={d} setData={setD} hasIntake={hasIntake} />;
      case 'summary': return <SummarySection stepData={stepData} />;
      default: return null;
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800/80 border-b border-slate-700 px-6 py-4 flex items-center gap-4 sticky top-0 z-10 backdrop-blur-sm flex-shrink-0">
        <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <Scale className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-white font-bold text-base leading-tight">Bankruptcy Information Questionnaire</h1>
          <p className="text-slate-400 text-xs truncate">{clientName} — {step.label}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {saveMsg && <span className="text-emerald-400 text-xs font-medium">{saveMsg}</span>}
          {saving && <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="hidden lg:flex w-60 flex-shrink-0 flex-col bg-slate-800/50 border-r border-slate-700 py-6 overflow-y-auto">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider px-5 mb-4">Progress</p>
          <div className="space-y-1 px-3">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const isActive = idx === currentStep;
              const isDone = completedSteps.has(s.key);
              return (
                <button
                  key={s.key}
                  onClick={() => setCurrentStep(idx)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-sm ${
                    isActive ? 'bg-amber-400/15 text-amber-400' :
                    isDone ? 'text-emerald-400 hover:bg-slate-700/50' :
                    'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <div className={`flex-shrink-0 ${isActive ? 'text-amber-400' : isDone ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {isDone && !isActive ? <CheckCircle className="w-4 h-4" /> : isActive ? <Icon className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  </div>
                  <span className="font-medium truncate">{s.label}</span>
                </button>
              );
            })}
          </div>
          {/* Progress bar */}
          <div className="mt-auto px-5 pt-5">
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>Progress</span>
              <span>{completedSteps.size}/{STEPS.length - 1} steps</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${(completedSteps.size / (STEPS.length - 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile progress */}
          <div className="lg:hidden flex items-center gap-2 px-4 py-3 border-b border-slate-700 overflow-x-auto">
            {STEPS.map((s, idx) => {
              const isDone = completedSteps.has(s.key);
              return (
                <div key={s.key} className={`flex-shrink-0 w-2.5 h-2.5 rounded-full transition-all ${
                  idx === currentStep ? 'bg-amber-400 w-6' :
                  isDone ? 'bg-emerald-400' : 'bg-slate-600'
                }`} />
              );
            })}
            <span className="ml-2 text-slate-400 text-xs flex-shrink-0">{step.short}</span>
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-8">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  {(() => { const Icon = step.icon; return <Icon className="w-5 h-5 text-amber-400" />; })()}
                  <h2 className="text-white font-bold text-xl">{step.label}</h2>
                </div>
                <p className="text-slate-400 text-sm">{step.short} of {STEPS.length - 1}</p>
              </div>

              {renderStep()}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-700">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 px-5 py-2.5 text-slate-300 hover:text-white border border-slate-600 hover:border-slate-500 rounded-xl transition-all text-sm font-semibold"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {currentStep === 0 ? 'Back to Portal' : 'Previous'}
                </button>

                <button
                  onClick={() => saveStep(step.key, stepData[step.key] || {})}
                  disabled={saving || step.key === 'summary'}
                  className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-xl transition-all text-sm disabled:opacity-30"
                >
                  Save Draft
                </button>

                {isLast ? (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-xl transition-all text-sm font-bold"
                  >
                    {submitting ? 'Submitting...' : 'Submit Questionnaire'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-xl transition-all text-sm font-bold"
                  >
                    {saving ? 'Saving...' : 'Save & Continue'}
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



