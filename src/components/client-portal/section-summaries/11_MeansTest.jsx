import React, { useState, useMemo } from "react";
import { Scale, Plus, X, FileUp, AlertCircle, ClipboardCheck } from "lucide-react";
import ConfirmFooter from "./ConfirmFooter";

/* Means Test — Current Monthly Income (Official Form 122A-1 / 122C-1).
   Restyled to the bankruptcy.ai dark theme + raw-data / controlled pattern.

   CONTROLLED COMPONENT — this section CAPTURES data (it is not a read-only
   summary). It reads from and writes to data.meansTest:

     data.meansTest = {
       income: { <categoryId>: { yes:boolean, sources:[{name,sub}], fromSchedI:boolean } },
       gifts, familyHelp, unreportedIncome,   // the 3 existing supplement fields
     }

   On any change it calls onChange(nextMeansTest); wire that to
   updateSection("meansTest", nextMeansTest) at the call site.

   Income is PRE-SEEDED from Schedule I the first time (so the client doesn't
   re-enter what they already gave). Pre-seed uses the REAL flat schedI keys
   (note: there is no dInterest field — "Interest & dividends" is left unseeded
   for the client to toggle manually).

   <MeansTestIncome
     data={questionnaireData}
     onChange={(mt) => updateSection("meansTest", mt)}
     confirmed={summaryConfirmed}
     onConfirm={onSummaryConfirm}
   />
   (meansTest is NOT a community-property section, so no community confirm.) */

/* cmi: counts toward Current Monthly Income. gross: capture gross (self-employment). */
const CATEGORIES = [
  { id: "wages", label: "Wages, salary, tips, bonuses, overtime, commissions",
    example: "e.g., a W-2 job — Walmart, Amazon, a hospital, an office",
    addType: "wages", cmi: true, doc: "6 months of pay stubs", plaid: true },
  { id: "self", label: "Self-Employment from a Business, Profession, or Farm",
    example: "e.g., Uber / Lyft, DoorDash, freelance or 1099 contractor, your own shop, a farm",
    addType: "self", cmi: true, gross: true,
    doc: "Profit & loss by source and month — business expenses only", plaid: false, chapterRule: true },
  { id: "rental", label: "Rental or other real-property income",
    example: "e.g., a rental house or duplex, a rented-out room, a land lease",
    cmi: true, doc: "Income form by source + amount (or statements)", plaid: false },
  { id: "interest", label: "Interest, dividends, and royalties",
    example: "e.g., bank interest, brokerage dividends, book or music royalties",
    cmi: true, doc: "Account / 1099 statements", plaid: true },
  { id: "pension", label: "Pension or retirement income (recurring)",
    example: "e.g., a monthly pension, annuity payments, recurring 401(k) / IRA distributions",
    cmi: true, verify: true, doc: "Benefit statements", plaid: true },
  { id: "retirementDraw", label: "Withdrawals or draws from a retirement account",
    example: "e.g., you pulled money out of a 401(k) or IRA, a hardship withdrawal, a lump-sum distribution",
    cmi: true, doc: "Distribution / withdrawal statements", plaid: true,
    note: "A one-time or occasional withdrawal is different from a recurring pension — attorney reviews whether it counts toward CMI." },
  { id: "unemployment", label: "Unemployment compensation",
    example: "e.g., state unemployment benefits",
    cmi: true, doc: "Award letter / benefit statements", plaid: false,
    note: "May be treated as a benefit under the Social Security Act — if so it moves to non-CMI. Flagged for attorney review." },
  { id: "contrib", label: "Support from family or friends",
    example: "e.g., a relative or friend regularly paying your rent or bills, or giving you money",
    cmi: true, doc: "Income form by source + amount", plaid: false },
  { id: "other", label: "Other income (annuity, state disability, etc.)",
    example: "e.g., an annuity, state disability, lawsuit-settlement payments",
    cmi: true, doc: "Source statements", plaid: false },
  { id: "socialsecurity", label: "Social Security benefits (retirement, SSDI, SSI)",
    example: "e.g., Social Security retirement, Social Security Disability (SSDI), SSI",
    cmi: false, doc: "Benefit / award statement", plaid: true,
    note: "Excluded from current monthly income by statute." },
  { id: "excluded", label: "Other excluded payments (war-crime / terrorism / national-emergency victim)",
    example: "e.g., certain payments to victims of war crimes, terrorism, or a national emergency",
    cmi: false, doc: "Source statement", plaid: false,
    note: "Statutorily excluded from current monthly income." },
];

