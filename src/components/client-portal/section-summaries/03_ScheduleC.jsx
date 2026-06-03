import React, { useMemo } from "react";
import { ShieldCheck, AlertCircle } from "lucide-react";
import ConfirmFooter from "./ConfirmFooter";

/* Schedule C — Official Form 106C — exemptions review (DRAFT).
   Raw-data pattern: pass the full questionnaire `data` object.

   IMPORTANT: exemption amounts are attorney-determined. This component
   intentionally shows NO computed exemption amounts, NO net-equity-after-
   exemption figures, and NO liquidation-value totals — those numbers would
   be $0 without attorney input and would falsely indicate every asset is
   fully exposed to creditors.

   <ScheduleCReview
     data={questionnaireData}
     confirmed={summaryConfirmed}
     onConfirm={onSummaryConfirm}
     communityConfirmed={communityConfirmed}
     onCommunityConfirm={communityRequired ? onCommunityConfirm : undefined}
   /> */

const money = (n) =>
  "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pf = (v) => parseFloat(v) || 0;

function buildAssets(data) {
  const re  = data?.schedAB_re  || {};
  const phy = data?.schedAB_phy || {};
  const fin = data?.schedAB_fin || {};
  const assets = [];

  /* Part 1 — Real estate */
  (re.properties || []).forEach((p) => {
    const mortgage = pf(p.mortgageBalance) + pf(p.mortgageArrears);
    const juniors  = (p.secondLiens || []).reduce((s, l) => s + pf(l.balance), 0);
    assets.push({
      name:  [p.addr, p.city, p.state].filter(Boolean).join(", ") || "Real property",
      note:  p.propertyType === "primary" ? "Primary residence" : p.propertyType || undefined,
      value: pf(p.value),
      liens: mortgage + juniors,
      part:  1,
    });
  });

  /* Part 2 — Vehicles */
  [...(phy.vehicles || []), ...(phy.otherVehicles || [])].forEach((v) => {
    assets.push({
      name:  [v.year, v.make, v.model].filter(Boolean).join(" ") || v.type || "Vehicle",
      value: pf(v.value),
      liens: pf(v.loanBalance),
      part:  2,
    });
  });

  /* Part 3 — Personal & household items (grouped totals only) */
  const push = (name, value, opts = {}) => {
    if (value > 0) assets.push({ name, value, liens: 0, part: 3, ...opts });
  };

  push("Household goods & furnishings", pf(phy.householdGoodsValue));
  push("Electronics",                   pf(phy.electronicsValue));
  push("Clothing & apparel",            pf(phy.clothing));

  const jewelryItems = phy.jewelryItems || [];
  if (jewelryItems.length > 0) {
    jewelryItems.forEach((j, i) => push(j.type || `Jewelry ${i + 1}`, pf(j.totalValue)));
  } else {
    push("Jewelry", pf(phy.jewelryValue));
  }

  (phy.collectibles || []).forEach((c, i) =>
    push(c.description || `Collectible ${i + 1}`, pf(c.value))
  );
  push("Animals & pets", pf(phy.pets));

  (phy.firearms || []).forEach((f, i) =>
    push([f.year, f.make, f.model, f.type].filter(Boolean).join(" ") || `Firearm ${i + 1}`, pf(f.value))
  );

  /* Part 4 — Financial assets */
  push("Cash on hand", pf(fin.cashOnHand));

  (fin.bankAccounts || []).forEach((a) =>
    push(`${a.bankName || "Bank"} — ${a.accountType || "Account"}`, pf(a.balance))
  );

  /* Retirement: shown with an ERISA note — still "attorney will determine" */
  (fin.retirement || []).forEach((a) => {
    if (pf(a.balance) > 0)
      assets.push({
        name:  [a.institution, a.accountType].filter(Boolean).join(" — ") || "Retirement account",
        value: pf(a.balance),
        liens: 0,
        part:  4,
        erisa: true,
      });
  });

  (fin.lifeInsurance || []).forEach((a, i) =>
    push(`Life insurance — ${a.insurerName || `policy ${i + 1}`} (cash value)`, pf(a.cashValue))
  );
  (fin.annuities || []).forEach((a, i) =>
    push(`${a.annuityType || "Annuity"} — ${a.issuerName || `annuity ${i + 1}`}`, pf(a.currentValue))
  );
  (fin.investments || []).forEach((inv) =>
    push(inv.institution || inv.description || "Investment account", pf(inv.value))
  );
  if (fin.hasStocks === "yes") push("Stocks & bonds", pf(fin.stocksValue));
  if (fin.hasCrypto === "yes") push("Cryptocurrency",  pf(fin.cryptoValue));

  return assets;
}

