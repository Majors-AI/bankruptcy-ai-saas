import React, { useState, useMemo } from "react";
import { TrendingUp, Building2, Home, Users, Info } from "lucide-react";

/* Fillable Profit & Loss by source / month — lives inside the Document Portal.
   Captures monthly income & expenses for the lookback period (default 6 months,
   the means-test window) across three sources: self-employment/business, rental
   property, and other household/family income. Computes per-month net, the
   6-month total, and the monthly average that feeds the Means Test (Form 122)
   and Schedule I. Self-employed and rental clients complete this in place of (or
   alongside) uploading statements. Preview sample — bind to live data. */

const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });

const SECTIONS = [
  {
    id: "biz", title: "Self-employment / business", icon: <Building2 size={15} />,
    income: [["bizSales", "Gross receipts / sales"], ["bizOther", "Other business income"]],
    expenses: [["bizCogs", "Cost of goods / materials"], ["bizLabor", "Wages / contract labor"], ["bizRent", "Rent / lease"], ["bizUtil", "Utilities"], ["bizSupp", "Supplies"], ["bizVeh", "Vehicle / fuel"], ["bizIns", "Insurance"], ["bizTax", "Taxes / licenses"], ["bizOtherEx", "Other expenses"]],
  },
  {
    id: "rental", title: "Rental property income", icon: <Home size={15} />,
    income: [["rentGross", "Gross rents received"]],
    expenses: [["rentMort", "Mortgage interest"], ["rentTax", "Property tax"], ["rentIns", "Insurance"], ["rentRep", "Repairs / maintenance"], ["rentMgmt", "Management / HOA"], ["rentUtil", "Utilities paid by owner"]],
  },
  {
    id: "family", title: "Other household / family income", icon: <Users size={15} />,
    income: [["famSpouse", "Spouse / partner contribution"], ["famMember", "Other household member contribution"], ["famSupport", "Other regular family support"]],
    expenses: [],
  },
];

function lastMonths(n, asOf) {
  const base = asOf ? new Date(asOf) : new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    out.push(d.toLocaleString("en-US", { month: "short", year: "2-digit" }));
  }
  return out;
}

