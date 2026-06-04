import React, { useState } from "react";
import { ClipboardCheck, Info, Circle, CheckCircle2, AlertCircle } from "lucide-react";

/* Statement of Intention — Official Form 108 (Chapter 7).
   Part 1 pulls every secured creditor from Schedule D (Form 106D) and captures
   the debtor's intention with the collateral: Surrender / Retain & redeem /
   Retain & reaffirm / Retain & explain — plus whether the property was claimed
   exempt on Schedule C. Part 2 pulls unexpired PERSONAL-property leases from
   Schedule G (Form 106G) with assume / do-not-assume. Real-estate leases are
   excluded. Comes after SOFA, in the signing/filing package.
   Preview sample — bind to live Schedule D / G data at runtime. */

const INTENTS = [
  { k: "surrender", label: "Surrender the property" },
  { k: "redeem", label: "Retain and redeem it" },
  { k: "reaffirm", label: "Retain and reaffirm (Reaffirmation Agreement)" },
  { k: "retain", label: "Retain and [explain]" },
];

const SAMPLE = {
  debtor: "Debtor (preview)",
  secured: [   // from Schedule D
    { creditor: "Rushmore", property: "6047 Atlas Place SW (residence) — 1st mortgage", exemptC: true, intent: "retain", explain: "Maintain regular monthly payments." },
    { creditor: "Figure Lending", property: "6047 Atlas Place SW (residence) — 2nd mortgage", exemptC: true, intent: "retain", explain: "Maintain regular monthly payments." },
    { creditor: "Ally", property: "2017 Maserati Ghibli — auto loan", exemptC: false, intent: "reaffirm", explain: "" },
  ],
  leases: [    // personal-property leases from Schedule G (no real estate)
    { lessor: "DriveTime Leasing", property: "2022 Nissan Altima (lease)", assume: true },
  ],
};

