import React, { useMemo, useState } from "react";
import { ClipboardCheck, CheckCircle2, Circle, AlertCircle, Lock, Download } from "lucide-react";

/* Final Review (13) — global review of every section + the final declaration.
   Replaces the *content* of the existing "review" step (SectionReview) but
   REUSES its wired infrastructure — pass these in from the call site:

     summaryConfirmedMap : { <confirmKey>: boolean }  (the existing per-section
                            aggregation; pre-seeds each card's confirm state)
     propertyTotal       : number  (SectionReview's A/B grand total: reTotal+finTotal+phyTotal)
     monthlyExpenses     : number  (SectionReview's Schedule J expense total)
     onExport            : () => void   (the existing handleExport — .BCI download)
     overallConfirmed    : boolean (data.petition.overallConfirmed)
     onOverallConfirm    : (name, date) => void  (sets overallConfirmed; the
                            existing email-trigger effect fires off that flag)

   Design notes:
   • Each section has a confirm check, PRE-SEEDED from summaryConfirmedMap so
     sections already confirmed in the flow arrive green. The final declaration
     unlocks only when all are checked. (Honors Dom's per-section + global gate.)
   • Schedule C is intentionally HIGH-LEVEL (client-safe) — the liquidation
     analysis is finalized by the attorney at Signing Review.
   • Income falls back data.meansTest.income → data.schedI; SOFA flags fall back
     data.sofa.answers → derived from sofa1–4. Totals for A/B and J come in as
     props (authoritative), with a best-effort internal fallback.

   <FinalReview data={data} summaryConfirmedMap={summaryConfirmedMap}
     propertyTotal={grandTotal} monthlyExpenses={jTotal}
     onExport={handleExport} overallConfirmed={data.petition?.overallConfirmed}
     onOverallConfirm={(name,date)=>updateSection("petition",{...data.petition,
        overallConfirmed:true, declarationName:name, declarationDate:date})} /> */

const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v) => parseFloat(v) || 0;
const truthy = (v) => v === true || (typeof v === "string" && v.trim().toLowerCase() === "yes");
const rowsOf = (sec) => Array.isArray(sec) ? sec : (sec?.creditors || sec?.entries || sec?.items || []);
const sumBalances = (sec) => rowsOf(sec).reduce((a, c) => a + num(c.balance ?? c.amount ?? c.claim ?? c.total), 0);

/* light SOFA yes-count for the digest (fallback when data.sofa is empty) */
function sofaYesCount(data) {
  const a = data.sofa?.answers;
  if (a && Object.keys(a).length) return Object.values(a).filter((x) => x?.yes === true).length;
  const s1 = data.sofa1 || {}, s2 = data.sofa2 || {}, s3 = data.sofa3 || {}, s4 = data.sofa4 || {};
  const ne = (x) => Array.isArray(x) && x.length > 0;
  let n = 0;
  [s2.transfers, s2.gifts, s2.charitable, s2.insiderPayments, s2.payments90, s2.setoffs, s2.assignments,
   s3.lawsuits, s3.repos, s3.priorAddresses, s3.creditorHelpPayments, s4.trusts, s4.losses, s4.heldProperty,
   s4.safeDeposit, s1.businesses].forEach((x) => { if (ne(x)) n++; });
  [s1.hasBiz, s1.gaveFinancialStmt, s2.garnishment, s4.holdingProp].forEach((x) => { if (truthy(x)) n++; });
  return n;
}

function monthlyIncome(data) {
  const i = data.schedI || {};
  return num(i.avgMonthly6) || (num(i.netPay) + num(i.bonuses) + num(i.dSelfEmployment) + num(i.dSsRetirement)
    + num(i.dSsDisability) + num(i.dPension) + num(i.dUnemployment) + num(i.dWorkersComp) + num(i.dRental)
    + num(i.dAlimony) + num(i.dChildSupport) + num(i.dFamilyContribution) + num(i.dOtherIncome));
}
const sumNumeric = (obj = {}) => Object.values(obj).reduce((a, v) => a + (typeof v === "number" ? v : 0), 0);

