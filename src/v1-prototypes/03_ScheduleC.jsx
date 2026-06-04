import React, { useState, useMemo } from "react";
import { ShieldCheck, AlertCircle, CheckCircle2, Circle, Scale } from "lucide-react";

/* Schedule C — Official Form 106C — exemptions + liquidation worksheet.
   Lists every asset, its liens and net equity, the exemption applied, and the
   resulting non-exempt equity. Total non-exempt equity = the liquidation
   analysis (value available to unsecured creditors in a Ch.7 liquidation).
   Iovin (WA) case. Self-contained. */

const money = (n) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DOMICILE = {
  currentState: "Washington",
  timeInState: "730+ days (≥ 2 years)",
  determination: "WA exemption set applies",
  federalElection: "WA permits the federal §522(d) election — firm default applied below",
};

/* value − liens = net equity; exemption applied → non-exempt equity.
   `fully` = exemption covers the net equity. `exemptAmt` used when partial. */
const ASSETS = [
  { name: "Residence — 6047 Atlas Place SW", value: 2000000, liens: 1936844.75, exemption: "WA homestead", fully: true },
  { name: "2017 Maserati Ghibli", value: 16000, liens: 15915.83, exemption: "WA vehicle", fully: true },
  { name: "2006 Volvo S60", value: 3000, liens: 0, exemption: "WA vehicle", fully: true },
  { name: "Cash on hand", value: 200, liens: 0, exemption: "Wildcard", fully: true },
  { name: "BECU / PayPal accounts", value: 0, liens: 0, exemption: "—", fully: true },
  { name: "Schwab — retirement", value: 109575.94, liens: 0, exemption: "Retirement (ERISA-qualified)", fully: true },
  { name: "Equity Trust — retirement", value: 170000, liens: 0, exemption: "Retirement (ERISA-qualified)", fully: true },
  { name: "Patents (intellectual property)", value: 0, liens: 0, exemption: "—", fully: true },
  { name: "Promissory note in default — G. Aminoff", value: 50000, liens: 0, exemption: "Wildcard (partial)", fully: false, exemptAmt: 3000 },
];