export default function StatementOfIntention({ data = SAMPLE }) {
  const [secured, setSecured] = useState(data.secured);
  const [leases, setLeases] = useState(data.leases);

  const setIntent = (i, k) => setSecured((p) => p.map((r, j) => j === i ? { ...r, intent: k } : r));
  const setExplain = (i, v) => setSecured((p) => p.map((r, j) => j === i ? { ...r, explain: v } : r));
  const setExempt = (i, v) => setSecured((p) => p.map((r, j) => j === i ? { ...r, exemptC: v } : r));
  const setAssume = (i, v) => setLeases((p) => p.map((r, j) => j === i ? { ...r, assume: v } : r));

  const done = secured.every((r) => r.intent) ;
  const lbl = (k) => INTENTS.find((x) => x.k === k)?.label;

  return (
    <div className="soi">
      <Style />
      <h1><ClipboardCheck size={21} style={{ verticalAlign: -3, marginRight: 8 }} />Statement of Intention</h1>
      <div className="form">Official Form 108 · Chapter 7 · file within 30 days of the petition or by the 341, whichever is earlier</div>
      <div className="rule"><Info size={12} style={{ verticalAlign: -1 }} /> Pulled from Schedule D (secured creditors) and Schedule G (personal-property leases). Confirm the intention for each. Copies must be sent to the listed creditors and lessors.</div>

      {/* Part 1 — secured */}
      <div className="card">
        <div className="ph">Part 1 · Creditors with secured claims (from Schedule D)</div>
        {secured.map((r, i) => (
          <div className="row" key={i}>
            <div className="rtop">
              <div className="rinfo"><span className="cred">{r.creditor}</span><span className="prop">{r.property}</span></div>
              <button className={"exempt " + (r.exemptC ? "on" : "")} onClick={() => setExempt(i, !r.exemptC)}>
                {r.exemptC ? <CheckCircle2 size={12} /> : <Circle size={12} />} Claimed exempt on Schedule C
              </button>
            </div>
            <div className="intents">
              {INTENTS.map((it) => (
                <button key={it.k} className={"intent " + (r.intent === it.k ? "on" : "")} onClick={() => setIntent(i, it.k)}>
                  {r.intent === it.k ? <CheckCircle2 size={12} /> : <Circle size={12} />} {it.label}
                </button>
              ))}
            </div>
            {r.intent === "retain" && (
              <input className="explain" placeholder="Explain (e.g., maintain regular payments / pay outside the plan)…" value={r.explain || ""} onChange={(e) => setExplain(i, e.target.value)} />
            )}
          </div>
        ))}
        {secured.length === 0 && <div className="empty">No secured creditors on Schedule D.</div>}
      </div>

      {/* Part 2 — leases */}
      <div className="card">
        <div className="ph">Part 2 · Unexpired personal-property leases (from Schedule G)</div>
        <div className="micro"><Info size={11} style={{ verticalAlign: -1 }} /> Personal-property leases only — do not list real-estate leases.</div>
        {leases.map((r, i) => (
          <div className="row" key={i}>
            <div className="rtop">
              <div className="rinfo"><span className="cred">{r.lessor}</span><span className="prop">{r.property}</span></div>
              <div className="yn">
                <button className={r.assume === true ? "on" : ""} onClick={() => setAssume(i, true)}>Assume lease</button>
                <button className={r.assume === false ? "on" : ""} onClick={() => setAssume(i, false)}>Do not assume</button>
              </div>
            </div>
          </div>
        ))}
        {leases.length === 0 && <div className="empty">No personal-property leases on Schedule G.</div>}
      </div>

      {/* Summary */}
      <div className="summary">
        <div className="sum-h"><ClipboardCheck size={16} /> Summary of intentions</div>
        <div className="sum-group">Secured property</div>
        {secured.map((r, i) => (
          <div className="sum-row" key={i}>
            <span className="sum-q">{r.creditor} — {r.property}</span>
            <span className={"sum-a " + (r.intent ? "yes" : "")}>{r.intent ? lbl(r.intent) : <em>—</em>}{r.intent === "retain" && r.explain ? `: ${r.explain}` : ""}{r.exemptC ? " · exempt (C)" : ""}</span>
          </div>
        ))}
        <div className="sum-group">Personal-property leases</div>
        {leases.map((r, i) => (
          <div className="sum-row" key={i}><span className="sum-q">{r.lessor} — {r.property}</span><span className={"sum-a " + (r.assume ? "yes" : "no")}>{r.assume ? "Assume" : "Do not assume"}</span></div>
        ))}
        {leases.length === 0 && <div className="sum-row"><span className="sum-q">Leases</span><span className="sum-a no">None</span></div>}

        <div className="sign">Under penalty of perjury, the debtor(s) declare the intentions stated above. Both debtors sign and date (joint case). Attorney reviews before filing.</div>
        <button className="confirmbtn" disabled={!done}>{done ? "Confirm Statement of Intention" : "Select an intention for each secured creditor"}</button>
      </div>
    </div>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .soi * { box-sizing:border-box; }
    .soi { --oxblood:#6b1f2a; --oxblood-d:#54171f; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --good:#2f6b4f; --good-bg:#e4efe6; --warn:#9a5b16; --warn-bg:#f6ead7; --line:#ddd2c2;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:860px; margin:0 auto; }
    .soi h1 { font-family:'Fraunces',serif; font-weight:600; font-size:24px; margin:0; }
    .soi .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .soi .rule { font-size:12.5px; color:var(--muted); background:var(--paper-2); border-radius:9px; padding:10px 13px; margin-top:12px; line-height:1.5; }
    .soi .card { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:6px 18px 10px; margin-top:14px; }
    .soi .ph { font-family:'Fraunces',serif; font-size:13px; font-weight:600; color:var(--oxblood); text-transform:uppercase; letter-spacing:.04em; padding:12px 0 8px; border-bottom:1px solid var(--line); }
    .soi .micro { font-size:12px; color:var(--muted); margin-top:8px; }
    .soi .row { padding:13px 0; border-bottom:1px solid var(--paper-2); } .soi .row:last-child { border-bottom:none; }
    .soi .rtop { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap; }
    .soi .cred { font-weight:600; font-size:14px; display:block; } .soi .prop { font-size:12.5px; color:var(--muted); display:block; margin-top:1px; }
    .soi .exempt { border:1px solid var(--line); background:var(--paper); border-radius:8px; padding:5px 10px; font:inherit; font-weight:600; font-size:11.5px; cursor:pointer; color:var(--muted); display:inline-flex; gap:5px; align-items:center; white-space:nowrap; }
    .soi .exempt.on { background:var(--good-bg); color:var(--good); border-color:var(--good); }
    .soi .intents { display:flex; gap:6px; flex-wrap:wrap; margin-top:10px; }
    .soi .intent { border:1px solid var(--line); background:var(--paper); border-radius:8px; padding:6px 11px; font:inherit; font-weight:600; font-size:12px; cursor:pointer; color:var(--muted); display:inline-flex; gap:5px; align-items:center; }
    .soi .intent.on { background:#efe2e4; color:var(--oxblood); border-color:var(--oxblood); }
    .soi .explain { width:100%; margin-top:9px; border:1px solid var(--line); border-radius:8px; padding:9px 11px; font:inherit; font-size:13px; background:var(--paper); }
    .soi .yn { display:inline-flex; gap:6px; flex:none; }
    .soi .yn button { border:1px solid var(--line); background:var(--paper); border-radius:8px; padding:6px 14px; font:inherit; font-weight:600; font-size:12px; cursor:pointer; color:var(--muted); }
    .soi .yn button.on { background:var(--oxblood); color:#fff; border-color:var(--oxblood); }
    .soi .empty { font-size:13px; color:var(--muted); padding:12px 0; }
    .soi .summary { background:#fffdf8; border:2px solid var(--oxblood); border-radius:12px; padding:16px 18px; margin-top:16px; }
    .soi .sum-h { font-family:'Fraunces',serif; font-weight:600; font-size:16px; display:flex; gap:8px; align-items:center; margin-bottom:8px; }
    .soi .sum-group { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--oxblood); margin:12px 0 4px; border-bottom:1px solid var(--line); padding-bottom:4px; }
    .soi .sum-row { display:grid; grid-template-columns:1.2fr 1fr; gap:8px 14px; font-size:13px; padding:8px 0; border-bottom:1px solid var(--paper-2); }
    .soi .sum-q { font-weight:600; } .soi .sum-a { text-align:right; font-weight:600; } .soi .sum-a.yes { color:var(--good); } .soi .sum-a.no { color:var(--muted); } .soi .sum-a em { color:var(--muted); font-style:normal; }
    .soi .sign { font-size:12.5px; color:var(--ink); background:var(--paper-2); border-radius:8px; padding:11px 13px; margin-top:12px; line-height:1.5; }
    .soi .confirmbtn { margin-top:12px; border:none; border-radius:10px; padding:12px 22px; font:inherit; font-weight:600; font-size:14px; cursor:pointer; background:var(--oxblood); color:#fff; }
    .soi .confirmbtn:disabled { background:var(--line); cursor:not-allowed; } .soi .confirmbtn:not(:disabled):hover { background:var(--oxblood-d); }
  `}</style>;
}