const SECTIONS_META = [
  { id: "petition", name: "Voluntary Petition", form: "Form 101", confirmKey: "personalInfo" },
  { id: "ab", name: "Schedule A/B — Property", form: "106A/B", confirmKey: "schedAB" },
  { id: "c", name: "Schedule C — Exemptions", form: "106C", confirmKey: "schedC" },
  { id: "d", name: "Schedule D — Secured", form: "106D", confirmKey: "schedD" },
  { id: "e", name: "Schedule E — Priority", form: "106E/F", confirmKey: "schedEF_pri" },
  { id: "f", name: "Schedule F — Unsecured", form: "106E/F", confirmKey: "schedEF_np" },
  { id: "g", name: "Schedule G — Contracts & leases", form: "106G", confirmKey: "schedG" },
  { id: "h", name: "Schedule H — Codebtors", form: "106H", confirmKey: "schedH" },
  { id: "i", name: "Schedule I — Income", form: "106I", confirmKey: "schedI" },
  { id: "j", name: "Schedule J — Expenses", form: "106J", confirmKey: "schedJ" },
  { id: "mt", name: "Means Test — Income (CMI)", form: "122A/C", confirmKey: "meansTest" },
  { id: "sofa", name: "Statement of Financial Affairs", form: "Form 107", confirmKey: "sofa" },
  { id: "soi", name: "Statement of Intention", form: "Form 108", confirmKey: "statementOfIntention" },
  { id: "doc", name: "Disclosure of Compensation", form: "Form 2030", confirmKey: "disclosureOfCompensation" },
  { id: "matrix", name: "Verified Creditor Matrix", form: "Creditor list + parties", confirmKey: "creditorMatrix" },
];

