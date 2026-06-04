import React, { useState, useMemo } from "react";
import {
  ClipboardList, CalendarDays, Inbox, Users, AlertTriangle, Bell, Mail, MessageSquareText,
  CheckCircle2, Circle, X, Plus, FolderCheck, GraduationCap, Send, Settings2, Scale, Gavel
} from "lucide-react";

/* Trustee Document Portal — staff-facing. Consolidated to four tabs:
   Task List · Calendar · Review Queue · Trustees.
   (Firm Trustees removed; 341 Checklist + API Config merged into Trustees.)
   Preview sample data — bind to live case/trustee data at runtime. */

const TODAY = new Date("2026-06-03");
const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const daysFrom = (d) => Math.round((new Date(d) - TODAY) / 86400000);

const CASES = [
  { name: "Robert Chen", caseNo: "2:26-bk-03994-DRB", attorney: "David A. Birdsell", state: "AZ", chapter: 7, hearing: "2026-05-10", docsDue: "2026-04-30", uploaded: 2, total: 7, sent: 5, lastFollowup: "2026-05-03", secondCourse: false,
    hearingStatus: "concluded", postPetition: ["Trustee demand: amended Schedule A/B — undisclosed timeshare"], pendingTasks: ["File amended Schedule A/B"], exam2004: false,
    missing: ["Last 2 years tax returns", "Mortgage statement or lease agreement", "Most recent pay stubs (60 days)", "Social Security card or proof of SSN", "Vehicle title(s)"] },
  { name: "Patricia Nguyen", caseNo: "2:26-bk-07134-KAE", attorney: "Kathryn A. Ellis", state: "WA", chapter: 7, hearing: "2026-05-13", docsDue: "2026-05-03", uploaded: 6, total: 7, sent: 4, lastFollowup: "2026-05-03", secondCourse: true,
    hearingStatus: "concluded", postPetition: [], pendingTasks: [], exam2004: false, missing: ["Vehicle title(s)"] },
  { name: "Margaret Torres", caseNo: "2:26-bk-04821-DRB", attorney: "David A. Birdsell", state: "AZ", chapter: 7, hearing: "2026-05-16", docsDue: "2026-05-06", uploaded: 5, total: 7, sent: 3, lastFollowup: "2026-05-02", secondCourse: false,
    hearingStatus: "continued", postPetition: ["Trustee demand: 2023 federal tax return"], pendingTasks: ["Provide 2023 return to trustee"], exam2004: false, missing: ["Social Security card or proof of SSN", "Vehicle title(s)"] },
  { name: "Kevin Park", caseNo: "2:26-bk-05877-JWA", attorney: "Jason Wilson-Aguilar", state: "WA", chapter: 13, hearing: "2026-06-09", docsDue: "2026-05-30", uploaded: 4, total: 7, sent: 3, lastFollowup: "2026-05-02", secondCourse: false,
    hearingStatus: "scheduled", postPetition: [], pendingTasks: [], exam2004: false, missing: ["Last 4 years tax returns", "Pay stubs — all employers (60 days)", "Proof of all income sources"] },
  { name: "James Kowalski", caseNo: "2:26-bk-05560-RB", attorney: "Russell A. Brown", state: "AZ", chapter: 13, hearing: "2026-06-12", docsDue: "2026-06-02", uploaded: 4, total: 8, sent: 2, lastFollowup: "2026-05-01", secondCourse: false,
    hearingStatus: "scheduled", postPetition: ["Trustee demand: business P&L (self-employed)"], pendingTasks: ["Schedule 2004 exam prep"], exam2004: true, missing: ["Last 60 days pay stubs", "Monthly expense documentation", "Profit & Loss statement (self-employed)", "Proof of current income (all sources)"] },
];

const HEARINGS = [
  { name: "David Okonkwo", date: "2026-06-09", chapter: 7, state: "WA", status: "Open", docsOverdue: 4 },
  { name: "Kevin Park", date: "2026-06-09", chapter: 13, state: "WA" },
  { name: "James Kowalski", date: "2026-06-12", chapter: 13, state: "AZ" },
  { name: "Sandra Williams", date: "2026-06-11", chapter: 13, state: "AZ" },
  { name: "Maria Santos", date: "2026-06-18", chapter: 13, state: "WA" },
];

const REVIEW = [
  { name: "Maria Santos", caseNo: "2:26-bk-06215-JWA", attorney: "Jason Wilson-Aguilar", state: "WA", chapter: 13, hearing: "2026-06-18", docsReady: "7/7" },
  { name: "Sandra Williams", caseNo: "2:26-bk-02187-RB", attorney: "Russell A. Brown", state: "AZ", chapter: 13, hearing: "2026-06-11", docsReady: "8/8" },
];

const STAFF_GROUPS = ["Intake Paralegals", "Senior Paralegals", "Attorney Review"];