export default function ProfitAndLoss({ data = {} }) {
  const months = useMemo(() => lastMonths(data.monthCount || 6, data.asOf), [data.monthCount, data.asOf]);
  const [v, setV] = useState(data.values || {});
  const key = (row, m) => `${row}:${m}`;
  const get = (row, m) => v[key(row, m)] ?? "";
  const set = (row, m, val) => setV((p) => ({ ...p, [key(row, m)]: val === "" ? "" : Number(val) }));
  const num = (row, m) => Number(v[key(row, m)] || 0);

  const sumRowsMonth = (rows, m) => rows.reduce((a, [id]) => a + num(id, m), 0);
  const sumRowsTotal = (rows) => months.reduce((a, _, m) => a + sumRowsMonth(rows, m), 0);

  // per-month net across all sections
  const monthNet = (m) => SECTIONS.reduce((a, s) => a + sumRowsMonth(s.income, m) - sumRowsMonth(s.expenses, m), 0);
  const grandTotal = months.reduce((a, _, m) => a + monthNet(m), 0);
  const monthlyAvg = grandTotal / months.length;

  const Cell = ({ row, m }) => (
    <td className="cell"><input type="number" value={get(row, m)} onChange={(e) => set(row, m, e.target.value)} placeholder="0" /></td>
  );
  const RowLine = ({ id, label, expense }) => (
    <tr className={expense ? "ex" : ""}>
      <td className="lab">{label}</td>
      {months.map((_, m) => <Cell key={m} row={id} m={m} />)}
      <td className="rt">{money(months.reduce((a, _, m) => a + num(id, m), 0))}</td>
    </tr>
  );

  return (
    <div className="pl">
      <Style />
      <h1><TrendingUp size={21} style={{ verticalAlign: -3, marginRight: 8 }} />Profit &amp; Loss — by source &amp; month</h1>
      <div className="form">{months.length}-month worksheet · feeds the Means Test (Form 122) &amp; Schedule I</div>
      <div className="rule"><Info size={12} style={{ verticalAlign: -1 }} /> Enter monthly income and expenses for each source you have. The monthly net and the {months.length}-month average are calculated for you.</div>

      <div className="scroll">
        <table>
          <thead>
            <tr><th className="lab">Line item</th>{months.map((m) => <th key={m}>{m}</th>)}<th className="rt">Total</th></tr>
          </thead>
          {SECTIONS.map((s) => {
            const incTot = (m) => sumRowsMonth(s.income, m);
            const exTot = (m) => sumRowsMonth(s.expenses, m);
            return (
              <tbody key={s.id}>
                <tr className="sec"><td className="lab">{s.icon} {s.title}</td>{months.map((m, i) => <td key={i} />)}<td className="rt" /></tr>
                {s.income.map(([id, label]) => <RowLine key={id} id={id} label={label} />)}
                {s.expenses.map(([id, label]) => <RowLine key={id} id={id} label={label} expense />)}
                <tr className="net">
                  <td className="lab">Net — {s.title.split(" ")[0]}</td>
                  {months.map((_, m) => <td key={m} className="netc">{money(incTot(m) - exTot(m))}</td>)}
                  <td className="rt">{money(sumRowsTotal(s.income) - sumRowsTotal(s.expenses))}</td>
                </tr>
              </tbody>
            );
          })}
          <tbody>
            <tr className="grand">
              <td className="lab">Total monthly net (all sources)</td>
              {months.map((_, m) => <td key={m} className="netc">{money(monthNet(m))}</td>)}
              <td className="rt">{money(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="summary">
        <div className="stat"><span className="sl">{months.length}-month total net</span><span className="sv">{money(grandTotal)}</span></div>
        <div className="stat hl"><span className="sl">Monthly average → Form 122 / Schedule I</span><span className="sv">{money(monthlyAvg)}</span></div>
      </div>
      <button className="confirmbtn">Save Profit &amp; Loss worksheet</button>
    </div>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .pl * { box-sizing:border-box; }
    .pl { --oxblood:#6b1f2a; --oxblood-d:#54171f; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --good:#2f6b4f; --good-bg:#e4efe6; --crit:#a23030; --line:#ddd2c2;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:980px; margin:0 auto; }
    .pl h1 { font-family:'Fraunces',serif; font-weight:600; font-size:23px; margin:0; }
    .pl .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .pl .rule { font-size:12.5px; color:var(--muted); background:var(--paper-2); border-radius:9px; padding:10px 13px; margin-top:12px; line-height:1.5; }
    .pl .scroll { overflow-x:auto; margin-top:14px; border:1px solid var(--line); border-radius:12px; background:#fffdf8; }
    .pl table { border-collapse:collapse; width:100%; min-width:680px; font-size:12.5px; }
    .pl th, .pl td { padding:7px 9px; text-align:right; border-bottom:1px solid var(--paper-2); white-space:nowrap; }
    .pl thead th { background:var(--paper-2); color:var(--oxblood); font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:.03em; position:sticky; top:0; }
    .pl .lab { text-align:left; font-weight:500; position:sticky; left:0; background:#fffdf8; }
    .pl thead .lab { background:var(--paper-2); }
    .pl .sec .lab { font-family:'Fraunces',serif; font-weight:600; color:var(--oxblood); font-size:12.5px; padding-top:11px; }
    .pl tr.ex .lab { color:var(--muted); padding-left:16px; }
    .pl .cell input { width:74px; border:1px solid var(--line); border-radius:6px; padding:5px 7px; font:inherit; font-size:12.5px; text-align:right; background:var(--paper); }
    .pl tr.ex .cell input { background:#fbf6f3; }
    .pl .rt { font-weight:600; background:#faf6ef; }
    .pl .net td { background:var(--good-bg); font-weight:600; color:var(--good); border-top:1px solid var(--line); }
    .pl .net .lab { background:var(--good-bg); }
    .pl .grand td { background:#efe2e4; font-weight:700; color:var(--oxblood); font-size:13px; }
    .pl .grand .lab { background:#efe2e4; }
    .pl .netc { text-align:right; }
    .pl .summary { display:flex; gap:12px; flex-wrap:wrap; margin-top:14px; }
    .pl .stat { flex:1; min-width:200px; background:#fffdf8; border:1px solid var(--line); border-radius:11px; padding:13px 16px; display:flex; justify-content:space-between; align-items:center; }
    .pl .stat.hl { border:2px solid var(--oxblood); background:#fffdf8; }
    .pl .sl { font-size:12px; color:var(--muted); font-weight:600; } .pl .stat.hl .sl { color:var(--oxblood); }
    .pl .sv { font-family:'Fraunces',serif; font-weight:600; font-size:19px; }
    .pl .confirmbtn { margin-top:14px; border:none; border-radius:10px; padding:12px 22px; font:inherit; font-weight:600; font-size:14px; cursor:pointer; background:var(--oxblood); color:#fff; } .pl .confirmbtn:hover { background:var(--oxblood-d); }
  `}</style>;
}
