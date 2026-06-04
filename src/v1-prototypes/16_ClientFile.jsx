import React, { useState } from "react";
import {
  FolderOpen, Clock, Bot, Mail, MessageSquare, Phone, UserCheck, FileText, FileSignature,
  Gavel, Plus, Scale, Paperclip, DollarSign, Archive, Ban, CheckCircle2, Landmark, ScrollText,
  FilePlus, X, LayoutDashboard, Receipt, ListChecks, MessagesSquare, Circle, Send, Check
} from "lucide-react";

/* Client File — the single visible record for a client. Seven tabs:
   Overview (case-status stage tracker) · Payments (invoice + history) ·
   Documents (submitted, from the Document Portal) · Time log (time + events,
   billed by role) · PACER (docket + claims) · Tasks (done / outstanding) ·
   Communications (full client thread + send a message).
   Data-driven preview sample — bind to live client data at runtime. */

const RATES_DEFAULT = { attorney: 350, paralegal: 150, staff: 95 };   // $/hr — set per firm
const ROLE_BILLABLE = { attorney: true, paralegal: true, staff: true, system: false, client: false };
const MIN_ENTRY_HRS = 0.2, INCREMENT_HRS = 0.1;   // 0.2 min, then 0.1 (6-min) increments
const trackedHours = (min) => {
  const rounded = Math.ceil(((min || 0) / 60) / INCREMENT_HRS) * INCREMENT_HRS;
  return Math.max(MIN_ENTRY_HRS, Math.round(rounded * 10) / 10);
};
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const fmt = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const STAGES = [
  { key: "intake", label: "Info & documents" },
  { key: "signing", label: "Signing scheduled" },
  { key: "filed", label: "Filed" },
  { key: "hearing", label: "341 scheduled" },
  { key: "concluded", label: "Hearing concluded" },
  { key: "discharge", label: "Discharge entered" },
  { key: "closed", label: "Case closed" },
];
const PLEADING_TEMPLATES = ["Notice of change of address", "Notice of conversion", "Notice of voluntary dismissal", "Amended schedule / SOFA", "Reaffirmation agreement", "Motion to avoid lien"];

