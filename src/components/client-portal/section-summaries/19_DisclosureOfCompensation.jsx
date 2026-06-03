import React, { useState } from "react";
import { FileSignature, Info, Circle, CheckCircle2 } from "lucide-react";
import ConfirmFooter from "./ConfirmFooter";

/* Disclosure of Compensation of Attorney for Debtor — Official Form 2030.
   Signed/filed by the ATTORNEY (11 U.S.C. § 329(a), Fed. R. Bankr. P. 2016(b)).

   NOTE (for placement): this is an attorney-completed form, not client intake.
   If it sits in the client flow it should be framed as an attorney step.

   NOTE (data source): the real fee/case-type lives in the fee record
   (AccountingPortal), not in questionnaire data. As wired this captures the
   disclosure fresh and persists to data.disclosureOfCompensation. The PRESET
   amounts are sample figures — replace with the firm's actual fee schedule, or
   bind to the fee record, when that wiring exists.

   <DisclosureOfCompensation
     data={questionnaireData}
     onChange={(doc) => updateSection("disclosureOfCompensation", doc)}
     confirmed={summaryConfirmed}
     onConfirm={onSummaryConfirm}
   /> */

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

export default function DisclosureOfCompensation({ data = {}, onChange, confirmed, onConfirm }) {
  const saved = data.disclosureOfCompensation || {};
  const defaultCaseType = saved.caseType || (String(data.petition?.chapter) === "13" ? "ch13" : "ch7");

  const [doc, setDoc] = useState(() => ({
    caseType: defaultCaseType,
    agreed: saved.agreed ?? PRESETS[defaultCaseType].agreed,
    received: saved.received ?? PRESETS[defaultCaseType].received,
    source: saved.source || "Debtor",
    shared: saved.shared || false,
    services: saved.services || { a: true, b: true, c: true, d: false },
    excluded: saved.excluded ?? "Adversary proceedings; non-dischargeability or relief-from-stay litigation (billed separately).",
  }));

  const patch = (p) => { const next = { ...doc, ...p }; setDoc(next); onChange && onChange({ ...saved, ...next }); };
  const pick = (k) => patch({ caseType: k, agreed: PRESETS[k].agreed, received: PRESETS[k].received });
  const toggleSvc = (k) => patch({ services: { ...doc.services, [k]: !doc.services[k] } });
  const balance = Math.max(0, (Number(doc.agreed) || 0) - (Number(doc.received) || 0));

  return (
    <div className="docp">
      <Style />
      <h1><FileSignature size={21} style={{ verticalAlign: -3, marginRight: 8 }} />Disclosure of Compensation of Attorney</h1>
      <div className="form">Official Form 2030 · signed &amp; filed by the attorney · 11 U.S.C. § 329(a), Rule 2016(b)</div>
      <div className="rule"><Info size={12} style={{ verticalAlign: -1 }} /> Completed by the attorney. The same fee figures flow to SOFA (payments to anyone consulted about bankruptcy).</div>

      <div className="card">
        <div className="ph">Case type — sets the fee schedule</div>
        <div className="types">
          {Object.entries(PRESETS).map(([k, v]) => (
            <button type="button" key={k} className={"type " + (doc.caseType === k ? "on" : "")} onClick={() => pick(k)}>{doc.caseType === k ? <CheckCircle2 size={13} /> : <Circle size={13} />} {v.label}</button>
          ))}
        </div>
        <div className="micro"><Info size={11} style={{ verticalAlign: -1 }} /> {PRESETS[doc.caseType].note}</div>
      </div>

      <div className="card">
        <div className="ph">1 · Compensation</div>
        <div className="feerow"><span>For legal services, I have agreed to accept</span><span className="amt">$<input type="number" value={doc.agreed} onChange={(e) => patch({ agreed: +e.target.value || 0 })} /></span></div>
        <div className="feerow"><span>Prior to filing this statement I have received (paid by client)</span><span className="amt">$<input type="number" value={doc.received} onChange={(e) => patch({ received: +e.target.value || 0 })} /></span></div>
        <div className="feerow total"><span>Balance Due</span><span className="amt big">{money(balance)}</span></div>
      </div>

      <div className="card">
        <div className="ph">2–3 · Source of compensation</div>
        <div className="yn">{["Debtor", "Other"].map((s) => <button type="button" key={s} className={doc.source === s ? "on" : ""} onClick={() => patch({ source: s })}>{s}</button>)}</div>
        <div className="micro">Source of compensation paid and to be paid: <b>{doc.source}</b>{doc.source === "Other" ? " (specify on the filed form)" : ""}.</div>
      </div>

      <div className="card">
        <div className="ph">4 · Fee sharing</div>
        <button type="button" className={"share " + (!doc.shared ? "on" : "")} onClick={() => patch({ shared: false })}>{!doc.shared ? <CheckCircle2 size={12} /> : <Circle size={12} />} Not shared outside my firm</button>
        <button type="button" className={"share " + (doc.shared ? "on" : "")} onClick={() => patch({ shared: true })}>{doc.shared ? <CheckCircle2 size={12} /> : <Circle size={12} />} Shared with others (attach agreement + names)</button>
      </div>

      <div className="card">
        <div className="ph">5 · Services included for the fee</div>
        {SERVICES.map((s) => (
          <button type="button" key={s.k} className={"svc " + (doc.services[s.k] ? "on" : "")} onClick={() => toggleSvc(s.k)}>{doc.services[s.k] ? <CheckCircle2 size={13} /> : <Circle size={13} />} <span>{s.label}</span></button>
        ))}
      </div>

      <div className="card">
        <div className="ph">6 · Services excluded from the fee</div>
        <textarea value={doc.excluded} onChange={(e) => patch({ excluded: e.target.value })} />
      </div>

      <div className="summary">
        <div className="sum-h"><FileSignature size={16} /> Certification</div>
        <div className="sum-row"><span className="sum-q">Case type</span><span className="sum-a">{PRESETS[doc.caseType].label}</span></div>
        <div className="sum-row"><span className="sum-q">Agreed fee</span><span className="sum-a">{money(doc.agreed)}</span></div>
        <div className="sum-row"><span className="sum-q">Paid by client (pre-filing)</span><span className="sum-a">{money(doc.received)}</span></div>
        <div className="sum-row"><span className="sum-q">Balance due</span><span className="sum-a yes">{money(balance)}</span></div>
        <div className="sum-row"><span className="sum-q">Source</span><span className="sum-a">{doc.source}</span></div>
        <div className="sign">I certify the foregoing is a complete statement of the agreement for payment to me for representing the debtor(s) in this case. Signed and filed by the attorney; the same fee figures flow to SOFA (payments to anyone consulted about bankruptcy).</div>
      </div>

      <ConfirmFooter
        confirmed={confirmed}
        onConfirm={onConfirm}
        sectionLabel="fee disclosure"
      />
    </div>
  );
}

