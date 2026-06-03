import React, { useState, useMemo } from "react";
import { ShieldCheck, AlertCircle, CheckCircle2, Circle, Scale } from "lucide-react";

/* Schedule C — Official Form 106C — exemptions + liquidation worksheet.
   Restyled to the bankruptcy.ai dark theme.

   ── INTEGRATION CONTRACT ──────────────────────────────────────────────
   PROP-DRIVEN. Pass `assets` (per-asset value/liens/exemption) and
   `domicile`. EXAMPLE_* are SAMPLE ONLY and MUST NOT ship. Wire from the
   questionnaire/Supabase during merge.

   assets: { name, value, liens, exemption, fully:boolean, exemptAmt?:number }[]
   <ScheduleCReview assets={cAssets} domicile={domicile} debtor="Jane Sample" />
   ─────────────────────────────────────────────────────────────────────── */

const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EXAMPLE_DOMICILE = {
  currentState: "Example State",
  timeInState: "730+ days (≥ 2 years)",
  determination: "State exemption set applies",
  federalElection: "State permits the federal §522(d) election — firm default applied below",
};

/* EXAMPLE ONLY — do not ship. */
const EXAMPLE_ASSETS = [
  { name: "Example residence", value: 0, liens: 0, exemption: "Homestead", fully: true },
];

export default function ScheduleCReview({ assets = EXAMPLE_ASSETS, domicile = EXAMPLE_DOMICILE, debtor = "Example Debtor" }) {
  const [confirmed, setConfirmed] = useState({});

  const rows = useMemo(() => assets.map((a, i) => {
    const netEquity = (a.value || 0) - (a.liens || 0);
    const nonExempt = a.fully ? 0 : Math.max(0, netEquity - (a.exemptAmt || 0));
    return { ...a, i, netEquity, nonExempt };
  }), [assets]);
  const liquidation = rows.reduce((s, r) => s + r.nonExempt, 0);
  const allConfirmed = rows.every((r) => confirmed[r.i]);

  return (
    <div className="sc">
      <Style />
      <h1><ShieldCheck size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule C — Exemptions & liquidation</h1>
      <div className="form">Official Form 106C · {debtor}</div>

      <div className="card">
        <div className="ph">Domicile — which state's exemptions apply</div>
        <div className="kv"><span className="k">Current state of residence</span><span className="v">{domicile.currentState}</span></div>
        <div className="kv"><span className="k">Time at current domicile</span><span className="v">{domicile.timeInState}</span></div>
        <div className="kv"><span className="k">§522(b)(3)(A) determination</span><span className="v">{domicile.determination}<span className="calc">auto</span></span></div>
        <div className="note">730-day rule, with a 180-day look-back if domicile was in more than one state. {domicile.federalElection}.</div>
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
              {confirmed[r.i] ? <CheckCircle2 size={18} color="var(--accent)" /> : <Circle size={18} color="var(--line)" />}
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
    .sc * { box-sizing:border-box; }
    .sc {
      --accent:#fbbf24; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8; --warn:#fcd34d; --warn-bg:rgba(251,191,36,.10);
      --calc:#7dd3fc; --calc-bg:rgba(56,189,248,.12); --ne:#fb7185;
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:900px; margin:0 auto; }
    .sc h1 { font-family:var(--serif); font-weight:600; font-size:24px; margin:0; color:#fff; }
    .sc .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .sc .card { background:var(--bg); border:1px solid var(--line); border-radius:16px; padding:18px 20px; margin-top:16px; }
    .sc .ph { font-family:var(--serif); font-size:13px; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:.04em; margin:0 0 8px; }
    .sc .kv { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:14px; padding:6px 0; border-bottom:1px solid var(--line-soft); }
    .sc .kv .k { color:var(--muted); } .sc .kv .v { font-weight:600; text-align:right; }
    .sc .grid { display:grid; grid-template-columns:2fr 1fr 1fr 1fr 1.4fr 1fr 0.5fr; gap:6px 10px; align-items:center; font-size:12.5px; padding:8px 0; border-bottom:1px solid var(--line-soft); }
    .sc .grid.head { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); border-bottom:1px solid var(--line); }
    .sc .grid .nm { font-weight:600; }
    .sc .grid .num { text-align:right; font-variant-numeric:tabular-nums; }
    .sc .grid .muted { color:var(--muted); }
    .sc .grid .ne { color:var(--ne); font-weight:700; }
    .sc .grid .ex { color:var(--muted); font-size:11.5px; }
    .sc .grid .chk { text-align:center; cursor:pointer; }
    .sc .calc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--calc-bg); color:var(--calc); padding:1px 6px; border-radius:6px; margin-left:6px; }
    .sc .note { font-size:12.5px; color:var(--muted); background:var(--bg-2); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:12px 0 2px; }
    .sc .liq { display:flex; justify-content:space-between; align-items:center; gap:18px; background:var(--bg-2); border:1px solid var(--accent); border-radius:16px; padding:18px 22px; margin-top:16px; }
    .sc .liq-l { font-family:var(--serif); font-weight:600; font-size:17px; color:#fff; }
    .sc .liq-s { font-size:12.5px; color:var(--muted); line-height:1.45; margin-top:4px; max-width:520px; }
    .sc .liq-n { font-family:var(--serif); font-weight:600; font-size:28px; white-space:nowrap; color:var(--accent); }
    .sc .confirm { display:flex; gap:8px; align-items:center; font-size:13px; font-weight:600; color:var(--warn); background:var(--warn-bg); border:1px solid rgba(251,191,36,.25); border-radius:8px; padding:11px 13px; margin-top:14px; }
  `}</style>;
}
