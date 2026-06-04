import React, { useMemo } from "react";
import { Boxes } from "lucide-react";

/* Schedule A/B — Official Form 106A/B — property answer-summary review.
   Assets grouped to the form's Parts 1–7. Iovin case. Self-contained. */

const money = (n) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PARTS = [
  { n: 1, title: "Real estate", assets: [
    { desc: "6047 Atlas Place SW, Seattle WA — single-family residence", value: 2000000, note: "secured $1,936,844" },
  ]},
  { n: 2, title: "Vehicles", assets: [
    { desc: "2017 Maserati Ghibli", value: 16000, note: "secured $15,916 (Ally)" },
    { desc: "2006 Volvo S60", value: 3000 },
  ]},
  { n: 3, title: "Personal & household items", assets: [] },
  { n: 4, title: "Financial assets", assets: [
    { desc: "Cash on hand", value: 200 },
    { desc: "BECU checking ••8067", value: 0 },
    { desc: "BECU checking ••1210", value: 0 },
    { desc: "PayPal", value: 0 },
    { desc: "Schwab — retirement", value: 109575.94 },
    { desc: "Equity Trust — retirement", value: 170000 },
    { desc: "Patents (intellectual property)", value: 0 },
    { desc: "Promissory note in default — G. Aminoff", value: 50000 },
  ]},
  { n: 5, title: "Business-related property", assets: [] },
  { n: 6, title: "Farm & commercial-fishing property", assets: [] },
  { n: 7, title: "Other property not listed above", assets: [] },
];

export default function ScheduleABReview() {
  const { parts, grand } = useMemo(() => {
    const p = PARTS.map((x) => ({ ...x, sub: x.assets.reduce((a, b) => a + b.value, 0) }));
    return { parts: p, grand: p.reduce((a, x) => a + x.sub, 0) };
  }, []);
  return (
    <div className="sab">
      <Style />
      <h1><Boxes size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule A/B — Property</h1>
      <div className="form">Official Form 106A/B · Christian E. Iovin</div>
      <div className="card">
        {parts.map((p) => (
          <div key={p.n}>
            <div className="ph">Part {p.n} · {p.title}</div>
            {p.assets.length === 0
              ? <div className="empty">None reported</div>
              : <>
                {p.assets.map((a, i) => (
                  <div className="row" key={i}>
                    <span>{a.desc}{a.note && <><br /><small>{a.note}</small></>}</span>
                    <span className="amt">{money(a.value)}</span>
                  </div>
                ))}
                <div className="sub"><span>Part {p.n} subtotal</span><span>{money(p.sub)}</span></div>
              </>}
          </div>
        ))}
        <div className="grand"><span>Total property value <span className="calc">auto</span></span><span>{money(grand)}</span></div>
      </div>
    </div>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    .sab * { box-sizing:border-box; }
    .sab { --oxblood:#6b1f2a; --paper:#f7f3ec; --paper-2:#ece4d8; --ink:#241c18; --muted:#8a7d72; --line:#ddd2c2; --calc:#2d5b8e; --calc-bg:#e4ecf5;
      font-family:'Hanken Grotesk',sans-serif; color:var(--ink); background:var(--paper); padding:24px; max-width:840px; margin:0 auto; }
    .sab h1 { font-family:'Fraunces',serif; font-weight:600; font-size:24px; margin:0; }
    .sab .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .sab .card { background:#fffdf8; border:1px solid var(--line); border-radius:13px; padding:18px 20px; margin-top:16px; }
    .sab .ph { font-family:'Fraunces',serif; font-size:13px; font-weight:600; color:var(--oxblood); text-transform:uppercase; letter-spacing:.04em; margin:16px 0 6px; }
    .sab .ph:first-child { margin-top:0; }
    .sab .row { display:grid; grid-template-columns:1fr auto; gap:3px 16px; font-size:13.5px; padding:7px 0; border-bottom:1px solid var(--paper-2); }
    .sab .row small { color:var(--muted); font-size:12px; }
    .sab .row .amt { font-weight:600; text-align:right; white-space:nowrap; }
    .sab .sub { display:flex; justify-content:space-between; font-weight:600; color:var(--muted); font-size:13px; padding:7px 0 2px; }
    .sab .empty { color:var(--muted); font-style:italic; font-size:13px; padding:4px 0; }
    .sab .grand { display:flex; justify-content:space-between; align-items:center; font-family:'Fraunces',serif; font-weight:600; font-size:16px; margin-top:14px; padding-top:14px; border-top:2px solid var(--oxblood); }
    .sab .calc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--calc-bg); color:var(--calc); padding:1px 6px; border-radius:6px; margin-left:6px; }
  `}</style>;
}