export default function FinalReview({
  data = {},
  summaryConfirmedMap = {},
  propertyTotal,
  monthlyExpenses,
  onExport,
  overallConfirmed,
  onOverallConfirm,
}) {
  const d = data;
  const pet = d.petition || {};

  // ── derived digests ──
  const der = useMemo(() => {
    const reTotal = (d.schedAB_re?.properties || []).reduce((a, p) => a + num(p.value), 0);
    const propTotal = (typeof propertyTotal === "number") ? propertyTotal : reTotal; // fallback = real estate only
    const secured = sumBalances(d.schedD);
    const priority = sumBalances(d.schedEF_pri);
    const unsecured = sumBalances(d.schedEF_np);
    const inc = monthlyIncome(d);
    const exp = (typeof monthlyExpenses === "number") ? monthlyExpenses : sumNumeric(d.schedJ);
    const mtIncome = d.meansTest?.income;
    const mtSources = mtIncome ? Object.values(mtIncome).filter((c) => c?.yes).length : null;
    const soi = d.statementOfIntention || {};
    const securedIntents = Object.keys(soi.secured || {}).length;
    const leaseDecisions = Object.keys(soi.leases || {}).length;
    const doc = d.disclosureOfCompensation || {};
    const matrixOv = d.creditorMatrix?.overrides || {};
    const matrixOff = Object.values(matrixOv).filter((o) => o?.included === false).length;
    return {
      propTotal, secured, priority, unsecured, inc, exp, liab: secured + priority + unsecured, net: inc - exp,
      reCount: (d.schedAB_re?.properties || []).length,
      dCount: rowsOf(d.schedD).length, eCount: rowsOf(d.schedEF_pri).length, fCount: rowsOf(d.schedEF_np).length,
      gCount: (d.schedG?.contracts || []).length, hCount: (d.schedH?.codebtors || []).length,
      mtSources, sofaYes: sofaYesCount(d), securedIntents, leaseDecisions,
      docAgreed: num(doc.agreed), docReceived: num(doc.received), docBalance: Math.max(0, num(doc.agreed) - num(doc.received)),
      matrixOff,
    };
  }, [d, propertyTotal, monthlyExpenses]);

  // digest line-items per section id
  const linesFor = (id) => {
    switch (id) {
      case "petition": return [
        ["Debtor", [pet.firstName, pet.lastName].filter(Boolean).join(" ") || "—"],
        ["SSN (last 4)", pet.ssnLastFour ? "••••" + String(pet.ssnLastFour).slice(-4) : "—"],
        ["Residence", [pet.addr1, pet.city, pet.state, pet.zip].filter(Boolean).join(", ") || "—"],
        ["County / District", [pet.county, pet.district].filter(Boolean).join(" · ") || "—"],
        ["Chapter", "Chapter " + (pet.chapter || "7")],
        ["Nature of debts", pet.debtNature || "—"],
      ];
      case "ab": return [["Total property (Schedule A/B)", money(der.propTotal)], ["Real-estate parcels", der.reCount]];
      case "c": return null; // high-level note rendered separately
      case "d": return [["Secured creditors", der.dCount], ["Total secured", money(der.secured)]];
      case "e": return [["Priority creditors", der.eCount], ["Total priority", money(der.priority)]];
      case "f": return [["Unsecured creditors", der.fCount], ["Total unsecured", money(der.unsecured)]];
      case "g": return der.gCount ? [["Contracts & leases", der.gCount]] : null;
      case "h": return der.hCount ? [["Codebtors", der.hCount]] : null;
      case "i": return [["Combined monthly income", money(der.inc)]];
      case "j": return [["Total monthly expenses", money(der.exp)], ["Monthly net (I − J)", money(der.net)]];
      case "mt": return [["Income sources (CMI)", der.mtSources == null ? "from Schedule I" : der.mtSources]];
      case "sofa": return [["Disclosures marked applicable", der.sofaYes]];
      case "soi": return [["Secured-property intentions", der.securedIntents || "—"], ["Lease decisions", der.leaseDecisions || "—"]];
      case "doc": return [["Agreed fee", money(der.docAgreed)], ["Paid / balance", money(der.docReceived) + " / " + money(der.docBalance)]];
      case "matrix": return [["Creditors left off", der.matrixOff], ["Verification", "final step — signed here"]];
      default: return null;
    }
  };

  // ── per-section confirm state, pre-seeded from the existing map ──
  const [confirmed, setConfirmed] = useState(() =>
    Object.fromEntries(SECTIONS_META.map((s) => [s.id, !!summaryConfirmedMap[s.confirmKey]]))
  );
  const toggle = (id) => setConfirmed((p) => ({ ...p, [id]: !p[id] }));
  const count = SECTIONS_META.filter((s) => confirmed[s.id]).length;
  const allConfirmed = count === SECTIONS_META.length;

  // ── declaration ──
  const [declName, setDeclName] = useState(pet.declarationName || [pet.firstName, pet.lastName].filter(Boolean).join(" ") || "");
  const [declDate, setDeclDate] = useState(pet.declarationDate || new Date().toISOString().slice(0, 10));
  const [declChecked, setDeclChecked] = useState(!!overallConfirmed);
  const canSubmit = allConfirmed && declName.trim() && declChecked;

  return (
    <div className="fr">
      <Style />
      <h1><ClipboardCheck size={21} style={{ verticalAlign: -3, marginRight: 8 }} />Final Review</h1>
      <div className="form">Confirm every section one last time, then declare and submit for signing review.</div>

      <div className="rollup">
        <Stat l="Total property" v={money(der.propTotal)} />
        <Stat l="Total liabilities" v={money(der.liab)} />
        <Stat l="Monthly net (I − J)" v={money(der.net)} neg={der.net < 0} />
        <Stat l="Sections confirmed" v={`${count} / ${SECTIONS_META.length}`} accent />
      </div>

      {SECTIONS_META.map((s) => {
        const lines = linesFor(s.id);
        const ok = confirmed[s.id];
        return (
          <div className={"card " + (ok ? "ok" : "")} key={s.id}>
            <div className="shd" onClick={() => toggle(s.id)} role="button">
              <span className="chk">{ok ? <CheckCircle2 size={19} /> : <Circle size={19} />}</span>
              <span className="snm">{s.name}</span>
              <span className="sform">{s.form}</span>
            </div>
            <div className="bd">
              {s.id === "c" ? (
                <div className="cnote">Exemptions and the liquidation (non-exempt equity) analysis are finalized by your attorney at Signing Review.</div>
              ) : lines ? (
                lines.map(([k, v]) => <div className="ln" key={k}><span>{k}</span><span className="amt">{typeof v === "number" ? v : v}</span></div>)
              ) : (
                <div className="empty">None reported.</div>
              )}
            </div>
          </div>
        );
      })}

      <div className="confirm"><AlertCircle size={15} /> Your attorney confirms exemptions, the liquidation analysis, the funds-available determination, and the asset/liability brackets at Signing Review.</div>

      {/* Declaration + export */}
      <div className="decl">
        <div className="decl-h">Declaration</div>
        {!allConfirmed && <div className="decl-lock"><Lock size={13} /> Confirm all {SECTIONS_META.length} sections above to sign and submit ({count}/{SECTIONS_META.length} done).</div>}
        <label className="decl-check" data-disabled={!allConfirmed}>
          <input type="checkbox" checked={declChecked} disabled={!allConfirmed} onChange={(e) => setDeclChecked(e.target.checked)} />
          <span>I declare under penalty of perjury that the information provided in this petition and all schedules is true and correct.</span>
        </label>
        <div className="decl-row">
          <label>Signature (type full legal name)
            <input value={declName} disabled={!allConfirmed} onChange={(e) => setDeclName(e.target.value)} placeholder="Full legal name" />
          </label>
          <label>Date
            <input type="date" value={declDate} disabled={!allConfirmed} onChange={(e) => setDeclDate(e.target.value)} />
          </label>
        </div>
        <div className="decl-actions">
          {onExport && <button type="button" className="export" onClick={onExport}><Download size={14} /> Export .BCI</button>}
          <button type="button" className="submit" disabled={!canSubmit} onClick={() => onOverallConfirm && onOverallConfirm(declName.trim(), declDate)}>
            <Lock size={15} /> {overallConfirmed ? "Submitted for signing review ✓" : canSubmit ? "Confirm all & submit for signing review" : "Complete the declaration to submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ l, v, accent, neg }) {
  return <div className={"stat" + (accent ? " accent" : "")}><div className="sl">{l}</div><div className={"sv" + (neg ? " neg" : "")}>{v}</div></div>;
}

function Style() {
  return <style>{`
    .fr * { box-sizing:border-box; }
    .fr {
      --accent:#fbbf24; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8; --good:#4ade80; --good-bg:rgba(74,222,128,.10); --neg:#f87171;
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:880px; margin:16px auto 0; }
    .fr h1 { font-family:var(--serif); font-weight:600; font-size:24px; margin:0; color:#fff; }
    .fr .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .fr .rollup { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:16px; }
    .fr .stat { background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:11px 14px; }
    .fr .stat.accent { border-color:rgba(251,191,36,.4); background:rgba(251,191,36,.06); }
    .fr .sl { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
    .fr .sv { font-family:var(--serif); font-weight:700; font-size:18px; color:#fff; margin-top:3px; } .fr .sv.neg { color:var(--neg); }
    .fr .card { background:var(--bg); border:1px solid var(--line); border-radius:12px; margin-top:10px; overflow:hidden; }
    .fr .card.ok { border-color:rgba(74,222,128,.35); }
    .fr .shd { display:flex; align-items:center; gap:11px; padding:13px 16px; cursor:pointer; user-select:none; }
    .fr .shd .chk { display:flex; color:var(--muted); } .fr .card.ok .shd .chk { color:var(--good); }
    .fr .snm { font-weight:600; font-size:14px; color:var(--ink); flex:1; }
    .fr .sform { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); background:var(--bg-2); border:1px solid var(--line); padding:2px 8px; border-radius:999px; }
    .fr .bd { padding:0 16px 13px; }
    .fr .ln { display:flex; justify-content:space-between; gap:14px; font-size:13px; padding:6px 0; border-top:1px solid var(--line-soft); }
    .fr .ln span:first-child { color:var(--muted); } .fr .ln .amt { font-weight:600; color:var(--ink); text-align:right; }
    .fr .cnote { font-size:12.5px; color:var(--muted); font-style:italic; padding-top:6px; line-height:1.5; }
    .fr .empty { font-size:12.5px; color:var(--muted); padding-top:6px; }
    .fr .confirm { display:flex; gap:8px; align-items:flex-start; font-size:12.5px; color:var(--accent); background:rgba(251,191,36,.08); border:1px solid rgba(251,191,36,.25); border-radius:9px; padding:11px 13px; margin-top:14px; line-height:1.5; }
    .fr .decl { background:var(--bg); border:1px solid var(--accent); border-radius:12px; padding:16px 18px; margin-top:16px; }
    .fr .decl-h { font-family:var(--serif); font-weight:600; font-size:16px; color:#fff; margin-bottom:10px; }
    .fr .decl-lock { display:flex; gap:7px; align-items:center; font-size:12.5px; color:var(--muted); background:var(--bg-2); border-radius:8px; padding:9px 12px; margin-bottom:12px; }
    .fr .decl-check { display:flex; gap:10px; align-items:flex-start; font-size:13px; line-height:1.5; cursor:pointer; }
    .fr .decl-check[data-disabled="true"] { opacity:.5; cursor:not-allowed; }
    .fr .decl-check input { margin-top:2px; width:16px; height:16px; flex:none; accent-color:var(--accent); }
    .fr .decl-row { display:flex; gap:12px; flex-wrap:wrap; margin-top:14px; }
    .fr .decl-row label { flex:1; min-width:160px; font-size:12px; color:var(--muted); font-weight:600; }
    .fr .decl-row input { display:block; width:100%; margin-top:5px; border:1px solid var(--line); border-radius:8px; padding:9px 11px; font:inherit; font-size:13.5px; background:var(--bg-2); color:var(--ink); }
    .fr .decl-row input:disabled { opacity:.5; }
    .fr .decl-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:16px; }
    .fr .export { border:1px solid var(--line); background:var(--bg-2); color:var(--ink); border-radius:10px; padding:11px 18px; font:inherit; font-weight:600; font-size:13.5px; cursor:pointer; display:inline-flex; gap:7px; align-items:center; }
    .fr .export:hover { border-color:var(--muted); }
    .fr .submit { flex:1; min-width:240px; border:none; border-radius:10px; padding:12px 22px; font:inherit; font-weight:600; font-size:14px; cursor:pointer; background:var(--accent); color:#1c1407; display:inline-flex; gap:8px; align-items:center; justify-content:center; }
    .fr .submit:disabled { background:var(--line); color:var(--muted); cursor:not-allowed; }
    @media(max-width:640px){ .fr .rollup{ grid-template-columns:1fr 1fr; } }
  `}</style>;
}
