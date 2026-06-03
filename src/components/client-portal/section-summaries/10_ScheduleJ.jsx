import React, { useMemo } from "react";
import { Receipt, AlertCircle } from "lucide-react";

/* Schedule J — Official Form 106J — expenses review.
   Restyled to the bankruptcy.ai dark theme.

   ── INTEGRATION CONTRACT ──────────────────────────────────────────────
   PROP-DRIVEN. Pass `household`, `monthlyIncome` (from Schedule I), and
   `expenseLines` (amount === null => not yet captured). EXAMPLE_* are
   SAMPLE ONLY and MUST NOT ship. Wire from the questionnaire/Supabase.

   household: { size:number, dependents:string }
   expenseLines: { label, amount:number|null }[]
   <ScheduleJReview household={hh} monthlyIncome={4608} expenseLines={exp} debtor="Jane Sample" />
   ─────────────────────────────────────────────────────────────────────── */

const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EXAMPLE_HOUSEHOLD = { size: 1, dependents: "—" };

/* EXAMPLE ONLY — do not ship. Form 106J expense lines (4–22). null = not captured. */
const EXAMPLE_EXPENSES = [
  { label: "Rent / home ownership (incl. mortgage)", amount: null },
  { label: "Property / homeowner taxes & insurance", amount: null },
  { label: "Home maintenance & upkeep", amount: null },
  { label: "Utilities (electric, gas, water, phone, internet)", amount: null },
  { label: "Food & housekeeping supplies", amount: null },
  { label: "Childcare & children's education", amount: null },
  { label: "Clothing & laundry", amount: null },
  { label: "Personal care", amount: null },
  { label: "Medical & dental", amount: null },
  { label: "Transportation", amount: null },
  { label: "Entertainment / recreation", amount: null },
  { label: "Charitable contributions", amount: null },
  { label: "Insurance (life / health / vehicle)", amount: null },
  { label: "Taxes (not deducted from wages)", amount: null },
  { label: "Installment / lease payments", amount: null },
  { label: "Domestic support / alimony", amount: null },
  { label: "Other expenses", amount: null },
];

export default function ScheduleJReview({ household = EXAMPLE_HOUSEHOLD, monthlyIncome = 0, expenseLines = EXAMPLE_EXPENSES, debtor = "Example Debtor" }) {
  const { total, missing } = useMemo(() => {
    const t = expenseLines.reduce((a, l) => a + (l.amount || 0), 0);
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
        <Row k="Household size" v={household.size} />
        <Row k="Dependents" v={household.dependents} />

        <div className="ph">Part 2 · Monthly expenses</div>
        {expenseLines.map((l, i) => (
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
    .sj * { box-sizing:border-box; }
    .sj {
      --accent:#fbbf24; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8; --warn:#fcd34d; --calc:#7dd3fc; --calc-bg:rgba(56,189,248,.12); --neg:#fb7185;
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:840px; margin:0 auto; }
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
