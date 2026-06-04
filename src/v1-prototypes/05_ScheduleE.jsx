import React, { useMemo } from "react";
import { Landmark } from "lucide-react";

/* Schedule E — Official Form 106E/F (Part 1) — priority unsecured creditors.
   Iovin case. Self-contained. */

const money = (n) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PRIORITY = [
  { name: "Internal Revenue Service", basis: "Income taxes — 2020 & 2021", amount: 2109923.71, type: "Tax" },
  { name: "Asha Iovin", basis: "Domestic support obligation (child support)", amount: 0, type: "Support" },
  { name: "DSHS — Division of Child Support", basis: "Domestic support obligation", amount: 0, type: "Support" },
];

export default function ScheduleEReview() {
  const total = useMemo(() => PRIORITY.reduce((a, c) => a + c.amount, 0), []);
  return (
    <div className="se">
      <Style />
      <h1><Landmark size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule E — Priority unsecured</h1>
      <div className="form">Official Form 106E/F (Part 1) · Christian E. Iovin</div>
      <div className="card">
        <div className="ph">Priority claims</div>
        {PRIORITY.map((c, i) => (
          <div className="row" key={i}>
            <span>{c.name}<br /><small>{c.basis}</small></span>
            <span className="pill">{c.type}</span>
            <span className="amt">{money(c.amount)}</span>
          </div>
        ))}
        <div className="grand"><span>Total priority claims (E) <span className="calc">auto</span></span><span>{money(total)}</span></div>
        <div className="note">Zero-balance support claims (Asha Iovin, DSHS) are listed for notice; confirm current arrears with the client / DSHS.</div>
      </div>
    </div>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .se * { box-sizing:border-box; }
    .se { --oxblood:#6b1f2a; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --warn:#9a5b16; --warn-bg:#f6ead7; --line:#ddd2c2; --calc:#2d5b8e; --calc-bg:#e4ecf5;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:840px; margin:0 auto; }
    .se h1 { font-family:'Fraunces',serif; font-weight:600; font-size:24px; margin:0; }
    .se .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .se .card { background:#fffdf8; border:1px solid var(--line); border-radius:13px; padding:18px 20px; margin-top:16px; }
    .se .ph { font-family:'Fraunces',serif; font-size:13px; font-weight:600; color:var(--oxblood); text-transform:uppercase; letter-spacing:.04em; margin:0 0 6px; }
    .se .row { display:grid; grid-template-columns:1fr auto auto; gap:4px 14px; align-items:center; font-size:13.5px; padding:8px 0; border-bottom:1px solid var(--paper-2); }
    .se .row small { color:var(--muted); font-size:12px; }
    .se .pill { font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--warn-bg); color:var(--warn); padding:2px 8px; border-radius:999px; white-space:nowrap; }
    .se .amt { font-weight:600; text-align:right; white-space:nowrap; }
    .se .grand { display:flex; justify-content:space-between; align-items:center; font-family:'Fraunces',serif; font-weight:600; font-size:16px; margin-top:14px; padding-top:14px; border-top:2px solid var(--oxblood); }
    .se .calc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--calc-bg); color:var(--calc); padding:1px 6px; border-radius:6px; margin-left:6px; }
    .se .note { font-size:12.5px; color:var(--muted); background:var(--paper); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:10px 0 2px; }
  `}</style>;
}
