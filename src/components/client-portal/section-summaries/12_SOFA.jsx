import React, { useState, useMemo } from "react";
import { ScrollText, AlertCircle, ClipboardCheck, Info, Sparkles, Check, Circle, Plus } from "lucide-react";
import ConfirmFooter from "./ConfirmFooter";

/* Statement of Financial Affairs — Official Form 107 (consolidated client intake).
   Replaces the four client-facing sofa1–4 sections with one form-ordered
   questionnaire: every question in Parts 1–11, yes/no + a brief detail line,
   with document/schedule pre-fill on five questions. "Confirm, don't recall" —
   the granular Form 107 detail is completed staff-side at petition prep.

   The four SectionSOFA1–4 components + their data are PRESERVED (mothballed),
   not deleted. This form PRE-SEEDS its yes/no answers from that existing data.

   CONTROLLED — reads/writes data.sofa:
     data.sofa = {
       marital, debtType,
       answers: { <qid>: { yes:boolean, detail:string } },
       imports: { <qid>: { confirmed:{key:bool}, added:[{label,value}] } },
     }

   <SOFAReview
     data={questionnaireData}
     onChange={(s) => updateSection("sofa", s)}
     confirmed={summaryConfirmed}
     onConfirm={onSummaryConfirm}
   />

   Live pre-fill sources (verified): petition.debtNature → threshold;
   schedD.creditors[].monthlyPayment → secured 90-day payments;
   sofa2.garnishment → garnishment line. Pay-stub / tax-return / attorney-fee
   imports degrade to manual add-rows until the Document Portal feeds them. */

const PARTS = [
  { n: 1, title: "Marital status & prior residences", qs: [
    { id: "marital", type: "choice", q: "Current marital status", options: ["Married", "Not married"] },
    { id: "priorAddr", q: "Have you lived anywhere other than your current home?", period: "Last 3 years" },
    { id: "communityProp", q: "Did you live with a spouse or legal equivalent in a community-property state?", period: "Last 8 years", note: "AZ & WA are community-property states — if yes, Schedule H (codebtors) must be completed." },
  ]},
  { n: 2, title: "Sources of income", qs: [
    { id: "empIncome", q: "Income from employment or operating a business?", period: "This year + prior 2 calendar years", note: "Gross amount by year; wages and/or business." },
    { id: "otherIncome", q: "Any other income? (support, Social Security, unemployment, pensions, rental, interest, dividends, lawsuit proceeds, royalties, gambling)", period: "This year + prior 2 years" },
  ]},
  { n: 3, title: "Certain payments before filing", qs: [
    { id: "creditorPmts", q: "Paid any creditor at or above the threshold? ($600 consumer debts / $8,575 non-consumer)", period: "90 days before filing", note: "Exclude domestic-support payments and attorney fees for this case." },
    { id: "insiderPmts", q: "Paid a debt owed to an insider (relative, business partner, etc.)?", period: "1 year before filing" },
    { id: "insiderBenefit", q: "Made any payment or transfer that benefited an insider?", period: "1 year before filing" },
  ]},
  { n: 4, title: "Legal actions, repossessions & foreclosures", qs: [
    { id: "lawsuits", q: "Were you a party to any lawsuit, court action, or administrative proceeding?", period: "1 year before filing" },
    { id: "repossess", q: "Was property repossessed, foreclosed, garnished, attached, seized, or levied?", period: "1 year before filing" },
    { id: "setoff", q: "Did any creditor set off amounts from your accounts?", period: "90 days before filing" },
    { id: "custodian", q: "Was any property in the possession of an assignee, receiver, or custodian?", period: "1 year before filing" },
  ]},
  { n: 5, title: "Gifts & contributions", qs: [
    { id: "gifts", q: "Gave gifts totaling more than $600 per person?", period: "2 years before filing" },
    { id: "charity", q: "Gave gifts or contributions of more than $600 to a charity?", period: "2 years before filing" },
  ]},
  { n: 6, title: "Losses", qs: [
    { id: "losses", q: "Lost anything because of theft, fire, disaster, or gambling?", period: "1 year before filing or since" },
  ]},
  { n: 7, title: "Certain payments or transfers", qs: [
    { id: "bkAdvice", q: "Paid or transferred property to anyone you consulted about bankruptcy?", period: "1 year before filing", note: "Attorneys, petition preparers, credit-counseling agencies." },
    { id: "creditHelp", q: "Paid or transferred to anyone who promised to help deal with creditors?", period: "1 year before filing" },
    { id: "transfers", q: "Sold, traded, or transferred property outside the ordinary course?", period: "2 years before filing" },
    { id: "trust", q: "Transferred property to a self-settled trust (asset-protection device)?", period: "10 years before filing" },
  ]},
  { n: 8, title: "Financial accounts, safe-deposit & storage", qs: [
    { id: "closedAccts", q: "Were any financial accounts closed, sold, moved, or transferred?", period: "1 year before filing" },
    { id: "safeDeposit", q: "Had a safe-deposit box or other depository for valuables?", period: "Now or within 1 year" },
    { id: "storage", q: "Stored property in a storage unit or place other than home?", period: "Within 1 year" },
  ]},
  { n: 9, title: "Property held for someone else", qs: [
    { id: "propForOthers", q: "Do you hold or control property that someone else owns?" },
  ]},
  { n: 10, title: "Environmental information", qs: [
    { id: "envNotice", q: "Notified by a governmental unit of environmental liability?" },
    { id: "envRelease", q: "Notified a governmental unit of a hazardous-material release?" },
    { id: "envProceeding", q: "Party to any judicial or administrative proceeding under an environmental law?" },
  ]},
  { n: 11, title: "Business connections", qs: [
    { id: "bizConn", q: "Owned a business or had business connections (sole proprietor, LLC/LLP member, partner, officer/director, ≥5% owner)?", period: "4 years before filing" },
    { id: "bizFinStmt", q: "Gave a financial statement about your business to anyone?", period: "2 years before filing" },
  ]},
];

