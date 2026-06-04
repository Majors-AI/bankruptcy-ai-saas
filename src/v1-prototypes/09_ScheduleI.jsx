import React, { useMemo } from "react";
import { Wallet } from "lucide-react";

/* Schedule I — Official Form 106I — income review.
   Iovin: not currently employed; income is unemployment. Self-contained. */

const money = (n) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EMPLOYMENT = { status: "Not employed", employer: "—", occupation: "—" };

// Form 106I monthly income lines (2–11)
const INCOME_LINES = [
  { label: "Gross wages / salary / commissions", amount: 0 },
  { label: "Net income from business / profession", amount: 0 },
  { label: "Net income from rental / real property", amount: 0 },
  { label: "Interest & dividends", amount: 0 },
  { label: "Unemployment compensation", amount: 4608 },
  { label: "Social Security", amount: 0 },
  { label: "Pension / retirement income", amount: 0 },
  { label: "Other monthly income", amount: 0 },
];

export default function ScheduleIReview() {
  const total = useMemo(() => INCOME_LINES.reduce((a, l) => a + l.amount, 0), []);
  return (
    <div className="si">
      <Style />
      <h1><Wallet size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule I — Income</h1>
      <div className="form">Official Form 106I · Christian E. Iovin</div>
      <div className="card">
        <div className="ph">Part 1 · Employment</div>
        <Row k="Employment status" v={EMPLOYMENT.status} />
        <Row k="Employer" v={EMPLOYMENT.employer} />
        <Row k="Occupation" v={EMPLOYMENT.occupation} />

        <div className="ph">Part 2 · Monthly income</div>
        {INCOME_LINES.map((l, i) => (
          <div className="row" key={i}><span className={l.amount ? "" : "z"}>{l.label}</span><span className="amt">{money(l.amount)}</span></div>
        ))}
        <div className="grand"><span>Combined monthly income <span className="calc">auto</span></span><span>{money(total)}</span></div>
        <div className="note">Debtor is not currently employed — income is unemployment compensation. Request the unemployment award letter / benefit statements rather than pay advices.</div>
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
    .si * { box-sizing:border-box; }
    .si { --oxblood:#6b1f2a; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --line:#ddd2c2; --calc:#2d5b8e; --calc-bg:#e4ecf5;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:840px; margin:0 auto; }
    .si h1 { font-family:'Fraunces',serif; font-weight:600; font-size:24px; margin:0; }
    .si .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .si .card { background:#fffdf8; border:1px solid var(--line); border-radius:13px; padding:18px 20px; margin-top:16px; }
    .si .ph { font-family:'Fraunces',serif; font-size:13px; font-weight:600; color:var(--oxblood); text-transform:uppercase; letter-spacing:.04em; margin:16px 0 6px; }
    .si .ph:first-child { margin-top:0; }
    .si .kv { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:14px; padding:6px 0; border-bottom:1px solid var(--paper-2); }
    .si .kv .k { color:var(--muted); } .si .kv .v { font-weight:600; text-align:right; }
    .si .row { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:13.5px; padding:6px 0; border-bottom:1px solid var(--paper-2); }
    .si .row .z { color:var(--muted); } .si .amt { font-weight:600; text-align:right; }
    .si .grand { display:flex; justify-content:space-between; align-items:center; font-family:'Fraunces',serif; font-weight:600; font-size:16px; margin-top:14px; padding-top:14px; border-top:2px solid var(--oxblood); }
    .si .calc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--calc-bg); color:var(--calc); padding:1px 6px; border-radius:6px; margin-left:6px; }
    .si .note { font-size:12.5px; color:var(--muted); background:var(--paper); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:10px 0 2px; }
  `}</style>;
}
