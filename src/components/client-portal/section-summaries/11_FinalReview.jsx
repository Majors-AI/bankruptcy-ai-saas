import React, { useState, useMemo } from "react";
import { ClipboardCheck, CheckCircle2, Circle, AlertCircle, Lock } from "lucide-react";

/* Final Review — full breakdown of EVERY answer across all schedules, for one
   last confirmation before the case advances. Each schedule is confirmed
   individually; submit unlocks only when all are confirmed.
   Restyled to the bankruptcy.ai dark theme.

   ── INTEGRATION CONTRACT ──────────────────────────────────────────────
   PROP-DRIVEN. Pass `data` with every section's answers. EXAMPLE_DATA is
   SAMPLE ONLY and MUST NOT ship. Wire from the questionnaire/Supabase.

   data: {
     petition: [label, value][],
     ab: { part:string, items:[label, number][] }[],
     cAssets: [name, value, liens, exemptionLabel, nonExempt][],
     d: [label, number][], e: [...], f: [...], i: [...],
     j: [label, number|null][],
   }
   onSubmit?: () => void  // called when all schedules confirmed + submit clicked
   <FinalReview data={allAnswers} debtor="Jane Sample" onSubmit={advance} />
   ─────────────────────────────────────────────────────────────────────── */

const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* EXAMPLE ONLY — do not ship. */
const EXAMPLE_DATA = {
  petition: [["Debtor 1", "Example Debtor"], ["Chapter", "Chapter 7"]],
  ab: [{ part: "1 · Real estate", items: [["Example residence", 0]] }],
  cAssets: [["Example residence", 0, 0, "Homestead", 0]],
  d: [["Example secured", 0]],
  e: [["Example priority", 0]],
  f: [["Example unsecured", 0]],
  i: [["All income lines", 0]],
  j: [["Example expense", null]],
};

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
];

export default function FinalReview({ data = EXAMPLE_DATA, debtor = "Example Debtor", onSubmit }) {
  const { petition, ab, cAssets, d, e, f, i, j } = data;
  const [confirmed, setConfirmed] = useState({});
  const toggle = (id) => setConfirmed((p) => ({ ...p, [id]: !p[id] }));
  const allConfirmed = SECTIONS.every((s) => confirmed[s.id]);
  const count = SECTIONS.filter((s) => confirmed[s.id]).length;

  const t = useMemo(() => {
    const abTot = ab.flatMap((p) => p.items).reduce((a, [, v]) => a + (v || 0), 0);
    const dTot = d.reduce((a, [, v]) => a + (v || 0), 0);
    const eTot = e.reduce((a, [, v]) => a + (v || 0), 0);
    const fTot = f.reduce((a, [, v]) => a + (v || 0), 0);
    const liq = cAssets.reduce((a, r) => a + (r[4] || 0), 0);
    const inc = i.reduce((a, [, v]) => a + (v || 0), 0);
    const exp = j.reduce((a, [, v]) => a + (v || 0), 0);
    return { abTot, dTot, eTot, fTot, liq, inc, exp, liab: dTot + eTot + fTot, net: inc - exp };
  }, [ab, cAssets, d, e, f, i, j]);

  const Hd = ({ s }) => (
    <div className="shd" onClick={() => toggle(s.id)}>
      <span className="chk">{confirmed[s.id] ? <CheckCircle2 size={19} color="var(--accent)" /> : <Circle size={19} color="var(--line)" />}</span>
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
      <div className="form">{debtor} · confirm all answers one last time before Signing Review</div>

      <div className="card"><Hd s={SECTIONS[0]} /><div className="bd">{petition.map(Line)}</div></div>

      <div className="card"><Hd s={SECTIONS[1]} /><div className="bd">
        {ab.map((p) => <div key={p.part}><div className="ph">Part {p.part}</div>{p.items.map(Line)}</div>)}
        <div className="sub"><span>Total property</span><span>{money(t.abTot)}</span></div>
      </div></div>

      <div className="card"><Hd s={SECTIONS[2]} /><div className="bd">
        <div className="grid head"><span>Asset</span><span>Value</span><span>Liens</span><span>Net</span><span>Exemption</span><span>Non-exempt</span></div>
        {cAssets.map((r, idx) => (
          <div className="grid" key={idx}>
            <span className="nm">{r[0]}</span><span className="num">{money(r[1])}</span>
            <span className="num muted">{r[2] ? money(r[2]) : "—"}</span><span className="num">{money((r[1] || 0) - (r[2] || 0))}</span>
            <span className="ex">{r[3]}</span><span className={"num " + (r[4] > 0 ? "ne" : "muted")}>{money(r[4])}</span>
          </div>
        ))}
        <div className="sub"><span>Liquidation analysis — non-exempt equity</span><span>{money(t.liq)}</span></div>
      </div></div>

      <div className="card"><Hd s={SECTIONS[3]} /><div className="bd">{d.map(Line)}<div className="sub"><span>Total secured</span><span>{money(t.dTot)}</span></div></div></div>
      <div className="card"><Hd s={SECTIONS[4]} /><div className="bd">{e.map(Line)}<div className="sub"><span>Total priority</span><span>{money(t.eTot)}</span></div></div></div>
      <div className="card"><Hd s={SECTIONS[5]} /><div className="bd">{f.map(Line)}<div className="sub"><span>Total unsecured</span><span>{money(t.fTot)}</span></div></div></div>
      <div className="card"><Hd s={SECTIONS[6]} /><div className="bd"><div className="empty">None reported</div></div></div>
      <div className="card"><Hd s={SECTIONS[7]} /><div className="bd"><div className="empty">None reported</div></div></div>
      <div className="card"><Hd s={SECTIONS[8]} /><div className="bd">{i.map(Line)}<div className="sub"><span>Combined monthly income</span><span>{money(t.inc)}</span></div></div></div>
      <div className="card"><Hd s={SECTIONS[9]} /><div className="bd">{j.map(Line)}
        <div className="sub"><span>Total monthly expenses</span><span>{money(t.exp)}</span></div>
        <div className="sub"><span>Monthly net (I − J)</span><span className={t.net < 0 ? "neg" : ""}>{money(t.net)}</span></div>
      </div></div>

      <div className="rollup">
        <Stat l="Total property" v={money(t.abTot)} />
        <Stat l="Total liabilities" v={money(t.liab)} />
        <Stat l="Liquidation value" v={money(t.liq)} accent />
        <Stat l="Monthly net" v={money(t.net)} />
      </div>

      <div className="confirm"><AlertCircle size={15} /> Attorney confirms exemptions, the liquidation analysis, the funds-available determination, and the asset/liability brackets at Signing Review (step 7.5).</div>

      <div className="footer">
        <div className="prog">{count} of {SECTIONS.length} schedules confirmed</div>
        <button className="submit" disabled={!allConfirmed} onClick={() => allConfirmed && onSubmit?.()}>
          <Lock size={15} /> {allConfirmed ? "Confirm all & submit for signing review" : "Confirm every schedule to continue"}
        </button>
      </div>
    </div>
  );
}