const ALL_QS = PARTS.flatMap((p) => p.qs.filter((q) => q.type !== "choice"));
const money = (n) => "$" + Number(n || 0).toLocaleString("en-US");
const truthy = (v) => v === true || (typeof v === "string" && v.trim().toLowerCase() === "yes");
const nonEmpty = (a) => Array.isArray(a) && a.length > 0;
const labelFor = (id) => ALL_QS.find((q) => q.id === id)?.q;

const IMPORT_IDS = ["empIncome", "otherIncome", "creditorPmts", "repossess", "bkAdvice"];

/* Pre-seed yes/no from the preserved sofa1–4 capture.
   Handles the mixed "yes"/"Yes" casing the data uses. */
function deriveSofaAnswers(data = {}) {
  const s1 = data.sofa1 || {}, s2 = data.sofa2 || {}, s3 = data.sofa3 || {}, s4 = data.sofa4 || {};
  const num = (v) => parseFloat(v) || 0;
  const ans = {};
  const yes = (id, cond) => { if (cond) ans[id] = { yes: true }; };

  // Part 1
  yes("priorAddr", truthy(s3.hasPriorAddresses) || nonEmpty(s3.priorAddresses));
  // Part 2
  yes("empIncome", num(s1.grossYTD) > 0 || num(s1.grossPrior) > 0 || num(s1.grossTwoYears) > 0 || truthy(s1.hasBiz) || nonEmpty(s1.businesses));
  // Part 3
  yes("creditorPmts", truthy(s2.hasPayments90) || nonEmpty(s2.payments90));
  yes("insiderPmts", truthy(s2.hasInsiderPayments) || nonEmpty(s2.insiderPayments));
  yes("insiderBenefit", truthy(s2.hasPreferential) || nonEmpty(s2.preferentialEntries));
  // Part 4
  yes("lawsuits", truthy(s3.hasLawsuits) || nonEmpty(s3.lawsuits));
  yes("repossess", truthy(s3.hasRepo) || nonEmpty(s3.repos) || truthy(s2.garnishment));
  yes("setoff", truthy(s2.hasSetoffs) || nonEmpty(s2.setoffs));
  yes("custodian", truthy(s2.hasAssignments) || nonEmpty(s2.assignments));
  // Part 5
  yes("gifts", truthy(s2.hasGifts) || nonEmpty(s2.gifts));
  yes("charity", truthy(s2.hasCharitable) || nonEmpty(s2.charitable));
  // Part 6
  yes("losses", truthy(s4.hasLosses) || nonEmpty(s4.losses));
  // Part 7
  yes("creditHelp", truthy(s3.hasCreditorHelpPayments) || nonEmpty(s3.creditorHelpPayments));
  yes("transfers", truthy(s2.hasTransfers) || nonEmpty(s2.transfers));
  yes("trust", truthy(s4.hasTrusts) || nonEmpty(s4.trusts));
  // Part 8
  yes("closedAccts", nonEmpty(s4.financialAccounts) && s4.financialAccounts.some((a) => truthy(a.closed)));
  yes("safeDeposit", nonEmpty(s4.safeDeposit));
  // Part 9
  yes("propForOthers", truthy(s4.holdingProp) || nonEmpty(s4.heldProperty));
  // Part 10 — envIssues is a single coarse flag; left manual for the 3 specific questions
  // Part 11
  yes("bizConn", truthy(s1.hasBiz) || nonEmpty(s1.businesses));
  yes("bizFinStmt", truthy(s1.gaveFinancialStmt) || nonEmpty(s1.finStmtRecipients));
  // (otherIncome, communityProp, bkAdvice, storage, env* left for the client to answer)
  return ans;
}

