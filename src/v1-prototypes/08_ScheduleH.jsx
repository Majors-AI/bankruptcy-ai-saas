import React from "react";
import { Users } from "lucide-react";

/* Schedule H — Official Form 106H — codebtors.
   Iovin: none reported. Self-contained; structure shown for the general case. */

const CODEBTORS = [
  // { name: "...", address: "...", creditor: "Associated creditor", schedule: "D/E/F" }
];

export default function ScheduleHReview() {
  return (
    <div className="sh">
      <Style />
      <h1><Users size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule H — Codebtors</h1>
      <div className="form">Official Form 106H · Christian E. Iovin</div>
      <div className="card">
        <div className="ph">Codebtors</div>
        {CODEBTORS.length === 0
          ? <div className="empty">None reported — no other person is liable on any of the debtor's debts (no co-signers, guarantors, or community-property codebtors).</div>
          : CODEBTORS.map((c, i) => (
            <div className="row" key={i}>
              <span>{c.name}<br /><small>{c.address}</small></span>
              <span className="rel">{c.creditor} · Sched {c.schedule}</span>
            </div>
          ))}
        <div className="note">Verify with the client: co-signers, guarantors, ex-spouses on joint debts, and — in community-property states (WA / AZ) — a non-filing spouse can be a codebtor.</div>
      </div>
    </div>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .sh * { box-sizing:border-box; }
    .sh { --oxblood:#6b1f2a; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --line:#ddd2c2;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:840px; margin:0 auto; }
    .sh h1 { font-family:'Fraunces',serif; font-weight:600; font-size:24px; margin:0; }
    .sh .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .sh .card { background:#fffdf8; border:1px solid var(--line); border-radius:13px; padding:18px 20px; margin-top:16px; }
    .sh .ph { font-family:'Fraunces',serif; font-size:13px; font-weight:600; color:var(--oxblood); text-transform:uppercase; letter-spacing:.04em; margin:0 0 8px; }
    .sh .row { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:13.5px; padding:8px 0; border-bottom:1px solid var(--paper-2); }
    .sh .row small { color:var(--muted); font-size:12px; }
    .sh .rel { font-weight:600; text-align:right; }
    .sh .empty { color:var(--muted); font-style:italic; font-size:13.5px; padding:4px 0; line-height:1.5; }
    .sh .note { font-size:12.5px; color:var(--muted); background:var(--paper); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:12px 0 2px; }
  `}</style>;
}
