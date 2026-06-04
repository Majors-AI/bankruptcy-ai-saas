import React from "react";
import { ShieldCheck, Lock, Info } from "lucide-react";

/* Your Statement About Your Social Security Numbers — Official Form 121.
   Filed WITH the petition but kept OUT of the public record; the full number is
   used by the court/trustee and verified against photo ID at the 341 meeting.
   For each debtor, one of: full SSN, ITIN, or neither. This review shows the
   masked number (last 4) — the full number stays in the protected file.
   Preview sample — bind to live client data at runtime. */

const SAMPLE = {
  debtor1: { name: "Debtor 1 (preview)", type: "ssn", last4: "6789" },
  debtor2: null,   // set for a joint case
};

const Block = ({ d, label }) => {
  if (!d) return null;
  return (
    <div className="ssn-block">
      <div className="who">{label} — {d.name}</div>
      {d.type === "ssn" && <div className="line"><span className="chk on" /> I have a Social Security number and it is <b className="num">•••-••-{d.last4}</b></div>}
      {d.type === "itin" && <div className="line"><span className="chk on" /> I have an Individual Taxpayer Identification Number (ITIN) and it is <b className="num">•••-••-{d.last4}</b></div>}
      {d.type === "none" && <div className="line"><span className="chk on" /> I do not have a Social Security number or an ITIN.</div>}
    </div>
  );
};

export default function StatementSSN({ data = SAMPLE }) {
  return (
    <div className="ssn">
      <Style />
      <h1><ShieldCheck size={21} style={{ verticalAlign: -3, marginRight: 8 }} />Statement About Your Social Security Numbers</h1>
      <div className="form">Official Form 121 · filed with the petition</div>

      <div className="rule"><Lock size={12} style={{ verticalAlign: -1 }} /> This statement is filed with the court but is <b>not part of the public record</b>. The full number is used by the court and trustee and is verified against your photo ID at the meeting of creditors (341).</div>

      <div className="card">
        <Block d={data.debtor1} label="Debtor 1" />
        {data.debtor2 && <Block d={data.debtor2} label="Debtor 2" />}
        {!data.debtor2 && <div className="micro"><Info size={11} style={{ verticalAlign: -1 }} /> Single filer — Debtor 2 not applicable. In a joint case, both debtors complete and sign.</div>}
      </div>

      <div className="summary">
        <div className="sum-h"><ShieldCheck size={16} /> Verification</div>
        <div className="sign">Under penalty of perjury, the debtor(s) declare the information above is true and correct. The full number is held in the protected case file and confirmed at the 341 meeting. Both debtors sign in a joint case.</div>
        <button className="confirmbtn">Confirm Statement About Social Security Numbers</button>
      </div>
    </div>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .ssn * { box-sizing:border-box; }
    .ssn { --oxblood:#6b1f2a; --oxblood-d:#54171f; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --good:#2f6b4f; --line:#ddd2c2;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:760px; margin:0 auto; }
    .ssn h1 { font-family:'Fraunces',serif; font-weight:600; font-size:23px; margin:0; }
    .ssn .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .ssn .rule { font-size:12.5px; color:var(--muted); background:var(--paper-2); border-radius:9px; padding:10px 13px; margin-top:12px; line-height:1.5; }
    .ssn .card { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:16px 18px; margin-top:14px; }
    .ssn .ssn-block { padding:10px 0; border-bottom:1px solid var(--paper-2); } .ssn .ssn-block:last-child { border-bottom:none; }
    .ssn .who { font-family:'Fraunces',serif; font-size:13px; font-weight:600; color:var(--oxblood); text-transform:uppercase; letter-spacing:.04em; margin-bottom:8px; }
    .ssn .line { display:flex; gap:9px; align-items:center; font-size:14px; }
    .ssn .chk { flex:none; width:16px; height:16px; border-radius:4px; border:1.5px solid var(--oxblood); position:relative; } .ssn .chk.on { background:var(--oxblood); } .ssn .chk.on::after { content:""; position:absolute; left:4.5px; top:1px; width:4px; height:8px; border:solid #fff; border-width:0 2px 2px 0; transform:rotate(45deg); }
    .ssn .num { font-family:'JetBrains Mono', monospace; letter-spacing:.06em; }
    .ssn .micro { font-size:12px; color:var(--muted); margin-top:6px; }
    .ssn .summary { background:#fffdf8; border:2px solid var(--oxblood); border-radius:12px; padding:16px 18px; margin-top:16px; }
    .ssn .sum-h { font-family:'Fraunces',serif; font-weight:600; font-size:16px; display:flex; gap:8px; align-items:center; margin-bottom:8px; }
    .ssn .sign { font-size:12.5px; color:var(--ink); background:var(--paper-2); border-radius:8px; padding:11px 13px; line-height:1.5; }
    .ssn .confirmbtn { margin-top:12px; border:none; border-radius:10px; padding:12px 22px; font:inherit; font-weight:600; font-size:14px; cursor:pointer; background:var(--oxblood); color:#fff; } .ssn .confirmbtn:hover { background:var(--oxblood-d); }
  `}</style>;
}
