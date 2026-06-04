import React, { useState } from "react";

/* DEV REVIEW HARNESS — renders every v1 prototype in sequence so the whole
   flow (petition → all documents → staff/firm tools) can be reviewed in one
   place at localhost. Not a production screen; not for merge. Each prototype is
   self-contained and styled inline, so they simply stack. Note: 16_ClientFile
   also appears embedded inside 17_ClientFileCabinet, and 23_ProfitAndLoss inside
   14_DocumentPortal — you'll see those twice, which is expected. */

import F01 from "./01_VoluntaryPetition.jsx";
import F02 from "./02_ScheduleAB.jsx";
import F03 from "./03_ScheduleC.jsx";
import F04 from "./04_ScheduleD.jsx";
import F05 from "./05_ScheduleE.jsx";
import F06 from "./06_ScheduleF.jsx";
import F07 from "./07_ScheduleG.jsx";
import F08 from "./08_ScheduleH.jsx";
import F09 from "./09_ScheduleI.jsx";
import F10 from "./10_ScheduleJ.jsx";
import F11 from "./11_MeansTest.jsx";
import F12 from "./12_SOFA.jsx";
import F18 from "./18_StatementOfIntention.jsx";
import F19 from "./19_DisclosureOfCompensation.jsx";
import F20 from "./20_CreditorMatrix.jsx";
import F22 from "./22_StatementSSN.jsx";
import F23 from "./23_ProfitAndLoss.jsx";
import F13 from "./13_FinalReview.jsx";
import F14 from "./14_DocumentPortal.jsx";
import F15 from "./15_TrusteeDocumentPortal.jsx";
import F16 from "./16_ClientFile.jsx";
import F17 from "./17_ClientFileCabinet.jsx";
import F21 from "./21_FirmIntegrations.jsx";

const CLIENT = [
  ["01", "Voluntary Petition (Form 101)", F01],
  ["02", "Schedule A/B — Property", F02],
  ["03", "Schedule C — Exemptions & liquidation", F03],
  ["04", "Schedule D — Secured", F04],
  ["05", "Schedule E — Priority", F05],
  ["06", "Schedule F — Unsecured", F06],
  ["07", "Schedule G — Contracts & leases", F07],
  ["08", "Schedule H — Codebtors", F08],
  ["09", "Schedule I — Income", F09],
  ["10", "Schedule J — Expenses", F10],
  ["11", "Means Test (Form 122)", F11],
  ["12", "Statement of Financial Affairs (Form 107)", F12],
  ["18", "Statement of Intention (Form 108)", F18],
  ["19", "Disclosure of Compensation (Form 2030)", F19],
  ["20", "Verified Creditor Matrix", F20],
  ["22", "Statement re Social Security No. (Form 121)", F22],
  ["23", "Profit & Loss worksheet", F23],
  ["13", "Final Review", F13],
  ["14", "Document Portal", F14],
];
const STAFF = [
  ["15", "Trustee Document Portal", F15],
  ["16", "Client File", F16],
  ["17", "Client File Cabinet", F17],
  ["21", "Firm Setup — Integrations & Calendar Sync", F21],
];

export default function PreviewAll() {
  const [open, setOpen] = useState(true);
  const all = [...CLIENT, ...STAFF];

  return (
    <div className="pa">
      <style>{`
        .pa { --ox:#6b1f2a; --paper:#f7f3ec; --line:#ddd2c2; font-family:'Hanken Grotesk',system-ui,sans-serif; display:flex; min-height:100vh; background:#efe9df; }
        .pa .nav { position:sticky; top:0; align-self:flex-start; width:250px; max-height:100vh; overflow:auto; background:#2a1418; color:#f7f3ec; padding:16px 12px; flex:none; }
        .pa .nav h3 { font-family:'Fraunces',serif; font-size:14px; margin:0 0 4px; color:#e8c9a0; }
        .pa .nav .grp { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#b88; margin:16px 0 6px; }
        .pa .nav a { display:block; color:#f0e6da; text-decoration:none; font-size:12.5px; padding:5px 8px; border-radius:6px; }
        .pa .nav a:hover { background:#43222a; }
        .pa .nav a b { color:#e8c9a0; margin-right:7px; font-variant-numeric:tabular-nums; }
        .pa .main { flex:1; min-width:0; }
        .pa .sec { scroll-margin-top:0; }
        .pa .bar { position:sticky; top:0; z-index:5; background:var(--ox); color:#fff; padding:10px 18px; font-family:'Fraunces',serif; font-size:15px; font-weight:600; display:flex; gap:10px; align-items:center; box-shadow:0 1px 0 rgba(0,0,0,.15); }
        .pa .bar .n { background:#fff; color:var(--ox); font-size:12px; font-weight:700; padding:2px 8px; border-radius:6px; }
        .pa .bar .back { margin-left:auto; font-size:11px; font-weight:600; color:#f0d9b8; text-decoration:none; }
        .pa .grouphdr { background:#43222a; color:#e8c9a0; font-family:'Fraunces',serif; font-size:13px; letter-spacing:.04em; text-transform:uppercase; padding:8px 18px; }
        .pa .frame { background:#efe9df; padding:0 0 8px; }
        .pa .toggle { position:fixed; left:10px; bottom:10px; z-index:20; background:var(--ox); color:#fff; border:none; border-radius:8px; padding:8px 12px; font:inherit; font-weight:600; font-size:12px; cursor:pointer; }
      `}</style>

      {open && (
        <nav className="nav" id="top">
          <h3>V1 review — full flow</h3>
          <div style={{ fontSize: 11, color: "#b88" }}>Local preview · not for merge</div>
          <div className="grp">Client — petition → documents</div>
          {CLIENT.map(([n, name]) => <a key={n} href={"#s" + n}><b>{n}</b>{name}</a>)}
          <div className="grp">Staff & firm tools</div>
          {STAFF.map(([n, name]) => <a key={n} href={"#s" + n}><b>{n}</b>{name}</a>)}
        </nav>
      )}

      <div className="main">
        <div className="grouphdr">Client — petition → documents</div>
        {all.map(([n, name, C], i) => (
          <React.Fragment key={n}>
            {n === "15" && <div className="grouphdr">Staff & firm tools</div>}
            <section className="sec" id={"s" + n}>
              <div className="bar"><span className="n">{n}</span>{name}<a className="back" href="#top">↑ index</a></div>
              <div className="frame"><C /></div>
            </section>
          </React.Fragment>
        ))}
      </div>

      <button className="toggle" onClick={() => setOpen((o) => !o)}>{open ? "Hide index" : "Show index"}</button>
    </div>
  );
}
