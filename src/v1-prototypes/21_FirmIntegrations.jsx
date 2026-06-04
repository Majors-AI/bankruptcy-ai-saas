import React, { useState } from "react";
import {
  Building2, Plug, CalendarClock, Link2, Mail, CheckCircle2, Circle, Plus, MapPin,
  CalendarDays, ListChecks, Scale, AlertCircle
} from "lucide-react";

/* Firm Setup — Integrations & Calendar Sync (multistate practices).
   Sync the channels that receive court notices and client comms — Microsoft 365,
   Twilio, SendGrid, and PACER/ECF — across every district the firm practices in.
   Firms get SECONDARY notices, so calendaring can run two ways:
     (A) Paste a public iCal link for a court/calendar, or
     (B) Connect (sign into) email accounts so the system parses inbound court
         notices, assigns each to the matching case file, and calendars the key
         dates (341, objection/claims deadlines, hearings, discharge).
   Every important date is pushed to the assigned attorney's task list and
   calendar portal. Preview sample — bind to live data at runtime. */

const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const SAMPLE = {
  firm: "Majors Law Group",
  jurisdictions: ["AZ — District of Arizona", "WA — Western District (Tacoma)", "WA — Eastern District (Spokane)"],
  connectors: [
    { k: "m365", name: "Microsoft 365", desc: "Email + calendar (Outlook / Exchange) — primary calendar destination", on: true },
    { k: "twilio", name: "Twilio", desc: "SMS — client texting + reminders", on: true },
    { k: "sendgrid", name: "SendGrid", desc: "Transactional email + automatic reminders", on: true },
    { k: "pacer", name: "PACER / ECF", desc: "Court notices (NEF), docket, and claims — per district", on: false },
  ],
  pacerAccounts: [
    { court: "District of Arizona", login: "mlg-az", status: "linked" },
    { court: "W.D. Washington (Tacoma)", login: "mlg-wawd", status: "linked" },
    { court: "E.D. Washington (Spokane)", login: "—", status: "needs login" },
  ],
  ical: [{ label: "AZ Bankruptcy Court — public calendar", url: "webcal://…/az-bk.ics" }],
  mailboxes: [
    { addr: "ecf-az@majorslaw.ai", scans: "AZ NEF notices", status: "scanning" },
    { addr: "ecf-wa@majorslaw.ai", scans: "WA NEF notices", status: "scanning" },
  ],
  events: [
    { date: "2026-06-09", title: "341 Meeting of Creditors", case: "Rasmussen", jur: "WA — Western", attorney: "John Lares", type: "Hearing" },
    { date: "2026-06-22", title: "Objection to exemptions deadline", case: "Chen", jur: "AZ", attorney: "Garrett Johnson", type: "Deadline" },
    { date: "2026-07-01", title: "Confirmation hearing", case: "Park", jur: "WA — Western", attorney: "John Lares", type: "Hearing" },
    { date: "2026-07-14", title: "Claims bar date", case: "Kowalski", jur: "AZ", attorney: "Garrett Johnson", type: "Deadline" },
    { date: "2026-08-05", title: "Discharge eligibility review", case: "Torres", jur: "AZ", attorney: "Garrett Johnson", type: "Milestone" },
  ],
  attorneys: [
    { name: "Garrett Johnson", jurisdictions: ["AZ"] },
    { name: "John Lares", jurisdictions: ["WA — Western", "WA — Eastern"] },
  ],
};

