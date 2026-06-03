import React, { useState } from "react";
import { FileText, AlertCircle } from "lucide-react";
import ConfirmFooter from "./ConfirmFooter";

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
  const d = data;

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

      <ConfirmFooter
        confirmed={confirmed}
        onConfirm={onConfirm}
        communityConfirmed={communityConfirmed}
        onCommunityConfirm={onCommunityConfirm}
        sectionLabel="petition and filing details"
      />
    </div>
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
      color:var(--ink); background:transparent; padding:0; max-width:840px; margin:16px auto 0;
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
  `}</style>;
}
