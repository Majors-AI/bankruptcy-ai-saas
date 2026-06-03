import React, { useMemo } from "react";
import { CreditCard } from "lucide-react";

/* Schedule F — Official Form 106E/F (Part 2) — nonpriority unsecured creditors.
   Restyled to the bankruptcy.ai dark theme.

   ── INTEGRATION CONTRACT ──────────────────────────────────────────────
   PROP-DRIVEN. Pass `unsecured`. EXAMPLE_UNSECURED is SAMPLE ONLY and
   MUST NOT ship. Wire from the questionnaire/Supabase during merge.

   unsecured: { name, acct, basis, amount:number }[]
   <ScheduleFReview unsecured={unsecuredCreditors} debtor="Jane Sample" />
   ─────────────────────────────────────────────────────────────────────── */

const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* EXAMPLE ONLY — do not ship. */
const EXAMPLE_UNSECURED = [
  { name: "Example Bank", acct: "••0000", basis: "Credit card", amount: 0 },
];

export default function ScheduleFReview({ unsecured = EXAMPLE_UNSECURED, debtor = "Example Debtor" }) {
  const total = useMemo(() => unsecured.reduce((a, c) => a + (c.amount || 0), 0), [unsecured]);
  return (
    <div className="sf">
      <Style />
      <h1><CreditCard size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule F — Nonpriority unsecured</h1>
      <div className="form">Official Form 106E/F (Part 2) · {debtor}</div>
      <div className="card">
        <div className="ph">Nonpriority unsecured claims · {unsecured.length} creditors</div>
        {unsecured.length === 0
          ? <div className="empty">None reported</div>
          : unsecured.map((c, i) => (
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
    .sf * { box-sizing:border-box; }
    .sf {
      --accent:#fbbf24; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8; --calc:#7dd3fc; --calc-bg:rgba(56,189,248,.12);
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:840px; margin:0 auto; }
    .sf h1 { font-family:var(--serif); font-weight:600; font-size:24px; margin:0; color:#fff; }
    .sf .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .sf .card { background:var(--bg); border:1px solid var(--line); border-radius:16px; padding:18px 20px; margin-top:16px; }
    .sf .ph { font-family:var(--serif); font-size:13px; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:.04em; margin:0 0 6px; }
    .sf .row { display:grid; grid-template-columns:1fr auto; gap:4px 16px; align-items:center; font-size:13.5px; padding:8px 0; border-bottom:1px solid var(--line-soft); }
    .sf .row small { color:var(--muted); font-size:12px; }
    .sf .amt { font-weight:600; text-align:right; white-space:nowrap; }
    .sf .empty { color:var(--muted); font-style:italic; font-size:13px; padding:4px 0; }
    .sf .grand { display:flex; justify-content:space-between; align-items:center; font-family:var(--serif); font-weight:600; font-size:16px; margin-top:14px; padding-top:14px; border-top:2px solid var(--accent); color:#fff; }
    .sf .calc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--calc-bg); color:var(--calc); padding:1px 6px; border-radius:6px; margin-left:6px; }
    .sf .note { font-size:12.5px; color:var(--muted); background:var(--bg-2); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:10px 0 2px; }
  `}</style>;
}