/* Document/schedule pre-fill for the 5 import questions. */
function importsFor(qid, data, debtType) {
  if (qid === "creditorPmts") {
    const threshold = debtType === "non-consumer" ? 8575 : 600;
    const rows = [];
    (data.schedD?.creditors || []).forEach((c, i) => {
      if (!c.name) return;
      const agg = (parseFloat(c.monthlyPayment) || 0) * 3; // ~90 days
      if (agg >= threshold) rows.push({ key: "d" + i, label: `${c.name} — secured`, value: money(agg) + " over ~90 days", source: "Schedule D" });
    });
    return { intro: `Secured-creditor payments from Schedule D that reach the ${money(threshold)} 90-day threshold (${debtType} debts) — confirm each, and add any others (credit cards, personal loans):`, rows, addLabel: "Add a payment not listed (e.g. credit card, personal loan)", empty: `No Schedule D payment reaches the ${money(threshold)} 90-day threshold — add any that apply.` };
  }
  if (qid === "repossess") {
    const rows = [];
    if (truthy(data.sofa2?.garnishment)) {
      const d = data.sofa2?.garnishmentDetails;
      rows.push({ key: "garn", label: "Wage garnishment / levy" + (d ? ` — ${d}` : ""), value: "reported earlier", source: "Your prior SOFA answers" });
    }
    return { intro: "Garnishment from your earlier answers — confirm, and add any repossession, foreclosure, or seizure:", rows, addLabel: "Add a repossession / foreclosure / seizure" };
  }
  // No live source yet — manual add-rows until the Document Portal feeds these.
  if (qid === "empIncome") return { intro: "Add your gross income by year — we'll confirm against pay stubs and tax returns once you upload them:", rows: [], addLabel: "Add a year / income source", empty: "Pay-stub and tax-return imports activate with the Document Portal — add amounts manually for now." };
  if (qid === "otherIncome") return { intro: "Add any other income (support, Social Security, unemployment, rental, interest, royalties, gambling):", rows: [], addLabel: "Add other income", empty: "Add any other income sources that apply." };
  if (qid === "bkAdvice") return { intro: "Add anyone you paid or consulted about bankruptcy (attorney, petition preparer, counseling agency) — fee records import with the Document Portal:", rows: [], addLabel: "Add a bankruptcy-related payment", empty: "Add any bankruptcy-related payments." };
  return null;
}