export default function ScheduleCReview() {
  const [confirmed, setConfirmed] = useState({});

  const rows = useMemo(() => ASSETS.map((a, i) => {
    const netEquity = a.value - a.liens;
    const nonExempt = a.fully ? 0 : Math.max(0, netEquity - (a.exemptAmt || 0));
    return { ...a, i, netEquity, nonExempt };
  }), []);
  const liquidation = rows.reduce((s, r) => s + r.nonExempt, 0);
  const allConfirmed = rows.every((r) => confirmed[r.i]);

  return (
    <div className="sc">
      <Style />
      <h1><ShieldCheck size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule C — Exemptions & liquidation</h1>
      <div className="form">Official Form 106C · Christian E. Iovin</div>

      <div className="card">
        <div className="ph">Domicile — which state's exemptions apply</div>
        <div className="kv"><span className="k">Current state of residence</span><span className="v">{DOMICILE.currentState}</span></div>
        <div className="kv"><span className="k">Time at current domicile</span><span className="v">{DOMICILE.timeInState}</span></div>
        <div className="kv"><span className="k">§522(b)(3)(A) determination</span><span className="v">{DOMICILE.determination}<span className="calc">auto</span></span></div>
        <div className="note">730-day rule, with a 180-day look-back if domicile was in more than one state. {DOMICILE.federalElection}.</div>
      </div>

      <div className="card">
        <div className="ph"><Scale size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Asset-by-asset exemption worksheet</div>
        <div className="grid head">
          <span>Asset</span><span>Value</span><span>Liens</span><span>Net equity</span><span>Exemption applied</span><span>Non-exempt</span><span>Equity?</span>
        </div>
        {rows.map((r) => (
          <div className="grid" key={r.i}>
            <span className="nm">{r.name}</span>
            <span className="num">{money(r.value)}</span>
            <span className="num muted">{r.liens ? money(r.liens) : "—"}</span>
            <span className="num">{money(r.netEquity)}</span>
            <span className="ex">{r.exemption}{r.fully && r.netEquity > 0 ? " · fully exempt" : ""}</span>
            <span className={"num " + (r.nonExempt > 0 ? "ne" : "muted")}>{money(r.nonExempt)}</span>
            <span className="chk" onClick={() => setConfirmed((p) => ({ ...p, [r.i]: !p[r.i] }))}>
              {confirmed[r.i] ? <CheckCircle2 size={18} color="var(--oxblood)" /> : <Circle size={18} color="var(--line)" />}
            </span>
          </div>
        ))}
        <div className="note">Confirm the equity figure on each asset (value minus liens). The indicated exemption is applied; anything left over is non-exempt equity.</div>
      </div>

      <div className="liq">
        <div>
          <div className="liq-l">Liquidation analysis — non-exempt equity</div>
          <div className="liq-s">Estimated value available to unsecured creditors in a Chapter 7 liquidation. Also sets the best-interest-of-creditors floor for a Chapter 13 plan.</div>
        </div>
        <div className="liq-n">{money(liquidation)}</div>
      </div>

      <div className="confirm">
        <AlertCircle size={15} /> {allConfirmed ? "All equity figures confirmed — " : ""}Attorney confirms the domicile determination, exemptions, and liquidation analysis before filing.
      </div>
    </div>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .sc * { box-sizing:border-box; }
    .sc { --oxblood:#6b1f2a; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --good:#2f6b4f; --warn:#9a5b16; --warn-bg:#f6ead7; --line:#ddd2c2; --calc:#2d5b8e; --calc-bg:#e4ecf5; --ne:#a23030;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:900px; margin:0 auto; }
    .sc h1 { font-family:'Fraunces',serif; font-weight:600; font-size:24px; margin:0; }
    .sc .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .sc .card { background:#fffdf8; border:1px solid var(--line); border-radius:13px; padding:18px 20px; margin-top:16px; }
    .sc .ph { font-family:'Fraunces',serif; font-size:13px; font-weight:600; color:var(--oxblood); text-transform:uppercase; letter-spacing:.04em; margin:0 0 8px; }
    .sc .kv { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:14px; padding:6px 0; border-bottom:1px solid var(--paper-2); }
    .sc .kv .k { color:var(--muted); } .sc .kv .v { font-weight:600; text-align:right; }
    .sc .grid { display:grid; grid-template-columns:2fr 1fr 1fr 1fr 1.4fr 1fr 0.5fr; gap:6px 10px; align-items:center; font-size:12.5px; padding:8px 0; border-bottom:1px solid var(--paper-2); }
    .sc .grid.head { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); border-bottom:1px solid var(--line); }
    .sc .grid .nm { font-weight:600; }
    .sc .grid .num { text-align:right; font-variant-numeric:tabular-nums; }
    .sc .grid .muted { color:var(--muted); }
    .sc .grid .ne { color:var(--ne); font-weight:700; }
    .sc .grid .ex { color:var(--muted); font-size:11.5px; }
    .sc .grid .chk { text-align:center; cursor:pointer; }
    .sc .calc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--calc-bg); color:var(--calc); padding:1px 6px; border-radius:6px; margin-left:6px; }
    .sc .note { font-size:12.5px; color:var(--muted); background:var(--paper); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:12px 0 2px; }
    .sc .liq { display:flex; justify-content:space-between; align-items:center; gap:18px; background:var(--oxblood); color:#fff; border-radius:13px; padding:18px 22px; margin-top:16px; }
    .sc .liq-l { font-family:'Fraunces',serif; font-weight:600; font-size:17px; }
    .sc .liq-s { font-size:12.5px; opacity:.85; line-height:1.45; margin-top:4px; max-width:520px; }
    .sc .liq-n { font-family:'Fraunces',serif; font-weight:600; font-size:28px; white-space:nowrap; }
    .sc .confirm { display:flex; gap:8px; align-items:center; font-size:13px; font-weight:600; color:var(--warn); background:var(--warn-bg); border-radius:8px; padding:11px 13px; margin-top:14px; }
  `}</style>;
}
