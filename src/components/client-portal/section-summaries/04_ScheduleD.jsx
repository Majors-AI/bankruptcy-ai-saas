import React, { useMemo } from "react";
import { Home, Car } from "lucide-react";
import ConfirmFooter from "./ConfirmFooter";

/* Schedule D — Official Form 106D — secured creditors review.
   Raw-data pattern: pass the full questionnaire `data` object.

   <ScheduleDReview
     data={questionnaireData}
     confirmed={summaryConfirmed}
     onConfirm={onSummaryConfirm}
     communityConfirmed={communityConfirmed}
     onCommunityConfirm={communityRequired ? onCommunityConfirm : undefined}
   /> */

const money = (n) =>
  "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Same collateral-type detection used in SectionSchedD tabs. */
const isREType = (collateral) => {
  const c = (collateral || "").toLowerCase();
  return c.includes("real property") || c.includes("residence") || c.includes("primary") ||
    c.includes("heloc") || c.includes("hoa") || c.includes("house") || c.includes("home") || c.includes("land");
};
const isVehType = (collateral) => {
  const c = (collateral || "").toLowerCase();
  if (isREType(collateral)) return false;
  return /^\d{4}\s/.test(c) || c.includes("vehicle") || c.includes("car") || c.includes("truck") ||
    c.includes("motorcycle") || c.includes("boat") || c.includes("rv") ||
    c.includes("title loan") || c.includes("registration");
};

function kindOf(c) {
  if (isREType(c.collateral)) return "home";
  if (isVehType(c.collateral)) return "vehicle";
  return "other";
}

export default function ScheduleDReview({
  data,
  confirmed,
  onConfirm,
  communityConfirmed,
  onCommunityConfirm,
}) {
  const pd = data?.petition || {};
  const debtor = [pd.firstName, pd.lastName].filter(Boolean).join(" ") || "Debtor";

  const secured = useMemo(() => {
    return (data?.schedD?.creditors || []).map((c) => ({
      name:       c.name || "Unknown creditor",
      kind:       kindOf(c),
      collateral: c.collateral || "—",
      lien:       c.consideration || "—",
      value:      parseFloat(c.collateralValue) || 0,
      balance:    parseFloat(c.amount)          || 0,
    }));
  }, [data]);

  const total = useMemo(() => secured.reduce((a, c) => a + c.balance, 0), [secured]);

  const homes    = secured.filter((c) => c.kind === "home");
  const vehicles = secured.filter((c) => c.kind === "vehicle");
  const others   = secured.filter((c) => c.kind === "other");

  const homeLiens = homes.reduce((a, c) => a + c.balance, 0);
  const homeValue = homes.length ? Math.max(...homes.map((c) => c.value || 0)) : 0;

  return (
    <div className="sd">
      <Style />
      <h1><Home size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule D — Secured creditors</h1>
      <div className="form">Official Form 106D · {debtor}</div>
      <div className="card">
        {homes.length > 0 && <>
          <div className="ph"><Home size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Real property (homes)</div>
          {homes.map((c, i) => <Cred key={i} c={c} />)}
        </>}
        {vehicles.length > 0 && <>
          <div className="ph"><Car size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Vehicles</div>
          {vehicles.map((c, i) => <Cred key={i} c={c} />)}
        </>}
        {others.length > 0 && <>
          <div className="ph">Other secured</div>
          {others.map((c, i) => <Cred key={i} c={c} />)}
        </>}
        {secured.length === 0 && <div className="empty">None reported</div>}
        <div className="grand">
          <span>Total secured claims (D) <span className="calc">auto</span></span>
          <span>{money(total)}</span>
        </div>
        {homes.length > 0 && homeValue > 0 && (
          <div className="note">
            Home liens total {money(homeLiens)} against a {money(homeValue)} value — roughly {money(homeValue - homeLiens)} equity. Flag for the Schedule C exemption review.
          </div>
        )}
      </div>
      <ConfirmFooter
        confirmed={confirmed}
        onConfirm={onConfirm}
        communityConfirmed={communityConfirmed}
        onCommunityConfirm={onCommunityConfirm}
        sectionLabel="secured debts"
      />
    </div>
  );
}

function Cred({ c }) {
  return (
    <div className="row">
      <span>{c.name}<br /><small>{c.lien} · {c.collateral}</small></span>
      <span className="col">collateral {money(c.value)}</span>
      <span className="amt">{money(c.balance)}</span>
    </div>
  );
}

function Style() {
  return <style>{`
    .sd * { box-sizing:border-box; }
    .sd {
      --accent:#fbbf24; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8; --calc:#7dd3fc; --calc-bg:rgba(56,189,248,.12);
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:840px; margin:16px auto 0; }
    .sd h1 { font-family:var(--serif); font-weight:600; font-size:24px; margin:0; color:#fff; }
    .sd .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .sd .card { background:var(--bg); border:1px solid var(--line); border-radius:16px; padding:18px 20px; margin-top:16px; }
    .sd .ph { font-family:var(--serif); font-size:13px; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:.04em; margin:16px 0 6px; }
    .sd .ph:first-child { margin-top:0; }
    .sd .row { display:grid; grid-template-columns:1fr auto auto; gap:4px 14px; align-items:center; font-size:13.5px; padding:8px 0; border-bottom:1px solid var(--line-soft); }
    .sd .row small { color:var(--muted); font-size:12px; }
    .sd .col { font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:rgba(251,191,36,.12); color:var(--accent); padding:2px 8px; border-radius:999px; white-space:nowrap; }
    .sd .amt { font-weight:600; text-align:right; white-space:nowrap; }
    .sd .empty { color:var(--muted); font-style:italic; font-size:13px; padding:4px 0; }
    .sd .grand { display:flex; justify-content:space-between; align-items:center; font-family:var(--serif); font-weight:600; font-size:16px; margin-top:14px; padding-top:14px; border-top:2px solid var(--accent); color:#fff; }
    .sd .calc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--calc-bg); color:var(--calc); padding:1px 6px; border-radius:6px; margin-left:6px; }
    .sd .note { font-size:12.5px; color:var(--muted); background:var(--bg-2); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:10px 0 2px; }
  `}</style>;
}
