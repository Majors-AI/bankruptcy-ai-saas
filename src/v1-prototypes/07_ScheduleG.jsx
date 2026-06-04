import React from "react";
import { FileSignature } from "lucide-react";

/* Schedule G — Official Form 106G — executory contracts & unexpired leases.
   Iovin: none reported. Self-contained; structure shown for the general case. */

const CONTRACTS = [
  // { otherParty: "...", address: "...", nature: "Lease / contract description" }
];

export default function ScheduleGReview() {
  return (
    <div className="sg">
      <Style />
      <h1><FileSignature size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule G — Contracts & leases</h1>
      <div className="form">Official Form 106G · Christian E. Iovin</div>
      <div className="card">
        <div className="ph">Executory contracts & unexpired leases</div>
        {CONTRACTS.length === 0
          ? <div className="empty">None reported — the debtor has no executory contracts or unexpired leases (e.g. residential/commercial leases, vehicle leases, service contracts, timeshares).</div>
          : CONTRACTS.map((c, i) => (
            <div className="row" key={i}>
              <span>{c.otherParty}<br /><small>{c.address}</small></span>
              <span className="nature">{c.nature}</span>
            </div>
          ))}
        <div className="note">Verify with the client: any apartment/home lease, vehicle lease, equipment lease, cell-phone/service contract, or timeshare belongs here. Personal-property leases flow to the Statement of Intention (Form 108) for assume/reject; any non-debtor party here (e.g., a former spouse or interested party) flows to the verified creditor matrix.</div>
      </div>
    </div>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .sg * { box-sizing:border-box; }
    .sg { --oxblood:#6b1f2a; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --line:#ddd2c2;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:840px; margin:0 auto; }
    .sg h1 { font-family:'Fraunces',serif; font-weight:600; font-size:24px; margin:0; }
    .sg .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .sg .card { background:#fffdf8; border:1px solid var(--line); border-radius:13px; padding:18px 20px; margin-top:16px; }
    .sg .ph { font-family:'Fraunces',serif; font-size:13px; font-weight:600; color:var(--oxblood); text-transform:uppercase; letter-spacing:.04em; margin:0 0 8px; }
    .sg .row { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:13.5px; padding:8px 0; border-bottom:1px solid var(--paper-2); }
    .sg .row small { color:var(--muted); font-size:12px; }
    .sg .nature { font-weight:600; text-align:right; }
    .sg .empty { color:var(--muted); font-style:italic; font-size:13.5px; padding:4px 0; line-height:1.5; }
    .sg .note { font-size:12.5px; color:var(--muted); background:var(--paper); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:12px 0 2px; }
  `}</style>;
}
