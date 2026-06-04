import React, { useState } from "react";
import { FileSignature, Info, Circle, CheckCircle2 } from "lucide-react";

/* Disclosure of Compensation of Attorney for Debtor — Official Form 2030.
   Signed and filed by the ATTORNEY (11 U.S.C. § 329(a), Fed. R. Bankr. P. 2016(b)).
   Discloses the fee agreed, the amount the client has paid, and the balance due.
   The fee schedule is driven by case type — Regular Chapter 7, Bifurcated
   Chapter 7, or Chapter 13 — set on the client record at intake / legacy import /
   after attorney review, and flows here and into SOFA. Comes after SOFA.
   Preview presets are editable — bind to the live fee record at runtime. */

const PRESETS = {
  ch7: { label: "Regular Chapter 7", agreed: 1800, received: 1800, note: "Flat fee — paid in full before filing (pre-petition Chapter 7 fees cannot be financed post-petition as a dischargeable balance)." },
  bifurcated: { label: "Bifurcated Chapter 7", agreed: 2200, received: 0, note: "Pre-petition portion $0; the balance is financed under a SEPARATE post-petition fee agreement and is not a pre-petition debt." },
  ch13: { label: "Chapter 13", agreed: 4500, received: 500, note: "Presumptively-reasonable (\"no-look\") fee; the balance is paid through the confirmed Chapter 13 plan." },
};
const SERVICES = [
  { k: "a", label: "Analysis of the debtor's financial situation and advice on whether to file" },
  { k: "b", label: "Preparation and filing of the petition, schedules, statement of affairs, and plan" },
  { k: "c", label: "Representation at the meeting of creditors and confirmation hearing (and adjournments)" },
  { k: "d", label: "Representation in adversary proceedings and other contested matters" },
];

