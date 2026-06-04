import React, { useMemo } from "react";
import { Receipt, AlertCircle } from "lucide-react";

/* Schedule J — Official Form 106J — expenses review.
   Iovin: partial (rent / food / transportation captured). Self-contained.
   monthlyIncome is pulled from Schedule I (combined monthly income). */

const money = (n) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const HOUSEHOLD = { size: 3, dependents: "2 sons (ages 18, 15)" };
const MONTHLY_INCOME = 4608;   // from Schedule I

// Form 106J expense lines (4–22). null = not yet captured.
const EXPENSE_LINES = [
  { label: "Rent / home ownership (incl. mortgage)", amount: 10634.01 },
  { label: "Property / homeowner taxes & insurance", amount: null },
  { label: "Home maintenance & upkeep", amount: null },
  { label: "Utilities (electric, gas, water, phone, internet)", amount: null },
  { label: "Food & housekeeping supplies", amount: 1060.00 },
  { label: "Childcare & children's education", amount: null },
  { label: "Clothing & laundry", amount: null },
  { label: "Personal care", amount: null },
  { label: "Medical & dental", amount: null },
  { label: "Transportation", amount: 500.00 },
  { label: "Entertainment / recreation", amount: null },
  { label: "Charitable contributions", amount: null },
  { label: "Insurance (life / health / vehicle)", amount: null },
  { label: "Taxes (not deducted from wages)", amount: null },
  { label: "Installment / lease payments", amount: null },
  { label: "Domestic support / alimony", amount: null },
  { label: "Other expenses", amount: null },
];

export default function ScheduleJReview() {
  const { total, missing } = useMemo(() => {
    const t = EXPENSE_LINES.reduce((a, l) => a + (l.amount || 0), 0);
    const m = EXPENSE_LINES.filter((l) => l.amount === null).length;
    return { total: t, missing: m };
  }, []);
  const net = MONTHLY_INCOME - total;
  return (
    <div className="sj">
      <Style />
      <h1><Receipt size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule J — Expenses</h1>
      <div className="form">Official Form 106J · Christian E. Iovin</div>
      <div className="card">
        <div className="ph">Part 1 · Household</div>
        <Row k="Household size" v={HOUSEHOLD.size} />
        <Row k="Dependents" v={HOUSEHOLD.dependents} />

        <div className="ph">Part 2 · Monthly expenses</div>
        {EXPENSE_LINES.map((l, i) => (
          <div className="row" key={i}>
            <span>{l.label}</span>
            {l.amount === null
              ? <span className="flag"><AlertCircle size={12} /> not entered</span>
              : <span className="amt">{money(l.amount)}</span>}
          </div>
        ))}
        <div className="grand"><span>Total monthly expenses <span className="calc">auto</span></span><span>{money(total)}</span></div>
        <div className="net">
          <span>Monthly net income (Schedule I − J) <span className="calc">auto</span></span>
          <span className={net < 0 ? "neg" : ""}>{money(net)}</span>
        </div>
        {missing > 0 && <div className="note">{missing} expense categories not yet entered — complete before the means test (Schedule J feeds disposable income).</div>}
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return <div className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>;
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .sj * { box-sizing:border-box; }
    .sj { --oxblood:#6b1f2a; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --warn:#9a5b16; --line:#ddd2c2; --calc:#2d5b8e; --calc-bg:#e4ecf5; --neg:#a23030;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:840px; margin:0 auto; }
    .sj h1 { font-family:'Fraunces',serif; font-weight:600; font-size:24px; margin:0; }
    .sj .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .sj .card { background:#fffdf8; border:1px solid var(--line); border-radius:13px; padding:18px 20px; margin-top:16px; }
    .sj .ph { font-family:'Fraunces',serif; font-size:13px; font-weight:600; color:var(--oxblood); text-transform:uppercase; letter-spacing:.04em; margin:16px 0 6px; }
    .sj .ph:first-child { margin-top:0; }
    .sj .kv { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:14px; padding:6px 0; border-bottom:1px solid var(--paper-2); }
    .sj .kv .k { color:var(--muted); } .sj .kv .v { font-weight:600; text-align:right; }
    .sj .row { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:13.5px; padding:6px 0; border-bottom:1px solid var(--paper-2); align-items:center; }
    .sj .amt { font-weight:600; text-align:right; }
    .sj .flag { color:var(--warn); font-weight:600; font-size:12px; display:inline-flex; gap:4px; align-items:center; }
    .sj .grand { display:flex; justify-content:space-between; align-items:center; font-family:'Fraunces',serif; font-weight:600; font-size:16px; margin-top:14px; padding-top:14px; border-top:2px solid var(--oxblood); }
    .sj .net { display:flex; justify-content:space-between; align-items:center; font-weight:600; font-size:14px; padding:10px 0 2px; }
    .sj .net .neg { color:var(--neg); }
    .sj .calc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--calc-bg); color:var(--calc); padding:1px 6px; border-radius:6px; margin-left:6px; }
    .sj .note { font-size:12.5px; color:var(--muted); background:var(--paper); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:10px 0 2px; }
  `}</style>;
}
