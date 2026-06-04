import React, { useState, useMemo } from "react";
import { Scale, Plus, X, FileUp, AlertCircle, ClipboardCheck } from "lucide-react";

/* Means Test — Current Monthly Income (Official Form 122A-1 / 122C-1).
   Confirms every income SOURCE in the 6-month look-back; no amounts or
   deductions here (those come in the Document Portal). Splits sources into
   CMI vs non-CMI for the summary.

   DATA-DRIVEN: the component takes a `data` prop pulled from the questionnaire
   (debtor, chapter, anticipated filing date, imported Schedule I income).
   SAMPLE_DATA below is preview-only — the live app passes real data. Nothing
   about a specific client is hard-coded into the form. */

const SAMPLE_DATA = {
  // PREVIEW ONLY — no client data. At runtime the live app passes the debtor,
  // chapter, anticipated filing date, and the imported Schedule I income, all
  // pulled from the questionnaire. Nothing about any client is hard-coded here.
  debtorName: "Client name (from questionnaire)",
  chapter: "7",
  anticipatedFilingDate: "2026-06-15",
  employed: null,
  // imported from Schedule I so we don't ask twice; each entry maps to a
  // category id, e.g. { category: "wages", name: "<employer>", sub: "Wages" }.
  // Empty in preview — populated at runtime from the client's Schedule I.
  scheduleIncome: [],
};

/* cmi: counts toward Current Monthly Income. employer: capture Wages vs Self-employment. */
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

