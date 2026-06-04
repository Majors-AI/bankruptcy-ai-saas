import React, { useMemo, useState } from "react";
import {
  FolderUp, CalendarClock, RefreshCw, GraduationCap, Fingerprint, FileText, Car, Home,
  PiggyBank, Shield, Banknote, Mail, AlertCircle, CheckCircle2, ShieldCheck, Lock, Scale, TrendingUp
} from "lucide-react";
import ProfitAndLoss from "./23_ProfitAndLoss.jsx";

/* Document Portal — all case documents collected here, organized BY SCHEDULE,
   modeled on the production portal. Driven by document-currency rules; fully
   data-bound (sample below mirrors the uploaded version — nothing hard-coded).

   CURRENCY RULES
   1. Filing docs must be CURRENT AS OF THE FILING DATE.
   2. Income docs + bank statements REFRESH EACH NEW MONTH (time-sensitive).
   3. Time-sensitive docs UNLOCK within the 60-day window before final payment.
   4. At SIGNING, request an updated balance PER ACCOUNT for every account NOT
      100% exempt (one per account).
   5. Fully-exempt accounts (IRA/retirement) skip the balance update unless their
      latest statement is older than 90 days.
   6. Morning of signing, an automated email requests each non-exempt balance. */

const SAMPLE_DATA = {
  debtorName: "Debtor (preview)",
  chapter: "7",
  today: "2026-06-03",
  anticipatedFilingDate: "2026-06-30",
  signingDate: "2026-06-25",
  finalPaymentDate: "2026-06-30",
  windowDays: 60,
  lookbackMonths: ["January 2026", "February 2026", "March 2026", "April 2026", "May 2026", "June 2026"],
  taxYears: ["2025", "2024"],
  realProperty: [{ desc: "Primary residence", mortgage: true, hoa: true }],
  vehicles: [{ name: "2019 Toyota Camry", loan: true }, { name: "2014 Honda Civic", loan: false }],
  accounts: [
    { name: "Chase Bank Checking", group: "bank", fullyExempt: false },
    { name: "Chase Bank Savings", group: "bank", fullyExempt: false },
    { name: "Banner Bank Checking", group: "bank", fullyExempt: false },
    { name: "Brokerage / Investment — Robinhood", group: "brokerage", fullyExempt: false, holdings: "AAPL 22 sh; TSLA 8 sh" },
    { name: "Cryptocurrency — Coinbase", group: "crypto", fullyExempt: false, holdings: "0.024 BTC" },
    { name: "401(k) — Fidelity Investments", group: "retirement", fullyExempt: true, lastStatement: "2026-04-30" },
    { name: "IRA (Traditional) — Vanguard", group: "retirement", fullyExempt: true, lastStatement: "2026-01-31" },
    { name: "403(b) — TIAA", group: "retirement", fullyExempt: true, lastStatement: "2026-05-31" },
  ],
  insurance: [{ type: "Term Life" }, { type: "Whole Life", cashValue: 4200 }],
  income: { wages: true, selfEmployed: true, nonFilingSpouse: true, rental: true, familyContribution: true },
  legal: { divorce8yr: true, support: true },
  taxRefundExpected: true,
  creditCounseling: "2026-02-15",   // pre-filing course completion date — must be within 180 days BEFORE filing
};

const ageDays = (from, to) => Math.round((to - new Date(from)) / 86400000);
const fmt = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const FORM_LABEL = { "A/B": "Form 106A/B", "C": "Form 106C", "D": "Form 106D", "E/F": "Form 106E/F", "I": "Form 106I", "J": "Form 106J", "122 / SOFA": "Form 122 / 107", "SOFA": "Form 107" };
const formFor = (s) => FORM_LABEL[s] || s;