function Style() {
  return <style>{`
    .docp * { box-sizing:border-box; }
    .docp {
      --accent:#fbbf24; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8; --good:#4ade80; --good-bg:rgba(74,222,128,.12);
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:820px; margin:16px auto 0; }
    .docp h1 { font-family:var(--serif); font-weight:600; font-size:23px; margin:0; color:#fff; }
    .docp .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .docp .rule { font-size:12.5px; color:var(--muted); background:var(--bg-2); border:1px solid var(--line); border-radius:9px; padding:10px 13px; margin-top:12px; line-height:1.5; }
    .docp .card { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:6px 18px 14px; margin-top:14px; }
    .docp .ph { font-family:var(--serif); font-size:13px; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:.04em; padding:12px 0 10px; border-bottom:1px solid var(--line); margin-bottom:10px; }
    .docp .micro { font-size:12px; color:var(--muted); margin-top:9px; line-height:1.5; } .docp .micro b { color:var(--ink); }
    .docp .types { display:flex; gap:7px; flex-wrap:wrap; }
    .docp .type { border:1px solid var(--line); background:var(--bg-2); border-radius:9px; padding:8px 13px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; color:var(--muted); display:inline-flex; gap:6px; align-items:center; }
    .docp .type.on { background:var(--accent); color:#1c1407; border-color:var(--accent); }
    .docp .feerow { display:flex; justify-content:space-between; align-items:center; gap:14px; padding:9px 0; border-bottom:1px solid var(--line-soft); font-size:13.5px; }
    .docp .feerow:last-child { border-bottom:none; } .docp .feerow.total { font-weight:700; font-size:15px; padding-top:12px; }
    .docp .amt { font-weight:600; white-space:nowrap; color:var(--ink); } .docp .amt input { width:120px; border:1px solid var(--line); border-radius:7px; padding:6px 9px; font:inherit; font-size:13.5px; background:var(--bg-2); color:var(--ink); text-align:right; margin-left:4px; }
    .docp .amt.big { color:var(--accent); font-family:var(--serif); font-size:20px; }
    .docp .yn { display:inline-flex; gap:6px; } .docp .yn button { border:1px solid var(--line); background:var(--bg-2); border-radius:8px; padding:7px 16px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; color:var(--muted); } .docp .yn button.on { background:var(--accent); color:#1c1407; border-color:var(--accent); }
    .docp .share, .docp .svc { display:flex; gap:8px; align-items:center; width:100%; text-align:left; border:1px solid var(--line); background:var(--bg-2); border-radius:8px; padding:9px 12px; font:inherit; font-weight:500; font-size:13px; cursor:pointer; color:var(--ink); margin-bottom:7px; }
    .docp .share.on, .docp .svc.on { background:var(--good-bg); border-color:var(--good); color:var(--good); font-weight:600; }
    .docp .svc.on span { color:var(--good); }
    .docp textarea { width:100%; min-height:60px; border:1px solid var(--line); border-radius:8px; padding:10px 12px; font:inherit; font-size:13px; background:var(--bg-2); color:var(--ink); resize:vertical; }
    .docp .summary { background:var(--bg); border:1px solid var(--accent); border-radius:12px; padding:16px 18px; margin-top:16px; }
    .docp .sum-h { font-family:var(--serif); font-weight:600; font-size:16px; display:flex; gap:8px; align-items:center; margin-bottom:8px; color:#fff; }
    .docp .sum-row { display:flex; justify-content:space-between; gap:14px; font-size:13.5px; padding:8px 0; border-bottom:1px solid var(--line-soft); } .docp .sum-q { font-weight:600; color:var(--ink); } .docp .sum-a { font-weight:600; color:var(--muted); } .docp .sum-a.yes { color:var(--accent); }
    .docp .sign { font-size:12.5px; color:var(--ink); background:var(--bg-2); border:1px solid var(--line); border-radius:8px; padding:11px 13px; margin-top:12px; line-height:1.5; }
  `}</style>;
}
