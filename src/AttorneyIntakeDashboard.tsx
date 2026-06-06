import { useState, useEffect, useMemo } from "react";
import { supabase } from "./lib/supabase";
import { getCourtsForState } from "./data/courts";
import { Scale, FileText, CheckCircle, XCircle, Clock, ChevronRight, DollarSign, MapPin, Send, AlertTriangle, Phone, Mail, Home, CreditCard, MessageSquare, TrendingUp, Briefcase, RefreshCw, ArrowUp, ArrowDown, AlertCircle, ArrowLeft, Package, Building, Car, Gem, Shield, Calendar, PhoneCall, Ligature as FileSignature, X, ClipboardList, ListChecks, ArrowRightLeft, Sun, Sunset, Moon } from "lucide-react";
import AttorneyTaskPanel from "./components/attorney/AttorneyTaskPanel";
import CaseActivityLog from "./components/admin/CaseActivityLog";
import IncomeExpenseModal from "./components/admin/IncomeExpenseModal";
import { getApplicableExemptions, getCaHomesteadByCounty, getWaHomesteadEligibility } from "./components/admin/exemptions";
import ExemptionQuickView, { buildAssetRows } from "./components/admin/ExemptionQuickView";

// Statutory court filing fees — current as of 2026, verify periodically.
const COURT_FILING_FEES = { 7: 338, 13: 313 } as const;

/**
 * Split total_fee into court_filing_fee + attorney_fee at decision time.
 * Returns nulls when total_fee is missing — never compute against a missing total.
 * Snapshotted on save; never recomputed on read.
 *
 * Rules:
 *   - Regular Ch7 ('normal'): court fee is SEPARATE. attorney_fee = total_fee.
 *   - Bifurcated Ch7:         court fee INCLUDED in total. attorney_fee = total_fee - 338.
 *   - Ch13:                   court fee is SEPARATE. attorney_fee = total_fee.
 */
function splitFees(
  chapter: 7 | 13,
  ch7FeeType: "normal" | "bifurcated",
  totalFee: number | null,
): { court_filing_fee: number | null; attorney_fee: number | null } {
  if (totalFee == null || !Number.isFinite(totalFee)) {
    return { court_filing_fee: null, attorney_fee: null };
  }
  const court = COURT_FILING_FEES[chapter];
  if (chapter === 7 && ch7FeeType === "bifurcated") {
    return { court_filing_fee: court, attorney_fee: totalFee - court };
  }
  return { court_filing_fee: court, attorney_fee: totalFee };
}

/**
 * Returns the effective homestead amount, or `null` when required inputs are
 * missing. Callers MUST treat null as "incomplete — data needed" and render
 * that state explicitly. Never compute against missing inputs.
 *
 * WA requires homeAcquiredDate AND isOccupiedPrimary — both must be present
 * on the intake form before the eligibility helper can produce a number.
 */
function getEffectiveHomestead(fd: Record<string, unknown>): number | null {
  const rawState = (fd.state as string) ?? "TX";
  const stateCode = normalizeStateCode(rawState);
  const county = (fd.county as string) ?? "";
  const hasRealProp = ((fd.properties as unknown[]) ?? []).length > 0;
  const stEx = getApplicableExemptions(stateCode, undefined, hasRealProp);
  if (stateCode === "CA" && hasRealProp) return getCaHomesteadByCounty(county);
  if (stateCode === "WA" && hasRealProp) {
    const acquired = fd.homeAcquiredDate as string | undefined;
    const occupied = fd.isOccupiedPrimary as string | undefined;
    if (!acquired || !occupied) return null;
    const waH = getWaHomesteadEligibility(acquired, occupied, county);
    return waH.eligible ? waH.amount : 0;
  }
  return stEx.homestead === "unlimited" || stEx.homestead === -1 ? Infinity : (stEx.homestead as number);
}

function getEffectiveVehicleExemption(fd: Record<string, unknown>): number {
  const stateCode = normalizeStateCode((fd.state as string) ?? "TX");
  const hasRealProp = ((fd.properties as unknown[]) ?? []).length > 0;
  return getApplicableExemptions(stateCode, undefined, hasRealProp).vehicle;
}

const STATE_NAME_TO_CODE: Record<string, string> = {
  Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",
  Connecticut:"CT",Delaware:"DE","District of Columbia":"DC",Florida:"FL",Georgia:"GA",
  Hawaii:"HI",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",
  Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",
  Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV","New Hampshire":"NH",
  "New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",
  Ohio:"OH",Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC",
  "South Dakota":"SD",Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",
  Washington:"WA","West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY",
};

function normalizeStateCode(state: string): string {
  if (!state) return "TX";
  if (state.length === 2) return state.toUpperCase();
  return STATE_NAME_TO_CODE[state] ?? state.toUpperCase().slice(0, 2);
}

function normalizeFormData(fd: Record<string, unknown>): Record<string, unknown> {
  const out = { ...fd };

  // Normalize state to 2-letter code
  if (fd.state) {
    out.state = normalizeStateCode(fd.state as string);
  }

  // Convert admin consult flat-field schema to the standard debtorSources[] schema
  const isAdminConsult = fd._source === "admin_consult" || (!fd.debtorSources && fd.debtorMonthlyGross !== undefined);
  if (isAdminConsult) {
    const pf = (v: unknown) => parseFloat(String(v ?? "0").replace(/[^0-9.-]/g, "")) || 0;
    const debtorGross = pf(fd.debtorMonthlyGross);
    const spouseGross = pf(fd.spouseMonthlyGross);
    const isJointFiling = fd.filingType === "joint" || fd.maritalStatus === "married_joint";
    const debtorSourceType = fd.debtorWorkStatus === "selfEmployed" ? "selfEmployment" : "employment";
    const spouseSourceType = fd.spouseWorkStatus === "selfEmployed" ? "selfEmployment" : "employment";

    const debtorSources: Record<string, unknown>[] = [];
    if (debtorGross > 0) {
      if (debtorSourceType === "selfEmployment") {
        debtorSources.push({ sourceType: "selfEmployment", businessName: fd.debtorEmployer ?? "Self-Employment", employerName: fd.debtorEmployer ?? "Self-Employment", payFrequency: "Monthly", grossPerPeriod: String(debtorGross), netPerPeriod: String(debtorGross), businessGrossIncome: String(debtorGross), businessExpenses: "0", receiveBonus: "no" });
      } else {
        debtorSources.push({ sourceType: "employment", employerName: fd.debtorEmployer ?? "Employer", payFrequency: "Monthly", grossPerPeriod: String(debtorGross), netPerPeriod: String(debtorGross), receiveBonus: "no" });
      }
    }

    const spouseSources: Record<string, unknown>[] = [];
    if (spouseGross > 0 && isJointFiling) {
      if (spouseSourceType === "selfEmployment") {
        spouseSources.push({ sourceType: "selfEmployment", businessName: fd.spouseEmployer ?? "Self-Employment (Spouse)", employerName: fd.spouseEmployer ?? "Self-Employment (Spouse)", payFrequency: "Monthly", grossPerPeriod: String(spouseGross), netPerPeriod: String(spouseGross), businessGrossIncome: String(spouseGross), businessExpenses: "0", receiveBonus: "no" });
      } else {
        spouseSources.push({ sourceType: "employment", employerName: fd.spouseEmployer ?? "Employer (Spouse)", payFrequency: "Monthly", grossPerPeriod: String(spouseGross), netPerPeriod: String(spouseGross), receiveBonus: "no" });
      }
    }

    out.filingType = isJointFiling ? "joint" : "individual";
    out.debtorSources = debtorSources;
    out.spouseSources = spouseSources;
    out.dSsRetirement = fd.debtorSsRetirement ?? "0";
    out.dSsDisability = fd.debtorSsDisability ?? "0";
    out.dVeterans = fd.debtorVeterans ?? "0";
    out.dVeteransRetirement = fd.debtorVeteransRetirement ?? "0";
    out.dUnemployment = fd.debtorUnemployment ?? "0";
    out.dWorkersComp = fd.debtorWorkersComp ?? "0";
    out.dPension = fd.debtorPension ?? "0";
    out.dRental = fd.debtorRental ?? "0";
    out.dAlimony = fd.debtorAlimony ?? "0";
    out.dChildSupport = fd.debtorChildSupport ?? "0";
    out.dFamilySupport = "0";
    out.dRoyalties = "0";
    out.dInvestment = "0";
    out.dOtherIncome = fd.debtorOtherIncome ?? "0";
    out.dOtherIncomeDesc = fd.debtorOtherIncomeDesc ?? "";
    out.sSsRetirement = fd.spouseSsRetirement ?? "0";
    out.sSsDisability = fd.spouseSsDisability ?? "0";
    out.sVeterans = fd.spouseVeterans ?? "0";
    out.sVeteransRetirement = fd.spouseVeteransRetirement ?? "0";
    out.sUnemployment = fd.spouseUnemployment ?? "0";
    out.sWorkersComp = fd.spouseWorkersComp ?? "0";
    out.sPension = fd.spousePension ?? "0";
    out.sRental = fd.spouseRental ?? "0";
    out.sAlimony = fd.spouseAlimony ?? "0";
    out.sChildSupport = fd.spouseChildSupport ?? "0";
    out.sFamilySupport = "0";
    out.sRoyalties = "0";
    out.sInvestment = "0";
    out.sOtherIncome = fd.spouseOtherIncome ?? "0";
    out.numDependents = fd.numDependents ?? (fd.dependentAges ? String((fd.dependentAges as string).split(",").length) : "0");
  }

  // Build properties array from flat fields if not already present
  if (!Array.isArray(fd.properties)) {
    const props: Record<string, unknown>[] = [];
    const primaryValue = parseFloat((fd.realPropValue as string) ?? "0") || 0;
    if (primaryValue > 0 || fd.ownsRealEstate === "yes" || fd.hasMortgage === "yes") {
      props.push({
        propertyValue: String(fd.realPropValue ?? "0"),
        loanBalance: String(fd.mortgageBalance ?? "0"),
        monthlyPayment: String(fd.realPropMonthlyPayment ?? fd.expRentMortgage ?? "0"),
        arrearsAmount: String(fd.mortgageArrears ?? "0"),
        lenderName: String(fd.mortgageLender ?? "Primary Lender"),
        address: String(fd.realPropAddress ?? ""),
        propType: String(fd.realPropType ?? "Primary Residence"),
        intent: String(fd.realPropIntent ?? "keep"),
      });
    }
    if (fd.secondProperty === "yes") {
      props.push({
        propertyValue: String(fd.secondPropValue ?? "0"),
        loanBalance: String(fd.secondMortgage ?? "0"),
        monthlyPayment: "0",
        arrearsAmount: "0",
        lenderName: "Second Property Lender",
        address: String(fd.secondPropAddress ?? ""),
        propType: "Investment/Rental Property",
        intent: String(fd.secondPropIntent ?? "keep"),
      });
    }
    if (props.length > 0) out.properties = props;
  }

  return out;
}

interface Submission {
  id: string;
  reference_number: string;
  form_data: Record<string, unknown>;
  submitted_at: string;
  updated_at?: string | null;
  last_modified_by?: string | null;
  stale_flag?: boolean | null;
  status: string;
  client_id?: string | null;
  lead_id?: string | null;
}

// Shape of an attorney_intake_reviews row, as the portal reads/writes it.
// Original source schema (case_reviews) had different column names; see
// migration 20260604120100_extend_attorney_intake_reviews_for_portal.sql for
// the columns added to bridge the gap.
interface Review {
  id: string;
  submission_id: string;        // was intake_id
  chapter: number;              // was text '7'/'13'; now integer 7/13
  court_district: string;
  total_fee: number;            // was quoted_fee
  attorney_fee: number | null;  // split at save via splitFees()
  court_filing_fee: number | null;
  decision_notes: string;       // was attorney_notes
  decision: string;             // 'accepted' | 'declined' | 'limited_scope' (was accepted boolean)
  decided_at: string;           // was reviewed_at
  confirmation_sent: boolean;
  ch7_fee_type: string;
  down_payment: number | null;  // was ch7_pre_filing_fee
  ch7_post_filing_fee: number | null;
  ch13_upfront_amount: number;  // was ch13_upfront_fee
  ch13_plan_portion: number;    // was ch13_rolled_into_plan
  fee_agreement_sent: boolean;
  payment_initiated: boolean;
  client_advisory_notes: string;
  returned_to_admin: boolean;
  closed_by_ai: boolean;
  limited_scope_desc: string;   // was limited_scope_description
}

function fmt(n: number | unknown) {
  if (typeof n !== "number" && typeof n !== "string") return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
}

function fmtNum(n: number | unknown) {
  if (typeof n !== "number" && typeof n !== "string") return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(num);
}

const PERIOD_TO_MONTHLY_ATY: Record<string, number> = { "Weekly": 4.333, "Bi-Weekly": 2.167, "Semi-Monthly": 2, "Monthly": 1 };

function srcMonthlyGrossAtty(s: Record<string, unknown>): number {
  if (s.sourceType === "selfEmployment") {
    return (parseFloat(s.businessGrossIncome as string) || 0) - (parseFloat(s.businessExpenses as string) || 0);
  }
  const factor = PERIOD_TO_MONTHLY_ATY[s.payFrequency as string] ?? 1;
  const base = (parseFloat(s.grossPerPeriod as string) || 0) * factor;
  if (s.receiveBonus === "yes" && s.bonusIncludedInIncome !== "yes") {
    return base + (parseFloat(s.bonusGross as string) || 0) / 12;
  }
  return base;
}

function srcMonthlyGrossNoExpDeduction(s: Record<string, unknown>): number {
  if (s.sourceType === "selfEmployment") {
    const gross = parseFloat(s.businessGrossIncome as string) || 0;
    if (s.receiveBonus === "yes" && s.bonusIncludedInIncome !== "yes") {
      return gross + (parseFloat(s.bonusGross as string) || 0) / 12;
    }
    return gross;
  }
  const factor = PERIOD_TO_MONTHLY_ATY[s.payFrequency as string] ?? 1;
  const base = (parseFloat(s.grossPerPeriod as string) || 0) * factor;
  if (s.receiveBonus === "yes" && s.bonusIncludedInIncome !== "yes") {
    return base + (parseFloat(s.bonusGross as string) || 0) / 12;
  }
  return base;
}

function calcTotalGrossIncome(data: Record<string, unknown>): number {
  const isJoint = data.filingType === "joint" || data.filingType === "individual-nonfiling-spouse";
  const debtorSources = (data.debtorSources as Array<Record<string, unknown>>) ?? [];
  const spouseSources = isJoint ? ((data.spouseSources as Array<Record<string, unknown>>) ?? []) : [];
  const debtorTotal = debtorSources.reduce((acc, s) => acc + srcMonthlyGrossNoExpDeduction(s), 0);
  const spouseTotal = spouseSources.reduce((acc, s) => acc + srcMonthlyGrossNoExpDeduction(s), 0);
  const otherIncome = (parseFloat(data.dSsRetirement as string) || 0) + (parseFloat(data.dSsDisability as string) || 0)
    + (parseFloat(data.dVeterans as string) || 0) + (parseFloat(data.dVeteransRetirement as string) || 0)
    + (parseFloat(data.dUnemployment as string) || 0)
    + (parseFloat(data.dWorkersComp as string) || 0) + (parseFloat(data.dPension as string) || 0)
    + (parseFloat(data.dRental as string) || 0) + (parseFloat(data.dAlimony as string) || 0)
    + (parseFloat(data.dChildSupport as string) || 0) + (parseFloat(data.dFamilySupport as string) || 0)
    + (parseFloat(data.dRoyalties as string) || 0) + (parseFloat(data.dInvestment as string) || 0)
    + (parseFloat(data.dOtherIncome as string) || 0);
  return debtorTotal + spouseTotal + otherIncome;
}

function calcTotalIncome(data: Record<string, unknown>): number {
  const isJoint = data.filingType === "joint" || data.filingType === "individual-nonfiling-spouse";
  const debtorSources = (data.debtorSources as Array<Record<string, unknown>>) ?? [];
  const spouseSources = isJoint ? ((data.spouseSources as Array<Record<string, unknown>>) ?? []) : [];
  const debtorTotal = debtorSources.reduce((acc, s) => acc + srcMonthlyGrossAtty(s), 0);
  const spouseTotal = spouseSources.reduce((acc, s) => acc + srcMonthlyGrossAtty(s), 0);
  const otherIncome = (parseFloat(data.dSsRetirement as string) || 0) + (parseFloat(data.dSsDisability as string) || 0)
    + (parseFloat(data.dVeterans as string) || 0) + (parseFloat(data.dVeteransRetirement as string) || 0)
    + (parseFloat(data.dUnemployment as string) || 0)
    + (parseFloat(data.dWorkersComp as string) || 0) + (parseFloat(data.dPension as string) || 0)
    + (parseFloat(data.dRental as string) || 0) + (parseFloat(data.dAlimony as string) || 0)
    + (parseFloat(data.dChildSupport as string) || 0) + (parseFloat(data.dFamilySupport as string) || 0)
    + (parseFloat(data.dRoyalties as string) || 0) + (parseFloat(data.dInvestment as string) || 0)
    + (parseFloat(data.dOtherIncome as string) || 0);
  return debtorTotal + spouseTotal + otherIncome;
}

function calcTotalDebt(data: Record<string, unknown>): number {
  const vehicles = (data.vehicles as Array<Record<string, unknown>>) ?? [];
  const properties = (data.properties as Array<Record<string, unknown>>) ?? [];
  const vehicleLiens = vehicles.reduce((a, v) => a + (parseFloat(v.loanBalance as string) || 0), 0);
  const mortgageBalances = properties.reduce((a, p) => a + (parseFloat(p.loanBalance as string) || 0), 0);
  const unsecured = (parseFloat(data.creditCardDebt as string) || 0)
    + (parseFloat(data.medicalDebt as string) || 0)
    + (parseFloat(data.studentLoanDebt as string) || 0)
    + (parseFloat(data.personalLoanDebt as string) || 0)
    + (parseFloat(data.otherDebt as string) || 0)
    + (parseFloat(data.supplyVendorDebt as string) || 0)
    + (parseFloat(data.businessCreditCardDebt as string) || 0)
    + (parseFloat(data.businessMortgageDebt as string) || 0)
    + (parseFloat(data.businessEquipmentDebt as string) || 0)
    + (parseFloat(data.otherBusinessDebt as string) || 0);
  const priority = (parseFloat(data.taxDebt as string) || 0);
  return vehicleLiens + mortgageBalances + unsecured + priority;
}

function calcTotalExpenses(data: Record<string, unknown>): number {
  const fields = ["expRentMortgage","expPropTax","expHoa","expElectricGas","expWaterSewer","expPhone","expInternet",
    "expFood","expHouseholdSupplies","expClothing","expPersonalCare","expGasFuel","expCarMaintenance",
    "expPublicTransit","expMedical","expInsHealth","expInsLife","expInsVehicle","expInsHome","expInsDisability",
    "expInsOther","expChildcare","expChildEducation","expCharitable","expRecreation","expHomeMaintenance",
    "expAddlTaxes","expAlimonyPaid","expSupportOthers","expGovFines","expOther"];
  const vehiclePayments = ((data.vehicles as Array<Record<string, unknown>>) ?? [])
    .reduce((a, v) => a + (parseFloat(v.monthlyPayment as string) || 0), 0);
  const lienPayments = ((data.liens as Array<Record<string, unknown>>) ?? [])
    .reduce((a, l) => a + (parseFloat(l.monthlyPayment as string) || 0), 0);
  const primaryMortgage = (data.isOccupiedPrimary as string) === "yes"
    ? (parseFloat((data.realPropMonthlyPayment as string) ?? "0") || 0)
    : (parseFloat((data.rentAtResidence as string) ?? "0") || parseFloat((data.expRentMortgage as string) ?? "0") || 0);
  const secondMortgage = parseFloat((data.secondMortgagePayment as string) ?? "0") || 0;
  const lotRent = parseFloat((data.expLotSpaceRent as string) ?? "0") || 0;
  const otherFields = fields.filter(f => f !== "expRentMortgage" && f !== "expLotSpaceRent");
  return otherFields.reduce((acc, f) => acc + (parseFloat((data[f] as string) ?? "0") || 0), 0)
    + vehiclePayments + lienPayments + primaryMortgage + secondMortgage + lotRent;
}

function detectIssues(fd: Record<string, unknown>): string[] {
  const issues: string[] = [];
  const income = calcTotalIncome(fd);
  const expenses = calcTotalExpenses(fd);
  const debt = calcTotalDebt(fd);
  if (fd.hadPriorBankruptcy === 'yes') issues.push("Prior bankruptcy");
  if (income === 0) issues.push("No income reported");
  if (debt === 0) issues.push("No debts reported");
  if (income > 0 && expenses > income * 1.5) issues.push("Expenses exceed income");
  const vehicles = (fd.vehicles as Array<Record<string, unknown>>) ?? [];
  vehicles.forEach(v => {
    const val = parseFloat((v.value as string) ?? "0") || 0;
    const lien = parseFloat((v.loanBalance as string) ?? "0") || 0;
    if (val > 5000 && lien === 0) issues.push(`Unencumbered vehicle: ${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""}`);
  });
  const properties = (fd.properties as Array<Record<string, unknown>>) ?? [];
  const stateCode = (fd.state as string) ?? "TX";
  const detExemptions = getApplicableExemptions(stateCode);
  const detHomestead = detExemptions.homestead === 'unlimited' || detExemptions.homestead === -1 ? Infinity : detExemptions.homestead;
  properties.forEach((p, i) => {
    const fmv = parseFloat((p.propertyValue as string) ?? "0") || 0;
    const mortgage = parseFloat((p.loanBalance as string) ?? "0") || 0;
    if (fmv > mortgage && fmv - mortgage > detHomestead) issues.push(`Equity in property ${i + 1}: ${fmt(fmv - mortgage)}`);
  });
  return issues;
}

function suggestChapter(fd: Record<string, unknown>): "7" | "13" | "either" {
  const income = calcTotalIncome(fd);
  const expenses = calcTotalExpenses(fd);
  const disposable = income - expenses;
  const mortgages = (fd.properties as Array<Record<string, unknown>>) ?? [];
  const hasMortgage = mortgages.length > 0;
  const hasPrior = fd.hadPriorBankruptcy === 'yes';
  if (hasMortgage && disposable > 200) return "13";
  if (hasPrior) return "13";
  if (disposable < 0 || disposable < 100) return "7";
  return "either";
}

const STATE_MEDIAN_INCOME: Record<string, number[]> = {
  AL:[47292,61140,71424,83412,93360], AK:[68196,90432,104520,114564,124608], AZ:[57132,74412,86136,100308,107532],
  AR:[44544,57792,68196,79308,91476], CA:[67884,88596,101616,116724,128316], CO:[70308,92064,103908,118416,130716],
  CT:[72576,95496,113268,130500,147732], DE:[62616,79776,94620,108648,116124], FL:[55236,69084,79392,91200,103116],
  GA:[55836,70716,82332,96252,107724], HI:[71736,97092,118248,135360,153972], ID:[54372,70716,83532,96672,107748],
  IL:[63540,81660,96156,110424,123048], IN:[55236,69876,81456,94560,106740], IA:[59736,76272,89784,102600,115416],
  KS:[58524,75348,88944,101136,113844], KY:[48384,62256,73392,85068,97164], LA:[48276,60396,73068,84756,96888],
  ME:[57480,72768,86604,99816,112872], MD:[82260,106440,124848,141528,157176], MA:[76140,99636,118200,134760,151080],
  MI:[57036,73092,86160,99876,112296], MN:[71556,93072,107748,122484,137940], MS:[43260,55380,66564,78996,89772],
  MO:[54168,68772,81132,93240,105456], MT:[53784,68880,82236,95652,107508], NE:[59616,77388,91668,103956,117252],
  NV:[58344,75528,88380,102756,115212], NH:[78324,101244,118308,135396,151128], NJ:[80016,103740,121212,139416,154896],
  NM:[45576,58884,71076,83568,93420], NY:[66876,87888,104208,120528,135588], NC:[54024,68244,80064,93576,105456],
  ND:[63924,83316,97644,111852,126288], OH:[56340,71424,83964,97884,109500], OK:[51516,65892,77604,90804,102300],
  OR:[63228,82512,96696,110340,123768], PA:[62244,79980,94572,108192,121584], RI:[68064,88572,104772,119808,134952],
  SC:[51204,64764,76716,90168,102384], SD:[57144,73824,87576,100764,114552], TN:[51840,65628,76860,90288,101736],
  TX:[57648,73680,86244,99372,111396], UT:[66576,87024,100356,113772,126312], VT:[65280,84060,100272,116952,131484],
  VA:[74064,96216,111576,127392,142848], WA:[75816,98904,113700,128916,143148], WV:[43728,55920,67704,79848,90468],
  WI:[61020,78756,93576,107100,120384], WY:[59604,77088,90408,104016,117468], DC:[82200,107220,126156,145080,162996],
};

function getStateMedian(state: string, householdSize: number): number {
  const medians = STATE_MEDIAN_INCOME[state?.toUpperCase()] ?? STATE_MEDIAN_INCOME["TX"];
  const idx = Math.min(Math.max(householdSize - 1, 0), medians.length - 1);
  return medians[idx];
}

interface EligibilityResult {
  eligible: boolean;
  badge: "eligible" | "not-eligible" | "conditional";
  reasons: string[];
  warnings: string[];
}

function calcTotalBusinessDebt(fd: Record<string, unknown>): number {
  return (
    (parseFloat((fd.supplyVendorDebt as string) ?? "0") || 0) +
    (parseFloat((fd.businessCreditCardDebt as string) ?? "0") || 0) +
    (parseFloat((fd.businessMortgageDebt as string) ?? "0") || 0) +
    (parseFloat((fd.businessEquipmentDebt as string) ?? "0") || 0) +
    (parseFloat((fd.otherBusinessDebt as string) ?? "0") || 0)
  );
}

function calcTotalConsumerDebt(fd: Record<string, unknown>): number {
  const vehicles = (fd.vehicles as Array<Record<string, unknown>>) ?? [];
  const properties = (fd.properties as Array<Record<string, unknown>>) ?? [];
  return (
    (parseFloat((fd.creditCardDebt as string) ?? "0") || 0) +
    (parseFloat((fd.medicalDebt as string) ?? "0") || 0) +
    (parseFloat((fd.studentLoanDebt as string) ?? "0") || 0) +
    (parseFloat((fd.personalLoanDebt as string) ?? "0") || 0) +
    (parseFloat((fd.otherDebt as string) ?? "0") || 0) +
    properties.reduce((a, p) => a + (parseFloat((p.loanBalance as string) ?? "0") || 0), 0) +
    vehicles.reduce((a, v) => a + (parseFloat((v.loanBalance as string) ?? "0") || 0), 0)
  );
}

function analyzeChapter7(fd: Record<string, unknown>): EligibilityResult {
  const grossIncome = calcTotalGrossIncome(fd);
  const income = calcTotalIncome(fd);
  const expenses = calcTotalExpenses(fd);
  const disposable = income - expenses;

  const numDeps = parseInt((fd.numDependents as string) ?? "0") || 0;
  const isJoint = fd.filingType === "joint" || fd.filingType === "individual-nonfiling-spouse";
  const householdSize = numDeps + (isJoint ? 2 : 1);
  const state = (fd.state as string) ?? "TX";
  const annualIncome = grossIncome * 12;
  const medianAnnual = getStateMedian(state, householdSize);
  const passesMeansTest = annualIncome <= medianAnnual;

  const totalBusinessDebt = calcTotalBusinessDebt(fd);
  const totalConsumerDebt = calcTotalConsumerDebt(fd);
  const totalAllDebt = totalBusinessDebt + totalConsumerDebt;
  const primarylyBusinessDebt = totalAllDebt > 0 && totalBusinessDebt / totalAllDebt > 0.50;

  const vehicles = (fd.vehicles as Array<Record<string, unknown>>) ?? [];
  const properties = (fd.properties as Array<Record<string, unknown>>) ?? [];
  const hasPrior = fd.hadPriorBankruptcy === 'yes';
  const priorChapter = (fd.priorChapter as string) ?? "";
  const priorYear = parseInt((fd.priorDischargeYear as string) ?? "0") || 0;
  const currentYear = new Date().getFullYear();

  const reasons: string[] = [];
  const warnings: string[] = [];
  let eligible = true;

  if (primarylyBusinessDebt) {
    reasons.push(`Primarily business debt (${Math.round((totalBusinessDebt / totalAllDebt) * 100)}% of total) — means test does not apply under § 707(b)(2)(D); Ch. 7 eligible regardless of income`);
  } else if (!passesMeansTest) {
    const excess = annualIncome - medianAnnual;
    if (disposable * 60 > 12_500 || (disposable * 60 > 7_700 && disposable * 60 / (income * 12) > 0.25)) {
      eligible = false;
      reasons.push(`Income ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(excess)} above ${householdSize}-person median — fails means test`);
    } else {
      warnings.push(`Income above median — full means test (Form 122A-2) required but may still pass after IRS expense deductions`);
    }
  } else {
    reasons.push(`Income below ${householdSize}-person ${state} median — presumed Ch. 7 eligible`);
  }

  const homesteadExemptionRaw = getEffectiveHomestead(fd);
  const vehicleExemptionAmt = getEffectiveVehicleExemption(fd);

  let nonExemptEquity = 0;
  let nonExemptPropCount = 0;
  let nonExemptPropTotal = 0;
  if (homesteadExemptionRaw === null) {
    warnings.push("WA homestead — incomplete, data needed. Cannot estimate non-exempt real-property equity until homeAcquiredDate and isOccupiedPrimary are collected on intake.");
  } else {
    const homesteadExemption = homesteadExemptionRaw;
    properties.forEach(p => {
      const fmv = parseFloat((p.propertyValue as string) ?? "0") || 0;
      const mortgage = parseFloat((p.loanBalance as string) ?? "0") || 0;
      const equity = fmv - mortgage;
      if (equity > homesteadExemption) {
        const nonExempt = equity - homesteadExemption;
        nonExemptEquity += nonExempt;
        nonExemptPropTotal += nonExempt;
        nonExemptPropCount++;
      }
    });
  }
  if (nonExemptPropCount === 1) {
    warnings.push(`Property has non-exempt equity of ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(nonExemptPropTotal)} — attorney review required to protect assets (exemption planning, wildcard, or trustee negotiation)`);
  } else if (nonExemptPropCount > 1) {
    warnings.push(`${nonExemptPropCount} properties have total non-exempt equity of ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(nonExemptPropTotal)} — attorney review required; Ch. 7 eligible but asset protection strategy needed`);
  }

  let nonExemptVehCount = 0;
  let nonExemptVehTotal = 0;
  vehicles.forEach(v => {
    const val = parseFloat((v.value as string) ?? "0") || 0;
    const lien = parseFloat((v.loanBalance as string) ?? "0") || 0;
    const equity = val - lien;
    if (equity > vehicleExemptionAmt) {
      const nonExempt = equity - vehicleExemptionAmt;
      nonExemptEquity += nonExempt;
      nonExemptVehTotal += nonExempt;
      nonExemptVehCount++;
    }
  });
  if (nonExemptVehCount === 1) {
    warnings.push(`Vehicle has non-exempt equity of ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(nonExemptVehTotal)} — attorney review required to address trustee exposure`);
  } else if (nonExemptVehCount > 1) {
    warnings.push(`${nonExemptVehCount} vehicles have total non-exempt equity of ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(nonExemptVehTotal)} — attorney review required on all`);
  }

  if (nonExemptEquity > 0) {
    warnings.push(`Total est. non-exempt equity: ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(nonExemptEquity)} — client is NOT a good Ch. 7 candidate without resolving these issues`);
  }

  if (hasPrior) {
    if (priorChapter === "7" && currentYear - priorYear < 8) {
      eligible = false;
      reasons.push(`Prior Ch. 7 discharge — ${8 - (currentYear - priorYear)} yr wait remaining (§ 727(a)(8))`);
    } else if (priorChapter === "13" && currentYear - priorYear < 6) {
      eligible = false;
      reasons.push(`Prior Ch. 13 discharge — ${6 - (currentYear - priorYear)} yr wait remaining (§ 727(a)(9))`);
    } else {
      warnings.push("Prior filing on record — verify discharge dates and eligibility");
    }
  }

  const hasMortgageArrears = properties.some(p => parseFloat((p.arrearsAmount as string) ?? "0") > 0);
  if (hasMortgageArrears) {
    warnings.push("Mortgage arrears present — Ch. 7 does not cure arrears; client must be advised to consider Ch. 13 to save home");
  }

  const recentPayments = fd.hasTransfers === 'yes';
  const insiderPayments = fd.hasInsiderTransfers === 'yes';
  const propertyTransfers = fd.hasPropertyTransfer === 'yes';

  if (recentPayments) {
    eligible = false;
    reasons.push("Recent large/preferential payments flagged — trustee will scrutinize payments to creditors within 90 days (insiders: 1 yr)");
    warnings.push("Advise client to WAIT until preference look-back period expires (90 days general / 1 year insider) before filing Ch. 7");
  }
  if (insiderPayments) {
    eligible = false;
    reasons.push("Insider payments reported — preference period is 1 year for family/business insiders (§ 547)");
    warnings.push("Client must wait until insider preference look-back period (1 year) has expired before filing to avoid trustee clawback");
  }
  if (propertyTransfers) {
    eligible = false;
    reasons.push("Property transfers within look-back period — potential fraudulent transfer issue under § 548 (2 yrs) or state law (up to 4 yrs)");
    warnings.push("Advise client to WAIT until applicable fraudulent transfer look-back period clears, or these transfers may be unwound by the trustee");
  }

  if (eligible && reasons.filter(r => !r.includes("median")).length === 0) {
    reasons.unshift(passesMeansTest ? "No significant Ch. 7 obstacles identified" : "");
  }

  return {
    eligible,
    badge: eligible ? (warnings.length > 0 ? "conditional" : "eligible") : "not-eligible",
    reasons: reasons.filter(Boolean),
    warnings,
  };
}

function analyzeChapter13(fd: Record<string, unknown>): EligibilityResult {
  const income = calcTotalIncome(fd);
  const expenses = calcTotalExpenses(fd);
  const disposable = income - expenses;

  const mortgages = (fd.properties as Array<Record<string, unknown>>) ?? [];
  const vehicles = (fd.vehicles as Array<Record<string, unknown>>) ?? [];

  const totalUnsecured = (parseFloat(fd.creditCardDebt as string) || 0)
    + (parseFloat(fd.medicalDebt as string) || 0)
    + (parseFloat(fd.studentLoanDebt as string) || 0)
    + (parseFloat(fd.personalLoanDebt as string) || 0)
    + (parseFloat(fd.otherDebt as string) || 0)
    + (parseFloat(fd.supplyVendorDebt as string) || 0)
    + (parseFloat(fd.businessCreditCardDebt as string) || 0)
    + (parseFloat(fd.businessMortgageDebt as string) || 0)
    + (parseFloat(fd.businessEquipmentDebt as string) || 0)
    + (parseFloat(fd.otherBusinessDebt as string) || 0);
  const totalSecured = mortgages.reduce((a, m) => a + (parseFloat((m.loanBalance as string) ?? "0") || 0), 0)
    + vehicles.reduce((a, v) => a + (parseFloat((v.loanBalance as string) ?? "0") || 0), 0);
  const totalArrears = mortgages.reduce((a, m) => a + (parseFloat((m.arrearsAmount as string) ?? "0") || 0), 0);

  const hasPrior = fd.hadPriorBankruptcy === 'yes';
  const priorChapter = (fd.priorChapter as string) ?? "";
  const priorYear = parseInt((fd.priorDischargeYear as string) ?? "0") || 0;
  const currentYear = new Date().getFullYear();

  const reasons: string[] = [];
  const warnings: string[] = [];
  let eligible = true;

  // Current limits under 11 U.S.C. § 109(e) — effective April 1, 2025 through March 31, 2028
  const CH13_UNSECURED_LIMIT = 526_700;
  const CH13_SECURED_LIMIT = 1_580_125;

  if (totalUnsecured > CH13_UNSECURED_LIMIT) {
    eligible = false;
    reasons.push(`Unsecured debt ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(totalUnsecured)} exceeds § 109(e) limit of $526,700 — Ch. 13 ineligible; must file Ch. 11`);
  }
  if (totalSecured > CH13_SECURED_LIMIT) {
    eligible = false;
    reasons.push(`Secured debt ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(totalSecured)} exceeds § 109(e) limit of $1,580,125 — Ch. 13 ineligible; must file Ch. 11`);
  }

  if (disposable < 0) {
    eligible = false;
    reasons.push(`Negative DMI (${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(disposable)}/mo) — plan cannot be funded`);
  } else if (disposable < 100) {
    warnings.push(`Low DMI (${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(disposable)}/mo) — plan feasibility requires careful review`);
  } else {
    reasons.push(`DMI ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(disposable)}/mo — est. 60-mo plan: ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(disposable * 60)}`);
  }

  if (hasPrior) {
    if (priorChapter === "13" && currentYear - priorYear < 2) {
      eligible = false;
      reasons.push(`Prior Ch. 13 discharge — ${2 - (currentYear - priorYear)} yr wait for another Ch. 13 discharge (§ 1328(f)(2))`);
    } else if (priorChapter === "7" && currentYear - priorYear < 4) {
      warnings.push(`Prior Ch. 7 discharge — Ch. 13 can be filed but discharge requires 4-yr wait; ${4 - (currentYear - priorYear)} yr remaining`);
    } else {
      warnings.push("Prior filing on record — verify discharge dates");
    }
  }

  if (totalArrears > 0) {
    reasons.push(`Mortgage arrears ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(totalArrears)} can be cured over 60-month plan`);
  }

  if (vehicles.length > 0) {
    warnings.push("Vehicle cramdown may be available if purchased >910 days ago (§ 1325(a))");
  }

  if (income === 0) {
    eligible = false;
    reasons.push("No income reported — plan cannot be funded without regular income");
  }

  if (eligible && reasons.filter(r => !r.includes("DMI")).length === 0) {
    reasons.push("No Ch. 13 eligibility obstacles identified");
  }

  return {
    eligible,
    badge: eligible ? (warnings.length > 0 ? "conditional" : "eligible") : "not-eligible",
    reasons: reasons.filter(Boolean),
    warnings,
  };
}

interface GoodFaithCheck {
  label: string;
  description: string;
  passed: boolean;
  detail: string;
  note?: string;
}

interface GoodFaithResult {
  checks: GoodFaithCheck[];
  isGoodCandidate: boolean;
}

function analyzeGoodFaith13(fd: Record<string, unknown>): GoodFaithResult {
  const grossIncome = calcTotalIncome(fd);
  const totalExpenses = calcTotalExpenses(fd);
  const mortgages = (fd.properties as Array<Record<string, unknown>>) ?? [];
  const vehicles = (fd.vehicles as Array<Record<string, unknown>>) ?? [];
  const properties = (fd.properties as Array<Record<string, unknown>>) ?? [];

  const keptMortgages = mortgages.filter(m => (m.intent as string) !== "surrender");
  const keptVehicles = vehicles.filter(v => (v.intent as string) !== "surrender");
  const hasMortgageArrears = keptMortgages.some(m => parseFloat((m.arrearsAmount as string) ?? "0") > 0);
  const totalMortgageMonthly = keptMortgages.reduce((a, m) => a + (parseFloat((m.monthlyPayment as string) ?? "0") || 0), 0);
  const totalMortgageArrears = keptMortgages.reduce((a, m) => a + (parseFloat((m.arrearsAmount as string) ?? "0") || 0), 0);
  const totalVehicleLiens = keptVehicles.reduce((a, v) => a + (parseFloat((v.loanBalance as string) ?? "0") || 0), 0);
  const childSupport = parseFloat((fd.dChildSupport as string) ?? "0") || 0;
  const alimony = parseFloat((fd.dAlimony as string) ?? "0") || 0;
  const backTaxes = parseFloat((fd.taxDebt as string) ?? "0") || 0;
  const priorityDebtsArr = (fd.priorityDebts as Array<Record<string, unknown>>) ?? [];
  const priorityDebtsBal = priorityDebtsArr.reduce((a, d) => a + (parseFloat((d.balance as string) ?? "0") || 0), 0);
  const csArrears = parseFloat((fd.childSupportArrears as string) ?? "0") || 0;
  const alArrears = parseFloat((fd.alimonyArrears as string) ?? "0") || 0;
  const dsoArrearsAmt = csArrears + alArrears || parseFloat((fd.domesticSupportArrears as string) ?? "0") || 0;

  const totalUnsecuredNonPriority = (parseFloat(fd.creditCardDebt as string) || 0)
    + (parseFloat(fd.medicalDebt as string) || 0)
    + (parseFloat(fd.studentLoanDebt as string) || 0)
    + (parseFloat(fd.personalLoanDebt as string) || 0)
    + (parseFloat(fd.otherDebt as string) || 0)
    + (parseFloat(fd.supplyVendorDebt as string) || 0)
    + (parseFloat(fd.businessCreditCardDebt as string) || 0)
    + (parseFloat(fd.businessMortgageDebt as string) || 0)
    + (parseFloat(fd.businessEquipmentDebt as string) || 0)
    + (parseFloat(fd.otherBusinessDebt as string) || 0);

  const rentMortgageExpense = parseFloat((fd.expRentMortgage as string) ?? "0") || 0;
  const adjustedExpenses = hasMortgageArrears ? totalExpenses - rentMortgageExpense : totalExpenses;
  const dmi = grossIncome - adjustedExpenses;
  const planBase = Math.max(dmi, 0);
  const planTerm = 60;

  const conduitPayments = totalMortgageMonthly * planTerm;
  const arrearsCure = totalMortgageArrears;
  const vehiclePayoff = totalVehicleLiens;
  const priorityPayoff = backTaxes + priorityDebtsBal + dsoArrearsAmt + (childSupport * planTerm) + (alimony * planTerm);
  const totalPlanFunding = planBase * planTerm;
  const trusteeFee = totalPlanFunding * 0.10;
  const totalSecuredObligations = conduitPayments + arrearsCure + vehiclePayoff;
  const planObligations = totalSecuredObligations + priorityPayoff + trusteeFee;
  const availableForUnsecured = Math.max(totalPlanFunding - planObligations, 0);

  // gf13* exemption variables removed — they were declared but never used in
  // the good-faith checks below.
  const liquidationValue = calcNonExemptEquity(fd);

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  const securedPasses = dmi > 0 && totalPlanFunding >= totalSecuredObligations;
  const priorityPasses = dmi > 0 && totalPlanFunding >= (totalSecuredObligations + priorityPayoff + trusteeFee);
  const liquidationPasses = availableForUnsecured >= liquidationValue;

  const checks: GoodFaithCheck[] = [
    {
      label: "DMI Funds All Secured Creditors",
      description: "Vehicles (lien payoff), mortgage conduit payments & arrears cure",
      passed: securedPasses,
      detail: securedPasses
        ? `Plan funds ${fmt(totalSecuredObligations)} in secured obligations (vehicles: ${fmt(vehiclePayoff)}, conduit: ${fmt(conduitPayments)}, arrears: ${fmt(arrearsCure)})`
        : dmi <= 0
          ? `DMI is ${fmt(dmi)}/mo — plan cannot be funded`
          : `Plan funds ${fmt(totalPlanFunding)} but secured obligations total ${fmt(totalSecuredObligations)} — shortfall of ${fmt(totalSecuredObligations - totalPlanFunding)}`,
    },
    {
      label: "DMI Pays All Priority Creditors",
      description: "Back child support, alimony, priority tax debt, and other priority claims",
      passed: priorityPasses,
      detail: priorityPasses
        ? `Priority obligations of ${fmt(priorityPayoff)} (plus ${fmt(trusteeFee)} trustee fee) are covered by plan funding of ${fmt(totalPlanFunding)}`
        : `Priority obligations total ${fmt(priorityPayoff + trusteeFee)} but plan only funds ${fmt(totalPlanFunding)} after secured — shortfall of ${fmt((totalSecuredObligations + priorityPayoff + trusteeFee) - totalPlanFunding)}`,
      note: childSupport > 0 || alimony > 0 ? `Domestic support: ${fmt((childSupport + alimony) * planTerm)} over plan` : undefined,
    },
    {
      label: "Satisfies Ch. 7 Liquidation Test",
      description: "Unsecured creditors receive at least what they would get in a Ch. 7 liquidation (unexempt equity)",
      passed: liquidationPasses,
      detail: liquidationPasses
        ? liquidationValue === 0
          ? `No non-exempt equity — liquidation test satisfied (creditors receive nothing in Ch. 7)`
          : `Plan pays ${fmt(availableForUnsecured)} to unsecured creditors, meeting the ${fmt(liquidationValue)} liquidation floor`
        : `Unexempt equity of ${fmt(liquidationValue)} exceeds ${fmt(availableForUnsecured)} available for unsecured — shortfall of ${fmt(liquidationValue - availableForUnsecured)}`,
    },
  ];

  const isGoodCandidate = checks.every(c => c.passed);

  return { checks, isGoodCandidate };
}

function calcNonExemptEquity(fd: Record<string, unknown>): number {
  const properties = (fd.properties as Array<Record<string, unknown>>) ?? [];
  const vehicles = (fd.vehicles as Array<Record<string, unknown>>) ?? [];
  const bankAccounts = (fd.bankAccounts as Array<Record<string, unknown>>) ?? [];
  const businessAssets = (fd.businessAssets as Array<Record<string, unknown>>) ?? [];
  const firearms = (fd.firearms as Array<Record<string, unknown>>) ?? [];

  const totalBankBalance = bankAccounts.reduce((a, b) => a + (parseFloat((b.balance as string) ?? "0") || 0), 0);
  const householdGoodsValue = parseFloat((fd.householdGoodsValue as string) ?? "0") || 0;
  const electronicsValue = parseFloat((fd.electronicsValue as string) ?? "0") || 0;
  const jewelryValue = parseFloat((fd.jewelryValue as string) ?? "0") || 0;
  const toolsValue = parseFloat((fd.toolsValue as string) ?? "0") || 0;
  const stocksValue = parseFloat((fd.stocksValue as string) ?? "0") || 0;
  const cryptoValue = parseFloat((fd.cryptoValue as string) ?? "0") || 0;
  const firearmsValue = firearms.reduce((a, f) => a + (parseFloat((f.value as string) ?? "0") || 0), 0);
  const collectiblesValue = parseFloat((fd.collectiblesValue as string) ?? "0") || 0;
  const otherPersonalPropValue = parseFloat((fd.otherPersonalPropValue as string) ?? "0") || 0;
  const moneyOwedAmt = parseFloat((fd.moneyOwedAmt as string) ?? "0") || 0;
  const pendingClaimsValue = parseFloat((fd.pendingClaimsValue as string) ?? "0") || 0;

  const totalBusinessAssetValue = businessAssets.reduce((a, b) => a + (parseFloat((b.estimatedValue as string) ?? "0") || 0), 0);
  const totalBusinessAssetLiens = businessAssets.reduce((a, b) => a + (parseFloat((b.owedOnIt as string) ?? "0") || 0), 0);
  const totalBusinessEquity = Math.max(0, totalBusinessAssetValue - totalBusinessAssetLiens);

  const totalPropertyFMV = properties.reduce((a, p) => a + (parseFloat((p.propertyValue as string) ?? "0") || 0), 0);
  const totalPropertyLiens = properties.reduce((a, p) => a + (parseFloat((p.loanBalance as string) ?? "0") || 0), 0);
  const totalPropertyEquity = Math.max(0, totalPropertyFMV - totalPropertyLiens);

  const totalVehicleFMV = vehicles.reduce((a, v) => a + (parseFloat((v.value as string) ?? "0") || 0), 0);
  const totalVehicleLienSum = vehicles.reduce((a, v) => a + (parseFloat((v.loanBalance as string) ?? "0") || 0), 0);
  const totalVehicleEquity = Math.max(0, totalVehicleFMV - totalVehicleLienSum);

  const filingState = normalizeStateCode((fd.state as string) ?? "TX");
  const isJointFiling = fd.filingType === "joint";
  const hasRealProperty = properties.length > 0;
  const stateEx = getApplicableExemptions(filingState, undefined, hasRealProperty);
  const caCounty = (fd.county as string) ?? "";
  const waCounty = (fd.county as string) ?? "";
  const waHomestead = filingState === "WA" && hasRealProperty
    ? getWaHomesteadEligibility(fd.homeAcquiredDate as string | undefined, fd.isOccupiedPrimary as string | undefined, waCounty)
    : null;
  const rawHomestead = filingState === "CA" && hasRealProperty
    ? getCaHomesteadByCounty(caCounty)
    : filingState === "WA" && waHomestead?.eligible
    ? waHomestead.amount
    : (stateEx.homestead === 'unlimited' || stateEx.homestead === -1 ? Infinity : stateEx.homestead);
  const propExemptionPerUnit = rawHomestead;
  const vehExemptionPerUnit = stateEx.vehicle;

  const totalPropExemption = properties.reduce((a, p, idx) => {
    if (idx > 0) return a;
    const eq = (parseFloat((p.propertyValue as string) ?? "0") || 0) - (parseFloat((p.loanBalance as string) ?? "0") || 0);
    return a + (eq > 0 ? Math.min(eq, propExemptionPerUnit) : 0);
  }, 0);
  const totalVehExemption = vehicles.reduce((a, v) => {
    const eq = (parseFloat((v.value as string) ?? "0") || 0) - (parseFloat((v.loanBalance as string) ?? "0") || 0);
    return a + (eq > 0 ? Math.min(eq, vehExemptionPerUnit) : 0);
  }, 0);
  const totalPropNonExemptEquity = Math.max(0, totalPropertyEquity - totalPropExemption);
  const totalVehNonExemptEquity = Math.max(0, totalVehicleEquity - totalVehExemption);

  const isTxAggregateState = filingState === "TX";
  const hhGoodsExemption = isTxAggregateState ? householdGoodsValue : Math.min(householdGoodsValue, stateEx.householdGoods);
  const electronicsExemption = isTxAggregateState ? electronicsValue : Math.min(electronicsValue, stateEx.householdGoods > 0 ? Math.max(0, stateEx.householdGoods - householdGoodsValue) : 0);
  const jewelryExemption = isTxAggregateState ? jewelryValue : Math.min(jewelryValue, stateEx.jewelry);
  const toolsExemption = isTxAggregateState ? toolsValue : Math.min(toolsValue, stateEx.tools);
  const firearmsExemption = isTxAggregateState ? firearmsValue : Math.min(firearmsValue, stateEx.householdGoods > 0 ? Math.max(0, stateEx.householdGoods - householdGoodsValue) : 0);

  const wildcardTotal = isTxAggregateState
    ? (isJointFiling ? 200000 : 100000)
    : (typeof stateEx.wildcard === "number" ? stateEx.wildcard : 0);

  const wildcardEligibleAssets = [
    { value: totalBankBalance, label: "bank" },
    { value: stocksValue, label: "stocks" },
    { value: cryptoValue, label: "crypto" },
    { value: moneyOwedAmt, label: "moneyOwed" },
    { value: collectiblesValue, label: "collectibles" },
    { value: otherPersonalPropValue, label: "otherProp" },
  ].filter(a => a.value > 0);

  let remainingWildcard = wildcardTotal;
  const wildcardApplied: Record<string, number> = {};
  for (const asset of wildcardEligibleAssets) {
    const applied = Math.min(remainingWildcard, asset.value);
    wildcardApplied[asset.label] = applied;
    remainingWildcard = Math.max(0, remainingWildcard - applied);
  }

  const bankNonExempt = Math.max(0, totalBankBalance - (wildcardApplied["bank"] ?? 0));
  const stocksNonExempt = Math.max(0, stocksValue - (wildcardApplied["stocks"] ?? 0));
  const cryptoNonExempt = Math.max(0, cryptoValue - (wildcardApplied["crypto"] ?? 0));
  const moneyOwedNonExempt = Math.max(0, moneyOwedAmt - (wildcardApplied["moneyOwed"] ?? 0));
  const collectiblesNonExempt = Math.max(0, collectiblesValue - (wildcardApplied["collectibles"] ?? 0));
  const otherPropNonExempt = Math.max(0, otherPersonalPropValue - (wildcardApplied["otherProp"] ?? 0));
  const hhGoodsNonExempt = Math.max(0, householdGoodsValue - hhGoodsExemption);
  const electronicsNonExempt = Math.max(0, electronicsValue - electronicsExemption);
  const jewelryNonExempt = Math.max(0, jewelryValue - jewelryExemption);
  const toolsNonExempt = Math.max(0, toolsValue - toolsExemption);
  const firearmsNonExempt = Math.max(0, firearmsValue - firearmsExemption);

  const personalPropNonExempt = hhGoodsNonExempt + electronicsNonExempt + jewelryNonExempt + toolsNonExempt + firearmsNonExempt + bankNonExempt + stocksNonExempt + cryptoNonExempt + moneyOwedNonExempt + collectiblesNonExempt + otherPropNonExempt + pendingClaimsValue;

  return totalPropNonExemptEquity + totalVehNonExemptEquity + personalPropNonExempt + totalBusinessEquity;
}

function calcAmortizedTotal(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRatePct <= 0) return principal;
  const r = annualRatePct / 100 / 12;
  const payment = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  return payment * months;
}

function effectiveVehRate(veh: Record<string, unknown>, tillRate: number | null): { rate: number | null; source: "contract" | "till" | null } {
  const contractRate = parseFloat((veh.interestRate as string) ?? "") || null;
  if (tillRate == null && contractRate == null) return { rate: null, source: null };
  if (tillRate == null) return { rate: contractRate, source: "contract" };
  if (contractRate == null) return { rate: tillRate, source: "till" };
  if (contractRate < tillRate) return { rate: contractRate, source: "contract" };
  return { rate: tillRate, source: "till" };
}


function CaseSummaryGrid({ fd: fdProp, submissionId, draftId, clientName, clientEmail, staffName, onFdUpdate }: { fd: Record<string, unknown>; submissionId?: string; draftId?: string; clientName?: string; clientEmail?: string; staffName?: string; onFdUpdate?: (updatedFd: Record<string, unknown>) => void }) {
  const [fd, setFd] = useState<Record<string, unknown>>(fdProp);
  const [schedJOpen, setSchedJOpen] = useState(false);
  const [incExpModal, setIncExpModal] = useState<{ mode: "income" | "expenses" | "both"; chapter: "7" | "13" } | null>(null);

  useEffect(() => { setFd(fdProp); }, [submissionId, draftId]);

  const income = calcTotalIncome(fd);
  const grossIncome = calcTotalGrossIncome(fd);
  const expenses = calcTotalExpenses(fd);
  const dmi = income - expenses;

  const numDeps = parseInt((fd.numDependents as string) ?? "0") || 0;
  const isJoint = fd.filingType === "joint" || fd.filingType === "individual-nonfiling-spouse";
  const householdSize = numDeps + (isJoint ? 2 : 1);
  const state = (fd.state as string) ?? "TX";
  const annualIncome = grossIncome * 12;
  const medianAnnual = getStateMedian(state, householdSize);
  const medianMonthly = medianAnnual / 12;
  const overMedian = annualIncome > medianAnnual;
  const medianDiff = Math.abs(annualIncome - medianAnnual);

  const isJointGrid = fd.filingType === "joint" || fd.filingType === "individual-nonfiling-spouse";
  const debtorSources = (fd.debtorSources as Array<Record<string, unknown>>) ?? [];
  const spouseSources = isJointGrid ? ((fd.spouseSources as Array<Record<string, unknown>>) ?? []) : [];

  function srcGrossForDisplay(s: Record<string, unknown>): number {
    if (s.sourceType === "selfEmployment" && overMedian) {
      return parseFloat(s.businessGrossIncome as string) || 0;
    }
    return srcMonthlyGrossAtty(s);
  }

  const debtorWagesTotal = debtorSources.reduce((a, s) => a + srcGrossForDisplay(s), 0);
  const spouseWagesTotal = spouseSources.reduce((a, s) => a + srcGrossForDisplay(s), 0);

  const otherIncomeItems: { label: string; amount: number; isSS: boolean }[] = [
    { label: "SS Retirement", amount: parseFloat((fd.dSsRetirement as string) ?? "0") || 0, isSS: true },
    { label: "SS Disability (SSDI)", amount: parseFloat((fd.dSsDisability as string) ?? "0") || 0, isSS: true },
    { label: "Veterans Benefits", amount: parseFloat((fd.dVeterans as string) ?? "0") || 0, isSS: false },
    { label: "Unemployment", amount: parseFloat((fd.dUnemployment as string) ?? "0") || 0, isSS: false },
    { label: "Workers Comp", amount: parseFloat((fd.dWorkersComp as string) ?? "0") || 0, isSS: false },
    { label: "Pension / Retirement", amount: parseFloat((fd.dPension as string) ?? "0") || 0, isSS: false },
    { label: "Rental Income", amount: parseFloat((fd.dRental as string) ?? "0") || 0, isSS: false },
    { label: "Alimony Received", amount: parseFloat((fd.dAlimony as string) ?? "0") || 0, isSS: false },
    { label: "Child Support Received", amount: parseFloat((fd.dChildSupport as string) ?? "0") || 0, isSS: false },
    { label: "Family Support", amount: parseFloat((fd.dFamilySupport as string) ?? "0") || 0, isSS: false },
    { label: "Royalties", amount: parseFloat((fd.dRoyalties as string) ?? "0") || 0, isSS: false },
    { label: "Investment Income", amount: parseFloat((fd.dInvestment as string) ?? "0") || 0, isSS: false },
    { label: "Other Income", amount: parseFloat((fd.dOtherIncome as string) ?? "0") || 0, isSS: false },
  ].filter(i => i.amount > 0);

  const nonSSIncome = debtorWagesTotal + spouseWagesTotal
    + otherIncomeItems.filter(i => !i.isSS).reduce((a, i) => a + i.amount, 0);
  const ssIncome = otherIncomeItems.filter(i => i.isSS).reduce((a, i) => a + i.amount, 0);
  const totalGrossForDisplay = nonSSIncome + ssIncome;

  const incomeSources = [...debtorSources, ...spouseSources];
  const properties = (fd.properties as Array<Record<string, unknown>>) ?? [];
  const vehicles = (fd.vehicles as Array<Record<string, unknown>>) ?? [];

  // ── PERSONAL PROPERTY TOTALS ──
  const bankAccounts = (fd.bankAccounts as Array<Record<string, unknown>>) ?? [];
  const retirementAccounts = (fd.retirementAccounts as Array<Record<string, unknown>>) ?? [];
  const lifePolicies = (fd.lifePolicies as Array<Record<string, unknown>>) ?? [];
  const annuities = (fd.annuities as Array<Record<string, unknown>>) ?? [];
  const businessAssets = (fd.businessAssets as Array<Record<string, unknown>>) ?? [];
  const firearms = (fd.firearms as Array<Record<string, unknown>>) ?? [];

  const totalBankBalance = bankAccounts.reduce((a, b) => a + (parseFloat((b.balance as string) ?? "0") || 0), 0);
  const totalRetirement = retirementAccounts.reduce((a, r) => a + (parseFloat((r.balance as string) ?? "0") || 0), 0);
  const totalLifeCV = lifePolicies.reduce((a, p) => a + (parseFloat((p.cashValue as string) ?? "0") || 0), 0);
  const totalAnnuities = annuities.reduce((a, an) => a + (parseFloat((an.currentValue as string) ?? "0") || 0), 0);
  const householdGoodsValue = parseFloat((fd.householdGoodsValue as string) ?? "0") || 0;
  const electronicsValue = parseFloat((fd.electronicsValue as string) ?? "0") || 0;
  const jewelryValue = parseFloat((fd.jewelryValue as string) ?? "0") || 0;
  const toolsValue = parseFloat((fd.toolsValue as string) ?? "0") || 0;
  const stocksValue = parseFloat((fd.stocksValue as string) ?? "0") || 0;
  const cryptoValue = parseFloat((fd.cryptoValue as string) ?? "0") || 0;
  const firearmsValue = firearms.reduce((a, f) => a + (parseFloat((f.value as string) ?? "0") || 0), 0);
  const collectiblesValue = parseFloat((fd.collectiblesValue as string) ?? "0") || 0;
  const otherPersonalPropValue = parseFloat((fd.otherPersonalPropValue as string) ?? "0") || 0;
  const moneyOwedAmt = parseFloat((fd.moneyOwedAmt as string) ?? "0") || 0;
  const pendingClaimsValue = parseFloat((fd.pendingClaimsValue as string) ?? "0") || 0;

  // ── BUSINESS ASSET TOTALS ──
  const totalBusinessAssetValue = businessAssets.reduce((a, b) => a + (parseFloat((b.estimatedValue as string) ?? "0") || 0), 0);
  const totalBusinessAssetLiens = businessAssets.reduce((a, b) => a + (parseFloat((b.owedOnIt as string) ?? "0") || 0), 0);
  const totalBusinessEquity = Math.max(0, totalBusinessAssetValue - totalBusinessAssetLiens);

  // ── REAL PROPERTY EQUITY ──
  const totalPropertyFMV = properties.reduce((a, p) => a + (parseFloat((p.propertyValue as string) ?? "0") || 0), 0);
  const totalPropertyEquity = Math.max(0, totalPropertyFMV - (properties.reduce((a, p) => a + (parseFloat((p.loanBalance as string) ?? "0") || 0), 0)));

  // ── VEHICLE EQUITY ──
  const totalVehicleFMV = vehicles.reduce((a, v) => a + (parseFloat((v.value as string) ?? "0") || 0), 0);
  const totalVehicleEquity = Math.max(0, totalVehicleFMV - vehicles.reduce((a, v) => a + (parseFloat((v.loanBalance as string) ?? "0") || 0), 0));

  // ── EXEMPTION LIMITS (state-aware) ──
  const filingState = normalizeStateCode((fd.state as string) ?? "TX");
  const isJointFiling = fd.filingType === "joint";
  const hasRealPropertyForExemptions = properties.length > 0;
  const stateEx = getApplicableExemptions(filingState, undefined, hasRealPropertyForExemptions);
  // For CA System 704 (homeowner), use county-specific 2026 homestead amount — no doubling for joint
  const caCounty = (fd.county as string) ?? "";
  const waCounty = (fd.county as string) ?? "";
  const waHomestead = filingState === "WA" && hasRealPropertyForExemptions
    ? getWaHomesteadEligibility(fd.homeAcquiredDate as string | undefined, fd.isOccupiedPrimary as string | undefined, waCounty)
    : null;
  const rawHomestead = filingState === "CA" && hasRealPropertyForExemptions
    ? getCaHomesteadByCounty(caCounty)
    : filingState === "WA" && waHomestead?.eligible
    ? waHomestead.amount
    : (stateEx.homestead === 'unlimited' || stateEx.homestead === -1 ? Infinity : stateEx.homestead);
  // Homestead is NEVER doubled for joint filers — one homestead per case
  const propExemptionPerUnit = rawHomestead;
  const vehExemptionPerUnit = stateEx.vehicle;
  // Homestead exemption applies ONLY to the primary residence (first property)
  const totalPropExemption = properties.reduce((a, p, idx) => {
    if (idx > 0) return a; // only primary residence qualifies
    const eq = (parseFloat((p.propertyValue as string) ?? "0") || 0) - (parseFloat((p.loanBalance as string) ?? "0") || 0);
    return a + (eq > 0 ? Math.min(eq, propExemptionPerUnit) : 0);
  }, 0);
  const totalVehExemption = vehicles.reduce((a, v) => {
    const eq = (parseFloat((v.value as string) ?? "0") || 0) - (parseFloat((v.loanBalance as string) ?? "0") || 0);
    return a + (eq > 0 ? Math.min(eq, vehExemptionPerUnit) : 0);
  }, 0);
  const totalPropNonExemptEquity = Math.max(0, totalPropertyEquity - totalPropExemption);
  const totalVehNonExemptEquity = Math.max(0, totalVehicleEquity - totalVehExemption);

  // Personal property exemptions — state-aware with wildcard spreading
  const personalPropSubtotal = householdGoodsValue + electronicsValue + jewelryValue + toolsValue + stocksValue + cryptoValue + firearmsValue + collectiblesValue + otherPersonalPropValue + moneyOwedAmt + pendingClaimsValue;
  const isTxAggregateState = filingState === "TX";

  // Per-category exemptions (dedicated)
  const hhGoodsExemption = isTxAggregateState ? householdGoodsValue : Math.min(householdGoodsValue, stateEx.householdGoods);
  const electronicsExemption = isTxAggregateState ? electronicsValue : Math.min(electronicsValue, stateEx.householdGoods > 0 ? Math.max(0, stateEx.householdGoods - householdGoodsValue) : 0);
  const jewelryExemption = isTxAggregateState ? jewelryValue : Math.min(jewelryValue, stateEx.jewelry);
  const toolsExemption = isTxAggregateState ? toolsValue : Math.min(toolsValue, stateEx.tools);
  const firearmsExemption = isTxAggregateState ? firearmsValue : Math.min(firearmsValue, stateEx.householdGoods > 0 ? Math.max(0, stateEx.householdGoods - householdGoodsValue) : 0);

  // Assets with no dedicated exemption — protected only by wildcard
  const wildcardTotal = isTxAggregateState
    ? (isJointFiling ? 200000 : 100000)
    : (typeof stateEx.wildcard === "number" ? stateEx.wildcard : 0);

  // Wildcard-eligible assets (no dedicated state exemption): bank accounts, stocks, crypto, collectibles, money owed, other personal prop
  // Pending claims are generally non-exempt
  // Spread wildcard across these assets in order until exhausted
  interface WildcardAsset { value: number; label: string; }
  const wildcardEligibleAssets: WildcardAsset[] = [
    { value: totalBankBalance, label: "bank" },
    { value: stocksValue, label: "stocks" },
    { value: cryptoValue, label: "crypto" },
    { value: moneyOwedAmt, label: "moneyOwed" },
    { value: collectiblesValue, label: "collectibles" },
    { value: otherPersonalPropValue, label: "otherProp" },
  ].filter(a => a.value > 0);

  let remainingWildcard = wildcardTotal;
  const wildcardApplied: Record<string, number> = {};
  for (const asset of wildcardEligibleAssets) {
    const applied = Math.min(remainingWildcard, asset.value);
    wildcardApplied[asset.label] = applied;
    remainingWildcard = Math.max(0, remainingWildcard - applied);
  }

  const bankExemption = wildcardApplied["bank"] ?? 0;
  const stocksExemption = wildcardApplied["stocks"] ?? 0;
  const cryptoExemption = wildcardApplied["crypto"] ?? 0;
  const moneyOwedExemption = wildcardApplied["moneyOwed"] ?? 0;
  const collectiblesExemption = wildcardApplied["collectibles"] ?? 0;
  const otherPropExemption = wildcardApplied["otherProp"] ?? 0;

  const bankNonExempt = Math.max(0, totalBankBalance - bankExemption);
  const stocksNonExempt = Math.max(0, stocksValue - stocksExemption);
  const cryptoNonExempt = Math.max(0, cryptoValue - cryptoExemption);
  const moneyOwedNonExempt = Math.max(0, moneyOwedAmt - moneyOwedExemption);
  const collectiblesNonExempt = Math.max(0, collectiblesValue - collectiblesExemption);
  const otherPropNonExempt = Math.max(0, otherPersonalPropValue - otherPropExemption);

  const personalPropExemption = hhGoodsExemption + electronicsExemption + jewelryExemption + toolsExemption + firearmsExemption + bankExemption + stocksExemption + cryptoExemption + moneyOwedExemption + collectiblesExemption + otherPropExemption;
  const hhGoodsNonExempt = Math.max(0, householdGoodsValue - hhGoodsExemption);
  const electronicsNonExempt = Math.max(0, electronicsValue - electronicsExemption);
  const jewelryNonExempt = Math.max(0, jewelryValue - jewelryExemption);
  const toolsNonExempt = Math.max(0, toolsValue - toolsExemption);
  const firearmsNonExempt = Math.max(0, firearmsValue - firearmsExemption);
  const personalPropNonExempt = hhGoodsNonExempt + electronicsNonExempt + jewelryNonExempt + toolsNonExempt + firearmsNonExempt + bankNonExempt + stocksNonExempt + cryptoNonExempt + moneyOwedNonExempt + collectiblesNonExempt + otherPropNonExempt + pendingClaimsValue;

  // Retirement & life insurance — generally fully exempt
  const totalNonExemptEquity = totalPropNonExemptEquity + totalVehNonExemptEquity + personalPropNonExempt + totalBusinessEquity;

  const totalBusinessDebtDisplay = (parseFloat((fd.supplyVendorDebt as string) ?? "0") || 0)
    + (parseFloat((fd.businessCreditCardDebt as string) ?? "0") || 0)
    + (parseFloat((fd.businessMortgageDebt as string) ?? "0") || 0)
    + (parseFloat((fd.businessEquipmentDebt as string) ?? "0") || 0)
    + (parseFloat((fd.otherBusinessDebt as string) ?? "0") || 0);
  const totalUnsecured = (parseFloat((fd.creditCardDebt as string) ?? "0") || 0)
    + (parseFloat((fd.medicalDebt as string) ?? "0") || 0)
    + (parseFloat((fd.studentLoanDebt as string) ?? "0") || 0)
    + (parseFloat((fd.personalLoanDebt as string) ?? "0") || 0)
    + (parseFloat((fd.otherDebt as string) ?? "0") || 0)
    + totalBusinessDebtDisplay;
  const totalMortgageBalance = properties.reduce((a, p) => a + (parseFloat((p.loanBalance as string) ?? "0") || 0), 0);
  const totalMortgageArrears = properties.reduce((a, p) => a + (parseFloat((p.arrearsAmount as string) ?? "0") || 0), 0);
  const totalVehicleLiens = vehicles.reduce((a, v) => a + (parseFloat((v.loanBalance as string) ?? "0") || 0), 0);

  const priorityDebts = (fd.priorityDebts as Array<Record<string, unknown>>) ?? [];
  const totalPriorityBalance = priorityDebts.reduce((a, d) => a + (parseFloat((d.balance as string) ?? "0") || 0), 0);
  const backTaxes = parseFloat((fd.taxDebt as string) ?? "0") || 0;
  const childSupport = parseFloat((fd.expAlimonyPaid as string) ?? "0") || 0;
  const alimony = parseFloat((fd.expSupportOthers as string) ?? "0") || 0;

  const expenseFields: { label: string; key: string }[] = [
    { label: "Property Tax", key: "expPropTax" },
    { label: "HOA Fees", key: "expHoa" },
    { label: "Electric / Gas", key: "expElectricGas" },
    { label: "Water / Sewer", key: "expWaterSewer" },
    { label: "Phone", key: "expPhone" },
    { label: "Internet", key: "expInternet" },
    { label: "Food / Groceries", key: "expFood" },
    { label: "Household Supplies", key: "expHouseholdSupplies" },
    { label: "Clothing", key: "expClothing" },
    { label: "Personal Care", key: "expPersonalCare" },
    { label: "Gas / Fuel", key: "expGasFuel" },
    { label: "Car Maintenance", key: "expCarMaintenance" },
    { label: "Public Transit", key: "expPublicTransit" },
    { label: "Medical / Dental", key: "expMedical" },
    { label: "Health Insurance", key: "expInsHealth" },
    { label: "Life Insurance", key: "expInsLife" },
    { label: "Vehicle Insurance", key: "expInsVehicle" },
    { label: "Home Insurance", key: "expInsHome" },
    { label: "Other Insurance", key: "expInsOther" },
    { label: "Childcare", key: "expChildcare" },
    { label: "Child Education", key: "expChildEducation" },
    { label: "Charitable Giving", key: "expCharitable" },
    { label: "Recreation", key: "expRecreation" },
    { label: "Home Maintenance", key: "expHomeMaintenance" },
    { label: "Additional Taxes", key: "expAddlTaxes" },
    { label: "Alimony Paid", key: "expAlimonyPaid" },
    { label: "Support of Others", key: "expSupportOthers" },
    { label: "Gov. Fines / Fees", key: "expGovFines" },
    { label: "Other Expenses", key: "expOther" },
  ];

  const housingExpenseLines: { label: string; amount: number }[] = [];
  const mortgageAmt = parseFloat((fd.realPropMonthlyPayment as string) ?? "0") || 0;
  const rentAmt = parseFloat((fd.rentAtResidence as string) ?? "0") || 0;
  const lotRentAmt = parseFloat((fd.expLotSpaceRent as string) ?? "0") || 0;
  const fallbackRentMortgage = parseFloat((fd.expRentMortgage as string) ?? "0") || 0;
  if (mortgageAmt > 0 && (fd.isOccupiedPrimary as string) === "yes") {
    const addr = (fd.realPropAddress as string) ?? "";
    housingExpenseLines.push({ label: addr ? `Mortgage — ${addr}` : "Mortgage Payment", amount: mortgageAmt });
  } else if (rentAmt > 0) {
    housingExpenseLines.push({ label: "Rent — Current Residence", amount: rentAmt });
  } else if (fallbackRentMortgage > 0) {
    housingExpenseLines.push({ label: "Rent / Mortgage", amount: fallbackRentMortgage });
  }
  if (lotRentAmt > 0) housingExpenseLines.push({ label: "Lot / Space Rent", amount: lotRentAmt });
  const secondMortgagePaymentAmt = parseFloat((fd.secondMortgagePayment as string) ?? "0") || 0;
  if (secondMortgagePaymentAmt > 0) {
    const addr2 = (fd.secondPropAddress as string) ?? "";
    housingExpenseLines.push({ label: addr2 ? `Mortgage — ${addr2}` : "2nd Property Mortgage", amount: secondMortgagePaymentAmt });
  }
  const lienLines: { label: string; amount: number }[] = ((fd.liens as Array<Record<string, unknown>>) ?? [])
    .filter(l => parseFloat(l.monthlyPayment as string) > 0)
    .map(l => ({ label: `${(l.lienType as string) || "Lien"}${l.lienHolder ? ` — ${l.lienHolder as string}` : ""}`, amount: parseFloat(l.monthlyPayment as string) }));
  const vehicleExpenseLines: { label: string; amount: number }[] = ((fd.vehicles as Array<Record<string, unknown>>) ?? [])
    .filter(v => parseFloat(v.monthlyPayment as string) > 0)
    .map(v => {
      const yr = (v.year as string) ?? "";
      const mk = (v.make as string) ?? "";
      const mo = (v.model as string) ?? "";
      const label = [yr, mk, mo].filter(Boolean).join(" ") || "Vehicle Payment";
      return { label, amount: parseFloat(v.monthlyPayment as string) };
    });

  const domicileIssues: string[] = [];
  const assetIssues: string[] = [];
  const sofaIssues: string[] = [];

  const hasPrior = fd.hadPriorBankruptcy === "yes";
  if (hasPrior) {
    const priorChapter = (fd.priorChapter as string) ?? "";
    const priorYear = parseInt((fd.priorDischargeYear as string) ?? "0") || 0;
    const currentYear = new Date().getFullYear();
    sofaIssues.push(`Prior Ch. ${priorChapter || "?"} bankruptcy (${priorYear || "unknown year"}) — verify eligibility wait period (${currentYear - priorYear} yrs elapsed)`);
  }

  const county = (fd.county as string) ?? "";
  if (!county || county === "—" || county.trim() === "") {
    domicileIssues.push("County not provided — required for filing district determination");
  }

  const addressYears = (fd.addressYears as string) ?? "";
  const priorDomicileState = (fd.priorDomicileState as string) ?? "";

  const NON_RESIDENT_RULES: Record<string, { result: string; note: string }> = {
    Alabama:{ result:"federal", note:"AL exemptions limited to residents — federal §522(d) applies." },
    Alaska:{ result:"federal", note:"AK exemptions limited to residents — federal §522(d) applies." },
    Arizona:{ result:"federal", note:"AZ exemptions limited to residents — federal §522(d) applies." },
    Arkansas:{ result:"federal", note:"AR exemptions limited to residents — federal §522(d) applies." },
    California:{ result:"state_only", note:"CA opted out of federal exemptions for ALL filers — CA state exemptions apply." },
    Colorado:{ result:"federal", note:"CO exemptions limited to residents — federal §522(d) applies." },
    Connecticut:{ result:"state_or_federal", note:"CT has not opted out — debtor may choose CT state or federal §522(d) exemptions." },
    Delaware:{ result:"federal", note:"DE exemptions limited to domiciliaries — federal §522(d) applies." },
    "District of Columbia":{ result:"federal", note:"DC exemptions limited to DC residents/workers — federal §522(d) applies." },
    Florida:{ result:"federal", note:"FL exemptions limited to residents — federal §522(d) applies." },
    Georgia:{ result:"federal", note:"GA exemptions limited to GA domiciliaries — federal §522(d) applies." },
    Hawaii:{ result:"state_or_federal", note:"HI has not opted out — debtor may choose HI state or federal §522(d) exemptions." },
    Idaho:{ result:"federal", note:"ID exemptions limited to residents — federal §522(d) applies under savings clause." },
    Illinois:{ result:"state_or_federal", note:"IL opt-out limited to IL residents — debtor may choose IL state or federal §522(d) exemptions." },
    Indiana:{ result:"federal", note:"IN exemptions limited to domiciliaries — federal §522(d) applies." },
    Iowa:{ result:"state_or_federal", note:"IA homestead is extraterritorial; personal property limited to residents — partial choice applies." },
    Kansas:{ result:"state_or_federal", note:"KS most personal property exemptions limited to residents — partial choice applies." },
    Kentucky:{ result:"state_or_federal", note:"KY most personal property exemptions limited to residents — partial choice applies." },
    Louisiana:{ result:"state_only", note:"LA opted out of federal exemptions for ALL filers — LA state exemptions apply." },
    Maine:{ result:"state_only", note:"ME opted out of federal exemptions for ALL filers — ME state exemptions apply." },
    Maryland:{ result:"federal", note:"MD exemptions limited to domiciliaries — federal §522(d) applies under savings clause." },
    Massachusetts:{ result:"state_or_federal", note:"MA has not opted out — debtor may choose MA state or federal §522(d) exemptions." },
    Michigan:{ result:"state_or_federal", note:"MI has not opted out — debtor may choose MI state or federal §522(d) exemptions." },
    Minnesota:{ result:"state_or_federal", note:"MN has not opted out — debtor may choose MN state or federal §522(d) exemptions." },
    Mississippi:{ result:"federal", note:"MS exemptions limited to residents — federal §522(d) applies." },
    Missouri:{ result:"state_only", note:"MO opted out of federal exemptions for ALL filers — MO state exemptions apply." },
    Montana:{ result:"federal", note:"MT exemptions limited to residents — federal §522(d) applies under savings clause." },
    Nebraska:{ result:"state_only", note:"NE opted out of federal exemptions for ALL filers — NE state exemptions apply." },
    Nevada:{ result:"state_or_federal", note:"NV opt-out limited to NV residents — debtor may choose NV state or federal §522(d) exemptions." },
    "New Hampshire":{ result:"state_or_federal", note:"NH has not opted out — debtor may choose NH state or federal §522(d) exemptions." },
    "New Jersey":{ result:"state_or_federal", note:"NJ has not opted out — debtor may choose NJ state or federal §522(d) exemptions." },
    "New Mexico":{ result:"state_or_federal", note:"NM some exemptions limited to residents — partial choice applies." },
    "New York":{ result:"federal", note:"NY exemptions limited to domiciliaries — federal §522(d) applies." },
    "North Carolina":{ result:"federal", note:"NC exemptions limited to residents — federal §522(d) applies." },
    "North Dakota":{ result:"state_or_federal", note:"ND some exemptions limited to residents — partial choice applies." },
    Ohio:{ result:"federal", note:"OH exemptions limited to domiciliaries — federal §522(d) applies." },
    Oklahoma:{ result:"federal", note:"OK exemptions limited to residents — federal §522(d) applies." },
    Oregon:{ result:"federal", note:"OR exemptions limited to residents — federal §522(d) applies." },
    Pennsylvania:{ result:"state_or_federal", note:"PA has not opted out — debtor may choose PA state or federal §522(d) exemptions." },
    "Rhode Island":{ result:"state_or_federal", note:"RI has not opted out — debtor may choose RI state or federal §522(d) exemptions." },
    "South Carolina":{ result:"federal", note:"SC exemptions limited to domiciliaries — federal §522(d) applies under savings clause." },
    "South Dakota":{ result:"state_or_federal", note:"SD most exemptions limited to residents — partial choice applies." },
    Tennessee:{ result:"federal", note:"TN exemptions limited to TN citizens — federal §522(d) applies." },
    Texas:{ result:"state_or_federal", note:"TX has not opted out — debtor may choose TX state or federal §522(d) exemptions." },
    Utah:{ result:"federal", note:"UT non-residents use federal §522(d) under savings clause." },
    Vermont:{ result:"state_or_federal", note:"VT has not opted out — debtor may choose VT state or federal §522(d) exemptions." },
    Virginia:{ result:"federal", note:"VA exemptions limited to residents — federal §522(d) applies under savings clause." },
    Washington:{ result:"state_or_federal", note:"WA has not opted out — debtor may choose WA state or federal §522(d) exemptions." },
    "West Virginia":{ result:"state_or_federal", note:"WV has not opted out — debtor may choose WV state or federal §522(d) exemptions." },
    Wisconsin:{ result:"federal", note:"WI exemptions limited to residents — federal §522(d) applies." },
    Wyoming:{ result:"federal", note:"WY exemptions limited to residents — federal §522(d) applies under savings clause." },
  };

  if (state.trim() === "") {
    domicileIssues.push("State not provided — domicile cannot be confirmed");
  } else {
    const residencyNote = addressYears
      ? `${addressYears} at current address`
      : "length of residency not provided";
    domicileIssues.push(`Domicile: ${(fd.city as string) ?? ""}, ${state} ${(fd.zip as string) ?? ""} — ${residencyNote}`);

    const inState730 = addressYears === "2+ years";
    if (inState730) {
      domicileIssues.push(`Residency 2+ years — ${state} state exemptions apply (11 U.S.C. § 522(b)(3)(A))`);
    } else if (addressYears === "Less than 91 days" || addressYears === "91 days – 6 months" || addressYears === "6 months – 2 years") {
      if (!priorDomicileState) {
        domicileIssues.push(`Residency ${addressYears} — prior domicile state not entered; exemption set cannot be determined`);
      } else if (priorDomicileState === state) {
        domicileIssues.push(`Residency ${addressYears} — prior domicile also ${state}; ${state} state exemptions apply`);
      } else {
        const rule = NON_RESIDENT_RULES[priorDomicileState];
        if (rule) {
          domicileIssues.push(`Prior domicile: ${priorDomicileState} (${addressYears} at current address) — ${rule.note}`);
        } else {
          domicileIssues.push(`Prior domicile: ${priorDomicileState} — exemption data not available; confirm applicable exemption set`);
        }
      }
    } else if (!addressYears) {
      domicileIssues.push("Length of residency not provided — cannot determine applicable exemption set");
    }
  }

  const assetStateExemptions = getApplicableExemptions((fd.state as string) ?? "TX");
  const assetHomestead = assetStateExemptions.homestead === 'unlimited' || assetStateExemptions.homestead === -1 ? Infinity : assetStateExemptions.homestead;
  const assetVehicleExemption = assetStateExemptions.vehicle;

  properties.forEach((p, i) => {
    const fmv = parseFloat((p.propertyValue as string) ?? "0") || 0;
    const mortgage = parseFloat((p.loanBalance as string) ?? "0") || 0;
    const equity = fmv - mortgage;
    if (equity > assetHomestead) {
      const stateLabel = assetStateExemptions.homesteadNote ? `${assetStateExemptions.state} homestead: ${fmt(assetHomestead)}` : `${assetStateExemptions.state} exemption: ${fmt(assetHomestead)}`;
      assetIssues.push(`Property ${i + 1} equity ${fmt(equity)} — est. non-exempt ${fmt(equity - assetHomestead)} (${stateLabel})`);
    } else if (equity > 0) {
      assetIssues.push(`Property ${i + 1}: ${fmt(equity)} equity — within ${assetStateExemptions.state} exemption range`);
    }
  });

  vehicles.forEach(v => {
    const val = parseFloat((v.value as string) ?? "0") || 0;
    const lien = parseFloat((v.loanBalance as string) ?? "0") || 0;
    const equity = val - lien;
    if (equity > assetVehicleExemption) {
      assetIssues.push(`${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""}: ${fmt(equity)} equity — est. non-exempt ${fmt(equity - assetVehicleExemption)} above ${assetStateExemptions.state} ${fmt(assetVehicleExemption)} vehicle exemption`);
    }
  });

  if (fd.additionalNotes) {
    sofaIssues.push(`Client notes present — review for SOFA disclosures: "${String(fd.additionalNotes).slice(0, 120)}${String(fd.additionalNotes).length > 120 ? "..." : ""}"`);
  }

  if (fd.yearsEmployed && parseInt(fd.yearsEmployed as string) < 2) {
    sofaIssues.push(`Employment < 2 years — SOFA income history (last 2 yrs) requires prior employer verification`);
  }

  if (totalMortgageArrears > 0) {
    sofaIssues.push(`Mortgage arrears ${fmt(totalMortgageArrears)} — SOFA Q6 payment history within 90 days must be reviewed for preference exposure`);
  }

  const incomeFlagAreas: string[] = [];
  const assetFlagAreas: string[] = [];
  const debtFlagAreas: string[] = [];
  const sofaFlagAreas: string[] = [];

  if (overMedian) incomeFlagAreas.push("Income above median — means test required");
  if (dmi < 100) incomeFlagAreas.push("Low DMI — plan feasibility concern");
  if (assetIssues.length > 0) assetFlagAreas.push(...assetIssues.map(() => "Non-exempt equity detected"));
  if (totalMortgageArrears > 0) debtFlagAreas.push("Mortgage arrears present");
  if (hasPrior) sofaFlagAreas.push("Prior bankruptcy on record");

  const reviewFlags: { label: string; area: string; color: string }[] = [
    ...incomeFlagAreas.map(f => ({ label: f, area: "Income", color: "text-amber-300 bg-amber-500/10 border-amber-500/30" })),
    ...assetFlagAreas.map(f => ({ label: f, area: "Asset Equity", color: "text-red-300 bg-red-500/10 border-red-500/30" })),
    ...debtFlagAreas.map(f => ({ label: f, area: "Debt Concern", color: "text-orange-300 bg-orange-500/10 border-orange-500/30" })),
    ...sofaFlagAreas.map(f => ({ label: f, area: "SOFA Answer", color: "text-rose-300 bg-rose-500/10 border-rose-500/30" })),
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-4">

        {/* ── DEBTOR ASSETS & EXEMPT PROPERTY (SCHEDULE A/B/C) ── */}
        <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <Package size={15} className="text-blue-400" />
              <div>
                <span className="text-sm font-bold text-white">Debtor Assets &amp; Exempt Property</span>
                <span className="text-[10px] text-slate-500 font-normal ml-2">(Schedule A/B/C)</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {totalNonExemptEquity > 0 && (
                <div className="flex items-center gap-1.5 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5 text-red-300">
                  <AlertTriangle size={11} className="flex-shrink-0" />
                  <span className="font-semibold">Debtor's Non-Exempt Equity: {fmt(totalNonExemptEquity)}</span>
                </div>
              )}
              {totalNonExemptEquity === 0 && (
                <div className="flex items-center gap-1.5 text-xs bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-1.5 text-green-300">
                  <CheckCircle size={11} />
                  <span>All assets within exemption limits</span>
                </div>
              )}
              <ExemptionQuickView
                key={`${filingState}-${isJointFiling}-${properties.length}-${vehicles.length}-${totalRetirement}-${totalBankBalance}`}
                stateEx={filingState === "WA" && waHomestead?.eligible ? { ...stateEx, homestead: waHomestead.amount, homesteadNote: `${waHomestead.county} County — RCW §§6.13.010–6.13.030` } : stateEx}
                filingState={filingState}
                isJointFiling={isJointFiling}
                hasRealProperty={properties.length > 0}
                hasVehicles={vehicles.length > 0}
                hasRetirement={totalRetirement > 0}
                hasBankAccounts={totalBankBalance > 0}
                wildcardTotal={wildcardTotal}
                isTxAggregate={isTxAggregateState}
                assetRows={buildAssetRows(
                  filingState === "WA" && waHomestead?.eligible ? { ...stateEx, homestead: waHomestead.amount, homesteadNote: `${waHomestead.county} County — RCW §§6.13.010–6.13.030` } : stateEx,
                  filingState,
                  isJointFiling,
                  properties,
                  vehicles,
                  bankAccounts,
                  retirementAccounts,
                  lifePolicies,
                  annuities,
                  businessAssets,
                  {
                    householdGoods: householdGoodsValue,
                    electronics: electronicsValue,
                    jewelry: jewelryValue,
                    tools: toolsValue,
                    stocks: stocksValue,
                    stocksDesc: fd.stocksDesc as string | undefined,
                    crypto: cryptoValue,
                    cryptoDesc: fd.cryptoDesc as string | undefined,
                    firearms: firearmsValue,
                    firearmsCount: firearms.length,
                    collectibles: collectiblesValue,
                    collectiblesDesc: fd.collectiblesDesc as string | undefined,
                    otherProp: otherPersonalPropValue,
                    otherPropDesc: fd.otherPersonalPropDesc as string | undefined,
                    moneyOwed: moneyOwedAmt,
                    moneyOwedDesc: fd.moneyOwedDesc as string | undefined,
                    pendingClaims: pendingClaimsValue,
                    pendingClaimsDesc: fd.pendingClaimsDesc as string | undefined,
                  },
                  propExemptionPerUnit,
                  wildcardTotal,
                  isTxAggregateState,
                )}
              />
            </div>
          </div>
          <div className="px-5 py-4 space-y-5">

            {/* JURISDICTION & APPLIED EXEMPTIONS */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin size={12} className="text-blue-400" />
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Jurisdiction &amp; Applied Exemptions</p>
              </div>

              {/* Domicile / Residency Info — shown immediately below title */}
              {domicileIssues.length > 0 && (
                <div className="space-y-1.5">
                  {domicileIssues.map((issue, i) => (
                    <div key={i} className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg border ${issue.toLowerCase().includes("not provided") || issue.toLowerCase().includes("cannot") ? "bg-red-500/8 border-red-500/25 text-red-200" : "bg-blue-500/8 border-blue-500/25 text-blue-200"}`}>
                      <AlertCircle size={11} className="flex-shrink-0 mt-0.5 text-blue-400" />
                      <span className="leading-relaxed">{issue}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Debtor location row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-2">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mb-0.5">State</p>
                  <p className="text-xs font-bold text-white">{stateEx.state}</p>
                </div>
                <div className="bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-2">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mb-0.5">County</p>
                  <p className="text-xs font-bold text-white">{county && county !== "—" ? county : <span className="text-red-400 text-[10px]">Not provided</span>}</p>
                </div>
                <div className="bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-2">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mb-0.5">Filing Type</p>
                  <p className="text-xs font-bold text-white capitalize">{isJointFiling ? "Joint" : "Individual"}</p>
                </div>
              </div>

              {/* Applied exemptions grid */}
              <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-700/40 flex items-center gap-1.5 flex-wrap">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Exemptions Auto-Applied — {stateEx.state}
                    {filingState === "CA" && (
                      <span className="ml-1 text-blue-400">
                        {hasRealPropertyForExemptions ? "(System 704 — Homeowner)" : "(System 703 — Non-homeowner)"}
                      </span>
                    )}
                  </p>
                </div>
                <div className="divide-y divide-slate-700/25">
                  {properties.length > 0 && (
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Home size={10} className="text-amber-400 flex-shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-300">
                            Homestead — primary residence only
                            {filingState === "CA" && isJointFiling ? <span className="text-orange-400 ml-1">(not doubled for joint)</span> : ""}
                          </span>
                          {filingState === "CA" && hasRealPropertyForExemptions && (
                            <span className="text-[9px] text-slate-500">
                              {caCounty ? `${caCounty.replace(/\s+county$/i, '')} County · CCP §704.730` : "County not set — using floor $371,547"}
                            </span>
                          )}
                          {filingState === "WA" && waHomestead && (
                            <span className="text-[9px] text-slate-500">
                              {waHomestead.eligible
                                ? `${waHomestead.county} County · RCW §§6.13.010–6.13.030 · ${waHomestead.daysOwned?.toLocaleString()} days owned`
                                : waHomestead.county
                                ? `${waHomestead.county} County · Not yet eligible (${waHomestead.daysOwned ?? 0} / 1,215 days)`
                                : "County not set — eligibility pending"}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-amber-300">
                        {propExemptionPerUnit === Infinity ? "Unlimited" : fmt(propExemptionPerUnit)}
                      </span>
                    </div>
                  )}
                  {vehicles.length > 0 && (
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Car size={10} className="text-blue-400 flex-shrink-0" />
                        <span className="text-[11px] text-slate-300">
                          {isTxAggregateState ? "Motor Vehicle (TX aggregate pool)" : `Motor Vehicle (per vehicle)`}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-blue-300">
                        {isTxAggregateState
                          ? (isJointFiling ? "$200,000 pool" : "$100,000 pool")
                          : (vehExemptionPerUnit === 0 ? "None" : `${fmt(vehExemptionPerUnit)}/vehicle`)}
                      </span>
                    </div>
                  )}
                  {totalBankBalance > 0 && stateEx.bankAccount > 0 && (
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <DollarSign size={10} className="text-sky-400 flex-shrink-0" />
                        <span className="text-[11px] text-slate-300">Bank Account / Deposits</span>
                      </div>
                      <span className="text-[11px] font-bold text-sky-300">
                        {fmt(stateEx.bankAccount)}
                        {stateEx.bankAccountNote && <span className="text-[9px] font-normal text-slate-500 ml-1">· {stateEx.bankAccountNote.split(';')[0]}</span>}
                      </span>
                    </div>
                  )}
                  {totalRetirement > 0 && (
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <CreditCard size={10} className="text-violet-400 flex-shrink-0" />
                        <span className="text-[11px] text-slate-300">Retirement Accounts (ERISA / IRA)</span>
                      </div>
                      <span className="text-[11px] font-bold text-violet-300">Fully Exempt</span>
                    </div>
                  )}
                  {!isTxAggregateState && (
                    <>
                      {householdGoodsValue > 0 && (
                        <div className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Package size={10} className="text-emerald-400 flex-shrink-0" />
                            <span className="text-[11px] text-slate-300">Household Goods</span>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-300">{fmt(stateEx.householdGoods)}</span>
                        </div>
                      )}
                      {jewelryValue > 0 && (
                        <div className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Gem size={10} className="text-pink-400 flex-shrink-0" />
                            <span className="text-[11px] text-slate-300">Jewelry</span>
                          </div>
                          <span className="text-[11px] font-bold text-pink-300">{fmt(stateEx.jewelry)}</span>
                        </div>
                      )}
                      {toolsValue > 0 && (
                        <div className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Briefcase size={10} className="text-cyan-400 flex-shrink-0" />
                            <span className="text-[11px] text-slate-300">Tools of Trade</span>
                          </div>
                          <span className="text-[11px] font-bold text-cyan-300">{fmt(stateEx.tools)}</span>
                        </div>
                      )}
                    </>
                  )}
                  {isTxAggregateState && (
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Package size={10} className="text-emerald-400 flex-shrink-0" />
                        <span className="text-[11px] text-slate-300">Personal Property Aggregate Pool (vehicles, goods, tools, jewelry, firearms)</span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-300">
                        {isJointFiling ? "$200,000" : "$100,000"}
                        <span className="text-[9px] font-normal text-slate-500 ml-1">· Tex. Prop. Code §42.001</span>
                      </span>
                    </div>
                  )}
                  {stateEx.wildcard > 0 && (
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Shield size={10} className="text-slate-400 flex-shrink-0" />
                        <span className="text-[11px] text-slate-300">Wildcard</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-300">
                        {fmt(stateEx.wildcard)}
                        {stateEx.wildcardNote && <span className="text-[9px] font-normal text-slate-500 ml-1">· {stateEx.wildcardNote.split(';')[0]}</span>}
                      </span>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* REAL PROPERTY */}
            {properties.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Home size={12} className="text-amber-400" />
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Real Property</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700/60">
                        <th className="text-left py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Description</th>
                        <th className="text-right py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Value (FMV)</th>
                        <th className="text-right py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Liens / Encumbrances</th>
                        <th className="text-right py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Equity</th>
                        <th className="text-right py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Exemption</th>
                        <th className="text-right py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Non-Exempt Equity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {properties.map((p, i) => {
                        const fmv = parseFloat((p.propertyValue as string) ?? "0") || 0;
                        const lien = parseFloat((p.loanBalance as string) ?? "0") || 0;
                        const equity = fmv - lien;
                        const exemption = (i === 0 && equity > 0) ? Math.min(equity, propExemptionPerUnit) : 0;
                        const nonExempt = Math.max(0, equity - exemption);
                        const desc = (p.address as string) || (p.propertyType as string) || `Property ${i + 1}`;
                        const isPrimary = i === 0;
                        return (
                          <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                            <td className="py-2.5 px-2 text-slate-300">
                              {desc}
                              {isPrimary && <span className="text-[9px] text-blue-400 ml-1.5 border border-blue-400/30 rounded px-1 py-0.5">Primary</span>}
                              {!isPrimary && <span className="text-[9px] text-slate-500 ml-1.5 border border-slate-600/40 rounded px-1 py-0.5">No Homestead</span>}
                              {(p.lenderName as string) && <span className="text-slate-500 ml-1">· {p.lenderName as string}</span>}
                            </td>
                            <td className="py-2.5 px-2 text-right text-white font-semibold">{fmv > 0 ? fmt(fmv) : "—"}</td>
                            <td className="py-2.5 px-2 text-right text-red-300">{lien > 0 ? fmt(lien) : "—"}</td>
                            <td className={`py-2.5 px-2 text-right font-semibold ${equity < 0 ? "text-slate-500" : equity > 0 ? "text-blue-300" : "text-slate-400"}`}>{fmt(equity)}</td>
                            <td className="py-2.5 px-2 text-right text-green-400">{exemption > 0 ? fmt(exemption) : "—"}</td>
                            <td className={`py-2.5 px-2 text-right font-bold ${nonExempt > 0 ? "text-red-400" : equity > 0 ? "text-green-400" : "text-slate-500"}`}>
                              {equity <= 0 ? "—" : nonExempt > 0 ? fmt(nonExempt) : <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-600/60 bg-slate-800/20">
                        <td className="py-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Real Property Total</td>
                        <td className="py-2 px-2 text-right text-white font-bold text-xs">{fmt(totalPropertyFMV)}</td>
                        <td className="py-2 px-2 text-right text-red-300 font-bold text-xs">{fmt(properties.reduce((a, p) => a + (parseFloat((p.loanBalance as string) ?? "0") || 0), 0))}</td>
                        <td className="py-2 px-2 text-right text-blue-300 font-bold text-xs">{fmt(totalPropertyEquity)}</td>
                        <td className="py-2 px-2 text-right text-green-400 font-bold text-xs">{fmt(totalPropExemption)}</td>
                        <td className={`py-2 px-2 text-right font-bold text-xs ${totalPropNonExemptEquity > 0 ? "text-red-400" : "text-green-400"}`}>{totalPropNonExemptEquity > 0 ? fmt(totalPropNonExemptEquity) : <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* PERSONAL PROPERTY */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Briefcase size={12} className="text-sky-400" />
                <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">Personal Property</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700/60">
                      <th className="text-left py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Category</th>
                      <th className="text-right py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Value</th>
                      <th className="text-right py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Liens</th>
                      <th className="text-right py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Net Equity</th>
                      <th className="text-right py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Exemption</th>
                      <th className="text-right py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Non-Exempt Equity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Vehicles */}
                    {vehicles.map((v, i) => {
                      const val = parseFloat((v.value as string) ?? "0") || 0;
                      const lien = parseFloat((v.loanBalance as string) ?? "0") || 0;
                      const equity = val - lien;
                      const exemption = equity > 0 ? Math.min(equity, vehExemptionPerUnit) : 0;
                      const nonExempt = Math.max(0, equity - exemption);
                      const label = [v.year, v.make, v.model].filter(Boolean).join(" ") || `Vehicle ${i + 1}`;
                      return (
                        <tr key={`veh-${i}`} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                          <td className="py-2 px-2 text-slate-300">{label}</td>
                          <td className="py-2 px-2 text-right text-white font-semibold">{val > 0 ? fmt(val) : "—"}</td>
                          <td className="py-2 px-2 text-right text-red-300">{lien > 0 ? fmt(lien) : "—"}</td>
                          <td className={`py-2 px-2 text-right font-semibold ${equity > 0 ? "text-blue-300" : "text-slate-500"}`}>{equity !== 0 ? fmt(equity) : "—"}</td>
                          <td className="py-2 px-2 text-right text-green-400">{exemption > 0 ? fmt(exemption) : "—"}</td>
                          <td className={`py-2 px-2 text-right font-bold text-[11px] ${nonExempt > 0 ? "text-red-400" : equity > 0 ? "text-green-400" : "text-slate-500"}`}>
                            {equity <= 0 ? "—" : nonExempt > 0 ? fmt(nonExempt) : <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Bank Accounts — wildcard spread proportionally */}
                    {bankAccounts.map((b, i) => {
                      const bal = parseFloat((b.balance as string) ?? "0") || 0;
                      const proportion = totalBankBalance > 0 ? bal / totalBankBalance : 0;
                      const acctExemption = Math.min(bal, bankExemption * proportion);
                      const acctNonExempt = Math.max(0, bal - acctExemption);
                      return (
                        <tr key={`bank-${i}`} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                          <td className="py-2 px-2 text-slate-300">{(b.bankName as string) || "Bank"} — {(b.accountType as string) || "Account"}</td>
                          <td className="py-2 px-2 text-right text-white font-semibold">{bal > 0 ? fmt(bal) : "—"}</td>
                          <td className="py-2 px-2 text-right text-slate-500">—</td>
                          <td className="py-2 px-2 text-right text-blue-300">{bal > 0 ? fmt(bal) : "—"}</td>
                          <td className="py-2 px-2 text-right text-green-400">{acctExemption > 0 ? fmt(acctExemption) : "—"}</td>
                          <td className={`py-2 px-2 text-right font-bold text-[11px] ${acctNonExempt > 0 ? "text-red-400" : "text-green-400"}`}>
                            {acctNonExempt > 0 ? fmt(acctNonExempt) : <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Household Goods */}
                    {householdGoodsValue > 0 && (
                      <tr className="border-b border-slate-700/30 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-300">Household Goods &amp; Furnishings</td>
                        <td className="py-2 px-2 text-right text-white font-semibold">{fmt(householdGoodsValue)}</td>
                        <td className="py-2 px-2 text-right text-slate-500">—</td>
                        <td className="py-2 px-2 text-right text-blue-300">{fmt(householdGoodsValue)}</td>
                        <td className="py-2 px-2 text-right text-green-400">{fmt(hhGoodsExemption)}</td>
                        <td className="py-2 px-2 text-right font-bold text-[11px] text-green-400">
                          <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>
                        </td>
                      </tr>
                    )}
                    {electronicsValue > 0 && (
                      <tr className="border-b border-slate-700/30 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-300">Electronics</td>
                        <td className="py-2 px-2 text-right text-white font-semibold">{fmt(electronicsValue)}</td>
                        <td className="py-2 px-2 text-right text-slate-500">—</td>
                        <td className="py-2 px-2 text-right text-blue-300">{fmt(electronicsValue)}</td>
                        <td className="py-2 px-2 text-right text-green-400">{fmt(electronicsExemption)}</td>
                        <td className="py-2 px-2 text-right font-bold text-[11px] text-green-400">
                          <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>
                        </td>
                      </tr>
                    )}
                    {jewelryValue > 0 && (
                      <tr className="border-b border-slate-700/30 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-300">Jewelry</td>
                        <td className="py-2 px-2 text-right text-white font-semibold">{fmt(jewelryValue)}</td>
                        <td className="py-2 px-2 text-right text-slate-500">—</td>
                        <td className="py-2 px-2 text-right text-blue-300">{fmt(jewelryValue)}</td>
                        <td className="py-2 px-2 text-right text-green-400">{fmt(jewelryExemption)}</td>
                        <td className="py-2 px-2 text-right font-bold text-[11px] text-green-400">
                          <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>
                        </td>
                      </tr>
                    )}
                    {toolsValue > 0 && (
                      <tr className="border-b border-slate-700/30 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-300">Tools of Trade</td>
                        <td className="py-2 px-2 text-right text-white font-semibold">{fmt(toolsValue)}</td>
                        <td className="py-2 px-2 text-right text-slate-500">—</td>
                        <td className="py-2 px-2 text-right text-blue-300">{fmt(toolsValue)}</td>
                        <td className="py-2 px-2 text-right text-green-400">{fmt(toolsExemption)}</td>
                        <td className="py-2 px-2 text-right font-bold text-[11px] text-green-400">
                          <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>
                        </td>
                      </tr>
                    )}
                    {stocksValue > 0 && (
                      <tr className="border-b border-slate-700/30 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-300">Stocks &amp; Brokerage{(fd.stocksDesc as string) && <span className="text-slate-500 ml-1">· {fd.stocksDesc as string}</span>}</td>
                        <td className="py-2 px-2 text-right text-white font-semibold">{fmt(stocksValue)}</td>
                        <td className="py-2 px-2 text-right text-slate-500">—</td>
                        <td className="py-2 px-2 text-right text-blue-300">{fmt(stocksValue)}</td>
                        <td className="py-2 px-2 text-right text-green-400">{stocksExemption > 0 ? fmt(stocksExemption) : "—"}</td>
                        <td className={`py-2 px-2 text-right font-bold text-[11px] ${stocksNonExempt > 0 ? "text-red-400" : "text-green-400"}`}>
                          {stocksNonExempt > 0 ? fmt(stocksNonExempt) : <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>}
                        </td>
                      </tr>
                    )}
                    {cryptoValue > 0 && (
                      <tr className="border-b border-slate-700/30 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-300">Cryptocurrency{(fd.cryptoDesc as string) && <span className="text-slate-500 ml-1">· {fd.cryptoDesc as string}</span>}</td>
                        <td className="py-2 px-2 text-right text-white font-semibold">{fmt(cryptoValue)}</td>
                        <td className="py-2 px-2 text-right text-slate-500">—</td>
                        <td className="py-2 px-2 text-right text-blue-300">{fmt(cryptoValue)}</td>
                        <td className="py-2 px-2 text-right text-green-400">{cryptoExemption > 0 ? fmt(cryptoExemption) : "—"}</td>
                        <td className={`py-2 px-2 text-right font-bold text-[11px] ${cryptoNonExempt > 0 ? "text-red-400" : "text-green-400"}`}>
                          {cryptoNonExempt > 0 ? fmt(cryptoNonExempt) : <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>}
                        </td>
                      </tr>
                    )}
                    {firearmsValue > 0 && (
                      <tr className="border-b border-slate-700/30 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-300">Firearms ({firearms.length})</td>
                        <td className="py-2 px-2 text-right text-white font-semibold">{fmt(firearmsValue)}</td>
                        <td className="py-2 px-2 text-right text-slate-500">—</td>
                        <td className="py-2 px-2 text-right text-blue-300">{fmt(firearmsValue)}</td>
                        <td className="py-2 px-2 text-right text-green-400">{fmt(firearmsExemption)}</td>
                        <td className="py-2 px-2 text-right font-bold text-[11px] text-green-400">
                          <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>
                        </td>
                      </tr>
                    )}
                    {collectiblesValue > 0 && (
                      <tr className="border-b border-slate-700/30 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-300">Collectibles &amp; Valuables{(fd.collectiblesDesc as string) && <span className="text-slate-500 ml-1">· {fd.collectiblesDesc as string}</span>}</td>
                        <td className="py-2 px-2 text-right text-white font-semibold">{fmt(collectiblesValue)}</td>
                        <td className="py-2 px-2 text-right text-slate-500">—</td>
                        <td className="py-2 px-2 text-right text-blue-300">{fmt(collectiblesValue)}</td>
                        <td className="py-2 px-2 text-right text-green-400">{collectiblesExemption > 0 ? fmt(collectiblesExemption) : "—"}</td>
                        <td className={`py-2 px-2 text-right font-bold text-[11px] ${collectiblesNonExempt > 0 ? "text-red-400" : "text-green-400"}`}>
                          {collectiblesNonExempt > 0 ? fmt(collectiblesNonExempt) : <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>}
                        </td>
                      </tr>
                    )}
                    {otherPersonalPropValue > 0 && (
                      <tr className="border-b border-slate-700/30 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-300">Other Personal Property{(fd.otherPersonalPropDesc as string) && <span className="text-slate-500 ml-1">· {fd.otherPersonalPropDesc as string}</span>}</td>
                        <td className="py-2 px-2 text-right text-white font-semibold">{fmt(otherPersonalPropValue)}</td>
                        <td className="py-2 px-2 text-right text-slate-500">—</td>
                        <td className="py-2 px-2 text-right text-blue-300">{fmt(otherPersonalPropValue)}</td>
                        <td className="py-2 px-2 text-right text-green-400">{otherPropExemption > 0 ? fmt(otherPropExemption) : "—"}</td>
                        <td className={`py-2 px-2 text-right font-bold text-[11px] ${otherPropNonExempt > 0 ? "text-red-400" : "text-green-400"}`}>
                          {otherPropNonExempt > 0 ? fmt(otherPropNonExempt) : <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>}
                        </td>
                      </tr>
                    )}
                    {moneyOwedAmt > 0 && (
                      <tr className="border-b border-slate-700/30 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-300">Money Owed to Debtor{(fd.moneyOwedDesc as string) && <span className="text-slate-500 ml-1">· {fd.moneyOwedDesc as string}</span>}</td>
                        <td className="py-2 px-2 text-right text-white font-semibold">{fmt(moneyOwedAmt)}</td>
                        <td className="py-2 px-2 text-right text-slate-500">—</td>
                        <td className="py-2 px-2 text-right text-blue-300">{fmt(moneyOwedAmt)}</td>
                        <td className="py-2 px-2 text-right text-green-400">{moneyOwedExemption > 0 ? fmt(moneyOwedExemption) : "—"}</td>
                        <td className={`py-2 px-2 text-right font-bold text-[11px] ${moneyOwedNonExempt > 0 ? "text-red-400" : "text-green-400"}`}>
                          {moneyOwedNonExempt > 0 ? fmt(moneyOwedNonExempt) : <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>}
                        </td>
                      </tr>
                    )}
                    {pendingClaimsValue > 0 && (
                      <tr className="border-b border-slate-700/30 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-300">Pending Claims / Lawsuits{(fd.pendingClaimsDesc as string) && <span className="text-slate-500 ml-1">· {fd.pendingClaimsDesc as string}</span>}</td>
                        <td className="py-2 px-2 text-right text-white font-semibold">{fmt(pendingClaimsValue)}</td>
                        <td className="py-2 px-2 text-right text-slate-500">—</td>
                        <td className="py-2 px-2 text-right text-blue-300">{fmt(pendingClaimsValue)}</td>
                        <td className="py-2 px-2 text-right text-slate-500 text-[10px]">—</td>
                        <td className="py-2 px-2 text-right">
                          <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/25 rounded px-1.5 py-0.5">NON-EXEMPT</span>
                        </td>
                      </tr>
                    )}
                    {/* Retirement & Life Insurance — exempt but shown for completeness */}
                    {totalRetirement > 0 && (
                      <tr className="border-b border-slate-700/30 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-300">Retirement Accounts</td>
                        <td className="py-2 px-2 text-right text-white font-semibold">{fmt(totalRetirement)}</td>
                        <td className="py-2 px-2 text-right text-slate-500">—</td>
                        <td className="py-2 px-2 text-right text-blue-300">{fmt(totalRetirement)}</td>
                        <td className="py-2 px-2 text-right text-green-400">{fmt(totalRetirement)}</td>
                        <td className="py-2 px-2 text-right font-bold text-[11px] text-green-400">
                          <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>
                        </td>
                      </tr>
                    )}
                    {totalLifeCV > 0 && (
                      <tr className="border-b border-slate-700/30 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-300">Life Insurance Cash Value</td>
                        <td className="py-2 px-2 text-right text-white font-semibold">{fmt(totalLifeCV)}</td>
                        <td className="py-2 px-2 text-right text-slate-500">—</td>
                        <td className="py-2 px-2 text-right text-blue-300">{fmt(totalLifeCV)}</td>
                        <td className="py-2 px-2 text-right text-green-400">{fmt(totalLifeCV)}</td>
                        <td className="py-2 px-2 text-right font-bold text-[11px] text-green-400">
                          <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>
                        </td>
                      </tr>
                    )}
                    {totalAnnuities > 0 && (
                      <tr className="border-b border-slate-700/30 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-300">Annuities</td>
                        <td className="py-2 px-2 text-right text-white font-semibold">{fmt(totalAnnuities)}</td>
                        <td className="py-2 px-2 text-right text-slate-500">—</td>
                        <td className="py-2 px-2 text-right text-blue-300">{fmt(totalAnnuities)}</td>
                        <td className="py-2 px-2 text-right text-green-400">{fmt(totalAnnuities)}</td>
                        <td className="py-2 px-2 text-right font-bold text-[11px] text-green-400">
                          <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>
                        </td>
                      </tr>
                    )}
                    {personalPropSubtotal === 0 && vehicles.length === 0 && totalRetirement === 0 && totalLifeCV === 0 && totalAnnuities === 0 && (
                      <tr><td colSpan={6} className="py-3 px-2 text-xs text-slate-500 text-center">No personal property reported</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-600/60 bg-slate-800/20">
                      <td className="py-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Personal Property Total</td>
                      <td className="py-2 px-2 text-right text-white font-bold text-xs">{fmt(totalVehicleFMV + totalBankBalance + personalPropSubtotal + totalRetirement + totalLifeCV + totalAnnuities)}</td>
                      <td className="py-2 px-2 text-right text-red-300 font-bold text-xs">{totalVehicleLiens > 0 ? fmt(totalVehicleLiens) : "—"}</td>
                      <td className={`py-2 px-2 text-right font-bold text-xs ${totalVehNonExemptEquity > 0 || personalPropNonExempt > 0 ? "text-red-400" : "text-blue-300"}`}>
                        {fmt(totalVehicleEquity + totalBankBalance + personalPropSubtotal)}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-500 text-[10px]">—</td>
                      <td className={`py-2 px-2 text-right font-bold text-xs ${totalVehNonExemptEquity > 0 || personalPropNonExempt > 0 ? "text-red-400" : "text-green-400"}`}>
                        {totalVehNonExemptEquity > 0 || personalPropNonExempt > 0 ? fmt(totalVehNonExemptEquity + personalPropNonExempt) : <span className="flex items-center justify-end gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Exempt</span>}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* BUSINESS ASSETS */}
            {businessAssets.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Building size={12} className="text-orange-400" />
                  <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Business Assets</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700/60">
                        <th className="text-left py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Asset</th>
                        <th className="text-right py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Value</th>
                        <th className="text-right py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Liens / Owed</th>
                        <th className="text-right py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Net Equity</th>
                        <th className="text-right py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Exemption</th>
                        <th className="text-right py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Non-Exempt Equity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {businessAssets.map((b, i) => {
                        const val = parseFloat((b.estimatedValue as string) ?? "0") || 0;
                        const owed = parseFloat((b.owedOnIt as string) ?? "0") || 0;
                        const equity = Math.max(0, val - owed);
                        const desc = (b.description as string) || (b.assetType as string) || `Asset ${i + 1}`;
                        return (
                          <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                            <td className="py-2 px-2 text-slate-300">{desc}{(b.lienHolder as string) && <span className="text-slate-500 ml-1">· {b.lienHolder as string}</span>}</td>
                            <td className="py-2 px-2 text-right text-white font-semibold">{val > 0 ? fmt(val) : "—"}</td>
                            <td className="py-2 px-2 text-right text-red-300">{owed > 0 ? fmt(owed) : "—"}</td>
                            <td className={`py-2 px-2 text-right font-semibold ${equity > 0 ? "text-blue-300" : "text-slate-500"}`}>{equity > 0 ? fmt(equity) : "—"}</td>
                            <td className="py-2 px-2 text-right text-slate-500 text-[10px]">—</td>
                            <td className={`py-2 px-2 text-right font-bold text-[11px] ${equity > 0 ? "text-red-400" : "text-slate-500"}`}>{equity > 0 ? fmt(equity) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-600/60 bg-slate-800/20">
                        <td className="py-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Business Assets Total</td>
                        <td className="py-2 px-2 text-right text-white font-bold text-xs">{fmt(totalBusinessAssetValue)}</td>
                        <td className="py-2 px-2 text-right text-red-300 font-bold text-xs">{totalBusinessAssetLiens > 0 ? fmt(totalBusinessAssetLiens) : "—"}</td>
                        <td className="py-2 px-2 text-right text-blue-300 font-bold text-xs">{totalBusinessEquity > 0 ? fmt(totalBusinessEquity) : "—"}</td>
                        <td className="py-2 px-2 text-right text-slate-500 text-[10px]">—</td>
                        <td className={`py-2 px-2 text-right font-bold text-xs ${totalBusinessEquity > 0 ? "text-red-400" : "text-slate-500"}`}>{totalBusinessEquity > 0 ? fmt(totalBusinessEquity) : "—"}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* TOTAL NON-EXEMPT EQUITY SUMMARY */}
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Total Non-Exempt Equity Summary</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs mb-3">
                {properties.length > 0 && (
                  <>
                    <span className="text-slate-400">Real Property Equity</span>
                    <span className="text-right text-white font-semibold">{fmt(totalPropertyEquity)}</span>
                    <span className="text-slate-400 pl-3">Less: Homestead Exemption ({filingState}{propExemptionPerUnit === Infinity ? " — Unlimited" : ` — ${fmt(propExemptionPerUnit)}`})</span>
                    <span className="text-right text-green-400">({fmt(totalPropExemption)})</span>
                    <span className="text-slate-400 pl-3 font-semibold">Non-Exempt Real Property</span>
                    <span className={`text-right font-bold ${totalPropNonExemptEquity > 0 ? "text-red-400" : "text-green-400"}`}>{totalPropNonExemptEquity > 0 ? fmt(totalPropNonExemptEquity) : "$0"}</span>
                  </>
                )}
                {vehicles.length > 0 && (
                  <>
                    <span className="text-slate-400">Vehicle Equity</span>
                    <span className="text-right text-white font-semibold">{fmt(totalVehicleEquity)}</span>
                    <span className="text-slate-400 pl-3">Less: Vehicle Exemption ({filingState} — {fmt(vehExemptionPerUnit)}/vehicle)</span>
                    <span className="text-right text-green-400">({fmt(totalVehExemption)})</span>
                    <span className="text-slate-400 pl-3 font-semibold">Non-Exempt Vehicle Equity</span>
                    <span className={`text-right font-bold ${totalVehNonExemptEquity > 0 ? "text-red-400" : "text-green-400"}`}>{totalVehNonExemptEquity > 0 ? fmt(totalVehNonExemptEquity) : "$0"}</span>
                  </>
                )}
                {personalPropSubtotal > 0 && (
                  <>
                    <span className="text-slate-400">Personal Property</span>
                    <span className="text-right text-white font-semibold">{fmt(personalPropSubtotal)}</span>
                    <span className="text-slate-400 pl-3">Less: Personal Property Exemption ({filingState})</span>
                    <span className="text-right text-green-400">({fmt(Math.min(personalPropSubtotal, personalPropExemption))})</span>
                    <span className="text-slate-400 pl-3 font-semibold">Non-Exempt Personal Property</span>
                    <span className={`text-right font-bold ${personalPropNonExempt > 0 ? "text-red-400" : "text-green-400"}`}>{personalPropNonExempt > 0 ? fmt(personalPropNonExempt) : "$0"}</span>
                  </>
                )}
                {businessAssets.length > 0 && (
                  <>
                    <span className="text-slate-400 font-semibold">Business Asset Equity</span>
                    <span className={`text-right font-bold ${totalBusinessEquity > 0 ? "text-orange-300" : "text-slate-500"}`}>{totalBusinessEquity > 0 ? fmt(totalBusinessEquity) : "$0"}</span>
                  </>
                )}
              </div>
              <div className="border-t border-slate-600/60 pt-2 flex justify-between items-center">
                <span className="text-xs font-bold text-white uppercase tracking-wide">Debtor's Non-Exempt Equity</span>
                <span className={`text-base font-bold ${totalNonExemptEquity > 0 ? "text-red-400" : "text-green-400"}`}>{fmt(totalNonExemptEquity)}</span>
              </div>
            </div>

          </div>
        </div>

        {/* BOX 2 — DEBT BREAKDOWN (full width) */}
        <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-red-400" />
              <span className="text-sm font-bold text-white">Debt Breakdown</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>Secured: <span className="text-white font-semibold">{fmt(totalMortgageBalance + totalVehicleLiens)}</span></span>
              <span>Priority: <span className="text-white font-semibold">{fmt(totalPriorityBalance + backTaxes)}</span></span>
              <span>Unsecured: <span className="text-white font-semibold">{fmt(totalUnsecured)}</span></span>
              <span className="text-slate-600">|</span>
              <span className="font-semibold text-red-400">Total: {fmt(calcTotalDebt(fd))}</span>
            </div>
          </div>
          <div className="px-5 py-5">
            <div className="grid grid-cols-3 gap-5">

              {/* SECURED COLUMN */}
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Secured Debts</p>
                <div className="space-y-2">
                  {properties.map((p, i) => {
                    const bal = parseFloat((p.loanBalance as string) ?? "0") || 0;
                    const monthly = parseFloat((p.monthlyPayment as string) ?? "0") || 0;
                    const arrears = parseFloat((p.arrearsAmount as string) ?? "0") || 0;
                    if (bal === 0 && monthly === 0) return null;
                    return (
                      <div key={i} className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-3">
                        <div className="flex justify-between items-start text-xs mb-1">
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Mortgage {i + 1}</span>
                            <span className="text-slate-300 font-semibold">{(p.lenderName as string) || (p.address as string) || `Property ${i + 1}`}</span>
                          </div>
                          <span className="text-white font-bold">{fmt(bal)}</span>
                        </div>
                        <div className="flex gap-3 text-[10px] text-slate-500 mt-1">
                          {monthly > 0 && <span>{fmt(monthly)}/mo</span>}
                          {p.interestRate && <span>{p.interestRate as string}% rate</span>}
                        </div>
                        {arrears > 0 && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1">
                            <AlertTriangle size={10} className="text-red-400 flex-shrink-0" />
                            <span className="text-red-300">Arrears: <span className="font-bold">{fmt(arrears)}</span></span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {vehicles.filter(v => parseFloat((v.loanBalance as string) ?? "0") > 0).map((v, i) => {
                    const lien = parseFloat((v.loanBalance as string) ?? "0") || 0;
                    const monthly = parseFloat((v.monthlyPayment as string) ?? "0") || 0;
                    return (
                      <div key={i} className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-3">
                        <div className="flex justify-between items-start text-xs mb-1">
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Vehicle Lien</span>
                            <span className="text-slate-300 font-semibold">{[v.year, v.make, v.model].filter(Boolean).join(" ") || `Vehicle ${i + 1}`}</span>
                          </div>
                          <span className="text-white font-bold">{fmt(lien)}</span>
                        </div>
                        {monthly > 0 && <p className="text-[10px] text-slate-500 mt-1">{fmt(monthly)}/mo</p>}
                      </div>
                    );
                  })}
                  {properties.length === 0 && vehicles.filter(v => parseFloat((v.loanBalance as string) ?? "0") > 0).length === 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/30 rounded-xl border border-slate-700/30 px-3 py-3">
                      <span className="text-[9px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded font-bold">NO</span>
                      No secured debts reported
                    </div>
                  )}
                  {(properties.length > 0 || totalVehicleLiens > 0) && (
                    <div className="flex justify-between text-xs pt-1 border-t border-slate-700/40 mt-1">
                      <span className="text-slate-400 font-semibold">Secured Total</span>
                      <span className="text-white font-bold">{fmt(totalMortgageBalance + totalVehicleLiens)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* PRIORITY COLUMN */}
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Priority Debts</p>
                <div className="space-y-2">
                  {backTaxes > 0 ? (
                    <div className="bg-rose-500/8 rounded-xl border border-rose-500/25 p-3">
                      <div className="flex justify-between items-start text-xs">
                        <div>
                          <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest block mb-0.5">Tax Debt</span>
                          <span className="text-slate-300 font-semibold">IRS / State Taxes</span>
                        </div>
                        <span className="text-white font-bold">{fmt(backTaxes)}</span>
                      </div>
                      <p className="text-[10px] text-rose-400/70 mt-1">Must be paid 100% in Ch. 13</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/30 rounded-xl border border-slate-700/30 px-3 py-2.5">
                      <span className="text-[9px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded font-bold">NO</span>
                      Tax debt
                    </div>
                  )}
                  {childSupport > 0 ? (
                    <div className="bg-amber-500/8 rounded-xl border border-amber-500/25 p-3">
                      <div className="flex justify-between items-start text-xs">
                        <div>
                          <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest block mb-0.5">Domestic Support</span>
                          <span className="text-slate-300 font-semibold">Child Support / Alimony</span>
                        </div>
                        <span className="text-white font-bold">{fmt(childSupport)}/mo</span>
                      </div>
                      <p className="text-[10px] text-amber-400/70 mt-1">Ongoing obligation — must stay current</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/30 rounded-xl border border-slate-700/30 px-3 py-2.5">
                      <span className="text-[9px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded font-bold">NO</span>
                      Child support / alimony
                    </div>
                  )}
                  {alimony > 0 && (
                    <div className="bg-amber-500/8 rounded-xl border border-amber-500/25 p-3">
                      <div className="flex justify-between items-start text-xs">
                        <div>
                          <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest block mb-0.5">Support Obligation</span>
                          <span className="text-slate-300 font-semibold">Support of Others</span>
                        </div>
                        <span className="text-white font-bold">{fmt(alimony)}/mo</span>
                      </div>
                    </div>
                  )}
                  {priorityDebts.map((d, i) => {
                    const bal = parseFloat((d.balance as string) ?? "0") || 0;
                    return (
                      <div key={i} className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-3">
                        <div className="flex justify-between items-start text-xs">
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Priority Claim</span>
                            <span className="text-slate-300 font-semibold">{(d.creditor as string) || (d.type as string) || `Priority ${i + 1}`}</span>
                          </div>
                          <span className="text-white font-bold">{fmt(bal)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {(totalPriorityBalance + backTaxes + childSupport + alimony) > 0 && (
                    <div className="flex justify-between text-xs pt-1 border-t border-slate-700/40 mt-1">
                      <span className="text-slate-400 font-semibold">Priority Total</span>
                      <span className="text-white font-bold">{fmt(totalPriorityBalance + backTaxes)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* UNSECURED COLUMN */}
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Unsecured Debts</p>
                <div className="space-y-2">
                  {([
                    { label: "Credit Cards", key: "creditCardDebt", badge: "bg-slate-700/80 text-slate-300" },
                    { label: "Medical", key: "medicalDebt", badge: "bg-blue-500/15 text-blue-300" },
                    { label: "Student Loans", key: "studentLoanDebt", badge: "bg-cyan-500/15 text-cyan-300" },
                    { label: "Personal Loans", key: "personalLoanDebt", badge: "bg-yellow-500/15 text-yellow-300" },
                    { label: "Other Unsecured", key: "otherDebt", badge: "bg-slate-700/80 text-slate-300" },
                  ] as { label: string; key: string; badge: string }[]).map(({ label, key, badge }) => {
                    const val = parseFloat((fd[key] as string) ?? "0") || 0;
                    return val > 0 ? (
                      <div key={key} className="flex justify-between items-center text-xs bg-slate-800/40 rounded-xl border border-slate-700/40 px-3 py-2.5">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${badge}`}>{label}</span>
                        <span className="text-white font-semibold">{fmt(val)}</span>
                      </div>
                    ) : (
                      <div key={key} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-800/20 rounded-xl border border-slate-700/20 px-3 py-2.5">
                        <span className="text-[9px] bg-slate-800 text-slate-600 px-1.5 py-0.5 rounded font-bold">NO</span>
                        {label}
                      </div>
                    );
                  })}
                  {totalBusinessDebtDisplay > 0 && (
                    <div className="flex justify-between items-center text-xs bg-orange-500/10 rounded-xl border border-orange-500/30 px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-orange-500/20 text-orange-300 w-fit">Business Debt</span>
                        {(fd.businessDebtDesc as string) && <span className="text-[9px] text-slate-500 max-w-[160px] truncate">{fd.businessDebtDesc as string}</span>}
                      </div>
                      <span className="text-orange-300 font-semibold">{fmt(totalBusinessDebtDisplay)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs pt-1 border-t border-slate-700/40 mt-1">
                    <span className="text-slate-400 font-semibold">Unsecured Total</span>
                    <span className="text-white font-bold">{fmt(totalUnsecured)}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* TOTAL SUMMARY BAR */}
            <div className="mt-5 bg-slate-800/60 rounded-xl border border-slate-700/40 p-4 grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-[10px] text-slate-500 mb-0.5">Secured</p>
                <p className="text-white font-bold">{fmt(totalMortgageBalance + totalVehicleLiens)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-0.5">Priority</p>
                <p className="text-white font-bold">{fmt(totalPriorityBalance + backTaxes)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-0.5">Unsecured</p>
                <p className="text-white font-bold">{fmt(totalUnsecured)}</p>
              </div>
              <div className="border-l border-slate-700/40">
                <p className="text-[10px] text-slate-500 mb-0.5">Total Debt</p>
                <p className="text-red-400 font-bold text-base">{fmt(calcTotalDebt(fd))}</p>
              </div>
            </div>
          </div>
        </div>


      </div>

      {schedJOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSchedJOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Schedule J — All Monthly Expenses</h3>
              <button onClick={() => setSchedJOpen(false)} className="text-slate-400 hover:text-white text-lg leading-none">&times;</button>
            </div>
            <div className="space-y-2">
              {housingExpenseLines.map((line, i) => (
                <div key={`housing-${i}`} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-700/40">
                  <span className="text-slate-400">{line.label}</span>
                  <span className="text-white font-semibold">{fmt(line.amount)}</span>
                </div>
              ))}
              {lienLines.map((line, i) => (
                <div key={`lien-${i}`} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-700/40">
                  <span className="text-slate-400">{line.label}</span>
                  <span className="text-white font-semibold">{fmt(line.amount)}</span>
                </div>
              ))}
              {vehicleExpenseLines.map((line, i) => (
                <div key={`veh-${i}`} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-700/40">
                  <span className="text-slate-400">{line.label}</span>
                  <span className="text-white font-semibold">{fmt(line.amount)}</span>
                </div>
              ))}
              {expenseFields.map(ef => {
                const val = parseFloat((fd[ef.key] as string) ?? "0") || 0;
                return (
                  <div key={ef.key} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-700/40">
                    <span className="text-slate-400">{ef.label}</span>
                    <span className={`font-semibold ${val > 0 ? "text-white" : "text-slate-600"}`}>{val > 0 ? fmt(val) : "—"}</span>
                  </div>
                );
              })}
              <div className="flex justify-between items-center text-sm pt-2 mt-1 border-t-2 border-slate-600">
                <span className="text-white font-bold">Total Monthly Expenses</span>
                <span className="text-white font-bold">{fmt(expenses)}</span>
              </div>
              <div className="flex justify-between items-center text-sm pb-1">
                <span className="text-slate-300">DMI (after expenses)</span>
                <span className={`font-bold ${dmi >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt(dmi)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {incExpModal && (
        <IncomeExpenseModal
          mode={incExpModal.mode}
          chapter={incExpModal.chapter}
          fd={fd}
          submissionId={submissionId}
          draftId={draftId}
          clientName={clientName}
          clientEmail={clientEmail}
          staffName={staffName}
          onClose={() => setIncExpModal(null)}
          onSave={(updatedFd) => {
            setFd(updatedFd);
            if (onFdUpdate) onFdUpdate(updatedFd);
          }}
        />
      )}
    </>
  );
}


function CaseRow({ sub, onSelect, isSelected }: { sub: Submission; onSelect: () => void; isSelected: boolean }) {
  const fd = sub.form_data as Record<string, unknown>;
  const name = `${fd.firstName ?? ""} ${fd.lastName ?? ""}`.trim() || "Unknown";
  const state = (fd.state as string) ?? "—";
  const chapter = suggestChapter(fd);
  const issues = detectIssues(fd);
  const income = calcTotalIncome(fd);
  const debt = calcTotalDebt(fd);
  const daysAgo = Math.floor((Date.now() - new Date(sub.submitted_at).getTime()) / 86400000);

  const ch7 = analyzeChapter7(fd);
  const goodFaith13 = analyzeGoodFaith13(fd);
  const noCase = !ch7.eligible && !(goodFaith13?.isGoodCandidate);

  const statusColors: Record<string, string> = {
    pending_review: "text-amber-300 bg-amber-400/10 border-amber-400/30",
    accepted: "text-green-300 bg-green-400/10 border-green-400/30",
    declined: "text-red-300 bg-red-400/10 border-red-400/30",
  };

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3.5 rounded-xl border transition-all ${
        isSelected
          ? "bg-blue-500/10 border-blue-500/50"
          : "bg-slate-800/30 border-slate-700/80 hover:border-slate-600 hover:bg-slate-800/60"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">{name}</p>
            <p className="text-slate-400 text-xs mt-0.5">{state} · {daysAgo === 0 ? "Today" : `${daysAgo}d ago`}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${statusColors[sub.status] ?? "text-slate-400 bg-slate-700 border-slate-600"}`}>
            {sub.status === "pending_review" ? "Pending" : sub.status === "accepted" ? "Accepted" : "Declined"}
          </span>
          {noCase ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold text-rose-300 bg-rose-500/10 border-rose-500/30 leading-tight text-center max-w-[120px]">
              No-Case / Ltd. Scope
            </span>
          ) : (
            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${chapter === "7" ? "text-cyan-300 bg-cyan-400/10 border-cyan-400/30" : chapter === "13" ? "text-amber-300 bg-amber-400/10 border-amber-400/30" : "text-slate-300 bg-slate-700 border-slate-600"}`}>
              {chapter === "either" ? "Ch. 7 or 13" : `Ch. ${chapter}`}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1"><TrendingUp size={10} className="text-green-400" />{fmt(income)}/mo</span>
        <span className="flex items-center gap-1"><CreditCard size={10} className="text-red-400" />{fmt(debt)}</span>
        {issues.length > 0 && (
          <span className="flex items-center gap-1 text-amber-300 ml-auto">
            <AlertTriangle size={10} /> {issues.length} issue{issues.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </button>
  );
}

export default function AttorneyIntakeDashboard({ onSwitchToCaseManagement }: { onSwitchToCaseManagement?: () => void } = {}) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Submission | null>(null);
  // Detail-panel tab — Overview / Eligibility (with Ch.7/Ch.13 sub-tabs) /
  // Issues / Decision & fees. Reset to Overview every time a new case is picked.
  const [activeTab, setActiveTab] = useState<'overview' | 'eligibility' | 'issues' | 'decision'>('overview');
  const [elgSubTab, setElgSubTab] = useState<'ch7' | 'ch13'>('ch7');
  useEffect(() => { if (selected) { setActiveTab('overview'); setElgSubTab('ch7'); } }, [selected?.id]);
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [saved, setSaved] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [sortOrder, setSortOrder] = useState<"oldest" | "newest">("oldest");

  const [form, setForm] = useState({
    chapter: "7" as "7" | "13",
    courtDistrict: "",
    quotedFee: "",
    attorneyNotes: "",
    clientAdvisoryNotes: "",
    accepted: true as boolean,
    ch7FeeType: "normal" as "normal" | "bifurcated",
    ch7TotalFee: "",
    ch7PreFilingFee: "",
    ch7PostFilingFee: "",
    ch13TotalFee: "",
    ch13UpfrontFee: "",
    ch13RolledIntoPlan: "",
    feeAgreementSent: false,
    paymentInitiated: false,
    returnedToAdmin: false,
    closedByAi: false,
    limitedScope: false,
    limitedScopeFlatFee: "",
    limitedScopeDescription: "",
  });

  const [tab, setTab] = useState<"pending" | "accepted" | "declined">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [incExpModal, setIncExpModal] = useState<{ mode: "income" | "expenses" | "both"; chapter: "7" | "13" } | null>(null);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsText, setSmsText] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState<"sent" | "error" | null>(null);
  const [showCalModal, setShowCalModal] = useState(false);
  const [showBoldSignModal, setShowBoldSignModal] = useState(false);
  const [boldSignNote, setBoldSignNote] = useState("");
  const [boldSignSending, setBoldSignSending] = useState(false);
  const [boldSignResult, setBoldSignResult] = useState<"sent" | "error" | null>(null);
  const [showCh7Popup, setShowCh7Popup] = useState(false);
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);
  const [acceptOverrideReason, setAcceptOverrideReason] = useState("");
  const [requestInfoSending, setRequestInfoSending] = useState(false);
  const [requestInfoSent, setRequestInfoSent] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"docs" | "log">("docs");
  const [clientDocs, setClientDocs] = useState<Array<Record<string, unknown>>>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [expandedSecured, setExpandedSecured] = useState(false);
  const [expandedPriority, setExpandedPriority] = useState(false);
  const [expandedLiquidation, setExpandedLiquidation] = useState(false);
  const [expandedConfEl1, setExpandedConfEl1] = useState(false);
  const [expandedConfEl2, setExpandedConfEl2] = useState(false);
  const [expandedConfEl3, setExpandedConfEl3] = useState(false);
  const [expandedConfEl4, setExpandedConfEl4] = useState(false);
  const [expandedConfEl5, setExpandedConfEl5] = useState(false);
  const [gridPrimeRate, setGridPrimeRate] = useState<number | null>(null);
  const [gridPrimeAsOf, setGridPrimeAsOf] = useState<string | null>(null);
  const [gridPrimeLoading, setGridPrimeLoading] = useState(false);
  const [gridPrimeError, setGridPrimeError] = useState<string | null>(null);
  const [gridModifyingRate, setGridModifyingRate] = useState(false);
  const [gridModifyInput, setGridModifyInput] = useState("");
  const [includeNonCMICh13, setIncludeNonCMICh13] = useState(false);
  const [expandNonCMICh7, setExpandNonCMICh7] = useState(false);
  const [expandNonCMICh13SchedI, setExpandNonCMICh13SchedI] = useState(false);
  const gridTillRate = gridPrimeRate != null ? gridPrimeRate + 3 : null;
  const [showTaskPanel, setShowTaskPanel] = useState(false);

  useEffect(() => { loadSubmissions(); fetchGridPrimeRate(); }, []);

  async function loadSubmissions() {
    setLoading(true);
    await supabase.rpc("refresh_intake_stale_flags").maybeSingle();
    const { data } = await supabase
      .from("intake_submissions")
      .select("*")
      .order("submitted_at", { ascending: true });
    setSubmissions((data as Submission[]) ?? []);
    setLoading(false);
    // 90-day stale auto-email removed pending attorney-approval gate.
    // Stale-flag refresh now runs server-side via refresh_intake_stale_flags RPC only.
  }

  async function fetchGridPrimeRate() {
    setGridPrimeLoading(true);
    setGridPrimeError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/prime-rate`, {
        headers: { Authorization: `Bearer ${supabaseAnonKey}` },
      });
      const data = await res.json();
      if (data.primeRate != null) {
        setGridPrimeRate(data.primeRate);
        setGridPrimeAsOf(data.asOf ?? null);
      } else {
        setGridPrimeError("Could not fetch prime rate");
      }
    } catch {
      setGridPrimeError("Network error");
    } finally {
      setGridPrimeLoading(false);
    }
  }

  function applyGridModifiedRate() {
    const val = parseFloat(gridModifyInput);
    if (!isNaN(val) && val > 0) {
      setGridPrimeRate(val);
      setGridPrimeAsOf("manual");
      setGridPrimeError(null);
    }
    setGridModifyingRate(false);
    setGridModifyInput("");
  }

  async function loadClientDocs(submissionId: string) {
    setDocsLoading(true);
    const { data } = await supabase
      .from("client_documents")
      .select("*")
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: false });
    setClientDocs((data as Array<Record<string, unknown>>) ?? []);
    setDocsLoading(false);
  }

  async function sendInfoRequest() {
    if (!selected) return;
    const fd = selected.form_data as Record<string, unknown>;
    const email = fd?.email as string;
    const phone = fd?.phone as string;
    const name = `${fd?.firstName ?? ""} ${fd?.lastName ?? ""}`.trim();
    setRequestInfoSending(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const message = `Hi ${name || "there"}, your bankruptcy case requires additional income and payment verification to complete the means test analysis. Please submit: (1) last 6 months of pay stubs or proof of income, (2) most recent mortgage statement, (3) most recent vehicle loan statement(s). Please upload these documents at your earliest convenience or reply to this message. Thank you.`;
      if (phone) {
        await fetch(`${supabaseUrl}/functions/v1/send-sms-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
          body: JSON.stringify({ type: "sms", to: phone, message }),
        });
      }
      if (email) {
        await fetch(`${supabaseUrl}/functions/v1/send-sms-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
          body: JSON.stringify({ type: "email", to: email, subject: "Action Required: Income Verification for Your Bankruptcy Case", message }),
        });
      }
      setRequestInfoSent(selected.id);
      await supabase.from("case_activity_logs").insert({
        submission_id: selected.id,
        activity_type: "sms",
        actor: "Attorney",
        summary: "Income verification request sent to client via SMS & email",
        detail: { body: message, to_sms: phone, to_email: email },
        client_notified: true,
      });
    } catch {
      // silent fail — SMS/email send is best-effort
    }
    setRequestInfoSending(false);
  }

  async function selectCase(sub: Submission) {
    setSelected(sub);
    setSaved(false);
    setEmailSent(false);
    setEmailError("");
    setRequestInfoSent(null);
    loadClientDocs(sub.id);

    const rawFd = sub.form_data as Record<string, unknown>;
    const fd = normalizeFormData(rawFd);
    const state = (rawFd.state as string) ?? "";
    const courts = getCourtsForState(state);
    const suggested = suggestChapter(fd);

    const { data: reviewData } = await supabase
      .from("attorney_intake_reviews")
      .select("*")
      .eq("submission_id", sub.id)
      .maybeSingle();

    if (reviewData) {
      const rv = reviewData as Review;
      setReview(rv);
      const isCh7 = rv.chapter === 7;
      const isLimited = rv.decision === "limited_scope";
      // total_fee is the single source of truth; for Ch7 vs Ch13 vs limited_scope
      // the same column carries the value. Split back into the form's three slots
      // based on chapter + decision.
      const totalStr = rv.total_fee != null ? String(rv.total_fee) : "";
      setForm({
        chapter: (rv.chapter === 13 ? "13" : "7") as "7" | "13",
        courtDistrict: rv.court_district ?? "",
        quotedFee: totalStr,
        attorneyNotes: rv.decision_notes ?? "",
        clientAdvisoryNotes: rv.client_advisory_notes ?? "",
        accepted: rv.decision === "accepted" || rv.decision === "limited_scope",
        ch7FeeType: (rv.ch7_fee_type as "normal" | "bifurcated") ?? "normal",
        ch7TotalFee: isCh7 && !isLimited ? totalStr : "",
        ch7PreFilingFee: rv.down_payment != null ? String(rv.down_payment) : "",
        ch7PostFilingFee: rv.ch7_post_filing_fee != null ? String(rv.ch7_post_filing_fee) : "",
        ch13TotalFee: !isCh7 && !isLimited ? totalStr : "",
        ch13UpfrontFee: rv.ch13_upfront_amount ? String(rv.ch13_upfront_amount) : "",
        ch13RolledIntoPlan: rv.ch13_plan_portion ? String(rv.ch13_plan_portion) : "",
        feeAgreementSent: rv.fee_agreement_sent ?? false,
        paymentInitiated: rv.payment_initiated ?? false,
        returnedToAdmin: rv.returned_to_admin ?? false,
        closedByAi: rv.closed_by_ai ?? false,
        limitedScope: isLimited,
        limitedScopeFlatFee: isLimited ? totalStr : "",
        limitedScopeDescription: rv.limited_scope_desc ?? "",
      });
    } else {
      setReview(null);
      setForm({
        chapter: suggested === "either" ? "7" : suggested,
        courtDistrict: courts[0]?.value ?? "",
        quotedFee: "",
        attorneyNotes: "",
        clientAdvisoryNotes: "",
        accepted: true,
        ch7FeeType: "normal",
        ch7TotalFee: "",
        ch7PreFilingFee: "",
        ch7PostFilingFee: "",
        ch13TotalFee: "",
        ch13UpfrontFee: "",
        ch13RolledIntoPlan: "",
        feeAgreementSent: false,
        paymentInitiated: false,
        returnedToAdmin: false,
        closedByAi: false,
        limitedScope: false,
        limitedScopeFlatFee: "",
        limitedScopeDescription: "",
      });
    }
  }

  async function saveReview() {
    if (!selected) return;
    setSaving(true);
    setSaved(false);

    const chapterNum: 7 | 13 = form.chapter === "13" ? 13 : 7;
    const ch7FeeType = form.ch7FeeType;
    const isLimited = form.limitedScope;
    const decision = isLimited ? "limited_scope" : form.accepted ? "accepted" : "declined";

    // Resolve total_fee from whichever slot carries it. Empty string → null.
    // Per rule: never compute against a missing total.
    const totalRaw = (isLimited
      ? form.limitedScopeFlatFee
      : chapterNum === 7 ? form.ch7TotalFee : form.ch13TotalFee
    ).trim();
    const totalFeeParsed = totalRaw ? parseFloat(totalRaw) : NaN;
    const totalFee: number | null = Number.isFinite(totalFeeParsed) ? totalFeeParsed : null;

    // Down payment = Ch7 pre-filing fee (only when bifurcated)
    const dpRaw = form.ch7PreFilingFee.trim();
    const dpParsed = dpRaw ? parseFloat(dpRaw) : NaN;
    const downPayment: number | null =
      chapterNum === 7 && ch7FeeType === "bifurcated" && Number.isFinite(dpParsed) ? dpParsed : null;

    // Snapshot ch7_post_filing_fee at save: only when bifurcated AND both
    // inputs present. Never recomputed on read.
    const ch7PostFilingFee: number | null =
      chapterNum === 7 && ch7FeeType === "bifurcated" && totalFee != null && downPayment != null
        ? Math.max(totalFee - downPayment, 0)
        : null;

    // Snapshot court_filing_fee + attorney_fee at save.
    const { court_filing_fee, attorney_fee } = splitFees(chapterNum, ch7FeeType, totalFee);

    const ch13Up = parseFloat(form.ch13UpfrontFee) || 0;
    const ch13Rolled = (totalFee ?? 0) - ch13Up;

    const payload = {
      submission_id: selected.id,
      lead_id: (selected as Submission & { lead_id?: string | null }).lead_id ?? null,
      chapter: chapterNum,
      court_district: form.courtDistrict,
      total_fee: totalFee,
      attorney_fee,
      court_filing_fee,
      decision_notes: form.attorneyNotes,
      client_advisory_notes: form.clientAdvisoryNotes,
      decision,
      decided_at: new Date().toISOString(),
      review_status: "completed",
      ch7_fee_type: ch7FeeType,
      down_payment: downPayment,
      ch7_post_filing_fee: ch7PostFilingFee,
      ch13_upfront_amount: chapterNum === 13 ? ch13Up : null,
      ch13_plan_portion: chapterNum === 13 ? Math.max(ch13Rolled, 0) : null,
      fee_agreement_sent: form.feeAgreementSent,
      payment_initiated: form.paymentInitiated,
      returned_to_admin: form.returnedToAdmin,
      closed_by_ai: form.closedByAi,
      limited_scope_desc: form.limitedScopeDescription,
    };

    let error;
    if (review) {
      const res = await supabase.from("attorney_intake_reviews").update(payload).eq("id", review.id);
      error = res.error;
    } else {
      const res = await supabase.from("attorney_intake_reviews").insert(payload).select().maybeSingle();
      error = res.error;
      if (res.data) setReview(res.data as Review);
    }

    if (!error) {
      const newStatus = (form.limitedScope || form.accepted) ? "accepted" : "declined";
      const newCaseStatus = form.limitedScope ? "limited_scope_offered" : form.accepted ? "accepted_pending_presentation" : "case_declined";

      await supabase
        .from("intake_submissions")
        .update({ status: newStatus, last_modified_by: "Attorney", stale_flag: false })
        .eq("id", selected.id);

      if (selected.client_id) {
        await supabase
          .from("clients")
          .update({ status: newStatus, case_status: newCaseStatus, last_activity: new Date().toISOString() })
          .eq("id", selected.client_id);
      } else {
        await supabase
          .from("clients")
          .update({ status: newStatus, case_status: newCaseStatus, last_activity: new Date().toISOString() })
          .eq("intake_id", selected.id);
      }

      const nowIso = new Date().toISOString();
      setSubmissions(prev =>
        prev.map(s => s.id === selected.id ? { ...s, status: newStatus, updated_at: nowIso, last_modified_by: "Attorney", stale_flag: false } : s)
      );
      setSelected(prev => prev ? { ...prev, status: newStatus, updated_at: nowIso, last_modified_by: "Attorney", stale_flag: false } : prev);
      setSaved(true);
    }
    setSaving(false);
  }

  async function sendConfirmation() {
    if (!selected) return;
    setSendingEmail(true);
    setEmailError("");
    setEmailSent(false);

    const fd = selected.form_data as Record<string, unknown>;
    const clientName = `${fd.firstName ?? ""} ${fd.lastName ?? ""}`.trim();
    const email = (fd.email as string) ?? "";

    if (!email) {
      setEmailError("No email address found in client intake data.");
      setSendingEmail(false);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-confirmation`, {
        method: "POST",
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, clientName, referenceNumber: selected.reference_number, chapter: form.chapter, courtDistrict: form.courtDistrict, quotedFee: parseFloat(form.quotedFee) || 0, attorneyNotes: form.attorneyNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send email");
      await supabase.from("attorney_intake_reviews").update({ confirmation_sent: true }).eq("submission_id", selected.id);
      setEmailSent(true);
    } catch (err) {
      setEmailError(String(err));
    }
    setSendingEmail(false);
  }

  const sortedFiltered = useMemo(() => {
    return submissions
      .filter(s => {
        const fd = s.form_data as Record<string, unknown>;
        const name = `${fd.firstName ?? ""} ${fd.lastName ?? ""}`.toLowerCase();
        const ref = s.reference_number.toLowerCase();
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q || name.includes(q) || ref.includes(q);
        const matchesTab = tab === "pending" ? (s.status === "pending_review" || s.status === "submitted_for_review") : tab === "accepted" ? s.status === "accepted" : s.status === "declined";
        return matchesSearch && matchesTab;
      })
      .sort((a, b) => {
        const ta = new Date(a.submitted_at).getTime();
        const tb = new Date(b.submitted_at).getTime();
        return sortOrder === "oldest" ? ta - tb : tb - ta;
      });
  }, [submissions, searchQuery, tab, sortOrder]);

  const counts = {
    pending:  submissions.filter(s => s.status === "pending_review" || s.status === "submitted_for_review").length,
    accepted: submissions.filter(s => s.status === "accepted").length,
    declined: submissions.filter(s => s.status === "declined").length,
  };

  const fd = selected?.form_data ? normalizeFormData(selected.form_data as Record<string, unknown>) : undefined;
  const availableCourts = selected?.form_data ? getCourtsForState((selected.form_data as Record<string, unknown>).state as string ?? "") : [];
  const selectedIssues = fd ? detectIssues(fd) : [];
  const selectedChapter = fd ? suggestChapter(fd) : "either";
  const ch7Analysis = fd ? analyzeChapter7(fd) : null;
  const ch13Analysis = fd ? analyzeChapter13(fd) : null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return { text: "Good morning", Icon: Sun };
    if (h < 17) return { text: "Good afternoon", Icon: Sunset };
    return { text: "Good evening", Icon: Moon };
  })();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {showTaskPanel && <AttorneyTaskPanel onClose={() => setShowTaskPanel(false)} />}
      <div className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm px-6 py-3 sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-amber-400/15 rounded-xl flex items-center justify-center flex-shrink-0">
              <Scale size={18} className="text-amber-400" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex-shrink-0">
                <span className="font-serif text-xl font-bold text-white">bankruptcy</span>
                <span className="font-serif text-xl font-bold text-amber-400">.AI</span>
              </div>
              <div className="h-5 w-px bg-slate-700 flex-shrink-0" />
              <div className="flex items-center gap-1.5 min-w-0">
                <greeting.Icon size={13} className="text-amber-400/70 flex-shrink-0" />
                <span className="text-slate-300 text-sm font-medium whitespace-nowrap">
                  {greeting.text}, <span className="text-white font-semibold">Dominic Majors</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {onSwitchToCaseManagement && (
              <button
                onClick={onSwitchToCaseManagement}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 border border-amber-400 text-white text-xs font-semibold rounded-xl transition-all"
              >
                <ArrowRightLeft size={12} /> Existing Clients
              </button>
            )}
            <button
              onClick={() => setShowTaskPanel(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-amber-400 text-xs font-semibold rounded-xl transition-all"
            >
              <ListChecks size={13} /> Tasks
            </button>
            <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
              <div className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${counts.pending > 0 ? "bg-red-500 text-white" : "bg-amber-400 text-slate-900"}`}>
                <FileText size={13} /> Case Review
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-slate-400">Live</span>
            </div>
          </div>
        </div>
      </div>

      {true && (
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { icon: FileText, label: "Total Submissions", value: submissions.length, color: "text-blue-400 bg-blue-500/15" },
              { icon: Clock, label: "Pending Review", value: counts.pending, color: "text-amber-400 bg-amber-400/15" },
              { icon: CheckCircle, label: "Accepted", value: counts.accepted, color: "text-green-400 bg-green-500/15" },
              { icon: XCircle, label: "Declined", value: counts.declined, color: "text-red-400 bg-red-500/15" },
            ].map(s => (
              <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>
                  <s.icon size={18} />
                </div>
                <div>
                  <p className="text-slate-400 text-xs font-medium">{s.label}</p>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-12 gap-5">
            <div className={selected ? "col-span-3" : "col-span-3"}>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden sticky top-24">
                <div className="p-3 border-b border-slate-800 space-y-2">
                  <input
                    type="text"
                    placeholder="Search name or reference..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 focus:border-amber-400/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{sortedFiltered.length} case{sortedFiltered.length !== 1 ? "s" : ""}</span>
                    <button
                      onClick={() => setSortOrder(o => o === "oldest" ? "newest" : "oldest")}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400 transition-colors"
                    >
                      {sortOrder === "oldest" ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                      {sortOrder === "oldest" ? "Oldest first" : "Newest first"}
                    </button>
                  </div>
                </div>
                <div className="flex border-b border-slate-800">
                  {(["pending", "accepted", "declined"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${tab === t ? "text-amber-400 border-b-2 border-amber-400" : "text-slate-500 hover:text-slate-300"}`}
                    >
                      {t === "pending" ? "Pending" : t === "accepted" ? "Accepted" : "Declined"}
                      <span className="ml-1 opacity-60">({counts[t]})</span>
                    </button>
                  ))}
                </div>
                <div className="p-2.5 space-y-1.5 max-h-[calc(100vh-360px)] overflow-y-auto">
                  {loading ? (
                    <div className="text-center py-10 text-slate-500 text-sm">Loading...</div>
                  ) : sortedFiltered.length === 0 ? (
                    <div className="text-center py-10">
                      <FileText size={28} className="text-slate-700 mx-auto mb-2" />
                      <p className="text-slate-500 text-xs">No {tab} cases</p>
                    </div>
                  ) : sortedFiltered.map(sub => (
                    <CaseRow key={sub.id} sub={sub} isSelected={selected?.id === sub.id} onSelect={() => selectCase(sub)} />
                  ))}
                </div>
                <div className="border-t border-slate-800 p-2.5">
                  <button onClick={loadSubmissions} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
                    <RefreshCw size={11} /> Refresh
                  </button>
                </div>
              </div>
            </div>

            <div className={selected ? "col-span-6" : "col-span-9"}>
              {!selected ? (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-slate-900 border border-slate-800 rounded-2xl">
                  <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mb-3">
                    <Briefcase size={24} className="text-slate-600" />
                  </div>
                  <p className="text-slate-400 font-semibold">Select a case to review</p>
                  <p className="text-slate-600 text-sm mt-1">Cases sorted oldest to newest by default</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="mb-4">
                      <div className="min-w-0">
                        <h2 className="text-2xl font-bold text-white font-serif leading-tight">
                          {(fd?.firstName as string) ?? ""} {(fd?.lastName as string) ?? ""}
                          {(fd?.filingType === "joint" || fd?.filingType === "individual-nonfiling-spouse") &&
                            <span className="text-slate-400 font-normal"> &amp; {(fd?.spouseFirstName as string) ?? ""} {(fd?.spouseLastName as string) ?? ""}</span>}
                        </h2>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {(() => {
                            const state = ((fd?.state as string) ?? "").toUpperCase().slice(0, 2);
                            const d1First = ((fd?.firstName as string) ?? "").charAt(0).toUpperCase();
                            const d1Last = ((fd?.lastName as string) ?? "").charAt(0).toUpperCase();
                            const isJoint = fd?.filingType === "joint" || fd?.filingType === "individual-nonfiling-spouse";
                            const d2First = isJoint ? ((fd?.spouseFirstName as string) ?? "").charAt(0).toUpperCase() : "";
                            const d2Last = isJoint ? ((fd?.spouseLastName as string) ?? "").charAt(0).toUpperCase() : "";
                            const lastInitials = d2Last && d2Last !== d1Last ? `${d1Last}${d2Last}` : d1Last;
                            const initials = `${d1First}${d2First}${lastInitials}`;
                            const date = new Date(selected.submitted_at);
                            const mo = String(date.getMonth() + 1).padStart(2, "0");
                            const yr = String(date.getFullYear()).slice(2);
                            const bkCode = `${state}-BK-${initials}${mo}${yr}`;
                            const refNum = selected.reference_number;
                            return (
                              <>
                                <span className="text-amber-400 text-sm font-mono font-bold tracking-wide">{bkCode}</span>
                                <span className="text-slate-600">·</span>
                                <span className="text-amber-400 text-xs font-mono font-semibold">{refNum}</span>
                              </>
                            );
                          })()}
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-400 text-sm">{new Date(selected.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                        {(() => {
                          const lastMod = selected.updated_at ?? selected.submitted_at;
                          const modBy = selected.last_modified_by ?? "Client";
                          const daysSince = Math.floor((Date.now() - new Date(lastMod).getTime()) / 86400000);
                          const isStale = selected.stale_flag || daysSince >= 90;
                          const modDate = new Date(lastMod).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                          return (
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border ${isStale ? "bg-red-500/15 border-red-500/40 text-red-300" : "bg-slate-800/60 border-slate-700/50 text-slate-400"}`}>
                                <Clock size={9} className={isStale ? "text-red-400" : "text-slate-500"} />
                                Last modified {modDate} by {modBy} · {daysSince}d ago
                              </span>
                              {isStale && (
                                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/50 text-red-300">
                                  <AlertCircle size={9} />
                                  90+ days — intake must be refreshed by client
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          {fd?.email && <span className="flex items-center gap-1 text-xs text-slate-300"><Mail size={10} className="text-slate-500" />{fd.email as string}</span>}
                          {fd?.phone && <span className="flex items-center gap-1 text-xs text-slate-300"><Phone size={10} className="text-slate-500" />{fd.phone as string}</span>}
                        </div>
                      </div>
                    </div>

                    {/* ── TAB BAR — Overview / Eligibility / Issues / Decision & fees ── */}
                    <div className="border-t border-slate-800 -mx-5 px-5 pt-3">
                      <div className="flex gap-1">
                        {([
                          { id: 'overview' as const,    label: 'Overview' },
                          { id: 'eligibility' as const, label: 'Eligibility' },
                          { id: 'issues' as const,      label: 'Issues' },
                          { id: 'decision' as const,    label: 'Decision & fees' },
                        ]).map(t => (
                          <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
                              activeTab === t.id
                                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                                : 'border-transparent text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* SMS MODAL */}
                    {showSmsModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowSmsModal(false)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-2 mb-4">
                            <MessageSquare size={16} className="text-amber-400" />
                            <h3 className="text-white font-bold text-base">Send SMS</h3>
                            <span className="text-xs text-slate-400 ml-auto">{fd?.phone as string ?? "No phone"}</span>
                          </div>
                          <textarea
                            value={smsText}
                            onChange={e => setSmsText(e.target.value)}
                            placeholder="Type your message..."
                            rows={4}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/60 resize-none mb-3"
                          />
                          {smsResult === "sent" && <p className="text-green-400 text-xs mb-2">Message sent successfully.</p>}
                          {smsResult === "error" && <p className="text-red-400 text-xs mb-2">Failed to send. Check SMS configuration.</p>}
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowSmsModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">Cancel</button>
                            <button
                              disabled={!smsText.trim() || smsSending}
                              onClick={async () => {
                                setSmsSending(true);
                                setSmsResult(null);
                                try {
                                  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms-email`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
                                    body: JSON.stringify({ to: fd?.phone, message: smsText, type: "sms" }),
                                  });
                                  const ok = res.ok;
                                  setSmsResult(ok ? "sent" : "error");
                                  if (ok && selected) {
                                    await supabase.from("case_activity_logs").insert({
                                      submission_id: selected.id,
                                      activity_type: "sms",
                                      actor: "Attorney",
                                      summary: `SMS sent to client: "${smsText.slice(0, 80)}${smsText.length > 80 ? "..." : ""}"`,
                                      detail: { body: smsText, to: fd?.phone },
                                      client_notified: true,
                                    });
                                  }
                                } catch { setSmsResult("error"); }
                                setSmsSending(false);
                              }}
                              className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
                            >
                              {smsSending ? "Sending..." : "Send"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CALENDAR MODAL */}
                    {showCalModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCalModal(false)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-2 mb-4">
                            <Calendar size={16} className="text-blue-400" />
                            <h3 className="text-white font-bold text-base">Schedule Appointment</h3>
                          </div>
                          <p className="text-slate-400 text-sm mb-4">Open your calendar to schedule a consultation or follow-up call for <span className="text-white font-semibold">{(fd?.firstName as string) ?? ""} {(fd?.lastName as string) ?? ""}</span>.</p>
                          <div className="flex gap-2">
                            <button onClick={() => setShowCalModal(false)} className="flex-1 px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">Cancel</button>
                            <button
                              onClick={() => { window.open("https://calendar.google.com/calendar/r/eventedit", "_blank"); setShowCalModal(false); }}
                              className="flex-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
                            >
                              Open Calendar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* BOLDSIGN / SEND DOCS MODAL */}
                    {showBoldSignModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowBoldSignModal(false)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-2 mb-4">
                            <FileSignature size={16} className="text-teal-400" />
                            <h3 className="text-white font-bold text-base">Send Fee Agreement</h3>
                          </div>
                          <p className="text-slate-400 text-xs mb-3">Sends the fee agreement template via BoldSign to <span className="text-white font-medium">{fd?.email as string ?? "client email"}</span>. Add any notes for the client below.</p>
                          <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl px-3 py-2 mb-3">
                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mb-0.5">Template</p>
                            <p className="text-xs text-slate-300 font-medium">Fee Agreement — {form.chapter === "13" ? "Chapter 13" : "Chapter 7"}</p>
                          </div>
                          <textarea
                            value={boldSignNote}
                            onChange={e => setBoldSignNote(e.target.value)}
                            placeholder="Optional notes to include with the document..."
                            rows={3}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400/60 resize-none mb-3"
                          />
                          {boldSignResult === "sent" && <p className="text-green-400 text-xs mb-2">Fee agreement sent via BoldSign.</p>}
                          {boldSignResult === "error" && <p className="text-red-400 text-xs mb-2">Failed to send. Check BoldSign configuration.</p>}
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowBoldSignModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">Cancel</button>
                            <button
                              disabled={boldSignSending}
                              onClick={async () => {
                                setBoldSignSending(true);
                                setBoldSignResult(null);
                                try {
                                  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-boldsign`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
                                    body: JSON.stringify({
                                      email: fd?.email,
                                      name: `${fd?.firstName ?? ""} ${fd?.lastName ?? ""}`.trim(),
                                      chapter: form.chapter,
                                      notes: boldSignNote,
                                      intakeId: selected?.id,
                                    }),
                                  });
                                  setBoldSignResult(res.ok ? "sent" : "error");
                                } catch { setBoldSignResult("error"); }
                                setBoldSignSending(false);
                              }}
                              className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                            >
                              {boldSignSending ? "Sending..." : "Send via BoldSign"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}


                    {/* CH. 7 ANALYSIS POPUP */}
                    {showCh7Popup && ch7Analysis && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowCh7Popup(false)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                          <div className={`px-5 py-4 border-b border-slate-700/60 flex items-center gap-3 ${ch7Analysis.eligible ? "bg-green-500/10" : "bg-red-500/10"}`}>
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-base ${ch7Analysis.eligible ? "bg-green-500/20 text-green-300 border border-green-500/40" : "bg-red-500/20 text-red-300 border border-red-500/40"}`}>7</div>
                            <div>
                              <p className="text-white font-bold text-sm">Chapter 7 Eligibility Analysis</p>
                              <p className={`text-xs font-semibold mt-0.5 ${ch7Analysis.eligible ? "text-green-400" : "text-red-400"}`}>
                                {ch7Analysis.eligible ? (ch7Analysis.warnings && ch7Analysis.warnings.length > 0 ? "Conditionally Eligible — Review Warnings" : "Eligible — Good Ch. 7 Candidate") : "Not Eligible — Issues Must Be Resolved"}
                              </p>
                            </div>
                            <button onClick={() => setShowCh7Popup(false)} className="ml-auto text-slate-400 hover:text-white p-1.5 hover:bg-slate-700 rounded-lg transition-colors"><X size={14} /></button>
                          </div>
                          <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
                            {ch7Analysis.reasons && ch7Analysis.reasons.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Eligibility Findings</p>
                                <div className="space-y-1.5">
                                  {ch7Analysis.reasons.map((r, i) => (
                                    <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${ch7Analysis.eligible ? "bg-green-500/8 border border-green-500/20 text-green-200" : "bg-red-500/8 border border-red-500/20 text-red-200"}`}>
                                      {ch7Analysis.eligible ? <CheckCircle size={11} className="text-green-400 flex-shrink-0 mt-0.5" /> : <XCircle size={11} className="text-red-400 flex-shrink-0 mt-0.5" />}
                                      <span className="leading-relaxed">{r}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {ch7Analysis.warnings && ch7Analysis.warnings.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Warnings & Considerations</p>
                                <div className="space-y-1.5">
                                  {ch7Analysis.warnings.map((w, i) => (
                                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg text-xs bg-amber-500/8 border border-amber-500/20 text-amber-200">
                                      <AlertCircle size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                      <span className="leading-relaxed">{w}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="px-5 py-3 border-t border-slate-700/60 flex justify-end">
                            <button onClick={() => setShowCh7Popup(false)} className="px-5 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors">Close</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ACCEPT OVERRIDE CONFIRMATION — shown when Ch. 7 has issues */}
                    {showAcceptConfirm && ch7Analysis && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowAcceptConfirm(false)}>
                        <div className="bg-slate-900 border border-red-500/40 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                          <div className="px-5 py-4 border-b border-red-500/30 bg-red-500/10 flex items-center gap-3">
                            <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
                            <div>
                              <p className="text-white font-bold text-sm">Accept Case Despite Ch. 7 Issues?</p>
                              <p className="text-red-300 text-xs mt-0.5">This client has eligibility concerns that must be acknowledged in writing</p>
                            </div>
                          </div>
                          <div className="px-5 py-4 space-y-3">
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Issues Identified</p>
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {[...(ch7Analysis.reasons?.filter(r => !r.includes("below") && !ch7Analysis.eligible || false) ?? []), ...(ch7Analysis.warnings ?? [])].filter(Boolean).map((issue, i) => (
                                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg text-xs bg-red-500/8 border border-red-500/20 text-red-200">
                                    <AlertCircle size={10} className="text-red-400 flex-shrink-0 mt-0.5" />
                                    <span className="leading-relaxed">{issue}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-amber-400 uppercase tracking-widest mb-1.5">Attorney Justification <span className="text-red-400">*</span></label>
                              <textarea
                                value={acceptOverrideReason}
                                onChange={e => setAcceptOverrideReason(e.target.value)}
                                rows={3}
                                placeholder="Explain why this case should be accepted despite the issues listed above (e.g., client has plan to resolve non-exempt equity, trustee negotiation strategy, timing considerations)..."
                                className="w-full bg-slate-800 border border-slate-600 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 resize-none outline-none transition-colors"
                              />
                            </div>
                          </div>
                          <div className="px-5 py-3 border-t border-slate-700/60 flex gap-2 justify-end">
                            <button onClick={() => setShowAcceptConfirm(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">Cancel</button>
                            <button
                              onClick={() => {
                                if (!acceptOverrideReason.trim()) return;
                                setForm(f => ({ ...f, accepted: true, limitedScope: false, attorneyNotes: f.attorneyNotes ? `${f.attorneyNotes}\n\n[OVERRIDE JUSTIFICATION]: ${acceptOverrideReason}` : `[OVERRIDE JUSTIFICATION]: ${acceptOverrideReason}` }));
                                setShowAcceptConfirm(false);
                              }}
                              disabled={!acceptOverrideReason.trim()}
                              className="px-5 py-2 text-sm bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                            >
                              Confirm Accept
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'eligibility' && ch7Analysis && ch13Analysis && (() => {
                      const goodFaith = fd ? analyzeGoodFaith13(fd) : null;
                      const dmiVal = calcTotalIncome(fd ?? {}) - calcTotalExpenses(fd ?? {});

                      // --- Intake-synced field names (match BankruptcyIntake schema) ---
                      const props = (fd?.properties as Array<Record<string, unknown>>) ?? [];
                      const vehs = (fd?.vehicles as Array<Record<string, unknown>>) ?? [];

                      const keptPropsInline = props.filter(p => (p.intent as string) !== "surrender");
                      const keptVehsInline = vehs.filter(v => (v.intent as string) !== "surrender");

                      const hasMortArrears = keptPropsInline.some(p => parseFloat((p.arrearsAmount as string) ?? "0") > 0);
                      const rentExp = parseFloat((fd?.expRentMortgage as string) ?? "0") || 0;
                      const adjExpenses = hasMortArrears ? calcTotalExpenses(fd ?? {}) - rentExp : calcTotalExpenses(fd ?? {});
                      const dmi60 = Math.max(calcTotalIncome(fd ?? {}) - adjExpenses, 0) * 60;

                      const mortArrears = keptPropsInline.reduce((a, p) => a + (parseFloat((p.arrearsAmount as string) ?? "0") || 0), 0);
                      const conduit60 = keptPropsInline.reduce((a, p) => a + (parseFloat((p.monthlyPayment as string) ?? "0") || 0), 0) * 60;
                      const vehiclePayoff = keptVehsInline.reduce((a, v) => {
                        const lien = parseFloat((v.loanBalance as string) ?? "0") || 0;
                        const { rate } = effectiveVehRate(v, gridTillRate);
                        return a + (rate != null ? calcAmortizedTotal(lien, rate, 60) : lien);
                      }, 0);
                      const securedObligations = conduit60 + mortArrears + vehiclePayoff;

                      const taxDebt = parseFloat((fd?.taxDebt as string) ?? "0") || 0;
                      const childSup = parseFloat((fd?.dChildSupport as string) ?? "0") || 0;
                      const alimonyAmt = parseFloat((fd?.dAlimony as string) ?? "0") || 0;
                      const inlineCSArrears = parseFloat((fd?.childSupportArrears as string) ?? "0") || 0;
                      const inlineAlimonyArrears = parseFloat((fd?.alimonyArrears as string) ?? "0") || 0;
                      const inlineDSOArrears = inlineCSArrears + inlineAlimonyArrears || parseFloat((fd?.domesticSupportArrears as string) ?? "0") || 0;
                      const inlinePriorityDebts = (fd?.priorityDebts as Array<Record<string, unknown>>) ?? [];
                      const inlinePriorityDebtsBal = inlinePriorityDebts.reduce((a, d) => a + (parseFloat((d.balance as string) ?? "0") || 0), 0);
                      const priorityTotal = taxDebt + inlinePriorityDebtsBal + inlineDSOArrears + (childSup * 60) + (alimonyAmt * 60);

                      const unsecuredNonPriority = (parseFloat((fd?.creditCardDebt as string) ?? "0") || 0)
                        + (parseFloat((fd?.medicalDebt as string) ?? "0") || 0)
                        + (parseFloat((fd?.studentLoanDebt as string) ?? "0") || 0)
                        + (parseFloat((fd?.personalLoanDebt as string) ?? "0") || 0)
                        + (parseFloat((fd?.otherDebt as string) ?? "0") || 0)
                        + (parseFloat((fd?.supplyVendorDebt as string) ?? "0") || 0)
                        + (parseFloat((fd?.businessCreditCardDebt as string) ?? "0") || 0)
                        + (parseFloat((fd?.businessMortgageDebt as string) ?? "0") || 0)
                        + (parseFloat((fd?.businessEquipmentDebt as string) ?? "0") || 0)
                        + (parseFloat((fd?.otherBusinessDebt as string) ?? "0") || 0);

                      const inlineHomesteadRaw = fd ? getEffectiveHomestead(fd) : 0;
                      const inlineHomesteadIncomplete = inlineHomesteadRaw === null;
                      const inlineHomestead = inlineHomesteadRaw ?? 0;
                      const inlineVehicle = fd ? getEffectiveVehicleExemption(fd) : 0;
                      const inlineState = (fd?.state as string) ?? "TX";
                      const inlineStateEx = getApplicableExemptions(inlineState);
                      const inlineIsJoint = fd?.filingType === "joint";
                      const liquidVal = fd ? calcNonExemptEquity(fd) : 0;

                      const trusteeFee = dmi60 * 0.10;
                      const availForUnsecured = Math.max(dmi60 - securedObligations - priorityTotal - trusteeFee, 0);

                      const barTotal = securedObligations + priorityTotal + Math.max(unsecuredNonPriority, liquidVal);
                      const securedPct = barTotal > 0 ? (securedObligations / barTotal) * 100 : 0;
                      const priorityPct = barTotal > 0 ? (priorityTotal / barTotal) * 100 : 0;
                      const unsecuredPct = barTotal > 0 ? (Math.max(unsecuredNonPriority, liquidVal) / barTotal) * 100 : 0;

                      // --- Creditor negotiation analysis ---
                      const totalDebt = calcTotalDebt(fd ?? {});
                      const liquidCash = parseFloat((fd?.cashSavings as string) ?? "0") || 0;
                      const totalAssetValue = props.reduce((a, p) => a + (parseFloat((p.propertyValue as string) ?? "0") || 0), 0)
                        + vehs.reduce((a, v) => a + (parseFloat((v.value as string) ?? "0") || 0), 0)
                        + liquidCash;
                      const liquidRatio = totalDebt > 0 ? liquidCash / unsecuredNonPriority : 0;
                      const canNegotiate = liquidRatio >= 0.50 && unsecuredNonPriority > 0 && liquidVal === 0;

                      // --- Non-exempt equity breakdown (mirrors CaseSummaryGrid) ---
                      const recHomesteadRaw = fd ? getEffectiveHomestead(fd) : 0;
                      const recHomesteadIncomplete = recHomesteadRaw === null;
                      const recHomestead = recHomesteadRaw ?? 0;
                      const recVehExempt = fd ? getEffectiveVehicleExemption(fd) : 0;
                      const recState = (fd?.state as string) ?? "TX";
                      const recStateEx = getApplicableExemptions(recState);
                      const totalPropNonExemptEquity = props.reduce((a, p) => {
                        const eq = (parseFloat((p.propertyValue as string) ?? "0") || 0) - (parseFloat((p.loanBalance as string) ?? "0") || 0);
                        return a + Math.max(eq - recHomestead, 0);
                      }, 0);
                      const totalVehNonExemptEquity = vehs.reduce((a, v) => {
                        const eq = (parseFloat((v.value as string) ?? "0") || 0) - (parseFloat((v.loanBalance as string) ?? "0") || 0);
                        return a + Math.max(eq - recVehExempt, 0);
                      }, 0);
                      const recBizAssets = (fd?.businessAssets as Array<Record<string, unknown>>) ?? [];
                      const totalBusinessEquity = Math.max(0,
                        recBizAssets.reduce((a, b) => a + (parseFloat((b.estimatedValue as string) ?? "0") || 0), 0) -
                        recBizAssets.reduce((a, b) => a + (parseFloat((b.owedOnIt as string) ?? "0") || 0), 0)
                      );
                      const personalPropNonExempt = Math.max(0, liquidVal - totalPropNonExemptEquity - totalVehNonExemptEquity - totalBusinessEquity);

                      // --- Recommendation logic ---
                      const numDepsRec = parseInt((fd?.numDependents as string) ?? "0") || 0;
                      const isJointRec = fd?.filingType === "joint" || fd?.filingType === "individual-nonfiling-spouse";
                      const hsRec = numDepsRec + (isJointRec ? 2 : 1);
                      const stateRec = (fd?.state as string) ?? "TX";
                      const annualIncRec = calcTotalGrossIncome(fd ?? {}) * 12;
                      const medianRec = getStateMedian(stateRec, hsRec);
                      const overMedianRec = annualIncRec > medianRec;

                      const recBizDebt = calcTotalBusinessDebt(fd ?? {});
                      const recConsumerDebt = calcTotalConsumerDebt(fd ?? {});
                      const recAllDebt = recBizDebt + recConsumerDebt;
                      const primarylyBizDebt = recAllDebt > 0 && recBizDebt / recAllDebt > 0.50;
                      const bizDebtPct = recAllDebt > 0 ? Math.round((recBizDebt / recAllDebt) * 100) : 0;

                      const ch7EligibleForRec = ch7Analysis.eligible && (!overMedianRec || primarylyBizDebt);

                      type Recommendation = "ch7" | "ch13" | "negotiate" | "either";
                      let recommendation: Recommendation = "either";
                      let recTitle = "";
                      let recDetail = "";
                      let recColor = "";

                      const ch7EligSummary = primarylyBizDebt
                        ? `Ch. 7: Eligible — ${bizDebtPct}% business debt; means test does not apply (§ 707(b)(2)(D))`
                        : overMedianRec
                          ? `Ch. 7: Over ${hsRec}-person ${stateRec} median (${fmt(annualIncRec)}/yr vs. ${fmt(medianRec)}) — request long-form 122A-2 with actual YTD figures and IRS allowable deductions to determine if debtor can pass`
                          : `Ch. 7: Eligible — income below ${hsRec}-person ${stateRec} median (${fmt(annualIncRec)}/yr vs. ${fmt(medianRec)})`;

                      const ch13EligSummary = goodFaith?.isGoodCandidate
                        ? `Ch. 13: Eligible — DMI of ${fmt(dmiVal)}/mo supports a ${fmt(dmiVal * 60)} 60-month plan`
                        : dmiVal <= 0
                          ? `Ch. 13: Does not qualify — DMI of ${fmt(dmiVal)}/mo cannot fund a plan`
                          : `Ch. 13: Not a good candidate — DMI of ${fmt(dmiVal)}/mo is insufficient to fund a confirmable plan`;

                      if (canNegotiate) {
                        recommendation = "negotiate";
                        recTitle = "Creditor Negotiation / Debt Settlement";
                        recDetail = `Client has sufficient liquid assets (${fmt(liquidCash)}) to cover approximately ${Math.round(liquidRatio * 100)}% of unsecured debt (${fmt(unsecuredNonPriority)}). With 50%+ liquidity, direct negotiation or settlement may achieve better outcomes than bankruptcy. Recommend evaluating debt settlement before filing.`;
                        recColor = "border-yellow-500/40 bg-yellow-500/5";
                      } else if (primarylyBizDebt && !goodFaith?.isGoodCandidate) {
                        recommendation = "ch7";
                        recTitle = "Recommend Chapter 7 — Business Debt Case";
                        recDetail = `Debtor's debt is ${bizDebtPct}% business-related (${fmt(recBizDebt)} of ${fmt(recAllDebt)} total). Under § 707(b)(2)(D), the means test does not apply when the majority of debt is non-consumer/business. Debtor may file Ch. 7 regardless of income or DMI. DMI of ${fmt(dmiVal)}/mo does not support a Ch. 13 plan.`;
                        recColor = "border-blue-500/40 bg-blue-500/5";
                      } else if (primarylyBizDebt && goodFaith?.isGoodCandidate) {
                        recommendation = "either";
                        recTitle = "Either Chapter Available — Business Debt Case";
                        recDetail = `Debtor's debt is ${bizDebtPct}% business-related (${fmt(recBizDebt)} of ${fmt(recAllDebt)} total). Means test does not apply under § 707(b)(2)(D) — Ch. 7 available regardless of income. DMI of ${fmt(dmiVal)}/mo also supports a Ch. 13 plan. Attorney discretion on best fit.`;
                        recColor = "border-amber-500/40 bg-amber-500/5";
                      } else if (!ch7EligibleForRec && !goodFaith?.isGoodCandidate) {
                        recTitle = "Neither Chapter Currently Recommended — Case Needs Review";
                        recDetail = `Client is over the ${hsRec}-person ${stateRec} median (${fmt(annualIncRec)}/yr vs. ${fmt(medianRec)} median) and DMI of ${fmt(dmiVal)}/mo cannot fund a Ch. 13 plan. Request the long-form 122A-2 using actual YTD income and IRS allowable deductions — client may still pass Ch. 7 means test. If not, review expense structure and income sources before advising.`;
                        recColor = "border-red-500/40 bg-red-500/5";
                        recommendation = "either";
                      } else if (ch7EligibleForRec && !goodFaith?.isGoodCandidate && !overMedianRec) {
                        recommendation = "ch7";
                        recTitle = "Recommend Chapter 7";
                        recDetail = `Client is under the ${hsRec}-person ${stateRec} median income (${fmt(annualIncRec)}/yr vs. ${fmt(medianRec)} median), passes the means test, and DMI of ${fmt(dmiVal)}/mo does not support a Ch. 13 plan. Chapter 7 provides the fastest discharge of unsecured debt.`;
                        recColor = "border-blue-500/40 bg-blue-500/5";
                      } else if (!ch7EligibleForRec && goodFaith?.isGoodCandidate) {
                        recommendation = "ch13";
                        recTitle = "Recommend Chapter 13";
                        recDetail = `Client is over the ${hsRec}-person ${stateRec} median (${fmt(annualIncRec)}/yr vs. ${fmt(medianRec)} median) and does not pass the means test for Ch. 7. Request the long-form 122A-2 with actual YTD figures and IRS allowable deductions to confirm whether Ch. 7 is possible — otherwise Ch. 13 is the appropriate path. DMI of ${fmt(dmiVal)}/mo supports a 60-month plan.`;
                        recColor = "border-green-500/40 bg-green-500/5";
                      } else if (ch7EligibleForRec && goodFaith?.isGoodCandidate) {
                        recommendation = "either";
                        recTitle = "Either Chapter Available — Attorney Discretion";
                        recDetail = `Client qualifies for both Ch. 7 and Ch. 13. Consider client goals: Ch. 7 for fastest discharge (${fmt(annualIncRec)}/yr under ${fmt(medianRec)} median), Ch. 13 if client needs to cure arrears, protect non-exempt assets, or has prior discharge timing issues. DMI of ${fmt(dmiVal)}/mo supports plan funding.`;
                        recColor = "border-amber-500/40 bg-amber-500/5";
                      } else if (overMedianRec && goodFaith?.isGoodCandidate) {
                        recommendation = "ch13";
                        recTitle = "Recommend Chapter 13 — Over Median";
                        recDetail = `Client is over the ${hsRec}-person ${stateRec} median (${fmt(annualIncRec)}/yr vs. ${fmt(medianRec)} median). Request the long-form 122A-2 using actual YTD income and IRS allowable deductions — if the means test clears, Ch. 7 may also be an option. In the meantime, DMI of ${fmt(dmiVal)}/mo supports a 60-month Ch. 13 plan.`;
                        recColor = "border-green-500/40 bg-green-500/5";
                      } else if (overMedianRec && !goodFaith?.isGoodCandidate) {
                        recTitle = "Over Median — Neither Chapter Currently Viable";
                        recDetail = `Client exceeds the ${hsRec}-person ${stateRec} median (${fmt(annualIncRec)}/yr vs. ${fmt(medianRec)} median) and DMI of ${fmt(dmiVal)}/mo cannot fund a confirmable Ch. 13 plan. Request the long-form 122A-2 with actual YTD income and IRS allowable deductions — passing the full means test would open Ch. 7. Review expense structure for plan feasibility.`;
                        recColor = "border-red-500/40 bg-red-500/5";
                        recommendation = "either";
                      }

                      const recIsHazard = recommendation !== "ch7" && recommendation !== "ch13" && recommendation !== "negotiate";
                      const recBadgeColor = recommendation === "ch7" ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                        : recommendation === "ch13" ? "bg-green-500/20 text-green-300 border-green-500/30"
                        : recommendation === "negotiate" ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                        : "bg-yellow-400/20 text-yellow-300 border-yellow-400/40";

                      return (
                        <div className="space-y-3">
                          {/* RECOMMENDATION BANNER */}
                          <div className={`rounded-xl border p-4 ${recColor}`}>
                            {/* ── ATTORNEY ACTION TOOLBAR (centered above content) ── */}
                            <div className="flex justify-center gap-2 mb-3 pb-3 border-b border-white/10">
                              <button
                                onClick={() => { setShowCalModal(true); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-600/80 border border-slate-600/60 text-slate-200 text-[11px] font-semibold transition-all"
                                title="Open Calendar"
                              >
                                <Calendar size={12} /> Calendar
                              </button>
                              <button
                                onClick={() => { if (fd?.phone) window.location.href = `tel:${fd.phone as string}`; }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-600/80 border border-slate-600/60 text-slate-200 text-[11px] font-semibold transition-all disabled:opacity-35 disabled:cursor-not-allowed"
                                title={fd?.phone ? `Call ${fd.phone as string}` : "No phone on file"}
                                disabled={!fd?.phone}
                              >
                                <PhoneCall size={12} /> Call
                              </button>
                              <button
                                onClick={() => { setSmsText(""); setSmsResult(null); setShowSmsModal(true); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-600/80 border border-slate-600/60 text-slate-200 text-[11px] font-semibold transition-all"
                                title="Send SMS"
                              >
                                <MessageSquare size={12} /> SMS
                              </button>
                              <button
                                onClick={() => { setBoldSignNote(""); setBoldSignResult(null); setShowBoldSignModal(true); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-600/80 border border-slate-600/60 text-slate-200 text-[11px] font-semibold transition-all"
                                title="Send Fee Agreement via BoldSign"
                              >
                                <FileSignature size={12} /> Send Docs
                              </button>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 font-bold text-sm ${recBadgeColor}`}>
                                {recIsHazard
                                  ? <AlertTriangle size={16} className="text-yellow-400" />
                                  : recommendation === "ch7" ? "7" : recommendation === "ch13" ? "13" : "$"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Case Recommendation</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${recBadgeColor}`}>
                                    {recommendation === "ch7" ? "Chapter 7" : recommendation === "ch13" ? "Chapter 13" : recommendation === "negotiate" ? "Debt Settlement" : "Review Required"}
                                  </span>
                                </div>
                                <p className="text-sm font-bold text-white mb-1">{recTitle}</p>
                                <p className="text-[11px] text-slate-300 leading-relaxed mb-2">{recDetail}</p>
                                {(() => {
                                  const minMonthly = (securedObligations + priorityTotal + trusteeFee + Math.max(liquidVal, unsecuredNonPriority)) / 60;
                                  const shortfall = minMonthly - Math.max(dmiVal, 0);
                                  if (shortfall <= 0 || dmiVal >= minMonthly) return null;
                                  return (
                                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 mb-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                                      <span className="text-[10px] text-amber-200">
                                        <span className="font-semibold">Plan Funding Gap:</span> debtor needs an additional <span className="font-bold text-amber-300">{fmt(shortfall)}/mo</span> beyond current DMI of <span className="font-bold">{fmt(dmiVal)}/mo</span> to fund the minimum Ch. 13 plan of <span className="font-bold">{fmt(minMonthly)}/mo</span>
                                      </span>
                                    </div>
                                  );
                                })()}
                                <div className="flex flex-col gap-1 mb-2">
                                  <div className={`flex items-start gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium ${ch7EligibleForRec ? "bg-blue-500/10 border-blue-500/25 text-blue-200" : "bg-red-500/10 border-red-500/25 text-red-200"}`}>
                                    {ch7EligibleForRec ? <CheckCircle size={10} className="text-blue-400 flex-shrink-0 mt-0.5" /> : <XCircle size={10} className="text-red-400 flex-shrink-0 mt-0.5" />}
                                    <span>{ch7EligSummary}</span>
                                  </div>
                                  <div className={`flex items-start gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium ${goodFaith?.isGoodCandidate ? "bg-green-500/10 border-green-500/25 text-green-200" : "bg-red-500/10 border-red-500/25 text-red-200"}`}>
                                    {goodFaith?.isGoodCandidate ? <CheckCircle size={10} className="text-green-400 flex-shrink-0 mt-0.5" /> : <XCircle size={10} className="text-red-400 flex-shrink-0 mt-0.5" />}
                                    <span>{ch13EligSummary}</span>
                                  </div>
                                </div>
                                {(() => {
                                  const hasEquityIssues = totalPropNonExemptEquity > 0 || totalVehNonExemptEquity > 0 || personalPropNonExempt > 0 || totalBusinessEquity > 0;
                                  const totalNonExemptEquity = totalPropNonExemptEquity + totalVehNonExemptEquity + personalPropNonExempt + totalBusinessEquity;
                                  const hasSOFAIssues = (ch7Analysis.reasons ?? []).some((r: string) => /transfer|sofa|fraud/i.test(r));
                                  const hasEligibilityIssues = !ch7Analysis.eligible;
                                  const hasIncomeMeansIssues = overMedianRec;
                                  const totalUnsec = unsecuredNonPriority;
                                  const totalSec13 = props.reduce((a, p) => a + (parseFloat((p.loanBalance as string) ?? "0") || 0), 0)
                                    + vehs.reduce((a, v) => a + (parseFloat((v.loanBalance as string) ?? "0") || 0), 0);
                                  const overUnsecLimitRec = totalUnsec > 526_700;
                                  const overSecLimitRec = totalSec13 > 1_580_125;
                                  const hasDebtLimitIssue = overUnsecLimitRec || overSecLimitRec;
                                  const planFundsRec = goodFaith?.isGoodCandidate ?? false;
                                  const hasPlanFundingIssue = !planFundsRec && dmiVal <= 0;
                                  const preferenceIssues = (ch7Analysis.reasons ?? []).some((r: string) => /preference|insider|payment within/i.test(r));

                                  const caseIssueLabels: string[] = [
                                    hasEquityIssues ? `Unexempt Equity (${fmt(totalNonExemptEquity)})` : "",
                                    hasDebtLimitIssue ? `Over Debt Limit${overUnsecLimitRec ? ` (unsecured ${fmt(totalUnsec)})` : ""}${overSecLimitRec ? ` (secured ${fmt(totalSec13)})` : ""}` : "",
                                    `DMI is ${fmt(dmiVal)}/mo`,
                                    hasSOFAIssues || preferenceIssues ? "SOFA / Preference Payment Concerns" : "",
                                    hasEligibilityIssues && hasIncomeMeansIssues ? `Over Median Income (${fmt(annualIncRec)}/yr vs. ${fmt(medianRec)} median)` : "",
                                    hasPlanFundingIssue ? "Plan Funding Insufficient" : "",
                                  ].filter(Boolean);

                                  const noIssues = !hasEquityIssues && !hasSOFAIssues && !preferenceIssues && !hasDebtLimitIssue && ch7Analysis.eligible && !hasPlanFundingIssue;

                                  return (
                                    <div className="mt-2 pt-2 border-t border-white/10">
                                      {noIssues ? (
                                        <div className="flex items-center gap-2">
                                          <CheckCircle size={11} className="text-green-400 flex-shrink-0" />
                                          <span className="text-[10px] font-semibold text-green-300">No Issues — Clean Case</span>
                                          <span className="text-[9px] text-slate-500">No unexempt equity, SOFA, eligibility, or plan funding concerns</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-start gap-2">
                                          <XCircle size={11} className="text-red-400 flex-shrink-0 mt-0.5" />
                                          <div className="flex-1 min-w-0">
                                            <span className="text-[10px] font-semibold text-red-300">Case Issues: </span>
                                            <span className="text-[10px] text-slate-300">{caseIssueLabels.join(" · ")}</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>

                          {/* CH. 7 + CH. 13 SIDE BY SIDE — order determined by best fit */}
                          {(() => {
                            const ch13First = (hasMortArrears && goodFaith?.isGoodCandidate) || (!ch7Analysis.eligible && (goodFaith?.isGoodCandidate ?? false));
                            const ch7Order = ch13First ? "order-2" : "order-1";
                            const ch13Order = ch13First ? "order-1" : "order-2";
                            return (
                          <div className="grid grid-cols-2 gap-3">

                            {/* ── CH. 7 ELIGIBILITY ── */}
                            <div className={ch7Order}>
                            {(() => {
                              const scrollTo = (id: string) => {
                                document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                              };

                              const ch7BadgeColor = ch7Analysis.eligible
                                ? "text-blue-300 bg-blue-500/15 border-blue-500/40"
                                : ch7Analysis.badge === "conditional"
                                  ? "text-amber-300 bg-amber-500/15 border-amber-500/40"
                                  : "text-red-300 bg-red-500/15 border-red-500/40";
                              const ch7Border = (!ch7Analysis.eligible || (overMedianRec && !primarylyBizDebt))
                                ? "border-red-500/30 bg-red-500/5"
                                : ch7Analysis.badge === "conditional"
                                  ? "border-amber-500/30 bg-amber-500/5"
                                  : "border-blue-500/30 bg-blue-500/5";

                              // Income breakdown for Sch. I
                              const ch7DebtorSrcs = (fd?.debtorSources as Array<Record<string, unknown>>) ?? [];
                              const ch7SpouseSrcs = (fd?.spouseSources as Array<Record<string, unknown>>) ?? [];
                              const isJointCh7 = fd?.filingType === "joint" || fd?.filingType === "individual-nonfiling-spouse";

                              // Helper: get gross monthly for Sch. I / means test (employment=gross, self-emp=gross-expenses)
                              const ch7SrcLabel = (s: Record<string, unknown>) => {
                                if (s.sourceType === "selfEmployment") return (s.businessName as string) || "Self-Employment";
                                if (s.sourceType === "socialSecurity") return "Social Security";
                                if (s.sourceType === "retirement") return (s.employerName as string) || "Retirement";
                                return (s.employerName as string) || "Employment";
                              };
                              const ch7SrcType = (s: Record<string, unknown>) => {
                                if (s.sourceType === "selfEmployment") return "SELF-EMPL";
                                if (s.sourceType === "socialSecurity") return "SS";
                                return "W-2";
                              };
                              const ch7SrcColor = (s: Record<string, unknown>) => {
                                if (s.sourceType === "selfEmployment") return "bg-orange-500/20 text-orange-300";
                                if (s.sourceType === "socialSecurity") return "bg-blue-500/20 text-blue-300";
                                return "bg-slate-700 text-slate-400";
                              };
                              const ch7SrcAmt = (s: Record<string, unknown>) => srcMonthlyGrossNoExpDeduction(s);
                              const ch7IsSS = (s: Record<string, unknown>) => s.sourceType === "socialSecurity";

                              const ch7DebtorTotal = ch7DebtorSrcs.reduce((a, s) => a + ch7SrcAmt(s), 0);
                              const ch7SpouseTotal = isJointCh7 ? ch7SpouseSrcs.reduce((a, s) => a + ch7SrcAmt(s), 0) : 0;

                              const ch7OtherItems = [
                                { label: "SS Retirement", amount: parseFloat((fd?.dSsRetirement as string) ?? "0") || 0, isSS: true },
                                { label: "SS Disability (SSDI)", amount: parseFloat((fd?.dSsDisability as string) ?? "0") || 0, isSS: true },
                                { label: "VA Disability Compensation", amount: parseFloat((fd?.dVeterans as string) ?? "0") || 0, isSS: true },
                                { label: "Military / Veterans Retirement Pay", amount: parseFloat((fd?.dVeteransRetirement as string) ?? "0") || 0, isSS: false },
                                { label: "Unemployment", amount: parseFloat((fd?.dUnemployment as string) ?? "0") || 0, isSS: false },
                                { label: "Workers Comp", amount: parseFloat((fd?.dWorkersComp as string) ?? "0") || 0, isSS: false },
                                { label: "Pension / Retirement", amount: parseFloat((fd?.dPension as string) ?? "0") || 0, isSS: false },
                                { label: "Rental Income", amount: parseFloat((fd?.dRental as string) ?? "0") || 0, isSS: false },
                                { label: "Alimony Received", amount: parseFloat((fd?.dAlimony as string) ?? "0") || 0, isSS: false },
                                { label: "Child Support", amount: parseFloat((fd?.dChildSupport as string) ?? "0") || 0, isSS: false },
                                { label: "Family Support", amount: parseFloat((fd?.dFamilySupport as string) ?? "0") || 0, isSS: false },
                                { label: "Royalties", amount: parseFloat((fd?.dRoyalties as string) ?? "0") || 0, isSS: false },
                                { label: "Investment Income", amount: parseFloat((fd?.dInvestment as string) ?? "0") || 0, isSS: false },
                                { label: "Other Income", amount: parseFloat((fd?.dOtherIncome as string) ?? "0") || 0, isSS: false },
                              ].filter(i => i.amount > 0);

                              const ch7SSTotal = ch7OtherItems.filter(i => i.isSS).reduce((a, i) => a + i.amount, 0)
                                + ch7DebtorSrcs.filter(s => ch7IsSS(s)).reduce((a, s) => a + ch7SrcAmt(s), 0)
                                + (isJointCh7 ? ch7SpouseSrcs.filter(s => ch7IsSS(s)).reduce((a, s) => a + ch7SrcAmt(s), 0) : 0);
                              const ch7TotalIncome = ch7DebtorTotal + ch7SpouseTotal + ch7OtherItems.reduce((a, i) => a + i.amount, 0);

                              // Net income for Schedule J DMI: net wages (after taxes/deductions), net business (gross - expenses), net other income
                              // Excludes SS retirement, SSDI, and VA disability — those are listed separately
                              const ch7SchedJNetSrc = (s: Record<string, unknown>): number => {
                                if (s.sourceType === "socialSecurity") return 0;
                                if (s.sourceType === "selfEmployment") {
                                  return (parseFloat(s.businessGrossIncome as string) || 0) - (parseFloat(s.businessExpenses as string) || 0);
                                }
                                const factor = PERIOD_TO_MONTHLY_ATY[s.payFrequency as string] ?? 1;
                                const base = (parseFloat(s.netPerPeriod as string) || 0) * factor;
                                if (s.receiveBonus === "yes" && s.bonusIncludedInIncome !== "yes") {
                                  return base + (parseFloat(s.bonusNet as string) || 0) / 12;
                                }
                                return base;
                              };
                              const ch7NetDebtorTotal = ch7DebtorSrcs.reduce((a, s) => a + ch7SchedJNetSrc(s), 0);
                              const ch7NetSpouseTotal = isJointCh7 ? ch7SpouseSrcs.reduce((a, s) => a + ch7SchedJNetSrc(s), 0) : 0;
                              // Other income excluding SS retirement, SSDI, VA disability
                              const ch7SchedJOtherExcluded = [
                                { label: "SS Retirement", amount: parseFloat((fd?.dSsRetirement as string) ?? "0") || 0 },
                                { label: "SSDI", amount: parseFloat((fd?.dSsDisability as string) ?? "0") || 0 },
                                { label: "VA Disability Compensation", amount: parseFloat((fd?.dVeterans as string) ?? "0") || 0 },
                              ].filter(i => i.amount > 0);
                              const ch7SchedJExcludedTotal = ch7SchedJOtherExcluded.reduce((a, i) => a + i.amount, 0);
                              const ch7SchedJOtherIncluded = ch7OtherItems.filter(i => !i.isSS);
                              const ch7SchedJNetIncome = ch7NetDebtorTotal + ch7NetSpouseTotal + ch7SchedJOtherIncluded.reduce((a, i) => a + i.amount, 0) + ch7SchedJExcludedTotal;

                              const ch7TotalExp = calcTotalExpenses(fd ?? {});
                              const ch7DMI = ch7SchedJNetIncome - ch7TotalExp;

                              // Deduplicated issue categories for Ch.7
                              const issueCategories: { icon: "pass" | "fail" | "warn"; label: string; link?: string }[] = [];
                              const passR = ch7Analysis.reasons.find(r => r.includes("below") || r.includes("No significant"));
                              const meansR = ch7Analysis.reasons.find(r => (r.includes("fails means test") || r.includes("above")) && (r.includes("median") || r.includes("means")));
                              const propR = ch7Analysis.reasons.find(r => r.includes("propert") || r.includes("non-exempt equity") || r.includes("properties have"));
                              const vehR = ch7Analysis.reasons.find(r => r.includes("vehicle") || r.includes("Vehicle") || r.includes("vehicles have"));
                              const priorR = ch7Analysis.reasons.find(r => r.includes("Prior") || r.includes("discharge"));
                              const transferR = ch7Analysis.reasons.find(r => r.includes("payment") || r.includes("transfer") || r.includes("Insider"));
                              const arrearsW = ch7Analysis.warnings.find(w => w.includes("Mortgage arrears"));
                              const meansW = ch7Analysis.warnings.find(w => w.includes("full means test") || w.includes("above median"));

                              // Build disqualifying factors list (over-median first)
                              const disqualifyingFactors: { icon: "pass" | "fail" | "warn"; label: string; link?: string }[] = [];
                              if (primarylyBizDebt) {
                                disqualifyingFactors.push({ icon: "pass", label: `${bizDebtPct}% business debt — means test does not apply (§ 707(b)(2)(D)); eligible regardless of income` });
                              } else if (overMedianRec) {
                                const overAmt = ch7TotalIncome - medianRec / 12;
                                disqualifyingFactors.push({ icon: "fail", label: `Over median by ${fmt(overAmt)}/mo — request long-form 122A-2 with actual YTD figures and IRS allowable deductions` });
                              }
                              if (meansR) disqualifyingFactors.push({ icon: "fail", label: meansR });
                              if (meansW && !meansR && !overMedianRec) disqualifyingFactors.push({ icon: "warn", label: meansW });
                              if (propR) disqualifyingFactors.push({ icon: "fail", label: propR, link: "schedule-i-j" });
                              if (vehR) disqualifyingFactors.push({ icon: "fail", label: vehR, link: "schedule-i-j" });
                              if (totalVehNonExemptEquity > 0) {
                                disqualifyingFactors.push({ icon: "warn", label: `Non-exempt vehicle equity: ${fmt(totalVehNonExemptEquity)} — attorney review required to address trustee exposure` });
                              }
                              if (recHomesteadIncomplete) {
                                disqualifyingFactors.push({ icon: "warn", label: "WA homestead — incomplete, data needed. Cannot compute non-exempt real-property equity until intake collects homeAcquiredDate and isOccupiedPrimary." });
                              } else if (totalPropNonExemptEquity > 0) {
                                disqualifyingFactors.push({ icon: "warn", label: `Non-exempt real property equity: ${fmt(totalPropNonExemptEquity)} — eligible but attorney review required to protect assets` });
                              }
                              if (personalPropNonExempt > 0) {
                                disqualifyingFactors.push({ icon: "warn", label: `Non-exempt personal property: ${fmt(personalPropNonExempt)} — attorney review required; may use wildcard or trustee negotiation` });
                              }
                              if (totalBusinessEquity > 0) {
                                disqualifyingFactors.push({ icon: "warn", label: `Business asset equity: ${fmt(totalBusinessEquity)} — attorney review required to address trustee exposure` });
                              }
                              if (priorR) disqualifyingFactors.push({ icon: "fail", label: priorR });
                              if (transferR) disqualifyingFactors.push({ icon: "fail", label: transferR });
                              if (arrearsW) disqualifyingFactors.push({ icon: "warn", label: arrearsW });
                              if (passR && disqualifyingFactors.length === 0) issueCategories.push({ icon: "pass", label: passR });

                              const ch7Qualifies = ch7Analysis.eligible && (!overMedianRec || primarylyBizDebt);
                              return (
                                <div className={`rounded-xl border p-4 ${ch7Border}`}>
                                  {/* Header */}
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                                        <span className="text-[10px] font-bold text-white">7</span>
                                      </div>
                                      <span className="text-xs font-bold text-white">Ch. 7 Eligibility</span>
                                    </div>
                                  </div>
                                  {/* Verdict pill */}
                                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border mb-3 ${ch7Qualifies ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                                    {ch7Qualifies
                                      ? <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
                                      : <XCircle size={13} className="text-red-400 flex-shrink-0" />}
                                    <span className={`text-xs font-bold ${ch7Qualifies ? "text-green-300" : "text-red-300"}`}>
                                      {ch7Qualifies
                                        ? primarylyBizDebt
                                          ? `Qualifies for Ch. 7 — Business Debt (${bizDebtPct}%, § 707(b)(2)(D))`
                                          : "Qualifies for Ch. 7"
                                        : overMedianRec && !primarylyBizDebt
                                          ? "Over Median — Request Long-Form 122A-2"
                                          : ch7Analysis.badge === "conditional"
                                            ? "Conditional — Attorney Review Required"
                                            : "Not a Good Ch. 7 Candidate"}
                                    </span>
                                  </div>

                                  {/* ── SCHEDULE I: MEANS TEST INCOME ── */}
                                  <div className="bg-slate-800/40 rounded-lg border border-slate-700/40 overflow-hidden mb-2">
                                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/40">
                                      <p className="text-[10px] text-slate-200 uppercase tracking-wider font-bold">Means Test 122c Calculated Income</p>
                                      <button onClick={() => setIncExpModal({ mode: "income", chapter: "7" })} className="text-[9px] text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">View / Edit Income</button>
                                    </div>
                                    <div className="px-3 pt-2 pb-1.5 space-y-1.5">
                                      {/* Employment / Wage sources */}
                                      {[
                                        ...ch7DebtorSrcs.filter(s => s.sourceType !== "selfEmployment" && s.sourceType !== "socialSecurity").map(s => ({ ...s, _who: "Debtor" })),
                                        ...ch7SpouseSrcs.filter(s => s.sourceType !== "selfEmployment" && s.sourceType !== "socialSecurity").map(s => ({ ...s, _who: "Spouse" })),
                                      ].map((s, i) => {
                                        const f = PERIOD_TO_MONTHLY_ATY[s.payFrequency as string] ?? 1;
                                        const gross = (parseFloat(s.grossPerPeriod as string) || 0) * f;
                                        const net = (parseFloat(s.netPerPeriod as string) || 0) * f;
                                        const ded = gross - net;
                                        const emp = (s.employerName as string) || `${s._who} Employer`;
                                        return (
                                          <div key={i} className="pl-2 border-l-2 border-slate-600/50">
                                            <div className="flex items-center justify-between">
                                              <span className="text-[10px] text-white font-semibold">{emp}</span>
                                              <span className="text-[9px] text-slate-500">{s._who as string}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px]">
                                              <span className="text-slate-500">Gross Pay</span>
                                              <span className="text-slate-300 tabular-nums">{fmt(gross)}/mo</span>
                                            </div>
                                            {ded > 0 && (
                                              <div className="flex justify-between text-[10px]">
                                                <span className="text-slate-500">Taxes &amp; Deductions</span>
                                                <span className="text-rose-400/80 tabular-nums">({fmt(ded)})/mo</span>
                                              </div>
                                            )}
                                            <div className="flex justify-between text-[10px] font-semibold border-t border-slate-700/30 mt-0.5 pt-0.5">
                                              <span className="text-slate-400">Net Wages</span>
                                              <span className="text-slate-200 tabular-nums">{fmt(net)}/mo</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                      {/* Self-employment sources */}
                                      {[
                                        ...ch7DebtorSrcs.filter(s => s.sourceType === "selfEmployment").map(s => ({ ...s, _who: "Debtor" })),
                                        ...ch7SpouseSrcs.filter(s => s.sourceType === "selfEmployment").map(s => ({ ...s, _who: "Spouse" })),
                                      ].map((s, i) => {
                                        const gross = parseFloat(s.businessGrossIncome as string) || 0;
                                        const bizExp = parseFloat(s.businessExpenses as string) || 0;
                                        const net = gross - bizExp;
                                        const name = (s.businessName as string) || `${s._who as string} Business`;
                                        return (
                                          <div key={i} className="pl-2 border-l-2 border-orange-500/30">
                                            <div className="flex items-center justify-between">
                                              <span className="text-[10px] text-white font-semibold">{name}</span>
                                              <span className="text-[9px] text-slate-500">{s._who as string}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px]">
                                              <span className="text-slate-500">Gross Receipts</span>
                                              <span className="text-slate-300 tabular-nums">{fmt(gross)}/mo</span>
                                            </div>
                                            {bizExp > 0 && (
                                              <div className="flex justify-between text-[10px]">
                                                <span className="text-slate-500">Business Expenses</span>
                                                <span className="text-rose-400/80 tabular-nums">({fmt(bizExp)})/mo</span>
                                              </div>
                                            )}
                                            <div className="flex justify-between text-[10px] font-semibold border-t border-slate-700/30 mt-0.5 pt-0.5">
                                              <span className="text-slate-400">Net Self-Emp.</span>
                                              <span className={`tabular-nums ${net >= 0 ? "text-orange-300" : "text-red-400"}`}>{fmt(net)}/mo</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                      {/* Other CMI income (non-SS, non-VA) */}
                                      {ch7OtherItems.filter(i => !i.isSS).map((item, i) => (
                                        <div key={i} className="flex justify-between text-[10px]">
                                          <span className="text-slate-500">{item.label}</span>
                                          <span className="text-slate-300 tabular-nums">{fmt(item.amount)}/mo</span>
                                        </div>
                                      ))}
                                      {/* CMI Total */}
                                      <div className="flex justify-between text-[11px] font-bold pt-1.5 border-t border-slate-700/40 mt-0.5">
                                        <span className="text-slate-300">Total CMI (Means Test)</span>
                                        <span className="text-white tabular-nums">{fmt(ch7TotalIncome - ch7SSTotal)}/mo</span>
                                      </div>
                                      {/* Non-CMI sources — shown but excluded from means test */}
                                      {(() => {
                                        const nonCMIItems = [
                                          ...ch7OtherItems.filter(i => i.isSS),
                                          ...ch7DebtorSrcs.filter(s => ch7IsSS(s)).map(s => ({ label: ch7SrcLabel(s), amount: ch7SrcAmt(s), isSS: true })),
                                          ...(isJointCh7 ? ch7SpouseSrcs.filter(s => ch7IsSS(s)).map(s => ({ label: `Spouse: ${ch7SrcLabel(s)}`, amount: ch7SrcAmt(s), isSS: true })) : []),
                                        ].filter(i => i.amount > 0);
                                        const nonCMITotal = nonCMIItems.reduce((a, i) => a + i.amount, 0);
                                        if (nonCMITotal === 0) return null;
                                        return (
                                          <div className="mt-2 pt-2 border-t border-slate-700/30">
                                            <div className="flex items-center justify-between mb-1.5">
                                              <span className="text-[9px] font-bold text-blue-400/70 uppercase tracking-wider">Non-CMI Income</span>
                                              <button
                                                onClick={() => setExpandNonCMICh7(v => !v)}
                                                className="flex items-center gap-1 text-[9px] text-blue-400/60 hover:text-blue-400 transition-colors"
                                              >
                                                <span className="tabular-nums font-semibold">{fmt(nonCMITotal)}/mo</span>
                                                <span className={`transition-transform text-[10px] ${expandNonCMICh7 ? "rotate-180" : ""}`}>▾</span>
                                              </button>
                                            </div>
                                            <div className="pl-2 border-l-2 border-blue-500/20 space-y-0.5">
                                              {nonCMIItems.map((item, i) => (
                                                <div key={i} className="flex justify-between text-[10px]">
                                                  <span className="text-slate-400">{item.label} <span className="text-[8px] text-blue-400/50">§ 101(10A)</span></span>
                                                  <span className="text-blue-400/70 tabular-nums">{fmt(item.amount)}/mo</span>
                                                </div>
                                              ))}
                                              {expandNonCMICh7 && (
                                                <p className="text-[9px] text-slate-600 pt-0.5 leading-snug">Not counted in means test; may be applied to Ch. 13 plan funding</p>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                    {/* Median comparison */}
                                    <div className="px-3 pt-2 pb-2.5 border-t border-slate-700/30 space-y-0.5">
                                      <div className="flex justify-between text-[10px]">
                                        <span className="text-slate-500">{hsRec}-person {stateRec} median (monthly)</span>
                                        <span className="text-slate-400 font-semibold tabular-nums">{fmt(medianRec / 12)}/mo</span>
                                      </div>
                                      <div className="flex justify-between text-[10px] font-bold">
                                        <span className={overMedianRec ? "text-red-400" : "text-green-400"}>
                                          {overMedianRec ? "Over median by" : "Under median by"}
                                        </span>
                                        <span className={`tabular-nums ${overMedianRec ? "text-red-400" : "text-green-400"}`}>
                                          {overMedianRec ? "+" : "−"}{fmt(Math.abs((ch7TotalIncome - ch7SSTotal) - medianRec / 12))}/mo
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* ── SCHEDULE J: EXPENSES & DMI ── */}
                                  <div className="bg-slate-800/40 rounded-lg border border-slate-700/40 px-3 py-2.5 mb-3">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <p className="text-[10px] text-slate-200 uppercase tracking-wider font-bold">Schedule J — Expenses &amp; DMI</p>
                                      <button onClick={() => setIncExpModal({ mode: "expenses", chapter: "7" })} className="text-[9px] text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">View / Edit Expenses</button>
                                    </div>
                                    <div className="space-y-0.5">
                                      {ch7SchedJOtherExcluded.map((item, i) => (
                                        <div key={i} className="flex justify-between text-[11px]">
                                          <span className="text-slate-400">{item.label} <span className="text-blue-400/70 text-[9px]">(non-CMI — not in means test)</span></span>
                                          <span className="text-slate-300 font-semibold">{fmt(item.amount)}/mo</span>
                                        </div>
                                      ))}
                                      <div className="flex justify-between text-[11px] font-bold pt-1 border-t border-slate-700/40 mt-0.5">
                                        <div>
                                          <span className="text-slate-300">Total Net Income</span>
                                          <p className="text-[9px] text-slate-500 font-normal mt-0.5">Net wages after all taxes &amp; deductions; net business income after expenses; non-CMI income included</p>
                                        </div>
                                        <span className="text-white ml-3 whitespace-nowrap">{fmt(ch7SchedJNetIncome)}/mo</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] py-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-slate-500 font-mono text-[10px]">−</span>
                                        <span className="text-slate-400">Total Expenses (Sch. J)</span>
                                      </div>
                                      <span className="text-slate-400 font-semibold">({fmt(ch7TotalExp)})/mo</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] font-bold pt-1.5 border-t border-slate-700/40 mt-1">
                                      <span className="text-white">Disposable Monthly Income</span>
                                      <span className={`font-bold ${ch7DMI >= 100 ? "text-green-400" : ch7DMI >= 0 ? "text-amber-400" : "text-red-400"}`}>{fmt(ch7DMI)}/mo</span>
                                    </div>
                                  </div>

                                  {/* ── DISQUALIFYING FACTORS ── */}
                                  {(disqualifyingFactors.length > 0 || issueCategories.length > 0) && (
                                    <div>
                                      {disqualifyingFactors.length > 0 && (
                                        <>
                                          <p className="text-[9px] font-bold text-red-400/80 uppercase tracking-widest mb-1.5">Disqualifying Factors</p>
                                          <div className="space-y-1">
                                            {disqualifyingFactors.map((issue, i) => (
                                              <div key={i} className="flex items-start gap-2 text-[11px]">
                                                {issue.icon === "fail" && <XCircle size={11} className="text-red-400 flex-shrink-0 mt-0.5" />}
                                                {issue.icon === "warn" && <AlertTriangle size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />}
                                                <div className="flex-1 min-w-0">
                                                  <span className={issue.icon === "fail" ? "text-red-300/80" : "text-amber-300/80"}>
                                                    {issue.label}
                                                  </span>
                                                  {issue.link && (
                                                    <button
                                                      onClick={() => scrollTo(issue.link!)}
                                                      className="ml-1.5 text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
                                                    >
                                                      → view details
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </>
                                      )}
                                      {issueCategories.map((issue, i) => (
                                        <div key={i} className="flex items-start gap-2 text-[11px] mt-1">
                                          <CheckCircle size={11} className="text-green-400 flex-shrink-0 mt-0.5" />
                                          <span className="text-green-300/80">{issue.label}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {disqualifyingFactors.length === 0 && issueCategories.length === 0 && (
                                    <div className="flex items-center gap-2 text-[11px]">
                                      <CheckCircle size={11} className="text-green-400 flex-shrink-0" />
                                      <span className="text-green-300/80">No disqualifying factors detected — standard Ch. 7 review applicable</span>
                                    </div>
                                  )}
                                  {/* Over-median long-form request panel */}
                                  {overMedianRec && (
                                    <div className="mt-3 pt-3 border-t border-yellow-400/20 rounded-b-xl">
                                      <div className="flex items-start gap-2 mb-2">
                                        <AlertTriangle size={12} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                          <p className="text-[11px] font-bold text-yellow-300 mb-0.5">Presumptive Abuse — Long Form Means Test Required</p>
                                          <p className="text-[10px] text-slate-400 leading-relaxed">Under 11 U.S.C. § 707(b), over-median income is presumptively abusive for Ch. 7. A long-form means test (Form 122A-2) is required to rebut the presumption. If client income is borderline, request verified income documentation and secured payment statements to complete the long-form analysis.</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 mt-2">
                                        <button
                                          onClick={sendInfoRequest}
                                          disabled={requestInfoSending || requestInfoSent === selected?.id}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-400/15 hover:bg-yellow-400/25 border border-yellow-400/30 text-yellow-300 text-[11px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          <FileText size={11} />
                                          {requestInfoSending ? "Sending..." : requestInfoSent === selected?.id ? "Request Sent" : "Request Income Verification from Client"}
                                        </button>
                                        {requestInfoSent === selected?.id && (
                                          <span className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle size={10} /> Sent via SMS &amp; email</span>
                                        )}
                                      </div>
                                      <p className="text-[9px] text-slate-500 mt-1.5">Client will be asked to submit: pay stubs (6 mo), mortgage statement, vehicle loan statement(s). View submitted documents in the Docs tab.</p>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            </div>

                            {/* ── CH. 13 ELIGIBILITY — Net Income Waterfall + Plan Funding ── */}
                            <div className={ch13Order}>
                            {(() => {
                              const scrollTo13 = (id: string) => {
                                document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                              };

                              // --- Ch. 13 net income: net wages + biz GROSS (no expense deduction) + non-SS other ---
                              const ch13DebtorSrcs = (fd?.debtorSources as Array<Record<string, unknown>>) ?? [];
                              const ch13SpouseSrcs = (fd?.spouseSources as Array<Record<string, unknown>>) ?? [];
                              const isJointCh13 = fd?.filingType === "joint" || fd?.filingType === "individual-nonfiling-spouse";

                              // For Ch. 13: wages use net take-home (netPerPeriod × factor), self-emp uses businessGrossIncome (NO expense deduction per bankruptcy case law)
                              const ch13SrcNet = (s: Record<string, unknown>): number => {
                                if (s.sourceType === "socialSecurity") return 0; // SS excluded from Ch. 13 DMI
                                if (s.sourceType === "selfEmployment") return parseFloat(s.businessGrossIncome as string) || 0;
                                const factor = PERIOD_TO_MONTHLY_ATY[s.payFrequency as string] ?? 1;
                                const base = (parseFloat(s.netPerPeriod as string) || 0) * factor;
                                if (s.receiveBonus === "yes" && s.bonusIncludedInIncome !== "yes") {
                                  return base + (parseFloat(s.bonusNet as string) || 0) / 12;
                                }
                                return base;
                              };
                              const ch13SrcLabel = (s: Record<string, unknown>) => {
                                if (s.sourceType === "selfEmployment") return (s.businessName as string) || "Self-Employment";
                                if (s.sourceType === "socialSecurity") return "Social Security";
                                if (s.sourceType === "retirement") return (s.employerName as string) || "Retirement";
                                return (s.employerName as string) || "Employment";
                              };
                              const ch13SrcTag = (s: Record<string, unknown>) => {
                                if (s.sourceType === "selfEmployment") return { label: "SELF-EMPL (gross, no exp deduction)", color: "bg-orange-500/20 text-orange-300" };
                                if (s.sourceType === "socialSecurity") return { label: "SS — excluded", color: "bg-slate-700 text-slate-500" };
                                return { label: "NET WAGES", color: "bg-slate-700 text-slate-400" };
                              };

                              const ch13DebtorNetTotal = ch13DebtorSrcs.reduce((a, s) => a + ch13SrcNet(s), 0);
                              const ch13SpouseNetTotal = isJointCh13 ? ch13SpouseSrcs.reduce((a, s) => a + ch13SrcNet(s), 0) : 0;

                              // Other income — exclude SS and VA Disability (non-CMI); Veterans Retirement IS CMI
                              const ch13VAExcluded = parseFloat((fd?.dVeterans as string) ?? "0") || 0;
                              const ch13OtherNonSS = [
                                { label: "Military / Veterans Retirement Pay", amount: parseFloat((fd?.dVeteransRetirement as string) ?? "0") || 0 },
                                { label: "Unemployment", amount: parseFloat((fd?.dUnemployment as string) ?? "0") || 0 },
                                { label: "Workers Comp", amount: parseFloat((fd?.dWorkersComp as string) ?? "0") || 0 },
                                { label: "Pension / Retirement", amount: parseFloat((fd?.dPension as string) ?? "0") || 0 },
                                { label: "Rental Income", amount: parseFloat((fd?.dRental as string) ?? "0") || 0 },
                                { label: "Alimony Received", amount: parseFloat((fd?.dAlimony as string) ?? "0") || 0 },
                                { label: "Child Support Received", amount: parseFloat((fd?.dChildSupport as string) ?? "0") || 0 },
                                { label: "Family Support", amount: parseFloat((fd?.dFamilySupport as string) ?? "0") || 0 },
                                { label: "Royalties", amount: parseFloat((fd?.dRoyalties as string) ?? "0") || 0 },
                                { label: "Investment Income", amount: parseFloat((fd?.dInvestment as string) ?? "0") || 0 },
                                { label: "Other Income", amount: parseFloat((fd?.dOtherIncome as string) ?? "0") || 0 },
                              ].filter(i => i.amount > 0);

                              const ch13SSExcluded = (parseFloat((fd?.dSsRetirement as string) ?? "0") || 0)
                                + (parseFloat((fd?.dSsDisability as string) ?? "0") || 0)
                                + ch13DebtorSrcs.filter(s => s.sourceType === "socialSecurity").reduce((a, s) => a + (parseFloat((s.grossPerPeriod as string) ?? "0") || 0) * (PERIOD_TO_MONTHLY_ATY[s.payFrequency as string] ?? 1), 0)
                                + (isJointCh13 ? ch13SpouseSrcs.filter(s => s.sourceType === "socialSecurity").reduce((a, s) => a + (parseFloat((s.grossPerPeriod as string) ?? "0") || 0) * (PERIOD_TO_MONTHLY_ATY[s.payFrequency as string] ?? 1), 0) : 0);

                              const ch13OtherTotal = ch13OtherNonSS.reduce((a, i) => a + i.amount, 0);
                              const ch13TotalNonCMI = ch13SSExcluded + ch13VAExcluded;
                              const ch13NetIncome = ch13DebtorNetTotal + ch13SpouseNetTotal + ch13OtherTotal;
                              const ch13NetIncomeBoosted = ch13NetIncome + ch13TotalNonCMI;

                              // Secured breakdown — exclude surrendered assets
                              const keptProps = props.filter(p => (p.intent as string) !== "surrender");
                              const keptVehs = vehs.filter(v => (v.intent as string) !== "surrender");
                              const mortConduit60 = keptProps.reduce((a, p) => a + (parseFloat((p.monthlyPayment as string) ?? "0") || 0), 0) * 60;
                              const mortArrearsAmt = keptProps.reduce((a, p) => a + (parseFloat((p.arrearsAmount as string) ?? "0") || 0), 0);
                              const vehPayoff = keptVehs.reduce((a, v) => {
                                const lien = parseFloat((v.loanBalance as string) ?? "0") || 0;
                                const { rate } = effectiveVehRate(v, gridTillRate);
                                return a + (rate != null ? calcAmortizedTotal(lien, rate, 60) : lien);
                              }, 0);
                              const totalSecObl = mortConduit60 + mortArrearsAmt + vehPayoff;

                              // For Ch. 13 DMI: mortgage payment is backed out when debtor has arrears (paid through plan as conduit).
                              // Vehicle payments are ALWAYS paid through the plan and removed from monthly budget.
                              const ch13MortgagePlanBacked = mortArrearsAmt > 0
                                ? keptProps.reduce((a, p) => a + (parseFloat((p.monthlyPayment as string) ?? "0") || 0), 0)
                                : 0;
                              const ch13VehPlanBacked = keptVehs.reduce((a, v) => a + (parseFloat((v.monthlyPayment as string) ?? "0") || 0), 0);

                              const totalExp13 = calcTotalExpenses(fd ?? {}) - ch13MortgagePlanBacked - ch13VehPlanBacked;
                              const ch13DMI = ch13NetIncome - totalExp13;
                              const ch13DMIBoosted = ch13NetIncomeBoosted - totalExp13;
                              const ch13EffDMI = includeNonCMICh13 ? ch13DMIBoosted : ch13DMI;
                              const ch13Pool60 = Math.max(ch13EffDMI, 0) * 60;

                              const ch7LiqFloor = liquidVal;
                              const attyFees13 = 3000;
                              const planSubtotal = totalSecObl + priorityTotal + ch7LiqFloor + attyFees13;
                              const trusteeFee13 = planSubtotal * 0.10;
                              const totalPlanNeeded = planSubtotal + trusteeFee13;
                              const remainAfterSec = ch13Pool60 - totalSecObl;
                              const remainAfterPri = remainAfterSec - priorityTotal;
                              const remainAfterLiq = remainAfterPri - ch7LiqFloor;
                              const remainAfterAtty = remainAfterLiq - attyFees13;
                              const remainAfterTrustee = remainAfterAtty - trusteeFee13;

                              const planFunds = ch13Pool60 >= totalPlanNeeded;
                              const fundsSec = ch13Pool60 >= totalSecObl;
                              const fundsPri = remainAfterSec >= priorityTotal;
                              const fundsLiq = remainAfterPri >= ch7LiqFloor;
                              const fundsAtty = remainAfterLiq >= attyFees13;
                              const fundsTrustee = remainAfterAtty >= trusteeFee13;

                              const totalUnsecured13 = unsecuredNonPriority;
                              const totalSecured13 = props.reduce((a, p) => a + (parseFloat((p.loanBalance as string) ?? "0") || 0), 0)
                                + vehs.reduce((a, v) => a + (parseFloat((v.loanBalance as string) ?? "0") || 0), 0);
                              const overUnsecLimit = totalUnsecured13 > 526_700;
                              const overSecLimit = totalSecured13 > 1_580_125;
                              const debtLimitIssue = overUnsecLimit || overSecLimit;

                              const barMax = Math.max(totalPlanNeeded, ch13Pool60, 1);

                              const ch13Border = debtLimitIssue ? "border-red-500/40 bg-red-500/5"
                                : goodFaith?.isGoodCandidate ? "border-green-500/40 bg-green-500/5"
                                : "border-red-500/40 bg-red-500/5";

                              const ch13Qualifies = !debtLimitIssue && goodFaith?.isGoodCandidate;
                              return (
                                <div className={`rounded-xl border p-4 ${ch13Border}`}>
                                  {/* Header */}
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                                        <span className="text-[10px] font-bold text-white">13</span>
                                      </div>
                                      <span className="text-xs font-bold text-white">Ch. 13 Eligibility</span>
                                      <span className="text-[10px] text-slate-500">(60-mo plan)</span>
                                    </div>
                                  </div>
                                  {/* Verdict pill */}
                                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border mb-3 ${ch13Qualifies ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                                    {ch13Qualifies
                                      ? <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
                                      : <XCircle size={13} className="text-red-400 flex-shrink-0" />}
                                    <span className={`text-xs font-bold ${ch13Qualifies ? "text-green-300" : "text-red-300"}`}>
                                      {ch13Qualifies ? "Qualifies for Ch. 13" : debtLimitIssue ? "Not Eligible — Over Debt Limit" : !planFunds ? "Does Not Qualify — Plan Cannot Be Funded" : "Does Not Qualify — Review Required"}
                                    </span>
                                  </div>

                                  {/* Debt limit warnings */}
                                  {debtLimitIssue && (
                                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 mb-3 space-y-1">
                                      {overUnsecLimit && (
                                        <div className="flex items-start gap-2 text-[11px]">
                                          <XCircle size={11} className="text-red-400 flex-shrink-0 mt-0.5" />
                                          <span className="text-red-300">Unsecured debt {fmt(totalUnsecured13)} exceeds § 109(e) limit of $526,700 — Ch. 13 ineligible; Ch. 11 required</span>
                                        </div>
                                      )}
                                      {overSecLimit && (
                                        <div className="flex items-start gap-2 text-[11px]">
                                          <XCircle size={11} className="text-red-400 flex-shrink-0 mt-0.5" />
                                          <span className="text-red-300">Secured debt {fmt(totalSecured13)} exceeds § 109(e) limit of $1,580,125 — Ch. 13 ineligible; Ch. 11 required</span>
                                        </div>
                                      )}
                                      <p className="text-[10px] text-slate-400 pt-1">Limits effective Apr 1, 2025 – Mar 31, 2028 (11 U.S.C. § 109(e))</p>
                                    </div>
                                  )}

                                  {/* ── INCOME / PLAN ANALYSIS — hidden when over debt limit ── */}
                                  {!debtLimitIssue && (<>

                                  {/* ── SCHEDULE I & J — INCOME + EXPENSES ── */}
                                  {(() => {
                                    // ── Self-employment sources ──
                                    const seDebtorSrcs = ch13DebtorSrcs.filter(s => s.sourceType === "selfEmployment");
                                    const seSpouseSrcs = isJointCh13 ? ch13SpouseSrcs.filter(s => s.sourceType === "selfEmployment") : [];
                                    // ── Wage sources ──
                                    const wgDebtorSrcs = ch13DebtorSrcs.filter(s => s.sourceType !== "selfEmployment" && s.sourceType !== "socialSecurity");
                                    const wgSpouseSrcs = isJointCh13 ? ch13SpouseSrcs.filter(s => s.sourceType !== "selfEmployment" && s.sourceType !== "socialSecurity") : [];
                                    // ── Retirement sources ──
                                    const retDebtorSrcs = ch13DebtorSrcs.filter(s => s.sourceType === "retirement");
                                    const retSpouseSrcs = isJointCh13 ? ch13SpouseSrcs.filter(s => s.sourceType === "retirement") : [];

                                    // helpers
                                    const wageGross = (s: Record<string,unknown>) => {
                                      const f = PERIOD_TO_MONTHLY_ATY[s.payFrequency as string] ?? 1;
                                      return (parseFloat(s.grossPerPeriod as string) || 0) * f;
                                    };
                                    const wageNet = (s: Record<string,unknown>) => {
                                      const f = PERIOD_TO_MONTHLY_ATY[s.payFrequency as string] ?? 1;
                                      return (parseFloat(s.netPerPeriod as string) || 0) * f;
                                    };

                                    const totalSEGross = [...seDebtorSrcs, ...seSpouseSrcs].reduce((a,s) => a + (parseFloat(s.businessGrossIncome as string)||0), 0);
                                    const totalSEExpenses = [...seDebtorSrcs, ...seSpouseSrcs].reduce((a,s) => a + (parseFloat(s.businessExpenses as string)||0), 0);
                                    const totalSENet = totalSEGross - totalSEExpenses;
                                    const totalWageGross = [...wgDebtorSrcs, ...wgSpouseSrcs].reduce((a,s) => a + wageGross(s), 0);
                                    const totalWageDeductions = totalWageGross - [...wgDebtorSrcs, ...wgSpouseSrcs].reduce((a,s) => a + wageNet(s), 0);
                                    const totalWageNet = totalWageGross - totalWageDeductions;

                                    // Expense breakdown
                                    const g = (f: string) => parseFloat((fd?.[f] as string) ?? "0") || 0;
                                    const primaryMortgage13 = (fd?.isOccupiedPrimary as string) === "yes"
                                      ? (parseFloat((fd?.realPropMonthlyPayment as string) ?? "0") || 0)
                                      : (parseFloat((fd?.rentAtResidence as string) ?? "0") || parseFloat((fd?.expRentMortgage as string) ?? "0") || 0);
                                    const secondMort13 = parseFloat((fd?.secondMortgagePayment as string) ?? "0") || 0;
                                    const vehPayments13 = ((fd?.vehicles as Array<Record<string,unknown>>) ?? []).reduce((a,v) => a + (parseFloat(v.monthlyPayment as string)||0), 0);
                                    const lienPmt13 = ((fd?.liens as Array<Record<string,unknown>>) ?? []).reduce((a,l) => a + (parseFloat(l.monthlyPayment as string)||0), 0);
                                    const lotRent13 = g("expLotSpaceRent");
                                    const mortgagePlanBacked13 = ch13MortgagePlanBacked > 0;
                                    const expGroups: Array<{ label: string; amount: number; category: string; planBacked?: boolean }> = [
                                      { label: "Rent / Mortgage", amount: primaryMortgage13, category: "Housing", planBacked: mortgagePlanBacked13 },
                                      { label: "2nd Mortgage", amount: secondMort13, category: "Housing", planBacked: mortgagePlanBacked13 },
                                      { label: "Property Tax", amount: g("expPropTax"), category: "Housing" },
                                      { label: "HOA Fees", amount: g("expHoa"), category: "Housing" },
                                      { label: "Home Maintenance", amount: g("expHomeMaintenance"), category: "Housing" },
                                      { label: "Lot / Space Rent", amount: lotRent13, category: "Housing" },
                                      { label: "Electric / Gas", amount: g("expElectricGas"), category: "Utilities" },
                                      { label: "Water / Sewer", amount: g("expWaterSewer"), category: "Utilities" },
                                      { label: "Phone", amount: g("expPhone"), category: "Utilities" },
                                      { label: "Internet", amount: g("expInternet"), category: "Utilities" },
                                      { label: "Food / Groceries", amount: g("expFood"), category: "Living" },
                                      { label: "Household Supplies", amount: g("expHouseholdSupplies"), category: "Living" },
                                      { label: "Clothing", amount: g("expClothing"), category: "Living" },
                                      { label: "Personal Care", amount: g("expPersonalCare"), category: "Living" },
                                      { label: "Recreation", amount: g("expRecreation"), category: "Living" },
                                      { label: "Gas / Fuel", amount: g("expGasFuel"), category: "Transportation" },
                                      { label: "Vehicle Payment(s)", amount: vehPayments13, category: "Transportation", planBacked: true },
                                      { label: "Lien Payments", amount: lienPmt13, category: "Transportation" },
                                      { label: "Car Maintenance", amount: g("expCarMaintenance"), category: "Transportation" },
                                      { label: "Public Transit", amount: g("expPublicTransit"), category: "Transportation" },
                                      { label: "Medical / Dental", amount: g("expMedical"), category: "Health" },
                                      { label: "Health Insurance", amount: g("expInsHealth"), category: "Health" },
                                      { label: "Life Insurance", amount: g("expInsLife"), category: "Insurance" },
                                      { label: "Vehicle Insurance", amount: g("expInsVehicle"), category: "Insurance" },
                                      { label: "Home Insurance", amount: g("expInsHome"), category: "Insurance" },
                                      { label: "Disability Insurance", amount: g("expInsDisability"), category: "Insurance" },
                                      { label: "Other Insurance", amount: g("expInsOther"), category: "Insurance" },
                                      { label: "Childcare", amount: g("expChildcare"), category: "Family" },
                                      { label: "Child Education", amount: g("expChildEducation"), category: "Family" },
                                      { label: "Alimony Paid", amount: g("expAlimonyPaid"), category: "Family" },
                                      { label: "Support of Others", amount: g("expSupportOthers"), category: "Family" },
                                      { label: "Charitable Giving", amount: g("expCharitable"), category: "Other" },
                                      { label: "Additional Taxes", amount: g("expAddlTaxes"), category: "Other" },
                                      { label: "Gov. Fines / Fees", amount: g("expGovFines"), category: "Other" },
                                      { label: "Other Expenses", amount: g("expOther"), category: "Other" },
                                    ].filter(e => e.amount > 0);

                                    const catColors: Record<string, string> = {
                                      Housing: "bg-blue-500/20 text-blue-300",
                                      Utilities: "bg-cyan-500/20 text-cyan-300",
                                      Living: "bg-green-500/20 text-green-300",
                                      Transportation: "bg-amber-500/20 text-amber-300",
                                      Health: "bg-rose-500/20 text-rose-300",
                                      Insurance: "bg-purple-500/20 text-purple-300",
                                      Family: "bg-pink-500/20 text-pink-300",
                                      Other: "bg-slate-600/40 text-slate-400",
                                    };

                                    return (
                                      <div className="rounded-lg border border-slate-700/50 overflow-hidden mb-2">
                                        {/* ── PANEL HEADER ── */}
                                        <div className="bg-slate-800/80 px-3 py-2.5 border-b border-slate-700/50 flex items-center justify-between">
                                          <div>
                                            <p className="text-[11px] font-bold text-white">Means Test 122c Calculated Income</p>
                                            <p className="text-[9px] text-slate-500 mt-0.5">Official Form 122C-1</p>
                                          </div>
                                          <div className="flex gap-2">
                                            <button onClick={() => setIncExpModal({ mode: "income", chapter: "13" })} className="text-[9px] text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">View / Edit Income</button>
                                          </div>
                                        </div>

                                        {/* ── SCHEDULE I — INCOME ── */}
                                        <div className="px-3 pt-2.5 pb-2 border-b border-slate-700/40 bg-slate-900/30">
                                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Means Test 122c Calculated Income</p>

                                          {/* Self-Employment */}
                                          {(seDebtorSrcs.length > 0 || seSpouseSrcs.length > 0) && (
                                            <div className="mb-2">
                                              <div className="flex items-center gap-1.5 mb-1">
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 uppercase tracking-wide">Self-Employment</span>
                                              </div>
                                              {[...seDebtorSrcs.map(s => ({ ...s, _who: "Debtor" })), ...seSpouseSrcs.map(s => ({ ...s, _who: "Spouse" }))].map((s, i) => {
                                                const gross = parseFloat(s.businessGrossIncome as string) || 0;
                                                const bizExp = parseFloat(s.businessExpenses as string) || 0;
                                                const net = gross - bizExp;
                                                const name = (s.businessName as string) || `${s._who} Business`;
                                                return (
                                                  <div key={i} className="pl-2 mb-1.5 border-l-2 border-orange-500/30">
                                                    <div className="flex items-center justify-between">
                                                      <span className="text-[10px] text-white font-semibold">{name}</span>
                                                      <span className="text-[9px] text-slate-500">{s._who}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px] mt-0.5">
                                                      <span className="text-slate-500">Gross Receipts</span>
                                                      <span className="text-slate-300 tabular-nums">{fmt(gross)}/mo</span>
                                                    </div>
                                                    {bizExp > 0 && (
                                                      <div className="flex justify-between text-[10px]">
                                                        <span className="text-slate-500">Business Expenses</span>
                                                        <span className="text-rose-400/80 tabular-nums">({fmt(bizExp)})/mo</span>
                                                      </div>
                                                    )}
                                                    <div className="flex justify-between text-[10px] font-semibold border-t border-slate-700/30 mt-0.5 pt-0.5">
                                                      <span className="text-slate-400">Net Self-Emp.</span>
                                                      <span className={`tabular-nums ${net >= 0 ? "text-orange-300" : "text-red-400"}`}>{fmt(net)}/mo</span>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                              {(seDebtorSrcs.length + seSpouseSrcs.length) > 1 && (
                                                <div className="flex justify-between text-[10px] font-bold text-orange-300/80 pl-2 mb-1">
                                                  <span>SE Total (Gross used for Ch.13 DMI)</span>
                                                  <span className="tabular-nums">{fmt(totalSEGross)}/mo</span>
                                                </div>
                                              )}
                                              <p className="text-[9px] text-slate-600 pl-2 leading-relaxed">Ch. 13 uses gross receipts — no expense deduction per In re Sorrell &amp; circuit authority</p>
                                            </div>
                                          )}

                                          {/* Wages */}
                                          {(wgDebtorSrcs.filter(s => s.sourceType !== "retirement").length > 0 || wgSpouseSrcs.filter(s => s.sourceType !== "retirement").length > 0) && (
                                            <div className="mb-2">
                                              <div className="flex items-center gap-1.5 mb-1">
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 uppercase tracking-wide">Wages / Employment</span>
                                              </div>
                                              {[
                                                ...wgDebtorSrcs.filter(s => s.sourceType !== "retirement").map(s => ({ ...s, _who: "Debtor" })),
                                                ...wgSpouseSrcs.filter(s => s.sourceType !== "retirement").map(s => ({ ...s, _who: "Spouse" }))
                                              ].map((s, i) => {
                                                const gross = wageGross(s);
                                                const net = wageNet(s);
                                                const ded = gross - net;
                                                const emp = (s.employerName as string) || `${s._who} Employer`;
                                                return (
                                                  <div key={i} className="pl-2 mb-1.5 border-l-2 border-slate-600/50">
                                                    <div className="flex items-center justify-between">
                                                      <span className="text-[10px] text-white font-semibold">{emp}</span>
                                                      <span className="text-[9px] text-slate-500">{s._who}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px] mt-0.5">
                                                      <span className="text-slate-500">Gross Pay</span>
                                                      <span className="text-slate-300 tabular-nums">{fmt(gross)}/mo</span>
                                                    </div>
                                                    {ded > 0 && (
                                                      <div className="flex justify-between text-[10px]">
                                                        <span className="text-slate-500">Deductions (taxes, benefits)</span>
                                                        <span className="text-rose-400/80 tabular-nums">({fmt(ded)})/mo</span>
                                                      </div>
                                                    )}
                                                    <div className="flex justify-between text-[10px] font-semibold border-t border-slate-700/30 mt-0.5 pt-0.5">
                                                      <span className="text-slate-400">Net Take-Home</span>
                                                      <span className="text-slate-200 tabular-nums">{fmt(net)}/mo</span>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                              {(wgDebtorSrcs.filter(s=>s.sourceType!=="retirement").length + wgSpouseSrcs.filter(s=>s.sourceType!=="retirement").length) > 1 && (
                                                <div className="flex justify-between text-[10px] font-bold text-slate-300 pl-2 mb-1">
                                                  <span>Total Wage Gross / Net</span>
                                                  <span className="tabular-nums">{fmt(totalWageGross)} / {fmt(totalWageNet)}</span>
                                                </div>
                                              )}
                                            </div>
                                          )}

                                          {/* Retirement / Other CMI Sources */}
                                          {(retDebtorSrcs.length > 0 || retSpouseSrcs.length > 0 || ch13OtherNonSS.length > 0) && (
                                            <div className="mb-2">
                                              <div className="flex items-center gap-1.5 mb-1">
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 uppercase tracking-wide">Retirement &amp; Other CMI Sources</span>
                                              </div>
                                              <div className="pl-2 border-l-2 border-slate-700/50 space-y-0.5">
                                                {[...retDebtorSrcs.map(s=>({...s,_who:"Debtor"})),...retSpouseSrcs.map(s=>({...s,_who:"Spouse"}))].map((s,i) => (
                                                  <div key={i} className="flex justify-between text-[10px]">
                                                    <span className="text-slate-400">{(s.employerName as string) || "Retirement"} <span className="text-slate-600">({s._who as string})</span></span>
                                                    <span className="text-slate-300 tabular-nums">{fmt(wageNet(s))}/mo</span>
                                                  </div>
                                                ))}
                                                {ch13OtherNonSS.map((o,i) => (
                                                  <div key={i} className="flex justify-between text-[10px]">
                                                    <span className="text-slate-400">{o.label}</span>
                                                    <span className="text-slate-300 tabular-nums">{fmt(o.amount)}/mo</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {/* Non-CMI Sources — SS and VA (excluded from standard DMI) */}
                                          {(() => {
                                            const nonCMI13Items = [
                                              ...(ch13SSExcluded > 0 ? [{ label: "Social Security / SSDI", amount: ch13SSExcluded }] : []),
                                              ...(ch13VAExcluded > 0 ? [{ label: "VA Disability Compensation", amount: ch13VAExcluded }] : []),
                                            ];
                                            if (ch13TotalNonCMI === 0) return null;
                                            return (
                                              <div className="mb-2">
                                                <div className="flex items-center justify-between mb-1">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 uppercase tracking-wide">Non-CMI Income</span>
                                                    <button
                                                      onClick={() => setExpandNonCMICh13SchedI(v => !v)}
                                                      className="flex items-center gap-0.5 text-[9px] text-blue-400/60 hover:text-blue-400 transition-colors"
                                                    >
                                                      <span className="tabular-nums font-semibold">{fmt(ch13TotalNonCMI)}/mo</span>
                                                      <span className={`transition-transform text-[10px] ${expandNonCMICh13SchedI ? "rotate-180" : ""}`}>▾</span>
                                                    </button>
                                                  </div>
                                                  <button
                                                    onClick={() => setIncludeNonCMICh13(v => !v)}
                                                    className={`flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded border transition-all ${
                                                      includeNonCMICh13
                                                        ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                                                        : "bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200"
                                                    }`}
                                                  >
                                                    {includeNonCMICh13 ? "✓ In Plan Funding" : "Add to Plan"}
                                                  </button>
                                                </div>
                                                <div className="pl-2 border-l-2 border-blue-500/20 space-y-0.5">
                                                  {nonCMI13Items.map((item, i) => (
                                                    <div key={i} className="flex justify-between text-[10px]">
                                                      <span className="text-slate-400">{item.label} <span className="text-[8px] text-blue-400/50">§ 101(10A)</span></span>
                                                      <span className="text-blue-400/70 tabular-nums">{fmt(item.amount)}/mo</span>
                                                    </div>
                                                  ))}
                                                  {expandNonCMICh13SchedI && (
                                                    <p className="text-[9px] text-slate-600 pt-0.5 leading-snug">Not counted in standard DMI; may be voluntarily applied to plan funding</p>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })()}

                                          {/* Net Total Income Summary Bar */}
                                          <div className="mt-1.5 rounded-md bg-slate-800/60 border border-slate-700/50 px-2.5 py-2">
                                            <div className="flex justify-between text-[11px] font-bold">
                                              <span className="text-white">Debtor(s) Net Total Income</span>
                                              <span className="text-white tabular-nums">{fmt(ch13NetIncome)}/mo</span>
                                            </div>
                                            <div className="mt-1.5 space-y-0.5">
                                              {totalSEGross > 0 && (
                                                <div className="flex justify-between text-[9px]">
                                                  <span className="text-slate-500">Self-Employment (gross)</span>
                                                  <span className="text-orange-300/80 tabular-nums">{fmt(totalSEGross)}</span>
                                                </div>
                                              )}
                                              {totalWageNet > 0 && (
                                                <div className="flex justify-between text-[9px]">
                                                  <span className="text-slate-500">Wages (net take-home)</span>
                                                  <span className="text-slate-300 tabular-nums">{fmt(totalWageNet)}</span>
                                                </div>
                                              )}
                                              {(ch13OtherTotal + [...retDebtorSrcs,...retSpouseSrcs].reduce((a,s)=>a+wageNet(s),0)) > 0 && (
                                                <div className="flex justify-between text-[9px]">
                                                  <span className="text-slate-500">Retirement &amp; Other (net)</span>
                                                  <span className="text-slate-300 tabular-nums">{fmt(ch13OtherTotal + [...retDebtorSrcs,...retSpouseSrcs].reduce((a,s)=>a+wageNet(s),0))}</span>
                                                </div>
                                              )}
                                              {ch13TotalNonCMI > 0 && (
                                                <div className="flex justify-between text-[9px] border-t border-slate-700/30 pt-0.5 mt-0.5">
                                                  <span className="text-blue-400/70">+ Non-CMI Income (SS/VA) <span className="text-slate-600 font-normal">§ 101(10A)</span></span>
                                                  <span className="text-blue-400/70 tabular-nums">+{fmt(ch13TotalNonCMI)}</span>
                                                </div>
                                              )}
                                            </div>
                                            {ch13TotalNonCMI > 0 && (
                                              <div className="flex justify-between text-[10px] font-bold border-t border-slate-700/40 mt-1.5 pt-1.5">
                                                <span className="text-blue-300">Total Net Income (incl. Non-CMI)</span>
                                                <span className="text-blue-300 tabular-nums">{fmt(ch13NetIncomeBoosted)}/mo</span>
                                              </div>
                                            )}
                                            {includeNonCMICh13 && ch13TotalNonCMI > 0 && (
                                              <div className="flex justify-between text-[9px] font-semibold mt-1 pt-0.5">
                                                <span className="text-blue-400">Non-CMI applied to plan funding</span>
                                                <span className="text-blue-400 tabular-nums">✓</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* ── SCHEDULE J — EXPENSES ── */}
                                        <div className="px-3 pt-2.5 pb-2 bg-slate-900/20">
                                          <div className="flex items-center justify-between mb-2">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Schedule J — Monthly Expenses</p>
                                            <button onClick={() => setIncExpModal({ mode: "expenses", chapter: "13" })} className="text-[9px] text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">View / Edit Expenses</button>
                                          </div>
                                          {expGroups.length === 0 ? (
                                            <p className="text-[10px] text-slate-600 italic">No expenses entered.</p>
                                          ) : (
                                            <div className="space-y-0.5">
                                              {expGroups.map((e, i) => (
                                                <div key={i} className={`flex items-center justify-between text-[10px] ${e.planBacked ? "opacity-50" : ""}`}>
                                                  <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className={`text-[8px] font-bold px-1 py-0.5 rounded shrink-0 ${catColors[e.category] ?? "bg-slate-700 text-slate-400"}`}>{e.category}</span>
                                                    <span className={`truncate ${e.planBacked ? "text-slate-500 line-through" : "text-slate-300"}`}>{e.label}</span>
                                                    {e.planBacked && <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-teal-500/20 text-teal-400 shrink-0">paid through plan</span>}
                                                  </div>
                                                  <span className={`tabular-nums ml-2 shrink-0 ${e.planBacked ? "text-slate-600" : "text-slate-400"}`}>{fmt(e.amount)}/mo</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                          {/* Expense total + DMI */}
                                          <div className="mt-2.5 pt-2 border-t border-slate-700/50 space-y-1">
                                            {(ch13MortgagePlanBacked > 0 || ch13VehPlanBacked > 0) && (
                                              <div className="flex justify-between text-[9px] text-slate-600">
                                                <span>Mortgage &amp; vehicle payments backed out — paid through plan</span>
                                                <span className="tabular-nums">({fmt(ch13MortgagePlanBacked + ch13VehPlanBacked)})</span>
                                              </div>
                                            )}
                                            <div className="flex justify-between text-[10px] font-semibold">
                                              <span className="text-slate-400">Monthly Expenses (excl. plan payments)</span>
                                              <span className="text-slate-300 tabular-nums">({fmt(totalExp13)})/mo</span>
                                            </div>
                                            <div className="flex justify-between text-[10px]">
                                              <span className="text-slate-500">Net Monthly Income</span>
                                              <span className="text-white tabular-nums">{fmt(ch13NetIncome)}/mo</span>
                                            </div>
                                            <div className="h-px bg-slate-700/60 my-1" />
                                            <div className="flex justify-between text-[11px] font-bold">
                                              <span className="text-white">Disposable Monthly Income (DMI)</span>
                                              <span className={`tabular-nums ${ch13EffDMI >= 100 ? "text-green-400" : ch13EffDMI >= 0 ? "text-amber-400" : "text-red-400"}`}>{fmt(ch13EffDMI)}/mo</span>
                                            </div>
                                            {includeNonCMICh13 && ch13TotalNonCMI > 0 && (
                                              <div className="flex justify-between text-[9px] text-blue-400/80 pl-3">
                                                <span>Includes +{fmt(ch13TotalNonCMI)}/mo SS/VA (non-CMI, voluntary)</span>
                                              </div>
                                            )}
                                            <div className="flex justify-between text-[10px] pl-3">
                                              <span className="text-slate-500">× 60 months</span>
                                              <span className={`font-bold tabular-nums ${ch13Pool60 > 0 ? "text-green-400" : "text-red-400"}`}>{fmt(ch13Pool60)} pool</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* ── PLAN FUNDING NEEDED ── */}
                                  <div className="bg-slate-800/40 rounded-lg border border-slate-700/40 px-3 py-2.5 mb-2">
                                    <div className="flex items-center justify-between mb-1.5 gap-2">
                                      <p className="text-[10px] text-slate-200 uppercase tracking-wider font-bold">Plan Funding Needed</p>
                                      <div className="flex items-center gap-1.5">
                                        {gridTillRate != null ? (
                                          <span className="text-[9px] text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded px-1.5 py-0.5">
                                            Till {gridTillRate.toFixed(2)}% (Prime {gridPrimeRate!.toFixed(2)}% + 3%)
                                            {gridPrimeAsOf && gridPrimeAsOf !== "manual" && <span className="text-blue-400/60"> · {gridPrimeAsOf}</span>}
                                            {gridPrimeAsOf === "manual" && <span className="text-amber-400/80"> · manual</span>}
                                          </span>
                                        ) : gridPrimeError ? (
                                          <span className="text-[9px] text-red-400">{gridPrimeError}</span>
                                        ) : null}
                                        {gridModifyingRate ? (
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              placeholder="Prime %"
                                              value={gridModifyInput}
                                              onChange={e => setGridModifyInput(e.target.value)}
                                              onKeyDown={e => { if (e.key === "Enter") applyGridModifiedRate(); if (e.key === "Escape") { setGridModifyingRate(false); setGridModifyInput(""); } }}
                                              autoFocus
                                              className="w-16 text-[9px] px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 text-white focus:outline-none focus:border-blue-400"
                                            />
                                            <button onClick={applyGridModifiedRate} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30">Apply</button>
                                            <button onClick={() => { setGridModifyingRate(false); setGridModifyInput(""); }} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 text-slate-400 hover:bg-slate-600">X</button>
                                          </div>
                                        ) : (
                                          <>
                                            <button
                                              onClick={() => { setGridModifyingRate(true); setGridModifyInput(gridPrimeRate != null ? String(gridPrimeRate) : ""); }}
                                              className="flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded border transition-all bg-slate-700/60 border-slate-600/60 text-slate-300 hover:bg-slate-700"
                                            >
                                              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                              Modify
                                            </button>
                                            <button
                                              onClick={() => window.open("https://www.fedprimerate.com/", "_blank")}
                                              disabled={gridPrimeLoading}
                                              className="flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded border transition-all disabled:opacity-50 bg-blue-500/10 border-blue-500/25 text-blue-400 hover:bg-blue-500/20"
                                            >
                                              {gridPrimeLoading ? (
                                                <svg className="animate-spin w-2.5 h-2.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                              ) : (
                                                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                              )}
                                              {gridTillRate != null ? "Re-verify" : "Verify Prime Rate"}
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    {/* Secured Obligations — collapsible */}
                                    <button
                                      onClick={() => setExpandedSecured(v => !v)}
                                      className="flex justify-between items-center w-full text-[11px] font-semibold text-blue-300 py-0.5 hover:text-blue-200 transition-colors"
                                    >
                                      <span className="flex items-center gap-1">
                                        <ChevronRight size={10} className={`transition-transform duration-150 ${expandedSecured ? "rotate-90" : ""}`} />
                                        Secured Obligations
                                      </span>
                                      <span className="tabular-nums">{fmt(totalSecObl)}</span>
                                    </button>
                                    {expandedSecured && (
                                      <div className="pl-3 mb-0.5 border-l border-blue-500/20 ml-1">
                                        {mortConduit60 > 0 && (
                                          <>
                                            <div className="flex justify-between text-[10px] text-slate-400 py-0.5">
                                              <span>Home conduit (60 mo)</span>
                                              <span className="tabular-nums">{fmt(mortConduit60)}</span>
                                            </div>
                                            {keptPropsInline.map((p, i) => {
                                              const monthly = parseFloat((p.monthlyPayment as string) ?? "0") || 0;
                                              const addr = (p.propertyAddress as string) || `Property ${i + 1}`;
                                              return monthly > 0 ? (
                                                <div key={i} className="pl-3 pb-0.5">
                                                  <div className="flex justify-between text-[9px] text-slate-500">
                                                    <span>{addr} — {fmt(monthly)}/mo × 60</span>
                                                    <span className="tabular-nums">{fmt(monthly * 60)}</span>
                                                  </div>
                                                  <div className="text-[9px] text-slate-600">60 mos of regular mortgage pmt</div>
                                                </div>
                                              ) : null;
                                            })}
                                          </>
                                        )}
                                        {mortArrearsAmt > 0 && <div className="flex justify-between text-[10px] text-slate-400 py-0.5"><span>Mortgage arrears (cure)</span><span className="tabular-nums">{fmt(mortArrearsAmt)}</span></div>}
                                        {vehPayoff > 0 && (
                                          <>
                                            <div className="flex justify-between text-[10px] text-slate-400 py-0.5">
                                              <span>Vehicle payoff ({keptVehsInline.length} vehicle{keptVehsInline.length !== 1 ? "s" : ""})</span>
                                              <span className="tabular-nums">{fmt(vehPayoff)}</span>
                                            </div>
                                            {keptVehsInline.every(v => effectiveVehRate(v, gridTillRate).rate == null) && (
                                              <div className="pl-3 pb-0.5 flex items-center gap-1">
                                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 flex-shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                                <span className="text-[9px] text-amber-400">Using principal only — verify prime rate or enter contract rate to apply Till formula and auto-adjust for interest</span>
                                              </div>
                                            )}
                                            {keptVehsInline.map((v, i) => {
                                              const lien = parseFloat((v.loanBalance as string) ?? "0") || 0;
                                              const { rate, source } = effectiveVehRate(v, gridTillRate);
                                              const amort = rate != null ? calcAmortizedTotal(lien, rate, 60) : lien;
                                              const label = `${(v.year as string) ?? ""} ${(v.make as string) ?? ""} ${(v.model as string) ?? ""}`.trim() || `Vehicle ${i + 1}`;
                                              const rateLabel = source === "contract" ? ` — @ ${rate!.toFixed(2)}% contract (lower than Till)` : source === "till" ? ` — @ ${rate!.toFixed(2)}% Till` : " — principal only (no rate)";
                                              return lien > 0 ? (
                                                <div key={i} className="pl-3 pb-0.5">
                                                  <div className="flex justify-between text-[9px] text-slate-500">
                                                    <span>{label}{rateLabel}</span>
                                                    <span className="tabular-nums">{fmt(amort)}</span>
                                                  </div>
                                                  {rate != null && amort > lien && (
                                                    <div className="flex justify-between text-[9px] text-slate-600 pl-2">
                                                      <span>{fmt(lien)} principal + {fmt(amort - lien)} interest</span>
                                                    </div>
                                                  )}
                                                </div>
                                              ) : null;
                                            })}
                                          </>
                                        )}
                                      </div>
                                    )}

                                    {/* Priority Debt — collapsible */}
                                    {priorityTotal > 0 && (
                                      <>
                                        <button
                                          onClick={() => setExpandedPriority(v => !v)}
                                          className="flex justify-between items-center w-full text-[11px] font-semibold text-orange-300 py-0.5 mt-0.5 hover:text-orange-200 transition-colors"
                                        >
                                          <span className="flex items-center gap-1">
                                            <ChevronRight size={10} className={`transition-transform duration-150 ${expandedPriority ? "rotate-90" : ""}`} />
                                            Priority Debt
                                          </span>
                                          <span className="tabular-nums">{fmt(priorityTotal)}</span>
                                        </button>
                                        {expandedPriority && (
                                          <div className="pl-3 mb-0.5 border-l border-orange-500/20 ml-1">
                                            {taxDebt > 0 && <div className="flex justify-between text-[10px] text-slate-400 py-0.5"><span>Tax debt (IRS / State)</span><span className="tabular-nums">{fmt(taxDebt)}</span></div>}
                                            {inlineDSOArrears > 0 && <div className="flex justify-between text-[10px] text-slate-400 py-0.5"><span>DSO arrears (child support / alimony)</span><span className="tabular-nums">{fmt(inlineDSOArrears)}</span></div>}
                                            {inlinePriorityDebtsBal > 0 && <div className="flex justify-between text-[10px] text-slate-400 py-0.5"><span>Other priority debts ({inlinePriorityDebts.length} claim{inlinePriorityDebts.length !== 1 ? "s" : ""})</span><span className="tabular-nums">{fmt(inlinePriorityDebtsBal)}</span></div>}
                                            {(childSup > 0 || alimonyAmt > 0) && <div className="flex justify-between text-[10px] text-slate-400 py-0.5"><span>Ongoing domestic support (60 mo)</span><span className="tabular-nums">{fmt((childSup + alimonyAmt) * 60)}</span></div>}
                                          </div>
                                        )}
                                      </>
                                    )}

                                    {/* Ch. 7 Liquidation Analysis — collapsible */}
                                    <button
                                      onClick={() => setExpandedLiquidation(v => !v)}
                                      className={`flex justify-between items-center w-full text-[11px] font-semibold py-0.5 mt-0.5 transition-colors ${ch7LiqFloor > 0 ? "text-rose-300 hover:text-rose-200" : "text-slate-500 hover:text-slate-400"}`}
                                    >
                                      <span className="flex items-center gap-1">
                                        <ChevronRight size={10} className={`transition-transform duration-150 ${expandedLiquidation ? "rotate-90" : ""}`} />
                                        <span className="flex flex-col items-start">
                                          <span>Ch. 7 Liquidation Analysis</span>
                                          <span className="text-[9px] font-normal text-slate-500 leading-tight">minimum amount needed to pay general unsecured non-priority creditors</span>
                                        </span>
                                      </span>
                                      <span className="tabular-nums">{ch7LiqFloor > 0 ? fmt(ch7LiqFloor) : "None"}</span>
                                    </button>
                                    {expandedLiquidation && (
                                      <div className="pl-3 mb-0.5 border-l border-rose-500/20 ml-1">
                                        <p className="text-[9px] text-slate-500 py-0.5">Plan must pay unsecured creditors at least the liquidation value of non-exempt assets (11 U.S.C. § 1325(a)(4))</p>
                                        {keptPropsInline.map((p, i) => {
                                          const fmv = parseFloat((p.propertyValue as string) ?? "0") || 0;
                                          const mortgage = parseFloat((p.loanBalance as string) ?? "0") || 0;
                                          const homestead = i === 0 ? inlineHomestead : 0;
                                          const equity = fmv - mortgage;
                                          const nonExempt = Math.max(equity - homestead, 0);
                                          const addr = (p.propertyAddress as string) || `Property ${i + 1}`;
                                          return (
                                            <div key={i} className="py-0.5">
                                              <div className="flex justify-between text-[10px] text-slate-400">
                                                <span>{addr}</span>
                                                <span className={`tabular-nums ${nonExempt > 0 ? "text-rose-400" : "text-green-400"}`}>{nonExempt > 0 ? fmt(nonExempt) : "Exempt"}</span>
                                              </div>
                                              {i === 0 && inlineHomesteadIncomplete && (
                                                <div className="flex justify-between text-[9px] text-amber-400 pl-2">
                                                  <span>WA homestead</span>
                                                  <span>Incomplete — data needed</span>
                                                </div>
                                              )}
                                              {i === 0 && !inlineHomesteadIncomplete && homestead > 0 && (
                                                <div className="flex justify-between text-[9px] text-slate-500 pl-2">
                                                  <span>Homestead exemption</span>
                                                  <span className="tabular-nums text-green-500">({fmt(homestead)})</span>
                                                </div>
                                              )}
                                              {i > 0 && (
                                                <div className="text-[9px] text-slate-500 pl-2">No homestead (non-primary)</div>
                                              )}
                                            </div>
                                          );
                                        })}
                                        {keptVehsInline.map((v, i) => {
                                          const val = parseFloat((v.value as string) ?? "0") || 0;
                                          const lien = parseFloat((v.loanBalance as string) ?? "0") || 0;
                                          const equity = val - lien;
                                          const nonExempt = Math.max(equity - inlineVehicle, 0);
                                          const label = `${(v.year as string) ?? ""} ${(v.make as string) ?? ""} ${(v.model as string) ?? ""}`.trim() || `Vehicle ${i + 1}`;
                                          return (
                                            <div key={i} className="py-0.5">
                                              <div className="flex justify-between text-[10px] text-slate-400">
                                                <span>{label}</span>
                                                <span className={`tabular-nums ${nonExempt > 0 ? "text-rose-400" : "text-green-400"}`}>{nonExempt > 0 ? fmt(nonExempt) : "Exempt"}</span>
                                              </div>
                                              {inlineVehicle > 0 && (
                                                <div className="flex justify-between text-[9px] text-slate-500 pl-2">
                                                  <span>Vehicle exemption</span>
                                                  <span className="tabular-nums text-green-500">({fmt(Math.min(Math.max(equity, 0), inlineVehicle))})</span>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                        {/*
                                          Personal-property + business-equity inline rows were
                                          referencing variables (inlinePersonalPropSubtotal,
                                          nonExemptPersonalProp, inlinePersonalExemption,
                                          nonExemptBizEquity) that source code never declared
                                          in this scope — would have ReferenceError'd at runtime.
                                          Removed pending a re-derivation pass that uses the same
                                          rec* totals computed above.
                                        */}
                                        <div className="flex justify-between text-[10px] font-bold text-slate-300 pt-1 border-t border-slate-700/40 mt-0.5">
                                          <span>Total Liquidation Floor</span>
                                          <span className={`tabular-nums ${ch7LiqFloor > 0 ? "text-rose-300" : "text-green-400"}`}>{ch7LiqFloor > 0 ? fmt(ch7LiqFloor) : "$0"}</span>
                                        </div>
                                      </div>
                                    )}

                                    <div className="flex justify-between text-[11px] font-semibold text-amber-300 py-0.5 mt-0.5">
                                      <span>Attorney Fees</span>
                                      <span className="tabular-nums">{fmt(attyFees13)}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 pl-3 pb-0.5">Flat $3,000 attorney fee disbursed through plan</p>

                                    <div className="flex justify-between text-[11px] font-semibold text-yellow-300/80 py-0.5">
                                      <span>Trustee Fee (10%)</span>
                                      <span className="tabular-nums">{fmt(trusteeFee13)}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 pl-3 pb-0.5">10% of all plan disbursements</p>

                                    <div className="flex justify-between text-[11px] font-bold pt-1.5 border-t border-slate-700/60 mt-1">
                                      <span className="text-white">Total Plan Minimum</span>
                                      <span className="text-white tabular-nums">{fmt(totalPlanNeeded)}</span>
                                    </div>

                                    <div className="flex justify-between text-[11px] font-semibold text-slate-300 pt-1 mt-0.5">
                                      <span>Debtor(s) DMI x 60</span>
                                      <span className="tabular-nums">{fmt(ch13Pool60)}</span>
                                    </div>

                                    {(() => {
                                      const shortfall = totalPlanNeeded - ch13Pool60;
                                      const unsecuredWithTrustee = unsecuredNonPriority * 1.10;
                                      const total100PlanNeeded = totalPlanNeeded + unsecuredWithTrustee;
                                      const can100Percent = ch13Pool60 >= total100PlanNeeded;
                                      const monthly100Plan = total100PlanNeeded / 60;

                                      if (shortfall > 0) {
                                        return (
                                          <div className="flex justify-between text-[11px] font-bold text-red-400 pt-0.5">
                                            <span>Plan Funding Shortfall</span>
                                            <span className="tabular-nums">({fmt(shortfall)})</span>
                                          </div>
                                        );
                                      } else if (can100Percent) {
                                        return (
                                          <div className="pt-1 mt-0.5 rounded-lg border border-green-500/30 bg-green-500/8 px-2 py-1.5 space-y-0.5">
                                            <div className="flex justify-between text-[11px] font-bold text-green-300">
                                              <span>100% Plan Payment</span>
                                              <span className="tabular-nums">{fmt(monthly100Plan)}/mo</span>
                                            </div>
                                            <p className="text-[10px] text-green-500/70">DMI covers 100% of all creditors — trustee will accept {fmt(monthly100Plan)}/mo instead of full DMI</p>
                                          </div>
                                        );
                                      } else {
                                        return (
                                          <div className="flex justify-between text-[11px] font-bold text-green-400 pt-0.5">
                                            <span>Plan Surplus (partial unsecured payout)</span>
                                            <span className="tabular-nums">{fmt(Math.abs(shortfall))}</span>
                                          </div>
                                        );
                                      }
                                    })()}
                                  </div>

                                  {/* ── CH. 13 CONFIRMATION ANALYSIS ── */}
                                  <div className="rounded-lg border border-slate-700/50 overflow-hidden">
                                    <div className="bg-slate-800/70 px-3 py-2 border-b border-slate-700/50 flex items-center justify-between">
                                      <p className="text-[10px] text-white uppercase tracking-wider font-bold">Ch. 13 — Confirmation Analysis</p>
                                      <span className="text-[9px] text-slate-500">11 U.S.C. § 1325</span>
                                    </div>

                                    {/* DMI Pool header row */}
                                    <div className="flex items-center justify-between px-3 py-2 bg-slate-800/40 border-b border-slate-700/40">
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-4 h-4 rounded bg-slate-600 flex items-center justify-center">
                                          <span className="text-[8px] font-bold text-white">$</span>
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-200">60-Month DMI Pool Available</span>
                                      </div>
                                      <span className={`text-[12px] font-bold tabular-nums ${ch13Pool60 > 0 ? "text-green-400" : "text-red-400"}`}>{fmt(ch13Pool60)}</span>
                                    </div>

                                    {/* Element 1 — Pay All Secured Creditors */}
                                    <div className={`border-b border-slate-700/40 ${fundsSec ? "bg-green-500/5" : "bg-red-500/5"}`}>
                                      <button
                                        onClick={() => setExpandedConfEl1(v => !v)}
                                        className="flex items-center justify-between w-full px-3 pt-2 pb-2 text-left"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${fundsSec ? "bg-green-500/20 text-green-300 border border-green-500/40" : "bg-red-500/20 text-red-300 border border-red-500/40"}`}>1</div>
                                          {fundsSec ? <CheckCircle size={11} className="text-green-400 flex-shrink-0" /> : <XCircle size={11} className="text-red-400 flex-shrink-0" />}
                                          <span className="text-[11px] font-bold text-white">Pay All Secured Creditors</span>
                                          <ChevronRight size={10} className={`text-slate-500 transition-transform duration-150 ${expandedConfEl1 ? "rotate-90" : ""}`} />
                                        </div>
                                        <span className={`text-[11px] font-bold tabular-nums flex-shrink-0 ml-2 ${fundsSec ? "text-blue-300" : "text-red-400"}`}>{fmt(totalSecObl)}</span>
                                      </button>
                                      {expandedConfEl1 && (
                                        <div className="px-3 pb-3 pl-10 space-y-1">
                                          <p className="text-[10px] text-slate-500 pb-0.5">Conduit payments + mortgage arrears cure + vehicle lien payoffs (11 U.S.C. § 1325(a)(5))</p>
                                          {totalSecObl > 0 && (
                                            <div className="space-y-0.5">
                                              {mortConduit60 > 0 && (
                                                <>
                                                  <div className="flex justify-between text-[10px]">
                                                    <span className="text-slate-500">Home conduit (60 mo)</span>
                                                    <span className="text-slate-400 tabular-nums">{fmt(mortConduit60)}</span>
                                                  </div>
                                                  {keptProps.map((p, i) => {
                                                    const monthly = parseFloat((p.monthlyPayment as string) ?? "0") || 0;
                                                    const addr = (p.propertyAddress as string) || `Property ${i + 1}`;
                                                    return monthly > 0 ? (
                                                      <div key={i} className="pl-3">
                                                        <div className="flex justify-between text-[9px] text-slate-500">
                                                          <span>{addr} — {fmt(monthly)}/mo × 60</span>
                                                          <span className="tabular-nums">{fmt(monthly * 60)}</span>
                                                        </div>
                                                        <div className="text-[9px] text-slate-600">60 mos of regular mortgage pmt</div>
                                                      </div>
                                                    ) : null;
                                                  })}
                                                </>
                                              )}
                                              {mortArrearsAmt > 0 && <div className="flex justify-between text-[10px]"><span className="text-slate-500">Mortgage arrears</span><span className="text-slate-400 tabular-nums">{fmt(mortArrearsAmt)}</span></div>}
                                              {vehPayoff > 0 && (
                                                <>
                                                  <div className="flex justify-between text-[10px]">
                                                    <span className="text-slate-500">Vehicle payoffs ({keptVehs.length} vehicle{keptVehs.length !== 1 ? "s" : ""})</span>
                                                    <span className="text-slate-400 tabular-nums">{fmt(vehPayoff)}</span>
                                                  </div>
                                                  {keptVehs.every(v => effectiveVehRate(v, gridTillRate).rate == null) && (
                                                    <div className="pl-3 flex items-center gap-1">
                                                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 flex-shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                                      <span className="text-[9px] text-amber-400">Using principal only — verify prime rate or enter contract rate to apply Till formula and auto-adjust for interest</span>
                                                    </div>
                                                  )}
                                                  {keptVehs.map((v, i) => {
                                                    const lien = parseFloat((v.loanBalance as string) ?? "0") || 0;
                                                    const { rate, source } = effectiveVehRate(v, gridTillRate);
                                                    const amort = rate != null ? calcAmortizedTotal(lien, rate, 60) : lien;
                                                    const label = `${(v.year as string) ?? ""} ${(v.make as string) ?? ""} ${(v.model as string) ?? ""}`.trim() || `Vehicle ${i + 1}`;
                                                    const rateLabel = source === "contract" ? ` — @ ${rate!.toFixed(2)}% contract (lower than Till)` : source === "till" ? ` — @ ${rate!.toFixed(2)}% Till` : " — principal only (no rate)";
                                                    return lien > 0 ? (
                                                      <div key={i} className="pl-3">
                                                        <div className="flex justify-between text-[9px] text-slate-500">
                                                          <span>{label}{rateLabel}</span>
                                                          <span className="tabular-nums">{fmt(amort)}</span>
                                                        </div>
                                                        {rate != null && amort > lien && (
                                                          <div className="flex justify-between text-[9px] text-slate-600 pl-2">
                                                            <span>{fmt(lien)} principal + {fmt(amort - lien)} interest</span>
                                                          </div>
                                                        )}
                                                      </div>
                                                    ) : null;
                                                  })}
                                                </>
                                              )}
                                            </div>
                                          )}
                                          <div className={`px-2 py-1 rounded text-[10px] flex justify-between mt-1 ${fundsSec ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                                            <span>Remaining after secured</span>
                                            <span className="font-semibold tabular-nums">{remainAfterSec >= 0 ? fmt(remainAfterSec) : `(${fmt(Math.abs(remainAfterSec))} deficit)`}</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Element 2 — Pay All Priority Debts */}
                                    <div className={`border-b border-slate-700/40 ${fundsPri ? "bg-green-500/5" : priorityTotal === 0 ? "bg-slate-800/20" : "bg-red-500/5"}`}>
                                      <button
                                        onClick={() => setExpandedConfEl2(v => !v)}
                                        className="flex items-center justify-between w-full px-3 pt-2 pb-2 text-left"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${fundsPri ? "bg-green-500/20 text-green-300 border border-green-500/40" : priorityTotal === 0 ? "bg-slate-700 text-slate-400 border border-slate-600" : "bg-red-500/20 text-red-300 border border-red-500/40"}`}>2</div>
                                          {priorityTotal === 0
                                            ? <CheckCircle size={11} className="text-green-400 flex-shrink-0" />
                                            : fundsPri ? <CheckCircle size={11} className="text-green-400 flex-shrink-0" /> : <XCircle size={11} className="text-red-400 flex-shrink-0" />}
                                          <span className="text-[11px] font-bold text-white">Pay All Priority Debts</span>
                                          <ChevronRight size={10} className={`text-slate-500 transition-transform duration-150 ${expandedConfEl2 ? "rotate-90" : ""}`} />
                                        </div>
                                        <span className={`text-[11px] font-bold tabular-nums flex-shrink-0 ml-2 ${priorityTotal === 0 ? "text-slate-500" : fundsPri ? "text-orange-300" : "text-red-400"}`}>{priorityTotal === 0 ? "None" : fmt(priorityTotal)}</span>
                                      </button>
                                      {expandedConfEl2 && (
                                        <div className="px-3 pb-3 pl-10 space-y-1">
                                          <p className="text-[10px] text-slate-500 pb-0.5">Back taxes, domestic support obligations, other priority claims (11 U.S.C. § 507, § 1322(a)(2))</p>
                                          {priorityTotal > 0 && (
                                            <div className="space-y-0.5">
                                              {taxDebt > 0 && <div className="flex justify-between text-[10px]"><span className="text-slate-500">Priority tax debt</span><span className="text-slate-400 tabular-nums">{fmt(taxDebt)}</span></div>}
                                              {inlineDSOArrears > 0 && <div className="flex justify-between text-[10px]"><span className="text-slate-500">DSO arrears (child support / alimony)</span><span className="text-slate-400 tabular-nums">{fmt(inlineDSOArrears)}</span></div>}
                                              {inlinePriorityDebtsBal > 0 && <div className="flex justify-between text-[10px]"><span className="text-slate-500">Other priority debts ({inlinePriorityDebts.length} claim{inlinePriorityDebts.length !== 1 ? "s" : ""})</span><span className="text-slate-400 tabular-nums">{fmt(inlinePriorityDebtsBal)}</span></div>}
                                              {(childSup + alimonyAmt) > 0 && <div className="flex justify-between text-[10px]"><span className="text-slate-500">Ongoing domestic support (outside plan)</span><span className="text-slate-400 tabular-nums">{fmt((childSup + alimonyAmt) * 60)} over 60 mo</span></div>}
                                            </div>
                                          )}
                                          {priorityTotal > 0 && (
                                            <div className={`px-2 py-1 rounded text-[10px] flex justify-between mt-1 ${fundsPri ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                                              <span>Remaining after priority</span>
                                              <span className="font-semibold tabular-nums">{remainAfterPri >= 0 ? fmt(remainAfterPri) : `(${fmt(Math.abs(remainAfterPri))} deficit)`}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* Element 3 — Satisfy Liquidation Analysis */}
                                    <div className={`border-b border-slate-700/40 ${fundsLiq ? "bg-green-500/5" : ch7LiqFloor === 0 ? "bg-slate-800/20" : "bg-red-500/5"}`}>
                                      <button
                                        onClick={() => setExpandedConfEl3(v => !v)}
                                        className="flex items-center justify-between w-full px-3 pt-2 pb-2 text-left"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${fundsLiq ? "bg-green-500/20 text-green-300 border border-green-500/40" : ch7LiqFloor === 0 ? "bg-slate-700 text-slate-400 border border-slate-600" : "bg-red-500/20 text-red-300 border border-red-500/40"}`}>3</div>
                                          {ch7LiqFloor === 0
                                            ? <CheckCircle size={11} className="text-green-400 flex-shrink-0" />
                                            : fundsLiq ? <CheckCircle size={11} className="text-green-400 flex-shrink-0" /> : <XCircle size={11} className="text-red-400 flex-shrink-0" />}
                                          <span className="text-[11px] font-bold text-white">Satisfy Liquidation Analysis</span>
                                          <ChevronRight size={10} className={`text-slate-500 transition-transform duration-150 ${expandedConfEl3 ? "rotate-90" : ""}`} />
                                        </div>
                                        <span className={`text-[11px] font-bold tabular-nums flex-shrink-0 ml-2 ${ch7LiqFloor === 0 ? "text-slate-500" : fundsLiq ? "text-rose-300" : "text-red-400"}`}>{ch7LiqFloor === 0 ? "None" : fmt(ch7LiqFloor)}</span>
                                      </button>
                                      {expandedConfEl3 && (
                                        <div className="px-3 pb-3 pl-10 space-y-1">
                                          <p className="text-[10px] text-slate-500 pb-0.5">General unsecured creditors must receive at least as much as they would in a Ch. 7 liquidation — i.e., the value of the debtor's non-exempt property (11 U.S.C. § 1325(a)(4))</p>
                                          {ch7LiqFloor > 0 && (
                                            <div className="space-y-0.5">
                                              <div className="flex justify-between text-[10px]"><span className="text-slate-500">Non-exempt equity (liquidation floor)</span><span className="text-rose-300 tabular-nums">{fmt(ch7LiqFloor)}</span></div>
                                              <div className="flex justify-between text-[10px]"><span className="text-slate-500">Plan pays to unsecured creditors</span><span className={`tabular-nums ${fundsLiq ? "text-green-400" : "text-red-400"}`}>{fmt(Math.max(remainAfterPri, 0))}</span></div>
                                            </div>
                                          )}
                                          {ch7LiqFloor > 0 && (
                                            <div className={`px-2 py-1 rounded text-[10px] flex justify-between mt-1 ${fundsLiq ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                                              <span>Remaining after liq. floor</span>
                                              <span className="font-semibold tabular-nums">{remainAfterLiq >= 0 ? fmt(remainAfterLiq) : `(${fmt(Math.abs(remainAfterLiq))} deficit)`}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* Element 4 — Debtor Pays All DMI */}
                                    {(() => {
                                      const dmiPositive = ch13DMI > 0;
                                      const dmiCoversAll = ch13Pool60 >= totalPlanNeeded;
                                      const dmiEl4Passes = dmiPositive && dmiCoversAll;
                                      return (
                                        <div className={`border-b border-slate-700/40 ${dmiEl4Passes ? "bg-green-500/5" : "bg-red-500/5"}`}>
                                          <button
                                            onClick={() => setExpandedConfEl4(v => !v)}
                                            className="flex items-center justify-between w-full px-3 pt-2 pb-2 text-left"
                                          >
                                            <div className="flex items-center gap-2">
                                              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${dmiEl4Passes ? "bg-green-500/20 text-green-300 border border-green-500/40" : "bg-red-500/20 text-red-300 border border-red-500/40"}`}>4</div>
                                              {dmiEl4Passes ? <CheckCircle size={11} className="text-green-400 flex-shrink-0" /> : <XCircle size={11} className="text-red-400 flex-shrink-0" />}
                                              <span className="text-[11px] font-bold text-white">Debtor Pays All DMI</span>
                                              <ChevronRight size={10} className={`text-slate-500 transition-transform duration-150 ${expandedConfEl4 ? "rotate-90" : ""}`} />
                                            </div>
                                            <span className={`text-[11px] font-bold tabular-nums flex-shrink-0 ml-2 ${dmiEl4Passes ? "text-teal-300" : "text-red-400"}`}>{fmt(Math.max(ch13DMI, 0))}<span className="text-slate-500 font-normal">/mo</span></span>
                                          </button>
                                          {expandedConfEl4 && (
                                            <div className="px-3 pb-3 pl-10 space-y-1">
                                              <p className="text-[10px] text-slate-500 pb-0.5 leading-relaxed">The debtor must pay into the plan all income remaining after deducting reasonable and necessary living expenses. The plan payment equals projected disposable monthly income — what is left over after housing, food, utilities, transportation, and other allowable expenses (11 U.S.C. § 1325(b)(1)(B)).</p>
                                              <div className="space-y-0.5">
                                                <div className="flex justify-between text-[10px]"><span className="text-slate-500">Net monthly income</span><span className="text-slate-400 tabular-nums">{fmt(ch13NetIncome)}</span></div>
                                                <div className="flex justify-between text-[10px]"><span className="text-slate-500">Reasonable &amp; necessary expenses</span><span className="text-slate-400 tabular-nums">({fmt(totalExp13)})</span></div>
                                                <div className="flex justify-between text-[10px] font-semibold border-t border-slate-700/40 pt-0.5 mt-0.5">
                                                  <span className={dmiEl4Passes ? "text-teal-300" : "text-red-400"}>Disposable Monthly Income (DMI)</span>
                                                  <span className={`tabular-nums ${dmiEl4Passes ? "text-teal-300" : "text-red-400"}`}>{fmt(ch13DMI)}</span>
                                                </div>
                                                <div className="flex justify-between text-[10px]"><span className="text-slate-500">60-month DMI pool</span><span className="text-slate-400 tabular-nums">{fmt(ch13Pool60)}</span></div>
                                                <div className="flex justify-between text-[10px]"><span className="text-slate-500">Total plan required</span><span className="text-slate-400 tabular-nums">{fmt(totalPlanNeeded)}</span></div>
                                              </div>
                                              <div className={`px-2 py-1 rounded text-[10px] flex justify-between mt-1 ${dmiEl4Passes ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                                                <span>{dmiEl4Passes ? "DMI fully funds plan" : "DMI insufficient to fund plan"}</span>
                                                <span className="font-semibold tabular-nums">{ch13Pool60 >= totalPlanNeeded ? `+${fmt(ch13Pool60 - totalPlanNeeded)} surplus` : `(${fmt(totalPlanNeeded - ch13Pool60)} shortfall)`}</span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}

                                    {/* Element 5 — Good Faith */}
                                    {(() => {
                                      const allThreeFund = fundsSec && (priorityTotal === 0 || fundsPri) && (ch7LiqFloor === 0 || fundsLiq);
                                      const goodFaithPasses = planFunds && allThreeFund;
                                      return (
                                        <div className={goodFaithPasses ? "bg-green-500/5" : "bg-red-500/5"}>
                                          <button
                                            onClick={() => setExpandedConfEl5(v => !v)}
                                            className="flex items-center justify-between w-full px-3 pt-2 pb-2 text-left"
                                          >
                                            <div className="flex items-center gap-2">
                                              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${goodFaithPasses ? "bg-green-500/20 text-green-300 border border-green-500/40" : "bg-red-500/20 text-red-300 border border-red-500/40"}`}>5</div>
                                              {goodFaithPasses ? <CheckCircle size={11} className="text-green-400 flex-shrink-0" /> : <XCircle size={11} className="text-red-400 flex-shrink-0" />}
                                              <span className="text-[11px] font-bold text-white">Good Faith</span>
                                              <ChevronRight size={10} className={`text-slate-500 transition-transform duration-150 ${expandedConfEl5 ? "rotate-90" : ""}`} />
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ml-2 ${goodFaithPasses ? "text-green-300 bg-green-500/15 border-green-500/40" : "text-red-300 bg-red-500/15 border-red-500/40"}`}>
                                              {goodFaithPasses ? "Present" : "Not Present"}
                                            </span>
                                          </button>
                                          {expandedConfEl5 && (
                                            <div className="px-3 pb-3 pl-10 space-y-1">
                                              <p className="text-[10px] text-slate-500 leading-relaxed">
                                                Good faith confirmation requires elements 1–4 to all be satisfied. The plan must be proposed with genuine intent to reorganize, not to delay or hinder creditors from enforcing their rights. Filing solely to obstruct enforcement without a legitimate reorganization purpose defeats good faith (11 U.S.C. § 1325(a)(3)).
                                              </p>
                                              {!goodFaithPasses && (
                                                <div className="px-2 py-1.5 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-300 space-y-0.5 mt-1">
                                                  {!fundsSec && <div className="flex items-center gap-1.5"><XCircle size={9} className="flex-shrink-0" /><span>Element 1 not satisfied — secured creditors not fully funded</span></div>}
                                                  {priorityTotal > 0 && !fundsPri && <div className="flex items-center gap-1.5"><XCircle size={9} className="flex-shrink-0" /><span>Element 2 not satisfied — priority debts not fully funded</span></div>}
                                                  {ch7LiqFloor > 0 && !fundsLiq && <div className="flex items-center gap-1.5"><XCircle size={9} className="flex-shrink-0" /><span>Element 3 not satisfied — liquidation floor not met</span></div>}
                                                  {!planFunds && <div className="flex items-center gap-1.5"><XCircle size={9} className="flex-shrink-0" /><span>Element 4 not satisfied — DMI pool ({fmt(ch13Pool60)}) does not cover total plan minimum ({fmt(totalPlanNeeded)})</span></div>}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}

                                    {/* ── PLAN FUNDING VISUAL ── */}
                                    {(() => {
                                      const planNeededVal = totalPlanNeeded;
                                      const debtorCanPayVal = ch13Pool60;
                                      const vizMax = Math.max(planNeededVal, debtorCanPayVal, 1);

                                      const secPct = Math.min((totalSecObl / vizMax) * 100, 100);
                                      const priPct = Math.min((priorityTotal / vizMax) * 100, 100);
                                      const liqPct = Math.min((ch7LiqFloor / vizMax) * 100, 100);
                                      const attyPct = Math.min((attyFees13 / vizMax) * 100, 100);
                                      const trusteePct = Math.min((trusteeFee13 / vizMax) * 100, 100);
                                      const debtorBarPct = Math.min((debtorCanPayVal / vizMax) * 100, 100);

                                      const paidToUnsecured = Math.max(remainAfterPri, 0);
                                      const unsecPct = totalUnsecured13 > 0
                                        ? Math.min((paidToUnsecured / totalUnsecured13) * 100, 100)
                                        : 0;

                                      return (
                                        <div className="px-3 py-3 bg-slate-900/60 border-t border-slate-700/40 space-y-4">
                                          {/* Title */}
                                          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Plan Funding Illustration</p>

                                          {/* Bar 1 — Total Plan Needed */}
                                          <div className="space-y-1">
                                            <div className="flex items-center justify-between mb-0.5">
                                              <span className="text-[10px] text-slate-400 font-medium">Total Plan Needed</span>
                                              <span className="text-[10px] font-bold text-white tabular-nums">{fmt(planNeededVal)}</span>
                                            </div>
                                            <div className="h-5 w-full bg-slate-800 rounded-md overflow-hidden flex">
                                              {totalSecObl > 0 && (
                                                <div className="h-full bg-blue-500/75 flex items-center justify-center transition-all" style={{ width: `${secPct}%` }}>
                                                  {secPct > 8 && <span className="text-[8px] font-bold text-white/90 px-0.5 truncate">Sec</span>}
                                                </div>
                                              )}
                                              {priorityTotal > 0 && (
                                                <div className="h-full bg-amber-500/75 flex items-center justify-center transition-all" style={{ width: `${priPct}%` }}>
                                                  {priPct > 8 && <span className="text-[8px] font-bold text-white/90 px-0.5 truncate">Pri</span>}
                                                </div>
                                              )}
                                              {ch7LiqFloor > 0 && (
                                                <div className="h-full bg-rose-500/70 flex items-center justify-center transition-all" style={{ width: `${liqPct}%` }}>
                                                  {liqPct > 8 && <span className="text-[8px] font-bold text-white/90 px-0.5 truncate">Liq</span>}
                                                </div>
                                              )}
                                              {attyFees13 > 0 && (
                                                <div className="h-full bg-slate-500/70 flex items-center justify-center transition-all" style={{ width: `${attyPct}%` }}>
                                                  {attyPct > 8 && <span className="text-[8px] font-bold text-white/90 px-0.5 truncate">Atty</span>}
                                                </div>
                                              )}
                                              {trusteeFee13 > 0 && (
                                                <div className="h-full bg-yellow-600/60 flex items-center justify-center transition-all" style={{ width: `${trusteePct}%` }}>
                                                  {trusteePct > 8 && <span className="text-[8px] font-bold text-white/90 px-0.5 truncate">Trstee</span>}
                                                </div>
                                              )}
                                            </div>
                                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                              {totalSecObl > 0 && <span className="text-[9px] text-slate-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-blue-500/75 inline-block" />Secured {fmt(totalSecObl)}</span>}
                                              {priorityTotal > 0 && <span className="text-[9px] text-slate-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-amber-500/75 inline-block" />Priority {fmt(priorityTotal)}</span>}
                                              {ch7LiqFloor > 0 && <span className="text-[9px] text-slate-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-rose-500/70 inline-block" />Liq. Floor {fmt(ch7LiqFloor)}</span>}
                                              {attyFees13 > 0 && <span className="text-[9px] text-slate-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-slate-500/70 inline-block" />Atty Fees {fmt(attyFees13)}</span>}
                                              {trusteeFee13 > 0 && <span className="text-[9px] text-slate-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-yellow-600/60 inline-block" />Trustee {fmt(trusteeFee13)}</span>}
                                            </div>
                                          </div>

                                          {/* Bar 2 — Debtor Can Pay */}
                                          <div className="space-y-1">
                                            <div className="flex items-center justify-between mb-0.5">
                                              <span className="text-[10px] text-slate-400 font-medium">Debtor(s) Can Pay (DMI × 60)</span>
                                              <span className={`text-[10px] font-bold tabular-nums ${debtorCanPayVal >= planNeededVal ? "text-green-400" : "text-red-400"}`}>{fmt(debtorCanPayVal)}</span>
                                            </div>
                                            <div className="h-5 w-full bg-slate-800 rounded-md overflow-hidden">
                                              <div
                                                className={`h-full transition-all flex items-center justify-end pr-1.5 ${debtorCanPayVal >= planNeededVal ? "bg-green-500/60" : "bg-red-500/60"}`}
                                                style={{ width: `${debtorBarPct}%` }}
                                              >
                                                {debtorBarPct > 10 && (
                                                  <span className="text-[8px] font-bold text-white/90">
                                                    {debtorCanPayVal >= planNeededVal ? "FUNDED" : `${Math.round((debtorCanPayVal / planNeededVal) * 100)}%`}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            {debtorCanPayVal < planNeededVal && (
                                              <div className="flex items-center gap-1 mt-0.5">
                                                <span className="text-[9px] text-red-400 font-semibold">Shortfall: {fmt(planNeededVal - debtorCanPayVal)}</span>
                                                <span className="text-[9px] text-slate-500">— plan cannot be confirmed at current income</span>
                                              </div>
                                            )}
                                          </div>

                                          {/* Divider */}
                                          <div className="border-t border-slate-700/50" />

                                          {/* General Unsecured Recovery */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">General Unsecured Recovery</p>
                                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border tabular-nums ${unsecPct === 0 ? "text-slate-400 bg-slate-800 border-slate-600" : unsecPct < 25 ? "text-red-300 bg-red-500/10 border-red-500/30" : unsecPct < 75 ? "text-amber-300 bg-amber-500/10 border-amber-500/30" : "text-green-300 bg-green-500/10 border-green-500/30"}`}>
                                                {unsecPct.toFixed(1)}% paid
                                              </span>
                                            </div>

                                            {/* Donut-style arc representation */}
                                            <div className="flex items-center gap-3">
                                              <div className="relative flex-shrink-0 w-16 h-16">
                                                <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                                                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgb(51,65,85)" strokeWidth="5" />
                                                  <circle
                                                    cx="18" cy="18" r="14" fill="none"
                                                    stroke={unsecPct === 0 ? "rgb(100,116,139)" : unsecPct < 25 ? "rgb(239,68,68)" : unsecPct < 75 ? "rgb(245,158,11)" : "rgb(34,197,94)"}
                                                    strokeWidth="5"
                                                    strokeDasharray={`${(unsecPct / 100) * 87.96} 87.96`}
                                                    strokeLinecap="round"
                                                    className="transition-all duration-700"
                                                  />
                                                </svg>
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                  <span className={`text-[10px] font-bold leading-none ${unsecPct === 0 ? "text-slate-500" : unsecPct < 25 ? "text-red-400" : unsecPct < 75 ? "text-amber-400" : "text-green-400"}`}>
                                                    {Math.round(unsecPct)}%
                                                  </span>
                                                </div>
                                              </div>
                                              <div className="flex-1 space-y-1.5">
                                                <div className="flex justify-between text-[10px]">
                                                  <span className="text-slate-400">Total general unsecured</span>
                                                  <span className="text-white font-semibold tabular-nums">{fmt(totalUnsecured13)}</span>
                                                </div>
                                                <div className="flex justify-between text-[10px]">
                                                  <span className="text-slate-400">Plan pays to unsecured</span>
                                                  <span className={`font-semibold tabular-nums ${paidToUnsecured > 0 ? "text-green-400" : "text-slate-500"}`}>{paidToUnsecured > 0 ? fmt(paidToUnsecured) : "$0"}</span>
                                                </div>
                                                <div className="flex justify-between text-[10px]">
                                                  <span className="text-slate-400">Unpaid / discharged</span>
                                                  <span className="text-rose-400 font-semibold tabular-nums">{fmt(Math.max(totalUnsecured13 - paidToUnsecured, 0))}</span>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Stacked bar showing paid vs unpaid */}
                                            <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex mt-1">
                                              <div
                                                className={`h-full transition-all ${unsecPct === 0 ? "bg-slate-700" : unsecPct < 25 ? "bg-red-500/70" : unsecPct < 75 ? "bg-amber-500/70" : "bg-green-500/70"}`}
                                                style={{ width: `${unsecPct}%` }}
                                              />
                                              <div className="h-full bg-rose-900/40 flex-1" />
                                            </div>
                                            <div className="flex justify-between text-[9px] text-slate-500">
                                              <span>{unsecPct === 0 ? "0% — No funds available for unsecured creditors" : `${unsecPct.toFixed(1)}% recovery`}</span>
                                              <span>{(100 - unsecPct).toFixed(1)}% discharged</span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {/* Final verdict */}
                                    <div className={`px-3 py-2 flex items-center gap-2 text-[11px] font-semibold border-t ${planFunds ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
                                      {planFunds
                                        ? <><CheckCircle size={11} className="flex-shrink-0" /> All confirmation elements satisfied — plan can be confirmed.</>
                                        : (() => {
                                            const shortfall = totalPlanNeeded - ch13Pool60;
                                            return <><XCircle size={11} className="flex-shrink-0" /> Plan cannot be confirmed — {fmt(shortfall)} funding shortfall over 60 months at current income/expense levels.</>;
                                          })()}
                                    </div>
                                  </div>

                                  </>)}
                                </div>
                              );
                            })()}
                            </div>
                          </div>
                            );
                          })()}

                          {/* NEGOTIATION CALLOUT */}
                          {canNegotiate && (
                            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
                              <div className="flex items-start gap-3">
                                <DollarSign size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-bold text-white mb-1">Creditor Settlement May Be Viable</p>
                                  <p className="text-[11px] text-slate-300 leading-relaxed">
                                    Client has <span className="text-yellow-300 font-semibold">{fmt(liquidCash)}</span> liquid ({Math.round(liquidRatio * 100)}% of {fmt(unsecuredNonPriority)} unsecured debt) with no significant non-exempt asset exposure.
                                    Creditors often settle for 40–60 cents on the dollar when the debtor has documented liquid funds. Consider whether bankruptcy filing is the best outcome before proceeding.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}


                        </div>
                      );
                    })()}
                  </div>

                  {activeTab === 'overview' && (
                    <>
                      <CaseSummaryGrid
                        fd={fd ?? {}}
                        submissionId={selected?.id}
                        clientName={`${(fd?.firstName as string) ?? ""} ${(fd?.lastName as string) ?? ""}`.trim() || "Client"}
                        clientEmail={(fd?.email as string) ?? undefined}
                        staffName="Attorney"
                        onFdUpdate={(updatedFd) => {
                          if (selected) {
                            setSubmissions(prev => prev.map(s => s.id === selected.id ? { ...s, form_data: updatedFd } : s));
                          }
                        }}
                      />
                      {/* DMI chapter-aware flag — positive AND > $500 */}
                      {(() => {
                        if (!fd) return null;
                        const dmi = calcTotalIncome(fd) - calcTotalExpenses(fd);
                        if (dmi <= 500) return null;
                        const ch7Above = !!ch7Analysis?.warnings.some(w => w.includes("above median") || w.includes("full means test"));
                        const msg = ch7Above
                          ? `Positive DMI ${fmt(dmi)}/mo — above-median household, evaluate § 707(b)(2) means-test presumption (≈$252.50/mo over 60mo, or ≈$151.25 if ≥25% of unsecured).`
                          : `Positive DMI ${fmt(dmi)}/mo — Ch.13 funding capacity. Not an abuse signal for below-median debtors.`;
                        return (
                          <div className={`rounded-2xl border p-4 ${ch7Above ? 'bg-red-500/8 border-red-500/30 text-red-200' : 'bg-amber-500/8 border-amber-500/30 text-amber-200'}`}>
                            <div className="flex items-start gap-2">
                              <AlertCircle size={14} className={ch7Above ? 'text-red-400 flex-shrink-0 mt-0.5' : 'text-amber-400 flex-shrink-0 mt-0.5'} />
                              <p className="text-xs leading-relaxed">{msg}</p>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}

                  {/* ── ISSUES TAB — statute-tagged issue list ───────────────── */}
                  {activeTab === 'issues' && fd && (() => {
                    type Severity = 'critical' | 'warning' | 'info';
                    type Issue = { statute: string; severity: Severity; title: string; detail: string };
                    const issues: Issue[] = [];

                    const detected = detectIssues(fd);
                    const liquidationValue = calcNonExemptEquity(fd);
                    const stateCode = normalizeStateCode((fd.state as string) ?? '');
                    const addressYears = parseInt((fd.addressYears as string) ?? '0') || 0;
                    const homeAcquired = fd.homeAcquiredDate as string | undefined;
                    const properties = (fd.properties as Array<Record<string, unknown>>) ?? [];

                    // Non-exempt assets — § 522 / § 1325(a)(4)
                    if (liquidationValue > 0) {
                      issues.push({
                        statute: '§ 522 / § 1325(a)(4)',
                        severity: 'critical',
                        title: 'Non-exempt asset equity',
                        detail: `Non-exempt equity totals ${fmt(liquidationValue)}. In Ch.7 this is exposed to the trustee; in Ch.13 it sets the § 1325(a)(4) liquidation floor that the plan must pay unsecured creditors.`,
                      });
                    }

                    // Jurisdiction / venue & domicile — § 1408 / § 522(b)(3) 730-day
                    const priorDomicile = (fd.priorDomicileState as string) ?? '';
                    if (priorDomicile && priorDomicile !== stateCode && addressYears < 2) {
                      issues.push({
                        statute: '§ 1408 / § 522(b)(3)',
                        severity: 'warning',
                        title: 'Domicile under 730 days',
                        detail: `Debtor in current state only ${addressYears} year(s). 730-day rule may require applying prior-state (${priorDomicile}) exemptions if that state held debtor's domicile for the greater portion of the 730-day window. Verify exemption_state derivation.`,
                      });
                    }

                    // Prior filings — § 727(a)(8), § 1328(f), § 362(c)
                    const priorBks = (fd.priorBankruptcies as Array<Record<string, unknown>>) ?? [];
                    for (const pb of priorBks) {
                      const ch = String(pb.chapter ?? '');
                      const discharged = pb.discharged === true;
                      const dischargeDate = pb.dischargeDate as string | undefined;
                      if (discharged && dischargeDate) {
                        const monthsSince = Math.floor((Date.now() - new Date(dischargeDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
                        if (ch === '7' && monthsSince < 96) {
                          issues.push({
                            statute: '§ 727(a)(8)',
                            severity: 'critical',
                            title: 'Prior Ch.7 discharge within 8 years',
                            detail: `Discharge in case ${pb.caseNumber ?? '(prior)'} on ${dischargeDate} — ${Math.floor(monthsSince/12)} years ago. Ch.7 discharge barred under § 727(a)(8) for 8 years from prior Ch.7 filing date.`,
                          });
                          if (monthsSince < 48) {
                            issues.push({
                              statute: '§ 1328(f)(1)',
                              severity: 'critical',
                              title: 'Ch.13 discharge barred (Ch.7-to-Ch.13 4-year bar)',
                              detail: `Ch.7 discharged ${Math.floor(monthsSince/12)}y ${monthsSince%12}m ago. Ch.13 discharge barred under § 1328(f)(1) until 4 years from Ch.7 filing date. Case may still be filed for plan relief (lien strip, arrears cure) — no discharge issuable.`,
                            });
                          }
                        }
                      }
                    }

                    // Over median — § 707(b)(2)
                    if (!!ch7Analysis?.warnings.some(w => w.includes("above median") || w.includes("full means test"))) {
                      issues.push({
                        statute: '§ 707(b)(2)',
                        severity: 'warning',
                        title: 'Above-median income — presumption of abuse',
                        detail: 'CMI exceeds the applicable state median. Long-form means test (Form 122A-2) required for Ch.7; § 707(b)(2) presumption applies if disposable income meets the statutory thresholds.',
                      });
                    }

                    // Preferential payments — § 547
                    if (fd.preferentialPayments === 'yes' || fd.preferentialPaymentsInsider === 'yes') {
                      const insider = (fd.preferentialInsiderEntries as unknown[]) ?? [];
                      issues.push({
                        statute: '§ 547(b)' + (insider.length > 0 ? ' + § 101(31)' : ''),
                        severity: 'warning',
                        title: insider.length > 0 ? 'Insider preferential payment' : 'Preferential payment',
                        detail: insider.length > 0
                          ? '1-year insider lookback. Trustee may avoid and recover for benefit of estate.'
                          : '90-day lookback for non-insiders. Trustee may recover transfers totaling > $700 to a single creditor.',
                      });
                    }

                    // Fraudulent transfers — § 548 / state UVTA
                    if (fd.transferredProperty === 'yes' || fd.has_transfers) {
                      issues.push({
                        statute: '§ 548 / state UVTA',
                        severity: 'warning',
                        title: 'Transfer within reach-back period',
                        detail: 'Disclosed transfer(s) within § 548 2-year reach-back. Trustee may avoid as actual or constructive fraud if debtor was insolvent at transfer. State UVTA may extend reach-back (typically 4 years).',
                      });
                    }

                    // Non-dischargeable debts — § 523 (DUI = § 523(a)(9))
                    const debtCodes = [
                      { key: 'taxDebt', label: 'Recent income tax debt', statute: '§ 523(a)(1) / § 507(a)(8)' },
                      { key: 'studentLoanDebt', label: 'Student loan debt', statute: '§ 523(a)(8)' },
                      { key: 'dsoArrearsAmount', label: 'Domestic support arrears', statute: '§ 523(a)(5)' },
                    ];
                    for (const dc of debtCodes) {
                      const v = parseFloat((fd[dc.key] as string) ?? '0') || 0;
                      if (v > 0) {
                        issues.push({
                          statute: dc.statute,
                          severity: 'info',
                          title: `${dc.label}: ${fmt(v)}`,
                          detail: 'Likely non-dischargeable under § 523. Discuss with client; plan should treat appropriately.',
                        });
                      }
                    }
                    if (fd.recentLuxury === 'yes' || fd.recentCashAdvance === 'yes') {
                      issues.push({
                        statute: '§ 523(a)(2)(C)',
                        severity: 'warning',
                        title: 'Recent luxury / cash advance',
                        detail: 'Presumption of nondischargeability for luxury purchases > $1,000 in 90 days OR cash advances > $1,100 in 70 days pre-petition.',
                      });
                    }

                    // Homestead 1215-day verifiability — § 522(p)
                    if (stateCode === 'WA' && properties.some(p => (p.propType as string)?.includes('Primary')) && !homeAcquired) {
                      issues.push({
                        statute: '§ 522(p)',
                        severity: 'warning',
                        title: 'Homestead 1215-day acquisition date missing',
                        detail: 'Cannot verify § 522(p) cap on state-law homestead (~$214,000) for property acquired within 1215 days of filing. Collect homeAcquiredDate on intake to validate.',
                      });
                    }

                    // Generic detector output (any not already covered)
                    for (const d of detected) {
                      if (!issues.some(i => i.detail.includes(d) || i.title.includes(d))) {
                        issues.push({ statute: 'review', severity: 'info', title: d, detail: '' });
                      }
                    }

                    return (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                        <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                          <AlertTriangle size={16} className="text-amber-400" /> Issues — {issues.length}
                        </h3>
                        {issues.length === 0 ? (
                          <div className="text-center py-10">
                            <CheckCircle size={28} className="text-green-500/50 mx-auto mb-2" />
                            <p className="text-slate-400 text-sm">No flagged issues detected.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {issues.map((i, idx) => {
                              const sev = i.severity === 'critical' ? 'bg-red-500/10 border-red-500/30 text-red-200'
                                : i.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                                : 'bg-slate-800/40 border-slate-700/40 text-slate-300';
                              const dot = i.severity === 'critical' ? 'bg-red-400' : i.severity === 'warning' ? 'bg-amber-400' : 'bg-slate-500';
                              return (
                                <div key={idx} className={`rounded-xl border p-3 ${sev}`}>
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                                    <span className="text-xs font-bold text-white">{i.title}</span>
                                    <span className="ml-auto text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900/60 border border-slate-700/50 text-slate-400">
                                      {i.statute}
                                    </span>
                                  </div>
                                  {i.detail && <p className="text-[11px] leading-relaxed opacity-90 pl-3">{i.detail}</p>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {activeTab === 'decision' && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Scale size={16} className="text-amber-400" /> Attorney Decision
                    </h3>

                    {/* Case Decision + Chapter */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">Bankruptcy Decision</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                const hasCh7Issues = fd && ch7Analysis && (!ch7Analysis.eligible || (ch7Analysis.warnings ?? []).length > 0);
                                if (form.chapter === "7" && hasCh7Issues) {
                                  setAcceptOverrideReason("");
                                  setShowAcceptConfirm(true);
                                } else {
                                  setForm(f => ({ ...f, accepted: true, limitedScope: false }));
                                }
                              }}
                              className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border text-xs font-semibold transition-all ${form.accepted && !form.limitedScope ? "bg-green-500/15 border-green-500 text-green-400" : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500"}`}
                            >
                              <CheckCircle size={14} />
                              Accept
                            </button>
                            <button
                              onClick={() => setForm(f => ({ ...f, accepted: false, limitedScope: false }))}
                              className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border text-xs font-semibold transition-all ${!form.accepted && !form.limitedScope ? "bg-red-500/15 border-red-500 text-red-400" : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500"}`}
                            >
                              <XCircle size={14} />
                              Decline
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">Bankruptcy Chapter</label>
                          <div className="grid grid-cols-2 gap-2">
                            {(["7", "13"] as const).map(ch => (
                              <button key={ch} onClick={() => { setForm(f => ({ ...f, chapter: ch })); if (ch === "7") setShowCh7Popup(true); }} className={`py-3 rounded-xl border text-sm font-semibold transition-all ${form.chapter === ch ? "bg-blue-500/15 border-blue-500 text-blue-400" : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500"}`}>
                                Chapter {ch}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Other Services</label>
                        <button
                          onClick={() => setForm(f => ({ ...f, accepted: false, limitedScope: !f.limitedScope }))}
                          className={`w-full flex flex-col items-center justify-center gap-1 py-3 rounded-xl border text-xs font-semibold transition-all ${form.limitedScope ? "bg-amber-500/15 border-amber-500 text-amber-400" : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500"}`}
                        >
                          <Scale size={14} />
                          Limited Scope
                        </button>
                      </div>
                    </div>

                    {/* Filing Court — not applicable for limited scope */}
                    {!form.limitedScope && (
                      <div>
                        <label className="block text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">
                          <MapPin size={11} className="inline mr-1" /> Filing Court
                        </label>
                        <select
                          value={form.courtDistrict}
                          onChange={e => setForm(f => ({ ...f, courtDistrict: e.target.value }))}
                          className="w-full bg-slate-800 border border-slate-600 focus:border-amber-400/70 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors"
                        >
                          {availableCourts.length === 0 && <option value="">Select court district...</option>}
                          {availableCourts.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                    )}

                    {/* Attorney Fee Quote — Chapter-specific (hidden when limited scope) */}
                    {!form.limitedScope && <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <DollarSign size={14} className="text-amber-400" />
                        <span className="text-sm font-bold text-white">Attorney Fee Structure</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ml-auto ${form.chapter === "7" ? "text-cyan-300 bg-cyan-500/15 border-cyan-500/40" : "text-green-300 bg-green-500/15 border-green-500/40"}`}>
                          Chapter {form.chapter}
                        </span>
                      </div>

                      {form.chapter === "7" ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Fee Agreement Type</label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => setForm(f => ({ ...f, ch7FeeType: "normal" }))}
                                className={`flex flex-col items-center py-3 px-2 rounded-xl border text-xs font-semibold transition-all ${form.ch7FeeType === "normal" ? "bg-cyan-500/15 border-cyan-500 text-cyan-300" : "bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500"}`}
                              >
                                <span className="font-bold text-sm mb-0.5">Regular</span>
                                <span className="text-[10px] opacity-70">Paid upfront in full</span>
                              </button>
                              <button
                                onClick={() => setForm(f => ({ ...f, ch7FeeType: "bifurcated" }))}
                                className={`flex flex-col items-center py-3 px-2 rounded-xl border text-xs font-semibold transition-all ${form.ch7FeeType === "bifurcated" ? "bg-cyan-500/15 border-cyan-500 text-cyan-300" : "bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500"}`}
                              >
                                <span className="font-bold text-sm mb-0.5">Bifurcated</span>
                                <span className="text-[10px] opacity-70">Split pre & post filing</span>
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Total Attorney Fee</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                              <input
                                type="number"
                                value={form.ch7TotalFee}
                                onChange={e => {
                                  const total = e.target.value;
                                  setForm(f => {
                                    const t = parseFloat(total) || 0;
                                    const pre = parseFloat(f.ch7PreFilingFee) || 0;
                                    return { ...f, ch7TotalFee: total, ch7PostFilingFee: f.ch7FeeType === "bifurcated" ? String(Math.max(t - pre, 0)) : "" };
                                  });
                                }}
                                placeholder="0.00"
                                className="w-full bg-slate-700/50 border border-slate-600 focus:border-amber-400/70 rounded-lg pl-7 pr-4 py-2.5 text-white text-sm focus:outline-none transition-colors"
                              />
                            </div>
                          </div>

                          {form.ch7FeeType === "bifurcated" && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Pre-Filing Amount</label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                  <input
                                    type="number"
                                    value={form.ch7PreFilingFee}
                                    onChange={e => {
                                      const pre = e.target.value;
                                      setForm(f => {
                                        const t = parseFloat(f.ch7TotalFee) || 0;
                                        const p = parseFloat(pre) || 0;
                                        return { ...f, ch7PreFilingFee: pre, ch7PostFilingFee: String(Math.max(t - p, 0)) };
                                      });
                                    }}
                                    placeholder="0.00"
                                    className="w-full bg-slate-700/50 border border-slate-600 focus:border-amber-400/70 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none transition-colors"
                                  />
                                </div>
                                <p className="text-[9px] text-slate-500 mt-1">Paid before filing</p>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Post-Filing Amount</label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                  <input
                                    type="number"
                                    value={form.ch7PostFilingFee}
                                    onChange={e => setForm(f => ({ ...f, ch7PostFilingFee: e.target.value }))}
                                    placeholder="auto"
                                    className="w-full bg-slate-700/50 border border-slate-600 focus:border-amber-400/70 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none transition-colors"
                                  />
                                </div>
                                <p className="text-[9px] text-slate-500 mt-1">Paid after filing</p>
                              </div>
                            </div>
                          )}

                          {(parseFloat(form.ch7TotalFee) > 0) && (
                            <div className={`rounded-lg border p-3 ${form.ch7FeeType === "normal" ? "border-cyan-500/25 bg-cyan-500/5" : "border-slate-600/40 bg-slate-800/40"}`}>
                              {form.ch7FeeType === "normal" ? (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-slate-300">Total due upfront (full payment)</span>
                                  <span className="text-sm font-bold text-cyan-300">{fmt(parseFloat(form.ch7TotalFee) || 0)}</span>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400">Pre-filing (due at signing)</span>
                                    <span className="text-sm font-bold text-cyan-300">{fmt(parseFloat(form.ch7PreFilingFee) || 0)}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400">Post-filing (after discharge)</span>
                                    <span className="text-sm font-bold text-slate-300">{fmt(parseFloat(form.ch7PostFilingFee) || 0)}</span>
                                  </div>
                                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/50">
                                    <span className="text-xs text-white font-semibold">Total</span>
                                    <span className="text-sm font-bold text-white">{fmt((parseFloat(form.ch7PreFilingFee) || 0) + (parseFloat(form.ch7PostFilingFee) || 0))}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Total Attorney Fee</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                              <input
                                type="number"
                                value={form.ch13TotalFee}
                                onChange={e => {
                                  const total = e.target.value;
                                  setForm(f => {
                                    const t = parseFloat(total) || 0;
                                    const up = parseFloat(f.ch13UpfrontFee) || 0;
                                    return { ...f, ch13TotalFee: total, ch13RolledIntoPlan: String(Math.max(t - up, 0)) };
                                  });
                                }}
                                placeholder="0.00"
                                className="w-full bg-slate-700/50 border border-slate-600 focus:border-amber-400/70 rounded-lg pl-7 pr-4 py-2.5 text-white text-sm focus:outline-none transition-colors"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Amount Upfront</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <input
                                  type="number"
                                  value={form.ch13UpfrontFee}
                                  onChange={e => {
                                    const up = e.target.value;
                                    setForm(f => {
                                      const t = parseFloat(f.ch13TotalFee) || 0;
                                      const u = parseFloat(up) || 0;
                                      return { ...f, ch13UpfrontFee: up, ch13RolledIntoPlan: String(Math.max(t - u, 0)) };
                                    });
                                  }}
                                  placeholder="0.00"
                                  className="w-full bg-slate-700/50 border border-slate-600 focus:border-amber-400/70 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none transition-colors"
                                />
                              </div>
                              <p className="text-[9px] text-slate-500 mt-1">Required before filing</p>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Rolled into Plan</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <input
                                  type="number"
                                  value={form.ch13RolledIntoPlan}
                                  onChange={e => setForm(f => ({ ...f, ch13RolledIntoPlan: e.target.value }))}
                                  placeholder="auto"
                                  className="w-full bg-slate-700/50 border border-slate-600 focus:border-amber-400/70 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none transition-colors"
                                />
                              </div>
                              <p className="text-[9px] text-slate-500 mt-1">Paid through the plan</p>
                            </div>
                          </div>

                          {(parseFloat(form.ch13TotalFee) > 0) && (
                            <div className="rounded-lg border border-green-500/25 bg-green-500/5 p-3 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400">Upfront (due at engagement)</span>
                                <span className="text-sm font-bold text-green-300">{fmt(parseFloat(form.ch13UpfrontFee) || 0)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400">Rolled into Ch. 13 plan</span>
                                <span className="text-sm font-bold text-slate-300">{fmt(Math.max((parseFloat(form.ch13TotalFee) || 0) - (parseFloat(form.ch13UpfrontFee) || 0), 0))}</span>
                              </div>
                              <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/50">
                                <span className="text-xs text-white font-semibold">Total Attorney Fee</span>
                                <span className="text-sm font-bold text-white">{fmt(parseFloat(form.ch13TotalFee) || 0)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>}

                    {/* Limited Scope Representation */}
                    {form.limitedScope && (
                      <div className="bg-amber-500/8 border border-amber-500/35 rounded-xl p-4 space-y-4">
                        <div className="flex items-center gap-2">
                          <Scale size={14} className="text-amber-400" />
                          <span className="text-sm font-bold text-amber-300">Limited Scope Representation</span>
                          <span className="ml-auto text-[10px] font-bold text-amber-400/70 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">Flat Fee · No Court Costs</span>
                        </div>
                        <p className="text-[11px] text-amber-200/60 leading-relaxed">
                          Offered when full representation is not appropriate but the client can benefit from limited legal guidance — typically debt negotiation or bankruptcy planning &amp; strategy consultations billed at a flat rate with no court costs or additional fees.
                        </p>
                        <div>
                          <label className="block text-[10px] font-bold text-amber-400/80 uppercase tracking-wider mb-1.5">Flat Fee Quoted</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                            <input
                              type="number"
                              value={form.limitedScopeFlatFee}
                              onChange={e => setForm(f => ({ ...f, limitedScopeFlatFee: e.target.value }))}
                              placeholder="0.00"
                              className="w-full bg-slate-800 border border-amber-500/30 focus:border-amber-400/70 rounded-lg pl-7 pr-4 py-2.5 text-white text-sm focus:outline-none transition-colors"
                            />
                          </div>
                          <p className="text-[9px] text-amber-400/50 mt-1">All-inclusive flat fee — no filing fees, no court costs</p>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-amber-400/80 uppercase tracking-wider mb-1.5">Description of Services Offered</label>
                          <textarea
                            value={form.limitedScopeDescription}
                            onChange={e => setForm(f => ({ ...f, limitedScopeDescription: e.target.value }))}
                            placeholder="e.g. Bankruptcy planning session and strategy consultation — review of exemptions, debt relief options, and pre-filing recommendations. Includes one 60-minute strategy call and written summary of recommendations."
                            rows={4}
                            className="w-full bg-slate-800 border border-amber-500/30 focus:border-amber-400/70 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors resize-none placeholder-slate-500"
                          />
                        </div>
                        {parseFloat(form.limitedScopeFlatFee) > 0 && (
                          <div className="flex items-center justify-between bg-amber-500/12 border border-amber-500/30 rounded-lg px-4 py-3">
                            <span className="text-sm text-amber-200 font-semibold">Total Flat Fee</span>
                            <span className="text-xl font-bold text-amber-300">{fmt(parseFloat(form.limitedScopeFlatFee) || 0)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Internal Attorney Notes */}
                    <div>
                      <label className="block text-xs font-bold text-amber-400 uppercase tracking-widest mb-1.5">Internal Attorney Notes</label>
                      <p className="text-[10px] text-slate-500 mb-2">For internal use only — not shared with client</p>
                      <textarea
                        value={form.attorneyNotes}
                        onChange={e => setForm(f => ({ ...f, attorneyNotes: e.target.value }))}
                        placeholder="Strategy considerations, case notes, internal flags..."
                        rows={3}
                        className="w-full bg-slate-800 border border-slate-600 focus:border-amber-400/70 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors resize-none placeholder-slate-500"
                      />
                    </div>

                    {/* Client Advisory Email */}
                    <div>
                      <label className="block text-xs font-bold text-amber-400 uppercase tracking-widest mb-1.5">
                        <Mail size={11} className="inline mr-1" /> Client Advisory Email
                      </label>
                      <p className="text-[10px] text-slate-500 mb-2">General advice emailed to debtor upon acceptance — attorney fees are not included in this email</p>
                      <textarea
                        value={form.clientAdvisoryNotes}
                        onChange={e => setForm(f => ({ ...f, clientAdvisoryNotes: e.target.value }))}
                        placeholder={`Dear [Client Name],\n\nBased on our review of your financial situation, we recommend proceeding with Chapter ${form.chapter} bankruptcy. Here is what you should know...\n\n• Stop using credit cards immediately\n• Do not make large purchases or transfers\n• Gather pay stubs and bank statements for the past 6 months\n• Continue making mortgage/vehicle payments if you wish to keep those assets\n\nOur office will reach out shortly with next steps.`}
                        rows={7}
                        className="w-full bg-slate-800 border border-slate-600 focus:border-amber-400/70 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors resize-none placeholder-slate-500"
                      />
                    </div>

                    {/* Primary Actions */}
                    <div className="flex gap-3">
                      <button onClick={saveReview} disabled={saving || (!form.limitedScope && !form.courtDistrict)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${saving || (!form.limitedScope && !form.courtDistrict) ? "bg-slate-700 text-slate-500 cursor-not-allowed" : "bg-amber-400 hover:bg-amber-300 text-slate-900"}`}>
                        {saving ? "Saving..." : saved ? "Saved!" : "Save Decision"}
                      </button>
                      {form.accepted && saved && (
                        <button onClick={sendConfirmation} disabled={sendingEmail || emailSent} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${emailSent ? "bg-green-500/15 border border-green-500 text-green-400 cursor-default" : sendingEmail ? "bg-slate-700 text-slate-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 text-white"}`}>
                          <Send size={14} />
                          {emailSent ? "Advisory Sent" : sendingEmail ? "Sending..." : "Send Advisory Email"}
                        </button>
                      )}
                    </div>

                    {/* Fee Agreement + Payment (accepted cases) */}
                    {form.accepted && saved && (
                      <div className="border-t border-slate-700/50 pt-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <CreditCard size={13} className="text-green-400" />
                          <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Client Engagement & Payment</span>
                        </div>
                        <p className="text-[11px] text-slate-400">Send the client a fee agreement and allow them to submit their retainer payment online.</p>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={async () => {
                              setForm(f => ({ ...f, feeAgreementSent: true }));
                              if (review) {
                                await supabase.from("attorney_intake_reviews").update({ fee_agreement_sent: true }).eq("id", review.id);
                              }
                            }}
                            className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all ${form.feeAgreementSent ? "bg-green-500/15 border-green-500 text-green-400 cursor-default" : "bg-slate-800 border-slate-600 text-slate-300 hover:border-green-500/60 hover:text-green-400"}`}
                          >
                            <FileText size={13} />
                            {form.feeAgreementSent ? "Agreement Sent" : "Send Fee Agreement"}
                          </button>
                          <button
                            onClick={async () => {
                              setForm(f => ({ ...f, paymentInitiated: true }));
                              if (review) {
                                await supabase.from("attorney_intake_reviews").update({ payment_initiated: true }).eq("id", review.id);
                              }
                            }}
                            className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all ${form.paymentInitiated ? "bg-green-500/15 border-green-500 text-green-400 cursor-default" : "bg-slate-800 border-slate-600 text-slate-300 hover:border-green-500/60 hover:text-green-400"}`}
                          >
                            <DollarSign size={13} />
                            {form.paymentInitiated ? "Payment Link Sent" : "Send Payment Link"}
                          </button>
                        </div>
                        {form.feeAgreementSent && (
                          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Retainer Amount</p>
                            <div className="flex items-center gap-3">
                              <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <input
                                  type="number"
                                  placeholder={form.chapter === "7" ? (form.ch7FeeType === "normal" ? form.ch7TotalFee : form.ch7PreFilingFee) : form.ch13UpfrontFee}
                                  className="w-full bg-slate-700/50 border border-slate-600 focus:border-green-400/70 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none transition-colors"
                                />
                              </div>
                              <span className="text-xs text-slate-400">
                                {form.chapter === "7"
                                  ? (form.ch7FeeType === "normal" ? "Full payment" : "Pre-filing portion")
                                  : "Upfront retainer"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Secondary Actions — Return or Close */}
                    {saved && (
                      <div className="border-t border-slate-700/50 pt-4">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Case Routing</p>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={async () => {
                              setForm(f => ({ ...f, returnedToAdmin: true }));
                              if (review) {
                                await supabase.from("attorney_intake_reviews").update({ returned_to_admin: true }).eq("id", review.id);
                              }
                            }}
                            className={`flex flex-col items-center gap-1 py-3 px-3 rounded-xl border text-xs font-semibold transition-all ${form.returnedToAdmin ? "bg-amber-500/15 border-amber-500 text-amber-400 cursor-default" : "bg-slate-800 border-slate-600 text-slate-400 hover:border-amber-500/60 hover:text-amber-300"}`}
                          >
                            <ArrowLeft size={14} />
                            <span>{form.returnedToAdmin ? "Returned to Admin" : "Return to Legal Admin"}</span>
                            {!form.returnedToAdmin && <span className="text-[9px] opacity-60">For follow-up or questions</span>}
                          </button>
                          <button
                            onClick={async () => {
                              setForm(f => ({ ...f, closedByAi: true }));
                              if (review) {
                                await supabase.from("attorney_intake_reviews").update({ closed_by_ai: true }).eq("id", review.id);
                                await supabase.from("intake_submissions").update({ status: "closed" }).eq("id", selected!.id);
                              }
                            }}
                            className={`flex flex-col items-center gap-1 py-3 px-3 rounded-xl border text-xs font-semibold transition-all ${form.closedByAi ? "bg-red-500/15 border-red-500 text-red-400 cursor-default" : "bg-slate-800 border-slate-600 text-slate-400 hover:border-red-500/60 hover:text-red-300"}`}
                          >
                            <XCircle size={14} />
                            <span>{form.closedByAi ? "Closed via AI Bot" : "Close via AI Bot"}</span>
                            {!form.closedByAi && <span className="text-[9px] opacity-60">AI will notify the client</span>}
                          </button>
                        </div>
                      </div>
                    )}

                    {emailError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
                        <AlertTriangle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-red-300 text-xs">{emailError}</p>
                      </div>
                    )}
                    {emailSent && (
                      <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-xs text-green-300 text-center">
                        Advisory email sent to client — does not include attorney fee amounts.
                      </div>
                    )}
                  </div>
                  )}
                </div>
              )}
            </div>

            {selected && (
              <div className="col-span-3 sticky top-24 flex flex-col" style={{ height: "640px" }}>
                {/* Tab bar */}
                <div className="flex bg-slate-900 border border-slate-800 rounded-t-2xl overflow-hidden border-b-0">
                  <button
                    onClick={() => { setRightPanelTab("docs"); loadClientDocs(selected.id); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${rightPanelTab === "docs" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/40"}`}
                  >
                    <FileText size={11} /> Client Docs
                    {clientDocs.length > 0 && <span className="bg-amber-400 text-slate-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">{clientDocs.length}</span>}
                  </button>
                  <button
                    onClick={() => setRightPanelTab("log")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${rightPanelTab === "log" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/40"}`}
                  >
                    <ClipboardList size={11} /> Case Log
                  </button>
                </div>
                {/* Tab content */}
                <div className="flex-1 min-h-0 rounded-b-2xl overflow-hidden border border-slate-800 border-t-0">
                  {rightPanelTab === "log" ? (
                    <div className="h-full bg-slate-900 flex flex-col">
                      <CaseActivityLog
                        submissionId={selected.id}
                        clientName={`${(selected.form_data as Record<string, unknown>)?.firstName ?? ""} ${(selected.form_data as Record<string, unknown>)?.lastName ?? ""}`.trim() || "Client"}
                      />
                    </div>
                  ) : (
                    <div className="h-full bg-slate-900 flex flex-col">
                      <div className="px-4 py-3 border-b border-slate-800">
                        <p className="text-xs font-bold text-white">Submitted Documents</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Income verification, statements &amp; supporting files</p>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {docsLoading ? (
                          <div className="text-center py-8 text-slate-500 text-xs">Loading...</div>
                        ) : clientDocs.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center mb-2">
                              <FileText size={18} className="text-slate-600" />
                            </div>
                            <p className="text-slate-400 text-xs font-semibold">No documents yet</p>
                            <p className="text-slate-600 text-[10px] mt-1">Request income verification to prompt the client to upload files.</p>
                            <button
                              onClick={sendInfoRequest}
                              disabled={requestInfoSending || requestInfoSent === selected.id}
                              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-400/15 hover:bg-yellow-400/25 border border-yellow-400/30 text-yellow-300 text-[11px] font-semibold transition-all disabled:opacity-50"
                            >
                              <FileText size={11} />
                              {requestInfoSent === selected.id ? "Request Sent" : "Request Verification from Client"}
                            </button>
                          </div>
                        ) : (
                          clientDocs.map((doc) => (
                            <div key={doc.id as string} className="bg-slate-800 rounded-xl p-3 border border-slate-700/60">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <FileText size={11} className="text-slate-400" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-white truncate">{doc.file_name as string || "Untitled"}</p>
                                    <p className="text-[10px] text-slate-500 capitalize">{String(doc.document_type).replace(/_/g, " ")}</p>
                                  </div>
                                </div>
                                {doc.file_url && (
                                  <a href={doc.file_url as string} target="_blank" rel="noopener noreferrer"
                                    className="text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2 whitespace-nowrap flex-shrink-0">
                                    View
                                  </a>
                                )}
                              </div>
                              {doc.notes && <p className="text-[10px] text-slate-400 mt-1.5 pl-8">{doc.notes as string}</p>}
                              <p className="text-[9px] text-slate-600 mt-1 pl-8">
                                {new Date(doc.created_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                {" · "}{doc.uploaded_by === "client" ? "Uploaded by client" : "Uploaded by staff"}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {incExpModal && fd && (
        <IncomeExpenseModal
          mode={incExpModal.mode}
          chapter={incExpModal.chapter}
          fd={fd}
          submissionId={selected?.id}
          clientName={`${(fd.firstName as string) ?? ""} ${(fd.lastName as string) ?? ""}`.trim() || "Client"}
          clientEmail={(fd.email as string) ?? undefined}
          staffName="Attorney"
          onClose={() => setIncExpModal(null)}
          onSave={(updatedFd) => {
            if (selected) {
              setSubmissions(prev => prev.map(s => s.id === selected.id ? { ...s, form_data: updatedFd } : s));
            }
          }}
        />
      )}
    </div>
  );
}
