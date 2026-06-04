import React, { useMemo } from "react";
import { Home, Car } from "lucide-react";

/* Schedule D — Official Form 106D — secured creditors review.
   Grouped homes + vehicles, collateral value, claim balance, total. Iovin. */

const money = (n) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SECURED = [
  { name: "Rushmore", kind: "home", collateral: "6047 Atlas Place SW (residence)", value: 2000000, balance: 1408730, lien: "1st mortgage" },
  { name: "Figure Lending", kind: "home", collateral: "6047 Atlas Place SW (residence)", value: 2000000, balance: 198114.75, lien: "2nd mortgage" },
  { name: "Michael Iovin", kind: "home", collateral: "6047 Atlas Place SW (residence)", value: 2000000, balance: 330000, lien: "3rd mortgage (private)" },
  { name: "Ally", kind: "vehicle", collateral: "2017 Maserati Ghibli", value: 16000, balance: 15915.83, lien: "auto loan" },
];

export default function ScheduleDReview() {
  const total = useMemo(() => SECURED.reduce((a, c) => a + c.balance, 0), []);
  const homes = SECURED.filter((c) => c.kind === "home");
  const homeLiens = homes.reduce((a, c) => a + c.balance, 0);
  return (
    <div className="sd">
      <Style />
      <h1><Home size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule D — Secured creditors</h1>
      <div className="form">Official Form 106D · Christian E. Iovin</div>
      <div className="card">
        <div className="ph"><Home size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Real property (homes)</div>
        {homes.map((c, i) => <Cred key={i} c={c} />)}
        <div className="ph"><Car size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Vehicles</div>
        {SECURED.filter((c) => c.kind === "vehicle").map((c, i) => <Cred key={i} c={c} />)}
        <div className="grand"><span>Total secured claims (D) <span className="calc">auto</span></span><span>{money(total)}</span></div>
        <div className="note">Home liens total {money(homeLiens)} against a {money(2000000)} value — roughly {money(2000000 - homeLiens)} equity. Flag for the Schedule C exemption review.</div>
      </div>
    </div>
  );
}

function Cred({ c }) {
  return (
    <div className="row">
      <span>{c.name}<br /><small>{c.lien} · {c.collateral}</small></span>
      <span className="col">collateral {money(c.value)}</span>
      <span className="amt">{money(c.balance)}</span>
    </div>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .sd * { box-sizing:border-box; }
    .sd { --oxblood:#6b1f2a; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --line:#ddd2c2; --calc:#2d5b8e; --calc-bg:#e4ecf5;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:840px; margin:0 auto; }
    .sd h1 { font-family:'Fraunces',serif; font-weight:600; font-size:24px; margin:0; }
    .sd .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .sd .card { background:#fffdf8; border:1px solid var(--line); border-radius:13px; padding:18px 20px; margin-top:16px; }
    .sd .ph { font-family:'Fraunces',serif; font-size:13px; font-weight:600; color:var(--oxblood); text-transform:uppercase; letter-spacing:.04em; margin:16px 0 6px; }
    .sd .ph:first-child { margin-top:0; }
    .sd .row { display:grid; grid-template-columns:1fr auto auto; gap:4px 14px; align-items:center; font-size:13.5px; padding:8px 0; border-bottom:1px solid var(--paper-2); }
    .sd .row small { color:var(--muted); font-size:12px; }
    .sd .col { font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:#efe2e4; color:var(--oxblood); padding:2px 8px; border-radius:999px; white-space:nowrap; }
    .sd .amt { font-weight:600; text-align:right; white-space:nowrap; }
    .sd .grand { display:flex; justify-content:space-between; align-items:center; font-family:'Fraunces',serif; font-weight:600; font-size:16px; margin-top:14px; padding-top:14px; border-top:2px solid var(--oxblood); }
    .sd .calc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--calc-bg); color:var(--calc); padding:1px 6px; border-radius:6px; margin-left:6px; }
    .sd .note { font-size:12.5px; color:var(--muted); background:var(--paper); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:10px 0 2px; }
  `}</style>;
}