const SAMPLE = {
  client: { name: "Client name (from file)", caseNo: "2:26-bk-03994-DRB", attorney: "Garrett Johnson", trustee: "David A. Birdsell", state: "AZ", chapter: 7, status: "Filed — awaiting 341", hearing: "2026-06-09", filingDate: "2026-05-20", stage: "hearing" },
  payments: { feeTotal: 1800, history: [
    { date: "2026-05-14", amount: 300, method: "Card — retainer", status: "Paid" },
    { date: "2026-05-20", amount: 750, method: "Card", status: "Paid" },
    { date: "2026-06-15", amount: 750, method: "Scheduled (auto-pay)", status: "Scheduled" },
  ]},
  log: [
    { d: "2026-06-02", t: "9:02 AM", kind: "auto", role: "system", actor: "System", text: "Document request reminder (day 14) emailed to client" },
    { d: "2026-06-01", t: "4:15 PM", kind: "client", role: "client", actor: "Client", text: "Uploaded: Bank statement — May 2026" },
    { d: "2026-05-31", t: "11:30 AM", kind: "client", role: "client", actor: "Client", text: "Completed Schedule A/B questionnaire" },
    { d: "2026-05-28", t: "8:00 AM", kind: "auto", role: "system", actor: "System", text: "Initial 341 hearing reminder emailed to client" },
    { d: "2026-05-26", t: "2:45 PM", kind: "staff", role: "paralegal", actor: "Erin Turner", text: "Reviewed intake; flagged vehicle title outstanding", min: 18 },
    { d: "2026-05-21", t: "8:30 AM", kind: "pacer", role: "system", actor: "PACER", text: "Docket #9 — Meeting of Creditors (341) scheduled for Jun 9, 2026" },
    { d: "2026-05-20", t: "9:55 AM", kind: "pacer", role: "system", actor: "System", text: "Case filed — assigned case no. 2:26-bk-03994-DRB" },
    { d: "2026-05-20", t: "9:50 AM", kind: "filed", role: "attorney", actor: "Garrett Johnson", text: "Voluntary petition & schedules filed with the court", min: 30 },
    { d: "2026-05-15", t: "3:20 PM", kind: "client", role: "client", actor: "Client", text: "Signed retainer / fee agreement" },
    { d: "2026-05-14", t: "1:00 PM", kind: "call", role: "attorney", actor: "Garrett Johnson", text: "Initial consultation", min: 30 },
    { d: "2026-05-12", t: "10:30 AM", kind: "email", role: "paralegal", actor: "Erin Turner", text: "Engagement letter + § 527 / 528 disclosures emailed", min: 12 },
  ],
  docket: [
    { no: 1, date: "2026-05-20", desc: "Voluntary Petition (Chapter 7)" },
    { no: 2, date: "2026-05-20", desc: "Statement About Your Social Security Number" },
    { no: 9, date: "2026-05-21", desc: "Meeting of Creditors (341) — set for Jun 9, 2026, 10:00 AM" },
    { no: 12, date: "2026-05-22", desc: "Certificate of Credit Counseling" },
    { no: 14, date: "2026-05-24", desc: "Notice of Incomplete Filing — pay advices due" },
  ],
  claims: [
    { creditor: "Capital One, N.A.", no: "1-1", type: "Unsecured", amount: 4992.60, date: "2026-05-28" },
    { creditor: "Internal Revenue Service", no: "2-1", type: "Priority", amount: 2109.71, date: "2026-05-30" },
    { creditor: "Toyota Financial Services", no: "3-1", type: "Secured", amount: 15915.83, date: "2026-06-01" },
    { creditor: "LVNV Funding LLC", no: "4-1", type: "Unsecured", amount: 3464.41, date: "2026-06-02" },
  ],
  tasks: [
    { label: "Complete intake questionnaire", done: true },
    { label: "Upload identity documents", done: true },
    { label: "Upload 6 months of bank statements", done: true },
    { label: "Upload 6 months of pay stubs", done: false },
    { label: "Provide vehicle title", done: false },
    { label: "Complete pre-filing credit counseling", done: true },
    { label: "Sign petition & schedules", done: true },
    { label: "File petition", done: true },
    { label: "Attend 341 meeting (Jun 9)", done: false },
    { label: "Complete financial management course (post-filing)", done: false },
  ],
  comms: [
    { d: "2026-06-02", t: "9:02 AM", dir: "out", channel: "email", subject: "Document request — day 14", text: "We still need your May bank statement and vehicle title before your 341 on Jun 9." },
    { d: "2026-06-01", t: "5:10 PM", dir: "in", channel: "email", text: "Uploaded my May statement — I'll get the title from the lender this week." },
    { d: "2026-05-28", t: "8:00 AM", dir: "out", channel: "email", subject: "Your 341 hearing", text: "Your meeting of creditors is set for Jun 9, 2026 at 10:00 AM (telephonic). Details to follow." },
    { d: "2026-05-20", t: "10:05 AM", dir: "out", channel: "email", subject: "Your case was filed", text: "Your bankruptcy case was filed today — case no. 2:26-bk-03994-DRB. A copy of your filed documents is attached." },
    { d: "2026-05-14", t: "2:30 PM", dir: "in", channel: "call", text: "Initial consultation call (30 min)." },
  ],
  cabinet: [
    { group: "Engagement & fee agreements", items: [
      { name: "Bankruptcy fee agreement (signed)", date: "2026-05-15", src: "Signed" },
      { name: "§ 527 / 528 disclosures", date: "2026-05-12", src: "Generated" },
    ]},
    { group: "Petition & schedules (filed)", items: [
      { name: "Voluntary Petition — Form 101", date: "2026-05-20", src: "Filed" },
      { name: "Schedules A/B–J", date: "2026-05-20", src: "Filed" },
      { name: "Statement of Financial Affairs — Form 107", date: "2026-05-20", src: "Filed" },
      { name: "Means Test — Form 122A", date: "2026-05-20", src: "Filed" },
    ]},
    { group: "Supporting documents (from Document Portal)", items: [
      { name: "Government photo ID", date: "2026-05-16", src: "Client upload" },
      { name: "Social Security card", date: "2026-05-16", src: "Client upload" },
      { name: "Bank statements — 6 months", date: "2026-06-02", src: "Client upload" },
      { name: "Pay stubs — 6 months", date: null, src: "Pending" },
      { name: "Vehicle title", date: null, src: "Pending" },
      { name: "Tax returns — 2024, 2025", date: "2026-05-18", src: "Client upload" },
    ]},
    { group: "PACER / docket", items: [
      { name: "Notice of Bankruptcy Case Filing", date: "2026-05-20", src: "Court" },
      { name: "Docket report (PACER)", date: "2026-05-24", src: "Court" },
      { name: "Claims register", date: "2026-06-02", src: "Court" },
    ]},
    { group: "Course certificates", items: [
      { name: "Credit counseling certificate (pre-filing)", date: "2026-05-14", src: "Completed" },
      { name: "Financial management course (post-filing)", date: null, src: "Pending" },
    ]},
    { group: "Trustee submissions", items: [
      { name: "Trustee packet — David A. Birdsell", date: "2026-05-30", src: "Trustee" },
    ]},
  ],
  pleadings: [{ name: "Notice of change of address", status: "To file", date: null }],
};

const KINDS = {
  auto: { label: "Auto email", icon: Bot, cls: "auto" }, email: { label: "Email", icon: Mail, cls: "email" },
  text: { label: "Text", icon: MessageSquare, cls: "email" }, call: { label: "Call", icon: Phone, cls: "staff" },
  client: { label: "Client activity", icon: UserCheck, cls: "client" }, doc: { label: "Document", icon: FileText, cls: "doc" },
  staff: { label: "Staff", icon: UserCheck, cls: "staff" }, filed: { label: "Filed", icon: Gavel, cls: "filed" },
  pacer: { label: "PACER", icon: Landmark, cls: "pacer" },
};
const ROLE_LABEL = { attorney: "Attorney", paralegal: "Paralegal", staff: "Staff", system: "Auto", client: "Client" };
const srcCls = (s) => ({ "Client upload": "client", "Filed": "filed", "Court": "filed", "Signed": "sign", "Generated": "doc", "Completed": "ok", "Pending": "muted", "Trustee": "staff", "Closing": "sign" }[s] || "muted");
const CHAN = { email: Mail, text: MessageSquare, call: Phone };

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "payments", label: "Payments", icon: Receipt },
  { id: "docs", label: "Documents", icon: Paperclip },
  { id: "log", label: "Time log", icon: Clock },
  { id: "pacer", label: "Docket (PACER)", icon: Landmark },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "comms", label: "Communications", icon: MessagesSquare },
];

