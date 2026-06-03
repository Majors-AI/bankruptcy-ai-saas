import React, { useState, useMemo } from "react";
import { Users, AlertTriangle, CheckCircle2, UserCheck } from "lucide-react";
import ConfirmFooter from "./ConfirmFooter";

/* Creditor Matrix — Official Form 101 Creditor/Interested-Party List.
   Aggregates every named party from Schedules D, E/F, G, and H, lets the
   client review and optionally exclude entries (with reason), and gates
   the Next button behind ConfirmFooter.

   CONTROLLED — reads data.creditorMatrix.overrides for saved state.
   On any change calls onChange({ overrides: {...} }).

   Wire at the call site:
     <CreditorMatrix
       data={questionnaireData}
       onChange={(cm) => updateSection("creditorMatrix", cm)}
       confirmed={summaryConfirmed}
       onConfirm={onSummaryConfirm}
     />

   Address key reference (confirmed from form source):
     D / E / F  : addr1 + city + state + zip   (separate parts, street = addr1)
     G          : addr  + city + state + zip   (addr = street only, has separate city/state/zip)
     H codebtors: addr  (combined string, no separate city/state/zip)
     H priorSpouses: addr (combined); state = marriage-state, NOT part of mailing address
     Collector on E/F: collectorAddr + collectorCity + collectorState + collectorZip
*/

// ── Address helpers ──────────────────────────────────────────────────────────

function fmtAddr(row) {
  // G-style: addr is street but city/state/zip are also present as separate fields
  if (row.addr && (row.city || row.state || row.zip)) {
    return [row.addr, row.city, row.state, row.zip].filter(Boolean).join(", ");
  }
  // H-style: addr is the full combined string (no city/state/zip siblings)
  if (row.addr) return row.addr;
  // D/E/F-style: addr1 as street + separate city/state/zip
  return [row.addr1, row.city, row.state, row.zip].filter(Boolean).join(", ");
}

function fmtCollectorAddr(row) {
  return [row.collectorAddr, row.collectorCity, row.collectorState, row.collectorZip]
    .filter(Boolean).join(", ");
}

// ── Stable ID ────────────────────────────────────────────────────────────────

function mkId(schedule, index, name) {
  const slug = (name || "").toLowerCase().replace(/\W+/g, "-").slice(0, 32);
  return `${schedule}-${index}-${slug}`;
}

// ── Aggregator ───────────────────────────────────────────────────────────────

