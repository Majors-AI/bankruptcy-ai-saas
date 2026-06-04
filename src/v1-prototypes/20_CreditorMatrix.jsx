import React, { useState } from "react";
import { ListChecks, AlertCircle, Check, X, MapPin, Info } from "lucide-react";

/* Verified Creditor Matrix / List + interested parties.
   Compiles every noticing address from Schedules D/E/F (creditors), H
   (co-debtors), and G (lease counterparties, interested parties, and spouses
   such as a former spouse) — including ANY party listed with a DIFFERENT
   mailing address (an alternate/notice address gets its own matrix line).
   The client may LEAVE OFF a creditor (with a warning that an omitted creditor
   may not receive notice and the debt may not be discharged). Ends with the
   Verification of Creditor Matrix the debtor(s) sign. Comes after SOFA.
   Preview sample — bind to live schedule data at runtime. */

const ROLE_CLS = { "Creditor": "cred", "Priority creditor": "cred", "Co-debtor": "co", "Lease counterparty": "g", "Interested party": "ip", "Former spouse": "sp" };

const SAMPLE = {
  debtors: ["Robert Eugene Rasmussen", "Kimberly Ann Rasmussen"],
  parties: [
    { name: "Rushmore Loan Management", role: "Creditor", address: "P.O. Box 55004, Irvine, CA 92619", source: "Schedule D", different: false },
    { name: "Figure Lending LLC", role: "Creditor", address: "650 California St, San Francisco, CA 94108", source: "Schedule D", different: false },
    { name: "Ally Financial", role: "Creditor", address: "P.O. Box 380901, Bloomington, MN 55438", source: "Schedule D", different: false },
    { name: "Internal Revenue Service", role: "Priority creditor", address: "P.O. Box 7346, Philadelphia, PA 19101", source: "Schedule E", different: false },
    { name: "Capital One, N.A.", role: "Creditor", address: "P.O. Box 30285, Salt Lake City, UT 84130", source: "Schedule F", different: false },
    { name: "Capital One — Bankruptcy Dept", role: "Creditor", address: "P.O. Box 30285, Salt Lake City, UT 84130 (notice address)", source: "Schedule F", different: true },
    { name: "LVNV Funding LLC", role: "Creditor", address: "c/o Resurgent Capital, P.O. Box 10587, Greenville, SC 29603", source: "Schedule F", different: false },
    { name: "DriveTime Leasing", role: "Lease counterparty", address: "1720 W Rio Salado Pkwy, Tempe, AZ 85281", source: "Schedule G", different: false },
    { name: "Jordan A. Rasmussen (former spouse)", role: "Former spouse", address: "144 Pine Ridge Rd, Olympia, WA 98502", source: "Schedule G", different: true },
    { name: "Smith & Lee LLP (counsel for lessor)", role: "Interested party", address: "900 4th Ave, Suite 3100, Seattle, WA 98164", source: "Schedule G", different: true },
  ],
};

