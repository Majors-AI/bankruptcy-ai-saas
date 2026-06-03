import React, { useMemo, useState } from "react";
import { ClipboardCheck, Info, Circle, CheckCircle2, AlertCircle } from "lucide-react";
import ConfirmFooter from "./ConfirmFooter";

/* Statement of Intention — Official Form 108 (Chapter 7 only).
   Part 1: secured creditors from Schedule D → intention (surrender / redeem /
   reaffirm / retain-explain) + claimed-exempt-on-C toggle.
   Part 2: personal-property leases from Schedule G → assume / do-not-assume
   (real-estate leases excluded).

   CONTROLLED — derives the item lists from the schedules each render; the
   client's choices persist to data.statementOfIntention:
     data.statementOfIntention = {
       secured: { <id>: { intent, explain, exemptC } },
       leases:  { <id>: { assume } },
     }

   <StatementOfIntention
     data={questionnaireData}
     onChange={(soi) => updateSection("statementOfIntention", soi)}
     confirmed={summaryConfirmed}
     onConfirm={onSummaryConfirm}
   />

   ── VERIFY (two field references, written best-effort) ──────────────────
   • deriveSecured(): the COLLATERAL / property-description field on
     data.schedD.creditors[] (fallback chain below — confirm the real key).
   • deriveLeases(): how data.schedG.contracts[] marks a PERSONAL-property
     lease vs a real-estate one. The exclusion filter is crude text-matching;
     if the schedule has a real/personal indicator field, use it instead.
   ──────────────────────────────────────────────────────────────────────── */

const INTENTS = [
  { k: "surrender", label: "Surrender the property" },
  { k: "redeem", label: "Retain and redeem it" },
  { k: "reaffirm", label: "Retain and reaffirm (Reaffirmation Agreement)" },
  { k: "retain", label: "Retain and [explain]" },
];
const lbl = (k) => INTENTS.find((x) => x.k === k)?.label;

function deriveSecured(data) {
  return (data.schedD?.creditors || []).map((c, i) => ({
    id: `D${i}`,
    creditor: c.name || "(creditor)",
    property: c.collateral || c.propertyDescription || c.collateralDescription || c.property || c.securing || "(collateral — see Schedule D)",
  })).filter((r) => r.creditor !== "(creditor)");
}

function deriveLeases(data) {
  // schedG.contracts[].contractType is a dropdown: "Residential Lease" = real estate (exclude);
  // "Vehicle Lease", "Equipment / Furniture Lease", etc. = personal property (include).
  // For entries with no contractType, fall back to regex exclusion.
  return (data.schedG?.contracts || []).map((c, i) => {
    const ct = (c.contractType || "").trim();
    const desc = (c.description || "").trim();
    const property = ct ? (desc ? `${ct} — ${desc}` : ct) : (desc || "(see Schedule G)");
    return { id: `G${i}`, lessor: c.name || "(lessor)", property, contractType: ct };
  }).filter((r) => {
    if (r.lessor === "(lessor)") return false;
    if (r.contractType === "Residential Lease") return false;
    if (!r.contractType) return !/real\s*estate|real\s*propert|\bland\b|building|residence|\bhome\b|premises/i.test(r.property);
    return true;
  });
}

