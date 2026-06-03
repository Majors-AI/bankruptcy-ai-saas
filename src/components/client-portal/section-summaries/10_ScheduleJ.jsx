import React, { useMemo } from "react";
import { Receipt, AlertCircle } from "lucide-react";
import ConfirmFooter from "./ConfirmFooter";

/* Schedule J — Official Form 106J — expenses review.
   Raw-data pattern: pass the full questionnaire `data` object.

   <ScheduleJReview
     data={questionnaireData}
     confirmed={summaryConfirmed}
     onConfirm={onSummaryConfirm}
     communityConfirmed={communityConfirmed}
     onCommunityConfirm={communityRequired ? onCommunityConfirm : undefined}
   /> */

const money = (n) =>
  "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const num = (v) => parseFloat(v) || 0;

/* `?? null`: undefined/null/empty-string → null ("not entered");
   actual $0 ("0") → 0 and is shown, not flagged. */
const toAmt = (v) => (v != null && v !== "") ? parseFloat(v) : null;

export default function ScheduleJReview({
  data,
  confirmed,
  onConfirm,
  communityConfirmed,
  onCommunityConfirm,
}) {
  const pd = data?.petition || {};
  const sd = data?.schedI   || {};
  const jd = data?.schedJ   || {};

  const debtor = [pd.firstName, pd.lastName].filter(Boolean).join(" ") || "Debtor";

  const numDep = parseInt(pd.numDependents) || 0;
  const isJoint = pd.filingType === "joint";
  const householdSize = 1 + (isJoint ? 1 : 0) + numDep;
  const deps = pd.dependents || [];
  const dependentStr = deps.length > 0
    ? deps.map((d) => [d.relationship, d.age ? `age ${d.age}` : ""].filter(Boolean).join(" ")).join("; ")
    : numDep > 0 ? `${numDep} dependent${numDep !== 1 ? "s" : ""}` : "None";

  const monthlyIncome = useMemo(() =>
    num(sd.avgMonthly6) + num(sd.bonuses) + num(sd.dSelfEmployment) + num(sd.dRental) +
    num(sd.dInterest) + num(sd.dSsRetirement) + num(sd.dSsDisability) + num(sd.dPension) +
    num(sd.dUnemployment) + num(sd.dWorkersComp) + num(sd.dAlimony) + num(sd.dChildSupport) +
    num(sd.dFamilyContribution) + num(sd.dOtherIncome),
  [sd]);

  const expenseLines = useMemo(() => [
    { label: "Rent / Mortgage",                   amount: toAmt(jd.rent) },
    { label: "Real Estate Taxes",                  amount: toAmt(jd.propTax) },
    { label: "HOA / Condo Dues",                   amount: toAmt(jd.hoa) },
    { label: "Homeowner's / Renter's Insurance",   amount: toAmt(jd.homeInsurance) },
    { label: "Electricity",                         amount: toAmt(jd.electric) },
    { label: "Gas",                                 amount: toAmt(jd.gas) },
    { label: "Water / Sewer / Trash",              amount: toAmt(jd.water) },
    { label: "Telephone / Cell",                   amount: toAmt(jd.phone) },
    { label: "Internet",                            amount: toAmt(jd.internet) },
    { label: "Cable / Streaming",                  amount: toAmt(jd.cable) },
    { label: "Food & Groceries",                   amount: toAmt(jd.food) },
    { label: "Clothing",                            amount: toAmt(jd.clothing) },
    { label: "Laundry / Dry Cleaning",             amount: toAmt(jd.laundry) },
    { label: "Personal Care Products",             amount: toAmt(jd.personalCare) },
    { label: "Recreation / Entertainment",         amount: toAmt(jd.recreation) },
    { label: "Pet Expenses",                       amount: toAmt(jd.pets) },
    { label: "Car Payment #1",                     amount: toAmt(jd.carPayment1) },
    { label: "Car Payment #2",                     amount: toAmt(jd.carPayment2) },
    { label: "Gas / Fuel",                         amount: toAmt(jd.transport) },
    { label: "Auto Insurance",                     amount: toAmt(jd.carInsurance) },
    { label: "Car Maintenance / Repairs",          amount: toAmt(jd.carMaint) },
    { label: "Public Transit / Rideshare",         amount: toAmt(jd.transit) },
    { label: "Health Insurance Premium",           amount: toAmt(jd.healthInsurance) },
    { label: "Life Insurance Premium",             amount: toAmt(jd.lifePremium) },
    { label: "Out-of-Pocket Medical Expenses",     amount: toAmt(jd.medical) },
    { label: "Dental Expenses",                    amount: toAmt(jd.dental) },
    { label: "Child Care / Daycare",               amount: toAmt(jd.childCare) },
    { label: "Tuition / School Fees",              amount: toAmt(jd.tuition) },
    { label: "Child Support Paid",                 amount: toAmt(jd.childSupportPaid) },
    { label: "Alimony Paid",                       amount: toAmt(jd.alimonyPaid) },
    { label: "Charitable Contributions",           amount: toAmt(jd.charity) },
    { label: "Other Monthly Expenses",             amount: toAmt(jd.otherExpenses) },
  ], [jd]);

  const { total, missing } = useMemo(() => {
    const t = expenseLines.reduce((a, l) => a + (l.amount ?? 0), 0);
    const m = expenseLines.filter((l) => l.amount === null).length;
    return { total: t, missing: m };
  }, [expenseLines]);

  const net = monthlyIncome - total;

  return (
    <div className="sj">
      <Style />
      <h1><Receipt size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule J — Expenses</h1>
      <div className="form">Official Form 106J · {debtor}</div>
      <div className="card">
        <div className="ph">Part 1 · Household</div>
        <Row k="Household size" v={householdSize} />
        <Row k="Dependents" v={dependentStr} />

        <div className="ph">Part 2 · Monthly expenses</div>
        {expenseLines.map((l, i) => (
          <div className="row" key={i}>
            <span>{l.label}</span>
            {l.amount === null
              ? <span className="flag"><AlertCircle size={12} /> not entered</span>
              : <span className="amt">{money(l.amount)}</span>}
          </div>
        ))}
        <div className="grand">
          <span>Total monthly expenses <span className="calc">auto</span></span>
          <span>{money(total)}</span>
        </div>
        <div className="net">
          <span>Monthly net income (Schedule I − J) <span className="calc">auto</span></span>
          <span className={net < 0 ? "neg" : ""}>{money(net)}</span>
        </div>
        {missing > 0 && (
          <div className="note">
            {missing} expense categor{missing === 1 ? "y" : "ies"} not yet entered — complete before the means test (Schedule J feeds disposable income).
          </div>
        )}
      </div>
      <ConfirmFooter
        confirmed={confirmed}
        onConfirm={onConfirm}
        communityConfirmed={communityConfirmed}
        onCommunityConfirm={onCommunityConfirm}
        sectionLabel="expenses"
      />
    </div>
  );
}