export default function ClientFile({ data = SAMPLE }) {
  const [tab, setTab] = useState("overview");
  const [log, setLog] = useState(data.log);
  const [cabinet, setCabinet] = useState(data.cabinet);
  const [pleadings, setPleadings] = useState(data.pleadings);
  const [tasks, setTasks] = useState(data.tasks);
  const [comms, setComms] = useState(data.comms);
  const [payments, setPayments] = useState(data.payments);
  const [rates, setRates] = useState(RATES_DEFAULT);
  const [stage, setStage] = useState(data.client.stage);
  const [status, setStatus] = useState(data.client.status);
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState("");
  const [cdraft, setCdraft] = useState(""); const [cchan, setCchan] = useState("email");
  const [pay, setPay] = useState(""); const [notifyLien, setNotifyLien] = useState(true);
  const closed = status.startsWith("Closed");

  const now = () => new Date();
  const stamp = () => ({ d: now().toISOString().slice(0, 10), t: now().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) });
  const prepend = (e) => setLog((p) => [{ ...stamp(), ...e }, ...p]);

  const enrich = (e) => { const billable = ROLE_BILLABLE[e.role]; const hrs = trackedHours(e.min); return { ...e, billable, hrs, amt: billable ? hrs * rates[e.role] : 0 }; };
  const rows = log.map(enrich);
  const billableHrs = rows.filter((r) => r.billable).reduce((a, r) => a + r.hrs, 0);
  const billableAmt = rows.filter((r) => r.billable).reduce((a, r) => a + r.amt, 0);
  const nonBillHrs = rows.filter((r) => !r.billable).reduce((a, r) => a + r.hrs, 0);

  const docItems = cabinet.flatMap((g) => g.items);
  const docsReceived = docItems.filter((i) => i.date).length;
  const paid = payments.history.filter((h) => h.status === "Paid").reduce((a, h) => a + h.amount, 0);
  const balance = payments.feeTotal - paid;
  const openTasks = tasks.filter((t) => !t.done).length;

  const shown = rows.filter((e) => filter === "all" || (filter === "corr" ? ["auto", "email", "text", "call"].includes(e.kind) : filter === "pacer" ? e.kind === "pacer" : filter === "client" ? e.kind === "client" : filter === "billable" ? e.billable : true));

  const addEntry = () => { if (!draft.trim()) return; prepend({ kind: "staff", role: "staff", actor: "You", text: draft.trim(), min: 6 }); setDraft(""); };
  const toggleTask = (i) => setTasks((p) => p.map((t, j) => j === i ? { ...t, done: !t.done } : t));
  const sendComm = () => {
    if (!cdraft.trim()) return;
    setComms((p) => [{ ...stamp(), dir: "out", channel: cchan, text: cdraft.trim() }, ...p]);
    prepend({ kind: cchan === "text" ? "text" : "email", role: "staff", actor: "You", text: `${cchan === "text" ? "Text" : "Email"} to client: ${cdraft.trim().slice(0, 60)}${cdraft.length > 60 ? "…" : ""}`, min: 6 });
    setCdraft("");
  };
  const recordPayment = () => {
    const amt = +pay; if (!amt) return;
    setPayments((p) => ({ ...p, history: [{ date: now().toISOString().slice(0, 10), amount: amt, method: "Manual entry", status: "Paid" }, ...p.history] }));
    prepend({ kind: "doc", role: "system", actor: "System", text: `Payment recorded: ${money(amt)}` }); setPay("");
  };
  const addPleading = (name) => setPleadings((p) => [...p, { name, status: "To file", date: null }]);
  const removePleading = (i) => setPleadings((p) => p.filter((_, j) => j !== i));
  const markFiled = (i) => { setPleadings((p) => p.map((pl, j) => j === i ? { ...pl, status: "Filed", date: now().toISOString().slice(0, 10) } : pl)); prepend({ kind: "filed", role: "attorney", actor: "You", text: `Filed pleading: ${pleadings[i].name}`, min: 12 }); };
  const closeCompleted = () => { prepend({ kind: "auto", role: "system", actor: "System", text: "File-closing letter emailed to client" }); if (notifyLien) prepend({ kind: "auto", role: "system", actor: "System", text: "Lienholder(s) notified of case closure" }); setStatus("Closed — completed"); setStage("closed"); };
  const closeCanceled = () => { prepend({ kind: "auto", role: "system", actor: "System", text: "Cancellation confirmation emailed to client; file closed" }); setStatus("Closed — client canceled"); setStage("closed"); };

  const curStage = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="cf">
      <Style />
      <div className="head">
        <div className="hl"><FolderOpen size={20} color="#6b1f2a" />
          <div><div className="hn">{data.client.name}</div>
            <div className="hm"><span className="caseno">{data.client.caseNo}</span> · {data.client.attorney} · {data.client.state} · Chapter {data.client.chapter} · <span className={"sbadge " + (closed ? "closed" : "open")}>{status}</span></div></div>
        </div>
        <div className="stats">
          <div className="st"><span className="sn">{money(balance)}</span><span className="sl">balance due</span></div>
          <div className="st"><span className="sn">{openTasks}</span><span className="sl">open tasks</span></div>
          <div className="st"><span className="sn">{docsReceived}/{docItems.length}</span><span className="sl">documents</span></div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}><t.icon size={14} /> {t.label}</button>)}
      </div>

      {tab === "overview" && (
        <div className="body">
          <div className="stepper">
            {STAGES.map((s, i) => {
              const st = closed ? (s.key === "closed" ? "now" : "done") : i < curStage ? "done" : i === curStage ? "now" : "todo";
              return <div className={"step " + st} key={s.key}><span className="dot">{st === "done" ? <Check size={12} /> : i + 1}</span><span className="slbl">{s.label}</span></div>;
            })}
          </div>
          <div className="ovgrid">
            <div className="ovcard"><span className="ovl">Current status</span><span className="ovv">{status}</span></div>
            <div className="ovcard"><span className="ovl">Filed</span><span className="ovv">{fmt(data.client.filingDate)}</span></div>
            <div className="ovcard"><span className="ovl">341 meeting</span><span className="ovv">{fmt(data.client.hearing)}</span></div>
            <div className="ovcard"><span className="ovl">Trustee</span><span className="ovv">{data.client.trustee}</span></div>
            <div className="ovcard"><span className="ovl">Attorney</span><span className="ovv">{data.client.attorney}</span></div>
            <div className="ovcard"><span className="ovl">Documents received</span><span className="ovv">{docsReceived} of {docItems.length}</span></div>
            <div className="ovcard"><span className="ovl">Balance due</span><span className="ovv">{money(balance)}</span></div>
            <div className="ovcard"><span className="ovl">Open tasks</span><span className="ovv">{openTasks}</span></div>
          </div>
          {!closed && (
            <div className="actions">
              <div className="al"><Archive size={14} /> Case actions</div>
              <div className="ar">
                <label className="lien"><input type="checkbox" checked={notifyLien} onChange={(e) => setNotifyLien(e.target.checked)} /> notify lienholder(s)</label>
                <button className="primary" onClick={closeCompleted}><Mail size={13} /> Close file &amp; email client</button>
                <button className="danger" onClick={closeCanceled}><Ban size={13} /> Close — client canceled</button>
              </div>
            </div>
          )}
          {closed && <div className="closedmsg"><CheckCircle2 size={14} /> {status} · closing letter saved to Documents</div>}
        </div>
      )}

      {tab === "payments" && (
        <div className="body">
          <div className="payrow">
            <div className="paycard"><span className="ovl">Flat fee</span><span className="payv">{money(payments.feeTotal)}</span></div>
            <div className="paycard ok"><span className="ovl">Paid</span><span className="payv">{money(paid)}</span></div>
            <div className="paycard due"><span className="ovl">Balance due</span><span className="payv">{money(balance)}</span></div>
          </div>
          <div className="cab">
            <div className="cabh">Invoice &amp; payment history<span className="cabn">{payments.history.length}</span></div>
            {payments.history.map((h, i) => (
              <div className="ci" key={i}>
                <div className="cimeta"><DollarSign size={14} /><span className="cin">{money(h.amount)} · {h.method}</span></div>
                <div className="ciright"><span className={"src " + (h.status === "Paid" ? "ok" : "muted")}>{h.status}</span><span className="cidate">{fmt(h.date)}</span></div>
              </div>
            ))}
            <div className="addrow" style={{ marginTop: 12 }}>
              <input type="number" value={pay} placeholder="Record a payment amount…" onChange={(e) => setPay(e.target.value)} />
              <button className="primary" onClick={recordPayment}><Plus size={13} /> Record payment</button>
            </div>
          </div>
        </div>
      )}

      {tab === "docs" && (
        <div className="body">
          <div className="note"><FileSignature size={13} /> {docsReceived} of {docItems.length} documents received. Everything submitted through the Document Portal lands here, alongside filed documents, PACER reports, the signed fee agreement, and the closing letter.</div>
          <div className="cab">
            <div className="cabh">Pleadings to file<span className="cabn">{pleadings.length}</span></div>
            <div className="tmpls"><span className="tl">Add from template:</span>{PLEADING_TEMPLATES.map((t) => <button key={t} className="tmpl" onClick={() => addPleading(t)}><FilePlus size={11} /> {t}</button>)}</div>
            {pleadings.map((p, i) => (
              <div className="ci" key={i}>
                <div className="cimeta"><ScrollText size={14} /><span className="cin">{p.name}</span></div>
                <div className="ciright"><span className={"src " + (p.status === "Filed" ? "filed" : "muted")}>{p.status === "Filed" ? `Filed ${fmt(p.date)}` : "To file"}</span>{p.status !== "Filed" && <button className="mini" onClick={() => markFiled(i)}>Mark filed</button>}<X size={13} className="rm" onClick={() => removePleading(i)} /></div>
              </div>
            ))}
          </div>
          {cabinet.map((g) => (
            <div className="cab" key={g.group}>
              <div className="cabh">{g.group}<span className="cabn">{g.items.filter((i) => i.date).length}/{g.items.length}</span></div>
              {g.items.map((it, i) => (
                <div className="ci" key={i}><div className="cimeta"><FileText size={14} /><span className="cin">{it.name}</span></div>
                  <div className="ciright"><span className={"src " + srcCls(it.src)}>{it.src}</span><span className="cidate">{fmt(it.date)}</span></div></div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === "log" && (
        <div className="body">
          <div className="note"><Bot size={13} /> Correspondence, automatic emails, PACER notices, and client activity are logged automatically with a timestamp. Each entry tracks time (0.2 hr minimum, then 0.1 hr increments) at the role rate. These totals drive the <b>end-of-representation fee look-back</b> — the reasonableness review (11 U.S.C. § 329 / Rule 2017) comparing accrued value against the flat fee charged. Staff can add manual entries.</div>
          <div className="bill">
            <div className="rates"><span className="rl">Rates ($/hr):</span>{["attorney", "paralegal", "staff"].map((r) => (<span className="rate" key={r}>{ROLE_LABEL[r]} <input type="number" value={rates[r]} min="0" step="5" onChange={(e) => setRates((p) => ({ ...p, [r]: +e.target.value || 0 }))} /></span>))}</div>
            <div className="totals"><div className="tt billable"><DollarSign size={14} /> Billable <b>{billableHrs.toFixed(1)} hr</b> · {money(billableAmt)}</div><div className="tt non"><Clock size={14} /> Non-billable <b>{nonBillHrs.toFixed(1)} hr</b></div><div className="tt look"><Scale size={14} /> Fee look-back: <b>{money(billableAmt)}</b> value vs {money(payments.feeTotal)} fee</div></div>
          </div>
          <div className="filters">{[["all", "All"], ["corr", "Correspondence"], ["pacer", "PACER"], ["client", "Client activity"], ["billable", "Billable"]].map(([k, l]) => (<button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>))}</div>
          <div className="addrow"><input value={draft} placeholder="Add a manual time-log entry…" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEntry()} /><button className="primary" onClick={addEntry}><Plus size={13} /> Add entry</button></div>
          {shown.map((e, i) => { const k = KINDS[e.kind]; const Icon = k.icon; return (
            <div className="le" key={i}>
              <div className="ld">{fmt(e.d)}<span className="lt">{e.t}</span></div>
              <div className={"lk " + k.cls}><Icon size={13} /></div>
              <div className="lbody"><span className="ltext">{e.text}</span><span className="lmeta"><span className={"kpill " + k.cls}>{k.label}</span> {e.actor}{(e.kind === "auto" || e.kind === "doc" || e.kind === "pacer") ? " · logged automatically" : ""}</span></div>
              <div className="lbill">{e.billable ? <><span className="bh">{e.hrs.toFixed(1)} hr</span><span className="ba">{money(e.amt)}</span><span className="brole">{ROLE_LABEL[e.role]}</span></> : <span className="nb">{e.hrs.toFixed(1)} hr · non-billable</span>}</div>
            </div>
          ); })}
        </div>
      )}

      {tab === "pacer" && (
        <div className="body">
          <div className="note"><Landmark size={13} /> PACER docket entries and creditor claims sync to the file and are saved in Documents. The assigned case number is captured from the Notice of Bankruptcy Case Filing.</div>
          <div className="cab"><div className="cabh">Docket entries<span className="cabn">{data.docket.length}</span></div>
            {data.docket.map((e, i) => (<div className="dk" key={i}><span className="dkno">#{e.no}</span><span className="dkdesc">{e.desc}</span><span className="dkdate">{fmt(e.date)}</span></div>))}
          </div>
          <div className="cab"><div className="cabh">Claims filed by creditors<span className="cabn">{data.claims.length}</span></div>
            {data.claims.map((c, i) => (<div className="cl" key={i}><div className="clmeta"><span className="cln">Claim {c.no} · {c.creditor}</span><span className={"clt " + c.type.toLowerCase()}>{c.type}</span></div><div className="clright"><span className="clamt">{money(c.amount)}</span><span className="cldate">{fmt(c.date)}</span></div></div>))}
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <div className="body">
          <div className="note"><ListChecks size={13} /> {openTasks} outstanding · {tasks.length - openTasks} completed. Click to toggle.</div>
          <div className="cab"><div className="cabh">Outstanding<span className="cabn">{openTasks}</span></div>
            {tasks.filter((t) => !t.done).map((t) => (<div className="tk" key={t.label} onClick={() => toggleTask(tasks.indexOf(t))}><Circle size={16} color="var(--muted)" /><span>{t.label}</span></div>))}
            {openTasks === 0 && <div className="tk"><CheckCircle2 size={16} color="var(--good)" /><span>All tasks complete.</span></div>}
          </div>
          <div className="cab"><div className="cabh">Completed<span className="cabn">{tasks.length - openTasks}</span></div>
            {tasks.filter((t) => t.done).map((t) => (<div className="tk done" key={t.label} onClick={() => toggleTask(tasks.indexOf(t))}><CheckCircle2 size={16} color="var(--good)" /><span>{t.label}</span></div>))}
          </div>
        </div>
      )}

      {tab === "comms" && (
        <div className="body">
          <div className="note"><MessagesSquare size={13} /> Full client communication history. Messages you send here are delivered to the client and logged to the time log automatically.</div>
          <div className="composer">
            <div className="chanrow">{["email", "text"].map((c) => (<button key={c} className={"chan " + (cchan === c ? "on" : "")} onClick={() => setCchan(c)}>{c === "email" ? <Mail size={13} /> : <MessageSquare size={13} />} {c[0].toUpperCase() + c.slice(1)}</button>))}</div>
            <textarea value={cdraft} placeholder={`Write ${cchan === "email" ? "an email" : "a text"} to the client…`} onChange={(e) => setCdraft(e.target.value)} />
            <button className="primary" onClick={sendComm}><Send size={13} /> Send {cchan}</button>
          </div>
          {comms.map((m, i) => { const Icon = CHAN[m.channel]; return (
            <div className={"msg " + m.dir} key={i}>
              <div className="mhead"><span className={"mdir " + m.dir}>{m.dir === "out" ? "Firm → Client" : "Client → Firm"}</span><span className="mchan"><Icon size={12} /> {m.channel}</span><span className="mdate">{fmt(m.d)} · {m.t}</span></div>
              {m.subject && <div className="msubj">{m.subject}</div>}
              <div className="mtext">{m.text}</div>
            </div>
          ); })}
        </div>
      )}

      <div className="foot"><Scale size={14} color="#6b1f2a" /> System of record: status, payments, documents, time, PACER, tasks, and every client communication — all in one file.</div>
    </div>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .cf * { box-sizing:border-box; }
    .cf { --oxblood:#6b1f2a; --oxblood-d:#54171f; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --good:#2f6b4f; --good-bg:#e4efe6; --warn:#9a5b16; --warn-bg:#f6ead7; --crit:#a23030; --crit-bg:#f3e0e0; --line:#ddd2c2; --calc:#2d5b8e; --calc-bg:#e4ecf5; --pur:#5b4a8a; --pur-bg:#e7e0f0; --teal:#1d6f6f; --teal-bg:#dcecec;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:22px; max-width:960px; margin:0 auto; }
    .cf .head { display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; }
    .cf .hl { display:flex; gap:11px; align-items:center; } .cf .hn { font-family:'Fraunces',serif; font-weight:600; font-size:20px; }
    .cf .hm { font-size:12.5px; color:var(--muted); margin-top:2px; }
    .cf .caseno { font-family:monospace; background:var(--paper-2); color:var(--ink); padding:1px 7px; border-radius:6px; }
    .cf .sbadge { font-weight:600; padding:1px 8px; border-radius:999px; } .cf .sbadge.open { background:var(--calc-bg); color:var(--calc); } .cf .sbadge.closed { background:var(--paper-2); color:var(--ink); }
    .cf .stats { display:flex; gap:10px; } .cf .st { background:#fffdf8; border:1px solid var(--line); border-radius:10px; padding:8px 14px; text-align:center; }
    .cf .st .sn { display:block; font-family:'Fraunces',serif; font-weight:600; font-size:18px; color:var(--oxblood); line-height:1; } .cf .st .sl { font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); }
    .cf .tabs { display:flex; gap:4px; margin-top:16px; border-bottom:1px solid var(--line); padding-bottom:12px; flex-wrap:wrap; }
    .cf .tabs button { border:1px solid var(--line); background:#fffdf8; border-radius:9px; padding:8px 13px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; color:var(--muted); display:inline-flex; gap:6px; align-items:center; }
    .cf .tabs button.on { background:var(--oxblood); color:#fff; border-color:var(--oxblood); }
    .cf .body { padding-top:16px; }
    .cf .note { font-size:12.5px; color:var(--muted); background:var(--paper-2); border-radius:9px; padding:10px 13px; line-height:1.5; display:flex; gap:8px; align-items:flex-start; margin-bottom:14px; }
    .cf .stepper { display:flex; gap:4px; flex-wrap:wrap; margin-bottom:16px; }
    .cf .step { flex:1; min-width:104px; display:flex; flex-direction:column; gap:6px; align-items:center; text-align:center; padding:10px 6px; border-radius:10px; border:1px solid var(--line); background:#fffdf8; }
    .cf .step .dot { width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; background:var(--paper-2); color:var(--muted); }
    .cf .step .slbl { font-size:11.5px; font-weight:600; color:var(--muted); }
    .cf .step.done .dot { background:var(--good-bg); color:var(--good); } .cf .step.done .slbl { color:var(--ink); }
    .cf .step.now { border-color:var(--oxblood); background:#efe2e4; } .cf .step.now .dot { background:var(--oxblood); color:#fff; } .cf .step.now .slbl { color:var(--oxblood); }
    .cf .ovgrid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
    .cf .ovcard { background:#fffdf8; border:1px solid var(--line); border-radius:11px; padding:11px 13px; }
    .cf .ovl { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); } .cf .ovv { display:block; font-weight:600; font-size:13.5px; margin-top:3px; }
    .cf .actions { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; background:#fffdf8; border:1px solid var(--line); border-radius:11px; padding:11px 15px; margin-top:14px; }
    .cf .al { font-weight:600; font-size:13px; display:flex; gap:7px; align-items:center; color:var(--oxblood); } .cf .ar { display:flex; gap:9px; align-items:center; flex-wrap:wrap; }
    .cf .lien { font-size:12.5px; color:var(--muted); display:flex; gap:6px; align-items:center; }
    .cf .closedmsg { font-size:12.5px; font-weight:600; color:var(--good); display:flex; gap:7px; align-items:center; margin-top:14px; background:var(--good-bg); padding:11px 14px; border-radius:10px; }
    .cf .payrow { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:14px; }
    .cf .paycard { background:#fffdf8; border:1px solid var(--line); border-radius:11px; padding:13px 15px; } .cf .paycard.ok { background:var(--good-bg); border-color:var(--good); } .cf .paycard.due { background:var(--warn-bg); border-color:var(--warn); }
    .cf .payv { display:block; font-family:'Fraunces',serif; font-weight:600; font-size:22px; margin-top:3px; }
    .cf button.primary { border:none; background:var(--oxblood); color:#fff; border-radius:8px; padding:9px 14px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; display:inline-flex; gap:6px; align-items:center; white-space:nowrap; } .cf button.primary:hover { background:var(--oxblood-d); }
    .cf button.danger { border:1px solid var(--crit); background:#fff; color:var(--crit); border-radius:8px; padding:9px 14px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; display:inline-flex; gap:6px; align-items:center; } .cf button.danger:hover { background:var(--crit-bg); }
    .cf .addrow { display:flex; gap:8px; } .cf .addrow input { flex:1; border:1px solid var(--line); border-radius:8px; padding:9px 12px; font:inherit; font-size:13px; background:#fffdf8; }
    .cf .cab { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:4px 16px 12px; margin-bottom:11px; }
    .cf .cabh { font-family:'Fraunces',serif; font-weight:600; font-size:14px; color:var(--oxblood); padding:12px 0 8px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; }
    .cf .cabn { font-size:11px; font-weight:700; color:var(--muted); background:var(--paper-2); padding:2px 9px; border-radius:999px; }
    .cf .ci { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--paper-2); } .cf .ci:last-child { border-bottom:none; }
    .cf .cimeta { display:flex; gap:9px; align-items:center; color:var(--muted); } .cf .cin { font-size:13.5px; font-weight:500; color:var(--ink); }
    .cf .ciright { display:flex; gap:9px; align-items:center; flex:none; }
    .cf .src { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:2px 8px; border-radius:999px; }
    .cf .src.client { background:var(--good-bg); color:var(--good); } .cf .src.filed { background:#efe2e4; color:var(--oxblood); } .cf .src.sign { background:var(--warn-bg); color:var(--warn); } .cf .src.doc { background:var(--calc-bg); color:var(--calc); } .cf .src.ok { background:var(--good-bg); color:var(--good); } .cf .src.muted { background:var(--paper-2); color:var(--muted); } .cf .src.staff { background:var(--pur-bg); color:var(--pur); }
    .cf .cidate { font-size:12px; color:var(--muted); min-width:92px; text-align:right; }
    .cf .mini { border:1px solid var(--oxblood); background:#fff; color:var(--oxblood); border-radius:7px; padding:4px 9px; font:inherit; font-weight:600; font-size:11px; cursor:pointer; }
    .cf .rm { cursor:pointer; color:var(--muted); } .cf .rm:hover { color:var(--crit); }
    .cf .tmpls { display:flex; gap:6px; flex-wrap:wrap; align-items:center; padding:10px 0 4px; } .cf .tmpls .tl { font-size:11.5px; color:var(--muted); font-weight:600; }
    .cf .tmpl { border:1px dashed var(--oxblood); background:#fff; color:var(--oxblood); border-radius:7px; padding:5px 9px; font:inherit; font-weight:600; font-size:11.5px; cursor:pointer; display:inline-flex; gap:5px; align-items:center; }
    .cf .bill { background:#fffdf8; border:1px solid var(--line); border-radius:11px; padding:12px 15px; margin-bottom:13px; display:flex; justify-content:space-between; gap:14px; flex-wrap:wrap; align-items:center; }
    .cf .rates { display:flex; gap:12px; align-items:center; flex-wrap:wrap; font-size:12.5px; color:var(--muted); } .cf .rates .rl { font-weight:600; color:var(--ink); }
    .cf .rate { display:inline-flex; gap:5px; align-items:center; color:var(--ink); font-weight:500; } .cf .rate input { width:62px; border:1px solid var(--line); border-radius:7px; padding:5px 7px; font:inherit; font-size:12.5px; background:var(--paper); }
    .cf .totals { display:flex; gap:10px; flex-wrap:wrap; } .cf .tt { font-size:13px; padding:7px 12px; border-radius:9px; display:inline-flex; gap:7px; align-items:center; } .cf .tt b { font-weight:700; } .cf .tt.billable { background:var(--good-bg); color:var(--good); } .cf .tt.non { background:var(--paper-2); color:var(--muted); } .cf .tt.look { background:#efe2e4; color:var(--oxblood); }
    .cf .filters { display:flex; gap:5px; margin:0 0 10px; flex-wrap:wrap; } .cf .filters button { border:1px solid var(--line); background:#fffdf8; border-radius:8px; padding:6px 12px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; color:var(--muted); } .cf .filters button.on { background:var(--oxblood); color:#fff; border-color:var(--oxblood); }
    .cf .le { display:grid; grid-template-columns:118px 30px 1fr auto; gap:12px; align-items:start; padding:12px 0; border-top:1px solid var(--paper-2); }
    .cf .ld { font-size:12px; font-weight:600; } .cf .lt { display:block; font-size:11px; color:var(--muted); font-weight:400; }
    .cf .lk { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; }
    .cf .lk.auto { background:var(--pur-bg); color:var(--pur); } .cf .lk.email { background:var(--calc-bg); color:var(--calc); } .cf .lk.client { background:var(--good-bg); color:var(--good); } .cf .lk.doc { background:var(--warn-bg); color:var(--warn); } .cf .lk.staff { background:var(--paper-2); color:var(--ink); } .cf .lk.filed { background:#efe2e4; color:var(--oxblood); } .cf .lk.pacer { background:var(--teal-bg); color:var(--teal); }
    .cf .ltext { display:block; font-size:13.5px; font-weight:500; } .cf .lmeta { font-size:11.5px; color:var(--muted); margin-top:3px; display:inline-flex; gap:6px; align-items:center; flex-wrap:wrap; }
    .cf .kpill { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:2px 7px; border-radius:999px; }
    .cf .kpill.auto { background:var(--pur-bg); color:var(--pur); } .cf .kpill.email { background:var(--calc-bg); color:var(--calc); } .cf .kpill.client { background:var(--good-bg); color:var(--good); } .cf .kpill.doc { background:var(--warn-bg); color:var(--warn); } .cf .kpill.staff { background:var(--paper-2); color:var(--ink); } .cf .kpill.filed { background:#efe2e4; color:var(--oxblood); } .cf .kpill.pacer { background:var(--teal-bg); color:var(--teal); }
    .cf .lbill { text-align:right; min-width:90px; } .cf .lbill .bh { display:block; font-size:13px; font-weight:600; } .cf .lbill .ba { display:block; font-size:12.5px; font-weight:600; color:var(--good); } .cf .lbill .brole { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); } .cf .lbill .nb { font-size:11px; color:var(--muted); }
    .cf .dk { display:grid; grid-template-columns:46px 1fr auto; gap:10px; align-items:center; padding:9px 0; border-bottom:1px solid var(--paper-2); } .cf .dk:last-child { border-bottom:none; }
    .cf .dkno { font-family:monospace; font-weight:600; font-size:12px; color:var(--oxblood); } .cf .dkdesc { font-size:13px; } .cf .dkdate { font-size:11.5px; color:var(--muted); }
    .cf .cl { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--paper-2); } .cf .cl:last-child { border-bottom:none; }
    .cf .clmeta { display:flex; gap:8px; align-items:center; } .cf .cln { font-size:13px; font-weight:500; } .cf .clt { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:2px 7px; border-radius:999px; }
    .cf .clt.unsecured { background:var(--paper-2); color:var(--muted); } .cf .clt.priority { background:var(--warn-bg); color:var(--warn); } .cf .clt.secured { background:#efe2e4; color:var(--oxblood); }
    .cf .clright { display:flex; gap:12px; align-items:center; } .cf .clamt { font-weight:600; font-size:13px; } .cf .cldate { font-size:11.5px; color:var(--muted); }
    .cf .tk { display:flex; gap:9px; align-items:center; padding:10px 0; border-bottom:1px solid var(--paper-2); font-size:13.5px; cursor:pointer; } .cf .tk:last-child { border-bottom:none; } .cf .tk.done span { color:var(--muted); text-decoration:line-through; }
    .cf .composer { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin-bottom:14px; }
    .cf .chanrow { display:flex; gap:6px; margin-bottom:9px; } .cf .chan { border:1px solid var(--line); background:var(--paper); border-radius:8px; padding:6px 12px; font:inherit; font-weight:600; font-size:12px; cursor:pointer; color:var(--muted); display:inline-flex; gap:6px; align-items:center; } .cf .chan.on { background:var(--oxblood); color:#fff; border-color:var(--oxblood); }
    .cf .composer textarea { width:100%; min-height:70px; border:1px solid var(--line); border-radius:8px; padding:10px 12px; font:inherit; font-size:13px; background:var(--paper); resize:vertical; margin-bottom:9px; }
    .cf .msg { border:1px solid var(--line); border-radius:11px; padding:11px 14px; margin-bottom:9px; background:#fffdf8; } .cf .msg.out { border-left:3px solid var(--oxblood); border-radius:0 11px 11px 0; } .cf .msg.in { border-left:3px solid var(--calc); border-radius:0 11px 11px 0; }
    .cf .mhead { display:flex; gap:10px; align-items:center; flex-wrap:wrap; font-size:11px; color:var(--muted); margin-bottom:5px; } .cf .mdir { font-weight:700; } .cf .mdir.out { color:var(--oxblood); } .cf .mdir.in { color:var(--calc); }
    .cf .mchan { display:inline-flex; gap:4px; align-items:center; text-transform:capitalize; } .cf .mdate { margin-left:auto; }
    .cf .msubj { font-weight:600; font-size:13.5px; margin-bottom:2px; } .cf .mtext { font-size:13px; line-height:1.5; }
    .cf .foot { font-size:12.5px; font-weight:500; background:var(--paper-2); border-radius:10px; padding:12px 14px; margin-top:14px; display:flex; gap:8px; align-items:center; }
    @media(max-width:760px){ .cf .ovgrid{grid-template-columns:1fr 1fr;} .cf .payrow{grid-template-columns:1fr;} .cf .le{grid-template-columns:84px 26px 1fr;} .cf .lbill{grid-column:1 / -1; text-align:left; margin-top:4px;} .cf .stats{width:100%;} }
  `}</style>;
}
