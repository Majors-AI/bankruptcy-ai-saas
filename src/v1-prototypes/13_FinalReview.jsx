import React, { useState, useMemo } from "react";
import { ClipboardCheck, CheckCircle2, Circle, AlertCircle, Lock, Scale } from "lucide-react";

/* Final Review — full breakdown of EVERY answer across all schedules, for one
   last confirmation before the case advances. Each schedule is confirmed
   individually; submit unlocks only when all are confirmed. Iovin case. */

const money = (n) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---- full answer data ---- */
const PETITION = [
  ["Debtor 1", "(from questionnaire)"], ["SSN — last 4", "••••"],
  ["Residence", "(from questionnaire)"], ["County", "(from questionnaire)"],
  ["District", "(from questionnaire)"], ["Chapter", "Chapter 7"],
  ["Nature of debts", "Consumer"], ["Estimated creditors", "auto from entries"],
  ["Estimated assets", "auto bracket"], ["Estimated liabilities", "auto bracket"],
];
const AB = [
  { part: "1 · Real estate", items: [["Primary residence", 2000000]] },
  { part: "2 · Vehicles", items: [["Vehicle 1", 16000], ["Vehicle 2", 3000]] },
  { part: "4 · Financial assets", items: [["Cash", 200], ["Checking ••0001", 0], ["Checking ••0002", 0], ["Online wallet", 0], ["Retirement — A", 109575.94], ["Retirement — B", 170000], ["Intellectual property", 0], ["Promissory note (private)", 50000]] },
];
const C_ASSETS = [
  ["Primary residence", 2000000, 1936844.75, "Homestead", 0],
  ["Vehicle 1", 16000, 15915.83, "Vehicle exemption", 0],
  ["Vehicle 2", 3000, 0, "Vehicle exemption", 0],
  ["Cash", 200, 0, "Wildcard", 0],
  ["Retirement — A", 109575.94, 0, "Retirement", 0],
  ["Retirement — B", 170000, 0, "Retirement", 0],
  ["Promissory note (private)", 50000, 0, "Wildcard (partial)", 47000],
];
const D = [["1st mortgage", 1408730], ["2nd mortgage", 198114.75], ["Private 3rd mortgage", 330000], ["Auto loan — Vehicle 1", 15915.83]];
const E = [["Internal Revenue Service — income taxes", 2109923.71], ["Domestic support — child support", 0], ["State support agency", 0]];
const F = [["Credit card ••1968", 7499.95], ["Credit card ••6732", 10345.48], ["Credit card ••8951", 6311.26], ["Credit card ••2004", 4366.97], ["Credit card ••3683", 4992.60], ["Online credit ••6763", 3464.41]];
const I = [["Unemployment compensation", 4608], ["All other income lines", 0]];
const J = [["Rent / home ownership", 10634.01], ["Food & housekeeping", 1060.00], ["Transportation", 500.00], ["Other categories", null]];
const MT = { cmi: [["Wages / net business income", "per income summary"], ["Other CMI income", "per income summary"]], nonCmi: [["Social Security / excluded", "if any"]] };
const SOFA = [["Prior residences (3 yrs)", "as disclosed"], ["Income sources (3 yrs)", "as disclosed"], ["Payments & transfers", "as disclosed"], ["Lawsuits & actions (1 yr)", "as disclosed"], ["Business connections (4 yrs)", "as disclosed"]];

