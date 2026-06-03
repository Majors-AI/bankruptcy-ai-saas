import React, { useMemo } from "react";
import { Users } from "lucide-react";
import ConfirmFooter from "./ConfirmFooter";

/* Schedule H — Official Form 106H — codebtors.
   Restyled to the bankruptcy.ai dark theme.

   ── INTEGRATION CONTRACT ──────────────────────────────────────────────
   PROP-DRIVEN. Pass the full questionnaire `data` object.
   creditorIds on each codebtor entry are resolved at render:
     "D-{n}" → data.schedD.creditors[n]
     "E-{n}" → data.schedEF_pri.creditors[n]
     "F-{n}" → data.schedEF_np.creditors[n]

   <ScheduleHReview
     data={questionnaireData}
     confirmed={summaryConfirmed}
     onConfirm={onSummaryConfirm}
     communityConfirmed={communityConfirmed}
     onCommunityConfirm={communityRequired ? onCommunityConfirm : undefined}
   />
   ─────────────────────────────────────────────────────────────────────── */

function resolveCreditorId(id, data) {
  const [prefix, idxStr] = id.split("-");
  const i = parseInt(idxStr, 10);
  if (prefix === "D") {
    const c = data?.schedD?.creditors?.[i];
    return { name: c?.name || id, sched: "D" };
  }
  if (prefix === "E") {
    const c = data?.schedEF_pri?.creditors?.[i];
    return { name: c?.name || c?.authority || id, sched: "E/F-1" };
  }
  if (prefix === "F") {
    const c = data?.schedEF_np?.creditors?.[i];
    return { name: c?.name || id, sched: "E/F-2" };
  }
  return { name: id, sched: "?" };
}

export default function ScheduleHReview({
  data,
  confirmed,
  onConfirm,
  communityConfirmed,
  onCommunityConfirm,
}) {
  const pd     = data?.petition || {};
  const debtor = [pd.firstName, pd.lastName].filter(Boolean).join(" ") || "Debtor";

  const codebtors = useMemo(() =>
    (data?.schedH?.codebtors || []).flatMap((c) => {
      const ids = c.creditorIds || [];
      if (ids.length === 0) {
        return [{ name: c.name || "Unknown", address: c.addr || "—", creditor: "—", schedule: "—" }];
      }
      return ids.map((id) => {
        const { name: credName, sched } = resolveCreditorId(id, data);
        return { name: c.name || "Unknown", address: c.addr || "—", creditor: credName, schedule: sched };
      });
    }),
  [data]);

  return (
    <div className="sh">
      <Style />
      <h1><Users size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule H — Codebtors</h1>
      <div className="form">Official Form 106H · {debtor}</div>
      <div className="card">
        <div className="ph">Codebtors</div>
        {codebtors.length === 0
          ? <div className="empty">None reported — no other person is liable on any of the debtor's debts (no co-signers, guarantors, or community-property codebtors).</div>
          : codebtors.map((c, i) => (
            <div className="row" key={i}>
              <span>{c.name}<br /><small>{c.address}</small></span>
              <span className="rel">{c.creditor} · Sched {c.schedule}</span>
            </div>
          ))}
        <div className="note">Verify with the client: co-signers, guarantors, ex-spouses on joint debts, and — in community-property states (WA / AZ) — a non-filing spouse can be a codebtor.</div>
      </div>
      <ConfirmFooter
        confirmed={confirmed}
        onConfirm={onConfirm}
        communityConfirmed={communityConfirmed}
        onCommunityConfirm={onCommunityConfirm}
        sectionLabel="co-debtor information"
      />
    </div>
  );
}

function Style() {
  return <style>{`
    .sh * { box-sizing:border-box; }
    .sh {
      --accent:#fbbf24; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8;
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:840px; margin:16px auto 0; }
    .sh h1 { font-family:var(--serif); font-weight:600; font-size:24px; margin:0; color:#fff; }
    .sh .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .sh .card { background:var(--bg); border:1px solid var(--line); border-radius:16px; padding:18px 20px; margin-top:16px; }
    .sh .ph { font-family:var(--serif); font-size:13px; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:.04em; margin:0 0 8px; }
    .sh .row { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:13.5px; padding:8px 0; border-bottom:1px solid var(--line-soft); }
    .sh .row small { color:var(--muted); font-size:12px; }
    .sh .rel { font-weight:600; text-align:right; }
    .sh .empty { color:var(--muted); font-style:italic; font-size:13.5px; padding:4px 0; line-height:1.5; }
    .sh .note { font-size:12.5px; color:var(--muted); background:var(--bg-2); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:12px 0 2px; }
  `}</style>;
}