const addPlaceholder = (t) => t === "wages" ? "Name of employer — e.g. Walmart…" : t === "self" ? "Business or income source — e.g. Uber…" : "Name / source of income…";
const addSub = (t) => t === "wages" ? "Wages" : t === "self" ? "Self-employment" : undefined;
const addLabel = (t) => t === "wages" ? "Add employer" : t === "self" ? "Add business" : "Add source";
const shortLabel = (l) => l.split(",")[0].split("(")[0].trim();

function lookbackWindow(dateStr) {
  if (!dateStr) return "the 6 full calendar months before filing";
  const f = new Date(dateStr);
  if (isNaN(f)) return "the 6 full calendar months before filing";
  const start = new Date(f.getFullYear(), f.getMonth() - 6, 1);
  const end = new Date(f.getFullYear(), f.getMonth(), 0);
  const fmt = (d) => d.toLocaleString("en-US", { month: "long", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

/* Translate the flat Schedule I fields into Dom's income categories.
   NB: no dInterest field exists in schedI, so "interest" is never pre-seeded. */
function deriveIncomeFromSchedI(schedI = {}) {
  const num = (v) => parseFloat(v) || 0;
  const seed = {};
  const set = (id, sources) => { seed[id] = { yes: true, sources: sources || [], fromSchedI: true }; };

  const empNames = (schedI.employmentSources || []).map((e) => e.employerName).filter(Boolean);
  if (empNames.length || num(schedI.netPay) > 0 || num(schedI.debtorMonthlyGross) > 0)
    set("wages", empNames.map((n) => ({ name: n, sub: "Wages" })));

  const bizNames = (schedI.selfEmploySources || []).map((e) => e.employerName || e.businessName).filter(Boolean);
  if (bizNames.length || num(schedI.dSelfEmployment) > 0)
    set("self", bizNames.length
      ? bizNames.map((n) => ({ name: n, sub: "Self-employment" }))
      : [{ name: schedI.dSelfEmploymentDesc || "Self-employment income", sub: "Self-employment" }]);

  if (num(schedI.dRental) > 0) set("rental");
  if (num(schedI.dPension) > 0) set("pension");
  if (num(schedI.dUnemployment) > 0) set("unemployment");
  if (num(schedI.dFamilyContribution) > 0) set("contrib");
  if (num(schedI.dWorkersComp) > 0 || num(schedI.dAlimony) > 0 || num(schedI.dChildSupport) > 0 || num(schedI.dOtherIncome) > 0)
    set("other");
  if (num(schedI.dSsRetirement) > 0 || num(schedI.dSsDisability) > 0) set("socialsecurity");

  return seed;
}

export default function MeansTestIncome({
  data = {},
  onChange,
  confirmed,
  onConfirm,
}) {
  const pd = data.petition || {};
  const debtor = [pd.firstName, pd.lastName].filter(Boolean).join(" ") || "Debtor";
  const chapter = String(pd.chapter || "7");
  const filingDate = pd.anticipatedFilingDate || data.meansTest?.anticipatedFilingDate;
  const lbWindow = useMemo(() => lookbackWindow(filingDate), [filingDate]);

  // ── State: seed income from saved data.meansTest.income, else from Schedule I ──
  const saved = data.meansTest || {};
  const [income, setIncome] = useState(() => {
    const base = (saved.income && Object.keys(saved.income).length)
      ? saved.income
      : deriveIncomeFromSchedI(data.schedI);
    return Object.fromEntries(CATEGORIES.map((c) => [
      c.id,
      { yes: !!base[c.id]?.yes, sources: base[c.id]?.sources || [], fromSchedI: !!base[c.id]?.fromSchedI },
    ]));
  });
  const [supplements, setSupplements] = useState({
    gifts: saved.gifts || "",
    familyHelp: saved.familyHelp || "",
    unreportedIncome: saved.unreportedIncome || "",
  });
  const [draft, setDraft] = useState({});

  // ── Persist helper ──
  const emit = (nextIncome, nextSupp) => {
    onChange && onChange({
      ...saved,
      income: nextIncome,
      gifts: nextSupp.gifts,
      familyHelp: nextSupp.familyHelp,
      unreportedIncome: nextSupp.unreportedIncome,
    });
  };
  const setYes = (id, yes) => {
    const next = { ...income, [id]: { ...income[id], yes } };
    setIncome(next); emit(next, supplements);
  };
  const addSource = (id, sub) => {
    const name = (draft[id] || "").trim(); if (!name) return;
    const next = { ...income, [id]: { ...income[id], sources: [...income[id].sources, { name, sub }] } };
    setIncome(next); setDraft((p) => ({ ...p, [id]: "" })); emit(next, supplements);
  };
  const removeSource = (id, idx) => {
    const next = { ...income, [id]: { ...income[id], sources: income[id].sources.filter((_, i) => i !== idx) } };
    setIncome(next); emit(next, supplements);
  };
  const setSupp = (field, value) => {
    const next = { ...supplements, [field]: value };
    setSupplements(next); emit(income, next);
  };

  const confirmedCats = CATEGORIES.filter((c) => income[c.id].yes);
  const cmiCats = confirmedCats.filter((c) => c.cmi);
  const nonCmiCats = confirmedCats.filter((c) => !c.cmi);
  const srcLabel = (id) => income[id].sources.length
    ? income[id].sources.map((s) => s.name + (s.sub ? ` (${s.sub})` : "")).join(", ")
    : null;

  return (
    <div className="mt">
      <Style />
      <div className="head">
        <div>
          <h1><Scale size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Means Test — Income Sources</h1>
          <div className="form">Official Form 122A-1 / 122C-1 · {debtor} · Chapter {chapter}</div>
        </div>
      </div>

      <div className="intro">
        <div><b>Confirm every source of income you received during the look-back period</b> — the 6 full calendar months before your anticipated filing date: <b>{lbWindow}</b>.</div>
        <div className="intro-sub">We've pre-filled what we already have from your Schedule I answers, so you won't repeat yourself. You won't enter amounts here — the actual figures and documents are collected in the Document Portal.</div>
      </div>

      {CATEGORIES.map((c) => {
        const s = income[c.id];
        return (
          <div className="q" key={c.id}>
            <div className="q-head">
              <div className="q-label">
                {c.label}
                <span className={"tag " + (c.cmi ? "cmi" : "noncmi")}>{c.cmi ? "CMI" : "non-CMI"}</span>
                {s.fromSchedI && <span className="tag si">from Schedule I</span>}
              </div>
              <div className="yn">
                <button type="button" className={s.yes ? "on" : ""} onClick={() => setYes(c.id, true)}>Yes</button>
                <button type="button" className={!s.yes ? "on" : ""} onClick={() => setYes(c.id, false)}>No</button>
              </div>
            </div>

            {c.example && <div className="example">{c.example}</div>}
            {c.note && <div className="micro">{c.note}</div>}
            {c.chapterRule && (
              <div className={"rule " + (chapter === "7" ? "ok" : "warn")}>
                {chapter === "7"
                  ? "Report GROSS self-employment income. Chapter 7 — business expenses are then deducted from gross receipts to reach net business income (P&L must list business expenses only, never personal)."
                  : "Report GROSS self-employment income. Chapter 13 — business expenses are NOT factored into CMI; the gross figure is used."}
              </div>
            )}

            {s.yes && (
              <div className="sources">
                {s.sources.map((src, i) => (
                  <div className="src" key={i}>
                    <span className="src-nm">{src.name}</span>
                    {src.sub && <span className="tag">{src.sub}</span>}
                    <button type="button" className="rm" onClick={() => removeSource(c.id, i)}><X size={13} /></button>
                  </div>
                ))}
                <div className="add">
                  <input value={draft[c.id] || ""}
                    placeholder={addPlaceholder(c.addType)}
                    onChange={(e) => setDraft((p) => ({ ...p, [c.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") addSource(c.id, addSub(c.addType)); }} />
                  <button type="button" className="addbtn" onClick={() => addSource(c.id, addSub(c.addType))}><Plus size={13} /> {addLabel(c.addType)}</button>
                </div>
                {c.addType === "wages" && <div className="micro">List the <b>name of each employer</b> — e.g. Walmart, Amazon.</div>}
                {c.addType === "self" && <div className="micro">List the <b>business or income source</b> and report <b>gross</b> income — e.g. Uber, a freelance client, your shop or farm.</div>}
                {c.verify && <div className="micro">Verify each pension/retirement source.</div>}
              </div>
            )}
          </div>
        );
      })}

      {/* Supplement questions (carried over from the existing means-test section) */}
      <div className="q">
        <div className="q-label">A few more questions for the means test</div>
        <label className="supp">
          <span>Any cash or in-kind <b>gifts of $200 or more</b> received in the past 6 months?</span>
          <textarea value={supplements.gifts} placeholder="Describe, or leave blank if none…"
            onChange={(e) => setSupp("gifts", e.target.value)} />
        </label>
        <label className="supp">
          <span>Does <b>family or a roommate help pay your expenses</b> (rent, utilities, food)?</span>
          <textarea value={supplements.familyHelp} placeholder="Describe, or leave blank if none…"
            onChange={(e) => setSupp("familyHelp", e.target.value)} />
        </label>
        <label className="supp">
          <span>Any <b>cash income not on your tax returns or pay stubs</b>?</span>
          <textarea value={supplements.unreportedIncome} placeholder="Describe, or leave blank if none…"
            onChange={(e) => setSupp("unreportedIncome", e.target.value)} />
        </label>
      </div>

      {/* Document portal handoff */}
      <div className="portal">
        <div className="portal-h"><FileUp size={15} /> What you'll provide in the Document Portal</div>
        {confirmedCats.length === 0
          ? <div className="micro">No income sources confirmed yet.</div>
          : confirmedCats.map((c) => (
            <div className="doc" key={c.id}>
              <span className="doc-cat">{shortLabel(c.label)}</span>
              <span className="doc-need">{c.doc}</span>
              <span className={"chan " + (c.plaid ? "plaid" : "manual")}>{c.plaid ? "Plaid where available" : "Manual upload"}</span>
            </div>
          ))}
        <div className="micro">V1 pulls what it can from Plaid; anything not retrieved is uploaded. Self-employment requires a P&L by source + month (business expenses only). Rental and contributions from others use a fillable income form by source + amount. Documents must be <b>current as of the filing date</b> — income docs refresh each new month, and bank balances refresh when a signing is scheduled.</div>
      </div>

      {/* Summary — CMI vs non-CMI */}
      <div className="summary">
        <div className="sum-h"><ClipboardCheck size={16} /> Income summary</div>

        <div className="sum-group">Counts toward CMI</div>
        {cmiCats.length === 0 ? <div className="micro">None confirmed.</div> : cmiCats.map((c) => (
          <div className="sum-row" key={c.id}>
            <span className="sum-cat">{shortLabel(c.label)}</span>
            <span className="sum-src">
              {c.id === "self" && <span className="tag rule-tag">{chapter === "7" ? "net of business expenses" : "gross (Ch.13)"}</span>}
              {srcLabel(c.id) || <em>source to be provided</em>}
            </span>
          </div>
        ))}

        <div className="sum-group excl">Excluded from CMI (non-CMI)</div>
        {nonCmiCats.length === 0 ? <div className="micro">None confirmed.</div> : nonCmiCats.map((c) => (
          <div className="sum-row" key={c.id}>
            <span className="sum-cat">{shortLabel(c.label)}</span>
            <span className="sum-src">{srcLabel(c.id) || <em>source to be provided</em>}</span>
          </div>
        ))}

        <div className="confirm-note"><AlertCircle size={14} /> CMI is the 6-month average of the CMI sources above; non-CMI income is excluded from that figure. Your attorney reviews the completed means test before filing.</div>
      </div>

      <ConfirmFooter
        confirmed={confirmed}
        onConfirm={onConfirm}
        sectionLabel="income sources"
      />
    </div>
  );
}

function Style() {
  return <style>{`
    .mt * { box-sizing:border-box; }
    .mt {
      --accent:#fbbf24; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8; --good:#4ade80; --good-bg:rgba(74,222,128,.10);
      --warn:#fcd34d; --warn-bg:rgba(251,191,36,.10); --calc:#7dd3fc; --calc-bg:rgba(56,189,248,.12);
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:840px; margin:16px auto 0; }
    .mt .head { display:flex; justify-content:space-between; align-items:flex-end; gap:12px; flex-wrap:wrap; }
    .mt h1 { font-family:var(--serif); font-weight:600; font-size:24px; margin:0; color:#fff; }
    .mt .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .mt .intro { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:15px 18px; margin-top:16px; font-size:14px; line-height:1.5; }
    .mt .intro-sub { color:var(--muted); font-size:13px; margin-top:7px; }
    .mt .q { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:14px 18px; margin-top:12px; }
    .mt .q-head { display:flex; align-items:center; gap:14px; justify-content:space-between; flex-wrap:wrap; }
    .mt .q-label { font-weight:600; font-size:14px; color:var(--ink); }
    .mt .example { font-size:12px; color:var(--muted); font-style:italic; margin-top:6px; }
    .mt .tag { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--bg-2); color:var(--muted); padding:2px 7px; border-radius:999px; margin-left:7px; white-space:nowrap; border:1px solid var(--line); }
    .mt .tag.si { background:var(--calc-bg); color:var(--calc); border-color:transparent; }
    .mt .tag.cmi { background:var(--good-bg); color:var(--good); border-color:transparent; }
    .mt .tag.noncmi { background:var(--warn-bg); color:var(--warn); border-color:transparent; }
    .mt .yn { display:inline-flex; gap:6px; flex:none; }
    .mt .yn button { border:1px solid var(--line); background:var(--bg-2); border-radius:8px; padding:6px 16px; font:inherit; font-weight:600; font-size:13px; cursor:pointer; color:var(--muted); }
    .mt .yn button.on { background:var(--accent); color:#1c1407; border-color:var(--accent); }
    .mt .micro { font-size:12px; color:var(--muted); margin-top:8px; line-height:1.45; }
    .mt .micro b { color:var(--ink); }
    .mt .rule { font-size:12.5px; font-weight:500; border-radius:8px; padding:9px 12px; margin-top:10px; line-height:1.45; }
    .mt .rule.ok { background:var(--good-bg); color:var(--good); }
    .mt .rule.warn { background:var(--warn-bg); color:var(--warn); }
    .mt .sources { margin-top:12px; border-top:1px dashed var(--line); padding-top:10px; }
    .mt .src { display:flex; align-items:center; gap:6px; padding:6px 0; border-bottom:1px solid var(--line-soft); font-size:13.5px; }
    .mt .src-nm { font-weight:600; }
    .mt .src .rm { margin-left:auto; border:none; background:none; cursor:pointer; color:var(--muted); display:flex; padding:3px; border-radius:6px; }
    .mt .src .rm:hover { background:var(--bg-2); color:var(--accent); }
    .mt .add { display:flex; gap:7px; margin-top:9px; flex-wrap:wrap; }
    .mt .add input { flex:1; min-width:200px; border:1px solid var(--line); border-radius:8px; padding:8px 11px; font:inherit; font-size:13px; background:var(--bg-2); color:var(--ink); }
    .mt .addbtn { border:1px solid var(--accent); background:transparent; color:var(--accent); border-radius:8px; padding:8px 12px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; display:inline-flex; gap:4px; align-items:center; white-space:nowrap; }
    .mt .addbtn:hover { background:var(--accent); color:#1c1407; }
    .mt .supp { display:block; margin-top:12px; font-size:13.5px; }
    .mt .supp span { display:block; margin-bottom:6px; color:var(--ink); }
    .mt .supp b { color:#fff; }
    .mt .supp textarea { width:100%; min-height:54px; border:1px solid var(--line); border-radius:8px; padding:9px 11px; font:inherit; font-size:13px; background:var(--bg-2); color:var(--ink); resize:vertical; }
    .mt .portal { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:15px 18px; margin-top:18px; }
    .mt .portal-h { font-family:var(--serif); font-weight:600; font-size:15px; color:var(--accent); display:flex; gap:8px; align-items:center; margin-bottom:8px; }
    .mt .doc { display:grid; grid-template-columns:1fr 1.4fr auto; gap:8px 14px; align-items:center; font-size:13px; padding:8px 0; border-bottom:1px solid var(--line-soft); }
    .mt .doc-cat { font-weight:600; } .mt .doc-need { color:var(--muted); }
    .mt .chan { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:2px 8px; border-radius:999px; white-space:nowrap; }
    .mt .chan.plaid { background:var(--good-bg); color:var(--good); } .mt .chan.manual { background:var(--warn-bg); color:var(--warn); }
    .mt .summary { background:var(--bg); border:1px solid var(--accent); border-radius:12px; padding:16px 18px; margin-top:18px; }
    .mt .sum-h { font-family:var(--serif); font-weight:600; font-size:16px; display:flex; gap:8px; align-items:center; margin-bottom:6px; color:#fff; }
    .mt .sum-group { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--good); margin:14px 0 4px; border-bottom:1px solid var(--line); padding-bottom:4px; }
    .mt .sum-group.excl { color:var(--warn); }
    .mt .sum-row { display:grid; grid-template-columns:1fr 1.6fr; gap:8px 14px; font-size:13.5px; padding:8px 0; border-bottom:1px solid var(--line-soft); }
    .mt .sum-cat { font-weight:600; } .mt .sum-src { color:var(--ink); } .mt .sum-src em { color:var(--muted); }
    .mt .rule-tag { background:var(--accent); color:#1c1407; margin:0 6px 0 0; border-color:transparent; }
    .mt .confirm-note { display:flex; gap:7px; align-items:center; font-size:12.5px; font-weight:600; color:var(--warn); background:var(--warn-bg); border-radius:8px; padding:10px 12px; margin-top:14px; }
  `}</style>;
}