const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DisclosureOfCompensation({ data = {} }) {
  const [caseType, setCaseType] = useState(data.caseType || "ch7");
  const [agreed, setAgreed] = useState(PRESETS[data.caseType || "ch7"].agreed);
  const [received, setReceived] = useState(PRESETS[data.caseType || "ch7"].received);
  const [source, setSource] = useState("Debtor");
  const [shared, setShared] = useState(false);
  const [services, setServices] = useState({ a: true, b: true, c: true, d: false });
  const [excluded, setExcluded] = useState("Adversary proceedings; non-dischargeability or relief-from-stay litigation (billed separately).");

  const pick = (k) => { setCaseType(k); setAgreed(PRESETS[k].agreed); setReceived(PRESETS[k].received); };
  const balance = Math.max(0, agreed - received);
  const toggle = (k) => setServices((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="doc">
      <Style />
      <h1><FileSignature size={21} style={{ verticalAlign: -3, marginRight: 8 }} />Disclosure of Compensation of Attorney</h1>
      <div className="form">Official Form 2030 · signed &amp; filed by the attorney · 11 U.S.C. § 329(a), Rule 2016(b)</div>

      <div className="card">
        <div className="ph">Case type — sets the fee schedule</div>
        <div className="types">
          {Object.entries(PRESETS).map(([k, v]) => (
            <button key={k} className={"type " + (caseType === k ? "on" : "")} onClick={() => pick(k)}>{caseType === k ? <CheckCircle2 size={13} /> : <Circle size={13} />} {v.label}</button>
          ))}
        </div>
        <div className="micro"><Info size={11} style={{ verticalAlign: -1 }} /> {PRESETS[caseType].note}</div>
      </div>

      <div className="card">
        <div className="ph">1 · Compensation</div>
        <div className="feerow"><span>For legal services, I have agreed to accept</span><span className="amt">$<input type="number" value={agreed} onChange={(e) => setAgreed(+e.target.value || 0)} /></span></div>
        <div className="feerow"><span>Prior to filing this statement I have received (paid by client)</span><span className="amt">$<input type="number" value={received} onChange={(e) => setReceived(+e.target.value || 0)} /></span></div>
        <div className="feerow total"><span>Balance Due</span><span className="amt big">{money(balance)}</span></div>
      </div>

      <div className="card">
        <div className="ph">2–3 · Source of compensation</div>
        <div className="yn">{["Debtor", "Other"].map((s) => <button key={s} className={source === s ? "on" : ""} onClick={() => setSource(s)}>{s}</button>)}</div>
        <div className="micro">Source of compensation paid and to be paid: <b>{source}</b>{source === "Other" ? " (specify on the filed form)" : ""}.</div>
      </div>

      <div className="card">
        <div className="ph">4 · Fee sharing</div>
        <button className={"share " + (!shared ? "on" : "")} onClick={() => setShared(false)}>{!shared ? <CheckCircle2 size={12} /> : <Circle size={12} />} Not shared outside my firm</button>
        <button className={"share " + (shared ? "on" : "")} onClick={() => setShared(true)}>{shared ? <CheckCircle2 size={12} /> : <Circle size={12} />} Shared with others (attach agreement + names)</button>
      </div>

      <div className="card">
        <div className="ph">5 · Services included for the fee</div>
        {SERVICES.map((s) => (
          <button key={s.k} className={"svc " + (services[s.k] ? "on" : "")} onClick={() => toggle(s.k)}>{services[s.k] ? <CheckCircle2 size={13} /> : <Circle size={13} />} <span>{s.label}</span></button>
        ))}
      </div>

      <div className="card">
        <div className="ph">6 · Services excluded from the fee</div>
        <textarea value={excluded} onChange={(e) => setExcluded(e.target.value)} />
      </div>

      <div className="summary">
        <div className="sum-h"><FileSignature size={16} /> Certification</div>
        <div className="sum-row"><span className="sum-q">Case type</span><span className="sum-a">{PRESETS[caseType].label}</span></div>
        <div className="sum-row"><span className="sum-q">Agreed fee</span><span className="sum-a">{money(agreed)}</span></div>
        <div className="sum-row"><span className="sum-q">Paid by client (pre-filing)</span><span className="sum-a">{money(received)}</span></div>
        <div className="sum-row"><span className="sum-q">Balance due</span><span className="sum-a yes">{money(balance)}</span></div>
        <div className="sum-row"><span className="sum-q">Source</span><span className="sum-a">{source}</span></div>
        <div className="sign">I certify the foregoing is a complete statement of the agreement for payment to me for representing the debtor(s) in this case. Signed and filed by the attorney; the same fee figures flow to SOFA (payments to anyone consulted about bankruptcy).</div>
        <button className="confirmbtn">Attorney certifies &amp; files Form 2030</button>
      </div>
    </div>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .doc * { box-sizing:border-box; }
    .doc { --oxblood:#6b1f2a; --oxblood-d:#54171f; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --good:#2f6b4f; --good-bg:#e4efe6; --line:#ddd2c2;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:820px; margin:0 auto; }
    .doc h1 { font-family:'Fraunces',serif; font-weight:600; font-size:23px; margin:0; }
    .doc .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .doc .card { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:6px 18px 14px; margin-top:14px; }
    .doc .ph { font-family:'Fraunces',serif; font-size:13px; font-weight:600; color:var(--oxblood); text-transform:uppercase; letter-spacing:.04em; padding:12px 0 10px; border-bottom:1px solid var(--line); margin-bottom:10px; }
    .doc .micro { font-size:12px; color:var(--muted); margin-top:9px; line-height:1.5; }
    .doc .types { display:flex; gap:7px; flex-wrap:wrap; }
    .doc .type { border:1px solid var(--line); background:var(--paper); border-radius:9px; padding:8px 13px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; color:var(--muted); display:inline-flex; gap:6px; align-items:center; }
    .doc .type.on { background:var(--oxblood); color:#fff; border-color:var(--oxblood); }
    .doc .feerow { display:flex; justify-content:space-between; align-items:center; gap:14px; padding:9px 0; border-bottom:1px solid var(--paper-2); font-size:13.5px; }
    .doc .feerow:last-child { border-bottom:none; } .doc .feerow.total { font-weight:700; font-size:15px; padding-top:12px; }
    .doc .amt { font-weight:600; white-space:nowrap; } .doc .amt input { width:120px; border:1px solid var(--line); border-radius:7px; padding:6px 9px; font:inherit; font-size:13.5px; background:var(--paper); text-align:right; margin-left:4px; }
    .doc .amt.big { color:var(--oxblood); font-family:'Fraunces',serif; font-size:20px; }
    .doc .yn { display:inline-flex; gap:6px; } .doc .yn button { border:1px solid var(--line); background:var(--paper); border-radius:8px; padding:7px 16px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; color:var(--muted); } .doc .yn button.on { background:var(--oxblood); color:#fff; border-color:var(--oxblood); }
    .doc .share, .doc .svc { display:flex; gap:8px; align-items:center; width:100%; text-align:left; border:1px solid var(--line); background:var(--paper); border-radius:8px; padding:9px 12px; font:inherit; font-weight:500; font-size:13px; cursor:pointer; color:var(--ink); margin-bottom:7px; }
    .doc .share.on, .doc .svc.on { background:var(--good-bg); border-color:var(--good); color:var(--good); font-weight:600; }
    .doc .svc.on span, .doc .share.on { color:var(--good); }
    .doc textarea { width:100%; min-height:60px; border:1px solid var(--line); border-radius:8px; padding:10px 12px; font:inherit; font-size:13px; background:var(--paper); resize:vertical; }
    .doc .summary { background:#fffdf8; border:2px solid var(--oxblood); border-radius:12px; padding:16px 18px; margin-top:16px; }
    .doc .sum-h { font-family:'Fraunces',serif; font-weight:600; font-size:16px; display:flex; gap:8px; align-items:center; margin-bottom:8px; }
    .doc .sum-row { display:flex; justify-content:space-between; gap:14px; font-size:13.5px; padding:8px 0; border-bottom:1px solid var(--paper-2); } .doc .sum-q { font-weight:600; } .doc .sum-a { font-weight:600; } .doc .sum-a.yes { color:var(--oxblood); }
    .doc .sign { font-size:12.5px; color:var(--ink); background:var(--paper-2); border-radius:8px; padding:11px 13px; margin-top:12px; line-height:1.5; }
    .doc .confirmbtn { margin-top:12px; border:none; border-radius:10px; padding:12px 22px; font:inherit; font-weight:600; font-size:14px; cursor:pointer; background:var(--oxblood); color:#fff; } .doc .confirmbtn:hover { background:var(--oxblood-d); }
  `}</style>;
}
