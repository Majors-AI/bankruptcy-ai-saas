import React, { useState } from "react";
import { ScrollText, AlertCircle, ClipboardCheck, Info, Sparkles, Check, Circle, Plus } from "lucide-react";

/* Statement of Financial Affairs — Official Form 107.
   Questions in the exact order of the form (Parts 1–11), each yes/no with a
   detail prompt on "Yes". Ends with a summary of every disclosure for the
   client to confirm. Fully interactive + data-bound — NO hard-coded client
   info. A `data` prop can pre-answer from prior questionnaire data. */

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

const money = (n) => "$" + Number(n).toLocaleString("en-US");

/* Documents/schedules the firm already has — preview sample; bind at runtime.
   These pre-fill SOFA answers so the client confirms instead of recalling. */
const SAMPLE_SOURCES = {
  paystub: { employer: "(employer from pay stub)", ytdGross: 38450, asOf: "May 31, 2026", garnishment: { creditor: "Midland Credit Management", amount: 1240 } },
  taxReturns: [{ year: "2025", wages: 71200, refund: 1830 }, { year: "2024", wages: 66950, refund: 2110 }],
  scheduleD: [{ creditor: "Toyota Financial Services", type: "auto loan", lastPayment: 415 }, { creditor: "(mortgage servicer)", type: "mortgage", lastPayment: 1685 }],
  scheduleJ: [{ payee: "Installment / personal loan (Schedule J)", amount: 220 }],
  attorneyFee: { firm: "Majors Law Group", caseType: "Regular Chapter 7", paid: 1800 },   // from the fee record / Disclosure of Compensation (Form 2030)
  creditCounselingPayment: { provider: "GreenPath Financial Wellness", amount: 25, date: "2026-02-15" },   // from the certificate / Document Portal
  eviction: { hasJudgment: true, landlord: "Cedar Park Apartments LLC", date: "2026-04-18" },   // from the petition rent/own + eviction answers
};

const IMPORT_IDS = ["empIncome", "otherIncome", "creditorPmts", "lawsuits", "repossess", "bkAdvice"];

function importsFor(qid, S, debtType = "consumer") {
  if (qid === "empIncome") {
    const rows = [{ key: "ytd", label: "This year (YTD) — wages", value: money(S.paystub.ytdGross), source: `Pay stub · ${S.paystub.employer} (as of ${S.paystub.asOf})` }];
    S.taxReturns.forEach((t) => rows.push({ key: "w" + t.year, label: `${t.year} — wages`, value: money(t.wages), source: `${t.year} tax return` }));
    return { intro: "Pulled from your latest pay stub and prior tax returns — confirm each amount:", rows, addLabel: "Add another year or income source" };
  }
  if (qid === "otherIncome") {
    const rows = S.taxReturns.filter((t) => t.refund).map((t) => ({ key: "r" + t.year, label: `${t.year} tax refund`, value: money(t.refund), source: `${t.year} tax return` }));
    return { intro: "Tax refunds from your returns — confirm, and add any other income:", rows, addLabel: "Add other income (support, SSA, unemployment, rental…)" };
  }
  if (qid === "creditorPmts") {
    const threshold = debtType === "non-consumer" ? 8575 : 600;   // 11 U.S.C. § 547(c)(8)/(9) aggregate, 90-day window
    const mk = (label, monthly, source, key) => { const agg = monthly * 3; return agg >= threshold ? { key, label, value: money(agg) + " over 90 days", source } : null; };
    const rows = [];
    S.scheduleD.forEach((c, i) => { const r = mk(`${c.creditor} — ${c.type}`, c.lastPayment, "Schedule D", "d" + i); if (r) rows.push(r); });
    S.scheduleJ.forEach((c, i) => { const r = mk(c.payee, c.amount, "Schedule J", "j" + i); if (r) rows.push(r); });
    return { intro: `Payments to any one creditor totaling ${money(threshold)}+ in the 90 days before filing (${debtType} debts), imported from Schedules D and J — confirm and add any not listed (e.g., credit-card payments):`, rows, addLabel: "Add a payment not listed (e.g., credit card, personal loan)", empty: `No imported payment reaches the ${money(threshold)} 90-day threshold — add any that apply.` };
  }
  if (qid === "repossess") {
    if (!S.paystub.garnishment) return null;
    const g = S.paystub.garnishment;
    return { intro: "A wage garnishment appears in your pay-stub deductions — confirm:", rows: [{ key: "garn", label: `Wage garnishment — ${g.creditor}`, value: money(g.amount) + " YTD withheld", source: "Pay stub · YTD deductions" }], addLabel: "Add a repossession / foreclosure / seizure not listed" };
  }
  if (qid === "lawsuits") {
    if (!S.eviction || !S.eviction.hasJudgment) return null;
    const e = S.eviction;
    return { intro: "An eviction (possession) judgment from your petition — confirm, and add any other lawsuits or actions:", rows: [{ key: "evict", label: `Eviction / unlawful detainer — ${e.landlord}`, value: "Possession judgment", source: `Petition · judgment ${e.date}` }], addLabel: "Add another lawsuit / court action / administrative proceeding" };
  }
  if (qid === "bkAdvice") {
    if (!S.attorneyFee) return null;
    const f = S.attorneyFee;
    const rows = [{ key: "atty", label: `${f.firm} — bankruptcy attorney fees (${f.caseType})`, value: money(f.paid) + " paid", source: "Disclosure of Compensation (Form 2030)" }];
    if (S.creditCounselingPayment) {
      const c = S.creditCounselingPayment;
      rows.push({ key: "cc", label: `${c.provider} — credit counseling course`, value: money(c.amount) + " paid", source: `Credit-counseling certificate · ${c.date}` });
    }
    return { intro: "Payments to anyone consulted about bankruptcy — attorney fees and the credit-counseling agency — confirm:", rows, addLabel: "Add another bankruptcy-related payment (petition preparer, other agency)" };
  }
  return null;
}