const DOC_CATALOG = [
  { statement: "§ 109(h) / § 727 — Courses", docs: ["Pre-filing credit counseling certificate", "Financial management course (post-filing)"] },
  { statement: "Identity — all cases", docs: ["Government photo ID (front & back)", "Social Security card"] },
  { statement: "Voluntary Petition — Form 101", docs: ["Signed voluntary petition"] },
  { statement: "Schedule A/B — Property", docs: ["Deed / title — real property", "Vehicle registration (per vehicle)", "Vehicle insurance declarations", "Account statements — brokerage / crypto / retirement", "Insurance / annuity declarations (incl. cash value)"] },
  { statement: "Schedule C — Exemptions", docs: ["Documentation supporting claimed exemptions"] },
  { statement: "Schedule D — Secured debts", docs: ["Mortgage statement — current month", "Auto-loan statement / payoff (per vehicle)"] },
  { statement: "Schedule E/F — Creditors", docs: ["Domestic-support order", "Creditor statements"] },
  { statement: "Schedule I — Income", docs: ["Pay stubs — last 6 months (all employers)"] },
  { statement: "Schedule J — Expenses", docs: ["HOA statement / dues", "Monthly expense documentation"] },
  { statement: "Statement of Financial Affairs — Form 107", docs: ["Divorce decree(s) — legal history", "Business / P&L documents (if self-employed)"] },
  { statement: "Means Test — Form 122", docs: ["Bank statements — last 6 months", "Non-filing spouse income verification", "Tax returns"] },
  { statement: "At signing — Schedule A/B", docs: ["Signing-day balance — per non-exempt account"] },
];
const ALL_DOCS = DOC_CATALOG.flatMap((g) => g.docs);

const TRUSTEES_SEED = [
  { name: "David A. Birdsell", state: "AZ", chapter: 7, email: "dabtrustee@hotmail.com", api: false, docs: ["Signed voluntary petition", "Government photo ID (front & back)", "Social Security card", "Pay stubs — last 6 months (all employers)", "Tax returns", "Bank statements — last 6 months"], instructions: "Email PDF packet to submission address 7 days before the 341." },
  { name: "Jason Wilson-Aguilar", state: "WA", chapter: 13, email: "courtmail@seattech13.com", api: false, docs: ["Signed voluntary petition", "Government photo ID (front & back)", "Social Security card", "Pay stubs — last 6 months (all employers)", "Tax returns", "Bank statements — last 6 months", "Business / P&L documents (if self-employed)", "Domestic-support order"], instructions: "Email; Chapter 13 plan + business docs required for self-employed." },
  { name: "Kathryn A. Ellis", state: "WA", chapter: 7, email: "kae@seanet.com", api: false, docs: ["Signed voluntary petition", "Government photo ID (front & back)", "Social Security card", "Tax returns", "Bank statements — last 6 months"], instructions: "Email PDF to submission address." },
  { name: "Russell A. Brown", state: "AZ", chapter: 13, email: "mail@ch13bk.com", api: false, docs: ["Signed voluntary petition", "Government photo ID (front & back)", "Social Security card", "Pay stubs — last 6 months (all employers)", "Bank statements — last 6 months", "Monthly expense documentation"], instructions: "Email; include monthly expense documentation." },
];

const TABS = [
  { id: "tasks", label: "Task List", icon: ClipboardList },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "review", label: "Review Queue", icon: Inbox },
  { id: "trustees", label: "Trustees", icon: Users },
];

export default function TrusteeDocumentPortal() {
  const [tab, setTab] = useState("tasks");
  return (
    <div className="tp">
      <Style />
      <div className="head">
        <div><Scale size={18} style={{ verticalAlign: -3, marginRight: 7 }} /><b>Trustee Document Portal</b>
          <span className="sub">341 hearings · tasks · paralegal review · submission</span></div>
        <div className="tabs">{TABS.map((t) => <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}><t.icon size={14} /> {t.label}</button>)}</div>
      </div>
      {tab === "tasks" && <Tasks />}
      {tab === "calendar" && <Calendar />}
      {tab === "review" && <Review />}
      {tab === "trustees" && <Trustees />}
    </div>
  );
}

