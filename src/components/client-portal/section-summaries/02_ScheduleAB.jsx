import React, { useMemo } from "react";
import { Boxes } from "lucide-react";
import ConfirmFooter from "./ConfirmFooter";

/* Schedule A/B — Official Form 106A/B — property answer-summary review.
   Raw-data pattern: pass the full questionnaire `data` object.

   <ScheduleABReview
     data={questionnaireData}
     confirmed={summaryConfirmed}
     onConfirm={onSummaryConfirm}
     communityConfirmed={communityConfirmed}
     onCommunityConfirm={communityRequired ? onCommunityConfirm : undefined}
   /> */

const money = (n) =>
  "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pf = (v) => parseFloat(v) || 0;

function buildParts(data) {
  const re  = data?.schedAB_re  || {};
  const fin = data?.schedAB_fin || {};
  const phy = data?.schedAB_phy || {};

  /* Part 1 — Real estate */
  const reAssets = (re.properties || []).map((p) => ({
    desc: [p.addr, p.city, p.state].filter(Boolean).join(", ") || "Real property",
    value: pf(p.value),
    note: p.propertyType === "primary" ? "Primary residence"
        : p.propertyType ? p.propertyType : undefined,
  }));

  /* Part 2 — Vehicles */
  const vehAssets = [
    ...(phy.vehicles || []),
    ...(phy.otherVehicles || []),
  ].map((v) => ({
    desc: [v.year, v.make, v.model].filter(Boolean).join(" ") || v.type || "Vehicle",
    value: pf(v.value),
  }));

  /* Part 3 — Personal & household items */
  const part3 = [];
  const push3 = (desc, v) => { if (v > 0) part3.push({ desc, value: v }); };

  push3("Household goods & furnishings", pf(phy.householdGoodsValue));
  push3("Electronics",                   pf(phy.electronicsValue));
  push3("Clothing & apparel",            pf(phy.clothing));

  const jewelryItems = phy.jewelryItems || [];
  if (jewelryItems.length > 0) {
    jewelryItems.forEach((j, i) => {
      const v = pf(j.totalValue);
      if (v) push3(j.type || `Jewelry ${i + 1}`, v);
    });
  } else {
    push3("Jewelry", pf(phy.jewelryValue));
  }

  const collectibles = phy.collectibles || [];
  collectibles.forEach((c, i) => {
    const v = pf(c.value);
    if (v) push3(c.description || `Collectible ${i + 1}`, v);
  });

  push3("Animals & pets", pf(phy.pets));

  const firearms = phy.firearms || [];
  firearms.forEach((f, i) => {
    const v = pf(f.value);
    if (v) push3([f.year, f.make, f.model, f.type].filter(Boolean).join(" ") || `Firearm ${i + 1}`, v);
  });

  /* Part 4 — Financial assets */
  const part4 = [];
  const push4 = (desc, v) => { if (v > 0) part4.push({ desc, value: v }); };

  push4("Cash on hand", pf(fin.cashOnHand));

  (fin.bankAccounts || []).forEach((a) =>
    push4(`${a.bankName || "Bank"} — ${a.accountType || "Account"}`, pf(a.balance))
  );

  (fin.retirement || []).forEach((a) =>
    push4(
      [a.institution, a.accountType].filter(Boolean).join(" — ") || "Retirement account",
      pf(a.balance)
    )
  );

  (fin.lifeInsurance || []).forEach((a, i) =>
    push4(
      `${a.policyType || "Life insurance"} — ${a.insurerName || `policy ${i + 1}`} (cash value)`,
      pf(a.cashValue)
    )
  );

  (fin.annuities || []).forEach((a, i) =>
    push4(
      `${a.annuityType || "Annuity"} — ${a.issuerName || `annuity ${i + 1}`}`,
      pf(a.currentValue)
    )
  );

  (fin.investments || []).forEach((inv) =>
    push4(inv.institution || inv.description || "Investment account", pf(inv.value))
  );

  (fin.fsaHsaAccounts || []).forEach((a) =>
    push4(`${a.accountType || "FSA/HSA"} — ${a.institution || ""}`.replace(/\s*—\s*$/, ""), pf(a.balance))
  );

  if (fin.hasStocks === "yes")
    push4(`Stocks & bonds${fin.stocksDesc ? " — " + fin.stocksDesc : ""}`, pf(fin.stocksValue));

  if (fin.hasCrypto === "yes")
    push4(`Cryptocurrency${fin.cryptoDesc ? " — " + fin.cryptoDesc : ""}`, pf(fin.cryptoValue));

  (fin.securityDeposits2 || []).forEach((dep) =>
    push4(`Security deposit — ${dep.heldBy || dep.purpose || "deposit"}`, pf(dep.amount))
  );

  /* Part 5 — Business-related property */
  const part5 = [];
  const otherItems = phy.otherItems || [];
  const toolItems = otherItems.filter((it) => it.category === "Work Tools & Equipment");
  const toolTotal = toolItems.reduce((s, it) => s + pf(it.value), 0);
  if (toolTotal) part5.push({ desc: "Tools of trade & equipment", value: toolTotal });

  return [
    { n: 1, title: "Real estate",                        assets: reAssets },
    { n: 2, title: "Vehicles",                           assets: vehAssets },
    { n: 3, title: "Personal & household items",         assets: part3 },
    { n: 4, title: "Financial assets",                   assets: part4 },
    { n: 5, title: "Business-related property",          assets: part5 },
    { n: 6, title: "Farm & commercial-fishing property", assets: [] },
    { n: 7, title: "Other property not listed above",    assets: [] },
  ];
}

export default function ScheduleABReview({
  data,
  confirmed,
  onConfirm,
  communityConfirmed,
  onCommunityConfirm,
}) {
  const pd = data?.petition || {};
  const debtor = [pd.firstName, pd.lastName].filter(Boolean).join(" ") || "Debtor";

  const { computed, grand } = useMemo(() => {
    const parts = buildParts(data);
    const p = parts.map((x) => ({ ...x, sub: x.assets.reduce((a, b) => a + (b.value || 0), 0) }));
    return { computed: p, grand: p.reduce((a, x) => a + x.sub, 0) };
  }, [data]);

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
        <div className="grand">
          <span>Total property value <span className="calc">auto</span></span>
          <span>{money(grand)}</span>
        </div>
      </div>
      <ConfirmFooter
        confirmed={confirmed}
        onConfirm={onConfirm}
        communityConfirmed={communityConfirmed}
        onCommunityConfirm={onCommunityConfirm}
        sectionLabel="assets"
      />
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
      color:var(--ink); background:transparent; padding:0; max-width:840px; margin:16px auto 0; }
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