const SECTIONS = [
  { id: "101", name: "Voluntary Petition", form: "Form 101" },
  { id: "ab", name: "Schedule A/B — Property", form: "106A/B" },
  { id: "c", name: "Schedule C — Exemptions & liquidation", form: "106C" },
  { id: "d", name: "Schedule D — Secured", form: "106D" },
  { id: "e", name: "Schedule E — Priority", form: "106E/F" },
  { id: "f", name: "Schedule F — Unsecured", form: "106E/F" },
  { id: "g", name: "Schedule G — Contracts & leases", form: "106G" },
  { id: "h", name: "Schedule H — Codebtors", form: "106H" },
  { id: "i", name: "Schedule I — Income", form: "106I" },
  { id: "j", name: "Schedule J — Expenses", form: "106J" },
  { id: "mt", name: "Means Test — Income (CMI)", form: "122A/C" },
  { id: "sofa", name: "Statement of Financial Affairs", form: "Form 107" },
  { id: "soi", name: "Statement of Intention", form: "Form 108" },
  { id: "doc", name: "Disclosure of Compensation", form: "Form 2030" },
  { id: "matrix", name: "Verified Creditor Matrix", form: "Creditor list + parties" },
];

export default function FinalReview() {
  const [confirmed, setConfirmed] = useState({});
  const toggle = (id) => setConfirmed((p) => ({ ...p, [id]: !p[id] }));
  const allConfirmed = SECTIONS.every((s) => confirmed[s.id]);
  const count = SECTIONS.filter((s) => confirmed[s.id]).length;

  const t = useMemo(() => {
    const ab = AB.flatMap((p) => p.items).reduce((a, [, v]) => a + v, 0);
    const d = D.reduce((a, [, v]) => a + v, 0), e = E.reduce((a, [, v]) => a + v, 0), f = F.reduce((a, [, v]) => a + v, 0);
    const liq = C_ASSETS.reduce((a, r) => a + r[4], 0);
    const inc = I.reduce((a, [, v]) => a + v, 0);
    const exp = J.reduce((a, [, v]) => a + (v || 0), 0);
    return { ab, d, e, f, liq, inc, exp, liab: d + e + f, net: inc - exp };
  }, []);

  const Hd = ({ s }) => (
    <div className="shd" onClick={() => toggle(s.id)}>
      <span className="chk">{confirmed[s.id] ? <CheckCircle2 size={19} color="var(--oxblood)" /> : <Circle size={19} color="var(--line)" />}</span>
      <span className="snm">{s.name}</span><span className="sform">{s.form}</span>
    </div>
  );
  const Line = ([k, v]) => (
    <div className="ln" key={k}><span>{k}</span><span className="amt">{v === null ? <em>not entered</em> : typeof v === "number" ? money(v) : v}</span></div>
  );

  return (
    <div className="fr">
      <Style />
      <h1><ClipboardCheck size={21} style={{ verticalAlign: -3, marginRight: 8 }} />Final Review — every answer</h1>
      <div className="form">Confirm all answers one last time before Signing Review · sample preview, data bound from the questionnaire</div>

      {/* Petition */}
      <div className="card"><Hd s={SECTIONS[0]} /><div className="bd">{PETITION.map(Line)}</div></div>

      {/* A/B */}
      <div className="card"><Hd s={SECTIONS[1]} /><div className="bd">
        {AB.map((p) => <div key={p.part}><div className="ph">Part {p.part}</div>{p.items.map(Line)}</div>)}
        <div className="sub"><span>Total property</span><span>{money(t.ab)}</span></div>
      </div></div>

      {/* C — liquidation */}
      <div className="card"><Hd s={SECTIONS[2]} /><div className="bd">
        <div className="grid head"><span>Asset</span><span>Value</span><span>Liens</span><span>Net</span><span>Exemption</span><span>Non-exempt</span></div>
        {C_ASSETS.map((r, i) => (
          <div className="grid" key={i}>
            <span className="nm">{r[0]}</span><span className="num">{money(r[1])}</span>
            <span className="num muted">{r[2] ? money(r[2]) : "—"}</span><span className="num">{money(r[1] - r[2])}</span>
            <span className="ex">{r[3]}</span><span className={"num " + (r[4] > 0 ? "ne" : "muted")}>{money(r[4])}</span>
          </div>
        ))}
        <div className="sub"><span>Liquidation analysis — non-exempt equity</span><span>{money(t.liq)}</span></div>
      </div></div>

      {/* D */}
      <div className="card"><Hd s={SECTIONS[3]} /><div className="bd">{D.map(Line)}<div className="sub"><span>Total secured</span><span>{money(t.d)}</span></div></div></div>
      {/* E */}
      <div className="card"><Hd s={SECTIONS[4]} /><div className="bd">{E.map(Line)}<div className="sub"><span>Total priority</span><span>{money(t.e)}</span></div></div></div>
      {/* F */}
      <div className="card"><Hd s={SECTIONS[5]} /><div className="bd">{F.map(Line)}<div className="sub"><span>Total unsecured</span><span>{money(t.f)}</span></div></div></div>
      {/* G */}
      <div className="card"><Hd s={SECTIONS[6]} /><div className="bd"><div className="empty">None reported</div></div></div>
      {/* H */}
      <div className="card"><Hd s={SECTIONS[7]} /><div className="bd"><div className="empty">None reported</div></div></div>
      {/* I */}
      <div className="card"><Hd s={SECTIONS[8]} /><div className="bd">{I.map(Line)}<div className="sub"><span>Combined monthly income</span><span>{money(t.inc)}</span></div></div></div>
      {/* J */}
      <div className="card"><Hd s={SECTIONS[9]} /><div className="bd">{J.map(Line)}
        <div className="sub"><span>Total monthly expenses</span><span>{money(t.exp)}</span></div>
        <div className="sub"><span>Monthly net (I − J)</span><span className={t.net < 0 ? "neg" : ""}>{money(t.net)}</span></div>
      </div></div>

      {/* Means Test */}
      <div className="card"><Hd s={SECTIONS[10]} /><div className="bd">
        <div className="ph">Counts toward CMI</div>{MT.cmi.map(Line)}
        <div className="ph">Excluded (non-CMI)</div>{MT.nonCmi.map(Line)}
      </div></div>
      {/* SOFA */}
      <div className="card"><Hd s={SECTIONS[11]} /><div className="bd">{SOFA.map(Line)}</div></div>
      {/* Statement of Intention */}
      <div className="card"><Hd s={SECTIONS[12]} /><div className="bd">
        {[["Secured property (Schedule D)", "surrender / redeem / reaffirm / retain"], ["Personal-property leases (Schedule G)", "assume / do-not-assume"]].map(Line)}
      </div></div>
      {/* Disclosure of Compensation */}
      <div className="card"><Hd s={SECTIONS[13]} /><div className="bd">
        {[["Attorney fee (case-type schedule)", "agreed / paid / balance"], ["Source & sharing", "as disclosed"]].map(Line)}
      </div></div>
      {/* Verified Creditor Matrix — final verification step */}
      <div className="card"><Hd s={SECTIONS[14]} /><div className="bd">
        {[["All creditors (D/E/F) + co-debtors (H)", "verified"], ["Schedule G parties, interested parties, former spouse", "verified"], ["Alternate / different addresses", "each on its own line"], ["Any creditors left off", "flagged for attorney review"]].map(Line)}
        <div style={{ fontSize: "12.5px", marginTop: "10px", color: "#6b1f2a", fontWeight: 600, lineHeight: 1.5 }}>Debtor(s) verify the creditor matrix is true and correct. This verification is the FINAL step — performed here at the full final review, only after every document above is complete.</div>
      </div></div>

      {/* Roll-up */}
      <div className="rollup">
        <Stat l="Total property" v={money(t.ab)} />
        <Stat l="Total liabilities" v={money(t.liab)} />
        <Stat l="Liquidation value" v={money(t.liq)} accent />
        <Stat l="Monthly net" v={money(t.net)} />
      </div>

      <div className="confirm"><AlertCircle size={15} /> Attorney confirms exemptions, the liquidation analysis, the funds-available determination, and the asset/liability brackets at Signing Review (step 7.5).</div>

      <div className="footer">
        <div className="prog">{count} of {SECTIONS.length} schedules confirmed</div>
        <button className="submit" disabled={!allConfirmed}><Lock size={15} /> {allConfirmed ? "Confirm all & submit for signing review" : "Confirm every schedule to continue"}</button>
      </div>
    </div>
  );
}