export default function DocumentPortal({ data = SAMPLE_DATA }) {
  const [ccDate, setCcDate] = useState(data.creditCounseling || "");
  const [ccPaid, setCcPaid] = useState("");
  const today = new Date(data.today);
  const filing = new Date(data.anticipatedFilingDate);
  const signing = data.signingDate ? new Date(data.signingDate) : null;
  const finalPay = data.finalPaymentDate ? new Date(data.finalPaymentDate) : null;
  const curMonth = today.toLocaleString("en-US", { month: "long", year: "numeric" });
  const daysToFinal = finalPay ? ageDays(today.toISOString(), finalPay) : null;
  const tsUnlocked = daysToFinal != null && daysToFinal <= data.windowDays;

  /* ---- build sections by schedule ---- */
  const sections = useMemo(() => buildSections(data, curMonth), [data, curMonth]);

  /* ---- signing-day balances: per account NOT 100% exempt ---- */
  const signingAccts = data.accounts.filter((a) => !a.fullyExempt);
  /* ---- retirement (exempt) currency: only re-request if >90 days as of filing ---- */
  const staleExempt = data.accounts.filter((a) => a.fullyExempt && ageDays(a.lastStatement, filing) > 90);

  /* ---- credit counseling must be obtained within 180 days BEFORE filing (11 U.S.C. § 109(h)) ---- */
  const cc = data.creditCounseling ? new Date(data.creditCounseling) : null;
  const ccExpiry = cc ? new Date(cc.getTime() + 180 * 86400000) : null;        // last valid filing date
  const ccDaysAtFiling = cc ? ageDays(data.creditCounseling, filing) : null;   // age of cert on filing day
  const ccValid = cc ? ccDaysAtFiling <= 180 : false;

  const totals = useMemo(() => {
    let total = 0, required = 0;
    sections.forEach((s) => s.docs.forEach((d) => { total++; if (d.required) required++; }));
    total += signingAccts.length; required += signingAccts.length;     // signing-day items
    return { total, required };
  }, [sections, signingAccts.length]);

  return (
    <div className="dp">
      <Style />
      <div className="top">
        <div className="crumb">Section 16 of 17 · Documents</div>
        <h1><FolderUp size={22} style={{ verticalAlign: -4, marginRight: 8 }} />Document Portal</h1>
        <div className="form">{data.debtorName} · Chapter {data.chapter}</div>
        <p className="lede">All required documents are collected here — nothing was asked during the earlier questionnaire sections. Time-sensitive documents (pay stubs, bank statements) must reflect the current month; if a new month begins before filing, you'll be asked to re-upload.</p>
      </div>

      <div className="bar">
        <div className="b"><CalendarClock size={15} /><div><span className="bl">Anticipated filing</span><span className="bv">{fmt(filing)}</span></div></div>
        <div className="b"><CalendarClock size={15} /><div><span className="bl">Signing</span><span className="bv">{signing ? fmt(signing) : "Not scheduled"}</span></div></div>
        <div className="b"><RefreshCw size={15} /><div><span className="bl">Current month</span><span className="bv">{curMonth}</span></div></div>
        <div className="b prog"><div><span className="bl">Documents</span><span className="bv">0 / {totals.total} ({totals.required} required)</span></div></div>
      </div>

      <div className="rule">All filing documents must be <b>current as of the filing date ({fmt(filing)})</b>. Income documents and bank statements refresh each new month; bank balances refresh at signing.</div>

      <div className="logged"><ShieldCheck size={14} /> Everything you upload or complete here is saved to your <b>client file</b> and recorded in your <b>time log</b> automatically — including your signed fee agreement and, once filed, a copy of your filed documents.</div>

      {tsUnlocked && (
        <div className="unlock"><Lock size={14} /> <b>Within the {data.windowDays}-day window</b> — {daysToFinal} days from final payment ({fmt(finalPay)}). Time-sensitive documents (bank statements, pay stubs) are unlocked.</div>
      )}

      {/* Required courses */}
      <div className="card">
        <div className="ch"><GraduationCap size={16} /><h2>Required courses</h2><span className="formtag">Form 423 · §109(h)</span><span className="ct">11 U.S.C. § 109(h) &amp; § 727(a)(11)</span></div>
        <Doc d={{ label: "Pre-filing Credit Counseling certificate", sub: "Course 1 of 2 — EOUST-approved provider, within 180 days of filing — before filing", required: true, sched: "§109(h)", tags: [ccValid ? "On file" : "Action needed", "Before filing"] }} />
        {cc
          ? <div className={"micro ccnote " + (ccValid ? "ccok" : "ccbad")}>
              {ccValid
                ? <>Completed {fmt(cc)} — <b>valid through {fmt(ccExpiry)}</b> ({180 - ccDaysAtFiling} days of margin at the anticipated filing date). If filing slips past {fmt(ccExpiry)}, the course must be retaken.</>
                : <>⚠ Completed {fmt(cc)} — <b>{ccDaysAtFiling} days old at the anticipated filing date, older than the 180-day limit.</b> It must be retaken before filing.</>}
            </div>
          : <div className="micro ccnote ccbad">⚠ Credit counseling completion date not recorded — confirm it was obtained within 180 days of filing.</div>}
        <div className="cccap">
          <span className="ccl">When uploading the certificate, tell us:</span>
          <label className="ccf">Date you took the course<input type="date" value={ccDate} onChange={(e) => setCcDate(e.target.value)} /></label>
          <label className="ccf">How much you paid<span className="ccdollar">$<input type="number" min="0" step="1" placeholder="0" value={ccPaid} onChange={(e) => setCcPaid(e.target.value)} /></span></label>
          <span className="ccnoteflow">Provider, date &amp; amount flow to your SOFA (payments to anyone consulted about bankruptcy).</span>
        </div>
        <Doc d={{ label: "Financial Management course", sub: "Course 2 of 2 — completed AFTER filing; attorney sends the provider link. Nothing to upload now.", sched: "§727(a)(11)", tags: ["After filing"] }} />
      </div>

      {/* Identity (case-wide) */}
      <div className="card">
        <div className="ch"><Fingerprint size={16} /><h2>Identity</h2><span className="formtag">All cases · §521</span><span className="ct">case-wide</span></div>
        <Doc d={{ label: "Government photo ID (front & back)", sub: "must be valid at time of filing", required: true, sched: "All cases", tags: ["Required", "Signing"] }} />
        <Doc d={{ label: "Social Security card", sub: "original or certified copy", required: true, sched: "All cases", tags: ["Required"] }} />
      </div>

      {/* Engagement documents — saved to the client file */}
      <div className="card">
        <div className="ch"><Shield size={16} /><h2>Engagement documents</h2><span className="formtag">Form 2030 · §527/528</span><span className="ct">saved to your client file</span></div>
        <Doc d={{ label: "Bankruptcy fee agreement (signed)", sub: "kept in your client file cabinet", sched: "Client file", tags: ["On file"] }} />
        <Doc d={{ label: "§ 527 / 528 disclosures · rights & responsibilities", sub: "kept in your client file cabinet", sched: "Client file", tags: ["On file"] }} />
      </div>

      {/* By-schedule sections */}
      {sections.map((s) => (
        <div className="card" key={s.sched}>
          <div className="ch">{s.icon}<h2>{s.title}</h2><span className="sched">Schedule {s.sched}</span><span className="formtag">{formFor(s.sched)}</span></div>
          {s.docs.map((d, i) => <Doc key={i} d={d} sched={s.sched} />)}
          {s.note && <div className="micro">{s.note}</div>}
        </div>
      ))}

      {/* Time-sensitive — monthly refresh */}
      <div className="card">
        <div className="ch"><RefreshCw size={16} /><h2>Time-sensitive — refresh each month</h2><span className="formtag">Form 122 · Sch. I</span><span className="ct">{tsUnlocked ? "unlocked" : "unlocks within 60-day window"}</span></div>
        <div className="micro" style={{ marginTop: 4 }}><b>6 months</b> of complete statements required, through the current month. When a new month begins before filing, that month is re-requested.</div>
        <div className="sub-h">Bank statements (all accounts) · Means test + Schedule A/B</div>
        {data.lookbackMonths.map((m, i) => (
          <Doc key={"b" + i} d={{ label: `Bank statement — ${m}`, required: true, sched: "A/B · Means test", tags: m === curMonth ? ["Required", "Current month"] : ["Required"], current: m === curMonth }} />
        ))}
        {data.income.wages && (<>
          <div className="sub-h">Pay stubs · Schedule I + Means test</div>
          {data.lookbackMonths.map((m, i) => (
            <Doc key={"p" + i} d={{ label: `Pay stubs — ${m}`, sub: "all stubs received this month", required: true, sched: "Sched I · Means test", tags: m === curMonth ? ["Required", "Current month"] : ["Required"], current: m === curMonth }} />
          ))}
        </>)}
        {data.income.nonFilingSpouse && <Doc d={{ label: "Non-filing spouse income verification", sub: "last 6 months — for the means test", required: true, sched: "Means test", tags: ["Required", "Means test"] }} />}
        {data.realProperty.some((r) => r.mortgage) && <Doc d={{ label: `Mortgage statement — ${curMonth}`, sub: "current balance", required: true, sched: "Sched D", tags: ["Required", "Signing", "Current month"], current: true }} />}
        {data.realProperty.some((r) => r.hoa) && <Doc d={{ label: "HOA statement / dues letter", sub: "current month, if applicable", sched: "Sched J", tags: ["Schedule J"] }} />}
        {staleExempt.length > 0 && <div className="micro">Exempt retirement accounts older than 90 days also need a refreshed statement: {staleExempt.map((a) => a.name).join(", ")}.</div>}
      </div>

      {/* Business / rental / family income — fillable Profit & Loss */}
      {(data.income.selfEmployed || data.income.rental || data.realProperty.some((r) => r.rental) || data.income.familyContribution) && (
        <div className="card">
          <div className="ch"><TrendingUp size={16} /><h2>Business &amp; rental income — Profit &amp; Loss</h2><span className="formtag">Form 122 · Sch. I</span><span className="ct">fillable worksheet</span></div>
          <div className="micro" style={{ marginBottom: 4 }}>Self-employment, rental, or other household income is entered here as a monthly Profit &amp; Loss instead of uploading separate statements. The monthly average flows to the Means Test and Schedule I.</div>
          <ProfitAndLoss data={{ monthCount: 6, asOf: data.today }} />
        </div>
      )}

      {/* At signing — balances per non-exempt account */}
      <div className="card signing">
        <div className="ch"><Banknote size={16} /><h2>At your signing appointment</h2><span className="formtag">Form 106A/B</span><span className="ct">day-of — do not upload early</span></div>
        <div className="micro" style={{ marginTop: 4 }}>An updated balance is required for every account that is <b>not 100% exempt</b>, reflecting the balance on the actual signing day. One per account.</div>
        <div className="micro" style={{ marginTop: 4 }}>When a signing is scheduled, the file is re-validated: documents that may have expired or gone stale (photo ID validity, current-month income &amp; statements, the 180-day credit-counseling window) are re-checked and re-requested, and the filing-date bank balances above are gathered.</div>
        {signingAccts.map((a, i) => (
          <Doc key={i} d={{ label: `Signing-day balance — ${a.name}`, sub: a.holdings ? `${a.holdings} — current value` : "log in & screenshot current balance", required: true, sched: "Sched A/B", tags: ["Day-of", "Signing"] }} />
        ))}
        <div className="micro"><ShieldCheck size={12} style={{ verticalAlign: -2 }} /> Fully-exempt accounts (IRA / retirement) are excluded unless their statement is older than 90 days.</div>
      </div>

      {/* Morning-of-signing email */}
      {signing && (
        <div className="email">
          <div className="ch"><Mail size={16} /><h2>Automated email — morning of signing</h2><span className="ct">{fmt(signing)}, 8:00 AM</span></div>
          <div className="micro" style={{ marginTop: 6 }}>Sent to the client the morning of the signing, requesting the updated balance for each non-exempt account as of {fmt(filing)}:</div>
          {signingAccts.map((a, i) => <div className="erow" key={i}><Banknote size={13} /> {a.name}</div>)}
        </div>
      )}

      <div className="summary">
        <div className="sh"><Scale size={16} color="var(--oxblood)" /> Re-evaluated on every month change and when a signing is scheduled, so the file stays current through filing. Attorney reviews document currency at Signing Review (step 7.5).</div>
        <div className="sh" style={{ marginTop: 8 }}><FileText size={16} color="var(--oxblood)" /> Uploads, completed sections, and every automatic email are written to your client-file <b>time log</b>; submitted documents and your fee agreement are stored in your <b>file cabinet</b>.</div>
      </div>
    </div>
  );
}

