import React from "react";
import { FileSignature } from "lucide-react";

/* Schedule G — Official Form 106G — executory contracts & unexpired leases.
   Restyled to the bankruptcy.ai dark theme.

   ── INTEGRATION CONTRACT ──────────────────────────────────────────────
   PROP-DRIVEN. Pass `contracts` ([] when none). Wire from the
   questionnaire/Supabase during merge.

   contracts: { otherParty, address, nature }[]
   <ScheduleGReview contracts={contracts} debtor="Jane Sample" />
   ─────────────────────────────────────────────────────────────────────── */

export default function ScheduleGReview({ contracts = [], debtor = "Example Debtor" }) {
  return (
    <div className="sg">
      <Style />
      <h1><FileSignature size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule G — Contracts & leases</h1>
      <div className="form">Official Form 106G · {debtor}</div>
      <div className="card">
        <div className="ph">Executory contracts & unexpired leases</div>
        {contracts.length === 0
          ? <div className="empty">None reported — the debtor has no executory contracts or unexpired leases (e.g. residential/commercial leases, vehicle leases, service contracts, timeshares).</div>
          : contracts.map((c, i) => (
            <div className="row" key={i}>
              <span>{c.otherParty}<br /><small>{c.address}</small></span>
              <span className="nature">{c.nature}</span>
            </div>
          ))}
        <div className="note">Verify with the client: any apartment/home lease, vehicle lease, equipment lease, cell-phone/service contract, or timeshare belongs here.</div>
      </div>
    </div>
  );
}

function Style() {
  return <style>{`
    .sg * { box-sizing:border-box; }
    .sg {
      --accent:#fbbf24; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8;
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:840px; margin:0 auto; }
    .sg h1 { font-family:var(--serif); font-weight:600; font-size:24px; margin:0; color:#fff; }
    .sg .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .sg .card { background:var(--bg); border:1px solid var(--line); border-radius:16px; padding:18px 20px; margin-top:16px; }
    .sg .ph { font-family:var(--serif); font-size:13px; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:.04em; margin:0 0 8px; }
    .sg .row { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:13.5px; padding:8px 0; border-bottom:1px solid var(--line-soft); }
    .sg .row small { color:var(--muted); font-size:12px; }
    .sg .nature { font-weight:600; text-align:right; }
    .sg .empty { color:var(--muted); font-style:italic; font-size:13.5px; padding:4px 0; line-height:1.5; }
    .sg .note { font-size:12.5px; color:var(--muted); background:var(--bg-2); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:12px 0 2px; }
  `}</style>;
}