function Stat({ l, v, accent }) {
  return <div className={"stat" + (accent ? " accent" : "")}><div className="sl">{l}</div><div className="sv">{v}</div></div>;
}

function Style() {
  return <style>{`
    .fr * { box-sizing:border-box; }
    .fr {
      --accent:#fbbf24; --accent-d:#f59e0b; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8; --warn:#fcd34d; --warn-bg:rgba(251,191,36,.10); --ne:#fb7185; --neg:#fb7185;
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:880px; margin:0 auto; }
    .fr h1 { font-family:var(--serif); font-weight:600; font-size:25px; margin:0; color:#fff; }
    .fr .form { color:var(--muted); font-size:13px; margin-top:3px; }
    .fr .card { background:var(--bg); border:1px solid var(--line); border-radius:16px; overflow:hidden; margin-top:14px; }
    .fr .shd { display:flex; align-items:center; gap:10px; padding:13px 18px; background:var(--bg-2); cursor:pointer; }
    .fr .shd .snm { font-family:var(--serif); font-weight:600; font-size:15.5px; color:#fff; }
    .fr .shd .sform { margin-left:auto; font-size:11.5px; color:var(--muted); font-weight:600; }
    .fr .bd { padding:8px 18px 14px; }
    .fr .ph { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--accent); margin:10px 0 4px; }
    .fr .ln { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:13.5px; padding:6px 0; border-bottom:1px solid var(--line-soft); }
    .fr .ln .amt { font-weight:600; text-align:right; } .fr .ln em { color:var(--warn); font-style:normal; font-weight:600; font-size:12px; }
    .fr .sub { display:flex; justify-content:space-between; font-weight:600; font-size:13.5px; padding:9px 0 2px; border-top:1px solid var(--line); margin-top:4px; }
    .fr .sub .neg { color:var(--neg); }
    .fr .empty { color:var(--muted); font-style:italic; font-size:13px; padding:4px 0; }
    .fr .grid { display:grid; grid-template-columns:1.8fr 1fr 1fr 1fr 1.2fr 1fr; gap:5px 10px; align-items:center; font-size:12px; padding:6px 0; border-bottom:1px solid var(--line-soft); }
    .fr .grid.head { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); }
    .fr .grid .nm { font-weight:600; } .fr .grid .num { text-align:right; font-variant-numeric:tabular-nums; } .fr .grid .muted { color:var(--muted); } .fr .grid .ne { color:var(--ne); font-weight:700; } .fr .grid .ex { color:var(--muted); font-size:11px; }
    .fr .rollup { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:16px; }
    .fr .stat { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:13px 15px; }
    .fr .stat.accent { background:var(--accent); border-color:var(--accent); color:#1c1407; }
    .fr .stat .sl { font-size:11px; text-transform:uppercase; letter-spacing:.05em; opacity:.75; }
    .fr .stat .sv { font-family:var(--serif); font-weight:600; font-size:18px; margin-top:3px; }
    .fr .confirm { display:flex; gap:8px; align-items:center; font-size:13px; font-weight:600; color:var(--warn); background:var(--warn-bg); border:1px solid rgba(251,191,36,.25); border-radius:8px; padding:11px 13px; margin-top:16px; }
    .fr .footer { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-top:18px; flex-wrap:wrap; }
    .fr .prog { color:var(--muted); font-size:13.5px; font-weight:600; }
    .fr .submit { border:none; border-radius:10px; padding:13px 22px; font:inherit; font-weight:600; font-size:14px; cursor:pointer; background:var(--accent); color:#1c1407; display:inline-flex; gap:8px; align-items:center; }
    .fr .submit:hover:not(:disabled) { background:var(--accent-d); } .fr .submit:disabled { background:var(--line); color:var(--muted); cursor:not-allowed; }
    @media(max-width:640px){ .fr .rollup{grid-template-columns:1fr 1fr;} }
  `}</style>;
}