/* ---------- build by-schedule sections from case data ---------- */
function buildSections(data, curMonth) {
  const S = [];

  const ab = [];
  data.realProperty.forEach((r) => ab.push({ label: `Deed / title — ${r.desc}`, required: true, tags: ["Required"] }));
  data.vehicles.forEach((v) => {
    ab.push({ label: `Registration — ${v.name}`, required: true, tags: ["Required"] });
    ab.push({ label: `Insurance — ${v.name}`, sub: "declarations page, current coverage", required: true, tags: ["Required"] });
  });
  data.accounts.filter((a) => a.group !== "bank").forEach((a) =>
    ab.push({ label: `Statement — ${a.name}`, sub: (a.holdings ? a.holdings + " — " : "") + "most recent, current value", required: true, tags: a.fullyExempt ? ["Required", "Exempt"] : ["Required"] }));
  data.insurance.forEach((p) =>
    ab.push({ label: `${p.type} — policy declarations page`, sub: p.cashValue ? `cash surrender value $${p.cashValue.toLocaleString()}` : "policy type, face value, beneficiary", required: true, tags: ["Required"] }));
  S.push({ sched: "A/B", title: "Property & assets", icon: <PiggyBank size={16} />, docs: ab,
    note: "Financial-account, vehicle, and policy statements support Schedule A/B values and the Schedule C exemptions." });

  const d = [];
  data.realProperty.filter((r) => r.mortgage).forEach(() => d.push({ label: `Mortgage statement — ${curMonth}`, sub: "current balance (also time-sensitive)", required: true, tags: ["Required", "Signing", "Monthly"] }));
  data.vehicles.filter((v) => v.loan).forEach((v) => d.push({ label: `Auto loan statement — ${v.name}`, sub: "most recent — payoff balance", required: true, tags: ["Required"] }));
  if (d.length) S.push({ sched: "D", title: "Secured debts", icon: <Home size={16} />, docs: d });

  const ef = [];
  if (data.legal.support) ef.push({ label: "Child support / alimony order", sub: "priority claim support", tags: ["Schedule E"] });
  if (ef.length) S.push({ sched: "E/F", title: "Creditors", icon: <FileText size={16} />, docs: ef });

  // Tax returns — means test / SOFA
  const tax = data.taxYears.map((y) => ({ label: `Federal tax return — ${y}`, sub: "all pages incl. W-2s / 1099s", required: true, tags: ["Required"] }));
  if (data.taxRefundExpected) tax.push({ label: "Tax refund documentation", sub: "IRS transcript / refund confirmation", tags: ["SOFA"] });
  S.push({ sched: "122 / SOFA", title: "Tax returns & refunds", icon: <FileText size={16} />, docs: tax,
    note: "Used for the means test and the Statement of Financial Affairs." });

  const legal = [];
  if (data.legal.divorce8yr) legal.push({ label: "Divorce decree(s) — last 8 years", tags: ["SOFA"] });
  if (legal.length) S.push({ sched: "SOFA", title: "Legal history", icon: <FileText size={16} />, docs: legal, note: "Feeds the Statement of Financial Affairs (next)." });

  return S;
}

