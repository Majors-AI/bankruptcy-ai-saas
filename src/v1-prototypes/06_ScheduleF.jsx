import React, { useMemo } from "react";
import { CreditCard } from "lucide-react";

/* Schedule F — Official Form 106E/F (Part 2) — nonpriority unsecured creditors.
   Iovin case. Self-contained. */

const money = (n) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const UNSECURED = [
  { name: "Bank of America", acct: "••1968", basis: "Credit card", amount: 7499.95 },
  { name: "Bank of America", acct: "••6732", basis: "Credit card", amount: 10345.48 },
  { name: "Barclays", acct: "••8951", basis: "Credit card", amount: 6311.26 },
  { name: "BECU", acct: "••2004", basis: "Credit card", amount: 4366.97 },
  { name: "Capital One", acct: "••3683", basis: "Credit card", amount: 4992.60 },
  { name: "PayPal", acct: "••6763", basis: "Credit card", amount: 3464.41 },
];

export default function ScheduleFReview() {
  const total = useMemo(() => UNSECURED.reduce((a, c) => a + c.amount, 0), []);
  return (
    <div className="sf">
      <Style />
      <h1><CreditCard size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule F — Nonpriority unsecured</h1>
      <div className="form">Official Form 106E/F (Part 2) · Christian E. Iovin</div>
      <div className="card">
        <div className="ph">Nonpriority unsecured claims · {UNSECURED.length} creditors</div>
        {UNSECURED.map((c, i) => (
          <div className="row" key={i}>
            <span>{c.name}<br /><small>{c.basis} · acct {c.acct}</small></span>
            <span className="amt">{money(c.amount)}</span>
          </div>
        ))}
        <div className="grand"><span>Total unsecured claims (F) <span className="calc">auto</span></span><span>{money(total)}</span></div>
        <div className="note">Confirm each balance and full account number against a recent statement before filing.</div>
      </div>
    </div>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .sf * { box-sizing:border-box; }
    .sf { --oxblood:#6b1f2a; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --line:#ddd2c2; --calc:#2d5b8e; --calc-bg:#e4ecf5;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:840px; margin:0 auto; }
    .sf h1 { font-family:'Fraunces',serif; font-weight:600; font-size:24px; margin:0; }
    .sf .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .sf .card { background:#fffdf8; border:1px solid var(--line); border-radius:13px; padding:18px 20px; margin-top:16px; }
    .sf .ph { font-family:'Fraunces',serif; font-size:13px; font-weight:600; color:var(--oxblood); text-transform:uppercase; letter-spacing:.04em; margin:0 0 6px; }
    .sf .row { display:grid; grid-template-columns:1fr auto; gap:4px 16px; align-items:center; font-size:13.5px; padding:8px 0; border-bottom:1px solid var(--paper-2); }
    .sf .row small { color:var(--muted); font-size:12px; }
    .sf .amt { font-weight:600; text-align:right; white-space:nowrap; }
    .sf .grand { display:flex; justify-content:space-between; align-items:center; font-family:'Fraunces',serif; font-weight:600; font-size:16px; margin-top:14px; padding-top:14px; border-top:2px solid var(--oxblood); }
    .sf .calc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--calc-bg); color:var(--calc); padding:1px 6px; border-radius:6px; margin-left:6px; }
    .sf .note { font-size:12.5px; color:var(--muted); background:var(--paper); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:10px 0 2px; }
  `}</style>;
}