export default function SOFAReview({ data = {} }) {
  const S = data.sources || SAMPLE_SOURCES;
  const [marital, setMarital] = useState(data.marital || null);
  const [ans, setAns] = useState({ empIncome: { yes: true }, otherIncome: { yes: true }, creditorPmts: { yes: true }, lawsuits: { yes: true }, repossess: { yes: true }, bkAdvice: { yes: true }, ...(data.answers || {}) });
  const [imp, setImp] = useState({});       // { qid: { confirmed:{key:bool}, added:[{label,value}] } }
  const [idraft, setIdraft] = useState({});
  const [debtType, setDebtType] = useState(data.debtType || "consumer");

  const set = (id, yes) => setAns((p) => ({ ...p, [id]: { ...p[id], yes } }));
  const setDetail = (id, detail) => setAns((p) => ({ ...p, [id]: { ...p[id], detail } }));
  const impFor = (id) => importsFor(id, S, debtType);
  const confirmRow = (qid, key) => setImp((p) => ({ ...p, [qid]: { ...p[qid], confirmed: { ...p[qid]?.confirmed, [key]: !p[qid]?.confirmed?.[key] } } }));
  const addRow = (qid) => {
    const l = idraft[qid + ":l"]; if (!l || !l.trim()) return;
    setImp((p) => ({ ...p, [qid]: { ...p[qid], added: [...(p[qid]?.added || []), { label: l.trim(), value: (idraft[qid + ":v"] || "").trim() }] } }));
    setIdraft((d) => ({ ...d, [qid + ":l"]: "", [qid + ":v"]: "" }));
  };

  const answered = ALL_QS.filter((q) => ans[q.id]?.yes !== undefined).length + (marital ? 1 : 0);
  const totalQ = ALL_QS.length + 1;
  const disclosures = ALL_QS.filter((q) => ans[q.id]?.yes === true);
  const complete = answered === totalQ;

  const labelFor = (id) => ALL_QS.find((q) => q.id === id)?.q;

  return (
    <div className="sofa">
      <Style />
      <h1><ScrollText size={21} style={{ verticalAlign: -3, marginRight: 8 }} />Statement of Financial Affairs</h1>
      <div className="form">Official Form 107 · answer every question in order</div>
      <div className="dtype"><span>Debts are primarily:</span>
        {["consumer", "non-consumer"].map((t) => <button key={t} className={debtType === t ? "on" : ""} onClick={() => setDebtType(t)}>{t}</button>)}
        <span className="dthint">sets the 90-day payment threshold ({debtType === "non-consumer" ? "$8,575" : "$600"})</span>
      </div>

      {PARTS.map((p) => (
        <div className="card" key={p.n}>
          <div className="ph">Part {p.n} · {p.title}</div>
          {p.qs.map((q) => {
            if (q.type === "choice") {
              return (
                <div className="q" key={q.id}>
                  <div className="q-head"><div className="q-label">{q.q}</div>
                    <div className="yn">{q.options.map((o) => <button key={o} className={marital === o ? "on" : ""} onClick={() => setMarital(o)}>{o}</button>)}</div>
                  </div>
                </div>
              );
            }
            const a = ans[q.id] || {};
            return (
              <div className="q" key={q.id}>
                <div className="q-head">
                  <div className="q-label">{q.q}{q.period && <span className="period">{q.period}</span>}</div>
                  <div className="yn">
                    <button className={a.yes === true ? "on" : ""} onClick={() => set(q.id, true)}>Yes</button>
                    <button className={a.yes === false ? "on" : ""} onClick={() => set(q.id, false)}>No</button>
                  </div>
                </div>
                {q.note && <div className="micro"><Info size={11} style={{ verticalAlign: -1 }} /> {q.note}</div>}
                {a.yes === true && (() => {
                  const imps = impFor(q.id);
                  if (!imps) return (
                    <input className="detail" placeholder="Briefly describe — details, dates, amounts collected next…"
                      value={a.detail || ""} onChange={(e) => setDetail(q.id, e.target.value)} />
                  );
                  const conf = imp[q.id]?.confirmed || {};
                  const added = imp[q.id]?.added || [];
                  return (
                    <div className="import">
                      <div className="import-h"><Sparkles size={12} /> {imps.intro}</div>
                      {imps.rows.map((r) => (
                        <div className="irow" key={r.key}>
                          <button className={"ick " + (conf[r.key] ? "on" : "")} onClick={() => confirmRow(q.id, r.key)}>{conf[r.key] ? <Check size={12} /> : <Circle size={12} />}</button>
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
                        <button onClick={() => addRow(q.id)}><Plus size={12} /> Add</button>
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
                return <div className="sum-row" key={q.id}><span className="sum-q">{q.q}</span><span className="sum-a">{marital || <em>—</em>}</span></div>;
              }
              const a = ans[q.id] || {};
              const yes = a.yes === true;
              return (
                <div className="sum-row" key={q.id}>
                  <span className="sum-q">{q.q}</span>
                  <span className={"sum-a " + (yes ? "yes" : a.yes === false ? "no" : "")}>
                    {a.yes === undefined ? <em>—</em> : yes ? "Yes" : "No"}
                    {yes && (() => {
                      const imps = impFor(q.id);
                      if (imps) { const c = imp[q.id]?.confirmed || {}; const n = imps.rows.filter((r) => c[r.key]).length + (imp[q.id]?.added?.length || 0); return ` · from documents — ${n} confirmed`; }
                      return a.detail ? " · " + a.detail : " · details to be provided";
                    })()}
                  </span>
                </div>
              );
            })}
          </div>
        ))}

        {ans.communityProp?.yes && <div className="flag"><AlertCircle size={13} /> Community-property disclosure — Schedule H (codebtors) must be completed.</div>}
        {ans.bizConn?.yes && <div className="flag"><AlertCircle size={13} /> Business connection disclosed — business documents (P&L, returns) requested in the Document Portal.</div>}

        <div className="confirm"><AlertCircle size={14} /> {complete ? "All questions answered. " : `${answered} of ${totalQ} answered. `}Attorney reviews the SOFA before filing.</div>
        <button className="confirmbtn" disabled={!complete}>{complete ? "Confirm SOFA disclosures" : "Answer every question to continue"}</button>
      </div>
    </div>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .sofa * { box-sizing:border-box; }
    .sofa { --oxblood:#6b1f2a; --oxblood-d:#54171f; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --good:#2f6b4f; --warn:#9a5b16; --warn-bg:#f6ead7; --line:#ddd2c2;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:860px; margin:0 auto; }
    .sofa h1 { font-family:'Fraunces',serif; font-weight:600; font-size:24px; margin:0; }
    .sofa .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .sofa .dtype { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:10px; font-size:12.5px; color:var(--muted); }
    .sofa .dtype button { border:1px solid var(--line); background:#fffdf8; border-radius:8px; padding:5px 12px; font:inherit; font-weight:600; font-size:12px; cursor:pointer; color:var(--muted); text-transform:capitalize; }
    .sofa .dtype button.on { background:var(--oxblood); color:#fff; border-color:var(--oxblood); }
    .sofa .dthint { font-size:11.5px; }
    .sofa .card { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:6px 18px 8px; margin-top:14px; }
    .sofa .ph { font-family:'Fraunces',serif; font-size:13px; font-weight:600; color:var(--oxblood); text-transform:uppercase; letter-spacing:.04em; padding:12px 0 8px; border-bottom:1px solid var(--line); }
    .sofa .q { padding:12px 0; border-bottom:1px solid var(--paper-2); }
    .sofa .q:last-child { border-bottom:none; }
    .sofa .q-head { display:flex; align-items:flex-start; gap:14px; justify-content:space-between; }
    .sofa .q-label { font-weight:600; font-size:13.5px; line-height:1.4; }
    .sofa .period { display:inline-block; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); background:var(--paper-2); padding:2px 7px; border-radius:999px; margin-left:8px; white-space:nowrap; }
    .sofa .yn { display:inline-flex; gap:6px; flex:none; }
    .sofa .yn button { border:1px solid var(--line); background:#fffdf8; border-radius:8px; padding:6px 15px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; color:var(--muted); white-space:nowrap; }
    .sofa .yn button.on { background:var(--oxblood); color:#fff; border-color:var(--oxblood); }
    .sofa .micro { font-size:12px; color:var(--muted); margin-top:8px; line-height:1.45; }
    .sofa .detail { width:100%; margin-top:9px; border:1px solid var(--line); border-radius:8px; padding:9px 11px; font:inherit; font-size:13px; background:var(--paper); }
    .sofa .import { margin-top:10px; background:var(--paper); border:1px solid var(--line); border-radius:10px; padding:11px 13px; }
    .sofa .import-h { font-size:12px; color:var(--oxblood); font-weight:600; display:flex; gap:6px; align-items:flex-start; line-height:1.45; margin-bottom:9px; }
    .sofa .irow { display:grid; grid-template-columns:26px 1fr auto auto; gap:10px; align-items:center; padding:7px 0; border-top:1px solid var(--paper-2); }
    .sofa .ick { border:1px solid var(--line); background:#fffdf8; border-radius:6px; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--muted); padding:0; }
    .sofa .ick.on { background:var(--good); border-color:var(--good); color:#fff; }
    .sofa .ilabel { font-size:13px; font-weight:500; } .sofa .ival { font-size:13px; font-weight:600; white-space:nowrap; }
    .sofa .isrc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); background:var(--paper-2); padding:2px 8px; border-radius:999px; white-space:nowrap; }
    .sofa .irow.added .isrc { background:#e4efe6; color:var(--good); }
    .sofa .iadd { display:flex; gap:6px; margin-top:9px; flex-wrap:wrap; }
    .sofa .iadd input { flex:1; min-width:160px; border:1px solid var(--line); border-radius:7px; padding:7px 10px; font:inherit; font-size:12.5px; background:#fffdf8; } .sofa .iadd .amt { flex:none; width:130px; }
    .sofa .iadd button { border:1px dashed var(--oxblood); background:#fff; color:var(--oxblood); border-radius:7px; padding:7px 11px; font:inherit; font-weight:600; font-size:12px; cursor:pointer; display:inline-flex; gap:5px; align-items:center; }
    .sofa .summary { background:#fffdf8; border:2px solid var(--oxblood); border-radius:12px; padding:16px 18px; margin-top:16px; }
    .sofa .sum-h { font-family:'Fraunces',serif; font-weight:600; font-size:16px; display:flex; gap:8px; align-items:center; margin-bottom:8px; }
    .sofa .kv { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:14px; padding:6px 0; border-bottom:1px solid var(--paper-2); }
    .sofa .kv .k { color:var(--muted); } .sofa .kv .v { font-weight:600; } .sofa .kv em, .sofa .sum-d em { color:var(--muted); font-style:normal; }
    .sofa .sum-group { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--oxblood); margin:14px 0 4px; border-bottom:1px solid var(--line); padding-bottom:4px; }
    .sofa .sum-row { display:grid; grid-template-columns:1.4fr 1fr; gap:8px 14px; font-size:13px; padding:8px 0; border-bottom:1px solid var(--paper-2); }
    .sofa .sum-q { font-weight:600; } .sofa .sum-d { color:var(--ink); text-align:right; }
    .sofa .sum-a { text-align:right; font-weight:600; }
    .sofa .sum-a.yes { color:var(--good); } .sofa .sum-a.no { color:var(--muted); }
    .sofa .flag { display:flex; gap:7px; align-items:center; font-size:12.5px; font-weight:600; color:var(--warn); background:var(--warn-bg); border-radius:8px; padding:9px 12px; margin-top:10px; }
    .sofa .confirm { display:flex; gap:7px; align-items:center; font-size:12.5px; font-weight:600; color:var(--warn); background:var(--warn-bg); border-radius:8px; padding:10px 12px; margin-top:12px; }
    .sofa .confirmbtn { margin-top:12px; border:none; border-radius:10px; padding:12px 22px; font:inherit; font-weight:600; font-size:14px; cursor:pointer; background:var(--oxblood); color:#fff; }
    .sofa .confirmbtn:disabled { background:var(--line); cursor:not-allowed; }
    .sofa .confirmbtn:not(:disabled):hover { background:var(--oxblood-d); }
  `}</style>;
}