export default function FirmIntegrations({ data = SAMPLE }) {
  const [connectors, setConnectors] = useState(data.connectors);
  const [ical, setIcal] = useState(data.ical);
  const [mailboxes, setMailboxes] = useState(data.mailboxes);
  const [icalDraft, setIcalDraft] = useState("");
  const [mboxDraft, setMboxDraft] = useState("");

  const toggle = (k) => setConnectors((p) => p.map((c) => c.k === k ? { ...c, on: !c.on } : c));
  const addIcal = () => { if (!icalDraft.trim()) return; setIcal((p) => [...p, { label: "Pasted calendar", url: icalDraft.trim() }]); setIcalDraft(""); };
  const addMbox = () => { if (!mboxDraft.trim()) return; setMailboxes((p) => [...p, { addr: mboxDraft.trim(), scans: "court notices", status: "pending sign-in" }]); setMboxDraft(""); };

  const datesFor = (a) => data.events.filter((e) => e.attorney === a.name);

  return (
    <div className="fi">
      <Style />
      <div className="head"><Building2 size={20} color="#6b1f2a" /><div>
        <div className="hn">{data.firm} — Integrations &amp; Calendar Sync</div>
        <div className="hm">Multistate setup — sync court notices &amp; client comms across every district, then route key dates to each attorney.</div>
      </div></div>

      <div className="jur"><MapPin size={13} /> Jurisdictions: {data.jurisdictions.map((j) => <span className="jchip" key={j}>{j}</span>)}</div>

      {/* Connectors */}
      <div className="card">
        <div className="ch"><Plug size={16} /><h2>Connectors</h2><span className="ct">channels that receive notices &amp; send comms</span></div>
        {connectors.map((c) => (
          <div className="conn" key={c.k}>
            <div className="cinfo"><span className="cname">{c.name}</span><span className="cdesc">{c.desc}</span></div>
            <button className={"connbtn " + (c.on ? "on" : "")} onClick={() => toggle(c.k)}>{c.on ? <><CheckCircle2 size={13} /> Connected</> : <><Circle size={13} /> Connect</>}</button>
          </div>
        ))}
        <div className="micro"><AlertCircle size={11} style={{ verticalAlign: -1 }} /> The firm receives <b>secondary notices</b> on these channels; the system reconciles duplicates so a date is calendared once.</div>
      </div>

      {/* PACER per district */}
      <div className="card">
        <div className="ch"><Scale size={16} /><h2>PACER / ECF accounts — per district</h2><span className="ct">multistate</span></div>
        {data.pacerAccounts.map((p, i) => (
          <div className="prow" key={i}>
            <span className="pcourt">{p.court}</span>
            <span className="plogin">{p.login}</span>
            <span className={"pstat " + (p.status === "linked" ? "ok" : "warn")}>{p.status}</span>
          </div>
        ))}
      </div>

      {/* Calendar sync — two modes */}
      <div className="card">
        <div className="ch"><CalendarClock size={16} /><h2>Calendar sync</h2><span className="ct">choose either or both</span></div>

        <div className="mode">
          <div className="mh"><Link2 size={14} /> A · Public iCal link</div>
          <div className="micro">Paste a court/calendar's public iCal (webcal) link; the system subscribes and pulls dates.</div>
          {ical.map((c, i) => <div className="srow" key={i}><CalendarDays size={13} /> <span className="sl">{c.label}</span><span className="su">{c.url}</span></div>)}
          <div className="add"><input placeholder="Paste webcal:// or https://….ics link…" value={icalDraft} onChange={(e) => setIcalDraft(e.target.value)} /><button onClick={addIcal}><Plus size={12} /> Add link</button></div>
        </div>

        <div className="mode">
          <div className="mh"><Mail size={14} /> B · Mailbox sign-in &amp; auto-assign</div>
          <div className="micro">Sign into the email accounts that receive court notices; the system parses each notice, assigns it to the matching case file, and calendars the key dates (341, objection/claims deadlines, hearings, discharge).</div>
          {mailboxes.map((m, i) => <div className="srow" key={i}><Mail size={13} /> <span className="sl">{m.addr}</span><span className="su">{m.scans}</span><span className={"pstat " + (m.status === "scanning" ? "ok" : "warn")}>{m.status}</span></div>)}
          <div className="add"><input placeholder="Add a mailbox to sign into (e.g., ecf-xx@firm)…" value={mboxDraft} onChange={(e) => setMboxDraft(e.target.value)} /><button onClick={addMbox}><Plus size={12} /> Connect mailbox</button></div>
        </div>
      </div>

      {/* Ingested key dates */}
      <div className="card">
        <div className="ch"><CalendarDays size={16} /><h2>Calendared key dates</h2><span className="ct">parsed &amp; assigned automatically</span></div>
        {data.events.map((e, i) => (
          <div className="erow" key={i}>
            <span className="edate">{fmt(e.date)}</span>
            <span className="etitle">{e.title}<span className="ecase">{e.case} · {e.jur}</span></span>
            <span className={"etype " + e.type.toLowerCase()}>{e.type}</span>
            <span className="eatt">→ {e.attorney}</span>
          </div>
        ))}
        <div className="micro"><ListChecks size={11} style={{ verticalAlign: -1 }} /> Each date posts to the assigned attorney's <b>task list</b> and <b>calendar portal</b>, and to the case file.</div>
      </div>

      {/* Per-attorney routing */}
      <div className="card">
        <div className="ch"><ListChecks size={16} /><h2>Per-attorney calendar &amp; tasks</h2></div>
        {data.attorneys.map((a, i) => {
          const ds = datesFor(a);
          return (
            <div className="att" key={i}>
              <div className="atop"><span className="aname">{a.name}</span><span className="ajur">{a.jurisdictions.join(" · ")}</span><span className="acount">{ds.length} on calendar &amp; task list</span></div>
              <div className="adates">{ds.length ? ds.map((e, j) => <span className="achip" key={j}>{fmt(e.date)} · {e.title}</span>) : <span className="anone">no upcoming dates</span>}</div>
            </div>
          );
        })}
      </div>

      <div className="foot"><Scale size={14} color="#6b1f2a" /> One sync per firm covers every district; dates flow to the right case file and the right attorney's calendar &amp; tasks.</div>
    </div>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .fi * { box-sizing:border-box; }
    .fi { --oxblood:#6b1f2a; --oxblood-d:#54171f; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --good:#2f6b4f; --good-bg:#e4efe6; --warn:#9a5b16; --warn-bg:#f6ead7; --line:#ddd2c2; --calc:#2d5b8e; --calc-bg:#e4ecf5; --pur:#5b4a8a; --pur-bg:#e7e0f0;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:900px; margin:0 auto; }
    .fi .head { display:flex; gap:11px; align-items:center; } .fi .hn { font-family:'Fraunces',serif; font-weight:600; font-size:21px; } .fi .hm { font-size:12.5px; color:var(--muted); margin-top:2px; }
    .fi .jur { font-size:12.5px; color:var(--muted); margin-top:12px; display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
    .fi .jchip { background:var(--paper-2); color:var(--ink); font-weight:600; font-size:11.5px; padding:3px 9px; border-radius:999px; }
    .fi .card { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:6px 18px 14px; margin-top:14px; }
    .fi .ch { display:flex; gap:8px; align-items:center; padding:12px 0 10px; border-bottom:1px solid var(--line); margin-bottom:10px; color:var(--oxblood); }
    .fi .ch h2 { font-family:'Fraunces',serif; font-size:15px; font-weight:600; margin:0; flex:1; } .fi .ct { font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); font-weight:700; }
    .fi .micro { font-size:12px; color:var(--muted); margin-top:9px; line-height:1.5; }
    .fi .conn { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--paper-2); } .fi .conn:last-of-type { border-bottom:none; }
    .fi .cname { font-weight:600; font-size:13.5px; display:block; } .fi .cdesc { font-size:12px; color:var(--muted); }
    .fi .connbtn { border:1px solid var(--line); background:var(--paper); border-radius:8px; padding:7px 13px; font:inherit; font-weight:600; font-size:12px; cursor:pointer; color:var(--muted); display:inline-flex; gap:6px; align-items:center; white-space:nowrap; }
    .fi .connbtn.on { background:var(--good-bg); color:var(--good); border-color:var(--good); }
    .fi .prow { display:grid; grid-template-columns:1.4fr 1fr auto; gap:10px; align-items:center; padding:9px 0; border-bottom:1px solid var(--paper-2); font-size:13px; } .fi .prow:last-child { border-bottom:none; }
    .fi .pcourt { font-weight:600; } .fi .plogin { font-family:monospace; font-size:12px; color:var(--muted); }
    .fi .pstat { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:2px 8px; border-radius:999px; } .fi .pstat.ok { background:var(--good-bg); color:var(--good); } .fi .pstat.warn { background:var(--warn-bg); color:var(--warn); }
    .fi .mode { border:1px solid var(--paper-2); border-radius:10px; padding:11px 13px; margin-top:10px; }
    .fi .mh { font-weight:700; font-size:12.5px; display:flex; gap:6px; align-items:center; color:var(--oxblood); }
    .fi .srow { display:flex; gap:8px; align-items:center; font-size:12.5px; padding:7px 0; border-bottom:1px solid var(--paper-2); } .fi .srow:last-of-type { border-bottom:none; }
    .fi .sl { font-weight:600; } .fi .su { color:var(--muted); font-size:11.5px; flex:1; }
    .fi .add { display:flex; gap:6px; margin-top:9px; } .fi .add input { flex:1; border:1px solid var(--line); border-radius:7px; padding:7px 10px; font:inherit; font-size:12.5px; background:var(--paper); }
    .fi .add button { border:1px dashed var(--oxblood); background:#fff; color:var(--oxblood); border-radius:7px; padding:7px 11px; font:inherit; font-weight:600; font-size:12px; cursor:pointer; display:inline-flex; gap:5px; align-items:center; white-space:nowrap; }
    .fi .erow { display:grid; grid-template-columns:96px 1fr auto auto; gap:10px; align-items:center; padding:9px 0; border-bottom:1px solid var(--paper-2); font-size:13px; } .fi .erow:last-of-type { border-bottom:none; }
    .fi .edate { font-weight:600; font-size:12px; } .fi .etitle { font-weight:500; } .fi .ecase { display:block; font-size:11px; color:var(--muted); }
    .fi .etype { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:2px 8px; border-radius:999px; } .fi .etype.hearing { background:#efe2e4; color:var(--oxblood); } .fi .etype.deadline { background:var(--warn-bg); color:var(--warn); } .fi .etype.milestone { background:var(--calc-bg); color:var(--calc); }
    .fi .eatt { font-size:12px; color:var(--muted); white-space:nowrap; }
    .fi .att { padding:10px 0; border-bottom:1px solid var(--paper-2); } .fi .att:last-of-type { border-bottom:none; }
    .fi .atop { display:flex; gap:10px; align-items:center; flex-wrap:wrap; } .fi .aname { font-weight:600; font-size:13.5px; } .fi .ajur { font-size:11.5px; color:var(--muted); } .fi .acount { margin-left:auto; font-size:11px; font-weight:700; color:var(--oxblood); background:#efe2e4; padding:2px 9px; border-radius:999px; }
    .fi .adates { display:flex; gap:6px; flex-wrap:wrap; margin-top:7px; } .fi .achip { font-size:11.5px; background:var(--paper-2); padding:3px 9px; border-radius:7px; } .fi .anone { font-size:11.5px; color:var(--muted); }
    .fi .foot { font-size:12.5px; font-weight:500; background:var(--paper-2); border-radius:10px; padding:12px 14px; margin-top:14px; display:flex; gap:8px; align-items:center; }
    @media(max-width:680px){ .fi .erow{grid-template-columns:1fr auto;} .fi .eatt,.fi .etype{grid-column:auto;} .fi .prow{grid-template-columns:1fr auto;} }
  `}</style>;
}
