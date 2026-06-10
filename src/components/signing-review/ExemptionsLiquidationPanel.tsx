// Exemptions & Liquidation Analysis — attorney-facing panel.
//
// Mounts inside SigningReview (step 7.5). Reads the client's intake
// form_data (same shape AllAnswersView uses) and presents a per-asset
// table: description, value, secured liens, equity, applicable
// exemption (from the centralized legal-reference store), claimed
// exempt $, non-exempt $.
//
// First-pass scope — get it visible + functional. Several pieces are
// TODO and clearly marked below:
//   - trustee fees / admin claims / costs of sale in the waterfall
//   - wildcard allocation across assets
//   - joint-debtor exemption doubling
//   - full state-vs-federal election rules
//   - persistence of the attorney's selections (today: local state only)
//
// Authorization:
//   - Attorney / supervising attorney → can edit selections + claimed $
//   - Everyone else → read-only view (selectors disabled, totals visible)

import { useEffect, useMemo, useState } from "react";
import { Scale, AlertTriangle, Info, Lock } from "lucide-react";
import {
  EXEMPTIONS_BY_JURISDICTION,
  getExemptionsFor,
  getWaHomesteadCap,
  type ExemptionItem,
} from "../../lib/irsMeansStandards";

interface Asset {
  id: string;
  /** Source category — drives default exemption suggestion. */
  category:
    | "real_property" | "vehicle" | "rec_vehicle" | "bank" | "retirement"
    | "life_insurance" | "annuity" | "household" | "electronics" | "jewelry"
    | "tools" | "firearms" | "collectibles" | "crypto" | "stocks"
    | "claims" | "tax_refund" | "hsa_fsa" | "business_asset" | "other";
  description: string;
  value: number;
  liens: number;
  /** Optional county hint (used by WA homestead lookup). */
  county?: string;
}

interface Props {
  formData: Record<string, unknown> | null;
  /** Client's domicile state — drives jurisdiction default. */
  clientState?: string;
  /** Client's county — used by WA homestead. */
  clientCounty?: string;
  /** Attorney edit rights. */
  canEdit: boolean;
}

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

// ─── Asset extraction from form_data ────────────────────────────────────────
//
// Mirrors AllAnswersView keys so we pull from the same source of truth.
// Each asset gets a stable id so the attorney's exemption selection survives
// re-renders.

