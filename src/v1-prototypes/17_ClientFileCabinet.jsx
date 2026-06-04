import React, { useState } from "react";
import {
  Archive, Search, ChevronRight, ArrowLeft, Scale, CircleDot, FileText, DollarSign, UserCheck
} from "lucide-react";
import ClientFile from "./16_ClientFile.jsx";

/* Client File Cabinet — the FIRM-level home for every client file.
   The Client File (16) lives INSIDE this cabinet: the cabinet is the roster of
   all clients; opening a row opens that client's file.

   HOW A FILE FLOWS (lifecycle — wire the app to follow this order):
     1. CLIENT INTAKE FORM — a lead completes intake (lead-gen / intake bot).
     2. RETAINED — once the client signs the fee agreement, a Client File is
        created here in the firm's Client File Cabinet and the intake data flows in.
     3. CLIENT PORTAL — the client supplements the full questionnaire in the
        portal (Schedules A/B–J, Means Test, SOFA).
     4. GATHER + REQUEST — when the questionnaire is complete, the system gathers
        any remaining info/details, then requests the client's documents
        (Document Portal, organized by schedule).
     5. SIGNING SCHEDULED — the system re-validates documents that may expire or
        need updating, and requests updated BANK BALANCES as of the actual filing
        date (per non-exempt account).
     6. CREDIT COUNSELING CHECK — confirm the pre-filing credit counseling was
        obtained within 180 days (~6 months) of the ACTUAL filing date; if not,
        it must be retaken/updated before filing.
   All of the above is logged automatically to each client's file (time log).
   Preview sample — bind to live data at runtime. */

const STAGES = ["Intake (lead)", "Info & documents", "Signing scheduled", "341 scheduled", "Hearing concluded", "Discharge entered", "Case closed"];
const stageCls = (s) => s === "Intake (lead)" ? "lead" : s === "Case closed" ? "closed" : ["Discharge entered", "Hearing concluded"].includes(s) ? "late" : "active";

const CLIENTS = [
  { name: "Sandra Willis", caseNo: "— not retained —", chapter: 7, attorney: "Intake", stage: "Intake (lead)", balance: 0, docs: "0/0", activity: "2026-06-03", next: "Consult booked — convert to retained" },
  { name: "James Kowalski", caseNo: "— not filed —", chapter: 13, attorney: "Kelly Andrus", stage: "Info & documents", balance: 3000, docs: "4/8", activity: "2026-05-28", next: "Awaiting questionnaire + documents" },
  { name: "Kevin Park", caseNo: "2:26-bk-05877-JWA", chapter: 13, attorney: "John Lares", stage: "Signing scheduled", balance: 1200, docs: "4/7", activity: "2026-06-01", next: "Refresh expiring docs + signing-day balances" },
  { name: "Robert Chen", caseNo: "2:26-bk-03994-DRB", chapter: 7, attorney: "Garrett Johnson", stage: "341 scheduled", balance: 0, docs: "6/6", activity: "2026-06-02", next: "Trustee packet · 341 on Jun 9" },
  { name: "Patricia Nguyen", caseNo: "2:26-bk-07134-KAE", chapter: 7, attorney: "John Lares", stage: "Hearing concluded", balance: 0, docs: "7/7", activity: "2026-05-30", next: "Awaiting discharge · financial mgmt course" },
  { name: "Margaret Torres", caseNo: "2:26-bk-04821-DRB", chapter: 7, attorney: "Garrett Johnson", stage: "Discharge entered", balance: 0, docs: "7/7", activity: "2026-05-29", next: "Close file & notify client" },
];

const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");

const FILTERS = [
  ["all", "All"],
  ["intake", "Intake"],
  ["active", "Active"],
  ["closing", "Closing / closed"],
];
const inFilter = (c, f) => f === "all" || (f === "intake" ? c.stage === "Intake (lead)"
  : f === "active" ? !["Intake (lead)", "Discharge entered", "Case closed"].includes(c.stage)
  : ["Discharge entered", "Case closed"].includes(c.stage));