export default function SOFAReview({ data = {}, onChange, confirmed, onConfirm }) {
  const saved = data.sofa || {};
  const seed = useMemo(() => deriveSofaAnswers(data), [data]);
  const defaultDebtType = saved.debtType
    || (data.petition?.debtNature === "consumer" ? "consumer" : data.petition?.debtNature ? "non-consumer" : "consumer");

  const [sofa, setSofa] = useState(() => ({
    marital: saved.marital || null,
    debtType: defaultDebtType,
    answers: { ...seed, ...(saved.answers || {}) },
    imports: saved.imports || {},
  }));
  const [idraft, setIdraft] = useState({});

  const patch = (p) => { const next = { ...sofa, ...p }; setSofa(next); onChange && onChange({ ...saved, ...next }); };
  const setMarital = (m) => patch({ marital: m });
  const setDebtType = (t) => patch({ debtType: t });
  const setYes = (id, yes) => patch({ answers: { ...sofa.answers, [id]: { ...sofa.answers[id], yes } } });
  const setDetail = (id, detail) => patch({ answers: { ...sofa.answers, [id]: { ...sofa.answers[id], detail } } });
  const confirmRow = (qid, key) => patch({ imports: { ...sofa.imports, [qid]: { ...sofa.imports[qid], confirmed: { ...sofa.imports[qid]?.confirmed, [key]: !sofa.imports[qid]?.confirmed?.[key] } } } });
  const addRow = (qid) => {
    const l = idraft[qid + ":l"];
    if (!l || !l.trim()) return;
    patch({ imports: { ...sofa.imports, [qid]: { ...sofa.imports[qid], added: [...(sofa.imports[qid]?.added || []), { label: l.trim(), value: (idraft[qid + ":v"] || "").trim() }] } } });
    setIdraft((d) => ({ ...d, [qid + ":l"]: "", [qid + ":v"]: "" }));
  };
  const impFor = (id) => importsFor(id, data, sofa.debtType);

  return (
    <div className="sofa">
      <Style />
      <h1><ScrollText size={21} style={{ verticalAlign: -3, marginRight: 8 }} />Statement of Financial Affairs</h1>
      <div className="form">Official Form 107 · answer every question in order</div>
      <div className="dtype"><span>Debts are primarily:</span>
        {["consumer", "non-consumer"].map((t) => <button type="button" key={t} className={sofa.debtType === t ? "on" : ""} onClick={() => setDebtType(t)}>{t}</button>)}
        <span className="dthint">sets the 90-day payment threshold ({sofa.debtType === "non-consumer" ? "$8,575" : "$600"})</span>
      </div>

      {PARTS.map((p) => (
        <div className="card" key={p.n}>
          <div className="ph">Part {p.n} · {p.title}</div>
          {p.qs.map((q) => {
            if (q.type === "choice") {
              return (
                <div className="q" key={q.id}>
                  <div className="q-head"><div className="q-label">{q.q}</div>
                    <div className="yn">{q.options.map((o) => <button type="button" key={o} className={sofa.marital === o ? "on" : ""} onClick={() => setMarital(o)}>{o}</button>)}</div>
                  </div>
                </div>
              );
            }
            const a = sofa.answers[q.id] || {};
            return (
              <div className="q" key={q.id}>
                <div className="q-head">
                  <div className="q-label">{q.q}{q.period && <span className="period">{q.period}</span>}</div>
                  <div className="yn">
                    <button type="button" className={a.yes === true ? "on" : ""} onClick={() => setYes(q.id, true)}>Yes</button>
                    <button type="button" className={a.yes === false ? "on" : ""} onClick={() => setYes(q.id, false)}>No</button>
                  </div>
                </div>
                {q.note && <div className="micro"><Info size={11} style={{ verticalAlign: -1 }} /> {q.note}</div>}
                {a.yes === true && (() => {
                  const imps = impFor(q.id);
                  if (!imps) return (
                    <input className="detail" placeholder="Briefly describe — details, dates, amounts collected next…"
                      value={a.detail || ""} onChange={(e) => setDetail(q.id, e.target.value)} />
                  );
                  const conf = sofa.imports[q.id]?.confirmed || {};
                  const added = sofa.imports[q.id]?.added || [];
                  return (
                    <div className="import">
                      <div className="import-h"><Sparkles size={12} /> {imps.intro}</div>
                      {imps.rows.map((r) => (
                        <div className="irow" key={r.key}>
                          <button type="button" className={"ick " + (conf[r.key] ? "on" : "")} onClick={() => confirmRow(q.id, r.key)}>{conf[r.key] ? <Check size={12} /> : <Circle size={12} />}</button>
                          <span className="ilabel">{r.label}</span><span className="ival">{r.value}</span><span className="isrc">{r.source}</span>
                        </div>
                      ))}
                      {added.map((r, idx) => (
                        <div className="irow added" key={"a" + idx}><span className="ick on"><Check size={12} /></span><span className="ilabel">{r.label}</span><span className="ival">{r.value}</span><span className="isrc">added</span></div>
                      ))}
                      {imps.rows.length === 0 && added.length === 0 && <div className="micro" style={{ marginTop: 6 }}>{imps.empty || "Nothing imported — add any that apply."}</div>}
                      <div className="iadd">
                        <input placeholder={imps.addLabel} value={idraft[q.id + ":l"] || ""} onChange={(e) => setIdraft((d) => ({ ...d, [q.id + ":l"]: e.target.value }))} />
                        <input className="amt" placeholder="amount / detail" value={idraft[q.id + ":v"] || ""} onChange={(e) => setIdraft((d) => ({ ...d, [q.id + ":v"]: e.target.value }))} />
                        <button type="button" onClick={() => addRow(q.id)}><Plus size={12} /> Add</button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      ))}

      {/* Summary — every question + answer */}
      <div className="summary">
        <div className="sum-h"><ClipboardCheck size={16} /> Summary — every question &amp; your answer</div>
        {PARTS.map((p) => (
          <div key={p.n}>
            <div className="sum-group">Part {p.n} · {p.title}</div>
            {p.qs.map((q) => {
              if (q.type === "choice") {
                return <div className="sum-row" key={q.id}><span className="sum-q">{q.q}</span><span className="sum-a">{sofa.marital || <em>—</em>}</span></div>;
              }
              const a = sofa.answers[q.id] || {};
              const isYes = a.yes === true;
              return (
                <div className="sum-row" key={q.id}>
                  <span className="sum-q">{q.q}</span>
                  <span className={"sum-a " + (isYes ? "yes" : a.yes === false ? "no" : "")}>
                    {a.yes === undefined ? <em>—</em> : isYes ? "Yes" : "No"}
                    {isYes && (() => {
                      const imps = impFor(q.id);
                      if (imps) { const c = sofa.imports[q.id]?.confirmed || {}; const n = imps.rows.filter((r) => c[r.key]).length + (sofa.imports[q.id]?.added?.length || 0); return ` · from documents — ${n} confirmed`; }
                      return a.detail ? " · " + a.detail : " · details to be provided";
                    })()}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        <div className="confirm-note"><AlertCircle size={14} /> This confirms which items apply. The detailed Form 107 entries (specific dates, amounts, parties) are completed with your attorney at petition preparation, using your answers here plus your uploaded documents.</div>
      </div>

      <ConfirmFooter
        confirmed={confirmed}
        onConfirm={onConfirm}
        sectionLabel="Statement of Financial Affairs"
      />
    </div>
  );
}

function Style() {
  return <style>{`
    .sofa * { box-sizing:border-box; }
    .sofa {
      --accent:#fbbf24; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8; --good:#4ade80; --good-bg:rgba(74,222,128,.12);
      --warn:#fcd34d; --warn-bg:rgba(251,191,36,.10); --calc:#7dd3fc; --calc-bg:rgba(56,189,248,.14);
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:860px; margin:16px auto 0; }
    .sofa h1 { font-family:var(--serif); font-weight:600; font-size:24px; margin:0; color:#fff; }
    .sofa .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .sofa .dtype { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:14px; font-size:13px; color:var(--muted); }
    .sofa .dtype button { border:1px solid var(--line); background:var(--bg-2); border-radius:8px; padding:5px 13px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; color:var(--muted); text-transform:capitalize; }
    .sofa .dtype button.on { background:var(--accent); color:#1c1407; border-color:var(--accent); }
    .sofa .dthint { font-size:12px; font-style:italic; }
    .sofa .card { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:6px 18px 14px; margin-top:14px; }
    .sofa .ph { font-family:var(--serif); font-weight:600; font-size:14px; color:var(--accent); padding:12px 0 6px; border-bottom:1px solid var(--line); margin-bottom:4px; }
    .sofa .q { padding:13px 0; border-bottom:1px solid var(--line-soft); }
    .sofa .q:last-child { border-bottom:none; }
    .sofa .q-head { display:flex; align-items:flex-start; gap:14px; justify-content:space-between; }
    .sofa .q-label { font-weight:500; font-size:13.5px; line-height:1.45; color:var(--ink); }
    .sofa .period { display:inline-block; margin-left:8px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--calc); background:var(--calc-bg); padding:2px 7px; border-radius:999px; white-space:nowrap; vertical-align:middle; }
    .sofa .yn { display:inline-flex; gap:6px; flex:none; }
    .sofa .yn button { border:1px solid var(--line); background:var(--bg-2); border-radius:8px; padding:6px 16px; font:inherit; font-weight:600; font-size:13px; cursor:pointer; color:var(--muted); }
    .sofa .yn button.on { background:var(--accent); color:#1c1407; border-color:var(--accent); }
    .sofa .micro { font-size:12px; color:var(--muted); margin-top:8px; line-height:1.45; display:flex; gap:5px; align-items:flex-start; }
    .sofa .detail { width:100%; margin-top:10px; border:1px solid var(--line); border-radius:8px; padding:8px 11px; font:inherit; font-size:13px; background:var(--bg-2); color:var(--ink); }
    .sofa .import { margin-top:11px; background:var(--bg-2); border:1px solid var(--line); border-radius:10px; padding:11px 13px; }
    .sofa .import-h { font-size:12px; color:var(--accent); font-weight:600; display:flex; gap:6px; align-items:flex-start; margin-bottom:9px; line-height:1.45; }
    .sofa .irow { display:grid; grid-template-columns:auto 1.3fr auto auto; gap:6px 11px; align-items:center; padding:6px 0; border-bottom:1px solid var(--line-soft); font-size:12.5px; }
    .sofa .irow:last-of-type { border-bottom:none; }
    .sofa .ick { width:22px; height:22px; flex:none; border:1px solid var(--line); background:var(--bg); border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--muted); }
    .sofa .ick.on { background:var(--good); border-color:var(--good); color:#06231a; }
    .sofa .ilabel { font-weight:600; color:var(--ink); }
    .sofa .ival { color:var(--ink); white-space:nowrap; }
    .sofa .isrc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); background:var(--bg); border:1px solid var(--line); padding:1px 6px; border-radius:999px; white-space:nowrap; }
    .sofa .irow.added .ilabel { color:var(--good); }
    .sofa .iadd { display:flex; gap:6px; margin-top:9px; flex-wrap:wrap; }
    .sofa .iadd input { flex:1; min-width:160px; border:1px solid var(--line); border-radius:7px; padding:7px 10px; font:inherit; font-size:12.5px; background:var(--bg); color:var(--ink); }
    .sofa .iadd input.amt { flex:none; width:130px; min-width:110px; }
    .sofa .iadd button { border:1px solid var(--accent); background:transparent; color:var(--accent); border-radius:7px; padding:7px 12px; font:inherit; font-weight:600; font-size:12px; cursor:pointer; display:inline-flex; gap:4px; align-items:center; }
    .sofa .iadd button:hover { background:var(--accent); color:#1c1407; }
    .sofa .summary { background:var(--bg); border:1px solid var(--accent); border-radius:12px; padding:16px 18px; margin-top:18px; }
    .sofa .sum-h { font-family:var(--serif); font-weight:600; font-size:16px; display:flex; gap:8px; align-items:center; margin-bottom:6px; color:#fff; }
    .sofa .sum-group { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--accent); margin:14px 0 4px; border-bottom:1px solid var(--line); padding-bottom:4px; }
    .sofa .sum-row { display:grid; grid-template-columns:1fr auto; gap:8px 14px; font-size:13px; padding:7px 0; border-bottom:1px solid var(--line-soft); }
    .sofa .sum-q { color:var(--ink); } .sofa .sum-a { color:var(--muted); text-align:right; } .sofa .sum-a em { color:var(--muted); }
    .sofa .sum-a.yes { color:var(--good); font-weight:600; } .sofa .sum-a.no { color:var(--muted); }
    .sofa .confirm-note { display:flex; gap:7px; align-items:flex-start; font-size:12.5px; font-weight:500; color:var(--warn); background:var(--warn-bg); border-radius:8px; padding:10px 12px; margin-top:14px; line-height:1.5; }
    @media(max-width:560px){
      .sofa .q-head { flex-direction:column; gap:8px; }
      .sofa .irow { grid-template-columns:auto 1fr; }
      .sofa .ival, .sofa .isrc { grid-column:2; text-align:left; }
    }
  `}</style>;
}