function lookbackWindow(dateStr) {
  const f = new Date(dateStr);
  const start = new Date(f.getFullYear(), f.getMonth() - 6, 1);
  const end = new Date(f.getFullYear(), f.getMonth(), 0);
  const fmt = (d) => d.toLocaleString("en-US", { month: "long", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function MeansTestIncome({ data = SAMPLE_DATA }) {
  const [chapter, setChapter] = useState(data.chapter || "7");
  const [state, setState] = useState(() =>
    Object.fromEntries(CATEGORIES.map((c) => {
      const seeded = (data.scheduleIncome || []).filter((s) => s.category === c.id).map((s) => ({ name: s.name, sub: s.sub }));
      return [c.id, { yes: seeded.length > 0, sources: seeded, fromSchedI: seeded.length > 0 }];
    }))
  );
  const [draft, setDraft] = useState({});
  const window = useMemo(() => lookbackWindow(data.anticipatedFilingDate), [data.anticipatedFilingDate]);

  const setYes = (id, yes) => setState((p) => ({ ...p, [id]: { ...p[id], yes } }));
  const addSource = (id, sub) => {
    const name = (draft[id] || "").trim(); if (!name) return;
    setState((p) => ({ ...p, [id]: { ...p[id], sources: [...p[id].sources, { name, sub }] } }));
    setDraft((p) => ({ ...p, [id]: "" }));
  };
  const removeSource = (id, idx) => setState((p) => ({ ...p, [id]: { ...p[id], sources: p[id].sources.filter((_, i) => i !== idx) } }));

  const confirmed = CATEGORIES.filter((c) => state[c.id].yes);
  const cmiCats = confirmed.filter((c) => c.cmi);
  const nonCmiCats = confirmed.filter((c) => !c.cmi);
  const srcLabel = (id) => state[id].sources.length
    ? state[id].sources.map((s) => s.name + (s.sub ? ` (${s.sub})` : "")).join(", ")
    : null;

  return (
    <div className="mt">
      <Style />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1><Scale size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Means Test — Income Sources</h1>
          <div className="form">Official Form 122A-1 / 122C-1 · {data.debtorName}</div>
        </div>
        <div className="toggle">{["7", "13"].map((c) => <button key={c} className={chapter === c ? "on" : ""} onClick={() => setChapter(c)}>Ch. {c}</button>)}</div>
      </div>

      <div className="intro">
        <div><b>Confirm every source of income you received during the look-back period</b> — the 6 full calendar months before your anticipated filing date: <b>{window}</b>.</div>
        <div className="intro-sub">We've pre-filled what we already have from your Schedule I answers, so you won't repeat yourself. You won't enter amounts here — we'll collect the actual figures and documents in the Document Portal.</div>
      </div>

      {CATEGORIES.map((c) => {
        const s = state[c.id];
        return (
          <div className="q" key={c.id}>
            <div className="q-head">
              <div className="q-label">
                {c.label}
                <span className={"tag " + (c.cmi ? "cmi" : "noncmi")}>{c.cmi ? "CMI" : "non-CMI"}</span>
                {s.fromSchedI && <span className="tag si">from Schedule I</span>}
              </div>
              <div className="yn">
                <button className={s.yes ? "on" : ""} onClick={() => setYes(c.id, true)}>Yes</button>
                <button className={!s.yes ? "on" : ""} onClick={() => setYes(c.id, false)}>No</button>
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
                    <button className="rm" onClick={() => removeSource(c.id, i)}><X size={13} /></button>
                  </div>
                ))}
                <div className="add">
                  <input value={draft[c.id] || ""}
                    placeholder={addPlaceholder(c.addType)}
                    onChange={(e) => setDraft((p) => ({ ...p, [c.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") addSource(c.id, addSub(c.addType)); }} />
                  <button className="addbtn" onClick={() => addSource(c.id, addSub(c.addType))}><Plus size={13} /> {addLabel(c.addType)}</button>
                </div>
                {c.addType === "wages" && <div className="micro">List the <b>name of each employer</b> — e.g. Walmart, Amazon.</div>}
                {c.addType === "self" && <div className="micro">List the <b>business or income source</b> and report <b>gross</b> income — e.g. Uber, a freelance client, your shop or farm.</div>}
                {c.verify && <div className="micro">Verify each pension/retirement source.</div>}
              </div>
            )}
          </div>
        );
      })}

      {/* Document portal handoff */}
      <div className="portal">
        <div className="portal-h"><FileUp size={15} /> What you'll provide in the Document Portal</div>
        {confirmed.length === 0
          ? <div className="micro">No income sources confirmed yet.</div>
          : confirmed.map((c) => (
            <div className="doc" key={c.id}>
              <span className="doc-cat">{shortLabel(c.label)}</span>
              <span className="doc-need">{c.doc}</span>
              <span className={"chan " + (c.plaid ? "plaid" : "manual")}>{c.plaid ? "Plaid where available" : "Manual upload"}</span>
            </div>
          ))}
        <div className="micro">V1 pulls what it can from Plaid; anything not retrieved is uploaded. Self-employment requires a P&L by source + month (business expenses only); if none exists, upload each month or fill the per-source data form. Rental and contributions from others use a fillable income form by source + amount. Documents must be <b>current as of the filing date</b> — income docs refresh each new month, and bank balances refresh when a signing is scheduled (per the Document Portal).</div>
      </div>

      {/* Summary — CMI vs non-CMI */}
      <div className="summary">
        <div className="sum-h"><ClipboardCheck size={16} /> Income summary — confirm before continuing</div>

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

        <div className="confirm"><AlertCircle size={14} /> CMI is the 6-month average of the CMI sources above; non-CMI income is excluded from that figure. Attorney reviews the completed means test before filing.</div>
        <button className="confirmbtn">Confirm income sources</button>
      </div>
    </div>
  );
}

const shortLabel = (l) => l.split(",")[0].split("(")[0].trim();

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .mt * { box-sizing:border-box; }
    .mt { --oxblood:#6b1f2a; --oxblood-d:#54171f; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --good:#2f6b4f; --good-bg:#e4efe6; --warn:#9a5b16; --warn-bg:#f6ead7; --line:#ddd2c2; --calc:#2d5b8e; --calc-bg:#e4ecf5;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:860px; margin:0 auto; }
    .mt h1 { font-family:'Fraunces',serif; font-weight:600; font-size:24px; margin:0; }
    .mt .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .mt .toggle { display:inline-flex; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    .mt .toggle button { border:none; background:#fffdf8; padding:7px 14px; font:inherit; font-weight:600; font-size:13px; cursor:pointer; color:var(--muted); }
    .mt .toggle button.on { background:var(--oxblood); color:#fff; }
    .mt .intro { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:15px 18px; margin-top:16px; font-size:14px; line-height:1.5; }
    .mt .intro-sub { color:var(--muted); font-size:13px; margin-top:7px; }
    .mt .q { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:14px 18px; margin-top:12px; }
    .mt .q-head { display:flex; align-items:center; gap:14px; justify-content:space-between; }
    .mt .q-label { font-weight:600; font-size:14px; }
    .mt .example { font-size:12px; color:var(--muted); font-style:italic; margin-top:6px; }
    .mt .tag { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--paper-2); color:var(--muted); padding:2px 7px; border-radius:999px; margin-left:7px; white-space:nowrap; }
    .mt .tag.si { background:var(--calc-bg); color:var(--calc); }
    .mt .tag.cmi { background:var(--good-bg); color:var(--good); }
    .mt .tag.noncmi { background:var(--warn-bg); color:var(--warn); }
    .mt .yn { display:inline-flex; gap:6px; flex:none; }
    .mt .yn button { border:1px solid var(--line); background:#fffdf8; border-radius:8px; padding:6px 16px; font:inherit; font-weight:600; font-size:13px; cursor:pointer; color:var(--muted); }
    .mt .yn button.on { background:var(--oxblood); color:#fff; border-color:var(--oxblood); }
    .mt .micro { font-size:12px; color:var(--muted); margin-top:8px; line-height:1.45; }
    .mt .rule { font-size:12.5px; font-weight:500; border-radius:8px; padding:9px 12px; margin-top:10px; line-height:1.45; }
    .mt .rule.ok { background:var(--good-bg); color:var(--good); }
    .mt .rule.warn { background:var(--warn-bg); color:var(--warn); }
    .mt .sources { margin-top:12px; border-top:1px dashed var(--line); padding-top:10px; }
    .mt .src { display:flex; align-items:center; gap:6px; padding:6px 0; border-bottom:1px solid var(--paper-2); font-size:13.5px; }
    .mt .src-nm { font-weight:600; }
    .mt .src .rm { margin-left:auto; border:none; background:none; cursor:pointer; color:var(--muted); display:flex; padding:3px; border-radius:6px; }
    .mt .src .rm:hover { background:var(--paper-2); color:var(--oxblood); }
    .mt .add { display:flex; gap:7px; margin-top:9px; flex-wrap:wrap; }
    .mt .add input { flex:1; min-width:200px; border:1px solid var(--line); border-radius:8px; padding:8px 11px; font:inherit; font-size:13px; background:var(--paper); }
    .mt .addbtn { border:1px solid var(--oxblood); background:#fffdf8; color:var(--oxblood); border-radius:8px; padding:8px 12px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; display:inline-flex; gap:4px; align-items:center; white-space:nowrap; }
    .mt .addbtn:hover { background:var(--oxblood); color:#fff; }
    .mt .portal { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:15px 18px; margin-top:18px; }
    .mt .portal-h { font-family:'Fraunces',serif; font-weight:600; font-size:15px; color:var(--oxblood); display:flex; gap:8px; align-items:center; margin-bottom:8px; }
    .mt .doc { display:grid; grid-template-columns:1fr 1.4fr auto; gap:8px 14px; align-items:center; font-size:13px; padding:8px 0; border-bottom:1px solid var(--paper-2); }
    .mt .doc-cat { font-weight:600; } .mt .doc-need { color:var(--muted); }
    .mt .chan { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:2px 8px; border-radius:999px; white-space:nowrap; }
    .mt .chan.plaid { background:var(--good-bg); color:var(--good); } .mt .chan.manual { background:var(--warn-bg); color:var(--warn); }
    .mt .summary { background:#fffdf8; border:2px solid var(--oxblood); border-radius:12px; padding:16px 18px; margin-top:18px; }
    .mt .sum-h { font-family:'Fraunces',serif; font-weight:600; font-size:16px; display:flex; gap:8px; align-items:center; margin-bottom:6px; }
    .mt .sum-group { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--good); margin:14px 0 4px; border-bottom:1px solid var(--line); padding-bottom:4px; }
    .mt .sum-group.excl { color:var(--warn); }
    .mt .sum-row { display:grid; grid-template-columns:1fr 1.6fr; gap:8px 14px; font-size:13.5px; padding:8px 0; border-bottom:1px solid var(--paper-2); }
    .mt .sum-cat { font-weight:600; } .mt .sum-src { color:var(--ink); } .mt .sum-src em { color:var(--muted); }
    .mt .rule-tag { background:var(--oxblood); color:#fff; margin:0 6px 0 0; }
    .mt .confirm { display:flex; gap:7px; align-items:center; font-size:12.5px; font-weight:600; color:var(--warn); background:var(--warn-bg); border-radius:8px; padding:10px 12px; margin-top:14px; }
    .mt .confirmbtn { margin-top:12px; border:none; border-radius:10px; padding:12px 22px; font:inherit; font-weight:600; font-size:14px; cursor:pointer; background:var(--oxblood); color:#fff; }
    .mt .confirmbtn:hover { background:var(--oxblood-d); }
  `}</style>;
}