export default function ClientFileCabinet({ clients = CLIENTS, firm = "Majors Law Group" }) {
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  if (open !== null) {
    return (
      <div className="cfc">
        <Style />
        <button className="back" onClick={() => setOpen(null)}><ArrowLeft size={14} /> Back to Client File Cabinet</button>
        <ClientFile />
      </div>
    );
  }

  const shown = clients.filter((c) => inFilter(c, filter) && c.name.toLowerCase().includes(q.toLowerCase()));
  const counts = { total: clients.length, active: clients.filter((c) => inFilter(c, "active")).length, intake: clients.filter((c) => c.stage === "Intake (lead)").length };

  return (
    <div className="cfc">
      <Style />
      <div className="head">
        <div className="hl"><Archive size={20} color="#6b1f2a" /><div>
          <div className="hn">{firm} — Client File Cabinet</div>
          <div className="hm">Every client file lives here. Open a file to see status, payments, documents, time, docket, tasks &amp; communications.</div>
        </div></div>
        <div className="stats">
          <div className="st"><span className="sn">{counts.total}</span><span className="sl">files</span></div>
          <div className="st"><span className="sn">{counts.active}</span><span className="sl">active</span></div>
          <div className="st"><span className="sn">{counts.intake}</span><span className="sl">intake</span></div>
        </div>
      </div>

      <div className="flow">
        <div className="fh">How a file flows</div>
        <ol>
          <li><b>Client intake form</b> — a lead completes intake.</li>
          <li><b>Retained</b> — on signing the fee agreement, a Client File is created here and the intake data flows in.</li>
          <li><b>Client portal</b> — the client supplements the full questionnaire (Schedules, Means Test, SOFA).</li>
          <li><b>Gather + request</b> — when complete, the system gathers remaining details, then requests the client's documents.</li>
          <li><b>Signing scheduled</b> — re-validate documents that may expire / need updating, and request updated <b>bank balances as of the filing date</b>.</li>
          <li><b>Credit counseling</b> — confirm it was obtained within <b>180 days (~6 months) of the actual filing date</b>, or it must be retaken before filing.</li>
        </ol>
      </div>

      <div className="toolbar">
        <div className="srch"><Search size={14} /><input value={q} placeholder="Search clients…" onChange={(e) => setQ(e.target.value)} /></div>
        <div className="filters">{FILTERS.map(([k, l]) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>)}</div>
      </div>

      <div className="roster">
        <div className="rhead"><span>Client</span><span>Case #</span><span>Stage</span><span>Docs</span><span>Balance</span><span>Next action</span><span></span></div>
        {shown.map((c, i) => (
          <button className="row" key={i} onClick={() => setOpen(i)}>
            <span className="rn"><UserCheck size={14} /> {c.name}<span className="rsub">{c.attorney} · Ch {c.chapter}</span></span>
            <span className="rcase">{c.caseNo}</span>
            <span><span className={"stage " + stageCls(c.stage)}><CircleDot size={10} /> {c.stage}</span></span>
            <span className="rdocs"><FileText size={12} /> {c.docs}</span>
            <span className={"rbal " + (c.balance > 0 ? "due" : "ok")}>{c.balance > 0 ? money(c.balance) : "Paid"}</span>
            <span className="rnext">{c.next}<span className="ract">last activity {fmt(c.activity)}</span></span>
            <span className="rchev"><ChevronRight size={16} /></span>
          </button>
        ))}
        {shown.length === 0 && <div className="empty">No files match.</div>}
      </div>

      <div className="foot"><Scale size={14} color="#6b1f2a" /> The Client File Cabinet is the firm's index of every client file; each file is the system of record for that case.</div>
    </div>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .cfc * { box-sizing:border-box; }
    .cfc { --oxblood:#6b1f2a; --oxblood-d:#54171f; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --good:#2f6b4f; --good-bg:#e4efe6; --warn:#9a5b16; --warn-bg:#f6ead7; --line:#ddd2c2; --calc:#2d5b8e; --calc-bg:#e4ecf5; --pur:#5b4a8a; --pur-bg:#e7e0f0;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:22px; max-width:1000px; margin:0 auto; }
    .cfc .back { border:1px solid var(--line); background:#fffdf8; color:var(--oxblood); border-radius:8px; padding:8px 13px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; display:inline-flex; gap:6px; align-items:center; margin-bottom:14px; }
    .cfc .head { display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; }
    .cfc .hl { display:flex; gap:11px; align-items:center; } .cfc .hn { font-family:'Fraunces',serif; font-weight:600; font-size:20px; }
    .cfc .hm { font-size:12.5px; color:var(--muted); margin-top:2px; max-width:560px; }
    .cfc .stats { display:flex; gap:10px; } .cfc .st { background:#fffdf8; border:1px solid var(--line); border-radius:10px; padding:8px 14px; text-align:center; }
    .cfc .st .sn { display:block; font-family:'Fraunces',serif; font-weight:600; font-size:19px; color:var(--oxblood); line-height:1; } .cfc .st .sl { font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); }
    .cfc .flow { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:12px 16px; margin-top:16px; }
    .cfc .fh { font-family:'Fraunces',serif; font-weight:600; font-size:14px; color:var(--oxblood); margin-bottom:6px; }
    .cfc .flow ol { margin:0; padding-left:20px; } .cfc .flow li { font-size:12.5px; line-height:1.7; color:var(--ink); }
    .cfc .toolbar { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; margin:16px 0 10px; align-items:center; }
    .cfc .srch { display:flex; gap:7px; align-items:center; border:1px solid var(--line); background:#fffdf8; border-radius:9px; padding:7px 12px; color:var(--muted); flex:1; min-width:200px; }
    .cfc .srch input { border:none; background:none; font:inherit; font-size:13px; color:var(--ink); outline:none; flex:1; }
    .cfc .filters { display:flex; gap:5px; flex-wrap:wrap; }
    .cfc .filters button { border:1px solid var(--line); background:#fffdf8; border-radius:8px; padding:7px 12px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; color:var(--muted); }
    .cfc .filters button.on { background:var(--oxblood); color:#fff; border-color:var(--oxblood); }
    .cfc .roster { background:#fffdf8; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
    .cfc .rhead, .cfc .row { display:grid; grid-template-columns:1.3fr 1.1fr 1.1fr .6fr .7fr 1.5fr 24px; gap:10px; align-items:center; padding:11px 16px; text-align:left; }
    .cfc .rhead { font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); font-weight:700; border-bottom:1px solid var(--line); }
    .cfc .row { border:none; border-bottom:1px solid var(--paper-2); background:none; font:inherit; cursor:pointer; width:100%; }
    .cfc .row:last-child { border-bottom:none; } .cfc .row:hover { background:var(--paper-2); }
    .cfc .rn { font-size:13.5px; font-weight:600; display:flex; gap:7px; align-items:center; flex-wrap:wrap; } .cfc .rsub { font-size:11px; font-weight:400; color:var(--muted); width:100%; padding-left:21px; }
    .cfc .rcase { font-family:monospace; font-size:12px; color:var(--ink); }
    .cfc .stage { font-size:11px; font-weight:600; padding:3px 8px; border-radius:999px; display:inline-flex; gap:5px; align-items:center; }
    .cfc .stage.lead { background:var(--pur-bg); color:var(--pur); } .cfc .stage.active { background:var(--calc-bg); color:var(--calc); } .cfc .stage.late { background:var(--good-bg); color:var(--good); } .cfc .stage.closed { background:var(--paper-2); color:var(--muted); }
    .cfc .rdocs { font-size:12.5px; color:var(--muted); display:inline-flex; gap:5px; align-items:center; }
    .cfc .rbal { font-size:12.5px; font-weight:600; } .cfc .rbal.due { color:var(--warn); } .cfc .rbal.ok { color:var(--good); }
    .cfc .rnext { font-size:12px; color:var(--ink); } .cfc .ract { display:block; font-size:10.5px; color:var(--muted); margin-top:2px; }
    .cfc .rchev { color:var(--muted); display:flex; justify-content:flex-end; }
    .cfc .empty { padding:24px; text-align:center; color:var(--muted); font-size:13px; }
    .cfc .foot { font-size:12.5px; font-weight:500; background:var(--paper-2); border-radius:10px; padding:12px 14px; margin-top:14px; display:flex; gap:8px; align-items:center; }
    @media(max-width:820px){ .cfc .rhead{display:none;} .cfc .row{grid-template-columns:1fr 1fr; gap:6px;} .cfc .rnext,.cfc .rchev{grid-column:1 / -1;} }
  `}</style>;
}
