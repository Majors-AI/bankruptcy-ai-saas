import React, { useMemo } from "react";
import { Wallet } from "lucide-react";

/* Schedule I — Official Form 106I — income review.
   Restyled to the bankruptcy.ai dark theme.

   ── INTEGRATION CONTRACT ──────────────────────────────────────────────
   PROP-DRIVEN. Pass `employment` and `incomeLines`. EXAMPLE_* are SAMPLE
   ONLY and MUST NOT ship. Wire from the questionnaire/Supabase during merge.

   employment: { status, employer, occupation }
   incomeLines: { label, amount:number }[]
   <ScheduleIReview employment={emp} incomeLines={income} debtor="Jane Sample" />
   ─────────────────────────────────────────────────────────────────────── */

const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EXAMPLE_EMPLOYMENT = { status: "—", employer: "—", occupation: "—" };

/* EXAMPLE ONLY — do not ship. Form 106I monthly income lines (2–11). */
const EXAMPLE_INCOME = [
  { label: "Gross wages / salary / commissions", amount: 0 },
  { label: "Net income from business / profession", amount: 0 },
  { label: "Net income from rental / real property", amount: 0 },
  { label: "Interest & dividends", amount: 0 },
  { label: "Unemployment compensation", amount: 0 },
  { label: "Social Security", amount: 0 },
  { label: "Pension / retirement income", amount: 0 },
  { label: "Other monthly income", amount: 0 },
];

export default function ScheduleIReview({ employment = EXAMPLE_EMPLOYMENT, incomeLines = EXAMPLE_INCOME, debtor = "Example Debtor" }) {
  const total = useMemo(() => incomeLines.reduce((a, l) => a + (l.amount || 0), 0), [incomeLines]);
  return (
    <div className="si">
      <Style />
      <h1><Wallet size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule I — Income</h1>
      <div className="form">Official Form 106I · {debtor}</div>
      <div className="card">
        <div className="ph">Part 1 · Employment</div>
        <Row k="Employment status" v={employment.status} />
        <Row k="Employer" v={employment.employer} />
        <Row k="Occupation" v={employment.occupation} />

        <div className="ph">Part 2 · Monthly income</div>
        {incomeLines.map((l, i) => (
          <div className="row" key={i}><span className={l.amount ? "" : "z"}>{l.label}</span><span className="amt">{money(l.amount)}</span></div>
        ))}
        <div className="grand"><span>Combined monthly income <span className="calc">auto</span></span><span>{money(total)}</span></div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return <div className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>;
}

function Style() {
  return <style>{`
    .si * { box-sizing:border-box; }
    .si {
      --accent:#fbbf24; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8; --calc:#7dd3fc; --calc-bg:rgba(56,189,248,.12);
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:840px; margin:0 auto; }
    .si h1 { font-family:var(--serif); font-weight:600; font-size:24px; margin:0; color:#fff; }
    .si .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .si .card { background:var(--bg); border:1px solid var(--line); border-radius:16px; padding:18px 20px; margin-top:16px; }
    .si .ph { font-family:var(--serif); font-size:13px; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:.04em; margin:16px 0 6px; }
    .si .ph:first-child { margin-top:0; }
    .si .kv { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:14px; padding:6px 0; border-bottom:1px solid var(--line-soft); }
    .si .kv .k { color:var(--muted); } .si .kv .v { font-weight:600; text-align:right; }
    .si .row { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:13.5px; padding:6px 0; border-bottom:1px solid var(--line-soft); }
    .si .row .z { color:var(--muted); } .si .amt { font-weight:600; text-align:right; }
    .si .grand { display:flex; justify-content:space-between; align-items:center; font-family:var(--serif); font-weight:600; font-size:16px; margin-top:14px; padding-top:14px; border-top:2px solid var(--accent); color:#fff; }
    .si .calc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--calc-bg); color:var(--calc); padding:1px 6px; border-radius:6px; margin-left:6px; }
    .si .note { font-size:12.5px; color:var(--muted); background:var(--bg-2); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:10px 0 2px; }
  `}</style>;
}
