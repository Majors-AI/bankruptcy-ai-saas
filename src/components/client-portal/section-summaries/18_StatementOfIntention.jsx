import React, { useMemo } from "react";
import { ClipboardCheck, Info, Lock, AlertCircle } from "lucide-react";
import ConfirmFooter from "./ConfirmFooter";

/* Statement of Intention — Official Form 108 (Chapter 7 only).
   Part 1: secured creditors from Schedule D → intention (surrender / redeem /
   reaffirm / retain-explain) + claimed-exempt-on-C marker.
   Part 2: personal-property leases from Schedule G → assume / do-not-assume
   (real-estate leases excluded).

   READ-ONLY PREVIEW for the client. The intent for each secured creditor
   is captured upstream on Schedule D itself (each creditor row carries an
   `intent` field — retain / reaffirm / redeem / surrender / other — set
   when the client added the creditor). This component renders that
   captured intent as a preview of what the attorney will sign and file;
   the client cannot change intents here. If an intent hasn't been set
   yet, the row shows "Pending — your attorney will set this" so it's
   obvious what's still open.

   <StatementOfIntention
     data={questionnaireData}
     onChange={() => {}}                // unused in read-only mode
     confirmed={summaryConfirmed}
     onConfirm={onSummaryConfirm}
   /> */

const INTENT_LABELS = {
  surrender: "Surrender the property",
  redeem:    "Retain and redeem it",
  reaffirm:  "Retain and reaffirm (Reaffirmation Agreement)",
  retain:    "Retain and [explain]",
  // Schedule D's "other" maps to Form 108's "retain — explain" bucket.
  other:     "Retain — see explanation",
};

function deriveSecured(data) {
  return (data.schedD?.creditors || []).map((c, i) => ({
    id: `D${i}`,
    creditor: c.name || "(creditor)",
    property: c.collateral || c.propertyDescription || c.collateralDescription || c.property || c.securing || "(collateral — see Schedule D)",
    // The Ch.7 intent captured on Schedule D itself (INTENT_OPTIONS in
    // CreditorList: retain | reaffirm | redeem | surrender | other).
    intent: (c.intent || "").trim(),
    explain: (c.intentNote || c.intentExplain || c.consideration || "").trim(),
    // Exempt-on-Schedule-C is set by the attorney upstream when the
    // collateral falls under a Schedule C exemption claim. Today we render
    // whatever's on the row; the client can't toggle it here.
    exemptC: !!(c._exemptC ?? c.exemptC),
  })).filter((r) => r.creditor !== "(creditor)");
}

function deriveLeases(data) {
  // schedG.contracts[].contractType: "Residential Lease" → real estate
  // (excluded); "Vehicle Lease" / "Equipment / Furniture Lease" / etc. →
  // personal property (included). Falls back to regex exclusion when type
  // is blank. Assume/do-not-assume is read off c.assume / c.intent.
  return (data.schedG?.contracts || []).map((c, i) => {
    const ct = (c.contractType || "").trim();
    const desc = (c.description || "").trim();
    const property = ct ? (desc ? `${ct} — ${desc}` : ct) : (desc || "(see Schedule G)");
    // Assume / do-not-assume: prefer c.assume boolean, then string-form intent.
    let assume = null;
    if (typeof c.assume === "boolean") assume = c.assume;
    else if (c.intent === "assume") assume = true;
    else if (c.intent === "reject" || c.intent === "do_not_assume") assume = false;
    return { id: `G${i}`, lessor: c.name || "(lessor)", property, contractType: ct, assume };
  }).filter((r) => {
    if (r.lessor === "(lessor)") return false;
    if (r.contractType === "Residential Lease") return false;
    if (!r.contractType) return !/real\s*estate|real\s*propert|\bland\b|building|residence|\bhome\b|premises/i.test(r.property);
    return true;
  });
}