function Doc({ d, sched }) {
  const ref = d.sched || sched;
  return (
    <div className="doc">
      <div className="dmeta">
        <span className="dn">{d.label}{!d.required && <span className="opt"> · optional</span>}</span>
        {d.sub && <span className="dsub">{d.sub}</span>}
      </div>
      <div className="tags">
        {ref && <span className="chip schedref">{ref}</span>}
        {(d.tags || []).map((t, i) => <span key={i} className={"chip " + chipClass(t)}>{t}</span>)}
      </div>
    </div>
  );
}
const chipClass = (t) => ({
  "Required": "req", "Signing": "sign", "Day-of": "sign", "Current month": "mon", "Monthly": "mon",
  "Exempt": "exempt", "Means test": "mt", "Before filing": "req", "After filing": "muted", "On file": "onfile",
}[t] || "muted");

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .dp * { box-sizing:border-box; }
    .dp { --oxblood:#6b1f2a; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --good:#2f6b4f; --good-bg:#e4efe6; --warn:#9a5b16; --warn-bg:#f6ead7; --line:#ddd2c2; --calc:#2d5b8e; --calc-bg:#e4ecf5;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:880px; margin:0 auto; }
    .dp .crumb { font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); }
    .dp h1 { font-family:'Fraunces',serif; font-weight:600; font-size:25px; margin:4px 0 0; }
    .dp .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .dp .lede { font-size:13.5px; line-height:1.5; color:var(--ink); margin:10px 0 0; max-width:660px; }
    .dp .bar { display:grid; grid-template-columns:repeat(4,1fr); gap:9px; margin-top:16px; }
    .dp .b { background:#fffdf8; border:1px solid var(--line); border-radius:11px; padding:11px 13px; display:flex; gap:9px; align-items:center; color:var(--oxblood); }
    .dp .b .bl { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); }
    .dp .b .bv { display:block; font-weight:600; font-size:13.5px; color:var(--ink); }
    .dp .b.prog { color:var(--ink); }
    .dp .rule { background:var(--warn-bg); color:var(--warn); border-radius:9px; padding:11px 14px; font-size:13px; font-weight:500; margin-top:12px; line-height:1.45; }
    .dp .logged { background:var(--good-bg); color:var(--good); border-radius:9px; padding:10px 14px; font-size:12.5px; font-weight:500; margin-top:10px; display:flex; gap:7px; align-items:center; line-height:1.4; }
    .dp .logged b { color:#1f4d39; }
    .dp .unlock { background:var(--good-bg); color:var(--good); border-radius:9px; padding:10px 14px; font-size:12.5px; font-weight:500; margin-top:10px; display:flex; gap:7px; align-items:center; line-height:1.4; }
    .dp .card { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:4px 18px 14px; margin-top:14px; }
    .dp .card.signing { border-color:var(--oxblood); }
    .dp .ccnote { margin-top:6px; }
    .dp .ccnote.ccok { color:#2f6b4f; }
    .dp .ccnote.ccbad { color:#a23030; font-weight:600; }
    .dp .cccap { margin-top:10px; background:var(--paper-2); border-radius:9px; padding:11px 13px; display:flex; gap:14px; align-items:flex-end; flex-wrap:wrap; }
    .dp .cccap .ccl { font-size:12px; font-weight:600; color:var(--oxblood); width:100%; }
    .dp .cccap .ccf { font-size:11.5px; color:var(--muted); font-weight:600; display:flex; flex-direction:column; gap:4px; }
    .dp .cccap .ccf input { border:1px solid var(--line); border-radius:7px; padding:6px 9px; font:inherit; font-size:13px; background:#fffdf8; }
    .dp .cccap .ccdollar { display:inline-flex; align-items:center; gap:3px; font-weight:600; color:var(--ink); } .dp .cccap .ccdollar input { width:90px; }
    .dp .cccap .ccnoteflow { font-size:11px; color:var(--muted); width:100%; }
    .dp .ch { display:flex; align-items:center; gap:9px; padding:13px 0 10px; border-bottom:1px solid var(--line); color:var(--oxblood); }
    .dp .ch h2 { font-family:'Fraunces',serif; font-weight:600; font-size:16px; margin:0; color:var(--ink); }
    .dp .ch .ct { margin-left:auto; font-size:11px; font-weight:600; color:var(--muted); text-align:right; }
    .dp .ch .sched { margin-left:auto; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--paper-2); color:var(--oxblood); padding:3px 9px; border-radius:999px; }
    .dp .ch .formtag { margin-left:8px; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:#efe2e4; color:var(--oxblood); padding:3px 9px; border-radius:999px; white-space:nowrap; }
    .dp .sub-h { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin:12px 0 2px; }
    .dp .doc { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--paper-2); }
    .dp .dmeta { flex:1; min-width:0; } .dp .dn { display:block; font-weight:600; font-size:13.5px; } .dp .dn .opt { color:var(--muted); font-weight:400; }
    .dp .dsub { display:block; color:var(--muted); font-size:12px; margin-top:2px; }
    .dp .tags { display:flex; gap:5px; flex-wrap:wrap; justify-content:flex-end; }
    .dp .chip { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:2px 7px; border-radius:999px; white-space:nowrap; }
    .dp .chip.req { background:#efe2e4; color:var(--oxblood); }
    .dp .chip.sign { background:var(--warn-bg); color:var(--warn); }
    .dp .chip.mon { background:var(--calc-bg); color:var(--calc); }
    .dp .chip.exempt { background:#e7e0f0; color:#5b4a8a; }
    .dp .chip.mt { background:var(--good-bg); color:var(--good); }
    .dp .chip.muted { background:var(--paper-2); color:var(--muted); }
    .dp .chip.onfile { background:var(--good-bg); color:var(--good); }
    .dp .chip.schedref { background:#fff; color:var(--oxblood); border:1px solid var(--oxblood); }
    .dp .micro { font-size:12px; color:var(--muted); margin-top:10px; line-height:1.45; }
    .dp .email { background:#fffdf8; border:1px dashed var(--oxblood); border-radius:12px; padding:4px 18px 16px; margin-top:14px; }
    .dp .erow { display:flex; gap:8px; align-items:center; font-size:13.5px; font-weight:500; padding:7px 0; border-bottom:1px solid var(--paper-2); }
    .dp .summary { background:var(--paper-2); border-radius:12px; padding:14px 18px; margin-top:16px; }
    .dp .sh { font-size:13px; font-weight:500; display:flex; gap:8px; align-items:flex-start; line-height:1.45; }
    @media(max-width:680px){ .dp .bar{grid-template-columns:1fr 1fr;} }
  `}</style>;
}
