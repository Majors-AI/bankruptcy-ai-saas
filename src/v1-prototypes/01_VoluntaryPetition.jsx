import React from "react";
import { FileText, AlertCircle } from "lucide-react";

/* Voluntary Petition — Official Form 101 — answer-summary review.
   Populated with the Iovin case. Self-contained; drop into the review flow. */

const money = (n) => "$" + n.toLocaleString();

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

const DATA = {
  debtor1: "Christian E. Iovin",
  otherNames: [],
  ssnLast4: "xxx-xx-XXXX",
  ein: null,
  residence: "6047 Atlas Place SW, Seattle, WA 98136",
  county: "King County",
  mailingSame: true,
  district: "Western District of Washington",
  venue180: true,
  feeMethod: "Pay in full at filing",
  priorBankruptcy8yr: null,        // captured via MAJ-117
  otherPendingCases: false,
  housing: "rent",              // "rent" or "own" — drives the eviction follow-ups
  evictionJudgment: true,       // only relevant if housing === "rent"
  evictionLandlord: "Cedar Park Apartments LLC",
  evictionDate: "2026-04-18",
  cureRight: true,              // right to cure default under nonbankruptcy law
  rentDeposited: false,         // deposited 30 days' rent with the court
  soleProprietor: false,
  hazardousProperty: false,
  creditCounseling: null,          // not yet on file
  natureOfDebts: "Consumer",
  ch7FundsAvailable: null,
  creditorCount: 13,
  chapter: "7",   // set on the FIRM side at intake/attorney review — not client-editable
  assetsTotal: 2348775.94,
  liabilitiesTotal: 4099664.96,
  signed: false,
};

export default function VoluntaryPetitionReview() {
  const d = DATA;
  const chapter = d.chapter || "7";   // firm-set; the petition only displays the chapter being filed
  return (
    <div className="vp">
      <Style />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div>
          <h1><FileText size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Voluntary Petition</h1>
          <div className="form">Official Form 101 · {d.debtor1}</div>
        </div>
        <div className="formbadge">Chapter {chapter} · Form 101</div>
      </div>

      <div className="card">
        <div className="ph">Part 1 · Identify yourself</div>
        <Row k="Debtor 1 — full legal name" v={d.debtor1} />
        <Row k="Other names (last 8 yrs)" v={d.otherNames.length ? d.otherNames.join(", ") : "None"} />
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
        <Row k="Residence — rent or own?" v={d.housing === "rent" ? "Rents" : "Owns"} />
        {d.housing === "rent" && <Row k="Eviction judgment entered against you?" v={d.evictionJudgment} bool />}
        {d.housing === "rent" && d.evictionJudgment && <>
          <Row k="Landlord (judgment creditor)" v={d.evictionLandlord} />
          <Row k="Judgment date" v={d.evictionDate} />
          <Row k="Right to cure the default under nonbankruptcy law?" v={d.cureRight} bool />
          <Row k="Deposited 30 days' rent with the court?" v={d.rentDeposited} bool />
        </>}

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
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .vp * { box-sizing:border-box; }
    .vp { --oxblood:#6b1f2a; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --good:#2f6b4f; --warn:#9a5b16; --warn-bg:#f6ead7; --line:#ddd2c2; --calc:#2d5b8e; --calc-bg:#e4ecf5;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:840px; margin:0 auto; }
    .vp h1 { font-family:'Fraunces',serif; font-weight:600; font-size:24px; margin:0; }
    .vp .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .vp .formbadge { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:#efe2e4; color:var(--oxblood); border:1px solid var(--oxblood); padding:7px 13px; border-radius:8px; white-space:nowrap; }
    .vp .card { background:#fffdf8; border:1px solid var(--line); border-radius:13px; padding:18px 20px; margin-top:16px; }
    .vp .ph { font-family:'Fraunces',serif; font-size:13px; font-weight:600; color:var(--oxblood); text-transform:uppercase; letter-spacing:.04em; margin:16px 0 6px; }
    .vp .ph:first-child { margin-top:0; }
    .vp .kv { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:14px; padding:6px 0; border-bottom:1px solid var(--paper-2); align-items:baseline; }
    .vp .kv .k { color:var(--muted); } .vp .kv .v { font-weight:600; text-align:right; }
    .vp .calc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--calc-bg); color:var(--calc); padding:1px 6px; border-radius:6px; margin-left:6px; }
    .vp .flag { color:var(--warn); font-weight:600; display:inline-flex; gap:5px; align-items:center; }
    .vp .yes { color:var(--good); } .vp .no { color:var(--ink); }
    .vp .note { font-size:12.5px; color:var(--muted); background:var(--paper); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:10px 0 2px; }
  `}</style>;
}