/* ===================== TASK LIST ===================== */
function Tasks() {
  const [filter, setFilter] = useState("all");
  const [cases, setCases] = useState(CASES.map((c) => ({ ...c, missing: [...c.missing], flagged: {}, auto: true, pushed: 0, postPetition: [...c.postPetition], pendingTasks: [...c.pendingTasks] })));
  const [drafts, setDrafts] = useState({});
  const setD = (k, v) => setDrafts((p) => ({ ...p, [k]: v }));

  const docsNeeded = cases.reduce((a, c) => a + c.missing.length, 0);
  const upcoming = HEARINGS.filter((h) => { const d = daysFrom(h.date); return d >= 0 && d <= 31; });
  const sev = (c) => { const d = daysFrom(c.hearing); return d < 0 ? "overdue" : d <= 10 ? "critical" : "elevated"; };
  const counts = { critical: cases.filter((c) => sev(c) === "critical").length, elevated: cases.filter((c) => sev(c) === "elevated").length, overdue: cases.filter((c) => sev(c) === "overdue").length };
  const shown = cases.filter((c) => filter === "all" || sev(c) === filter);

  const removeDoc = (ci, doc) => setCases((p) => p.map((c, i) => i === ci ? { ...c, missing: c.missing.filter((m) => m !== doc) } : c));
  const flagDoc = (ci, doc) => setCases((p) => p.map((c, i) => i === ci ? { ...c, flagged: { ...c.flagged, [doc]: !c.flagged[doc] } } : c));
  const toggleAuto = (ci) => setCases((p) => p.map((c, i) => i === ci ? { ...c, auto: !c.auto } : c));
  const pushNow = (ci) => setCases((p) => p.map((c, i) => i === ci ? { ...c, sent: c.sent + 1, pushed: c.pushed + 1 } : c));
  const setHearing = (ci, s) => setCases((p) => p.map((c, i) => i === ci ? { ...c, hearingStatus: s } : c));
  const toggle2004 = (ci) => setCases((p) => p.map((c, i) => i === ci ? { ...c, exam2004: !c.exam2004 } : c));
  const addItem = (ci, key, val) => { if (!val || !val.trim()) return; setCases((p) => p.map((c, i) => i === ci ? { ...c, [key]: [...c[key], val.trim()] } : c)); };
  const removeItem = (ci, key, val) => setCases((p) => p.map((c, i) => i === ci ? { ...c, [key]: c[key].filter((x) => x !== val) } : c));

  return (
    <div className="body">
      {/* Status bar */}
      <div className="statusbar">
        <div className="stat"><AlertTriangle size={16} /><div><span className="sn">{docsNeeded}</span><span className="sl">trustee docs still needed</span></div></div>
        <div className="stat"><CalendarDays size={16} /><div><span className="sn">{upcoming.length}</span><span className="sl">341 hearings next 30 days</span></div></div>
        <div className="upc">
          {upcoming.sort((a, b) => new Date(a.date) - new Date(b.date)).map((h, i) => (
            <span className="upchip" key={i}>{fmt(h.date)} · {h.name} (Ch.{h.chapter})</span>
          ))}
        </div>
      </div>

      <div className="cadence">
        <Bell size={13} /> <b>Automatic reminders</b> run on this cadence: initial hearing email → recurring email requests until complete → docs due <b>10 days before the 341</b> → day-of <b>text</b> to client → email with a copy of filed documents → on completion saved to the <b>File Cabinet</b> with a reference + 2nd-course (Financial Management) reminder. Staff can <b>push a reminder manually</b> anytime; every send is logged to the client file <b>time log</b>.
      </div>

      <div className="rowhead">
        <h2>Active Case Task List</h2>
        <div className="filters">
          {["all", "critical", "elevated", "overdue"].map((f) => (
            <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)}{f !== "all" && ` (${counts[f]})`}
            </button>
          ))}
        </div>
      </div>

      {shown.map((c, ci) => {
        const realIdx = cases.indexOf(c);
        const d = daysFrom(c.hearing);
        const warn = d <= 10;
        return (
          <div className={"case " + sev(c)} key={c.caseNo}>
            <div className="cmain">
              <div className="cinfo">
                <div className="cname"><span className={"dot " + sev(c)} />{c.name}<span className="cno">{c.caseNo}</span>
                  {warn && <span className="badge crit"><AlertTriangle size={11} /> {d < 0 ? "Hearing passed — docs overdue" : `341 in ${d}d — immediate`}</span>}
                  {!c.secondCourse && <span className="badge course"><GraduationCap size={11} /> 2nd course due</span>}
                </div>
                <div className="cmeta">{c.attorney} · {c.state} · <span className="chap">Chapter {c.chapter}</span> · 341 {fmt(c.hearing)} ({d < 0 ? `${-d}d ago` : `in ${d}d`}) · docs due {fmt(c.docsDue)}</div>

                <div className="cstatus">
                  <span className="slabel">341 hearing:</span>
                  {["scheduled", "continued", "concluded"].map((s) => (
                    <button key={s} className={"hbtn " + (c.hearingStatus === s ? "on " + s : "")} onClick={() => setHearing(realIdx, s)}>{s[0].toUpperCase() + s.slice(1)}</button>
                  ))}
                  <button className={"hbtn x2004 " + (c.exam2004 ? "on" : "")} onClick={() => toggle2004(realIdx)}><Gavel size={11} /> 2004 exam</button>
                </div>

                <div className="missing">
                  <span className="ml">{c.missing.length} missing — click to flag for update, × to remove:</span>
                  {c.missing.map((m) => (
                    <span key={m} className={"mchip " + (c.flagged[m] ? "flagged" : "")} onClick={() => flagDoc(realIdx, m)}>
                      {m}<X size={11} className="rm" onClick={(e) => { e.stopPropagation(); removeDoc(realIdx, m); }} />
                    </span>
                  ))}
                  {c.missing.length === 0 && <span className="alldone"><CheckCircle2 size={13} /> all documents received</span>}
                  <span className="addinline">
                    <input placeholder="Add a document (undisclosed / corrected)…" value={drafts[`${realIdx}:missing`] || ""} onChange={(e) => setD(`${realIdx}:missing`, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { addItem(realIdx, "missing", e.target.value); setD(`${realIdx}:missing`, ""); } }} />
                    <button onClick={() => { addItem(realIdx, "missing", drafts[`${realIdx}:missing`] || ""); setD(`${realIdx}:missing`, ""); }}><Plus size={11} /> Add</button>
                  </span>
                </div>

                <div className="postpet">
                  <div className="ppcol">
                    <span className="ppl">Post-petition issues / trustee demands</span>
                    <div className="ppchips">
                      {c.postPetition.length === 0 && <span className="ppnone">none raised</span>}
                      {c.postPetition.map((it) => (
                        <span key={it} className="ppchip demand">{it}<X size={11} className="rm" onClick={() => removeItem(realIdx, "postPetition", it)} /></span>
                      ))}
                      <span className="addinline sm">
                        <input placeholder="Add issue / trustee demand…" value={drafts[`${realIdx}:pp`] || ""} onChange={(e) => setD(`${realIdx}:pp`, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { addItem(realIdx, "postPetition", e.target.value); setD(`${realIdx}:pp`, ""); } }} />
                        <button onClick={() => { addItem(realIdx, "postPetition", drafts[`${realIdx}:pp`] || ""); setD(`${realIdx}:pp`, ""); }}><Plus size={11} /></button>
                      </span>
                    </div>
                  </div>
                  <div className="ppcol">
                    <span className="ppl">Pending tasks</span>
                    <div className="ppchips">
                      {c.pendingTasks.length === 0 && <span className="ppnone">none</span>}
                      {c.pendingTasks.map((it) => (
                        <span key={it} className="ppchip task">{it}<X size={11} className="rm" onClick={() => removeItem(realIdx, "pendingTasks", it)} /></span>
                      ))}
                      <span className="addinline sm">
                        <input placeholder="Add task…" value={drafts[`${realIdx}:pt`] || ""} onChange={(e) => setD(`${realIdx}:pt`, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { addItem(realIdx, "pendingTasks", e.target.value); setD(`${realIdx}:pt`, ""); } }} />
                        <button onClick={() => { addItem(realIdx, "pendingTasks", drafts[`${realIdx}:pt`] || ""); setD(`${realIdx}:pt`, ""); }}><Plus size={11} /></button>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bar"><div className="fill" style={{ width: `${(c.uploaded / c.total) * 100}%` }} /></div>
                <div className="cfoot">{c.uploaded}/{c.total} docs · last follow-up {fmt(c.lastFollowup)} · {c.sent} sent
                  {c.auto && <> · <span className="auton">auto-reminder on — next tomorrow 8:00 AM</span></>} · all sends logged to client file{c.pushed ? ` · ${c.pushed} manual push${c.pushed > 1 ? "es" : ""}` : ""}</div>
              </div>
              <div className="cactions">
                <button className={"toggle " + (c.auto ? "on" : "")} onClick={() => toggleAuto(realIdx)}><Bell size={12} /> Auto {c.auto ? "on" : "off"}</button>
                <button className="primary" onClick={() => pushNow(realIdx)}><Send size={13} /> Push reminder now</button>
                <button className="ghost"><Mail size={13} /> Email</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===================== CALENDAR ===================== */
function Calendar() {
  const first = new Date(2026, 5, 1).getDay();   // June 1 2026
  const days = 30;
  const byDay = {};
  HEARINGS.forEach((h) => { const day = new Date(h.date).getDate(); (byDay[day] = byDay[day] || []).push(h); });
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const upcoming = HEARINGS.filter((h) => daysFrom(h.date) >= 0).sort((a, b) => new Date(a.date) - new Date(b.date));
  return (
    <div className="body cal">
      <div className="calwrap">
        <h2 style={{ textAlign: "center" }}>June 2026</h2>
        <div className="weekrow">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="wd">{d}</div>)}</div>
        <div className="grid">
          {cells.map((day, i) => (
            <div className={"cell " + (day === TODAY.getDate() ? "today" : "")} key={i}>
              {day && <span className="dn">{day}</span>}
              {day && (byDay[day] || []).map((h, j) => <div key={j} className="ev">{h.name} {h.chapter}</div>)}
            </div>
          ))}
        </div>
      </div>
      <div className="side">
        <h3>Upcoming 341 hearings</h3>
        <div className="sidesub">Next 30 days · {upcoming.length} scheduled</div>
        {upcoming.map((h, i) => (
          <div className="hcard" key={i}>
            <div className="hn">{h.name}<span className="hin">{daysFrom(h.date)}d</span></div>
            <div className="hmeta">{fmt(h.date)} · Ch.{h.chapter} · {h.state} {h.docsOverdue ? <span className="hover">Docs overdue {h.docsOverdue}d</span> : null}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== REVIEW QUEUE ===================== */
function Review() {
  const [items, setItems] = useState(REVIEW.map((r) => ({ ...r, stage: "ready", group: "", priority: "Normal", confirmed: false })));
  const set = (i, patch) => setItems((p) => p.map((x, j) => j === i ? { ...x, ...patch } : x));
  const tabCount = (s) => items.filter((x) => x.stage === s).length;
  const [view, setView] = useState("ready");
  const shown = items.map((x, i) => ({ x, i })).filter(({ x }) => view === "all" || x.stage === view);

  return (
    <div className="body">
      <div className="rowhead">
        <h2>Paralegal Review Queue</h2>
        <div className="filters">
          {[["ready", "Ready"], ["in_review", "In Review"], ["approved", "Approved"], ["all", "All"]].map(([k, l]) => (
            <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}{k !== "all" && ` (${tabCount(k)})`}</button>
          ))}
        </div>
      </div>
      <div className="cadence"><AlertTriangle size={13} /> Submission APIs aren't enabled yet — staff review each packet to confirm it's correct, then <b>manually assign</b> to a prioritized staff group for submission.</div>

      {shown.map(({ x, i }) => (
        <div className="rev" key={x.caseNo}>
          <div className="revhead">
            <div><span className="cname">{x.name}<span className="cno">{x.caseNo}</span></span>
              <div className="cmeta">{x.attorney} · {x.state} · Chapter {x.chapter} · 341 {fmt(x.hearing)} ({daysFrom(x.hearing)}d) · {x.docsReady} docs ready</div>
            </div>
            {x.stage === "ready" && <button className="primary" onClick={() => set(i, { stage: "in_review" })}>Start review</button>}
            {x.stage === "in_review" && <span className="badge rev">In review</span>}
            {x.stage === "approved" && <span className="badge ok"><CheckCircle2 size={11} /> Approved · {x.group} · {x.priority}</span>}
          </div>

          {x.stage === "in_review" && (
            <div className="revbody">
              <label className="conf" onClick={() => set(i, { confirmed: !x.confirmed })}>
                {x.confirmed ? <CheckCircle2 size={16} color="var(--oxblood)" /> : <Circle size={16} color="var(--line)" />} I confirmed every document is present and correct
              </label>
              <div className="assign">
                <span>Assign to:</span>
                <select value={x.group} onChange={(e) => set(i, { group: e.target.value })}>
                  <option value="">Select staff group…</option>
                  {STAFF_GROUPS.map((g) => <option key={g}>{g}</option>)}
                </select>
                <select value={x.priority} onChange={(e) => set(i, { priority: e.target.value })}>
                  {["High", "Normal", "Low"].map((p) => <option key={p}>{p}</option>)}
                </select>
                <button className="primary" disabled={!x.confirmed || !x.group} onClick={() => set(i, { stage: "approved" })}>Approve &amp; assign</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ===================== TRUSTEES (consolidated) ===================== */
function Trustees() {
  const [list, setList] = useState(TRUSTEES_SEED);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", state: "AZ", chapter: 7, email: "" });

  const toggleDoc = (ti, doc) => setList((p) => p.map((t, i) => i === ti
    ? { ...t, docs: t.docs.includes(doc) ? t.docs.filter((s) => s !== doc) : [...t.docs, doc] } : t));
  const toggleApi = (ti) => setList((p) => p.map((t, i) => i === ti ? { ...t, api: !t.api } : t));
  const addTrustee = () => {
    if (!draft.name) return;
    setList((p) => [...p, { ...draft, api: false, docs: ["Signed voluntary petition", "Government photo ID (front & back)", "Social Security card"], instructions: "" }]);
    setDraft({ name: "", state: "AZ", chapter: 7, email: "" }); setAdding(false);
  };

  return (
    <div className="body">
      <div className="rowhead">
        <h2>Trustees</h2>
        <button className="primary" onClick={() => setAdding((v) => !v)}><Plus size={13} /> Add trustee</button>
      </div>
      <div className="cadence"><Settings2 size={13} /> Configure, per trustee, the exact documents required — broken down from the client Document Portal and grouped by the <b>statement / schedule each was filed under</b> — plus submission instructions and method (email today, API when enabled). The 341 checklist and API config now live here.</div>

      {adding && (
        <div className="addcard">
          <input placeholder="Trustee name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input placeholder="Submission email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          <select value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })}>{["AZ", "WA"].map((s) => <option key={s}>{s}</option>)}</select>
          <select value={draft.chapter} onChange={(e) => setDraft({ ...draft, chapter: +e.target.value })}>{[7, 13].map((c) => <option key={c} value={c}>Chapter {c}</option>)}</select>
          <button className="primary" onClick={addTrustee}>Save</button>
        </div>
      )}

      {list.map((t, ti) => (
        <div className="tcard" key={ti}>
          <div className="thead">
            <div><span className="cname">{t.name}</span><span className="cmeta"> · {t.state} · <span className="chap">Chapter {t.chapter}</span> · {t.email}</span></div>
            <button className={"apibtn " + (t.api ? "on" : "")} onClick={() => toggleApi(ti)}>{t.api ? "API submission: ON" : "Email submission · Enable API"}</button>
          </div>
          <div className="tsub">341 document breakdown — select the documents this trustee requires, grouped by the statement each was filed under ({t.docs.length} of {ALL_DOCS.length} selected):</div>
          <div className="catalog">
            {DOC_CATALOG.map((g) => (
              <div className="catgrp" key={g.statement}>
                <div className="catst">{g.statement}</div>
                <div className="catdocs">
                  {g.docs.map((doc) => {
                    const on = t.docs.includes(doc);
                    return (
                      <span key={doc} className={"dchip " + (on ? "on" : "")} onClick={() => toggleDoc(ti, doc)}>
                        {on ? <CheckCircle2 size={12} /> : <Circle size={12} />} {doc}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="catgrp">
              <div className="catst">Trustee-specific forms</div>
              <div className="catdocs"><span className="dchip future"><Circle size={12} /> Custom forms (coming soon)</span></div>
            </div>
          </div>
          <div className="tinstr"><b>Submission instructions:</b> {t.instructions || <span className="muted">— add instructions —</span>}</div>
        </div>
      ))}
    </div>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .tp * { box-sizing:border-box; }
    .tp { --oxblood:#6b1f2a; --oxblood-d:#54171f; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --good:#2f6b4f; --good-bg:#e4efe6; --warn:#9a5b16; --warn-bg:#f6ead7; --crit:#a23030; --crit-bg:#f3e0e0; --line:#ddd2c2; --calc:#2d5b8e; --calc-bg:#e4ecf5;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:18px; max-width:1080px; margin:0 auto; }
    .tp .head { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; border-bottom:1px solid var(--line); padding-bottom:12px; }
    .tp .head b { font-family:'Fraunces',serif; font-size:18px; }
    .tp .head .sub { color:var(--muted); font-size:12px; margin-left:10px; }
    .tp .tabs { display:flex; gap:4px; flex-wrap:wrap; }
    .tp .tabs button { border:1px solid var(--line); background:#fffdf8; border-radius:9px; padding:7px 13px; font:inherit; font-weight:600; font-size:13px; cursor:pointer; color:var(--muted); display:inline-flex; gap:6px; align-items:center; }
    .tp .tabs button.on { background:var(--oxblood); color:#fff; border-color:var(--oxblood); }
    .tp .body { padding-top:16px; }
    .tp h2 { font-family:'Fraunces',serif; font-weight:600; font-size:19px; margin:0; }
    .tp h3 { font-family:'Fraunces',serif; font-weight:600; font-size:15px; margin:0 0 2px; }
    .tp .statusbar { display:flex; gap:14px; align-items:center; flex-wrap:wrap; background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
    .tp .stat { display:flex; gap:9px; align-items:center; color:var(--oxblood); padding-right:14px; border-right:1px solid var(--line); }
    .tp .stat .sn { font-family:'Fraunces',serif; font-weight:600; font-size:22px; display:block; line-height:1; }
    .tp .stat .sl { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
    .tp .upc { display:flex; gap:6px; flex-wrap:wrap; }
    .tp .upchip { font-size:11.5px; font-weight:600; background:var(--paper-2); color:var(--ink); padding:4px 9px; border-radius:999px; }
    .tp .cadence { font-size:12.5px; color:var(--muted); background:var(--paper-2); border-radius:9px; padding:10px 13px; margin:12px 0; line-height:1.5; display:flex; gap:8px; align-items:flex-start; }
    .tp .cadence b { color:var(--ink); }
    .tp .rowhead { display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap; margin:14px 0 8px; }
    .tp .filters { display:flex; gap:5px; }
    .tp .filters button { border:1px solid var(--line); background:#fffdf8; border-radius:8px; padding:6px 12px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; color:var(--muted); }
    .tp .filters button.on { background:var(--oxblood); color:#fff; border-color:var(--oxblood); }
    .tp .case { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:14px 16px; margin-bottom:10px; border-left:4px solid var(--line); }
    .tp .case.critical, .tp .case.overdue { border-left-color:var(--crit); }
    .tp .case.elevated { border-left-color:var(--warn); }
    .tp .cmain { display:flex; gap:16px; justify-content:space-between; align-items:flex-start; }
    .tp .cinfo { flex:1; min-width:0; }
    .tp .cname { font-weight:700; font-size:15px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .tp .dot { width:9px; height:9px; border-radius:50%; background:var(--muted); }
    .tp .dot.critical, .tp .dot.overdue { background:var(--crit); } .tp .dot.elevated { background:var(--warn); }
    .tp .cno { font-size:11px; color:var(--muted); font-weight:500; background:var(--paper-2); padding:2px 7px; border-radius:6px; font-family:monospace; }
    .tp .badge { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; padding:2px 8px; border-radius:999px; display:inline-flex; gap:4px; align-items:center; }
    .tp .badge.crit { background:var(--crit-bg); color:var(--crit); } .tp .badge.course { background:var(--warn-bg); color:var(--warn); }
    .tp .badge.rev { background:var(--calc-bg); color:var(--calc); } .tp .badge.ok { background:var(--good-bg); color:var(--good); }
    .tp .cmeta { font-size:12.5px; color:var(--muted); margin-top:4px; } .tp .chap { color:var(--calc); font-weight:600; }
    .tp .missing { margin-top:9px; display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
    .tp .ml { font-size:11.5px; color:var(--crit); font-weight:600; width:100%; }
    .tp .mchip { font-size:11.5px; font-weight:500; background:#fff; border:1px solid var(--crit); color:var(--crit); padding:3px 8px; border-radius:7px; cursor:pointer; display:inline-flex; gap:5px; align-items:center; }
    .tp .mchip.flagged { background:var(--crit); color:#fff; }
    .tp .mchip .rm { opacity:.7; } .tp .mchip .rm:hover { opacity:1; }
    .tp .alldone { font-size:12.5px; color:var(--good); font-weight:600; display:inline-flex; gap:5px; align-items:center; }
    .tp .cstatus { display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:10px; }
    .tp .slabel { font-size:11.5px; color:var(--muted); font-weight:600; }
    .tp .hbtn { border:1px solid var(--line); background:var(--paper); border-radius:7px; padding:4px 10px; font:inherit; font-weight:600; font-size:11.5px; cursor:pointer; color:var(--muted); display:inline-flex; gap:5px; align-items:center; }
    .tp .hbtn.on.scheduled { background:var(--calc-bg); color:var(--calc); border-color:var(--calc); }
    .tp .hbtn.on.continued { background:var(--warn-bg); color:var(--warn); border-color:var(--warn); }
    .tp .hbtn.on.concluded { background:var(--good-bg); color:var(--good); border-color:var(--good); }
    .tp .hbtn.x2004 { margin-left:6px; } .tp .hbtn.x2004.on { background:#efe2e4; color:var(--oxblood); border-color:var(--oxblood); }
    .tp .addinline { display:inline-flex; gap:5px; align-items:center; }
    .tp .addinline input { border:1px solid var(--line); border-radius:7px; padding:4px 8px; font:inherit; font-size:11.5px; background:var(--paper); min-width:210px; }
    .tp .addinline.sm input { min-width:150px; }
    .tp .addinline button { border:1px dashed var(--oxblood); background:#fff; color:var(--oxblood); border-radius:7px; padding:4px 9px; font:inherit; font-weight:600; font-size:11px; cursor:pointer; display:inline-flex; gap:4px; align-items:center; }
    .tp .postpet { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:11px; background:var(--paper); border:1px solid var(--paper-2); border-radius:9px; padding:10px 12px; }
    .tp .ppl { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); display:block; margin-bottom:6px; }
    .tp .ppchips { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
    .tp .ppnone { font-size:11.5px; color:var(--muted); }
    .tp .ppchip { font-size:11.5px; font-weight:500; padding:3px 8px; border-radius:7px; display:inline-flex; gap:5px; align-items:center; }
    .tp .ppchip.demand { background:#efe2e4; color:var(--oxblood); border:1px solid var(--oxblood); }
    .tp .ppchip.task { background:var(--warn-bg); color:var(--warn); }
    .tp .ppchip .rm { cursor:pointer; opacity:.7; } .tp .ppchip .rm:hover { opacity:1; }
    .tp .bar { height:6px; background:var(--paper-2); border-radius:999px; margin-top:10px; overflow:hidden; }
    .tp .fill { height:100%; background:var(--oxblood); border-radius:999px; }
    .tp .cfoot { font-size:11.5px; color:var(--muted); margin-top:6px; }
    .tp .auton { color:var(--good); font-weight:600; }
    .tp button.toggle { border:1px solid var(--line); background:var(--paper); border-radius:8px; padding:7px 11px; font:inherit; font-weight:600; font-size:12px; cursor:pointer; color:var(--muted); display:inline-flex; gap:6px; align-items:center; justify-content:center; }
    .tp button.toggle.on { background:var(--good-bg); color:var(--good); border-color:var(--good); }
    .tp .cactions { display:flex; flex-direction:column; gap:7px; flex:none; }
    .tp button.primary { border:none; background:var(--oxblood); color:#fff; border-radius:8px; padding:8px 13px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; display:inline-flex; gap:6px; align-items:center; white-space:nowrap; }
    .tp button.primary:hover { background:var(--oxblood-d); } .tp button.primary:disabled { background:var(--line); cursor:not-allowed; }
    .tp button.ghost { border:1px solid var(--line); background:#fffdf8; border-radius:8px; padding:8px 13px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; color:var(--muted); display:inline-flex; gap:6px; align-items:center; }
    /* calendar */
    .tp .cal { display:grid; grid-template-columns:1fr 300px; gap:16px; }
    .tp .calwrap { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:14px; }
    .tp .weekrow, .tp .grid { display:grid; grid-template-columns:repeat(7,1fr); }
    .tp .wd { text-align:center; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); padding:6px 0; }
    .tp .cell { min-height:70px; border:1px solid var(--paper-2); padding:4px; font-size:11px; }
    .tp .cell.today { background:var(--calc-bg); }
    .tp .dn { color:var(--muted); }
    .tp .ev { background:var(--oxblood); color:#fff; border-radius:5px; padding:2px 5px; margin-top:3px; font-size:10.5px; font-weight:600; }
    .tp .side { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:14px; }
    .tp .sidesub { font-size:11.5px; color:var(--muted); margin-bottom:10px; }
    .tp .hcard { border-top:1px solid var(--paper-2); padding:9px 0; }
    .tp .hn { font-weight:600; font-size:13.5px; display:flex; justify-content:space-between; }
    .tp .hin { font-size:10.5px; font-weight:700; background:var(--crit-bg); color:var(--crit); padding:1px 7px; border-radius:999px; }
    .tp .hmeta { font-size:11.5px; color:var(--muted); margin-top:2px; }
    .tp .hover { color:var(--crit); font-weight:600; }
    /* review */
    .tp .rev { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:13px 16px; margin-bottom:10px; }
    .tp .revhead { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; }
    .tp .revbody { margin-top:12px; border-top:1px solid var(--paper-2); padding-top:12px; }
    .tp .conf { display:flex; gap:8px; align-items:center; font-size:13.5px; font-weight:600; cursor:pointer; }
    .tp .assign { display:flex; gap:8px; align-items:center; margin-top:12px; flex-wrap:wrap; font-size:13px; font-weight:600; }
    .tp .assign select { border:1px solid var(--line); border-radius:8px; padding:7px 10px; font:inherit; font-size:13px; background:var(--paper); }
    /* trustees */
    .tp .addcard { background:#fffdf8; border:1px dashed var(--oxblood); border-radius:12px; padding:12px; margin-bottom:12px; display:flex; gap:8px; flex-wrap:wrap; }
    .tp .addcard input, .tp .addcard select { border:1px solid var(--line); border-radius:8px; padding:8px 10px; font:inherit; font-size:13px; background:var(--paper); }
    .tp .tcard { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:14px 16px; margin-bottom:10px; }
    .tp .thead { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
    .tp .apibtn { border:1px solid var(--line); background:var(--paper); border-radius:8px; padding:6px 12px; font:inherit; font-weight:600; font-size:12px; cursor:pointer; color:var(--muted); }
    .tp .apibtn.on { background:var(--good-bg); color:var(--good); border-color:var(--good); }
    .tp .tsub { font-size:11.5px; color:var(--muted); margin:11px 0 7px; }
    .tp .secs { display:flex; gap:7px; flex-wrap:wrap; }
    .tp .sec { font-size:12px; font-weight:600; border:1px solid var(--line); border-radius:8px; padding:5px 10px; cursor:pointer; color:var(--muted); display:inline-flex; gap:5px; align-items:center; background:var(--paper); }
    .tp .sec.on { background:#efe2e4; color:var(--oxblood); border-color:var(--oxblood); }
    .tp .sec.future { opacity:.55; cursor:default; }
    .tp .catalog { display:flex; flex-direction:column; gap:10px; }
    .tp .catst { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--oxblood); margin-bottom:5px; }
    .tp .catdocs { display:flex; gap:6px; flex-wrap:wrap; }
    .tp .dchip { font-size:11.5px; font-weight:500; border:1px solid var(--line); border-radius:8px; padding:5px 9px; cursor:pointer; color:var(--muted); display:inline-flex; gap:5px; align-items:center; background:var(--paper); }
    .tp .dchip.on { background:#efe2e4; color:var(--oxblood); border-color:var(--oxblood); }
    .tp .dchip.future { opacity:.55; cursor:default; }
    .tp .tinstr { font-size:12.5px; margin-top:11px; color:var(--ink); } .tp .tinstr .muted { color:var(--muted); }
    @media(max-width:820px){ .tp .cal{grid-template-columns:1fr;} .tp .cmain{flex-direction:column;} .tp .postpet{grid-template-columns:1fr;} }
  `}</style>;
}
