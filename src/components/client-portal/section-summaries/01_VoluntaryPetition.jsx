import React, { useState } from "react";
import { FileText, AlertCircle } from "lucide-react";

/* Voluntary Petition — Official Form 101 — answer-summary review.
   Restyled to the bankruptcy.ai dark theme.

   ── INTEGRATION CONTRACT ──────────────────────────────────────────────
   This component is PROP-DRIVEN. Pass the client's real petition answers
   via the `data` prop (and optionally a starting `chapter`).

   The EXAMPLE_DATA object below is SAMPLE ONLY for standalone preview and
   MUST NOT ship to a client. During merge, wire `data` from the
   questionnaire state / Supabase. Shape is documented on EXAMPLE_DATA.

   <VoluntaryPetitionReview data={petitionAnswers} chapter="7" />
   ─────────────────────────────────────────────────────────────────────── */

const money = (n) => "$" + Number(n || 0).toLocaleString();

const creditorBracket = (n) => {
  const b = [[49, "1-49"], [99, "50-99"], [199, "100-199"], [999, "200-999"], [5000, "1,000-5,000"]];
  for (const [m, l] of b) if (n <= m) return l;
  return "More than 5,000";
};
const dollarBracket = (n) => {
  const b = [[50000, "$0-$50,000"], [100000, "$50,001-$100,000"], [500000, "$100,001-$500,000"],
  [1000000, "$500,001-$1 million"], [10000000, "$1,000,001-$10 million"], [50000000, "$10,000,001-$50 million"]];
  for (const [m, l] of b) if (n <= m) return l;
  return "More than $50 million";
};

/* EXAMPLE ONLY — do not ship. Replace by passing the real `data` prop.
   This documents the expected shape. */
const EXAMPLE_DATA = {
  debtor1: "Example Debtor Name",
  otherNames: [],                  // string[]
  ssnLast4: "xxx-xx-XXXX",
  ein: null,                       // string | null
  residence: "123 Example St, City, ST 00000",
  county: "Example County",
  mailingSame: true,               // boolean
  district: "Example District",
  venue180: true,                  // boolean
  feeMethod: "Pay in full at filing",
  priorBankruptcy8yr: null,        // string | null  (MAJ-117) — null => pending
  otherPendingCases: false,        // boolean
  rentsResidence: false,           // boolean
  soleProprietor: false,           // boolean
  hazardousProperty: false,        // boolean
  creditCounseling: null,          // string | null  — null => not on file
  natureOfDebts: "Consumer",       // "Consumer" | "Business"
  ch7FundsAvailable: null,         // string | null  — attorney determination
  creditorCount: 0,                // number
  assetsTotal: 0,                  // number
  liabilitiesTotal: 0,             // number
  signed: false,                   // boolean
};

