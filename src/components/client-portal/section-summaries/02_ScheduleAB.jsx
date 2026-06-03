import React, { useMemo } from "react";
import { Boxes } from "lucide-react";

/* Schedule A/B — Official Form 106A/B — property answer-summary review.
   Restyled to the bankruptcy.ai dark theme.

   ── INTEGRATION CONTRACT ──────────────────────────────────────────────
   PROP-DRIVEN. Pass the client's real property data via `parts`
   (the form's Parts 1–7) and `debtor`. EXAMPLE_PARTS is SAMPLE ONLY for
   standalone preview and MUST NOT ship. Wire `parts` from the
   questionnaire/Supabase during merge.

   <ScheduleABReview parts={abParts} debtor="Jane Sample" />
   ─────────────────────────────────────────────────────────────────────── */

const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* EXAMPLE ONLY — do not ship. Documents the expected shape:
   parts: { n:number, title:string, assets:{ desc:string, value:number, note?:string }[] }[] */
const EXAMPLE_PARTS = [
  { n: 1, title: "Real estate", assets: [{ desc: "Example residence", value: 0 }] },
  { n: 2, title: "Vehicles", assets: [] },
  { n: 3, title: "Personal & household items", assets: [] },
  { n: 4, title: "Financial assets", assets: [] },
  { n: 5, title: "Business-related property", assets: [] },
  { n: 6, title: "Farm & commercial-fishing property", assets: [] },
  { n: 7, title: "Other property not listed above", assets: [] },
];

export default function ScheduleABReview({ parts = EXAMPLE_PARTS, debtor = "Example Debtor" }) {
  const { computed, grand } = useMemo(() => {
    const p = parts.map((x) => ({ ...x, sub: x.assets.reduce((a, b) => a + (b.value || 0), 0) }));
    return { computed: p, grand: p.reduce((a, x) => a + x.sub, 0) };
  }, [parts]);
  return (
    <div className="sab">
      <Style />
      <h1><Boxes size={20} style={{ verticalAlign: -3, marginRight: 8 }} />Schedule A/B — Property</h1>
      <div className="form">Official Form 106A/B · {debtor}</div>
      <div className="card">
        {computed.map((p) => (
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
    .sab * { box-sizing:border-box; }
    .sab {
      --accent:#fbbf24; --bg:#0d1221; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8; --calc:#7dd3fc; --calc-bg:rgba(56,189,248,.12);
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:840px; margin:0 auto; }
    .sab h1 { font-family:var(--serif); font-weight:600; font-size:24px; margin:0; color:#fff; }
    .sab .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .sab .card { background:var(--bg); border:1px solid var(--line); border-radius:16px; padding:18px 20px; margin-top:16px; }
    .sab .ph { font-family:var(--serif); font-size:13px; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:.04em; margin:16px 0 6px; }
    .sab .ph:first-child { margin-top:0; }
    .sab .row { display:grid; grid-template-columns:1fr auto; gap:3px 16px; font-size:13.5px; padding:7px 0; border-bottom:1px solid var(--line-soft); }
    .sab .row small { color:var(--muted); font-size:12px; }
    .sab .row .amt { font-weight:600; text-align:right; white-space:nowrap; }
    .sab .sub { display:flex; justify-content:space-between; font-weight:600; color:var(--muted); font-size:13px; padding:7px 0 2px; }
    .sab .empty { color:var(--muted); font-style:italic; font-size:13px; padding:4px 0; }
    .sab .grand { display:flex; justify-content:space-between; align-items:center; font-family:var(--serif); font-weight:600; font-size:16px; margin-top:14px; padding-top:14px; border-top:2px solid var(--accent); color:#fff; }
    .sab .calc { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:var(--calc-bg); color:var(--calc); padding:1px 6px; border-radius:6px; margin-left:6px; }
  `}</style>;
}