function buildCreditorParties(data) {
  const parties = [];

  // Schedule D — secured creditors
  (data.schedD?.creditors || []).forEach((c, i) => {
    if (!c.name) return;
    parties.push({
      id:       mkId("D", i, c.name),
      schedule: "D",
      role:     "Secured",
      name:     c.name,
      addr:     fmtAddr(c),
      badge:    c.acct ? `acct ···${c.acct}` : null,
    });
  });

  // Schedule E — priority creditors
  (data.schedEF_pri?.creditors || []).forEach((c, i) => {
    if (!c.name) return;
    parties.push({
      id:       mkId("E", i, c.name),
      schedule: "E",
      role:     "Priority",
      name:     c.name,
      addr:     fmtAddr(c),
      badge:    c.acct ? `acct ···${c.acct}` : null,
    });
    if (c.hasCollector === "yes" && c.collectorName) {
      parties.push({
        id:       mkId("E-col", i, c.collectorName),
        schedule: "E",
        role:     "Priority",
        name:     c.collectorName,
        addr:     fmtCollectorAddr(c),
        note:     `Collection agency for ${c.name}`,
      });
    }
  });

  // Schedule E — tax debts (separate taxDebts array, no name field — use _authorityId)
  (data.schedEF_pri?.taxDebts || []).forEach((t, i) => {
    const name = t.name || t._authorityId || "Tax Authority";
    parties.push({
      id:       mkId("E-tax", i, name),
      schedule: "E",
      role:     "Priority",
      name:     name,
      addr:     fmtAddr(t),
      note:     t.taxType ? `Tax · ${t.taxType.replace(/_/g, " ")}` : "Tax debt",
    });
  });

  // Schedule F — non-priority unsecured creditors
  (data.schedEF_np?.creditors || []).forEach((c, i) => {
    if (!c.name) return;
    parties.push({
      id:       mkId("F", i, c.name),
      schedule: "F",
      role:     "Unsecured",
      name:     c.name,
      addr:     fmtAddr(c),
      badge:    c.acct ? `acct ···${c.acct}` : null,
    });
    if (c.hasCollector === "yes" && c.collectorName) {
      parties.push({
        id:       mkId("F-col", i, c.collectorName),
        schedule: "F",
        role:     "Unsecured",
        name:     c.collectorName,
        addr:     fmtCollectorAddr(c),
        note:     `Collection agency for ${c.name}`,
      });
    }
  });

  // Schedule G — executory contracts / unexpired leases
  // addr = street only; city/state/zip are separate fields
  (data.schedG?.contracts || []).forEach((c, i) => {
    if (!c.name) return;
    parties.push({
      id:       mkId("G", i, c.name),
      schedule: "G",
      role:     "Contract/Lease",
      name:     c.name,
      addr:     fmtAddr(c),
      note:     c.contractType || c.description || null,
    });
  });

  // Schedule H — codebtors (addr is a single combined string)
  (data.schedH?.codebtors || []).forEach((c, i) => {
    if (!c.name) return;
    parties.push({
      id:       mkId("H", i, c.name),
      schedule: "H",
      role:     "Codebtor",
      name:     c.name,
      addr:     c.addr || "",
      note:     c.relationship || null,
    });
  });

  // Schedule H — former spouses / community-property disclosures
  // addr = combined mailing address; state = state-of-marriage (NOT part of address)
  (data.schedH?.priorSpouses || []).forEach((s, i) => {
    if (!s.name) return;
    parties.push({
      id:       mkId("H-sp", i, s.name),
      schedule: "H",
      role:     "Former Spouse",
      name:     s.name,
      addr:     s.addr || "",
      note:     s.endReason
        ? `${s.endReason}${s.divorceYear ? " · " + s.divorceYear : ""}`
        : "Former spouse — community property disclosure",
    });
  });

  return parties;
}

// ── Debtor helper ─────────────────────────────────────────────────────────────

function deriveDebtors(data) {
  const pd = data.petition || {};
  const name1 = [pd.firstName, pd.lastName].filter(Boolean).join(" ");
  const ft = pd.filingType;
  const debtors = [];
  if (name1) debtors.push({ name: name1, role: ft === "joint" ? "Debtor 1" : "Debtor" });
  if (ft === "joint" || ft === "individual-nonfiling-spouse") {
    const name2 = [pd.spouseFirst, pd.spouseLast].filter(Boolean).join(" ");
    if (name2) debtors.push({
      name: name2,
      role: ft === "joint" ? "Debtor 2" : "Non-filing Spouse",
    });
  }
  return debtors;
}

// ── Role display meta ─────────────────────────────────────────────────────────