export default function CreditorMatrix({ data = SAMPLE }) {
  const [parties, setParties] = useState(data.parties.map((p) => ({ ...p, included: true, reason: "" })));
  const [filter, setFilter] = useState("all");

  const toggle = (i) => setParties((p) => p.map((r, j) => j === i ? { ...r, included: !r.included } : r));
  const setReason = (i, v) => setParties((p) => p.map((r, j) => j === i ? { ...r, reason: v } : r));

  const isCreditor = (r) => r.role === "Creditor" || r.role === "Priority creditor";
  const included = parties.filter((p) => p.included);
  const leftOff = parties.filter((p) => !p.included);
  const shown = parties.filter((p) => filter === "all" || (filter === "creditors" ? isCreditor(p) : filter === "interested" ? !isCreditor(p) : filter === "different" ? p.different : true));

  return (
    <div className="cm">
      <Style />
      <h1><ListChecks size={21} style={{ verticalAlign: -3, marginRight: 8 }} />Verified Creditor Matrix</h1>
      <div className="form">All creditors &amp; interested parties · every noticing address, including alternates · debtor-verified</div>
      <div className="rule"><Info size={12} style={{ verticalAlign: -1 }} /> Compiled from Schedules D/E/F (creditors), H (co-debtors), and G (lease counterparties, interested parties, and any spouse such as a former spouse). Any party with a <b>different mailing address</b> gets its own line. You may leave a creditor off — but an omitted creditor may not receive notice and that debt may not be discharged.</div>

      <div className="bar">
        <div className="counts"><b>{included.length}</b> included · {leftOff.length} left off · {parties.filter((p) => p.different).length} alternate addresses</div>
        <div className="filters">{[["all", "All"], ["creditors", "Creditors"], ["interested", "Interested parties"], ["different", "Different address"]].map(([k, l]) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>)}</div>
      </div>

      <div className="list">
        {shown.map((r) => {
          const i = parties.indexOf(r);
          return (
            <div className={"prow " + (r.included ? "" : "off")} key={i}>
              <button className={"inc " + (r.included ? "on" : "")} onClick={() => toggle(i)} title={r.included ? "Included" : "Left off"}>{r.included ? <Check size={13} /> : <X size={13} />}</button>
              <div className="pinfo">
                <div className="ptop"><span className="pname">{r.name}</span><span className={"role " + (ROLE_CLS[r.role] || "ip")}>{r.role}</span>{r.different && <span className="diff"><MapPin size={10} /> different address</span>}</div>
                <div className="paddr">{r.address} <span className="psrc">{r.source}</span></div>
                {!r.included && isCreditor(r) && (
                  <input className="reason" placeholder="Reason for leaving this creditor off (attorney reviews)…" value={r.reason} onChange={(e) => setReason(i, e.target.value)} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {leftOff.some(isCreditor) && (
        <div className="warn"><AlertCircle size={14} /> {leftOff.filter(isCreditor).length} creditor(s) left off the matrix will not be noticed — those debts may not be discharged. Attorney review required before filing.</div>
      )}

      <div className="verify">
        <div className="vh">Verification of Creditor Matrix</div>
        <div className="vtext">The above-named debtor(s) verify that the attached list of creditors is true and correct to the best of their knowledge. <b>The debtor signature/verification is captured at the full final review — after every document is complete</b> — not here.</div>
        {data.debtors.map((d, i) => (
          <div className="sigline" key={i}><span className="sigName">{d}</span><span className="sigLabel">Signature of Debtor · Date __________ (signed at final review)</span></div>
        ))}
        <button className="confirmbtn">Save creditor matrix ({included.length} parties) — verify at final review</button>
      </div>
    </div>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .cm * { box-sizing:border-box; }
    .cm { --oxblood:#6b1f2a; --oxblood-d:#54171f; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --good:#2f6b4f; --good-bg:#e4efe6; --warn:#9a5b16; --warn-bg:#f6ead7; --crit:#a23030; --crit-bg:#f3e0e0; --line:#ddd2c2; --calc:#2d5b8e; --calc-bg:#e4ecf5; --pur:#5b4a8a; --pur-bg:#e7e0f0;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:880px; margin:0 auto; }
    .cm h1 { font-family:'Fraunces',serif; font-weight:600; font-size:23px; margin:0; }
    .cm .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .cm .rule { font-size:12.5px; color:var(--muted); background:var(--paper-2); border-radius:9px; padding:10px 13px; margin-top:12px; line-height:1.5; }
    .cm .bar { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center; margin:14px 0 10px; }
    .cm .counts { font-size:12.5px; color:var(--muted); } .cm .counts b { color:var(--oxblood); font-size:14px; }
    .cm .filters { display:flex; gap:5px; flex-wrap:wrap; }
    .cm .filters button { border:1px solid var(--line); background:#fffdf8; border-radius:8px; padding:6px 12px; font:inherit; font-weight:600; font-size:12px; cursor:pointer; color:var(--muted); } .cm .filters button.on { background:var(--oxblood); color:#fff; border-color:var(--oxblood); }
    .cm .list { background:#fffdf8; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
    .cm .prow { display:flex; gap:11px; align-items:flex-start; padding:12px 15px; border-bottom:1px solid var(--paper-2); } .cm .prow:last-child { border-bottom:none; }
    .cm .prow.off { background:var(--paper-2); opacity:.7; } .cm .prow.off .pname { text-decoration:line-through; }
    .cm .inc { flex:none; width:26px; height:26px; border-radius:7px; border:1px solid var(--line); background:#fffdf8; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--muted); }
    .cm .inc.on { background:var(--good); border-color:var(--good); color:#fff; }
    .cm .pinfo { flex:1; }
    .cm .ptop { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .cm .pname { font-weight:600; font-size:13.5px; }
    .cm .role { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:2px 7px; border-radius:999px; }
    .cm .role.cred { background:#efe2e4; color:var(--oxblood); } .cm .role.co { background:var(--calc-bg); color:var(--calc); } .cm .role.g { background:var(--warn-bg); color:var(--warn); } .cm .role.ip { background:var(--pur-bg); color:var(--pur); } .cm .role.sp { background:var(--good-bg); color:var(--good); }
    .cm .diff { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--crit); background:var(--crit-bg); padding:2px 7px; border-radius:999px; display:inline-flex; gap:3px; align-items:center; }
    .cm .paddr { font-size:12.5px; color:var(--muted); margin-top:3px; } .cm .psrc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); background:var(--paper-2); padding:1px 6px; border-radius:999px; margin-left:6px; }
    .cm .reason { width:100%; margin-top:8px; border:1px solid var(--crit); border-radius:7px; padding:7px 10px; font:inherit; font-size:12.5px; background:#fff; }
    .cm .warn { display:flex; gap:8px; align-items:center; font-size:12.5px; font-weight:600; color:var(--crit); background:var(--crit-bg); border-radius:9px; padding:11px 13px; margin-top:12px; }
    .cm .verify { background:#fffdf8; border:2px solid var(--oxblood); border-radius:12px; padding:16px 18px; margin-top:16px; }
    .cm .vh { font-family:'Fraunces',serif; font-weight:600; font-size:16px; color:var(--oxblood); margin-bottom:6px; }
    .cm .vtext { font-size:13px; line-height:1.5; margin-bottom:14px; }
    .cm .sigline { border-top:1px solid var(--line); padding-top:6px; margin-top:18px; } .cm .sigName { font-weight:600; font-size:13.5px; display:block; } .cm .sigLabel { font-size:11.5px; color:var(--muted); }
    .cm .confirmbtn { margin-top:16px; border:none; border-radius:10px; padding:12px 22px; font:inherit; font-weight:600; font-size:14px; cursor:pointer; background:var(--oxblood); color:#fff; } .cm .confirmbtn:hover { background:var(--oxblood-d); }
  `}</style>;
}