function Row({ k, v }) {
  return <div className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>;
}

function Style() {
  return <style>{`
    .sj * { box-sizing:border-box; }
    .sj {
      --accent:#fbbf24; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8; --warn:#fcd34d; --calc:#7dd3fc; --calc-bg:rgba(56,189,248,.12); --neg:#fb7185;
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:840px; margin:16px auto 0; }
    .sj h1 { font-family:var(--serif); font-weight:600; font-size:24px; margin:0; color:#fff; }
    .sj .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .sj .card { background:var(--bg); border:1px solid var(--line); border-radius:16px; padding:18px 20px; margin-top:16px; }
    .sj .ph { font-family:var(--serif); font-size:13px; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:.04em; margin:16px 0 6px; }
    .sj .ph:first-child { margin-top:0; }
    .sj .kv { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:14px; padding:6px 0; border-bottom:1px solid var(--line-soft); }
    .sj .kv .k { color:var(--muted); } .sj .kv .v { font-weight:600; text-align:right; }
    .sj .row { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:13.5px; padding:6px 0; border-bottom:1px solid var(--line-soft); align-items:center; }
    .sj .amt { font-weight:600; text-align:right; }
    .sj .flag { color:var(--warn); font-weight:600; font-size:12px; display:inline-flex; gap:4px; align-items:center; }
    .sj .grand { display:flex; justify-content:space-between; align-items:center; font-family:var(--serif); font-weight:600; font-size:16px; margin-top:14px; padding-top:14px; border-top:2px solid var(--accent); color:#fff; }
    .sj .net { display:flex; justify-content:space-between; align-items:center; font-weight:600; font-size:14px; padding:10px 0 2px; }
    .sj .net .neg { color:var(--neg); }
    .sj .calc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--calc-bg); color:var(--calc); padding:1px 6px; border-radius:6px; margin-left:6px; }
    .sj .note { font-size:12.5px; color:var(--muted); background:var(--bg-2); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:10px 0 2px; }
  `}</style>;
}