const ROLE_META = {
  "Secured":        { cls: "sch-d", label: "D · Secured" },
  "Priority":       { cls: "sch-e", label: "E · Priority" },
  "Unsecured":      { cls: "sch-f", label: "F · Unsecured" },
  "Contract/Lease": { cls: "sch-g", label: "G · Contract" },
  "Codebtor":       { cls: "sch-h", label: "H · Codebtor" },
  "Former Spouse":  { cls: "sch-h", label: "H · Fmr. Spouse" },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreditorMatrix({
  data = {},
  onChange,
  confirmed,
  onConfirm,
}) {
  const saved = data.creditorMatrix || {};
  const [overrides, setOverrides] = useState(saved.overrides || {});
  const [filter, setFilter]       = useState("all");

  const parties = useMemo(() => buildCreditorParties(data), [data]);
  const debtors = useMemo(() => deriveDebtors(data), [data]);

  const emit = (next) => onChange && onChange({ ...saved, overrides: next });

  const isIncluded = (id) => overrides[id]?.included !== false;

  const toggle = (id, included) => {
    const next = { ...overrides, [id]: { ...(overrides[id] || {}), included } };
    setOverrides(next); emit(next);
  };

  const setReason = (id, reason) => {
    const next = { ...overrides, [id]: { ...(overrides[id] || {}), reason } };
    setOverrides(next); emit(next);
  };

  const SCHEDULES   = ["D", "E", "F", "G", "H"];
  const filtered    = filter === "all" ? parties : parties.filter((p) => p.schedule === filter);
  const includedCnt = parties.filter((p) => isIncluded(p.id)).length;
  const excludedCnt = parties.length - includedCnt;

  return (
    <div className="cm">
      <Style />

      <div className="cm-head">
        <h1><Users size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Creditor Matrix</h1>
        <div className="cm-form">
          Creditor &amp; Interested-Party List &middot; compiled from your schedules
          {debtors.length > 0 && <> &middot; {debtors.map((d) => d.name).join(" & ")}</>}
        </div>
      </div>

      <div className="cm-intro">
        <b>Every creditor, contract counterparty, and codebtor listed in your schedules must receive written notice of your filing.</b> The court uses this matrix to mail all case notices. Review each entry — if one is wrong or belongs to a different person, exclude it and give a reason so your attorney can investigate.
        <div className="cm-intro-sub">These names and addresses are pulled directly from your Schedule D, E/F, G, and H answers. Entries marked <b className="cm-warn-inline">(no address on file)</b> must be corrected before the case is filed.</div>
      </div>

      {/* Stats bar */}
      <div className="cm-stats">
        <div className="cm-stat"><span className="cm-n">{parties.length}</span><span className="cm-l">Total parties</span></div>
        <div className="cm-stat"><span className="cm-n">{includedCnt}</span><span className="cm-l">Included</span></div>
        {excludedCnt > 0 && (
          <div className="cm-stat cm-stat-warn"><span className="cm-n">{excludedCnt}</span><span className="cm-l">Excluded</span></div>
        )}
      </div>

      {/* Filter bar */}
      <div className="cm-filters">
        <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>
          All <span className="cm-fc">{parties.length}</span>
        </button>
        {SCHEDULES.map((s) => {
          const cnt = parties.filter((p) => p.schedule === s).length;
          return cnt === 0 ? null : (
            <button key={s} className={filter === s ? "on" : ""} onClick={() => setFilter(s)}>
              Sched.&nbsp;{s} <span className="cm-fc">{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* Party list */}
      {parties.length === 0 ? (
        <div className="cm-empty">
          No creditors or parties found yet. Complete Schedules D, E/F, G, and H — this matrix populates automatically from those answers.
        </div>
      ) : filtered.length === 0 ? (
        <div className="cm-empty">No entries from Schedule {filter}.</div>
      ) : filtered.map((p) => {
        const inc  = isIncluded(p.id);
        const meta = ROLE_META[p.role] || { cls: "sch-d", label: p.role };
        return (
          <div className={"cm-entry" + (inc ? "" : " cm-excl")} key={p.id}>
            <div className="cm-entry-top">
              <div className="cm-entry-info">
                <span className="cm-name">{p.name}</span>
                <span className={"cm-pill " + meta.cls}>{meta.label}</span>
                {p.badge && <span className="cm-badge">{p.badge}</span>}
              </div>
              <div className="cm-yn">
                <button type="button" className={inc ? "on" : ""} onClick={() => toggle(p.id, true)}>Include</button>
                <button type="button" className={!inc ? "on warn" : ""} onClick={() => toggle(p.id, false)}>Exclude</button>
              </div>
            </div>
            <div className="cm-addr">
              {p.addr
                ? p.addr
                : <span className="cm-no-addr">(no address on file &mdash; must be corrected before filing)</span>}
            </div>
            {p.note && <div className="cm-note">{p.note}</div>}
            {!inc && (
              <div className="cm-excl-block">
                <div className="cm-warn-msg">
                  <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                  This party will <b>not</b> receive court notice of your filing. Creditors who are not listed may retain the ability to collect after discharge. Confirm the reason with your attorney before submitting.
                </div>
                <label className="cm-reason-lbl">
                  Reason for exclusion
                  <textarea
                    value={overrides[p.id]?.reason || ""}
                    placeholder="e.g. duplicate entry, belongs to a different person, attorney to investigate&hellip;"
                    onChange={(e) => setReason(p.id, e.target.value)}
                  />
                </label>
              </div>
            )}
          </div>
        );
      })}

      {/* Debtor verification block */}
      <div className="cm-verify">
        <div className="cm-verify-h"><UserCheck size={16} />Debtor verification</div>
        <div className="cm-verify-sub">The debtors below must sign the creditor matrix at Final Review before submission.</div>
        {debtors.length === 0 ? (
          <div className="cm-micro">Complete the Voluntary Petition to populate debtor names here.</div>
        ) : debtors.map((d, i) => (
          <div className="cm-verify-row" key={i}>
            <span className="cm-verify-name">{d.name}</span>
            <span className="cm-verify-role">{d.role}</span>
            <span className="cm-verify-status">
              <CheckCircle2 size={13} style={{ verticalAlign: -2 }} /> Signature collected at Final Review
            </span>
          </div>
        ))}
      </div>

      <ConfirmFooter
        confirmed={confirmed}
        onConfirm={onConfirm}
        sectionLabel="creditor matrix"
      />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function Style() {
  return <style>{`
    .cm * { box-sizing:border-box; }
    .cm {
      --accent:#fbbf24; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8; --warn:#fcd34d; --warn-bg:rgba(251,191,36,.10);
      --good:#4ade80; --good-bg:rgba(74,222,128,.10);
      --d:#60a5fa; --d-bg:rgba(96,165,250,.12);
      --e:#fb923c; --e-bg:rgba(251,146,60,.12);
      --f:#f472b6; --f-bg:rgba(244,114,182,.12);
      --g:#a78bfa; --g-bg:rgba(167,139,250,.12);
      --h:#34d399; --h-bg:rgba(52,211,153,.12);
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:860px; margin:16px auto 0;
    }
    .cm h1 { font-family:var(--serif); font-weight:600; font-size:24px; margin:0; color:#fff; }
    .cm-form { color:var(--muted); font-size:13px; margin-top:2px; }
    .cm-intro { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:15px 18px; margin-top:16px; font-size:14px; line-height:1.5; }
    .cm-intro-sub { color:var(--muted); font-size:13px; margin-top:7px; }
    .cm-warn-inline { color:var(--warn); font-style:normal; }
    .cm-stats { display:flex; gap:10px; margin-top:14px; flex-wrap:wrap; }
    .cm-stat { background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:10px 16px; min-width:90px; }
    .cm-stat-warn { border-color:rgba(251,191,36,.4); background:var(--warn-bg); }
    .cm-n { display:block; font-family:var(--serif); font-weight:700; font-size:22px; color:#fff; }
    .cm-stat-warn .cm-n { color:var(--warn); }
    .cm-l { display:block; font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; margin-top:1px; }
    .cm-filters { display:flex; gap:6px; flex-wrap:wrap; margin-top:14px; }
    .cm-filters button { border:1px solid var(--line); background:var(--bg-2); border-radius:8px; padding:6px 13px; font:inherit; font-size:13px; font-weight:600; cursor:pointer; color:var(--muted); display:inline-flex; align-items:center; gap:6px; transition:all .15s; }
    .cm-filters button.on { border-color:var(--accent); color:var(--accent); background:rgba(251,191,36,.08); }
    .cm-fc { font-size:11px; background:var(--line); border-radius:999px; padding:1px 6px; color:var(--muted); }
    .cm-empty { color:var(--muted); font-size:14px; font-style:italic; padding:28px 0; text-align:center; }
    .cm-entry { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:14px 18px; margin-top:10px; }
    .cm-entry.cm-excl { border-color:rgba(251,191,36,.4); background:rgba(251,191,36,.03); }
    .cm-entry-top { display:flex; align-items:flex-start; gap:12px; justify-content:space-between; flex-wrap:wrap; }
    .cm-entry-info { display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex:1; min-width:0; }
    .cm-name { font-weight:700; font-size:14.5px; color:#fff; }
    .cm-pill { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:2px 8px; border-radius:999px; white-space:nowrap; }
    .sch-d { background:var(--d-bg); color:var(--d); }
    .sch-e { background:var(--e-bg); color:var(--e); }
    .sch-f { background:var(--f-bg); color:var(--f); }
    .sch-g { background:var(--g-bg); color:var(--g); }
    .sch-h { background:var(--h-bg); color:var(--h); }
    .cm-badge { font-size:11px; color:var(--muted); font-weight:600; padding:2px 8px; border:1px solid var(--line); border-radius:999px; }
    .cm-yn { display:inline-flex; gap:5px; flex:none; }
    .cm-yn button { border:1px solid var(--line); background:var(--bg-2); border-radius:8px; padding:5px 13px; font:inherit; font-weight:600; font-size:12.5px; cursor:pointer; color:var(--muted); transition:all .15s; }
    .cm-yn button.on { background:var(--good); color:#052e16; border-color:var(--good); }
    .cm-yn button.on.warn { background:var(--warn); color:#1c1407; border-color:var(--warn); }
    .cm-addr { font-size:13px; color:var(--ink); margin-top:7px; line-height:1.4; }
    .cm-no-addr { color:var(--warn); font-style:normal; font-weight:600; font-size:12.5px; }
    .cm-note { font-size:12px; color:var(--muted); margin-top:4px; font-style:italic; }
    .cm-excl-block { margin-top:12px; border-top:1px dashed rgba(251,191,36,.25); padding-top:12px; display:flex; flex-direction:column; gap:10px; }
    .cm-warn-msg { display:flex; gap:8px; align-items:flex-start; font-size:12.5px; color:var(--warn); background:var(--warn-bg); border:1px solid rgba(251,191,36,.25); border-radius:8px; padding:10px 12px; line-height:1.5; }
    .cm-warn-msg b { color:#fff; }
    .cm-reason-lbl { display:block; font-size:13px; font-weight:600; color:var(--ink); }
    .cm-reason-lbl textarea { display:block; width:100%; min-height:52px; margin-top:6px; border:1px solid var(--line); border-radius:8px; padding:8px 11px; font:inherit; font-size:13px; background:var(--bg-2); color:var(--ink); resize:vertical; }
    .cm-reason-lbl textarea::placeholder { color:var(--muted); }
    .cm-verify { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:15px 18px; margin-top:18px; }
    .cm-verify-h { font-family:var(--serif); font-weight:600; font-size:15px; color:var(--accent); display:flex; gap:8px; align-items:center; margin-bottom:4px; }
    .cm-verify-sub { font-size:12.5px; color:var(--muted); margin-bottom:10px; }
    .cm-verify-row { display:grid; grid-template-columns:1fr auto auto; gap:8px 16px; align-items:center; font-size:13.5px; padding:8px 0; border-bottom:1px solid var(--line-soft); }
    .cm-verify-name { font-weight:700; color:#fff; }
    .cm-verify-role { font-size:11.5px; color:var(--muted); font-weight:600; white-space:nowrap; }
    .cm-verify-status { font-size:12px; color:var(--good); display:flex; align-items:center; gap:5px; white-space:nowrap; }
    .cm-micro { font-size:12px; color:var(--muted); font-style:italic; }
    @media(max-width:580px){
      .cm-entry-top { flex-direction:column; }
      .cm-yn { width:100%; }
      .cm-verify-row { grid-template-columns:1fr; gap:3px; }
    }
  `}</style>;
}