function domicileText(pd) {
  const state = pd.state || "—";
  const years = pd.addressYears;
  if (!years) return { state, rule: "Residency duration not yet entered" };
  if (years === "2+ years")
    return { state, rule: "730-day residency satisfied — " + state + " exemptions apply" };
  const inStateTwo = pd.inStateTwo;
  if (inStateTwo === "yes")
    return { state, rule: "180-day look-back — " + (pd.priorState || "prior state") + " exemptions may apply" };
  return { state, rule: "Domicile determination pending — your attorney will confirm" };
}

export default function ScheduleCReview({
  data,
  confirmed,
  onConfirm,
  communityConfirmed,
  onCommunityConfirm,
}) {
  const pd = data?.petition || {};
  const debtor = [pd.firstName, pd.lastName].filter(Boolean).join(" ") || "Debtor";

  const assets = useMemo(() => buildAssets(data), [data]);
  const dom    = useMemo(() => domicileText(pd),   [pd]);

  const hasAnyLiens = assets.some((a) => a.liens > 0);

  return (
    <div className="sc">
      <Style />

      {/* ── DRAFT BANNER ─────────────────────────────────────────────────── */}
      <div className="draft-banner">
        <AlertCircle size={15} className="shrink-0" />
        <span>
          <strong>Draft — your attorney will review and finalize your exemptions before filing.</strong>{" "}
          Values shown are based on your entries. Exemption amounts, protected property, and any liquidation analysis are determined by your attorney — none of those figures are shown here.
        </span>
      </div>

      <h1 style={{ marginTop: 20 }}>
        <ShieldCheck size={20} style={{ verticalAlign: -3, marginRight: 8 }} />
        Schedule C — Exemptions
      </h1>
      <div className="form">Official Form 106C · {debtor}</div>

      {/* ── Domicile ──────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="ph">Domicile — which exemption set applies</div>
        <div className="kv"><span className="k">State of residence</span><span className="v">{dom.state}</span></div>
        <div className="kv"><span className="k">730-day residency rule</span><span className="v atty">{dom.rule}</span></div>
        <div className="note">Your attorney applies the 730-day rule (§522(b)(3)(A)) and selects the strongest available exemption set — federal or state — before filing.</div>
      </div>

      {/* ── Asset list ────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="ph">Your assets — exemptions to be applied by attorney</div>

        {assets.length === 0 ? (
          <div className="empty">No assets entered yet — complete Schedule A/B first.</div>
        ) : (
          <>
            <div className={"grid-hdr " + (hasAnyLiens ? "has-liens" : "")}>
              <span>Asset</span>
              <span>Value</span>
              {hasAnyLiens && <span>Liens</span>}
              <span>Exemption</span>
            </div>

            {assets.map((a, i) => (
              <div className={"grid-row " + (hasAnyLiens ? "has-liens" : "")} key={i}>
                <span className="nm">
                  {a.name}
                  {a.note && <><br /><small>{a.note}</small></>}
                </span>
                <span className="num">{money(a.value)}</span>
                {hasAnyLiens && (
                  <span className="num muted">{a.liens > 0 ? money(a.liens) : "—"}</span>
                )}
                <span className="atty-cell">
                  {a.erisa
                    ? <><span className="atty-tag">ERISA — typically fully protected</span><span className="atty-sub">Attorney will confirm</span></>
                    : <span className="atty-tag">Attorney will determine</span>
                  }
                </span>
              </div>
            ))}

            <div className="note" style={{ marginTop: 14 }}>
              Exemption amounts, protected-property determinations, and any non-exempt equity calculations are not shown — those are prepared by your attorney using the applicable state or federal exemption schedules.
            </div>
          </>
        )}
      </div>

      <ConfirmFooter
        confirmed={confirmed}
        onConfirm={onConfirm}
        communityConfirmed={communityConfirmed}
        onCommunityConfirm={onCommunityConfirm}
        sectionLabel="exemptions"
      />
    </div>
  );
}

function Style() {
  return <style>{`
    .sc * { box-sizing:border-box; }
    .sc {
      --accent:#fbbf24; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8; --warn:#fcd34d; --warn-bg:rgba(251,191,36,.10);
      --atty:#a78bfa; --atty-bg:rgba(167,139,250,.10);
      --calc:#7dd3fc; --calc-bg:rgba(56,189,248,.12);
      --draft-bg:rgba(251,191,36,.08); --draft-border:rgba(251,191,36,.35);
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:900px; margin:16px auto 0; }
    .sc h1 { font-family:var(--serif); font-weight:600; font-size:24px; margin:0; color:#fff; }
    .sc .form { color:var(--muted); font-size:13px; margin-top:2px; }

    .sc .draft-banner {
      display:flex; gap:10px; align-items:flex-start;
      background:var(--draft-bg); border:1px solid var(--draft-border);
      border-radius:12px; padding:13px 16px; font-size:13px; color:var(--warn);
      line-height:1.5; }
    .sc .draft-banner strong { color:var(--warn); }

    .sc .card { background:var(--bg); border:1px solid var(--line); border-radius:16px; padding:18px 20px; margin-top:16px; }
    .sc .ph { font-family:var(--serif); font-size:13px; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:.04em; margin:0 0 8px; }
    .sc .kv { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-size:13.5px; padding:6px 0; border-bottom:1px solid var(--line-soft); align-items:start; }
    .sc .kv .k { color:var(--muted); }
    .sc .kv .v { font-weight:600; text-align:right; }
    .sc .kv .atty { color:var(--atty); font-weight:600; text-align:right; font-size:12.5px; }
    .sc .note { font-size:12.5px; color:var(--muted); background:var(--bg-2); border:1px dashed var(--line); border-radius:8px; padding:9px 12px; margin:12px 0 2px; }
    .sc .empty { color:var(--muted); font-style:italic; font-size:13px; padding:6px 0; }

    .sc .grid-hdr,
    .sc .grid-row {
      display:grid;
      grid-template-columns:2fr 1fr 1.6fr;
      gap:6px 12px; align-items:center;
      font-size:13px; padding:8px 0; border-bottom:1px solid var(--line-soft); }
    .sc .grid-hdr.has-liens,
    .sc .grid-row.has-liens { grid-template-columns:2fr 1fr 1fr 1.6fr; }
    .sc .grid-hdr { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); border-bottom:1px solid var(--line); padding-bottom:6px; }
    .sc .grid-row .nm { font-weight:600; }
    .sc .grid-row .nm small { display:block; font-weight:400; color:var(--muted); font-size:11.5px; }
    .sc .grid-row .num { text-align:right; font-variant-numeric:tabular-nums; font-weight:600; }
    .sc .grid-row .num.muted { color:var(--muted); font-weight:400; }
    .sc .atty-cell { display:flex; flex-direction:column; gap:2px; }
    .sc .atty-tag { font-size:11px; font-weight:700; color:var(--atty); background:var(--atty-bg); border:1px solid rgba(167,139,250,.25); border-radius:6px; padding:2px 7px; display:inline-block; }
    .sc .atty-sub { font-size:10.5px; color:var(--muted); }
  `}</style>;
}