export default function VoluntaryPetitionReview({
  data = EXAMPLE_DATA,
  chapter: chapterProp,
  confirmed,
  onConfirm,
  communityConfirmed,
  onCommunityConfirm,
}) {
  const [chapter, setChapter] = useState(chapterProp || "7");
  const [communityWarning, setCommunityWarning] = useState(false);
  const d = data;
  const showConfirm = typeof onConfirm === "function";
  const showCommunity = typeof onCommunityConfirm === "function";

  return (
    <div className="vp">
      <Style />
      <div className="head">
        <div>
          <h1><FileText size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Voluntary Petition</h1>
          <div className="form">Official Form 101 · {d.debtor1}</div>
        </div>
        <div className="toggle">
          {["7", "13"].map((c) => (
            <button key={c} className={chapter === c ? "on" : ""} onClick={() => setChapter(c)}>Ch. {c}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="ph">Part 1 · Identify yourself</div>
        <Row k="Debtor 1 — full legal name" v={d.debtor1} />
        <Row k="Other names (last 8 yrs)" v={d.otherNames?.length ? d.otherNames.join(", ") : "None"} />
        <Row k="SSN — last 4" v={d.ssnLast4} />
        <Row k="EIN" v={d.ein || "None"} />
        <Row k="Residence" v={d.residence} />
        <Row k="County" v={d.county} />
        <Row k="Mailing address" v={d.mailingSame ? "Same as residence" : "—"} />
        <Row k="District chosen" v={d.district} />
        <Row k="Venue basis" v={d.venue180 ? "Lived here longest in last 180 days" : "Other"} />

        <div className="ph">Part 2 · Tell the court about your case</div>
        <Row k="Chapter" v={`Chapter ${chapter}`} />
        <Row k="How the fee will be paid" v={d.feeMethod} />
        <Row k="Filed bankruptcy in last 8 years?" v={d.priorBankruptcy8yr} pending />
        <Row k="Other pending cases (spouse/partner/affiliate)?" v={d.otherPendingCases} bool />
        <Row k="Rents residence?" v={d.rentsResidence} bool />

        <div className="ph">Part 3 · Sole-proprietor business</div>
        <Row k="Sole proprietor of a business?" v={d.soleProprietor} bool />

        <div className="ph">Part 4 · Hazardous property</div>
        <Row k="Owns hazardous / urgent-attention property?" v={d.hazardousProperty} bool />

        <div className="ph">Part 5 · Credit counseling briefing (§109(h))</div>
        <Row k="Pre-filing briefing" v={d.creditCounseling} pending pendingText="Not yet completed — certificate not on file" />

        <div className="ph">Part 6 · Reporting questions</div>
        <Row k="Nature of debts" v={d.natureOfDebts} />
        {chapter === "7"
          ? <Row k="Line 17 — funds available to unsecured?" v={d.ch7FundsAvailable} pending pendingText="Attorney determination pending" />
          : <div className="note"><b>Line 17 (funds available)</b> is a Chapter 7 question — N/A on Form 101 for Chapter 13. Surface the plan's projected dividend instead.</div>}
        <Row k="Estimated number of creditors" v={`${creditorBracket(d.creditorCount)}  (${d.creditorCount} entered)`} calc />
        <Row k="Estimated assets" v={dollarBracket(d.assetsTotal)} calc />
        <Row k="Estimated liabilities" v={dollarBracket(d.liabilitiesTotal)} calc />
        <div className="note">Brackets are auto-suggested from entered data; they lock into the petition only after the attorney confirms at Signing Review.</div>

        <div className="ph">Part 7 · Signature</div>
        <Row k="Debtor signature" v={d.signed ? "Signed" : null} pending pendingText="Pending at signing review" />
      </div>

      {(showConfirm || showCommunity) && (
        <div className="confirm-footer">
          <div className="confirm-footer-hd">
            <p className="confirm-footer-title">Section Summary — Please Review</p>
            <p className="confirm-footer-sub">Review the petition summary above before continuing. If anything looks wrong, scroll up and correct it.</p>
          </div>
          <div className="confirm-footer-body">
            {showConfirm && (
              <ConfirmRow id="vpr_summary_confirm" checked={!!confirmed} onChange={onConfirm}>
                I have reviewed the summary above and confirm that all information is{" "}
                <strong className="confirm-strong">true, accurate, and complete</strong> to the best of my
                knowledge. I understand that the information provided will be used to prepare my official
                bankruptcy documents filed with the federal court.
              </ConfirmRow>
            )}
            {showCommunity && (
              <>
                <ConfirmRow
                  id="vpr_community_confirm"
                  checked={!!communityConfirmed}
                  onChange={(v) => {
                    setCommunityWarning(!v);
                    onCommunityConfirm(v);
                  }}
                >
                  I confirm that the petition and filing details listed above includes{" "}
                  <strong className="confirm-strong">all community property</strong> — all community
                  income, assets, and debts belonging to me and my non-filing spouse — and that nothing
                  has been omitted.
                </ConfirmRow>
                {communityWarning && !communityConfirmed && (
                  <div className="community-warn">
                    <svg className="community-warn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                    <div>
                      <p className="community-warn-title">Missing Community Property?</p>
                      <p>If any community income, assets, or debts are missing, please{" "}
                        <strong className="confirm-strong">scroll up and re-enter the missing information</strong>{" "}
                        before confirming. Filing incomplete information can affect your case or result in legal consequences.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmRow({ id, checked, onChange, children }) {
  return (
    <label htmlFor={id} className={`confirm-row ${checked ? "confirm-row-checked" : "confirm-row-unchecked"}`}>
      <div
        className={`confirm-box ${checked ? "confirm-box-checked" : "confirm-box-unchecked"}`}
        onClick={() => onChange(!checked)}
      >
        {checked && <svg className="confirm-check-svg" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5 1 6.5l4 4 6-6.5z"/></svg>}
      </div>
      <div className="confirm-text">{children}</div>
    </label>
  );
}

function Row({ k, v, bool, pending, pendingText, calc }) {
  let disp;
  if (pending && (v === null || v === undefined)) disp = <span className="flag"><AlertCircle size={13} /> {pendingText || "Not answered"}</span>;
  else if (bool) disp = v ? <span className="yes">Yes</span> : <span className="no">No</span>;
  else disp = v;
  return <div className="kv"><span className="k">{k}</span><span className="v">{disp}{calc && <span className="calc">auto-calc</span>}</span></div>;
}

function Style() {
  return <style>{`
    .vp * { box-sizing:border-box; }
    .vp {
      --accent:#fbbf24;        /* amber-400 */
      --bg:#0d1221;            /* app card navy */
      --bg-2:#111827;          /* slightly lighter panel */
      --line:#1e293b;          /* slate-800 */
      --line-soft:#162132;     /* row divider */
      --ink:#e2e8f0;           /* slate-200 */
      --muted:#94a3b8;         /* slate-400 */
      --good:#4ade80;          /* green-400 */
      --warn:#fcd34d;          /* amber-300 */
      --warn-bg:rgba(251,191,36,.10);
      --calc:#7dd3fc;          /* sky-300 */
      --calc-bg:rgba(56,189,248,.12);
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:840px; margin:0 auto;
    }
    .vp .head { display:flex; justify-content:space-between; align-items:flex-end; gap:12px; }
    .vp h1 { font-family:var(--serif); font-weight:600; font-size:24px; margin:0; color:#fff; }
    .vp .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .vp .toggle { display:inline-flex; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    .vp .toggle button { border:none; background:var(--bg-2); padding:7px 14px; font:inherit; font-weight:600; font-size:13px; cursor:pointer; color:var(--muted); }
    .vp .toggle button.on { background:var(--accent); color:#1c1407; }
    .vp .card { background:var(--bg); border:1px solid var(--line); border-radius:16px; padding:18px 20px; margin-top:16px; }
    .vp .ph { font-family:var(--serif); font-size:13px; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:.04em; margin:16px 0 6px; }
    .vp .ph:first-child { margin-top:0; }
    .vp .kv { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:14px; padding:6px 0; border-bottom:1px solid var(--line-soft); align-items:baseline; }
    .vp .kv .k { color:var(--muted); } .vp .kv .v { font-weight:600; text-align:right; }
    .vp .calc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--calc-bg); color:var(--calc); padding:1px 6px; border-radius:6px; margin-left:6px; }
    .vp .flag { color:var(--warn); font-weight:600; display:inline-flex; gap:5px; align-items:center; }
    .vp .yes { color:var(--good); } .vp .no { color:var(--ink); }
    .vp .note { font-size:12.5px; color:var(--muted); background:var(--bg-2); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:10px 0 2px; }
    .vp .note b { color:var(--ink); }
    .vp .confirm-footer { margin-top:24px; border:1px solid var(--line); border-radius:16px; overflow:hidden; }
    .vp .confirm-footer-hd { background:var(--bg-2); padding:12px 20px; border-bottom:1px solid var(--line); }
    .vp .confirm-footer-title { margin:0; font-family:var(--serif); font-weight:700; font-size:14px; color:#fff; }
    .vp .confirm-footer-sub { margin:2px 0 0; color:var(--muted); font-size:12px; }
    .vp .confirm-footer-body { background:#030712; padding:16px 20px; display:flex; flex-direction:column; gap:10px; }
    .vp .confirm-row { display:flex; align-items:flex-start; gap:12px; padding:12px; border-radius:12px; border:1px solid var(--line); cursor:pointer; transition:border-color .15s,background .15s; }
    .vp .confirm-row-checked { border-color:rgba(34,197,94,.40); background:rgba(74,222,128,.05); }
    .vp .confirm-row-unchecked:hover { border-color:#334155; }
    .vp .confirm-box { width:20px; height:20px; border-radius:4px; border:2px solid #475569; flex-shrink:0; margin-top:2px; display:flex; align-items:center; justify-content:center; transition:all .15s; }
    .vp .confirm-box-checked { border-color:var(--accent); background:var(--accent); }
    .vp .confirm-box-unchecked { background:transparent; }
    .vp .confirm-check-svg { width:12px; height:12px; color:#1c1407; }
    .vp .confirm-text { font-size:14px; color:#cbd5e1; line-height:1.6; }
    .vp .confirm-strong { color:#fff; font-weight:700; }
    .vp .community-warn { margin-top:4px; display:flex; gap:12px; background:var(--warn-bg); border:1px solid rgba(251,191,36,.40); border-radius:12px; padding:12px 16px; font-size:12px; color:#fde68a; line-height:1.5; }
    .vp .community-warn-icon { width:16px; height:16px; color:var(--accent); flex-shrink:0; margin-top:2px; }
    .vp .community-warn-title { font-weight:700; color:var(--warn); margin-bottom:4px; }
  `}</style>;
}
