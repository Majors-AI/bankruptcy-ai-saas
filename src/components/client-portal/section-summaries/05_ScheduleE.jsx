import React, { useMemo } from "react";
import { Landmark } from "lucide-react";
import ConfirmFooter from "./ConfirmFooter";

/* Schedule E — Official Form 106E/F (Part 1) — priority unsecured creditors.
   Restyled to the bankruptcy.ai dark theme.

   ── INTEGRATION CONTRACT ──────────────────────────────────────────────
   PROP-DRIVEN. Pass the full questionnaire `data` object.

   <ScheduleEReview
     data={questionnaireData}
     confirmed={summaryConfirmed}
     onConfirm={onSummaryConfirm}
     communityConfirmed={communityConfirmed}
     onCommunityConfirm={communityRequired ? onCommunityConfirm : undefined}
   />
   ─────────────────────────────────────────────────────────────────────── */

const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ScheduleEReview({
  data,
  confirmed,
  onConfirm,
  communityConfirmed,
  onCommunityConfirm,
}) {
  const pd     = data?.petition || {};
  const debtor = [pd.firstName, pd.lastName].filter(Boolean).join(" ") || "Debtor";

  const priority = useMemo(() => [
    ...(data?.schedEF_pri?.taxDebts || []).map((c) => ({
      name:   c.authority || c.name || "Tax authority",
      basis:  c.taxType   || c.consideration || "Income taxes",
      amount: parseFloat(c.balance || c.amountOwed) || 0,
      type:   "Tax",
    })),
    ...(data?.schedEF_pri?.creditors || []).map((c) => ({
      name:   c.name || c.authority || "Unknown",
      basis:  c.consideration || c._category || "Priority claim",
      amount: parseFloat(c.balance || c.amountOwed) || 0,
      type:   c._category === "support" ? "Support" : "Priority",
    })),
  ], [data]);

  const total   = useMemo(() => priority.reduce((a, c) => a + c.amount, 0), [priority]);
  const hasZero = priority.some((c) => !c.amount);

  return (
    <div className="se">
      <Style />
      <h1><Landmark size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule E — Priority unsecured</h1>
      <div className="form">Official Form 106E/F (Part 1) · {debtor}</div>
      <div className="card">
        <div className="ph">Priority claims</div>
        {priority.length === 0
          ? <div className="empty">None reported</div>
          : priority.map((c, i) => (
            <div className="row" key={i}>
              <span>{c.name}<br /><small>{c.basis}</small></span>
              <span className="pill">{c.type}</span>
              <span className="amt">{money(c.amount)}</span>
            </div>
          ))}
        <div className="grand"><span>Total priority claims (E) <span className="calc">auto</span></span><span>{money(total)}</span></div>
        {hasZero && <div className="note">Zero-balance support claims are listed for notice; confirm current arrears with the client / support agency.</div>}
      </div>
      <ConfirmFooter
        confirmed={confirmed}
        onConfirm={onConfirm}
        communityConfirmed={communityConfirmed}
        onCommunityConfirm={onCommunityConfirm}
        sectionLabel="priority debts"
      />
    </div>
  );
}

function Style() {
  return <style>{`
    .se * { box-sizing:border-box; }
    .se {
      --accent:#fbbf24; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8; --warn:#fcd34d; --warn-bg:rgba(251,191,36,.10);
      --calc:#7dd3fc; --calc-bg:rgba(56,189,248,.12);
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:840px; margin:16px auto 0; }
    .se h1 { font-family:var(--serif); font-weight:600; font-size:24px; margin:0; color:#fff; }
    .se .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .se .card { background:var(--bg); border:1px solid var(--line); border-radius:16px; padding:18px 20px; margin-top:16px; }
    .se .ph { font-family:var(--serif); font-size:13px; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:.04em; margin:0 0 6px; }
    .se .row { display:grid; grid-template-columns:1fr auto auto; gap:4px 14px; align-items:center; font-size:13.5px; padding:8px 0; border-bottom:1px solid var(--line-soft); }
    .se .row small { color:var(--muted); font-size:12px; }
    .se .pill { font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--warn-bg); color:var(--warn); padding:2px 8px; border-radius:999px; white-space:nowrap; }
    .se .amt { font-weight:600; text-align:right; white-space:nowrap; }
    .se .empty { color:var(--muted); font-style:italic; font-size:13px; padding:4px 0; }
    .se .grand { display:flex; justify-content:space-between; align-items:center; font-family:var(--serif); font-weight:600; font-size:16px; margin-top:14px; padding-top:14px; border-top:2px solid var(--accent); color:#fff; }
    .se .calc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--calc-bg); color:var(--calc); padding:1px 6px; border-radius:6px; margin-left:6px; }
    .se .note { font-size:12.5px; color:var(--muted); background:var(--bg-2); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:10px 0 2px; }
  `}</style>;
}