export default function StatementOfIntention({ data = {}, confirmed, onConfirm }) {
  const chapter = String(data.petition?.chapter || "7");
  const isCh7 = chapter === "7";

  const secured = useMemo(() => deriveSecured(data), [data]);
  const leases = useMemo(() => deriveLeases(data), [data]);
  const allIntentsSet = secured.every((r) => r.intent);
  const allLeasesSet = leases.every((r) => r.assume != null);

  if (!isCh7) {
    return (
      <div className="soi">
        <Style />
        <h1><ClipboardCheck size={21} style={{ verticalAlign: -3, marginRight: 8 }} />Statement of Intention</h1>
        <div className="form">Official Form 108 · Chapter 7 only</div>
        <div className="na">
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          The Statement of Intention (Form 108) is required only in Chapter 7. Your case is
          Chapter {chapter}, so this step doesn't apply — your treatment of secured debts
          and leases is handled through your Chapter 13 plan. Confirm to continue.
        </div>
        <ConfirmFooter confirmed={confirmed} onConfirm={onConfirm} sectionLabel="this step (not applicable)" />
      </div>
    );
  }

  return (
    <div className="soi">
      <Style />
      <h1><ClipboardCheck size={21} style={{ verticalAlign: -3, marginRight: 8 }} />Statement of Intention</h1>
      <div className="form">Official Form 108 · Chapter 7 · file within 30 days of the petition or by the 341 meeting, whichever is earlier</div>

      {/* Plain-English explanation card */}
      <div className="explain">
        <div className="explain-h"><Info size={13} style={{ verticalAlign: -2, marginRight: 6 }} />What you're looking at</div>
        <p>
          This is a <b>preview</b> of your <b>Statement of Intention</b> (Form 108) — the
          court filing that tells your secured creditors and lease counterparties what you
          plan to do with each collateralized item. It's filed within 30 days of your
          petition, and copies are sent to every listed creditor and lessor.
        </p>
        <p>
          Each line below is auto-filled from what you already told us when you entered
          your secured creditors on Schedule D and your leases on Schedule G.{" "}
          <b>You cannot edit this form</b>. If anything looks wrong, go back to Schedule D
          or G to fix the underlying entry, or contact your attorney.
        </p>
      </div>

      {/* Part 1 — secured */}
      <div className="card readonly">
        <div className="ph">Part 1 · Creditors with secured claims (from Schedule D)</div>
        {secured.map((r) => {
          const label = r.intent ? INTENT_LABELS[r.intent] || r.intent : null;
          return (
            <div className="row" key={r.id}>
              <div className="rtop">
                <div className="rinfo">
                  <span className="cred">{r.creditor}</span>
                  <span className="prop">{r.property}</span>
                </div>
                {r.exemptC && (
                  <span className="exempt on">
                    <Lock size={10} /> Claimed exempt on Schedule C
                  </span>
                )}
              </div>
              <div className="ro-intent">
                {label ? (
                  <>
                    <span className="ro-intent-pill">{label}</span>
                    {(r.intent === "retain" || r.intent === "other") && r.explain && (
                      <span className="ro-explain">— {r.explain}</span>
                    )}
                  </>
                ) : (
                  <span className="ro-pending">
                    <AlertCircle size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                    Pending — your attorney will set this before filing
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {secured.length === 0 && <div className="empty">No secured creditors on Schedule D.</div>}
      </div>

      {/* Part 2 — leases */}
      <div className="card readonly">
        <div className="ph">Part 2 · Unexpired personal-property leases (from Schedule G)</div>
        <div className="micro"><Info size={11} style={{ verticalAlign: -1 }} /> Personal-property leases only — real-estate leases are not listed here.</div>
        {leases.map((r) => (
          <div className="row" key={r.id}>
            <div className="rtop">
              <div className="rinfo">
                <span className="cred">{r.lessor}</span>
                <span className="prop">{r.property}</span>
              </div>
              <div className="ro-intent">
                {r.assume === true && <span className="ro-intent-pill">Assume lease</span>}
                {r.assume === false && <span className="ro-intent-pill">Do not assume</span>}
                {r.assume == null && (
                  <span className="ro-pending">
                    <AlertCircle size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                    Pending — your attorney will set this before filing
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {leases.length === 0 && <div className="empty">No personal-property leases on Schedule G.</div>}
      </div>

      {/* Summary */}
      <div className="summary">
        <div className="sum-h"><ClipboardCheck size={16} /> Summary of intentions</div>
        <div className="sum-group">Secured property</div>
        {secured.length === 0
          ? <div className="sum-row"><span className="sum-q">Secured property</span><span className="sum-a no">None</span></div>
          : secured.map((r) => {
              const label = r.intent ? (INTENT_LABELS[r.intent] || r.intent) : null;
              return (
                <div className="sum-row" key={r.id}>
                  <span className="sum-q">{r.creditor} — {r.property}</span>
                  <span className={"sum-a " + (label ? "yes" : "")}>
                    {label || <em>pending</em>}
                    {(r.intent === "retain" || r.intent === "other") && r.explain ? `: ${r.explain}` : ""}
                    {r.exemptC ? " · exempt (C)" : ""}
                  </span>
                </div>
              );
            })}
        <div className="sum-group">Personal-property leases</div>
        {leases.length === 0
          ? <div className="sum-row"><span className="sum-q">Leases</span><span className="sum-a no">None</span></div>
          : leases.map((r) => (
              <div className="sum-row" key={r.id}>
                <span className="sum-q">{r.lessor} — {r.property}</span>
                <span className={"sum-a " + (r.assume != null ? "yes" : "no")}>
                  {r.assume === true ? "Assume" : r.assume === false ? "Do not assume" : <em>pending</em>}
                </span>
              </div>
            ))}

        {(!allIntentsSet && secured.length > 0) || (!allLeasesSet && leases.length > 0) ? (
          <div className="warn">
            <AlertCircle size={14} />
            One or more items still show <b>Pending</b> — your attorney will resolve them
            before this form is filed. You don't need to do anything here.
          </div>
        ) : null}
        <div className="sign">
          Under penalty of perjury, the debtor(s) declare the intentions stated above.
          In a joint case both debtors sign and date. Your attorney reviews and files this
          on your behalf.
        </div>
      </div>

      <ConfirmFooter
        confirmed={confirmed}
        onConfirm={onConfirm}
        sectionLabel="this Statement of Intention preview (review only — your attorney files it)"
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
    .soi .explain { background:rgba(59,130,246,.06); border:1px solid rgba(59,130,246,.30); border-radius:10px; padding:13px 16px; margin-top:14px; font-size:12.5px; line-height:1.55; color:var(--ink); }
    .soi .explain p { margin:0 0 8px; } .soi .explain p:last-child { margin-bottom:0; }
    .soi .explain b { color:#fff; }
    .soi .explain-h { font-family:var(--serif); font-weight:600; font-size:13px; color:#93c5fd; text-transform:uppercase; letter-spacing:.04em; margin-bottom:7px; }
    .soi .na { display:flex; gap:9px; align-items:flex-start; font-size:13.5px; color:var(--ink); background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:14px 16px; margin-top:16px; line-height:1.5; }
    .soi .card { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:6px 18px 10px; margin-top:14px; }
    .soi .card.readonly { background:rgba(15,23,42,.55); }
    .soi .ph { font-family:var(--serif); font-size:13px; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:.04em; padding:12px 0 8px; border-bottom:1px solid var(--line); }
    .soi .micro { font-size:12px; color:var(--muted); margin-top:8px; }
    .soi .row { padding:13px 0; border-bottom:1px solid var(--line-soft); } .soi .row:last-child { border-bottom:none; }
    .soi .rtop { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap; }
    .soi .cred { font-weight:600; font-size:14px; display:block; color:#fff; } .soi .prop { font-size:12.5px; color:var(--muted); display:block; margin-top:1px; }
    .soi .exempt { border:1px solid var(--line); background:var(--bg-2); border-radius:8px; padding:5px 10px; font:inherit; font-weight:600; font-size:11.5px; color:var(--muted); display:inline-flex; gap:5px; align-items:center; white-space:nowrap; }
    .soi .exempt.on { background:var(--good-bg); color:var(--good); border-color:var(--good); }
    .soi .ro-intent { margin-top:10px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .soi .ro-intent-pill { background:rgba(251,191,36,.12); border:1px solid rgba(251,191,36,.40); color:var(--accent); border-radius:8px; padding:6px 11px; font-size:12px; font-weight:600; display:inline-block; }
    .soi .ro-explain { font-size:12px; color:var(--muted); font-style:italic; }
    .soi .ro-pending { color:var(--warn); background:var(--warn-bg); border:1px dashed rgba(252,211,77,.40); border-radius:8px; padding:6px 11px; font-size:12px; font-weight:600; display:inline-flex; align-items:center; }
    .soi .empty { font-size:13px; color:var(--muted); padding:12px 0; }
    .soi .summary { background:var(--bg); border:1px solid var(--accent); border-radius:12px; padding:16px 18px; margin-top:16px; }
    .soi .sum-h { font-family:var(--serif); font-weight:600; font-size:16px; display:flex; gap:8px; align-items:center; margin-bottom:8px; color:#fff; }
    .soi .sum-group { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--accent); margin:12px 0 4px; border-bottom:1px solid var(--line); padding-bottom:4px; }
    .soi .sum-row { display:grid; grid-template-columns:1.2fr 1fr; gap:8px 14px; font-size:13px; padding:8px 0; border-bottom:1px solid var(--line-soft); }
    .soi .sum-q { font-weight:600; color:var(--ink); } .soi .sum-a { text-align:right; font-weight:600; color:var(--muted); } .soi .sum-a.yes { color:var(--good); } .soi .sum-a.no { color:var(--muted); } .soi .sum-a em { color:var(--muted); font-style:italic; }
    .soi .warn { display:flex; gap:8px; align-items:flex-start; font-size:12.5px; color:var(--warn); background:var(--warn-bg); border-radius:8px; padding:10px 12px; margin-top:12px; line-height:1.5; }
    .soi .warn b { color:#fef3c7; }
    .soi .sign { font-size:12.5px; color:var(--ink); background:var(--bg-2); border:1px solid var(--line); border-radius:8px; padding:11px 13px; margin-top:12px; line-height:1.5; }
  `}</style>;
}