export default function StatementOfIntention({ data = {}, onChange, confirmed, onConfirm }) {
  const chapter = String(data.petition?.chapter || "7");
  const isCh7 = chapter === "7";

  const secured = useMemo(() => deriveSecured(data), [data]);
  const leases = useMemo(() => deriveLeases(data), [data]);
  const saved = data.statementOfIntention || {};
  const [ov, setOv] = useState({ secured: saved.secured || {}, leases: saved.leases || {} });

  const patch = (next) => { setOv(next); onChange && onChange({ ...saved, secured: next.secured, leases: next.leases }); };
  const secOf = (id) => ov.secured[id] || {};
  const leaseOf = (id) => ov.leases[id] || {};
  const setIntent = (id, k) => patch({ ...ov, secured: { ...ov.secured, [id]: { ...ov.secured[id], intent: k } } });
  const setExplain = (id, v) => patch({ ...ov, secured: { ...ov.secured, [id]: { ...ov.secured[id], explain: v } } });
  const setExempt = (id, v) => patch({ ...ov, secured: { ...ov.secured, [id]: { ...ov.secured[id], exemptC: v } } });
  const setAssume = (id, v) => patch({ ...ov, leases: { ...ov.leases, [id]: { assume: v } } });

  if (!isCh7) {
    return (
      <div className="soi">
        <Style />
        <h1><ClipboardCheck size={21} style={{ verticalAlign: -3, marginRight: 8 }} />Statement of Intention</h1>
        <div className="form">Official Form 108 · Chapter 7 only</div>
        <div className="na"><Info size={14} style={{ flexShrink: 0, marginTop: 1 }} /> The Statement of Intention (Form 108) is required only in Chapter 7. Your case is Chapter {chapter}, so this step doesn't apply — your treatment of secured debts and leases is handled through the plan. Confirm to continue.</div>
        <ConfirmFooter confirmed={confirmed} onConfirm={onConfirm} sectionLabel="this step (not applicable)" />
      </div>
    );
  }

  const allChosen = secured.every((r) => secOf(r.id).intent);

  return (
    <div className="soi">
      <Style />
      <h1><ClipboardCheck size={21} style={{ verticalAlign: -3, marginRight: 8 }} />Statement of Intention</h1>
      <div className="form">Official Form 108 · Chapter 7 · file within 30 days of the petition or by the 341 meeting, whichever is earlier</div>
      <div className="rule"><Info size={12} style={{ verticalAlign: -1 }} /> Pulled from Schedule D (secured creditors) and Schedule G (personal-property leases). Confirm the intention for each. Copies must be sent to the listed creditors and lessors.</div>

      {/* Part 1 — secured */}
      <div className="card">
        <div className="ph">Part 1 · Creditors with secured claims (from Schedule D)</div>
        {secured.map((r) => {
          const s = secOf(r.id);
          return (
            <div className="row" key={r.id}>
              <div className="rtop">
                <div className="rinfo"><span className="cred">{r.creditor}</span><span className="prop">{r.property}</span></div>
                <button type="button" className={"exempt " + (s.exemptC ? "on" : "")} onClick={() => setExempt(r.id, !s.exemptC)}>
                  {s.exemptC ? <CheckCircle2 size={12} /> : <Circle size={12} />} Claimed exempt on Schedule C
                </button>
              </div>
              <div className="intents">
                {INTENTS.map((it) => (
                  <button type="button" key={it.k} className={"intent " + (s.intent === it.k ? "on" : "")} onClick={() => setIntent(r.id, it.k)}>
                    {s.intent === it.k ? <CheckCircle2 size={12} /> : <Circle size={12} />} {it.label}
                  </button>
                ))}
              </div>
              {s.intent === "retain" && (
                <input className="explain" placeholder="Explain (e.g., maintain regular payments / pay outside the plan)…" value={s.explain || ""} onChange={(e) => setExplain(r.id, e.target.value)} />
              )}
            </div>
          );
        })}
        {secured.length === 0 && <div className="empty">No secured creditors on Schedule D.</div>}
      </div>

      {/* Part 2 — leases */}
      <div className="card">
        <div className="ph">Part 2 · Unexpired personal-property leases (from Schedule G)</div>
        <div className="micro"><Info size={11} style={{ verticalAlign: -1 }} /> Personal-property leases only — real-estate leases are not listed here.</div>
        {leases.map((r) => {
          const s = leaseOf(r.id);
          return (
            <div className="row" key={r.id}>
              <div className="rtop">
                <div className="rinfo"><span className="cred">{r.lessor}</span><span className="prop">{r.property}</span></div>
                <div className="yn">
                  <button type="button" className={s.assume === true ? "on" : ""} onClick={() => setAssume(r.id, true)}>Assume lease</button>
                  <button type="button" className={s.assume === false ? "on" : ""} onClick={() => setAssume(r.id, false)}>Do not assume</button>
                </div>
              </div>
            </div>
          );
        })}
        {leases.length === 0 && <div className="empty">No personal-property leases on Schedule G.</div>}
      </div>

      {/* Summary */}
      <div className="summary">
        <div className="sum-h"><ClipboardCheck size={16} /> Summary of intentions</div>
        <div className="sum-group">Secured property</div>
        {secured.length === 0 ? <div className="sum-row"><span className="sum-q">Secured property</span><span className="sum-a no">None</span></div>
          : secured.map((r) => {
            const s = secOf(r.id);
            return (
              <div className="sum-row" key={r.id}>
                <span className="sum-q">{r.creditor} — {r.property}</span>
                <span className={"sum-a " + (s.intent ? "yes" : "")}>{s.intent ? lbl(s.intent) : <em>—</em>}{s.intent === "retain" && s.explain ? `: ${s.explain}` : ""}{s.exemptC ? " · exempt (C)" : ""}</span>
              </div>
            );
          })}
        <div className="sum-group">Personal-property leases</div>
        {leases.length === 0 ? <div className="sum-row"><span className="sum-q">Leases</span><span className="sum-a no">None</span></div>
          : leases.map((r) => {
            const s = leaseOf(r.id);
            return <div className="sum-row" key={r.id}><span className="sum-q">{r.lessor} — {r.property}</span><span className={"sum-a " + (s.assume ? "yes" : "no")}>{s.assume === true ? "Assume" : s.assume === false ? "Do not assume" : <em>—</em>}</span></div>;
          })}

        {!allChosen && secured.length > 0 && (
          <div className="warn"><AlertCircle size={14} /> Select an intention for each secured creditor before your attorney files this form.</div>
        )}
        <div className="sign">Under penalty of perjury, the debtor(s) declare the intentions stated above. In a joint case both debtors sign and date. Your attorney reviews this before filing.</div>
      </div>

      <ConfirmFooter
        confirmed={confirmed}
        onConfirm={onConfirm}
        sectionLabel="Statement of Intention"
      />
    </div>
  );
}