function extractAssets(fd: Record<string, unknown> | null, defaultCounty?: string): Asset[] {
  if (!fd) return [];
  const out: Asset[] = [];

  // Real property — primary residence
  if (fd.ownsRealEstate === "yes") {
    const val = num(fd.realPropValue);
    const lien = num(fd.mortgageBalance);
    if (val > 0 || lien > 0) {
      out.push({
        id: "rp:primary",
        category: "real_property",
        description: `Primary residence — ${String(fd.realPropAddress || "address not specified")}`,
        value: val,
        liens: lien,
        county: String(fd.county || defaultCounty || ""),
      });
    }
  }
  // Real property — second property
  if (fd.secondProperty === "yes") {
    const val = num(fd.secondPropValue);
    const lien = num(fd.secondMortgage);
    if (val > 0 || lien > 0) {
      out.push({
        id: "rp:second",
        category: "real_property",
        description: `Second property — ${String(fd.secondPropAddress || "address not specified")}`,
        value: val,
        liens: lien,
        county: String(fd.county || defaultCounty || ""),
      });
    }
  }

  // Vehicles
  if (fd.hasVehicles === "yes" && Array.isArray(fd.vehicles)) {
    (fd.vehicles as Array<Record<string, unknown>>).forEach((v, i) => {
      const val = num(v.value);
      const lien = num(v.loanBalance);
      const desc = `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim() || `Vehicle ${i + 1}`;
      if (val > 0 || lien > 0) {
        out.push({ id: `veh:${i}`, category: "vehicle", description: desc, value: val, liens: lien });
      }
    });
  }
  // Recreational vehicles
  if (fd.hasRecreationalVehicles === "yes" && Array.isArray(fd.recreationalVehicles)) {
    (fd.recreationalVehicles as Array<Record<string, unknown>>).forEach((rv, i) => {
      const val = num(rv.value);
      const lien = num(rv.loanBalance);
      const desc = `${rv.year || ""} ${rv.make || ""} ${rv.model || ""}`.trim() || String(rv.type || `Rec vehicle ${i + 1}`);
      if (val > 0 || lien > 0) {
        out.push({ id: `rv:${i}`, category: "rec_vehicle", description: desc, value: val, liens: lien });
      }
    });
  }

  // Bank accounts
  if (fd.hasBankAccounts === "yes" && Array.isArray(fd.bankAccounts)) {
    (fd.bankAccounts as Array<Record<string, unknown>>).forEach((b, i) => {
      const val = num(b.balance);
      if (val > 0) {
        out.push({
          id: `bank:${i}`,
          category: "bank",
          description: `${b.bankName || "Bank"} — ${b.accountType || "account"}`,
          value: val,
          liens: 0,
        });
      }
    });
  }

  // HSA / FSA
  if (fd.hasHsaFsa === "yes" && Array.isArray(fd.hsaFsaEntries)) {
    (fd.hsaFsaEntries as Array<Record<string, unknown>>).forEach((h, i) => {
      const val = num(h.balance);
      if (val > 0) {
        out.push({
          id: `hsa:${i}`,
          category: "hsa_fsa",
          description: `${h.accountType || "HSA/FSA"} — ${h.provider || "provider"}`,
          value: val,
          liens: 0,
        });
      }
    });
  }

  // Retirement accounts
  if (fd.hasRetirement === "yes" && Array.isArray(fd.retirementAccounts)) {
    (fd.retirementAccounts as Array<Record<string, unknown>>).forEach((r, i) => {
      const val = num(r.balance);
      if (val > 0) {
        out.push({
          id: `ret:${i}`,
          category: "retirement",
          description: `${r.accountType || "Retirement"} — ${r.provider || ""}`.trim(),
          value: val,
          liens: 0,
        });
      }
    });
  }

  // Life insurance policies (cash value)
  if (Array.isArray(fd.lifePolicies)) {
    (fd.lifePolicies as Array<Record<string, unknown>>).forEach((p, i) => {
      const val = num(p.cashValue);
      if (val > 0) {
        out.push({
          id: `life:${i}`,
          category: "life_insurance",
          description: `Life insurance — ${p.insurer || ""} ${p.policyType || ""}`.trim(),
          value: val,
          liens: 0,
        });
      }
    });
  }

  // Annuities
  if (fd.hasAnnuities === "yes" && Array.isArray(fd.annuities)) {
    (fd.annuities as Array<Record<string, unknown>>).forEach((a, i) => {
      const val = num(a.value);
      if (val > 0) {
        out.push({
          id: `ann:${i}`,
          category: "annuity",
          description: `Annuity — ${a.carrier || ""}`,
          value: val,
          liens: 0,
        });
      }
    });
  }

  // Personal property — single-bucket fields
  const buckets: Array<{ key: string; cat: Asset["category"]; label: string }> = [
    { key: "householdGoodsValue",  cat: "household",   label: "Household goods" },
    { key: "electronicsValue",     cat: "electronics", label: "Electronics" },
    { key: "jewelryValue",         cat: "jewelry",     label: "Jewelry" },
    { key: "toolsValue",           cat: "tools",       label: "Tools of trade" },
    { key: "collectiblesValue",    cat: "collectibles",label: "Collectibles" },
    { key: "cryptoValue",          cat: "crypto",      label: "Cryptocurrency" },
    { key: "stocksValue",          cat: "stocks",      label: "Stocks / brokerage" },
    { key: "otherPersonalPropValue", cat: "other",    label: "Other personal property" },
  ];
  for (const b of buckets) {
    const val = num(fd[b.key]);
    if (val > 0) {
      out.push({ id: `pp:${b.key}`, category: b.cat, description: b.label, value: val, liens: 0 });
    }
  }

  // Firearms (sum)
  if (fd.hasFirearms === "yes" && Array.isArray(fd.firearms)) {
    const total = (fd.firearms as Array<Record<string, unknown>>).reduce((a, f) => a + num(f.value), 0);
    if (total > 0) {
      out.push({ id: "pp:firearms", category: "firearms", description: "Firearms", value: total, liens: 0 });
    }
  }

  // Business assets (sum)
  if (fd.hasBusinessAssets === "yes" && Array.isArray(fd.businessAssets)) {
    const total = (fd.businessAssets as Array<Record<string, unknown>>).reduce((a, b) => a + num(b.estimatedValue), 0);
    if (total > 0) {
      out.push({ id: "pp:business", category: "business_asset", description: "Business assets", value: total, liens: 0 });
    }
  }

  // Pending claims (Schedule A/B asset)
  if (fd.hasPendingClaims === "yes") {
    const val = num(fd.pendingClaimsValue);
    out.push({
      id: "claim:pending",
      category: "claims",
      description: `Pending claim — ${String(fd.pendingClaimsDesc || "unspecified")}`,
      value: val,
      liens: 0,
    });
  }

  return out;
}

// ─── Default-exemption suggester ────────────────────────────────────────────
//
// Best-guess: match by category to a labelled exemption in the chosen
// jurisdiction. Attorney can always override.

function suggestExemption(asset: Asset, items: ReadonlyArray<ExemptionItem>): ExemptionItem | null {
  const lower = (s: string) => s.toLowerCase();
  const labels = items.map(it => ({ it, l: lower(it.label) }));
  const find = (...needles: string[]) => labels.find(({ l }) => needles.every(n => l.includes(n)))?.it ?? null;

  switch (asset.category) {
    case "real_property":   return find("homestead");
    case "vehicle":         return find("motor vehicle") || find("vehicle");
    case "rec_vehicle":     return find("motor vehicle") || find("other personal");
    case "household":       return find("household") || find("furnishings");
    case "electronics":     return find("household") || find("electron");
    case "jewelry":         return find("jewelry") || find("ring");
    case "tools":           return find("tools");
    case "firearms":        return find("firearm");
    case "collectibles":    return find("other personal") || find("household");
    case "bank":            return find("bank account") || find("other personal");
    case "retirement":      return find("retirement");
    case "life_insurance":  return find("life insurance");
    case "annuity":         return find("annuity");
    case "claims":          return find("personal injury") || find("crime victim") || find("wrongful death");
    case "hsa_fsa":         return find("health aid") || find("other personal");
    case "crypto":          return find("other personal");
    case "stocks":          return find("other personal");
    case "business_asset":  return find("tools");
    default:                return null;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ExemptionsLiquidationPanel({ formData, clientState, clientCounty, canEdit }: Props) {
  const defaultJurisdiction = useMemo(() => {
    const s = (clientState || "").toUpperCase();
    if (s === "AZ") return "AZ";
    if (s === "WA") return "WA";
    return "Federal";
  }, [clientState]);

  const [jurisdiction, setJurisdiction] = useState<string>(defaultJurisdiction);
  const jur = getExemptionsFor(jurisdiction);

  const assets = useMemo(() => extractAssets(formData, clientCounty), [formData, clientCounty]);

  // Per-asset attorney selections — local state only today.
  // TODO: persist to signing_reviews row or a new exemptions_workspace table.
  const [selections, setSelections] = useState<Record<string, { exemptionStatute: string; claimed: number }>>({});

  // Re-seed defaults when jurisdiction or assets change.
  useEffect(() => {
    if (!jur) return;
    const next: Record<string, { exemptionStatute: string; claimed: number }> = {};
    for (const a of assets) {
      const equity = Math.max(0, a.value - a.liens);
      const suggested = suggestExemption(a, jur.items);
      let claimed = 0;
      let statute = suggested?.statute ?? "";
      if (suggested) {
        let cap = suggested.limit;
        // WA homestead — per-county cap override.
        if (jurisdiction === "WA" && suggested.statute.includes("6.13") && (a.county || clientCounty)) {
          const c = a.county || clientCounty || "";
          const wa = getWaHomesteadCap(c);
          if (wa != null) cap = wa;
        }
        claimed = cap == null ? equity : Math.min(cap, equity);
      }
      next[a.id] = { exemptionStatute: statute, claimed };
    }
    setSelections(next);
  }, [jurisdiction, assets, jur, clientCounty]);

  const rows = useMemo(() => {
    return assets.map(a => {
      const equity = Math.max(0, a.value - a.liens);
      const sel = selections[a.id] || { exemptionStatute: "", claimed: 0 };
      const exemptItem = jur?.items.find(it => it.statute === sel.exemptionStatute);
      // For WA homestead, the cap depends on county.
      let cap: number | null = exemptItem?.limit ?? null;
      if (jurisdiction === "WA" && exemptItem?.statute.includes("6.13")) {
        const c = a.county || clientCounty || "";
        const wa = getWaHomesteadCap(c);
        if (wa != null) cap = wa;
      }
      const maxClaimable = cap == null ? equity : Math.min(cap, equity);
      const claimed = Math.min(Math.max(0, sel.claimed), maxClaimable);
      const nonExempt = Math.max(0, equity - claimed);
      return { asset: a, equity, exemptItem, cap, claimed, nonExempt };
    });
  }, [assets, selections, jur, jurisdiction, clientCounty]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        value: acc.value + r.asset.value,
        liens: acc.liens + r.asset.liens,
        equity: acc.equity + r.equity,
        claimed: acc.claimed + r.claimed,
        nonExempt: acc.nonExempt + r.nonExempt,
      }),
      { value: 0, liens: 0, equity: 0, claimed: 0, nonExempt: 0 },
    );
  }, [rows]);

  if (!jur) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-200">
        Could not load exemptions for {jurisdiction}.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <Scale className="w-4.5 h-4.5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Exemptions & Liquidation Analysis</h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              First-pass attorney workspace. Pulls assets from intake, applies the chosen exemption set, and computes non-exempt equity for the Ch.7 liquidation / Ch.13 best-interests-of-creditors test.
            </p>
          </div>
        </div>
        {!canEdit && (
          <span className="text-[10px] uppercase tracking-widest text-slate-400 bg-slate-800 border border-slate-700 rounded-full px-2 py-1 inline-flex items-center gap-1">
            <Lock className="w-3 h-3" /> Read-only (attorney edit required)
          </span>
        )}
      </div>

      {/* Jurisdiction selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-slate-400">Exemption set:</label>
        <select
          value={jurisdiction}
          onChange={e => setJurisdiction(e.target.value)}
          disabled={!canEdit || (clientState?.toUpperCase() === "AZ")}
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white disabled:opacity-60"
        >
          {Object.keys(EXEMPTIONS_BY_JURISDICTION).map(k => (
            <option key={k} value={k}>{EXEMPTIONS_BY_JURISDICTION[k].jurisdiction}</option>
          ))}
        </select>
        <span className="text-[10px] uppercase tracking-widest text-slate-400 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">
          Election: {jur.election}
        </span>
        {clientState && (
          <span className="text-[10px] uppercase tracking-widest text-slate-400 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">
            Client state: {clientState}
          </span>
        )}
        {!jur.verified && (
          <span className="text-[10px] uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Not attorney-verified
          </span>
        )}
      </div>
      {clientState?.toUpperCase() === "AZ" && (
        <p className="text-[11px] text-slate-500 italic">Arizona is opt-out; the federal set is not available — AZ exemptions only.</p>
      )}
      {clientState?.toUpperCase() === "WA" && (
        <p className="text-[11px] text-slate-500 italic">Washington allows election of state OR federal. Toggle above to compare.</p>
      )}

      {/* Assets table */}
      {assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-xs text-slate-400">
          No assets pulled from intake. Confirm the client has completed Schedule A/B sections.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700 bg-[#0d1221] overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-800/60">
              <tr className="text-slate-400 uppercase tracking-widest text-[10px]">
                <th className="text-left  px-3 py-2">Asset</th>
                <th className="text-right px-3 py-2">Value</th>
                <th className="text-right px-3 py-2">Liens</th>
                <th className="text-right px-3 py-2">Equity</th>
                <th className="text-left  px-3 py-2">Applicable exemption (statute · cap)</th>
                <th className="text-right px-3 py-2">Claimed $</th>
                <th className="text-right px-3 py-2">Non-exempt $</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.asset.id} className="border-t border-slate-700/60 text-slate-200">
                  <td className="px-3 py-2">
                    <div className="font-semibold">{r.asset.description}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">{r.asset.category.replace(/_/g, " ")}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.asset.value)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-400">{fmt(r.asset.liens)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmt(r.equity)}</td>
                  <td className="px-3 py-2">
                    <select
                      value={r.exemptItem?.statute ?? ""}
                      onChange={e => setSelections(prev => ({ ...prev, [r.asset.id]: { ...(prev[r.asset.id] || { claimed: 0, exemptionStatute: "" }), exemptionStatute: e.target.value } }))}
                      disabled={!canEdit}
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white w-full max-w-[22rem] disabled:opacity-60"
                    >
                      <option value="">— pick an exemption —</option>
                      {jur.items.map((it, idx) => {
                        const capLabel = it.limit == null ? "no fixed limit" : `$${it.limit.toLocaleString()}`;
                        return (
                          <option key={`${it.statute}-${idx}`} value={it.statute}>
                            {it.label} · {it.statute} · {capLabel}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      value={r.claimed || 0}
                      onChange={e => {
                        const v = parseFloat(e.target.value) || 0;
                        setSelections(prev => ({ ...prev, [r.asset.id]: { ...(prev[r.asset.id] || { exemptionStatute: "" }), claimed: v } }));
                      }}
                      disabled={!canEdit}
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white w-24 text-right tabular-nums disabled:opacity-60"
                    />
                    {r.cap != null && (
                      <p className="text-[10px] text-slate-500 mt-0.5">cap ${r.cap.toLocaleString()}</p>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums font-bold ${r.nonExempt > 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {fmt(r.nonExempt)}
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="border-t border-slate-600 bg-slate-800/40 font-bold">
                <td className="px-3 py-2 text-slate-300">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totals.value)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totals.liens)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totals.equity)}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totals.claimed)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${totals.nonExempt > 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {fmt(totals.nonExempt)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Outcome block */}
      <div className={`rounded-xl border p-4 ${totals.nonExempt > 0 ? "border-red-500/30 bg-red-500/5" : "border-emerald-500/30 bg-emerald-500/5"}`}>
        {totals.nonExempt > 0 ? (
          <>
            <p className="text-sm font-bold text-red-300 mb-1">
              ⚠ Non-exempt equity: <span className="tabular-nums">{fmt(totals.nonExempt)}</span>
            </p>
            <p className="text-xs text-red-200 leading-relaxed">
              In a <strong>Chapter 7 liquidation</strong>, approximately <strong>{fmt(totals.nonExempt)}</strong> of non-exempt equity would be available to the trustee for unsecured creditors.
            </p>
            <p className="text-xs text-red-200 leading-relaxed mt-1">
              For <strong>Chapter 13</strong>, this <strong>{fmt(totals.nonExempt)}</strong> is the <strong>§ 1325(a)(4) best-interests-of-creditors floor</strong> — the plan must pay general unsecured creditors <em>at least this amount</em>.
            </p>
            <div className="mt-2 text-[11px] text-red-200/80">
              Assets with non-exempt exposure:
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {rows.filter(r => r.nonExempt > 0).map(r => (
                  <li key={r.asset.id}>{r.asset.description} — {fmt(r.nonExempt)} exposed</li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <p className="text-sm font-bold text-emerald-300">
            ✓ All scheduled assets appear fully exempt; no non-exempt equity for liquidation.
          </p>
        )}
      </div>

      {/* TODO / scaffold disclaimers */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3 text-[11px] text-slate-400 leading-relaxed space-y-1">
        <p className="flex items-center gap-1.5 font-semibold text-slate-300"><Info className="w-3 h-3" /> First-pass scope — TODO:</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>Trustee fees, administrative / priority claims, and costs of sale in the liquidation waterfall.</li>
          <li>Wildcard allocation across multiple assets (e.g., applying § 522(d)(5) unused homestead to other personal property).</li>
          <li>Joint-debtor exemption doubling (jurisdiction-specific rules).</li>
          <li>Full state-vs-federal election rules (residency / domicile checks, opt-out matrix).</li>
          <li>Persistence of the attorney's exemption selections — today: component state only.</li>
        </ul>
      </div>
    </div>
  );
}