function Stat({ l, v, accent }) {
  return <div className={"stat" + (accent ? " accent" : "")}><div className="sl">{l}</div><div className="sv">{v}</div></div>;
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .fr * { box-sizing:border-box; }
    .fr { --oxblood:#6b1f2a; --oxblood-d:#54171f; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --good:#2f6b4f; --warn:#9a5b16; --warn-bg:#f6ead7; --line:#ddd2c2; --ne:#a23030; --neg:#a23030;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:880px; margin:0 auto; }
    .fr h1 { font-family:'Fraunces',serif; font-weight:600; font-size:25px; margin:0; }
    .fr .form { color:var(--muted); font-size:13px; margin-top:3px; }
    .fr .card { background:#fffdf8; border:1px solid var(--line); border-radius:13px; overflow:hidden; margin-top:14px; }
    .fr .shd { display:flex; align-items:center; gap:10px; padding:13px 18px; background:var(--paper-2); cursor:pointer; }
    .fr .shd .snm { font-family:'Fraunces',serif; font-weight:600; font-size:15.5px; }
    .fr .shd .sform { margin-left:auto; font-size:11.5px; color:var(--muted); font-weight:600; }
    .fr .bd { padding:8px 18px 14px; }
    .fr .ph { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--oxblood); margin:10px 0 4px; }
    .fr .ln { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:13.5px; padding:6px 0; border-bottom:1px solid var(--paper-2); }
    .fr .ln .amt { font-weight:600; text-align:right; } .fr .ln em { color:var(--warn); font-style:normal; font-weight:600; font-size:12px; }
    .fr .sub { display:flex; justify-content:space-between; font-weight:600; font-size:13.5px; padding:9px 0 2px; border-top:1px solid var(--line); margin-top:4px; }
    .fr .sub .neg { color:var(--neg); }
    .fr .empty { color:var(--muted); font-style:italic; font-size:13px; padding:4px 0; }
    .fr .grid { display:grid; grid-template-columns:1.8fr 1fr 1fr 1fr 1.2fr 1fr; gap:5px 10px; align-items:center; font-size:12px; padding:6px 0; border-bottom:1px solid var(--paper-2); }
    .fr .grid.head { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); }
    .fr .grid .nm { font-weight:600; } .fr .grid .num { text-align:right; font-variant-numeric:tabular-nums; } .fr .grid .muted { color:var(--muted); } .fr .grid .ne { color:var(--ne); font-weight:700; } .fr .grid .ex { color:var(--muted); font-size:11px; }
    .fr .rollup { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:16px; }
    .fr .stat { background:#fffdf8; border:1px solid var(--line); border-radius:11px; padding:13px 15px; }
    .fr .stat.accent { background:var(--oxblood); border-color:var(--oxblood); color:#fff; }
    .fr .stat .sl { font-size:11px; text-transform:uppercase; letter-spacing:.05em; opacity:.8; }
    .fr .stat .sv { font-family:'Fraunces',serif; font-weight:600; font-size:18px; margin-top:3px; }
    .fr .confirm { display:flex; gap:8px; align-items:center; font-size:13px; font-weight:600; color:var(--warn); background:var(--warn-bg); border-radius:8px; padding:11px 13px; margin-top:16px; }
    .fr .footer { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-top:18px; flex-wrap:wrap; }
    .fr .prog { color:var(--muted); font-size:13.5px; font-weight:600; }
    .fr .submit { border:none; border-radius:10px; padding:13px 22px; font:inherit; font-weight:600; font-size:14px; cursor:pointer; background:var(--oxblood); color:#fff; display:inline-flex; gap:8px; align-items:center; }
    .fr .submit:hover { background:var(--oxblood-d); } .fr .submit:disabled { background:var(--line); cursor:not-allowed; }
    @media(max-width:640px){ .fr .rollup{grid-template-columns:1fr 1fr;} }
  `}</style>;
}