function Style() {
  return <style>{`
    .soi * { box-sizing:border-box; }
    .soi {
      --accent:#fbbf24; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8; --good:#4ade80; --good-bg:rgba(74,222,128,.12);
      --warn:#fcd34d; --warn-bg:rgba(251,191,36,.10);
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:860px; margin:16px auto 0; }
    .soi h1 { font-family:var(--serif); font-weight:600; font-size:24px; margin:0; color:#fff; }
    .soi .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .soi .na { display:flex; gap:9px; align-items:flex-start; font-size:13.5px; color:var(--ink); background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:14px 16px; margin-top:16px; line-height:1.5; }
    .soi .rule { font-size:12.5px; color:var(--muted); background:var(--bg-2); border:1px solid var(--line); border-radius:9px; padding:10px 13px; margin-top:12px; line-height:1.5; }
    .soi .card { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:6px 18px 10px; margin-top:14px; }
    .soi .ph { font-family:var(--serif); font-size:13px; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:.04em; padding:12px 0 8px; border-bottom:1px solid var(--line); }
    .soi .micro { font-size:12px; color:var(--muted); margin-top:8px; }
    .soi .row { padding:13px 0; border-bottom:1px solid var(--line-soft); } .soi .row:last-child { border-bottom:none; }
    .soi .rtop { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap; }
    .soi .cred { font-weight:600; font-size:14px; display:block; color:#fff; } .soi .prop { font-size:12.5px; color:var(--muted); display:block; margin-top:1px; }
    .soi .exempt { border:1px solid var(--line); background:var(--bg-2); border-radius:8px; padding:5px 10px; font:inherit; font-weight:600; font-size:11.5px; cursor:pointer; color:var(--muted); display:inline-flex; gap:5px; align-items:center; white-space:nowrap; }
    .soi .exempt.on { background:var(--good-bg); color:var(--good); border-color:var(--good); }
    .soi .intents { display:flex; gap:6px; flex-wrap:wrap; margin-top:10px; }
    .soi .intent { border:1px solid var(--line); background:var(--bg-2); border-radius:8px; padding:6px 11px; font:inherit; font-weight:600; font-size:12px; cursor:pointer; color:var(--muted); display:inline-flex; gap:5px; align-items:center; }
    .soi .intent.on { background:var(--accent); color:#1c1407; border-color:var(--accent); }
    .soi .explain { width:100%; margin-top:9px; border:1px solid var(--line); border-radius:8px; padding:9px 11px; font:inherit; font-size:13px; background:var(--bg-2); color:var(--ink); }
    .soi .yn { display:inline-flex; gap:6px; flex:none; }
    .soi .yn button { border:1px solid var(--line); background:var(--bg-2); border-radius:8px; padding:6px 14px; font:inherit; font-weight:600; font-size:12px; cursor:pointer; color:var(--muted); }
    .soi .yn button.on { background:var(--accent); color:#1c1407; border-color:var(--accent); }
    .soi .empty { font-size:13px; color:var(--muted); padding:12px 0; }
    .soi .summary { background:var(--bg); border:1px solid var(--accent); border-radius:12px; padding:16px 18px; margin-top:16px; }
    .soi .sum-h { font-family:var(--serif); font-weight:600; font-size:16px; display:flex; gap:8px; align-items:center; margin-bottom:8px; color:#fff; }
    .soi .sum-group { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--accent); margin:12px 0 4px; border-bottom:1px solid var(--line); padding-bottom:4px; }
    .soi .sum-row { display:grid; grid-template-columns:1.2fr 1fr; gap:8px 14px; font-size:13px; padding:8px 0; border-bottom:1px solid var(--line-soft); }
    .soi .sum-q { font-weight:600; color:var(--ink); } .soi .sum-a { text-align:right; font-weight:600; color:var(--muted); } .soi .sum-a.yes { color:var(--good); } .soi .sum-a.no { color:var(--muted); } .soi .sum-a em { color:var(--muted); font-style:normal; }
    .soi .warn { display:flex; gap:8px; align-items:center; font-size:12.5px; font-weight:600; color:var(--warn); background:var(--warn-bg); border-radius:8px; padding:10px 12px; margin-top:12px; }
    .soi .sign { font-size:12.5px; color:var(--ink); background:var(--bg-2); border:1px solid var(--line); border-radius:8px; padding:11px 13px; margin-top:12px; line-height:1.5; }
  `}</style>;
}
